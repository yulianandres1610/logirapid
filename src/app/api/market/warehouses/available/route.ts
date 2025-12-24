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
 * GET /api/market/warehouses/available
 * Get list of active warehouses for transfers (excluding optional current warehouse)
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
    const excludeId = searchParams.get('excludeId')

    let query = `
      SELECT
        id,
        code,
        name,
        warehouse_type,
        is_central,
        address,
        city,
        state
      FROM market_warehouses
      WHERE company_id = $1 AND is_active = true
    `
    const params: (number | string)[] = [payload.companyId]

    if (excludeId && !isNaN(parseInt(excludeId))) {
      query += ` AND id != $2`
      params.push(parseInt(excludeId))
    }

    query += ` ORDER BY is_central DESC, name ASC`

    const result = await db.query(query, params)

    return NextResponse.json({
      success: true,
      data: result.rows.map(w => ({
        id: w.id,
        code: w.code,
        name: w.name,
        warehouseType: w.warehouse_type,
        isCentral: w.is_central,
        address: w.address,
        city: w.city,
        state: w.state,
        displayName: `${w.name}${w.is_central ? ' (Central)' : ''}`
      }))
    })

  } catch (error) {
    console.error('[Warehouses Available] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener almacenes'
    }, { status: 500 })
  }
}
