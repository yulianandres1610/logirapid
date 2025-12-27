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
 * GET /api/consignments/returns
 * Lista devoluciones de consignacion
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const supplierId = searchParams.get('supplier_id')

    let filters = ['s.company_id = $1']
    const params: (string | number)[] = [payload.companyId]
    let paramIndex = 2

    if (status !== 'all') {
      filters.push(`r.status = $${paramIndex}`)
      params.push(status)
      paramIndex++
    }

    if (supplierId) {
      filters.push(`r.supplier_id = $${paramIndex}`)
      params.push(parseInt(supplierId))
      paramIndex++
    }

    const whereClause = filters.join(' AND ')

    const result = await db.query(`
      SELECT
        r.*,
        s.code as supplier_code,
        s.name as supplier_name,
        o.order_number,
        w.name as warehouse_name,
        (SELECT COUNT(*) FROM consignment_return_lines WHERE return_id = r.id) as line_count
      FROM consignment_returns r
      JOIN consignment_suppliers s ON s.id = r.supplier_id
      JOIN consignment_orders o ON o.id = r.order_id
      JOIN market_warehouses w ON w.id = r.warehouse_id
      WHERE ${whereClause}
      ORDER BY r.created_at DESC
    `, params)

    // Get stats
    const statsResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE r.status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE r.status = 'validated') as validated_count,
        COUNT(*) FILTER (WHERE r.status = 'completed') as completed_count,
        COALESCE(SUM(r.total_value) FILTER (WHERE r.status = 'pending'), 0) as pending_value,
        COALESCE(SUM(r.total_value) FILTER (WHERE r.status = 'completed'), 0) as completed_value
      FROM consignment_returns r
      JOIN consignment_suppliers s ON s.id = r.supplier_id
      WHERE s.company_id = $1
    `, [payload.companyId])

    const stats = statsResult.rows[0]

    const returns = result.rows.map(r => ({
      id: r.id,
      returnNumber: r.return_number,
      supplier: {
        id: r.supplier_id,
        code: r.supplier_code,
        name: r.supplier_name
      },
      order: {
        id: r.order_id,
        orderNumber: r.order_number
      },
      warehouse: {
        id: r.warehouse_id,
        name: r.warehouse_name
      },
      status: r.status,
      totalItems: parseInt(r.line_count) || 0,
      totalUnits: parseInt(r.total_units) || 0,
      totalValue: parseFloat(r.total_value) || 0,
      reason: r.reason,
      createdAt: r.created_at,
      validatedAt: r.validated_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        returns,
        stats: {
          pending: { count: parseInt(stats.pending_count), value: parseFloat(stats.pending_value) },
          validated: { count: parseInt(stats.validated_count), value: 0 },
          completed: { count: parseInt(stats.completed_count), value: parseFloat(stats.completed_value) }
        }
      }
    })

  } catch (error) {
    console.error('[Returns GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al cargar devoluciones'
    }, { status: 500 })
  }
}

interface ReturnLine {
  orderLineId: number
  productId: number
  quantity: number
  unitCost: number
}

/**
 * POST /api/consignments/returns
 * Crear devolucion de consignacion
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { orderId, reason, lines } = await request.json() as {
      orderId: number
      reason: string
      lines: ReturnLine[]
    }

    if (!orderId || !lines || lines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden y lineas son requeridas'
      }, { status: 400 })
    }

    // Verify order exists and belongs to company
    const orderResult = await db.query(`
      SELECT o.*, s.company_id
      FROM consignment_orders o
      JOIN consignment_suppliers s ON s.id = o.supplier_id
      WHERE o.id = $1 AND s.company_id = $2
    `, [orderId, payload.companyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Generate return number
    const year = new Date().getFullYear()
    const seqResult = await db.query(`
      SELECT COUNT(*) as count
      FROM consignment_returns
      WHERE EXTRACT(YEAR FROM created_at) = $1
    `, [year])
    const seq = (parseInt(seqResult.rows[0].count) + 1).toString().padStart(4, '0')
    const returnNumber = `RET-${year}-${seq}`

    // Calculate totals
    const totalUnits = lines.reduce((sum, l) => sum + l.quantity, 0)
    const totalValue = lines.reduce((sum, l) => sum + (l.quantity * l.unitCost), 0)

    // Create return
    const insertResult = await db.query(`
      INSERT INTO consignment_returns (
        return_number, order_id, supplier_id, warehouse_id, status,
        total_items, total_units, total_value, reason, created_by
      ) VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9)
      RETURNING id, return_number
    `, [
      returnNumber,
      orderId,
      order.supplier_id,
      order.warehouse_id,
      lines.length,
      totalUnits,
      totalValue,
      reason || null,
      payload.userId
    ])

    const returnId = insertResult.rows[0].id

    // Create return lines
    for (const line of lines) {
      // Find lot inventory for this product
      const lotResult = await db.query(`
        SELECT id FROM consignment_lot_inventory
        WHERE warehouse_id = $1 AND product_id = $2 AND order_line_id = $3
        LIMIT 1
      `, [order.warehouse_id, line.productId, line.orderLineId])

      await db.query(`
        INSERT INTO consignment_return_lines (
          return_id, order_line_id, lot_inventory_id, product_id,
          quantity_to_return, unit_cost
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        returnId,
        line.orderLineId,
        lotResult.rows[0]?.id || null,
        line.productId,
        line.quantity,
        line.unitCost
      ])
    }

    return NextResponse.json({
      success: true,
      message: 'Devolucion creada exitosamente',
      data: {
        id: returnId,
        returnNumber
      }
    })

  } catch (error) {
    console.error('[Returns POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al crear devolucion'
    }, { status: 500 })
  }
}
