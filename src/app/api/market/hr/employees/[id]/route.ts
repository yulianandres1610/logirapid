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
        e.id,
        e.employee_code,
        e.status,
        e.departmentid,
        e.hasfaceregistered,
        e.user_id,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as fullname,
        u.firstname,
        u.lastname,
        u.email,
        u.phone,
        d.name as department_name,
        (SELECT c.position FROM market_contracts c WHERE c.employeeid = e.id AND c.status = 'active' LIMIT 1) as position
      FROM market_employees e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN market_departments d ON e.departmentid = d.id
      WHERE e.id = $1 AND e.company_id = $2
    `, [id, companyId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      )
    }

    const row = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        employee_code: row.employee_code,
        status: row.status,
        position: row.position,
        departmentId: row.departmentid,
        departmentName: row.department_name,
        hasFaceRegistered: row.hasfaceregistered || false,
        userId: row.user_id,
        fullname: row.fullname,
        firstname: row.firstname,
        lastname: row.lastname,
        email: row.email,
        phone: row.phone
      }
    })

  } catch (error: any) {
    console.error('Error fetching employee:', error)
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
    const { status, departmentId } = body

    // Build update query dynamically
    // Note: position is stored in contracts table, not employees
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`)
      values.push(status)
    }

    if (departmentId !== undefined) {
      updates.push(`departmentid = $${paramIndex++}`)
      values.push(departmentId)
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      )
    }

    updates.push(`updatedat = NOW()`)
    values.push(id, companyId)

    const result = await db.query(`
      UPDATE market_employees
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex++} AND company_id = $${paramIndex}
      RETURNING *
    `, values)

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Employee updated successfully'
    })

  } catch (error: any) {
    console.error('Error updating employee:', error)
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

    // Soft delete - set status to inactive
    const result = await db.query(`
      UPDATE market_employees
      SET status = 'inactive', updated_at = NOW()
      WHERE id = $1 AND company_id = $2
      RETURNING id
    `, [id, companyId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Employee deactivated successfully'
    })

  } catch (error: any) {
    console.error('Error deactivating employee:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
