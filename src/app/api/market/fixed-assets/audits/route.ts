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
 * GET /api/market/fixed-assets/audits
 * List fixed asset audits with filters
 *
 * Query params:
 * - page: number (default 1)
 * - limit: number (default 20)
 * - status: string ('in_progress', 'completed', 'approved')
 * - warehouseId: number
 * - categoryId: number
 * - startDate: string (ISO date)
 * - endDate: string (ISO date)
 */
export async function GET(request: NextRequest) {
  try {
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
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const warehouseId = searchParams.get('warehouseId')
    const categoryId = searchParams.get('categoryId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const offset = (page - 1) * limit

    // Build WHERE conditions
    const conditions: string[] = []
    const params: (string | number)[] = []
    let paramIndex = 1

    // Company filter
    if (payload.role !== 'SUPER_ADMIN') {
      conditions.push(`a.company_id = $${paramIndex}`)
      params.push(payload.companyId)
      paramIndex++
    }

    if (status) {
      conditions.push(`a.status = $${paramIndex}`)
      params.push(status)
      paramIndex++
    }

    if (warehouseId) {
      conditions.push(`a.warehouse_id = $${paramIndex}`)
      params.push(parseInt(warehouseId))
      paramIndex++
    }

    if (categoryId) {
      conditions.push(`a.category_id = $${paramIndex}`)
      params.push(parseInt(categoryId))
      paramIndex++
    }

    if (startDate) {
      conditions.push(`a.audit_date >= $${paramIndex}`)
      params.push(startDate)
      paramIndex++
    }

    if (endDate) {
      conditions.push(`a.audit_date <= $${paramIndex}`)
      params.push(endDate)
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Count total
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM market_fixed_asset_audits a
      ${whereClause}
    `, params)

    const total = parseInt(countResult.rows[0].total)

    // Get audits with joins
    const auditsResult = await db.query(`
      SELECT
        a.*,
        w.name as warehouse_name,
        c.name as category_name,
        cu.firstname || ' ' || cu.lastname as created_by_name,
        cou.firstname || ' ' || cou.lastname as completed_by_name,
        apu.firstname || ' ' || apu.lastname as approved_by_name
      FROM market_fixed_asset_audits a
      LEFT JOIN market_warehouses w ON a.warehouse_id = w.id
      LEFT JOIN market_fixed_asset_categories c ON a.category_id = c.id
      LEFT JOIN users cu ON a.created_by = cu.id
      LEFT JOIN users cou ON a.completed_by = cou.id
      LEFT JOIN users apu ON a.approved_by = apu.id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset])

    return NextResponse.json({
      success: true,
      data: {
        audits: auditsResult.rows.map(row => ({
          id: row.id,
          companyId: row.company_id,
          auditNumber: row.audit_number,
          auditDate: row.audit_date,
          warehouseId: row.warehouse_id,
          warehouseName: row.warehouse_name,
          categoryId: row.category_id,
          categoryName: row.category_name,
          totalAssets: row.total_assets,
          assetsFound: row.assets_found,
          assetsMissing: row.assets_missing,
          assetsSurplus: row.assets_surplus,
          status: row.status,
          createdBy: row.created_by,
          createdByName: row.created_by_name,
          completedBy: row.completed_by,
          completedByName: row.completed_by_name,
          approvedBy: row.approved_by,
          approvedByName: row.approved_by_name,
          createdAt: row.created_at,
          completedAt: row.completed_at,
          approvedAt: row.approved_at,
          notes: row.notes
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Fixed Asset Audits GET] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error al obtener auditorías'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/fixed-assets/audits
 * Create a new fixed asset audit
 */
export async function POST(request: NextRequest) {
  try {
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
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const body = await request.json()
    const {
      auditDate,
      warehouseId,
      categoryId,
      notes
    } = body

    if (!auditDate) {
      return NextResponse.json({
        success: false,
        error: 'La fecha de auditoría es requerida'
      }, { status: 400 })
    }

    // Generate audit number
    const year = new Date().getFullYear()
    const seqResult = await db.query(`
      SELECT COALESCE(MAX(
        CAST(SUBSTRING(audit_number FROM 'AUD-[0-9]{4}-([0-9]+)') AS INTEGER)
      ), 0) + 1 as next_seq
      FROM market_fixed_asset_audits
      WHERE company_id = $1
      AND audit_number LIKE $2
    `, [payload.companyId, `AUD-${year}-%`])

    const nextSeq = seqResult.rows[0].next_seq || 1
    const auditNumber = `AUD-${year}-${String(nextSeq).padStart(4, '0')}`

    // Count total assets in scope
    let totalAssetsConditions = ['company_id = $1', "status != 'disposed'"]
    const totalAssetsParams: (number | string)[] = [payload.companyId]

    if (warehouseId) {
      totalAssetsConditions.push(`warehouse_id = $${totalAssetsParams.length + 1}`)
      totalAssetsParams.push(warehouseId)
    }

    if (categoryId) {
      totalAssetsConditions.push(`category_id = $${totalAssetsParams.length + 1}`)
      totalAssetsParams.push(categoryId)
    }

    const totalCountResult = await db.query(`
      SELECT COUNT(*) as total FROM market_fixed_assets
      WHERE ${totalAssetsConditions.join(' AND ')}
    `, totalAssetsParams)

    const totalAssets = parseInt(totalCountResult.rows[0].total)

    // Insert audit
    const insertResult = await db.query(`
      INSERT INTO market_fixed_asset_audits (
        company_id, audit_number, audit_date,
        warehouse_id, category_id,
        total_assets, assets_found, assets_missing, assets_surplus,
        status, created_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, 0, 0, 0, 'in_progress', $7, $8)
      RETURNING id
    `, [
      payload.companyId,
      auditNumber,
      auditDate,
      warehouseId || null,
      categoryId || null,
      totalAssets,
      payload.userId,
      notes || null
    ])

    const auditId = insertResult.rows[0].id

    // Fetch complete audit data
    const auditResult = await db.query(`
      SELECT
        a.*,
        w.name as warehouse_name,
        c.name as category_name
      FROM market_fixed_asset_audits a
      LEFT JOIN market_warehouses w ON a.warehouse_id = w.id
      LEFT JOIN market_fixed_asset_categories c ON a.category_id = c.id
      WHERE a.id = $1
    `, [auditId])

    const audit = auditResult.rows[0]

    return NextResponse.json({
      success: true,
      message: 'Auditoría creada exitosamente',
      data: {
        id: audit.id,
        auditNumber: audit.audit_number,
        auditDate: audit.audit_date,
        warehouseId: audit.warehouse_id,
        warehouseName: audit.warehouse_name,
        categoryId: audit.category_id,
        categoryName: audit.category_name,
        totalAssets: audit.total_assets,
        status: audit.status,
        createdAt: audit.created_at
      }
    }, { status: 201 })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Fixed Asset Audits POST] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error al crear auditoría'
    }, { status: 500 })
  }
}
