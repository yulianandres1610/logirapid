import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/database'

interface PrinterInfo {
  printerName: string
  printerId?: string
  driverName?: string
  printerType?: 'thermal_80mm' | 'label_4x6' | 'label_barcode' | 'standard'
  connectionType?: 'usb' | 'network' | 'bluetooth'
  networkAddress?: string
  supportsEscpos?: boolean
  supportsRaw?: boolean
  paperWidthMm?: number
  dpi?: number
}

/**
 * Get supported document types based on printer type
 */
function getSupportedDocumentTypes(printerType: string, printerName: string): string[] {
  // All document types that exist in the system
  const ALL_TYPES = [
    'pos_receipt', 'product_label', 'weight_label', 'lot_label', 'invoice',
    'purchase_invoice', 'sales_report', 'inventory_count_report', 'cash_register_report',
    'shipping_label', 'warehouse_operation', 'consignment_receipt', 'unified_reception',
    'transfer_receipt', 'audit_count_report'
  ]

  // Label printers (Zebra, Dymo, etc.) - for labels and barcodes
  if (printerType === 'label_barcode' || printerType === 'label_4x6') {
    return ['product_label', 'weight_label', 'lot_label', 'shipping_label']
  }

  // Check by printer name for label printers
  const nameLower = printerName.toLowerCase()
  if (nameLower.includes('zebra') || nameLower.includes('dymo') ||
      nameLower.includes('brother') || nameLower.includes('label') ||
      nameLower.includes('etiqueta') || nameLower.includes('zd') ||
      nameLower.includes('ztc') || nameLower.includes('tsc') ||
      nameLower.includes('godex') || nameLower.includes('honeywell') ||
      nameLower.includes('sato') || nameLower.includes('citizen') ||
      nameLower.includes('postek')) {
    return ['product_label', 'weight_label', 'lot_label', 'shipping_label']
  }

  // Thermal receipt printers (80mm) - for receipts and reports
  if (printerType === 'thermal_80mm') {
    return [
      'pos_receipt', 'invoice', 'purchase_invoice', 'sales_report',
      'inventory_count_report', 'cash_register_report', 'consignment_receipt',
      'unified_reception', 'transfer_receipt', 'audit_count_report'
    ]
  }

  // Standard printers support everything
  return ALL_TYPES
}

interface RegisterRequest {
  platform: 'windows' | 'macos' | 'linux'
  hostname: string
  version: string
  printers: PrinterInfo[]
}

/**
 * Find service by ID (numeric) or service_code (string like PRS-2025-0001)
 */
async function findService(idOrCode: string): Promise<number | null> {
  // Try as numeric ID first
  const numericId = parseInt(idOrCode)
  if (!isNaN(numericId)) {
    const result = await db.query('SELECT id FROM print_services WHERE id = $1', [numericId])
    if (result.rows.length > 0) {
      return result.rows[0].id
    }
  }

  // Try as service_code (e.g., PRS-2025-0001)
  const result = await db.query('SELECT id FROM print_services WHERE service_code = $1', [idOrCode])
  if (result.rows.length > 0) {
    return result.rows[0].id
  }

  return null
}

/**
 * Verify API credentials from Authorization header
 * Format: Bearer apiKey:apiSecret
 */
