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
 * GET /api/market/door-security/kiosks/[id]
 * Get a specific door security kiosk
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Fetch kiosk by ID or deviceId
    const result = await db.query(`
      SELECT
        k.id,
        k.companyid,
        k.name,
        k.location,
        k.deviceid,
        k.warehouseid,
        k.isactive,
        k.lastping,
        k.settings,
        k.createdat,
        w.name as warehousename,
        c.name as companyname,
        c.logo as companylogo
      FROM market_door_kiosks k
      LEFT JOIN market_warehouses w ON k.warehouseid = w.id
      LEFT JOIN companies c ON k.companyid = c.id
      WHERE (k.id = $1 OR k.deviceid = $1)
    `, [id])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Kiosk no encontrado'
      }, { status: 404 })
    }

    const kiosk = result.rows[0]

    // Check company access (unless SUPER_ADMIN)
    if (payload.role !== 'SUPER_ADMIN' && kiosk.companyid !== payload.companyId) {
      return NextResponse.json({
        success: false,
        error: 'No tiene acceso a este kiosk'
      }, { status: 403 })
    }

    // Get guards assigned to this kiosk
    const guardsResult = await db.query(`
      SELECT
        g.id,
        g.employeeid,
        g.isactive,
        u.firstname,
        u.lastname,
        e.employee_code,
        e.pos_pin
      FROM market_door_guards g
      JOIN market_employees e ON g.employeeid = e.id
      JOIN users u ON e.user_id = u.id
      WHERE (g.kioskid = $1 OR g.kioskid IS NULL)
      AND g.companyid = $2
      AND g.isactive = true
    `, [kiosk.id, kiosk.companyid])

    // Get today's statistics
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as totaltoday,
        COUNT(*) FILTER (WHERE status = 'active') as activevisitors,
        COUNT(*) FILTER (WHERE status = 'completed') as completedvisits
      FROM market_visitor_logs
      WHERE kioskid = $1 AND DATE(entrytime) = CURRENT_DATE
    `, [kiosk.id])

    const stats = statsResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        id: kiosk.id,
        companyId: kiosk.companyid,
        companyName: kiosk.companyname,
        companyLogo: kiosk.companylogo,
        name: kiosk.name,
        location: kiosk.location,
        deviceId: kiosk.deviceid,
        warehouseId: kiosk.warehouseid,
        warehouseName: kiosk.warehousename,
        isActive: kiosk.isactive,
        lastPing: kiosk.lastping,
        settings: kiosk.settings,
        createdAt: kiosk.createdat,
        guards: guardsResult.rows.map(g => ({
          id: g.id,
          employeeId: g.employeeid,
          name: `${g.firstname || ''} ${g.lastname || ''}`.trim(),
          code: g.employee_code || '',
          hasPin: !!g.pos_pin,
          isActive: g.isactive
        })),
        stats: {
          totalToday: parseInt(stats?.totaltoday || '0'),
          activeVisitors: parseInt(stats?.activevisitors || '0'),
          completedVisits: parseInt(stats?.completedvisits || '0')
        }
      }
    })

  } catch (error) {
    console.error('[Door Kiosk GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener kiosk'
    }, { status: 500 })
  }
}

/**
 * PATCH /api/market/door-security/kiosks/[id]
 * Update a door security kiosk
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Only ADMIN or higher can update kiosks
    if (!['SUPER_ADMIN', 'ADMIN', 'MARKET_MANAGER'].includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para actualizar kiosks'
      }, { status: 403 })
    }

    // Check kiosk exists and belongs to company
    const existingResult = await db.query(`
      SELECT id, companyid FROM market_door_kiosks
      WHERE id = $1
    `, [id])

    if (existingResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Kiosk no encontrado'
      }, { status: 404 })
    }

    const kiosk = existingResult.rows[0]
    if (payload.role !== 'SUPER_ADMIN' && kiosk.companyid !== payload.companyId) {
      return NextResponse.json({
        success: false,
        error: 'No tiene acceso a este kiosk'
      }, { status: 403 })
    }

    const body = await request.json()
    const { name, location, warehouseId, isActive, settings } = body

    // Build update query dynamically
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`)
      values.push(name)
      paramIndex++
    }
    if (location !== undefined) {
      updates.push(`location = $${paramIndex}`)
      values.push(location)
      paramIndex++
    }
    if (warehouseId !== undefined) {
      updates.push(`warehouseid = $${paramIndex}`)
      values.push(warehouseId)
      paramIndex++
    }
    if (isActive !== undefined) {
      updates.push(`isactive = $${paramIndex}`)
      values.push(isActive)
      paramIndex++
    }
    if (settings !== undefined) {
      updates.push(`settings = $${paramIndex}`)
      values.push(JSON.stringify(settings))
      paramIndex++
    }

    updates.push(`updatedat = NOW()`)

    if (updates.length === 1) {
      return NextResponse.json({
        success: false,
        error: 'No hay campos para actualizar'
      }, { status: 400 })
    }

    values.push(id)

    const result = await db.query(`
      UPDATE market_door_kiosks
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values)

    const updated = result.rows[0]

    console.log('[Door Kiosk PATCH] Updated kiosk:', id)

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        location: updated.location,
        deviceId: updated.deviceid,
        warehouseId: updated.warehouseid,
        isActive: updated.isactive,
        settings: updated.settings,
        updatedAt: updated.updatedat
      }
    })

  } catch (error) {
    console.error('[Door Kiosk PATCH] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar kiosk'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/door-security/kiosks/[id]
 * Delete a door security kiosk
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Only ADMIN or higher can delete kiosks
    if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para eliminar kiosks'
      }, { status: 403 })
    }

    // Check kiosk exists and belongs to company
    const existingResult = await db.query(`
      SELECT id, companyid FROM market_door_kiosks
      WHERE id = $1
    `, [id])

    if (existingResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Kiosk no encontrado'
      }, { status: 404 })
    }

    const kiosk = existingResult.rows[0]
    if (payload.role !== 'SUPER_ADMIN' && kiosk.companyid !== payload.companyId) {
      return NextResponse.json({
        success: false,
        error: 'No tiene acceso a este kiosk'
      }, { status: 403 })
    }

    // Check if there are active visitor logs
    const activeLogsResult = await db.query(`
      SELECT COUNT(*) as count FROM market_visitor_logs
      WHERE kioskid = $1 AND status = 'active'
    `, [id])

    if (parseInt(activeLogsResult.rows[0]?.count || '0') > 0) {
      return NextResponse.json({
        success: false,
        error: 'No se puede eliminar el kiosk porque tiene visitantes activos'
      }, { status: 400 })
    }

    // Delete associated guards first
    await db.query(`
      DELETE FROM market_door_guards WHERE kioskid = $1
    `, [id])

    // Delete the kiosk
    await db.query(`
      DELETE FROM market_door_kiosks WHERE id = $1
    `, [id])

    console.log('[Door Kiosk DELETE] Deleted kiosk:', id)

    return NextResponse.json({
      success: true,
      message: 'Kiosk eliminado exitosamente'
    })

  } catch (error) {
    console.error('[Door Kiosk DELETE] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar kiosk'
    }, { status: 500 })
  }
}
