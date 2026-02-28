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
      'SELECT id, status, signature_token, quote_number FROM market_quotes WHERE id = $1 AND company_id = $2',
      [quoteId, payload.companyId]
    )

    if (checkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Cotización no encontrada'
      }, { status: 404 })
    }

    const quote = checkResult.rows[0]

    // If already has a token, return existing one
    if (quote.signature_token) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://mercado.logirapid.com'
      return NextResponse.json({
        success: true,
        message: 'Enlace de firma ya existente',
        data: {
          token: quote.signature_token,
          url: `${baseUrl}/quote-sign/${quote.signature_token}`
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
