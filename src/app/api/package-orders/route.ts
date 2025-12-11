import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'
import { sendOrderCreatedSMS, sendWhatsAppOrderConfirmation, isValidPhoneNumber } from '@/lib/sms-service'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


// GET: Obtener todas las órdenes de paquetería con paginación y filtros
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)
    const customerId = searchParams.get('customerId')
    const orderId = searchParams.get('id')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const searchTerm = searchParams.get('search')
    const statusFilter = searchParams.get('status')
    const orderType = searchParams.get('orderType') // 'recogida' o 'oficina'
    const hasCoordinates = searchParams.get('hasCoordinates') === 'true' // Filtro para vista de mapa
    const warehouseId = searchParams.get('warehouseId') // Filtro por almacén
    const companyIdParam = searchParams.get('companyId')
    const companyIdFilter = companyIdParam ? parseInt(companyIdParam) : headerCompanyId

    // Build WHERE conditions
    const conditions = []
    const params = []

    if (orderId) {
      params.push(orderId)
      conditions.push('po.id = $' + params.length)
    }

    if (customerId) {
      params.push(customerId)
      conditions.push('po.customerid = $' + params.length)
    }

    // Filtrar por tipo de orden (recogida u oficina)
    if (orderType) {
      params.push(orderType)
      conditions.push('po.order_type = $' + params.length)
    } else {
      // Si no se especifica orderType, excluir solo las de oficina
      // Mostrar recogida y entrega (ambas necesitan ruta)
      conditions.push("po.order_type IN ('recogida', 'entrega')")
    }

    if (searchTerm) {
      const searchPattern = `%${searchTerm}%`
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern)
      const searchCondition = `(
        po.ordernumber ILIKE $${params.length - 5} OR
        po.customername ILIKE $${params.length - 4} OR
        CONCAT(po.firstname, ' ', po.lastname) ILIKE $${params.length - 3} OR
        po.customeraddress::text ILIKE $${params.length - 2} OR
        po.phone ILIKE $${params.length - 1} OR
        EXISTS (
          SELECT 1 FROM empaques e
          WHERE e.orden_id = po.id
          AND e.codigo ILIKE $${params.length}
        )
      )`
      conditions.push(searchCondition)
    }

    if (statusFilter && statusFilter !== 'all') {
      params.push(statusFilter)
      conditions.push('po.status = $' + params.length)
    }

    // Filtro para vista de mapa: solo órdenes con coordenadas válidas
    if (hasCoordinates) {
      conditions.push('po.latitude IS NOT NULL AND po.longitude IS NOT NULL')
    }

    // Filtro por almacén
    if (warehouseId) {
      params.push(parseInt(warehouseId))
      conditions.push('po.warehouse_id = $' + params.length)
    }

    // Filtro por empresa (multi-tenant)
    if (!isSuperAdmin) {
      if (!headerCompanyId) {
        return NextResponse.json({
          success: false,
          error: 'No se pudo determinar la empresa del usuario'
        }, { status: 400 })
      }
      params.push(headerCompanyId)
      conditions.push(`po.company_id = $${params.length}`)
    } else if (companyIdParam) {
      params.push(parseInt(companyIdParam))
      conditions.push(`po.company_id = $${params.length}`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Optimized: Use Window Function to get count in same query
    // This eliminates 1 query and reduces latency by ~40%
    const offset = (page - 1) * limit
    params.push(limit, offset)

    const dataQuery = `
      SELECT
        po.id,
        po.customerid as "customerId",
        po.customername as "customerName",
        po.customeraddress as "customerAddress",
        po.ordernumber as "orderNumber",
        po.services,
        po.scheduleddate as "scheduledDate",
        po.timeslot as "timeSlot",
        po.status,
        po.latitude,
        po.longitude,
        po.totalamount as "totalAmount",
        po.firstname as "firstName",
        po.lastname as "lastName",
        po.order_type as "orderType",
        po.office_order_data as "officeOrderData",
        po.warehouse_id as "warehouseId",
        po.warehouse_name as "warehouseName",
        po.zipcode,
        po.street,
        po.apartment,
        po.city,
        po.state,
        po.country,
        po.company_id as "companyId",
        c.legalname as "companyName",
        po.createdat as "createdAt",
        po.payment_status as "paymentStatus",
        po.paid_amount as "paidAmount",
        po.paymentmethod as "paymentMethod",
        COUNT(*) OVER() as total_count
      FROM package_orders po
      LEFT JOIN companies c ON po.company_id = c.id
      ${whereClause}
      ORDER BY po.createdat DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `

    const result = await db.query(dataQuery, params)
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0

    // Convertir coordenadas de string a number para el frontend
    const processedRows = result.rows.map(row => ({
      ...row,
      latitude: row.latitude ? parseFloat(row.latitude) : null,
      longitude: row.longitude ? parseFloat(row.longitude) : null,
      totalAmount: row.totalAmount ? parseFloat(row.totalAmount) : null,
      paidAmount: row.paidAmount ? parseFloat(row.paidAmount) : 0,
      paymentStatus: row.paymentStatus || 'pending_payment'
    }))

    return NextResponse.json({
      success: true,
      data: processedRows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: page > 1
      }
    })

  } catch (error) {
    console.error('Error getting package orders:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener órdenes de paquetería'
    }, { status: 500 })
  }
}

