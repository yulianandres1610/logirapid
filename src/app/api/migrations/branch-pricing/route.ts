import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * Migration 41: Branch-Specific Product Pricing
 *
 * Allows matrix companies to set DIFFERENT prices for EACH branch
 * instead of a single precio_sucursales for all branches.
 *
 * Example:
 *   Matrix Company sets:
 *   - Caja Pequeña → Miami: $15, Tampa: $18, Orlando: $20
 *
 *   When Tampa loads their pricing:
 *   - mi_costo = $18 (specific price for Tampa)
 */

export async function POST(request: NextRequest) {
  const results: string[] = []

  try {
    // Step 1: Create the branch_product_pricing table
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS branch_product_pricing (
          id SERIAL PRIMARY KEY,

          -- References
          matrix_company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          branch_company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          product_id INTEGER NOT NULL REFERENCES product_catalog(id) ON DELETE CASCADE,

          -- Specific price for this branch (overrides matrix's precio_sucursales)
          precio_sucursal DECIMAL(15,2) NOT NULL,

          -- Optional notes
          notes TEXT,

          -- Timestamps
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),

          -- Unique constraint: one price per matrix/branch/product combination
          CONSTRAINT unique_branch_product_pricing
            UNIQUE (matrix_company_id, branch_company_id, product_id)
        )
      `)
      results.push('Created branch_product_pricing table')
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        results.push('branch_product_pricing table already exists')
      } else {
        throw error
      }
    }

    // Step 2: Create indexes for efficient lookups
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_branch_pricing_matrix
        ON branch_product_pricing(matrix_company_id)
      `)
      results.push('Created index idx_branch_pricing_matrix')
    } catch (error: any) {
      results.push(`Index idx_branch_pricing_matrix: ${error.message}`)
    }

    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_branch_pricing_branch
        ON branch_product_pricing(branch_company_id)
      `)
      results.push('Created index idx_branch_pricing_branch')
    } catch (error: any) {
      results.push(`Index idx_branch_pricing_branch: ${error.message}`)
    }

    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_branch_pricing_product
        ON branch_product_pricing(product_id)
      `)
      results.push('Created index idx_branch_pricing_product')
    } catch (error: any) {
      results.push(`Index idx_branch_pricing_product: ${error.message}`)
    }

    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_branch_pricing_lookup
        ON branch_product_pricing(branch_company_id, product_id)
      `)
      results.push('Created composite index idx_branch_pricing_lookup')
    } catch (error: any) {
      results.push(`Index idx_branch_pricing_lookup: ${error.message}`)
    }

    // Step 3: Add comment to table
    try {
      await db.query(`
        COMMENT ON TABLE branch_product_pricing IS
        'Per-branch specific pricing. Overrides matrix precio_sucursales for specific branches.'
      `)
      results.push('Added table comment')
    } catch (error: any) {
      results.push(`Table comment: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Branch pricing migration completed successfully',
      results
    })

  } catch (error: any) {
    console.error('Migration error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      results
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Check if table exists and show structure
    const tableResult = await db.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'branch_product_pricing'
      ORDER BY ordinal_position
    `)

    // Check row count
    let rowCount = 0
    try {
      const countResult = await db.query('SELECT COUNT(*) as count FROM branch_product_pricing')
      rowCount = parseInt(countResult.rows[0].count)
    } catch {
      // Table doesn't exist
    }

    return NextResponse.json({
      success: true,
      message: 'Branch pricing migration status',
      tableExists: tableResult.rows.length > 0,
      columns: tableResult.rows,
      rowCount
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
