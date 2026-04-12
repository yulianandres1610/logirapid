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

interface WarehouseQuantities {
  [warehouseId: string]: number
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

async function generateOperationNumber(companyId: number): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `WD-${year}-`
  const result = await db.query(`
    SELECT operation_number FROM market_warehouse_operations
    WHERE company_id = $1 AND operation_number LIKE $2
    ORDER BY operation_number DESC LIMIT 1
  `, [companyId, `${prefix}%`])

  let nextNumber = 1
  if (result.rows.length > 0) {
    const match = result.rows[0].operation_number.match(/WD-\d{4}-(\d+)/)
    if (match) nextNumber = parseInt(match[1]) + 1
  }
  return `${prefix}${nextNumber.toString().padStart(4, '0')}`
}

async function generateDeliveryNumber(companyId: number): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `ENT-${year}-`
  const result = await db.query(`
    SELECT delivery_number FROM market_invoice_deliveries
    WHERE delivery_number LIKE $1
    ORDER BY delivery_number DESC LIMIT 1
  `, [`${prefix}%`])

  let nextNumber = 1
  if (result.rows.length > 0) {
    const match = result.rows[0].delivery_number.match(/ENT-\d{4}-(\d+)/)
    if (match) nextNumber = parseInt(match[1]) + 1
  }
  return `${prefix}${nextNumber.toString().padStart(4, '0')}`
}

/**
 * Deduct stock from warehouse when confirming invoice delivery.
 * Called during the confirm transaction.
 */
