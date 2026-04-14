import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload { userId: number; email: string; role: string; companyId: number }

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  try { return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as JWTPayload } catch { return null }
}

const PLATFORMS = ['facebook', 'instagram', 'whatsapp', 'telegram']

const PLATFORM_FIELDS: Record<string, string[]> = {
  facebook: ['access_token', 'page_id', 'cookies'],
  instagram: ['session_id', 'cookies'],
  whatsapp: ['phone_number', 'session_data'],
  telegram: ['bot_token', 'api_id', 'api_hash']
}

function maskValue(value: string): string {
  if (!value || value.length <= 4) return '****'
  return '*'.repeat(value.length - 4) + value.slice(-4)
}

export async function GET() {
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    const result = await db.query(`
      SELECT platform, credentials, status, last_verified_at, updated_at
      FROM mkt_platform_credentials
      WHERE company_id = $1
    `, [payload.companyId])

    const credsByPlatform: Record<string, any> = {}
    for (const row of result.rows) {
      credsByPlatform[row.platform] = row
    }

    const platforms = PLATFORMS.map(platform => {
      const row = credsByPlatform[platform]
      const fields = PLATFORM_FIELDS[platform] || []

      if (!row) {
        return {
          platform,
          configured: false,
          status: null,
          lastVerified: null,
          fields: {}
        }
      }

      const creds = row.credentials || {}
      const maskedFields: Record<string, string> = {}
      for (const field of fields) {
        if (creds[field]) {
          maskedFields[field] = maskValue(String(creds[field]))
        }
      }

      return {
        platform,
        configured: fields.some(f => !!creds[f]),
        status: row.status,
        lastVerified: row.last_verified_at,
        updatedAt: row.updated_at,
        fields: maskedFields
      }
    })

    return NextResponse.json({ success: true, data: { platforms } })
  } catch (error) {
    console.error('[MKT Settings Integrations GET]', error)
    return NextResponse.json({ success: false, error: 'Error al obtener integraciones' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    const body = await request.json()
    const { platform, credentials } = body

    if (!platform || !PLATFORMS.includes(platform)) {
      return NextResponse.json({ success: false, error: 'Plataforma invalida' }, { status: 400 })
    }

    if (!credentials || typeof credentials !== 'object') {
      return NextResponse.json({ success: false, error: 'Credenciales requeridas' }, { status: 400 })
    }

    // Filter only allowed fields
    const allowedFields = PLATFORM_FIELDS[platform] || []
    const cleanCreds: Record<string, string> = {}
    for (const field of allowedFields) {
      if (credentials[field] !== undefined && credentials[field] !== '') {
        cleanCreds[field] = String(credentials[field])
      }
    }

    // Upsert
    const result = await db.query(`
      INSERT INTO mkt_platform_credentials (company_id, platform, credentials, status, updated_at)
      VALUES ($1, $2, $3, 'active', NOW())
      ON CONFLICT (company_id, platform)
      DO UPDATE SET
        credentials = mkt_platform_credentials.credentials || $3::jsonb,
        status = 'active',
        updated_at = NOW()
      RETURNING id, platform, status
    `, [payload.companyId, platform, JSON.stringify(cleanCreds)])

    return NextResponse.json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error('[MKT Settings Integrations PUT]', error)
    return NextResponse.json({ success: false, error: 'Error al guardar integracion' }, { status: 500 })
  }
}
