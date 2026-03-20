import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { generateDocument } from '@/lib/print-generators'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/print-agent?token=X&version=1.0.0&printers=[...]
 *
 * Agent polling endpoint. The desktop print agent calls this periodically
 * to check for pending print jobs and report its status.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const version = searchParams.get('version') || 'unknown'
    const printersParam = searchParams.get('printers') || '[]'

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token requerido' },
        { status: 400 }
      )
    }

    // Validate token against print_services
    const serviceResult = await db.query(
      `SELECT * FROM print_services WHERE pairing_token = $1 AND status = 'active'`,
      [token]
    )

    if (serviceResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Token inválido o servicio inactivo' },
        { status: 401 }
      )
    }

    const service = serviceResult.rows[0]

    // Parse printers JSON
    let agentPrinters: any[] = []
    try {
      agentPrinters = JSON.parse(printersParam)
    } catch {
      agentPrinters = []
    }

    // Update service heartbeat
    await db.query(
      `UPDATE print_services SET last_seen_at = NOW(), agent_version = $1, agent_printers = $2 WHERE id = $3`,
      [version, JSON.stringify(agentPrinters), service.id]
    )

    // Get pending jobs
    const jobsResult = await db.query(
      `SELECT * FROM print_jobs WHERE service_id = $1 AND status = 'pending' ORDER BY created_at ASC LIMIT 10`,
      [service.id]
    )

    const jobs = jobsResult.rows

    // Generate documents for each job and build response
    const generatedJobs = await Promise.all(
      jobs.map(async (job: any) => {
        try {
          const generated = await generateDocument(
            job.document_type,
            typeof job.document_data === 'string'
              ? JSON.parse(job.document_data)
              : job.document_data,
            service.printer_type || 'thermal_80mm'
          )
          return {
            id: job.id,
            document_type: job.document_type,
            format: generated.format,
            data: generated.data,
            printer_name: job.printer_name || (service.printer_mappings && service.printer_mappings[job.document_type]) || service.selected_printer,
            copies: job.copies || 1,
          }
        } catch (genError) {
          console.error(`[Print Agent] Error generating document for job ${job.id}:`, genError)
          return {
            id: job.id,
            document_type: job.document_type,
            format: 'escpos' as const,
            data: '',
            printer_name: job.printer_name || (service.printer_mappings && service.printer_mappings[job.document_type]) || service.selected_printer,
            copies: job.copies || 1,
            error: 'Generation failed',
          }
        }
      })
    )

    // Mark successfully generated jobs as 'sent', failed ones as 'error'
    const successJobIds = generatedJobs.filter((j: any) => !j.error).map((j: any) => j.id)
    const failedJobIds = generatedJobs.filter((j: any) => j.error).map((j: any) => j.id)

    if (successJobIds.length > 0) {
      await db.query(
        `UPDATE print_jobs SET status = 'sent', updated_at = NOW() WHERE id = ANY($1)`,
        [successJobIds]
      )
    }
    if (failedJobIds.length > 0) {
      await db.query(
        `UPDATE print_jobs SET status = 'error', error_message = 'Document generation failed', updated_at = NOW() WHERE id = ANY($1)`,
        [failedJobIds]
      )
    }

    // Only send successfully generated jobs to the agent
    const validJobs = generatedJobs.filter((j: any) => !j.error)

    return NextResponse.json({
      success: true,
      service_name: service.name,
      selected_printer: service.selected_printer,
      printer_type: service.printer_type,
      jobs: validJobs,
    })
  } catch (error) {
    console.error('[Print Agent] GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al procesar polling: ' + String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/print-agent
 *
 * Report job result from the agent.
 * Body: { token, job_id, status, error_message }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, job_id, status, error_message } = body

    if (!token || !job_id || !status) {
      return NextResponse.json(
        { success: false, error: 'Campos requeridos: token, job_id, status' },
        { status: 400 }
      )
    }

    // Validate token
    const serviceResult = await db.query(
      `SELECT id FROM print_services WHERE pairing_token = $1 AND status = 'active'`,
      [token]
    )

    if (serviceResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Token inválido o servicio inactivo' },
        { status: 401 }
      )
    }

    const serviceId = serviceResult.rows[0].id

    // Validate job belongs to this service
    const jobCheck = await db.query(
      `SELECT id FROM print_jobs WHERE id = $1 AND service_id = $2`,
      [job_id, serviceId]
    )

    if (jobCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Job no encontrado para este servicio' },
        { status: 404 }
      )
    }

    // Update job status
    await db.query(
      `UPDATE print_jobs SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3`,
      [status, error_message || null, job_id]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Print Agent] POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al reportar resultado: ' + String(error) },
      { status: 500 }
    )
  }
}
