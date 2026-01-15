import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import Stripe from 'stripe'

interface RouteParams {
  params: Promise<{ code: string }>
}

// Initialize Stripe lazily
let stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!stripe) {
    const apiKey = process.env.STRIPE_SECRET_KEY
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }
    stripe = new Stripe(apiKey, {
      apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion
    })
  }
  return stripe
}

/**
 * POST /api/payment-links/[code]/create-intent
 * Crea un PaymentIntent para un payment link
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { code } = await params

    // Obtener payment link
    const result = await db.query(`
      SELECT * FROM payment_links WHERE link_code = $1
    `, [code])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Link de pago no encontrado' },
        { status: 404 }
      )
    }

    const paymentLink = result.rows[0]

    // Verificar estado
    if (paymentLink.status === 'paid') {
      return NextResponse.json(
        { success: false, error: 'Este link ya fue pagado' },
        { status: 400 }
      )
    }

    if (paymentLink.status === 'expired' ||
      (paymentLink.expires_at && new Date(paymentLink.expires_at) < new Date())) {
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

    // Si ya tiene un PaymentIntent, reutilizarlo si es posible
    if (paymentLink.stripe_payment_intent_id) {
      try {
        const existingIntent = await getStripe().paymentIntents.retrieve(
          paymentLink.stripe_payment_intent_id
        )

        // Si el intent todavia es usable, retornarlo
        if (existingIntent.status === 'requires_payment_method' ||
          existingIntent.status === 'requires_confirmation') {
          return NextResponse.json({
            success: true,
            data: {
              clientSecret: existingIntent.client_secret,
              paymentIntentId: existingIntent.id,
              amount: paymentLink.amount,
              currency: paymentLink.currency
            }
          })
        }
      } catch {
        // Si falla, crear uno nuevo
      }
    }

    // Crear nuevo PaymentIntent
    const amountCents = Math.round(parseFloat(paymentLink.amount) * 100)

    const paymentIntent = await getStripe().paymentIntents.create({
      amount: amountCents,
      currency: paymentLink.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      receipt_email: paymentLink.customer_email || undefined,
      description: paymentLink.description ||
        `Pago ${paymentLink.order_type}: ${paymentLink.order_number}`,
      metadata: {
        linkCode: paymentLink.link_code,
        orderType: paymentLink.order_type,
        orderId: paymentLink.order_id.toString(),
        orderNumber: paymentLink.order_number || '',
        customerPhone: paymentLink.customer_phone || '',
        customerName: paymentLink.customer_name || '',
        platform: 'LogiRapid'
      }
    })

    // Guardar PaymentIntent ID en el payment link
    await db.query(`
      UPDATE payment_links
      SET
        stripe_payment_intent_id = $1,
        stripe_client_secret = $2,
        updated_at = NOW()
      WHERE id = $3
    `, [paymentIntent.id, paymentIntent.client_secret, paymentLink.id])

    return NextResponse.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentLink.amount,
        currency: paymentLink.currency
      }
    })

  } catch (error) {
    console.error('[Payment Intent API] Error creating intent:', error)
    return NextResponse.json(
      { success: false, error: 'Error creando intento de pago' },
      { status: 500 }
    )
  }
}
