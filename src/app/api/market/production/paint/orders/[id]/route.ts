import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import { calculatePaintProduction } from '@/lib/paint-production-calculator'

interface JWTPayload { userId: number; email: string; role: string; companyId: number; companyName: string }

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-change-in-production') as JWTPayload
  } catch { return null }
}

/**
 * GET /api/market/production/paint/orders/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

  const { id } = await params
  const orderId = parseInt(id)

  try {
    // Get order
    const orderResult = await db.query(
      'SELECT * FROM paint_production_orders WHERE id = $1 AND company_id = $2',
      [orderId, payload.companyId]
    )
    if (orderResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Orden no encontrada' }, { status: 404 })
    }
    const order = orderResult.rows[0]

    // Get lines with color card and packaging info
    const linesResult = await db.query(`
      SELECT pl.*, cc.name as color_name, cc.hex_color, cc.code as color_code,
             bt.name as base_type_name, bt.code as base_type_code,
             ps.name as packaging_name, ps.volume_liters, ps.net_weight_kg,
             fp.name as finished_product_name
      FROM paint_production_lines pl
      JOIN paint_color_cards cc ON cc.id = pl.color_card_id
      JOIN paint_base_types bt ON bt.id = cc.base_type_id
      JOIN paint_packaging_specs ps ON ps.id = pl.packaging_spec_id
      LEFT JOIN market_products fp ON fp.id = pl.finished_product_id
      WHERE pl.paint_order_id = $1
      ORDER BY pl.id
    `, [orderId])

    // Get steps with materials
    const stepsResult = await db.query(`
      SELECT ps.*, bt.name as base_type_name, cc.name as color_name, cc.hex_color,
             pkg.name as packaging_name, m.name as mixer_name
      FROM paint_production_steps ps
      LEFT JOIN paint_base_types bt ON bt.id = ps.base_type_id
      LEFT JOIN paint_color_cards cc ON cc.id = ps.color_card_id
      LEFT JOIN paint_packaging_specs pkg ON pkg.id = ps.packaging_spec_id
      LEFT JOIN paint_mixers m ON m.id = ps.mixer_id
      WHERE ps.paint_order_id = $1
      ORDER BY ps.step_number
    `, [orderId])

    // Get materials per step
    const materialsResult = await db.query(`
      SELECT sm.*, p.name as product_name, p.sku as product_sku
      FROM paint_production_step_materials sm
      JOIN market_products p ON p.id = sm.product_id
      JOIN paint_production_steps ps ON ps.id = sm.step_id
      WHERE ps.paint_order_id = $1
      ORDER BY sm.step_id, sm.id
    `, [orderId])

    const materialsByStep = new Map<number, any[]>()
    for (const m of materialsResult.rows) {
      if (!materialsByStep.has(m.step_id)) materialsByStep.set(m.step_id, [])
      materialsByStep.get(m.step_id)!.push({
        id: m.id,
        productId: m.product_id,
        productName: m.product_name,
        productSku: m.product_sku,
        quantityRequired: parseFloat(m.quantity_required),
        quantityIssued: parseFloat(m.quantity_issued) || 0,
        unitCost: parseFloat(m.unit_cost) || 0,
        totalCost: parseFloat(m.total_cost) || 0,
        status: m.status
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        plannedDate: order.planned_date,
        warehouseId: order.warehouse_id,
        targetWarehouseId: order.target_warehouse_id,
        sourceQuoteId: order.source_quote_id,
        notes: order.notes,
        totalBaseCost: parseFloat(order.total_base_cost) || 0,
        totalTintCost: parseFloat(order.total_tint_cost) || 0,
        totalPackagingCost: parseFloat(order.total_packaging_cost) || 0,
        totalLaborCost: parseFloat(order.total_labor_cost) || 0,
        totalCost: parseFloat(order.total_cost) || 0,
        createdAt: order.created_at,
        lines: linesResult.rows.map((l: any) => ({
          id: l.id,
          colorCardId: l.color_card_id,
          colorName: l.color_name,
          colorCode: l.color_code,
          hexColor: l.hex_color,
          baseTypeName: l.base_type_name,
          packagingSpecId: l.packaging_spec_id,
          packagingName: l.packaging_name,
          volumeLiters: parseFloat(l.volume_liters),
          netWeightKg: parseFloat(l.net_weight_kg),
          finishedProductId: l.finished_product_id,
          finishedProductName: l.finished_product_name,
          quantityUnits: parseInt(l.quantity_units),
          totalWeightKg: parseFloat(l.total_weight_kg),
          baseCost: parseFloat(l.base_cost) || 0,
          tintCost: parseFloat(l.tint_cost) || 0,
          packagingCost: parseFloat(l.packaging_cost) || 0,
          laborCost: parseFloat(l.labor_cost) || 0,
          totalCost: parseFloat(l.total_cost) || 0,
          costPerUnit: parseFloat(l.cost_per_unit) || 0,
          lotNumber: l.lot_number
        })),
        steps: stepsResult.rows.map((s: any) => ({
          id: s.id,
          stepNumber: s.step_number,
          stepType: s.step_type,
          description: s.description,
          baseTypeName: s.base_type_name,
          colorName: s.color_name,
          hexColor: s.hex_color,
          packagingName: s.packaging_name,
          mixerName: s.mixer_name,
          mixerBatches: s.mixer_batches,
          weightKg: parseFloat(s.weight_kg) || 0,
          quantityUnits: s.quantity_units,
          status: s.status,
          estimatedTimeMinutes: s.estimated_time_minutes,
          actualTimeMinutes: s.actual_time_minutes,
          startedAt: s.started_at,
          completedAt: s.completed_at,
          operatorNotes: s.operator_notes,
          qualityCheck: s.quality_check,
          materialsCost: parseFloat(s.materials_cost) || 0,
          laborCost: parseFloat(s.labor_cost) || 0,
          materials: materialsByStep.get(s.id) || []
        }))
      }
    })
  } catch (error) {
    console.error('[Paint Order Detail] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener orden' }, { status: 500 })
  }
}

/**
 * POST /api/market/production/paint/orders/[id]
 * Action: calculate (generates steps and materials)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

  const { id } = await params
  const orderId = parseInt(id)
  const body = await request.json()
  const { action } = body

  if (action === 'calculate') {
    return handleCalculate(orderId, payload)
  }

  return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 })
}

async function handleCalculate(orderId: number, payload: JWTPayload) {
  try {
    // Get order lines
    const linesResult = await db.query(`
      SELECT pl.*, cc.name as color_name, cc.base_type_id,
             bt.name as base_type_name, bt.code as base_type_code,
             ps.name as packaging_name, ps.volume_liters, ps.net_weight_kg
      FROM paint_production_lines pl
      JOIN paint_color_cards cc ON cc.id = pl.color_card_id
      JOIN paint_base_types bt ON bt.id = cc.base_type_id
      JOIN paint_packaging_specs ps ON ps.id = pl.packaging_spec_id
      WHERE pl.paint_order_id = $1
    `, [orderId])

    if (linesResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'La orden no tiene líneas' }, { status: 400 })
    }

    // Load all needed data
    const companyId = payload.companyId

    // Base types with formulas
    const btResult = await db.query(`
      SELECT bt.*, f.labor_cost_per_batch, f.yield_quantity
      FROM paint_base_types bt
      LEFT JOIN market_production_formulas f ON f.id = bt.formula_id
      WHERE bt.company_id = $1
    `, [companyId])

    const baseTypes = new Map()
    for (const bt of btResult.rows) {
      // Get formula materials
      let formulaMaterials: any[] = []
      if (bt.formula_id) {
        const fmResult = await db.query(`
          SELECT fl.raw_material_id as product_id, fl.quantity, p.name as product_name, p.cost_price
          FROM market_production_formula_lines fl
          JOIN market_products p ON p.id = fl.raw_material_id
          WHERE fl.formula_id = $1
        `, [bt.formula_id])
        formulaMaterials = fmResult.rows.map((fm: any) => ({
          productId: fm.product_id,
          productName: fm.product_name,
          quantity: parseFloat(fm.quantity),
          unitCost: parseFloat(fm.cost_price) || 0
        }))
      }

      baseTypes.set(bt.id, {
        id: bt.id,
        code: bt.code,
        name: bt.name,
        formulaId: bt.formula_id,
        yieldKg: parseFloat(bt.yield_kg) || parseFloat(bt.yield_quantity) || 1,
        formulaMaterials,
        laborCostPerBatch: parseFloat(bt.labor_cost_per_batch) || 0
      })
    }

    // Color cards with tints
    const ccResult = await db.query(`
      SELECT cc.id, cc.name, cc.base_type_id
      FROM paint_color_cards cc WHERE cc.company_id = $1
    `, [companyId])

    const colorCards = new Map()
    for (const cc of ccResult.rows) {
      const tintsResult = await db.query(`
        SELECT t.tint_product_id, t.quantity_per_kg, t.unit, p.name as tint_product_name, p.cost_price
        FROM paint_color_card_tints t
        JOIN market_products p ON p.id = t.tint_product_id
        WHERE t.color_card_id = $1
      `, [cc.id])

      colorCards.set(cc.id, {
        id: cc.id,
        name: cc.name,
        baseTypeId: cc.base_type_id,
        tints: tintsResult.rows.map((t: any) => ({
          tintProductId: t.tint_product_id,
          tintProductName: t.tint_product_name,
          quantityPerKg: parseFloat(t.quantity_per_kg),
          unit: t.unit
        }))
      })
    }

    // Mixers
    const mixResult = await db.query(
      'SELECT * FROM paint_mixers WHERE company_id = $1 AND is_available = true ORDER BY capacity_max_kg',
      [companyId]
    )
    const mixers = mixResult.rows.map((m: any) => ({
      id: m.id, name: m.name,
      capacityMinKg: parseFloat(m.capacity_min_kg),
      capacityMaxKg: parseFloat(m.capacity_max_kg),
      mixerType: m.mixer_type
    }))

    // Packaging specs
    const pkgResult = await db.query(`
      SELECT ps.*, cp.cost_price as container_cost, cp.name as container_name,
             lp.cost_price as label_cost, lp.name as label_name,
             ldp.cost_price as lid_cost, ldp.name as lid_name
      FROM paint_packaging_specs ps
      LEFT JOIN market_products cp ON cp.id = ps.container_product_id
      LEFT JOIN market_products lp ON lp.id = ps.label_product_id
      LEFT JOIN market_products ldp ON ldp.id = ps.lid_product_id
      WHERE ps.company_id = $1
    `, [companyId])

    const packagingSpecs = new Map()
    for (const p of pkgResult.rows) {
      packagingSpecs.set(p.id, {
        id: p.id, name: p.name,
        volumeLiters: parseFloat(p.volume_liters),
        netWeightKg: parseFloat(p.net_weight_kg),
        containerProductId: p.container_product_id,
        containerName: p.container_name,
        containerCost: parseFloat(p.container_cost) || 0,
        labelProductId: p.label_product_id,
        labelName: p.label_name,
        labelCost: parseFloat(p.label_cost) || 0,
        lidProductId: p.lid_product_id,
        lidName: p.lid_name,
        lidCost: parseFloat(p.lid_cost) || 0,
        laborCostPerUnit: parseFloat(p.labor_cost_per_unit) || 0
      })
    }

    // Build calc lines
    const calcLines = linesResult.rows.map((l: any) => ({
      colorCardId: l.color_card_id,
      colorName: l.color_name,
      baseTypeId: l.base_type_id,
      baseTypeName: l.base_type_name,
      baseTypeCode: l.base_type_code,
      packagingSpecId: l.packaging_spec_id,
      packagingName: l.packaging_name,
      volumeLiters: parseFloat(l.volume_liters),
      netWeightKg: parseFloat(l.net_weight_kg),
      finishedProductId: l.finished_product_id,
      quantityUnits: parseInt(l.quantity_units)
    }))

    // Calculate!
    const result = calculatePaintProduction(calcLines, colorCards, baseTypes, mixers, packagingSpecs)

    // Save steps and materials to DB
    await db.query('BEGIN')
    try {
      // Delete existing steps/materials
      await db.query(`
        DELETE FROM paint_production_step_materials WHERE step_id IN
        (SELECT id FROM paint_production_steps WHERE paint_order_id = $1)
      `, [orderId])
      await db.query('DELETE FROM paint_production_steps WHERE paint_order_id = $1', [orderId])

      // Insert steps
      for (const step of result.steps) {
        const stepResult = await db.query(`
          INSERT INTO paint_production_steps (
            paint_order_id, step_number, step_type, description,
            base_type_id, color_card_id, packaging_spec_id, paint_line_id,
            weight_kg, quantity_units, mixer_id, mixer_batches,
            estimated_time_minutes, materials_cost, labor_cost
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          RETURNING id
        `, [
          orderId, step.stepNumber, step.stepType, step.description,
          step.baseTypeId || null, step.colorCardId || null, step.packagingSpecId || null,
          step.paintLineIndex !== undefined ? linesResult.rows[step.paintLineIndex]?.id || null : null,
          step.weightKg || null, step.quantityUnits || null,
          step.mixerId || null, step.mixerBatches || null,
          step.estimatedTimeMinutes || null, step.materialsCost, step.laborCost
        ])

        const stepId = stepResult.rows[0].id

        // Insert materials
        for (const mat of step.materials) {
          await db.query(`
            INSERT INTO paint_production_step_materials (step_id, product_id, quantity_required, unit_cost, total_cost)
            VALUES ($1,$2,$3,$4,$5)
          `, [stepId, mat.productId, mat.quantityRequired, mat.unitCost, mat.totalCost])
        }
      }

      // Update line costs
      for (let i = 0; i < result.lines.length; i++) {
        const rl = result.lines[i]
        const dbLine = linesResult.rows[i]
        if (dbLine) {
          await db.query(`
            UPDATE paint_production_lines SET
              base_cost = $1, tint_cost = $2, packaging_cost = $3, labor_cost = $4,
              total_cost = $5, cost_per_unit = $6
            WHERE id = $7
          `, [rl.baseCost, rl.tintCost, rl.packagingCost, rl.laborCost, rl.totalCost, rl.costPerUnit, dbLine.id])
        }
      }

      // Update order totals
      await db.query(`
        UPDATE paint_production_orders SET
          total_base_cost = $1, total_tint_cost = $2, total_packaging_cost = $3,
          total_labor_cost = $4, total_cost = $5, status = CASE WHEN status = 'draft' THEN 'planned' ELSE status END,
          updated_at = NOW()
        WHERE id = $6
      `, [result.totals.baseCost, result.totals.tintCost, result.totals.packagingCost, result.totals.laborCost, result.totals.totalCost, orderId])

      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        data: result,
        message: 'Cálculo completado y pasos generados'
      })
    } catch (err) {
      await db.query('ROLLBACK')
      throw err
    }
  } catch (error) {
    console.error('[Paint Order Calculate] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al calcular' }, { status: 500 })
  }
}
