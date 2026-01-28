import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
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
 * GET /api/market/wholesale/invoices/next-number
 * Get the next invoice number
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const year = new Date().getFullYear()
    const result = await db.query(`
      SELECT invoice_number FROM market_invoices
      WHERE company_id = $1 AND invoice_number LIKE $2
      ORDER BY id DESC
      LIMIT 1
    `, [payload.companyId, `FAC-${year}-%`])

    let nextNumber = 1
    if (result.rows.length > 0) {
      const lastNumber = result.rows[0].invoice_number
      const match = lastNumber.match(/FAC-\d{4}-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1]) + 1
      }
    }

    const invoiceNumber = `FAC-${year}-${String(nextNumber).padStart(4, '0')}`

    return NextResponse.json({
      success: true,
      data: { invoiceNumber }
    })

  } catch (error) {
    console.error('[Wholesale Next Invoice Number] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener número'
    }, { status: 500 })
  }
}