// Helper function to validate and recalculate services with product pricing from DB
async function validateAndEnrichServices(
  services: any[],
  companyId: number
): Promise<{ services: any[]; totalAmount: number }> {
  const enrichedServices = []
  let totalAmount = 0

  for (const service of services) {
    // If service has productId, look up pricing from database
    if (service.productId) {
      const priceResult = await db.query(`
        SELECT
          pc.id,
          pc.code,
          pc.name,
          COALESCE(cpp.sell_price, pc.precio_publico, pc.platform_price) as sell_price,
          COALESCE(cpp.cost_price, pc.mi_costo) as cost_price
        FROM product_catalog pc
        LEFT JOIN company_product_pricing cpp
          ON cpp.product_id = pc.id AND cpp.company_id = $1
        WHERE pc.id = $2 AND pc.is_active = true
      `, [companyId, service.productId])

      if (priceResult.rows.length > 0) {
        const product = priceResult.rows[0]
        const quantity = service.quantity || 1
        const unitPrice = parseFloat(product.sell_price || 0)
        const costPrice = parseFloat(product.cost_price || 0)
        const subtotal = unitPrice * quantity

        enrichedServices.push({
          productId: product.id,
          productCode: product.code,
          name: product.name,
          quantity,
          unitPrice,
          costPrice,
          subtotal
        })

        totalAmount += subtotal
      } else {
        // Product not found - keep original service data
        enrichedServices.push(service)
        totalAmount += parseFloat(service.subtotal || service.unitPrice || 0)
      }
    } else {
      // Legacy service without productId - keep as is
      enrichedServices.push(service)
      totalAmount += parseFloat(service.subtotal || service.price || 0)
    }
  }

  return { services: enrichedServices, totalAmount }
}

