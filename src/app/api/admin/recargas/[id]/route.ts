import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

// GET - Obtener una recarga específica por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rechargeId = parseInt(id)

    if (isNaN(rechargeId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de recarga inválido'
      }, { status: 400 })
    }

    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    // Get the recharge transaction with all details
    // Usar columnas específicas para evitar errores con columnas que no existen
    let query = `
      SELECT
        rt.id,
        rt.company_id,
        rt.user_id,
        rt.univcell_order_id,
        rt.local_reference,
        rt.product_id,
        rt.product_name,
        rt.destination,
        rt.amount,
        rt.amount_cents,
        rt.service_type,
        rt.status,
        rt.result_code,
        rt.result_message,
        rt.confirmation_code,
        rt.customer_name,
        rt.customer_email,
        rt.created_at,
        rt.completed_at,
        rt.updated_at,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as user_name,
        u.email as user_email,
        c.legalname as company_name,
        erp.name as external_product_name,
        erp.country_code,
        erp.country_name,
        erp.is_promotion,
        erp.provider_amount,
        erp.base_cost,
        erp.manual_cost_price,
        erp.manual_selling_price
      FROM recharge_transactions rt
      LEFT JOIN users u ON u.id = rt.user_id
      LEFT JOIN companies c ON c.id = rt.company_id
      LEFT JOIN external_recharge_products erp ON erp.id = rt.product_id
      WHERE rt.id = $1
    `
    const queryParams: (number | string)[] = [rechargeId]

    // Filter by company for non-SUPER_ADMIN
    if (payload.role !== 'SUPER_ADMIN') {
      query += ` AND rt.company_id = $2`
      queryParams.push(payload.companyId)
    }

    const result = await db.query(query, queryParams)

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Recarga no encontrada'
      }, { status: 404 })
    }

    const row = result.rows[0]

    // Obtener datos del payment link relacionado (si existe)
    const paymentLinkResult = await db.query(`
      SELECT
        pl.id as payment_link_id,
        pl.link_code,
        pl.amount as payment_amount,
        pl.currency,
        pl.status as payment_status,
        pl.customer_phone as pl_customer_phone,
        pl.customer_name as pl_customer_name,
        pl.customer_email as pl_customer_email,
        pl.stripe_payment_intent_id,
        pl.paid_at,
        pl.expires_at,
        pl.created_at as payment_link_created_at
      FROM payment_links pl
      WHERE pl.order_type = 'recharge' AND pl.order_id = $1
      ORDER BY pl.created_at DESC
      LIMIT 1
    `, [rechargeId])

    const paymentLink = paymentLinkResult.rows[0] || null

    // Format the response with all details
    const rechargeDetails = {
      // Basic info
      id: row.id,
      localReference: row.local_reference,
      orderNumber: row.local_reference?.slice(0, 12) || `REC-${row.id}`,
      univcellOrderId: row.univcell_order_id,

      // Product info
      productId: row.product_id,
      productName: row.product_name || row.external_product_name || 'Recarga',
      countryCode: row.country_code || 'CU',
      countryName: row.country_name || 'Cuba',
      isPromotion: row.is_promotion || false,
      serviceType: row.service_type || 'telefono',

      // Pricing info
      amount: parseFloat(row.amount) || 0,
      amountCents: row.amount_cents,
      providerAmount: row.provider_amount ? parseFloat(row.provider_amount) : null,
      baseCost: row.base_cost ? parseFloat(row.base_cost) : null,
      costPrice: row.manual_cost_price ? parseFloat(row.manual_cost_price) : null,

      // Destination
      destination: row.destination,
      phoneNumber: row.destination,

      // Status
      status: row.status || 'pending',
      paymentStatus: paymentLink?.payment_status || null,
      resultCode: row.result_code,
      resultMessage: row.result_message,
      confirmationCode: row.confirmation_code,

      // Customer info (priorizar datos de payment_link si existen)
      customerName: paymentLink?.pl_customer_name || row.customer_name,
      customerEmail: paymentLink?.pl_customer_email || row.customer_email,
      customerPhone: paymentLink?.pl_customer_phone || null,

      // Company & User info
      companyId: row.company_id,
      companyName: row.company_name,
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,

      // Source & tracking
      source: paymentLink?.pl_customer_phone ? 'whatsapp' : 'web',

      // Payment/Stripe info
      payment: paymentLink ? {
        paymentLinkId: paymentLink.payment_link_id,
        linkCode: paymentLink.link_code,
        paymentAmount: parseFloat(paymentLink.payment_amount) || 0,
        currency: paymentLink.currency || 'USD',
        paymentStatus: paymentLink.payment_status,
        stripePaymentIntentId: paymentLink.stripe_payment_intent_id,
        paidAt: paymentLink.paid_at,
        expiresAt: paymentLink.expires_at,
        paymentLinkCreatedAt: paymentLink.payment_link_created_at
      } : null,

      // Timestamps
      createdAt: row.created_at,
      completedAt: row.completed_at,
      updatedAt: row.updated_at
    }

    return NextResponse.json({
      success: true,
      data: rechargeDetails
    })

  } catch (error) {
    console.error('[Recargas] Error fetching recharge:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({
      success: false,
      error: `Error al obtener la recarga: ${errorMessage}`
    }, { status: 500 })
  }
}
