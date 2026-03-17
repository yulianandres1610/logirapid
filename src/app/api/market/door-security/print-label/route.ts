import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * Generate a unique job number
 */
function generateJobNumber(): string {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
  return `PRJ-${year}-${random}`
}

/**
 * POST /api/market/door-security/print-label
 * Create a print job for product labels from kiosk
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { kioskId, guardId, items, copies = 1 } = body

    if (!kioskId || !guardId) {
      return NextResponse.json({
        success: false,
        error: 'kioskId y guardId son requeridos'
      }, { status: 400 })
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'items es requerido y debe contener al menos un producto'
      }, { status: 400 })
    }

    // Authenticate via kiosk + guard
    const kioskResult = await db.query(
      'SELECT companyid FROM market_door_kiosks WHERE id = $1 AND isactive = true',
      [kioskId]
    )
    if (kioskResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Kiosk no encontrado' }, { status: 401 })
    }

    const guardResult = await db.query(
      'SELECT id FROM market_door_guards WHERE employeeid = $1 AND isactive = true',
      [guardId]
    )
    if (guardResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Guardia no autorizado' }, { status: 401 })
    }

    const companyId = kioskResult.rows[0].companyid

    // Resolve print service: check print_configurations for product_label, then warehouse default
    let resolvedServiceId: number | null = null
    let resolvedPrinterId: number | null = null

    const configResult = await db.query(`
      SELECT print_service_id, printer_id
      FROM print_configurations
      WHERE company_id = $1 AND document_type = 'product_label' AND is_active = true
      ORDER BY priority DESC NULLS LAST
      LIMIT 1
    `, [companyId])

    if (configResult.rows.length > 0) {
      resolvedServiceId = configResult.rows[0].print_service_id
      resolvedPrinterId = configResult.rows[0].printer_id
    }

    // If no config found, try to find any active print service for this company
    if (!resolvedServiceId) {
      const serviceResult = await db.query(
        `SELECT id FROM print_services WHERE company_id = $1 AND status IN ('active', 'pending') ORDER BY id LIMIT 1`,
        [companyId]
      )
      if (serviceResult.rows.length > 0) {
        resolvedServiceId = serviceResult.rows[0].id
      }
    }

    // Verify service belongs to company
    if (resolvedServiceId) {
      const serviceCheck = await db.query(
        `SELECT id FROM print_services WHERE id = $1 AND company_id = $2 AND status IN ('active', 'pending')`,
        [resolvedServiceId, companyId]
      )
      if (serviceCheck.rows.length === 0) {
        resolvedServiceId = null
      }
    }

    // Build document data for the print service (matches ProductLabelData format)
    const documentData = {
      productName: items[0].name,
      sku: items[0].sku || '',
      barcode: items[0].barcode || '',
      price: items[0].price,
      currency: items[0].currency || 'USD',
      includePrice: items[0].price !== undefined && items[0].price !== null,
      items: items.map((item: any) => ({
        productName: item.name,
        sku: item.sku || '',
        barcode: item.barcode || '',
        price: item.price,
        currency: item.currency || 'USD',
        copies: copies,
      })),
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

    // Create the print job
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
      ) VALUES ($1, $2, $3, $4, 'product_label', 'kiosk', $5, $6, $7, 0, 'pending', $8, NOW())
      RETURNING id
    `, [
      jobNumber,
      companyId,
      resolvedServiceId || null,
      resolvedPrinterId || null,
      kioskId.toString(),
      JSON.stringify(documentData),
      copies,
      guardId,
    ])

    const jobId = result.rows[0].id

    // Log job creation
    try {
      await db.query(`
        INSERT INTO print_job_history (print_job_id, event_type, event_data, created_at)
        VALUES ($1, 'created', $2, NOW())
      `, [jobId, JSON.stringify({ source: 'door-kiosk', kioskId, guardId, itemCount: items.length, copies })])
    } catch {
      // History logging is not critical
    }

    console.log(`[Print Label - Kiosk] Created job ${jobNumber} for ${items.length} items, service: ${resolvedServiceId || 'unassigned'}`)

    return NextResponse.json({
      success: true,
      data: {
        jobId,
        jobNumber,
        status: 'pending',
        printServiceId: resolvedServiceId,
      },
      message: resolvedServiceId
        ? 'Etiqueta enviada a imprimir'
        : 'Trabajo creado pero no hay servicio de impresión configurado'
    })

  } catch (error) {
    console.error('[Print Label - Kiosk] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear trabajo de impresión'
    }, { status: 500 })
  }
}
