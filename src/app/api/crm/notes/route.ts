import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

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

    const customerIdNum = parseInt(customerId)
    if (isNaN(customerIdNum)) {
      return NextResponse.json({
        success: false,
        error: 'ID de cliente inválido'
      }, { status: 400 })
    }

    const query = `
      SELECT
        id,
        customerid as "customerId",
        note,
        priority,
        createdby as "createdBy",
        createdat as "createdAt"
      FROM call_center_notes
      WHERE customerid = $1
      ORDER BY createdat DESC
    `

    const result = await db.query(query, [customerIdNum])

    return NextResponse.json({
      success: true,
      data: result.rows
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

    const insertQuery = `
      INSERT INTO call_center_notes (
        customerid, note, priority, createdby, createdat
      ) VALUES (
        $1, $2, $3, $4, NOW()
      )
      RETURNING
        id,
        customerid as "customerId",
        note,
        priority,
        createdby as "createdBy",
        createdat as "createdAt"
    `

    const values = [
      parseInt(body.customerId),
      body.note.trim(),
      body.priority || 'medium',
      body.createdBy
    ]

    const result = await db.query(insertQuery, values)

    return NextResponse.json({
      success: true,
      data: result.rows[0],
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

// PUT: Actualizar nota existente
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere ID de la nota'
      }, { status: 400 })
    }

    // Construir query de actualización dinámica
    const updateFields = []
    const values = []
    let valueIndex = 1

    const fieldMapping: { [key: string]: string } = {
      note: 'note',
      priority: 'priority',
      createdBy: 'createdby'
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
      UPDATE call_center_notes
      SET ${updateFields.join(', ')}
      WHERE id = $${valueIndex}
      RETURNING
        id,
        customerid as "customerId",
        note,
        priority,
        createdby as "createdBy",
        createdat as "createdAt"
    `

    const result = await db.query(updateQuery, values)

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró la nota'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Nota actualizada exitosamente'
    })

  } catch (error) {
    console.error('Error updating note:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar nota'
    }, { status: 500 })
  }
}

// DELETE: Eliminar nota
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere ID de la nota'
      }, { status: 400 })
    }

    const noteId = parseInt(id)
    if (isNaN(noteId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de nota inválido'
      }, { status: 400 })
    }

    const deleteQuery = 'DELETE FROM call_center_notes WHERE id = $1 RETURNING id'
    const result = await db.query(deleteQuery, [noteId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró la nota'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Nota eliminada exitosamente'
    })

  } catch (error) {
    console.error('Error deleting note:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al eliminar nota'
    }, { status: 500 })
  }
}