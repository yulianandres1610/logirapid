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
 * GET /api/market/door-security/guards
 * List authorized guards for door security
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
    const kioskId = searchParams.get('kioskId')
    const isActive = searchParams.get('isActive')

    let whereClause = 'WHERE g.companyid = $1'
    const params: any[] = [payload.companyId]
    let paramIndex = 2

    if (kioskId) {
      whereClause += ` AND (g.kioskid = $${paramIndex} OR g.kioskid IS NULL)`
      params.push(kioskId)
      paramIndex++
    }

    if (isActive !== null && isActive !== undefined) {
      whereClause += ` AND g.isactive = $${paramIndex}`
      params.push(isActive === 'true')
      paramIndex++
    }

    // Try to get guards with employee info, return empty if tables don't exist
    try {
      const result = await db.query(`
        SELECT
          g.id,
          g.employeeid,
          g.kioskid,
          g.isactive,
          g.createdat,
          e.employee_code,
          e.status as employee_status,
          u.firstname,
          u.lastname,
          u.email,
          u.phone,
          k.name as kioskname
        FROM market_door_guards g
        LEFT JOIN market_employees e ON g.employeeid = e.id
        LEFT JOIN users u ON e.user_id = u.id
        LEFT JOIN market_door_kiosks k ON g.kioskid = k.id
        ${whereClause}
        ORDER BY g.createdat DESC
      `, params)

      return NextResponse.json({
        success: true,
        data: {
          guards: result.rows.map(g => ({
            id: g.id,
            employeeId: g.employeeid,
            employeeName: g.firstname ? `${g.firstname} ${g.lastname || ''}`.trim() : `Empleado #${g.employeeid}`,
            employeeCode: g.employee_code || '',
            email: g.email || '',
            phone: g.phone || '',
            kioskId: g.kioskid,
            kioskName: g.kioskname || 'Todos los kiosks',
            isActive: g.isactive,
            employeeActive: g.employee_status === 'active',
            createdAt: g.createdat
          }))
        }
      })
    } catch (tableError: any) {
      // If tables don't exist yet, return empty list
      if (tableError.message?.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          data: { guards: [] }
        })
      }
      throw tableError
    }

  } catch (error) {
    console.error('[Guards GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener guardias'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/door-security/guards
 * Add a new authorized guard
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

    // Only ADMIN or higher can manage guards
    if (!['SUPER_ADMIN', 'ADMIN', 'MARKET_MANAGER'].includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para gestionar guardias'
      }, { status: 403 })
    }

    const body = await request.json()
    const { employeeId, kioskId } = body

    if (!employeeId) {
      return NextResponse.json({
        success: false,
        error: 'ID del empleado requerido'
      }, { status: 400 })
    }

    // Verify employee exists and belongs to company
    let employee: any = null
    try {
      const employeeResult = await db.query(`
        SELECT e.id, e.pos_pin, e.status, u.firstname, u.lastname
        FROM market_employees e
        LEFT JOIN users u ON e.user_id = u.id
        WHERE e.id = $1 AND e.company_id = $2 AND e.status = 'active'
      `, [employeeId, payload.companyId])

      if (employeeResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Empleado no encontrado o inactivo'
        }, { status: 404 })
      }

      employee = employeeResult.rows[0]

      // Check employee has PIN (optional - can be set later)
      // For now, we allow adding guards without PIN
      // if (!employee.pos_pin) {
      //   return NextResponse.json({
      //     success: false,
      //     error: 'El empleado debe tener un PIN configurado para ser guardia'
      //   }, { status: 400 })
      // }
    } catch (tableError: any) {
      if (tableError.message?.includes('does not exist')) {
        return NextResponse.json({
          success: false,
          error: 'La tabla de empleados no existe. Inicialice primero el módulo de RRHH.'
        }, { status: 400 })
      }
      throw tableError
    }

    // Verify kiosk if provided
    if (kioskId) {
      const kioskResult = await db.query(`
        SELECT id FROM market_door_kiosks
        WHERE id = $1 AND companyid = $2
      `, [kioskId, payload.companyId])

      if (kioskResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Kiosk no encontrado'
        }, { status: 404 })
      }
    }

    // Check if guard already exists for this employee/kiosk combination
    const existingResult = await db.query(`
      SELECT id FROM market_door_guards
      WHERE companyid = $1 AND employeeid = $2
        AND (kioskid = $3 OR (kioskid IS NULL AND $3 IS NULL))
    `, [payload.companyId, employeeId, kioskId || null])

    if (existingResult.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Este empleado ya está autorizado como guardia para este kiosk'
      }, { status: 400 })
    }

    // Create guard
    const result = await db.query(`
      INSERT INTO market_door_guards (companyid, employeeid, kioskid, isactive)
      VALUES ($1, $2, $3, true)
      RETURNING *
    `, [payload.companyId, employeeId, kioskId || null])

    const guard = result.rows[0]

    console.log('[Guards POST] Created guard:', guard.id, 'for employee:', employeeId)

    return NextResponse.json({
      success: true,
      data: {
        id: guard.id,
        employeeId: guard.employeeid,
        employeeName: `${employee.firstname || ''} ${employee.lastname || ''}`.trim() || `Empleado #${employeeId}`,
        kioskId: guard.kioskid,
        isActive: guard.isactive,
        createdAt: guard.createdat
      }
    })

  } catch (error) {
    console.error('[Guards POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear guardia'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/door-security/guards
 * Remove a guard authorization
 */
export async function DELETE(request: NextRequest) {
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

    // Only ADMIN or higher can manage guards
    if (!['SUPER_ADMIN', 'ADMIN', 'MARKET_MANAGER'].includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para gestionar guardias'
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const guardId = searchParams.get('id')

    if (!guardId) {
      return NextResponse.json({
        success: false,
        error: 'ID del guardia requerido'
      }, { status: 400 })
    }

    // Check guard exists and belongs to company
    const guardResult = await db.query(`
      SELECT id, companyid FROM market_door_guards WHERE id = $1
    `, [guardId])

    if (guardResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Guardia no encontrado'
      }, { status: 404 })
    }

    const guard = guardResult.rows[0]
    if (payload.role !== 'SUPER_ADMIN' && guard.companyid !== payload.companyId) {
      return NextResponse.json({
        success: false,
        error: 'No tiene acceso a este guardia'
      }, { status: 403 })
    }

    // Delete guard
    await db.query(`DELETE FROM market_door_guards WHERE id = $1`, [guardId])

    console.log('[Guards DELETE] Deleted guard:', guardId)

    return NextResponse.json({
      success: true,
      message: 'Guardia eliminado exitosamente'
    })

  } catch (error) {
    console.error('[Guards DELETE] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar guardia'
    }, { status: 500 })
  }
}
