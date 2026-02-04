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
    const status = searchParams.get('status') || 'active'
    const employeeId = searchParams.get('employeeId')
    const departmentId = searchParams.get('departmentId')

    let query = `
      SELECT
        c.*,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as employee_name,
        e.employee_code,
        d.name as department_name,
        s.name as schedule_name
      FROM market_contracts c
      JOIN market_employees e ON c.employee_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN market_departments d ON c.department_id = d.id
      LEFT JOIN market_schedules s ON c.schedule_id = s.id
      WHERE c.company_id = $1
    `

    const params: any[] = [companyId]
    let paramCount = 1

    if (status !== 'all') {
      paramCount++
      query += ` AND c.status = $${paramCount}`
      params.push(status)
    }

    if (employeeId) {
      paramCount++
      query += ` AND c.employee_id = $${paramCount}`
      params.push(employeeId)
    }

    if (departmentId) {
      paramCount++
      query += ` AND c.department_id = $${paramCount}`
      params.push(departmentId)
    }

    query += ` ORDER BY c.created_at DESC`

    const result = await db.query(query, params)

    return NextResponse.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        companyId: row.company_id,
        employeeId: row.employee_id,
        employeeName: row.employee_name,
        employeeCode: row.employee_code,
        contractNumber: row.contract_number,
        contractType: row.contract_type,
        startDate: row.start_date,
        endDate: row.end_date,
        payType: row.pay_type,
        payRate: parseFloat(row.pay_rate),
        currency: row.currency,
        commissionRate: parseFloat(row.commission_rate) || 0,
        departmentId: row.department_id,
        departmentName: row.department_name,
        scheduleId: row.schedule_id,
        scheduleName: row.schedule_name,
        position: row.position,
        status: row.status,
        terminationDate: row.termination_date,
        terminationReason: row.termination_reason,
        notes: row.notes,
        photoUrl: row.photo_url,
        photoOriginalUrl: row.photo_original_url,
        photoProcessedAt: row.photo_processed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    })

  } catch (error: any) {
    console.error('Error fetching contracts:', error)
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
      contractNumber,
      contractType,
      startDate,
      endDate,
      payType,
      payRate,
      currency,
      commissionRate,
      departmentId,
      scheduleId,
      position,
      notes,
      photoUrl,
      photoOriginalUrl
    } = body

    if (!employeeId || !contractType || !startDate || !payType || !payRate) {
      return NextResponse.json(
        { success: false, error: 'Employee, contract type, start date, pay type, and pay rate are required' },
        { status: 400 }
      )
    }

    // Check if employee exists and belongs to company
    const employeeCheck = await db.query(`
      SELECT id FROM market_employees WHERE id = $1 AND company_id = $2
    `, [employeeId, companyId])

    if (employeeCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Generate contract number if not provided
    let finalContractNumber = contractNumber
    if (!finalContractNumber) {
      const year = new Date().getFullYear()
      const countResult = await db.query(`
        SELECT COUNT(*) as count FROM market_contracts WHERE company_id = $1
      `, [companyId])
      const count = parseInt(countResult.rows[0].count) + 1
      finalContractNumber = `CONT-${year}-${String(count).padStart(5, '0')}`
    }

    // Terminate any existing active contract for this employee
    await db.query(`
      UPDATE market_contracts
      SET status = 'terminated', termination_date = $1, updated_at = NOW()
      WHERE employee_id = $2 AND company_id = $3 AND status = 'active'
    `, [startDate, employeeId, companyId])

    // Create new contract
    const result = await db.query(`
      INSERT INTO market_contracts (
        company_id, employee_id, contract_number, contract_type,
        start_date, end_date, pay_type, pay_rate, currency,
        commission_rate, department_id, schedule_id, position, notes,
        photo_url, photo_original_url, photo_processed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `, [
      companyId, employeeId, finalContractNumber, contractType,
      startDate, endDate || null, payType, payRate, currency || 'USD',
      commissionRate || 0, departmentId || null, scheduleId || null,
      position || null, notes || null,
      photoUrl || null, photoOriginalUrl || null, photoUrl ? new Date() : null
    ])

    // Update employee's department if specified
    // Note: market_employees uses departmentid (no underscore)
    if (departmentId) {
      await db.query(`
        UPDATE market_employees SET departmentid = $1, updatedat = NOW()
        WHERE id = $2
      `, [departmentId, employeeId])
    }

    const row = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        companyId: row.company_id,
        employeeId: row.employee_id,
        contractNumber: row.contract_number,
        contractType: row.contract_type,
        startDate: row.start_date,
        endDate: row.end_date,
        payType: row.pay_type,
        payRate: parseFloat(row.pay_rate),
        currency: row.currency,
        commissionRate: parseFloat(row.commission_rate) || 0,
        departmentId: row.department_id,
        scheduleId: row.schedule_id,
        position: row.position,
        status: row.status,
        notes: row.notes,
        photoUrl: row.photo_url,
        photoOriginalUrl: row.photo_original_url,
        photoProcessedAt: row.photo_processed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    })

  } catch (error: any) {
    console.error('Error creating contract:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
