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
        d.*,
        e.id as manager_employee_id,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as managername
      FROM market_departments d
      LEFT JOIN market_employees e ON d.managerid = e.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE d.id = $1 AND d.companyid = $2
    `, [id, companyId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Department not found' },
        { status: 404 }
      )
    }

    const row = result.rows[0]

    // Get employees in this department
    const employeesResult = await db.query(`
      SELECT
        e.id, e.employee_code, e.user_id,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as fullname,
        e.status
      FROM market_employees e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.departmentid = $1 AND e.company_id = $2
      ORDER BY fullname ASC
    `, [id, companyId])

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        companyId: row.companyid,
        name: row.name,
        code: row.code,
        description: row.description,
        managerId: row.managerid,
        managerName: row.managername,
        isActive: row.isactive,
        createdAt: row.createdat,
        updatedAt: row.updatedat,
        employees: employeesResult.rows.map(emp => ({
          id: emp.id,
          employeeCode: emp.employee_code,
          fullName: emp.fullname,
          status: emp.status
        }))
      }
    })

  } catch (error: any) {
    console.error('Error fetching department:', error)
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
    const { name, code, description, managerId, isActive } = body

    const result = await db.query(`
      UPDATE market_departments
      SET
        name = COALESCE($1, name),
        code = COALESCE($2, code),
        description = COALESCE($3, description),
        managerid = $4,
        isactive = COALESCE($5, isactive),
        updatedat = NOW()
      WHERE id = $6 AND companyid = $7
      RETURNING *
    `, [name, code, description, managerId || null, isActive, id, companyId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Department not found' },
        { status: 404 }
      )
    }

    const row = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        companyId: row.companyid,
        name: row.name,
        code: row.code,
        description: row.description,
        managerId: row.managerid,
        isActive: row.isactive,
        createdAt: row.createdat,
        updatedAt: row.updatedat
      }
    })

  } catch (error: any) {
    console.error('Error updating department:', error)
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

    // Check if department has employees
    const employeesCheck = await db.query(`
      SELECT COUNT(*) as count FROM market_employees
      WHERE departmentid = $1 AND company_id = $2
    `, [id, companyId])

    if (parseInt(employeesCheck.rows[0].count) > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete department with employees. Remove employees first or reassign them.' },
        { status: 400 }
      )
    }

    // Soft delete - set isactive to false
    const result = await db.query(`
      UPDATE market_departments
      SET isactive = false, updatedat = NOW()
      WHERE id = $1 AND companyid = $2
      RETURNING *
    `, [id, companyId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Department not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Department deactivated successfully'
    })

  } catch (error: any) {
    console.error('Error deleting department:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
