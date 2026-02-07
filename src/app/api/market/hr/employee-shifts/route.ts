import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

async function getCompanyId() {
  const cookieStore = await cookies()
  const companyId = cookieStore.get('user-company-id')?.value
  return companyId ? parseInt(companyId) : null
}

export async function GET(request: NextRequest) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No company ID' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const shiftType = searchParams.get('shiftType')

    let query = `
      SELECT
        es.*,
        sp.name as patternname,
        sp.code as patterncode,
        sp.workdays as patternworkdays,
        sp.restdays as patternrestdays,
        e.employee_code,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as employeename
      FROM market_employee_shifts es
      LEFT JOIN market_shift_patterns sp ON sp.id = es.patternid
      LEFT JOIN market_employees e ON e.id = es.employeeid
      LEFT JOIN users u ON u.id = e.user_id
      WHERE es.companyid = $1
    `

    const params: any[] = [companyId]
    let paramIndex = 2

    if (employeeId) {
      query += ` AND es.employeeid = $${paramIndex++}`
      params.push(parseInt(employeeId))
    }

    if (startDate) {
      query += ` AND es.shiftdate >= $${paramIndex++}`
      params.push(startDate)
    }

    if (endDate) {
      query += ` AND es.shiftdate <= $${paramIndex++}`
      params.push(endDate)
    }

    if (shiftType) {
      query += ` AND es.shifttype = $${paramIndex++}`
      params.push(shiftType)
    }

    query += ` ORDER BY es.shiftdate ASC, es.employeeid ASC`

    const result = await db.query(query, params)

    const shifts = result.rows.map(row => ({
      id: row.id,
      companyId: row.companyid,
      employeeId: row.employeeid,
      employeeName: row.employeename,
      employeeCode: row.employee_code,
      shiftDate: row.shiftdate,
      patternId: row.patternid,
      patternName: row.patternname,
      patternCode: row.patterncode,
      patternLabel: row.patternworkdays && row.patternrestdays
        ? `${row.patternworkdays}x${row.patternrestdays}`
        : null,
      scheduleId: row.scheduleid,
      startTime: row.starttime,
      endTime: row.endtime,
      breakMinutes: row.breakminutes,
      shiftType: row.shifttype,
      notes: row.notes,
      createdBy: row.createdby,
      createdAt: row.createdat,
      updatedAt: row.updatedat
    }))

    return NextResponse.json({
      success: true,
      data: shifts
    })

  } catch (error: any) {
    console.error('Error fetching employee shifts:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No company ID' }, { status: 401 })
    }

    const cookieStore = await cookies()
    const userId = cookieStore.get('user-id')?.value

    const body = await request.json()
    const { employeeId, shiftDate, patternId, scheduleId, startTime, endTime, breakMinutes, shiftType, notes } = body

    // Validate required fields
    if (!employeeId || !shiftDate) {
      return NextResponse.json(
        { success: false, error: 'Employee ID and shift date are required' },
        { status: 400 }
      )
    }

    // Verify employee exists and belongs to company
    const employeeCheck = await db.query(`
      SELECT id FROM market_employees
      WHERE id = $1 AND company_id = $2
    `, [employeeId, companyId])

    if (employeeCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Validate shiftType
    const validShiftTypes = ['work', 'rest', 'vacation', 'sick', 'leave']
    const finalShiftType = shiftType || 'work'
    if (!validShiftTypes.includes(finalShiftType)) {
      return NextResponse.json(
        { success: false, error: `Invalid shift type. Valid types: ${validShiftTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Insert or update shift (upsert)
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
        shifttype = $9,
        notes = COALESCE($10, market_employee_shifts.notes),
        updatedat = NOW()
      RETURNING *
    `, [
      companyId, employeeId, shiftDate, patternId || null, scheduleId || null,
      startTime || null, endTime || null, breakMinutes || 0, finalShiftType,
      notes || null, userId ? parseInt(userId) : null
    ])

    const row = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        companyId: row.companyid,
        employeeId: row.employeeid,
        shiftDate: row.shiftdate,
        patternId: row.patternid,
        scheduleId: row.scheduleid,
        startTime: row.starttime,
        endTime: row.endtime,
        breakMinutes: row.breakminutes,
        shiftType: row.shifttype,
        notes: row.notes,
        createdBy: row.createdby,
        createdAt: row.createdat,
        updatedAt: row.updatedat
      }
    })

  } catch (error: any) {
    console.error('Error creating employee shift:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No company ID' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const shiftId = searchParams.get('id')

    if (!shiftId) {
      return NextResponse.json(
        { success: false, error: 'Shift ID is required' },
        { status: 400 }
      )
    }

    // Verify shift exists and belongs to company
    const existingCheck = await db.query(`
      SELECT id FROM market_employee_shifts
      WHERE id = $1 AND companyid = $2
    `, [parseInt(shiftId), companyId])

    if (existingCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Shift not found' },
        { status: 404 }
      )
    }

    await db.query(`
      DELETE FROM market_employee_shifts
      WHERE id = $1
    `, [parseInt(shiftId)])

    return NextResponse.json({
      success: true,
      message: 'Shift deleted successfully'
    })

  } catch (error: any) {
    console.error('Error deleting employee shift:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
