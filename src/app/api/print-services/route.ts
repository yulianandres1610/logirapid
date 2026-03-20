import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

async function authenticate(): Promise<{ payload: JWTPayload } | { error: NextResponse }> {
  const cookieStore = await cookies()
  const authToken = cookieStore.get('auth-token')?.value

  if (!authToken) {
    return {
      error: NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }
  }

  try {
    const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
    const payload = jwt.verify(authToken, secret) as JWTPayload
    return { payload }
  } catch {
    return {
      error: NextResponse.json({
        success: false,
        error: 'Token invalido'
      }, { status: 401 })
    }
  }
}

/**
 * GET /api/print-services
 * List print services for the user's company
 */
export async function GET() {
  try {
    const auth = await authenticate()
    if ('error' in auth) return auth.error
    const { payload } = auth

    const companyId = payload.companyId

    const result = await db.query(`
      SELECT
        ps.id, ps.company_id, ps.name, ps.pairing_token, ps.warehouse_id, ps.pos_terminal_id,
        ps.selected_printer, ps.printer_type, ps.agent_printers, ps.last_seen_at,
        ps.agent_version, ps.status, ps.created_at,
        mw.name as warehouse_name
      FROM print_services ps
      LEFT JOIN market_warehouses mw ON mw.id = ps.warehouse_id
      WHERE ps.company_id = $1
      ORDER BY ps.created_at DESC
    `, [companyId])

    const now = new Date()
    const services = result.rows.map(row => ({
      id: row.id,
      companyId: row.company_id,
      name: row.name,
      pairingToken: row.pairing_token,
      warehouseId: row.warehouse_id,
      posTerminalId: row.pos_terminal_id,
      selectedPrinter: row.selected_printer,
      printerType: row.printer_type,
      agentPrinters: row.agent_printers || [],
      lastSeenAt: row.last_seen_at,
      agentVersion: row.agent_version,
      status: row.status,
      warehouseName: row.warehouse_name || null,
      createdAt: row.created_at,
      online: row.last_seen_at
        ? (now.getTime() - new Date(row.last_seen_at).getTime()) < 30000
        : false
    }))

    return NextResponse.json({
      success: true,
      data: services
    })

  } catch (error) {
    console.error('[Print Services API] Error listing:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener servicios de impresion'
    }, { status: 500 })
  }
}

/**
 * POST /api/print-services
 * Create a new print service
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate()
    if ('error' in auth) return auth.error
    const { payload } = auth

    const companyId = payload.companyId
    const body = await request.json()
    const { name, warehouseId, posTerminalId, printerType } = body

    if (!name) {
      return NextResponse.json({
        success: false,
        error: 'El nombre es requerido'
      }, { status: 400 })
    }

    const pairingToken = crypto.randomUUID()

    const result = await db.query(`
      INSERT INTO print_services (
        company_id, name, pairing_token, warehouse_id, pos_terminal_id,
        printer_type, status, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 'active', NOW()
      ) RETURNING
        id, company_id, name, pairing_token, warehouse_id, pos_terminal_id,
        selected_printer, printer_type, agent_printers, last_seen_at,
        agent_version, status, created_at
    `, [
      companyId,
      name,
      pairingToken,
      warehouseId || null,
      posTerminalId || null,
      printerType || 'thermal_80mm'
    ])

    const row = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        companyId: row.company_id,
        name: row.name,
        pairingToken: row.pairing_token,
        warehouseId: row.warehouse_id,
        posTerminalId: row.pos_terminal_id,
        selectedPrinter: row.selected_printer,
        printerType: row.printer_type,
        agentPrinters: row.agent_printers || [],
        lastSeenAt: row.last_seen_at,
        agentVersion: row.agent_version,
        status: row.status,
        createdAt: row.created_at,
        online: false
      }
    })

  } catch (error) {
    console.error('[Print Services API] Error creating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear servicio de impresion'
    }, { status: 500 })
  }
}

/**
 * PUT /api/print-services
 * Update a print service
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await authenticate()
    if ('error' in auth) return auth.error
    const { payload } = auth

    const companyId = payload.companyId
    const body = await request.json()
    const { id, name, selectedPrinter, printerType, warehouseId, posTerminalId, status } = body

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'El ID es requerido'
      }, { status: 400 })
    }

    // Verify it belongs to the user's company
    const existing = await db.query(
      'SELECT id FROM print_services WHERE id = $1 AND company_id = $2',
      [id, companyId]
    )

    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Servicio de impresion no encontrado'
      }, { status: 404 })
    }

    // Build dynamic update
    const setClauses: string[] = []
    const params: (string | number | null)[] = []
    let paramIndex = 1

    if (name !== undefined) {
      setClauses.push(`name = $${paramIndex}`)
      params.push(name)
      paramIndex++
    }
    if (selectedPrinter !== undefined) {
      setClauses.push(`selected_printer = $${paramIndex}`)
      params.push(selectedPrinter)
      paramIndex++
    }
    if (printerType !== undefined) {
      setClauses.push(`printer_type = $${paramIndex}`)
      params.push(printerType)
      paramIndex++
    }
    if (warehouseId !== undefined) {
      setClauses.push(`warehouse_id = $${paramIndex}`)
      params.push(warehouseId || null)
      paramIndex++
    }
    if (posTerminalId !== undefined) {
      setClauses.push(`pos_terminal_id = $${paramIndex}`)
      params.push(posTerminalId || null)
      paramIndex++
    }
    if (status !== undefined) {
      setClauses.push(`status = $${paramIndex}`)
      params.push(status)
      paramIndex++
    }

    if (setClauses.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay campos para actualizar'
      }, { status: 400 })
    }

    params.push(id)
    params.push(companyId)

    const result = await db.query(`
      UPDATE print_services
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex} AND company_id = $${paramIndex + 1}
      RETURNING
        id, company_id, name, pairing_token, warehouse_id, pos_terminal_id,
        selected_printer, printer_type, agent_printers, last_seen_at,
        agent_version, status, created_at
    `, params)

    const row = result.rows[0]
    const now = new Date()

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        companyId: row.company_id,
        name: row.name,
        pairingToken: row.pairing_token,
        warehouseId: row.warehouse_id,
        posTerminalId: row.pos_terminal_id,
        selectedPrinter: row.selected_printer,
        printerType: row.printer_type,
        agentPrinters: row.agent_printers || [],
        lastSeenAt: row.last_seen_at,
        agentVersion: row.agent_version,
        status: row.status,
        createdAt: row.created_at,
        online: row.last_seen_at
          ? (now.getTime() - new Date(row.last_seen_at).getTime()) < 30000
          : false
      }
    })

  } catch (error) {
    console.error('[Print Services API] Error updating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar servicio de impresion'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/print-services?id=X
 * Delete a print service
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticate()
    if ('error' in auth) return auth.error
    const { payload } = auth

    const companyId = payload.companyId
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'El ID es requerido'
      }, { status: 400 })
    }

    // Verify it belongs to the user's company and delete
    const result = await db.query(
      'DELETE FROM print_services WHERE id = $1 AND company_id = $2 RETURNING id',
      [parseInt(id), companyId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Servicio de impresion no encontrado'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: { id: result.rows[0].id }
    })

  } catch (error) {
    console.error('[Print Services API] Error deleting:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar servicio de impresion'
    }, { status: 500 })
  }
}
