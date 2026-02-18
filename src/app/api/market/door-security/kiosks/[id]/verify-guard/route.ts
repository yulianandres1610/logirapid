import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/market/door-security/kiosks/[id]/verify-guard
 * Verify a guard's PIN for a door kiosk
 * This endpoint is public (no auth required) as it's used by the kiosk
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { pin } = body

    if (!pin) {
      return NextResponse.json({
        success: false,
        error: 'PIN requerido'
      }, { status: 400 })
    }

    // Find kiosk by ID or deviceId
    const kioskResult = await db.query(`
      SELECT id, companyid, name, isactive
      FROM market_door_kiosks
      WHERE (id = $1 OR deviceid = $1)
    `, [id])

    if (kioskResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Kiosk no encontrado'
      }, { status: 404 })
    }

    const kiosk = kioskResult.rows[0]

    if (!kiosk.isactive) {
      return NextResponse.json({
        success: false,
        error: 'Este kiosk está desactivado'
      }, { status: 403 })
    }

    // Find employee with matching PIN who is authorized as guard
    // Guards can be assigned to specific kiosk (kioskid = kiosk.id) or all kiosks (kioskid IS NULL)
    const guardResult = await db.query(`
      SELECT
        e.id as employeeid,
        u.firstname,
        u.lastname,
        e.employee_code,
        u.role,
        g.id as guardid,
        g.kioskid
      FROM market_employees e
      JOIN users u ON e.user_id = u.id
      JOIN market_door_guards g ON e.id = g.employeeid
      WHERE e.company_id = $1
        AND e.pos_pin = $2
        AND e.status = 'active'
        AND g.isactive = true
        AND (g.kioskid = $3 OR g.kioskid IS NULL)
      LIMIT 1
    `, [kiosk.companyid, pin, kiosk.id])

    if (guardResult.rows.length === 0) {
      // Log failed attempt
      console.log('[Door Security] Failed PIN attempt for kiosk:', kiosk.id)

      return NextResponse.json({
        success: false,
        error: 'PIN inválido o no autorizado para este kiosk'
      }, { status: 401 })
    }

    const guard = guardResult.rows[0]

    // Update kiosk last ping
    await db.query(`
      UPDATE market_door_kiosks
      SET lastping = NOW()
      WHERE id = $1
    `, [kiosk.id])

    console.log('[Door Security] Guard authenticated:', guard.employeeid, 'at kiosk:', kiosk.id)

    return NextResponse.json({
      success: true,
      data: {
        guard: {
          id: guard.employeeid,
          name: `${guard.firstname || ''} ${guard.lastname || ''}`.trim(),
          code: guard.employee_code || '',
          role: guard.role || ''
        },
        kiosk: {
          id: kiosk.id,
          name: kiosk.name
        }
      }
    })

  } catch (error) {
    console.error('[Door Security Verify] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al verificar PIN'
    }, { status: 500 })
  }
}
