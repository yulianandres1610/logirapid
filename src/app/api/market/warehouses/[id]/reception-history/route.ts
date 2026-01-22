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

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null

  try {
    const secret = process.env.JWT_SECRET || 'fallback-secret'
    return jwt.verify(token, secret) as JWTPayload
  } catch {
    return null
  }
}

/**
 * GET /api/market/warehouses/[id]/reception-history
 * Obtiene historial de recepciones (consignaciones y compras)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const warehouseId = parseInt(id)
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'consignment', 'purchase', or null for both
    const limit = parseInt(searchParams.get('limit') || '50')

    console.log('[Reception History] Query params:', { companyId: payload.companyId, warehouseId, type, limit })

    // Get consignment receptions
    // Buscar órdenes que tengan lotes en este almacén (consignment_lot_inventory)
    // o que tengan warehouse_id = este almacén
    const consignmentReceptions = type === 'purchase' ? [] : (await db.query(`
      SELECT DISTINCT
        o.id,
        o.order_number,
        'consignment' as order_type,
        o.status,
        COALESCE(o.received_at, o.updated_at) as received_at,
        s.supplier_code as supplier_code,
        s.name as supplier_name,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as received_by_name,
        (SELECT COALESCE(SUM(quantity_received), 0) FROM consignment_order_lines WHERE order_id = o.id) as total_units,
        (SELECT COUNT(*) FROM consignment_order_lines WHERE order_id = o.id AND quantity_received > 0) as total_lines
      FROM consignment_orders o
      JOIN market_suppliers s ON s.id = o.supplier_id
      LEFT JOIN users u ON u.id = o.received_by
      WHERE o.company_id = $1
        AND o.status IN ('received', 'partial')
        AND (
          o.warehouse_id = $2
          OR EXISTS (
            SELECT 1 FROM consignment_lot_inventory cli
            WHERE cli.warehouse_id = $2
            AND cli.company_id = $1
            AND EXISTS (
              SELECT 1 FROM consignment_order_lines col
              WHERE col.order_id = o.id
              AND col.id = cli.order_line_id
            )
          )
        )
        AND EXISTS (
          SELECT 1 FROM consignment_order_lines col
          WHERE col.order_id = o.id AND col.quantity_received > 0
        )
      ORDER BY COALESCE(o.received_at, o.updated_at) DESC
      LIMIT $3
    `, [payload.companyId, warehouseId, limit])).rows

    console.log('[Reception History] Consignment results:', consignmentReceptions.length)

    // Get purchase receptions
    // Buscar compras que tengan lotes en este almacén (purchase_lot_inventory)
    // o que tengan warehouse_id = este almacén
    const purchaseReceptions = type === 'consignment' ? [] : (await db.query(`
      SELECT DISTINCT
        p.id,
        p.purchase_number as order_number,
        'purchase' as order_type,
        p.status,
        COALESCE(p.received_date, p.updated_at) as received_at,
        COALESCE(ms.supplier_code, 'PROV') as supplier_code,
        COALESCE(p.supplier_name, ms.name, 'Proveedor') as supplier_name,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as received_by_name,
        (SELECT COALESCE(SUM(quantity_received), 0) FROM market_purchase_lines WHERE purchase_id = p.id) as total_units,
        (SELECT COUNT(*) FROM market_purchase_lines WHERE purchase_id = p.id AND quantity_received > 0) as total_lines
      FROM market_purchases p
      LEFT JOIN market_suppliers ms ON ms.id = p.supplier_id
      LEFT JOIN users u ON u.id = p.received_by
      WHERE p.company_id = $1
        AND p.status IN ('recibido', 'pendiente')
        AND (
          p.warehouse_id = $2
          OR EXISTS (
            SELECT 1 FROM purchase_lot_inventory pli
            WHERE pli.warehouse_id = $2
            AND pli.company_id = $1
            AND EXISTS (
              SELECT 1 FROM market_purchase_lines mpl
              WHERE mpl.purchase_id = p.id
              AND mpl.id = pli.purchase_line_id
            )
          )
        )
        AND EXISTS (
          SELECT 1 FROM market_purchase_lines mpl
          WHERE mpl.purchase_id = p.id AND mpl.quantity_received > 0
        )
      ORDER BY COALESCE(p.received_date, p.updated_at) DESC
      LIMIT $3
    `, [payload.companyId, warehouseId, limit])).rows

    console.log('[Reception History] Purchase results:', purchaseReceptions.length)

    // Combine and sort by date
    const allReceptions = [...consignmentReceptions, ...purchaseReceptions]
      .sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime())
      .slice(0, limit)

    return NextResponse.json({
      success: true,
      data: {
        receptions: allReceptions,
        summary: {
          totalConsignments: consignmentReceptions.length,
          totalPurchases: purchaseReceptions.length,
          totalUnits: allReceptions.reduce((sum, r) => sum + parseInt(r.total_units || '0'), 0)
        }
      }
    })

  } catch (error) {
    console.error('[Reception History] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener historial'
    }, { status: 500 })
  }
}

/**
 * GET /api/market/warehouses/[id]/reception-history/[orderId]
 * Obtiene detalles de una recepción específica
 */
