import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

/**
 * POST /api/consignments/orders/[id]/submit
 * Submit a draft consignment order for approval
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

    // Verify order exists, is owned by current company, and is in draft status
    const orderCheck = await db.query(`
      SELECT
        co.id,
        co.status,
        co.order_number,
        co.total_items,
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

    if (order.status !== 'draft') {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden enviar consignaciones en borrador'
      }, { status: 400 })
    }

    if (order.total_items === 0) {
      return NextResponse.json({
        success: false,
        error: 'La consignación debe tener al menos un producto'
      }, { status: 400 })
    }

    // Update status to pending_approval
    await db.query(`
      UPDATE consignment_orders
      SET status = 'pending_approval',
          updated_at = NOW()
      WHERE id = $1
    `, [id])

    return NextResponse.json({
      success: true,
      message: `Consignación ${order.order_number} enviada a ${order.receiver_name} para aprobación`,
      data: {
        id: order.id,
        orderNumber: order.order_number,
        status: 'pending_approval'
      }
    })

  } catch (error) {
    console.error('[Consignment Submit] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al enviar consignación'
    }, { status: 500 })
  }
}
