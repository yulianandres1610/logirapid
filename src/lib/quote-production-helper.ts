import { db } from '@/lib/database'

interface QuoteLine {
  productId: number
  productName: string
  quantity: number
  estimatedDelivery?: string | null
}

/**
 * Auto-create production plans in draft status for quote lines
 * that have an active formula and insufficient stock.
 *
 * - warehouse_id of plan = central warehouse (raw materials source)
 * - target_warehouse_id of plan = quote's selected warehouse or central warehouse
 */
export async function createProductionPlansForQuote(
  companyId: number,
  warehouseId: number | null,
  quoteNumber: string,
  quoteId: number,
  lines: QuoteLine[]
): Promise<{ plansCreated: number; planNumbers: string[] }> {
  // Find central warehouse
  const centralResult = await db.query(
    'SELECT id FROM market_warehouses WHERE company_id = $1 AND is_central = true LIMIT 1',
    [companyId]
  )
  const centralWarehouseId = centralResult.rows[0]?.id
  if (!centralWarehouseId) {
    console.log('[QuoteProductionHelper] No central warehouse found, skipping production plans')
    return { plansCreated: 0, planNumbers: [] }
  }

  // Use quote warehouse or fallback to central warehouse for stock check and target
  const targetWarehouseId = warehouseId || centralWarehouseId

  // === Check for paint products first ===
  const paintResult = await createPaintOrderForQuote(companyId, centralWarehouseId, targetWarehouseId, quoteNumber, quoteId, lines)

  const planNumbers: string[] = [...paintResult.orderNumbers]

  for (const line of lines) {
    // Skip paint products (already handled)
    if (paintResult.paintProductIds.has(line.productId)) continue
    try {
      // Check current stock to calculate deficit (check across all warehouses)
      let stockOnHand = 0
      try {
        const stockResult = await db.query(
          'SELECT COALESCE(SUM(quantity_on_hand), 0) as total_stock FROM market_warehouse_stock WHERE product_id = $1 AND company_id = $2',
          [line.productId, companyId]
        )
        stockOnHand = parseFloat(stockResult.rows[0]?.total_stock) || 0
      } catch {
        // Try without company_id filter (older schema)
        try {
          const stockResult2 = await db.query(
            'SELECT quantity_on_hand FROM market_warehouse_stock WHERE product_id = $1 AND warehouse_id = $2',
            [line.productId, targetWarehouseId]
          )
          stockOnHand = parseFloat(stockResult2.rows[0]?.quantity_on_hand) || 0
        } catch { /* no stock record */ }
      }

      const deficit = line.quantity - stockOnHand
      if (deficit <= 0) continue

      // Find active formula
      const formulaResult = await db.query(`
        SELECT f.id, f.yield_quantity, f.labor_cost_per_batch
        FROM market_production_formulas f
        WHERE f.target_product_id = $1 AND f.company_id = $2 AND f.is_active = true
        LIMIT 1
      `, [line.productId, companyId])

      if (formulaResult.rows.length === 0) continue

      const formula = formulaResult.rows[0]
      const yieldQuantity = parseFloat(formula.yield_quantity) || 1
      const multiplier = deficit / yieldQuantity

      // Get formula lines with costs
      const formulaLinesResult = await db.query(`
        SELECT fl.raw_material_id, fl.quantity, p.cost_price
        FROM market_production_formula_lines fl
        JOIN market_products p ON fl.raw_material_id = p.id
        WHERE fl.formula_id = $1
      `, [formula.id])

      if (formulaLinesResult.rows.length === 0) continue

      // Generate plan number
      const planNumber = await generatePlanNumber(companyId)

      // Calculate planned date (today + 3 days)
      const plannedDate = new Date()
      plannedDate.setDate(plannedDate.getDate() + 3)
      const plannedDateStr = plannedDate.toISOString().split('T')[0]

      const laborCost = parseFloat(formula.labor_cost_per_batch) || 0

      // Create plan
      const planResult = await db.query(`
        INSERT INTO market_production_plans (
          company_id, plan_number, formula_id, warehouse_id, target_warehouse_id,
          planned_date, planned_quantity, batches, status,
          labor_cost, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9, $10, NULL)
        RETURNING id
      `, [
        companyId,
        planNumber,
        formula.id,
        centralWarehouseId,
        targetWarehouseId,
        plannedDateStr,
        deficit,
        1,
        laborCost,
        `Auto-generado por oferta ${quoteNumber}`
      ])

      const planId = planResult.rows[0].id

      // Insert materials
      let totalMaterialsCost = 0
      for (const fl of formulaLinesResult.rows) {
        const quantityRequired = parseFloat(fl.quantity) * multiplier
        const unitCost = parseFloat(fl.cost_price) || 0
        const lineCost = quantityRequired * unitCost
        totalMaterialsCost += lineCost

        await db.query(`
          INSERT INTO market_production_plan_materials (
            plan_id, raw_material_id, quantity_required, unit_cost, total_cost, status
          ) VALUES ($1, $2, $3, $4, $5, 'pending')
        `, [planId, fl.raw_material_id, quantityRequired, unitCost, lineCost])
      }

      // Update plan with costs
      const totalCost = totalMaterialsCost + laborCost
      const costPerUnit = deficit > 0 ? totalCost / deficit : 0

      await db.query(`
        UPDATE market_production_plans
        SET materials_cost = $1, total_cost = $2, cost_per_unit = $3
        WHERE id = $4
      `, [totalMaterialsCost, totalCost, costPerUnit, planId])

      planNumbers.push(planNumber)
      console.log(`[QuoteProductionHelper] Created plan ${planNumber} for product ${line.productName} (qty: ${deficit})`)

    } catch (error) {
      console.error(`[QuoteProductionHelper] Error creating plan for product ${line.productId}:`, error)
    }
  }

  return { plansCreated: planNumbers.length, planNumbers }
}

