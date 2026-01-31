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
 * GET /api/market/bom/[id]
 * Get a specific BOM with its lines
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    const { id } = await params
    const bomId = parseInt(id)

    if (isNaN(bomId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de receta inválido'
      }, { status: 400 })
    }

    // Get BOM
    const bomResult = await db.query(`
      SELECT
        bom.*,
        p.name as product_name,
        p.sku as product_sku,
        p.image_url as product_image,
        p.cost_price as product_cost_price,
        p.selling_price as product_selling_price,
        p.unit_of_measure as product_unit,
        v.variant_name,
        v.sku as variant_sku,
        v.cost_price as variant_cost_price,
        v.selling_price as variant_selling_price,
        creator.email as created_by_email
      FROM market_bill_of_materials bom
      LEFT JOIN market_products p ON bom.product_id = p.id
      LEFT JOIN market_product_variants v ON bom.variant_id = v.id
      LEFT JOIN users creator ON bom.created_by = creator.id
      WHERE bom.id = $1 AND bom.company_id = $2
    `, [bomId, companyId])

    if (bomResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Receta no encontrada'
      }, { status: 404 })
    }

    const bom = bomResult.rows[0]

    // Get lines
    const linesResult = await db.query(`
      SELECT
        bl.*,
        mp.name as product_name,
        mp.sku as product_sku,
        mp.image_url as product_image,
        mp.cost_price as product_cost_price,
        mp.unit_of_measure as product_unit,
        pv.variant_name,
        pv.sku as variant_sku,
        pv.cost_price as variant_cost_price
      FROM market_bom_lines bl
      LEFT JOIN market_products mp ON bl.product_id = mp.id
      LEFT JOIN market_product_variants pv ON bl.variant_id = pv.id
      WHERE bl.bom_id = $1
      ORDER BY bl.is_primary DESC, bl.id ASC
    `, [bomId])

    const lines = linesResult.rows.map(line => {
      const costPrice = parseFloat(line.variant_cost_price || line.product_cost_price) || 0
      const quantity = parseFloat(line.quantity_required) || 0
      return {
        id: line.id,
        productId: line.product_id,
        productName: line.product_name,
        productSku: line.product_sku,
        productImage: line.product_image,
        productCostPrice: costPrice,
        productUnit: line.product_unit,
        variantId: line.variant_id,
        variantName: line.variant_name,
        variantSku: line.variant_sku,
        quantityRequired: quantity,
        unit: line.unit,
        isPrimary: line.is_primary,
        notes: line.notes,
        lineCost: costPrice * quantity
      }
    })

    const totalMaterialCost = lines.reduce((sum, line) => sum + line.lineCost, 0)
    const outputQuantity = parseFloat(bom.output_quantity) || 1
    const unitCost = totalMaterialCost / outputQuantity

    return NextResponse.json({
      success: true,
      data: {
        id: bom.id,
        bomCode: bom.bom_code,
        bomName: bom.bom_name,
        productId: bom.product_id,
        productName: bom.product_name,
        productSku: bom.product_sku,
        productImage: bom.product_image,
        productCostPrice: parseFloat(bom.variant_cost_price || bom.product_cost_price) || 0,
        productSellingPrice: parseFloat(bom.variant_selling_price || bom.product_selling_price) || 0,
        productUnit: bom.product_unit,
        variantId: bom.variant_id,
        variantName: bom.variant_name,
        variantSku: bom.variant_sku,
        outputQuantity,
        outputUnit: bom.output_unit,
        expectedWastePercent: parseFloat(bom.expected_waste_percent) || 0,
        isActive: bom.is_active,
        notes: bom.notes,
        totalMaterialCost,
        unitCost,
        createdBy: bom.created_by_email,
        createdAt: bom.created_at,
        updatedAt: bom.updated_at,
        lines
      }
    })

  } catch (error) {
    console.error('[BOM API] Error getting BOM:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener receta'
    }, { status: 500 })
  }
}

