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
 * GET /api/market/warehouses/[id]/pos-returns/pending-count
 * Obtiene el conteo de devoluciones POS pendientes
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

    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM pos_returns
      WHERE warehouse_id = $1
        AND company_id = $2
        AND status = 'pending'
    `, [warehouseId, payload.companyId])

    return NextResponse.json({
      success: true,
      data: {
        count: parseInt(result.rows[0]?.count) || 0
      }
    })

  } catch (error) {
    console.error('[POS Returns - Pending Count] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener conteo'
    }, { status: 500 })
  }
}
