import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

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
        o.created_by,
        o.created_at,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as created_by_name,
        t.name as terminal_name,
        s.session_code
      FROM market_pos_orders o
      LEFT JOIN users u ON o.created_by = u.id
      LEFT JOIN market_pos_terminals t ON o.pos_terminal_id = t.id
      LEFT JOIN market_pos_sessions s ON o.pos_session_id = s.id
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

    // Get payments for all orders
    const orderIds = result.rows.map(r => r.id)
    let paymentsMap: Record<number, { method: string; amount: number; currency: string }[]> = {}

    if (orderIds.length > 0) {
      const paymentsResult = await db.query(`
        SELECT order_id, payment_method, amount, currency
        FROM market_pos_payments
        WHERE order_id = ANY($1)
        ORDER BY order_id, id
      `, [orderIds])

      for (const p of paymentsResult.rows) {
        if (!paymentsMap[p.order_id]) {
          paymentsMap[p.order_id] = []
        }
        paymentsMap[p.order_id].push({
          method: p.payment_method,
          amount: parseFloat(p.amount) || 0,
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

    const body = await request.json()
    const {
      sessionId,
      terminalId,
      warehouseId,
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

    // Create order
    const orderResult = await db.query(`
      INSERT INTO market_pos_orders (
        company_id, pos_session_id, pos_terminal_id, warehouse_id,
        order_number, customer_id, customer_name,
        subtotal, discount_amount, tax_amount, total_amount,
        currency, status, offline_id, synced_at,
        created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
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
      userId
    ])

    const orderId = orderResult.rows[0].id

    // Insert order lines
    for (const line of lines) {
      const lineSubtotal = (line.quantity || 1) * (line.unitPrice || 0)
      const lineDiscount = line.discountAmount || (lineSubtotal * (line.discountPercent || 0) / 100)
      const lineTotal = lineSubtotal - lineDiscount + (line.taxAmount || 0)

      await db.query(`
        INSERT INTO market_pos_order_lines (
          order_id, product_id, product_name, product_sku,
          quantity, unit_price,
          discount_percent, discount_amount,
          subtotal, tax_amount, total,
          promotion_id, promotion_name,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      `, [
        orderId,
        line.productId,
        line.productName,
        line.productSku || null,
        line.quantity || 1,
        line.unitPrice || 0,
        line.discountPercent || 0,
        lineDiscount,
        lineSubtotal,
        line.taxAmount || 0,
        lineTotal,
        line.promotionId || null,
        line.promotionName || null
      ])

      // Update inventory - ALWAYS reduce stock when selling
      if (line.productId) {
        const quantityToReduce = line.quantity || 1

        console.log('[POS Orders] Reducing stock for product:', {
          productId: line.productId,
          quantity: quantityToReduce,
          warehouseId
        })

        // Get current stock before update
        const currentStockResult = await db.query(`
          SELECT quantity_on_hand FROM market_products WHERE id = $1
        `, [line.productId])

        const quantityBefore = currentStockResult.rows[0]?.quantity_on_hand || 0

        // If warehouse specified, also update warehouse stock
        if (warehouseId) {
          const warehouseStockResult = await db.query(`
            UPDATE market_warehouse_stock
            SET quantity_on_hand = GREATEST(0, quantity_on_hand - $1), updated_at = NOW()
            WHERE product_id = $2 AND warehouse_id = $3
            RETURNING id, quantity_on_hand
          `, [quantityToReduce, line.productId, warehouseId])

          console.log('[POS Orders] Warehouse stock update:', warehouseStockResult.rows)
        }

        // ALWAYS update main product stock
        const productResult = await db.query(`
          UPDATE market_products
          SET quantity_on_hand = GREATEST(0, quantity_on_hand - $1), updated_at = NOW()
          WHERE id = $2
          RETURNING id, quantity_on_hand
        `, [quantityToReduce, line.productId])

        const quantityAfter = productResult.rows[0]?.quantity_on_hand || 0
        console.log('[POS Orders] Product stock update:', productResult.rows)

        // Register inventory movement for traceability
        await db.query(`
          INSERT INTO market_inventory_movements (
            product_id, company_id, movement_type, quantity,
            quantity_before, quantity_after, reference_type, reference_id, notes, created_at
          )
          SELECT $1, company_id, 'sale_out', $2, $3, $4, 'pos_order', $5, $6, NOW()
          FROM market_products WHERE id = $1
        `, [line.productId, -quantityToReduce, quantityBefore, quantityAfter, orderId, `Venta POS: ${orderNumber}`])
      }
    }

    // Insert payments if provided
    if (payments && payments.length > 0) {
      for (const payment of payments) {
        await db.query(`
          INSERT INTO market_pos_payments (
            order_id, payment_method, amount, currency,
            amount_tendered, change_amount, reference,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
          orderId,
          payment.method || 'cash',
          payment.amount || 0,
          payment.currency || 'USD',
          payment.amountTendered || null,
          payment.changeAmount || null,
          payment.reference || null
        ])
      }

      // Calculate total paid
      const totalPaid = payments.reduce((sum: number, p: { amount?: number }) => sum + (p.amount || 0), 0)

      // If fully paid, mark as paid
      if (totalPaid >= totalAmount) {
        await db.query(`
          UPDATE market_pos_orders SET status = 'paid', updated_at = NOW()
          WHERE id = $1
        `, [orderId])
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
