import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

async function getCompanyId() {
  const cookieStore = await cookies()
  const companyId = cookieStore.get('user-company-id')?.value
  return companyId ? parseInt(companyId) : null
}

// POST - Create multiple shifts at once
export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No company ID' }, { status: 401 })
    }

    const cookieStore = await cookies()
    const userId = cookieStore.get('user-id')?.value
    const createdBy = userId ? parseInt(userId) : null

    const body = await request.json()
    const { shifts } = body

    if (!shifts || !Array.isArray(shifts) || shifts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Shifts array is required' },
        { status: 400 }
      )
    }

    // Validate shifts structure
    for (const shift of shifts) {
      if (!shift.employeeId || !shift.shiftDate) {
        return NextResponse.json(
          { success: false, error: 'Each shift requires employeeId and shiftDate' },
          { status: 400 }
        )
      }
    }

    let created = 0
    let updated = 0
    const errors: string[] = []

    for (const shift of shifts) {
      try {
        const result = await db.query(`
          INSERT INTO market_employee_shifts (
            companyid, employeeid, shiftdate, patternid, scheduleid,
            starttime, endtime, breakminutes, shifttype, notes, createdby
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (employeeid, shiftdate) DO UPDATE SET
            patternid = COALESCE($4, market_employee_shifts.patternid),
            scheduleid = COALESCE($5, market_employee_shifts.scheduleid),
            starttime = COALESCE($6, market_employee_shifts.starttime),
            endtime = COALESCE($7, market_employee_shifts.endtime),
            breakminutes = COALESCE($8, market_employee_shifts.breakminutes),
            shifttype = COALESCE($9, market_employee_shifts.shifttype),
            notes = COALESCE($10, market_employee_shifts.notes),
            updatedat = NOW()
          RETURNING (xmax = 0) as is_insert
        `, [
          companyId,
          shift.employeeId,
          shift.shiftDate,
          shift.patternId || null,
          shift.scheduleId || null,
          shift.startTime || null,
          shift.endTime || null,
          shift.breakMinutes || 0,
          shift.shiftType || 'work',
          shift.notes || null,
          createdBy
        ])

        if (result.rows[0]?.is_insert) {
          created++
        } else {
          updated++
        }
      } catch (err: any) {
        errors.push(`${shift.employeeId}/${shift.shiftDate}: ${err.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        created,
        updated,
        total: shifts.length,
        errors: errors.length > 0 ? errors : undefined
      }
    })

  } catch (error: any) {
    console.error('Error bulk creating shifts:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Delete multiple shifts
export async function DELETE(request: NextRequest) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No company ID' }, { status: 401 })
    }

    const body = await request.json()
    const { shiftIds, employeeId, startDate, endDate, patternId } = body

    // Option 1: Delete by IDs
    if (shiftIds && Array.isArray(shiftIds) && shiftIds.length > 0) {
      const result = await db.query(`
        DELETE FROM market_employee_shifts
        WHERE id = ANY($1) AND companyid = $2
        RETURNING id
      `, [shiftIds, companyId])

      return NextResponse.json({
        success: true,
        data: {
          deleted: result.rows.length
        }
      })
    }

    // Option 2: Delete by employee and date range
    if (employeeId && startDate && endDate) {
      let query = `
        DELETE FROM market_employee_shifts
        WHERE companyid = $1 AND employeeid = $2
        AND shiftdate >= $3 AND shiftdate <= $4
      `
      const params: any[] = [companyId, employeeId, startDate, endDate]

      if (patternId) {
        query += ` AND patternid = $5`
        params.push(patternId)
      }

      query += ` RETURNING id`

      const result = await db.query(query, params)

      return NextResponse.json({
        success: true,
        data: {
          deleted: result.rows.length
        }
      })
    }

    // Option 3: Delete all shifts for a pattern in date range
    if (patternId && startDate && endDate) {
      const result = await db.query(`
        DELETE FROM market_employee_shifts
        WHERE companyid = $1 AND patternid = $2
        AND shiftdate >= $3 AND shiftdate <= $4
        RETURNING id
      `, [companyId, patternId, startDate, endDate])

      return NextResponse.json({
        success: true,
        data: {
          deleted: result.rows.length
        }
      })
    }

    return NextResponse.json(
      { success: false, error: 'Provide shiftIds OR (employeeId + startDate + endDate) OR (patternId + startDate + endDate)' },
      { status: 400 }
    )

  } catch (error: any) {
    console.error('Error bulk deleting shifts:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
