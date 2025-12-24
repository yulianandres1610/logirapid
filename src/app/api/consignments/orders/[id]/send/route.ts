import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

/**
 * POST /api/consignments/orders/[id]/send
 * Mark a consignment order as sent/in transit (as provider)
 * This happens after the receiver has approved the order
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
    const body = await request.json().catch(() => ({}))
    const { providerNotes } = body

    // Verify order exists and belongs to current company as provider
    const orderCheck = await db.query(`
      SELECT
        co.id,
        co.status,
        co.order_number,
        co.receiver_company_id,
        r.legalname as receiver_name
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

    // Can only send if status is 'approved'
    if (order.status !== 'approved') {
      return NextResponse.json({
        success: false,
        error: order.status === 'in_transit'
          ? 'Esta consignación ya fue marcada como enviada'
          : 'Esta consignación no está lista para enviar (debe estar aprobada)'
      }, { status: 400 })
    }

    // Update order status to in_transit
    await db.query(`
      UPDATE consignment_orders
      SET status = 'in_transit',
          provider_notes = COALESCE($1, provider_notes),
          sent_by = $2,
          sent_at = NOW(),
          updated_at = NOW()
      WHERE id = $3
    `, [providerNotes || null, userId, id])

    return NextResponse.json({
      success: true,
      message: `Consignación ${order.order_number} marcada como enviada`,
      data: {
        id: order.id,
        orderNumber: order.order_number,
        status: 'in_transit',
        receiverName: order.receiver_name
      }
    })

  } catch (error) {
    console.error('[Consignment Send] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al marcar consignación como enviada'
    }, { status: 500 })
  }
}
