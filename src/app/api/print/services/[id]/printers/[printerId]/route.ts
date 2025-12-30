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

const ALL_DOCUMENT_TYPES = [
  'pos_receipt',
  'product_label',
  'invoice',
  'purchase_invoice',
  'sales_report',
  'inventory_count_report',
  'cash_register_report',
  'shipping_label',
  'warehouse_operation',
  'consignment_receipt',
  'unified_reception'
]

/**
 * GET /api/print/services/[id]/printers/[printerId]
 * Get printer details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; printerId: string }> }
) {
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

    const { id, printerId } = await params

    // Verify printer belongs to a service owned by this company
    const result = await db.query(`
      SELECT
        psp.*,
        ps.company_id,
        ps.service_name
      FROM print_service_printers psp
      JOIN print_services ps ON psp.print_service_id = ps.id
      WHERE psp.id = $1
        AND psp.print_service_id = $2
        AND ps.company_id = $3
    `, [printerId, id, payload.companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Impresora no encontrada' }, { status: 404 })
    }

    const printer = result.rows[0]

    // Parse supported_document_types
    let supportedTypes: string[] = ALL_DOCUMENT_TYPES
    if (printer.supported_document_types) {
      if (Array.isArray(printer.supported_document_types)) {
        supportedTypes = printer.supported_document_types
      } else if (typeof printer.supported_document_types === 'string') {
        try {
          supportedTypes = JSON.parse(printer.supported_document_types)
        } catch {
          supportedTypes = ALL_DOCUMENT_TYPES
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: printer.id,
        printServiceId: printer.print_service_id,
        serviceName: printer.service_name,
        printerName: printer.printer_name,
        printerId: printer.printer_id,
        driverName: printer.driver_name,
        printerType: printer.printer_type,
        connectionType: printer.connection_type,
        networkAddress: printer.network_address,
        isOnline: printer.is_online,
        isDefault: printer.is_default,
        supportsEscpos: printer.supports_escpos,
        supportsRaw: printer.supports_raw,
        paperWidthMm: printer.paper_width_mm,
        dpi: printer.dpi,
        supportedDocumentTypes: supportedTypes,
        createdAt: printer.created_at,
        updatedAt: printer.updated_at
      }
    })

  } catch (error) {
    console.error('[Printer API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener impresora'
    }, { status: 500 })
  }
}

/**
 * PUT /api/print/services/[id]/printers/[printerId]
 * Update printer configuration (type, supported documents, etc.)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; printerId: string }> }
) {
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

    // Only ADMIN and SUPER_ADMIN can update printers
    if (!['ADMIN', 'SUPER_ADMIN'].includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'No tienes permisos para modificar impresoras'
      }, { status: 403 })
    }

    const { id, printerId } = await params
    const body = await request.json()

    // Verify printer belongs to a service owned by this company
    const checkResult = await db.query(`
      SELECT psp.id, ps.company_id
      FROM print_service_printers psp
      JOIN print_services ps ON psp.print_service_id = ps.id
      WHERE psp.id = $1
        AND psp.print_service_id = $2
        AND ps.company_id = $3
    `, [printerId, id, payload.companyId])

    if (checkResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Impresora no encontrada' }, { status: 404 })
    }

    // Build update query dynamically
    const updates: string[] = []
    const values: (string | number | boolean | string[] | null)[] = []
    let paramIndex = 1

    // Update printer_type
    if (body.printerType !== undefined) {
      const validTypes = ['thermal_80mm', 'label_4x6', 'label_barcode', 'standard']
      if (!validTypes.includes(body.printerType)) {
        return NextResponse.json({
          success: false,
          error: `Tipo de impresora inválido. Válidos: ${validTypes.join(', ')}`
        }, { status: 400 })
      }
      updates.push(`printer_type = $${paramIndex}`)
      values.push(body.printerType)
      paramIndex++
    }

    // Update supported_document_types
    if (body.supportedDocumentTypes !== undefined) {
      if (!Array.isArray(body.supportedDocumentTypes)) {
        return NextResponse.json({
          success: false,
          error: 'supportedDocumentTypes debe ser un array'
        }, { status: 400 })
      }

      // Validate all types
      const invalidTypes = body.supportedDocumentTypes.filter((t: string) => !ALL_DOCUMENT_TYPES.includes(t))
      if (invalidTypes.length > 0) {
        return NextResponse.json({
          success: false,
          error: `Tipos de documento inválidos: ${invalidTypes.join(', ')}. Válidos: ${ALL_DOCUMENT_TYPES.join(', ')}`
        }, { status: 400 })
      }

      // Pass JavaScript array directly - pg driver handles conversion
      updates.push(`supported_document_types = $${paramIndex}`)
      values.push(body.supportedDocumentTypes)
      paramIndex++
    }

    // Update is_default
    if (body.isDefault !== undefined) {
      // If setting as default, unset other defaults first
      if (body.isDefault === true) {
        await db.query(`
          UPDATE print_service_printers
          SET is_default = false
          WHERE print_service_id = $1 AND id != $2
        `, [id, printerId])
      }
      updates.push(`is_default = $${paramIndex}`)
      values.push(body.isDefault)
      paramIndex++
    }

    // Update connection_type
    if (body.connectionType !== undefined) {
      const validConnections = ['usb', 'network', 'bluetooth']
      if (!validConnections.includes(body.connectionType)) {
        return NextResponse.json({
          success: false,
          error: `Tipo de conexión inválido. Válidos: ${validConnections.join(', ')}`
        }, { status: 400 })
      }
      updates.push(`connection_type = $${paramIndex}`)
      values.push(body.connectionType)
      paramIndex++
    }

    // Update paper_width_mm
    if (body.paperWidthMm !== undefined) {
      updates.push(`paper_width_mm = $${paramIndex}`)
      values.push(body.paperWidthMm)
      paramIndex++
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay campos para actualizar'
      }, { status: 400 })
    }

    // Add updated_at
    updates.push(`updated_at = NOW()`)

    // Add printer ID for WHERE clause
    values.push(parseInt(printerId))

    const updateQuery = `
      UPDATE print_service_printers
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    const result = await db.query(updateQuery, values)
    const updatedPrinter = result.rows[0]

    // Parse supported_document_types for response
    let supportedTypes: string[] = ALL_DOCUMENT_TYPES
    if (updatedPrinter.supported_document_types) {
      if (Array.isArray(updatedPrinter.supported_document_types)) {
        supportedTypes = updatedPrinter.supported_document_types
      } else if (typeof updatedPrinter.supported_document_types === 'string') {
        try {
          supportedTypes = JSON.parse(updatedPrinter.supported_document_types)
        } catch {
          supportedTypes = ALL_DOCUMENT_TYPES
        }
      }
    }

    console.log(`[Printer API] Updated printer ${printerId} for service ${id}`)

    return NextResponse.json({
      success: true,
      data: {
        id: updatedPrinter.id,
        printerName: updatedPrinter.printer_name,
        printerType: updatedPrinter.printer_type,
        connectionType: updatedPrinter.connection_type,
        isDefault: updatedPrinter.is_default,
        paperWidthMm: updatedPrinter.paper_width_mm,
        supportedDocumentTypes: supportedTypes
      },
      message: 'Impresora actualizada correctamente'
    })

  } catch (error) {
    console.error('[Printer API] Error updating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar impresora'
    }, { status: 500 })
  }
}
