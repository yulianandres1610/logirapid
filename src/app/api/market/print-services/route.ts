import { NextResponse } from 'next/server'
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
 * GET /api/market/print-services
 * List all print services for the company (for warehouse/terminal configuration)
 */
export async function GET() {
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

    // Get all active print services for the company
    const result = await db.query(`
      SELECT
        id,
        service_code as code,
        service_name as name,
        status,
        last_seen_at
      FROM print_services
      WHERE company_id = $1 AND status IN ('active', 'pending')
      ORDER BY service_name ASC
    `, [payload.companyId])

    return NextResponse.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        code: row.code,
        name: row.name,
        status: row.status,
        lastSeenAt: row.last_seen_at
      }))
    })

  } catch (error) {
    console.error('[Market Print Services API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener servicios de impresión'
    }, { status: 500 })
  }
}
