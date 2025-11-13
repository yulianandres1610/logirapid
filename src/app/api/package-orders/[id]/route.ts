import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


// GET: Obtener una orden específica por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id)
    if (isNaN(id)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    const query = `
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
        phone,
        email,
        address,
        customernotes as "customerNotes",
        servicepackages as "servicePackages",
        servicequantities as "serviceQuantities",
        needsboxconstruction as "needsBoxConstruction",
        routeid as "routeId",
        stopnumber as "stopNumber",
        paymentmethod as "paymentMethod",
        createdat as "createdAt",
        updatedat as "updatedAt"
      FROM package_orders
      WHERE id = $1
    `

    const result = await db.query(query, [id])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = result.rows[0]

    // Parsear JSON fields
    if (order.customerAddress && typeof order.customerAddress === 'string') {
      try {
        order.customerAddress = JSON.parse(order.customerAddress)
      } catch (e) {
        // Si no es JSON válido, dejar como string
      }
    }

    if (order.additionalServices && typeof order.additionalServices === 'string') {
      try {
        order.additionalServices = JSON.parse(order.additionalServices)
      } catch (e) {
        // Si no es JSON válido, dejar como string
      }
    }

    // Parsear servicios con manejo de corrupción
    if (order.services && typeof order.services === 'string') {
      if (order.services === '[object Object]') {
        console.warn('⚠️ Services corrupto en API para orden', order.id, ', intentando usar servicePackages')
        // Intentar usar servicePackages como respaldo
        if (order.servicePackages) {
          try {
            const servicePackagesData = JSON.parse(order.servicePackages)
            order.services = Object.keys(servicePackagesData)
            // Extraer serviceQuantities y needsBoxConstruction desde servicePackages
            order.serviceQuantities = {}
            order.needsBoxConstruction = {}
            if (servicePackagesData && typeof servicePackagesData === 'object') {
              for (const [service, packages] of Object.entries(servicePackagesData)) {
                if (Array.isArray(packages) && packages.length > 0) {
                  order.serviceQuantities[service] = packages.length
                  order.needsBoxConstruction[service] = true
                }
              }
            }
            console.log('✅ Servicios recuperados desde servicePackages en API:', order.services)
          } catch (e) {
            console.error('❌ Error parsing servicePackages en API:', e)
            order.services = ['Recoger Caja'] // valor por defecto
          }
        } else {
          order.services = ['Recoger Caja'] // valor por defecto
        }
      } else {
        try {
          order.services = JSON.parse(order.services)
        } catch (e) {
          // Si no es JSON válido y no es [object Object], intentar servicePackages
          console.warn('⚠️ Error parsing services en API para orden', order.id, ', intentando servicePackages')
          if (order.servicePackages) {
            try {
              const servicePackagesData = JSON.parse(order.servicePackages)
              order.services = Object.keys(servicePackagesData)
              // Extraer serviceQuantities y needsBoxConstruction desde servicePackages
              order.serviceQuantities = {}
              order.needsBoxConstruction = {}
              if (servicePackagesData && typeof servicePackagesData === 'object') {
                for (const [service, packages] of Object.entries(servicePackagesData)) {
                  if (Array.isArray(packages) && packages.length > 0) {
                    order.serviceQuantities[service] = packages.length
                    order.needsBoxConstruction[service] = true
                  }
                }
              }
              console.log('✅ Servicios recuperados desde servicePackages en API:', order.services)
            } catch (e) {
              console.error('❌ Error parsing servicePackages en API:', e)
              order.services = ['Recoger Caja']
            }
          } else {
            order.services = ['Recoger Caja']
          }
        }
      }
    }

    // Parsear cantidades de servicios
    if (order.serviceQuantities && typeof order.serviceQuantities === 'string') {
      try {
        order.serviceQuantities = JSON.parse(order.serviceQuantities)
      } catch (e) {
        // Si no es JSON válido, dejar como objeto vacío
        order.serviceQuantities = {}
      }
    }

    // Parsear necesidades de construcción de cajas
    if (order.needsBoxConstruction && typeof order.needsBoxConstruction === 'string') {
      try {
        order.needsBoxConstruction = JSON.parse(order.needsBoxConstruction)
      } catch (e) {
        // Si no es JSON válido, dejar como objeto vacío
        order.needsBoxConstruction = {}
      }
    }

    // Parsear empaques por servicio
    if (order.servicePackages && typeof order.servicePackages === 'string') {
      try {
        order.servicePackages = JSON.parse(order.servicePackages)
      } catch (e) {
        // Si no es JSON válido, dejar como objeto vacío
        order.servicePackages = {}
      }
    }

    return NextResponse.json({
      success: true,
      data: order
    })

  } catch (error) {
    console.error('Error getting package order:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener orden de paquetería'
    }, { status: 500 })
  }
}

