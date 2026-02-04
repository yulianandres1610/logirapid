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
      JOIN market_employees e ON c.employeeid = e.id
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN market_departments d ON c.departmentid = d.id
      LEFT JOIN market_schedules s ON c.scheduleid = s.id
      WHERE c.companyid = $1
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
      query += ` AND c.employeeid = $${paramCount}`
      params.push(employeeId)
    }

    if (departmentId) {
      paramCount++
      query += ` AND c.departmentid = $${paramCount}`
      params.push(departmentId)
    }

    query += ` ORDER BY c.createdat DESC`

    const result = await db.query(query, params)

    return NextResponse.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        companyId: row.companyid,
        employeeId: row.employeeid,
        employeeName: row.employee_name,
        employeeCode: row.employee_code,
        contractNumber: row.contractnumber,
        contractType: row.contracttype,
        startDate: row.startdate,
        endDate: row.enddate,
        payType: row.paytype,
        payRate: parseFloat(row.payrate),
        currency: row.currency,
        commissionRate: parseFloat(row.commissionrate) || 0,
        departmentId: row.departmentid,
        departmentName: row.department_name,
        scheduleId: row.scheduleid,
        scheduleName: row.schedule_name,
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
    // Note: market_employees uses company_id (with underscore)
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
        SELECT COUNT(*) as count FROM market_contracts WHERE companyid = $1
      `, [companyId])
      const count = parseInt(countResult.rows[0].count) + 1
      finalContractNumber = `CONT-${year}-${String(count).padStart(5, '0')}`
    }

    // Terminate any existing active contract for this employee
    await db.query(`
      UPDATE market_contracts
      SET status = 'terminated', terminationdate = $1, updatedat = NOW()
      WHERE employeeid = $2 AND companyid = $3 AND status = 'active'
    `, [startDate, employeeId, companyId])

    // Create new contract
    const result = await db.query(`
      INSERT INTO market_contracts (
        companyid, employeeid, contractnumber, contracttype,
        startdate, enddate, paytype, payrate, currency,
        commissionrate, departmentid, scheduleid, position, notes,
        photourl, photooriginalurl, photoprocessedat
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
    // Note: market_employees uses departmentid (no underscore for this column) but updated_at (with underscore)
    if (departmentId) {
      await db.query(`
        UPDATE market_employees SET departmentid = $1, updated_at = NOW()
        WHERE id = $2
      `, [departmentId, employeeId])
    }

    const row = result.rows[0]

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
        notes: row.notes,
        photoUrl: row.photourl,
        photoOriginalUrl: row.photooriginalurl,
        photoProcessedAt: row.photoprocessedat,
        createdAt: row.createdat,
        updatedAt: row.updatedat
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
