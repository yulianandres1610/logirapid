import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/cleanup-operation-lines?operationId=X&keepLines=50,51
 * Remove incorrectly added lines from an operation, keeping only specified lines
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const operationId = searchParams.get('operationId')
    const keepLines = searchParams.get('keepLines')

    if (!operationId) {
      return NextResponse.json({
        success: false,
        error: 'operationId is required'
      }, { status: 400 })
    }

    const opId = parseInt(operationId)

    // Get current lines before cleanup
    const beforeResult = await db.query(`
      SELECT id, product_id, variant_id
      FROM market_warehouse_operation_lines
      WHERE operation_id = $1
      ORDER BY id
    `, [opId])

    console.log(`[Cleanup] Operation ${opId} has ${beforeResult.rows.length} lines before cleanup`)

    let deletedCount = 0

    if (keepLines) {
      // Keep only specific line IDs
      const keepIds = keepLines.split(',').map(id => parseInt(id.trim()))

      const deleteResult = await db.query(`
        DELETE FROM market_warehouse_operation_lines
        WHERE operation_id = $1
          AND id NOT IN (${keepIds.join(',')})
        RETURNING id
      `, [opId])

      deletedCount = deleteResult.rows.length
      console.log(`[Cleanup] Deleted ${deletedCount} lines from operation ${opId}, kept lines: ${keepIds.join(', ')}`)
    } else {
      return NextResponse.json({
        success: false,
        error: 'keepLines parameter is required (comma-separated list of line IDs to keep)'
      }, { status: 400 })
    }

    // Get lines after cleanup
    const afterResult = await db.query(`
      SELECT l.id, p.name as product_name, v.variant_name, l.quantity_planned
      FROM market_warehouse_operation_lines l
      JOIN market_products p ON p.id = l.product_id
      LEFT JOIN market_product_variants v ON v.id = l.variant_id
      WHERE l.operation_id = $1
      ORDER BY l.id
    `, [opId])

    return NextResponse.json({
      success: true,
      message: `Cleanup completed: ${deletedCount} lines deleted`,
      operationId: opId,
      linesBefore: beforeResult.rows.length,
      linesAfter: afterResult.rows.length,
      remainingLines: afterResult.rows
    })

  } catch (error) {
    console.error('[Cleanup] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Cleanup failed'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/migrations/cleanup-operation-lines?operationId=X&productId=Y&variantId=Z
 * Remove specific product from an operation
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const operationId = searchParams.get('operationId')
    const productId = searchParams.get('productId')
    const variantId = searchParams.get('variantId')

    if (!operationId || !productId) {
      return NextResponse.json({
        success: false,
        error: 'operationId and productId are required'
      }, { status: 400 })
    }

    let deleteQuery = `
      DELETE FROM market_warehouse_operation_lines
      WHERE operation_id = $1 AND product_id = $2
    `
    const params: any[] = [parseInt(operationId), parseInt(productId)]

    if (variantId === 'null') {
      deleteQuery += ' AND variant_id IS NULL'
    } else if (variantId) {
      deleteQuery += ' AND variant_id = $3'
      params.push(parseInt(variantId))
    }

    deleteQuery += ' RETURNING id'

    const result = await db.query(deleteQuery, params)

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.rows.length} lines`,
      deletedLineIds: result.rows.map(r => r.id)
    })

  } catch (error) {
    console.error('[Cleanup] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Cleanup failed'
    }, { status: 500 })
  }
}
