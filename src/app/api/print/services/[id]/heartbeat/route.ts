import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/database'

interface PrinterInfo {
  printerName: string
  printerId?: string
  driverName?: string
  printerType?: string
  connectionType?: string
  networkAddress?: string
  supportsEscpos?: boolean
  supportsRaw?: boolean
  paperWidthMm?: number
  dpi?: number
}

interface HeartbeatRequest {
  printerStatuses?: { printerId: number; isOnline: boolean }[]
  printers?: PrinterInfo[]
}

function getSupportedDocumentTypes(printerType: string, printerName: string): string[] {
  const ALL_TYPES = [
    'pos_receipt', 'product_label', 'weight_label', 'lot_label', 'invoice',
    'purchase_invoice', 'sales_report', 'inventory_count_report', 'cash_register_report',
    'shipping_label', 'warehouse_operation', 'consignment_receipt', 'unified_reception',
    'transfer_receipt', 'audit_count_report'
  ]

  if (printerType === 'label_barcode' || printerType === 'label_4x6') {
    return ['product_label', 'weight_label', 'lot_label', 'shipping_label']
  }

  const nameLower = printerName.toLowerCase()
  if (nameLower.includes('zebra') || nameLower.includes('dymo') ||
      nameLower.includes('brother') || nameLower.includes('label') ||
      nameLower.includes('zd') || nameLower.includes('ztc') ||
      nameLower.includes('tsc') || nameLower.includes('godex')) {
    return ['product_label', 'weight_label', 'lot_label', 'shipping_label']
  }

  if (printerType === 'thermal_80mm') {
    return [
      'pos_receipt', 'invoice', 'purchase_invoice', 'sales_report',
      'inventory_count_report', 'cash_register_report', 'consignment_receipt',
      'unified_reception', 'transfer_receipt', 'audit_count_report'
    ]
  }

  return ALL_TYPES
}

async function findService(idOrCode: string): Promise<number | null> {
  const numericId = parseInt(idOrCode)
  if (!isNaN(numericId)) {
    const result = await db.query('SELECT id FROM print_services WHERE id = $1', [numericId])
    if (result.rows.length > 0) return result.rows[0].id
  }
  const result = await db.query('SELECT id FROM print_services WHERE service_code = $1', [idOrCode])
  if (result.rows.length > 0) return result.rows[0].id
  return null
}

async function verifyCredentials(authHeader: string | null, serviceId: number): Promise<{ valid: boolean; error?: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid Authorization header' }
  }
  const credentials = authHeader.substring(7)
  const [apiKey, apiSecret] = credentials.split(':')
  if (!apiKey || !apiSecret) {
    return { valid: false, error: 'Invalid credential format' }
  }
  const apiSecretHash = crypto.createHash('sha256').update(apiSecret).digest('hex')
  const result = await db.query(
    'SELECT id FROM print_services WHERE id = $1 AND api_key = $2 AND api_secret_hash = $3',
    [serviceId, apiKey, apiSecretHash]
  )
  if (result.rows.length === 0) {
    return { valid: false, error: 'Invalid API credentials' }
  }
  return { valid: true }
}

