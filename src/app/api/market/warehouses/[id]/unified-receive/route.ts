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

interface ReceivedLine {
  lineId: number
  productId: number
  quantityReceived: number
  lotNumber: string
  expirationDate?: string
}

interface ReceiveRequest {
  orderType: 'consignment' | 'purchase'
  orderId: number
  lines: ReceivedLine[]
}

/**
 * POST /api/market/warehouses/[id]/unified-receive
 * Procesa recepcion unificada para consignaciones y compras
 * Crea entradas FIFO y actualiza inventario
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const warehouseId = parseInt(id)
    const body: ReceiveRequest = await request.json()
    const { orderType, orderId, lines } = body

    if (!orderType || !orderId || !lines || lines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Datos de recepcion incompletos'
      }, { status: 400 })
    }

    // Verify warehouse belongs to company
    const warehouseResult = await db.query(`
      SELECT id, name, code FROM market_warehouses
      WHERE id = $1 AND company_id = $2
    `, [warehouseId, payload.companyId])

    if (warehouseResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Almacen no encontrado'
      }, { status: 404 })
    }

    const warehouse = warehouseResult.rows[0]
    let orderNumber = ''
    let supplierCode = ''
    let supplierName = ''
    let supplierId = 0
    let totalUnitsReceived = 0
    let processedLines = 0

    const today = new Date()
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '').slice(2) // YYMMDD

    if (orderType === 'consignment') {
      // Process consignment reception
      const orderResult = await db.query(`
        SELECT o.*, s.code as supplier_code, s.name as supplier_name
        FROM consignment_orders o
        JOIN consignment_suppliers s ON s.id = o.supplier_id
        WHERE o.id = $1 AND o.company_id = $2
      `, [orderId, payload.companyId])

      if (orderResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Orden de consignacion no encontrada'
        }, { status: 404 })
      }

      const order = orderResult.rows[0]
      if (order.status === 'received') {
        return NextResponse.json({
          success: false,
          error: 'Esta orden ya fue recibida completamente'
        }, { status: 400 })
      }

      orderNumber = order.order_number
      supplierCode = order.supplier_code
      supplierName = order.supplier_name
      supplierId = order.supplier_id

      // VALIDACIÓN: Verificar que ningún producto tenga stock de OTRO proveedor de consignación
      for (const line of lines) {
        if (line.quantityReceived <= 0) continue

        const conflictCheck = await db.query(`
          SELECT
            cli.supplier_id,
            cs.code as supplier_code,
            cs.name as supplier_name,
            cli.unit_cost,
            SUM(cli.quantity_available) as total_available
          FROM consignment_lot_inventory cli
          JOIN consignment_suppliers cs ON cs.id = cli.supplier_id
          WHERE cli.warehouse_id = $1
            AND cli.product_id = $2
            AND cli.quantity_available > 0
            AND cli.supplier_id != $3
          GROUP BY cli.supplier_id, cs.code, cs.name, cli.unit_cost
        `, [warehouseId, line.productId, supplierId])

        if (conflictCheck.rows.length > 0) {
          const conflict = conflictCheck.rows[0]
          // Obtener nombre del producto
          const productResult = await db.query(
            'SELECT name FROM market_products WHERE id = $1',
            [line.productId]
          )
          const productName = productResult.rows[0]?.name || 'Producto'

          return NextResponse.json({
            success: false,
            error: 'supplier_conflict',
            conflict: {
              productId: line.productId,
              productName,
              existingSupplier: {
                id: parseInt(conflict.supplier_id),
                code: conflict.supplier_code,
                name: conflict.supplier_name,
                unitCost: parseFloat(conflict.unit_cost),
                stockAvailable: parseInt(conflict.total_available)
              },
              message: `El producto "${productName}" tiene ${conflict.total_available} unidades en consignación del proveedor ${conflict.supplier_name} a $${parseFloat(conflict.unit_cost).toFixed(2)}. Debe devolver todo el stock antes de consignar con otro proveedor.`
            }
          }, { status: 409 })
        }
      }

      // Process each line
      for (const line of lines) {
        if (line.quantityReceived <= 0) continue

        // Get order line details
        const lineResult = await db.query(`
          SELECT * FROM consignment_order_lines WHERE id = $1 AND order_id = $2
        `, [line.lineId, orderId])

        if (lineResult.rows.length === 0) continue

        const orderLine = lineResult.rows[0]

        // Generate lot number if not provided
        let lotNumber = line.lotNumber
        if (!lotNumber) {
          const seqResult = await db.query(`
            SELECT COUNT(*) as count FROM consignment_lot_inventory
            WHERE lot_number LIKE $1
          `, [`${supplierCode}${dateStr}%`])
          const seq = (parseInt(seqResult.rows[0].count) + 1).toString().padStart(2, '0')
          lotNumber = `${supplierCode}${dateStr}${seq}`
        }

        // Update order line
        await db.query(`
          UPDATE consignment_order_lines SET
            quantity_received = COALESCE(quantity_received, 0) + $1,
            lot_number = $2,
            expiration_date = $3
          WHERE id = $4
        `, [
          line.quantityReceived,
          lotNumber,
          line.expirationDate || null,
          line.lineId
        ])

        // Create FIFO inventory entry
        await db.query(`
          INSERT INTO consignment_lot_inventory (
            company_id, warehouse_id, product_id, order_line_id, supplier_id,
            lot_number, expiration_date, quantity_initial, quantity_available, unit_cost
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9)
          ON CONFLICT (warehouse_id, product_id, lot_number) DO UPDATE SET
            quantity_initial = consignment_lot_inventory.quantity_initial + $8,
            quantity_available = consignment_lot_inventory.quantity_available + $8
        `, [
          payload.companyId,
          warehouseId,
          orderLine.product_id,
          line.lineId,
          supplierId,
          lotNumber,
          line.expirationDate || null,
          line.quantityReceived,
          orderLine.unit_cost
        ])

        // Update warehouse stock (upsert manual por índice con variant_id)
        const stockExists = await db.query(`
          SELECT id, quantity_on_hand FROM market_warehouse_stock
          WHERE warehouse_id = $1 AND product_id = $2 AND variant_id IS NULL
        `, [warehouseId, orderLine.product_id])

        if (stockExists.rows.length > 0) {
          await db.query(`
            UPDATE market_warehouse_stock SET
              quantity_on_hand = quantity_on_hand + $1,
              last_movement_at = NOW(),
              updated_at = NOW()
            WHERE warehouse_id = $2 AND product_id = $3 AND variant_id IS NULL
          `, [line.quantityReceived, warehouseId, orderLine.product_id])
        } else {
          await db.query(`
            INSERT INTO market_warehouse_stock (
              warehouse_id, product_id, variant_id, quantity_on_hand, quantity_reserved,
              last_movement_at, created_at, updated_at
            ) VALUES ($1, $2, NULL, $3, 0, NOW(), NOW(), NOW())
          `, [warehouseId, orderLine.product_id, line.quantityReceived])
        }

        totalUnitsReceived += line.quantityReceived
        processedLines++
      }

      // Check if order is fully received
      const pendingResult = await db.query(`
        SELECT COUNT(*) as pending FROM consignment_order_lines
        WHERE order_id = $1 AND quantity_ordered > COALESCE(quantity_received, 0)
      `, [orderId])

      const newStatus = parseInt(pendingResult.rows[0].pending) === 0 ? 'received' : 'partial'

      // Update order status
      await db.query(`
        UPDATE consignment_orders SET
          status = $1,
          warehouse_id = COALESCE(warehouse_id, $2),
          received_at = CASE WHEN $1 = 'received' THEN NOW() ELSE received_at END,
          received_by = $3,
          updated_at = NOW()
        WHERE id = $4
      `, [newStatus, warehouseId, payload.userId, orderId])

      // Create wallet transaction for received goods
      const walletResult = await db.query(
        'SELECT id FROM consignment_supplier_wallets WHERE supplier_id = $1',
        [supplierId]
      )

      if (walletResult.rows.length > 0) {
        await db.query(`
          INSERT INTO consignment_wallet_transactions (
            wallet_id, order_id, transaction_type, amount, notes, created_by
          ) VALUES ($1, $2, 'received', 0, $3, $4)
        `, [
          walletResult.rows[0].id,
          orderId,
          `Recepcion de orden ${orderNumber}: ${totalUnitsReceived} unidades en ${warehouse.name}`,
          payload.userId
        ])
      }

    } else if (orderType === 'purchase') {
      // Process purchase reception
      const purchaseResult = await db.query(`
        SELECT p.*, ms.code as supplier_code
        FROM market_purchases p
        LEFT JOIN market_suppliers ms ON ms.id = p.supplier_id
        WHERE p.id = $1 AND p.company_id = $2
      `, [orderId, payload.companyId])

      if (purchaseResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Orden de compra no encontrada'
        }, { status: 404 })
      }

      const purchase = purchaseResult.rows[0]
      if (purchase.status === 'recibido') {
        return NextResponse.json({
          success: false,
          error: 'Esta compra ya fue recibida completamente'
        }, { status: 400 })
      }

      orderNumber = purchase.purchase_number
      supplierCode = purchase.supplier_code || 'PROV'
      supplierName = purchase.supplier_name || 'Proveedor'
      supplierId = purchase.supplier_id || 0

      // Process each line
      for (const line of lines) {
        if (line.quantityReceived <= 0) continue

        // Get purchase line details
        const lineResult = await db.query(`
          SELECT * FROM market_purchase_lines WHERE id = $1 AND purchase_id = $2
        `, [line.lineId, orderId])

        if (lineResult.rows.length === 0) continue

        const purchaseLine = lineResult.rows[0]

        // Generate lot number if not provided
        let lotNumber = line.lotNumber
        if (!lotNumber) {
          const seqResult = await db.query(`
            SELECT COUNT(*) as count FROM purchase_lot_inventory
            WHERE lot_number LIKE $1
          `, [`${supplierCode}${dateStr}%`])
          const seq = (parseInt(seqResult.rows[0]?.count || '0') + 1).toString().padStart(2, '0')
          lotNumber = `${supplierCode}${dateStr}${seq}`
        }

        // Update purchase line
        await db.query(`
          UPDATE market_purchase_lines SET
            quantity_received = COALESCE(quantity_received, 0) + $1,
            lot_number = $2,
            expiration_date = $3
          WHERE id = $4
        `, [
          line.quantityReceived,
          lotNumber,
          line.expirationDate || null,
          line.lineId
        ])

        // Ensure purchase_lot_inventory table exists and create FIFO entry
        await db.query(`
          CREATE TABLE IF NOT EXISTS purchase_lot_inventory (
            id SERIAL PRIMARY KEY,
            company_id INTEGER NOT NULL,
            warehouse_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            purchase_line_id INTEGER,
            supplier_id INTEGER,
            lot_number VARCHAR(50) NOT NULL,
            expiration_date DATE,
            manufacturing_date DATE,
            quantity_initial INTEGER NOT NULL DEFAULT 0,
            quantity_available INTEGER NOT NULL DEFAULT 0,
            quantity_sold INTEGER NOT NULL DEFAULT 0,
            unit_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
            received_at TIMESTAMP DEFAULT NOW(),
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(warehouse_id, product_id, lot_number)
          )
        `)

        // Create FIFO inventory entry for purchase
        await db.query(`
          INSERT INTO purchase_lot_inventory (
            company_id, warehouse_id, product_id, purchase_line_id, supplier_id,
            lot_number, expiration_date, quantity_initial, quantity_available, unit_cost
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9)
          ON CONFLICT (warehouse_id, product_id, lot_number) DO UPDATE SET
            quantity_initial = purchase_lot_inventory.quantity_initial + $8,
            quantity_available = purchase_lot_inventory.quantity_available + $8
        `, [
          payload.companyId,
          warehouseId,
          purchaseLine.product_id,
          line.lineId,
          supplierId,
          lotNumber,
          line.expirationDate || null,
          line.quantityReceived,
          purchaseLine.unit_price || 0
        ])

        // Update main product inventory
        await db.query(`
          UPDATE market_products SET
            quantity_on_hand = COALESCE(quantity_on_hand, 0) + $1,
            quantity_expected = GREATEST(0, COALESCE(quantity_expected, 0) - $1)
          WHERE id = $2
        `, [line.quantityReceived, purchaseLine.product_id])

        // Update warehouse stock (upsert manual por índice con variant_id)
        const stockExists = await db.query(`
          SELECT id, quantity_on_hand FROM market_warehouse_stock
          WHERE warehouse_id = $1 AND product_id = $2 AND variant_id IS NULL
        `, [warehouseId, purchaseLine.product_id])

        if (stockExists.rows.length > 0) {
          await db.query(`
            UPDATE market_warehouse_stock SET
              quantity_on_hand = quantity_on_hand + $1,
              last_movement_at = NOW(),
              updated_at = NOW()
            WHERE warehouse_id = $2 AND product_id = $3 AND variant_id IS NULL
          `, [line.quantityReceived, warehouseId, purchaseLine.product_id])
        } else {
          await db.query(`
            INSERT INTO market_warehouse_stock (
              warehouse_id, product_id, variant_id, quantity_on_hand, quantity_reserved,
              last_movement_at, created_at, updated_at
            ) VALUES ($1, $2, NULL, $3, 0, NOW(), NOW(), NOW())
          `, [warehouseId, purchaseLine.product_id, line.quantityReceived])
        }

        totalUnitsReceived += line.quantityReceived
        processedLines++
      }

      // Check if purchase is fully received
      const pendingResult = await db.query(`
        SELECT COUNT(*) as pending FROM market_purchase_lines
        WHERE purchase_id = $1 AND quantity > COALESCE(quantity_received, 0)
      `, [orderId])

      const newStatus = parseInt(pendingResult.rows[0].pending) === 0 ? 'recibido' : 'pendiente'

      // Update purchase status
      await db.query(`
        UPDATE market_purchases SET
          status = $1,
          warehouse_id = COALESCE(warehouse_id, $2),
          received_date = CASE WHEN $1 = 'recibido' THEN NOW() ELSE received_date END,
          received_by = $3,
          updated_at = NOW()
        WHERE id = $4
      `, [newStatus, warehouseId, payload.userId, orderId])

      // Create inventory movement record
      await db.query(`
        INSERT INTO market_inventory_movements (
          company_id, warehouse_id, movement_type, reference_type, reference_id,
          notes, created_by, created_at
        ) VALUES ($1, $2, 'purchase_in', 'purchase', $3, $4, $5, NOW())
      `, [
        payload.companyId,
        warehouseId,
        orderId,
        `Recepcion de compra ${orderNumber}: ${totalUnitsReceived} unidades`,
        payload.userId
      ])
    }

    // Return success with data for printing
    return NextResponse.json({
      success: true,
      message: 'Recepcion procesada exitosamente',
      data: {
        orderType,
        orderId,
        orderNumber,
        supplier: {
          id: supplierId,
          code: supplierCode,
          name: supplierName
        },
        warehouse: {
          id: warehouseId,
          name: warehouse.name,
          code: warehouse.code
        },
        linesProcessed: processedLines,
        unitsReceived: totalUnitsReceived,
        receivedAt: new Date().toISOString(),
        receivedBy: payload.userId
      }
    })

  } catch (error) {
    console.error('[Unified Receive] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar recepcion'
    }, { status: 500 })
  }
}