/**
 * Create a paint production order for paint products in the quote
 */
async function createPaintOrderForQuote(
  companyId: number,
  centralWarehouseId: number,
  targetWarehouseId: number,
  quoteNumber: string,
  quoteId: number,
  lines: QuoteLine[]
): Promise<{ orderNumbers: string[]; paintProductIds: Set<number> }> {
  const paintProductIds = new Set<number>()
  const paintLines: { colorCardId: number; packagingSpecId: number; quantityUnits: number; productId: number }[] = []

  for (const line of lines) {
    try {
      const prodResult = await db.query(
        'SELECT paint_color_card_id, paint_packaging_spec_id FROM market_products WHERE id = $1',
        [line.productId]
      )
      const prod = prodResult.rows[0]
      if (prod?.paint_color_card_id && prod?.paint_packaging_spec_id) {
        paintProductIds.add(line.productId)
        paintLines.push({
          colorCardId: prod.paint_color_card_id,
          packagingSpecId: prod.paint_packaging_spec_id,
          quantityUnits: Math.ceil(line.quantity),
          productId: line.productId
        })
      }
    } catch { /* product might not have paint columns yet */ }
  }

  if (paintLines.length === 0) return { orderNumbers: [], paintProductIds }

  try {
    // Generate order number (use MAX to avoid collision)
    const yearStr = new Date().getFullYear().toString()
    const prefix = `PPRD-${yearStr}-`
    const lastResult = await db.query(
      `SELECT order_number FROM paint_production_orders WHERE company_id = $1 AND order_number LIKE $2 ORDER BY order_number DESC LIMIT 1`,
      [companyId, `${prefix}%`]
    )
    let nextNum = 1
    if (lastResult.rows.length > 0) {
      const lastNum = lastResult.rows[0].order_number.split('-').pop()
      nextNum = (parseInt(lastNum) || 0) + 1
    }
    const orderNumber = `${prefix}${String(nextNum).padStart(5, '0')}`

    // Create order in transaction
    await db.query('BEGIN')
    const orderResult = await db.query(`
      INSERT INTO paint_production_orders (company_id, order_number, status, warehouse_id, target_warehouse_id, source_quote_id, notes, planned_date)
      VALUES ($1, $2, 'draft', $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      companyId, orderNumber, centralWarehouseId, targetWarehouseId, quoteId,
      `Auto-generado por oferta ${quoteNumber}`,
      new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
    ])

    const orderId = orderResult.rows[0].id

    // Insert lines
    for (const pl of paintLines) {
      const pkg = await db.query('SELECT net_weight_kg FROM paint_packaging_specs WHERE id = $1', [pl.packagingSpecId])
      const netWeightKg = pkg.rows[0] ? parseFloat(pkg.rows[0].net_weight_kg) : 1
      const totalWeightKg = pl.quantityUnits * netWeightKg

      await db.query(`
        INSERT INTO paint_production_lines (paint_order_id, color_card_id, packaging_spec_id, finished_product_id, quantity_units, total_weight_kg)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [orderId, pl.colorCardId, pl.packagingSpecId, pl.productId, pl.quantityUnits, totalWeightKg])
    }

    await db.query('COMMIT')
    console.log(`[QuoteProductionHelper] Created paint order ${orderNumber} with ${paintLines.length} lines from offer ${quoteNumber}`)
    return { orderNumbers: [orderNumber], paintProductIds }
  } catch (error) {
    try { await db.query('ROLLBACK') } catch { /* ignore */ }
    console.error('[QuoteProductionHelper] Error creating paint order:', error)
    return { orderNumbers: [], paintProductIds: new Set<number>() } // Return empty set so products get regular plans
  }
}

async function generatePlanNumber(companyId: number): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `PLAN-${year}-`

  const result = await db.query(`
    SELECT plan_number FROM market_production_plans
    WHERE company_id = $1 AND plan_number LIKE $2
    ORDER BY plan_number DESC
    LIMIT 1
  `, [companyId, `${prefix}%`])

  let nextNumber = 1
  if (result.rows.length > 0) {
    const lastNumber = result.rows[0].plan_number
    const parts = lastNumber.split('-')
    nextNumber = parseInt(parts[2]) + 1
  }

  return `${prefix}${nextNumber.toString().padStart(5, '0')}`
}
