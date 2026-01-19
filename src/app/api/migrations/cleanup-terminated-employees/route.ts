import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/cleanup-terminated-employees
 * Clear POS credentials from terminated employees to allow badge code reuse
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Cleanup Terminated] Starting cleanup...')

    // Find terminated employees with POS credentials
    const checkResult = await db.query(`
      SELECT id, employee_code, pos_badge_code, pos_pin IS NOT NULL as has_pin
      FROM market_employees
      WHERE status = 'terminated'
        AND (pos_badge_code IS NOT NULL OR pos_pin IS NOT NULL)
    `)

    console.log('[Cleanup Terminated] Found', checkResult.rows.length, 'terminated employees with POS credentials')

    if (checkResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No terminated employees with POS credentials found',
        cleaned: 0
      })
    }

    // Clear POS credentials from terminated employees
    const updateResult = await db.query(`
      UPDATE market_employees
      SET pos_badge_code = NULL,
          pos_pin = NULL,
          updated_at = NOW()
      WHERE status = 'terminated'
        AND (pos_badge_code IS NOT NULL OR pos_pin IS NOT NULL)
      RETURNING id, employee_code
    `)

    console.log('[Cleanup Terminated] Cleaned', updateResult.rowCount, 'employees')

    return NextResponse.json({
      success: true,
      message: `Cleaned POS credentials from ${updateResult.rowCount} terminated employees`,
      cleaned: updateResult.rowCount,
      employees: updateResult.rows.map(r => ({ id: r.id, code: r.employee_code }))
    })

  } catch (error) {
    console.error('[Cleanup Terminated] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error during cleanup'
    }, { status: 500 })
  }
}

/**
 * GET /api/migrations/cleanup-terminated-employees
 * Preview terminated employees with POS credentials
 */
export async function GET(request: NextRequest) {
  try {
    const result = await db.query(`
      SELECT
        e.id,
        e.employee_code,
        e.pos_badge_code,
        e.pos_pin IS NOT NULL as has_pin,
        e.termination_date,
        u.email,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as name
      FROM market_employees e
      JOIN users u ON e.user_id = u.id
      WHERE e.status = 'terminated'
        AND (e.pos_badge_code IS NOT NULL OR e.pos_pin IS NOT NULL)
      ORDER BY e.termination_date DESC
    `)

    return NextResponse.json({
      success: true,
      count: result.rows.length,
      employees: result.rows.map(r => ({
        id: r.id,
        employeeCode: r.employee_code,
        name: r.name,
        email: r.email,
        badgeCode: r.pos_badge_code,
        hasPIN: r.has_pin,
        terminationDate: r.termination_date
      }))
    })

  } catch (error) {
    console.error('[Cleanup Terminated Preview] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error checking terminated employees'
    }, { status: 500 })
  }
}
