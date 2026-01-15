import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

interface RouteParams {
  params: Promise<{ code: string }>
}

/**
 * GET /api/payment-links/[code]
 * Obtiene datos de un payment link por su codigo
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { code } = await params

    const result = await db.query(`
      SELECT
        id,
        link_code,
        order_type,
        order_id,
        order_number,
        amount,
        currency,
        status,
        customer_phone,
        customer_name,
        customer_email,
        description,
        stripe_payment_intent_id,
        expires_at,
        paid_at,
        created_at
      FROM payment_links
      WHERE link_code = $1
    `, [code])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Link de pago no encontrado' },
        { status: 404 }
      )
    }

    const paymentLink = result.rows[0]

    // Verificar si esta expirado
    if (paymentLink.expires_at && new Date(paymentLink.expires_at) < new Date()) {
      // Actualizar estado a expired si no lo esta
      if (paymentLink.status === 'pending') {
        await db.query(`
          UPDATE payment_links SET status = 'expired', updated_at = NOW()
          WHERE id = $1
        `, [paymentLink.id])
        paymentLink.status = 'expired'
      }
    }

    // Obtener detalles de la orden segun el tipo
    let orderDetails = null
    if (paymentLink.order_type === 'remittance') {
      const orderResult = await db.query(`
        SELECT
          id, order_number, send_amount, recipient_name,
          recipient_phone, recipient_province, recipient_municipality,
          recipient_address, sender_name, status
        FROM remittance_orders
        WHERE id = $1
      `, [paymentLink.order_id])

      if (orderResult.rows.length > 0) {
        orderDetails = orderResult.rows[0]
      }
    } else if (paymentLink.order_type === 'pickup') {
      const orderResult = await db.query(`
        SELECT
          id, ordernumber, customername, customeraddress,
          city, state, zipcode, scheduleddate, status
        FROM package_orders
        WHERE id = $1
      `, [paymentLink.order_id])

      if (orderResult.rows.length > 0) {
        orderDetails = orderResult.rows[0]
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...paymentLink,
        orderDetails,
        isExpired: paymentLink.status === 'expired',
        isPaid: paymentLink.status === 'paid'
      }
    })

  } catch (error) {
    console.error('[Payment Link API] Error getting link:', error)
    return NextResponse.json(
      { success: false, error: 'Error obteniendo link de pago' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/payment-links/[code]
 * Confirmar pago de un link (llamado despues de Stripe payment)
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { code } = await params
    const body = await request.json()

    const { paymentIntentId, paymentMethod } = body

    // Obtener payment link
    const linkResult = await db.query(`
      SELECT * FROM payment_links WHERE link_code = $1
    `, [code])

    if (linkResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Link de pago no encontrado' },
        { status: 404 }
      )
    }

    const paymentLink = linkResult.rows[0]

    // Verificar estado
    if (paymentLink.status === 'paid') {
      return NextResponse.json(
        { success: false, error: 'Este link ya fue pagado' },
        { status: 400 }
      )
    }

    if (paymentLink.status === 'expired') {
      return NextResponse.json(
        { success: false, error: 'Este link ha expirado' },
        { status: 400 }
      )
    }

    if (paymentLink.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: 'Este link fue cancelado' },
        { status: 400 }
      )
    }

    // Actualizar payment link
    await db.query(`
      UPDATE payment_links
      SET
        status = 'paid',
        stripe_payment_intent_id = $1,
        paid_at = NOW(),
        updated_at = NOW()
      WHERE id = $2
    `, [paymentIntentId, paymentLink.id])

    // Actualizar estado de la orden
    if (paymentLink.order_type === 'remittance') {
      await db.query(`
        UPDATE remittance_orders
        SET
          payment_status = 'paid',
          status = 'processing',
          updated_at = NOW()
        WHERE id = $1
      `, [paymentLink.order_id])
    } else if (paymentLink.order_type === 'pickup') {
      await db.query(`
        UPDATE package_orders
        SET
          payment_status = 'paid',
          updatedat = NOW()
        WHERE id = $1
      `, [paymentLink.order_id])
    }

    return NextResponse.json({
      success: true,
      message: 'Pago confirmado exitosamente',
      data: {
        linkCode: code,
        orderType: paymentLink.order_type,
        orderId: paymentLink.order_id,
        orderNumber: paymentLink.order_number,
        amount: paymentLink.amount,
        paidAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('[Payment Link API] Error confirming payment:', error)
    return NextResponse.json(
      { success: false, error: 'Error confirmando pago' },
      { status: 500 }
    )
  }
}
