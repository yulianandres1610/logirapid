import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'

/**
 * GET /api/migrations/print-system-v2
 *
 * Migration endpoint to set up the v2 print system tables.
 * Drops old tables and creates the new schema.
 */
export async function GET() {
  const results: string[] = []

  try {
    // 1. Drop old tables that are no longer needed
    try {
      await db.query(`DROP TABLE IF EXISTS print_service_printers, print_configurations, print_job_history CASCADE`)
      results.push('Dropped old tables: print_service_printers, print_configurations, print_job_history')
    } catch (e) {
      results.push('Drop old tables (skipped or error): ' + String(e))
    }

    // 2. Create print_services table
    await db.query(`
      CREATE TABLE IF NOT EXISTS print_services (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        pairing_token VARCHAR(255) UNIQUE NOT NULL,
        warehouse_id INTEGER,
        pos_terminal_id INTEGER,
        selected_printer VARCHAR(255),
        printer_type VARCHAR(50) DEFAULT 'thermal_80mm',
        agent_printers JSONB DEFAULT '[]',
        last_seen_at TIMESTAMP,
        agent_version VARCHAR(50),
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    results.push('Created table: print_services')

    // 3. Create print_jobs table
    await db.query(`
      CREATE TABLE IF NOT EXISTS print_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        service_id INTEGER REFERENCES print_services(id),
        company_id INTEGER NOT NULL,
        document_type VARCHAR(100) NOT NULL,
        document_data JSONB NOT NULL,
        format VARCHAR(20),
        printer_name VARCHAR(255),
        copies INTEGER DEFAULT 1,
        status VARCHAR(20) DEFAULT 'pending',
        error_message TEXT,
        requested_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    results.push('Created table: print_jobs')

    // 4. Create index for pending jobs lookup
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_pj_pending ON print_jobs(service_id, status) WHERE status = 'pending'
    `)
    results.push('Created index: idx_pj_pending')

    // 5. Clean old columns from print_services (try-catch each one)
    const oldServiceColumns = ['api_key', 'api_secret_hash', 'service_code', 'hostname', 'platform', 'version']
    for (const col of oldServiceColumns) {
      try {
        await db.query(`ALTER TABLE print_services DROP COLUMN IF EXISTS ${col}`)
        results.push(`Dropped old column print_services.${col}`)
      } catch (e) {
        results.push(`Column print_services.${col} (skipped): ${String(e)}`)
      }
    }

    // 6. Clean old columns from print_jobs if they exist
    const oldJobColumns = ['payload', 'raw_data', 'printer_id', 'configuration_id']
    for (const col of oldJobColumns) {
      try {
        await db.query(`ALTER TABLE print_jobs DROP COLUMN IF EXISTS ${col}`)
        results.push(`Dropped old column print_jobs.${col}`)
      } catch (e) {
        results.push(`Column print_jobs.${col} (skipped): ${String(e)}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Print system v2 migration completed',
      details: results,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: String(error),
        details: results,
      },
      { status: 500 }
    )
  }
}
