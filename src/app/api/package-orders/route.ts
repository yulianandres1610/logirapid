import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// GET: Obtener todas las órdenes de paquetería con paginación y filtros
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')
    const orderId = searchParams.get('id')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const searchTerm = searchParams.get('search')
    const statusFilter = searchParams.get('status')

    // Build WHERE conditions
    const conditions = []
    const params = []

    if (orderId) {
      params.push(orderId)
      conditions.push('id = $' + params.length)
    }

    if (customerId) {
      params.push(customerId)
      conditions.push('customerid = $' + params.length)
    }

    if (searchTerm) {
      const searchPattern = `%${searchTerm}%`
      params.push(searchPattern, searchPattern, searchPattern, searchPattern)
      const searchCondition = `(
        ordernumber ILIKE $${params.length - 3} OR
        customername ILIKE $${params.length - 2} OR
        CONCAT(firstname, ' ', lastname) ILIKE $${params.length - 1} OR
        customeraddress::text ILIKE $${params.length}
      )`
      conditions.push(searchCondition)
    }

    if (statusFilter && statusFilter !== 'all') {
      params.push(statusFilter)
      conditions.push('status = $' + params.length)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Count total records
    const countQuery = `SELECT COUNT(*) as total FROM package_orders ${whereClause}`
    const countResult = await db.query(countQuery, params)
    const total = parseInt(countResult.rows[0].total)

    // Get paginated results
    const offset = (page - 1) * limit
    params.push(limit, offset)
    const dataQuery = `
      SELECT
        id,
        customerid as "customerId",
        customername as "customerName",
        customeraddress as "customerAddress",
        ordernumber as "orderNumber",
        services,
        notes,
        scheduleddate as "scheduledDate",
        timeslot as "timeSlot",
        status,
        createdby as "createdBy",
        latitude,
        longitude,
        subtotal,
        taxamount as "taxAmount",
        totalamount as "totalAmount",
        boxcount as "boxCount",
        boxprice as "boxPrice",
        additionalservices as "additionalServices",
        boxes,
        firstname as "firstName",
        lastname as "lastName",
        createdat as "createdAt",
        updatedat as "updatedAt"
      FROM package_orders
      ${whereClause}
      ORDER BY createdat DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `

    const result = await db.query(dataQuery, params)

    return NextResponse.json({
      success: true,
      data: result.rows,
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
    console.log('POST /api/package-orders received body:', body)

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

    // Prepare services as JSON string
    const servicesJson = typeof body.services === 'string' ? body.services : JSON.stringify(body.services)
    const additionalServicesJson = typeof body.additionalServices === 'string'
      ? body.additionalServices
      : JSON.stringify(body.additionalServices || [])
    const boxesJson = typeof body.boxes === 'string' ? body.boxes : JSON.stringify(body.boxes || [])

    const insertQuery = `
      INSERT INTO package_orders (
        customerid, customername, customeraddress, ordernumber, services,
        notes, scheduleddate, timeslot, status, createdby,
        latitude, longitude, subtotal, taxamount, totalamount,
        boxcount, boxprice, additionalservices, boxes,
        firstname, lastname, createdat, updatedat
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19,
        $20, $21, NOW(), NOW()
      )
      RETURNING *
    `

    const values = [
      body.customerId,
      body.customerName || null,
      body.customerAddress || null,
      body.orderNumber,
      servicesJson,
      body.notes || null,
      body.scheduledDate || null,
      body.timeSlot || null,
      body.status || 'pending',
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
      body.firstName || null,
      body.lastName || null
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

    return NextResponse.json({
      success: true,
      data: formattedOrder,
      message: 'Orden de paquetería creada exitosamente'
    })

  } catch (error) {
    console.error('Error creating package order:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al crear orden de paquetería'
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