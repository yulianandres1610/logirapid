import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

async function getCompanyId() {
  const cookieStore = await cookies()
  const companyId = cookieStore.get('user-company-id')?.value
  return companyId ? parseInt(companyId) : null
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

interface CalendarDay {
  date: string
  dayOfWeek: number
  dayName: string
  shiftType: 'work' | 'rest' | 'vacation' | 'sick' | 'leave' | 'none'
  startTime: string | null
  endTime: string | null
  breakMinutes: number
  source: 'rotating' | 'fixed' | 'none'
  shiftId: number | null
  patternId: number | null
  patternName: string | null
  patternLabel: string | null
  scheduleId: number | null
  scheduleName: string | null
  notes: string | null
  isEditable: boolean
}

interface EmployeeCalendar {
  employeeId: number
  employeeName: string
  employeeCode: string
  department: string | null
  photoUrl: string | null
  scheduleType: 'fixed' | 'rotating' | 'none'
  scheduleName: string | null
  patternName: string | null
  patternLabel: string | null
  days: CalendarDay[]
}

export async function GET(request: NextRequest) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No company ID' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const employeeId = searchParams.get('employeeId')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'startDate and endDate are required' },
        { status: 400 }
      )
    }

    // Get all active employees with their schedules
    // Note: The contracts table only has scheduleid column, not schedule_type or shift_pattern_id
    // We determine schedule type based on whether there are shifts in market_employee_shifts
    // Column names: departmentid (no underscore), user_id and company_id (with underscore)
    let employeesQuery = `
      SELECT
        e.id,
        e.employee_code,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as fullname,
        d.name as department_name,
        c.scheduleid,
        s.name as schedule_name,
        c.photourl as photo_url
      FROM market_employees e
      LEFT JOIN users u ON u.id = e.user_id
      LEFT JOIN market_departments d ON d.id = e.departmentid
      LEFT JOIN market_contracts c ON c.employeeid = e.id AND c.status = 'active'
      LEFT JOIN market_schedules s ON s.id = c.scheduleid
      WHERE e.company_id = $1 AND e.status = 'active'
    `
    const employeesParams: any[] = [companyId]

    if (employeeId) {
      employeesQuery += ` AND e.id = $2`
      employeesParams.push(parseInt(employeeId))
    }

    employeesQuery += ` ORDER BY fullname ASC`

    const employeesResult = await db.query(employeesQuery, employeesParams)

    // Get all shifts for the date range (with error handling for missing tables)
    const shiftsMap = new Map<string, any>()
    try {
      const shiftsResult = await db.query(`
        SELECT
          es.*,
          sp.name as patternname,
          sp.workdays,
          sp.restdays
        FROM market_employee_shifts es
        LEFT JOIN market_shift_patterns sp ON sp.id = es.patternid
        WHERE es.companyid = $1
          AND es.shiftdate >= $2
          AND es.shiftdate <= $3
      `, [companyId, startDate, endDate])

      // Create shifts map for quick lookup
      shiftsResult.rows.forEach(shift => {
        // Handle date whether it's a Date object or string
        let dateStr: string
        if (shift.shiftdate instanceof Date) {
          dateStr = shift.shiftdate.toISOString().split('T')[0]
        } else if (typeof shift.shiftdate === 'string') {
          dateStr = shift.shiftdate.split('T')[0]
        } else {
          dateStr = String(shift.shiftdate).split('T')[0]
        }
        const key = `${shift.employeeid}-${dateStr}`
        shiftsMap.set(key, shift)
      })
    } catch (e) {
      console.log('[Calendar API] Shifts table may not exist:', e)
    }

    // Get all fixed schedules (with error handling for missing tables)
    const scheduleDaysMap = new Map<string, any>()
    try {
      const schedulesResult = await db.query(`
        SELECT s.id, s.name, sd.*
        FROM market_schedules s
        JOIN market_schedule_days sd ON sd.scheduleid = s.id
        WHERE s.companyid = $1
      `, [companyId])

      // Create schedule days map
      schedulesResult.rows.forEach(row => {
        const key = `${row.id}-${row.dayofweek}`
        scheduleDaysMap.set(key, row)
      })
    } catch (e) {
      console.log('[Calendar API] Schedules table may not exist:', e)
    }

    // Generate date range
    const dates: Date[] = []
    const start = new Date(startDate + 'T12:00:00')
    const end = new Date(endDate + 'T12:00:00')
    let current = new Date(start)
    while (current <= end) {
      dates.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }

    // Build calendar for each employee
    const calendars: EmployeeCalendar[] = employeesResult.rows.map(emp => {
      // Check if employee has any rotating shifts in the date range
      const hasRotatingShifts = dates.some(date => {
        const dateStr = date.toISOString().split('T')[0]
        return shiftsMap.has(`${emp.id}-${dateStr}`)
      })

      // Get pattern info from the first shift if available
      let patternName: string | null = null
      let patternLabel: string | null = null
      for (const date of dates) {
        const dateStr = date.toISOString().split('T')[0]
        const shift = shiftsMap.get(`${emp.id}-${dateStr}`)
        if (shift && shift.patternname) {
          patternName = shift.patternname
          if (shift.workdays && shift.restdays) {
            patternLabel = `${shift.workdays}x${shift.restdays}`
          }
          break
        }
      }

      const scheduleType: 'fixed' | 'rotating' | 'none' =
        hasRotatingShifts ? 'rotating' :
        emp.scheduleid ? 'fixed' : 'none'

      const days: CalendarDay[] = dates.map(date => {
        const dateStr = date.toISOString().split('T')[0]
        const dayOfWeek = date.getDay()
        const shiftKey = `${emp.id}-${dateStr}`
        const shift = shiftsMap.get(shiftKey)

        // If there's a specific shift assigned, use that
        if (shift) {
          const shiftPatternLabel = shift.workdays && shift.restdays
            ? `${shift.workdays}x${shift.restdays}`
            : null

          return {
            date: dateStr,
            dayOfWeek,
            dayName: DAY_NAMES[dayOfWeek],
            shiftType: shift.shifttype || 'work',
            startTime: shift.starttime,
            endTime: shift.endtime,
            breakMinutes: shift.breakminutes || 0,
            source: 'rotating' as const,
            shiftId: shift.id,
            patternId: shift.patternid,
            patternName: shift.patternname,
            patternLabel: shiftPatternLabel,
            scheduleId: null,
            scheduleName: null,
            notes: shift.notes,
            isEditable: true
          }
        }

        // If employee has a fixed schedule, use that
        if (emp.scheduleid) {
          const scheduleDay = scheduleDaysMap.get(`${emp.scheduleid}-${dayOfWeek}`)
          if (scheduleDay) {
            return {
              date: dateStr,
              dayOfWeek,
              dayName: DAY_NAMES[dayOfWeek],
              shiftType: scheduleDay.isworkday ? 'work' : 'rest',
              startTime: scheduleDay.starttime,
              endTime: scheduleDay.endtime,
              breakMinutes: scheduleDay.breakminutes || 0,
              source: 'fixed' as const,
              shiftId: null,
              patternId: null,
              patternName: null,
              patternLabel: null,
              scheduleId: emp.scheduleid,
              scheduleName: emp.schedule_name,
              notes: null,
              isEditable: true
            }
          }
        }

        // No schedule assigned
        return {
          date: dateStr,
          dayOfWeek,
          dayName: DAY_NAMES[dayOfWeek],
          shiftType: 'none' as const,
          startTime: null,
          endTime: null,
          breakMinutes: 0,
          source: 'none' as const,
          shiftId: null,
          patternId: null,
          patternName: null,
          patternLabel: null,
          scheduleId: null,
          scheduleName: null,
          notes: null,
          isEditable: true
        }
      })

      return {
        employeeId: emp.id,
        employeeName: emp.fullname || `Empleado ${emp.id}`,
        employeeCode: emp.employee_code || `EMP-${emp.id}`,
        department: emp.department_name,
        photoUrl: emp.photo_url,
        scheduleType,
        scheduleName: emp.schedule_name,
        patternName,
        patternLabel,
        days
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        startDate,
        endDate,
        totalDays: dates.length,
        employees: calendars
      }
    })

  } catch (error: any) {
    console.error('Error fetching calendar:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
