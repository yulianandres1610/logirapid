import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BUCKET_NAME = 'company-private-documents'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
}

/**
 * GET /api/upload-tokens/status?token=xxx
 * Authenticated endpoint - Check token status (for polling from desktop)
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token invalido' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'token query param es requerido'
      }, { status: 400 })
    }

    const result = await db.query(`
      SELECT id, status, file_url, file_name, file_size, file_type, expires_at, uploaded_at
      FROM upload_tokens
      WHERE token = $1 AND company_id = $2
    `, [token, payload.companyId])

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

    // Generate signed URL for preview if file was uploaded
    let signedUrl = null
    if (tokenData.status === 'uploaded' && tokenData.file_url && supabaseUrl && supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        })
        const { data } = await supabase.storage
          .from(BUCKET_NAME)
          .createSignedUrl(tokenData.file_url, 3600) // 1 hour
        signedUrl = data?.signedUrl || null
      } catch (e) {
        console.error('[Upload Token Status] Error creating signed URL:', e)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        status: tokenData.status,
        fileUrl: tokenData.file_url,
        fileName: tokenData.file_name,
        fileSize: tokenData.file_size ? parseInt(tokenData.file_size) : 0,
        fileType: tokenData.file_type || 'image/jpeg',
        signedUrl, // URL for preview
        expired: isExpired,
        uploadedAt: tokenData.uploaded_at
      }
    })

  } catch (error) {
    console.error('[Upload Token Status] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al verificar status'
    }, { status: 500 })
  }
}
