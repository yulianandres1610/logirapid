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
 * GET /api/market/warehouses/[id]/pending-orders
 * Get pending purchase orders and in-transit consignments for reception
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

    const { id } = await params
    const warehouseId = parseInt(id)

    if (isNaN(warehouseId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de almacén inválido'
      }, { status: 400 })
    }

    // Verify warehouse belongs to company
    const warehouseCheck = await db.query(
      'SELECT id, name FROM market_warehouses WHERE id = $1 AND company_id = $2',
      [warehouseId, payload.companyId]
    )

    if (warehouseCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Almacén no encontrado'
      }, { status: 404 })
    }

    // Get pending purchase orders (if table exists)
    let purchaseOrders: Array<{
      id: number
      orderNumber: string
      supplierName: string
      itemCount: number
      totalUnits: number
      expectedDate: string | null
      createdAt: string
    }> = []

    try {
      const poResult = await db.query(`
        SELECT
          po.id,
          po.order_number,
          COALESCE(s.name, 'Proveedor desconocido') as supplier_name,
          COUNT(poi.id) as item_count,
          COALESCE(SUM(poi.quantity), 0) as total_units,
          po.expected_delivery_date,
          po.created_at
        FROM market_purchase_orders po
        LEFT JOIN market_suppliers s ON po.supplier_id = s.id
        LEFT JOIN market_purchase_order_items poi ON po.id = poi.purchase_order_id
        WHERE po.company_id = $1
          AND po.warehouse_id = $2
          AND po.status IN ('pending', 'approved', 'ordered')
        GROUP BY po.id, po.order_number, s.name, po.expected_delivery_date, po.created_at
        ORDER BY po.expected_delivery_date ASC NULLS LAST, po.created_at DESC
      `, [payload.companyId, warehouseId])

      purchaseOrders = poResult.rows.map(r => ({
        id: r.id,
        orderNumber: r.order_number,
        supplierName: r.supplier_name,
        itemCount: parseInt(r.item_count) || 0,
        totalUnits: parseInt(r.total_units) || 0,
        expectedDate: r.expected_delivery_date,
        createdAt: r.created_at
      }))
    } catch {
      // Table might not exist, continue without purchase orders
      console.log('[Pending Orders] Purchase orders table not available')
    }

    // Get in-transit consignments destined for this company
    let consignments: Array<{
      id: number
      orderNumber: string
      providerName: string
      itemCount: number
      totalUnits: number
      sentAt: string | null
      status: string
    }> = []

    try {
      const consResult = await db.query(`
        SELECT
          co.id,
          co.order_number,
          COALESCE(c.legalname, c.tradename, 'Proveedor desconocido') as provider_name,
          COUNT(coi.id) as item_count,
          COALESCE(SUM(coi.quantity), 0) as total_units,
          co.sent_at,
          co.status
        FROM consignment_orders co
        LEFT JOIN companies c ON co.provider_company_id = c.id
        LEFT JOIN consignment_order_items coi ON co.id = coi.consignment_order_id
        WHERE co.receiver_company_id = $1
          AND co.status = 'in_transit'
        GROUP BY co.id, co.order_number, c.legalname, c.tradename, co.sent_at, co.status
        ORDER BY co.sent_at DESC NULLS LAST
      `, [payload.companyId])

      consignments = consResult.rows.map(r => ({
        id: r.id,
        orderNumber: r.order_number,
        providerName: r.provider_name,
        itemCount: parseInt(r.item_count) || 0,
        totalUnits: parseInt(r.total_units) || 0,
        sentAt: r.sent_at,
        status: r.status
      }))
    } catch {
      // Consignment tables might not exist, continue without
      console.log('[Pending Orders] Consignment orders table not available')
    }

    return NextResponse.json({
      success: true,
      data: {
        warehouseId,
        warehouseName: warehouseCheck.rows[0].name,
        purchaseOrders,
        consignments,
        totalPendingOrders: purchaseOrders.length + consignments.length
      }
    })

  } catch (error) {
    console.error('[Pending Orders] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener órdenes pendientes'
    }, { status: 500 })
  }
}

/**
 * GET /api/market/warehouses/[id]/pending-orders/[orderId]
 * Get details of a specific pending order (items list)
 */
