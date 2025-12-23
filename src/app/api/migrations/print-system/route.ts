import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/print-system
 * Creates the print system tables for silent printing functionality
 */
export async function GET() {
  const results: { table: string; status: string; error?: string }[] = []

  try {
    // 1. Create print_services table
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS print_services (
          id SERIAL PRIMARY KEY,
          company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
          warehouse_id INTEGER REFERENCES market_warehouses(id) ON DELETE SET NULL,

          -- Identification
          service_code VARCHAR(50) UNIQUE NOT NULL,
          service_name VARCHAR(100) NOT NULL,

          -- Authentication
          api_key VARCHAR(255) NOT NULL,
          api_secret_hash VARCHAR(255) NOT NULL,

          -- Status and connectivity
          status VARCHAR(20) DEFAULT 'pending',
          last_seen_at TIMESTAMP,
          last_ip_address VARCHAR(45),
          version VARCHAR(20),

          -- Device info
          platform VARCHAR(20),
          hostname VARCHAR(100),

          -- Timestamps
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER REFERENCES users(id)
        )
      `)
      results.push({ table: 'print_services', status: 'created' })
    } catch (error) {
      results.push({
        table: 'print_services',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Create indexes for print_services
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_print_services_company ON print_services(company_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_print_services_warehouse ON print_services(warehouse_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_print_services_status ON print_services(status)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_print_services_api_key ON print_services(api_key)`)
    } catch {
      // Indexes may already exist
    }

    // 2. Create print_service_printers table
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS print_service_printers (
          id SERIAL PRIMARY KEY,
          print_service_id INTEGER REFERENCES print_services(id) ON DELETE CASCADE,

          -- Printer identification
          printer_name VARCHAR(200) NOT NULL,
          printer_id VARCHAR(200),
          driver_name VARCHAR(200),

          -- Type and capabilities
          printer_type VARCHAR(30),
          connection_type VARCHAR(20),
          network_address VARCHAR(100),

          -- Status
          is_online BOOLEAN DEFAULT false,
          is_default BOOLEAN DEFAULT false,
          last_status_check TIMESTAMP,

          -- Capabilities
          supports_escpos BOOLEAN DEFAULT false,
          supports_raw BOOLEAN DEFAULT false,
          paper_width_mm INTEGER,
          dpi INTEGER,

          -- Timestamps
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

          UNIQUE(print_service_id, printer_name)
        )
      `)
      results.push({ table: 'print_service_printers', status: 'created' })
    } catch (error) {
      results.push({
        table: 'print_service_printers',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Create indexes for print_service_printers
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_printers_service ON print_service_printers(print_service_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_printers_type ON print_service_printers(printer_type)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_printers_online ON print_service_printers(is_online)`)
    } catch {
      // Indexes may already exist
    }

    // 3. Create print_configurations table
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS print_configurations (
          id SERIAL PRIMARY KEY,
          company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
          warehouse_id INTEGER REFERENCES market_warehouses(id) ON DELETE CASCADE,
          pos_terminal_id INTEGER REFERENCES market_pos_terminals(id) ON DELETE CASCADE,

          -- Document type
          document_type VARCHAR(50) NOT NULL,

          -- Printer assignment
          print_service_id INTEGER REFERENCES print_services(id) ON DELETE SET NULL,
          printer_id INTEGER REFERENCES print_service_printers(id) ON DELETE SET NULL,

          -- Print settings
          copies INTEGER DEFAULT 1,
          auto_print BOOLEAN DEFAULT false,
          paper_size VARCHAR(30),
          orientation VARCHAR(20) DEFAULT 'portrait',

          -- Priority for config inheritance
          priority INTEGER DEFAULT 0,

          -- Status
          is_active BOOLEAN DEFAULT true,

          -- Timestamps
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER REFERENCES users(id)
        )
      `)
      results.push({ table: 'print_configurations', status: 'created' })
    } catch (error) {
      results.push({
        table: 'print_configurations',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Create indexes for print_configurations
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_print_config_company ON print_configurations(company_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_print_config_warehouse ON print_configurations(warehouse_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_print_config_terminal ON print_configurations(pos_terminal_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_print_config_doc_type ON print_configurations(document_type)`)
    } catch {
      // Indexes may already exist
    }

    // 4. Create print_jobs table
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS print_jobs (
          id SERIAL PRIMARY KEY,
          job_number VARCHAR(50) UNIQUE NOT NULL,

          -- References
          company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
          print_service_id INTEGER REFERENCES print_services(id) ON DELETE SET NULL,
          printer_id INTEGER REFERENCES print_service_printers(id) ON DELETE SET NULL,

          -- Document info
          document_type VARCHAR(50) NOT NULL,
          source_type VARCHAR(50),
          source_id INTEGER,

          -- Document data (JSON)
          document_data JSONB NOT NULL,

          -- Print settings
          copies INTEGER DEFAULT 1,
          priority INTEGER DEFAULT 0,

          -- Status
          status VARCHAR(30) DEFAULT 'pending',
          attempts INTEGER DEFAULT 0,
          max_attempts INTEGER DEFAULT 3,

          -- Timestamps
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          sent_at TIMESTAMP,
          started_at TIMESTAMP,
          completed_at TIMESTAMP,

          -- Error info
          error_message TEXT,
          error_code VARCHAR(50),

          -- User who requested
          requested_by INTEGER REFERENCES users(id),

          -- Additional metadata
          metadata JSONB
        )
      `)
      results.push({ table: 'print_jobs', status: 'created' })
    } catch (error) {
      results.push({
        table: 'print_jobs',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Create indexes for print_jobs
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_print_jobs_service ON print_jobs(print_service_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_print_jobs_company ON print_jobs(company_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_print_jobs_created ON print_jobs(created_at DESC)`)
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_print_jobs_pending
        ON print_jobs(status, priority DESC, created_at)
        WHERE status IN ('pending', 'sent')
      `)
    } catch {
      // Indexes may already exist
    }

    // 5. Create print_job_history table for audit trail
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS print_job_history (
          id SERIAL PRIMARY KEY,
          print_job_id INTEGER REFERENCES print_jobs(id) ON DELETE CASCADE,

          event_type VARCHAR(50) NOT NULL,
          event_data JSONB,

          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)
      results.push({ table: 'print_job_history', status: 'created' })
    } catch (error) {
      results.push({
        table: 'print_job_history',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Create index for print_job_history
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_job_history_job ON print_job_history(print_job_id)`)
    } catch {
      // Index may already exist
    }

    // 6. Add supported_document_types column to print_service_printers if not exists
    try {
      await db.query(`
        ALTER TABLE print_service_printers
        ADD COLUMN IF NOT EXISTS supported_document_types TEXT[] DEFAULT ARRAY['pos_receipt', 'product_label', 'invoice', 'purchase_invoice', 'sales_report', 'inventory_count_report', 'cash_register_report', 'shipping_label']::TEXT[]
      `)
      results.push({ table: 'print_service_printers.supported_document_types', status: 'created' })
    } catch (error) {
      // Column may already exist or DB doesn't support arrays
      try {
        // Fallback to JSONB
        await db.query(`
          ALTER TABLE print_service_printers
          ADD COLUMN IF NOT EXISTS supported_document_types JSONB DEFAULT '["pos_receipt", "product_label", "invoice", "purchase_invoice", "sales_report", "inventory_count_report", "cash_register_report", "shipping_label"]'::JSONB
        `)
        results.push({ table: 'print_service_printers.supported_document_types', status: 'created (jsonb)' })
      } catch {
        results.push({
          table: 'print_service_printers.supported_document_types',
          status: 'skipped',
          error: 'Column may already exist'
        })
      }
    }

    // Add comments to tables for documentation
    try {
      await db.query(`COMMENT ON TABLE print_services IS 'Local print service installations (Electron app)'`)
      await db.query(`COMMENT ON TABLE print_service_printers IS 'Printers detected by each print service'`)
      await db.query(`COMMENT ON TABLE print_configurations IS 'Printer assignments by document type per terminal/warehouse/company'`)
      await db.query(`COMMENT ON TABLE print_jobs IS 'Print job queue'`)
      await db.query(`COMMENT ON TABLE print_job_history IS 'Audit trail for print jobs'`)

      await db.query(`COMMENT ON COLUMN print_services.status IS 'pending, active, offline, disabled'`)
      await db.query(`COMMENT ON COLUMN print_service_printers.printer_type IS 'thermal_80mm, label_4x6, label_barcode, standard'`)
      await db.query(`COMMENT ON COLUMN print_service_printers.connection_type IS 'usb, network, bluetooth'`)
      await db.query(`COMMENT ON COLUMN print_configurations.document_type IS 'pos_receipt, shipping_label, product_label, invoice'`)
      await db.query(`COMMENT ON COLUMN print_jobs.status IS 'pending, sent, printing, completed, failed, cancelled'`)
      await db.query(`COMMENT ON COLUMN print_jobs.source_type IS 'pos_order, package_order, product, manual'`)
    } catch {
      // Comments may fail on some databases
    }

    const hasErrors = results.some(r => r.status === 'error')

    return NextResponse.json({
      success: !hasErrors,
      message: hasErrors
        ? 'Migration completed with some errors'
        : 'Print system migration completed successfully',
      data: {
        results,
        tablesCreated: results.filter(r => r.status === 'created').length,
        errors: results.filter(r => r.status === 'error').length
      }
    })

  } catch (error) {
    console.error('[Print System Migration] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during migration',
      data: { results }
    }, { status: 500 })
  }
}
