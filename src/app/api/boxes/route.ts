import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * Helper to generate tracking code
 */
async function generateTrackingCode(companyId: number, client: typeof db = db): Promise<string> {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const seqResult = await client.query("SELECT NEXTVAL('box_tracking_code_seq') as seq")
  const seq = seqResult.rows[0].seq
  return `BOX-${String(companyId).padStart(4, '0')}-${date}-${String(seq).padStart(6, '0')}`
}

/**
 * GET /api/boxes
 * List boxes with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { companyId, isSuperAdmin } = getCompanyFilter(request)
    const { searchParams } = new URL(request.url)

    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const customerId = searchParams.get('customerId')
    const productId = searchParams.get('productId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const offset = (page - 1) * limit

    const conditions: string[] = []
    const params: any[] = []

    // Company filter
    if (!isSuperAdmin && companyId) {
      params.push(companyId)
      conditions.push(`bt.company_id = $${params.length}`)
    }

    // Search by tracking code or customer name
    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(bt.tracking_code ILIKE $${params.length} OR bt.customer_name ILIKE $${params.length})`)
    }

    // Status filter
    if (status) {
      params.push(status)
      conditions.push(`bt.current_status = $${params.length}`)
    }

    // Customer filter
    if (customerId) {
      params.push(parseInt(customerId))
      conditions.push(`bt.customer_id = $${params.length}`)
    }

    // Product filter
    if (productId) {
      params.push(parseInt(productId))
      conditions.push(`bt.product_id = $${params.length}`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Count query
    const countQuery = `SELECT COUNT(*) as total FROM box_tracking bt ${whereClause}`
    const countResult = await db.query(countQuery, params)
    const total = parseInt(countResult.rows[0].total)

    // Data query
    const dataParams = [...params, limit, offset]
    const dataQuery = `
      SELECT
        bt.*,
        c.legalname as company_name,
        pc.name as product_name_ref,
        w.name as warehouse_name,
        (SELECT COUNT(*) FROM service_sales ss WHERE ss.box_tracking_id = bt.id) as services_sold
      FROM box_tracking bt
      LEFT JOIN companies c ON bt.company_id = c.id
      LEFT JOIN product_catalog pc ON bt.product_id = pc.id
      LEFT JOIN warehouses w ON bt.warehouse_id = w.id
      ${whereClause}
      ORDER BY bt.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `

    const dataResult = await db.query(dataQuery, dataParams)

    const boxes = dataResult.rows.map(row => ({
      id: row.id,
      trackingCode: row.tracking_code,
      productId: row.product_id,
      productName: row.product_name || row.product_name_ref,
      companyId: row.company_id,
      companyName: row.company_name,
      customerId: row.customer_id,
      customerName: row.customer_name,
      boxType: row.box_type,
      boxDimensions: row.box_dimensions,
      currentStatus: row.current_status,
      currentLocation: row.current_location,
      warehouseId: row.warehouse_id,
      warehouseName: row.warehouse_name,
      weightLb: row.weight_lb ? parseFloat(row.weight_lb) : null,
      weightKg: row.weight_kg ? parseFloat(row.weight_kg) : null,
      servicesSold: parseInt(row.services_sold) || 0,
      createdAt: row.created_at,
      boxDeliveredAt: row.box_delivered_at,
      confeccionadaAt: row.confeccionada_at,
      recogidaAt: row.recogida_at,
      entregadaAt: row.entregada_at,
      notes: row.notes
    }))

    return NextResponse.json({
      success: true,
      data: {
        boxes,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('❌ [Error] GET /api/boxes:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener cajas',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * POST /api/boxes
 * Create a new box tracking record
 */
