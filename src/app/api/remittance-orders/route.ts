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
 * GET /api/remittance-orders
 * List remittance orders with filters
 */
export async function GET(request: NextRequest) {
  try {
    // Handle special migration BEFORE auth check
    const { searchParams } = new URL(request.url)
    const fixMigration = searchParams.get('fixMigration')

    // FIX MIGRATION: Fix orders with NULL selling_company_id (no auth required, one-time use)
    if (fixMigration === 'fix-company-7-secret-2024') {
      console.log('[Migration] Running fix for selling_company_id')

      // First, show all orders to see what's there
      const allOrders = await db.query(`
        SELECT id, order_number, selling_company_id, sold_by_user_id, created_at
        FROM remittance_orders
        ORDER BY created_at DESC
      `)

      // Fix orders with NULL OR wrong selling_company_id - assign to company 7
      const fixResult = await db.query(`
        UPDATE remittance_orders
        SET selling_company_id = 7
        WHERE selling_company_id IS NULL OR selling_company_id != 7
        RETURNING id, order_number, selling_company_id
      `)

      console.log('[Migration] Fixed orders:', fixResult.rows)

      return NextResponse.json({
        success: true,
        migration: {
          allOrdersBefore: allOrders.rows,
          fixed: fixResult.rows.length,
          orders: fixResult.rows
        }
      })
    }

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
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    // ALWAYS get companyId from cookie as primary source (more reliable)
    const companyIdCookie = cookieStore.get('user-company-id')?.value
    if (companyIdCookie) {
      payload.companyId = parseInt(companyIdCookie, 10)
      console.log(`[Remittance Orders GET] Using companyId from cookie: ${payload.companyId}`)
    } else if (!payload.companyId) {
      console.log(`[Remittance Orders GET] WARNING: No companyId in cookie or JWT`)
    }

    // Old migration parameter (kept for backwards compat)
    if (fixMigration === 'fix-company-7') {
      console.log('[Migration] Running fix for selling_company_id')

      // Fix orders with NULL selling_company_id - assign to company 7
      const fixResult = await db.query(`
        UPDATE remittance_orders
        SET selling_company_id = 7
        WHERE selling_company_id IS NULL
        RETURNING id, order_number
      `)

      console.log('[Migration] Fixed orders:', fixResult.rows)

      return NextResponse.json({
        success: true,
        migration: {
          fixed: fixResult.rows.length,
          orders: fixResult.rows
        }
      })
    }

    const debugOrder = searchParams.get('debugOrder')
    if (debugOrder) {
      console.log(`[Remittance Orders GET] DEBUG MODE for order: ${debugOrder}`)
      const debugResult = await db.query(`
        SELECT id, order_number, selling_company_id, sold_by_user_id, status, created_at
        FROM remittance_orders
        WHERE order_number = $1
      `, [debugOrder])

      console.log(`[Remittance Orders GET] Found order:`, debugResult.rows[0])
      console.log(`[Remittance Orders GET] User companyId: ${payload.companyId}`)

      return NextResponse.json({
        success: true,
        debug: {
          order: debugResult.rows[0],
          userCompanyId: payload.companyId,
          userRole: payload.role,
          match: debugResult.rows[0]?.selling_company_id === payload.companyId
        }
      })
    }

    // Check if table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'remittance_orders'
      ) as exists
    `)

    if (!tableCheck.rows[0].exists) {
      // Table doesn't exist - return empty data with setup message
      return NextResponse.json({
        success: true,
        data: {
          orders: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0
          }
        },
        needsSetup: true,
        message: 'La tabla de órdenes de remesas no existe. Ejecute la migración en /api/migrations/remittance-orders-setup'
      })
    }

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const province = searchParams.get('province')
    const search = searchParams.get('search')

    const offset = (page - 1) * limit
    const params: any[] = []

    // Build WHERE clause based on role
    let whereClause = 'WHERE 1=1'

    console.log(`[Remittance Orders GET] ====== DEBUGGING ======`)
    console.log(`[Remittance Orders GET] User: ${payload.email}, role: ${payload.role}, companyId: ${payload.companyId}`)

    // First, let's check what orders exist in the database for debugging
    try {
      const debugQuery = await db.query(`
        SELECT id, order_number, selling_company_id, created_at
        FROM remittance_orders
        ORDER BY created_at DESC
        LIMIT 5
      `)
      console.log(`[Remittance Orders GET] Latest 5 orders in DB:`, debugQuery.rows)
    } catch (dbErr) {
      console.log(`[Remittance Orders GET] Debug query error:`, dbErr)
    }

    // SUPER_ADMIN can see all, others see their company's orders
    // Ensure companyId is properly cast to integer for comparison
    const userCompanyId = parseInt(String(payload.companyId), 10)

    if (payload.role !== 'SUPER_ADMIN') {
      // Filter by company - users only see their company's orders
      if (userCompanyId && !isNaN(userCompanyId) && userCompanyId > 0) {
        params.push(userCompanyId)
        whereClause += ` AND ro.selling_company_id = $${params.length}`
        console.log(`[Remittance Orders GET] Filtering by selling_company_id = ${userCompanyId}`)
      } else {
        console.log(`[Remittance Orders GET] WARNING: Invalid userCompanyId (${userCompanyId}), showing no orders`)
        // Return empty if no valid company ID
        return NextResponse.json({
          success: true,
          data: {
            orders: [],
            pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
          },
          warning: 'No se pudo determinar la empresa del usuario'
        })
      }
    } else {
      console.log(`[Remittance Orders GET] SUPER_ADMIN - showing all orders`)
    }

    if (status) {
      params.push(status)
      whereClause += ` AND ro.status = $${params.length}`
    }

    if (province) {
      params.push(province)
      whereClause += ` AND ro.recipient_province = $${params.length}`
    }

    if (search) {
      params.push(`%${search}%`)
      const searchParam = params.length
      whereClause += ` AND (
        ro.order_number ILIKE $${searchParam}
        OR ro.recipient_name ILIKE $${searchParam}
        OR ro.recipient_phone ILIKE $${searchParam}
        OR ro.sender_name ILIKE $${searchParam}
      )`
    }

    // Count total
    console.log(`[Remittance Orders GET] Query WHERE clause: ${whereClause}`)
    console.log(`[Remittance Orders GET] Query params:`, params)

    const countResult = await db.query(`
      SELECT COUNT(*) as total FROM remittance_orders ro ${whereClause}
    `, params)
    const total = parseInt(countResult.rows[0].total)

    console.log(`[Remittance Orders GET] Total orders found: ${total}`)

    // Get orders
    const query = `
      SELECT
        ro.*,
        sc.legalname as selling_company_name,
        bc.legalname as broker_company_name,
        COALESCE(su.firstname || ' ' || su.lastname, su.firstname, su.lastname, '') as sold_by_name
      FROM remittance_orders ro
      LEFT JOIN companies sc ON ro.selling_company_id = sc.id
      LEFT JOIN companies bc ON ro.broker_company_id = bc.id
      LEFT JOIN users su ON ro.sold_by_user_id = su.id
      ${whereClause}
      ORDER BY ro.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `

    params.push(limit, offset)
    const result = await db.query(query, params)

    return NextResponse.json({
      success: true,
      data: {
        _debug: {
          userCompanyId: userCompanyId,
          userRole: payload.role,
          totalFound: total
        },
        orders: result.rows.map(row => ({
          id: row.id,
          orderNumber: row.order_number,
          status: row.status,
          paymentStatus: row.payment_status,
          _sellingCompanyId: row.selling_company_id,
          // Amounts
          sendAmount: parseFloat(row.send_amount),
          sendCurrency: row.send_currency,
          receiveAmount: parseFloat(row.receive_amount),
          receiveCurrency: row.receive_currency,
          totalCharged: parseFloat(row.total_charged),
          serviceFee: parseFloat(row.service_fee) || 0,
          deliveryFee: parseFloat(row.delivery_fee) || 0,
          // Recipient
          recipientName: row.recipient_name,
          recipientPhone: row.recipient_phone,
          recipientProvince: row.recipient_province,
          recipientMunicipality: row.recipient_municipality,
          recipientAddress: row.recipient_address,
          // Sender
          senderName: row.sender_name,
          senderPhone: row.sender_phone,
          // Companies
          sellingCompanyId: row.selling_company_id,
          sellingCompanyName: row.selling_company_name,
          brokerCompanyId: row.broker_company_id,
          brokerCompanyName: row.broker_company_name,
          soldByName: row.sold_by_name,
          // Times
          estimatedDelivery: row.estimated_delivery,
          createdAt: row.created_at,
          deliveredAt: row.delivered_at,
          // Payment
          paymentMethod: row.payment_method
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('[Remittance Orders API] GET error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener órdenes'
    }, { status: 500 })
  }
}

/**
 * POST /api/remittance-orders
 * Create a new remittance order
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
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    // ALWAYS get companyId from cookie as primary source (more reliable)
    const companyIdCookie = cookieStore.get('user-company-id')?.value
    let sellingCompanyId: number

    if (companyIdCookie) {
      sellingCompanyId = parseInt(companyIdCookie, 10)
      console.log(`[Remittance Orders POST] Using companyId from cookie: ${sellingCompanyId}`)
    } else if (payload.companyId) {
      sellingCompanyId = parseInt(String(payload.companyId), 10)
      console.log(`[Remittance Orders POST] Using companyId from JWT: ${sellingCompanyId}`)
    } else {
      console.error(`[Remittance Orders POST] ERROR: No companyId found for user ${payload.email}`)
      return NextResponse.json({
        success: false,
        error: 'No se pudo determinar la empresa del usuario. Por favor, cierre sesión e inicie nuevamente.'
      }, { status: 400 })
    }

    // Validate we have a valid number
    if (isNaN(sellingCompanyId) || sellingCompanyId <= 0) {
      console.error(`[Remittance Orders POST] ERROR: Invalid companyId: ${sellingCompanyId}`)
      return NextResponse.json({
        success: false,
        error: 'ID de empresa inválido. Por favor, cierre sesión e inicie nuevamente.'
      }, { status: 400 })
    }

    console.log(`[Remittance Orders POST] Final sellingCompanyId: ${sellingCompanyId}`)

    const body = await request.json()
    const {
      // Location
      province,
      municipality,
      // Service
      productId,
      serviceType,
      // Amounts
      sendAmount,
      sendCurrency = 'USD',
      receiveCurrency,
      deliveryFee = 0,
      exchangeRate = 1,
      // Recipient
      recipient,
      // Sender
      sender,
      // Payment
      paymentMethod,
      paymentReference,
      cashReceived,
      // Optional broker assignment
      brokerId
    } = body

    // Validate required fields
    if (!province || !municipality) {
      return NextResponse.json({
        success: false,
        error: 'Provincia y municipio son requeridos'
      }, { status: 400 })
    }

    if (!sendAmount || sendAmount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'El monto debe ser mayor a 0'
      }, { status: 400 })
    }

    if (!recipient?.name || !recipient?.phone) {
      return NextResponse.json({
        success: false,
        error: 'Nombre y teléfono del destinatario son requeridos'
      }, { status: 400 })
    }

    if (!sender?.name) {
      return NextResponse.json({
        success: false,
        error: 'Nombre del remitente es requerido'
      }, { status: 400 })
    }

    // Get product info for pricing
    let serviceFee = 0
    let serviceFeePercentage = 0
    let productName = serviceType || 'Remesa USD'
    const finalReceiveCurrency = receiveCurrency || sendCurrency

    if (productId) {
      const productResult = await db.query(`
        SELECT
          pc.name,
          pc.mi_costo,
          pc.precio_publico,
          pc.mi_costo_fijo,
          cpp.mi_costo as company_mi_costo,
          cpp.precio_clientes as company_precio,
          cpp.mi_costo_fijo as company_mi_costo_fijo,
          cpp.precio_clientes_fijo as company_precio_fijo
        FROM product_catalog pc
        LEFT JOIN company_product_pricing cpp
          ON cpp.product_id = pc.id AND cpp.company_id = $1
        WHERE pc.id = $2
      `, [payload.companyId, productId])

      if (productResult.rows.length > 0) {
        const product = productResult.rows[0]
        productName = product.name

        // Calculate service fee (percentage)
        const feePercentage = parseFloat(product.company_precio || product.precio_publico) || 0
        serviceFeePercentage = feePercentage
        serviceFee = (sendAmount * feePercentage / 100)

        // Add fixed fee if exists
        const fixedFee = parseFloat(product.company_precio_fijo || product.mi_costo_fijo) || 0
        serviceFee += fixedFee
      }
    }

    // Calculate totals
    const receiveAmount = sendAmount * exchangeRate
    const totalCharged = sendAmount + serviceFee + deliveryFee
    const cashChange = cashReceived ? cashReceived - totalCharged : null

    // Find best broker or use provided one
    let brokerCompanyId = brokerId
    // ALWAYS start with '1-3 días' - only change to '1-24 horas' AFTER successful fund reservation
    let estimatedDelivery = '1-3 días'
    let potentialFastDelivery = false

    console.log(`[Remittance Orders] Looking for broker in ${province}/${municipality} with ${finalReceiveCurrency} balance >= ${receiveAmount}`)

    if (!brokerCompanyId) {
      // Find broker with most available funds in this location
      // Use LOWER() for case-insensitive matching since frontend sends formatted names
      // First try exact municipality match
      let brokerResult = await db.query(`
        SELECT
          c.id,
          c.legalname,
          bwb.available_balance,
          bwb.currency
        FROM companies c
        LEFT JOIN broker_wallet_balances bwb
          ON bwb.company_id = c.id AND bwb.currency = $3
        WHERE c.companytype = 'broker'
          AND c.broker_is_active = true
          AND LOWER(c.broker_province) = LOWER($1)
          AND (LOWER(c.broker_municipality) = LOWER($2) OR c.broker_coverage_area::jsonb ? $2)
        ORDER BY COALESCE(bwb.available_balance, 0) DESC
        LIMIT 1
      `, [province, municipality, finalReceiveCurrency])

      // If no exact match, try to find any broker in the same province
      if (brokerResult.rows.length === 0) {
        console.log(`[Remittance Orders] No broker found for exact municipality ${municipality}, searching province ${province}...`)
        brokerResult = await db.query(`
          SELECT
            c.id,
            c.legalname,
            bwb.available_balance,
            bwb.currency
          FROM companies c
          LEFT JOIN broker_wallet_balances bwb
            ON bwb.company_id = c.id AND bwb.currency = $2
          WHERE c.companytype = 'broker'
            AND c.broker_is_active = true
            AND LOWER(c.broker_province) = LOWER($1)
          ORDER BY COALESCE(bwb.available_balance, 0) DESC
          LIMIT 1
        `, [province, finalReceiveCurrency])
      }

      // If still no match, try to find ANY active broker
      if (brokerResult.rows.length === 0) {
        console.log(`[Remittance Orders] No broker found in province ${province}, searching any active broker...`)
        brokerResult = await db.query(`
          SELECT
            c.id,
            c.legalname,
            bwb.available_balance,
            bwb.currency
          FROM companies c
          LEFT JOIN broker_wallet_balances bwb
            ON bwb.company_id = c.id AND bwb.currency = $1
          WHERE c.companytype = 'broker'
            AND c.broker_is_active = true
          ORDER BY COALESCE(bwb.available_balance, 0) DESC
          LIMIT 1
        `, [finalReceiveCurrency])
      }

      if (brokerResult.rows.length > 0) {
        brokerCompanyId = brokerResult.rows[0].id
        const availableBalance = parseFloat(brokerResult.rows[0].available_balance) || 0
        const brokerCurrency = brokerResult.rows[0].currency

        console.log(`[Remittance Orders] Found broker ${brokerResult.rows[0].legalname} (ID: ${brokerCompanyId}) with ${availableBalance} ${brokerCurrency || 'N/A'} available`)

        // Only mark as potential fast delivery if broker has enough balance in the correct currency
        if (brokerCurrency === finalReceiveCurrency && availableBalance >= receiveAmount) {
          potentialFastDelivery = true
          console.log(`[Remittance Orders] Broker has sufficient ${finalReceiveCurrency} balance for fast delivery`)
        } else {
          console.log(`[Remittance Orders] Broker does NOT have sufficient ${finalReceiveCurrency} balance (need ${receiveAmount}, has ${availableBalance} ${brokerCurrency || 'none'})`)
        }
      } else {
        console.log(`[Remittance Orders] No active broker found in the system`)
      }
    } else {
      // Check provided broker's availability
      const brokerBalance = await db.query(`
        SELECT available_balance, currency FROM broker_wallet_balances
        WHERE company_id = $1 AND currency = $2
      `, [brokerCompanyId, finalReceiveCurrency])

      if (brokerBalance.rows.length > 0) {
        const available = parseFloat(brokerBalance.rows[0].available_balance) || 0
        console.log(`[Remittance Orders] Provided broker ${brokerCompanyId} has ${available} ${finalReceiveCurrency} available`)
        if (available >= receiveAmount) {
          potentialFastDelivery = true
        }
      } else {
        console.log(`[Remittance Orders] Provided broker ${brokerCompanyId} has no ${finalReceiveCurrency} wallet`)
      }
    }

    // Begin transaction
    await db.query('BEGIN')

    console.log(`[Remittance Orders POST] ====== CREATING ORDER ======`)
    console.log(`[Remittance Orders POST] User: ${payload.email}, companyId: ${payload.companyId}, userId: ${payload.userId}`)
    console.log(`[Remittance Orders POST] Province: ${province}, Municipality: ${municipality}`)
    console.log(`[Remittance Orders POST] Broker assigned: ${brokerCompanyId}`)

    try {
      // Generate order number
      const orderNumResult = await db.query('SELECT generate_remittance_order_number() as order_number')
      const orderNumber = orderNumResult.rows[0].order_number
      console.log(`[Remittance Orders POST] Generated order number: ${orderNumber}`)

      // Create the order
      const insertResult = await db.query(`
        INSERT INTO remittance_orders (
          order_number,
          selling_company_id, sold_by_user_id,
          broker_company_id, broker_province, broker_municipality,
          product_id, product_name, service_type,
          send_amount, send_currency, receive_amount, receive_currency, exchange_rate,
          service_fee, service_fee_percentage, delivery_fee, total_charged,
          recipient_name, recipient_phone, recipient_id_number,
          recipient_address, recipient_neighborhood,
          recipient_province, recipient_municipality, recipient_address_references,
          has_alternate_contact, alternate_contact_name, alternate_contact_phone,
          sender_name, sender_phone, sender_email, sender_id_type, sender_id_number,
          status, payment_status, estimated_delivery,
          payment_method, payment_reference, cash_received, cash_change
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
          $31, $32, $33, $34, $35, $36, $37, $38, $39, $40,
          $41
        )
        RETURNING *
      `, [
        orderNumber,
        sellingCompanyId, payload.userId,
        brokerCompanyId, province, municipality,
        productId, productName, serviceType,
        sendAmount, sendCurrency, receiveAmount, finalReceiveCurrency, exchangeRate,
        serviceFee, serviceFeePercentage, deliveryFee, totalCharged,
        recipient.name, recipient.phone, recipient.idNumber || null,
        recipient.address || null, recipient.neighborhood || null,
        province, municipality, recipient.addressReferences || null,
        recipient.hasAlternateContact || false,
        recipient.alternateContactName || null,
        recipient.alternateContactPhone || null,
        sender.name, sender.phone || null, sender.email || null,
        sender.idType || null, sender.idNumber || null,
        'pending', paymentMethod ? 'paid' : 'pending', estimatedDelivery,
        paymentMethod, paymentReference, cashReceived, cashChange
      ])

      const order = insertResult.rows[0]
      console.log(`[Remittance Orders POST] Order created successfully:`)
      console.log(`[Remittance Orders POST] - ID: ${order.id}`)
      console.log(`[Remittance Orders POST] - Order Number: ${order.order_number}`)
      console.log(`[Remittance Orders POST] - selling_company_id: ${order.selling_company_id}`)
      console.log(`[Remittance Orders POST] - sold_by_user_id: ${order.sold_by_user_id}`)

      // ALWAYS reserve funds in broker's wallet if broker was assigned
      let fundsReserved = false
      if (brokerCompanyId) {
        try {
          const reserveResult = await db.query(`
            SELECT reserve_broker_funds($1, $2, $3, $4, $5) as reserved
          `, [brokerCompanyId, finalReceiveCurrency, receiveAmount, order.id, payload.userId])

          fundsReserved = reserveResult.rows[0]?.reserved === true

          if (fundsReserved) {
            console.log(`[Remittance Orders] Funds reserved for order ${order.id}: ${receiveAmount} ${finalReceiveCurrency}`)
          } else {
            console.log(`[Remittance Orders] Could not reserve funds for order ${order.id} - broker may have insufficient balance`)
          }
        } catch (reserveError) {
          console.error(`[Remittance Orders] Error reserving funds:`, reserveError)
          // Continue without reservation - order will need manual handling
        }
      }

      // Update order with reservation status
      if (fundsReserved) {
        await db.query(`
          UPDATE remittance_orders
          SET estimated_delivery = '1-24 horas'
          WHERE id = $1
        `, [order.id])
        order.estimated_delivery = '1-24 horas'
      }

      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        data: {
          id: order.id,
          orderNumber: order.order_number,
          status: order.status,
          paymentStatus: order.payment_status,
          sendAmount: parseFloat(order.send_amount),
          sendCurrency: order.send_currency,
          receiveAmount: parseFloat(order.receive_amount),
          receiveCurrency: order.receive_currency,
          serviceFee: parseFloat(order.service_fee),
          deliveryFee: parseFloat(order.delivery_fee),
          totalCharged: parseFloat(order.total_charged),
          cashChange: order.cash_change ? parseFloat(order.cash_change) : null,
          estimatedDelivery: order.estimated_delivery,
          recipientName: order.recipient_name,
          recipientProvince: order.recipient_province,
          recipientMunicipality: order.recipient_municipality,
          sellingCompanyId: order.selling_company_id,
          brokerCompanyId: order.broker_company_id,
          fundsReserved,
          createdAt: order.created_at
        }
      })

    } catch (err) {
      await db.query('ROLLBACK')
      throw err
    }

  } catch (error) {
    console.error('[Remittance Orders API] POST error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear orden'
    }, { status: 500 })
  }
}
