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
 * GET /api/market/categories
 * List all distinct product categories for a market company
 */
export async function GET(request: NextRequest) {
  try {
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
    const search = searchParams.get('search') || ''

    // Get distinct categories from products
    let query = `
      SELECT DISTINCT category
      FROM market_products
      WHERE company_id = $1
        AND category IS NOT NULL
        AND category != ''
    `
    const queryParams: (string | number)[] = [companyId]

    if (search) {
      query += ` AND LOWER(category) LIKE $2`
      queryParams.push(`%${search.toLowerCase()}%`)
    }

    query += ` ORDER BY category ASC`

    const result = await db.query(query, queryParams)

    // Map to expected format
    const categories = result.rows.map((row, index) => ({
      id: index + 1,
      name: row.category,
      slug: row.category.toLowerCase().replace(/\s+/g, '-')
    }))

    return NextResponse.json({
      success: true,
      data: {
        categories,
        total: categories.length
      }
    })

  } catch (error) {
    console.error('[Market Categories API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener categorías'
    }, { status: 500 })
  }
}
