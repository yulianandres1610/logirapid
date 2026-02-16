import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import crypto from 'crypto'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/market/door-security/kiosks
 * List all door security kiosks for the company
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
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const isActive = searchParams.get('isActive')
    const offset = (page - 1) * limit

    let whereClause = 'WHERE k.companyid = $1'
    const params: any[] = [payload.companyId]
    let paramIndex = 2

    if (search) {
      whereClause += ` AND (k.name ILIKE $${paramIndex} OR k.location ILIKE $${paramIndex})`
      params.push(`%${search}%`)
      paramIndex++
    }

    if (isActive !== null && isActive !== undefined) {
      whereClause += ` AND k.isactive = $${paramIndex}`
      params.push(isActive === 'true')
      paramIndex++
    }

    // Get total count
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM market_door_kiosks k
      ${whereClause}
    `, params)

    const total = parseInt(countResult.rows[0]?.total || '0')

    // Get kiosks with warehouse info
    const result = await db.query(`
      SELECT
        k.id,
        k.name,
        k.location,
        k.deviceid,
        k.warehouseid,
        k.isactive,
        k.lastping,
        k.settings,
        k.createdat,
        w.name as warehousename,
        (
          SELECT COUNT(*)
          FROM market_visitor_logs vl
          WHERE vl.kioskid = k.id AND vl.status = 'active'
        ) as activevisitors,
        (
          SELECT COUNT(*)
          FROM market_visitor_logs vl
          WHERE vl.kioskid = k.id AND DATE(vl.entrytime) = CURRENT_DATE
        ) as todayvisitors
      FROM market_door_kiosks k
      LEFT JOIN market_warehouses w ON k.warehouseid = w.id
      ${whereClause}
      ORDER BY k.createdat DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset])

    return NextResponse.json({
      success: true,
      data: {
        kiosks: result.rows.map(k => ({
          id: k.id,
          name: k.name,
          location: k.location,
          deviceId: k.deviceid,
          warehouseId: k.warehouseid,
          warehouseName: k.warehousename,
          isActive: k.isactive,
          lastPing: k.lastping,
          settings: k.settings,
          createdAt: k.createdat,
          activeVisitors: parseInt(k.activevisitors || '0'),
          todayVisitors: parseInt(k.todayvisitors || '0')
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('[Door Kiosks GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener kiosks'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/door-security/kiosks
 * Create a new door security kiosk
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

    // Only ADMIN or higher can create kiosks
    if (!['SUPER_ADMIN', 'ADMIN', 'MARKET_MANAGER'].includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para crear kiosks'
      }, { status: 403 })
    }

    const body = await request.json()
    const { name, location, warehouseId, settings } = body

    if (!name) {
      return NextResponse.json({
        success: false,
        error: 'El nombre es requerido'
      }, { status: 400 })
    }

    // Generate unique device ID
    const deviceId = `DOOR-KIOSK-${crypto.randomBytes(8).toString('hex').toUpperCase()}`

    const result = await db.query(`
      INSERT INTO market_door_kiosks (
        companyid, name, location, deviceid, warehouseid, settings, isactive
      ) VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING *
    `, [
      payload.companyId,
      name,
      location || null,
      deviceId,
      warehouseId || null,
      JSON.stringify(settings || {})
    ])

    const kiosk = result.rows[0]

    console.log('[Door Kiosks POST] Created kiosk:', kiosk.id, 'for company:', payload.companyId)

    return NextResponse.json({
      success: true,
      data: {
        id: kiosk.id,
        name: kiosk.name,
        location: kiosk.location,
        deviceId: kiosk.deviceid,
        warehouseId: kiosk.warehouseid,
        isActive: kiosk.isactive,
        settings: kiosk.settings,
        createdAt: kiosk.createdat
      }
    })

  } catch (error) {
    console.error('[Door Kiosks POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear kiosk'
    }, { status: 500 })
  }
}
