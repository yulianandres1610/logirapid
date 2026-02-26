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
}

/**
 * Generate lot number: LOT-YYYY-MMDD-XXXXX
 */
async function generateLotNumber(companyId: number): Promise<string> {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const prefix = `LOT-${year}-${month}${day}-`

  const result = await db.query(`
    SELECT lot_number FROM market_production_plans
    WHERE company_id = $1 AND lot_number LIKE $2
    ORDER BY lot_number DESC
    LIMIT 1
  `, [companyId, `${prefix}%`])

  let nextNumber = 1
  if (result.rows.length > 0) {
    const lastLot = result.rows[0].lot_number
    const parts = lastLot.split('-')
    nextNumber = parseInt(parts[3]) + 1
  }

  return `${prefix}${nextNumber.toString().padStart(5, '0')}`
}

/**
 * Generate barcode for the lot (EAN-13 format with company prefix)
 */
function generateBarcode(companyId: number, productCode: number, lotSeq: number): string {
  // Format: 2CCPPPPPSSSS + check digit
  // 2 = Variable weight product marker
  // CC = Company ID (2 digits)
  // PPPPP = Product code (5 digits)
  // SSSS = Lot sequence (4 digits)
  const companyPart = String(companyId % 100).padStart(2, '0')
  const productPart = String(productCode % 100000).padStart(5, '0')
  const lotPart = String(lotSeq % 10000).padStart(4, '0')

  const baseCode = `2${companyPart}${productPart}${lotPart}`

  // Calculate EAN-13 check digit
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(baseCode[i])
    sum += digit * (i % 2 === 0 ? 1 : 3)
  }
  const checkDigit = (10 - (sum % 10)) % 10

  return baseCode + checkDigit
}

