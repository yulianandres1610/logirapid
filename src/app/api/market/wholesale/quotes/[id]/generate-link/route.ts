import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
}

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null

  try {
    const secret = process.env.JWT_SECRET || 'fallback-secret'
    return jwt.verify(token, secret) as JWTPayload
  } catch {
    return null
  }
}

/**
 * POST /api/market/wholesale/quotes/[id]/generate-link
 * Generate a public signature link for the quote
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const quoteId = parseInt(id)

    // Verify quote exists
    const checkResult = await db.query(
      'SELECT id, status, quote_number FROM market_quotes WHERE id = $1 AND company_id = $2',
      [quoteId, payload.companyId]
    )

    if (checkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Cotización no encontrada'
      }, { status: 404 })
    }

    const quote = checkResult.rows[0]

    // Ensure signature columns exist
    try {
      await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS signature_token UUID`)
      await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS signature_data TEXT`)
      await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP`)
      await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS signer_name VARCHAR(255)`)
      await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS signer_ip VARCHAR(45)`)
      await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_signature_token ON market_quotes(signature_token) WHERE signature_token IS NOT NULL`)
    } catch {
      // Columns may already exist
    }

    // Check if already has a token
    let existingToken: string | null = null
    try {
      const sigResult = await db.query(
        'SELECT signature_token FROM market_quotes WHERE id = $1',
        [quoteId]
      )
      existingToken = sigResult.rows[0]?.signature_token || null
    } catch {
      // Column doesn't exist yet - ignore
    }

    if (existingToken) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://mercado.logirapid.com'
      return NextResponse.json({
        success: true,
        message: 'Enlace de firma ya existente',
        data: {
          token: existingToken,
          url: `${baseUrl}/quote-sign/${existingToken}`
        }
      })
    }

    // Generate new token
    const token = crypto.randomUUID()

    await db.query(
      'UPDATE market_quotes SET signature_token = $1, updated_at = NOW() WHERE id = $2',
      [token, quoteId]
    )

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://mercado.logirapid.com'
    const url = `${baseUrl}/quote-sign/${token}`

    return NextResponse.json({
      success: true,
      message: 'Enlace de firma generado exitosamente',
      data: {
        token,
        url
      }
    })

  } catch (error) {
    console.error('[Quote Generate Link] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al generar enlace'
    }, { status: 500 })
  }
}