async function deductStockFIFO(
  txClient: any,
  warehouseId: number,
  productId: number,
  variantId: number | null,
  quantity: number,
  companyId: number,
  userId: number,
  invoiceNumber: string,
  customerName: string,
  operationId: number,
  productName: string
) {
  const variantClause = variantId ? 'AND variant_id = $3' : 'AND variant_id IS NULL'
  const variantParams = variantId
    ? [warehouseId, productId, variantId]
    : [warehouseId, productId]

  // Get current stock
  const stockResult = await txClient.query(`
    SELECT id, quantity_on_hand, quantity_reserved
    FROM market_warehouse_stock
    WHERE warehouse_id = $1 AND product_id = $2 ${variantClause}
  `, variantParams)

  if (stockResult.rows.length > 0) {
    const stock = stockResult.rows[0]
    const previousOnHand = parseFloat(stock.quantity_on_hand) || 0
    const newOnHand = previousOnHand - quantity

    // Deduct from on_hand directly (NO reservation - direct deduction)
    await txClient.query(`
      UPDATE market_warehouse_stock SET
        quantity_on_hand = $1,
        quantity_reserved = GREATEST(0, COALESCE(quantity_reserved, 0)),
        updated_at = NOW()
      WHERE id = $2
    `, [newOnHand, stock.id])

    // Create stock movement
    await txClient.query(`
      INSERT INTO market_stock_movements (
        company_id, from_warehouse_id, product_id, variant_id,
        movement_type, quantity, quantity_before, quantity_after,
        reference_type, reference_id, notes, created_by, created_at
      ) VALUES ($1, $2, $3, $4, 'wholesale_out', $5, $6, $7, 'wholesale_delivery', $8, $9, $10, NOW())
    `, [
      companyId, warehouseId, productId, variantId,
      quantity, previousOnHand, newOnHand,
      operationId,
      `Entrega mayorista ${invoiceNumber} a ${customerName}`,
      userId
    ])

    // Create inventory movement (using SAVEPOINT to avoid aborting transaction if table doesn't exist)
    try {
      await txClient.query('SAVEPOINT sp_inventory_movement')
      await txClient.query(`
        INSERT INTO market_inventory_movements (
          product_id, company_id, movement_type, quantity,
          quantity_before, quantity_after, reference_type, reference_id, notes, created_at
        )
        SELECT $1, company_id, 'wholesale_out', $2, $3, $4, 'wholesale_invoice', $5, $6, NOW()
        FROM market_products WHERE id = $1
      `, [productId, -quantity, previousOnHand, newOnHand, operationId,
        `Venta Mayorista: ${invoiceNumber} - ${customerName}`])
      await txClient.query('RELEASE SAVEPOINT sp_inventory_movement')
    } catch {
      await txClient.query('ROLLBACK TO SAVEPOINT sp_inventory_movement')
    }

    // Update variant quantity if applicable
    if (variantId) {
      try {
        await txClient.query('SAVEPOINT sp_variant_qty')
        const totalResult = await txClient.query(`
          SELECT COALESCE(SUM(quantity_on_hand), 0) as total
          FROM market_warehouse_stock WHERE product_id = $1 AND variant_id = $2
        `, [productId, variantId])
        await txClient.query(`
          UPDATE market_product_variants SET quantity_on_hand = $1, updated_at = NOW() WHERE id = $2
        `, [totalResult.rows[0].total, variantId])
        await txClient.query('RELEASE SAVEPOINT sp_variant_qty')
      } catch {
        await txClient.query('ROLLBACK TO SAVEPOINT sp_variant_qty')
      }
    }

    // Update main product quantity
    try {
      await txClient.query('SAVEPOINT sp_product_qty')
      await txClient.query(`
        UPDATE market_products SET quantity_on_hand = (
          SELECT COALESCE(SUM(quantity_on_hand), 0) FROM market_warehouse_stock
          WHERE product_id = $1 AND variant_id IS NULL
        ), updated_at = NOW() WHERE id = $1
      `, [productId])
      await txClient.query('RELEASE SAVEPOINT sp_product_qty')
    } catch {
      await txClient.query('ROLLBACK TO SAVEPOINT sp_product_qty')
    }
  }

  // Process FIFO lots
  let remainingQty = quantity

  // 1. Consignment lots (using SAVEPOINT to avoid aborting transaction if tables don't exist)
  try {
    await txClient.query('SAVEPOINT sp_consignment')
    const lots = await txClient.query(`
      SELECT id, lot_number, quantity_available, unit_cost, supplier_id, order_line_id
      FROM consignment_lot_inventory
      WHERE warehouse_id = $1 AND product_id = $2 AND company_id = $3 AND quantity_available > 0
      ${variantId ? 'AND (variant_id = $4 OR variant_id IS NULL)' : 'AND variant_id IS NULL'}
      ORDER BY received_at ASC FOR UPDATE
    `, variantId
      ? [warehouseId, productId, companyId, variantId]
      : [warehouseId, productId, companyId])

    for (const lot of lots.rows) {
      if (remainingQty <= 0) break
      const toDeduct = Math.min(remainingQty, parseFloat(lot.quantity_available) || 0)
      const unitCost = parseFloat(lot.unit_cost)

      await txClient.query(`
        UPDATE consignment_lot_inventory
        SET quantity_available = quantity_available - $1, quantity_sold = COALESCE(quantity_sold, 0) + $1
        WHERE id = $2
      `, [toDeduct, lot.id])

      if (lot.order_line_id) {
        const olr = await txClient.query(`SELECT order_id FROM consignment_order_lines WHERE id = $1`, [lot.order_line_id])
        await txClient.query(`UPDATE consignment_order_lines SET quantity_sold = COALESCE(quantity_sold, 0) + $1 WHERE id = $2`, [toDeduct, lot.order_line_id])
        if (olr.rows.length > 0) {
          await txClient.query(`UPDATE consignment_orders SET total_sold = COALESCE(total_sold, 0) + $1, updated_at = NOW() WHERE id = $2`,
            [toDeduct * unitCost, olr.rows[0].order_id])
        }
      }

      const wr = await txClient.query('SELECT id FROM consignment_supplier_wallets WHERE supplier_id = $1', [lot.supplier_id])
      if (wr.rows.length > 0) {
        const earnings = toDeduct * unitCost
        await txClient.query(`UPDATE consignment_supplier_wallets SET balance_available = balance_available + $1, total_earned = COALESCE(total_earned, 0) + $1, updated_at = NOW() WHERE id = $2`, [earnings, wr.rows[0].id])
        await txClient.query(`INSERT INTO consignment_wallet_transactions (wallet_id, transaction_type, amount, product_id, quantity, unit_price, notes, created_by, created_at) VALUES ($1, 'sale', $2, $3, $4, $5, $6, $7, NOW())`,
          [wr.rows[0].id, earnings, productId, toDeduct, unitCost, `Venta Mayorista: ${invoiceNumber} - ${productName}`, userId])
      }
      remainingQty -= toDeduct
    }
    // Empty consignment lots stay in DB to preserve FK references from return_lines
    await txClient.query('RELEASE SAVEPOINT sp_consignment')
  } catch {
    await txClient.query('ROLLBACK TO SAVEPOINT sp_consignment')
  }

  // 2. Production lots
  if (remainingQty > 0) {
    try {
      await txClient.query('SAVEPOINT sp_production')
      const lots = await txClient.query(`
        SELECT id, lot_number, quantity_available FROM production_lot_inventory
        WHERE warehouse_id = $1 AND product_id = $2 AND company_id = $3 AND quantity_available > 0
        ${variantId ? 'AND (variant_id = $4 OR variant_id IS NULL)' : 'AND variant_id IS NULL'}
        ORDER BY received_at ASC FOR UPDATE
      `, variantId ? [warehouseId, productId, companyId, variantId] : [warehouseId, productId, companyId])
      for (const lot of lots.rows) {
        if (remainingQty <= 0) break
        const toDeduct = Math.min(remainingQty, parseFloat(lot.quantity_available) || 0)
        await txClient.query(`UPDATE production_lot_inventory SET quantity_available = quantity_available - $1, quantity_sold = COALESCE(quantity_sold, 0) + $1 WHERE id = $2`, [toDeduct, lot.id])
        remainingQty -= toDeduct
      }
      await txClient.query(`DELETE FROM production_lot_inventory WHERE warehouse_id = $1 AND product_id = $2 AND company_id = $3 AND quantity_available <= 0`, [warehouseId, productId, companyId])
      await txClient.query('RELEASE SAVEPOINT sp_production')
    } catch {
      await txClient.query('ROLLBACK TO SAVEPOINT sp_production')
    }
  }

  // 3. Purchase lots
  if (remainingQty > 0) {
    try {
      await txClient.query('SAVEPOINT sp_purchase')
      const lots = await txClient.query(`
        SELECT id, lot_number, quantity_available FROM purchase_lot_inventory
        WHERE warehouse_id = $1 AND product_id = $2 AND company_id = $3 AND quantity_available > 0
        ${variantId ? 'AND (variant_id = $4 OR variant_id IS NULL)' : 'AND variant_id IS NULL'}
        ORDER BY created_at ASC FOR UPDATE
      `, variantId ? [warehouseId, productId, companyId, variantId] : [warehouseId, productId, companyId])
      for (const lot of lots.rows) {
        if (remainingQty <= 0) break
        const toDeduct = Math.min(remainingQty, parseFloat(lot.quantity_available) || 0)
        await txClient.query(`UPDATE purchase_lot_inventory SET quantity_available = quantity_available - $1, quantity_sold = COALESCE(quantity_sold, 0) + $1 WHERE id = $2`, [toDeduct, lot.id])
        remainingQty -= toDeduct
      }
      await txClient.query(`DELETE FROM purchase_lot_inventory WHERE warehouse_id = $1 AND product_id = $2 AND company_id = $3 AND quantity_available <= 0`, [warehouseId, productId, companyId])
      await txClient.query('RELEASE SAVEPOINT sp_purchase')
    } catch {
      await txClient.query('ROLLBACK TO SAVEPOINT sp_purchase')
    }
  }

  // 4. Manual lots
  if (remainingQty > 0) {
    try {
      await txClient.query('SAVEPOINT sp_manual_lots')
      const lots = await txClient.query(`
        SELECT id, lot_number, quantity_available FROM market_product_lots
        WHERE product_id = $1 AND company_id = $2 AND quantity_available > 0 AND is_active = true
        ORDER BY expiration_date ASC NULLS LAST, created_at ASC FOR UPDATE
      `, [productId, companyId])
      for (const lot of lots.rows) {
        if (remainingQty <= 0) break
        const toDeduct = Math.min(remainingQty, parseFloat(lot.quantity_available) || 0)
        await txClient.query(`UPDATE market_product_lots SET quantity_available = quantity_available - $1 WHERE id = $2`, [toDeduct, lot.id])
        remainingQty -= toDeduct
      }
      await txClient.query(`UPDATE market_product_lots SET is_active = false WHERE product_id = $1 AND company_id = $2 AND quantity_available <= 0`, [productId, companyId])
      await txClient.query('RELEASE SAVEPOINT sp_manual_lots')
    } catch {
      await txClient.query('ROLLBACK TO SAVEPOINT sp_manual_lots')
    }
  }
}

