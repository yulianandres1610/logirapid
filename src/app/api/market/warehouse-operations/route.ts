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
 * GET /api/market/warehouse-operations
 * List warehouse operations (transfers, receptions, picking, scrap)
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
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const companyId = payload.companyId
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'transfer', 'reception', 'picking', 'scrap', 'adjustment'
    const status = searchParams.get('status')
    const warehouseId = searchParams.get('warehouseId')
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let query = `
      SELECT
        mwo.*,
        sw.name as source_warehouse_name,
        sw.code as source_warehouse_code,
        dw.name as destination_warehouse_name,
        dw.code as destination_warehouse_code,
        creator.email as created_by_email,
        confirmer.email as confirmed_by_email,
        completer.email as completed_by_email,
        (SELECT COUNT(*) FROM market_warehouse_operation_lines WHERE operation_id = mwo.id) as lines_count,
        (SELECT COALESCE(SUM(quantity_planned), 0) FROM market_warehouse_operation_lines WHERE operation_id = mwo.id) as total_planned,
        (SELECT COALESCE(SUM(quantity_done), 0) FROM market_warehouse_operation_lines WHERE operation_id = mwo.id) as total_done
      FROM market_warehouse_operations mwo
      LEFT JOIN market_warehouses sw ON mwo.source_warehouse_id = sw.id
      LEFT JOIN market_warehouses dw ON mwo.destination_warehouse_id = dw.id
      LEFT JOIN users creator ON mwo.created_by = creator.id
      LEFT JOIN users confirmer ON mwo.confirmed_by = confirmer.id
      LEFT JOIN users completer ON mwo.completed_by = completer.id
      WHERE mwo.company_id = $1
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
      query += ` AND (mwo.source_warehouse_id = $${paramIndex} OR mwo.destination_warehouse_id = $${paramIndex})`
      queryParams.push(parseInt(warehouseId))
      paramIndex++
    }

    if (search) {
      query += ` AND LOWER(mwo.operation_number) LIKE $${paramIndex}`
      queryParams.push(`%${search.toLowerCase()}%`)
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

    // Get stats
    const statsResult = await db.query(`
      SELECT
        operation_type,
        status,
        COUNT(*) as count
      FROM market_warehouse_operations
      WHERE company_id = $1
      GROUP BY operation_type, status
    `, [companyId])

    const stats: Record<string, Record<string, number>> = {
      transfer: { draft: 0, confirmed: 0, in_progress: 0, done: 0, cancelled: 0 },
      reception: { draft: 0, confirmed: 0, in_progress: 0, done: 0, cancelled: 0 },
      picking: { draft: 0, confirmed: 0, in_progress: 0, done: 0, cancelled: 0 },
      scrap: { draft: 0, confirmed: 0, done: 0, cancelled: 0 },
      adjustment: { draft: 0, done: 0, cancelled: 0 }
    }

    for (const row of statsResult.rows) {
      if (stats[row.operation_type]) {
        stats[row.operation_type][row.status] = parseInt(row.count) || 0
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        operations: result.rows.map(row => ({
          id: row.id,
          operationNumber: row.operation_number,
          operationType: row.operation_type,
          sourceWarehouse: row.source_warehouse_id ? {
            id: row.source_warehouse_id,
            name: row.source_warehouse_name,
            code: row.source_warehouse_code
          } : null,
          destinationWarehouse: row.destination_warehouse_id ? {
            id: row.destination_warehouse_id,
            name: row.destination_warehouse_name,
            code: row.destination_warehouse_code
          } : null,
          referenceType: row.reference_type,
          referenceId: row.reference_id,
          status: row.status,
          scheduledDate: row.scheduled_date,
          startedAt: row.started_at,
          completedAt: row.completed_at,
          notes: row.notes,
          internalNotes: row.internal_notes,
          linesCount: parseInt(row.lines_count) || 0,
          totalPlanned: parseInt(row.total_planned) || 0,
          totalDone: parseInt(row.total_done) || 0,
          createdBy: row.created_by_email,
          confirmedBy: row.confirmed_by_email,
          completedBy: row.completed_by_email,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        })),
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
    console.error('[Warehouse Operations API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener operaciones'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/warehouse-operations
 * Create a new warehouse operation
 */
export async function POST(request: NextRequest) {
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
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const companyId = payload.companyId
    const userId = payload.userId

    const body = await request.json()
    const {
      operationType,
      sourceWarehouseId,
      destinationWarehouseId,
      referenceType,
      referenceId,
      scheduledDate,
      notes,
      internalNotes,
      lines = []
    } = body

    // Validate operation type
    const validTypes = ['transfer', 'reception', 'picking', 'scrap', 'adjustment']
    if (!validTypes.includes(operationType)) {
      return NextResponse.json({
        success: false,
        error: 'Tipo de operación no válido'
      }, { status: 400 })
    }

    // Validate warehouses based on operation type
    if (operationType === 'transfer') {
      if (!sourceWarehouseId || !destinationWarehouseId) {
        return NextResponse.json({
          success: false,
          error: 'Las transferencias requieren almacén origen y destino'
        }, { status: 400 })
      }
      if (sourceWarehouseId === destinationWarehouseId) {
        return NextResponse.json({
          success: false,
          error: 'El almacén origen y destino deben ser diferentes'
        }, { status: 400 })
      }
    }

    if (operationType === 'reception' && !destinationWarehouseId) {
      return NextResponse.json({
        success: false,
        error: 'Las recepciones requieren almacén destino'
      }, { status: 400 })
    }

    if ((operationType === 'picking' || operationType === 'scrap') && !sourceWarehouseId) {
      return NextResponse.json({
        success: false,
        error: 'Esta operación requiere almacén origen'
      }, { status: 400 })
    }

    // Generate operation number
    const typePrefix = {
      transfer: 'TRF',
      reception: 'RCP',
      picking: 'PCK',
      scrap: 'SCR',
      adjustment: 'ADJ'
    }[operationType]

    const year = new Date().getFullYear()
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM market_warehouse_operations WHERE company_id = $1 AND operation_type = $2 AND EXTRACT(YEAR FROM created_at) = $3`,
      [companyId, operationType, year]
    )
    const sequenceNumber = (parseInt(countResult.rows[0]?.count) || 0) + 1
    const operationNumber = `${typePrefix}-${year}-${sequenceNumber.toString().padStart(4, '0')}`

    // Create operation
    const result = await db.query(`
      INSERT INTO market_warehouse_operations (
        company_id, operation_number, operation_type,
        source_warehouse_id, destination_warehouse_id,
        reference_type, reference_id,
        status, scheduled_date, notes, internal_notes,
        created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9, $10, $11, NOW(), NOW()
      ) RETURNING id
    `, [
      companyId, operationNumber, operationType,
      sourceWarehouseId || null, destinationWarehouseId || null,
      referenceType || null, referenceId || null,
      scheduledDate || null, notes || null, internalNotes || null,
      userId
    ])

    const operationId = result.rows[0].id

    // Add lines if provided
    if (lines.length > 0) {
      for (const line of lines) {
        await db.query(`
          INSERT INTO market_warehouse_operation_lines (
            operation_id, product_id, variant_id,
            quantity_planned, quantity_done,
            source_location, destination_location,
            scrap_reason, line_status, created_at
          ) VALUES ($1, $2, $3, $4, 0, $5, $6, $7, 'pending', NOW())
        `, [
          operationId,
          line.productId,
          line.variantId || null,
          line.quantityPlanned || 0,
          line.sourceLocation || null,
          line.destinationLocation || null,
          line.scrapReason || null
        ])
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: operationId,
        operationNumber
      },
      message: 'Operación creada exitosamente'
    })

  } catch (error) {
    console.error('[Warehouse Operations API] Error creating operation:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear operación'
    }, { status: 500 })
  }
}
