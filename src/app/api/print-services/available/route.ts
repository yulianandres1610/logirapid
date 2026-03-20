import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/print-services/available?documentType=product_label&warehouseId=5
 *
 * Returns all active print services that can handle the given document type,
 * with their mapped printer names. Used by print modals to show printer selection.
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token invalido' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const documentType = searchParams.get('documentType')

    const now = new Date()
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

    // Get all active services for this company
    const result = await db.query(
      `SELECT id, name, selected_printer, printer_type, printer_mappings,
              agent_printers, warehouse_id, pos_terminal_id, last_seen_at
       FROM print_services
       WHERE company_id = $1 AND status = 'active'
       ORDER BY last_seen_at DESC NULLS LAST`,
      [payload.companyId]
    )

    const services = result.rows.map((row: any) => {
      const mappings = row.printer_mappings || {}
      const agentPrinters = row.agent_printers || []
      const isOnline = row.last_seen_at && new Date(row.last_seen_at) > fiveMinutesAgo

      // The printer assigned to this document type (if mapped)
      const mappedPrinter = documentType ? mappings[documentType] : null

      return {
        id: row.id,
        name: row.name,
        online: isOnline,
        printerName: mappedPrinter || row.selected_printer || null,
        printerType: row.printer_type,
        warehouseId: row.warehouse_id,
        posTerminalId: row.pos_terminal_id,
        agentPrinters: Array.isArray(agentPrinters)
          ? agentPrinters.map((p: any) => typeof p === 'string' ? p : p.name || p.printerName || '')
          : [],
      }
    })

    return NextResponse.json({
      success: true,
      data: services,
    })
  } catch (error) {
    console.error('[Print Services Available] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener servicios disponibles' },
      { status: 500 }
    )
  }
}
