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
 * POST /api/market/wholesale/fix-reservations
 * Fix stuck reservations left by the old two-step wholesale delivery mechanism.
 * Clears quantity_reserved and syncs product quantities.
 * Admin only.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const secret = process.env.JWT_SECRET || 'fallback-secret'
    let payload: JWTPayload
    try {
      payload = jwt.verify(token, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    if (payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Solo administradores' }, { status: 403 })
    }

    // 1. Find all stocks with stuck reservations
    const stuckResult = await db.query(`
      SELECT ws.id, ws.warehouse_id, ws.product_id, ws.variant_id,
             ws.quantity_on_hand, ws.quantity_reserved,
             p.name as product_name, p.sku,
             w.name as warehouse_name
      FROM market_warehouse_stock ws
      JOIN market_products p ON p.id = ws.product_id
      JOIN market_warehouses w ON w.id = ws.warehouse_id
      WHERE ws.quantity_reserved > 0
        AND p.company_id = $1
      ORDER BY ws.warehouse_id, p.name
    `, [payload.companyId])

    const stuckItems = stuckResult.rows.map(r => ({
      stockId: r.id,
      warehouseId: r.warehouse_id,
      warehouseName: r.warehouse_name,
      productId: r.product_id,
      productName: r.product_name,
      sku: r.sku,
      variantId: r.variant_id,
      quantityOnHand: parseFloat(r.quantity_on_hand) || 0,
      quantityReserved: parseFloat(r.quantity_reserved) || 0
    }))

    if (stuckItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay reservaciones atascadas',
        data: { fixed: 0, items: [] }
      })
    }

    // 2. Clear all stuck reservations
    await db.query(`
      UPDATE market_warehouse_stock SET
        quantity_reserved = 0,
        updated_at = NOW()
      WHERE quantity_reserved > 0
        AND product_id IN (SELECT id FROM market_products WHERE company_id = $1)
    `, [payload.companyId])

    // 3. Sync product quantities from warehouse stock
    const productIds = [...new Set(stuckItems.map(i => i.productId))]
    for (const productId of productIds) {
      // Sync main product quantity (non-variant stock)
      await db.query(`
        UPDATE market_products SET
          quantity_on_hand = COALESCE((
            SELECT SUM(quantity_on_hand) FROM market_warehouse_stock
            WHERE product_id = $1 AND variant_id IS NULL
          ), 0),
          updated_at = NOW()
        WHERE id = $1
      `, [productId])

      // Sync variant quantities
      const variants = stuckItems.filter(i => i.productId === productId && i.variantId)
      for (const v of variants) {
        await db.query(`
          UPDATE market_product_variants SET
            quantity_on_hand = COALESCE((
              SELECT SUM(quantity_on_hand) FROM market_warehouse_stock
              WHERE product_id = $1 AND variant_id = $2
            ), 0),
            updated_at = NOW()
          WHERE id = $2
        `, [productId, v.variantId])
      }
    }

    // 4. Get current stock status for verification
    const verifyResult = await db.query(`
      SELECT ws.product_id, p.name as product_name, p.sku,
             ws.warehouse_id, w.name as warehouse_name,
             ws.variant_id, ws.quantity_on_hand, ws.quantity_reserved,
             p.quantity_on_hand as product_total
      FROM market_warehouse_stock ws
      JOIN market_products p ON p.id = ws.product_id
      JOIN market_warehouses w ON w.id = ws.warehouse_id
      WHERE p.company_id = $1
        AND ws.product_id = ANY($2)
      ORDER BY p.name, w.name
    `, [payload.companyId, productIds])

    const currentStock = verifyResult.rows.map(r => ({
      productName: r.product_name,
      sku: r.sku,
      warehouseName: r.warehouse_name,
      quantityOnHand: parseFloat(r.quantity_on_hand) || 0,
      quantityReserved: parseFloat(r.quantity_reserved) || 0,
      productTotal: parseFloat(r.product_total) || 0
    }))

    return NextResponse.json({
      success: true,
      message: `Se limpiaron ${stuckItems.length} reservaciones atascadas`,
      data: {
        fixed: stuckItems.length,
        itemsFixed: stuckItems,
        currentStock
      }
    })

  } catch (error) {
    console.error('[Fix Reservations] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al corregir reservaciones'
    }, { status: 500 })
  }
}
