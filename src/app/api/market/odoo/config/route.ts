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
        odoo_url as "odooUrl",
        odoo_database as "odooDatabase",
        odoo_username as "odooUsername",
        odoo_api_key as "odooApiKey",
        odoo_enabled as "odooEnabled",
        odoo_sync_frequency as "syncFrequency",
        odoo_sync_direction as "syncDirection",
        odoo_sync_variants as "syncVariants",
        odoo_sync_stock as "syncStock"
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
    console.error('Error getting Odoo config:', error)
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
      url,
      database,
      username,
      apiKey,
      enabled,
      syncFrequency,
      syncDirection,
      syncVariants,
      syncStock
    } = body

    // First ensure columns exist (will fail silently if they already exist)
    try {
      await db.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS odoo_url VARCHAR(255)`)
      await db.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS odoo_database VARCHAR(100)`)
      await db.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS odoo_username VARCHAR(100)`)
      await db.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS odoo_api_key VARCHAR(255)`)
      await db.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS odoo_enabled BOOLEAN DEFAULT false`)
      await db.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS odoo_sync_frequency VARCHAR(20) DEFAULT 'manual'`)
      await db.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS odoo_sync_direction VARCHAR(20) DEFAULT 'both'`)
      await db.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS odoo_sync_variants BOOLEAN DEFAULT true`)
      await db.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS odoo_sync_stock BOOLEAN DEFAULT true`)
    } catch {
      // Columns may already exist
    }

    await db.query(`
      UPDATE companies SET
        odoo_url = $1,
        odoo_database = $2,
        odoo_username = $3,
        odoo_api_key = $4,
        odoo_enabled = $5,
        odoo_sync_frequency = $6,
        odoo_sync_direction = $7,
        odoo_sync_variants = $8,
        odoo_sync_stock = $9
      WHERE id = $10
    `, [
      url || null,
      database || null,
      username || null,
      apiKey || null,
      enabled || false,
      syncFrequency || 'manual',
      syncDirection || 'both',
      syncVariants !== false,
      syncStock !== false,
      parseInt(companyId)
    ])

    return NextResponse.json({
      success: true,
      message: 'Configuración guardada'
    })
  } catch (error) {
    console.error('Error saving Odoo config:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al guardar configuración'
    }, { status: 500 })
  }
}
