import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/companies/[id]/products/services
 *
 * Get ALL services for ALL products of a company
 * Used in the price configuration tab to show services grouped by product
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const companyId = parseInt(id)

    if (isNaN(companyId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de empresa inválido'
      }, { status: 400 })
    }

    // Verify auth
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
        error: 'Token invalido'
      }, { status: 401 })
    }

    // Authorization: SUPER_ADMIN can view any company, others only their own
    if (payload.role !== 'SUPER_ADMIN' && payload.companyId !== companyId) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado para ver servicios de esta empresa'
      }, { status: 403 })
    }

    // Get all services for this company with product info
    const servicesResult = await db.query(`
      SELECT
        cps.id,
        cps.company_id,
        cps.product_id,
        cps.service_code,
        cps.service_name,
        cps.service_description,
        cps.cost_price,
        cps.sell_price,
        cps.margin,
        cps.margin_percentage,
        cps.is_required,
        cps.is_default_selected,
        cps.is_active,
        pc.name as product_name,
        pc.code as product_code
      FROM company_product_services cps
      JOIN product_catalog pc ON pc.id = cps.product_id
      WHERE cps.company_id = $1 AND cps.is_active = true
      ORDER BY cps.product_id, cps.display_order, cps.service_name
    `, [companyId])

    // Map to frontend format
    const services = servicesResult.rows.map(s => ({
      id: s.id,
      companyId: s.company_id,
      productId: s.product_id,
      productName: s.product_name,
      productCode: s.product_code,
      serviceCode: s.service_code,
      serviceName: s.service_name,
      serviceDescription: s.service_description,
      costPrice: parseFloat(s.cost_price) || 0,
      sellPrice: parseFloat(s.sell_price) || 0,
      margin: parseFloat(s.margin) || 0,
      marginPercentage: parseFloat(s.margin_percentage) || 0,
      isRequired: s.is_required,
      isDefaultSelected: s.is_default_selected,
      isActive: s.is_active
    }))

    return NextResponse.json({
      success: true,
      data: services
    })

  } catch (error) {
    console.error('Error fetching all company services:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener servicios'
    }, { status: 500 })
  }
}
