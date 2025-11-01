import { NextRequest, NextResponse } from 'next/server'
import {
  getAllOrders,
  getCustomerOrders,
  getOrderByNumber,
  saveOrder,
  updateOrder,
  saveOrderNote,
  getOrderNotes
} from '@/lib/database'

// GET: Obtener todas las órdenes o buscar por criterio
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const customerPhone = searchParams.get('customerPhone')
    const orderNumber = searchParams.get('orderNumber')
    const customerId = searchParams.get('customerId')

    let orders

    if (orderNumber) {
      // Buscar por número de orden
      const order = getOrderByNumber(orderNumber)
      orders = order ? [order] : []
    } else if (customerPhone) {
      // Buscar por teléfono de cliente
      const customerOrders = getAllOrders()
      orders = customerOrders.filter((order: any) => order.phone === customerPhone)
    } else if (customerId) {
      // Buscar por ID de cliente
      orders = getCustomerOrders(parseInt(customerId))
    } else {
      // Obtener todas las órdenes
      orders = getAllOrders()
    }

    return NextResponse.json({
      success: true,
      data: orders
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

    const newOrder = saveOrder({
      customerId: body.customerId,
      orderNumber: body.orderNumber,
      packageType: body.packageType,
      status: body.status || 'pending',
      notes: body.notes,
      createdBy: body.createdBy || 'system',
      agentId: body.agentId || 'system'
    })

    return NextResponse.json({
      success: true,
      data: newOrder,
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

    const updatedOrder = updateOrder(id, updateData)

    if (!updatedOrder || updatedOrder.changes === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró la orden o no hay cambios'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
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