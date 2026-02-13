import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
  companyType: string
}

/**
 * POST /api/audit/counts/[countId]/apply
 * Apply audit count results to adjust stock levels or fixed asset status
 *
 * For products:
 * 1. Adjusts market_warehouse_stock to match counted quantities
 * 2. Syncs market_product_variants.quantity_on_hand
 * 3. Updates market_products.quantity_on_hand
 * 4. Records adjustment movements
 * 5. Adjusts FIFO lots for shortages
 *
 * For fixed assets:
 * 1. Marks missing assets as status = 'lost'
 * 2. Creates records in market_fixed_asset_movements
 * 3. Updates last_audit_date in found assets
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ countId: string }> }
) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    // Only ADMIN and SUPER_ADMIN can apply audit results
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN']
    if (payload.companyType !== 'market' || !allowedRoles.includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'Solo administradores pueden aplicar ajustes de auditoría'
      }, { status: 403 })
    }

    const { countId } = await params
    const countIdNum = parseInt(countId)

    if (isNaN(countIdNum)) {
      return NextResponse.json({ success: false, error: 'ID de conteo inválido' }, { status: 400 })
    }

    // Get the body for optional notes
    let notes = ''
    try {
      const body = await request.json()
      notes = body.notes || ''
    } catch {
      // No body provided, that's ok
    }

    // Verify count exists and is completed (not already applied)
    const countResult = await db.query(`
      SELECT
        ac.id, ac.count_number, ac.warehouse_id, ac.status,
        COALESCE(ac.audit_type, 'products') as audit_type,
        mw.name as warehouse_name
      FROM audit_counts ac
      JOIN market_warehouses mw ON ac.warehouse_id = mw.id
      WHERE ac.id = $1 AND ac.company_id = $2
    `, [countIdNum, payload.companyId])

    if (countResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Conteo no encontrado' }, { status: 404 })
    }

    const count = countResult.rows[0]

    if (count.status === 'applied') {
      return NextResponse.json({
        success: false,
        error: 'Este conteo ya fue aplicado anteriormente'
      }, { status: 400 })
    }

    if (count.status !== 'completed') {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden aplicar conteos completados'
      }, { status: 400 })
    }

    // Route to appropriate handler based on audit type
    if (count.audit_type === 'fixed_assets') {
      return applyFixedAssetAudit(countIdNum, count, payload, notes)
    } else {
      return applyProductAudit(countIdNum, count, payload, notes)
    }

  } catch (error) {
    console.error('[Audit Apply API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al aplicar ajustes de auditoría'
    }, { status: 500 })
  }
}

/**
 * Apply product audit adjustments
 */
