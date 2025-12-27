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
 * GET /api/consignments/orders
 * Lista órdenes de consignación
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const supplierId = searchParams.get('supplierId') || ''
    const warehouseId = searchParams.get('warehouseId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let query = `
      SELECT
        o.*,
        s.code as supplier_code,
        s.name as supplier_name,
        w.name as warehouse_name,
        w.code as warehouse_code,
        u.firstname || ' ' || u.lastname as created_by_name,
        (SELECT COUNT(*) FROM consignment_order_lines WHERE order_id = o.id) as line_count
      FROM consignment_orders o
      JOIN consignment_suppliers s ON s.id = o.supplier_id
      JOIN market_warehouses w ON w.id = o.warehouse_id
      LEFT JOIN users u ON u.id = o.created_by
      WHERE o.company_id = $1
    `
    const params: (string | number)[] = [payload.companyId]
    let paramIndex = 2

    if (search) {
      query += ` AND (o.order_number ILIKE $${paramIndex} OR s.name ILIKE $${paramIndex})`
      params.push(`%${search}%`)
      paramIndex++
    }

    if (status) {
      query += ` AND o.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    if (supplierId) {
      query += ` AND o.supplier_id = $${paramIndex}`
      params.push(parseInt(supplierId))
      paramIndex++
    }

    if (warehouseId) {
      query += ` AND o.warehouse_id = $${paramIndex}`
      params.push(parseInt(warehouseId))
      paramIndex++
    }

    // Count total - build count query separately to avoid subquery issues
    let countQuery = `
      SELECT COUNT(*) as total
      FROM consignment_orders o
      JOIN consignment_suppliers s ON s.id = o.supplier_id
      JOIN market_warehouses w ON w.id = o.warehouse_id
      LEFT JOIN users u ON u.id = o.created_by
      WHERE o.company_id = $1
    `
    const countParams: (string | number)[] = [payload.companyId]
    let countParamIndex = 2

    if (search) {
      countQuery += ` AND (o.order_number ILIKE $${countParamIndex} OR s.name ILIKE $${countParamIndex})`
      countParams.push(`%${search}%`)
      countParamIndex++
    }

    if (status) {
      countQuery += ` AND o.status = $${countParamIndex}`
      countParams.push(status)
      countParamIndex++
    }

    if (supplierId) {
      countQuery += ` AND o.supplier_id = $${countParamIndex}`
      countParams.push(parseInt(supplierId))
      countParamIndex++
    }

    if (warehouseId) {
      countQuery += ` AND o.warehouse_id = $${countParamIndex}`
      countParams.push(parseInt(warehouseId))
      countParamIndex++
    }

    const countResult = await db.query(countQuery, countParams)
    const total = parseInt(countResult.rows[0]?.total || '0')

    // Get stats by status
    const statsResult = await db.query(`
      SELECT
        status,
        COUNT(*) as count,
        COALESCE(SUM(total_cost), 0) as total_cost,
        COALESCE(SUM(total_sold), 0) as total_sold,
        COALESCE(SUM(total_paid), 0) as total_paid
      FROM consignment_orders
      WHERE company_id = $1
      GROUP BY status
    `, [payload.companyId])

    const stats = {
      pending: { count: 0, totalCost: 0 },
      received: { count: 0, totalCost: 0 },
      selling: { count: 0, totalCost: 0, totalSold: 0 },
      paid: { count: 0, totalPaid: 0 },
      returned: { count: 0 },
      liquidated: { count: 0 }
    }

    for (const row of statsResult.rows) {
      const s = row.status as keyof typeof stats
      if (stats[s]) {
        stats[s].count = parseInt(row.count)
        if ('totalCost' in stats[s]) {
          (stats[s] as { totalCost: number }).totalCost = parseFloat(row.total_cost)
        }
        if ('totalSold' in stats[s]) {
          (stats[s] as { totalSold: number }).totalSold = parseFloat(row.total_sold)
        }
        if ('totalPaid' in stats[s]) {
          (stats[s] as { totalPaid: number }).totalPaid = parseFloat(row.total_paid)
        }
      }
    }

    // Get paginated results
    query += ` ORDER BY o.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    const orders = result.rows.map(o => ({
      id: o.id,
      orderNumber: o.order_number,
      supplier: {
        id: o.supplier_id,
        code: o.supplier_code,
        name: o.supplier_name
      },
      warehouse: {
        id: o.warehouse_id,
        code: o.warehouse_code,
        name: o.warehouse_name
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
      notes: o.notes,
      createdBy: o.created_by_name,
      createdAt: o.created_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        orders,
        stats,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('[Consignment Orders GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener órdenes'
    }, { status: 500 })
  }
}

/**
 * POST /api/consignments/orders
 * Crear orden de consignación
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { supplierId, warehouseId, consignmentDate, notes, lines } = body

    // Validaciones
    if (!supplierId || !warehouseId || !lines || lines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Proveedor, almacén y productos son requeridos'
      }, { status: 400 })
    }

    // Verificar proveedor existe
    const supplierCheck = await db.query(
      'SELECT id, code FROM consignment_suppliers WHERE id = $1 AND company_id = $2',
      [supplierId, payload.companyId]
    )
    if (supplierCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Proveedor no encontrado'
      }, { status: 404 })
    }

    // Verificar almacén existe
    const warehouseCheck = await db.query(
      'SELECT id FROM market_warehouses WHERE id = $1 AND company_id = $2',
      [warehouseId, payload.companyId]
    )
    if (warehouseCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Almacén no encontrado'
      }, { status: 404 })
    }

    // Generar número de orden
    const year = new Date().getFullYear()
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM consignment_orders WHERE company_id = $1 AND order_number LIKE $2`,
      [payload.companyId, `CONS-${year}-%`]
    )
    const count = parseInt(countResult.rows[0].count) + 1
    const orderNumber = `CONS-${year}-${count.toString().padStart(4, '0')}`

    // Calcular totales
    let totalItems = lines.length
    let totalUnits = 0
    let totalCost = 0

    for (const line of lines) {
      totalUnits += line.quantity
      totalCost += line.quantity * line.unitCost
    }

    // Crear orden
    const orderResult = await db.query(`
      INSERT INTO consignment_orders (
        company_id, order_number, supplier_id, warehouse_id,
        status, total_items, total_units, total_cost,
        consignment_date, notes, created_by
      ) VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9, $10)
      RETURNING id
    `, [
      payload.companyId,
      orderNumber,
      supplierId,
      warehouseId,
      totalItems,
      totalUnits,
      totalCost,
      consignmentDate || new Date().toISOString().split('T')[0],
      notes || null,
      payload.userId
    ])

    const orderId = orderResult.rows[0].id

    // Crear líneas
    for (const line of lines) {
      await db.query(`
        INSERT INTO consignment_order_lines (
          order_id, product_id, quantity_ordered, unit_cost, unit_price
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        orderId,
        line.productId,
        line.quantity,
        line.unitCost,
        line.unitPrice || null
      ])
    }

    return NextResponse.json({
      success: true,
      message: 'Orden de consignación creada exitosamente',
      data: {
        id: orderId,
        orderNumber,
        totalItems,
        totalUnits,
        totalCost
      }
    })

  } catch (error) {
    console.error('[Consignment Orders POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear orden'
    }, { status: 500 })
  }
}
