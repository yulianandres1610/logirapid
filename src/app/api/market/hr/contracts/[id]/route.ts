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
        c.*,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as employee_name,
        e.employee_code,
        u.email as employee_email,
        d.name as department_name,
        d.code as department_code,
        s.name as schedule_name,
        s.weeklyhours as weekly_hours
      FROM market_contracts c
      JOIN market_employees e ON c.employee_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN market_departments d ON c.department_id = d.id
      LEFT JOIN market_schedules s ON c.schedule_id = s.id
      WHERE c.id = $1 AND c.company_id = $2
    `, [id, companyId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      )
    }

    const row = result.rows[0]

    // Get schedule days if schedule exists
    let scheduleDays = []
    if (row.schedule_id) {
      const daysResult = await db.query(`
        SELECT * FROM market_schedule_days
        WHERE scheduleid = $1
        ORDER BY dayofweek ASC
      `, [row.schedule_id])

      const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
      scheduleDays = daysResult.rows.map(day => ({
        dayOfWeek: day.dayofweek,
        dayName: DAY_NAMES[day.dayofweek],
        startTime: day.starttime,
        endTime: day.endtime,
        breakMinutes: day.breakminutes,
        isWorkDay: day.isworkday
      }))
    }

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        companyId: row.company_id,
        employeeId: row.employee_id,
        employeeName: row.employee_name,
        employeeCode: row.employee_code,
        employeeEmail: row.employee_email,
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
        departmentCode: row.department_code,
        scheduleId: row.schedule_id,
        scheduleName: row.schedule_name,
        weeklyHours: row.weekly_hours ? parseFloat(row.weekly_hours) : null,
        scheduleDays,
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
      }
    })

  } catch (error: any) {
    console.error('Error fetching contract:', error)
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
    const {
      contractType,
      endDate,
      payType,
      payRate,
      currency,
      commissionRate,
      departmentId,
      scheduleId,
      position,
      status,
      terminationDate,
      terminationReason,
      notes,
      photoUrl,
      photoOriginalUrl
    } = body

    const result = await db.query(`
      UPDATE market_contracts
      SET
        contract_type = COALESCE($1, contract_type),
        end_date = $2,
        pay_type = COALESCE($3, pay_type),
        pay_rate = COALESCE($4, pay_rate),
        currency = COALESCE($5, currency),
        commission_rate = COALESCE($6, commission_rate),
        department_id = $7,
        schedule_id = $8,
        position = $9,
        status = COALESCE($10, status),
        termination_date = $11,
        termination_reason = $12,
        notes = $13,
        photo_url = COALESCE($16, photo_url),
        photo_original_url = COALESCE($17, photo_original_url),
        photo_processed_at = CASE WHEN $16 IS NOT NULL THEN NOW() ELSE photo_processed_at END,
        updated_at = NOW()
      WHERE id = $14 AND company_id = $15
      RETURNING *
    `, [
      contractType, endDate, payType, payRate, currency,
      commissionRate, departmentId || null, scheduleId || null,
      position, status, terminationDate, terminationReason,
      notes, id, companyId, photoUrl, photoOriginalUrl
    ])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      )
    }

    const row = result.rows[0]

    // Update employee's department if specified
    // Note: market_employees uses departmentid (no underscore)
    if (departmentId !== undefined) {
      await db.query(`
        UPDATE market_employees SET departmentid = $1, updatedat = NOW()
        WHERE id = $2
      `, [departmentId || null, row.employee_id])
    }

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
        terminationDate: row.termination_date,
        terminationReason: row.termination_reason,
        notes: row.notes,
        photoUrl: row.photo_url,
        photoOriginalUrl: row.photo_original_url,
        photoProcessedAt: row.photo_processed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    })

  } catch (error: any) {
    console.error('Error updating contract:', error)
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

    // Don't actually delete - terminate the contract
    const result = await db.query(`
      UPDATE market_contracts
      SET status = 'terminated', termination_date = CURRENT_DATE, updated_at = NOW()
      WHERE id = $1 AND company_id = $2
      RETURNING *
    `, [id, companyId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Contract terminated successfully'
    })

  } catch (error: any) {
    console.error('Error terminating contract:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
