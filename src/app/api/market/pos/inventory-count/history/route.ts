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
 * GET /api/market/pos/inventory-count/history
 * Get inventory count history for a terminal or session
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

    const { searchParams } = new URL(request.url)
    const terminalId = searchParams.get('terminalId')
    const sessionId = searchParams.get('sessionId')
    const limit = parseInt(searchParams.get('limit') || '20')

    let query = `
      SELECT
        c.id,
        c.count_number,
        c.status,
        c.total_products,
        c.products_with_differences,
        c.total_difference_value,
        c.started_at,
        c.completed_at,
        c.session_id,
        w.name as warehouse_name,
        s.session_code
      FROM market_inventory_counts c
      LEFT JOIN market_warehouses w ON c.warehouse_id = w.id
      LEFT JOIN market_pos_sessions s ON c.session_id = s.id
      WHERE c.company_id = $1
    `
    const params: (number | string)[] = [payload.companyId]
    let paramIndex = 2

    if (terminalId) {
      query += ` AND s.pos_terminal_id = $${paramIndex++}`
      params.push(parseInt(terminalId))
    }

    if (sessionId) {
      query += ` AND c.session_id = $${paramIndex++}`
      params.push(parseInt(sessionId))
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${paramIndex++}`
    params.push(limit)

    const result = await db.query(query, params)

    return NextResponse.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        countNumber: row.count_number,
        status: row.status,
        warehouseName: row.warehouse_name,
        sessionCode: row.session_code,
        totalProducts: parseInt(row.total_products) || 0,
        productsWithDifferences: parseInt(row.products_with_differences) || 0,
        totalDifferenceValue: parseFloat(row.total_difference_value) || 0,
        startedAt: row.started_at,
        completedAt: row.completed_at
      }))
    })

  } catch (error) {
    console.error('[Inventory Count History] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener historial'
    }, { status: 500 })
  }
}
