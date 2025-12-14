import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'

// GET - Get order details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const userRole = cookieStore.get('user-role')?.value

    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    const result = await db.query(`
      SELECT
        cdo.*,
        bc.name as broker_name,
        bc.broker_province,
        bc.broker_municipality,
        bc.broker_contact_phone,
        du.name as delivery_user_display_name,
        du.email as delivery_user_email,
        cu.name as created_by_name,
        cu.email as created_by_email,
        comp.name as completed_by_name
      FROM cash_delivery_orders cdo
      LEFT JOIN companies bc ON cdo.broker_company_id = bc.id
      LEFT JOIN users du ON cdo.delivery_user_id = du.id
      LEFT JOIN users cu ON cdo.created_by_user_id = cu.id
      LEFT JOIN users comp ON cdo.completed_by_user_id = comp.id
      WHERE cdo.id = $1
    `, [orderId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error: any) {
    console.error('[Cash Delivery API] Error fetching order:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener la orden'
    }, { status: 500 })
  }
}

// DELETE - Cancel order
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const userRole = cookieStore.get('user-role')?.value
    const userId = cookieStore.get('user-id')?.value

    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const { reason } = body

    // Check current status
    const orderResult = await db.query(`
      SELECT status, order_number FROM cash_delivery_orders WHERE id = $1
    `, [orderId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Can only cancel pending or in_transit orders
    if (!['pending', 'in_transit'].includes(order.status)) {
      return NextResponse.json({
        success: false,
        error: `No se puede cancelar una orden en estado: ${order.status}`
      }, { status: 400 })
    }

    // Update order status
    await db.query(`
      UPDATE cash_delivery_orders
      SET
        status = 'cancelled',
        cancellation_reason = $1,
        updated_at = NOW()
      WHERE id = $2
    `, [reason || 'Cancelada por administrador', orderId])

    return NextResponse.json({
      success: true,
      message: `Orden ${order.order_number} cancelada exitosamente`
    })

  } catch (error: any) {
    console.error('[Cash Delivery API] Error cancelling order:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al cancelar la orden'
    }, { status: 500 })
  }
}

// PATCH - Update order status (e.g., mark as in_transit)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const userRole = cookieStore.get('user-role')?.value

    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    const body = await request.json()
    const { status, notes } = body

    const validStatuses = ['pending', 'in_transit', 'cancelled']

    if (!validStatuses.includes(status)) {
      return NextResponse.json({
        success: false,
        error: `Estado inválido. Estados válidos: ${validStatuses.join(', ')}`
      }, { status: 400 })
    }

    // Check current status
    const orderResult = await db.query(`
      SELECT status, order_number FROM cash_delivery_orders WHERE id = $1
    `, [orderId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Update order
    const updateFields: string[] = ['status = $1', 'updated_at = NOW()']
    const updateParams: any[] = [status]
    let paramIndex = 2

    if (notes !== undefined) {
      updateFields.push(`notes = $${paramIndex++}`)
      updateParams.push(notes)
    }

    updateParams.push(orderId)

    await db.query(`
      UPDATE cash_delivery_orders
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
    `, updateParams)

    return NextResponse.json({
      success: true,
      message: `Orden ${order.order_number} actualizada a estado: ${status}`
    })

  } catch (error: any) {
    console.error('[Cash Delivery API] Error updating order:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar la orden'
    }, { status: 500 })
  }
}
