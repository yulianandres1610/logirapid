import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * PATCH /api/pickup-orders/[id]/empaques/[codigo]
 * Actualiza el peso de un empaque asociado a una orden
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; codigo: string }> }
) {
  try {
    const { id, codigo } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: 'ID de orden inválido' },
        { status: 400 }
      )
    }

    if (!codigo) {
      return NextResponse.json(
        { success: false, error: 'Código de empaque requerido' },
        { status: 400 }
      )
    }

    // Verificar que la orden existe
    const orderQuery = 'SELECT ordernumber FROM package_orders WHERE id = $1'
    const orderResult = await db.query(orderQuery, [orderId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Orden no encontrada' },
        { status: 404 }
      )
    }

    const orderNumber = orderResult.rows[0].ordernumber

    // Verificar que el empaque existe y pertenece a esta orden
    const empaqueQuery = 'SELECT * FROM empaques WHERE codigo = $1'
    const empaqueResult = await db.query(empaqueQuery, [codigo])

    if (empaqueResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: `Empaque ${codigo} no encontrado` },
        { status: 404 }
      )
    }

    const empaque = empaqueResult.rows[0]

    if (empaque.order_number !== orderNumber) {
      return NextResponse.json(
        {
          success: false,
          error: `El empaque ${codigo} no está asociado a esta orden`
        },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { peso_lb, peso_kg } = body

    // Construir update dinámico
    const updates: string[] = []
    const values: any[] = []
    let paramCount = 1

    if (peso_lb !== undefined) {
      updates.push(`weight_lb = $${paramCount++}`)
      values.push(parseFloat(peso_lb))

      // Si se proporciona peso_lb, calcular automáticamente peso_kg
      if (peso_kg === undefined) {
        const pesoKgCalculado = (parseFloat(peso_lb) * 0.453592).toFixed(2)
        updates.push(`weight_kg = $${paramCount++}`)
        values.push(parseFloat(pesoKgCalculado))
      }
    }

    if (peso_kg !== undefined && peso_lb === undefined) {
      updates.push(`weight_kg = $${paramCount++}`)
      values.push(parseFloat(peso_kg))
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionaron campos para actualizar' },
        { status: 400 }
      )
    }

    // Agregar timestamp
    updates.push(`updated_at = CURRENT_TIMESTAMP`)

    // Agregar código al final
    values.push(codigo)

    const updateQuery = `
      UPDATE empaques
      SET ${updates.join(', ')}
      WHERE codigo = $${paramCount}
      RETURNING *
    `

    const updateResult = await db.query(updateQuery, values)

    // Registrar en trazabilidad
    const trazQuery = `
      INSERT INTO empaque_trazabilidad (
        empaque_id,
        accion,
        fecha,
        notas
      ) VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
    `

    await db.query(trazQuery, [
      empaque.id,
      'PESO_ACTUALIZADO',
      `Peso actualizado: ${peso_lb || peso_kg} ${peso_lb ? 'lb' : 'kg'}`
    ])

    return NextResponse.json({
      success: true,
      message: 'Peso actualizado exitosamente',
      data: updateResult.rows[0]
    })
  } catch (error) {
    console.error('Error in PATCH /api/pickup-orders/[id]/empaques/[codigo]:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/pickup-orders/[id]/empaques/[codigo]
 * Desasocia un empaque de una orden de recogida
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; codigo: string }> }
) {
  try {
    const { id, codigo } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: 'ID de orden inválido' },
        { status: 400 }
      )
    }

    if (!codigo) {
      return NextResponse.json(
        { success: false, error: 'Código de empaque requerido' },
        { status: 400 }
      )
    }

    // Verificar que la orden existe
    const orderQuery = 'SELECT ordernumber FROM package_orders WHERE id = $1'
    const orderResult = await db.query(orderQuery, [orderId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Orden no encontrada' },
        { status: 404 }
      )
    }

    const orderNumber = orderResult.rows[0].ordernumber

    // Verificar que el empaque existe y pertenece a esta orden
    const empaqueQuery = 'SELECT * FROM empaques WHERE codigo = $1'
    const empaqueResult = await db.query(empaqueQuery, [codigo])

    if (empaqueResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: `Empaque ${codigo} no encontrado` },
        { status: 404 }
      )
    }

    const empaque = empaqueResult.rows[0]

    if (empaque.order_number !== orderNumber) {
      return NextResponse.json(
        {
          success: false,
          error: `El empaque ${codigo} no está asociado a esta orden`
        },
        { status: 400 }
      )
    }

    // Desasociar empaque (volver a estado disponible)
    const updateQuery = `
      UPDATE empaques
      SET
        order_number = NULL,
        estado = 'disponible',
        service_name = NULL,
        recipient_name = NULL,
        recipient_city = NULL,
        recipient_state = NULL,
        weight_lb = NULL,
        weight_kg = NULL,
        box_number = NULL,
        total_boxes = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE codigo = $1
      RETURNING *
    `

    const updateResult = await db.query(updateQuery, [codigo])

    // Registrar en trazabilidad
    const trazQuery = `
      INSERT INTO empaque_trazabilidad (
        empaque_id,
        accion,
        fecha,
        notas
      ) VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
    `

    await db.query(trazQuery, [
      empaque.id,
      'DESASOCIADO_DE_ORDEN',
      `Empaque desasociado de orden ${orderNumber}`
    ])

    return NextResponse.json({
      success: true,
      message: `Empaque ${codigo} desasociado exitosamente`,
      data: updateResult.rows[0]
    })
  } catch (error) {
    console.error('Error in DELETE /api/pickup-orders/[id]/empaques/[codigo]:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
