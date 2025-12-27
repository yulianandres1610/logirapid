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
 * GET /api/market/warehouses/[id]/pos-returns/scrap-history
 * Obtiene el historial de scrap de devoluciones POS
 * Query params: condition, search, from, to
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const warehouseId = parseInt(id)
    const { searchParams } = new URL(request.url)
    const condition = searchParams.get('condition')
    const search = searchParams.get('search')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    // Build filters
    const filters: string[] = []
    const queryParams: (number | string)[] = [warehouseId, payload.companyId]
    let paramIndex = 3

    if (condition && condition !== 'all') {
      filters.push(`mps.condition = $${paramIndex}`)
      queryParams.push(condition)
      paramIndex++
    }

    if (search) {
      filters.push(`(LOWER(mp.name) LIKE LOWER($${paramIndex}) OR LOWER(mp.sku) LIKE LOWER($${paramIndex}))`)
      queryParams.push(`%${search}%`)
      paramIndex++
    }

    if (from) {
      filters.push(`mps.scrapped_at >= $${paramIndex}`)
      queryParams.push(from)
      paramIndex++
    }

    if (to) {
      filters.push(`mps.scrapped_at <= $${paramIndex}`)
      queryParams.push(to)
      paramIndex++
    }

    const whereClause = filters.length > 0 ? `AND ${filters.join(' AND ')}` : ''

    // Get scrap entries
    const entriesResult = await db.query(`
      SELECT
        mps.id,
        mps.quantity,
        mps.unit_cost,
        mps.total_value,
        mps.condition,
        mps.reason,
        mps.scrapped_at,
        mp.name as product_name,
        mp.sku,
        pr.return_number,
        COALESCE(pos.name, 'POS') as pos_name,
        u.name as scrapped_by
      FROM market_pos_scrap mps
      JOIN market_products mp ON mp.id = mps.product_id
      LEFT JOIN pos_returns pr ON pr.id = mps.pos_return_id
      LEFT JOIN market_pos pos ON pos.id = pr.pos_id
      LEFT JOIN users u ON u.id = mps.scrapped_by
      WHERE mps.warehouse_id = $1
        AND mps.company_id = $2
        ${whereClause}
      ORDER BY mps.scrapped_at DESC
      LIMIT 100
    `, queryParams)

    // Get summary
    const summaryResult = await db.query(`
      SELECT
        COUNT(*) as total_items,
        COALESCE(SUM(total_value), 0) as total_value,
        condition,
        COUNT(*) as condition_count,
        COALESCE(SUM(total_value), 0) as condition_value
      FROM market_pos_scrap
      WHERE warehouse_id = $1 AND company_id = $2
      GROUP BY condition
    `, [warehouseId, payload.companyId])

    // Calculate summary
    let totalItems = 0
    let totalValue = 0
    const byCondition: Record<string, { count: number; value: number }> = {}

    for (const row of summaryResult.rows) {
      totalItems += parseInt(row.condition_count)
      totalValue += parseFloat(row.condition_value)
      byCondition[row.condition] = {
        count: parseInt(row.condition_count),
        value: parseFloat(row.condition_value)
      }
    }

    const entries = entriesResult.rows.map(row => ({
      id: parseInt(row.id),
      returnNumber: row.return_number,
      posName: row.pos_name,
      productName: row.product_name,
      sku: row.sku,
      quantity: parseInt(row.quantity),
      unitCost: parseFloat(row.unit_cost),
      totalValue: parseFloat(row.total_value),
      condition: row.condition,
      reason: row.reason,
      scrappedAt: row.scrapped_at,
      scrappedBy: row.scrapped_by || 'Sistema'
    }))

    return NextResponse.json({
      success: true,
      data: {
        entries,
        summary: {
          totalItems,
          totalValue,
          byCondition
        }
      }
    })

  } catch (error) {
    console.error('[POS Returns - Scrap History] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener historial'
    }, { status: 500 })
  }
}
