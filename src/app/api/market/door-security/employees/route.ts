import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/market/door-security/employees
 * List active employees for kiosk meeting selection
 * Auth: kioskId + guardId (no JWT needed)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const kioskId = searchParams.get('kioskId')
    const guardId = searchParams.get('guardId')
    const search = searchParams.get('search')

    if (!kioskId || !guardId) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    // Validate kiosk and get companyId
    const kioskResult = await db.query(
      'SELECT id, companyid FROM market_door_kiosks WHERE id = $1 AND isactive = true',
      [kioskId]
    )
    if (kioskResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Kiosco no encontrado' }, { status: 404 })
    }

    // Validate guard
    const guardResult = await db.query(
      'SELECT id FROM market_door_guards WHERE id = $1 AND isactive = true',
      [guardId]
    )
    if (guardResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Guardia no autorizado' }, { status: 403 })
    }

    const companyId = kioskResult.rows[0].companyid

    let query = `
      SELECT
        e.id,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as fullname,
        d.name as department_name
      FROM market_employees e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN market_departments d ON e.departmentid = d.id
      WHERE e.company_id = $1 AND e.status = 'active'
    `
    const params: any[] = [companyId]

    if (search) {
      query += ` AND (
        u.firstname ILIKE $2 OR
        u.lastname ILIKE $2 OR
        u.email ILIKE $2
      )`
      params.push(`%${search}%`)
    }

    query += ` ORDER BY u.firstname ASC, u.lastname ASC LIMIT 50`

    const result = await db.query(query, params)

    return NextResponse.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        fullName: row.fullname,
        department: row.department_name
      }))
    })
  } catch (error) {
    console.error('[Door Security Employees] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener empleados' }, { status: 500 })
  }
}
