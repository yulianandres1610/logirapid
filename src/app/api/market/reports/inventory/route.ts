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
 * GET /api/market/reports/inventory
 * Returns inventory analysis: expiration, rotation, valuation
 * Query params: warehouseId, expiringDays (default 30), tab
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    const companyId = payload.companyId
    const { searchParams } = new URL(request.url)

    const warehouseId = searchParams.get('warehouseId')
    const expiringDays = parseInt(searchParams.get('expiringDays') || '30')

    console.log('[Inventory Report API] Params:', { companyId, warehouseId, expiringDays })

    // Helper for safe queries
    const safeQuery = async (query: string, params: any[]) => {
      try {
        return await db.query(query, params)
      } catch (error) {
        console.log('[Inventory Report] Query skipped:', error instanceof Error ? error.message : error)
        return { rows: [] }
      }
    }

    // Products expiring soon (from both purchase and consignment lots)
    const expiringResult = await safeQuery(`
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.barcode,
        lots.lot_number,
        lots.expiration_date,
        (lots.expiration_date - CURRENT_DATE) as days_until_expiration,
        lots.quantity_available as quantity,
        lots.unit_cost,
        (lots.quantity_available * lots.unit_cost) as value,
        lots.source_type,
        w.name as warehouse_name
      FROM (
        -- Purchase lots
        SELECT
          product_id, warehouse_id, lot_number, expiration_date,
          quantity_available, unit_cost, 'compra' as source_type
        FROM purchase_lot_inventory
        WHERE company_id = $1
          AND expiration_date IS NOT NULL
          AND expiration_date <= CURRENT_DATE + $2::integer
          AND quantity_available > 0

        UNION ALL

        -- Consignment lots
        SELECT
          product_id, warehouse_id, lot_number, expiration_date,
          quantity_available, unit_cost, 'consignación' as source_type
        FROM consignment_lot_inventory
        WHERE company_id = $1
          AND expiration_date IS NOT NULL
          AND expiration_date <= CURRENT_DATE + $2::integer
          AND quantity_available > 0
      ) lots
      JOIN market_products p ON lots.product_id = p.id
      JOIN market_warehouses w ON lots.warehouse_id = w.id
      ORDER BY lots.expiration_date ASC
    `, [companyId, expiringDays])

    console.log('[Inventory Report API] Expiring products:', expiringResult.rows.length)

    // Inventory rotation (sales velocity)
    const rotationResult = await safeQuery(`
      WITH daily_sales AS (
        SELECT
          ol.product_id,
          SUM(ol.quantity) as total_sold,
          COUNT(DISTINCT DATE(o.created_at)) as days_with_sales
        FROM market_pos_order_lines ol
        JOIN market_pos_orders o ON ol.order_id = o.id
        WHERE o.company_id = $1
          AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
          AND o.status IN ('paid', 'completed')
        GROUP BY ol.product_id
      ),
      daily_purchases AS (
        SELECT
          pl.product_id,
          SUM(pl.quantity_received) as total_purchased,
          COUNT(DISTINCT DATE(p.received_date)) as days_with_purchases
        FROM market_purchase_lines pl
        JOIN market_purchases p ON pl.purchase_id = p.id
        WHERE p.company_id = $1
          AND p.received_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY pl.product_id
      )
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.barcode,
        p.quantity_on_hand,
        p.cost_price,
        COALESCE(ds.total_sold, 0) as total_sold_30d,
        COALESCE(ds.days_with_sales, 0) as days_with_sales,
        CASE
          WHEN COALESCE(ds.days_with_sales, 0) > 0
          THEN ROUND((ds.total_sold::numeric / ds.days_with_sales), 2)
          ELSE 0
        END as sales_velocity,
        CASE
          WHEN COALESCE(ds.total_sold, 0) > 0 AND ds.days_with_sales > 0
          THEN ROUND((p.quantity_on_hand::numeric / (ds.total_sold::numeric / ds.days_with_sales)), 1)
          ELSE 999
        END as days_of_stock,
        COALESCE(dp.total_purchased, 0) as total_purchased_30d,
        CASE
          WHEN COALESCE(dp.days_with_purchases, 0) > 0
          THEN ROUND((dp.total_purchased::numeric / dp.days_with_purchases), 2)
          ELSE 0
        END as purchase_velocity
      FROM market_products p
      LEFT JOIN daily_sales ds ON p.id = ds.product_id
      LEFT JOIN daily_purchases dp ON p.id = dp.product_id
      WHERE p.company_id = $1
        AND p.is_active = true
        AND p.quantity_on_hand > 0
      ORDER BY
        CASE
          WHEN COALESCE(ds.total_sold, 0) > 0 AND ds.days_with_sales > 0
          THEN (p.quantity_on_hand::numeric / (ds.total_sold::numeric / ds.days_with_sales))
          ELSE 999
        END ASC
    `, [companyId])

    console.log('[Inventory Report API] Rotation products:', rotationResult.rows.length)

    // Stock valuation by warehouse
    const valuationByWarehouse = await safeQuery(`
      SELECT
        w.id as warehouse_id,
        w.name as warehouse_name,
        COUNT(DISTINCT ws.product_id) as product_count,
        COALESCE(SUM(ws.quantity_on_hand), 0) as total_units,
        COALESCE(SUM(ws.quantity_on_hand * COALESCE(p.cost_price, 0)), 0) as total_value
      FROM market_warehouses w
      LEFT JOIN market_warehouse_stock ws ON w.id = ws.warehouse_id
      LEFT JOIN market_products p ON ws.product_id = p.id
      WHERE w.company_id = $1 AND w.is_active = true
      GROUP BY w.id, w.name
      ORDER BY total_value DESC
    `, [companyId])

    console.log('[Inventory Report API] Valuation by warehouse:', valuationByWarehouse.rows.length)

    // Stock valuation by category
    const valuationByCategory = await safeQuery(`
      SELECT
        COALESCE(p.category, 'Sin categoría') as category_name,
        COUNT(DISTINCT p.id) as product_count,
        COALESCE(SUM(p.quantity_on_hand), 0) as total_units,
        COALESCE(SUM(p.quantity_on_hand * COALESCE(p.cost_price, 0)), 0) as total_value
      FROM market_products p
      WHERE p.company_id = $1 AND p.is_active = true
      GROUP BY p.category
      ORDER BY total_value DESC
    `, [companyId])

    console.log('[Inventory Report API] Valuation by category:', valuationByCategory.rows.length)

    // Summary statistics
    const summaryResult = await safeQuery(`
      SELECT
        COUNT(*) as total_products,
        COUNT(*) FILTER (WHERE quantity_on_hand > 0) as products_in_stock,
        COUNT(*) FILTER (WHERE quantity_on_hand <= minimum_stock AND quantity_on_hand > 0) as low_stock,
        COUNT(*) FILTER (WHERE quantity_on_hand = 0) as out_of_stock,
        COALESCE(SUM(quantity_on_hand * COALESCE(cost_price, 0)), 0) as total_value
      FROM market_products
      WHERE company_id = $1 AND is_active = true
    `, [companyId])

    console.log('[Inventory Report API] Summary:', summaryResult.rows[0])

    // Low stock products
    const lowStockResult = await safeQuery(`
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.barcode,
        p.quantity_on_hand,
        p.minimum_stock,
        (p.minimum_stock - p.quantity_on_hand) as deficit
      FROM market_products p
      WHERE p.company_id = $1
        AND p.is_active = true
        AND p.quantity_on_hand <= p.minimum_stock
        AND p.quantity_on_hand > 0
      ORDER BY deficit DESC
      LIMIT 20
    `, [companyId])

    // Calculate totals
    const totalExpiringValue = expiringResult.rows.reduce((sum, row) => sum + parseFloat(row.value || 0), 0)
    const totalExpiringUnits = expiringResult.rows.reduce((sum, row) => sum + parseInt(row.quantity || 0), 0)

    // High rotation products (selling fast)
    const highRotation = rotationResult.rows.filter(row =>
      parseFloat(row.sales_velocity) > 0 && parseFloat(row.days_of_stock) < 15
    )

    // Slow moving products (low rotation)
    const slowMoving = rotationResult.rows.filter(row =>
      parseFloat(row.days_of_stock) > 60 && parseInt(row.quantity_on_hand) > 0
    )

    return NextResponse.json({
      success: true,
      data: {
        filters: {
          warehouseId: warehouseId ? parseInt(warehouseId) : null,
          expiringDays
        },
        summary: {
          totalProducts: parseInt(summaryResult.rows[0]?.total_products) || 0,
          productsInStock: parseInt(summaryResult.rows[0]?.products_in_stock) || 0,
          lowStockCount: parseInt(summaryResult.rows[0]?.low_stock) || 0,
          outOfStockCount: parseInt(summaryResult.rows[0]?.out_of_stock) || 0,
          totalValue: parseFloat(summaryResult.rows[0]?.total_value) || 0,
          expiringCount: expiringResult.rows.length,
          expiringValue: totalExpiringValue,
          expiringUnits: totalExpiringUnits,
          highRotationCount: highRotation.length,
          slowMovingCount: slowMoving.length
        },
        expiring: expiringResult.rows.map(row => ({
          productId: row.product_id,
          productName: row.product_name,
          barcode: row.barcode,
          lotNumber: row.lot_number,
          expirationDate: row.expiration_date,
          daysUntilExpiration: parseInt(row.days_until_expiration),
          quantity: parseInt(row.quantity),
          unitCost: parseFloat(row.unit_cost) || 0,
          value: parseFloat(row.value) || 0,
          sourceType: row.source_type,
          warehouseName: row.warehouse_name
        })),
        rotation: rotationResult.rows.map(row => ({
          productId: row.product_id,
          productName: row.product_name,
          barcode: row.barcode,
          quantityOnHand: parseInt(row.quantity_on_hand) || 0,
          costPrice: parseFloat(row.cost_price) || 0,
          totalSold30d: parseInt(row.total_sold_30d) || 0,
          salesVelocity: parseFloat(row.sales_velocity) || 0,
          daysOfStock: parseFloat(row.days_of_stock) || 999,
          totalPurchased30d: parseInt(row.total_purchased_30d) || 0,
          purchaseVelocity: parseFloat(row.purchase_velocity) || 0
        })),
        valuation: {
          byWarehouse: valuationByWarehouse.rows.map(row => ({
            warehouseId: row.warehouse_id,
            warehouseName: row.warehouse_name,
            productCount: parseInt(row.product_count) || 0,
            totalUnits: parseInt(row.total_units) || 0,
            totalValue: parseFloat(row.total_value) || 0
          })),
          byCategory: valuationByCategory.rows.map(row => ({
            categoryName: row.category_name,
            productCount: parseInt(row.product_count) || 0,
            totalUnits: parseInt(row.total_units) || 0,
            totalValue: parseFloat(row.total_value) || 0
          }))
        },
        lowStock: lowStockResult.rows.map(row => ({
          productId: row.product_id,
          productName: row.product_name,
          barcode: row.barcode,
          quantityOnHand: parseInt(row.quantity_on_hand) || 0,
          minimumStock: parseInt(row.minimum_stock) || 0,
          deficit: parseInt(row.deficit) || 0
        })),
        alerts: {
          expiringSoon: expiringResult.rows.filter(row => parseInt(row.days_until_expiration) <= 7).length,
          alreadyExpired: expiringResult.rows.filter(row => parseInt(row.days_until_expiration) < 0).length,
          criticalLowStock: lowStockResult.rows.filter(row => parseInt(row.quantity_on_hand) <= 5).length
        }
      }
    })

  } catch (error) {
    console.error('[Inventory Report API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener reporte de inventario'
    }, { status: 500 })
  }
}
