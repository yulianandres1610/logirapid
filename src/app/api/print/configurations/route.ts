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
 * GET /api/print/configurations
 * List print configurations with filters
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
    const warehouseId = searchParams.get('warehouseId')
    const posTerminalId = searchParams.get('posTerminalId')
    const printServiceId = searchParams.get('printServiceId')

    let query = `
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
        pc.printer_id,
        psp.printer_name
      FROM print_configurations pc
      LEFT JOIN market_warehouses mw ON pc.warehouse_id = mw.id
      LEFT JOIN market_pos_terminals mpt ON pc.pos_terminal_id = mpt.id
      LEFT JOIN print_services ps ON pc.print_service_id = ps.id
      LEFT JOIN print_service_printers psp ON pc.printer_id = psp.id
      WHERE pc.company_id = $1
    `
    const params: (string | number)[] = [payload.companyId]
    let paramIndex = 2

    if (documentType) {
      query += ` AND pc.document_type = $${paramIndex}`
      params.push(documentType)
      paramIndex++
    }

    if (warehouseId) {
      query += ` AND pc.warehouse_id = $${paramIndex}`
      params.push(parseInt(warehouseId))
      paramIndex++
    }

    if (posTerminalId) {
      query += ` AND pc.pos_terminal_id = $${paramIndex}`
      params.push(parseInt(posTerminalId))
      paramIndex++
    }

    if (printServiceId) {
      query += ` AND pc.print_service_id = $${paramIndex}`
      params.push(parseInt(printServiceId))
      paramIndex++
    }

    query += ' ORDER BY pc.priority DESC, pc.document_type ASC, pc.created_at DESC'

    const result = await db.query(query, params)

    return NextResponse.json({
      success: true,
      data: {
        configurations: result.rows.map(c => ({
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
          printerId: c.printer_id,
          printerName: c.printer_name,
          createdAt: c.created_at,
          updatedAt: c.updated_at
        }))
      }
    })

  } catch (error) {
    console.error('[Print Configurations API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener configuraciones'
    }, { status: 500 })
  }
}

/**
 * POST /api/print/configurations
 * Create a new print configuration
 */
export async function POST(request: NextRequest) {
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

    // Only ADMIN and SUPER_ADMIN can create configurations
    if (!['ADMIN', 'SUPER_ADMIN'].includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para crear configuraciones'
      }, { status: 403 })
    }

    const body = await request.json()
    const {
      documentType,
      printServiceId,
      printerId,
      warehouseId,
      posTerminalId,
      copies = 1,
      autoPrint = false,
      priority = 0
    } = body

    // Validate required fields
    if (!documentType || !printServiceId || !printerId) {
      return NextResponse.json({
        success: false,
        error: 'documentType, printServiceId y printerId son requeridos'
      }, { status: 400 })
    }

    // Validate document type
    const validDocTypes = ['pos_receipt', 'shipping_label', 'product_label', 'invoice']
    if (!validDocTypes.includes(documentType)) {
      return NextResponse.json({
        success: false,
        error: `Tipo de documento inválido. Válidos: ${validDocTypes.join(', ')}`
      }, { status: 400 })
    }

    // Verify print service belongs to company
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

    // Verify printer belongs to service
    const printerCheck = await db.query(
      'SELECT id FROM print_service_printers WHERE id = $1 AND print_service_id = $2',
      [printerId, printServiceId]
    )
    if (printerCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Impresora no encontrada en el servicio especificado'
      }, { status: 400 })
    }

    // Verify warehouse belongs to company if provided
    if (warehouseId) {
      const warehouseCheck = await db.query(
        'SELECT id FROM market_warehouses WHERE id = $1 AND company_id = $2',
        [warehouseId, payload.companyId]
      )
      if (warehouseCheck.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Almacén no encontrado'
        }, { status: 400 })
      }
    }

    // Verify terminal belongs to company if provided
    if (posTerminalId) {
      const terminalCheck = await db.query(
        'SELECT id FROM market_pos_terminals WHERE id = $1 AND company_id = $2',
        [posTerminalId, payload.companyId]
      )
      if (terminalCheck.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Terminal POS no encontrado'
        }, { status: 400 })
      }
    }

    // Check for duplicate configuration
    let duplicateQuery = `
      SELECT id FROM print_configurations
      WHERE company_id = $1 AND document_type = $2
    `
    const duplicateParams: (string | number | null)[] = [payload.companyId, documentType]
    let dupParamIndex = 3

    if (warehouseId) {
      duplicateQuery += ` AND warehouse_id = $${dupParamIndex}`
      duplicateParams.push(warehouseId)
      dupParamIndex++
    } else {
      duplicateQuery += ` AND warehouse_id IS NULL`
    }

    if (posTerminalId) {
      duplicateQuery += ` AND pos_terminal_id = $${dupParamIndex}`
      duplicateParams.push(posTerminalId)
    } else {
      duplicateQuery += ` AND pos_terminal_id IS NULL`
    }

    const duplicateCheck = await db.query(duplicateQuery, duplicateParams)
    if (duplicateCheck.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Ya existe una configuración para este tipo de documento y ubicación'
      }, { status: 400 })
    }

    // Create configuration
    const result = await db.query(`
      INSERT INTO print_configurations (
        company_id,
        document_type,
        print_service_id,
        printer_id,
        warehouse_id,
        pos_terminal_id,
        copies,
        auto_print,
        priority,
        is_active,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW())
      RETURNING id
    `, [
      payload.companyId,
      documentType,
      printServiceId,
      printerId,
      warehouseId || null,
      posTerminalId || null,
      copies,
      autoPrint,
      priority
    ])

    const configId = result.rows[0].id

    console.log(`[Print Config] Created config ${configId} for ${documentType}`)

    return NextResponse.json({
      success: true,
      data: { id: configId },
      message: 'Configuración creada correctamente'
    })

  } catch (error) {
    console.error('[Print Configurations API] Error creating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear configuración'
    }, { status: 500 })
  }
}
