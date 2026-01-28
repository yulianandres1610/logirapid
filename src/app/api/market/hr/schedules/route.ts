import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

async function getCompanyId() {
  const cookieStore = await cookies()
  const companyId = cookieStore.get('user-company-id')?.value
  return companyId ? parseInt(companyId) : null
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

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
        s.*,
        (SELECT COUNT(*) FROM market_contracts c WHERE c.scheduleid = s.id AND c.status = 'active') as contractcount
      FROM market_schedules s
      WHERE s.companyid = $1
    `

    const params: any[] = [companyId]

    if (status !== 'all') {
      query += ` AND s.isactive = $2`
      params.push(status === 'active')
    }

    query += ` ORDER BY s.name ASC`

    const result = await db.query(query, params)

    // Get schedule days for each schedule
    const schedules = await Promise.all(result.rows.map(async (row) => {
      const daysResult = await db.query(`
        SELECT * FROM market_schedule_days
        WHERE scheduleid = $1
        ORDER BY dayofweek ASC
      `, [row.id])

      return {
        id: row.id,
        companyId: row.companyid,
        name: row.name,
        weeklyHours: parseFloat(row.weeklyhours),
        isFlexible: row.isflexible,
        isActive: row.isactive,
        contractCount: parseInt(row.contractcount) || 0,
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
    }))

    return NextResponse.json({
      success: true,
      data: schedules
    })

  } catch (error: any) {
    console.error('Error fetching schedules:', error)
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
    const { name, weeklyHours, isFlexible, days } = body

    if (!name || !weeklyHours) {
      return NextResponse.json(
        { success: false, error: 'Name and weekly hours are required' },
        { status: 400 }
      )
    }

    // Use transaction for atomic creation
    const schedule = await db.transaction(async (client) => {
      // Create schedule
      const scheduleResult = await client.query(`
        INSERT INTO market_schedules (companyid, name, weeklyhours, isflexible)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [companyId, name, weeklyHours, isFlexible || false])

      const scheduleRow = scheduleResult.rows[0]

      // Create schedule days if provided
      if (days && Array.isArray(days) && days.length > 0) {
        for (const day of days) {
          await client.query(`
            INSERT INTO market_schedule_days (scheduleid, dayofweek, starttime, endtime, breakminutes, isworkday)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            scheduleRow.id,
            day.dayOfWeek,
            day.startTime || null,
            day.endTime || null,
            day.breakMinutes || 60,
            day.isWorkDay !== false
          ])
        }
      } else {
        // Create default days (Monday-Friday, 9-18)
        for (let i = 1; i <= 5; i++) {
          await client.query(`
            INSERT INTO market_schedule_days (scheduleid, dayofweek, starttime, endtime, breakminutes, isworkday)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [scheduleRow.id, i, '09:00', '18:00', 60, true])
        }
        // Weekend (non-work days)
        for (const i of [0, 6]) {
          await client.query(`
            INSERT INTO market_schedule_days (scheduleid, dayofweek, starttime, endtime, breakminutes, isworkday)
            VALUES ($1, $2, NULL, NULL, 0, false)
          `, [scheduleRow.id, i])
        }
      }

      return scheduleRow
    })

    // Fetch the created schedule with days
    const daysResult = await db.query(`
      SELECT * FROM market_schedule_days
      WHERE scheduleid = $1
      ORDER BY dayofweek ASC
    `, [schedule.id])

    return NextResponse.json({
      success: true,
      data: {
        id: schedule.id,
        companyId: schedule.companyid,
        name: schedule.name,
        weeklyHours: parseFloat(schedule.weeklyhours),
        isFlexible: schedule.isflexible,
        isActive: schedule.isactive,
        createdAt: schedule.createdat,
        updatedAt: schedule.updatedat,
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
    console.error('Error creating schedule:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
