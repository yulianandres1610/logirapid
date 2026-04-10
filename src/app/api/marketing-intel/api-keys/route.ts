import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import { generateApiKey } from '@/lib/marketing-intel-auth'

interface JWTPayload { userId: number; email: string; role: string; companyId: number }

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  try { return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as JWTPayload } catch { return null }
}

/**
 * GET /api/marketing-intel/api-keys
 * List all API keys (masked) for the company
 */
export async function GET() {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const result = await db.query(`
      SELECT id, key_prefix, name, agent_type, permissions, is_active, last_used_at, expires_at, created_at
      FROM mi_api_keys
      WHERE company_id = $1
      ORDER BY created_at DESC
    `, [payload.companyId])

    return NextResponse.json({
      success: true,
      data: result.rows.map(k => ({
        id: k.id,
        keyPrefix: k.key_prefix,
        name: k.name,
        agentType: k.agent_type,
        permissions: k.permissions || [],
        isActive: k.is_active,
        lastUsedAt: k.last_used_at,
        expiresAt: k.expires_at,
        createdAt: k.created_at
      }))
    })
  } catch (error) {
    console.error('[MI API Keys GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener API keys' }, { status: 500 })
  }
}

/**
 * POST /api/marketing-intel/api-keys
 * Generate a new API key
 * Body: { name, agentType, permissions?, expiresInDays? }
 */
export async function POST(request: NextRequest) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const body = await request.json()
    const { name, agentType, permissions, expiresInDays } = body

    if (!name || !agentType) {
      return NextResponse.json({ success: false, error: 'name y agentType requeridos' }, { status: 400 })
    }

    const { rawKey, keyHash, keyPrefix } = generateApiKey()

    let expiresAt: string | null = null
    if (expiresInDays && expiresInDays > 0) {
      const d = new Date()
      d.setDate(d.getDate() + expiresInDays)
      expiresAt = d.toISOString()
    }

    await db.query(`
      INSERT INTO mi_api_keys (company_id, key_hash, key_prefix, name, agent_type, permissions, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [payload.companyId, keyHash, keyPrefix, name, agentType, JSON.stringify(permissions || []), expiresAt])

    return NextResponse.json({
      success: true,
      data: {
        apiKey: rawKey,
        keyPrefix,
        name,
        agentType,
        expiresAt
      },
      message: 'Guarda esta API key. No se mostrará de nuevo.'
    })
  } catch (error) {
    console.error('[MI API Keys POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al crear API key' }, { status: 500 })
  }
}
