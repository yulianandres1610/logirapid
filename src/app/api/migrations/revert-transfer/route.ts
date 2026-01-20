import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/revert-transfer?operationNumber=OP-2026-000002
 * Revert a transfer operation completely - return all quantities to source warehouse
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const operationNumber = searchParams.get('operationNumber')

    if (!operationNumber) {
      return NextResponse.json({
        success: false,
        error: 'operationNumber is required'
      }, { status: 400 })
    }

    // Get operation details
    const opResult = await db.query(`
      SELECT
        o.id, o.operation_number, o.status, o.validation_status,
        o.source_warehouse_id, o.destination_warehouse_id,
        sw.name as source_name,
        dw.name as dest_name
      FROM market_warehouse_operations o
      LEFT JOIN market_warehouses sw ON sw.id = o.source_warehouse_id
      LEFT JOIN market_warehouses dw ON dw.id = o.destination_warehouse_id
      WHERE o.operation_number = $1
    `, [operationNumber])

    if (opResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Operation ${operationNumber} not found`
      }, { status: 404 })
    }

    const operation = opResult.rows[0]
    console.log(`[Revert] Found operation:`, operation)

    // Get all lines grouped by product+variant
    const linesResult = await db.query(`
      SELECT
        l.product_id,
        l.variant_id,
        p.name as product_name,
        v.variant_name,
        SUM(l.quantity_planned) as total_planned,
        SUM(COALESCE(l.quantity_validated, 0)) as total_validated
      FROM market_warehouse_operation_lines l
      JOIN market_products p ON p.id = l.product_id
      LEFT JOIN market_product_variants v ON v.id = l.variant_id
      WHERE l.operation_id = $1
      GROUP BY l.product_id, l.variant_id, p.name, v.variant_name
      ORDER BY p.name, v.variant_name NULLS FIRST
    `, [operation.id])

    console.log(`[Revert] Found ${linesResult.rows.length} product groups to revert`)

    // Begin transaction
    await db.query('BEGIN')

    try {
      const sourceWarehouseId = operation.source_warehouse_id
      const destWarehouseId = operation.destination_warehouse_id
      const revertedProducts: any[] = []

      for (const line of linesResult.rows) {
        const productId = line.product_id
        const variantId = line.variant_id || null
        const plannedQty = parseFloat(line.total_planned) || 0
        const validatedQty = parseFloat(line.total_validated) || 0

        console.log(`[Revert] Processing: ${line.product_name} ${line.variant_name || ''} - planned: ${plannedQty}, validated: ${validatedQty}`)

        // 1. Release reservation in source warehouse (if pending)
        if (operation.status === 'pending') {
          await db.query(`
            UPDATE market_warehouse_stock
            SET quantity_reserved = GREATEST(0, quantity_reserved - $1),
                updated_at = NOW()
            WHERE warehouse_id = $2 AND product_id = $3
              AND (variant_id = $4 OR ($4 IS NULL AND variant_id IS NULL))
          `, [plannedQty, sourceWarehouseId, productId, variantId])

          console.log(`[Revert] Released ${plannedQty} reserved from source warehouse`)
        }

        // 2. If transfer was completed (done), reverse the stock movement
        if (operation.status === 'done') {
          // Add back to source warehouse
          const sourceResult = await db.query(`
            UPDATE market_warehouse_stock
            SET quantity_on_hand = quantity_on_hand + $1,
                quantity_reserved = GREATEST(0, quantity_reserved - $2),
                updated_at = NOW()
            WHERE warehouse_id = $3 AND product_id = $4
              AND (variant_id = $5 OR ($5 IS NULL AND variant_id IS NULL))
            RETURNING quantity_on_hand
          `, [validatedQty, plannedQty, sourceWarehouseId, productId, variantId])

          console.log(`[Revert] Added ${validatedQty} back to source, new qty: ${sourceResult.rows[0]?.quantity_on_hand}`)

          // Remove from destination warehouse
          await db.query(`
            UPDATE market_warehouse_stock
            SET quantity_on_hand = GREATEST(0, quantity_on_hand - $1),
                updated_at = NOW()
            WHERE warehouse_id = $2 AND product_id = $3
              AND (variant_id = $4 OR ($4 IS NULL AND variant_id IS NULL))
          `, [validatedQty, destWarehouseId, productId, variantId])

          console.log(`[Revert] Removed ${validatedQty} from destination warehouse`)
        }

        revertedProducts.push({
          productName: line.product_name,
          variantName: line.variant_name,
          quantityReverted: operation.status === 'done' ? validatedQty : plannedQty
        })
      }

      // 3. Delete stock movements for this operation
      const movementsDeleted = await db.query(`
        DELETE FROM market_stock_movements
        WHERE operation_id = $1
        RETURNING id
      `, [operation.id])

      console.log(`[Revert] Deleted ${movementsDeleted.rows.length} stock movements`)

      // 4. Delete operation lines
      const linesDeleted = await db.query(`
        DELETE FROM market_warehouse_operation_lines
        WHERE operation_id = $1
        RETURNING id
      `, [operation.id])

      console.log(`[Revert] Deleted ${linesDeleted.rows.length} operation lines`)

      // 5. Delete the operation itself
      await db.query(`
        DELETE FROM market_warehouse_operations
        WHERE id = $1
      `, [operation.id])

      console.log(`[Revert] Deleted operation ${operationNumber}`)

      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: `Operation ${operationNumber} reverted successfully`,
        data: {
          operationId: operation.id,
          operationNumber: operation.operation_number,
          previousStatus: operation.status,
          sourceWarehouse: operation.source_name,
          destinationWarehouse: operation.dest_name,
          productsReverted: revertedProducts.length,
          linesDeleted: linesDeleted.rows.length,
          movementsDeleted: movementsDeleted.rows.length,
          products: revertedProducts
        }
      })

    } catch (txError) {
      await db.query('ROLLBACK')
      throw txError
    }

  } catch (error) {
    console.error('[Revert Transfer] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error reverting transfer'
    }, { status: 500 })
  }
}

/**
 * GET /api/migrations/revert-transfer?operationNumber=OP-2026-000002
 * Preview what will be reverted (dry run)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const operationNumber = searchParams.get('operationNumber')

    if (!operationNumber) {
      return NextResponse.json({
        success: false,
        error: 'operationNumber is required'
      }, { status: 400 })
    }

    // Get operation details
    const opResult = await db.query(`
      SELECT
        o.id, o.operation_number, o.status, o.validation_status,
        o.source_warehouse_id, o.destination_warehouse_id,
        sw.name as source_name,
        dw.name as dest_name,
        o.created_at
      FROM market_warehouse_operations o
      LEFT JOIN market_warehouses sw ON sw.id = o.source_warehouse_id
      LEFT JOIN market_warehouses dw ON dw.id = o.destination_warehouse_id
      WHERE o.operation_number = $1
    `, [operationNumber])

    if (opResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Operation ${operationNumber} not found`
      }, { status: 404 })
    }

    const operation = opResult.rows[0]

    // Get all lines grouped by product+variant
    const linesResult = await db.query(`
      SELECT
        l.product_id,
        l.variant_id,
        p.name as product_name,
        v.variant_name,
        SUM(l.quantity_planned) as total_planned,
        SUM(COALESCE(l.quantity_validated, 0)) as total_validated
      FROM market_warehouse_operation_lines l
      JOIN market_products p ON p.id = l.product_id
      LEFT JOIN market_product_variants v ON v.id = l.variant_id
      WHERE l.operation_id = $1
      GROUP BY l.product_id, l.variant_id, p.name, v.variant_name
      ORDER BY p.name, v.variant_name NULLS FIRST
    `, [operation.id])

    const products = linesResult.rows.map(line => ({
      productName: line.product_name,
      variantName: line.variant_name,
      quantityPlanned: parseFloat(line.total_planned) || 0,
      quantityValidated: parseFloat(line.total_validated) || 0,
      willRevert: operation.status === 'done'
        ? parseFloat(line.total_validated) || 0
        : parseFloat(line.total_planned) || 0
    }))

    const totalToRevert = products.reduce((sum, p) => sum + p.willRevert, 0)

    return NextResponse.json({
      success: true,
      message: 'DRY RUN - Use POST to execute',
      data: {
        operation: {
          id: operation.id,
          operationNumber: operation.operation_number,
          status: operation.status,
          validationStatus: operation.validation_status,
          sourceWarehouse: operation.source_name,
          destinationWarehouse: operation.dest_name,
          createdAt: operation.created_at
        },
        summary: {
          totalProducts: products.length,
          totalUnitsToRevert: totalToRevert,
          action: operation.status === 'done'
            ? 'Will return validated quantities to source warehouse and remove from destination'
            : 'Will release reserved quantities in source warehouse'
        },
        products
      }
    })

  } catch (error) {
    console.error('[Revert Transfer Preview] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
