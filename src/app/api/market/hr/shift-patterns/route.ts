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

    let query = `
      SELECT
        sp.*,
        (SELECT COUNT(*) FROM market_employee_shifts es WHERE es.patternid = sp.id) as usagecount
      FROM market_shift_patterns sp
      WHERE sp.companyid = $1
    `

    const params: any[] = [companyId]

    if (status !== 'all') {
      query += ` AND sp.isactive = $2`
      params.push(status === 'active')
    }

    query += ` ORDER BY sp.name ASC`

    const result = await db.query(query, params)

    const patterns = result.rows.map(row => ({
      id: row.id,
      companyId: row.companyid,
      name: row.name,
      code: row.code,
      description: row.description,
      workDays: row.workdays,
      restDays: row.restdays,
      startTime: row.starttime,
      endTime: row.endtime,
      breakMinutes: row.breakminutes,
      isActive: row.isactive,
      usageCount: parseInt(row.usagecount) || 0,
      createdAt: row.createdat,
      updatedAt: row.updatedat,
      // Display pattern name like "2x2", "4x2", etc.
      patternLabel: `${row.workdays}x${row.restdays}`
    }))

    return NextResponse.json({
      success: true,
      data: patterns
    })

  } catch (error: any) {
    console.error('Error fetching shift patterns:', error)
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
    const { name, code, description, workDays, restDays, startTime, endTime, breakMinutes } = body

    // Validate required fields
    if (!name || !workDays || !restDays || !startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: 'Name, work days, rest days, start time, and end time are required' },
        { status: 400 }
      )
    }

    // Validate work/rest days
    if (workDays < 1 || restDays < 1) {
      return NextResponse.json(
        { success: false, error: 'Work days and rest days must be at least 1' },
        { status: 400 }
      )
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return NextResponse.json(
        { success: false, error: 'Invalid time format. Use HH:MM' },
        { status: 400 }
      )
    }

    // Create the pattern
    const result = await db.query(`
      INSERT INTO market_shift_patterns (
        companyid, name, code, description, workdays, restdays,
        starttime, endtime, breakminutes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      companyId, name, code || null, description || null,
      workDays, restDays, startTime, endTime, breakMinutes || 0
    ])

    const row = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        companyId: row.companyid,
        name: row.name,
        code: row.code,
        description: row.description,
        workDays: row.workdays,
        restDays: row.restdays,
        startTime: row.starttime,
        endTime: row.endtime,
        breakMinutes: row.breakminutes,
        isActive: row.isactive,
        createdAt: row.createdat,
        updatedAt: row.updatedat,
        patternLabel: `${row.workdays}x${row.restdays}`
      }
    })

  } catch (error: any) {
    console.error('Error creating shift pattern:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
