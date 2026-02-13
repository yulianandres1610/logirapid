import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/audit-fixed-assets
 * Extends audit tables to support fixed asset counting
 */
export async function POST() {
  try {
    console.log('[Migration] Starting audit fixed assets migration...')
    const results: string[] = []

    // 1. Add audit_type column to audit_counts
    try {
      await db.query(`
        ALTER TABLE audit_counts ADD COLUMN audit_type VARCHAR(20) DEFAULT 'products'
      `)
      results.push('audit_counts.audit_type: Added')
      console.log('[Migration] Added audit_type column to audit_counts')
    } catch (e: unknown) {
      const error = e as { code?: string }
      if (error.code === '42701') {
        results.push('audit_counts.audit_type: Already exists')
      } else {
        throw e
      }
    }

    // 2. Add check constraint for audit_type
    try {
      await db.query(`
        ALTER TABLE audit_counts ADD CONSTRAINT chk_audit_type
        CHECK (audit_type IN ('products', 'fixed_assets'))
      `)
      results.push('audit_counts.chk_audit_type: Added')
      console.log('[Migration] Added check constraint for audit_type')
    } catch (e: unknown) {
      const error = e as { code?: string }
      if (error.code === '42710') {
        results.push('audit_counts.chk_audit_type: Already exists')
      } else {
        throw e
      }
    }

    // 3. Create index for audit_type
    try {
      await db.query(`
        CREATE INDEX idx_audit_counts_type ON audit_counts(company_id, audit_type, status)
      `)
      results.push('idx_audit_counts_type: Created')
      console.log('[Migration] Created index idx_audit_counts_type')
    } catch (e: unknown) {
      const error = e as { code?: string }
      if (error.code === '42P07') {
        results.push('idx_audit_counts_type: Already exists')
      } else {
        throw e
      }
    }

    // 4. Add fixed assets columns to audit_count_lines
    const fixedAssetColumns = [
      { name: 'asset_id', type: 'INTEGER REFERENCES market_fixed_assets(id) ON DELETE SET NULL' },
      { name: 'asset_code', type: 'VARCHAR(50)' },
      { name: 'asset_barcode', type: 'VARCHAR(100)' },
      { name: 'scan_status', type: 'VARCHAR(20)' }, // 'found', 'missing', 'surplus'
      { name: 'expected_warehouse_id', type: 'INTEGER REFERENCES market_warehouses(id) ON DELETE SET NULL' },
      { name: 'found_warehouse_id', type: 'INTEGER REFERENCES market_warehouses(id) ON DELETE SET NULL' },
      { name: 'expected_condition', type: 'VARCHAR(20)' },
      { name: 'observed_condition', type: 'VARCHAR(20)' },
      { name: 'responsible_name', type: 'VARCHAR(255)' },
      { name: 'category_name', type: 'VARCHAR(100)' },
    ]

    for (const col of fixedAssetColumns) {
      try {
        await db.query(`
          ALTER TABLE audit_count_lines ADD COLUMN ${col.name} ${col.type}
        `)
        results.push(`audit_count_lines.${col.name}: Added`)
        console.log(`[Migration] Added ${col.name} column to audit_count_lines`)
      } catch (e: unknown) {
        const error = e as { code?: string }
        if (error.code === '42701') {
          results.push(`audit_count_lines.${col.name}: Already exists`)
        } else {
          throw e
        }
      }
    }

    // 5. Make product_id nullable (for fixed assets, we use asset_id instead)
    try {
      await db.query(`
        ALTER TABLE audit_count_lines ALTER COLUMN product_id DROP NOT NULL
      `)
      results.push('audit_count_lines.product_id: Made nullable')
      console.log('[Migration] Made product_id nullable in audit_count_lines')
    } catch (e: unknown) {
      // Column might already be nullable, ignore error
      results.push('audit_count_lines.product_id: Already nullable or error')
    }

    // 6. Add index for asset_id
    try {
      await db.query(`
        CREATE INDEX idx_audit_count_lines_asset ON audit_count_lines(asset_id) WHERE asset_id IS NOT NULL
      `)
      results.push('idx_audit_count_lines_asset: Created')
      console.log('[Migration] Created index idx_audit_count_lines_asset')
    } catch (e: unknown) {
      const error = e as { code?: string }
      if (error.code === '42P07') {
        results.push('idx_audit_count_lines_asset: Already exists')
      } else {
        throw e
      }
    }

    // 7. Add fixed asset specific totals to audit_counts
    const fixedAssetTotals = [
      { name: 'total_assets', type: 'INTEGER DEFAULT 0' },
      { name: 'assets_found', type: 'INTEGER DEFAULT 0' },
      { name: 'assets_missing', type: 'INTEGER DEFAULT 0' },
      { name: 'assets_surplus', type: 'INTEGER DEFAULT 0' },
      { name: 'total_value_at_risk', type: 'DECIMAL(12,2) DEFAULT 0' },
    ]

    for (const col of fixedAssetTotals) {
      try {
        await db.query(`
          ALTER TABLE audit_counts ADD COLUMN ${col.name} ${col.type}
        `)
        results.push(`audit_counts.${col.name}: Added`)
        console.log(`[Migration] Added ${col.name} column to audit_counts`)
      } catch (e: unknown) {
        const error = e as { code?: string }
        if (error.code === '42701') {
          results.push(`audit_counts.${col.name}: Already exists`)
        } else {
          throw e
        }
      }
    }

    console.log('[Migration] Audit fixed assets migration completed!')

    return NextResponse.json({
      success: true,
      message: 'Audit fixed assets migration completed',
      results
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Migration] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Migration failed'
    }, { status: 500 })
  }
}

/**
 * GET /api/migrations/audit-fixed-assets
 * Check migration status
 */
export async function GET() {
  try {
    const checks: Record<string, boolean> = {}

    // Check audit_type column in audit_counts
    const auditTypeCheck = await db.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'audit_counts' AND column_name = 'audit_type'
      )
    `)
    checks['audit_counts.audit_type'] = auditTypeCheck.rows[0].exists

    // Check asset_id column in audit_count_lines
    const assetIdCheck = await db.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'audit_count_lines' AND column_name = 'asset_id'
      )
    `)
    checks['audit_count_lines.asset_id'] = assetIdCheck.rows[0].exists

    // Check if product_id is nullable
    const productIdCheck = await db.query(`
      SELECT is_nullable FROM information_schema.columns
      WHERE table_name = 'audit_count_lines' AND column_name = 'product_id'
    `)
    checks['audit_count_lines.product_id_nullable'] = productIdCheck.rows[0]?.is_nullable === 'YES'

    // Check total_assets column
    const totalAssetsCheck = await db.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'audit_counts' AND column_name = 'total_assets'
      )
    `)
    checks['audit_counts.total_assets'] = totalAssetsCheck.rows[0].exists

    const allMigrated = Object.values(checks).every(v => v)

    return NextResponse.json({
      success: true,
      migrated: allMigrated,
      checks
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Migration Check] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error checking migration status'
    }, { status: 500 })
  }
}
