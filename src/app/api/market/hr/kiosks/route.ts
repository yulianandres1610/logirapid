import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'
import { randomBytes } from 'crypto'

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
        k.*,
        w.name as warehousename,
        w.address as warehouseaddress
      FROM market_attendance_kiosks k
      LEFT JOIN market_warehouses w ON k.warehouseid = w.id
      WHERE k.companyid = $1
    `

    const params: any[] = [companyId]

    if (status !== 'all') {
      query += ` AND k.isactive = $2`
      params.push(status === 'active')
    }

    query += ` ORDER BY k.name ASC`

    const result = await db.query(query, params)

    return NextResponse.json({
      success: true,
      data: result.rows.map(row => ({
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
        createdAt: row.createdat
      }))
    })

  } catch (error: any) {
    console.error('Error fetching kiosks:', error)
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
    const { name, location, warehouseId, settings } = body

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Kiosk name is required' },
        { status: 400 }
      )
    }

    // Generate unique device ID
    const deviceId = `KIOSK-${randomBytes(8).toString('hex').toUpperCase()}`

    const result = await db.query(`
      INSERT INTO market_attendance_kiosks (companyid, name, location, deviceid, warehouseid, settings)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [companyId, name, location || null, deviceId, warehouseId || null, settings ? JSON.stringify(settings) : null])

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
    console.error('Error creating kiosk:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
