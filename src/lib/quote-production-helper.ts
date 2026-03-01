import { db } from '@/lib/database'

interface QuoteLine {
  productId: number
  productName: string
  quantity: number
  estimatedDelivery?: string | null
}

/**
 * Auto-create production plans in draft status for quote lines
 * that have estimated_delivery = '1-3d' (can be manufactured).
 *
 * - warehouse_id of plan = central warehouse (raw materials source)
 * - target_warehouse_id of plan = quote's selected warehouse (finished product destination)
 */
export async function createProductionPlansForQuote(
  companyId: number,
  warehouseId: number | null,
  quoteNumber: string,
  quoteId: number,
  lines: QuoteLine[]
): Promise<{ plansCreated: number; planNumbers: string[] }> {
  if (!warehouseId) {
    return { plansCreated: 0, planNumbers: [] }
  }

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

  const planNumbers: string[] = []

  for (const line of lines) {
    if (line.estimatedDelivery !== '1-3d') continue

    try {
      // Check current stock to calculate deficit
      let stockOnHand = 0
      try {
        const stockResult = await db.query(
          'SELECT quantity_on_hand FROM market_warehouse_stock WHERE product_id = $1 AND warehouse_id = $2',
          [line.productId, warehouseId]
        )
        stockOnHand = parseFloat(stockResult.rows[0]?.quantity_on_hand) || 0
      } catch { /* no stock record */ }

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
        warehouseId,
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
