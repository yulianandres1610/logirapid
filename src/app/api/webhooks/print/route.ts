import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import crypto from 'crypto'

interface PrintWebhookEvent {
  type: string
  serviceId: number
  timestamp: string
  data: Record<string, unknown>
}

/**
 * POST /api/webhooks/print
 * Handle print service webhook events from Electron app
 *
 * Events handled:
 * - job.started: Print job started printing
 * - job.completed: Print job completed successfully
 * - job.failed: Print job failed
 * - printer.online: Printer came online
 * - printer.offline: Printer went offline
 * - service.connected: Print service connected
 * - service.disconnected: Print service disconnected
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-print-signature')
    const apiKey = request.headers.get('x-api-key')

    console.log('[Print Webhook] Received event')

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing API key'
      }, { status: 401 })
    }

    // Find service by API key
    const serviceResult = await db.query(
      'SELECT id, company_id, api_secret_hash, service_name FROM print_services WHERE api_key = $1',
      [apiKey]
    )

    if (serviceResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Invalid API key'
      }, { status: 401 })
    }

    const service = serviceResult.rows[0]

    // Verify HMAC signature if provided
    if (signature) {
      const isValid = verifyPrintSignature(body, signature, service.api_secret_hash)
      if (!isValid) {
        console.error('[Print Webhook] Invalid signature for service:', service.id)
        return NextResponse.json({
          success: false,
          error: 'Invalid signature'
        }, { status: 401 })
      }
    }

    const event: PrintWebhookEvent = JSON.parse(body)

    console.log(`[Print Webhook] Service ${service.service_name} - Event: ${event.type}`)

    // Handle different event types
    switch (event.type) {
      case 'job.started':
        await handleJobStarted(event, service.id)
        break

      case 'job.completed':
        await handleJobCompleted(event, service.id)
        break

      case 'job.failed':
        await handleJobFailed(event, service.id)
        break

      case 'printer.online':
        await handlePrinterOnline(event, service.id)
        break

      case 'printer.offline':
        await handlePrinterOffline(event, service.id)
        break

      case 'service.connected':
        await handleServiceConnected(service.id)
        break

      case 'service.disconnected':
        await handleServiceDisconnected(service.id)
        break

      case 'batch.completed':
        await handleBatchCompleted(event, service.id)
        break

      default:
        console.log('[Print Webhook] Unhandled event type:', event.type)
    }

    return NextResponse.json({
      success: true,
      message: 'Event processed'
    })

  } catch (error) {
    console.error('[Print Webhook] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Webhook processing error'
    }, { status: 500 })
  }
}

/**
 * Verify print service webhook signature using HMAC SHA256
 * The signature is: HMAC-SHA256(body, apiSecretHash)
 */
function verifyPrintSignature(
  body: string,
  signature: string,
  apiSecretHash: string
): boolean {
  try {
    const hmac = crypto.createHmac('sha256', apiSecretHash)
    hmac.update(body)
    const expectedSignature = hmac.digest('hex')

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  } catch (error) {
    console.error('[Print Webhook] Signature verification error:', error)
    return false
  }
}

/**
 * Handle job.started event - Mark job as printing
 */
async function handleJobStarted(event: PrintWebhookEvent, serviceId: number) {
  const { jobId, printerId } = event.data as { jobId: number; printerId?: number }

  if (!jobId) {
    console.error('[Print Webhook] job.started missing jobId')
    return
  }

  // Update job status
  await db.query(`
    UPDATE print_jobs
    SET status = 'printing', started_at = COALESCE(started_at, NOW())
    WHERE id = $1 AND print_service_id = $2
  `, [jobId, serviceId])

  // Log event
  await db.query(`
    INSERT INTO print_job_history (print_job_id, event_type, event_data, created_at)
    VALUES ($1, 'printing', $2, NOW())
  `, [jobId, JSON.stringify({ serviceId, printerId, source: 'webhook' })])

  console.log(`[Print Webhook] Job ${jobId} started printing`)
}

/**
 * Handle job.completed event - Mark job as completed
 */
async function handleJobCompleted(event: PrintWebhookEvent, serviceId: number) {
  const { jobId, printerId, duration } = event.data as {
    jobId: number
    printerId?: number
    duration?: number
  }

  if (!jobId) {
    console.error('[Print Webhook] job.completed missing jobId')
    return
  }

  // Update job status
  await db.query(`
    UPDATE print_jobs
    SET status = 'completed', completed_at = NOW()
    WHERE id = $1 AND print_service_id = $2
  `, [jobId, serviceId])

  // Log event
  await db.query(`
    INSERT INTO print_job_history (print_job_id, event_type, event_data, created_at)
    VALUES ($1, 'completed', $2, NOW())
  `, [jobId, JSON.stringify({ serviceId, printerId, duration, source: 'webhook' })])

  console.log(`[Print Webhook] Job ${jobId} completed`)
}

/**
 * Handle job.failed event - Mark job as failed with retry logic
 */
