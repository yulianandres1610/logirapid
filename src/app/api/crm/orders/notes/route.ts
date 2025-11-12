import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

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

    const orderIdNum = parseInt(orderId)
    if (isNaN(orderIdNum)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    const query = `
      SELECT
        id,
        orderid as "orderId",
        content,
        agentid as "agentId",
        createdat as "createdAt"
      FROM order_notes
      WHERE orderid = $1
      ORDER BY createdat DESC
    `

    const result = await db.query(query, [orderIdNum])

    return NextResponse.json({
      success: true,
      data: result.rows
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

    // Validar que el contenido no esté vacío
    if (body.content.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'El contenido de la nota no puede estar vacío'
      }, { status: 400 })
    }

    const insertQuery = `
      INSERT INTO order_notes (
        orderid, content, agentid, createdat
      ) VALUES (
        $1, $2, $3, NOW()
      )
      RETURNING
        id,
        orderid as "orderId",
        content,
        agentid as "agentId",
        createdat as "createdAt"
    `

    const values = [
      parseInt(body.orderId),
      body.content.trim(),
      body.agentId
    ]

    const result = await db.query(insertQuery, values)

    return NextResponse.json({
      success: true,
      data: result.rows[0],
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
      content: 'content',
      agentId: 'agentid'
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
      UPDATE order_notes
      SET ${updateFields.join(', ')}
      WHERE id = $${valueIndex}
      RETURNING
        id,
        orderid as "orderId",
        content,
        agentid as "agentId",
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
    console.error('Error updating order note:', error)
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

    const deleteQuery = 'DELETE FROM order_notes WHERE id = $1 RETURNING id'
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
    console.error('Error deleting order note:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al eliminar nota'
    }, { status: 500 })
  }
}