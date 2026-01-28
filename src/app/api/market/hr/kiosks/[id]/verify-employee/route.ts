import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

async function getCompanyId() {
  const cookieStore = await cookies()
  const companyId = cookieStore.get('user-company-id')?.value
  return companyId ? parseInt(companyId) : null
}

export async function POST(
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
    const { method, pin, badgeCode, employeeId } = body

    // Verify kiosk exists and is active
    const kioskCheck = await db.query(`
      SELECT * FROM market_attendance_kiosks
      WHERE id = $1 AND companyid = $2 AND isactive = true
    `, [id, companyId])

    if (kioskCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Kiosk not found or inactive' },
        { status: 404 }
      )
    }

    // Update kiosk last ping
    await db.query(`
      UPDATE market_attendance_kiosks SET lastping = NOW() WHERE id = $1
    `, [id])

    let employee = null

    if (method === 'pin' && pin) {
      // Verify by PIN
      const result = await db.query(`
        SELECT
          e.id, e.employeecode, e.status,
          COALESCE(e.firstname || ' ' || e.lastname, u.email) as fullname,
          e.hasfaceregistered
        FROM market_employees e
        LEFT JOIN users u ON e.userid = u.id
        WHERE e.companyid = $1 AND e.pin = $2 AND e.status = 'active'
      `, [companyId, pin])

      if (result.rows.length > 0) {
        employee = result.rows[0]
      }
    } else if (method === 'badge' && badgeCode) {
      // Verify by badge code
      const result = await db.query(`
        SELECT
          e.id, e.employeecode, e.status,
          COALESCE(e.firstname || ' ' || e.lastname, u.email) as fullname,
          e.hasfaceregistered
        FROM market_employees e
        LEFT JOIN users u ON e.userid = u.id
        WHERE e.companyid = $1 AND e.badgecode = $2 AND e.status = 'active'
      `, [companyId, badgeCode])

      if (result.rows.length > 0) {
        employee = result.rows[0]
      }
    } else if (method === 'face' && employeeId) {
      // For face recognition, we need the employee ID from the client-side face match
      const result = await db.query(`
        SELECT
          e.id, e.employeecode, e.status,
          COALESCE(e.firstname || ' ' || e.lastname, u.email) as fullname,
          e.hasfaceregistered
        FROM market_employees e
        LEFT JOIN users u ON e.userid = u.id
        WHERE e.id = $1 AND e.companyid = $2 AND e.status = 'active'
      `, [employeeId, companyId])

      if (result.rows.length > 0) {
        employee = result.rows[0]
      }
    }

    if (!employee) {
      return NextResponse.json(
        { success: false, error: 'Empleado no encontrado o credenciales inválidas' },
        { status: 401 }
      )
    }

    // Check today's attendance status
    const today = new Date().toISOString().split('T')[0]
    const attendanceCheck = await db.query(`
      SELECT * FROM market_attendance
      WHERE employeeid = $1 AND date = $2
    `, [employee.id, today])

    const attendance = attendanceCheck.rows[0]
    const canCheckIn = !attendance || !attendance.checkin
    const canCheckOut = attendance && attendance.checkin && !attendance.checkout

    return NextResponse.json({
      success: true,
      data: {
        id: employee.id,
        employeeCode: employee.employeecode,
        fullName: employee.fullname,
        hasFaceRegistered: employee.hasfaceregistered,
        canCheckIn,
        canCheckOut,
        todayAttendance: attendance ? {
          checkIn: attendance.checkin,
          checkOut: attendance.checkout,
          status: attendance.status
        } : null
      }
    })

  } catch (error: any) {
    console.error('Error verifying employee:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
