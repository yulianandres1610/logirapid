import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

export const dynamic = 'force-dynamic'

// GET: Obtener historial de pagos de una orden
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden invalido'
      }, { status: 400 })
    }

    // Get order info with payment status
    const orderResult = await db.query(`
      SELECT
        id,
        ordernumber as "orderNumber",
        totalamount as "totalAmount",
        payment_status as "paymentStatus",
        paid_amount as "paidAmount",
        payment_confirmed_at as "paymentConfirmedAt",
        payment_confirmed_by as "paymentConfirmedBy",
        paymentmethod as "paymentMethod"
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
    const totalAmount = parseFloat(order.totalAmount) || 0
    const paidAmount = parseFloat(order.paidAmount) || 0

    // Get payment history
    const paymentsResult = await db.query(`
      SELECT
        id,
        order_id as "orderId",
        payment_method as "paymentMethod",
        amount,
        reference,
        cash_received as "cashReceived",
        change_amount as "changeAmount",
        notes,
        registered_by as "registeredBy",
        registered_by_name as "registeredByName",
        registered_at as "registeredAt",
        source
      FROM order_payments
      WHERE order_id = $1
      ORDER BY registered_at DESC
    `, [orderId])

    return NextResponse.json({
      success: true,
      data: {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          totalAmount,
          paidAmount,
          remainingAmount: Math.max(0, totalAmount - paidAmount),
          paymentStatus: order.paymentStatus || 'pending_payment',
          paymentMethod: order.paymentMethod,
          paymentConfirmedAt: order.paymentConfirmedAt,
          paymentConfirmedBy: order.paymentConfirmedBy
        },
        payments: paymentsResult.rows.map(p => ({
          ...p,
          amount: parseFloat(p.amount),
          cashReceived: p.cashReceived ? parseFloat(p.cashReceived) : null,
          changeAmount: p.changeAmount ? parseFloat(p.changeAmount) : null
        }))
      }
    })

  } catch (error) {
    console.error('Error getting order payments:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener pagos de la orden'
    }, { status: 500 })
  }
}

// POST: Registrar un nuevo pago
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orderId = parseInt(id)
    const body = await request.json()
    const { isSuperAdmin, companyId } = getCompanyFilter(request)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden invalido'
      }, { status: 400 })
    }

    // Validate required fields
    if (!body.paymentMethod || !body.amount) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos (paymentMethod, amount)'
      }, { status: 400 })
    }

    if (!body.registeredBy || !body.registeredByName) {
      return NextResponse.json({
        success: false,
        error: 'Faltan datos del usuario que registra el pago'
      }, { status: 400 })
    }

    // Get order info
    const orderResult = await db.query(`
      SELECT
        id,
        ordernumber,
        totalamount,
        payment_status,
        paid_amount,
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
    const paymentAmount = parseFloat(body.amount)

    // Validate payment amount
    if (paymentAmount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'El monto del pago debe ser mayor a 0'
      }, { status: 400 })
    }

    // Calculate change if cash received
    let changeAmount = null
    if (body.cashReceived && body.paymentMethod === 'cash') {
      const cashReceived = parseFloat(body.cashReceived)
      if (cashReceived >= paymentAmount) {
        changeAmount = cashReceived - paymentAmount
      }
    }

    // Use transaction to ensure atomicity
    const result = await db.transaction(async (client) => {
      // 1. Insert payment record
      const paymentInsert = await client.query(`
        INSERT INTO order_payments (
          order_id, payment_method, amount, reference,
          cash_received, change_amount, notes,
          registered_by, registered_by_name,
          source, company_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `, [
        orderId,
        body.paymentMethod,
        paymentAmount,
        body.reference || null,
        body.cashReceived || null,
        changeAmount,
        body.notes || null,
        body.registeredBy,
        body.registeredByName,
        body.source || 'dashboard',
        order.company_id
      ])

      const paymentId = paymentInsert.rows[0].id

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
          payment_confirmed_by = CASE WHEN $1 = 'paid' THEN $3 ELSE payment_confirmed_by END,
          updatedat = NOW()
        WHERE id = $4
      `, [newPaymentStatus, newPaidAmount, body.registeredBy, orderId])

      return {
        paymentId,
        newPaidAmount,
        newPaymentStatus,
        remainingAmount: Math.max(0, totalAmount - newPaidAmount)
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Pago registrado exitosamente',
      data: {
        paymentId: result.paymentId,
        orderId,
        orderNumber: order.ordernumber,
        newPaymentStatus: result.newPaymentStatus,
        paidAmount: result.newPaidAmount,
        remainingAmount: result.remainingAmount,
        changeAmount
      }
    })

  } catch (error) {
    console.error('Error registering payment:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al registrar el pago',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
