import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
}

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null

  try {
    const secret = process.env.JWT_SECRET || 'fallback-secret'
    return jwt.verify(token, secret) as JWTPayload
  } catch {
    return null
  }
}

/**
 * POST /api/market/warehouses/[id]/supplier-returns
 * Procesa una devolución a proveedor de consignación
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await db.getClient()

  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const warehouseId = parseInt(id)
    const body = await request.json()
    const { supplierId, reason, notes, lines } = body

    if (!supplierId || !lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Datos de devolución incompletos'
      }, { status: 400 })
    }

    await client.query('BEGIN')

    // Ensure schema is up to date (migration safe)
    try {
      await client.query(`ALTER TABLE consignment_returns ADD COLUMN IF NOT EXISTS notes TEXT`)
      await client.query(`ALTER TABLE consignment_returns ALTER COLUMN order_id DROP NOT NULL`)
      await client.query(`ALTER TABLE consignment_return_lines ADD COLUMN IF NOT EXISTS quantity INTEGER`)
      await client.query(`ALTER TABLE consignment_return_lines ADD COLUMN IF NOT EXISTS total_value DECIMAL(12,2)`)
    } catch {
      // Columns might already be correct, continue anyway
    }

    // Get supplier info
    const supplierResult = await client.query(
      'SELECT id, code, name FROM consignment_suppliers WHERE id = $1 AND company_id = $2',
      [supplierId, payload.companyId]
    )

    if (supplierResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({
        success: false,
        error: 'Proveedor no encontrado'
      }, { status: 404 })
    }

    const supplier = supplierResult.rows[0]

    // Generate return number
    const returnNumberResult = await client.query(`
      SELECT COUNT(*) + 1 as next_number
      FROM consignment_returns
      WHERE company_id = $1
    `, [payload.companyId])
    const returnNumber = `DEV-${supplier.code}-${new Date().getFullYear()}-${String(returnNumberResult.rows[0].next_number).padStart(4, '0')}`

    // Create return record
    const returnResult = await client.query(`
      INSERT INTO consignment_returns (
        return_number, company_id, warehouse_id, supplier_id,
        reason, notes, status, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'completed', $7, NOW())
      RETURNING id
    `, [returnNumber, payload.companyId, warehouseId, supplierId, reason, notes || null, payload.userId])

    const returnId = returnResult.rows[0].id
    let totalUnits = 0
    let totalValue = 0

    // Process each line
    for (const line of lines) {
      const { productId, lotInventoryId, quantity } = line

      if (!productId || !lotInventoryId || !quantity || quantity <= 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({
          success: false,
          error: 'Línea de devolución inválida'
        }, { status: 400 })
      }

      // Get lot inventory info and validate
      const lotResult = await client.query(`
        SELECT
          cli.id,
          cli.order_line_id,
          cli.quantity_available,
          cli.quantity_returned,
          cli.unit_cost,
          col.order_id,
          mp.name as product_name
        FROM consignment_lot_inventory cli
        JOIN consignment_order_lines col ON col.id = cli.order_line_id
        JOIN market_products mp ON mp.id = cli.product_id
        WHERE cli.id = $1
          AND cli.product_id = $2
          AND cli.supplier_id = $3
          AND cli.warehouse_id = $4
          AND cli.company_id = $5
      `, [lotInventoryId, productId, supplierId, warehouseId, payload.companyId])

      if (lotResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({
          success: false,
          error: 'Lote no encontrado'
        }, { status: 404 })
      }

      const lot = lotResult.rows[0]

      if (quantity > lot.quantity_available) {
        await client.query('ROLLBACK')
        return NextResponse.json({
          success: false,
          error: `No hay suficiente stock disponible para ${lot.product_name}. Disponible: ${lot.quantity_available}`
        }, { status: 400 })
      }

      const lineValue = quantity * parseFloat(lot.unit_cost)

      // Create return line
      await client.query(`
        INSERT INTO consignment_return_lines (
          return_id, product_id, lot_inventory_id, quantity, unit_cost, total_value
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [returnId, productId, lotInventoryId, quantity, lot.unit_cost, lineValue])

      // Update lot inventory: decrease available, increase returned
      await client.query(`
        UPDATE consignment_lot_inventory
        SET
          quantity_available = quantity_available - $1,
          quantity_returned = COALESCE(quantity_returned, 0) + $1,
          updated_at = NOW()
        WHERE id = $2
      `, [quantity, lotInventoryId])

      // Update order line: increase returned
      await client.query(`
        UPDATE consignment_order_lines
        SET
          quantity_returned = COALESCE(quantity_returned, 0) + $1,
          updated_at = NOW()
        WHERE id = $2
      `, [quantity, lot.order_line_id])

      // Update warehouse stock
      await client.query(`
        UPDATE market_warehouse_stock
        SET
          quantity_on_hand = quantity_on_hand - $1,
          updated_at = NOW()
        WHERE warehouse_id = $2 AND product_id = $3
      `, [quantity, warehouseId, productId])

      // Create inventory movement
      await client.query(`
        INSERT INTO market_inventory_movements (
          company_id, warehouse_id, product_id,
          movement_type, quantity, reference_type, reference_id,
          notes, created_by, created_at
        ) VALUES ($1, $2, $3, 'return', $4, 'consignment_return', $5, $6, $7, NOW())
      `, [
        payload.companyId, warehouseId, productId,
        -quantity, returnId,
        `Devolución a proveedor ${supplier.name}`,
        payload.userId
      ])

      totalUnits += quantity
      totalValue += lineValue
    }

    // Get wallet for this supplier
    const walletResult = await client.query(`
      SELECT id FROM consignment_supplier_wallets WHERE supplier_id = $1
    `, [supplierId])

    if (walletResult.rows.length > 0) {
      const walletId = walletResult.rows[0].id

      // Update supplier wallet: decrease balance_available, increase total_returned
      await client.query(`
        UPDATE consignment_supplier_wallets
        SET
          balance_available = balance_available - $1,
          total_returned = COALESCE(total_returned, 0) + $1,
          updated_at = NOW()
        WHERE id = $2
      `, [totalValue, walletId])

      // Create wallet transaction
      await client.query(`
        INSERT INTO consignment_wallet_transactions (
          wallet_id, transaction_type, amount, notes, created_at
        ) VALUES ($1, 'return', $2, $3, NOW())
      `, [walletId, -totalValue, `Devolución ${returnNumber}: ${totalUnits} unidades`])
    }

    // Check if any orders should be closed (fully returned/sold)
    const ordersToCheck = await client.query(`
      SELECT DISTINCT col.order_id
      FROM consignment_return_lines crl
      JOIN consignment_lot_inventory cli ON cli.id = crl.lot_inventory_id
      JOIN consignment_order_lines col ON col.id = cli.order_line_id
      WHERE crl.return_id = $1
    `, [returnId])

    for (const row of ordersToCheck.rows) {
      const orderCheck = await client.query(`
        SELECT
          o.id,
          o.status,
          SUM(ol.quantity_received) as total_received,
          SUM(COALESCE(ol.quantity_sold, 0)) as total_sold,
          SUM(COALESCE(ol.quantity_returned, 0)) as total_returned
        FROM consignment_orders o
        JOIN consignment_order_lines ol ON ol.order_id = o.id
        WHERE o.id = $1
        GROUP BY o.id, o.status
      `, [row.order_id])

      if (orderCheck.rows.length > 0) {
        const order = orderCheck.rows[0]
        const totalAccounted = parseInt(order.total_sold) + parseInt(order.total_returned)
        const totalReceived = parseInt(order.total_received)

        // If everything is accounted for (sold + returned >= received), close the order
        if (totalAccounted >= totalReceived && order.status !== 'liquidated') {
          await client.query(`
            UPDATE consignment_orders
            SET
              status = 'liquidated',
              completed_at = NOW(),
              updated_at = NOW()
            WHERE id = $1
          `, [row.order_id])
        }
      }
    }

    // Update return totals
    await client.query(`
      UPDATE consignment_returns
      SET
        total_units = $1,
        total_value = $2
      WHERE id = $3
    `, [totalUnits, totalValue, returnId])

    await client.query('COMMIT')

    return NextResponse.json({
      success: true,
      message: `Devolución ${returnNumber} procesada exitosamente`,
      data: {
        returnId,
        returnNumber,
        totalUnits,
        totalValue,
        supplier: {
          id: supplier.id,
          code: supplier.code,
          name: supplier.name
        }
      }
    })

  } catch (error) {
    await client.query('ROLLBACK')
    console.error('[Supplier Returns] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar devolución'
    }, { status: 500 })
  } finally {
    client.release()
  }
}