export async function POST(request: NextRequest) {
  try {
    const { companyId, userId } = getCompanyFilter(request)

    if (!companyId) {
      return NextResponse.json({
        success: false,
        error: 'Company ID requerido'
      }, { status: 400 })
    }

    const body = await request.json()
    const {
      productId,
      customerId,
      customerName,
      boxType,
      boxDimensions,
      weightLb,
      weightKg,
      warehouseId,
      notes
    } = body

    if (!productId) {
      return NextResponse.json({
        success: false,
        error: 'ID de producto es requerido'
      }, { status: 400 })
    }

    // Verify product exists
    const productResult = await db.query(
      'SELECT id, name, has_box_tracking FROM product_catalog WHERE id = $1',
      [productId]
    )

    if (productResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Producto no encontrado'
      }, { status: 404 })
    }

    const product = productResult.rows[0]

    // Generate tracking code
    const trackingCode = await generateTrackingCode(companyId)

    // Create box tracking record
    const result = await db.query(`
      INSERT INTO box_tracking (
        tracking_code, product_id, product_name, company_id,
        customer_id, customer_name, box_type, box_dimensions,
        current_status, warehouse_id, weight_lb, weight_kg,
        created_by_user_id, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'created', $9, $10, $11, $12, $13, NOW(), NOW())
      RETURNING *
    `, [
      trackingCode, productId, product.name, companyId,
      customerId || null, customerName || null, boxType || null, boxDimensions || null,
      warehouseId || null, weightLb || null, weightKg || null,
      userId || null, notes || null
    ])

    const box = result.rows[0]

    // Record initial history
    await db.query(`
      INSERT INTO box_tracking_history (
        box_tracking_id, previous_status, new_status,
        changed_by_user_id, changed_at, notes
      ) VALUES ($1, NULL, 'created', $2, NOW(), 'Caja creada')
    `, [box.id, userId || null])

    return NextResponse.json({
      success: true,
      message: 'Caja creada exitosamente',
      data: {
        id: box.id,
        trackingCode: box.tracking_code,
        productId: box.product_id,
        productName: box.product_name,
        companyId: box.company_id,
        customerId: box.customer_id,
        customerName: box.customer_name,
        currentStatus: box.current_status,
        createdAt: box.created_at
      }
    }, { status: 201 })

  } catch (error) {
    console.error('❌ [Error] POST /api/boxes:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al crear caja',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * PATCH /api/boxes
 * Update box status (requires trackingCode or id in body)
 */
export async function PATCH(request: NextRequest) {
  try {
    const { companyId, isSuperAdmin, userId, userRole } = getCompanyFilter(request)
    const { searchParams } = new URL(request.url)

    const body = await request.json()
    const {
      trackingCode,
      boxId,
      newStatus,
      location,
      warehouseId,
      notes,
      weightLb,
      weightKg
    } = body

    if (!trackingCode && !boxId) {
      return NextResponse.json({
        success: false,
        error: 'Código de tracking o ID de caja requerido'
      }, { status: 400 })
    }

    // Find the box
    let boxQuery = 'SELECT * FROM box_tracking WHERE '
    let boxParams: any[] = []

    if (trackingCode) {
      boxQuery += 'tracking_code = $1'
      boxParams.push(trackingCode)
    } else {
      boxQuery += 'id = $1'
      boxParams.push(boxId)
    }

    if (!isSuperAdmin && companyId) {
      boxQuery += ' AND company_id = $2'
      boxParams.push(companyId)
    }

    const boxResult = await db.query(boxQuery, boxParams)

    if (boxResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Caja no encontrada'
      }, { status: 404 })
    }

    const box = boxResult.rows[0]
    const previousStatus = box.current_status

    // Build update fields
    const updates: string[] = ['updated_at = NOW()']
    const updateParams: any[] = []
    let paramIndex = 1

    if (newStatus) {
      updates.push(`current_status = $${paramIndex}`)
      updateParams.push(newStatus)
      paramIndex++

      // Update timestamp fields based on status
      if (newStatus === 'caja_entregada') {
        updates.push('box_delivered_at = NOW()')
      } else if (newStatus === 'confeccionada') {
        updates.push('confeccionada_at = NOW()')
      } else if (newStatus === 'recogida') {
        updates.push('recogida_at = NOW()')
      } else if (newStatus === 'entregada_destino') {
        updates.push('entregada_at = NOW()')
      }
    }

    if (location !== undefined) {
      updates.push(`current_location = $${paramIndex}`)
      updateParams.push(location)
      paramIndex++
    }

    if (warehouseId !== undefined) {
      updates.push(`warehouse_id = $${paramIndex}`)
      updateParams.push(warehouseId)
      paramIndex++
    }

    if (weightLb !== undefined) {
      updates.push(`weight_lb = $${paramIndex}`)
      updateParams.push(weightLb)
      paramIndex++
    }

    if (weightKg !== undefined) {
      updates.push(`weight_kg = $${paramIndex}`)
      updateParams.push(weightKg)
      paramIndex++
    }

    // Update box
    updateParams.push(box.id)
    const updateQuery = `
      UPDATE box_tracking
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    const updateResult = await db.query(updateQuery, updateParams)
    const updatedBox = updateResult.rows[0]

    // Record history if status changed
    if (newStatus && newStatus !== previousStatus) {
      await db.query(`
        INSERT INTO box_tracking_history (
          box_tracking_id, previous_status, new_status,
          location, warehouse_id, changed_by_user_id, changed_at, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
      `, [
        box.id, previousStatus, newStatus,
        location || null, warehouseId || null,
        userId || null, notes || null
      ])
    }

    return NextResponse.json({
      success: true,
      message: 'Caja actualizada exitosamente',
      data: {
        id: updatedBox.id,
        trackingCode: updatedBox.tracking_code,
        previousStatus,
        currentStatus: updatedBox.current_status,
        location: updatedBox.current_location,
        warehouseId: updatedBox.warehouse_id,
        updatedAt: updatedBox.updated_at
      }
    })

  } catch (error) {
    console.error('❌ [Error] PATCH /api/boxes:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar caja',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
