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
 * GET /api/market/warehouses/[id]/pending-production
 * Get count of pending production orders for this warehouse
 * (scheduled plans waiting for material issue, or in_production waiting for completion)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const warehouseId = parseInt(id)

    if (isNaN(warehouseId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de almacén inválido'
      }, { status: 400 })
    }

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

    // Count plans that need action from this warehouse
    // - scheduled: waiting for material issue
    // - materials_issued: waiting for production start
    // - in_production: waiting for completion
    const result = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'scheduled') as pending_issue,
        COUNT(*) FILTER (WHERE status = 'materials_issued') as pending_start,
        COUNT(*) FILTER (WHERE status = 'in_production') as pending_complete,
        COUNT(*) as total_pending
      FROM market_production_plans
      WHERE company_id = $1
        AND warehouse_id = $2
        AND status IN ('scheduled', 'materials_issued', 'in_production')
    `, [companyId, warehouseId])

    const counts = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        pendingCount: parseInt(counts.total_pending) || 0,
        pendingIssue: parseInt(counts.pending_issue) || 0,
        pendingStart: parseInt(counts.pending_start) || 0,
        pendingComplete: parseInt(counts.pending_complete) || 0
      }
    })

  } catch (error) {
    console.error('[Pending Production API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener planes pendientes'
    }, { status: 500 })
  }
}