// PUT: Actualizar una orden específica por ID
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id)

    const body = await request.json()
    console.log('🔧 PUT /api/package-orders/[id] - Actualizando orden')
    console.log(`📦 ID Orden: ${id}`)
    console.log(`🔄 Estado solicitado: ${body.status}`)
    console.log(`📍 Datos completos:`, JSON.stringify(body, null, 2))

    if (isNaN(id)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    // Verificar que la orden existe
    const existingResult = await db.query('SELECT id FROM package_orders WHERE id = $1', [id])
    if (existingResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    // Preparar campos para actualización
    const updateFields = []
    const updateValues = []
    let valueIndex = 1

    // Mapeo de campos de API a campos de base de datos
    const fieldMapping = {
      customerId: 'customerid',
      customerName: 'customername',
      customerAddress: 'customeraddress',
      services: 'services',
      notes: 'notes',
      scheduledDate: 'scheduleddate',
      timeSlot: 'timeslot',
      status: 'status',
      subtotal: 'subtotal',
      taxAmount: 'taxamount',
      totalAmount: 'totalamount',
      boxCount: 'boxcount',
      boxPrice: 'boxprice',
      additionalServices: 'additionalservices',
      paymentMethod: 'paymentmethod',
      latitude: 'latitude',
      longitude: 'longitude',
      routeId: 'routeid',
      stopNumber: 'stopnumber',
      firstName: 'firstname',
      lastName: 'lastname',
      phone: 'phone',
      email: 'email',
      address: 'address',
      customerNotes: 'customernotes',
      servicePackages: 'servicepackages',
      serviceQuantities: 'servicequantities',
      needsBoxConstruction: 'needsboxconstruction'
    }

    for (const [apiField, dbField] of Object.entries(fieldMapping)) {
      if (body[apiField] !== undefined) {
        let value = body[apiField]

        // Convertir objects/arrays a JSON strings
        if (apiField === 'customerAddress' && typeof value === 'object') {
          value = JSON.stringify(value)
        } else if (apiField === 'additionalServices' && Array.isArray(value)) {
          value = JSON.stringify(value)
        } else if (apiField === 'servicePackages' && typeof value === 'object') {
          value = JSON.stringify(value)
        } else if (apiField === 'serviceQuantities' && typeof value === 'object') {
          value = JSON.stringify(value)
        } else if (apiField === 'needsBoxConstruction' && typeof value === 'object') {
          value = JSON.stringify(value)
        } else if (apiField === 'services' && Array.isArray(value)) {
          value = JSON.stringify(value)
        }

        updateFields.push(`${dbField} = $${valueIndex}`)
        updateValues.push(value)
        valueIndex++
      }
    }

    if (updateFields.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay campos válidos para actualizar'
      }, { status: 400 })
    }

    // Agregar timestamp de actualización
    updateFields.push('updatedat = NOW()')
    updateValues.push(id)

    const updateQuery = `
      UPDATE package_orders
      SET ${updateFields.join(', ')}
      WHERE id = $${valueIndex}
      RETURNING *
    `

    console.log('💾 EJECUTANDO ACTUALIZACIÓN:')
    console.log('📋 Query:', updateQuery)
    console.log('🔢 Valores:', updateValues)
    console.log(`📨 Campos a actualizar: ${updateFields.join(', ')}`)

    const result = await db.query(updateQuery, updateValues)

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo actualizar la orden'
      }, { status: 500 })
    }

    // Formatear la orden actualizada para la respuesta
    const updatedOrder = result.rows[0]
    const formattedOrder = {
      id: updatedOrder.id,
      customerId: updatedOrder.customerid,
      customerName: updatedOrder.customername,
      customerAddress: updatedOrder.customeraddress,
      orderNumber: updatedOrder.ordernumber,
      services: updatedOrder.services,
      notes: updatedOrder.notes,
      scheduledDate: updatedOrder.scheduleddate,
      timeSlot: updatedOrder.timeslot,
      status: updatedOrder.status,
      createdBy: updatedOrder.createdby,
      latitude: updatedOrder.latitude,
      longitude: updatedOrder.longitude,
      subtotal: updatedOrder.subtotal,
      taxAmount: updatedOrder.taxamount,
      totalAmount: updatedOrder.totalamount,
      boxCount: updatedOrder.boxcount,
      boxPrice: updatedOrder.boxprice,
      additionalServices: updatedOrder.additionalservices,
      boxes: updatedOrder.boxes,
      firstName: updatedOrder.firstname,
      lastName: updatedOrder.lastname,
      phone: updatedOrder.phone,
      email: updatedOrder.email,
      address: updatedOrder.address,
      customerNotes: updatedOrder.customernotes,
      servicePackages: updatedOrder.servicepackages,
      serviceQuantities: updatedOrder.servicequantities,
      needsBoxConstruction: updatedOrder.needsboxconstruction,
      routeId: updatedOrder.routeid,
      stopNumber: updatedOrder.stopnumber,
      paymentMethod: updatedOrder.paymentmethod,
      createdAt: updatedOrder.createdat,
      updatedAt: updatedOrder.updatedat
    }

    // Parsear JSON fields para la respuesta
    if (formattedOrder.customerAddress && typeof formattedOrder.customerAddress === 'string') {
      try {
        formattedOrder.customerAddress = JSON.parse(formattedOrder.customerAddress)
      } catch (e) {
        // Si no es JSON válido, dejar como string
      }
    }

    if (formattedOrder.additionalServices && typeof formattedOrder.additionalServices === 'string') {
      try {
        formattedOrder.additionalServices = JSON.parse(formattedOrder.additionalServices)
      } catch (e) {
        // Si no es JSON válido, dejar como string
      }
    }

    // Parsear servicios
    if (formattedOrder.services && typeof formattedOrder.services === 'string') {
      try {
        formattedOrder.services = JSON.parse(formattedOrder.services)
      } catch (e) {
        // Si no es JSON válido, dejar como array vacío
        formattedOrder.services = []
      }
    }

    // Parsear cantidades de servicios
    if (formattedOrder.serviceQuantities && typeof formattedOrder.serviceQuantities === 'string') {
      try {
        formattedOrder.serviceQuantities = JSON.parse(formattedOrder.serviceQuantities)
      } catch (e) {
        // Si no es JSON válido, dejar como objeto vacío
        formattedOrder.serviceQuantities = {}
      }
    }

    // Parsear necesidades de construcción de cajas
    if (formattedOrder.needsBoxConstruction && typeof formattedOrder.needsBoxConstruction === 'string') {
      try {
        formattedOrder.needsBoxConstruction = JSON.parse(formattedOrder.needsBoxConstruction)
      } catch (e) {
        // Si no es JSON válido, dejar como objeto vacío
        formattedOrder.needsBoxConstruction = {}
      }
    }

    // Parsear empaques por servicio
    if (formattedOrder.servicePackages && typeof formattedOrder.servicePackages === 'string') {
      try {
        formattedOrder.servicePackages = JSON.parse(formattedOrder.servicePackages)
      } catch (e) {
        // Si no es JSON válido, dejar como objeto vacío
        formattedOrder.servicePackages = {}
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Orden de paquetería actualizada exitosamente',
      data: formattedOrder
    })

  } catch (error) {
    console.error('Error updating package order:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar orden de paquetería',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE: Eliminar una orden específica por ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id)
    if (isNaN(id)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    // Verificar que la orden existe
    const existingResult = await db.query('SELECT id FROM package_orders WHERE id = $1', [id])
    if (existingResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const result = await db.query('DELETE FROM package_orders WHERE id = $1 RETURNING id', [id])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo eliminar la orden'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Orden de paquetería eliminada exitosamente'
    })

  } catch (error) {
    console.error('Error deleting package order:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al eliminar orden de paquetería',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}