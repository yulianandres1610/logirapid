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

const VALID_ROLES = ['DRIVER', 'USER', 'MANAGER', 'ADMIN', 'ALL']
const VALID_COMMISSION_TYPES = ['fixed', 'percentage']

/**
 * GET /api/companies/[id]/commissions
 *
 * Get commission configurations for a company
 *
 * Query params:
 * - role: Filter by role
 * - productId: Filter by product
 * - active: Filter by active status (true/false)
 *
 * Returns:
 * - commissions: Array of commission configurations with product details
 * - productsWithoutCommission: Products without any commission configured
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get auth token
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    // Verify JWT
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

    const { id } = await params
    const companyId = parseInt(id)

    if (isNaN(companyId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de empresa invalido'
      }, { status: 400 })
    }

    // Authorization: SUPER_ADMIN can see any company, others only their own
    if (payload.role !== 'SUPER_ADMIN' && payload.companyId !== companyId) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado para ver comisiones de esta empresa'
      }, { status: 403 })
    }

    // Get query params
    const { searchParams } = new URL(request.url)
    const roleFilter = searchParams.get('role')
    const productIdFilter = searchParams.get('productId')
    const activeFilter = searchParams.get('active')

    // Get company info
    const companyResult = await db.query(`
      SELECT id, legalname FROM companies WHERE id = $1
    `, [companyId])

    if (companyResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empresa no encontrada'
      }, { status: 404 })
    }

    const company = companyResult.rows[0]

    // Build query for commission configurations
    let query = `
      SELECT
        ccc.id,
        ccc.company_id,
        ccc.product_id,
        ccc.role,
        ccc.commission_type,
        ccc.commission_value,
        ccc.min_amount,
        ccc.max_amount,
        ccc.is_active,
        ccc.created_at,
        ccc.updated_at,
        pc.code as product_code,
        pc.name as product_name,
        pc.service_category,
        pc.base_price as product_base_price,
        u.firstname || ' ' || u.lastname as created_by_name
      FROM company_commission_config ccc
      JOIN product_catalog pc ON ccc.product_id = pc.id
      LEFT JOIN users u ON ccc.created_by = u.id
      WHERE ccc.company_id = $1
    `
    const queryParams: any[] = [companyId]
    let paramIndex = 2

    if (roleFilter && VALID_ROLES.includes(roleFilter)) {
      query += ` AND ccc.role = $${paramIndex}`
      queryParams.push(roleFilter)
      paramIndex++
    }

    if (productIdFilter) {
      query += ` AND ccc.product_id = $${paramIndex}`
      queryParams.push(parseInt(productIdFilter))
      paramIndex++
    }

    if (activeFilter !== null && activeFilter !== undefined) {
      query += ` AND ccc.is_active = $${paramIndex}`
      queryParams.push(activeFilter === 'true')
      paramIndex++
    }

    query += ` ORDER BY pc.service_category, pc.name, ccc.role`

    const commissionsResult = await db.query(query, queryParams)

    // Get all products to show which ones don't have commissions
    const allProductsResult = await db.query(`
      SELECT
        pc.id,
        pc.code,
        pc.name,
        pc.service_category,
        pc.base_price
      FROM product_catalog pc
      WHERE pc.is_active = true
      ORDER BY pc.service_category, pc.name
    `)

    // Find products without any commission for this company
    const productsWithCommission = new Set(commissionsResult.rows.map(c => c.product_id))
    const productsWithoutCommission = allProductsResult.rows.filter(
      p => !productsWithCommission.has(p.id)
    )

    // Format response
    const commissions = commissionsResult.rows.map(c => ({
      id: c.id,
      companyId: c.company_id,
      productId: c.product_id,
      productCode: c.product_code,
      productName: c.product_name,
      serviceCategory: c.service_category,
      productBasePrice: parseFloat(c.product_base_price || 0),
      role: c.role,
      commissionType: c.commission_type,
      commissionValue: parseFloat(c.commission_value),
      minAmount: c.min_amount ? parseFloat(c.min_amount) : null,
      maxAmount: c.max_amount ? parseFloat(c.max_amount) : null,
      isActive: c.is_active,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      createdByName: c.created_by_name
    }))

    // Group commissions by product for easier UI rendering
    const commissionsByProduct: Record<number, any> = {}
    commissions.forEach(c => {
      if (!commissionsByProduct[c.productId]) {
        commissionsByProduct[c.productId] = {
          productId: c.productId,
          productCode: c.productCode,
          productName: c.productName,
          serviceCategory: c.serviceCategory,
          productBasePrice: c.productBasePrice,
          roles: []
        }
      }
      commissionsByProduct[c.productId].roles.push({
        id: c.id,
        role: c.role,
        commissionType: c.commissionType,
        commissionValue: c.commissionValue,
        minAmount: c.minAmount,
        maxAmount: c.maxAmount,
        isActive: c.isActive
      })
    })

    return NextResponse.json({
      success: true,
      data: {
        companyId: company.id,
        companyName: company.legalname,
        commissions,
        commissionsByProduct: Object.values(commissionsByProduct),
        productsWithoutCommission: productsWithoutCommission.map(p => ({
          id: p.id,
          code: p.code,
          name: p.name,
          serviceCategory: p.service_category,
          basePrice: parseFloat(p.base_price || 0)
        })),
        summary: {
          totalConfigurations: commissions.length,
          activeConfigurations: commissions.filter(c => c.isActive).length,
          productsConfigured: Object.keys(commissionsByProduct).length,
          productsWithoutConfig: productsWithoutCommission.length
        }
      }
    })

  } catch (error) {
    console.error('Error in GET /api/companies/[id]/commissions:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 })
  }
}

/**
 * POST /api/companies/[id]/commissions
 *
 * Create or update a commission configuration
 *
 * Body:
 * {
 *   productId: number,
 *   role: 'DRIVER' | 'USER' | 'MANAGER' | 'ADMIN' | 'ALL',
 *   commissionType: 'fixed' | 'percentage',
 *   commissionValue: number,
 *   minAmount?: number,
 *   maxAmount?: number,
 *   isActive?: boolean
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get auth token
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    // Verify JWT
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

    const { id } = await params
    const companyId = parseInt(id)

    if (isNaN(companyId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de empresa invalido'
      }, { status: 400 })
    }

    // Authorization: SUPER_ADMIN or ADMIN of the company
    if (payload.role !== 'SUPER_ADMIN' && payload.role !== 'ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Solo ADMIN puede configurar comisiones'
      }, { status: 403 })
    }

    if (payload.role !== 'SUPER_ADMIN' && payload.companyId !== companyId) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado para configurar comisiones de esta empresa'
      }, { status: 403 })
    }

    // Parse body
    const body = await request.json()
    const {
      productId,
      role,
      commissionType,
      commissionValue,
      minAmount,
      maxAmount,
      isActive = true
    } = body

    // Validate required fields
    if (!productId || !role || !commissionType || commissionValue === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Campos requeridos: productId, role, commissionType, commissionValue'
      }, { status: 400 })
    }

    // Validate role
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({
        success: false,
        error: `Rol invalido. Valores validos: ${VALID_ROLES.join(', ')}`
      }, { status: 400 })
    }

    // Validate commission type
    if (!VALID_COMMISSION_TYPES.includes(commissionType)) {
      return NextResponse.json({
        success: false,
        error: `Tipo de comision invalido. Valores validos: ${VALID_COMMISSION_TYPES.join(', ')}`
      }, { status: 400 })
    }

    // Validate commission value
    if (typeof commissionValue !== 'number' || commissionValue < 0) {
      return NextResponse.json({
        success: false,
        error: 'commissionValue debe ser un numero positivo'
      }, { status: 400 })
    }

    // For percentage, validate it's reasonable (0-100)
    if (commissionType === 'percentage' && commissionValue > 100) {
      return NextResponse.json({
        success: false,
        error: 'Para porcentaje, el valor no puede ser mayor a 100'
      }, { status: 400 })
    }

    // Verify company exists
    const companyResult = await db.query(`
      SELECT id, legalname FROM companies WHERE id = $1
    `, [companyId])

    if (companyResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empresa no encontrada'
      }, { status: 404 })
    }

    // Verify product exists
    const productResult = await db.query(`
      SELECT id, code, name, service_category FROM product_catalog WHERE id = $1
    `, [productId])

    if (productResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Producto no encontrado'
      }, { status: 404 })
    }

    const product = productResult.rows[0]

    // Upsert commission configuration
    const result = await db.query(`
      INSERT INTO company_commission_config (
        company_id,
        product_id,
        role,
        commission_type,
        commission_value,
        min_amount,
        max_amount,
        is_active,
        created_by,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (company_id, product_id, role) DO UPDATE SET
        commission_type = EXCLUDED.commission_type,
        commission_value = EXCLUDED.commission_value,
        min_amount = EXCLUDED.min_amount,
        max_amount = EXCLUDED.max_amount,
        is_active = EXCLUDED.is_active,
        updated_by = EXCLUDED.created_by,
        updated_at = NOW()
      RETURNING *
    `, [
      companyId,
      productId,
      role,
      commissionType,
      commissionValue,
      minAmount || null,
      maxAmount || null,
      isActive,
      payload.userId
    ])

    const config = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        id: config.id,
        companyId: config.company_id,
        productId: config.product_id,
        productCode: product.code,
        productName: product.name,
        serviceCategory: product.service_category,
        role: config.role,
        commissionType: config.commission_type,
        commissionValue: parseFloat(config.commission_value),
        minAmount: config.min_amount ? parseFloat(config.min_amount) : null,
        maxAmount: config.max_amount ? parseFloat(config.max_amount) : null,
        isActive: config.is_active,
        createdAt: config.created_at,
        updatedAt: config.updated_at
      },
      message: 'Configuracion de comision guardada exitosamente'
    })

  } catch (error) {
    console.error('Error in POST /api/companies/[id]/commissions:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/companies/[id]/commissions
 *
 * Delete a commission configuration
 *
 * Query params:
 * - configId: ID of the configuration to delete
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get auth token
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    // Verify JWT
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

    const { id } = await params
    const companyId = parseInt(id)

    if (isNaN(companyId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de empresa invalido'
      }, { status: 400 })
    }

    // Authorization: SUPER_ADMIN or ADMIN of the company
    if (payload.role !== 'SUPER_ADMIN' && payload.role !== 'ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Solo ADMIN puede eliminar comisiones'
      }, { status: 403 })
    }

    if (payload.role !== 'SUPER_ADMIN' && payload.companyId !== companyId) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado para eliminar comisiones de esta empresa'
      }, { status: 403 })
    }

    // Get configId from query params
    const { searchParams } = new URL(request.url)
    const configId = searchParams.get('configId')

    if (!configId) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere configId'
      }, { status: 400 })
    }

    // Verify the config belongs to this company
    const configResult = await db.query(`
      SELECT id, company_id FROM company_commission_config
      WHERE id = $1 AND company_id = $2
    `, [parseInt(configId), companyId])

    if (configResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Configuracion no encontrada o no pertenece a esta empresa'
      }, { status: 404 })
    }

    // Delete the configuration
    await db.query(`
      DELETE FROM company_commission_config WHERE id = $1
    `, [parseInt(configId)])

    return NextResponse.json({
      success: true,
      message: 'Configuracion de comision eliminada exitosamente'
    })

  } catch (error) {
    console.error('Error in DELETE /api/companies/[id]/commissions:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 })
  }
}
