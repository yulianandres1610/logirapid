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
 * Generate a unique job number
 */
function generateJobNumber(): string {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
  return `PRJ-${year}-${random}`
}

/**
 * GET /api/print/jobs
 * List print jobs with filters
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
    const status = searchParams.get('status')
    const documentType = searchParams.get('documentType')
    const printServiceId = searchParams.get('printServiceId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    let query = `
      SELECT
        pj.id,
        pj.job_number,
        pj.document_type,
        pj.source_type,
        pj.source_id,
        pj.copies,
        pj.status,
        pj.attempts,
        pj.error_message,
        pj.created_at,
        pj.sent_at,
        pj.completed_at,
        ps.service_name,
        psp.printer_name,
        u.email as requested_by_email
      FROM print_jobs pj
      LEFT JOIN print_services ps ON pj.print_service_id = ps.id
      LEFT JOIN print_service_printers psp ON pj.printer_id = psp.id
      LEFT JOIN users u ON pj.requested_by = u.id
      WHERE pj.company_id = $1
    `
    const params: (string | number)[] = [payload.companyId]
    let paramIndex = 2

    if (status) {
      query += ` AND pj.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    if (documentType) {
      query += ` AND pj.document_type = $${paramIndex}`
      params.push(documentType)
      paramIndex++
    }

    if (printServiceId) {
      query += ` AND pj.print_service_id = $${paramIndex}`
      params.push(parseInt(printServiceId))
      paramIndex++
    }

    // Count total
    const countQuery = query.replace(/SELECT[\s\S]+FROM/, 'SELECT COUNT(*) as total FROM')
    const countResult = await db.query(countQuery, params)
    const total = parseInt(countResult.rows[0]?.total) || 0

    // Add pagination
    query += ` ORDER BY pj.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    return NextResponse.json({
      success: true,
      data: {
        jobs: result.rows.map(j => ({
          id: j.id,
          jobNumber: j.job_number,
          documentType: j.document_type,
          sourceType: j.source_type,
          sourceId: j.source_id,
          copies: j.copies,
          status: j.status,
          attempts: j.attempts,
          errorMessage: j.error_message,
          serviceName: j.service_name,
          printerName: j.printer_name,
          requestedByEmail: j.requested_by_email,
          createdAt: j.created_at,
          sentAt: j.sent_at,
          completedAt: j.completed_at
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('[Print Jobs API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener trabajos de impresión'
    }, { status: 500 })
  }
}

/**
 * POST /api/print/jobs
 * Create a new print job
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

    const body = await request.json()
    const {
      documentType,
      sourceType,
      sourceId,
      documentData,
      copies = 1,
      priority = 0,
      printServiceId,
      printerId,
      posTerminalId,
      warehouseId
    } = body

    // Validate required fields
    if (!documentType || !documentData) {
      return NextResponse.json({
        success: false,
        error: 'documentType y documentData son requeridos'
      }, { status: 400 })
    }

    // Validate document type
    const validDocTypes = [
      'pos_receipt',           // Recibo de venta POS
      'shipping_label',        // Etiqueta de envío
      'product_label',         // Etiqueta de producto
      'lot_label',             // Etiqueta de lote 4x6 (recepción consignación/compra)
      'invoice',               // Factura general
      'purchase_invoice',      // Factura de compra
      'sales_report',          // Reporte de ventas
      'inventory_count_report', // Reporte de conteo de inventario
      'cash_register_report',  // Reporte de caja/arqueo
      'warehouse_operation',   // Operación de almacén (recepción, transferencia, scrap, ajuste)
      'consignment_receipt',   // Recibo de orden de consignación para almacén
      'unified_reception'      // Recibo de recepción unificada (consignación/compra)
    ]
    if (!validDocTypes.includes(documentType)) {
      return NextResponse.json({
        success: false,
        error: `Tipo de documento inválido. Válidos: ${validDocTypes.join(', ')}`
      }, { status: 400 })
    }

    // Resolve printer configuration if not explicitly provided
    let resolvedServiceId = printServiceId
    let resolvedPrinterId = printerId

    if (!resolvedServiceId || !resolvedPrinterId) {
      // Try to find configuration by priority: terminal > warehouse > company
      let configQuery = `
        SELECT print_service_id, printer_id
        FROM print_configurations
        WHERE company_id = $1 AND document_type = $2 AND is_active = true
      `
      const configParams: (string | number)[] = [payload.companyId, documentType]
      let paramIndex = 3

      if (posTerminalId) {
        configQuery += ` AND (pos_terminal_id = $${paramIndex} OR pos_terminal_id IS NULL)`
        configParams.push(posTerminalId)
        paramIndex++
      }

      if (warehouseId) {
        configQuery += ` AND (warehouse_id = $${paramIndex} OR warehouse_id IS NULL)`
        configParams.push(warehouseId)
        paramIndex++
      }

      configQuery += ' ORDER BY priority DESC, pos_terminal_id DESC NULLS LAST, warehouse_id DESC NULLS LAST LIMIT 1'

      const configResult = await db.query(configQuery, configParams)

      if (configResult.rows.length > 0) {
        resolvedServiceId = resolvedServiceId || configResult.rows[0].print_service_id
        resolvedPrinterId = resolvedPrinterId || configResult.rows[0].printer_id
      }
    }

    // Verify service belongs to company if provided
    if (resolvedServiceId) {
      const serviceCheck = await db.query(
        'SELECT id FROM print_services WHERE id = $1 AND company_id = $2 AND status = $3',
        [resolvedServiceId, payload.companyId, 'active']
      )
      if (serviceCheck.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Servicio de impresión no encontrado o no está activo'
        }, { status: 400 })
      }
    }

    // Generate unique job number
    let jobNumber = generateJobNumber()
    let attempts = 0
    while (attempts < 10) {
      const existing = await db.query('SELECT id FROM print_jobs WHERE job_number = $1', [jobNumber])
      if (existing.rows.length === 0) break
      jobNumber = generateJobNumber()
      attempts++
    }

    // Create the job
    const result = await db.query(`
      INSERT INTO print_jobs (
        job_number,
        company_id,
        print_service_id,
        printer_id,
        document_type,
        source_type,
        source_id,
        document_data,
        copies,
        priority,
        status,
        requested_by,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, NOW())
      RETURNING id
    `, [
      jobNumber,
      payload.companyId,
      resolvedServiceId || null,
      resolvedPrinterId || null,
      documentType,
      sourceType || null,
      sourceId || null,
      JSON.stringify(documentData),
      copies,
      priority,
      payload.userId
    ])

    const jobId = result.rows[0].id

    // Log job creation
    await db.query(`
      INSERT INTO print_job_history (print_job_id, event_type, event_data, created_at)
      VALUES ($1, 'created', $2, NOW())
    `, [jobId, JSON.stringify({ requestedBy: payload.email, documentType, copies })])

    console.log(`[Print Jobs] Created job ${jobNumber} for ${documentType}, service: ${resolvedServiceId || 'unassigned'}`)

    return NextResponse.json({
      success: true,
      data: {
        jobId,
        jobNumber,
        status: 'pending',
        printServiceId: resolvedServiceId,
        printerId: resolvedPrinterId
      },
      message: resolvedServiceId
        ? 'Trabajo de impresión creado'
        : 'Trabajo de impresión creado sin servicio asignado. Configure un servicio de impresión.'
    })

  } catch (error) {
    console.error('[Print Jobs API] Error creating job:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear trabajo de impresión'
    }, { status: 500 })
  }
}
