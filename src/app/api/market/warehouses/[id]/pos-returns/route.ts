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
 * GET /api/market/warehouses/[id]/pos-returns
 * Lista las devoluciones de POS pendientes y procesadas para este almacén
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
    const status = searchParams.get('status') || 'all'

    let statusFilter = ''
    if (status === 'pending') {
      statusFilter = "AND pr.status = 'pending'"
    } else if (status === 'completed') {
      statusFilter = "AND pr.status = 'completed'"
    }

    // Ensure customer_name column exists
    try {
      await db.query(`ALTER TABLE pos_returns ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255)`)
    } catch {
      // Column may already exist
    }

    const result = await db.query(`
      SELECT
        pr.id,
        pr.return_number,
        pr.status,
        pr.reason,
        pr.created_at,
        pr.customer_name,
        COALESCE(pos.name, 'POS') as pos_name,
        COUNT(prl.id) as total_items,
        COALESCE(SUM(prl.quantity), 0) as total_units,
        COALESCE(SUM(prl.quantity * prl.unit_price), 0) as total_value
      FROM pos_returns pr
      LEFT JOIN market_pos pos ON pos.id = pr.pos_id
      LEFT JOIN pos_return_lines prl ON prl.return_id = pr.id
      WHERE pr.warehouse_id = $1
        AND pr.company_id = $2
        ${statusFilter}
      GROUP BY pr.id, pr.return_number, pr.status, pr.reason, pr.created_at, pr.customer_name, pos.name
      ORDER BY pr.created_at DESC
    `, [warehouseId, payload.companyId])

    const returns = result.rows.map(row => ({
      id: parseInt(row.id),
      returnNumber: row.return_number,
      posName: row.pos_name || 'POS',
      customerName: row.customer_name,
      reason: row.reason,
      status: row.status,
      createdAt: row.created_at,
      totalItems: parseInt(row.total_items) || 0,
      totalUnits: parseInt(row.total_units) || 0,
      totalValue: parseFloat(row.total_value) || 0
    }))

    return NextResponse.json({
      success: true,
      data: {
        returns,
        count: returns.length
      }
    })

  } catch (error) {
    console.error('[POS Returns] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener devoluciones'
    }, { status: 500 })
  }
}