async function applyProductAudit(
  countIdNum: number,
  count: { id: number; count_number: string; warehouse_id: number; warehouse_name: string },
  payload: JWTPayload,
  notes: string
) {
  // Get all lines with differences
  const linesResult = await db.query(`
    SELECT
      product_id, variant_id, product_name, product_sku,
      system_quantity, counted_quantity, difference,
      cost_price, difference_value_cost
    FROM audit_count_lines
    WHERE count_id = $1 AND difference != 0
    ORDER BY id ASC
  `, [countIdNum])

  const lines = linesResult.rows

  if (lines.length === 0) {
    // No differences to apply, just mark as applied
    await db.query(`
      UPDATE audit_counts
      SET status = 'applied', applied_at = NOW(), applied_by = $1
      WHERE id = $2
    `, [payload.userId, countIdNum])

    return NextResponse.json({
      success: true,
      message: 'Conteo aplicado (sin diferencias que ajustar)',
      data: {
        countNumber: count.count_number,
        adjustmentsApplied: 0
      }
    })
  }

  // Begin transaction
  await db.query('BEGIN')

  try {
    let adjustmentsApplied = 0
    let totalAdjustmentValue = 0

    for (const line of lines) {
      const productId = line.product_id
      const variantId = line.variant_id || null
      const countedQty = parseFloat(line.counted_quantity) || 0
      const difference = parseFloat(line.difference) || 0 // positive = shortage, negative = excess
      const adjustmentQty = -difference // We need to add this to reach counted

      // 1. Adjust market_warehouse_stock
      const stockResult = await db.query(`
        SELECT id, quantity_on_hand
        FROM market_warehouse_stock
        WHERE warehouse_id = $1 AND product_id = $2
          AND (variant_id = $3 OR ($3 IS NULL AND variant_id IS NULL))
      `, [count.warehouse_id, productId, variantId])

      let currentStockQty = 0
      if (stockResult.rows.length > 0) {
        currentStockQty = parseFloat(stockResult.rows[0].quantity_on_hand) || 0

        await db.query(`
          UPDATE market_warehouse_stock
          SET quantity_on_hand = $1, updated_at = NOW()
          WHERE id = $2
        `, [countedQty, stockResult.rows[0].id])
      } else {
        // Create stock record if it doesn't exist
        await db.query(`
          INSERT INTO market_warehouse_stock (
            warehouse_id, product_id, variant_id, quantity_on_hand, quantity_reserved, created_at
          ) VALUES ($1, $2, $3, $4, 0, NOW())
        `, [count.warehouse_id, productId, variantId, countedQty])
      }

      // 2. Record adjustment movement
      await db.query(`
        INSERT INTO market_stock_movements (
          company_id, product_id, variant_id, movement_type,
          from_warehouse_id, to_warehouse_id,
          quantity, quantity_before, quantity_after,
          reference_type, reference_id, notes, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, 'audit_adjustment', $9, $10, $11, NOW())
      `, [
        payload.companyId,
        productId,
        variantId,
        difference > 0 ? 'audit_shortage' : 'audit_excess',
        count.warehouse_id,
        adjustmentQty,
        currentStockQty,
        countedQty,
        countIdNum,
        `Ajuste por auditoría ${count.count_number}: ${line.product_name} (${line.product_sku})`,
        payload.userId
      ])

      // 3. Sync market_product_variants if applicable
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

      // 4. Update market_products total (sum from all warehouse stock for this product)
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

      // 5. Adjust FIFO lots if there's a shortage
      if (difference > 0) {
        let remainingShortage = difference

        // First try purchase lots
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

          const availableInLot = parseFloat(lot.quantity_available) || 0
          const toDeduct = Math.min(remainingShortage, availableInLot)

          await db.query(`
            UPDATE purchase_lot_inventory
            SET quantity_available = quantity_available - $1
            WHERE id = $2
          `, [toDeduct, lot.id])

          remainingShortage -= toDeduct
          console.log(`[Audit Apply] Adjusted purchase lot ${lot.lot_number}: -${toDeduct}`)
        }

        // Then try consignment lots
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

            const availableInLot = parseFloat(lot.quantity_available) || 0
            const toDeduct = Math.min(remainingShortage, availableInLot)

            await db.query(`
              UPDATE consignment_lot_inventory
              SET quantity_available = quantity_available - $1
              WHERE id = $2
            `, [toDeduct, lot.id])

            remainingShortage -= toDeduct
            console.log(`[Audit Apply] Adjusted consignment lot ${lot.lot_number}: -${toDeduct}`)
          }
        }

        if (remainingShortage > 0) {
          console.warn(`[Audit Apply] Could not fully adjust lots for product ${productId}, remaining: ${remainingShortage}`)
        }
      }

      adjustmentsApplied++
      totalAdjustmentValue += Math.abs(parseFloat(line.difference_value_cost) || 0)
    }

    // Mark audit as applied
    await db.query(`
      UPDATE audit_counts
      SET status = 'applied', applied_at = NOW(), applied_by = $1, apply_notes = $2
      WHERE id = $3
    `, [payload.userId, notes || null, countIdNum])

    // Log the application
    await db.query(`
      INSERT INTO audit_count_history (count_id, action, performed_by, changes_summary)
      VALUES ($1, 'applied', $2, $3)
    `, [
      countIdNum,
      payload.userId,
      JSON.stringify({
        auditType: 'products',
        adjustmentsApplied,
        totalAdjustmentValue,
        notes
      })
    ])

    await db.query('COMMIT')

    console.log(`[Audit Apply] Successfully applied product audit ${count.count_number}: ${adjustmentsApplied} adjustments`)

    return NextResponse.json({
      success: true,
      message: `Auditoría ${count.count_number} aplicada exitosamente`,
      data: {
        countId: countIdNum,
        countNumber: count.count_number,
        warehouseName: count.warehouse_name,
        auditType: 'products',
        adjustmentsApplied,
        totalAdjustmentValue: Math.round(totalAdjustmentValue * 100) / 100
      }
    })

  } catch (txError) {
    await db.query('ROLLBACK')
    throw txError
  }
}

/**
 * Apply fixed asset audit adjustments
 */
