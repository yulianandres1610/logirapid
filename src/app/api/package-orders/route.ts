import { NextRequest, NextResponse } from 'next/server'
import {
  savePackageOrder,
  getAllPackageOrders,
  updatePackageOrder,
  getPackageOrderById,
  getCustomerPackageOrders
} from '@/lib/database'

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

    let orders

    if (orderId) {
      // Buscar por ID específico
      const order = getPackageOrderById(parseInt(orderId))
      orders = order ? [order] : []
    } else if (customerId) {
      // Buscar por ID de cliente
      orders = getCustomerPackageOrders(parseInt(customerId))
    } else {
      // Obtener todas las órdenes
      orders = getAllPackageOrders()
    }

    // Aplicar filtros
    let filteredOrders = orders
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filteredOrders = orders.filter(order =>
        order.orderNumber.toLowerCase().includes(searchLower) ||
        (order.customerName && order.customerName.toLowerCase().includes(searchLower)) ||
        ((order.firstName || order.lastName) &&
          `${order.firstName || ''} ${order.lastName || ''}`.trim().toLowerCase().includes(searchLower)) ||
        (order.customerAddress && (() => {
          try {
            const addr = JSON.parse(order.customerAddress || '{}')
            return addr.street?.toLowerCase().includes(searchLower) || false
          } catch {
            return order.customerAddress && typeof order.customerAddress === 'string'
              ? order.customerAddress.toLowerCase().includes(searchLower)
              : false
          }
        })())
      )
    }

    if (statusFilter && statusFilter !== 'all') {
      filteredOrders = filteredOrders.filter(order => order.status === statusFilter)
    }

    // Aplicar paginación
    const total = filteredOrders.length
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedOrders = filteredOrders.slice(startIndex, endIndex)

    return NextResponse.json({
      success: true,
      data: paginatedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: endIndex < total,
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

    const newOrder = savePackageOrder({
      customerId: body.customerId,
      customerName: body.customerName,
      customerAddress: body.customerAddress,
      orderNumber: body.orderNumber,
      services: body.services,
      notes: body.notes,
      scheduledDate: body.scheduledDate,
      timeSlot: body.timeSlot,
      status: body.status || 'pending',
      createdBy: body.createdBy || 'system',
      // Coordinates for mapping
      latitude: body.latitude || null,
      longitude: body.longitude || null,
      // Financial fields
      subtotal: body.subtotal || 0,
      taxAmount: body.taxAmount || 0,
      totalAmount: body.totalAmount || 0,
      boxCount: body.boxCount || 0,
      boxPrice: body.boxPrice || 0,
      additionalServices: body.additionalServices || '[]',
      boxes: typeof body.boxes === 'string' ? body.boxes : JSON.stringify(body.boxes || [])
    })

    return NextResponse.json({
      success: true,
      data: newOrder,
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

    // Handle additionalServices if it's an array
    if (updateData.additionalServices && Array.isArray(updateData.additionalServices)) {
      updateData.additionalServices = JSON.stringify(updateData.additionalServices)
    }

    const updatedOrder = updatePackageOrder(id, updateData)

    if (!updatedOrder || updatedOrder.changes === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró la orden o no hay cambios'
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