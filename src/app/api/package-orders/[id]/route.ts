import { NextRequest, NextResponse } from 'next/server'
import { Database } from 'sqlite3'
import { open } from 'sqlite'

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

    const db = await open({
      filename: './data/cubarapid.db',
      driver: Database
    })

    const order = await db.get('SELECT * FROM package_orders WHERE id = ?', [id])
    await db.close()

    if (!order) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

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

    const db = await open({
      filename: './data/cubarapid.db',
      driver: Database
    })

    // Verificar que la orden existe
    const existingOrder = await db.get('SELECT id FROM package_orders WHERE id = ?', [id])
    if (!existingOrder) {
      await db.close()
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    // Preparar campos para actualización
    const updateFields = []
    const updateValues = []

    // Campos permitidos para actualizar
    const allowedFields = [
      'customerId', 'customerName', 'customerAddress', 'services', 'notes',
      'scheduledDate', 'timeSlot', 'status', 'subtotal', 'taxAmount',
      'totalAmount', 'boxCount', 'boxPrice', 'additionalServices',
      'paymentMethod', 'latitude', 'longitude', 'routeId', 'stopNumber',
      'firstName', 'lastName', 'phone', 'email', 'address', 'customerNotes',
      'servicePackages', 'serviceQuantities', 'needsBoxConstruction'
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields.push(`${field} = ?`)

        // Convertir arrays a JSON strings
        if (field === 'customerAddress' && typeof body[field] === 'object') {
          updateValues.push(JSON.stringify(body[field]))
        } else if (field === 'additionalServices' && Array.isArray(body[field])) {
          updateValues.push(JSON.stringify(body[field]))
        } else if (field === 'servicePackages' && typeof body[field] === 'object') {
          updateValues.push(JSON.stringify(body[field]))
        } else if (field === 'serviceQuantities' && typeof body[field] === 'object') {
          updateValues.push(JSON.stringify(body[field]))
        } else if (field === 'needsBoxConstruction' && typeof body[field] === 'object') {
          updateValues.push(JSON.stringify(body[field]))
        } else if (field === 'services' && Array.isArray(body[field])) {
          updateValues.push(JSON.stringify(body[field]))
        } else {
          updateValues.push(body[field])
        }
      }
    }

    if (updateFields.length === 0) {
      await db.close()
      return NextResponse.json({
        success: false,
        error: 'No hay campos válidos para actualizar'
      }, { status: 400 })
    }

    // Agregar timestamp de actualización
    updateFields.push('updatedAt = datetime("now")')
    updateValues.push(id)

    const updateQuery = `UPDATE package_orders SET ${updateFields.join(', ')} WHERE id = ?`

    console.log('💾 EJECUTANDO ACTUALIZACIÓN:')
    console.log('📋 Query:', updateQuery)
    console.log('🔢 Valores:', updateValues)
    console.log(`📨 Campos a actualizar: ${updateFields.join(', ')}`)

    const result = await db.run(updateQuery, updateValues)

    // Obtener la orden actualizada
    const updatedOrder = await db.get('SELECT * FROM package_orders WHERE id = ?', [id])
    await db.close()

    // Parsear JSON fields para la respuesta
    if (updatedOrder.customerAddress && typeof updatedOrder.customerAddress === 'string') {
      try {
        updatedOrder.customerAddress = JSON.parse(updatedOrder.customerAddress)
      } catch (e) {
        // Si no es JSON válido, dejar como string
      }
    }

    if (updatedOrder.additionalServices && typeof updatedOrder.additionalServices === 'string') {
      try {
        updatedOrder.additionalServices = JSON.parse(updatedOrder.additionalServices)
      } catch (e) {
        // Si no es JSON válido, dejar como string
      }
    }

    // Parsear servicios
    if (updatedOrder.services && typeof updatedOrder.services === 'string') {
      try {
        updatedOrder.services = JSON.parse(updatedOrder.services)
      } catch (e) {
        // Si no es JSON válido, dejar como array vacío
        updatedOrder.services = []
      }
    }

    // Parsear cantidades de servicios
    if (updatedOrder.serviceQuantities && typeof updatedOrder.serviceQuantities === 'string') {
      try {
        updatedOrder.serviceQuantities = JSON.parse(updatedOrder.serviceQuantities)
      } catch (e) {
        // Si no es JSON válido, dejar como objeto vacío
        updatedOrder.serviceQuantities = {}
      }
    }

    // Parsear necesidades de construcción de cajas
    if (updatedOrder.needsBoxConstruction && typeof updatedOrder.needsBoxConstruction === 'string') {
      try {
        updatedOrder.needsBoxConstruction = JSON.parse(updatedOrder.needsBoxConstruction)
      } catch (e) {
        // Si no es JSON válido, dejar como objeto vacío
        updatedOrder.needsBoxConstruction = {}
      }
    }

    // Parsear empaques por servicio
    if (updatedOrder.servicePackages && typeof updatedOrder.servicePackages === 'string') {
      try {
        updatedOrder.servicePackages = JSON.parse(updatedOrder.servicePackages)
      } catch (e) {
        // Si no es JSON válido, dejar como objeto vacío
        updatedOrder.servicePackages = {}
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Orden de paquetería actualizada exitosamente',
      data: updatedOrder
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

    const db = await open({
      filename: './data/cubarapid.db',
      driver: Database
    })

    // Verificar que la orden existe
    const existingOrder = await db.get('SELECT id FROM package_orders WHERE id = ?', [id])
    if (!existingOrder) {
      await db.close()
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const result = await db.run('DELETE FROM package_orders WHERE id = ?', [id])
    await db.close()

    if (result.changes === 0) {
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