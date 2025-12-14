import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'

// POST - Start reception process
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const companyId = cookieStore.get('user-company-id')?.value

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params
    const orderId = parseInt(id)
    const brokerCompanyId = parseInt(companyId)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    // Get order and verify it belongs to this broker
    const orderResult = await db.query(`
      SELECT * FROM cash_delivery_orders
      WHERE id = $1 AND broker_company_id = $2
    `, [orderId, brokerCompanyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Check status
    if (!['pending', 'in_transit'].includes(order.status)) {
      return NextResponse.json({
        success: false,
        error: `No se puede iniciar recepción para una orden en estado: ${order.status}`
      }, { status: 400 })
    }

    // Update status to pending_reception
    await db.query(`
      UPDATE cash_delivery_orders
      SET
        status = 'pending_reception',
        reception_started_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `, [orderId])

    return NextResponse.json({
      success: true,
      message: 'Proceso de recepción iniciado',
      data: {
        status: 'pending_reception',
        orderNumber: order.order_number,
        totalAmount: parseFloat(order.total_amount),
        currency: order.currency,
        billDenominations: order.bill_denominations,
        totalBills: order.total_bills,
        deliveryUserName: order.delivery_user_name,
        deliveryUserPhone: order.delivery_user_phone
      }
    })

  } catch (error: any) {
    console.error('[Start Reception API] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al iniciar el proceso de recepción'
    }, { status: 500 })
  }
}
