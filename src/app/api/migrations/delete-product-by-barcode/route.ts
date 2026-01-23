import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/delete-product-by-barcode?barcode=XXX
 * Deletes a product and all related data by barcode
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const barcode = searchParams.get('barcode')

    if (!barcode) {
      return NextResponse.json({
        success: false,
        error: 'barcode parameter required'
      }, { status: 400 })
    }

    // Find the product by barcode
    const productResult = await db.query(
      'SELECT id, name, barcode, company_id FROM market_products WHERE barcode = $1',
      [barcode]
    )

    if (productResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: `No product found with barcode: ${barcode}`
      }, { status: 404 })
    }

    const product = productResult.rows[0]
    const productId = product.id

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
    const logsResult = await db.query(
      'DELETE FROM market_product_logs WHERE product_id = $1',
      [productId]
    )
    deletions.push(`logs: ${logsResult.rowCount} rows`)

    // 6. Delete the product itself
    const deleteResult = await db.query(
      'DELETE FROM market_products WHERE id = $1',
      [productId]
    )
    deletions.push(`product: ${deleteResult.rowCount} rows`)

    return NextResponse.json({
      success: true,
      message: `Product "${product.name}" (barcode: ${barcode}) deleted successfully`,
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
