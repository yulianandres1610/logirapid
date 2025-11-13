import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


// GET: Obtener todas las órdenes o buscar por criterio
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const customerPhone = searchParams.get('customerPhone')
    const orderNumber = searchParams.get('orderNumber')
    const customerId = searchParams.get('customerId')

    let query: string
    let params: any[] = []

    if (orderNumber) {
      // Buscar por número de orden
      query = `
        SELECT
          id,
          customerid as "customerId",
          ordernumber as "orderNumber",
          packagetype as "packageType",
          status,
          notes,
          createdby as "createdBy",
          agentid as "agentId",
          createdat as "createdAt"
        FROM crm_orders
        WHERE ordernumber = $1
      `
      params = [orderNumber]
    } else if (customerPhone) {
      // Buscar por teléfono de cliente
      query = `
        SELECT
          o.id,
          o.customerid as "customerId",
          o.ordernumber as "orderNumber",
          o.packagetype as "packageType",
          o.status,
          o.notes,
          o.createdby as "createdBy",
          o.agentid as "agentId",
          o.createdat as "createdAt"
        FROM crm_orders o
        LEFT JOIN customers c ON o.customerid = c.id
        WHERE c.phone = $1
        ORDER BY o.createdat DESC
      `
      params = [customerPhone]
    } else if (customerId) {
      // Buscar por ID de cliente
      query = `
        SELECT
          id,
          customerid as "customerId",
          ordernumber as "orderNumber",
          packagetype as "packageType",
          status,
          notes,
          createdby as "createdBy",
          agentid as "agentId",
          createdat as "createdAt"
        FROM crm_orders
        WHERE customerid = $1
        ORDER BY createdat DESC
      `
      params = [parseInt(customerId)]
    } else {
      // Obtener todas las órdenes
      query = `
        SELECT
          id,
          customerid as "customerId",
          ordernumber as "orderNumber",
          packagetype as "packageType",
          status,
          notes,
          createdby as "createdBy",
          agentid as "agentId",
          createdat as "createdAt"
        FROM crm_orders
        ORDER BY createdat DESC
        LIMIT 100
      `
      params = []
    }

    const result = await db.query(query, params)

    return NextResponse.json({
      success: true,
      data: result.rows
    })

  } catch (error) {
    console.error('Error getting orders:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener órdenes'
    }, { status: 500 })
  }
}

// POST: Crear nueva orden
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body || !body.customerId || !body.orderNumber || !body.packageType) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos (customerId, orderNumber, packageType)'
      }, { status: 400 })
    }

    const insertQuery = `
      INSERT INTO crm_orders (
        customerid, ordernumber, packagetype, status,
        notes, createdby, agentid, createdat
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, NOW()
      )
      RETURNING
        id,
        customerid as "customerId",
        ordernumber as "orderNumber",
        packagetype as "packageType",
        status,
        notes,
        createdby as "createdBy",
        agentid as "agentId",
        createdat as "createdAt"
    `

    const values = [
      body.customerId,
      body.orderNumber,
      body.packageType,
      body.status || 'pending',
      body.notes || null,
      body.createdBy || 'system',
      body.agentId || 'system'
    ]

    const result = await db.query(insertQuery, values)

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Orden creada exitosamente'
    })

  } catch (error) {
    console.error('Error creating order:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al crear orden'
    }, { status: 500 })
  }
}

// PUT: Actualizar orden existente
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

    // Construir query de actualización dinámica
    const updateFields = []
    const values = []
    let valueIndex = 1

    const fieldMapping: { [key: string]: string } = {
      customerId: 'customerid',
      orderNumber: 'ordernumber',
      packageType: 'packagetype',
      status: 'status',
      notes: 'notes',
      createdBy: 'createdby',
      agentId: 'agentid'
    }

    for (const [key, value] of Object.entries(updateData)) {
      if (fieldMapping[key] !== undefined) {
        updateFields.push(`${fieldMapping[key]} = $${valueIndex}`)
        values.push(value)
        valueIndex++
      }
    }

    if (updateFields.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay campos para actualizar'
      }, { status: 400 })
    }

    values.push(id)

    const updateQuery = `
      UPDATE crm_orders
      SET ${updateFields.join(', ')}
      WHERE id = $${valueIndex}
      RETURNING
        id,
        customerid as "customerId",
        ordernumber as "orderNumber",
        packagetype as "packageType",
        status,
        notes,
        createdby as "createdBy",
        agentid as "agentId",
        createdat as "createdAt"
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
      data: result.rows[0],
      message: 'Orden actualizada exitosamente'
    })

  } catch (error) {
    console.error('Error updating order:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar orden'
    }, { status: 500 })
  }
}