import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

async function getCompanyId() {
  const cookieStore = await cookies()
  const companyId = cookieStore.get('user-company-id')?.value
  return companyId ? parseInt(companyId) : null
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

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
      SELECT * FROM market_schedules
      WHERE id = $1 AND companyid = $2
    `, [id, companyId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      )
    }

    const row = result.rows[0]

    // Get schedule days
    const daysResult = await db.query(`
      SELECT * FROM market_schedule_days
      WHERE scheduleid = $1
      ORDER BY dayofweek ASC
    `, [id])

    // Get contracts using this schedule
    const contractsResult = await db.query(`
      SELECT
        c.id, c.contractnumber, c.position,
        COALESCE(e.firstname || ' ' || e.lastname, u.email) as employeename
      FROM market_contracts c
      JOIN market_employees e ON c.employeeid = e.id
      LEFT JOIN users u ON e.userid = u.id
      WHERE c.scheduleid = $1 AND c.status = 'active'
      ORDER BY employeename ASC
    `, [id])

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        companyId: row.companyid,
        name: row.name,
        weeklyHours: parseFloat(row.weeklyhours),
        isFlexible: row.isflexible,
        isActive: row.isactive,
        createdAt: row.createdat,
        updatedAt: row.updatedat,
        days: daysResult.rows.map(day => ({
          id: day.id,
          dayOfWeek: day.dayofweek,
          dayName: DAY_NAMES[day.dayofweek],
          startTime: day.starttime,
          endTime: day.endtime,
          breakMinutes: day.breakminutes,
          isWorkDay: day.isworkday
        })),
        contracts: contractsResult.rows.map(c => ({
          id: c.id,
          contractNumber: c.contractnumber,
          position: c.position,
          employeeName: c.employeename
        }))
      }
    })

  } catch (error: any) {
    console.error('Error fetching schedule:', error)
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
    const { name, weeklyHours, isFlexible, isActive, days } = body

    await db.transaction(async (client) => {
      // Update schedule
      await client.query(`
        UPDATE market_schedules
        SET
          name = COALESCE($1, name),
          weeklyhours = COALESCE($2, weeklyhours),
          isflexible = COALESCE($3, isflexible),
          isactive = COALESCE($4, isactive),
          updatedat = NOW()
        WHERE id = $5 AND companyid = $6
      `, [name, weeklyHours, isFlexible, isActive, id, companyId])

      // Update days if provided
      if (days && Array.isArray(days)) {
        // Delete existing days
        await client.query(`DELETE FROM market_schedule_days WHERE scheduleid = $1`, [id])

        // Insert new days
        for (const day of days) {
          await client.query(`
            INSERT INTO market_schedule_days (scheduleid, dayofweek, starttime, endtime, breakminutes, isworkday)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            id,
            day.dayOfWeek,
            day.startTime || null,
            day.endTime || null,
            day.breakMinutes || 60,
            day.isWorkDay !== false
          ])
        }
      }
    })

    // Fetch updated schedule
    const result = await db.query(`
      SELECT * FROM market_schedules WHERE id = $1
    `, [id])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      )
    }

    const row = result.rows[0]

    const daysResult = await db.query(`
      SELECT * FROM market_schedule_days
      WHERE scheduleid = $1
      ORDER BY dayofweek ASC
    `, [id])

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        companyId: row.companyid,
        name: row.name,
        weeklyHours: parseFloat(row.weeklyhours),
        isFlexible: row.isflexible,
        isActive: row.isactive,
        createdAt: row.createdat,
        updatedAt: row.updatedat,
        days: daysResult.rows.map(day => ({
          id: day.id,
          dayOfWeek: day.dayofweek,
          dayName: DAY_NAMES[day.dayofweek],
          startTime: day.starttime,
          endTime: day.endtime,
          breakMinutes: day.breakminutes,
          isWorkDay: day.isworkday
        }))
      }
    })

  } catch (error: any) {
    console.error('Error updating schedule:', error)
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

    // Check if schedule is in use
    const contractsCheck = await db.query(`
      SELECT COUNT(*) as count FROM market_contracts
      WHERE scheduleid = $1 AND status = 'active'
    `, [id])

    if (parseInt(contractsCheck.rows[0].count) > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete schedule in use by active contracts' },
        { status: 400 }
      )
    }

    // Soft delete
    const result = await db.query(`
      UPDATE market_schedules
      SET isactive = false, updatedat = NOW()
      WHERE id = $1 AND companyid = $2
      RETURNING *
    `, [id, companyId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Schedule deactivated successfully'
    })

  } catch (error: any) {
    console.error('Error deleting schedule:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
