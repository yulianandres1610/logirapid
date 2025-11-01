import { NextRequest, NextResponse } from 'next/server'
import {
  createCallCenterNote,
  getCallCenterNotes
} from '@/lib/database'

// GET: Obtener notas de un cliente
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

    const notes = getCallCenterNotes(parseInt(customerId))

    return NextResponse.json({
      success: true,
      data: notes
    })

  } catch (error) {
    console.error('Error getting call center notes:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener notas'
    }, { status: 500 })
  }
}

// POST: Crear nueva nota
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar campos obligatorios
    if (!body || !body.customerId || !body.note || !body.createdBy) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos (customerId, note, createdBy)'
      }, { status: 400 })
    }

    // Validar que la nota no esté vacía
    if (body.note.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'La nota no puede estar vacía'
      }, { status: 400 })
    }

    // Validar prioridad
    const validPriorities = ['low', 'medium', 'high', 'urgent']
    if (body.priority && !validPriorities.includes(body.priority)) {
      return NextResponse.json({
        success: false,
        error: 'Prioridad inválida. Valores válidos: low, medium, high, urgent'
      }, { status: 400 })
    }

    const newNote = createCallCenterNote(
      parseInt(body.customerId),
      body.note.trim(),
      body.createdBy,
      body.priority || 'medium'
    )

    return NextResponse.json({
      success: true,
      data: newNote,
      message: 'Nota creada exitosamente'
    })

  } catch (error) {
    console.error('Error creating call center note:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al crear nota'
    }, { status: 500 })
  }
}