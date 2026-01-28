import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

async function getCompanyId() {
  const cookieStore = await cookies()
  const companyId = cookieStore.get('user-company-id')?.value
  return companyId ? parseInt(companyId) : null
}

/**
 * GET /api/market/hr/employees
 * List employees for HR module (simple auth)
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No company ID' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'active'
    const search = searchParams.get('search')

    let query = `
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
        d.name as department_name
      FROM market_employees e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN market_departments d ON e.departmentid = d.id
      WHERE e.company_id = $1
    `

    const params: any[] = [companyId]
    let paramIndex = 2

    if (status !== 'all') {
      query += ` AND e.status = $${paramIndex++}`
      params.push(status)
    }

    if (search) {
      query += ` AND (
        e.employee_code ILIKE $${paramIndex} OR
        u.email ILIKE $${paramIndex} OR
        u.firstname ILIKE $${paramIndex} OR
        u.lastname ILIKE $${paramIndex}
      )`
      params.push(`%${search}%`)
      paramIndex++
    }

    query += ` ORDER BY u.firstname ASC, u.lastname ASC`

    const result = await db.query(query, params)

    return NextResponse.json({
      success: true,
      data: {
        employees: result.rows.map(row => ({
          id: row.id,
          employeeCode: row.employee_code,
          status: row.status,
          departmentId: row.departmentid,
          departmentName: row.department_name,
          hasFaceRegistered: row.hasfaceregistered || false,
          userId: row.user_id,
          fullName: row.fullname,
          firstName: row.firstname,
          lastName: row.lastname,
          email: row.email,
          phone: row.phone
        }))
      }
    })

  } catch (error: any) {
    console.error('Error fetching employees:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
