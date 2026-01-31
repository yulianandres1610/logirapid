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
 * POST /api/migrations/usd-4-decimals
 * Migration to change USD price columns from DECIMAL(12,2) to DECIMAL(12,4)
 * This allows for exact CUP calculations (CUP must be integer multiples of 10)
 *
 * Example: 510 CUP / 400 rate = 1.2750 USD (4 decimals)
 * When selling: 1.2750 * 400 = 510 CUP exactly
 */
export async function POST(request: NextRequest) {
  try {
    // Verify auth - only SUPER_ADMIN can run migrations
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

    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Solo SUPER_ADMIN puede ejecutar migraciones'
      }, { status: 403 })
    }

    console.log('[Migration USD-4-Decimals] Starting migration by', payload.email)

    const results: { table: string; column: string; success: boolean; error?: string }[] = []

    // 1. market_products: cost_price, selling_price
    try {
      await db.query(`
        ALTER TABLE market_products
        ALTER COLUMN cost_price TYPE DECIMAL(12,4),
        ALTER COLUMN selling_price TYPE DECIMAL(12,4)
      `)
      results.push({ table: 'market_products', column: 'cost_price, selling_price', success: true })
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error'
      results.push({ table: 'market_products', column: 'cost_price, selling_price', success: false, error })
      console.error('[Migration] market_products error:', error)
    }

    // 2. market_product_variants: unit_cost, selling_price
    try {
      await db.query(`
        ALTER TABLE market_product_variants
        ALTER COLUMN cost_price TYPE DECIMAL(12,4),
        ALTER COLUMN selling_price TYPE DECIMAL(12,4)
      `)
      results.push({ table: 'market_product_variants', column: 'cost_price, selling_price', success: true })
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error'
      results.push({ table: 'market_product_variants', column: 'cost_price, selling_price', success: false, error })
      console.error('[Migration] market_product_variants error:', error)
    }

    // 3. market_pos_order_lines: unit_price
    try {
      await db.query(`
        ALTER TABLE market_pos_order_lines
        ALTER COLUMN unit_price TYPE DECIMAL(12,4)
      `)
      results.push({ table: 'market_pos_order_lines', column: 'unit_price', success: true })
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error'
      results.push({ table: 'market_pos_order_lines', column: 'unit_price', success: false, error })
      console.error('[Migration] market_pos_order_lines error:', error)
    }

    // 4. market_invoice_lines: unit_price, cost_price
    try {
      await db.query(`
        ALTER TABLE market_invoice_lines
        ALTER COLUMN unit_price TYPE DECIMAL(12,4),
        ALTER COLUMN cost_price TYPE DECIMAL(12,4)
      `)
      results.push({ table: 'market_invoice_lines', column: 'unit_price, cost_price', success: true })
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error'
      results.push({ table: 'market_invoice_lines', column: 'unit_price, cost_price', success: false, error })
      console.error('[Migration] market_invoice_lines error:', error)
    }

    // 5. Create index for price searches (if not exists)
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_products_selling_price
        ON market_products(selling_price)
      `)
      results.push({ table: 'market_products', column: 'idx_selling_price', success: true })
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error'
      results.push({ table: 'market_products', column: 'idx_selling_price', success: false, error })
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    console.log('[Migration USD-4-Decimals] Completed:', successCount, 'success,', failCount, 'failed')

    return NextResponse.json({
      success: true,
      message: `Migración completada: ${successCount} exitosos, ${failCount} fallidos`,
      data: {
        results,
        summary: {
          total: results.length,
          success: successCount,
          failed: failCount
        }
      }
    })

  } catch (error) {
    console.error('[Migration USD-4-Decimals] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error en migración'
    }, { status: 500 })
  }
}

/**
 * GET /api/migrations/usd-4-decimals
 * Check current column precision
 */
export async function GET() {
  try {
    const result = await db.query(`
      SELECT
        table_name,
        column_name,
        data_type,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns
      WHERE table_name IN ('market_products', 'market_product_variants', 'market_pos_order_lines', 'market_invoice_lines')
        AND column_name IN ('cost_price', 'selling_price', 'unit_price')
      ORDER BY table_name, column_name
    `)

    return NextResponse.json({
      success: true,
      data: {
        columns: result.rows,
        note: 'numeric_scale = 4 means 4 decimal places'
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error checking columns'
    }, { status: 500 })
  }
}
