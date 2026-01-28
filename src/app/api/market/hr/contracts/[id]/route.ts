import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

async function getCompanyId() {
  const cookieStore = await cookies()
  const companyId = cookieStore.get('user-company-id')?.value
  return companyId ? parseInt(companyId) : null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No company ID' }, { status: 401 })
    }

    const { id } = await params

    const result = await db.query(`
      SELECT
        c.*,
        COALESCE(e.firstname || ' ' || e.lastname, u.email) as employeename,
        e.employeecode,
        u.email as employeeemail,
        d.name as departmentname,
        d.code as departmentcode,
        s.name as schedulename,
        s.weeklyhours
      FROM market_contracts c
      JOIN market_employees e ON c.employeeid = e.id
      LEFT JOIN users u ON e.userid = u.id
      LEFT JOIN market_departments d ON c.departmentid = d.id
      LEFT JOIN market_schedules s ON c.scheduleid = s.id
      WHERE c.id = $1 AND c.companyid = $2
    `, [id, companyId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      )
    }

    const row = result.rows[0]

    // Get schedule days if schedule exists
    let scheduleDays = []
    if (row.scheduleid) {
      const daysResult = await db.query(`
        SELECT * FROM market_schedule_days
        WHERE scheduleid = $1
        ORDER BY dayofweek ASC
      `, [row.scheduleid])

      const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
      scheduleDays = daysResult.rows.map(day => ({
        dayOfWeek: day.dayofweek,
        dayName: DAY_NAMES[day.dayofweek],
        startTime: day.starttime,
        endTime: day.endtime,
        breakMinutes: day.breakminutes,
        isWorkDay: day.isworkday
      }))
    }

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        companyId: row.companyid,
        employeeId: row.employeeid,
        employeeName: row.employeename,
        employeeCode: row.employeecode,
        employeeEmail: row.employeeemail,
        contractNumber: row.contractnumber,
        contractType: row.contracttype,
        startDate: row.startdate,
        endDate: row.enddate,
        payType: row.paytype,
        payRate: parseFloat(row.payrate),
        currency: row.currency,
        commissionRate: parseFloat(row.commissionrate) || 0,
        departmentId: row.departmentid,
        departmentName: row.departmentname,
        departmentCode: row.departmentcode,
        scheduleId: row.scheduleid,
        scheduleName: row.schedulename,
        weeklyHours: row.weeklyhours ? parseFloat(row.weeklyhours) : null,
        scheduleDays,
        position: row.position,
        status: row.status,
        terminationDate: row.terminationdate,
        terminationReason: row.terminationreason,
        notes: row.notes,
        photoUrl: row.photourl,
        photoOriginalUrl: row.photooriginalurl,
        photoProcessedAt: row.photoprocessedat,
        createdAt: row.createdat,
        updatedAt: row.updatedat
      }
    })

  } catch (error: any) {
    console.error('Error fetching contract:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No company ID' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const {
      contractType,
      endDate,
      payType,
      payRate,
      currency,
      commissionRate,
      departmentId,
      scheduleId,
      position,
      status,
      terminationDate,
      terminationReason,
      notes,
      photoUrl,
      photoOriginalUrl
    } = body

    const result = await db.query(`
      UPDATE market_contracts
      SET
        contracttype = COALESCE($1, contracttype),
        enddate = $2,
        paytype = COALESCE($3, paytype),
        payrate = COALESCE($4, payrate),
        currency = COALESCE($5, currency),
        commissionrate = COALESCE($6, commissionrate),
        departmentid = $7,
        scheduleid = $8,
        position = $9,
        status = COALESCE($10, status),
        terminationdate = $11,
        terminationreason = $12,
        notes = $13,
        photourl = COALESCE($16, photourl),
        photooriginalurl = COALESCE($17, photooriginalurl),
        photoprocessedat = CASE WHEN $16 IS NOT NULL THEN NOW() ELSE photoprocessedat END,
        updatedat = NOW()
      WHERE id = $14 AND companyid = $15
      RETURNING *
    `, [
      contractType, endDate, payType, payRate, currency,
      commissionRate, departmentId || null, scheduleId || null,
      position, status, terminationDate, terminationReason,
      notes, id, companyId, photoUrl, photoOriginalUrl
    ])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      )
    }

    const row = result.rows[0]

    // Update employee's department if specified
    if (departmentId !== undefined) {
      await db.query(`
        UPDATE market_employees SET departmentid = $1, updatedat = NOW()
        WHERE id = $2
      `, [departmentId || null, row.employeeid])
    }

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        companyId: row.companyid,
        employeeId: row.employeeid,
        contractNumber: row.contractnumber,
        contractType: row.contracttype,
        startDate: row.startdate,
        endDate: row.enddate,
        payType: row.paytype,
        payRate: parseFloat(row.payrate),
        currency: row.currency,
        commissionRate: parseFloat(row.commissionrate) || 0,
        departmentId: row.departmentid,
        scheduleId: row.scheduleid,
        position: row.position,
        status: row.status,
        terminationDate: row.terminationdate,
        terminationReason: row.terminationreason,
        notes: row.notes,
        photoUrl: row.photourl,
        photoOriginalUrl: row.photooriginalurl,
        photoProcessedAt: row.photoprocessedat,
        createdAt: row.createdat,
        updatedAt: row.updatedat
      }
    })

  } catch (error: any) {
    console.error('Error updating contract:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No company ID' }, { status: 401 })
    }

    const { id } = await params

    // Don't actually delete - terminate the contract
    const result = await db.query(`
      UPDATE market_contracts
      SET status = 'terminated', terminationdate = CURRENT_DATE, updatedat = NOW()
      WHERE id = $1 AND companyid = $2
      RETURNING *
    `, [id, companyId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Contract terminated successfully'
    })

  } catch (error: any) {
    console.error('Error terminating contract:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
