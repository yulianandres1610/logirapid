import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const companyId = cookieStore.get('user-company-id')?.value

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'Sin empresa asignada' }, { status: 403 })
    }

    const result = await db.query(`
      SELECT
        market_province as "marketProvince",
        market_municipality as "marketMunicipality",
        market_address as "marketAddress",
        market_contact_phone as "marketContactPhone",
        market_alternate_phone as "marketAlternatePhone",
        market_delivery_hours as "marketDeliveryHours",
        market_is_active as "marketIsActive"
      FROM companies
      WHERE id = $1
    `, [parseInt(companyId)])

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Empresa no encontrada' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Error getting company config:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener configuración'
    }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies()
    const companyId = cookieStore.get('user-company-id')?.value

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'Sin empresa asignada' }, { status: 403 })
    }

    const body = await request.json()
    const {
      marketProvince,
      marketMunicipality,
      marketAddress,
      marketContactPhone,
      marketAlternatePhone,
      marketDeliveryHours,
      marketIsActive
    } = body

    // First ensure columns exist
    const columns = [
      { name: 'market_province', type: 'VARCHAR(100)' },
      { name: 'market_municipality', type: 'VARCHAR(100)' },
      { name: 'market_address', type: 'VARCHAR(255)' },
      { name: 'market_contact_phone', type: 'VARCHAR(20)' },
      { name: 'market_alternate_phone', type: 'VARCHAR(20)' },
      { name: 'market_delivery_hours', type: 'VARCHAR(50)' },
      { name: 'market_is_active', type: 'BOOLEAN DEFAULT true' }
    ]

    for (const col of columns) {
      try {
        await db.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`)
      } catch {
        // Column may already exist
      }
    }

    await db.query(`
      UPDATE companies SET
        market_province = $1,
        market_municipality = $2,
        market_address = $3,
        market_contact_phone = $4,
        market_alternate_phone = $5,
        market_delivery_hours = $6,
        market_is_active = $7,
        updated_at = NOW()
      WHERE id = $8
    `, [
      marketProvince || null,
      marketMunicipality || null,
      marketAddress || null,
      marketContactPhone || null,
      marketAlternatePhone || null,
      marketDeliveryHours || null,
      marketIsActive !== false,
      parseInt(companyId)
    ])

    return NextResponse.json({
      success: true,
      message: 'Configuración guardada'
    })
  } catch (error) {
    console.error('Error saving company config:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al guardar configuración'
    }, { status: 500 })
  }
}
