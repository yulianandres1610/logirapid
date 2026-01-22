import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/upload-tokens/[token]
 * Public endpoint - Get token info for mobile upload page
 * Does NOT expose sensitive data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token || token.length < 32) {
      return NextResponse.json({
        success: false,
        error: 'Token invalido'
      }, { status: 400 })
    }

    const result = await db.query(`
      SELECT id, purpose, status, expires_at, file_url
      FROM upload_tokens
      WHERE token = $1
    `, [token])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Token no encontrado'
      }, { status: 404 })
    }

    const tokenData = result.rows[0]

    // Check if expired
    const isExpired = new Date(tokenData.expires_at) < new Date()
    if (isExpired && tokenData.status === 'pending') {
      await db.query(`UPDATE upload_tokens SET status = 'expired' WHERE id = $1`, [tokenData.id])
      tokenData.status = 'expired'
    }

    return NextResponse.json({
      success: true,
      data: {
        purpose: tokenData.purpose,
        status: tokenData.status,
        expired: isExpired,
        hasFile: !!tokenData.file_url
      }
    })

  } catch (error) {
    console.error('[Upload Token Info] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener info del token'
    }, { status: 500 })
  }
}
