import { NextRequest, NextResponse } from 'next/server'
import {
  getCustomerChangeHistory,
  addCustomerChangeHistory
} from '@/lib/database'

// GET: Obtener historial de cambios de un cliente
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')

    if (!customerId) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere el ID del cliente'
      }, { status: 400 })
    }

    const history = getCustomerChangeHistory(parseInt(customerId))

    return NextResponse.json({
      success: true,
      data: history
    })

  } catch (error) {
    console.error('Error getting customer change history:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener historial de cambios'
    }, { status: 500 })
  }
}

// POST: Registrar un cambio en el historial
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar campos obligatorios
    if (!body || !body.customerId || !body.fieldName || !body.changedBy) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos (customerId, fieldName, changedBy)'
      }, { status: 400 })
    }

    const newChange = addCustomerChangeHistory(
      parseInt(body.customerId),
      body.fieldName,
      body.oldValue || null,
      body.newValue || null,
      body.changedBy,
      body.changeType || 'update'
    )

    return NextResponse.json({
      success: true,
      data: newChange,
      message: 'Cambio registrado exitosamente'
    })

  } catch (error) {
    console.error('Error adding customer change history:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al registrar cambio'
    }, { status: 500 })
  }
}