// POST: Crear nueva orden de paquetería
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { isSuperAdmin, companyId: headerCompanyId, userId, userRole, userEmail } = getCompanyFilter(request)
    const bodyCompanyId = body.companyId ? parseInt(body.companyId) : null
    const companyId = !isSuperAdmin
      ? headerCompanyId || bodyCompanyId
      : (bodyCompanyId || headerCompanyId)

    if (!companyId) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo determinar la empresa para la orden'
      }, { status: 400 })
    }
    console.log('POST /api/package-orders received body:', {
      customerId: body.customerId,
      orderNumber: body.orderNumber,
      customerAddress: body.customerAddress,
      street: body.street,
      apartment: body.apartment,
      city: body.city,
      state: body.state,
      zipcode: body.zipcode,
      country: body.country,
      latitude: body.latitude,
      longitude: body.longitude
    })

    // Validar campos requeridos
    if (!body || !body.customerId || !body.orderNumber || !body.services || body.services.length === 0) {
      console.error('Validation failed:', {
        hasBody: !!body,
        customerId: body?.customerId,
        orderNumber: body?.orderNumber,
        services: body?.services,
        servicesLength: body?.services?.length
      })
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos (customerId, orderNumber, services)'
      }, { status: 400 })
    }

    // Validar orden type y sus requisitos
    const orderType = body.orderType || 'recogida'

    if (orderType === 'recogida') {
      // PICKUP orders: scheduledDate and coordinates are OPTIONAL
      // They will be added later by the manager when scheduling the route

      // Validate order number format for PICKUP
      if (!body.orderNumber.startsWith('PICKUP')) {
        return NextResponse.json({
          success: false,
          error: 'Las órdenes de recogida deben tener un número que comience con PICKUP'
        }, { status: 400 })
      }
    }

    if (orderType === 'oficina') {
      // Validate order number format for SHIPPING
      if (!body.orderNumber.startsWith('SHIPPING')) {
        return NextResponse.json({
          success: false,
          error: 'Las órdenes de oficina deben tener un número que comience con SHIPPING'
        }, { status: 400 })
      }
    }

    if (orderType === 'entrega') {
      // DELIVERY orders: empty package delivery to customer
      // Validate order number format for DELIVERY
      if (!body.orderNumber.startsWith('DELIVERY')) {
        return NextResponse.json({
          success: false,
          error: 'Las órdenes de entrega deben tener un número que comience con DELIVERY'
        }, { status: 400 })
      }
    }

    // Helper function to extract zipcode from address
    const extractZipcode = (address: string): string | null => {
      if (!address) return null

      // 1. Patrón "STATE zipcode" (ej: "FL 33186" o "FL, 33142")
      // Acepta tanto espacio como coma+espacio entre estado y código postal
      let zipcodeMatch = address.match(/\b[A-Z]{2}[,\s]+(\d{5})(?:-\d{4})?\b/)
      if (zipcodeMatch) return zipcodeMatch[1]

      // 2. Patrón "state_name zipcode" (ej: "florida 33186", "miami florida 33186")
      zipcodeMatch = address.match(/(?:florida|miami|kentucky|texas|california|new york)[,\s]+(\d{5})(?:-\d{4})?\b/i)
      if (zipcodeMatch) return zipcodeMatch[1]

      // 3. Cualquier secuencia de 5 dígitos al final o en medio de la dirección
      zipcodeMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/)
      if (zipcodeMatch) return zipcodeMatch[1]

      return null
    }

    // Extract zipcode from address if not provided
    // Note: Use truthy check to handle empty strings
    const zipcode = body.zipcode && body.zipcode.trim() !== ''
      ? body.zipcode.trim()
      : (body.customerAddress ? extractZipcode(body.customerAddress) : null)

    // Parse services (might be string or array)
    const rawServices = typeof body.services === 'string'
      ? JSON.parse(body.services)
      : body.services

    // Validate and enrich services with pricing from database
    // This ensures prices come from company_product_pricing or product_catalog
    const { services: enrichedServices, totalAmount: calculatedTotal } = await validateAndEnrichServices(
      rawServices,
      companyId
    )

    // Use calculated total if services have productIds, otherwise use provided total
    const hasProductIds = enrichedServices.some((s: any) => s.productId)
    const finalTotalAmount = hasProductIds ? calculatedTotal : (body.totalAmount || 0)

    // Prepare services as JSON string
    const servicesJson = JSON.stringify(enrichedServices)
    const additionalServicesJson = typeof body.additionalServices === 'string'
      ? body.additionalServices
      : JSON.stringify(body.additionalServices || [])
    const boxesJson = typeof body.boxes === 'string' ? body.boxes : JSON.stringify(body.boxes || [])

    // Determine initial status based on order type
    const initialStatus = body.status || (orderType === 'oficina' ? 'picked_up' : 'pending')

    // Determine payment status based on payment method
    // If paymentStatus is explicitly provided (e.g., from wizard), use it
    // Otherwise, default to 'pending_payment'
    const paymentMethod = body.paymentMethod || 'cod'
    const paymentStatus = body.paymentStatus || 'pending_payment'
    const paidAmount = body.paidAmount || 0

    const insertQuery = `
      INSERT INTO package_orders (
        customerid, customername, customeraddress, ordernumber, services,
        notes, scheduleddate, timeslot, status, createdby,
        latitude, longitude, subtotal, taxamount, totalamount,
        boxcount, boxprice, additionalservices, boxes,
        firstname, lastname, order_type, office_order_data,
        zipcode, street, apartment, city, state, country,
        company_id, paymentmethod, payment_status, paid_amount,
        created_by_user_id,
        createdat, updatedat
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19,
        $20, $21, $22, $23,
        $24, $25, $26, $27, $28, $29,
        $30, $31, $32, $33,
        $34,
        NOW(), NOW()
      )
      RETURNING *
    `

    // Helper to convert empty strings to null
    const emptyToNull = (val: any) => val && String(val).trim() !== '' ? String(val).trim() : null

    const values = [
      body.customerId,
      emptyToNull(body.customerName),
      emptyToNull(body.customerAddress),
      body.orderNumber,
      servicesJson,
      emptyToNull(body.notes),
      emptyToNull(body.scheduledDate),
      emptyToNull(body.timeSlot),
      initialStatus,
      body.createdBy || userEmail || 'system',
      body.latitude || null,
      body.longitude || null,
      body.subtotal || 0,
      body.taxAmount || 0,
      finalTotalAmount,
      body.boxCount || 0,
      body.boxPrice || 0,
      additionalServicesJson,
      boxesJson,
      emptyToNull(body.firstName),
      emptyToNull(body.lastName),
      orderType,
      emptyToNull(body.officeOrderData),
      zipcode,
      emptyToNull(body.street),
      emptyToNull(body.apartment),
      emptyToNull(body.city),
      emptyToNull(body.state),
      emptyToNull(body.country),
      companyId,
      paymentMethod,
      paymentStatus,
      paidAmount,
      userId || null  // created_by_user_id
    ]

    const result = await db.query(insertQuery, values)

    // Get the created order
    const newOrder = result.rows[0]
    const orderId = newOrder.id

    // ================================================
    // CREAR ORDER_PARTICIPANTS Y ORDER_ACTIVITY_LOG
    // ================================================
    if (userId) {
      try {
        // Create order_participants entry
        await db.query(`
          INSERT INTO order_participants (
            order_id, company_id, created_by_user_id, created_by_role, created_at
          ) VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (order_id) DO NOTHING
        `, [orderId, companyId, userId, userRole || 'USER'])

        // Create order_activity_log entry
        await db.query(`
          INSERT INTO order_activity_log (
            order_id, company_id, user_id, user_role, user_name,
            activity_type, new_status, source
          ) VALUES ($1, $2, $3, $4, $5, 'created', $6, 'web')
        `, [orderId, companyId, userId, userRole || 'USER', userEmail || 'system', initialStatus])

        console.log(`✅ [UserTracking] Order ${orderId} created by user ${userId} (${userRole})`)
      } catch (trackingError) {
        // Don't fail order creation if tracking fails
        console.error('[UserTracking] Error creating participants/activity:', trackingError)
      }
    }

    // Format the response to match expected format
    const formattedOrder = {
      id: newOrder.id,
      customerId: newOrder.customerid,
      customerName: newOrder.customername,
      customerAddress: newOrder.customeraddress,
      orderNumber: newOrder.ordernumber,
      services: newOrder.services,
      notes: newOrder.notes,
      scheduledDate: newOrder.scheduleddate,
      timeSlot: newOrder.timeslot,
      status: newOrder.status,
      createdBy: newOrder.createdby,
      latitude: newOrder.latitude,
      longitude: newOrder.longitude,
      subtotal: newOrder.subtotal,
      taxAmount: newOrder.taxamount,
      totalAmount: newOrder.totalamount,
      boxCount: newOrder.boxcount,
      boxPrice: newOrder.boxprice,
      additionalServices: newOrder.additionalservices,
      boxes: newOrder.boxes,
      firstName: newOrder.firstname,
      lastName: newOrder.lastname,
      createdAt: newOrder.createdat,
      updatedAt: newOrder.updatedat,
      paymentMethod: newOrder.paymentmethod,
      paymentStatus: newOrder.payment_status
    }

    // ================================================
    // ENVIAR NOTIFICACION DE CONFIRMACION (WhatsApp automatico)
    // ================================================
    if (orderType === 'recogida' && body.customerId) {
      try {
        // Obtener telefono del cliente, nombre y datos de la empresa
        const customerQuery = await db.query(
          'SELECT phone, firstname, lastname FROM customers WHERE id = $1',
          [body.customerId]
        )

        const companyQuery = await db.query(
          'SELECT legalname, customer_service_phone FROM companies WHERE id = $1',
          [companyId]
        )

        const customerPhone = customerQuery.rows[0]?.phone
        const customerFirstName = customerQuery.rows[0]?.firstname || ''
        const customerLastName = customerQuery.rows[0]?.lastname || ''
        const customerFullName = `${customerFirstName} ${customerLastName}`.trim() || 'Cliente'
        const companyName = companyQuery.rows[0]?.legalname || 'LogiRapid'
        const customerServicePhone = companyQuery.rows[0]?.customer_service_phone || null

        // Solo enviar notificacion si hay telefono valido
        if (customerPhone && isValidPhoneNumber(customerPhone)) {
          const scheduledDate = newOrder.scheduleddate || new Date().toISOString()
          const timeSlot = newOrder.timeslot || null
          const address = newOrder.customeraddress || ''

          // WhatsApp es el canal principal de notificaciones automaticas
          console.log(`[WhatsApp] Enviando WhatsApp de confirmacion a ${customerPhone} para orden ${newOrder.ordernumber}`)

          const whatsappResult = await sendWhatsAppOrderConfirmation(
            customerPhone,
            customerFullName,
            companyName,
            newOrder.ordernumber,
            scheduledDate,
            timeSlot,
            address,
            customerServicePhone
          )

          if (whatsappResult.success) {
            console.log(`[WhatsApp] WhatsApp enviado exitosamente. SID: ${whatsappResult.messageId}`)
          } else {
            console.warn(`[WhatsApp] Error al enviar WhatsApp: ${whatsappResult.error}`)

            // Fallback a SMS si WhatsApp falla
            console.log(`[SMS] Intentando fallback a SMS...`)
            const smsResult = await sendOrderCreatedSMS(
              customerPhone,
              companyName,
              newOrder.ordernumber,
              scheduledDate,
              timeSlot,
              customerServicePhone
            )

            if (smsResult.success) {
              console.log(`[SMS] SMS de fallback enviado exitosamente. SID: ${smsResult.messageId}`)
            } else {
              console.warn(`[SMS] Error al enviar SMS de fallback: ${smsResult.error}`)
            }
          }
        } else {
          console.log(`[Notificacion] No se envio notificacion - telefono invalido o no disponible: ${customerPhone}`)
        }
      } catch (notificationError) {
        // No bloquear la creacion de la orden si falla la notificacion
        console.error('[Notificacion] Error al intentar enviar notificacion:', notificationError)
      }
    }

    return NextResponse.json({
      success: true,
      data: formattedOrder,
      message: 'Orden de paquetería creada exitosamente'
    })

  } catch (error) {
    console.error('Error creating package order:', error)
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error')
    console.error('Stack trace:', error instanceof Error ? error.stack : '')
    return NextResponse.json({
      success: false,
      error: 'Error al crear orden de paquetería',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// PUT: Actualizar orden de paquetería existente
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere ID de la orden'
      }, { status: 400 })
    }

    // If status is being updated, validate based on order type
    if (updateData.status) {
      // Fetch the existing order to check its type
      const existingOrderResult = await db.query(
        'SELECT order_type FROM package_orders WHERE id = $1',
        [id]
      )

      if (existingOrderResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No se encontró la orden'
        }, { status: 404 })
      }

      const orderType = existingOrderResult.rows[0].order_type

      // Validate: office orders cannot have 'pending' or 'reprogrammed' status
      if (orderType === 'oficina' && (updateData.status === 'pending' || updateData.status === 'reprogrammed')) {
        return NextResponse.json({
          success: false,
          error: 'Las órdenes de oficina no pueden tener estado "pendiente" o "reprogramado"'
        }, { status: 400 })
      }
    }

    // Build UPDATE query dynamically
    const updateFields = []
    const values = []
    let valueIndex = 1

    const fieldMapping = {
      customerId: 'customerid',
      customerName: 'customername',
      customerAddress: 'customeraddress',
      orderNumber: 'ordernumber',
      services: 'services',
      notes: 'notes',
      scheduledDate: 'scheduleddate',
      timeSlot: 'timeslot',
      status: 'status',
      createdBy: 'createdby',
      latitude: 'latitude',
      longitude: 'longitude',
      subtotal: 'subtotal',
      taxAmount: 'taxamount',
      totalAmount: 'totalamount',
      boxCount: 'boxcount',
      boxPrice: 'boxprice',
      additionalServices: 'additionalservices',
      boxes: 'boxes',
      firstName: 'firstname',
      lastName: 'lastname'
    }

    for (const [key, value] of Object.entries(updateData)) {
      if (fieldMapping[key]) {
        let processedValue = value

        // Convert arrays to JSON strings for JSON fields
        if (['services', 'additionalServices', 'boxes'].includes(key) && Array.isArray(value)) {
          processedValue = JSON.stringify(value)
        }

        updateFields.push(`${fieldMapping[key]} = $${valueIndex}`)
        values.push(processedValue)
        valueIndex++
      }
    }

    if (updateFields.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay campos para actualizar'
      }, { status: 400 })
    }

    // Add updatedat
    updateFields.push(`updatedat = NOW()`)

    // Add id to values
    values.push(id)

    const updateQuery = `
      UPDATE package_orders
      SET ${updateFields.join(', ')}
      WHERE id = $${valueIndex}
      RETURNING *
    `

    const result = await db.query(updateQuery, values)

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró la orden'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Orden de paquetería actualizada exitosamente'
    })

  } catch (error) {
    console.error('Error updating package order:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar orden de paquetería'
    }, { status: 500 })
  }
}