async function handleJobFailed(event: PrintWebhookEvent, serviceId: number) {
  const { jobId, printerId, errorMessage, errorCode } = event.data as {
    jobId: number
    printerId?: number
    errorMessage?: string
    errorCode?: string
  }

  if (!jobId) {
    console.error('[Print Webhook] job.failed missing jobId')
    return
  }

  // Get current attempt count
  const jobResult = await db.query(
    'SELECT attempts, max_attempts FROM print_jobs WHERE id = $1 AND print_service_id = $2',
    [jobId, serviceId]
  )

  if (jobResult.rows.length === 0) {
    console.error('[Print Webhook] Job not found:', jobId)
    return
  }

  const job = jobResult.rows[0]
  const newAttempts = job.attempts + 1
  const shouldRetry = newAttempts < job.max_attempts

  // Update job status
  await db.query(`
    UPDATE print_jobs
    SET
      status = $1,
      attempts = $2,
      error_message = $3,
      error_code = $4
    WHERE id = $5
  `, [
    shouldRetry ? 'pending' : 'failed',
    newAttempts,
    errorMessage || null,
    errorCode || null,
    jobId
  ])

  // Log event
  await db.query(`
    INSERT INTO print_job_history (print_job_id, event_type, event_data, created_at)
    VALUES ($1, 'failed', $2, NOW())
  `, [jobId, JSON.stringify({
    serviceId,
    printerId,
    errorMessage,
    errorCode,
    attempt: newAttempts,
    willRetry: shouldRetry,
    source: 'webhook'
  })])

  console.log(`[Print Webhook] Job ${jobId} failed (attempt ${newAttempts}/${job.max_attempts}), retry: ${shouldRetry}`)
}

/**
 * Handle printer.online event - Mark printer as online
 */
async function handlePrinterOnline(event: PrintWebhookEvent, serviceId: number) {
  const { printerId, printerName } = event.data as {
    printerId?: number
    printerName?: string
  }

  let updateQuery = 'UPDATE print_service_printers SET is_online = true, last_status_check = NOW() WHERE print_service_id = $1'
  const params: (number | string)[] = [serviceId]

  if (printerId) {
    updateQuery += ' AND id = $2'
    params.push(printerId)
  } else if (printerName) {
    updateQuery += ' AND printer_name = $2'
    params.push(printerName)
  } else {
    console.error('[Print Webhook] printer.online missing printerId or printerName')
    return
  }

  await db.query(updateQuery, params)
  console.log(`[Print Webhook] Printer ${printerId || printerName} is now online`)
}

/**
 * Handle printer.offline event - Mark printer as offline
 */
async function handlePrinterOffline(event: PrintWebhookEvent, serviceId: number) {
  const { printerId, printerName, reason } = event.data as {
    printerId?: number
    printerName?: string
    reason?: string
  }

  let updateQuery = 'UPDATE print_service_printers SET is_online = false, last_status_check = NOW() WHERE print_service_id = $1'
  const params: (number | string)[] = [serviceId]

  if (printerId) {
    updateQuery += ' AND id = $2'
    params.push(printerId)
  } else if (printerName) {
    updateQuery += ' AND printer_name = $2'
    params.push(printerName)
  } else {
    console.error('[Print Webhook] printer.offline missing printerId or printerName')
    return
  }

  await db.query(updateQuery, params)
  console.log(`[Print Webhook] Printer ${printerId || printerName} is now offline. Reason: ${reason || 'unknown'}`)
}

/**
 * Handle service.connected event - Mark service as active
 */
async function handleServiceConnected(serviceId: number) {
  await db.query(`
    UPDATE print_services
    SET status = 'active', last_seen_at = NOW()
    WHERE id = $1
  `, [serviceId])

  console.log(`[Print Webhook] Service ${serviceId} connected`)
}

/**
 * Handle service.disconnected event - Mark service as offline
 */
async function handleServiceDisconnected(serviceId: number) {
  await db.query(`
    UPDATE print_services
    SET status = 'offline'
    WHERE id = $1
  `, [serviceId])

  // Mark all printers as offline
  await db.query(`
    UPDATE print_service_printers
    SET is_online = false
    WHERE print_service_id = $1
  `, [serviceId])

  console.log(`[Print Webhook] Service ${serviceId} disconnected`)
}

/**
 * Handle batch.completed event - Multiple jobs completed
 */
async function handleBatchCompleted(event: PrintWebhookEvent, serviceId: number) {
  const { jobIds, totalPrinted, totalFailed } = event.data as {
    jobIds: number[]
    totalPrinted?: number
    totalFailed?: number
  }

  if (!jobIds || !Array.isArray(jobIds)) {
    console.error('[Print Webhook] batch.completed missing jobIds array')
    return
  }

  // Mark all jobs as completed
  await db.query(`
    UPDATE print_jobs
    SET status = 'completed', completed_at = NOW()
    WHERE id = ANY($1) AND print_service_id = $2
  `, [jobIds, serviceId])

  // Log batch completion
  for (const jobId of jobIds) {
    await db.query(`
      INSERT INTO print_job_history (print_job_id, event_type, event_data, created_at)
      VALUES ($1, 'completed', $2, NOW())
    `, [jobId, JSON.stringify({ serviceId, batchCompletion: true, source: 'webhook' })])
  }

  console.log(`[Print Webhook] Batch completed: ${jobIds.length} jobs (printed: ${totalPrinted || 'n/a'}, failed: ${totalFailed || 'n/a'})`)
}
