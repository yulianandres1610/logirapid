import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/order-validation
 * Migration to add validation fields to market_purchases and consignment_orders tables
 */
export async function POST() {
  try {
    const results: string[] = []

    // Add validation columns to market_purchases
    const purchaseColumns = [
      { name: 'validation_status', type: "VARCHAR(50) DEFAULT 'pending_validation'" },
      { name: 'validated_by', type: 'INTEGER REFERENCES users(id)' },
      { name: 'validated_at', type: 'TIMESTAMP' },
      { name: 'rejection_reason', type: 'TEXT' }
    ]

    results.push('--- market_purchases ---')
    for (const col of purchaseColumns) {
      try {
        await db.query(`
          ALTER TABLE market_purchases
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `)
        results.push(`Added ${col.name} to market_purchases`)
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          results.push(`${col.name} already exists in market_purchases`)
        } else {
          results.push(`market_purchases.${col.name}: ${error.message}`)
        }
      }
    }

    // Add validation columns to consignment_orders
    const consignmentColumns = [
      { name: 'validation_status', type: "VARCHAR(50) DEFAULT 'pending_validation'" },
      { name: 'validated_by', type: 'INTEGER REFERENCES users(id)' },
      { name: 'validated_at', type: 'TIMESTAMP' },
      { name: 'rejection_reason', type: 'TEXT' }
    ]

    results.push('--- consignment_orders ---')
    for (const col of consignmentColumns) {
      try {
        await db.query(`
          ALTER TABLE consignment_orders
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `)
        results.push(`Added ${col.name} to consignment_orders`)
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          results.push(`${col.name} already exists in consignment_orders`)
        } else {
          results.push(`consignment_orders.${col.name}: ${error.message}`)
        }
      }
    }

    // Update existing records to have 'confirmed' status (they were created before validation system)
    try {
      await db.query(`
        UPDATE market_purchases
        SET validation_status = 'confirmed'
        WHERE validation_status IS NULL OR validation_status = 'pending_validation'
      `)
      results.push('Updated existing market_purchases to confirmed status')
    } catch (error: any) {
      results.push(`Failed to update market_purchases: ${error.message}`)
    }

    try {
      await db.query(`
        UPDATE consignment_orders
        SET validation_status = 'confirmed'
        WHERE validation_status IS NULL OR validation_status = 'pending_validation'
      `)
      results.push('Updated existing consignment_orders to confirmed status')
    } catch (error: any) {
      results.push(`Failed to update consignment_orders: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Order validation migration completed',
      results
    })

  } catch (error) {
    console.error('[Migration] Order validation error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Check current state of validation columns in both tables
    const purchaseCols = await db.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'market_purchases'
      AND column_name IN ('validation_status', 'validated_by', 'validated_at', 'rejection_reason')
      ORDER BY column_name
    `)

    const consignmentCols = await db.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'consignment_orders'
      AND column_name IN ('validation_status', 'validated_by', 'validated_at', 'rejection_reason')
      ORDER BY column_name
    `)

    return NextResponse.json({
      success: true,
      market_purchases: purchaseCols.rows,
      consignment_orders: consignmentCols.rows
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
