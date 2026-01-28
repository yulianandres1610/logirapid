import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

// Helper to get company ID from cookie
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
    const status = searchParams.get('status') || 'active'

    let query = `
      SELECT
        d.*,
        e.id as manager_employee_id,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as managername,
        (SELECT COUNT(*) FROM market_employees emp WHERE emp.departmentid = d.id) as employeecount
      FROM market_departments d
      LEFT JOIN market_employees e ON d.managerid = e.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE d.companyid = $1
    `

    const params: any[] = [companyId]

    if (status !== 'all') {
      query += ` AND d.isactive = $2`
      params.push(status === 'active')
    }

    query += ` ORDER BY d.name ASC`

    const result = await db.query(query, params)

    return NextResponse.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        companyId: row.companyid,
        name: row.name,
        code: row.code,
        description: row.description,
        managerId: row.managerid,
        managerName: row.managername,
        isActive: row.isactive,
        employeeCount: parseInt(row.employeecount) || 0,
        createdAt: row.createdat,
        updatedAt: row.updatedat
      }))
    })

  } catch (error: any) {
    console.error('Error fetching departments:', error)
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
    const { name, code, description, managerId } = body

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Department name is required' },
        { status: 400 }
      )
    }

    const result = await db.query(`
      INSERT INTO market_departments (companyid, name, code, description, managerid)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [companyId, name, code || null, description || null, managerId || null])

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
    console.error('Error creating department:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
