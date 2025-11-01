import { NextRequest, NextResponse } from 'next/server'

// Base de datos simulada para recargas
let RECARGAS_DB = [
  {
    id: 'REC-001',
    date: '2024-01-15 14:30',
    service: 'telefono',
    phoneNumber: '52345678',
    amount: 100.00,
    commission: 2.00,
    total: 102.00,
    status: 'completed',
    customerName: 'María González',
    customerEmail: 'maria@nauta.com.cu',
    referenceCode: 'REC-001',
    agencyId: 'agency-1',
    createdBy: 'admin-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

// GET - Obtener todas las recargas
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const service = searchParams.get('service')
    const status = searchParams.get('status')
    const agencyId = searchParams.get('agencyId')
    const limit = searchParams.get('limit')
    const offset = searchParams.get('offset')

    let filteredRecargas = [...RECARGAS_DB]

    // Aplicar filtros
    if (service && service !== 'all') {
      filteredRecargas = filteredRecargas.filter(recarga => recarga.service === service)
    }
    if (status && status !== 'all') {
      filteredRecargas = filteredRecargas.filter(recarga => recarga.status === status)
    }
    if (agencyId) {
      filteredRecargas = filteredRecargas.filter(recarga => recarga.agencyId === agencyId)
    }

    // Ordenar por fecha (más recientes primero)
    filteredRecargas.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Aplicar paginación
    const limitNum = limit ? parseInt(limit) : 50
    const offsetNum = offset ? parseInt(offset) : 0
    const paginatedRecargas = filteredRecargas.slice(offsetNum, offsetNum + limitNum)

    // Calcular estadísticas
    const stats = {
      total: filteredRecargas.length,
      completed: filteredRecargas.filter(r => r.status === 'completed').length,
      pending: filteredRecargas.filter(r => r.status === 'pending').length,
      cancelled: filteredRecargas.filter(r => r.status === 'cancelled').length,
      totalAmount: filteredRecargas.reduce((sum, recarga) => sum + recarga.amount, 0),
      totalCommission: filteredRecargas.reduce((sum, recarga) => sum + recarga.commission, 0)
    }

    return NextResponse.json({
      success: true,
      data: paginatedRecargas,
      stats,
      total: filteredRecargas.length,
      hasMore: offsetNum + limitNum < filteredRecargas.length
    })
  } catch (error) {
    console.error('Error fetching recargas:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Crear una nueva recarga
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      service,
      phoneNumber,
      amount,
      commission = 2.00,
      customerName,
      customerEmail,
      agencyId = 'agency-1' // En producción vendría del token de autenticación
    } = body

    // Validación de campos requeridos
    if (!service || !phoneNumber || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validar que el servicio sea válido
    if (!['telefono', 'nauta'].includes(service)) {
      return NextResponse.json(
        { success: false, error: 'Invalid service type' },
        { status: 400 }
      )
    }

    // Validar el número de teléfono
    if (service === 'telefono') {
      const phoneRegex = /^5\d{7}$/
      if (!phoneRegex.test(phoneNumber.replace(/\D/g, ''))) {
        return NextResponse.json(
          { success: false, error: 'Invalid phone number format' },
          { status: 400 }
        )
      }
    }

    // Generar ID único
    const recargaId = `REC-${Date.now().toString().slice(-6)}`

    // Calcular total
    const total = parseFloat(amount) + parseFloat(commission.toString())

    // Crear nueva recarga
    const newRecarga = {
      id: recargaId,
      date: new Date().toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      service,
      phoneNumber,
      amount: parseFloat(amount),
      commission: parseFloat(commission.toString()),
      total,
      status: 'completed',
      referenceCode: recargaId,
      customerName: customerName || '',
      customerEmail: customerEmail || '',
      agencyId,
      createdBy: 'admin-1', // En producción vendría del token de autenticación
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    RECARGAS_DB.push(newRecarga)

    return NextResponse.json({
      success: true,
      data: newRecarga,
      message: 'Recarga created successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating recarga:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}