/**
 * POST /api/market/wholesale/invoices/[id]/confirm
 * Confirm invoice + create delivery + deduct stock - all in ONE transaction
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
    const invoiceId = parseInt(id)

    // Inline migrations - ensure tables and columns exist
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS market_invoice_deliveries (
          id SERIAL PRIMARY KEY,
          invoice_id INTEGER NOT NULL REFERENCES market_invoices(id),
          delivery_number VARCHAR(30) NOT NULL,
          warehouse_id INTEGER NOT NULL REFERENCES market_warehouses(id),
          operation_id INTEGER,
          status VARCHAR(20) DEFAULT 'pending',
          delivery_date DATE,
          delivery_address TEXT,
          notes TEXT,
          created_by INTEGER REFERENCES users(id),
          created_at TIMESTAMP DEFAULT NOW(),
          dispatched_at TIMESTAMP,
          delivered_at TIMESTAMP
        )
      `)
      await db.query(`
        CREATE TABLE IF NOT EXISTS market_invoice_delivery_lines (
          id SERIAL PRIMARY KEY,
          delivery_id INTEGER NOT NULL REFERENCES market_invoice_deliveries(id) ON DELETE CASCADE,
          invoice_line_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          variant_id INTEGER,
          quantity_to_deliver DECIMAL(12,3) NOT NULL,
          quantity_delivered DECIMAL(12,3) DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `)
      await db.query(`ALTER TABLE market_warehouse_operations ADD COLUMN IF NOT EXISTS validation_status VARCHAR(50)`)
      await db.query(`ALTER TABLE market_warehouse_operations ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100)`)
      await db.query(`ALTER TABLE market_warehouse_operations ADD COLUMN IF NOT EXISTS discrepancy_notes TEXT`)
      await db.query(`ALTER TABLE market_warehouse_operations ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP`)
      await db.query(`ALTER TABLE market_warehouse_operations ADD COLUMN IF NOT EXISTS completed_by INTEGER`)
      await db.query(`ALTER TABLE market_warehouse_operation_lines ADD COLUMN IF NOT EXISTS quantity_validated DECIMAL(15,3) DEFAULT 0`)
      await db.query(`ALTER TABLE market_invoice_deliveries ADD COLUMN IF NOT EXISTS dispatched_by INTEGER`)
      await db.query(`ALTER TABLE market_invoice_deliveries ADD COLUMN IF NOT EXISTS delivered_by INTEGER`)
    } catch (migrationError) {
      console.error('[Wholesale Confirm] Migration error (non-fatal):', migrationError)
    }

    // Verify invoice exists
    const checkResult = await db.query(`
      SELECT i.id, i.status, i.invoice_number, i.warehouse_id, i.customer_id,
             w.name as warehouse_name, c.business_name as customer_name, c.address as customer_address
      FROM market_invoices i
      LEFT JOIN market_warehouses w ON w.id = i.warehouse_id
      LEFT JOIN market_wholesale_customers c ON c.id = i.customer_id
      WHERE i.id = $1 AND i.company_id = $2
    `, [invoiceId, payload.companyId])

    if (checkResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Factura no encontrada' }, { status: 404 })
    }

    const invoice = checkResult.rows[0]

    if (invoice.status === 'cancelled') {
      return NextResponse.json({ success: false, error: 'No se pueden confirmar facturas canceladas' }, { status: 400 })
    }

    // Check if deliveries already exist
    const existingDeliveries = await db.query(
      'SELECT id FROM market_invoice_deliveries WHERE invoice_id = $1', [invoiceId]
    )
    if (existingDeliveries.rows.length > 0) {
      return NextResponse.json({ success: false, error: 'Esta factura ya tiene entregas creadas' }, { status: 400 })
    }

    // Get invoice lines
    const linesResult = await db.query(`
      SELECT il.*, p.name as product_name, p.sku as product_sku, p.barcode
      FROM market_invoice_lines il
      JOIN market_products p ON p.id = il.product_id
      WHERE il.invoice_id = $1
    `, [invoiceId])

    // Parse warehouse_quantities (may be string or object from DB)
    const parseWQ = (wq: any): WarehouseQuantities => {
      if (!wq) return {}
      if (typeof wq === 'string') { try { return JSON.parse(wq) } catch { return {} } }
      if (typeof wq === 'object') return wq as WarehouseQuantities
      return {}
    }

    // Determine warehouse mode
    const isMultiWarehouse = linesResult.rows.some(line => {
      const wq = parseWQ(line.warehouse_quantities)
      return Object.keys(wq).length > 0 && Object.values(wq).some(q => q > 0)
    })

    console.log('[Confirm] isMultiWarehouse:', isMultiWarehouse, 'invoice.warehouse_id:', invoice.warehouse_id)

    // Collect warehouse IDs
    const warehouseIds = new Set<number>()
    if (isMultiWarehouse) {
      for (const line of linesResult.rows) {
        const wq = parseWQ(line.warehouse_quantities)
        for (const [wId, qty] of Object.entries(wq)) {
          if (qty > 0) warehouseIds.add(parseInt(wId))
        }
      }
      if (warehouseIds.size === 0) {
        return NextResponse.json({ success: false, error: 'No se especificaron cantidades por almacén' }, { status: 400 })
      }
    } else {
      if (invoice.warehouse_id) {
        warehouseIds.add(invoice.warehouse_id)
      } else {
        // Fallback: find central warehouse or any active warehouse
        const centralResult = await db.query(
          'SELECT id, name FROM market_warehouses WHERE company_id = $1 AND is_active = true ORDER BY is_central DESC NULLS LAST LIMIT 1',
          [payload.companyId]
        )
        if (centralResult.rows.length > 0) {
          warehouseIds.add(centralResult.rows[0].id)
          // Update invoice with resolved warehouse
          await db.query('UPDATE market_invoices SET warehouse_id = $1 WHERE id = $2', [centralResult.rows[0].id, invoiceId])
          invoice.warehouse_id = centralResult.rows[0].id
          invoice.warehouse_name = centralResult.rows[0].name || 'Almacén Central'
        } else {
          return NextResponse.json({ success: false, error: 'No hay almacén disponible para confirmar' }, { status: 400 })
        }
      }
    }

    // Get warehouse names
    const warehouseResult = await db.query('SELECT id, name FROM market_warehouses WHERE id = ANY($1)', [Array.from(warehouseIds)])
    const warehouseNames = new Map<number, string>()
    for (const row of warehouseResult.rows) warehouseNames.set(row.id, row.name)

    // Check stock availability (before transaction)
    const insufficientStock: Array<{ product: string; warehouseName: string; required: number; available: number }> = []

    for (const line of linesResult.rows) {
      if (isMultiWarehouse) {
        const wq = parseWQ(line.warehouse_quantities)
        for (const [wIdStr, qty] of Object.entries(wq)) {
          if (qty <= 0) continue
          const wId = parseInt(wIdStr)
          const sr = await db.query(`
            SELECT COALESCE(quantity_on_hand, 0) as on_hand, COALESCE(quantity_reserved, 0) as reserved
            FROM market_warehouse_stock WHERE warehouse_id = $1 AND product_id = $2
            ${line.variant_id ? 'AND variant_id = $3' : 'AND variant_id IS NULL'}
          `, line.variant_id ? [wId, line.product_id, line.variant_id] : [wId, line.product_id])
          const available = (parseFloat(sr.rows[0]?.on_hand) || 0) - (parseFloat(sr.rows[0]?.reserved) || 0)
          if (available < qty) {
            insufficientStock.push({ product: line.product_name, warehouseName: warehouseNames.get(wId) || `Almacén ${wId}`, required: qty, available })
          }
        }
      } else {
        // Check stock in specific warehouse first, then total across all warehouses
        let sr = await db.query(`
          SELECT COALESCE(SUM(quantity_on_hand), 0) as on_hand, COALESCE(SUM(quantity_reserved), 0) as reserved
          FROM market_warehouse_stock WHERE warehouse_id = $1 AND product_id = $2
        `, [invoice.warehouse_id, line.product_id])
        let available = (parseFloat(sr.rows[0]?.on_hand) || 0) - (parseFloat(sr.rows[0]?.reserved) || 0)

        // If no stock in specific warehouse, check total stock (product might be in another warehouse)
        if (available <= 0) {
          sr = await db.query(`
            SELECT COALESCE(SUM(quantity_on_hand), 0) as on_hand, COALESCE(SUM(quantity_reserved), 0) as reserved
            FROM market_warehouse_stock WHERE product_id = $1
          `, [line.product_id])
          available = (parseFloat(sr.rows[0]?.on_hand) || 0) - (parseFloat(sr.rows[0]?.reserved) || 0)
        }

        const required = parseFloat(line.quantity)
        if (available < required) {
          insufficientStock.push({ product: line.product_name, warehouseName: invoice.warehouse_name || 'Almacén', required, available })
        }
      }
    }

    if (insufficientStock.length > 0) {
      return NextResponse.json({ success: false, error: 'Stock insuficiente', data: { insufficientStock } }, { status: 400 })
    }

    // === SINGLE TRANSACTION: confirm + create delivery + deduct stock + mark delivered ===
    // IMPORTANT: Use a dedicated client to ensure all queries run on the SAME connection.
    // db.query() uses pool.query() which may assign different connections per call,
    // breaking BEGIN/COMMIT/ROLLBACK transaction semantics.
    const client = await db.getClient()

    try {
      await client.query('BEGIN')
      const createdDeliveries: Array<{
        deliveryId: number; deliveryNumber: string; operationId: number
        warehouseId: number; warehouseName: string; operationNumber: string; productCount: number
      }> = []

      if (isMultiWarehouse) {
        // Group lines by warehouse
        const linesByWarehouse = new Map<number, Array<{
          lineId: number; productId: number; variantId: number | null; productName: string; quantity: number
        }>>()

        for (const line of linesResult.rows) {
          const wq = parseWQ(line.warehouse_quantities)
          for (const [wIdStr, qty] of Object.entries(wq)) {
            if (qty <= 0) continue
            const wId = parseInt(wIdStr)
            if (!linesByWarehouse.has(wId)) linesByWarehouse.set(wId, [])
            linesByWarehouse.get(wId)!.push({
              lineId: line.id, productId: line.product_id, variantId: line.variant_id,
              productName: line.product_name, quantity: qty
            })
          }
        }

        for (const [warehouseId, warehouseLines] of linesByWarehouse) {
          const deliveryNumber = await generateDeliveryNumber(payload.companyId)
          const operationNumber = await generateOperationNumber(payload.companyId)

          // Create operation as PENDING — stock deducted only when warehouse dispatches
          const opResult = await client.query(`
            INSERT INTO market_warehouse_operations (
              company_id, operation_number, operation_type, status,
              source_warehouse_id,
              reference_type, reference_id, reference_number,
              notes, created_by, created_at
            ) VALUES ($1, $2, 'wholesale_delivery', 'confirmed', $3,
              'wholesale_invoice', $4, $5, $6, $7, NOW()
            ) RETURNING id
          `, [payload.companyId, operationNumber, warehouseId, invoiceId, invoice.invoice_number,
            `Entrega mayorista - Cliente: ${invoice.customer_name}`, payload.userId])
          const operationId = opResult.rows[0].id

          // Create delivery as PENDING — warehouse must validate and dispatch
          const delResult = await client.query(`
            INSERT INTO market_invoice_deliveries (
              invoice_id, delivery_number, warehouse_id, operation_id,
              status, delivery_address, notes, created_by, created_at
            ) VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, NOW())
            RETURNING id
          `, [invoiceId, deliveryNumber, warehouseId, operationId,
            invoice.customer_address || null,
            `Entrega desde ${warehouseNames.get(warehouseId) || 'almacén'}`,
            payload.userId])
          const deliveryId = delResult.rows[0].id

          // Create lines + deduct stock immediately
          for (const item of warehouseLines) {
            await client.query(`
              INSERT INTO market_warehouse_operation_lines (
                operation_id, product_id, variant_id, quantity_planned, created_at
              ) VALUES ($1, $2, $3, $4, NOW())
            `, [operationId, item.productId, item.variantId, item.quantity])

            await client.query(`
              INSERT INTO market_invoice_delivery_lines (
                delivery_id, invoice_line_id, product_id, variant_id,
                quantity_to_deliver, quantity_delivered, created_at
              ) VALUES ($1, $2, $3, $4, $5, $5, NOW())
            `, [deliveryId, item.lineId, item.productId, item.variantId, item.quantity])

            // Deduct stock from warehouse
            await deductStockFIFO(
              client, warehouseId, item.productId, item.variantId,
              item.quantity, payload.companyId, payload.userId,
              invoice.invoice_number, invoice.customer_name || '',
              operationId, item.productName
            )
          }

          createdDeliveries.push({
            deliveryId, deliveryNumber, operationId, warehouseId,
            warehouseName: warehouseNames.get(warehouseId) || 'Almacén',
            operationNumber, productCount: warehouseLines.length
          })
        }
      } else {
        // Single warehouse mode
        const operationNumber = await generateOperationNumber(payload.companyId)
        const deliveryNumber = await generateDeliveryNumber(payload.companyId)

        const opResult = await client.query(`
          INSERT INTO market_warehouse_operations (
            company_id, operation_number, operation_type, status,
            source_warehouse_id,
            reference_type, reference_id, reference_number,
            notes, created_by, created_at
          ) VALUES ($1, $2, 'wholesale_delivery', 'confirmed', $3,
            'wholesale_invoice', $4, $5, $6, $7, NOW()
          ) RETURNING id
        `, [payload.companyId, operationNumber, invoice.warehouse_id, invoiceId, invoice.invoice_number,
          `Entrega mayorista - Cliente: ${invoice.customer_name}`, payload.userId])
        const operationId = opResult.rows[0].id

        const delResult = await client.query(`
          INSERT INTO market_invoice_deliveries (
            invoice_id, delivery_number, warehouse_id, operation_id,
            status, delivery_address, notes, created_by, created_at
          ) VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, NOW())
          RETURNING id
        `, [invoiceId, deliveryNumber, invoice.warehouse_id, operationId,
          invoice.customer_address || null,
          `Entrega desde ${invoice.warehouse_name || 'almacén'}`,
          payload.userId])
        const deliveryId = delResult.rows[0].id

        for (const line of linesResult.rows) {
          const qty = parseFloat(line.quantity)

          await client.query(`
            INSERT INTO market_warehouse_operation_lines (
              operation_id, product_id, variant_id, quantity_planned, created_at
            ) VALUES ($1, $2, $3, $4, NOW())
          `, [operationId, line.product_id, line.variant_id, qty])

          await client.query(`
            INSERT INTO market_invoice_delivery_lines (
              delivery_id, invoice_line_id, product_id, variant_id,
              quantity_to_deliver, quantity_delivered, created_at
            ) VALUES ($1, $2, $3, $4, $5, $5, NOW())
          `, [deliveryId, line.id, line.product_id, line.variant_id, qty])

          // Deduct stock from warehouse
          await deductStockFIFO(
            client, invoice.warehouse_id, line.product_id, line.variant_id,
            qty, payload.companyId, payload.userId,
            invoice.invoice_number, invoice.customer_name || '',
            operationId, line.product_name
          )
        }

        createdDeliveries.push({
          deliveryId, deliveryNumber, operationId,
          warehouseId: invoice.warehouse_id,
          warehouseName: invoice.warehouse_name || 'Almacén',
          operationNumber, productCount: linesResult.rows.length
        })
      }

      // Update invoice lines quantity_delivered
      for (const line of linesResult.rows) {
        const qty = isMultiWarehouse
          ? Object.values(parseWQ(line.warehouse_quantities)).reduce((s, v) => s + (v > 0 ? v : 0), 0)
          : parseFloat(line.quantity)
        await client.query(
          'UPDATE market_invoice_lines SET quantity_delivered = COALESCE(quantity_delivered, 0) + $1 WHERE id = $2',
          [qty, line.id]
        )
      }

      // Update invoice status to delivered (stock already deducted)
      await client.query(`
        UPDATE market_invoices SET
          status = 'delivered',
          confirmed_at = COALESCE(confirmed_at, NOW()),
          delivered_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `, [invoiceId])

      // Update customer balance
      const invoiceTotal = await client.query('SELECT total_amount FROM market_invoices WHERE id = $1', [invoiceId])
      await client.query(`
        UPDATE market_wholesale_customers SET
          current_balance = current_balance + $1, updated_at = NOW()
        WHERE id = $2
      `, [invoiceTotal.rows[0].total_amount, invoice.customer_id])

      // Clean up any stuck reservations for these products
      for (const line of linesResult.rows) {
        try {
          await client.query('SAVEPOINT sp_cleanup_reservations')
          if (isMultiWarehouse) {
            const wq = parseWQ(line.warehouse_quantities)
            for (const [wIdStr] of Object.entries(wq)) {
              await client.query(`
                UPDATE market_warehouse_stock SET quantity_reserved = 0, updated_at = NOW()
                WHERE warehouse_id = $1 AND product_id = $2 AND quantity_reserved > 0
                ${line.variant_id ? 'AND variant_id = $3' : 'AND variant_id IS NULL'}
              `, line.variant_id ? [parseInt(wIdStr), line.product_id, line.variant_id] : [parseInt(wIdStr), line.product_id])
            }
          } else {
            await client.query(`
              UPDATE market_warehouse_stock SET quantity_reserved = 0, updated_at = NOW()
              WHERE warehouse_id = $1 AND product_id = $2 AND quantity_reserved > 0
              ${line.variant_id ? 'AND variant_id = $3' : 'AND variant_id IS NULL'}
            `, line.variant_id ? [invoice.warehouse_id, line.product_id, line.variant_id] : [invoice.warehouse_id, line.product_id])
          }
          await client.query('RELEASE SAVEPOINT sp_cleanup_reservations')
        } catch {
          await client.query('ROLLBACK TO SAVEPOINT sp_cleanup_reservations')
        }
      }

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: `Factura ${invoice.invoice_number} confirmada y entregada exitosamente`,
        data: {
          invoiceNumber: invoice.invoice_number,
          deliveries: createdDeliveries,
          isMultiWarehouse,
          totalDeliveries: createdDeliveries.length
        }
      })

    } catch (txError) {
      try {
        await client.query('ROLLBACK')
      } catch { /* ignore rollback errors */ }
      throw txError
    } finally {
      client.release()
    }

  } catch (error) {
    console.error('[Wholesale Invoice Confirm] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al confirmar factura'
    }, { status: 500 })
  }
}