/**
 * POST /api/market/production/plans/[id]/complete
 * Complete production and receive finished product
 * Transition: in_production -> completed
 * - Generates lot number and barcode
 * - Adds product to warehouse stock
 * - Updates product cost_price
 * - Records in production_lot_inventory
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const planId = parseInt(id)

    if (isNaN(planId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de plan inválido'
      }, { status: 400 })
    }

    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const companyId = payload.companyId
    const userId = payload.userId

    // Get plan with current status
    const planResult = await db.query(`
      SELECT p.*, f.name as formula_name, f.target_product_id, f.yield_unit,
             tp.name as target_product_name, tp.sku as target_product_sku
      FROM market_production_plans p
      LEFT JOIN market_production_formulas f ON p.formula_id = f.id
      LEFT JOIN market_products tp ON f.target_product_id = tp.id
      WHERE p.id = $1 AND p.company_id = $2
    `, [planId, companyId])

    if (planResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Plan no encontrado'
      }, { status: 404 })
    }

    const plan = planResult.rows[0]

    // Validate current status
    if (plan.status !== 'in_production') {
      return NextResponse.json({
        success: false,
        error: `No se puede completar un plan en estado "${plan.status}". La producción debe estar en progreso.`
      }, { status: 400 })
    }

    const body = await request.json()
    const {
      actualQuantity,
      wasteQuantity,
      notes
    } = body

    // Validate actual quantity
    if (!actualQuantity || actualQuantity <= 0) {
      return NextResponse.json({
        success: false,
        error: 'La cantidad producida debe ser mayor a 0'
      }, { status: 400 })
    }

    // Start transaction
    await db.query('BEGIN')

    try {
      // Generate lot number and barcode
      const lotNumber = await generateLotNumber(companyId)
      const lotSeq = parseInt(lotNumber.split('-')[3])
      const barcode = generateBarcode(companyId, plan.target_product_id, lotSeq)

      // Calculate final costs
      const materialsCost = parseFloat(plan.materials_cost) || 0
      const laborCost = parseFloat(plan.labor_cost) || 0
      const totalCost = materialsCost + laborCost
      const costPerUnit = totalCost / actualQuantity

      // Get target warehouse
      const targetWarehouseId = plan.target_warehouse_id || plan.warehouse_id

      // Add to warehouse stock
      const existingStock = await db.query(`
        SELECT id, quantity_on_hand FROM market_warehouse_stock
        WHERE product_id = $1 AND warehouse_id = $2
      `, [plan.target_product_id, targetWarehouseId])

      let previousStock = 0
      if (existingStock.rows.length > 0) {
        previousStock = parseFloat(existingStock.rows[0].quantity_on_hand) || 0
        await db.query(`
          UPDATE market_warehouse_stock
          SET quantity_on_hand = quantity_on_hand + $1,
              last_movement_at = NOW(),
              updated_at = NOW()
          WHERE product_id = $2 AND warehouse_id = $3
        `, [actualQuantity, plan.target_product_id, targetWarehouseId])
      } else {
        await db.query(`
          INSERT INTO market_warehouse_stock (
            product_id, warehouse_id, quantity_on_hand, last_movement_at
          ) VALUES ($1, $2, $3, NOW())
        `, [plan.target_product_id, targetWarehouseId, actualQuantity])
      }

      // Update global product stock
      await db.query(`
        UPDATE market_products
        SET quantity_on_hand = COALESCE(quantity_on_hand, 0) + $1,
            updated_at = NOW()
        WHERE id = $2
      `, [actualQuantity, plan.target_product_id])

      // Update product cost_price with new calculated cost
      await db.query(`
        UPDATE market_products
        SET cost_price = $1,
            updated_at = NOW()
        WHERE id = $2
      `, [costPerUnit, plan.target_product_id])

      // Record stock movement
      await db.query(`
        INSERT INTO market_stock_movements (
          company_id, product_id, movement_type,
          to_warehouse_id, quantity, quantity_before, quantity_after,
          reference_type, reference_id, notes, created_by
        ) VALUES ($1, $2, 'production_receipt', $3, $4, $5, $6, 'production_plan', $7, $8, $9)
      `, [
        companyId,
        plan.target_product_id,
        targetWarehouseId,
        actualQuantity,
        previousStock,
        previousStock + actualQuantity,
        planId,
        `Recepción de producción ${plan.plan_number} - Lote: ${lotNumber}`,
        userId
      ])

      // Create lot inventory record for FIFO tracking
      await db.query(`
        INSERT INTO production_lot_inventory (
          company_id, warehouse_id, product_id, production_order_id,
          lot_number, manufacturing_date, quantity_initial, quantity_available,
          unit_cost, received_at
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, $6, $7, NOW())
      `, [
        companyId,
        targetWarehouseId,
        plan.target_product_id,
        planId,
        lotNumber,
        actualQuantity,
        costPerUnit
      ])

      // Update plan with final data
      const finalNotes = [plan.notes, notes].filter(Boolean).join('\n')
      await db.query(`
        UPDATE market_production_plans
        SET status = 'completed',
            lot_number = $1,
            barcode = $2,
            actual_quantity = $3,
            waste_quantity = $4,
            total_cost = $5,
            cost_per_unit = $6,
            notes = $7,
            completed_by = $8,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = $9
      `, [
        lotNumber,
        barcode,
        actualQuantity,
        wasteQuantity || 0,
        totalCost,
        costPerUnit,
        finalNotes || null,
        userId,
        planId
      ])

      await db.query('COMMIT')

      console.log('[Complete API] Completed production for plan:', plan.plan_number, '| Lot:', lotNumber, '| Qty:', actualQuantity)

      return NextResponse.json({
        success: true,
        message: `Producción completada para ${plan.plan_number}`,
        data: {
          planNumber: plan.plan_number,
          formulaName: plan.formula_name,
          targetProductName: plan.target_product_name,
          status: 'completed',
          lotNumber,
          barcode,
          actualQuantity,
          wasteQuantity: wasteQuantity || 0,
          totalCost,
          costPerUnit,
          completedAt: new Date().toISOString()
        }
      })

    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('[Complete API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al completar producción'
    }, { status: 500 })
  }
}
