import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { randomBytes } from 'crypto'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * POST /api/upload-tokens
 * Create a new upload token for phone upload
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { purpose, referenceType, referenceId } = body

    if (!purpose) {
      return NextResponse.json({
        success: false,
        error: 'purpose es requerido'
      }, { status: 400 })
    }

    const validPurposes = ['purchase_invoice', 'expense_receipt', 'product_image', 'employee_contract_photo', 'fixed_asset_image']
    if (!validPurposes.includes(purpose)) {
      return NextResponse.json({
        success: false,
        error: `purpose invalido. Validos: ${validPurposes.join(', ')}`
      }, { status: 400 })
    }

    // Generate unique token (64 hex chars = 32 bytes)
    const token = randomBytes(32).toString('hex')

    // Token expires in 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

    // Revoke any existing pending tokens for the same reference
    if (referenceType && referenceId) {
      await db.query(`
        UPDATE upload_tokens
        SET status = 'revoked'
        WHERE company_id = $1 AND reference_type = $2 AND reference_id = $3 AND status = 'pending'
      `, [payload.companyId, referenceType, referenceId])
    }

    // Create the token
    const result = await db.query(`
      INSERT INTO upload_tokens (token, company_id, user_id, purpose, reference_type, reference_id, status, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
      RETURNING id, token, expires_at
    `, [token, payload.companyId, payload.userId, purpose, referenceType || null, referenceId || null, expiresAt])

    const created = result.rows[0]

    console.log(`[Upload Token] Created token for ${purpose}, ref: ${referenceType}/${referenceId}, user: ${payload.email}`)

    return NextResponse.json({
      success: true,
      data: {
        token: created.token,
        expiresAt: created.expires_at,
        purpose
      }
    })

  } catch (error) {
    console.error('[Upload Tokens API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear token'
    }, { status: 500 })
  }
}