async function applyFixedAssetAudit(
  countIdNum: number,
  count: { id: number; count_number: string; warehouse_id: number; warehouse_name: string },
  payload: JWTPayload,
  notes: string
) {
  // Get all lines
  const linesResult = await db.query(`
    SELECT
      asset_id, asset_code, product_name as asset_name,
      scan_status, cost_price as current_value,
      expected_condition, observed_condition
    FROM audit_count_lines
    WHERE count_id = $1
    ORDER BY id ASC
  `, [countIdNum])

  const lines = linesResult.rows

  if (lines.length === 0) {
    // No assets to process, just mark as applied
    await db.query(`
      UPDATE audit_counts
      SET status = 'applied', applied_at = NOW(), applied_by = $1
      WHERE id = $2
    `, [payload.userId, countIdNum])

    return NextResponse.json({
      success: true,
      message: 'Conteo aplicado (sin activos procesados)',
      data: {
        countNumber: count.count_number,
        assetsProcessed: 0,
        assetsMarkedLost: 0
      }
    })
  }

  // Begin transaction
  await db.query('BEGIN')

  try {
    let assetsProcessed = 0
    let assetsMarkedLost = 0
    let assetsUpdated = 0
    let totalValueAtRisk = 0

    for (const line of lines) {
      if (!line.asset_id) continue

      const assetId = line.asset_id

      if (line.scan_status === 'missing') {
        // Mark asset as lost
        await db.query(`
          UPDATE market_fixed_assets
          SET status = 'lost', updated_at = NOW()
          WHERE id = $1 AND company_id = $2
        `, [assetId, payload.companyId])

        // Record movement
        await db.query(`
          INSERT INTO market_fixed_asset_movements (
            asset_id, company_id, movement_type,
            from_status, to_status, reason, created_by, created_at
          ) VALUES ($1, $2, 'status_change', 'active', 'lost', $3, $4, NOW())
        `, [
          assetId,
          payload.companyId,
          `Marcado como perdido en auditoría ${count.count_number}`,
          payload.userId
        ])

        assetsMarkedLost++
        totalValueAtRisk += parseFloat(line.current_value) || 0
        console.log(`[Audit Apply] Asset ${line.asset_code} marked as lost`)

      } else if (line.scan_status === 'found') {
        // Update last audit date
        await db.query(`
          UPDATE market_fixed_assets
          SET last_audit_date = NOW(), last_audit_by = $1, updated_at = NOW()
          WHERE id = $2 AND company_id = $3
        `, [payload.userId, assetId, payload.companyId])

        // Update condition if changed
        if (line.observed_condition && line.observed_condition !== line.expected_condition) {
          await db.query(`
            UPDATE market_fixed_assets
            SET condition = $1
            WHERE id = $2 AND company_id = $3
          `, [line.observed_condition, assetId, payload.companyId])

          // Record condition change movement
          await db.query(`
            INSERT INTO market_fixed_asset_movements (
              asset_id, company_id, movement_type,
              from_status, to_status, reason, created_by, created_at
            ) VALUES ($1, $2, 'condition_change', $3, $4, $5, $6, NOW())
          `, [
            assetId,
            payload.companyId,
            line.expected_condition,
            line.observed_condition,
            `Cambio de condición detectado en auditoría ${count.count_number}`,
            payload.userId
          ])
        }

        assetsUpdated++
      }

      assetsProcessed++
    }

    // Mark audit as applied
    await db.query(`
      UPDATE audit_counts
      SET status = 'applied', applied_at = NOW(), applied_by = $1, apply_notes = $2
      WHERE id = $3
    `, [payload.userId, notes || null, countIdNum])

    // Log the application
    await db.query(`
      INSERT INTO audit_count_history (count_id, action, performed_by, changes_summary)
      VALUES ($1, 'applied', $2, $3)
    `, [
      countIdNum,
      payload.userId,
      JSON.stringify({
        auditType: 'fixed_assets',
        assetsProcessed,
        assetsMarkedLost,
        assetsUpdated,
        totalValueAtRisk,
        notes
      })
    ])

    await db.query('COMMIT')

    console.log(`[Audit Apply] Successfully applied fixed assets audit ${count.count_number}: ${assetsProcessed} assets processed, ${assetsMarkedLost} marked lost`)

    return NextResponse.json({
      success: true,
      message: `Auditoría de activos ${count.count_number} aplicada exitosamente`,
      data: {
        countId: countIdNum,
        countNumber: count.count_number,
        warehouseName: count.warehouse_name,
        auditType: 'fixed_assets',
        assetsProcessed,
        assetsMarkedLost,
        assetsUpdated,
        totalValueAtRisk: Math.round(totalValueAtRisk * 100) / 100
      }
    })

  } catch (txError) {
    await db.query('ROLLBACK')
    throw txError
  }
}

