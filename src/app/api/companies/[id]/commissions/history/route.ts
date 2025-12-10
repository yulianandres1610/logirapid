import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/companies/[id]/commissions/history
 *
 * Get commission payment history for a company
 *
 * Query params:
 * - userId: Filter by employee
 * - startDate: Start date (YYYY-MM-DD)
 * - endDate: End date (YYYY-MM-DD)
 * - status: Filter by status (pending, paid, cancelled)
 * - serviceType: Filter by service type
 * - page: Page number (default 1)
 * - limit: Items per page (default 50)
 *
 * Returns:
 * - commissions: Array of paid commissions
 * - totals: Summary totals by role
 * - pagination: Page info
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get auth token
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    // Verify JWT
    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token invalido'
      }, { status: 401 })
    }

    const { id } = await params
    const companyId = parseInt(id)

    if (isNaN(companyId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de empresa invalido'
      }, { status: 400 })
    }

    // Authorization: SUPER_ADMIN can see any company, others only their own
    if (payload.role !== 'SUPER_ADMIN' && payload.companyId !== companyId) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado para ver historial de comisiones de esta empresa'
      }, { status: 403 })
    }

    // Get query params
    const { searchParams } = new URL(request.url)
    const userIdFilter = searchParams.get('userId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const statusFilter = searchParams.get('status')
    const serviceTypeFilter = searchParams.get('serviceType')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Get company info
    const companyResult = await db.query(`
      SELECT id, legalname FROM companies WHERE id = $1
    `, [companyId])

    if (companyResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empresa no encontrada'
      }, { status: 404 })
    }

    const company = companyResult.rows[0]

    // Build query for commission history
    let query = `
      SELECT
        ec.id,
        ec.company_id,
        ec.user_id,
        ec.user_role,
        ec.service_type,
        ec.service_id,
        ec.service_reference,
        ec.product_id,
        ec.product_name,
        ec.product_price,
        ec.commission_type,
        ec.commission_rate,
        ec.commission_amount,
        ec.transaction_id,
        ec.transaction_number,
        ec.status,
        ec.created_at,
        ec.paid_at,
        ec.notes,
        u.firstname || ' ' || u.lastname as user_name,
        u.email as user_email
      FROM employee_commissions ec
      LEFT JOIN users u ON ec.user_id = u.id
      WHERE ec.company_id = $1
    `
    const queryParams: any[] = [companyId]
    let paramIndex = 2

    if (userIdFilter) {
      query += ` AND ec.user_id = $${paramIndex}`
      queryParams.push(parseInt(userIdFilter))
      paramIndex++
    }

    if (startDate) {
      query += ` AND ec.created_at >= $${paramIndex}`
      queryParams.push(startDate)
      paramIndex++
    }

    if (endDate) {
      query += ` AND ec.created_at <= $${paramIndex}::date + interval '1 day'`
      queryParams.push(endDate)
      paramIndex++
    }

    if (statusFilter) {
      query += ` AND ec.status = $${paramIndex}`
      queryParams.push(statusFilter)
      paramIndex++
    }

    if (serviceTypeFilter) {
      query += ` AND ec.service_type = $${paramIndex}`
      queryParams.push(serviceTypeFilter)
      paramIndex++
    }

    // Count total for pagination
    const countQuery = query.replace(
      /SELECT[\s\S]*?FROM employee_commissions/,
      'SELECT COUNT(*) as total FROM employee_commissions'
    )
    const countResult = await db.query(countQuery, queryParams)
    const total = parseInt(countResult.rows[0]?.total || '0')

    // Add ordering and pagination
    query += ` ORDER BY ec.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    queryParams.push(limit, offset)

    const commissionsResult = await db.query(query, queryParams)

    // Calculate totals
    const totalsQuery = `
      SELECT
        SUM(commission_amount) as total_amount,
        COUNT(*) as total_count,
        user_role
      FROM employee_commissions
      WHERE company_id = $1
        AND status = 'paid'
        ${startDate ? `AND created_at >= '${startDate}'` : ''}
        ${endDate ? `AND created_at <= '${endDate}'::date + interval '1 day'` : ''}
      GROUP BY user_role
    `
    const totalsResult = await db.query(totalsQuery, [companyId])

    const totalsByRole: Record<string, { count: number; amount: number }> = {
      DRIVER: { count: 0, amount: 0 },
      USER: { count: 0, amount: 0 },
      MANAGER: { count: 0, amount: 0 },
      ADMIN: { count: 0, amount: 0 }
    }

    let grandTotalAmount = 0
    let grandTotalCount = 0

    totalsResult.rows.forEach(row => {
      const role = row.user_role
      if (totalsByRole[role]) {
        totalsByRole[role] = {
          count: parseInt(row.total_count),
          amount: parseFloat(row.total_amount)
        }
      }
      grandTotalAmount += parseFloat(row.total_amount || 0)
      grandTotalCount += parseInt(row.total_count || 0)
    })

    // Get unique employees
    const employeesQuery = `
      SELECT DISTINCT ec.user_id, u.firstname || ' ' || u.lastname as name
      FROM employee_commissions ec
      JOIN users u ON ec.user_id = u.id
      WHERE ec.company_id = $1
      ORDER BY name
    `
    const employeesResult = await db.query(employeesQuery, [companyId])

    // This month totals
    const thisMonthQuery = `
      SELECT
        SUM(commission_amount) as amount,
        COUNT(*) as count
      FROM employee_commissions
      WHERE company_id = $1
        AND status = 'paid'
        AND created_at >= date_trunc('month', CURRENT_DATE)
    `
    const thisMonthResult = await db.query(thisMonthQuery, [companyId])

    // Format response
    const commissions = commissionsResult.rows.map(c => ({
      id: c.id,
      userId: c.user_id,
      userName: c.user_name,
      userEmail: c.user_email,
      userRole: c.user_role,
      serviceType: c.service_type,
      serviceId: c.service_id,
      serviceReference: c.service_reference,
      productId: c.product_id,
      productName: c.product_name,
      productPrice: c.product_price ? parseFloat(c.product_price) : null,
      commissionType: c.commission_type,
      commissionRate: c.commission_rate ? parseFloat(c.commission_rate) : null,
      commissionAmount: parseFloat(c.commission_amount),
      transactionId: c.transaction_id,
      transactionNumber: c.transaction_number,
      status: c.status,
      createdAt: c.created_at,
      paidAt: c.paid_at,
      notes: c.notes
    }))

    return NextResponse.json({
      success: true,
      data: {
        companyId: company.id,
        companyName: company.legalname,
        commissions,
        totals: {
          grandTotal: {
            count: grandTotalCount,
            amount: grandTotalAmount
          },
          thisMonth: {
            count: parseInt(thisMonthResult.rows[0]?.count || '0'),
            amount: parseFloat(thisMonthResult.rows[0]?.amount || '0')
          },
          byRole: totalsByRole
        },
        employees: employeesResult.rows.map(e => ({
          id: e.user_id,
          name: e.name
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('Error in GET /api/companies/[id]/commissions/history:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 })
  }
}
