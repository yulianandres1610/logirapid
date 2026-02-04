import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'
import bcrypt from 'bcryptjs'

async function getCompanyId() {
  const cookieStore = await cookies()
  const companyId = cookieStore.get('user-company-id')?.value
  return companyId ? parseInt(companyId) : null
}

// Helper function to check if employee is a manager or admin
async function isManagerOrAdmin(employeeId: number, companyId: number): Promise<{ isManager: boolean; userRole: string | null }> {
  const result = await db.query(`
    SELECT u.role
    FROM market_employees e
    JOIN users u ON e.user_id = u.id
    WHERE e.id = $1 AND e.company_id = $2
  `, [employeeId, companyId])

  if (result.rows.length === 0) {
    return { isManager: false, userRole: null }
  }

  const userRole = result.rows[0].role
  const isManager = ['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(userRole)
  return { isManager, userRole }
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
    const { method, pin, badgeCode, employeeId, managerPin, targetEmployeeId } = body

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
    let managerData = null

    // MANAGER OVERRIDE: Manager uses their PIN to mark attendance for another employee
    if (method === 'manager_override' && managerPin && targetEmployeeId) {
      // First, find and verify the manager by PIN
      const managersResult = await db.query(`
        SELECT
          e.id, e.employee_code, e.status, e.pos_pin,
          COALESCE(u.firstname || ' ' || u.lastname, u.email) as fullname,
          u.role
        FROM market_employees e
        JOIN users u ON e.user_id = u.id
        WHERE e.company_id = $1 AND e.status = 'active' AND e.pos_pin IS NOT NULL
          AND u.role IN ('MANAGER', 'ADMIN', 'SUPER_ADMIN')
      `, [companyId])

      let manager = null
      for (const mgr of managersResult.rows) {
        if (mgr.pos_pin) {
          const pinMatch = await bcrypt.compare(managerPin, mgr.pos_pin)
          if (pinMatch) {
            manager = mgr
            break
          }
        }
      }

      if (!manager) {
        return NextResponse.json(
          { success: false, error: 'PIN de manager inválido o no tiene permisos de manager' },
          { status: 401 }
        )
      }

      // Now get the target employee data
      const targetResult = await db.query(`
        SELECT
          e.id, e.employee_code, e.status,
          COALESCE(u.firstname || ' ' || u.lastname, u.email) as fullname,
          COALESCE(e.hasfaceregistered, false) as hasfaceregistered
        FROM market_employees e
        LEFT JOIN users u ON e.user_id = u.id
        WHERE e.id = $1 AND e.company_id = $2 AND e.status = 'active'
      `, [targetEmployeeId, companyId])

      if (targetResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Empleado no encontrado o inactivo' },
          { status: 404 }
        )
      }

      employee = targetResult.rows[0]
      managerData = {
        id: manager.id,
        fullName: manager.fullname,
        employeeCode: manager.employee_code,
        role: manager.role
      }
    }
    // FACE RECOGNITION: Primary method for regular employees
    else if (method === 'face' && employeeId) {
      // For face recognition, we need the employee ID from the client-side face match
      const result = await db.query(`
        SELECT
          e.id, e.employee_code, e.status,
          COALESCE(u.firstname || ' ' || u.lastname, u.email) as fullname,
          COALESCE(e.hasfaceregistered, false) as hasfaceregistered
        FROM market_employees e
        LEFT JOIN users u ON e.user_id = u.id
        WHERE e.id = $1 AND e.company_id = $2 AND e.status = 'active'
      `, [employeeId, companyId])

      if (result.rows.length > 0) {
        employee = result.rows[0]
      }
    }
    // PIN METHOD: Only allowed for managers (for their own attendance)
    else if (method === 'pin' && pin) {
      // Verify by PIN - but only for managers
      const result = await db.query(`
        SELECT
          e.id, e.employee_code, e.status, e.pos_pin,
          COALESCE(u.firstname || ' ' || u.lastname, u.email) as fullname,
          COALESCE(e.hasfaceregistered, false) as hasfaceregistered,
          u.role
        FROM market_employees e
        JOIN users u ON e.user_id = u.id
        WHERE e.company_id = $1 AND e.status = 'active' AND e.pos_pin IS NOT NULL
      `, [companyId])

      // Check PIN against each employee (bcrypt compare)
      for (const emp of result.rows) {
        if (emp.pos_pin) {
          const pinMatch = await bcrypt.compare(pin, emp.pos_pin)
          if (pinMatch) {
            // Check if this employee is a manager
            const isManager = ['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(emp.role)
            if (!isManager) {
              return NextResponse.json(
                { success: false, error: 'Solo managers pueden usar PIN. Use reconocimiento facial.' },
                { status: 403 }
              )
            }
            employee = emp
            break
          }
        }
      }
    }
    // BADGE METHOD: Disabled for regular employees (can be enabled for managers if needed)
    else if (method === 'badge' && badgeCode) {
      // Verify by badge code - only for managers
      const result = await db.query(`
        SELECT
          e.id, e.employee_code, e.status,
          COALESCE(u.firstname || ' ' || u.lastname, u.email) as fullname,
          COALESCE(e.hasfaceregistered, false) as hasfaceregistered,
          u.role
        FROM market_employees e
        JOIN users u ON e.user_id = u.id
        WHERE e.company_id = $1 AND e.pos_badge_code = $2 AND e.status = 'active'
      `, [companyId, badgeCode])

      if (result.rows.length > 0) {
        const emp = result.rows[0]
        const isManager = ['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(emp.role)
        if (!isManager) {
          return NextResponse.json(
            { success: false, error: 'Solo managers pueden usar badge. Use reconocimiento facial.' },
            { status: 403 }
          )
        }
        employee = emp
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

    console.log(`[VERIFY-EMPLOYEE] Employee: ${employee.id}, Date: ${today}, Attendance:`,
      attendance ? { checkin: attendance.checkin, checkout: attendance.checkout, status: attendance.status } : null)

    // Format timestamps to ISO strings for consistent client-side parsing
    const todayAttendance = attendance ? {
      checkIn: attendance.checkin ? new Date(attendance.checkin).toISOString() : null,
      checkOut: attendance.checkout ? new Date(attendance.checkout).toISOString() : null,
      status: attendance.status || 'present'
    } : null

    return NextResponse.json({
      success: true,
      data: {
        id: employee.id,
        employeeCode: employee.employee_code,
        fullName: employee.fullname,
        hasFaceRegistered: employee.hasfaceregistered,
        canCheckIn,
        canCheckOut,
        todayAttendance,
        // Include manager data if this was a manager override
        isManagerOverride: !!managerData,
        approvedBy: managerData
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

// GET endpoint to fetch list of active employees (for manager override selection)
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

    // Verify kiosk exists
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

    // Get all active employees for the company
    const result = await db.query(`
      SELECT
        e.id, e.employee_code,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as fullname,
        d.name as department_name,
        COALESCE(e.hasfaceregistered, false) as hasfaceregistered
      FROM market_employees e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN market_departments d ON e.departmentid = d.id
      WHERE e.company_id = $1 AND e.status = 'active'
      ORDER BY fullname ASC
    `, [companyId])

    // Get today's attendance for each employee
    const today = new Date().toISOString().split('T')[0]
    const attendanceResult = await db.query(`
      SELECT employeeid, checkin, checkout, status
      FROM market_attendance
      WHERE companyid = $1 AND date = $2
    `, [companyId, today])

    const attendanceMap = new Map()
    for (const att of attendanceResult.rows) {
      attendanceMap.set(att.employeeid, att)
    }

    const employees = result.rows.map(emp => {
      const attendance = attendanceMap.get(emp.id)
      return {
        id: emp.id,
        employeeCode: emp.employee_code,
        fullName: emp.fullname,
        departmentName: emp.department_name,
        hasFaceRegistered: emp.hasfaceregistered,
        todayAttendance: attendance ? {
          checkIn: attendance.checkin ? new Date(attendance.checkin).toISOString() : null,
          checkOut: attendance.checkout ? new Date(attendance.checkout).toISOString() : null,
          status: attendance.status || 'present'
        } : null,
        canCheckIn: !attendance || !attendance.checkin,
        canCheckOut: attendance && attendance.checkin && !attendance.checkout
      }
    })

    return NextResponse.json({
      success: true,
      data: employees
    })

  } catch (error: any) {
    console.error('Error fetching employees:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
