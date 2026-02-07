import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'
import { getEmployeeScheduleForDate } from '@/lib/hr/schedule-utils'

async function getCompanyId() {
  const cookieStore = await cookies()
  const companyId = cookieStore.get('user-company-id')?.value
  return companyId ? parseInt(companyId) : null
}

/**
 * Detect absences for a given date
 * For each active employee:
 * 1. Get their schedule for the date (rotating or fixed)
 * 2. If it's a work day and no attendance record exists, create an absence record
 */
export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No company ID' }, { status: 401 })
    }

    const body = await request.json()
    const { date } = body

    // Default to today if no date provided
    const targetDate = date ? new Date(date) : new Date()
    const dateStr = targetDate.toISOString().split('T')[0]

    // Don't allow future dates
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    if (targetDate > today) {
      return NextResponse.json(
        { success: false, error: 'Cannot detect absences for future dates' },
        { status: 400 }
      )
    }

    // Get all active employees with active contracts
    const employeesResult = await db.query(`
      SELECT DISTINCT
        e.id,
        e.employee_code,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as fullname
      FROM market_employees e
      LEFT JOIN users u ON u.id = e.user_id
      INNER JOIN market_contracts c ON c.employeeid = e.id AND c.status = 'active'
      WHERE e.company_id = $1 AND e.status = 'active'
    `, [companyId])

    let absencesCreated = 0
    let alreadyPresent = 0
    let notWorkDay = 0
    let noSchedule = 0
    const absenceDetails: any[] = []

    for (const employee of employeesResult.rows) {
      // Check if attendance record exists for this date
      const attendanceCheck = await db.query(`
        SELECT id, status, checkin FROM market_attendance
        WHERE employeeid = $1 AND date = $2
      `, [employee.id, dateStr])

      if (attendanceCheck.rows.length > 0) {
        // Already has attendance record (present, late, or already marked absent)
        alreadyPresent++
        continue
      }

      // Get the employee's schedule for this date
      const schedule = await getEmployeeScheduleForDate(employee.id, targetDate)

      if (!schedule) {
        // No schedule assigned
        noSchedule++
        continue
      }

      if (!schedule.isWorkDay) {
        // Not a work day for this employee
        notWorkDay++
        continue
      }

      // Employee should have worked but didn't check in - mark as absent
      await db.query(`
        INSERT INTO market_attendance (
          companyid, employeeid, date, status, notes, createdat
        )
        VALUES ($1, $2, $3, 'absent', $4, NOW())
        ON CONFLICT (employeeid, date) DO NOTHING
      `, [
        companyId,
        employee.id,
        dateStr,
        `Ausencia detectada automáticamente (horario: ${schedule.source === 'rotating' ? 'rotativo' : 'fijo'})`
      ])

      absencesCreated++
      absenceDetails.push({
        employeeId: employee.id,
        employeeCode: employee.employee_code,
        employeeName: employee.fullname,
        scheduleSource: schedule.source,
        scheduledStart: schedule.startTime,
        scheduledEnd: schedule.endTime
      })
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${employeesResult.rows.length} employees for ${dateStr}`,
      data: {
        date: dateStr,
        totalEmployees: employeesResult.rows.length,
        absencesCreated,
        alreadyPresent,
        notWorkDay,
        noSchedule,
        absenceDetails: absencesCreated > 0 ? absenceDetails : undefined
      }
    })

  } catch (error: any) {
    console.error('Error detecting absences:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET - Check absence detection status for a date range
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No company ID' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'startDate and endDate are required' },
        { status: 400 }
      )
    }

    // Get absence summary by date
    const result = await db.query(`
      SELECT
        date,
        COUNT(*) FILTER (WHERE status = 'absent') as absences,
        COUNT(*) FILTER (WHERE status = 'present') as present,
        COUNT(*) FILTER (WHERE status = 'late') as late,
        COUNT(*) as total
      FROM market_attendance
      WHERE companyid = $1 AND date >= $2 AND date <= $3
      GROUP BY date
      ORDER BY date ASC
    `, [companyId, startDate, endDate])

    return NextResponse.json({
      success: true,
      data: result.rows.map(row => ({
        date: row.date,
        absences: parseInt(row.absences) || 0,
        present: parseInt(row.present) || 0,
        late: parseInt(row.late) || 0,
        total: parseInt(row.total) || 0
      }))
    })

  } catch (error: any) {
    console.error('Error getting absence summary:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
