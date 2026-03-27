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

interface FormulaLine {
  id?: number
  rawMaterialId: number
  quantity: number
  isCritical?: boolean
  notes?: string
}

/**
 * GET /api/market/production/formulas/[id]
 * Get a formula with its lines
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const formulaId = parseInt(id)

    if (isNaN(formulaId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de fórmula inválido'
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

    // Get formula
    const formulaResult = await db.query(`
      SELECT
        f.id,
        f.code,
        f.name,
        f.target_product_id,
        f.yield_quantity,
        f.yield_unit,
        f.labor_cost_per_batch,
        f.estimated_time_minutes,
        f.notes,
        f.is_active,
        f.created_at,
        f.updated_at,
        p.name as target_product_name,
        p.sku as target_product_sku,
        p.image_url as target_product_image,
        p.unit_of_measure as target_product_unit,
        p.cost_price as target_product_cost,
        p.selling_price as target_product_price,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as created_by_name
      FROM market_production_formulas f
      LEFT JOIN market_products p ON f.target_product_id = p.id
      LEFT JOIN users u ON f.created_by = u.id
      WHERE f.id = $1 AND f.company_id = $2
    `, [formulaId, companyId])

    if (formulaResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Fórmula no encontrada'
      }, { status: 404 })
    }

    const formula = formulaResult.rows[0]

    // Get formula lines with material details
    const linesResult = await db.query(`
      SELECT
        fl.id,
        fl.raw_material_id,
        fl.quantity,
        fl.is_critical,
        fl.notes,
        fl.created_at,
        p.name as material_name,
        p.sku as material_sku,
        p.image_url as material_image,
        p.unit_of_measure as material_unit,
        p.cost_price as material_cost,
        p.quantity_on_hand as material_stock,
        (SELECT COALESCE(SUM(ws.quantity_on_hand), 0)
         FROM market_warehouse_stock ws
         WHERE ws.product_id = p.id) as total_stock
      FROM market_production_formula_lines fl
      JOIN market_products p ON fl.raw_material_id = p.id
      WHERE fl.formula_id = $1
      ORDER BY fl.id ASC
    `, [formulaId])

    // Calculate totals
    let totalMaterialsCost = 0
    const lines = linesResult.rows.map(row => {
      const lineCost = (parseFloat(row.quantity) || 0) * (parseFloat(row.material_cost) || 0)
      totalMaterialsCost += lineCost
      return {
        id: row.id,
        rawMaterialId: row.raw_material_id,
        materialName: row.material_name,
        materialSku: row.material_sku,
        materialImage: row.material_image,
        materialUnit: row.material_unit,
        materialCost: parseFloat(row.material_cost) || 0,
        materialStock: parseFloat(row.material_stock) || 0,
        totalStock: parseFloat(row.total_stock) || 0,
        quantity: parseFloat(row.quantity) || 0,
        isCritical: row.is_critical,
        notes: row.notes,
        lineCost,
        createdAt: row.created_at
      }
    })

    const yieldQuantity = parseFloat(formula.yield_quantity) || 1
    const laborCost = parseFloat(formula.labor_cost_per_batch) || 0
    const totalCostPerBatch = totalMaterialsCost + laborCost
    const costPerUnit = totalCostPerBatch / yieldQuantity

    // Count production plans using this formula
    const plansResult = await db.query(`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE status = 'completed') as completed
      FROM market_production_plans
      WHERE formula_id = $1
    `, [formulaId])

    // Fetch modification history
    let history: any[] = []
    try {
      const histResult = await db.query(`
        SELECT h.*, CONCAT(u.firstname, ' ', u.lastname) as performed_by_name, u.email as performed_by_email
        FROM market_production_formula_history h
        LEFT JOIN users u ON u.id = h.performed_by
        WHERE h.formula_id = $1
        ORDER BY h.performed_at DESC
        LIMIT 20
      `, [formulaId])
      history = histResult.rows.map((h: any) => ({
        id: h.id,
        action: h.action,
        changes: h.changes,
        performedBy: h.performed_by_name || h.performed_by_email || 'Sistema',
        performedAt: h.performed_at
      }))
    } catch { /* table may not exist yet */ }

    return NextResponse.json({
      success: true,
      data: {
        id: formula.id,
        code: formula.code,
        name: formula.name,
        targetProductId: formula.target_product_id,
        targetProductName: formula.target_product_name,
        targetProductSku: formula.target_product_sku,
        targetProductImage: formula.target_product_image,
        targetProductUnit: formula.target_product_unit,
        targetProductCost: parseFloat(formula.target_product_cost) || 0,
        targetProductPrice: parseFloat(formula.target_product_price) || 0,
        yieldQuantity,
        yieldUnit: formula.yield_unit,
        laborCostPerBatch: laborCost,
        estimatedTimeMinutes: formula.estimated_time_minutes,
        notes: formula.notes,
        isActive: formula.is_active,
        createdAt: formula.created_at,
        updatedAt: formula.updated_at,
        createdByName: formula.created_by_name,
        lines,
        summary: {
          materialCount: lines.length,
          totalMaterialsCost,
          laborCost,
          totalCostPerBatch,
          costPerUnit,
          estimatedMargin: formula.target_product_price
            ? ((parseFloat(formula.target_product_price) - costPerUnit) / parseFloat(formula.target_product_price)) * 100
            : 0
        },
        usage: {
          totalPlans: parseInt(plansResult.rows[0].total) || 0,
          completedPlans: parseInt(plansResult.rows[0].completed) || 0
        },
        history
      }
    })

  } catch (error) {
    console.error('[Formulas API] GET Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener fórmula'
    }, { status: 500 })
  }
}

