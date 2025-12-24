import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

interface CancelRequest {
  reason?: string
}

/**
 * POST /api/consignments/orders/[id]/cancel
 * Cancel a consignment order (as provider)
 * Only works for draft or pending_approval status
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const companyIdCookie = cookieStore.get('user-company-id')
    const currentCompanyId = companyIdCookie?.value

    if (!currentCompanyId) {
      return NextResponse.json({
        success: false,
        error: 'No autenticado'
      }, { status: 401 })
    }

    const { id } = await params
    const body: CancelRequest = await request.json()
    const { reason } = body

    // Verify order exists and is owned by current company
    const orderCheck = await db.query(`
      SELECT
        co.id,
        co.status,
        co.order_number,
        r.name as receiver_name
      FROM consignment_orders co
      LEFT JOIN companies r ON r.id = co.receiver_company_id
      WHERE co.id = $1 AND co.provider_company_id = $2
    `, [id, currentCompanyId])

    if (orderCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Consignación no encontrada'
      }, { status: 404 })
    }

    const order = orderCheck.rows[0]

    // Can only cancel draft or pending_approval
    if (!['draft', 'pending_approval'].includes(order.status)) {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden cancelar consignaciones en borrador o pendientes de aprobación'
      }, { status: 400 })
    }

    // Update order status to cancelled
    await db.query(`
      UPDATE consignment_orders
      SET status = 'cancelled',
          provider_notes = COALESCE(provider_notes || ' | ', '') || $1,
          updated_at = NOW()
      WHERE id = $2
    `, [reason ? `Cancelado: ${reason}` : 'Cancelado por el proveedor', id])

    return NextResponse.json({
      success: true,
      message: `Consignación ${order.order_number} cancelada`,
      data: {
        id: order.id,
        orderNumber: order.order_number,
        status: 'cancelled'
      }
    })

  } catch (error) {
    console.error('[Consignment Cancel] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al cancelar consignación'
    }, { status: 500 })
  }
}
