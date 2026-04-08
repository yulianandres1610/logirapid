import { NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { generateDocument } from '@/lib/print-generators'

export async function GET() {
  try {
    // Get last 5 session_close jobs
    const result = await db.query(`
      SELECT id, document_type, status, error_message, service_id,
             created_at, updated_at,
             LEFT(document_data::text, 500) as data_preview
      FROM print_jobs
      WHERE document_type = 'session_close_report'
      ORDER BY created_at DESC
      LIMIT 5
    `)

    // Try to generate the last one to see if it fails
    let generationTest = null
    if (result.rows.length > 0) {
      const lastJob = result.rows[0]
      try {
        const docData = typeof lastJob.data_preview === 'string'
          ? 'Data too long for preview'
          : lastJob.data_preview

        // Get full data for the last job
        const fullJob = await db.query('SELECT document_data FROM print_jobs WHERE id = $1', [lastJob.id])
        const fullData = fullJob.rows[0]?.document_data

        let parsed: any = null
        try {
          parsed = typeof fullData === 'string' ? JSON.parse(fullData) : fullData
        } catch (parseErr) {
          generationTest = { error: 'JSON parse failed', message: String(parseErr) }
        }

        if (parsed) {
          try {
            const generated = await generateDocument('session_close_report', parsed, 'thermal_80mm')
            generationTest = {
              success: true,
              format: generated.format,
              dataLength: generated.data.length,
              dataPreview: generated.data.substring(0, 100)
            }
          } catch (genErr: any) {
            generationTest = {
              error: 'Generation failed',
              message: genErr.message,
              stack: genErr.stack?.substring(0, 300)
            }
          }
        }
      } catch (testErr: any) {
        generationTest = { error: 'Test failed', message: testErr.message }
      }
    }

    return NextResponse.json({
      success: true,
      jobs: result.rows.map(r => ({
        id: r.id,
        status: r.status,
        error: r.error_message,
        serviceId: r.service_id,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        dataPreview: r.data_preview?.substring(0, 200)
      })),
      generationTest
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
