import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

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

    console.log(`[CHECK-IN] Employee: ${employeeId}, Method: ${method}, Photo: ${photoUrl ? 'yes' : 'no'}`)

    if (!employeeId) {
      return NextResponse.json(
        { success: false, error: 'Employee ID is required' },
        { status: 400 }
      )
    }

    // Verify employee exists and belongs to company
    const employeeCheck = await db.query(`
      SELECT
        e.id, e.employee_code,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as fullname
      FROM market_employees e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN market_contracts c ON c.employeeid = e.id AND c.status = 'active'
      WHERE e.id = $1 AND e.company_id = $2 AND e.status = 'active'
    `, [employeeId, companyId])

    if (employeeCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Employee not found or inactive' },
        { status: 404 }
      )
    }

    const employee = employeeCheck.rows[0]
    const now = new Date()
    const today = now.toISOString().split('T')[0]

    // Check if already checked in today
    const existingCheck = await db.query(`
      SELECT * FROM market_attendance
      WHERE employeeid = $1 AND date = $2
    `, [employeeId, today])

    if (existingCheck.rows.length > 0 && existingCheck.rows[0].checkin) {
      return NextResponse.json(
        { success: false, error: 'Already checked in today', existingCheckIn: existingCheck.rows[0].checkin },
        { status: 400 }
      )
    }

    // Calculate late minutes if schedule exists (from active contract)
    let lateMinutes = 0
    let status = 'present'

    // Try to get schedule from contract
    const contractCheck = await db.query(`
      SELECT c.scheduleid FROM market_contracts c
      WHERE c.employeeid = $1 AND c.status = 'active'
      LIMIT 1
    `, [employeeId])

    if (contractCheck.rows.length > 0 && contractCheck.rows[0].scheduleid) {
      const scheduleId = contractCheck.rows[0].scheduleid
      const dayOfWeek = now.getDay()
      const scheduleDay = await db.query(`
        SELECT * FROM market_schedule_days
        WHERE scheduleid = $1 AND dayofweek = $2
      `, [scheduleId, dayOfWeek])

      if (scheduleDay.rows.length > 0 && scheduleDay.rows[0].isworkday && scheduleDay.rows[0].starttime) {
        const scheduledStart = scheduleDay.rows[0].starttime
        const [scheduledHour, scheduledMinute] = scheduledStart.split(':').map(Number)
        const scheduledTime = new Date(now)
        scheduledTime.setHours(scheduledHour, scheduledMinute, 0, 0)

        if (now > scheduledTime) {
          lateMinutes = Math.round((now.getTime() - scheduledTime.getTime()) / (1000 * 60))
          if (lateMinutes > 15) {
            status = 'late'
          }
        }
      }
    }

    // Determine the check-in method and notes
    let checkInMethod = method || 'manual'
    let notes = null

    if (method === 'manager_override' && approvedByName) {
      checkInMethod = 'manager_override'
      notes = `Entrada marcada por manager: ${approvedByName}`
    }

    // Ensure table exists with all columns
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS market_attendance (
          id SERIAL PRIMARY KEY,
          companyid INTEGER NOT NULL,
          employeeid INTEGER NOT NULL,
          date DATE NOT NULL,
          checkin TIMESTAMP,
          checkout TIMESTAMP,
          checkinmethod VARCHAR(50),
          checkoutmethod VARCHAR(50),
          checkinphotourl TEXT,
          checkoutphotourl TEXT,
          status VARCHAR(20) DEFAULT 'present',
          lateminutes INTEGER DEFAULT 0,
          workedhours DECIMAL(5,2) DEFAULT 0,
          overtimehours DECIMAL(5,2) DEFAULT 0,
          earlydepartureminutes INTEGER DEFAULT 0,
          approvedby INTEGER,
          notes TEXT,
          createdat TIMESTAMP DEFAULT NOW(),
          updatedat TIMESTAMP,
          UNIQUE(employeeid, date)
        )
      `)
    } catch {
      // Table exists, try to add missing columns
      try {
        await db.query(`
          ALTER TABLE market_attendance
          ADD COLUMN IF NOT EXISTS checkinphotourl TEXT,
          ADD COLUMN IF NOT EXISTS checkoutphotourl TEXT,
          ADD COLUMN IF NOT EXISTS workedhours DECIMAL(5,2) DEFAULT 0,
          ADD COLUMN IF NOT EXISTS overtimehours DECIMAL(5,2) DEFAULT 0,
          ADD COLUMN IF NOT EXISTS earlydepartureminutes INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS updatedat TIMESTAMP
        `)
      } catch {
        // Columns exist, continue
      }
    }

    // Create or update attendance record
    console.log(`[CHECK-IN] Inserting record - company: ${companyId}, employee: ${employeeId}, date: ${today}`)

    const result = await db.query(`
      INSERT INTO market_attendance (
        companyid, employeeid, date, checkin, checkinmethod,
        checkinphotourl, status, lateminutes, approvedby, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::INTEGER, $9::INTEGER, $10::TEXT)
      ON CONFLICT (employeeid, date) DO UPDATE SET
        checkin = $4,
        checkinmethod = $5,
        checkinphotourl = $6,
        status = $7,
        lateminutes = $8::INTEGER,
        approvedby = $9::INTEGER,
        notes = CASE
          WHEN $10::TEXT IS NOT NULL THEN COALESCE(market_attendance.notes || E'\n', '') || $10::TEXT
          ELSE market_attendance.notes
        END,
        updatedat = NOW()
      RETURNING *
    `, [
      companyId, employeeId, today, now.toISOString(),
      checkInMethod, photoUrl || null, status, lateMinutes,
      approvedById || null, notes || null
    ])

    console.log(`[CHECK-IN] Record created/updated: id=${result.rows[0]?.id}`)

    const row = result.rows[0]

    // Update kiosk last ping if provided
    if (kioskId) {
      await db.query(`
        UPDATE market_attendance_kiosks SET lastping = NOW() WHERE id = $1
      `, [kioskId])
    }

    return NextResponse.json({
      success: true,
      message: `¡Bienvenido, ${employee.fullname}!`,
      data: {
        id: row.id,
        employeeId: row.employeeid,
        employeeName: employee.fullname,
        employeeCode: employee.employee_code,
        date: row.date,
        checkIn: row.checkin,
        checkInMethod: row.checkinmethod,
        status: row.status,
        lateMinutes: row.lateminutes
      }
    })

  } catch (error: any) {
    console.error('Error checking in:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
