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
        u.full_name as user_name,
        u.email as user_email,
        c.name as company_name,
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
      paymentStatus: null, // No existe en la tabla base
      resultCode: row.result_code,
      resultMessage: row.result_message,
      confirmationCode: row.confirmation_code,

      // Customer info
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerPhone: null, // No existe en la tabla base

      // Company & User info
      companyId: row.company_id,
      companyName: row.company_name,
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,

      // Source & tracking
      source: 'web', // Default ya que no existe en la tabla base

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
    return NextResponse.json({
      success: false,
      error: 'Error al obtener la recarga'
    }, { status: 500 })
  }
}
