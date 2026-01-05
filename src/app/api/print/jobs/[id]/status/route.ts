import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/database'

interface StatusUpdate {
  status: 'printing' | 'completed' | 'failed'
  errorMessage?: string
  errorCode?: string
}

/**
 * Verify API credentials from Authorization header
 */
async function verifyServiceCredentials(
  authHeader: string | null
): Promise<{ valid: boolean; error?: string; serviceId?: number }> {
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
    'SELECT id FROM print_services WHERE api_key = $1 AND api_secret_hash = $2 AND status = $3',
    [apiKey, apiSecretHash, 'active']
  )

  if (result.rows.length === 0) {
    return { valid: false, error: 'Invalid API credentials' }
  }

  return { valid: true, serviceId: result.rows[0].id }
}

/**
 * POST /api/print/jobs/[id]/status
 * Update the status of a print job (called by Electron app)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const jobId = parseInt(id)

    if (isNaN(jobId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    // Verify API credentials
    const authHeader = request.headers.get('Authorization')
    const verification = await verifyServiceCredentials(authHeader)

    if (!verification.valid) {
      return NextResponse.json({
        success: false,
        error: verification.error
      }, { status: 401 })
    }

    const body: StatusUpdate = await request.json()
    const { status, errorMessage, errorCode } = body

    // Validate status
    const validStatuses = ['printing', 'completed', 'failed']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({
        success: false,
        error: `Estado inválido. Válidos: ${validStatuses.join(', ')}`
      }, { status: 400 })
    }

    // Verify job belongs to this service
    const jobCheck = await db.query(
      'SELECT id, job_number, status as current_status, attempts FROM print_jobs WHERE id = $1 AND print_service_id = $2',
      [jobId, verification.serviceId]
    )

    if (jobCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Trabajo no encontrado o no pertenece a este servicio'
      }, { status: 404 })
    }

    const job = jobCheck.rows[0]

    // Build update query
    let updateQuery = 'UPDATE print_jobs SET status = $1'
    const updateParams: (string | number | null)[] = [status]
    let paramIndex = 2

    if (status === 'printing') {
      updateQuery += `, started_at = COALESCE(started_at, NOW())`
    }

    if (status === 'completed') {
      updateQuery += `, completed_at = NOW()`
    }

    if (status === 'failed') {
      updateQuery += `, attempts = attempts + 1`
      if (errorMessage) {
        updateQuery += `, error_message = $${paramIndex}`
        updateParams.push(errorMessage)
        paramIndex++
      }
      if (errorCode) {
        updateQuery += `, error_code = $${paramIndex}`
        updateParams.push(errorCode)
        paramIndex++
      }

      // Check if we should retry - update the first parameter instead of adding duplicate
      const newAttempts = job.attempts + 1
      if (newAttempts < 3) { // max_attempts default is 3
        updateParams[0] = 'pending' // Change status to pending for retry
      }
    }

    updateParams.push(jobId)
    updateQuery += ` WHERE id = $${paramIndex}`

    await db.query(updateQuery, updateParams)

    // Log status change
    await db.query(`
      INSERT INTO print_job_history (print_job_id, event_type, event_data, created_at)
      VALUES ($1, $2, $3, NOW())
    `, [
      jobId,
      status === 'failed' ? 'failed' : status === 'completed' ? 'completed' : 'printing',
      JSON.stringify({
        serviceId: verification.serviceId,
        previousStatus: job.current_status,
        newStatus: status,
        errorMessage,
        errorCode
      })
    ])

    console.log(`[Print Jobs] Job ${job.job_number} status updated to ${status}`)

    return NextResponse.json({
      success: true,
      data: {
        jobId,
        jobNumber: job.job_number,
        status: status === 'failed' && job.attempts + 1 < 3 ? 'pending' : status,
        willRetry: status === 'failed' && job.attempts + 1 < 3
      },
      message: 'Estado actualizado'
    })

  } catch (error) {
    console.error('[Print Jobs Status API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar estado'
    }, { status: 500 })
  }
}
