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
 * GET /api/print/debug
 * Debug endpoint to see print services and printers for the current user's company
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
      SELECT
        ps.id,
        ps.service_code,
        ps.service_name,
        ps.status,
        ps.last_seen_at,
        ps.warehouse_id
      FROM print_services ps
      WHERE ps.company_id = $1
      ORDER BY ps.created_at DESC
    `, [payload.companyId])

    // Get all printers for these services
    const serviceIds = servicesResult.rows.map(s => s.id)
    let printersResult = { rows: [] as Array<{
      id: number
      print_service_id: number
      printer_name: string
      printer_type: string
      is_online: boolean
      is_default: boolean
    }> }

    if (serviceIds.length > 0) {
      printersResult = await db.query(`
        SELECT
          id,
          print_service_id,
          printer_name,
          printer_type,
          is_online,
          is_default
        FROM print_service_printers
        WHERE print_service_id = ANY($1)
        ORDER BY printer_name ASC
      `, [serviceIds])
    }

    // Group printers by service
    const printersByService: Record<number, typeof printersResult.rows> = {}
    for (const printer of printersResult.rows) {
      if (!printersByService[printer.print_service_id]) {
        printersByService[printer.print_service_id] = []
      }
      printersByService[printer.print_service_id].push(printer)
    }

    // Check which printers would match thermal filter
    const thermalTypes = ['thermal_80mm', 'thermal_58mm', 'pos', 'receipt', 'thermal']

    const services = servicesResult.rows.map(service => {
      const printers = printersByService[service.id] || []
      const thermalPrinters = printers.filter(p =>
        thermalTypes.includes(p.printer_type?.toLowerCase() || '')
      )

      return {
        id: service.id,
        serviceCode: service.service_code,
        serviceName: service.service_name,
        status: service.status,
        lastSeenAt: service.last_seen_at,
        warehouseId: service.warehouse_id,
        printers: printers.map(p => ({
          id: p.id,
          printerName: p.printer_name,
          printerType: p.printer_type,
          printerTypeLower: p.printer_type?.toLowerCase(),
          isOnline: p.is_online,
          isDefault: p.is_default,
          isThermal: thermalTypes.includes(p.printer_type?.toLowerCase() || '')
        })),
        thermalPrinterCount: thermalPrinters.length
      }
    })

    const totalThermalPrinters = services.reduce((sum, s) => sum + s.thermalPrinterCount, 0)

    return NextResponse.json({
      success: true,
      data: {
        user: {
          email: payload.email,
          companyId: payload.companyId,
          companyName: payload.companyName
        },
        thermalTypes,
        totalServices: services.length,
        totalThermalPrinters,
        services
      }
    })

  } catch (error) {
    console.error('[Print Debug API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
