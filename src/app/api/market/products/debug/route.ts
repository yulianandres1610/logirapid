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
 * GET /api/market/products/debug
 * Debug endpoint to check product data
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

    // Check company info
    const companyResult = await db.query(`
      SELECT id, name, type, is_active
      FROM companies
      WHERE id = $1
    `, [companyId])

    // Check total products (including inactive)
    const totalProductsResult = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(*) FILTER (WHERE is_active = false) as inactive
      FROM market_products
      WHERE company_id = $1
    `, [companyId])

    // Check if table exists
    const tableCheckResult = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'market_products'
      ) as table_exists
    `)

    // Sample products
    const sampleProducts = await db.query(`
      SELECT id, name, is_active, created_at
      FROM market_products
      WHERE company_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [companyId])

    // Check ALL products in the system (for debugging)
    const allProductsResult = await db.query(`
      SELECT
        p.company_id,
        c.name as company_name,
        COUNT(*) as product_count
      FROM market_products p
      LEFT JOIN companies c ON p.company_id = c.id
      GROUP BY p.company_id, c.name
      ORDER BY product_count DESC
      LIMIT 10
    `)

    // Check if market_products table has any data at all
    const totalInSystemResult = await db.query(`
      SELECT COUNT(*) as total FROM market_products
    `)

    return NextResponse.json({
      success: true,
      debug: {
        user: {
          email: payload.email,
          role: payload.role,
          companyId: payload.companyId,
          companyName: payload.companyName
        },
        company: companyResult.rows[0] || null,
        tableExists: tableCheckResult.rows[0]?.table_exists || false,
        productCounts: {
          total: parseInt(totalProductsResult.rows[0]?.total) || 0,
          active: parseInt(totalProductsResult.rows[0]?.active) || 0,
          inactive: parseInt(totalProductsResult.rows[0]?.inactive) || 0
        },
        sampleProducts: sampleProducts.rows,
        totalProductsInSystem: parseInt(totalInSystemResult.rows[0]?.total) || 0,
        productsByCompany: allProductsResult.rows
      }
    })

  } catch (error) {
    console.error('[Market Products Debug] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}
