import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * Migration: Add precio_a_logirapid field for providers
 *
 * This field allows provider companies to track:
 * - mi_costo: Their actual cost (production/acquisition cost)
 * - precio_a_logirapid: What they charge to LogiRapid
 *
 * When a provider updates precio_a_logirapid, it should update
 * the product_catalog.mi_costo for that product.
 */

export async function POST(request: NextRequest) {
  const results: string[] = []

  try {
    // Step 1: Add precio_a_logirapid column to company_product_pricing
    try {
      await db.query(`
        ALTER TABLE company_product_pricing
        ADD COLUMN IF NOT EXISTS precio_a_logirapid DECIMAL(15,2)
      `)
      results.push('Added precio_a_logirapid column to company_product_pricing')
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        throw error
      }
      results.push('precio_a_logirapid column already exists')
    }

    // Step 2: Add provider_cost column to company_product_pricing (the provider's actual cost)
    try {
      await db.query(`
        ALTER TABLE company_product_pricing
        ADD COLUMN IF NOT EXISTS provider_cost DECIMAL(15,2)
      `)
      results.push('Added provider_cost column to company_product_pricing')
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        throw error
      }
      results.push('provider_cost column already exists')
    }

    // Step 3: Add provider_margin columns
    try {
      await db.query(`
        ALTER TABLE company_product_pricing
        ADD COLUMN IF NOT EXISTS provider_margin DECIMAL(15,2),
        ADD COLUMN IF NOT EXISTS provider_margin_pct DECIMAL(10,2)
      `)
      results.push('Added provider_margin columns to company_product_pricing')
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        throw error
      }
      results.push('provider_margin columns already exist')
    }

    // Step 4: Add is_provider_pricing flag
    try {
      await db.query(`
        ALTER TABLE company_product_pricing
        ADD COLUMN IF NOT EXISTS is_provider_pricing BOOLEAN DEFAULT FALSE
      `)
      results.push('Added is_provider_pricing flag to company_product_pricing')
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        throw error
      }
      results.push('is_provider_pricing flag already exists')
    }

    // Step 5: Create index for provider pricing lookups
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_company_product_pricing_provider
        ON company_product_pricing (company_id, is_provider_pricing)
        WHERE is_provider_pricing = TRUE
      `)
      results.push('Created index for provider pricing lookups')
    } catch (error: any) {
      results.push(`Index creation: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Provider pricing migration completed successfully',
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
    // Check current state of columns
    const columnsResult = await db.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'company_product_pricing'
      AND column_name IN ('precio_a_logirapid', 'provider_cost', 'provider_margin', 'provider_margin_pct', 'is_provider_pricing')
      ORDER BY column_name
    `)

    return NextResponse.json({
      success: true,
      message: 'Provider pricing migration status',
      columns: columnsResult.rows,
      migrationApplied: columnsResult.rows.length >= 4
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
