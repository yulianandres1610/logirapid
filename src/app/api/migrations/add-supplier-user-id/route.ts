import { NextResponse } from 'next/server'
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
 * POST /api/migrations/add-supplier-user-id
 * Add user_id column to market_suppliers table for portal access
 */
export async function POST() {
  try {
    const payload = await getPayload()
    if (!payload || !['SUPER_ADMIN', 'ADMIN'].includes(payload.role)) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const results: string[] = []

    // Add user_id column if not exists
    try {
      await db.query(`
        ALTER TABLE market_suppliers
        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)
      `)
      results.push('Added user_id column to market_suppliers')
    } catch (e) {
      results.push(`user_id column: ${e instanceof Error ? e.message : 'already exists or error'}`)
    }

    // Create index on user_id
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_market_suppliers_user_id
        ON market_suppliers(user_id)
      `)
      results.push('Created index on user_id')
    } catch (e) {
      results.push(`Index: ${e instanceof Error ? e.message : 'already exists'}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      results
    })

  } catch (error) {
    console.error('[Migration add-supplier-user-id] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error running migration'
    }, { status: 500 })
  }
}

/**
 * GET /api/migrations/add-supplier-user-id
 * Check current state
 */
export async function GET() {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    // Check if column exists
    const columnCheck = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'market_suppliers' AND column_name = 'user_id'
    `)

    const hasColumn = columnCheck.rows.length > 0

    // Count suppliers with user_id set
    let suppliersWithUser = 0
    if (hasColumn) {
      const countResult = await db.query(`
        SELECT COUNT(*) as count FROM market_suppliers WHERE user_id IS NOT NULL
      `)
      suppliersWithUser = parseInt(countResult.rows[0].count) || 0
    }

    return NextResponse.json({
      success: true,
      data: {
        hasUserIdColumn: hasColumn,
        suppliersWithUser
      }
    })

  } catch (error) {
    console.error('[Migration add-supplier-user-id GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error checking migration status'
    }, { status: 500 })
  }
}
