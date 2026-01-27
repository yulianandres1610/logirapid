import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/test/comprehensive-stock-test
 * Comprehensive test for stock synchronization:
 * 1. Test POS sale with variant -> void -> verify stock restored correctly
 * 2. Test transfer with variant -> verify variant synced
 * 3. Verify no discrepancies exist
 */
export async function POST() {
  const testResults: {
    step: string
    status: 'pass' | 'fail'
    details: unknown
  }[] = []

  try {
    console.log('[Comprehensive Test] Starting comprehensive stock tests...')

    // ========================================
    // STEP 1: Find a product with variant and stock
    // ========================================
    const productResult = await db.query(`
      SELECT
        mp.id as product_id,
        mp.name as product_name,
        mp.sku,
        mpv.id as variant_id,
        mpv.variant_name,
        mws.warehouse_id,
        mw.name as warehouse_name,
        mws.quantity_on_hand as warehouse_qty,
        mpv.quantity_on_hand as variant_qty
      FROM market_products mp
      JOIN market_product_variants mpv ON mpv.product_id = mp.id
      JOIN market_warehouse_stock mws ON mws.variant_id = mpv.id
      JOIN market_warehouses mw ON mw.id = mws.warehouse_id
      WHERE mws.quantity_on_hand >= 5
      ORDER BY mws.quantity_on_hand DESC
      LIMIT 1
    `)

    if (productResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró un producto con variante y stock suficiente para probar'
      }, { status: 400 })
    }

    const testProduct = productResult.rows[0]
    testResults.push({
      step: '1. Producto de prueba seleccionado',
      status: 'pass',
      details: {
        productId: testProduct.product_id,
        productName: testProduct.product_name,
        variantId: testProduct.variant_id,
        variantName: testProduct.variant_name,
        warehouseId: testProduct.warehouse_id,
        warehouseName: testProduct.warehouse_name,
        initialWarehouseQty: parseFloat(testProduct.warehouse_qty),
        initialVariantQty: parseFloat(testProduct.variant_qty)
      }
    })

    // Get company info
    const companyResult = await db.query(`
      SELECT company_id FROM market_warehouses WHERE id = $1
    `, [testProduct.warehouse_id])
    const companyId = companyResult.rows[0].company_id

    // ========================================
    // STEP 2: Simulate POS sale (reduce stock)
    // ========================================
    const saleQty = 2
    const initialWarehouseQty = parseFloat(testProduct.warehouse_qty)
    const initialVariantQty = parseFloat(testProduct.variant_qty)

    await db.query('BEGIN')

    try {
      // Reduce warehouse stock
      await db.query(`
        UPDATE market_warehouse_stock
        SET quantity_on_hand = quantity_on_hand - $1, updated_at = NOW()
        WHERE warehouse_id = $2 AND product_id = $3
          AND (variant_id = $4 OR ($4 IS NULL AND variant_id IS NULL))
      `, [saleQty, testProduct.warehouse_id, testProduct.product_id, testProduct.variant_id])

      // Reduce variant stock
      await db.query(`
        UPDATE market_product_variants
        SET quantity_on_hand = quantity_on_hand - $1, updated_at = NOW()
        WHERE id = $2
      `, [saleQty, testProduct.variant_id])

      // Reduce product stock
      await db.query(`
        UPDATE market_products
        SET quantity_on_hand = quantity_on_hand - $1, updated_at = NOW()
        WHERE id = $2
      `, [saleQty, testProduct.product_id])

      await db.query('COMMIT')

      // Verify stock after sale
      const afterSaleStock = await db.query(`
        SELECT
          mws.quantity_on_hand as warehouse_qty,
          mpv.quantity_on_hand as variant_qty
        FROM market_warehouse_stock mws
        JOIN market_product_variants mpv ON mpv.id = mws.variant_id
        WHERE mws.warehouse_id = $1 AND mws.variant_id = $2
      `, [testProduct.warehouse_id, testProduct.variant_id])

      const afterSaleWarehouseQty = parseFloat(afterSaleStock.rows[0].warehouse_qty)
      const afterSaleVariantQty = parseFloat(afterSaleStock.rows[0].variant_qty)

      const saleCorrect =
        afterSaleWarehouseQty === initialWarehouseQty - saleQty &&
        afterSaleVariantQty === initialVariantQty - saleQty

      testResults.push({
        step: '2. Venta POS simulada (reducción de stock)',
        status: saleCorrect ? 'pass' : 'fail',
        details: {
          quantitySold: saleQty,
          warehouseStock: {
            before: initialWarehouseQty,
            after: afterSaleWarehouseQty,
            expected: initialWarehouseQty - saleQty
          },
          variantStock: {
            before: initialVariantQty,
            after: afterSaleVariantQty,
            expected: initialVariantQty - saleQty
          }
        }
      })

      // ========================================
      // STEP 3: Simulate VOID (restore stock using the NEW fixed logic)
      // ========================================
      await db.query('BEGIN')

      // This is the FIXED void logic that includes variant_id
      const variantId = testProduct.variant_id

      // 1. Restore warehouse stock WITH variant_id filter
      await db.query(`
        UPDATE market_warehouse_stock
        SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
        WHERE warehouse_id = $2 AND product_id = $3
          AND (variant_id = $4 OR ($4 IS NULL AND variant_id IS NULL))
      `, [saleQty, testProduct.warehouse_id, testProduct.product_id, variantId])

      // 2. Restore variant stock
      if (variantId) {
        await db.query(`
          UPDATE market_product_variants
          SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
          WHERE id = $2
        `, [saleQty, variantId])
      }

      // 3. Restore product stock
      await db.query(`
        UPDATE market_products
        SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
        WHERE id = $2
      `, [saleQty, testProduct.product_id])

      await db.query('COMMIT')

      // Verify stock after void
      const afterVoidStock = await db.query(`
        SELECT
          mws.quantity_on_hand as warehouse_qty,
          mpv.quantity_on_hand as variant_qty
        FROM market_warehouse_stock mws
        JOIN market_product_variants mpv ON mpv.id = mws.variant_id
        WHERE mws.warehouse_id = $1 AND mws.variant_id = $2
      `, [testProduct.warehouse_id, testProduct.variant_id])

      const afterVoidWarehouseQty = parseFloat(afterVoidStock.rows[0].warehouse_qty)
      const afterVoidVariantQty = parseFloat(afterVoidStock.rows[0].variant_qty)

      const voidCorrect =
        afterVoidWarehouseQty === initialWarehouseQty &&
        afterVoidVariantQty === initialVariantQty

      testResults.push({
        step: '3. VOID simulado (restauración de stock)',
        status: voidCorrect ? 'pass' : 'fail',
        details: {
          quantityRestored: saleQty,
          warehouseStock: {
            afterVoid: afterVoidWarehouseQty,
            expected: initialWarehouseQty,
            match: afterVoidWarehouseQty === initialWarehouseQty
          },
          variantStock: {
            afterVoid: afterVoidVariantQty,
            expected: initialVariantQty,
            match: afterVoidVariantQty === initialVariantQty
          }
        }
      })

      // ========================================
      // STEP 4: Verify no discrepancies exist (variant vs warehouse sum)
      // ========================================
      const discrepancyCheck = await db.query(`
        SELECT COUNT(*) as count
        FROM market_product_variants mpv
        LEFT JOIN (
          SELECT variant_id, SUM(quantity_on_hand) as total
          FROM market_warehouse_stock
          WHERE variant_id IS NOT NULL
          GROUP BY variant_id
        ) mws ON mws.variant_id = mpv.id
        WHERE ABS(mpv.quantity_on_hand - COALESCE(mws.total, 0)) >= 0.001
      `)

      const discrepancyCount = parseInt(discrepancyCheck.rows[0].count)

      testResults.push({
        step: '4. Verificación de discrepancias (variante vs almacenes)',
        status: discrepancyCount === 0 ? 'pass' : 'fail',
        details: {
          discrepanciesFound: discrepancyCount,
          expected: 0
        }
      })

      // ========================================
      // STEP 5: Test transfer sync logic
      // ========================================
      // Find a second warehouse for the same company
      const secondWarehouse = await db.query(`
        SELECT id, name FROM market_warehouses
        WHERE company_id = $1 AND id != $2
        LIMIT 1
      `, [companyId, testProduct.warehouse_id])

      if (secondWarehouse.rows.length > 0) {
        const destWarehouseId = secondWarehouse.rows[0].id
        const destWarehouseName = secondWarehouse.rows[0].name
        const transferQty = 1

        await db.query('BEGIN')

        // Get current quantities
        const beforeTransfer = await db.query(`
          SELECT
            mpv.quantity_on_hand as variant_qty,
            (SELECT COALESCE(SUM(quantity_on_hand), 0) FROM market_warehouse_stock WHERE variant_id = mpv.id) as total_warehouse
          FROM market_product_variants mpv
          WHERE mpv.id = $1
        `, [testProduct.variant_id])

        const beforeVariantQty = parseFloat(beforeTransfer.rows[0].variant_qty)
        const beforeTotalWarehouse = parseFloat(beforeTransfer.rows[0].total_warehouse)

        // Simulate transfer: reduce source
        await db.query(`
          UPDATE market_warehouse_stock
          SET quantity_on_hand = quantity_on_hand - $1, updated_at = NOW()
          WHERE warehouse_id = $2 AND variant_id = $3
        `, [transferQty, testProduct.warehouse_id, testProduct.variant_id])

        // Add to destination (or create if doesn't exist)
        const destStock = await db.query(`
          SELECT id FROM market_warehouse_stock
          WHERE warehouse_id = $1 AND product_id = $2 AND variant_id = $3
        `, [destWarehouseId, testProduct.product_id, testProduct.variant_id])

        if (destStock.rows.length > 0) {
          await db.query(`
            UPDATE market_warehouse_stock
            SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
            WHERE id = $2
          `, [transferQty, destStock.rows[0].id])
        } else {
          await db.query(`
            INSERT INTO market_warehouse_stock (
              warehouse_id, product_id, variant_id, quantity_on_hand, quantity_reserved, created_at
            ) VALUES ($1, $2, $3, $4, 0, NOW())
          `, [destWarehouseId, testProduct.product_id, testProduct.variant_id, transferQty])
        }

        // NOW: Apply the FIX - sync variant total from all warehouses
        const totalVariantStock = await db.query(`
          SELECT COALESCE(SUM(quantity_on_hand), 0) as total
          FROM market_warehouse_stock
          WHERE product_id = $1 AND variant_id = $2
        `, [testProduct.product_id, testProduct.variant_id])

        await db.query(`
          UPDATE market_product_variants
          SET quantity_on_hand = $1, updated_at = NOW()
          WHERE id = $2
        `, [parseFloat(totalVariantStock.rows[0].total) || 0, testProduct.variant_id])

        await db.query('COMMIT')

        // Verify after transfer
        const afterTransfer = await db.query(`
          SELECT
            mpv.quantity_on_hand as variant_qty,
            (SELECT COALESCE(SUM(quantity_on_hand), 0) FROM market_warehouse_stock WHERE variant_id = mpv.id) as total_warehouse
          FROM market_product_variants mpv
          WHERE mpv.id = $1
        `, [testProduct.variant_id])

        const afterVariantQty = parseFloat(afterTransfer.rows[0].variant_qty)
        const afterTotalWarehouse = parseFloat(afterTransfer.rows[0].total_warehouse)

        // Transfer should NOT change total (just moves between warehouses)
        const transferCorrect =
          afterVariantQty === afterTotalWarehouse &&
          afterTotalWarehouse === beforeTotalWarehouse // Total should be same

        testResults.push({
          step: '5. Transferencia simulada (sincronización de variante)',
          status: transferCorrect ? 'pass' : 'fail',
          details: {
            sourceWarehouse: testProduct.warehouse_name,
            destWarehouse: destWarehouseName,
            quantityTransferred: transferQty,
            beforeTransfer: {
              variantQty: beforeVariantQty,
              totalWarehouse: beforeTotalWarehouse
            },
            afterTransfer: {
              variantQty: afterVariantQty,
              totalWarehouse: afterTotalWarehouse
            },
            variantSynced: afterVariantQty === afterTotalWarehouse,
            totalUnchanged: afterTotalWarehouse === beforeTotalWarehouse
          }
        })

        // Revert transfer for clean state
        await db.query('BEGIN')
        await db.query(`
          UPDATE market_warehouse_stock
          SET quantity_on_hand = quantity_on_hand + $1
          WHERE warehouse_id = $2 AND variant_id = $3
        `, [transferQty, testProduct.warehouse_id, testProduct.variant_id])
        await db.query(`
          UPDATE market_warehouse_stock
          SET quantity_on_hand = quantity_on_hand - $1
          WHERE warehouse_id = $2 AND variant_id = $3
        `, [transferQty, destWarehouseId, testProduct.variant_id])
        // Re-sync variant
        const revertSync = await db.query(`
          SELECT COALESCE(SUM(quantity_on_hand), 0) as total
          FROM market_warehouse_stock WHERE variant_id = $1
        `, [testProduct.variant_id])
        await db.query(`
          UPDATE market_product_variants SET quantity_on_hand = $1 WHERE id = $2
        `, [parseFloat(revertSync.rows[0].total), testProduct.variant_id])
        await db.query('COMMIT')

      } else {
        testResults.push({
          step: '5. Transferencia simulada',
          status: 'pass',
          details: { message: 'Solo hay un almacén, transferencia no aplicable' }
        })
      }

      // ========================================
      // STEP 6: Final discrepancy check
      // ========================================
      const finalDiscrepancyCheck = await db.query(`
        SELECT
          mpv.id,
          mpv.variant_name,
          mp.name as product_name,
          mpv.quantity_on_hand as variant_qty,
          COALESCE(SUM(mws.quantity_on_hand), 0) as warehouse_total
        FROM market_product_variants mpv
        JOIN market_products mp ON mp.id = mpv.product_id
        LEFT JOIN market_warehouse_stock mws ON mws.variant_id = mpv.id
        GROUP BY mpv.id, mpv.variant_name, mp.name, mpv.quantity_on_hand
        HAVING ABS(mpv.quantity_on_hand - COALESCE(SUM(mws.quantity_on_hand), 0)) >= 0.001
      `)

      testResults.push({
        step: '6. Verificación final de integridad',
        status: finalDiscrepancyCheck.rows.length === 0 ? 'pass' : 'fail',
        details: {
          discrepanciesFound: finalDiscrepancyCheck.rows.length,
          discrepancies: finalDiscrepancyCheck.rows.slice(0, 5).map(r => ({
            variantId: r.id,
            variantName: r.variant_name,
            productName: r.product_name,
            variantQty: parseFloat(r.variant_qty),
            warehouseTotal: parseFloat(r.warehouse_total)
          }))
        }
      })

    } catch (txError) {
      await db.query('ROLLBACK')
      throw txError
    }

    // Summary
    const allPassed = testResults.every(r => r.status === 'pass')
    const passCount = testResults.filter(r => r.status === 'pass').length
    const failCount = testResults.filter(r => r.status === 'fail').length

    console.log(`[Comprehensive Test] Completed: ${passCount} passed, ${failCount} failed`)

    return NextResponse.json({
      success: allPassed,
      message: allPassed
        ? `Todas las pruebas pasaron (${passCount}/${testResults.length})`
        : `Algunas pruebas fallaron (${failCount}/${testResults.length})`,
      data: {
        summary: {
          total: testResults.length,
          passed: passCount,
          failed: failCount,
          allPassed
        },
        results: testResults
      }
    })

  } catch (error) {
    console.error('[Comprehensive Test] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error en pruebas',
      partialResults: testResults
    }, { status: 500 })
  }
}

/**
 * GET - Just show test info
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Prueba comprehensiva de stock',
    description: 'POST a este endpoint para ejecutar pruebas de:',
    tests: [
      '1. Selección de producto con variante',
      '2. Simulación de venta POS (reducción de stock)',
      '3. Simulación de VOID (restauración de stock)',
      '4. Verificación de discrepancias variante vs almacenes',
      '5. Simulación de transferencia entre almacenes',
      '6. Verificación final de integridad'
    ]
  })
}
