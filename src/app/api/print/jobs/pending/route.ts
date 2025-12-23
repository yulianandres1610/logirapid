import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/database'

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
): Promise<{ valid: boolean; error?: string; companyId?: number }> {
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
    'SELECT id, company_id FROM print_services WHERE id = $1 AND api_key = $2 AND api_secret_hash = $3 AND status = $4',
    [serviceId, apiKey, apiSecretHash, 'active']
  )

  if (result.rows.length === 0) {
    return { valid: false, error: 'Invalid API credentials or service not active' }
  }

  return { valid: true, companyId: result.rows[0].company_id }
}

/**
 * GET /api/print/jobs/pending
 * Get pending jobs for a print service (called by Electron app)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    // Accept both serviceId and serviceCode for backwards compatibility
    const serviceIdParam = searchParams.get('serviceId') || searchParams.get('serviceCode')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)

    if (!serviceIdParam) {
      return NextResponse.json({
        success: false,
        error: 'serviceId or serviceCode is required'
      }, { status: 400 })
    }

    // Find service by ID or code
    const serviceId = await findService(serviceIdParam)

    if (!serviceId) {
      return NextResponse.json({ success: false, error: 'Service not found' }, { status: 404 })
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

    // Get pending jobs for this service
    // Also include jobs without a specific service that belong to the same company
    const result = await db.query(`
      SELECT
        pj.id,
        pj.job_number,
        pj.document_type,
        pj.source_type,
        pj.source_id,
        pj.document_data,
        pj.copies,
        pj.priority,
        pj.printer_id,
        psp.printer_name
      FROM print_jobs pj
      LEFT JOIN print_service_printers psp ON pj.printer_id = psp.id
      WHERE pj.status = 'pending'
        AND pj.attempts < pj.max_attempts
        AND (pj.print_service_id = $1 OR (pj.print_service_id IS NULL AND pj.company_id = $2))
      ORDER BY pj.priority DESC, pj.created_at ASC
      LIMIT $3
    `, [serviceId, verification.companyId, limit])

    // Mark jobs as sent
    if (result.rows.length > 0) {
      const jobIds = result.rows.map(j => j.id)
      await db.query(`
        UPDATE print_jobs
        SET status = 'sent', sent_at = NOW(), print_service_id = $1
        WHERE id = ANY($2)
      `, [serviceId, jobIds])

      // Log sent events
      for (const job of result.rows) {
        await db.query(`
          INSERT INTO print_job_history (print_job_id, event_type, event_data, created_at)
          VALUES ($1, 'sent', $2, NOW())
        `, [job.id, JSON.stringify({ serviceId })])
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        jobs: result.rows.map(j => ({
          id: j.id,
          jobNumber: j.job_number,
          documentType: j.document_type,
          sourceType: j.source_type,
          sourceId: j.source_id,
          documentData: j.document_data,
          copies: j.copies,
          priority: j.priority,
          printerId: j.printer_id,
          printerName: j.printer_name
        }))
      }
    })

  } catch (error) {
    console.error('[Print Jobs Pending API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener trabajos pendientes'
    }, { status: 500 })
  }
}
