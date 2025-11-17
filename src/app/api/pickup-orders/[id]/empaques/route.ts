import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/pickup-orders/[id]/empaques
 * Asocia un empaque a una orden de recogida
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: 'ID de orden inválido' },
        { status: 400 }
      )
    }

    // Verificar que la orden existe
    const orderQuery = `
      SELECT id, ordernumber, customername, status, order_type
      FROM package_orders
      WHERE id = $1
    `
    const orderResult = await db.query(orderQuery, [orderId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Orden no encontrada' },
        { status: 404 }
      )
    }

    const order = orderResult.rows[0]

    // Solo permitir asociar empaques a órdenes de recogida
    if (order.order_type !== 'recogida') {
      return NextResponse.json(
        { success: false, error: 'Solo se pueden asociar empaques a órdenes de recogida' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { codigo, peso_lb } = body

    if (!codigo) {
      return NextResponse.json(
        { success: false, error: 'El código del empaque es requerido' },
        { status: 400 }
      )
    }

    // Verificar que el empaque existe
    const empaqueQuery = 'SELECT * FROM empaques WHERE codigo = $1'
    const empaqueResult = await db.query(empaqueQuery, [codigo])

    if (empaqueResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: `El empaque con código ${codigo} no existe` },
        { status: 404 }
      )
    }

    const empaque = empaqueResult.rows[0]

    // Verificar que el empaque esté disponible
    if (empaque.estado !== 'disponible' && empaque.estado !== 'asignado') {
      return NextResponse.json(
        {
          success: false,
          error: `El empaque ${codigo} no está disponible (estado actual: ${empaque.estado})`,
          currentStatus: empaque.estado
        },
        { status: 400 }
      )
    }

    // Verificar que no esté ya asociado a otra orden
    if (empaque.order_number && empaque.order_number !== order.ordernumber) {
      return NextResponse.json(
        {
          success: false,
          error: `El empaque ${codigo} ya está asociado a la orden ${empaque.order_number}`
        },
        { status: 400 }
      )
    }

    // Calcular peso en kg si se proporciona en libras
    const pesoLb = peso_lb ? parseFloat(peso_lb) : null
    const pesoKg = pesoLb ? (pesoLb * 0.453592).toFixed(2) : null

    // Actualizar empaque con información de la orden
    const updateQuery = `
      UPDATE empaques
      SET
        order_number = $1,
        estado = 'asignado',
        weight_lb = $2,
        weight_kg = $3,
        recipient_name = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE codigo = $5
      RETURNING *
    `

    const updateResult = await db.query(updateQuery, [
      order.ordernumber,
      pesoLb,
      pesoKg,
      order.customername,
      codigo
    ])

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
      'ASIGNADO_A_ORDEN',
      `Empaque asignado a orden ${order.ordernumber}`
    ])

    return NextResponse.json({
      success: true,
      message: `Empaque ${codigo} asociado exitosamente`,
      data: updateResult.rows[0]
    })
  } catch (error) {
    console.error('Error in POST /api/pickup-orders/[id]/empaques:', error)
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
 * GET /api/pickup-orders/[id]/empaques
 * Obtiene todos los empaques asociados a una orden
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: 'ID de orden inválido' },
        { status: 400 }
      )
    }

    // Obtener orden
    const orderQuery = 'SELECT ordernumber FROM package_orders WHERE id = $1'
    const orderResult = await db.query(orderQuery, [orderId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Orden no encontrada' },
        { status: 404 }
      )
    }

    const orderNumber = orderResult.rows[0].ordernumber

    // Obtener empaques
    const empaquesQuery = `
      SELECT
        e.*,
        w.name as warehouse_name
      FROM empaques e
      LEFT JOIN warehouses w ON e.warehouse_id = w.id
      WHERE e.order_number = $1
      ORDER BY e.box_number ASC, e.created_at ASC
    `

    const empaquesResult = await db.query(empaquesQuery, [orderNumber])

    return NextResponse.json({
      success: true,
      data: empaquesResult.rows,
      count: empaquesResult.rows.length
    })
  } catch (error) {
    console.error('Error in GET /api/pickup-orders/[id]/empaques:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}
