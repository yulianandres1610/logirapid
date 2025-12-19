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
      totalOnHand: acc.totalOnHand + (parseInt(row.quantity_on_hand) || 0),
      totalReserved: acc.totalReserved + (parseInt(row.quantity_reserved) || 0),
      totalAvailable: acc.totalAvailable + (parseInt(row.quantity_available) || 0)
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
        quantityOnHand: stockData ? parseInt(stockData.quantity_on_hand) : 0,
        quantityReserved: stockData ? parseInt(stockData.quantity_reserved) : 0,
        quantityAvailable: stockData ? parseInt(stockData.quantity_available) : 0,
        locationCode: stockData?.location_code || null,
        lastMovementAt: stockData?.last_movement_at || null
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        warehouses: stockByWarehouse,
        totals,
        warehouseCount: warehousesResult.rows.length
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
