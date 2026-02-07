import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'
import { generateShiftsFromPattern, ShiftPattern } from '@/lib/hr/schedule-utils'

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

    const cookieStore = await cookies()
    const userId = cookieStore.get('user-id')?.value
    const createdBy = userId ? parseInt(userId) : undefined

    const body = await request.json()
    const { employeeIds, patternId, startDate, endDate, firstWorkDay, overwrite } = body

    // Validate required fields
    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one employee ID is required' },
        { status: 400 }
      )
    }

    if (!patternId || !startDate || !endDate || !firstWorkDay) {
      return NextResponse.json(
        { success: false, error: 'Pattern ID, start date, end date, and first work day are required' },
        { status: 400 }
      )
    }

    // Validate dates
    const start = new Date(startDate)
    const end = new Date(endDate)
    const firstWork = new Date(firstWorkDay)

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || isNaN(firstWork.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format' },
        { status: 400 }
      )
    }

    if (end < start) {
      return NextResponse.json(
        { success: false, error: 'End date must be after start date' },
        { status: 400 }
      )
    }

    // Get the pattern
    const patternResult = await db.query(`
      SELECT * FROM market_shift_patterns
      WHERE id = $1 AND companyid = $2 AND isactive = true
    `, [patternId, companyId])

    if (patternResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Shift pattern not found or inactive' },
        { status: 404 }
      )
    }

    const patternRow = patternResult.rows[0]
    const pattern: ShiftPattern = {
      id: patternRow.id,
      workdays: patternRow.workdays,
      restdays: patternRow.restdays,
      starttime: patternRow.starttime,
      endtime: patternRow.endtime,
      breakminutes: patternRow.breakminutes,
      name: patternRow.name
    }

    // Verify all employees exist and belong to company
    const employeeCheck = await db.query(`
      SELECT id FROM market_employees
      WHERE id = ANY($1) AND company_id = $2
    `, [employeeIds, companyId])

    const validEmployeeIds = employeeCheck.rows.map(r => r.id)
    const invalidEmployeeIds = employeeIds.filter((id: number) => !validEmployeeIds.includes(id))

    if (invalidEmployeeIds.length > 0) {
      return NextResponse.json(
        { success: false, error: `Invalid employee IDs: ${invalidEmployeeIds.join(', ')}` },
        { status: 400 }
      )
    }

    // Generate shifts for each employee
    let totalShiftsCreated = 0
    let totalShiftsUpdated = 0
    const errors: string[] = []

    for (const employeeId of validEmployeeIds) {
      try {
        const shifts = generateShiftsFromPattern(
          {
            employeeId,
            companyId,
            patternId,
            startDate: start,
            endDate: end,
            firstWorkDay: firstWork,
            createdBy
          },
          pattern
        )

        // If overwrite is true, delete existing shifts in the range first
        if (overwrite) {
          await db.query(`
            DELETE FROM market_employee_shifts
            WHERE employeeid = $1 AND shiftdate >= $2 AND shiftdate <= $3
          `, [employeeId, startDate, endDate])
        }

        // Insert shifts
        for (const shift of shifts) {
          const result = await db.query(`
            INSERT INTO market_employee_shifts (
              companyid, employeeid, shiftdate, patternid, starttime, endtime,
              breakminutes, shifttype, createdby
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (employeeid, shiftdate) DO UPDATE SET
              patternid = $4,
              starttime = $5,
              endtime = $6,
              breakminutes = $7,
              shifttype = $8,
              updatedat = NOW()
            RETURNING (xmax = 0) as is_insert
          `, [
            shift.companyId, shift.employeeId, shift.shiftDate, shift.patternId,
            shift.startTime, shift.endTime, shift.breakMinutes, shift.shiftType,
            shift.createdBy || null
          ])

          if (result.rows[0]?.is_insert) {
            totalShiftsCreated++
          } else {
            totalShiftsUpdated++
          }
        }
      } catch (err: any) {
        errors.push(`Employee ${employeeId}: ${err.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Generated shifts for ${validEmployeeIds.length} employees`,
      data: {
        employeesProcessed: validEmployeeIds.length,
        shiftsCreated: totalShiftsCreated,
        shiftsUpdated: totalShiftsUpdated,
        pattern: {
          id: pattern.id,
          name: pattern.name,
          label: `${pattern.workdays}x${pattern.restdays}`
        },
        dateRange: {
          start: startDate,
          end: endDate,
          firstWorkDay
        },
        errors: errors.length > 0 ? errors : undefined
      }
    })

  } catch (error: any) {
    console.error('Error generating shifts:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
