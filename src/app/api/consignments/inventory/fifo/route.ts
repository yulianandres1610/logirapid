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
 * GET /api/consignments/inventory/fifo
 * Obtiene lotes FIFO disponibles para un producto en un almacen
 * Query: warehouseId, productId
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const warehouseId = searchParams.get('warehouseId')
    const productId = searchParams.get('productId')

    if (!warehouseId || !productId) {
      return NextResponse.json({
        success: false,
        error: 'warehouseId y productId son requeridos'
      }, { status: 400 })
    }

    // Get available lots ordered by FIFO (oldest first)
    const result = await db.query(`
      SELECT
        cli.id as lot_id,
        cli.lot_number,
        cli.expiration_date,
        cli.quantity_available,
        cli.unit_cost,
        cli.received_at,
        cs.id as supplier_id,
        cs.code as supplier_code,
        cs.name as supplier_name,
        co.order_number
      FROM consignment_lot_inventory cli
      JOIN consignment_suppliers cs ON cs.id = cli.supplier_id
      JOIN consignment_order_lines col ON col.id = cli.order_line_id
      JOIN consignment_orders co ON co.id = col.order_id
      WHERE cli.warehouse_id = $1
        AND cli.product_id = $2
        AND cli.company_id = $3
        AND cli.quantity_available > 0
      ORDER BY cli.received_at ASC, cli.expiration_date ASC NULLS LAST
    `, [parseInt(warehouseId), parseInt(productId), payload.companyId])

    const lots = result.rows.map(lot => ({
      lotId: lot.lot_id,
      lotNumber: lot.lot_number,
      expirationDate: lot.expiration_date,
      quantityAvailable: parseInt(lot.quantity_available),
      unitCost: parseFloat(lot.unit_cost),
      receivedAt: lot.received_at,
      supplier: {
        id: lot.supplier_id,
        code: lot.supplier_code,
        name: lot.supplier_name
      },
      orderNumber: lot.order_number
    }))

    const totalAvailable = lots.reduce((sum, lot) => sum + lot.quantityAvailable, 0)

    return NextResponse.json({
      success: true,
      data: {
        lots,
        totalAvailable,
        isConsignment: lots.length > 0
      }
    })

  } catch (error) {
    console.error('[FIFO Inventory GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al cargar inventario FIFO'
    }, { status: 500 })
  }
}

interface SaleItem {
  productId: number
  quantity: number
  salePrice: number
}

/**
 * POST /api/consignments/inventory/fifo
 * Procesa venta FIFO - descuenta de lotes y actualiza wallet proveedor
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { warehouseId, items, posOrderId, posOrderNumber } = await request.json() as {
      warehouseId: number
      items: SaleItem[]
      posOrderId?: number
      posOrderNumber?: string
    }

    if (!warehouseId || !items || items.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'warehouseId e items son requeridos'
      }, { status: 400 })
    }

    const results: Array<{
      productId: number
      quantity: number
      lotDeductions: Array<{ lotId: number; lotNumber: string; quantity: number; unitCost: number }>
      supplierEarnings: Array<{ supplierId: number; amount: number }>
    }> = []

    for (const item of items) {
      let remainingQty = item.quantity
      const lotDeductions: Array<{ lotId: number; lotNumber: string; quantity: number; unitCost: number }> = []
      const supplierEarnings = new Map<number, number>()

      // Get available lots FIFO
      const lotsResult = await db.query(`
        SELECT
          cli.id as lot_id,
          cli.lot_number,
          cli.quantity_available,
          cli.unit_cost,
          cli.supplier_id,
          cli.order_line_id
        FROM consignment_lot_inventory cli
        WHERE cli.warehouse_id = $1
          AND cli.product_id = $2
          AND cli.company_id = $3
          AND cli.quantity_available > 0
        ORDER BY cli.received_at ASC
        FOR UPDATE
      `, [warehouseId, item.productId, payload.companyId])

      for (const lot of lotsResult.rows) {
        if (remainingQty <= 0) break

        const availableQty = parseInt(lot.quantity_available)
        const toDeduct = Math.min(remainingQty, availableQty)
        const unitCost = parseFloat(lot.unit_cost)

        // Deduct from lot
        await db.query(`
          UPDATE consignment_lot_inventory
          SET
            quantity_available = quantity_available - $1,
            quantity_sold = quantity_sold + $1
          WHERE id = $2
        `, [toDeduct, lot.lot_id])

        // Update order line
        await db.query(`
          UPDATE consignment_order_lines
          SET quantity_sold = quantity_sold + $1
          WHERE id = $2
        `, [toDeduct, lot.order_line_id])

        // Track lot deduction
        lotDeductions.push({
          lotId: lot.lot_id,
          lotNumber: lot.lot_number,
          quantity: toDeduct,
          unitCost
        })

        // Accumulate supplier earnings (at cost price)
        const currentEarnings = supplierEarnings.get(lot.supplier_id) || 0
        supplierEarnings.set(lot.supplier_id, currentEarnings + (toDeduct * unitCost))

        remainingQty -= toDeduct
      }

      // Update supplier wallets
      const supplierEarningsArray: Array<{ supplierId: number; amount: number }> = []

      for (const [supplierId, amount] of supplierEarnings) {
        // Get wallet
        const walletResult = await db.query(
          'SELECT id FROM consignment_supplier_wallets WHERE supplier_id = $1',
          [supplierId]
        )

        if (walletResult.rows.length > 0) {
          const walletId = walletResult.rows[0].id

          // Update wallet balance
          await db.query(`
            UPDATE consignment_supplier_wallets
            SET
              balance_available = balance_available + $1,
              total_earned = total_earned + $1,
              updated_at = NOW()
            WHERE id = $2
          `, [amount, walletId])

          // Create transaction
          await db.query(`
            INSERT INTO consignment_wallet_transactions (
              wallet_id, transaction_type, amount, pos_order_id, pos_order_number, notes, created_by
            ) VALUES ($1, 'sale', $2, $3, $4, $5, $6)
          `, [
            walletId,
            amount,
            posOrderId || null,
            posOrderNumber || null,
            `Venta POS: ${item.quantity} unidades`,
            payload.userId
          ])
        }

        supplierEarningsArray.push({ supplierId, amount })
      }

      results.push({
        productId: item.productId,
        quantity: item.quantity - remainingQty,
        lotDeductions,
        supplierEarnings: supplierEarningsArray
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Venta FIFO procesada exitosamente',
      data: { results }
    })

  } catch (error) {
    console.error('[FIFO Sale POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al procesar venta FIFO'
    }, { status: 500 })
  }
}
