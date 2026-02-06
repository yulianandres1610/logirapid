import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
}

/**
 * GET /api/market/products/[id]/fix-stock
 * Get current stock by warehouse and allow correction
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    // Get product info
    const productResult = await db.query(`
      SELECT id, name, sku, barcode, quantity_on_hand as total_stock
      FROM market_products
      WHERE id = $1 AND company_id = $2
    `, [productId, payload.companyId])

    if (productResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Producto no encontrado' }, { status: 404 })
    }

    const product = productResult.rows[0]

    // Get all warehouses with their stock
    const stockResult = await db.query(`
      SELECT
        mw.id as warehouse_id,
        mw.name as warehouse_name,
        mw.code as warehouse_code,
        COALESCE(mws.id, 0) as stock_id,
        COALESCE(mws.quantity_on_hand, 0) as quantity_on_hand,
        COALESCE(mws.quantity_reserved, 0) as quantity_reserved,
        COALESCE(mws.variant_id, NULL) as variant_id
      FROM market_warehouses mw
      LEFT JOIN market_warehouse_stock mws ON mws.warehouse_id = mw.id
        AND mws.product_id = $1
        AND mws.variant_id IS NULL
      WHERE mw.company_id = $2 AND mw.is_active = true
      ORDER BY mw.name
    `, [productId, payload.companyId])

    return NextResponse.json({
      success: true,
      data: {
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          totalStock: parseFloat(product.total_stock) || 0
        },
        warehouses: stockResult.rows.map(w => ({
          warehouseId: w.warehouse_id,
          warehouseName: w.warehouse_name,
          warehouseCode: w.warehouse_code,
          stockId: w.stock_id,
          currentStock: parseFloat(w.quantity_on_hand) || 0,
          reserved: parseFloat(w.quantity_reserved) || 0
        }))
      }
    })

  } catch (error) {
    console.error('[Fix Stock GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/products/[id]/fix-stock
 * Correct stock to match physical inventory
 *
 * Body:
 * - corrections: Array<{ warehouseId: number, newStock: number, reason: string }>
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Only admins can fix stock
    if (!['SUPER_ADMIN', 'ADMIN', 'MARKET_ADMIN'].includes(payload.role)) {
      return NextResponse.json({ success: false, error: 'Solo administradores pueden corregir stock' }, { status: 403 })
    }

    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    const body = await request.json()
    const { corrections } = body as {
      corrections: Array<{ warehouseId: number, newStock: number, reason?: string }>
    }

    if (!corrections || !Array.isArray(corrections) || corrections.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere array de correcciones: [{ warehouseId, newStock, reason }]'
      }, { status: 400 })
    }

    // Verify product exists
    const productResult = await db.query(`
      SELECT id, name FROM market_products WHERE id = $1 AND company_id = $2
    `, [productId, payload.companyId])

    if (productResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Producto no encontrado' }, { status: 404 })
    }

    const productName = productResult.rows[0].name
    const results: Array<{
      warehouseId: number
      warehouseName: string
      before: number
      after: number
      difference: number
      action: string
    }> = []

    let totalNewStock = 0

    for (const correction of corrections) {
      const { warehouseId, newStock, reason } = correction

      if (typeof warehouseId !== 'number' || typeof newStock !== 'number') {
        continue
      }

      // Get warehouse name
      const warehouseResult = await db.query(`
        SELECT id, name FROM market_warehouses WHERE id = $1 AND company_id = $2
      `, [warehouseId, payload.companyId])

      if (warehouseResult.rows.length === 0) {
        continue
      }

      const warehouseName = warehouseResult.rows[0].name

      // Get current stock
      const currentStockResult = await db.query(`
        SELECT id, quantity_on_hand FROM market_warehouse_stock
        WHERE product_id = $1 AND warehouse_id = $2 AND variant_id IS NULL
      `, [productId, warehouseId])

      const currentStock = parseFloat(currentStockResult.rows[0]?.quantity_on_hand) || 0
      const stockId = currentStockResult.rows[0]?.id
      const difference = newStock - currentStock

      if (difference === 0) {
        results.push({
          warehouseId,
          warehouseName,
          before: currentStock,
          after: newStock,
          difference: 0,
          action: 'Sin cambios'
        })
        totalNewStock += newStock
        continue
      }

      // Create adjustment operation for tracking
      const operationNumber = `ADJ-${Date.now()}-${warehouseId}`
      const adjustmentNotes = reason || `Corrección de inventario: ${currentStock} -> ${newStock} por ${payload.email}`

      // Create warehouse operation record
      const operationResult = await db.query(`
        INSERT INTO market_warehouse_operations (
          company_id, operation_number, operation_type, status,
          source_warehouse_id, notes, created_by, created_at, completed_at
        ) VALUES ($1, $2, 'adjustment', 'done', $3, $4, $5, NOW(), NOW())
        RETURNING id
      `, [payload.companyId, operationNumber, warehouseId, adjustmentNotes, payload.userId])

      const operationId = operationResult.rows[0].id

      // Create operation line
      await db.query(`
        INSERT INTO market_warehouse_operation_lines (
          operation_id, product_id, variant_id, quantity_planned, quantity_done, created_at
        ) VALUES ($1, $2, NULL, $3, $3, NOW())
      `, [operationId, productId, Math.abs(difference)])

      // Update or insert stock
      if (stockId) {
        await db.query(`
          UPDATE market_warehouse_stock
          SET quantity_on_hand = $1, updated_at = NOW(), last_movement_at = NOW()
          WHERE id = $2
        `, [newStock, stockId])
      } else {
        await db.query(`
          INSERT INTO market_warehouse_stock (
            warehouse_id, product_id, variant_id, quantity_on_hand,
            quantity_reserved, created_at, updated_at, last_movement_at
          ) VALUES ($1, $2, NULL, $3, 0, NOW(), NOW(), NOW())
        `, [warehouseId, productId, newStock])
      }

      results.push({
        warehouseId,
        warehouseName,
        before: currentStock,
        after: newStock,
        difference,
        action: difference > 0 ? `+${difference} agregadas` : `${difference} removidas`
      })

      totalNewStock += newStock

      console.log(`[Fix Stock] Producto ${productId} (${productName}): ${warehouseName} ${currentStock} -> ${newStock} (${difference > 0 ? '+' : ''}${difference})`)
    }

    // Update main product stock total
    await db.query(`
      UPDATE market_products
      SET quantity_on_hand = $1, updated_at = NOW()
      WHERE id = $2
    `, [totalNewStock, productId])

    // Log the correction in product change history if table exists
    try {
      await db.query(`
        INSERT INTO market_product_change_logs (
          product_id, action, field_name, old_value, new_value, notes,
          created_by, created_at
        ) VALUES ($1, 'stock_correction', 'quantity_on_hand', $2, $3, $4, $5, NOW())
      `, [
        productId,
        results.reduce((sum, r) => sum + r.before, 0).toString(),
        totalNewStock.toString(),
        `Corrección manual por ${payload.email}: ${JSON.stringify(results.map(r => ({ wh: r.warehouseName, before: r.before, after: r.after })))}`,
        payload.userId
      ])
    } catch {
      // Table might not exist
    }

    return NextResponse.json({
      success: true,
      message: `Stock corregido para ${productName}`,
      data: {
        productId,
        productName,
        newTotalStock: totalNewStock,
        corrections: results
      }
    })

  } catch (error) {
    console.error('[Fix Stock POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al corregir stock'
    }, { status: 500 })
  }
}
