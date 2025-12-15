import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/remittance-recipients
 * Search and list remittance recipients
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    // Ensure table exists
    await ensureTableExists()

    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')
    const search = searchParams.get('search')
    const idNumber = searchParams.get('idNumber')

    let query: string
    let params: any[]

    if (phone) {
      // Search by exact phone
      query = `
        SELECT * FROM remittance_recipients
        WHERE company_id = $1 AND phone = $2
        LIMIT 1
      `
      params = [payload.companyId, phone]
    } else if (idNumber) {
      // Search by ID number
      query = `
        SELECT * FROM remittance_recipients
        WHERE company_id = $1 AND id_number = $2
        LIMIT 1
      `
      params = [payload.companyId, idNumber]
    } else if (search) {
      // Search by name or phone
      query = `
        SELECT * FROM remittance_recipients
        WHERE company_id = $1
          AND (
            full_name ILIKE $2
            OR phone ILIKE $2
            OR id_number ILIKE $2
          )
        ORDER BY updated_at DESC
        LIMIT 20
      `
      params = [payload.companyId, `%${search}%`]
    } else {
      // Get recent recipients
      query = `
        SELECT * FROM remittance_recipients
        WHERE company_id = $1
        ORDER BY updated_at DESC
        LIMIT 50
      `
      params = [payload.companyId]
    }

    const result = await db.query(query, params)

    // Transform to camelCase
    const recipients = result.rows.map(row => ({
      id: row.id,
      fullName: row.full_name,
      phone: row.phone,
      idNumber: row.id_number,
      address: row.address,
      province: row.province,
      municipality: row.municipality,
      neighborhood: row.neighborhood,
      addressReferences: row.address_references,
      latitude: row.latitude ? parseFloat(row.latitude) : null,
      longitude: row.longitude ? parseFloat(row.longitude) : null,
      hasAlternateContact: row.has_alternate_contact,
      alternateContactName: row.alternate_contact_name,
      alternateContactPhone: row.alternate_contact_phone,
      totalOrders: row.total_orders || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))

    return NextResponse.json({
      success: true,
      data: phone || idNumber ? recipients[0] || null : recipients
    })

  } catch (error) {
    console.error('[Remittance Recipients API] GET error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al buscar destinatarios'
    }, { status: 500 })
  }
}

/**
 * POST /api/remittance-recipients
 * Create or update a remittance recipient
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    // Ensure table exists
    await ensureTableExists()

    const body = await request.json()
    const {
      fullName,
      phone,
      idNumber,
      address,
      province,
      municipality,
      neighborhood,
      addressReferences,
      latitude,
      longitude,
      hasAlternateContact,
      alternateContactName,
      alternateContactPhone
    } = body

    // Validate required fields
    if (!fullName || !phone || !province || !municipality) {
      return NextResponse.json({
        success: false,
        error: 'Nombre, teléfono, provincia y municipio son requeridos'
      }, { status: 400 })
    }

    // Check if recipient already exists by phone
    const existingResult = await db.query(`
      SELECT id FROM remittance_recipients
      WHERE company_id = $1 AND phone = $2
    `, [payload.companyId, phone])

    let result
    if (existingResult.rows.length > 0) {
      // Update existing recipient
      const recipientId = existingResult.rows[0].id
      result = await db.query(`
        UPDATE remittance_recipients
        SET
          full_name = $1,
          id_number = $2,
          address = $3,
          province = $4,
          municipality = $5,
          neighborhood = $6,
          address_references = $7,
          latitude = $8,
          longitude = $9,
          has_alternate_contact = $10,
          alternate_contact_name = $11,
          alternate_contact_phone = $12,
          updated_at = NOW()
        WHERE id = $13
        RETURNING *
      `, [
        fullName, idNumber || null, address || null,
        province, municipality, neighborhood || null,
        addressReferences || null, latitude || null, longitude || null,
        hasAlternateContact || false, alternateContactName || null,
        alternateContactPhone || null, recipientId
      ])
    } else {
      // Create new recipient
      result = await db.query(`
        INSERT INTO remittance_recipients (
          company_id, full_name, phone, id_number,
          address, province, municipality, neighborhood, address_references,
          latitude, longitude,
          has_alternate_contact, alternate_contact_name, alternate_contact_phone,
          created_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW()
        )
        RETURNING *
      `, [
        payload.companyId, fullName, phone, idNumber || null,
        address || null, province, municipality, neighborhood || null,
        addressReferences || null, latitude || null, longitude || null,
        hasAlternateContact || false, alternateContactName || null,
        alternateContactPhone || null, payload.userId
      ])
    }

    const row = result.rows[0]
    const recipient = {
      id: row.id,
      fullName: row.full_name,
      phone: row.phone,
      idNumber: row.id_number,
      address: row.address,
      province: row.province,
      municipality: row.municipality,
      neighborhood: row.neighborhood,
      addressReferences: row.address_references,
      latitude: row.latitude ? parseFloat(row.latitude) : null,
      longitude: row.longitude ? parseFloat(row.longitude) : null,
      hasAlternateContact: row.has_alternate_contact,
      alternateContactName: row.alternate_contact_name,
      alternateContactPhone: row.alternate_contact_phone
    }

    return NextResponse.json({
      success: true,
      data: recipient,
      message: existingResult.rows.length > 0 ? 'Destinatario actualizado' : 'Destinatario guardado'
    })

  } catch (error) {
    console.error('[Remittance Recipients API] POST error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al guardar destinatario'
    }, { status: 500 })
  }
}

/**
 * Ensure the remittance_recipients table exists
 */
async function ensureTableExists() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS remittance_recipients (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL,

      -- Basic info
      full_name VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      id_number VARCHAR(50),

      -- Address in Cuba
      address TEXT,
      province VARCHAR(100) NOT NULL,
      municipality VARCHAR(100) NOT NULL,
      neighborhood VARCHAR(255),
      address_references TEXT,

      -- Coordinates
      latitude DECIMAL(10,8),
      longitude DECIMAL(11,8),

      -- Alternate contact
      has_alternate_contact BOOLEAN DEFAULT false,
      alternate_contact_name VARCHAR(255),
      alternate_contact_phone VARCHAR(50),

      -- Stats
      total_orders INTEGER DEFAULT 0,

      -- Metadata
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),

      -- Unique constraint per company
      UNIQUE(company_id, phone)
    )
  `)

  // Create indexes
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_remittance_recipients_company ON remittance_recipients(company_id);
    CREATE INDEX IF NOT EXISTS idx_remittance_recipients_phone ON remittance_recipients(phone);
    CREATE INDEX IF NOT EXISTS idx_remittance_recipients_search ON remittance_recipients(full_name, phone);
  `)
}
