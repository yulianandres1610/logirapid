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
        k.*,
        w.name as warehousename,
        w.address as warehouseaddress
      FROM market_attendance_kiosks k
      LEFT JOIN market_warehouses w ON k.warehouseid = w.id
      WHERE k.id = $1 AND k.companyid = $2
    `, [id, companyId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Kiosk not found' },
        { status: 404 }
      )
    }

    const row = result.rows[0]

    // Get recent activity
    const recentActivity = await db.query(`
      SELECT
        a.id, a.date, a.checkin, a.checkout, a.checkinmethod,
        COALESCE(u.name, u.email, e.employee_code) as employeename
      FROM market_attendance a
      JOIN market_employees e ON a.employeeid = e.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE a.companyid = $1
      AND (a.checkinmethod = 'kiosk' OR a.checkoutmethod = 'kiosk')
      AND a.date >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY COALESCE(a.checkout, a.checkin) DESC
      LIMIT 20
    `, [companyId])

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        companyId: row.companyid,
        name: row.name,
        location: row.location,
        deviceId: row.deviceid,
        warehouseId: row.warehouseid,
        warehouseName: row.warehousename,
        warehouseAddress: row.warehouseaddress,
        isActive: row.isactive,
        lastPing: row.lastping,
        settings: row.settings,
        createdAt: row.createdat,
        recentActivity: recentActivity.rows.map(a => ({
          id: a.id,
          date: a.date,
          checkIn: a.checkin,
          checkOut: a.checkout,
          method: a.checkinmethod,
          employeeName: a.employeename
        }))
      }
    })

  } catch (error: any) {
    console.error('Error fetching kiosk:', error)
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
    const { name, location, warehouseId, isActive, settings } = body

    const result = await db.query(`
      UPDATE market_attendance_kiosks
      SET
        name = COALESCE($1, name),
        location = $2,
        warehouseid = $3,
        isactive = COALESCE($4, isactive),
        settings = COALESCE($5, settings)
      WHERE id = $6 AND companyid = $7
      RETURNING *
    `, [name, location, warehouseId || null, isActive, settings ? JSON.stringify(settings) : null, id, companyId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Kiosk not found' },
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
        location: row.location,
        deviceId: row.deviceid,
        warehouseId: row.warehouseid,
        isActive: row.isactive,
        settings: row.settings,
        createdAt: row.createdat
      }
    })

  } catch (error: any) {
    console.error('Error updating kiosk:', error)
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

    // Soft delete
    const result = await db.query(`
      UPDATE market_attendance_kiosks
      SET isactive = false
      WHERE id = $1 AND companyid = $2
      RETURNING *
    `, [id, companyId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Kiosk not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Kiosk deactivated successfully'
    })

  } catch (error: any) {
    console.error('Error deleting kiosk:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
