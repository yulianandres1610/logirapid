import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/database'

interface PrinterStatus {
  printerId: number
  isOnline: boolean
}

interface HeartbeatRequest {
  printerStatuses?: PrinterStatus[]
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
 */
async function verifyCredentials(
  authHeader: string | null,
  serviceId: number
): Promise<{ valid: boolean; error?: string }> {
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

    // Get client IP
    const forwarded = request.headers.get('x-forwarded-for')
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown'

    // Update service last_seen_at and activate if pending/offline
    await db.query(`
      UPDATE print_services SET
        last_seen_at = NOW(),
        last_ip_address = $1,
        status = CASE WHEN status IN ('offline', 'pending') THEN 'active' ELSE status END
      WHERE id = $2
    `, [clientIp, serviceId])

    // Update printer statuses if provided
    const body: HeartbeatRequest = await request.json().catch(() => ({}))

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

    // Get count of pending jobs
    const pendingJobsResult = await db.query(
      "SELECT COUNT(*) as count FROM print_jobs WHERE print_service_id = $1 AND status IN ('pending', 'sent')",
      [serviceId]
    )
    const pendingJobs = parseInt(pendingJobsResult.rows[0]?.count) || 0

    // Check for any urgent jobs (high priority)
    const urgentJobsResult = await db.query(
      "SELECT COUNT(*) as count FROM print_jobs WHERE print_service_id = $1 AND status = 'pending' AND priority > 0",
      [serviceId]
    )
    const urgentJobs = parseInt(urgentJobsResult.rows[0]?.count) || 0

    return NextResponse.json({
      success: true,
      data: {
        nextPoll: urgentJobs > 0 ? 1000 : 5000, // Poll faster if urgent jobs
        pendingJobs,
        urgentJobs
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
