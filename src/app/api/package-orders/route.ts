import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'
import { sendOrderCreatedSMS, isValidPhoneNumber } from '@/lib/sms-service'

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
      totalAmount: row.totalAmount ? parseFloat(row.totalAmount) : null
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

// POST: Crear nueva orden de paquetería
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)
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

    // Prepare services as JSON string
    const servicesJson = typeof body.services === 'string' ? body.services : JSON.stringify(body.services)
    const additionalServicesJson = typeof body.additionalServices === 'string'
      ? body.additionalServices
      : JSON.stringify(body.additionalServices || [])
    const boxesJson = typeof body.boxes === 'string' ? body.boxes : JSON.stringify(body.boxes || [])

    // Determine initial status based on order type
    const initialStatus = body.status || (orderType === 'oficina' ? 'picked_up' : 'pending')

    const insertQuery = `
      INSERT INTO package_orders (
        customerid, customername, customeraddress, ordernumber, services,
        notes, scheduleddate, timeslot, status, createdby,
        latitude, longitude, subtotal, taxamount, totalamount,
        boxcount, boxprice, additionalservices, boxes,
        firstname, lastname, order_type, office_order_data,
        zipcode, street, apartment, city, state, country,
        company_id,
        createdat, updatedat
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19,
        $20, $21, $22, $23,
        $24, $25, $26, $27, $28, $29,
        $30,
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
      body.createdBy || 'system',
      body.latitude || null,
      body.longitude || null,
      body.subtotal || 0,
      body.taxAmount || 0,
      body.totalAmount || 0,
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
      companyId
    ]

    const result = await db.query(insertQuery, values)

    // Format the response to match expected format
    const newOrder = result.rows[0]
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
      updatedAt: newOrder.updatedat
    }

    // ================================================
    // ENVIAR SMS DE CONFIRMACION (solo para ordenes de recogida)
    // ================================================
    if (orderType === 'recogida' && body.customerId) {
      try {
        // Obtener telefono del cliente y nombre de la empresa
        const customerQuery = await db.query(
          'SELECT phone FROM customers WHERE id = $1',
          [body.customerId]
        )

        const companyQuery = await db.query(
          'SELECT legalname FROM companies WHERE id = $1',
          [companyId]
        )

        const customerPhone = customerQuery.rows[0]?.phone
        const companyName = companyQuery.rows[0]?.legalname || 'LogiRapid'

        // Solo enviar SMS si hay telefono valido y fecha programada
        if (customerPhone && isValidPhoneNumber(customerPhone)) {
          const scheduledDate = newOrder.scheduleddate || new Date().toISOString()
          const timeSlot = newOrder.timeslot || null

          console.log(`[SMS] Enviando SMS de confirmacion a ${customerPhone} para orden ${newOrder.ordernumber}`)

          const smsResult = await sendOrderCreatedSMS(
            customerPhone,
            companyName,
            newOrder.ordernumber,
            scheduledDate,
            timeSlot
          )

          if (smsResult.success) {
            console.log(`[SMS] SMS enviado exitosamente. SID: ${smsResult.messageId}`)
          } else {
            console.warn(`[SMS] Error al enviar SMS: ${smsResult.error}`)
          }
        } else {
          console.log(`[SMS] No se envio SMS - telefono invalido o no disponible: ${customerPhone}`)
        }
      } catch (smsError) {
        // No bloquear la creacion de la orden si falla el SMS
        console.error('[SMS] Error al intentar enviar SMS:', smsError)
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