/**
 * GET /api/audit/counts/[countId]/apply
 * Check if audit can be applied and get preview of adjustments
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ countId: string }> }
) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'MARKET_MANAGER']
    if (payload.companyType !== 'market' || !allowedRoles.includes(payload.role)) {
      return NextResponse.json({ success: false, error: 'Acceso denegado' }, { status: 403 })
    }

    const { countId } = await params
    const countIdNum = parseInt(countId)

    if (isNaN(countIdNum)) {
      return NextResponse.json({ success: false, error: 'ID de conteo inválido' }, { status: 400 })
    }

    // Get count info
    const countResult = await db.query(`
      SELECT
        ac.id, ac.count_number, ac.warehouse_id, ac.status,
        COALESCE(ac.audit_type, 'products') as audit_type,
        ac.total_shortage_value, ac.total_excess_value,
        ac.products_with_differences,
        ac.total_assets, ac.assets_found, ac.assets_missing, ac.assets_surplus,
        ac.total_value_at_risk,
        mw.name as warehouse_name
      FROM audit_counts ac
      JOIN market_warehouses mw ON ac.warehouse_id = mw.id
      WHERE ac.id = $1 AND ac.company_id = $2
    `, [countIdNum, payload.companyId])

    if (countResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Conteo no encontrado' }, { status: 404 })
    }

    const count = countResult.rows[0]

    if (count.audit_type === 'fixed_assets') {
      // Get fixed asset lines for preview
      const linesResult = await db.query(`
        SELECT
          asset_id, asset_code, product_name as asset_name,
          product_image as image_url, scan_status, cost_price as current_value,
          expected_condition, observed_condition, category_name, responsible_name
        FROM audit_count_lines
        WHERE count_id = $1
        ORDER BY
          CASE scan_status WHEN 'missing' THEN 0 WHEN 'surplus' THEN 1 ELSE 2 END,
          cost_price DESC
      `, [countIdNum])

      return NextResponse.json({
        success: true,
        data: {
          countId: countIdNum,
          countNumber: count.count_number,
          warehouseId: count.warehouse_id,
          warehouseName: count.warehouse_name,
          status: count.status,
          auditType: 'fixed_assets',
          canApply: count.status === 'completed',
          totalAssets: count.total_assets || 0,
          assetsFound: count.assets_found || 0,
          assetsMissing: count.assets_missing || 0,
          assetsSurplus: count.assets_surplus || 0,
          totalValueAtRisk: parseFloat(count.total_value_at_risk) || 0,
          assets: linesResult.rows.map(l => ({
            assetId: l.asset_id,
            assetCode: l.asset_code,
            assetName: l.asset_name,
            imageUrl: l.image_url,
            scanStatus: l.scan_status,
            currentValue: parseFloat(l.current_value) || 0,
            expectedCondition: l.expected_condition,
            observedCondition: l.observed_condition,
            categoryName: l.category_name,
            responsibleName: l.responsible_name
          }))
        }
      })
    } else {
      // Get product lines with differences for preview
      const linesResult = await db.query(`
        SELECT
          product_id, variant_id, product_name, product_sku, product_image,
          system_quantity, counted_quantity, difference,
          difference_value_cost, difference_value_sale
        FROM audit_count_lines
        WHERE count_id = $1 AND difference != 0
        ORDER BY ABS(difference_value_cost) DESC
      `, [countIdNum])

      return NextResponse.json({
        success: true,
        data: {
          countId: countIdNum,
          countNumber: count.count_number,
          warehouseId: count.warehouse_id,
          warehouseName: count.warehouse_name,
          status: count.status,
          auditType: 'products',
          canApply: count.status === 'completed',
          productsWithDifferences: count.products_with_differences,
          totalShortageValue: parseFloat(count.total_shortage_value) || 0,
          totalExcessValue: parseFloat(count.total_excess_value) || 0,
          adjustments: linesResult.rows.map(l => ({
            productId: l.product_id,
            variantId: l.variant_id,
            productName: l.product_name,
            productSku: l.product_sku,
            productImage: l.product_image,
            systemQuantity: parseFloat(l.system_quantity) || 0,
            countedQuantity: parseFloat(l.counted_quantity) || 0,
            difference: parseFloat(l.difference) || 0,
            differenceValueCost: parseFloat(l.difference_value_cost) || 0,
            differenceValueSale: parseFloat(l.difference_value_sale) || 0,
            adjustmentType: parseFloat(l.difference) > 0 ? 'shortage' : 'excess'
          }))
        }
      })
    }

  } catch (error) {
    console.error('[Audit Apply Preview API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener vista previa'
    }, { status: 500 })
  }
}
