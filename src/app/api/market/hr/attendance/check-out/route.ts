import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'
import { getEmployeeScheduleForDate, calculateEarlyDepartureMinutes, calculateOvertimeHours } from '@/lib/hr/schedule-utils'

async function getCompanyId() {
  const cookieStore = await cookies()
  const companyId = cookieStore.get('user-company-id')?.value
  return companyId ? parseInt(companyId) : null
}

export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No company ID' }, { status: 401 })
    }

    const body = await request.json()
    const { employeeId, method, photoUrl, kioskId, approvedById, approvedByName } = body

    if (!employeeId) {
      return NextResponse.json(
        { success: false, error: 'Employee ID is required' },
        { status: 400 }
      )
    }

    // Verify employee exists
    const employeeCheck = await db.query(`
      SELECT
        e.id, e.employee_code,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as fullname
      FROM market_employees e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.id = $1 AND e.company_id = $2
    `, [employeeId, companyId])

    if (employeeCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      )
    }

    const employee = employeeCheck.rows[0]
    const now = new Date()
    const today = now.toISOString().split('T')[0]

    // Check if checked in today
    const existingCheck = await db.query(`
      SELECT * FROM market_attendance
      WHERE employeeid = $1 AND date = $2
    `, [employeeId, today])

    if (existingCheck.rows.length === 0 || !existingCheck.rows[0].checkin) {
      return NextResponse.json(
        { success: false, error: 'No check-in found for today. Please check in first.' },
        { status: 400 }
      )
    }

    if (existingCheck.rows[0].checkout) {
      return NextResponse.json(
        { success: false, error: 'Already checked out today', existingCheckOut: existingCheck.rows[0].checkout },
        { status: 400 }
      )
    }

    const attendance = existingCheck.rows[0]

    // Calculate worked hours
    const checkInTime = new Date(attendance.checkin)
    const workedHours = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)

    // Calculate early departure and overtime using schedule-utils (supports both rotating and fixed schedules)
    let earlyDepartureMinutes = 0
    let overtimeHours = 0
    let scheduleSource: string | null = null

    // Get employee's schedule for today (rotating shifts take priority over fixed)
    const schedule = await getEmployeeScheduleForDate(employeeId, now)

    if (schedule) {
      scheduleSource = schedule.source

      // Only calculate if it's a work day and there's an end time
      if (schedule.isWorkDay && schedule.endTime) {
        earlyDepartureMinutes = calculateEarlyDepartureMinutes(now, schedule.endTime)
        overtimeHours = calculateOvertimeHours(now, schedule.endTime)
      }
    }

    // Determine the check-out method and notes
    let checkOutMethod = method || 'manual'
    let newNotes = null

    if (method === 'manager_override' && approvedByName) {
      checkOutMethod = 'manager_override'
      newNotes = `Salida marcada por manager: ${approvedByName}`
    }

    // Ensure columns exist
    try {
      await db.query(`
        ALTER TABLE market_attendance
        ADD COLUMN IF NOT EXISTS checkoutphotourl TEXT,
        ADD COLUMN IF NOT EXISTS workedhours DECIMAL(5,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS overtimehours DECIMAL(5,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS earlydepartureminutes INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS updatedat TIMESTAMP
      `)
    } catch {
      // Columns might already exist, continue
    }

    // Update attendance record
    const result = await db.query(`
      UPDATE market_attendance
      SET
        checkout = $1,
        checkoutmethod = $2,
        checkoutphotourl = $3,
        workedhours = $4,
        overtimehours = $5,
        earlydepartureminutes = $6,
        approvedby = COALESCE($7::INTEGER, approvedby),
        notes = CASE
          WHEN $8::TEXT IS NOT NULL THEN COALESCE(notes || E'\n', '') || $8::TEXT
          ELSE notes
        END,
        updatedat = NOW()
      WHERE employeeid = $9 AND date = $10
      RETURNING *
    `, [
      now.toISOString(), checkOutMethod, photoUrl || null,
      Math.round(workedHours * 100) / 100,
      Math.round(overtimeHours * 100) / 100,
      earlyDepartureMinutes,
      approvedById || null,
      newNotes || null,
      employeeId, today
    ])

    const row = result.rows[0]

    // Update kiosk last ping if provided
    if (kioskId) {
      await db.query(`
        UPDATE market_attendance_kiosks SET lastping = NOW() WHERE id = $1
      `, [kioskId])
    }

    // Format worked hours for display
    const hours = Math.floor(workedHours)
    const minutes = Math.round((workedHours - hours) * 60)

    return NextResponse.json({
      success: true,
      message: `¡Hasta pronto, ${employee.fullname}! Trabajaste ${hours}h ${minutes}m hoy.`,
      data: {
        id: row.id,
        employeeId: row.employeeid,
        employeeName: employee.fullname,
        employeeCode: employee.employee_code,
        date: row.date,
        checkIn: row.checkin,
        checkOut: row.checkout,
        checkOutMethod: row.checkoutmethod,
        workedHours: parseFloat(row.workedhours),
        overtimeHours: parseFloat(row.overtimehours) || 0,
        earlyDepartureMinutes: row.earlydepartureminutes || 0
      }
    })

  } catch (error: any) {
    console.error('Error checking out:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