/**
 * PATCH /api/market/production/formulas/[id]
 * Update a formula and its lines
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const formulaId = parseInt(id)

    if (isNaN(formulaId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de fórmula inválido'
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

    // Check formula exists
    const existingFormula = await db.query(
      'SELECT id, code FROM market_production_formulas WHERE id = $1 AND company_id = $2',
      [formulaId, companyId]
    )

    if (existingFormula.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Fórmula no encontrada'
      }, { status: 404 })
    }

    const body = await request.json()
    const {
      name,
      targetProductId,
      yieldQuantity,
      yieldUnit,
      laborCostPerBatch,
      estimatedTimeMinutes,
      notes,
      isActive,
      lines
    } = body

    // Ensure history table exists
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS market_production_formula_history (
          id SERIAL PRIMARY KEY,
          formula_id INTEGER NOT NULL,
          action VARCHAR(50) NOT NULL,
          changes JSONB,
          performed_by INTEGER,
          performed_at TIMESTAMP DEFAULT NOW()
        )
      `)
    } catch { /* ignore */ }

    await db.query('BEGIN')

    try {
      // Snapshot before changes for history
      const beforeSnapshot = {
        name: existingFormula.rows[0].name,
        targetProductId: existingFormula.rows[0].target_product_id,
        yieldQuantity: existingFormula.rows[0].yield_quantity,
        laborCostPerBatch: existingFormula.rows[0].labor_cost_per_batch,
        notes: existingFormula.rows[0].notes
      }
      // Build update query
      const updates: string[] = []
      const values: any[] = []
      let paramIndex = 1

      if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`)
        values.push(name)
      }
      if (targetProductId !== undefined) {
        updates.push(`target_product_id = $${paramIndex++}`)
        values.push(targetProductId)
      }
      if (yieldQuantity !== undefined) {
        updates.push(`yield_quantity = $${paramIndex++}`)
        values.push(yieldQuantity)
      }
      if (yieldUnit !== undefined) {
        updates.push(`yield_unit = $${paramIndex++}`)
        values.push(yieldUnit)
      }
      if (laborCostPerBatch !== undefined) {
        updates.push(`labor_cost_per_batch = $${paramIndex++}`)
        values.push(laborCostPerBatch)
      }
      if (estimatedTimeMinutes !== undefined) {
        updates.push(`estimated_time_minutes = $${paramIndex++}`)
        values.push(estimatedTimeMinutes)
      }
      if (notes !== undefined) {
        updates.push(`notes = $${paramIndex++}`)
        values.push(notes)
      }
      if (isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`)
        values.push(isActive)
      }

      if (updates.length > 0) {
        updates.push(`updated_at = NOW()`)
        values.push(formulaId)

        await db.query(`
          UPDATE market_production_formulas
          SET ${updates.join(', ')}
          WHERE id = $${paramIndex}
        `, values)
      }

      // Update lines if provided
      if (lines && Array.isArray(lines)) {
        // Delete existing lines
        await db.query('DELETE FROM market_production_formula_lines WHERE formula_id = $1', [formulaId])

        // Insert new lines
        for (const line of lines as FormulaLine[]) {
          // Verify raw material exists
          const materialCheck = await db.query(
            'SELECT id FROM market_products WHERE id = $1 AND company_id = $2',
            [line.rawMaterialId, companyId]
          )

          if (materialCheck.rows.length === 0) {
            throw new Error(`La materia prima con ID ${line.rawMaterialId} no existe`)
          }

          await db.query(`
            INSERT INTO market_production_formula_lines (
              formula_id, raw_material_id, quantity, is_critical, notes
            ) VALUES ($1, $2, $3, $4, $5)
          `, [
            formulaId,
            line.rawMaterialId,
            line.quantity,
            line.isCritical !== false,
            line.notes || null
          ])
        }
      }

      // Record history
      try {
        await db.query(`
          INSERT INTO market_production_formula_history (formula_id, action, changes, performed_by)
          VALUES ($1, 'updated', $2, $3)
        `, [formulaId, JSON.stringify({ before: beforeSnapshot, after: { name, targetProductId, yieldQuantity, laborCostPerBatch, notes, linesCount: lines?.length } }), payload.userId])
      } catch { /* ignore history errors */ }

      await db.query('COMMIT')

      console.log('[Formulas API] Updated formula:', existingFormula.rows[0].code)

      return NextResponse.json({
        success: true,
        message: 'Fórmula actualizada exitosamente'
      })

    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('[Formulas API] PATCH Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar fórmula'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/production/formulas/[id]
 * Delete a formula (only if not used in production plans)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const formulaId = parseInt(id)

    if (isNaN(formulaId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de fórmula inválido'
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

    // Check formula exists
    const existingFormula = await db.query(
      'SELECT id, code, name FROM market_production_formulas WHERE id = $1 AND company_id = $2',
      [formulaId, companyId]
    )

    if (existingFormula.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Fórmula no encontrada'
      }, { status: 404 })
    }

    // Check if formula is used in any production plans
    const usageCheck = await db.query(
      'SELECT COUNT(*) as count FROM market_production_plans WHERE formula_id = $1',
      [formulaId]
    )

    if (parseInt(usageCheck.rows[0].count) > 0) {
      return NextResponse.json({
        success: false,
        error: 'No se puede eliminar la fórmula porque tiene planes de producción asociados. Desactívela en su lugar.'
      }, { status: 400 })
    }

    // Delete formula (lines will cascade)
    await db.query('DELETE FROM market_production_formulas WHERE id = $1', [formulaId])

    console.log('[Formulas API] Deleted formula:', existingFormula.rows[0].code)

    return NextResponse.json({
      success: true,
      message: `Fórmula ${existingFormula.rows[0].code} eliminada exitosamente`
    })

  } catch (error) {
    console.error('[Formulas API] DELETE Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar fórmula'
    }, { status: 500 })
  }
}
