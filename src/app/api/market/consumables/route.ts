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
 * GET /api/market/consumables
 * List consumable items with filters and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const warehouseId = searchParams.get('warehouseId')
    const status = searchParams.get('status')

    const offset = (page - 1) * limit

    // Build WHERE conditions
    const conditions: string[] = []
    const params: (string | number)[] = []
    let paramIndex = 1

    if (payload.role !== 'SUPER_ADMIN') {
      conditions.push(`i.company_id = $${paramIndex}`)
      params.push(payload.companyId)
      paramIndex++
    }

    if (search) {
      conditions.push(`(i.name ILIKE $${paramIndex} OR i.code ILIKE $${paramIndex})`)
      params.push(`%${search}%`)
      paramIndex++
    }

    if (category) {
      conditions.push(`i.category = $${paramIndex}`)
      params.push(category)
      paramIndex++
    }

    if (warehouseId) {
      conditions.push(`i.warehouse_id = $${paramIndex}`)
      params.push(parseInt(warehouseId))
      paramIndex++
    }

    if (status) {
      conditions.push(`i.status = $${paramIndex}`)
      params.push(status)
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Count total
    const countResult = await db.query(`
      SELECT COUNT(*) as total FROM market_consumable_items i ${whereClause}
    `, params)
    const total = parseInt(countResult.rows[0].total)

    // Stats
    const statsConditions = payload.role !== 'SUPER_ADMIN' ? 'WHERE company_id = $1' : ''
    const statsParams = payload.role !== 'SUPER_ADMIN' ? [payload.companyId] : []

    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total_items,
        COUNT(*) FILTER (WHERE current_stock <= min_stock AND status = 'active') as low_stock_count
      FROM market_consumable_items
      ${statsConditions}
    `, statsParams)

    // Dispatches this month
    let dispatchCount = 0
    try {
      const dispatchResult = await db.query(`
        SELECT COUNT(*) as cnt
        FROM market_consumable_movements
        WHERE movement_type = 'dispatch'
        AND created_at >= date_trunc('month', CURRENT_DATE)
        ${payload.role !== 'SUPER_ADMIN' ? 'AND company_id = $1' : ''}
      `, payload.role !== 'SUPER_ADMIN' ? [payload.companyId] : [])
      dispatchCount = parseInt(dispatchResult.rows[0].cnt) || 0
    } catch { /* table may not exist yet */ }

    // Get items with joins
    const itemsResult = await db.query(`
      SELECT
        i.*,
        w.name as warehouse_name,
        u.firstname || ' ' || u.lastname as created_by_name
      FROM market_consumable_items i
      LEFT JOIN market_warehouses w ON i.warehouse_id = w.id
      LEFT JOIN users u ON i.created_by = u.id
      ${whereClause}
      ORDER BY i.name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset])

    const items = itemsResult.rows.map(row => ({
      id: row.id,
      companyId: row.company_id,
      name: row.name,
      code: row.code,
      description: row.description,
      category: row.category,
      unit: row.unit,
      currentStock: parseFloat(row.current_stock) || 0,
      minStock: parseFloat(row.min_stock) || 0,
      warehouseId: row.warehouse_id,
      warehouseName: row.warehouse_name,
      imageUrl: row.image_url,
      status: row.status,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        stats: {
          totalItems: parseInt(statsResult.rows[0].total_items) || 0,
          lowStock: parseInt(statsResult.rows[0].low_stock_count) || 0,
          dispatchesThisMonth: dispatchCount
        }
      }
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Consumables GET] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error al obtener consumibles'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/consumables
 * Create a new consumable item
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      code,
      description,
      category,
      unit = 'unidad',
      minStock = 0,
      warehouseId,
      imageUrl
    } = body

    if (!name) {
      return NextResponse.json({
        success: false,
        error: 'El nombre del consumible es requerido'
      }, { status: 400 })
    }

    // Auto-generate code if not provided
    let itemCode = code
    if (!itemCode) {
      const seqResult = await db.query(`
        SELECT COALESCE(MAX(
          CAST(SUBSTRING(code FROM 'CON-([0-9]+)') AS INTEGER)
        ), 0) + 1 as next_seq
        FROM market_consumable_items
        WHERE company_id = $1
        AND code LIKE 'CON-%'
      `, [payload.companyId])
      const nextSeq = seqResult.rows[0].next_seq || 1
      itemCode = `CON-${String(nextSeq).padStart(4, '0')}`
    }

    const insertResult = await db.query(`
      INSERT INTO market_consumable_items (
        company_id, name, code, description, category, unit,
        current_stock, min_stock, warehouse_id, image_url, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        0, $7, $8, $9, $10
      )
      RETURNING *
    `, [
      payload.companyId,
      name,
      itemCode,
      description || null,
      category || null,
      unit,
      minStock,
      warehouseId || null,
      imageUrl || null,
      payload.userId
    ])

    const item = insertResult.rows[0]

    return NextResponse.json({
      success: true,
      message: 'Consumible creado exitosamente',
      data: {
        id: item.id,
        companyId: item.company_id,
        name: item.name,
        code: item.code,
        description: item.description,
        category: item.category,
        unit: item.unit,
        currentStock: 0,
        minStock: parseFloat(item.min_stock) || 0,
        warehouseId: item.warehouse_id,
        status: item.status,
        createdAt: item.created_at
      }
    }, { status: 201 })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Consumables POST] Error:', err)
    if (err.message?.includes('unique') || err.message?.includes('duplicate')) {
      return NextResponse.json({
        success: false,
        error: 'Ya existe un consumible con ese código'
      }, { status: 409 })
    }
    return NextResponse.json({
      success: false,
      error: err.message || 'Error al crear consumible'
    }, { status: 500 })
  }
}
