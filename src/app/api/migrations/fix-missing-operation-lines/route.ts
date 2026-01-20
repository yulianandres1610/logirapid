import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/fix-missing-operation-lines
 * Show what lines are missing from operations based on reserved stock
 */
export async function GET() {
  try {
    // Find reserved stock that might not have corresponding operation lines
    // We look for reserved stock and check if there's a matching pending operation line

    // Get all pending internal operations
    const pendingOps = await db.query(`
      SELECT id, operation_number, source_warehouse_id, destination_warehouse_id
      FROM market_warehouse_operations
      WHERE operation_type = 'internal'
        AND status = 'pending'
        AND validation_status = 'pending_validation'
    `)

    const results = []

    for (const op of pendingOps.rows) {
      // Get reserved stock in source warehouse
      const reservedStock = await db.query(`
        SELECT
          ws.product_id,
          ws.variant_id,
          p.name as product_name,
          v.variant_name,
          ws.quantity_reserved
        FROM market_warehouse_stock ws
        JOIN market_products p ON p.id = ws.product_id
        LEFT JOIN market_product_variants v ON v.id = ws.variant_id
        WHERE ws.warehouse_id = $1
          AND ws.quantity_reserved > 0
        ORDER BY p.name, v.variant_name
      `, [op.source_warehouse_id])

      // Get existing operation lines
      const existingLines = await db.query(`
        SELECT product_id, variant_id, SUM(quantity_planned) as total_planned
        FROM market_warehouse_operation_lines
        WHERE operation_id = $1
        GROUP BY product_id, variant_id
      `, [op.id])

      // Find missing lines
      const existingSet = new Set(
        existingLines.rows.map(l => `${l.product_id}-${l.variant_id || 'null'}`)
      )

      const missingLines = reservedStock.rows.filter(rs => {
        const key = `${rs.product_id}-${rs.variant_id || 'null'}`
        return !existingSet.has(key)
      })

      if (missingLines.length > 0) {
        results.push({
          operationId: op.id,
          operationNumber: op.operation_number,
          sourceWarehouseId: op.source_warehouse_id,
          missingLines: missingLines.map(ml => ({
            productId: ml.product_id,
            variantId: ml.variant_id,
            productName: ml.product_name,
            variantName: ml.variant_name,
            quantityReserved: parseFloat(ml.quantity_reserved)
          }))
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Analysis of missing operation lines',
      operations: results,
      warning: 'POST to this endpoint to add missing lines to operations'
    })

  } catch (error) {
    console.error('[Migration] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}

/**
 * POST /api/migrations/fix-missing-operation-lines
 * Add missing lines to operations based on reserved stock
 */
export async function POST() {
  try {
    console.log('[Migration] Starting fix-missing-operation-lines...')

    // Get all pending internal operations
    const pendingOps = await db.query(`
      SELECT id, operation_number, source_warehouse_id, destination_warehouse_id
      FROM market_warehouse_operations
      WHERE operation_type = 'internal'
        AND status = 'pending'
        AND validation_status = 'pending_validation'
    `)

    const addedLines: any[] = []

    for (const op of pendingOps.rows) {
      // Get reserved stock in source warehouse
      const reservedStock = await db.query(`
        SELECT
          ws.product_id,
          ws.variant_id,
          p.name as product_name,
          v.variant_name,
          ws.quantity_reserved
        FROM market_warehouse_stock ws
        JOIN market_products p ON p.id = ws.product_id
        LEFT JOIN market_product_variants v ON v.id = ws.variant_id
        WHERE ws.warehouse_id = $1
          AND ws.quantity_reserved > 0
        ORDER BY p.name, v.variant_name
      `, [op.source_warehouse_id])

      // Get existing operation lines
      const existingLines = await db.query(`
        SELECT product_id, variant_id, SUM(quantity_planned) as total_planned
        FROM market_warehouse_operation_lines
        WHERE operation_id = $1
        GROUP BY product_id, variant_id
      `, [op.id])

      // Find missing lines
      const existingSet = new Set(
        existingLines.rows.map(l => `${l.product_id}-${l.variant_id || 'null'}`)
      )

      for (const rs of reservedStock.rows) {
        const key = `${rs.product_id}-${rs.variant_id || 'null'}`
        if (!existingSet.has(key)) {
          // Add missing line
          const quantity = parseFloat(rs.quantity_reserved)

          await db.query(`
            INSERT INTO market_warehouse_operation_lines
              (operation_id, product_id, variant_id, quantity_planned, quantity_validated, line_status)
            VALUES ($1, $2, $3, $4, 0, 'pending')
          `, [op.id, rs.product_id, rs.variant_id, quantity])

          console.log(`[Migration] Added line: ${rs.product_name} ${rs.variant_name || ''} (${quantity}) to operation ${op.operation_number}`)

          addedLines.push({
            operationId: op.id,
            operationNumber: op.operation_number,
            productName: rs.product_name,
            variantName: rs.variant_name,
            quantity: quantity
          })
        }
      }
    }

    console.log(`[Migration] fix-missing-operation-lines completed: ${addedLines.length} lines added`)

    return NextResponse.json({
      success: true,
      message: `Migration completed: ${addedLines.length} lines added`,
      addedLines
    })

  } catch (error) {
    console.error('[Migration] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed'
    }, { status: 500 })
  }
}
