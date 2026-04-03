import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

// Ensure employee_id column exists (migration)
let migrationRun = false
async function ensureMigrations() {
  if (migrationRun) return
  try {
    await db.query(`
      ALTER TABLE market_pos_orders
      ADD COLUMN IF NOT EXISTS employee_id INTEGER REFERENCES market_employees(id)
    `)
    await db.query(`
      ALTER TABLE market_pos_order_lines
      ADD COLUMN IF NOT EXISTS original_price DECIMAL(12,2)
    `)

    // Fix consignment tables to support decimal quantities (for products sold by weight/volume)
    // Check if consignment_lot_inventory exists before altering
    const lotTableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables WHERE table_name = 'consignment_lot_inventory'
      ) as exists
    `)

    if (lotTableCheck.rows[0]?.exists) {
      await db.query(`
        ALTER TABLE consignment_lot_inventory
        ALTER COLUMN quantity_initial TYPE DECIMAL(12,3) USING quantity_initial::DECIMAL(12,3),
        ALTER COLUMN quantity_available TYPE DECIMAL(12,3) USING quantity_available::DECIMAL(12,3),
        ALTER COLUMN quantity_sold TYPE DECIMAL(12,3) USING quantity_sold::DECIMAL(12,3),
        ALTER COLUMN quantity_returned TYPE DECIMAL(12,3) USING quantity_returned::DECIMAL(12,3)
      `)
      console.log('[POS Orders] Fixed consignment_lot_inventory columns to DECIMAL')
    }

    const orderLinesTableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables WHERE table_name = 'consignment_order_lines'
      ) as exists
    `)

    if (orderLinesTableCheck.rows[0]?.exists) {
      await db.query(`
        ALTER TABLE consignment_order_lines
        ALTER COLUMN quantity_ordered TYPE DECIMAL(12,3) USING quantity_ordered::DECIMAL(12,3),
        ALTER COLUMN quantity_received TYPE DECIMAL(12,3) USING quantity_received::DECIMAL(12,3),
        ALTER COLUMN quantity_sold TYPE DECIMAL(12,3) USING quantity_sold::DECIMAL(12,3),
        ALTER COLUMN quantity_returned TYPE DECIMAL(12,3) USING quantity_returned::DECIMAL(12,3)
      `)
      console.log('[POS Orders] Fixed consignment_order_lines columns to DECIMAL')
    }

    // Also fix purchase_lot_inventory if exists
    const purchaseLotTableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables WHERE table_name = 'purchase_lot_inventory'
      ) as exists
    `)

    if (purchaseLotTableCheck.rows[0]?.exists) {
      await db.query(`
        ALTER TABLE purchase_lot_inventory
        ALTER COLUMN quantity_initial TYPE DECIMAL(12,3) USING quantity_initial::DECIMAL(12,3),
        ALTER COLUMN quantity_available TYPE DECIMAL(12,3) USING quantity_available::DECIMAL(12,3),
        ALTER COLUMN quantity_sold TYPE DECIMAL(12,3) USING quantity_sold::DECIMAL(12,3)
      `)
      console.log('[POS Orders] Fixed purchase_lot_inventory columns to DECIMAL')
    }

    // Fix consignment_wallet_transactions quantity column
    const walletTxTableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables WHERE table_name = 'consignment_wallet_transactions'
      ) as exists
    `)

    if (walletTxTableCheck.rows[0]?.exists) {
      await db.query(`
        ALTER TABLE consignment_wallet_transactions
        ALTER COLUMN quantity TYPE DECIMAL(12,3) USING quantity::DECIMAL(12,3)
      `)
      console.log('[POS Orders] Fixed consignment_wallet_transactions.quantity to DECIMAL')
    }

    // Add change_currency column to market_pos_payments for tracking the currency of change given
    await db.query(`
      ALTER TABLE market_pos_payments
      ADD COLUMN IF NOT EXISTS change_currency VARCHAR(10) DEFAULT NULL
    `)

    console.log('[POS Orders] Migrations ensured (employee_id, original_price, decimal quantities, change_currency)')
    migrationRun = true
  } catch (error) {
    console.error('[POS Orders] Migration error (may be safe to ignore):', error)
    migrationRun = true
  }
}

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/market/pos/orders
 * List orders for a session or terminal
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const companyId = payload.companyId

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const terminalId = searchParams.get('terminalId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = `
      SELECT
        o.id,
        o.order_number,
        o.pos_session_id,
        o.pos_terminal_id,
        o.customer_id,
        o.customer_name,
        o.subtotal,
        o.discount_amount,
        o.tax_amount,
        o.total_amount,
        o.currency,
        o.status,
        o.offline_id,
        o.synced_at,
        o.employee_id,
        o.created_by,
        o.created_at,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as created_by_name,
        t.name as terminal_name,
        s.session_code,
        e.employee_code,
        COALESCE(eu.firstname || ' ' || eu.lastname, eu.email) as employee_name
      FROM market_pos_orders o
      LEFT JOIN users u ON o.created_by = u.id
      LEFT JOIN market_pos_terminals t ON o.pos_terminal_id = t.id
      LEFT JOIN market_pos_sessions s ON o.pos_session_id = s.id
      LEFT JOIN market_employees e ON o.employee_id = e.id
      LEFT JOIN users eu ON e.user_id = eu.id
      WHERE o.company_id = $1
    `
    const params: (number | string)[] = [companyId]
    let paramIndex = 2

    if (sessionId) {
      query += ` AND o.pos_session_id = $${paramIndex++}`
      params.push(parseInt(sessionId))
    }

    if (terminalId) {
      query += ` AND o.pos_terminal_id = $${paramIndex++}`
      params.push(parseInt(terminalId))
    }

    if (status && status !== 'all') {
      query += ` AND o.status = $${paramIndex++}`
      params.push(status)
    }

    query += ` ORDER BY o.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    // Get total count
    let countQuery = `SELECT COUNT(*) as count FROM market_pos_orders o WHERE o.company_id = $1`
    const countParams: (number | string)[] = [companyId]
    let countParamIndex = 2

    if (sessionId) {
      countQuery += ` AND o.pos_session_id = $${countParamIndex++}`
      countParams.push(parseInt(sessionId))
    }
    if (terminalId) {
      countQuery += ` AND o.pos_terminal_id = $${countParamIndex++}`
      countParams.push(parseInt(terminalId))
    }
    if (status && status !== 'all') {
      countQuery += ` AND o.status = $${countParamIndex++}`
      countParams.push(status)
    }

    const countResult = await db.query(countQuery, countParams)

    // Get payments for all orders (include change details)
    const orderIds = result.rows.map(r => r.id)
    let paymentsMap: Record<number, {
      method: string
      amount: number
      amountTendered: number | null
      changeAmount: number | null
      changeCurrency: string | null
      currency: string
    }[]> = {}

    if (orderIds.length > 0) {
      const paymentsResult = await db.query(`
        SELECT order_id, payment_method, amount, currency, amount_tendered, change_amount, change_currency
        FROM market_pos_payments
        WHERE order_id = ANY($1)
        ORDER BY order_id, id
      `, [orderIds])

      for (const p of paymentsResult.rows) {
        if (!paymentsMap[p.order_id]) {
          paymentsMap[p.order_id] = []
        }
        const amount = parseFloat(p.amount) || 0
        const tendered = p.amount_tendered ? parseFloat(p.amount_tendered) : null
        const change = p.change_amount ? parseFloat(p.change_amount) : null
        paymentsMap[p.order_id].push({
          method: p.payment_method,
          // NOTE: amount is the payment amount in its currency (NOT minus change)
          // Change is tracked separately and may be in a different currency (e.g., change in CUP for USD payment)
          amount: amount,
          amountTendered: tendered,
          changeAmount: change,
          changeCurrency: p.change_currency || null, // Currency of the change (e.g., CUP)
          currency: p.currency || 'USD'
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        orders: result.rows.map(row => ({
          id: row.id,
          orderNumber: row.order_number,
          sessionId: row.pos_session_id,
          sessionCode: row.session_code,
          terminalId: row.pos_terminal_id,
          terminalName: row.terminal_name,
          customerId: row.customer_id,
          customerName: row.customer_name,
          subtotal: parseFloat(row.subtotal) || 0,
          discountAmount: parseFloat(row.discount_amount) || 0,
          taxAmount: parseFloat(row.tax_amount) || 0,
          totalAmount: parseFloat(row.total_amount) || 0,
          currency: row.currency,
          status: row.status,
          offlineId: row.offline_id,
          syncedAt: row.synced_at,
          employeeId: row.employee_id,
          employeeCode: row.employee_code,
          employeeName: row.employee_name,
          createdBy: row.created_by,
          createdByName: row.created_by_name,
          createdAt: row.created_at,
          payments: paymentsMap[row.id] || []
        })),
        total: parseInt(countResult.rows[0].count)
      }
    })

  } catch (error) {
    console.error('[POS Orders API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener órdenes'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/pos/orders
 * Create new order with lines and payments
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const companyId = payload.companyId
    const userId = payload.userId

    // Ensure migrations
    await ensureMigrations()

    const body = await request.json()
    const {
      sessionId,
      terminalId,
      warehouseId,
      employeeId, // Cashier who processed the sale
      customerId,
      customerName,
      lines,
      payments,
      currency,
      offlineId // For offline sync
    } = body

    if (!sessionId || !terminalId) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere sesión y terminal'
      }, { status: 400 })
    }

    if (!lines || lines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'La orden debe tener al menos un producto'
      }, { status: 400 })
    }

    // Verify session is open
    const sessionCheck = await db.query(`
      SELECT id, status FROM market_pos_sessions
      WHERE id = $1 AND company_id = $2
    `, [sessionId, companyId])

    if (sessionCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Sesión no encontrada'
      }, { status: 404 })
    }

    if (sessionCheck.rows[0].status !== 'open') {
      return NextResponse.json({
        success: false,
        error: 'La sesión está cerrada'
      }, { status: 400 })
    }

    // Check if offline order already synced
    if (offlineId) {
      const existingOrder = await db.query(`
        SELECT id FROM market_pos_orders WHERE offline_id = $1
      `, [offlineId])

      if (existingOrder.rows.length > 0) {
        return NextResponse.json({
          success: true,
          data: { id: existingOrder.rows[0].id },
          message: 'Orden ya sincronizada'
        })
      }
    }

    // Generate order number
    const year = new Date().getFullYear()
    const countResult = await db.query(`
      SELECT COUNT(*) as count FROM market_pos_orders WHERE company_id = $1
    `, [companyId])
    const count = parseInt(countResult.rows[0].count) + 1
    const orderNumber = `POS-${year}-${String(count).padStart(5, '0')}`

    // Calculate totals from lines
    let subtotal = 0
    let totalDiscount = 0
    let totalTax = 0

    for (const line of lines) {
      const lineSubtotal = (line.quantity || 1) * (line.unitPrice || 0)
      const lineDiscount = line.discountAmount || (lineSubtotal * (line.discountPercent || 0) / 100)
      const lineTax = line.taxAmount || 0

      subtotal += lineSubtotal
      totalDiscount += lineDiscount
      totalTax += lineTax
    }

    const totalAmount = subtotal - totalDiscount + totalTax

    // Validate stock availability in the POS terminal's warehouse before creating order
    if (warehouseId) {
      for (const line of lines) {
        const quantity = parseFloat(line.quantity) || 1
        const productId = parseInt(line.productId) || null
        const variantId = line.variantId ? parseInt(line.variantId) : null

        if (productId) {
          // Get product info
          const productCheck = await db.query(
            'SELECT name, COALESCE(quantity_on_hand, 0) as global_stock FROM market_products WHERE id = $1',
            [productId]
          )
          const productName = productCheck.rows[0]?.name || `Producto ${productId}`

          // Check warehouse stock availability (only the POS terminal's warehouse matters)
          // First try variant-specific stock, then product-level stock
          let availableStock = 0
          let stockRecordFound = false

          if (variantId) {
            // Check variant-specific warehouse stock
            const variantStockCheck = await db.query(`
              SELECT COALESCE(quantity_on_hand, 0) as available
              FROM market_warehouse_stock
              WHERE product_id = $1 AND warehouse_id = $2 AND variant_id = $3
            `, [productId, warehouseId, variantId])

            if (variantStockCheck.rows.length > 0) {
              availableStock = parseFloat(variantStockCheck.rows[0]?.available) || 0
              stockRecordFound = true
            } else {
              // No variant-specific record - check product-level warehouse stock
              const productStockCheck = await db.query(`
                SELECT COALESCE(quantity_on_hand, 0) as available
                FROM market_warehouse_stock
                WHERE product_id = $1 AND warehouse_id = $2 AND variant_id IS NULL
              `, [productId, warehouseId])

              if (productStockCheck.rows.length > 0) {
                availableStock = parseFloat(productStockCheck.rows[0]?.available) || 0
                stockRecordFound = true
              }
            }
          } else {
            // No variant - check product-level warehouse stock
            const stockCheck = await db.query(`
              SELECT COALESCE(quantity_on_hand, 0) as available
              FROM market_warehouse_stock
              WHERE product_id = $1 AND warehouse_id = $2 AND variant_id IS NULL
            `, [productId, warehouseId])

            if (stockCheck.rows.length > 0) {
              availableStock = parseFloat(stockCheck.rows[0]?.available) || 0
              stockRecordFound = true
            }
          }

          // If no warehouse record found, try to auto-initialize from variant/product stock
          if (!stockRecordFound) {
            let fallbackStock = 0
            if (variantId) {
              const variantCheck = await db.query(
                'SELECT COALESCE(quantity_on_hand, 0) as variant_stock FROM market_product_variants WHERE id = $1',
                [variantId]
              )
              fallbackStock = parseFloat(variantCheck.rows[0]?.variant_stock) || 0
            } else {
              fallbackStock = parseFloat(productCheck.rows[0]?.global_stock) || 0
            }

            if (fallbackStock > 0) {
              await db.query(`
                INSERT INTO market_warehouse_stock (product_id, warehouse_id, variant_id, quantity_on_hand, created_at, updated_at)
                VALUES ($1, $2, $3, $4, NOW(), NOW())
              `, [productId, warehouseId, variantId || null, fallbackStock])
              availableStock = fallbackStock
              console.log('[POS Orders] Auto-initialized warehouse stock:', { productId, productName, variantId, warehouseId, stock: fallbackStock })
            }
          }

          if (availableStock < quantity) {
            console.log('[POS Orders] Insufficient stock:', {
              productId,
              productName,
              variantId,
              requested: quantity,
              available: availableStock,
              warehouseId
            })

            return NextResponse.json({
              success: false,
              error: `Stock insuficiente para "${productName}". Disponible: ${availableStock}, Solicitado: ${quantity}`
            }, { status: 400 })
          }
        }
      }
    }

    // Create order
    const orderResult = await db.query(`
      INSERT INTO market_pos_orders (
        company_id, pos_session_id, pos_terminal_id, warehouse_id,
        order_number, customer_id, customer_name,
        subtotal, discount_amount, tax_amount, total_amount,
        currency, status, offline_id, synced_at,
        employee_id, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
      RETURNING id
    `, [
      companyId,
      sessionId,
      terminalId,
      warehouseId || null,
      orderNumber,
      customerId || null,
      customerName || null,
      subtotal,
      totalDiscount,
      totalTax,
      totalAmount,
      currency || 'USD',
      'draft',
      offlineId || null,
      offlineId ? new Date().toISOString() : null,
      employeeId || null,
      userId
    ])

    const orderId = orderResult.rows[0].id

    // Insert order lines with FIFO consignment/purchase tracking
    for (const line of lines) {
      // Ensure numeric values are properly parsed
      const quantity = parseFloat(line.quantity) || 1
      const unitPrice = parseFloat(line.unitPrice) || 0
      const discountPercent = parseFloat(line.discountPercent) || 0
      const discountAmountInput = parseFloat(line.discountAmount) || 0
      const taxAmount = parseFloat(line.taxAmount) || 0

      const lineSubtotal = quantity * unitPrice
      const lineDiscount = discountAmountInput || (lineSubtotal * discountPercent / 100)
      const lineTotal = lineSubtotal - lineDiscount + taxAmount

      const variantId = line.variantId ? parseInt(line.variantId) : null
      const productId = parseInt(line.productId) || null

      // Variables for traceability
      let supplierId: number | null = null
      let lotId: number | null = null
      let costPrice: number | null = null
      let isConsignment = false

      // Process inventory with FIFO if we have product and warehouse
      if (productId && warehouseId) {
        const quantityToReduce = quantity
        let remainingQty = quantityToReduce

        console.log('[POS Orders] Processing FIFO for product:', {
          productId,
          variantId,
          quantity: quantityToReduce,
          warehouseId
        })

        // Get current stock before update for movement tracking
        const currentStockResult = await db.query(`
          SELECT quantity_on_hand FROM market_products WHERE id = $1
        `, [productId])
        const quantityBefore = parseFloat(currentStockResult.rows[0]?.quantity_on_hand) || 0

        // 1. First try FIFO from consignment lots (variant-specific or product-level)
        const consignmentLots = await db.query(`
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
            ${variantId ? 'AND (cli.variant_id = $4 OR cli.variant_id IS NULL)' : 'AND cli.variant_id IS NULL'}
          ORDER BY cli.received_at ASC
          FOR UPDATE
        `, variantId
          ? [warehouseId, productId, companyId, variantId]
          : [warehouseId, productId, companyId])

        // Process consignment lots FIFO
        for (const lot of consignmentLots.rows) {
          if (remainingQty <= 0) break

          const availableQty = parseFloat(lot.quantity_available) || 0
          const toDeduct = Math.min(remainingQty, availableQty)
          const unitCost = parseFloat(lot.unit_cost)

          // Deduct from consignment lot
          await db.query(`
            UPDATE consignment_lot_inventory
            SET
              quantity_available = quantity_available - $1,
              quantity_sold = quantity_sold + $1
            WHERE id = $2
          `, [toDeduct, lot.lot_id])

          // Update consignment order line sold quantity
          if (lot.order_line_id) {
            // Get the order line details to update the master order
            const orderLineResult = await db.query(`
              SELECT order_id, unit_price FROM consignment_order_lines WHERE id = $1
            `, [lot.order_line_id])

            await db.query(`
              UPDATE consignment_order_lines
              SET quantity_sold = quantity_sold + $1
              WHERE id = $2
            `, [toDeduct, lot.order_line_id])

            // Update consignment_orders.total_sold (aggregate) using unit_cost, not unit_price
            if (orderLineResult.rows.length > 0) {
              const orderId = orderLineResult.rows[0].order_id
              const saleAmount = toDeduct * unitCost

              await db.query(`
                UPDATE consignment_orders
                SET total_sold = COALESCE(total_sold, 0) + $1,
                    updated_at = NOW()
                WHERE id = $2
              `, [saleAmount, orderId])

              console.log('[POS Orders] Consignment order total_sold updated:', { orderId, saleAmount })
            }
          }

          // Update supplier wallet with earnings (at cost price)
          const walletResult = await db.query(
            'SELECT id FROM consignment_supplier_wallets WHERE supplier_id = $1',
            [lot.supplier_id]
          )

          if (walletResult.rows.length > 0) {
            const walletId = walletResult.rows[0].id
            const earnings = toDeduct * unitCost

            // Update wallet balance
            await db.query(`
              UPDATE consignment_supplier_wallets
              SET
                balance_available = balance_available + $1,
                total_earned = total_earned + $1,
                updated_at = NOW()
              WHERE id = $2
            `, [earnings, walletId])

            // Create wallet transaction
            await db.query(`
              INSERT INTO consignment_wallet_transactions (
                wallet_id, transaction_type, amount, pos_order_id, pos_order_number, notes, created_by
              ) VALUES ($1, 'sale', $2, $3, $4, $5, $6)
            `, [
              walletId,
              earnings,
              orderId,
              orderNumber,
              `Venta POS: ${toDeduct} unidades @ $${unitCost.toFixed(2)}`,
              userId
            ])

            console.log('[POS Orders] Consignment wallet updated:', { supplierId: lot.supplier_id, earnings })
          }

          // Track traceability (use first lot's data for the line)
          if (!supplierId) {
            supplierId = parseInt(lot.supplier_id)
            lotId = parseInt(lot.lot_id)
            costPrice = unitCost
            isConsignment = true
          }

          remainingQty -= toDeduct
        }

        // 2. If not fully satisfied, try purchase lots
        if (remainingQty > 0) {
          const purchaseLots = await db.query(`
            SELECT
              pli.id as lot_id,
              pli.lot_number,
              pli.quantity_available,
              pli.unit_cost,
              pli.supplier_id,
              pli.purchase_line_id
            FROM purchase_lot_inventory pli
            WHERE pli.warehouse_id = $1
              AND pli.product_id = $2
              AND pli.company_id = $3
              AND pli.quantity_available > 0
              ${variantId ? 'AND (pli.variant_id = $4 OR pli.variant_id IS NULL)' : 'AND pli.variant_id IS NULL'}
            ORDER BY pli.received_at ASC
            FOR UPDATE
          `, variantId
            ? [warehouseId, productId, companyId, variantId]
            : [warehouseId, productId, companyId])

          for (const lot of purchaseLots.rows) {
            if (remainingQty <= 0) break

            const availableQty = parseFloat(lot.quantity_available) || 0
            const toDeduct = Math.min(remainingQty, availableQty)
            const unitCost = parseFloat(lot.unit_cost)

            // Deduct from purchase lot
            await db.query(`
              UPDATE purchase_lot_inventory
              SET
                quantity_available = quantity_available - $1,
                quantity_sold = quantity_sold + $1
              WHERE id = $2
            `, [toDeduct, lot.lot_id])

            // Track cost price if not already set from consignment
            if (!costPrice) {
              costPrice = unitCost
              lotId = parseInt(lot.lot_id)
            }

            remainingQty -= toDeduct
          }
        }

        // 2.5 Empty lots stay in DB (quantity_available=0) to preserve FK references
        // from consignment_return_lines.lot_inventory_id. Do NOT delete them.

        // 3. Update warehouse stock (covers both consignment and purchase deductions)
        // IMPORTANT: Use UPSERT to ensure stock record exists before deducting
        if (variantId) {
          // Update variant stock in market_product_variants
          await db.query(`
            UPDATE market_product_variants
            SET quantity_on_hand = GREATEST(0, quantity_on_hand - $1), updated_at = NOW()
            WHERE id = $2
          `, [quantityToReduce, variantId])

          // Try to update variant-specific warehouse stock first
          const variantStockResult = await db.query(`
            UPDATE market_warehouse_stock
            SET quantity_on_hand = GREATEST(0, quantity_on_hand - $1), updated_at = NOW(), last_movement_at = NOW()
            WHERE product_id = $2 AND variant_id = $3 AND warehouse_id = $4
            RETURNING id, quantity_on_hand
          `, [quantityToReduce, productId, variantId, warehouseId])

          // If no variant-specific row, deduct from product-level warehouse stock
          if (variantStockResult.rows.length === 0) {
            // Try update first
            const productStockResult = await db.query(`
              UPDATE market_warehouse_stock
              SET quantity_on_hand = GREATEST(0, quantity_on_hand - $1), updated_at = NOW(), last_movement_at = NOW()
              WHERE product_id = $2 AND warehouse_id = $3 AND variant_id IS NULL
              RETURNING id, quantity_on_hand
            `, [quantityToReduce, productId, warehouseId])

            // If no row was updated, the stock record doesn't exist - create it with 0 (already sold)
            if (productStockResult.rows.length === 0) {
              console.warn(`[POS Orders] WARNING: No warehouse stock record for product ${productId} in warehouse ${warehouseId}. Creating record.`)
              await db.query(`
                INSERT INTO market_warehouse_stock (warehouse_id, product_id, variant_id, quantity_on_hand, quantity_reserved, created_at, updated_at, last_movement_at)
                VALUES ($1, $2, NULL, 0, 0, NOW(), NOW(), NOW())
                ON CONFLICT (warehouse_id, product_id, variant_id) DO NOTHING
              `, [warehouseId, productId])
            }
          }
        } else {
          // Update warehouse stock for product without variant
          const stockUpdateResult = await db.query(`
            UPDATE market_warehouse_stock
            SET quantity_on_hand = GREATEST(0, quantity_on_hand - $1), updated_at = NOW(), last_movement_at = NOW()
            WHERE product_id = $2 AND warehouse_id = $3 AND variant_id IS NULL
            RETURNING id, quantity_on_hand
          `, [quantityToReduce, productId, warehouseId])

          // If no row was updated, the stock record doesn't exist - this is a data integrity issue
          if (stockUpdateResult.rows.length === 0) {
            console.warn(`[POS Orders] WARNING: No warehouse stock record for product ${productId} in warehouse ${warehouseId}. Creating record.`)
            await db.query(`
              INSERT INTO market_warehouse_stock (warehouse_id, product_id, variant_id, quantity_on_hand, quantity_reserved, created_at, updated_at, last_movement_at)
              VALUES ($1, $2, NULL, 0, 0, NOW(), NOW(), NOW())
              ON CONFLICT (warehouse_id, product_id, variant_id) DO NOTHING
            `, [warehouseId, productId])
          }
        }

        // ALWAYS update main product stock
        const productResult = await db.query(`
          UPDATE market_products
          SET quantity_on_hand = GREATEST(0, quantity_on_hand - $1), updated_at = NOW()
          WHERE id = $2
          RETURNING id, quantity_on_hand
        `, [quantityToReduce, productId])

        const quantityAfter = parseFloat(productResult.rows[0]?.quantity_on_hand) || 0

        // Register inventory movement for traceability
        await db.query(`
          INSERT INTO market_inventory_movements (
            product_id, company_id, movement_type, quantity,
            quantity_before, quantity_after, reference_type, reference_id, notes, created_at
          )
          SELECT $1, company_id, 'sale_out', $2, $3, $4, 'pos_order', $5, $6, NOW()
          FROM market_products WHERE id = $1
        `, [productId, -quantityToReduce, quantityBefore, quantityAfter, orderId,
          `Venta POS: ${orderNumber}${isConsignment ? ' (Consignación)' : ''}`])

        console.log('[POS Orders] Stock processed:', {
          product: productId,
          isConsignment,
          supplierId,
          costPrice,
          quantityBefore,
          quantityAfter
        })
      }

      // IMPORTANT: If no cost was obtained from FIFO lots, get it from the product
      // This ensures margin calculations are always accurate
      if (costPrice === null && productId) {
        const productCostResult = await db.query(
          'SELECT cost_price FROM market_products WHERE id = $1',
          [productId]
        )
        costPrice = parseFloat(productCostResult.rows[0]?.cost_price) || 0
        console.log('[POS Orders] Using product cost_price as fallback:', { productId, costPrice })
      }

      // Insert order line with traceability fields
      const originalPrice = line.originalPrice ? parseFloat(line.originalPrice) : null
      await db.query(`
        INSERT INTO market_pos_order_lines (
          order_id, product_id, variant_id, product_name, product_sku,
          quantity, unit_price, original_price,
          discount_percent, discount_amount,
          subtotal, tax_amount, total,
          promotion_id, promotion_name,
          supplier_id, lot_id, cost_price, is_consignment,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
      `, [
        orderId,
        productId,
        variantId,
        line.productName,
        line.productSku || null,
        quantity,
        unitPrice,
        originalPrice,
        discountPercent,
        lineDiscount,
        lineSubtotal,
        taxAmount,
        lineTotal,
        line.promotionId ? parseInt(line.promotionId) : null,
        line.promotionName || null,
        supplierId,
        lotId,
        costPrice,
        isConsignment
      ])
    }

    // Insert payments if provided
    if (payments && payments.length > 0) {
      for (const payment of payments) {
        await db.query(`
          INSERT INTO market_pos_payments (
            order_id, payment_method, amount, currency,
            amount_tendered, change_amount, change_currency, reference,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        `, [
          orderId,
          payment.method || 'cash',
          payment.amount || 0,
          payment.currency || 'USD',
          payment.amountTendered || null,
          payment.changeAmount || null,
          payment.changeCurrency || null, // Currency of the change (USD or CUP)
          payment.reference || null
        ])
      }

      // Calculate total paid from database (more reliable than request data)
      const dbPaidResult = await db.query(`
        SELECT COALESCE(SUM(amount), 0) as total_paid FROM market_pos_payments WHERE order_id = $1
      `, [orderId])
      const totalPaid = parseFloat(dbPaidResult.rows[0]?.total_paid) || 0

      console.log('[POS Orders] Payment verification:', {
        orderId,
        orderNumber,
        totalAmount,
        totalPaid,
        paymentsReceived: payments.length,
        willMarkAsPaid: totalPaid >= (totalAmount - 0.01)
      })

      // If fully paid (with small tolerance for floating point), mark as paid
      if (totalPaid >= (totalAmount - 0.01)) {
        await db.query(`
          UPDATE market_pos_orders SET status = 'paid', updated_at = NOW()
          WHERE id = $1
        `, [orderId])
        console.log('[POS Orders] Order marked as PAID:', orderNumber)
      } else {
        console.log('[POS Orders] Order remains DRAFT:', orderNumber, 'Need:', totalAmount, 'Got:', totalPaid)
      }
    }

    // Calculate and record employee commissions if employee has commission_rate > 0
    if (employeeId) {
      const employeeResult = await db.query(`
        SELECT id, commission_rate FROM market_employees
        WHERE id = $1 AND company_id = $2
      `, [employeeId, companyId])

      const employee = employeeResult.rows[0]
      const commissionRate = parseFloat(employee?.commission_rate) || 0

      if (employee && commissionRate > 0) {
        // Get order lines with cost price for commission calculation
        const orderLinesResult = await db.query(`
          SELECT
            id, product_id, product_name, quantity, unit_price, cost_price
          FROM market_pos_order_lines
          WHERE order_id = $1
        `, [orderId])

        let totalCommission = 0

        for (const line of orderLinesResult.rows) {
          const quantity = parseFloat(line.quantity) || 0
          const unitPrice = parseFloat(line.unit_price) || 0

          // Get cost price from order line or fetch from product
          let lineCostPrice = parseFloat(line.cost_price) || 0
          if (lineCostPrice === 0 && line.product_id) {
            const productCost = await db.query(`
              SELECT cost_price FROM market_products WHERE id = $1
            `, [line.product_id])
            lineCostPrice = parseFloat(productCost.rows[0]?.cost_price) || 0
          }

          // Calculate gross margin (before any discounts)
          // Margin = (selling_price - cost_price) * quantity
          const marginAmount = (unitPrice - lineCostPrice) * quantity
          // Commission = margin * commission_rate%
          const commissionAmount = marginAmount * (commissionRate / 100)

          if (commissionAmount > 0) {
            // Insert commission record
            await db.query(`
              INSERT INTO market_employee_commissions (
                company_id, employee_id, pos_order_id, pos_order_line_id,
                product_id, product_name, quantity,
                unit_price, cost_price, margin_amount,
                commission_rate, commission_amount, status, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', NOW())
            `, [
              companyId, employeeId, orderId, line.id,
              line.product_id, line.product_name, quantity,
              unitPrice, lineCostPrice, marginAmount,
              commissionRate, commissionAmount
            ])

            totalCommission += commissionAmount
          }
        }

        // Update employee's commission balance
        if (totalCommission > 0) {
          await db.query(`
            UPDATE market_employees
            SET commission_balance = COALESCE(commission_balance, 0) + $1
            WHERE id = $2
          `, [totalCommission, employeeId])

          console.log('[POS Orders] Commission calculated:', {
            employeeId,
            commissionRate,
            totalCommission: totalCommission.toFixed(2)
          })
        }
      }
    }

    console.log('[POS Orders] Created order:', orderNumber, 'ID:', orderId)

    return NextResponse.json({
      success: true,
      data: {
        id: orderId,
        orderNumber,
        totalAmount
      },
      message: 'Orden creada exitosamente'
    })

  } catch (error) {
    console.error('[POS Orders API] Error creating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear orden'
    }, { status: 500 })
  }
}
