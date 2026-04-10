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

/**
 * DELETE /api/marketing-intel/api-keys/[id]
 * Revoke (deactivate) an API key
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const { id } = await params
    const keyId = parseInt(id)

    const result = await db.query(
      'UPDATE mi_api_keys SET is_active = false, updated_at = NOW() WHERE id = $1 AND company_id = $2 RETURNING id, name',
      [keyId, payload.companyId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'API key no encontrada' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: `API key "${result.rows[0].name}" revocada`
    })
  } catch (error) {
    console.error('[MI API Keys DELETE] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al revocar API key' }, { status: 500 })
  }
}
