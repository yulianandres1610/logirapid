import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * GET /api/drivers
 * Lista todos los usuarios con rol DRIVER
 * Incluye conteos de inventario (cajas vacías, bultos)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const companyIdParam = searchParams.get('companyId')

    // Build WHERE conditions
    const conditions = ["u.role = 'DRIVER'"]
    const params: any[] = []

    if (search) {
      conditions.push(`(
        u.firstname ILIKE $${params.length + 1} OR
        u.lastname ILIKE $${params.length + 2} OR
        u.email ILIKE $${params.length + 3} OR
        u.phone ILIKE $${params.length + 4} OR
        CONCAT(u.firstname, ' ', u.lastname) ILIKE $${params.length + 5}
      )`)
      const searchTerm = `%${search}%`
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm)
    }

    if (status && status !== 'all') {
      if (status === 'active') {
        params.push(true)
        conditions.push(`u.isactive = $${params.length}`)
      } else if (status === 'inactive') {
        params.push(false)
        conditions.push(`u.isactive = $${params.length}`)
      }
    }

    // Multi-tenancy filter
    if (!isSuperAdmin) {
      if (!headerCompanyId) {
        return NextResponse.json(
          { success: false, error: 'No se pudo determinar la empresa del usuario' },
          { status: 400 }
        )
      }
      params.push(headerCompanyId)
      conditions.push(`uc.companyid = $${params.length}`)
    } else if (companyIdParam) {
      params.push(parseInt(companyIdParam))
      conditions.push(`uc.companyid = $${params.length}`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Count total records
    const countQuery = `
      SELECT COUNT(DISTINCT u.id) as total
      FROM users u
      LEFT JOIN user_companies uc ON u.id = uc.userid
      ${whereClause}
    `
    const countResult = await db.query(countQuery, params)

    // Get paginated results with inventory counts
    const offset = (page - 1) * limit
    params.push(limit, offset)

    const dataQuery = `
      SELECT DISTINCT
        u.id,
        u.firstname as "firstName",
        u.lastname as "lastName",
        u.email,
        u.phone,
        u.address,
        u.city,
        u.country,
        u.role,
        u.status,
        u.isactive as "isActive",
        u.createdat as "createdAt",
        u.lastlogin as "lastLogin",
        COALESCE(di.cajas_vacias_count, 0) as "cajas_vacias_count",
        COALESCE(di.bultos_count, 0) as "bultos_count",
        COALESCE(di.cajas_vacias_capacity, 50) as "cajas_vacias_capacity",
        COALESCE(di.bultos_capacity, 100) as "bultos_capacity",
        c.id as "companyId",
        c.legalname as "companyName"
      FROM users u
      LEFT JOIN user_companies uc ON u.id = uc.userid
      LEFT JOIN companies c ON uc.companyid = c.id
      LEFT JOIN driver_inventory di ON u.id = di.driver_id
      ${whereClause}
      ORDER BY u.createdat DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `

    const result = await db.query(dataQuery, params)

    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching drivers:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener lista de drivers' },
      { status: 500 }
    )
  }
}
