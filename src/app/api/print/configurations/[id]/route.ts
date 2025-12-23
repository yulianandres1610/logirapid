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
 * GET /api/print/configurations/[id]
 * Get a specific print configuration
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const configId = parseInt(id)

    if (isNaN(configId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

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

    const result = await db.query(`
      SELECT
        pc.id,
        pc.document_type,
        pc.copies,
        pc.auto_print,
        pc.is_active,
        pc.priority,
        pc.created_at,
        pc.updated_at,
        pc.warehouse_id,
        mw.name as warehouse_name,
        pc.pos_terminal_id,
        mpt.name as terminal_name,
        pc.print_service_id,
        ps.service_name,
        ps.status as service_status,
        pc.printer_id,
        psp.printer_name,
        psp.printer_type,
        psp.is_online as printer_online
      FROM print_configurations pc
      LEFT JOIN market_warehouses mw ON pc.warehouse_id = mw.id
      LEFT JOIN market_pos_terminals mpt ON pc.pos_terminal_id = mpt.id
      LEFT JOIN print_services ps ON pc.print_service_id = ps.id
      LEFT JOIN print_service_printers psp ON pc.printer_id = psp.id
      WHERE pc.id = $1 AND pc.company_id = $2
    `, [configId, payload.companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Configuración no encontrada'
      }, { status: 404 })
    }

    const c = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        id: c.id,
        documentType: c.document_type,
        copies: c.copies,
        autoPrint: c.auto_print,
        isActive: c.is_active,
        priority: c.priority,
        warehouseId: c.warehouse_id,
        warehouseName: c.warehouse_name,
        posTerminalId: c.pos_terminal_id,
        terminalName: c.terminal_name,
        printServiceId: c.print_service_id,
        serviceName: c.service_name,
        serviceStatus: c.service_status,
        printerId: c.printer_id,
        printerName: c.printer_name,
        printerType: c.printer_type,
        printerOnline: c.printer_online,
        createdAt: c.created_at,
        updatedAt: c.updated_at
      }
    })

  } catch (error) {
    console.error('[Print Configurations API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener configuración'
    }, { status: 500 })
  }
}

/**
 * PUT /api/print/configurations/[id]
 * Update a print configuration
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const configId = parseInt(id)

    if (isNaN(configId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

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

    // Only ADMIN and SUPER_ADMIN can update configurations
    if (!['ADMIN', 'SUPER_ADMIN'].includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para modificar configuraciones'
      }, { status: 403 })
    }

    // Verify configuration exists and belongs to company
    const existingCheck = await db.query(
      'SELECT id FROM print_configurations WHERE id = $1 AND company_id = $2',
      [configId, payload.companyId]
    )
    if (existingCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Configuración no encontrada'
      }, { status: 404 })
    }

    const body = await request.json()
    const { printServiceId, printerId, copies, autoPrint, priority, isActive } = body

    // Build update query
    const updates: string[] = []
    const updateParams: (string | number | boolean)[] = []
    let paramIndex = 1

    if (printServiceId !== undefined) {
      // Verify service belongs to company
      const serviceCheck = await db.query(
        'SELECT id FROM print_services WHERE id = $1 AND company_id = $2',
        [printServiceId, payload.companyId]
      )
      if (serviceCheck.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Servicio de impresión no encontrado'
        }, { status: 400 })
      }
      updates.push(`print_service_id = $${paramIndex}`)
      updateParams.push(printServiceId)
      paramIndex++
    }

    if (printerId !== undefined) {
      // Verify printer belongs to service
      const printerCheck = await db.query(`
        SELECT psp.id FROM print_service_printers psp
        JOIN print_services ps ON psp.print_service_id = ps.id
        WHERE psp.id = $1 AND ps.company_id = $2
      `, [printerId, payload.companyId])
      if (printerCheck.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Impresora no encontrada'
        }, { status: 400 })
      }
      updates.push(`printer_id = $${paramIndex}`)
      updateParams.push(printerId)
      paramIndex++
    }

    if (copies !== undefined) {
      updates.push(`copies = $${paramIndex}`)
      updateParams.push(Math.max(1, Math.min(copies, 10)))
      paramIndex++
    }

    if (autoPrint !== undefined) {
      updates.push(`auto_print = $${paramIndex}`)
      updateParams.push(autoPrint)
      paramIndex++
    }

    if (priority !== undefined) {
      updates.push(`priority = $${paramIndex}`)
      updateParams.push(priority)
      paramIndex++
    }

    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex}`)
      updateParams.push(isActive)
      paramIndex++
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay campos para actualizar'
      }, { status: 400 })
    }

    updates.push(`updated_at = NOW()`)
    updateParams.push(configId)

    await db.query(`
      UPDATE print_configurations
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `, updateParams)

    console.log(`[Print Config] Updated config ${configId}`)

    return NextResponse.json({
      success: true,
      message: 'Configuración actualizada correctamente'
    })

  } catch (error) {
    console.error('[Print Configurations API] Error updating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar configuración'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/print/configurations/[id]
 * Delete a print configuration
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const configId = parseInt(id)

    if (isNaN(configId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

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

    // Only ADMIN and SUPER_ADMIN can delete configurations
    if (!['ADMIN', 'SUPER_ADMIN'].includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para eliminar configuraciones'
      }, { status: 403 })
    }

    // Verify configuration exists and belongs to company
    const result = await db.query(
      'DELETE FROM print_configurations WHERE id = $1 AND company_id = $2 RETURNING id',
      [configId, payload.companyId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Configuración no encontrada'
      }, { status: 404 })
    }

    console.log(`[Print Config] Deleted config ${configId}`)

    return NextResponse.json({
      success: true,
      message: 'Configuración eliminada correctamente'
    })

  } catch (error) {
    console.error('[Print Configurations API] Error deleting:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar configuración'
    }, { status: 500 })
  }
}
