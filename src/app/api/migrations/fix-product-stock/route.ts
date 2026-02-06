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
 * GET /api/migrations/fix-product-stock
 * See current stock and warehouses
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (!productId) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere productId en query params'
      }, { status: 400 })
    }

    // Get all stock records for this product
    const stockResult = await db.query(`
      SELECT
        mws.id as stock_id,
        mws.product_id,
        mws.warehouse_id,
        mw.name as warehouse_name,
        mw.code as warehouse_code,
        mws.variant_id,
        mpv.variant_name,
        mws.quantity_on_hand,
        mws.quantity_reserved,
        p.name as product_name,
        p.sku,
        p.quantity_on_hand as product_total_stock
      FROM market_warehouse_stock mws
      JOIN market_warehouses mw ON mw.id = mws.warehouse_id
      JOIN market_products p ON p.id = mws.product_id
      LEFT JOIN market_product_variants mpv ON mpv.id = mws.variant_id
      WHERE mws.product_id = $1
      ORDER BY mw.name
    `, [parseInt(productId)])

    // Get all warehouses for this product's company
    const warehousesResult = await db.query(`
      SELECT mw.id, mw.name, mw.code
      FROM market_warehouses mw
      JOIN market_products p ON p.company_id = mw.company_id
      WHERE p.id = $1 AND mw.is_active = true
      ORDER BY mw.name
    `, [parseInt(productId)])

    return NextResponse.json({
      success: true,
      data: {
        productId: parseInt(productId),
        warehouses: warehousesResult.rows,
        currentStock: stockResult.rows.map(r => ({
          stockId: r.stock_id,
          warehouseId: r.warehouse_id,
          warehouseName: r.warehouse_name,
          warehouseCode: r.warehouse_code,
          variantId: r.variant_id,
          variantName: r.variant_name,
          quantityOnHand: parseFloat(r.quantity_on_hand) || 0,
          quantityReserved: parseFloat(r.quantity_reserved) || 0
        })),
        productInfo: stockResult.rows[0] ? {
          name: stockResult.rows[0].product_name,
          sku: stockResult.rows[0].sku,
          totalStock: parseFloat(stockResult.rows[0].product_total_stock) || 0
        } : null
      }
    })

  } catch (error) {
    console.error('[Fix Product Stock GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}

/**
 * POST /api/migrations/fix-product-stock
 * Fix stock for specific products
 *
 * Body example:
 * {
 *   "fixes": [
 *     { "productId": 59, "warehouseId": 1, "newStock": 11 },
 *     { "productId": 59, "warehouseId": 2, "newStock": 74 }
 *   ]
 * }
 *
 * Or use warehouse names:
 * {
 *   "fixes": [
 *     { "productId": 59, "warehouseName": "tienda", "newStock": 11 },
 *     { "productId": 59, "warehouseName": "infanta", "newStock": 74 }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
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

    if (!['SUPER_ADMIN', 'ADMIN', 'MARKET_ADMIN'].includes(payload.role)) {
      return NextResponse.json({ success: false, error: 'Solo administradores' }, { status: 403 })
    }

    const body = await request.json()
    const { fixes } = body as {
      fixes: Array<{
        productId: number
        warehouseId?: number
        warehouseName?: string
        newStock: number
        reason?: string
      }>
    }

    if (!fixes || !Array.isArray(fixes)) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere array fixes'
      }, { status: 400 })
    }

    const results: Array<{
      productId: number
      productName: string
      warehouseId: number
      warehouseName: string
      before: number
      after: number
      difference: number
    }> = []

    // Group fixes by product
    const productFixes = new Map<number, typeof fixes>()
    for (const fix of fixes) {
      if (!productFixes.has(fix.productId)) {
        productFixes.set(fix.productId, [])
      }
      productFixes.get(fix.productId)!.push(fix)
    }

    for (const [productId, productFixList] of productFixes) {
      // Get product
      const productResult = await db.query(`
        SELECT id, name, company_id FROM market_products WHERE id = $1
      `, [productId])

      if (productResult.rows.length === 0) {
        console.log(`[Fix Stock] Producto ${productId} no encontrado`)
        continue
      }

      const product = productResult.rows[0]
      let totalNewStock = 0

      for (const fix of productFixList) {
        let warehouseId = fix.warehouseId

        // Find warehouse by name if not ID
        if (!warehouseId && fix.warehouseName) {
          const whResult = await db.query(`
            SELECT id, name FROM market_warehouses
            WHERE company_id = $1 AND LOWER(name) LIKE LOWER($2)
            LIMIT 1
          `, [product.company_id, `%${fix.warehouseName}%`])

          if (whResult.rows.length > 0) {
            warehouseId = whResult.rows[0].id
          } else {
            console.log(`[Fix Stock] Almacén "${fix.warehouseName}" no encontrado`)
            continue
          }
        }

        if (!warehouseId) continue

        // Get warehouse info
        const warehouseResult = await db.query(`
          SELECT id, name FROM market_warehouses WHERE id = $1
        `, [warehouseId])

        if (warehouseResult.rows.length === 0) continue

        const warehouseName = warehouseResult.rows[0].name

        // Get current stock
        const currentResult = await db.query(`
          SELECT id, quantity_on_hand FROM market_warehouse_stock
          WHERE product_id = $1 AND warehouse_id = $2 AND variant_id IS NULL
        `, [productId, warehouseId])

        const currentStock = parseFloat(currentResult.rows[0]?.quantity_on_hand) || 0
        const stockId = currentResult.rows[0]?.id
        const newStock = fix.newStock
        const difference = newStock - currentStock

        // Create adjustment operation
        const operationNumber = `FIX-${Date.now()}-${productId}-${warehouseId}`
        await db.query(`
          INSERT INTO market_warehouse_operations (
            company_id, operation_number, operation_type, status,
            source_warehouse_id, notes, created_by, created_at, completed_at
          ) VALUES ($1, $2, 'adjustment', 'done', $3, $4, $5, NOW(), NOW())
        `, [
          product.company_id,
          operationNumber,
          warehouseId,
          `Corrección de stock: ${currentStock} -> ${newStock}. ${fix.reason || 'Ajuste manual por discrepancia física'}. Usuario: ${payload.email}`,
          payload.userId
        ])

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
          productId,
          productName: product.name,
          warehouseId,
          warehouseName,
          before: currentStock,
          after: newStock,
          difference
        })

        totalNewStock += newStock

        console.log(`[Fix Stock] ✓ ${product.name} @ ${warehouseName}: ${currentStock} -> ${newStock}`)
      }

      // Update product total
      await db.query(`
        UPDATE market_products
        SET quantity_on_hand = $1, updated_at = NOW()
        WHERE id = $2
      `, [totalNewStock, productId])

      console.log(`[Fix Stock] ✓ ${product.name} total actualizado: ${totalNewStock}`)
    }

    return NextResponse.json({
      success: true,
      message: `Stock corregido para ${results.length} registros`,
      data: {
        corrections: results,
        totalCorrections: results.length
      }
    })

  } catch (error) {
    console.error('[Fix Product Stock POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
