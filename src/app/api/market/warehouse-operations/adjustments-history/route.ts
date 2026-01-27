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
 * GET /api/market/warehouse-operations/adjustments-history
 * Get comprehensive history of adjustments and scrap operations with detailed reasons
 */
export async function GET(request: NextRequest) {
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

    const companyId = payload.companyId
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'all', 'adjustment', 'scrap'
    const status = searchParams.get('status')
    const warehouseId = searchParams.get('warehouseId')
    const search = searchParams.get('search') || ''
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build main query
    let query = `
      SELECT
        mwo.id,
        mwo.operation_number,
        mwo.operation_type,
        mwo.status,
        mwo.notes,
        mwo.internal_notes,
        mwo.created_at,
        mwo.completed_at,
        sw.id as warehouse_id,
        sw.name as warehouse_name,
        sw.code as warehouse_code,
        COALESCE(creator.firstname || ' ' || creator.lastname, creator.email) as created_by_name,
        COALESCE(completer.firstname || ' ' || completer.lastname, completer.email) as completed_by_name,
        (SELECT COUNT(*) FROM market_warehouse_operation_lines WHERE operation_id = mwo.id) as lines_count,
        (SELECT COALESCE(SUM(quantity_planned), 0) FROM market_warehouse_operation_lines WHERE operation_id = mwo.id) as total_quantity,
        (SELECT COALESCE(SUM(
          CASE
            WHEN mwol.variant_id IS NOT NULL THEN mwol.quantity_planned * COALESCE(mpv.cost_price, 0)
            ELSE mwol.quantity_planned * COALESCE(mp.cost_price, 0)
          END
        ), 0)
        FROM market_warehouse_operation_lines mwol
        LEFT JOIN market_products mp ON mp.id = mwol.product_id
        LEFT JOIN market_product_variants mpv ON mpv.id = mwol.variant_id
        WHERE mwol.operation_id = mwo.id) as total_value
      FROM market_warehouse_operations mwo
      LEFT JOIN market_warehouses sw ON mwo.source_warehouse_id = sw.id
      LEFT JOIN users creator ON mwo.created_by = creator.id
      LEFT JOIN users completer ON mwo.completed_by = completer.id
      WHERE mwo.company_id = $1
        AND mwo.operation_type IN ('adjustment', 'scrap')
    `

    const queryParams: (string | number)[] = [companyId]
    let paramIndex = 2

    if (type && type !== 'all') {
      query += ` AND mwo.operation_type = $${paramIndex}`
      queryParams.push(type)
      paramIndex++
    }

    if (status && status !== 'all') {
      query += ` AND mwo.status = $${paramIndex}`
      queryParams.push(status)
      paramIndex++
    }

    if (warehouseId) {
      query += ` AND mwo.source_warehouse_id = $${paramIndex}`
      queryParams.push(parseInt(warehouseId))
      paramIndex++
    }

    if (search) {
      query += ` AND (LOWER(mwo.operation_number) LIKE $${paramIndex} OR LOWER(mwo.notes) LIKE $${paramIndex})`
      queryParams.push(`%${search.toLowerCase()}%`)
      paramIndex++
    }

    if (dateFrom) {
      query += ` AND mwo.created_at >= $${paramIndex}`
      queryParams.push(dateFrom)
      paramIndex++
    }

    if (dateTo) {
      query += ` AND mwo.created_at <= $${paramIndex}`
      queryParams.push(dateTo + ' 23:59:59')
      paramIndex++
    }

    // Count total
    const countQuery = query.replace(/SELECT[\s\S]+FROM market_warehouse_operations/, 'SELECT COUNT(*) as total FROM market_warehouse_operations')
    const countResult = await db.query(countQuery, queryParams)
    const total = parseInt(countResult.rows[0]?.total) || 0

    // Add pagination
    query += ` ORDER BY mwo.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    queryParams.push(limit, offset)

    const result = await db.query(query, queryParams)

    // Get operation IDs to fetch lines
    const operationIds = result.rows.map(r => r.id)
    let linesMap: Record<number, Array<{
      id: number
      productId: number
      productName: string
      productSku: string
      variantId: number | null
      variantName: string | null
      quantity: number
      reason: string | null
      unitCost: number
    }>> = {}

    if (operationIds.length > 0) {
      const linesResult = await db.query(`
        SELECT
          mwol.id,
          mwol.operation_id,
          mwol.product_id,
          mp.name as product_name,
          mp.sku as product_sku,
          mwol.variant_id,
          mpv.variant_name,
          mwol.quantity_planned as quantity,
          mwol.scrap_reason as reason,
          CASE
            WHEN mwol.variant_id IS NOT NULL THEN COALESCE(mpv.cost_price, 0)
            ELSE COALESCE(mp.cost_price, 0)
          END as unit_cost
        FROM market_warehouse_operation_lines mwol
        LEFT JOIN market_products mp ON mp.id = mwol.product_id
        LEFT JOIN market_product_variants mpv ON mpv.id = mwol.variant_id
        WHERE mwol.operation_id = ANY($1)
        ORDER BY mp.name ASC
      `, [operationIds])

      for (const line of linesResult.rows) {
        if (!linesMap[line.operation_id]) {
          linesMap[line.operation_id] = []
        }
        linesMap[line.operation_id].push({
          id: line.id,
          productId: line.product_id,
          productName: line.product_name,
          productSku: line.product_sku,
          variantId: line.variant_id,
          variantName: line.variant_name,
          quantity: parseFloat(line.quantity) || 0,
          reason: line.reason,
          unitCost: parseFloat(line.unit_cost) || 0
        })
      }
    }

    // Get summary stats
    const statsResult = await db.query(`
      SELECT
        operation_type,
        status,
        COUNT(*) as count,
        COALESCE(SUM((
          SELECT COALESCE(SUM(quantity_planned), 0)
          FROM market_warehouse_operation_lines
          WHERE operation_id = mwo.id
        )), 0) as total_qty
      FROM market_warehouse_operations mwo
      WHERE company_id = $1 AND operation_type IN ('adjustment', 'scrap')
      GROUP BY operation_type, status
    `, [companyId])

    const stats = {
      adjustment: { draft: 0, done: 0, cancelled: 0, totalQty: 0, totalValue: 0 },
      scrap: { draft: 0, confirmed: 0, in_progress: 0, done: 0, cancelled: 0, totalQty: 0, totalValue: 0 }
    }

    for (const row of statsResult.rows) {
      if (stats[row.operation_type as keyof typeof stats]) {
        const statObj = stats[row.operation_type as keyof typeof stats]
        if (row.status in statObj) {
          (statObj as Record<string, number>)[row.status] = parseInt(row.count) || 0
        }
        statObj.totalQty += parseFloat(row.total_qty) || 0
      }
    }

    // Get total value for stats
    const valueResult = await db.query(`
      SELECT
        mwo.operation_type,
        COALESCE(SUM(
          CASE
            WHEN mwol.variant_id IS NOT NULL THEN mwol.quantity_planned * COALESCE(mpv.cost_price, 0)
            ELSE mwol.quantity_planned * COALESCE(mp.cost_price, 0)
          END
        ), 0) as total_value
      FROM market_warehouse_operations mwo
      LEFT JOIN market_warehouse_operation_lines mwol ON mwol.operation_id = mwo.id
      LEFT JOIN market_products mp ON mp.id = mwol.product_id
      LEFT JOIN market_product_variants mpv ON mpv.id = mwol.variant_id
      WHERE mwo.company_id = $1
        AND mwo.operation_type IN ('adjustment', 'scrap')
        AND mwo.status = 'done'
      GROUP BY mwo.operation_type
    `, [companyId])

    for (const row of valueResult.rows) {
      if (stats[row.operation_type as keyof typeof stats]) {
        stats[row.operation_type as keyof typeof stats].totalValue = parseFloat(row.total_value) || 0
      }
    }

    // Get reason distribution for scrap
    const reasonsResult = await db.query(`
      SELECT
        mwol.scrap_reason as reason,
        COUNT(*) as count,
        COALESCE(SUM(mwol.quantity_planned), 0) as total_qty
      FROM market_warehouse_operation_lines mwol
      JOIN market_warehouse_operations mwo ON mwo.id = mwol.operation_id
      WHERE mwo.company_id = $1
        AND mwo.operation_type = 'scrap'
        AND mwol.scrap_reason IS NOT NULL
      GROUP BY mwol.scrap_reason
      ORDER BY count DESC
    `, [companyId])

    const reasonDistribution = reasonsResult.rows.map(r => ({
      reason: r.reason,
      count: parseInt(r.count) || 0,
      totalQty: parseFloat(r.total_qty) || 0
    }))

    // Get warehouses for filter
    const warehousesResult = await db.query(`
      SELECT DISTINCT mw.id, mw.name, mw.code
      FROM market_warehouses mw
      JOIN market_warehouse_operations mwo ON mwo.source_warehouse_id = mw.id
      WHERE mw.company_id = $1 AND mwo.operation_type IN ('adjustment', 'scrap')
      ORDER BY mw.name
    `, [companyId])

    return NextResponse.json({
      success: true,
      data: {
        operations: result.rows.map(row => ({
          id: row.id,
          operationNumber: row.operation_number,
          operationType: row.operation_type,
          status: row.status,
          warehouse: row.warehouse_id ? {
            id: row.warehouse_id,
            name: row.warehouse_name,
            code: row.warehouse_code
          } : null,
          notes: row.notes,
          internalNotes: row.internal_notes,
          linesCount: parseInt(row.lines_count) || 0,
          totalQuantity: parseFloat(row.total_quantity) || 0,
          totalValue: parseFloat(row.total_value) || 0,
          createdByName: row.created_by_name,
          completedByName: row.completed_by_name,
          createdAt: row.created_at,
          completedAt: row.completed_at,
          lines: linesMap[row.id] || []
        })),
        stats,
        reasonDistribution,
        warehouses: warehousesResult.rows.map(r => ({
          id: r.id,
          name: r.name,
          code: r.code
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('[Adjustments History API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener historial'
    }, { status: 500 })
  }
}
