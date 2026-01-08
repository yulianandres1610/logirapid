import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET() {
  try {
    // Check column types for market_products
    const productsColumnResult = await db.query(`
      SELECT column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'market_products'
      AND column_name IN ('cost_price', 'selling_price')
      ORDER BY column_name
    `)

    // Check column types for market_product_variants
    const variantsColumnResult = await db.query(`
      SELECT column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'market_product_variants'
      AND column_name IN ('cost_price', 'selling_price')
      ORDER BY column_name
    `)

    // Get a sample product to see actual values
    const sampleProduct = await db.query(`
      SELECT id, name, cost_price, selling_price
      FROM market_products
      LIMIT 1
    `)

    return NextResponse.json({
      success: true,
      data: {
        market_products_columns: productsColumnResult.rows,
        market_product_variants_columns: variantsColumnResult.rows,
        sample_product: sampleProduct.rows[0] || null
      }
    })
  } catch (error) {
    console.error('Error checking columns:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
