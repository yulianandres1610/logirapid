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
 * GET /api/market/warehouses/[id]/pos-returns/pending
 * Lista devoluciones POS pendientes de recibir
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
        pr.reason,
        pr.notes,
        pr.created_at,
        pr.status,
        pr.customer_name,
        COALESCE(pos.name, 'POS') as pos_name,
        COUNT(prl.id) as total_items,
        COALESCE(SUM(prl.quantity), 0) as total_units
      FROM pos_returns pr
      LEFT JOIN market_pos pos ON pos.id = pr.pos_id
      LEFT JOIN pos_return_lines prl ON prl.return_id = pr.id
      WHERE pr.warehouse_id = $1
        AND pr.company_id = $2
        AND pr.status = 'pending'
      GROUP BY pr.id, pr.return_number, pr.reason, pr.notes, pr.created_at, pr.status, pr.customer_name, pos.name
      ORDER BY pr.created_at DESC
    `, [warehouseId, payload.companyId])

    const returns = result.rows.map(row => ({
      id: parseInt(row.id),
      returnNumber: row.return_number,
      posName: row.pos_name,
      customerName: row.customer_name,
      reason: row.reason,
      notes: row.notes,
      status: row.status,
      createdAt: row.created_at,
      totalItems: parseInt(row.total_items) || 0,
      totalUnits: parseInt(row.total_units) || 0
    }))

    return NextResponse.json({
      success: true,
      data: {
        returns,
        count: returns.length
      }
    })

  } catch (error) {
    console.error('[POS Returns - Pending] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener devoluciones pendientes'
    }, { status: 500 })
  }
}
