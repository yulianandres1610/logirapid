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
 * GET /api/market/fixed-assets/checkouts
 * List asset checkouts (tool lending) with filters
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const employeeId = searchParams.get('employeeId')
    const assetId = searchParams.get('assetId')

    const offset = (page - 1) * limit

    const conditions: string[] = []
    const params: (string | number)[] = []
    let paramIndex = 1

    if (payload.role !== 'SUPER_ADMIN') {
      conditions.push(`c.company_id = $${paramIndex}`)
      params.push(payload.companyId)
      paramIndex++
    }

    if (status) {
      conditions.push(`c.status = $${paramIndex}`)
      params.push(status)
      paramIndex++
    }

    if (employeeId) {
      conditions.push(`c.employee_id = $${paramIndex}`)
      params.push(parseInt(employeeId))
      paramIndex++
    }

    if (assetId) {
      conditions.push(`c.asset_id = $${paramIndex}`)
      params.push(parseInt(assetId))
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Count
    const countResult = await db.query(`
      SELECT COUNT(*) as total FROM market_asset_checkouts c ${whereClause}
    `, params)
    const total = parseInt(countResult.rows[0].total)

    // Stats
    const statsConditions = payload.role !== 'SUPER_ADMIN' ? 'WHERE company_id = $1' : ''
    const statsParams = payload.role !== 'SUPER_ADMIN' ? [payload.companyId] : []

    const statsResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'checked_out') as active_count,
        COUNT(*) FILTER (WHERE status = 'returned' AND return_date >= date_trunc('month', CURRENT_DATE)) as returned_this_month
      FROM market_asset_checkouts
      ${statsConditions}
    `, statsParams)

    // Get checkouts with joins
    const checkoutsResult = await db.query(`
      SELECT
        c.*,
        a.name as asset_name,
        a.asset_code,
        a.image_url as asset_image,
        COALESCE(eu.firstname || ' ' || eu.lastname, 'Empleado #' || me.id) as employee_name,
        cu.firstname || ' ' || cu.lastname as checkout_by_name,
        ru.firstname || ' ' || ru.lastname as return_by_name
      FROM market_asset_checkouts c
      LEFT JOIN market_fixed_assets a ON c.asset_id = a.id
      LEFT JOIN market_employees me ON c.employee_id = me.id
      LEFT JOIN users eu ON me.user_id = eu.id
      LEFT JOIN users cu ON c.checkout_by = cu.id
      LEFT JOIN users ru ON c.return_by = ru.id
      ${whereClause}
      ORDER BY c.checkout_date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset])

    const checkouts = checkoutsResult.rows.map(row => ({
      id: row.id,
      companyId: row.company_id,
      assetId: row.asset_id,
      assetName: row.asset_name,
      assetCode: row.asset_code,
      assetImage: row.asset_image,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      checkoutDate: row.checkout_date,
      checkoutByName: row.checkout_by_name,
      checkoutNotes: row.checkout_notes,
      expectedReturn: row.expected_return,
      returnDate: row.return_date,
      returnByName: row.return_by_name,
      returnNotes: row.return_notes,
      returnCondition: row.return_condition,
      status: row.status,
      createdAt: row.created_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        checkouts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        stats: {
          activeCheckouts: parseInt(statsResult.rows[0].active_count) || 0,
          returnedThisMonth: parseInt(statsResult.rows[0].returned_this_month) || 0
        }
      }
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Checkouts GET] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error al obtener préstamos'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/fixed-assets/checkouts
 * Register a new asset checkout (lending)
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    const body = await request.json()
    const { assetId, employeeId, notes, expectedReturn } = body

    if (!assetId || !employeeId) {
      return NextResponse.json({
        success: false,
        error: 'Debe seleccionar un activo y un empleado'
      }, { status: 400 })
    }

    const result = await db.transaction(async (client) => {
      // Verify asset exists, belongs to company, and is not checked out
      const assetResult = await client.query(`
        SELECT id, name, asset_code, is_checked_out, company_id
        FROM market_fixed_assets
        WHERE id = $1 AND status = 'active'
        ${payload.role !== 'SUPER_ADMIN' ? 'AND company_id = $2' : ''}
        FOR UPDATE
      `, payload.role !== 'SUPER_ADMIN' ? [assetId, payload.companyId] : [assetId])

      if (assetResult.rows.length === 0) {
        throw new Error('ASSET_NOT_FOUND')
      }

      if (assetResult.rows[0].is_checked_out) {
        throw new Error('ALREADY_CHECKED_OUT')
      }

      const companyId = assetResult.rows[0].company_id
      const assetName = assetResult.rows[0].name

      // Insert checkout
      const insertResult = await client.query(`
        INSERT INTO market_asset_checkouts (
          company_id, asset_id, employee_id,
          checkout_by, checkout_notes, expected_return
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, checkout_date
      `, [companyId, assetId, employeeId, payload.userId, notes || null, expectedReturn || null])

      // Mark asset as checked out
      await client.query(`
        UPDATE market_fixed_assets SET is_checked_out = true WHERE id = $1
      `, [assetId])

      return {
        checkoutId: insertResult.rows[0].id,
        checkoutDate: insertResult.rows[0].checkout_date,
        assetName
      }
    })

    return NextResponse.json({
      success: true,
      message: `Préstamo de "${result.assetName}" registrado exitosamente`,
      data: {
        id: result.checkoutId,
        checkoutDate: result.checkoutDate
      }
    }, { status: 201 })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Checkouts POST] Error:', err)

    if (err.message === 'ASSET_NOT_FOUND') {
      return NextResponse.json({
        success: false,
        error: 'Activo no encontrado o no está activo'
      }, { status: 404 })
    }

    if (err.message === 'ALREADY_CHECKED_OUT') {
      return NextResponse.json({
        success: false,
        error: 'Este activo ya está prestado a otro empleado'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: err.message || 'Error al registrar préstamo'
    }, { status: 500 })
  }
}
