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
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    let query = `
      SELECT
        a.*,
        COALESCE(e.firstname || ' ' || e.lastname, u.email) as employeename,
        e.employeecode,
        COALESCE(approver.firstname || ' ' || approver.lastname, approver_u.email) as approvedbyname
      FROM market_attendance a
      JOIN market_employees e ON a.employeeid = e.id
      LEFT JOIN users u ON e.userid = u.id
      LEFT JOIN market_employees approver ON a.approvedby = approver.id
      LEFT JOIN users approver_u ON approver.userid = approver_u.id
      WHERE a.companyid = $1
    `

    const params: any[] = [companyId]
    let paramCount = 1

    if (employeeId) {
      paramCount++
      query += ` AND a.employeeid = $${paramCount}`
      params.push(employeeId)
    }

    if (startDate) {
      paramCount++
      query += ` AND a.date >= $${paramCount}`
      params.push(startDate)
    }

    if (endDate) {
      paramCount++
      query += ` AND a.date <= $${paramCount}`
      params.push(endDate)
    }

    if (status) {
      paramCount++
      query += ` AND a.status = $${paramCount}`
      params.push(status)
    }

    // Count total
    const countResult = await db.query(
      query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as count FROM'),
      params
    )
    const total = parseInt(countResult.rows[0].count)

    // Get paginated results
    query += ` ORDER BY a.date DESC, a.checkin DESC`
    paramCount++
    query += ` LIMIT $${paramCount}`
    params.push(limit)
    paramCount++
    query += ` OFFSET $${paramCount}`
    params.push(offset)

    const result = await db.query(query, params)

    return NextResponse.json({
      success: true,
      data: {
        records: result.rows.map(row => ({
          id: row.id,
          companyId: row.companyid,
          employeeId: row.employeeid,
          employeeName: row.employeename,
          employeeCode: row.employeecode,
          date: row.date,
          checkIn: row.checkin,
          checkOut: row.checkout,
          checkInMethod: row.checkinmethod,
          checkOutMethod: row.checkoutmethod,
          checkInPhotoUrl: row.checkinphotourl,
          checkOutPhotoUrl: row.checkoutphotourl,
          workedHours: row.workedhours ? parseFloat(row.workedhours) : null,
          overtimeHours: row.overtimehours ? parseFloat(row.overtimehours) : 0,
          status: row.status,
          lateMinutes: row.lateminutes || 0,
          earlyDepartureMinutes: row.earlydepartureminutes || 0,
          notes: row.notes,
          approvedBy: row.approvedby,
          approvedByName: row.approvedbyname,
          createdAt: row.createdat,
          updatedAt: row.updatedat
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error: any) {
    console.error('Error fetching attendance:', error)
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

    const body = await request.json()
    const {
      employeeId,
      date,
      checkIn,
      checkOut,
      checkInMethod,
      checkOutMethod,
      status,
      notes
    } = body

    if (!employeeId || !date) {
      return NextResponse.json(
        { success: false, error: 'Employee and date are required' },
        { status: 400 }
      )
    }

    // Calculate worked hours if both check-in and check-out provided
    let workedHours = null
    if (checkIn && checkOut) {
      const inTime = new Date(checkIn)
      const outTime = new Date(checkOut)
      workedHours = (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60)
    }

    // Use upsert to handle existing records
    const result = await db.query(`
      INSERT INTO market_attendance (
        companyid, employeeid, date, checkin, checkout,
        checkinmethod, checkoutmethod, workedhours, status, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (employeeid, date) DO UPDATE SET
        checkin = COALESCE($4, market_attendance.checkin),
        checkout = COALESCE($5, market_attendance.checkout),
        checkinmethod = COALESCE($6, market_attendance.checkinmethod),
        checkoutmethod = COALESCE($7, market_attendance.checkoutmethod),
        workedhours = COALESCE($8, market_attendance.workedhours),
        status = COALESCE($9, market_attendance.status),
        notes = COALESCE($10, market_attendance.notes),
        updatedat = NOW()
      RETURNING *
    `, [
      companyId, employeeId, date, checkIn || null, checkOut || null,
      checkInMethod || 'manual', checkOutMethod || null,
      workedHours, status || 'present', notes || null
    ])

    const row = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        companyId: row.companyid,
        employeeId: row.employeeid,
        date: row.date,
        checkIn: row.checkin,
        checkOut: row.checkout,
        checkInMethod: row.checkinmethod,
        checkOutMethod: row.checkoutmethod,
        workedHours: row.workedhours ? parseFloat(row.workedhours) : null,
        overtimeHours: row.overtimehours ? parseFloat(row.overtimehours) : 0,
        status: row.status,
        notes: row.notes,
        createdAt: row.createdat,
        updatedAt: row.updatedat
      }
    })

  } catch (error: any) {
    console.error('Error creating attendance:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
