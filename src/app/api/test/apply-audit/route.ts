import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/test/apply-audit
 * Get preview of audit application (without auth for testing)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const countNumber = searchParams.get('countNumber') || 'AUD-2026-4554'

    // Get the audit count
    const countResult = await db.query(`
      SELECT
        ac.id,
        ac.count_number,
        ac.warehouse_id,
        ac.status,
        ac.total_shortage_value,
        ac.total_excess_value,
        ac.products_with_differences,
        mw.name as warehouse_name
      FROM audit_counts ac
      JOIN market_warehouses mw ON mw.id = ac.warehouse_id
      WHERE ac.count_number = $1
    `, [countNumber])

    if (countResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Audit ${countNumber} not found`
      }, { status: 404 })
    }

    const count = countResult.rows[0]

    // Get lines with differences
    const linesResult = await db.query(`
      SELECT
        product_id, variant_id, product_name, product_sku,
        system_quantity, counted_quantity, difference,
        difference_value_cost, difference_value_sale
      FROM audit_count_lines
      WHERE count_id = $1 AND difference != 0
      ORDER BY ABS(difference_value_cost) DESC
    `, [count.id])

    return NextResponse.json({
      success: true,
      data: {
        audit: {
          id: count.id,
          countNumber: count.count_number,
          warehouseId: count.warehouse_id,
          warehouseName: count.warehouse_name,
          status: count.status,
          canApply: count.status === 'completed',
          productsWithDifferences: count.products_with_differences,
          totalShortageValue: parseFloat(count.total_shortage_value) || 0,
          totalExcessValue: parseFloat(count.total_excess_value) || 0
        },
        adjustments: linesResult.rows.map(l => ({
          productId: l.product_id,
          variantId: l.variant_id,
          productName: l.product_name,
          productSku: l.product_sku,
          systemQty: parseFloat(l.system_quantity) || 0,
          countedQty: parseFloat(l.counted_quantity) || 0,
          difference: parseFloat(l.difference) || 0,
          type: parseFloat(l.difference) > 0 ? 'FALTANTE' : 'SOBRANTE'
        })),
        totalAdjustments: linesResult.rows.length
      }
    })

  } catch (error) {
    console.error('[Test Apply Audit] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}

/**
 * POST /api/test/apply-audit
 * Apply audit adjustments (bypasses auth for testing)
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const countNumber = searchParams.get('countNumber') || 'AUD-2026-4554'

    // Get the audit count
    const countResult = await db.query(`
      SELECT
        ac.id, ac.count_number, ac.warehouse_id, ac.status, ac.company_id,
        mw.name as warehouse_name
      FROM audit_counts ac
      JOIN market_warehouses mw ON mw.id = ac.warehouse_id
      WHERE ac.count_number = $1
    `, [countNumber])

    if (countResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Audit ${countNumber} not found`
      }, { status: 404 })
    }

    const count = countResult.rows[0]

    // Get a valid user ID for audit trail
    const userResult = await db.query(`
      SELECT id FROM users WHERE id IN (
        SELECT userid FROM user_companies WHERE companyid = $1
      ) LIMIT 1
    `, [count.company_id])

    const userId = userResult.rows.length > 0 ? userResult.rows[0].id : null

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró un usuario válido para registrar el ajuste'
      }, { status: 400 })
    }

    if (count.status === 'applied') {
      return NextResponse.json({
        success: false,
        error: 'Esta auditoría ya fue aplicada'
      }, { status: 400 })
    }

    if (count.status !== 'completed') {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden aplicar auditorías completadas'
      }, { status: 400 })
    }

    // Get lines with differences
    const linesResult = await db.query(`
      SELECT
        product_id, variant_id, product_name, product_sku,
        system_quantity, counted_quantity, difference,
        cost_price, difference_value_cost
      FROM audit_count_lines
      WHERE count_id = $1 AND difference != 0
    `, [count.id])

    if (linesResult.rows.length === 0) {
      // No differences, just mark as applied
      await db.query(`
        UPDATE audit_counts
        SET status = 'applied', applied_at = NOW()
        WHERE id = $1
      `, [count.id])

      return NextResponse.json({
        success: true,
        message: 'Auditoría aplicada (sin ajustes necesarios)',
        data: { adjustmentsApplied: 0 }
      })
    }

    // Begin transaction
    await db.query('BEGIN')

    try {
      let adjustmentsApplied = 0
      const results: Array<{
        productName: string
        variantId: number | null
        oldQty: number
        newQty: number
        adjustment: number
      }> = []

      for (const line of linesResult.rows) {
        const productId = line.product_id
        const variantId = line.variant_id || null
        const countedQty = parseFloat(line.counted_quantity) || 0
        const difference = parseFloat(line.difference) || 0

        // 1. Get current stock
        const stockResult = await db.query(`
          SELECT id, quantity_on_hand
          FROM market_warehouse_stock
          WHERE warehouse_id = $1 AND product_id = $2
            AND (variant_id = $3 OR ($3 IS NULL AND variant_id IS NULL))
        `, [count.warehouse_id, productId, variantId])

        let currentQty = 0
        if (stockResult.rows.length > 0) {
          currentQty = parseFloat(stockResult.rows[0].quantity_on_hand) || 0

          // Update to counted quantity
          await db.query(`
            UPDATE market_warehouse_stock
            SET quantity_on_hand = $1, updated_at = NOW()
            WHERE id = $2
          `, [countedQty, stockResult.rows[0].id])
        } else {
          // Create if doesn't exist
          await db.query(`
            INSERT INTO market_warehouse_stock (
              warehouse_id, product_id, variant_id, quantity_on_hand, quantity_reserved, created_at
            ) VALUES ($1, $2, $3, $4, 0, NOW())
          `, [count.warehouse_id, productId, variantId, countedQty])
        }

        // 2. Record movement
        await db.query(`
          INSERT INTO market_stock_movements (
            company_id, product_id, variant_id, movement_type,
            from_warehouse_id, to_warehouse_id,
            quantity, quantity_before, quantity_after,
            reference_type, reference_id, notes, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, 'audit_adjustment', $9, $10, $11, NOW())
        `, [
          count.company_id,
          productId,
          variantId,
          difference > 0 ? 'audit_shortage' : 'audit_excess',
          count.warehouse_id,
          -difference, // adjustment quantity
          currentQty,
          countedQty,
          count.id,
          `Ajuste por auditoría ${count.count_number}: ${line.product_name}`,
          userId
        ])

        // 3. Sync variant if applicable
        if (variantId) {
          const totalVariantStock = await db.query(`
            SELECT COALESCE(SUM(quantity_on_hand), 0) as total
            FROM market_warehouse_stock
            WHERE product_id = $1 AND variant_id = $2
          `, [productId, variantId])

          await db.query(`
            UPDATE market_product_variants
            SET quantity_on_hand = $1, updated_at = NOW()
            WHERE id = $2
          `, [parseFloat(totalVariantStock.rows[0].total) || 0, variantId])
        }

        // 4. Update product total
        const totalProductStock = await db.query(`
          SELECT COALESCE(SUM(quantity_on_hand), 0) as total
          FROM market_warehouse_stock
          WHERE product_id = $1
        `, [productId])

        await db.query(`
          UPDATE market_products
          SET quantity_on_hand = $1, updated_at = NOW()
          WHERE id = $2
        `, [parseFloat(totalProductStock.rows[0].total) || 0, productId])

        // 5. Adjust FIFO lots for shortages
        if (difference > 0) {
          let remainingShortage = difference

          // Adjust purchase lots
          const purchaseLots = await db.query(`
            SELECT id, lot_number, quantity_available
            FROM purchase_lot_inventory
            WHERE warehouse_id = $1 AND product_id = $2
              AND (variant_id = $3 OR ($3 IS NULL AND variant_id IS NULL))
              AND quantity_available > 0
            ORDER BY received_at DESC
            FOR UPDATE
          `, [count.warehouse_id, productId, variantId])

          for (const lot of purchaseLots.rows) {
            if (remainingShortage <= 0) break

            const available = parseFloat(lot.quantity_available) || 0
            const toDeduct = Math.min(remainingShortage, available)

            await db.query(`
              UPDATE purchase_lot_inventory
              SET quantity_available = quantity_available - $1
              WHERE id = $2
            `, [toDeduct, lot.id])

            remainingShortage -= toDeduct
          }

          // Adjust consignment lots
          if (remainingShortage > 0) {
            const consignmentLots = await db.query(`
              SELECT id, lot_number, quantity_available
              FROM consignment_lot_inventory
              WHERE warehouse_id = $1 AND product_id = $2
                AND (variant_id = $3 OR ($3 IS NULL AND variant_id IS NULL))
                AND quantity_available > 0
              ORDER BY received_at DESC
              FOR UPDATE
            `, [count.warehouse_id, productId, variantId])

            for (const lot of consignmentLots.rows) {
              if (remainingShortage <= 0) break

              const available = parseFloat(lot.quantity_available) || 0
              const toDeduct = Math.min(remainingShortage, available)

              await db.query(`
                UPDATE consignment_lot_inventory
                SET quantity_available = quantity_available - $1
                WHERE id = $2
              `, [toDeduct, lot.id])

              remainingShortage -= toDeduct
            }
          }
        }

        results.push({
          productName: line.product_name,
          variantId,
          oldQty: currentQty,
          newQty: countedQty,
          adjustment: countedQty - currentQty
        })

        adjustmentsApplied++
      }

      // Mark audit as applied
      await db.query(`
        UPDATE audit_counts
        SET status = 'applied', applied_at = NOW(), apply_notes = 'Aplicado via test endpoint'
        WHERE id = $1
      `, [count.id])

      // Log application
      await db.query(`
        INSERT INTO audit_count_history (count_id, action, performed_by, changes_summary)
        VALUES ($1, 'applied', $2, $3)
      `, [count.id, userId, JSON.stringify({ adjustmentsApplied, results: results.slice(0, 10) })])

      await db.query('COMMIT')

      console.log(`[Test Apply Audit] Applied ${count.count_number}: ${adjustmentsApplied} adjustments`)

      return NextResponse.json({
        success: true,
        message: `Auditoría ${count.count_number} aplicada exitosamente`,
        data: {
          countNumber: count.count_number,
          warehouseName: count.warehouse_name,
          adjustmentsApplied,
          results
        }
      })

    } catch (txError) {
      await db.query('ROLLBACK')
      throw txError
    }

  } catch (error) {
    console.error('[Test Apply Audit] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
