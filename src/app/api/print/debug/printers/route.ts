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

/**
 * GET /api/print/debug/printers
 * Debug endpoint to see all printers in database for this company
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    // Get all services for this company
    const servicesResult = await db.query(`
      SELECT id, service_code, service_name, status, last_seen_at
      FROM print_services
      WHERE company_id = $1
      ORDER BY id
    `, [payload.companyId])

    const services = []

    for (const service of servicesResult.rows) {
      // Get printers for each service
      const printersResult = await db.query(`
        SELECT
          id,
          printer_name,
          printer_id,
          printer_type,
          connection_type,
          is_online,
          is_default,
          created_at,
          updated_at
        FROM print_service_printers
        WHERE print_service_id = $1
        ORDER BY id
      `, [service.id])

      services.push({
        serviceId: service.id,
        serviceCode: service.service_code,
        serviceName: service.service_name,
        status: service.status,
        lastSeenAt: service.last_seen_at,
        printerCount: printersResult.rows.length,
        printers: printersResult.rows.map(p => ({
          id: p.id,
          printerName: p.printer_name,
          printerId: p.printer_id,
          printerType: p.printer_type,
          connectionType: p.connection_type,
          isOnline: p.is_online,
          isDefault: p.is_default,
          createdAt: p.created_at,
          updatedAt: p.updated_at
        }))
      })
    }

    return NextResponse.json({
      success: true,
      companyId: payload.companyId,
      totalServices: services.length,
      services
    })

  } catch (error) {
    console.error('[Print Debug API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
