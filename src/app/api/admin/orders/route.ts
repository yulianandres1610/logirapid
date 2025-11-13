import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


// Base de datos simulada para órdenes
let ORDERS_DB = [
  {
    id: 'MRK-001',
    date: '2024-01-15 14:30',
    type: 'marketplace',
    customerName: 'María González',
    customerPhone: '+53 5 123 4567',
    customerAddress: 'Calle 23 #12, Vedado, La Habana',
    amount: 125.50,
    status: 'completed',
    referenceCode: 'MRK-001',
    details: {
      marketName: 'Supermercado Habana',
      marketAddress: 'Calle 23 #12, Vedado, La Habana',
      items: [
        { productName: 'Arroz (5kg)', quantity: 2, price: 25.00 },
        { productName: 'Frijoles (3kg)', quantity: 1, price: 15.50 },
        { productName: 'Aceite vegetal', quantity: 3, price: 20.00 },
        { productName: 'Pollo (2kg)', quantity: 1, price: 45.00 }
      ]
    },
    notes: 'Entregar en la puerta principal',
    agencyId: 'agency-1',
    createdBy: 'admin-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

// GET - Obtener todas las órdenes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const agencyId = searchParams.get('agencyId')
    const limit = searchParams.get('limit')
    const offset = searchParams.get('offset')

    let filteredOrders = [...ORDERS_DB]

    // Aplicar filtros
    if (type && type !== 'all') {
      filteredOrders = filteredOrders.filter(order => order.type === type)
    }
    if (status && status !== 'all') {
      filteredOrders = filteredOrders.filter(order => order.status === status)
    }
    if (agencyId) {
      filteredOrders = filteredOrders.filter(order => order.agencyId === agencyId)
    }

    // Ordenar por fecha (más recientes primero)
    filteredOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Aplicar paginación
    const limitNum = limit ? parseInt(limit) : 50
    const offsetNum = offset ? parseInt(offset) : 0
    const paginatedOrders = filteredOrders.slice(offsetNum, offsetNum + limitNum)

    // Calcular estadísticas
    const stats = {
      total: filteredOrders.length,
      completed: filteredOrders.filter(o => o.status === 'completed').length,
      pending: filteredOrders.filter(o => o.status === 'pending').length,
      cancelled: filteredOrders.filter(o => o.status === 'cancelled').length,
      totalAmount: filteredOrders.reduce((sum, order) => sum + order.amount, 0)
    }

    return NextResponse.json({
      success: true,
      data: paginatedOrders,
      stats,
      total: filteredOrders.length,
      hasMore: offsetNum + limitNum < filteredOrders.length
    })
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Crear una nueva orden
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      type,
      customerName,
      customerPhone,
      customerAddress,
      amount,
      details,
      notes,
      agencyId = 'agency-1' // En producción vendría del token de autenticación
    } = body

    // Validación de campos requeridos
    if (!type || !customerName || !customerPhone || !customerAddress || !amount || !details) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Generar ID único
    const orderId = type === 'marketplace' ? `MRK-${Date.now().toString().slice(-6)}` :
                   type === 'recarga' ? `REC-${Date.now().toString().slice(-6)}` :
                   `RMS-${Date.now().toString().slice(-6)}`

    // Crear nueva orden
    const newOrder = {
      id: orderId,
      date: new Date().toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      type,
      customerName,
      customerPhone,
      customerAddress,
      amount: parseFloat(amount),
      status: 'pending',
      referenceCode: orderId,
      details,
      notes: notes || '',
      agencyId,
      createdBy: 'admin-1', // En producción vendría del token de autenticación
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    ORDERS_DB.push(newOrder)

    return NextResponse.json({
      success: true,
      data: newOrder,
      message: 'Order created successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating order:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}