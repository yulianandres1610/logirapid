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

    // Delete all related records in order
    const tablesToDelete = [
      { name: 'market_pos_order_lines (variant)', query: 'DELETE FROM market_pos_order_lines WHERE variant_id IN (SELECT id FROM market_product_variants WHERE product_id = $1)' },
      { name: 'market_warehouse_stock (variant)', query: 'DELETE FROM market_warehouse_stock WHERE variant_id IN (SELECT id FROM market_product_variants WHERE product_id = $1)' },
      { name: 'market_variant_options', query: 'DELETE FROM market_variant_options WHERE variant_id IN (SELECT id FROM market_product_variants WHERE product_id = $1)' },
      { name: 'market_pos_order_lines', query: 'DELETE FROM market_pos_order_lines WHERE product_id = $1' },
      { name: 'market_warehouse_stock', query: 'DELETE FROM market_warehouse_stock WHERE product_id = $1' },
      { name: 'market_stock_movements', query: 'DELETE FROM market_stock_movements WHERE product_id = $1' },
      { name: 'market_warehouse_operation_lines', query: 'DELETE FROM market_warehouse_operation_lines WHERE product_id = $1' },
      { name: 'market_order_lines', query: 'DELETE FROM market_order_lines WHERE product_id = $1' },
      { name: 'market_purchase_lines', query: 'DELETE FROM market_purchase_lines WHERE product_id = $1' },
      { name: 'market_inventory_movements', query: 'DELETE FROM market_inventory_movements WHERE product_id = $1' },
      { name: 'market_pricelist_items', query: 'DELETE FROM market_pricelist_items WHERE product_id = $1' },
      { name: 'market_invoice_lines', query: 'DELETE FROM market_invoice_lines WHERE product_id = $1' },
      { name: 'market_invoice_delivery_lines', query: 'DELETE FROM market_invoice_delivery_lines WHERE product_id = $1' },
      { name: 'market_quote_lines', query: 'DELETE FROM market_quote_lines WHERE product_id = $1' },
      { name: 'market_product_variants', query: 'DELETE FROM market_product_variants WHERE product_id = $1' },
      { name: 'market_product_logs', query: 'DELETE FROM market_product_logs WHERE product_id = $1' },
      { name: 'market_product_change_logs', query: 'DELETE FROM market_product_change_logs WHERE product_id = $1' },
    ]

    for (const { name, query } of tablesToDelete) {
      try {
        const result = await db.query(query, [productId])
        if (result.rowCount && result.rowCount > 0) {
          deletions.push(`${name}: ${result.rowCount} rows`)
        }
      } catch {
        // Table may not exist - continue
      }
    }

    // Delete the product itself
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
