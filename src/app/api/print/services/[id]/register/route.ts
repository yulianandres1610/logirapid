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
      // Get existing printers
      const existingPrinters = await db.query(
        'SELECT id, printer_name FROM print_service_printers WHERE print_service_id = $1',
        [serviceId]
      )
      const existingNames = new Set(existingPrinters.rows.map(p => p.printer_name))
      const newNames = new Set(printers.map(p => p.printerName))

      // Remove printers that no longer exist
      for (const existing of existingPrinters.rows) {
        if (!newNames.has(existing.printer_name)) {
          await db.query('DELETE FROM print_service_printers WHERE id = $1', [existing.id])
        }
      }

      // Add or update printers
      for (const printer of printers) {
        if (existingNames.has(printer.printerName)) {
          // Update existing printer
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
              updated_at = NOW()
            WHERE print_service_id = $10 AND printer_name = $11
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
            serviceId,
            printer.printerName
          ])
        } else {
          // Insert new printer
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
              created_at,
              updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), $8, $9, $10, $11, NOW(), NOW())
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
            printer.dpi || null
          ])
        }
      }
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
