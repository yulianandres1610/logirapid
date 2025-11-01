import { NextRequest, NextResponse } from 'next/server'
import {
  saveOrderNote,
  getOrderNotes
} from '@/lib/database'

// GET: Obtener notas de una orden
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere orderId'
      }, { status: 400 })
    }

    const notes = getOrderNotes(parseInt(orderId))

    return NextResponse.json({
      success: true,
      data: notes
    })

  } catch (error) {
    console.error('Error getting order notes:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener notas de la orden'
    }, { status: 500 })
  }
}

// POST: Crear nueva nota para una orden
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body || !body.orderId || !body.content || !body.agentId) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos (orderId, content, agentId)'
      }, { status: 400 })
    }

    const newNote = saveOrderNote(body.orderId, {
      content: body.content,
      agentId: body.agentId
    })

    return NextResponse.json({
      success: true,
      data: newNote,
      message: 'Nota creada exitosamente'
    })

  } catch (error) {
    console.error('Error creating order note:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al crear nota'
    }, { status: 500 })
  }
}