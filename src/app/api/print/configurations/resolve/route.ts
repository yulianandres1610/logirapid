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
 * GET /api/print/configurations/resolve
 * Resolve the best matching print configuration for a document type
 *
 * Priority order:
 * 1. Terminal-specific configuration
 * 2. Warehouse-specific configuration
 * 3. Company-wide configuration
 *
 * Also considers priority field within each level
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

    const { searchParams } = new URL(request.url)
    const documentType = searchParams.get('documentType')
    const posTerminalId = searchParams.get('posTerminalId')
    const warehouseId = searchParams.get('warehouseId')

    if (!documentType) {
      return NextResponse.json({
        success: false,
        error: 'documentType es requerido'
      }, { status: 400 })
    }

    // Build query to find best matching configuration
    // Order by specificity: terminal > warehouse > company-wide
    const result = await db.query(`
      SELECT
        pc.id,
        pc.document_type,
        pc.copies,
        pc.auto_print,
        pc.priority,
        pc.warehouse_id,
        pc.pos_terminal_id,
        pc.print_service_id,
        ps.service_name,
        ps.status as service_status,
        ps.last_seen_at,
        pc.printer_id,
        psp.printer_name,
        psp.printer_type,
        psp.is_online as printer_online,
        CASE
          WHEN pc.pos_terminal_id IS NOT NULL THEN 3
          WHEN pc.warehouse_id IS NOT NULL THEN 2
          ELSE 1
        END as specificity
      FROM print_configurations pc
      LEFT JOIN print_services ps ON pc.print_service_id = ps.id
      LEFT JOIN print_service_printers psp ON pc.printer_id = psp.id
      WHERE pc.company_id = $1
        AND pc.document_type = $2
        AND pc.is_active = true
        AND (
          (pc.pos_terminal_id = $3)
          OR (pc.pos_terminal_id IS NULL AND pc.warehouse_id = $4)
          OR (pc.pos_terminal_id IS NULL AND pc.warehouse_id IS NULL)
        )
      ORDER BY specificity DESC, pc.priority DESC
      LIMIT 1
    `, [
      payload.companyId,
      documentType,
      posTerminalId ? parseInt(posTerminalId) : null,
      warehouseId ? parseInt(warehouseId) : null
    ])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          found: false,
          message: 'No hay configuración de impresión para este tipo de documento'
        }
      })
    }

    const config = result.rows[0]

    // Check if service is online (last seen within 2 minutes)
    const lastSeen = config.last_seen_at ? new Date(config.last_seen_at) : null
    const isServiceOnline = lastSeen && (Date.now() - lastSeen.getTime()) < 2 * 60 * 1000

    return NextResponse.json({
      success: true,
      data: {
        found: true,
        configuration: {
          id: config.id,
          documentType: config.document_type,
          copies: config.copies,
          autoPrint: config.auto_print,
          printServiceId: config.print_service_id,
          serviceName: config.service_name,
          serviceOnline: isServiceOnline,
          printerId: config.printer_id,
          printerName: config.printer_name,
          printerType: config.printer_type,
          printerOnline: config.printer_online,
          scope: config.pos_terminal_id
            ? 'terminal'
            : config.warehouse_id
              ? 'warehouse'
              : 'company'
        },
        canPrint: isServiceOnline && config.printer_online,
        warnings: [
          !isServiceOnline && 'El servicio de impresión está desconectado',
          !config.printer_online && 'La impresora está desconectada'
        ].filter(Boolean)
      }
    })

  } catch (error) {
    console.error('[Print Config Resolve] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al resolver configuración'
    }, { status: 500 })
  }
}