/**
 * PUT /api/market/bom/[id]
 * Update a BOM
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    const { id } = await params
    const bomId = parseInt(id)

    if (isNaN(bomId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de receta inválido'
      }, { status: 400 })
    }

    // Verify BOM exists and belongs to company
    const existsResult = await db.query(`
      SELECT id FROM market_bill_of_materials WHERE id = $1 AND company_id = $2
    `, [bomId, companyId])

    if (existsResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Receta no encontrada'
      }, { status: 404 })
    }

    const body = await request.json()
    const {
      productId,
      variantId,
      bomName,
      outputQuantity,
      outputUnit,
      expectedWastePercent,
      isActive,
      notes,
      lines
    } = body

    // Update BOM
    const updateFields: string[] = []
    const updateParams: (string | number | boolean | null)[] = []
    let paramIndex = 1

    if (productId !== undefined) {
      updateFields.push(`product_id = $${paramIndex++}`)
      updateParams.push(productId)
    }
    if (variantId !== undefined) {
      updateFields.push(`variant_id = $${paramIndex++}`)
      updateParams.push(variantId || null)
    }
    if (bomName !== undefined) {
      updateFields.push(`bom_name = $${paramIndex++}`)
      updateParams.push(bomName)
    }
    if (outputQuantity !== undefined) {
      updateFields.push(`output_quantity = $${paramIndex++}`)
      updateParams.push(outputQuantity)
    }
    if (outputUnit !== undefined) {
      updateFields.push(`output_unit = $${paramIndex++}`)
      updateParams.push(outputUnit)
    }
    if (expectedWastePercent !== undefined) {
      updateFields.push(`expected_waste_percent = $${paramIndex++}`)
      updateParams.push(expectedWastePercent)
    }
    if (isActive !== undefined) {
      updateFields.push(`is_active = $${paramIndex++}`)
      updateParams.push(isActive)
    }
    if (notes !== undefined) {
      updateFields.push(`notes = $${paramIndex++}`)
      updateParams.push(notes || null)
    }

    updateFields.push(`updated_at = NOW()`)

    if (updateFields.length > 1) {
      updateParams.push(bomId)
      await db.query(`
        UPDATE market_bill_of_materials
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
      `, updateParams)
    }

    // Update lines if provided
    if (lines !== undefined) {
      // Delete existing lines
      await db.query(`DELETE FROM market_bom_lines WHERE bom_id = $1`, [bomId])

      // Insert new lines
      for (const line of lines) {
        await db.query(`
          INSERT INTO market_bom_lines (
            bom_id, product_id, variant_id, quantity_required, unit, is_primary, notes, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
          bomId,
          line.productId,
          line.variantId || null,
          line.quantityRequired || 0,
          line.unit || 'unidad',
          line.isPrimary !== false,
          line.notes || null
        ])
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Receta actualizada exitosamente'
    })

  } catch (error) {
    console.error('[BOM API] Error updating BOM:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar receta'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/bom/[id]
 * Deactivate a BOM (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    const { id } = await params
    const bomId = parseInt(id)

    if (isNaN(bomId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de receta inválido'
      }, { status: 400 })
    }

    // Verify BOM exists and belongs to company
    const existsResult = await db.query(`
      SELECT id FROM market_bill_of_materials WHERE id = $1 AND company_id = $2
    `, [bomId, companyId])

    if (existsResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Receta no encontrada'
      }, { status: 404 })
    }

    // Check if BOM is used in pending production orders
    const ordersResult = await db.query(`
      SELECT COUNT(*) as count
      FROM market_production_orders
      WHERE bom_id = $1 AND status NOT IN ('completed', 'cancelled')
    `, [bomId])

    if (parseInt(ordersResult.rows[0]?.count) > 0) {
      return NextResponse.json({
        success: false,
        error: 'No se puede desactivar la receta porque tiene órdenes de producción pendientes'
      }, { status: 400 })
    }

    // Soft delete (deactivate)
    await db.query(`
      UPDATE market_bill_of_materials
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
    `, [bomId])

    return NextResponse.json({
      success: true,
      message: 'Receta desactivada exitosamente'
    })

  } catch (error) {
    console.error('[BOM API] Error deleting BOM:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al desactivar receta'
    }, { status: 500 })
  }
}
