import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface SupplierJWTPayload {
  supplierId: number
  supplierCode: string
  companyId: number
  type: string
}

async function getSupplierPayload(): Promise<SupplierJWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('supplier-token')?.value
  if (!token) return null

  try {
    const secret = process.env.JWT_SECRET || 'fallback-secret'
    const payload = jwt.verify(token, secret) as SupplierJWTPayload
    if (payload.type !== 'supplier') return null
    return payload
  } catch {
    return null
  }
}

/**
 * GET /api/supplier/orders
 * Lista ordenes del proveedor con filtros
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getSupplierPayload()
    if (!payload) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    // First get supplier info from consignment_suppliers
    const consignmentResult = await db.query(`
      SELECT id, code, name FROM consignment_suppliers WHERE id = $1
    `, [payload.supplierId])

    if (consignmentResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Proveedor no encontrado'
      }, { status: 404 })
    }

    const consignmentSupplier = consignmentResult.rows[0]

    // Get market_suppliers.id - try by code first, then by name
    let marketSupplierResult = await db.query(`
      SELECT id FROM market_suppliers
      WHERE supplier_code = $1 AND company_id = $2
    `, [consignmentSupplier.code, payload.companyId])

    if (marketSupplierResult.rows.length === 0) {
      marketSupplierResult = await db.query(`
        SELECT id FROM market_suppliers
        WHERE LOWER(name) = LOWER($1) AND company_id = $2
      `, [consignmentSupplier.name, payload.companyId])
    }

    const supplierId = marketSupplierResult.rows[0]?.id

    // Return empty list if no market supplier found
    if (!supplierId) {
      return NextResponse.json({
        success: true,
        data: {
          orders: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
        }
      })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // all, active, completed
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let statusFilter = ''
    if (status === 'active') {
      statusFilter = "AND status IN ('pending', 'received', 'selling')"
    } else if (status === 'completed') {
      statusFilter = "AND status IN ('paid', 'liquidated')"
    }

    // Get orders
    const ordersResult = await db.query(`
      SELECT
        o.*,
        w.name as warehouse_name,
        w.code as warehouse_code,
        (SELECT COUNT(*) FROM consignment_order_lines WHERE order_id = o.id) as line_count
      FROM consignment_orders o
      LEFT JOIN market_warehouses w ON w.id = o.warehouse_id
      WHERE o.supplier_id = $1 ${statusFilter}
      ORDER BY o.created_at DESC
      LIMIT $2 OFFSET $3
    `, [supplierId, limit, offset])

    // Get total count
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM consignment_orders
      WHERE supplier_id = $1 ${statusFilter}
    `, [supplierId])

    const total = parseInt(countResult.rows[0].total)

    const orders = ordersResult.rows.map(o => ({
      id: o.id,
      orderNumber: o.order_number,
      warehouse: {
        id: o.warehouse_id,
        name: o.warehouse_name,
        code: o.warehouse_code
      },
      status: o.status,
      totalItems: parseInt(o.line_count) || 0,
      totalUnits: parseInt(o.total_units) || 0,
      totalCost: parseFloat(o.total_cost) || 0,
      totalSold: parseFloat(o.total_sold) || 0,
      totalPaid: parseFloat(o.total_paid) || 0,
      totalReturned: parseFloat(o.total_returned) || 0,
      consignmentDate: o.consignment_date,
      receivedAt: o.received_at,
      completedAt: o.completed_at,
      createdAt: o.created_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('[Supplier Orders] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al cargar ordenes'
    }, { status: 500 })
  }
}
