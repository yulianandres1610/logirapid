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

    // Get consignment receptions
    const consignmentReceptions = type === 'purchase' ? [] : (await db.query(`
      SELECT
        o.id,
        o.order_number,
        'consignment' as order_type,
        o.status,
        o.received_at,
        s.code as supplier_code,
        s.name as supplier_name,
        u.name as received_by_name,
        COALESCE(SUM(ol.quantity_received), 0) as total_units,
        COUNT(DISTINCT ol.id) as total_lines
      FROM consignment_orders o
      JOIN consignment_suppliers s ON s.id = o.supplier_id
      LEFT JOIN users u ON u.id = o.received_by
      LEFT JOIN consignment_order_lines ol ON ol.order_id = o.id
      WHERE o.company_id = $1
        AND o.warehouse_id = $2
        AND o.status IN ('received', 'partial')
        AND o.received_at IS NOT NULL
      GROUP BY o.id, o.order_number, o.status, o.received_at, s.code, s.name, u.name
      ORDER BY o.received_at DESC
      LIMIT $3
    `, [payload.companyId, warehouseId, limit])).rows

    // Get purchase receptions
    const purchaseReceptions = type === 'consignment' ? [] : (await db.query(`
      SELECT
        p.id,
        p.purchase_number as order_number,
        'purchase' as order_type,
        p.status,
        p.received_date as received_at,
        COALESCE(ms.supplier_code, 'PROV') as supplier_code,
        COALESCE(p.supplier_name, ms.name, 'Proveedor') as supplier_name,
        u.name as received_by_name,
        COALESCE(SUM(pl.quantity_received), 0) as total_units,
        COUNT(DISTINCT pl.id) as total_lines
      FROM market_purchases p
      LEFT JOIN market_suppliers ms ON ms.id = p.supplier_id
      LEFT JOIN users u ON u.id = p.received_by
      LEFT JOIN market_purchase_lines pl ON pl.purchase_id = p.id
      WHERE p.company_id = $1
        AND p.warehouse_id = $2
        AND p.status IN ('recibido', 'pendiente')
        AND p.received_date IS NOT NULL
      GROUP BY p.id, p.purchase_number, p.status, p.received_date, ms.supplier_code, p.supplier_name, ms.name, u.name
      ORDER BY p.received_date DESC
      LIMIT $3
    `, [payload.companyId, warehouseId, limit])).rows

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