/**
 * POST /api/print/services/[id]/heartbeat
 * Called periodically by Electron app to maintain connection and update printer status
 * Now also accepts printers array to sync printers on every heartbeat
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const serviceId = await findService(id)

    if (!serviceId) {
      return NextResponse.json({ success: false, error: 'Servicio no encontrado' }, { status: 404 })
    }

    const authHeader = request.headers.get('Authorization')
    const verification = await verifyCredentials(authHeader, serviceId)
    if (!verification.valid) {
      return NextResponse.json({ success: false, error: verification.error }, { status: 401 })
    }

    const forwarded = request.headers.get('x-forwarded-for')
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown'

    await db.query(`
      UPDATE print_services SET
        last_seen_at = NOW(),
        last_ip_address = $1,
        status = CASE WHEN status IN ('offline', 'pending') THEN 'active' ELSE status END
      WHERE id = $2
    `, [clientIp, serviceId])

    const body: HeartbeatRequest = await request.json().catch(() => ({}))

    // Update individual printer statuses if provided
    if (body.printerStatuses && Array.isArray(body.printerStatuses)) {
      for (const status of body.printerStatuses) {
        if (typeof status.printerId === 'number' && typeof status.isOnline === 'boolean') {
          await db.query(`
            UPDATE print_service_printers SET
              is_online = $1,
              last_status_check = NOW()
            WHERE id = $2 AND print_service_id = $3
          `, [status.isOnline, status.printerId, serviceId])
        }
      }
    }

    // Sync printers if provided (fallback mechanism)
    if (body.printers && Array.isArray(body.printers) && body.printers.length > 0) {
      // Check how many printers we have in DB
      const existingCount = await db.query(
        'SELECT COUNT(*) as count FROM print_service_printers WHERE print_service_id = $1',
        [serviceId]
      )
      const dbCount = parseInt(existingCount.rows[0]?.count) || 0

      // Only sync if DB has fewer printers than client reports
      if (dbCount < body.printers.length) {
        console.log(`[Heartbeat] DB has ${dbCount} printers but client reports ${body.printers.length} — syncing`)

        const existingPrinters = await db.query(
          'SELECT id, printer_name FROM print_service_printers WHERE print_service_id = $1',
          [serviceId]
        )
        const existingNames = new Set(existingPrinters.rows.map((p: any) => p.printer_name))

        for (const printer of body.printers) {
          if (!existingNames.has(printer.printerName)) {
            const supportedTypes = getSupportedDocumentTypes(
              printer.printerType || 'standard',
              printer.printerName
            )

            console.log(`[Heartbeat] Inserting missing printer: "${printer.printerName}"`)
            await db.query(`
              INSERT INTO print_service_printers (
                print_service_id, printer_name, printer_id, driver_name,
                printer_type, connection_type, network_address,
                is_online, last_status_check,
                supports_escpos, supports_raw, paper_width_mm, dpi,
                supported_document_types, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), $8, $9, $10, $11, $12, NOW(), NOW())
            `, [
              serviceId,
              printer.printerName,
              printer.printerId || null,
              printer.driverName || null,
              printer.printerType || 'standard',
              printer.connectionType || 'usb',
              printer.networkAddress || null,
              printer.supportsEscpos || false,
              printer.supportsRaw || false,
              printer.paperWidthMm || null,
              printer.dpi || null,
              JSON.stringify(supportedTypes)
            ])
          }
        }
      }
    }

    // Get count of pending jobs
    const pendingJobsResult = await db.query(
      "SELECT COUNT(*) as count FROM print_jobs WHERE print_service_id = $1 AND status IN ('pending', 'sent')",
      [serviceId]
    )
    const pendingJobs = parseInt(pendingJobsResult.rows[0]?.count) || 0

    const urgentJobsResult = await db.query(
      "SELECT COUNT(*) as count FROM print_jobs WHERE print_service_id = $1 AND status = 'pending' AND priority > 0",
      [serviceId]
    )
    const urgentJobs = parseInt(urgentJobsResult.rows[0]?.count) || 0

    // Return how many printers server has so client knows if sync is needed
    const printerCountResult = await db.query(
      'SELECT COUNT(*) as count FROM print_service_printers WHERE print_service_id = $1',
      [serviceId]
    )
    const serverPrinterCount = parseInt(printerCountResult.rows[0]?.count) || 0

    return NextResponse.json({
      success: true,
      data: {
        nextPoll: urgentJobs > 0 ? 1000 : 5000,
        pendingJobs,
        urgentJobs,
        serverPrinterCount
      }
    })

  } catch (error) {
    console.error('[Print Service Heartbeat] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error en heartbeat'
    }, { status: 500 })
  }
}
