import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/market/suppliers/search
 * Quick search for autocomplete
 * Returns minimal data for fast response
 */
export async function GET(request: NextRequest) {
  try {
    // Verify auth
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
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const companyId = payload.companyId

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20)

    if (q.length < 2) {
      return NextResponse.json({
        success: true,
        data: []
      })
    }

    const searchTerm = `%${q.toLowerCase()}%`

    const result = await db.query(`
      SELECT
        id,
        supplier_code,
        name,
        phone,
        email,
        address,
        city,
        state
      FROM market_suppliers
      WHERE company_id = $1
        AND is_active = true
        AND (
          LOWER(name) LIKE $2
          OR LOWER(supplier_code) LIKE $2
          OR phone LIKE $2
          OR LOWER(email) LIKE $2
        )
      ORDER BY
        CASE
          WHEN LOWER(name) LIKE $3 THEN 1
          WHEN LOWER(supplier_code) LIKE $3 THEN 2
          ELSE 3
        END,
        name ASC
      LIMIT $4
    `, [companyId, searchTerm, `${q.toLowerCase()}%`, limit])

    console.log('[Supplier Search] Query:', q, 'Found:', result.rows.length)

    return NextResponse.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        supplierCode: row.supplier_code,
        name: row.name,
        phone: row.phone,
        email: row.email,
        address: row.address,
        city: row.city,
        state: row.state,
        // Full address for display
        fullAddress: [row.address, row.city, row.state].filter(Boolean).join(', ')
      }))
    })

  } catch (error) {
    console.error('[Supplier Search API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error en búsqueda'
    }, { status: 500 })
  }
}
