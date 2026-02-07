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
    const patternId = parseInt(id)

    const result = await db.query(`
      SELECT
        sp.*,
        (SELECT COUNT(*) FROM market_employee_shifts es WHERE es.patternid = sp.id) as usagecount
      FROM market_shift_patterns sp
      WHERE sp.id = $1 AND sp.companyid = $2
    `, [patternId, companyId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Shift pattern not found' },
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
        workDays: row.workdays,
        restDays: row.restdays,
        startTime: row.starttime,
        endTime: row.endtime,
        breakMinutes: row.breakminutes,
        isActive: row.isactive,
        usageCount: parseInt(row.usagecount) || 0,
        createdAt: row.createdat,
        updatedAt: row.updatedat,
        patternLabel: `${row.workdays}x${row.restdays}`
      }
    })

  } catch (error: any) {
    console.error('Error fetching shift pattern:', error)
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
    const patternId = parseInt(id)
    const body = await request.json()

    // Check if pattern exists and belongs to company
    const existingCheck = await db.query(`
      SELECT id FROM market_shift_patterns
      WHERE id = $1 AND companyid = $2
    `, [patternId, companyId])

    if (existingCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Shift pattern not found' },
        { status: 404 }
      )
    }

    const { name, code, description, workDays, restDays, startTime, endTime, breakMinutes, isActive } = body

    // Build dynamic update query
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(name)
    }
    if (code !== undefined) {
      updates.push(`code = $${paramIndex++}`)
      values.push(code)
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(description)
    }
    if (workDays !== undefined) {
      if (workDays < 1) {
        return NextResponse.json(
          { success: false, error: 'Work days must be at least 1' },
          { status: 400 }
        )
      }
      updates.push(`workdays = $${paramIndex++}`)
      values.push(workDays)
    }
    if (restDays !== undefined) {
      if (restDays < 1) {
        return NextResponse.json(
          { success: false, error: 'Rest days must be at least 1' },
          { status: 400 }
        )
      }
      updates.push(`restdays = $${paramIndex++}`)
      values.push(restDays)
    }
    if (startTime !== undefined) {
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
      if (!timeRegex.test(startTime)) {
        return NextResponse.json(
          { success: false, error: 'Invalid start time format. Use HH:MM' },
          { status: 400 }
        )
      }
      updates.push(`starttime = $${paramIndex++}`)
      values.push(startTime)
    }
    if (endTime !== undefined) {
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
      if (!timeRegex.test(endTime)) {
        return NextResponse.json(
          { success: false, error: 'Invalid end time format. Use HH:MM' },
          { status: 400 }
        )
      }
      updates.push(`endtime = $${paramIndex++}`)
      values.push(endTime)
    }
    if (breakMinutes !== undefined) {
      updates.push(`breakminutes = $${paramIndex++}`)
      values.push(breakMinutes)
    }
    if (isActive !== undefined) {
      updates.push(`isactive = $${paramIndex++}`)
      values.push(isActive)
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      )
    }

    updates.push(`updatedat = NOW()`)
    values.push(patternId)

    const result = await db.query(`
      UPDATE market_shift_patterns
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values)

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
    console.error('Error updating shift pattern:', error)
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
    const patternId = parseInt(id)

    // Check if pattern exists and belongs to company
    const existingCheck = await db.query(`
      SELECT id FROM market_shift_patterns
      WHERE id = $1 AND companyid = $2
    `, [patternId, companyId])

    if (existingCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Shift pattern not found' },
        { status: 404 }
      )
    }

    // Check if pattern is in use
    const usageCheck = await db.query(`
      SELECT COUNT(*) as count FROM market_employee_shifts
      WHERE patternid = $1
    `, [patternId])

    if (parseInt(usageCheck.rows[0].count) > 0) {
      // Soft delete - just deactivate
      await db.query(`
        UPDATE market_shift_patterns
        SET isactive = false, updatedat = NOW()
        WHERE id = $1
      `, [patternId])

      return NextResponse.json({
        success: true,
        message: 'Pattern deactivated (in use by employee shifts)'
      })
    }

    // Hard delete if not in use
    await db.query(`
      DELETE FROM market_shift_patterns
      WHERE id = $1
    `, [patternId])

    return NextResponse.json({
      success: true,
      message: 'Shift pattern deleted successfully'
    })

  } catch (error: any) {
    console.error('Error deleting shift pattern:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
