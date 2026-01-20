import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const companyId = cookieStore.get('user-company-id')?.value

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'Sin empresa asignada' }, { status: 403 })
    }

    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    // Get currentWarehouseId from query params
    const url = new URL(request.url)
    const currentWarehouseId = url.searchParams.get('currentWarehouseId')
    const currentWarehouseIdNum = currentWarehouseId ? parseInt(currentWarehouseId) : null

    // Get stock by warehouse
    const stockResult = await db.query(`
      SELECT
        mws.id,
        mws.warehouse_id,
        mw.name as warehouse_name,
        mw.code as warehouse_code,
        mw.is_central,
        mw.city,
        mws.quantity_on_hand,
        mws.quantity_reserved,
        (mws.quantity_on_hand - mws.quantity_reserved) as quantity_available,
        mws.location_code,
        mws.last_movement_at
      FROM market_warehouse_stock mws
      JOIN market_warehouses mw ON mws.warehouse_id = mw.id
      WHERE mws.product_id = $1 AND mw.company_id = $2 AND mw.is_active = true
      ORDER BY mw.is_central DESC, mw.name ASC
    `, [productId, parseInt(companyId)])

    // Calculate totals
    const totals = stockResult.rows.reduce((acc, row) => ({
      totalOnHand: acc.totalOnHand + (parseFloat(row.quantity_on_hand) || 0),
      totalReserved: acc.totalReserved + (parseFloat(row.quantity_reserved) || 0),
      totalAvailable: acc.totalAvailable + (parseFloat(row.quantity_available) || 0)
    }), { totalOnHand: 0, totalReserved: 0, totalAvailable: 0 })

    // Get all active warehouses to show which ones don't have stock
    const warehousesResult = await db.query(`
      SELECT id, name, code, is_central, city
      FROM market_warehouses
      WHERE company_id = $1 AND is_active = true
      ORDER BY is_central DESC, name ASC
    `, [parseInt(companyId)])

    // Merge warehouses with stock data
    const stockByWarehouse = warehousesResult.rows.map(warehouse => {
      const stockData = stockResult.rows.find(s => s.warehouse_id === warehouse.id)
      return {
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        warehouseCode: warehouse.code,
        isCentral: warehouse.is_central,
        city: warehouse.city,
        quantityOnHand: stockData ? parseFloat(stockData.quantity_on_hand) : 0,
        quantityReserved: stockData ? parseFloat(stockData.quantity_reserved) : 0,
        quantityAvailable: stockData ? parseFloat(stockData.quantity_available) : 0,
        locationCode: stockData?.location_code || null,
        lastMovementAt: stockData?.last_movement_at || null,
        isCurrentWarehouse: currentWarehouseIdNum ? warehouse.id === currentWarehouseIdNum : false
      }
    })

    // Get variant stock data
    const variantStockResult = await db.query(`
      SELECT
        mpv.id as variant_id,
        mpv.variant_name,
        mpv.sku as variant_sku,
        mpv.barcode as variant_barcode,
        mws.warehouse_id,
        mw.name as warehouse_name,
        COALESCE(mws.quantity_on_hand, 0) as quantity_on_hand,
        COALESCE(mws.quantity_reserved, 0) as quantity_reserved,
        (COALESCE(mws.quantity_on_hand, 0) - COALESCE(mws.quantity_reserved, 0)) as quantity_available
      FROM market_product_variants mpv
      LEFT JOIN market_warehouse_stock mws ON mws.variant_id = mpv.id AND mws.product_id = $1
      LEFT JOIN market_warehouses mw ON mws.warehouse_id = mw.id AND mw.company_id = $2
      WHERE mpv.product_id = $1 AND mpv.is_active = true
      ORDER BY mpv.variant_name, mw.name
    `, [productId, parseInt(companyId)])

    // Group variant stock by variant
    const variantStockMap = new Map<number, {
      variantId: number
      variantName: string
      variantSku: string
      variantBarcode: string | null
      totalOnHand: number
      totalReserved: number
      totalAvailable: number
      byWarehouse: Array<{
        warehouseId: number
        warehouseName: string
        quantityOnHand: number
        quantityReserved: number
        quantityAvailable: number
        isCurrentWarehouse: boolean
      }>
    }>()

    for (const row of variantStockResult.rows) {
      if (!variantStockMap.has(row.variant_id)) {
        variantStockMap.set(row.variant_id, {
          variantId: row.variant_id,
          variantName: row.variant_name,
          variantSku: row.variant_sku,
          variantBarcode: row.variant_barcode,
          totalOnHand: 0,
          totalReserved: 0,
          totalAvailable: 0,
          byWarehouse: []
        })
      }
      const variant = variantStockMap.get(row.variant_id)!
      if (row.warehouse_id) {
        const qty = parseFloat(row.quantity_on_hand) || 0
        const reserved = parseFloat(row.quantity_reserved) || 0
        variant.totalOnHand += qty
        variant.totalReserved += reserved
        variant.totalAvailable += qty - reserved
        variant.byWarehouse.push({
          warehouseId: row.warehouse_id,
          warehouseName: row.warehouse_name,
          quantityOnHand: qty,
          quantityReserved: reserved,
          quantityAvailable: qty - reserved,
          isCurrentWarehouse: currentWarehouseIdNum ? row.warehouse_id === currentWarehouseIdNum : false
        })
      }
    }

    const variantStock = Array.from(variantStockMap.values())

    // Add cache headers to reduce repeated calls (30 seconds)
    return NextResponse.json({
      success: true,
      data: {
        warehouses: stockByWarehouse,
        variantStock,
        totals,
        warehouseCount: warehousesResult.rows.length
      }
    }, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60'
      }
    })
  } catch (error) {
    console.error('Error getting product stock:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener stock del producto'
    }, { status: 500 })
  }
}