async function verifyCredentials(
  authHeader: string | null,
  serviceId: number
): Promise<{ valid: boolean; error?: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid Authorization header' }
  }

  const credentials = authHeader.substring(7) // Remove 'Bearer '
  const [apiKey, apiSecret] = credentials.split(':')

  if (!apiKey || !apiSecret) {
    return { valid: false, error: 'Invalid credential format. Expected apiKey:apiSecret' }
  }

  // Verify API key and secret hash match
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
 * POST /api/print/services/[id]/register
 * Called by Electron app when it starts to register/update its status and printers
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Find service by ID or service_code
    const serviceId = await findService(id)

    if (!serviceId) {
      return NextResponse.json({ success: false, error: 'Servicio no encontrado' }, { status: 404 })
    }

    // Verify API credentials
    const authHeader = request.headers.get('Authorization')
    const verification = await verifyCredentials(authHeader, serviceId)

    if (!verification.valid) {
      return NextResponse.json({
        success: false,
        error: verification.error
      }, { status: 401 })
    }

    const body: RegisterRequest = await request.json()
    const { platform, hostname, version, printers } = body

    // Validate required fields
    if (!platform || !hostname || !version) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: platform, hostname, version'
      }, { status: 400 })
    }

    // Get client IP
    const forwarded = request.headers.get('x-forwarded-for')
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown'

    // Update service status
    await db.query(`
      UPDATE print_services SET
        status = 'active',
        last_seen_at = NOW(),
        last_ip_address = $1,
        platform = $2,
        hostname = $3,
        version = $4,
        updated_at = NOW()
      WHERE id = $5
    `, [clientIp, platform, hostname, version, serviceId])

    // Update printers
    if (printers && Array.isArray(printers)) {
      console.log(`[Print Service Register] Received ${printers.length} printers from client:`)
      printers.forEach((p, i) => console.log(`  [${i + 1}] "${p.printerName}" (id: ${p.printerId}, type: ${p.printerType})`))

      // Get existing printers
      const existingPrinters = await db.query(
        'SELECT id, printer_name FROM print_service_printers WHERE print_service_id = $1',
        [serviceId]
      )
      console.log(`[Print Service Register] Existing printers in DB: ${existingPrinters.rows.length}`)
      existingPrinters.rows.forEach((p, i) => console.log(`  [${i + 1}] "${p.printer_name}" (id: ${p.id})`))

      const existingNames = new Set(existingPrinters.rows.map(p => p.printer_name))
      const newNames = new Set(printers.map(p => p.printerName))

      // Remove printers that no longer exist
      for (const existing of existingPrinters.rows) {
        if (!newNames.has(existing.printer_name)) {
          console.log(`[Print Service Register] Removing printer: "${existing.printer_name}"`)
          await db.query('DELETE FROM print_service_printers WHERE id = $1', [existing.id])
        }
      }

      // Add or update printers
      for (const printer of printers) {
        // Determine supported document types based on printer type and name
        const supportedTypes = getSupportedDocumentTypes(
          printer.printerType || 'standard',
          printer.printerName
        )
        const supportedTypesJson = JSON.stringify(supportedTypes)

        if (existingNames.has(printer.printerName)) {
          console.log(`[Print Service Register] Updating printer: "${printer.printerName}" with types: ${supportedTypes.join(', ')}`)
          // Update existing printer including supported_document_types
          await db.query(`
            UPDATE print_service_printers SET
              printer_id = $1,
              driver_name = $2,
              printer_type = $3,
              connection_type = $4,
              network_address = $5,
              is_online = true,
              last_status_check = NOW(),
              supports_escpos = $6,
              supports_raw = $7,
              paper_width_mm = $8,
              dpi = $9,
              supported_document_types = $10,
              updated_at = NOW()
            WHERE print_service_id = $11 AND printer_name = $12
          `, [
            printer.printerId || null,
            printer.driverName || null,
            printer.printerType || 'standard',
            printer.connectionType || 'usb',
            printer.networkAddress || null,
            printer.supportsEscpos || false,
            printer.supportsRaw || false,
            printer.paperWidthMm || null,
            printer.dpi || null,
            supportedTypesJson,
            serviceId,
            printer.printerName
          ])
        } else {
          console.log(`[Print Service Register] Inserting NEW printer: "${printer.printerName}" with types: ${supportedTypes.join(', ')}`)
          // Insert new printer with supported_document_types
          await db.query(`
            INSERT INTO print_service_printers (
              print_service_id,
              printer_name,
              printer_id,
              driver_name,
              printer_type,
              connection_type,
              network_address,
              is_online,
              last_status_check,
              supports_escpos,
              supports_raw,
              paper_width_mm,
              dpi,
              supported_document_types,
              created_at,
              updated_at
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
            supportedTypesJson
          ])
        }
      }

      // Verify what's in DB now
      const finalPrinters = await db.query(
        'SELECT id, printer_name FROM print_service_printers WHERE print_service_id = $1',
        [serviceId]
      )
      console.log(`[Print Service Register] Final printers in DB: ${finalPrinters.rows.length}`)
      finalPrinters.rows.forEach((p, i) => console.log(`  [${i + 1}] "${p.printer_name}" (id: ${p.id})`))
    }

    // Get count of pending jobs for this service
    const pendingJobsResult = await db.query(
      "SELECT COUNT(*) as count FROM print_jobs WHERE print_service_id = $1 AND status IN ('pending', 'sent')",
      [serviceId]
    )
    const pendingJobs = parseInt(pendingJobsResult.rows[0]?.count) || 0

    console.log(`[Print Service Register] Service ${serviceId} registered from ${clientIp}, ${printers?.length || 0} printers, ${pendingJobs} pending jobs`)

    return NextResponse.json({
      success: true,
      data: {
        serviceId,
        status: 'active',
        registeredAt: new Date().toISOString(),
        configuration: {
          pollInterval: 5000, // 5 seconds
          heartbeatInterval: 30000, // 30 seconds
          jobEndpoint: `/api/print/jobs/pending?serviceId=${serviceId}`,
          statusEndpoint: `/api/print/jobs/{jobId}/status`,
          webhookEndpoint: '/api/webhooks/print'
        },
        pendingJobs
      },
      message: 'Servicio registrado correctamente'
    })

  } catch (error) {
    console.error('[Print Service Register] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al registrar servicio'
    }, { status: 500 })
  }
}
