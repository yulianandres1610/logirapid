import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import bcrypt from 'bcryptjs'

/**
 * POST /api/market/door-security/auth-guard
 * Authenticate a guard by PIN and return their assigned kiosk(s)
 * This endpoint is public (no auth required) as it's used by the kiosk
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pin, companySubdomain } = body

    if (!pin) {
      return NextResponse.json({
        success: false,
        error: 'PIN requerido'
      }, { status: 400 })
    }

    // Validate PIN format (4 digits)
    if (!/^\d{4,6}$/.test(pin)) {
      return NextResponse.json({
        success: false,
        error: 'El PIN debe ser de 4 a 6 dígitos'
      }, { status: 400 })
    }

    // First, try to find the company by subdomain or custom domain
    let companyId: number | null = null

    if (companySubdomain) {
      const companyResult = await db.query(`
        SELECT id FROM companies
        WHERE subdomain = $1 OR custom_domain = $1
        LIMIT 1
      `, [companySubdomain])

      if (companyResult.rows.length > 0) {
        companyId = companyResult.rows[0].id
      }
    }

    // Find all active guards (we'll verify PIN with bcrypt)
    let guardQuery = `
      SELECT
        e.id as employeeid,
        e.pos_pin,
        u.firstname,
        u.lastname,
        e.employee_code,
        e.company_id,
        u.role as userrole,
        g.id as guardid,
        g.kioskid,
        k.id as kiosk_id,
        k.name as kiosk_name,
        k.location as kiosk_location,
        k.deviceid as kiosk_device_id,
        k.isactive as kiosk_is_active
      FROM market_employees e
      JOIN users u ON e.user_id = u.id
      JOIN market_door_guards g ON e.id = g.employeeid
      LEFT JOIN market_door_kiosks k ON g.kioskid = k.id
      WHERE e.pos_pin IS NOT NULL
        AND e.status = 'active'
        AND g.isactive = true
        AND u.role IN ('MARKET_GUARDIA', 'MARKET_MANAGER', 'ADMIN', 'SUPER_ADMIN')
    `

    const params: any[] = []

    if (companyId) {
      guardQuery += ` AND e.company_id = $1`
      params.push(companyId)
    }

    const guardsResult = await db.query(guardQuery, params)

    // Verify PIN against each guard using bcrypt
    let matchedGuard = null
    for (const guard of guardsResult.rows) {
      const isMatch = await bcrypt.compare(pin, guard.pos_pin)
      if (isMatch) {
        matchedGuard = guard
        break
      }
    }

    if (!matchedGuard) {
      console.log('[Door Security] Failed PIN attempt - no guard found')
      return NextResponse.json({
        success: false,
        error: 'PIN inválido o no autorizado'
      }, { status: 401 })
    }

    const guard = matchedGuard

    // If guard is assigned to a specific kiosk, return that kiosk
    if (guard.kioskid && guard.kiosk_is_active) {
      console.log('[Door Security] Guard authenticated, assigned to kiosk:', guard.kiosk_id)

      return NextResponse.json({
        success: true,
        data: {
          guard: {
            id: guard.employeeid,
            name: `${guard.firstname || ''} ${guard.lastname || ''}`.trim(),
            code: guard.employee_code || '',
            role: guard.userrole || ''
          },
          kiosk: {
            id: guard.kiosk_id,
            name: guard.kiosk_name,
            location: guard.kiosk_location,
            deviceId: guard.kiosk_device_id
          },
          redirectTo: `/door-kiosk/${guard.kiosk_id}`
        }
      })
    }

    // If guard is assigned to all kiosks (kioskid IS NULL), find all active kiosks for this company
    const kiosksResult = await db.query(`
      SELECT id, name, location, deviceid
      FROM market_door_kiosks
      WHERE companyid = $1 AND isactive = true
      ORDER BY name
    `, [guard.company_id])

    const kiosks = kiosksResult.rows.map(k => ({
      id: k.id,
      name: k.name,
      location: k.location,
      deviceId: k.deviceid
    }))

    console.log('[Door Security] Guard authenticated, can access all kiosks:', kiosks.length)

    // If only one kiosk, redirect directly
    if (kiosks.length === 1) {
      return NextResponse.json({
        success: true,
        data: {
          guard: {
            id: guard.employeeid,
            name: `${guard.firstname || ''} ${guard.lastname || ''}`.trim(),
            code: guard.employee_code || '',
            role: guard.userrole || ''
          },
          kiosk: kiosks[0],
          redirectTo: `/door-kiosk/${kiosks[0].id}`
        }
      })
    }

    // Multiple kiosks available - let them choose
    return NextResponse.json({
      success: true,
      data: {
        guard: {
          id: guard.employeeid,
          name: `${guard.firstname || ''} ${guard.lastname || ''}`.trim(),
          code: guard.employee_code || '',
          role: guard.userrole || ''
        },
        kiosks: kiosks,
        redirectTo: null // User must select a kiosk
      }
    })

  } catch (error) {
    console.error('[Door Security Auth] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al autenticar'
    }, { status: 500 })
  }
}
