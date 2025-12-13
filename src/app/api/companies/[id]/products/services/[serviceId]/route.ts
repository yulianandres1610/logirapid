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
 * GET /api/companies/[id]/products/services/[serviceId]
 * Get a specific service
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; serviceId: string }> }
) {
  try {
    const { id, serviceId } = await params
    const companyId = parseInt(id)
    const svcId = parseInt(serviceId)

    if (isNaN(companyId) || isNaN(svcId)) {
      return NextResponse.json({
        success: false,
        error: 'IDs invalidos'
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

    // Authorization
    if (payload.role !== 'SUPER_ADMIN' && payload.companyId !== companyId) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 403 })
    }

    const result = await db.query(`
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
        cps.is_active
      FROM company_product_services cps
      WHERE cps.id = $1 AND cps.company_id = $2
    `, [svcId, companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Servicio no encontrado'
      }, { status: 404 })
    }

    const s = result.rows[0]
    return NextResponse.json({
      success: true,
      data: {
        id: s.id,
        companyId: s.company_id,
        productId: s.product_id,
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
      }
    })

  } catch (error) {
    console.error('Error fetching service:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener servicio'
    }, { status: 500 })
  }
}

/**
 * PUT /api/companies/[id]/products/services/[serviceId]
 * Update a specific service (sell price, etc.)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; serviceId: string }> }
) {
  try {
    const { id, serviceId } = await params
    const companyId = parseInt(id)
    const svcId = parseInt(serviceId)

    if (isNaN(companyId) || isNaN(svcId)) {
      return NextResponse.json({
        success: false,
        error: 'IDs invalidos'
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

    // Authorization - only SUPER_ADMIN or company ADMIN can update
    if (payload.role !== 'SUPER_ADMIN' && payload.role !== 'ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para actualizar servicios'
      }, { status: 403 })
    }

    if (payload.role !== 'SUPER_ADMIN' && payload.companyId !== companyId) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado para esta empresa'
      }, { status: 403 })
    }

    const body = await request.json()
    const { sellPrice, serviceName, serviceDescription, costPrice, isRequired, isDefaultSelected, isActive } = body

    // First verify the service belongs to this company
    const existingResult = await db.query(`
      SELECT id, cost_price, sell_price FROM company_product_services
      WHERE id = $1 AND company_id = $2
    `, [svcId, companyId])

    if (existingResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Servicio no encontrado'
      }, { status: 404 })
    }

    const existing = existingResult.rows[0]
    const currentCostPrice = parseFloat(existing.cost_price) || 0

    // Calculate margin if sellPrice is provided
    let margin = null
    let marginPercentage = null
    const finalSellPrice = sellPrice !== undefined ? sellPrice : parseFloat(existing.sell_price) || 0
    const finalCostPrice = costPrice !== undefined ? costPrice : currentCostPrice

    if (finalSellPrice !== null && finalCostPrice !== null) {
      margin = finalSellPrice - finalCostPrice
      marginPercentage = finalCostPrice > 0 ? ((finalSellPrice - finalCostPrice) / finalCostPrice) * 100 : 0
    }

    // Build dynamic update query
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (sellPrice !== undefined) {
      updates.push(`sell_price = $${paramIndex++}`)
      values.push(sellPrice)
    }

    if (serviceName !== undefined) {
      updates.push(`service_name = $${paramIndex++}`)
      values.push(serviceName)
    }

    if (serviceDescription !== undefined) {
      updates.push(`service_description = $${paramIndex++}`)
      values.push(serviceDescription)
    }

    if (costPrice !== undefined) {
      updates.push(`cost_price = $${paramIndex++}`)
      values.push(costPrice)
    }

    if (isRequired !== undefined) {
      updates.push(`is_required = $${paramIndex++}`)
      values.push(isRequired)
    }

    if (isDefaultSelected !== undefined) {
      updates.push(`is_default_selected = $${paramIndex++}`)
      values.push(isDefaultSelected)
    }

    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`)
      values.push(isActive)
    }

    // Always update margin if sellPrice or costPrice changed
    if (sellPrice !== undefined || costPrice !== undefined) {
      updates.push(`margin = $${paramIndex++}`)
      values.push(margin)
      updates.push(`margin_percentage = $${paramIndex++}`)
      values.push(marginPercentage)
    }

    updates.push(`updated_at = NOW()`)

    if (updates.length === 1) {
      // Only updated_at, nothing to update
      return NextResponse.json({
        success: false,
        error: 'No hay campos para actualizar'
      }, { status: 400 })
    }

    // Add WHERE params
    values.push(svcId, companyId)

    const updateQuery = `
      UPDATE company_product_services
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex++} AND company_id = $${paramIndex}
      RETURNING *
    `

    const result = await db.query(updateQuery, values)

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Error al actualizar servicio'
      }, { status: 500 })
    }

    const s = result.rows[0]
    return NextResponse.json({
      success: true,
      data: {
        id: s.id,
        companyId: s.company_id,
        productId: s.product_id,
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
      }
    })

  } catch (error) {
    console.error('Error updating service:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar servicio'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/companies/[id]/products/services/[serviceId]
 * Soft delete a service (set is_active = false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; serviceId: string }> }
) {
  try {
    const { id, serviceId } = await params
    const companyId = parseInt(id)
    const svcId = parseInt(serviceId)

    if (isNaN(companyId) || isNaN(svcId)) {
      return NextResponse.json({
        success: false,
        error: 'IDs invalidos'
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

    // Authorization
    if (payload.role !== 'SUPER_ADMIN' && payload.role !== 'ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para eliminar servicios'
      }, { status: 403 })
    }

    if (payload.role !== 'SUPER_ADMIN' && payload.companyId !== companyId) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado para esta empresa'
      }, { status: 403 })
    }

    // Soft delete
    const result = await db.query(`
      UPDATE company_product_services
      SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND company_id = $2
      RETURNING id
    `, [svcId, companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Servicio no encontrado'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Servicio eliminado'
    })

  } catch (error) {
    console.error('Error deleting service:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar servicio'
    }, { status: 500 })
  }
}
