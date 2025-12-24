import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

interface RejectRequest {
  rejectionReason: string
  receiverNotes?: string
}

/**
 * POST /api/consignments/orders/[id]/reject
 * Reject a pending consignment order (as receiver)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const companyIdCookie = cookieStore.get('user-company-id')
    const userIdCookie = cookieStore.get('user-id')
    const currentCompanyId = companyIdCookie?.value
    const userId = userIdCookie?.value

    if (!currentCompanyId) {
      return NextResponse.json({
        success: false,
        error: 'No autenticado'
      }, { status: 401 })
    }

    const { id } = await params
    const body: RejectRequest = await request.json()
    const { rejectionReason, receiverNotes } = body

    if (!rejectionReason || rejectionReason.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'Debe proporcionar un motivo de rechazo'
      }, { status: 400 })
    }

    // Verify order exists and is pending approval for current company as receiver
    const orderCheck = await db.query(`
      SELECT
        co.id,
        co.status,
        co.order_number,
        p.legalname as provider_name
      FROM consignment_orders co
      LEFT JOIN companies p ON p.id = co.provider_company_id
      WHERE co.id = $1 AND co.receiver_company_id = $2
    `, [id, currentCompanyId])

    if (orderCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Consignación no encontrada'
      }, { status: 404 })
    }

    const order = orderCheck.rows[0]

    if (order.status !== 'pending_approval') {
      return NextResponse.json({
        success: false,
        error: 'Esta consignación no está pendiente de aprobación'
      }, { status: 400 })
    }

    // Update order status to rejected
    await db.query(`
      UPDATE consignment_orders
      SET status = 'rejected',
          rejection_reason = $1,
          receiver_notes = $2,
          approved_by = $3,
          approved_at = NOW(),
          updated_at = NOW()
      WHERE id = $4
    `, [rejectionReason, receiverNotes || null, userId, id])

    return NextResponse.json({
      success: true,
      message: `Consignación ${order.order_number} rechazada`,
      data: {
        id: order.id,
        orderNumber: order.order_number,
        status: 'rejected',
        rejectionReason
      }
    })

  } catch (error) {
    console.error('[Consignment Reject] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al rechazar consignación'
    }, { status: 500 })
  }
}
