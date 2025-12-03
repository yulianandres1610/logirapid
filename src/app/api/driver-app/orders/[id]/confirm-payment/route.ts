import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

// Helper para obtener info del usuario desde el token
async function getUserFromToken(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value

    if (!token) {
      return null
    }

    const secret = process.env.JWT_SECRET || 'secret-key-for-development'
    const decoded = jwt.verify(token, secret) as any

    return {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      companyId: decoded.companyId,
      companyName: decoded.companyName
    }
  } catch (error) {
    console.error('Error decoding token:', error)
    return null
  }
}

// POST: Driver confirma pago COD al entregar
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orderId = parseInt(id)
    const body = await request.json()

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden invalido'
      }, { status: 400 })
    }

    // Get driver info from token
    const user = await getUserFromToken(request)
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado - token invalido'
      }, { status: 401 })
    }

    // Get order info
    const orderResult = await db.query(`
      SELECT
        id,
        ordernumber,
        totalamount,
        payment_status,
        paid_amount,
        paymentmethod,
        company_id
      FROM package_orders
      WHERE id = $1
    `, [orderId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]
    const totalAmount = parseFloat(order.totalamount) || 0
    const currentPaidAmount = parseFloat(order.paid_amount) || 0

    // Validate that order is COD and pending payment
    if (order.paymentmethod !== 'cod') {
      return NextResponse.json({
        success: false,
        error: 'Esta orden no es Cash on Delivery (COD)'
      }, { status: 400 })
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json({
        success: false,
        error: 'Esta orden ya esta pagada'
      }, { status: 400 })
    }

    // Calculate payment amount (default to total if not specified)
    const paymentAmount = body.amount ? parseFloat(body.amount) : totalAmount

    // Calculate change if cash received
    let changeAmount = null
    if (body.cashReceived) {
      const cashReceived = parseFloat(body.cashReceived)
      if (cashReceived >= paymentAmount) {
        changeAmount = Math.round((cashReceived - paymentAmount) * 100) / 100
      }
    }

    // Use transaction
    const result = await db.transaction(async (client) => {
      // 1. Insert payment record
      await client.query(`
        INSERT INTO order_payments (
          order_id, payment_method, amount, reference,
          cash_received, change_amount, notes,
          registered_by, registered_by_name,
          source, company_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        orderId,
        'cod',
        paymentAmount,
        `COD-${orderId}-${Date.now()}`,
        body.cashReceived || null,
        changeAmount,
        body.notes || 'Pago COD confirmado por driver',
        user.userId,
        user.email,
        'driver_app',
        order.company_id
      ])

      // 2. Calculate new totals and status
      const newPaidAmount = currentPaidAmount + paymentAmount
      let newPaymentStatus = 'pending_payment'

      if (newPaidAmount >= totalAmount) {
        newPaymentStatus = 'paid'
      } else if (newPaidAmount > 0) {
        newPaymentStatus = 'partial'
      }

      // 3. Update order payment status
      await client.query(`
        UPDATE package_orders
        SET
          payment_status = $1,
          paid_amount = $2,
          payment_confirmed_at = CASE WHEN $1 = 'paid' THEN NOW() ELSE payment_confirmed_at END,
          payment_confirmed_by = $3,
          updatedat = NOW()
        WHERE id = $4
      `, [newPaymentStatus, newPaidAmount, user.userId, orderId])

      return {
        newPaidAmount,
        newPaymentStatus,
        remainingAmount: Math.max(0, totalAmount - newPaidAmount)
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Pago COD confirmado exitosamente',
      data: {
        orderId,
        orderNumber: order.ordernumber,
        paymentStatus: result.newPaymentStatus,
        amountPaid: paymentAmount,
        totalPaid: result.newPaidAmount,
        totalAmount,
        remainingAmount: result.remainingAmount,
        changeAmount,
        confirmedBy: user.email,
        confirmedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error confirming COD payment:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al confirmar el pago COD',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
