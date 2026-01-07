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
 * GET /api/market/warehouses/[id]/consignments
 * Lista ordenes de consignacion pendientes para un almacen
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
    const status = searchParams.get('status') || 'pending'

    // Verify warehouse belongs to company
    const warehouseCheck = await db.query(
      'SELECT id FROM market_warehouses WHERE id = $1 AND company_id = $2',
      [warehouseId, payload.companyId]
    )

    if (warehouseCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Almacen no encontrado'
      }, { status: 404 })
    }

    // Get consignment orders for this warehouse
    const result = await db.query(`
      SELECT
        o.*,
        s.supplier_code as supplier_code,
        s.name as supplier_name,
        (SELECT COUNT(*) FROM consignment_order_lines WHERE order_id = o.id) as line_count
      FROM consignment_orders o
      JOIN market_suppliers s ON s.id = o.supplier_id
      WHERE o.warehouse_id = $1 AND o.company_id = $2 AND o.status = $3
      ORDER BY o.created_at DESC
    `, [warehouseId, payload.companyId, status])

    const orders = result.rows.map(o => ({
      id: o.id,
      orderNumber: o.order_number,
      supplier: {
        id: o.supplier_id,
        code: o.supplier_code,
        name: o.supplier_name
      },
      status: o.status,
      totalItems: parseInt(o.line_count) || 0,
      totalUnits: parseInt(o.total_units) || 0,
      totalCost: parseFloat(o.total_cost) || 0,
      consignmentDate: o.consignment_date,
      createdAt: o.created_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        orders,
        count: orders.length
      }
    })

  } catch (error) {
    console.error('[Warehouse Consignments GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener ordenes'
    }, { status: 500 })
  }
}
