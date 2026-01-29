import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/delete-product-86
 * Deletes product ID 86 and all related data
 */
export async function GET() {
  try {
    const productId = 86

    // Find the product
    const productResult = await db.query(
      'SELECT id, name, barcode, company_id FROM market_products WHERE id = $1',
      [productId]
    )

    if (productResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: `No product found with id: ${productId}`
      }, { status: 404 })
    }

    const product = productResult.rows[0]

    // Delete related data in order
    const deletions: string[] = []

    // 1. Delete warehouse stock
    const stockResult = await db.query(
      'DELETE FROM market_warehouse_stock WHERE product_id = $1',
      [productId]
    )
    deletions.push(`warehouse_stock: ${stockResult.rowCount} rows`)

    // 2. Delete variant stock
    const variantStockResult = await db.query(
      'DELETE FROM market_warehouse_stock WHERE variant_id IN (SELECT id FROM market_product_variants WHERE product_id = $1)',
      [productId]
    )
    deletions.push(`variant_stock: ${variantStockResult.rowCount} rows`)

    // 3. Delete variant options
    const variantOptionsResult = await db.query(
      'DELETE FROM market_variant_options WHERE variant_id IN (SELECT id FROM market_product_variants WHERE product_id = $1)',
      [productId]
    )
    deletions.push(`variant_options: ${variantOptionsResult.rowCount} rows`)

    // 4. Delete variants
    const variantsResult = await db.query(
      'DELETE FROM market_product_variants WHERE product_id = $1',
      [productId]
    )
    deletions.push(`variants: ${variantsResult.rowCount} rows`)

    // 5. Delete product logs
    try {
      const logsResult = await db.query(
        'DELETE FROM market_product_logs WHERE product_id = $1',
        [productId]
      )
      deletions.push(`logs: ${logsResult.rowCount} rows`)
    } catch {
      // Table may not exist
    }

    // 6. Delete product change logs
    try {
      const changeLogsResult = await db.query(
        'DELETE FROM market_product_change_logs WHERE product_id = $1',
        [productId]
      )
      deletions.push(`change_logs: ${changeLogsResult.rowCount} rows`)
    } catch {
      // Table may not exist
    }

    // 7. Delete the product itself
    const deleteResult = await db.query(
      'DELETE FROM market_products WHERE id = $1',
      [productId]
    )
    deletions.push(`product: ${deleteResult.rowCount} rows`)

    return NextResponse.json({
      success: true,
      message: `Product "${product.name}" (id: ${productId}) deleted successfully`,
      productId,
      deletions
    })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error deleting product'
    }, { status: 500 })
  }
}
