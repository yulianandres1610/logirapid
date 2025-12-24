import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

interface ConsignmentItem {
  productId: number
  quantity: number
  providerCost: number
  providerPrice: number
  suggestedRetailPrice?: number
}

interface CreateConsignmentRequest {
  receiverCompanyId: number
  providerWarehouseId: number
  scheduledDeliveryDate?: string
  providerNotes?: string
  items: ConsignmentItem[]
  submitForApproval?: boolean
}

/**
 * GET /api/consignments/orders
 * List consignment orders for the current company (as provider or receiver)
 *
 * Query params:
 * - role: 'provider' | 'receiver' | 'all' (default: 'all')
 * - status: filter by status
 * - page: pagination
 * - limit: items per page
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const companyIdCookie = cookieStore.get('user-company-id')
    const currentCompanyId = companyIdCookie?.value

    if (!currentCompanyId) {
      return NextResponse.json({
        success: false,
        error: 'No autenticado'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role') || 'all'
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build WHERE clause based on role
    let whereClause = ''
    const params: (string | number)[] = []
    let paramIndex = 1

    if (role === 'provider') {
      whereClause = `WHERE co.provider_company_id = $${paramIndex++}`
      params.push(currentCompanyId)
    } else if (role === 'receiver') {
      whereClause = `WHERE co.receiver_company_id = $${paramIndex++}`
      params.push(currentCompanyId)
    } else {
      whereClause = `WHERE (co.provider_company_id = $${paramIndex++} OR co.receiver_company_id = $${paramIndex++})`
      params.push(currentCompanyId, currentCompanyId)
    }

    if (status) {
      whereClause += ` AND co.status = $${paramIndex++}`
      params.push(status)
    }

    // Get total count
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM consignment_orders co
      ${whereClause}
    `, params)

    // Get orders with details
    const result = await db.query(`
      SELECT
        co.*,
        provider.legalname as provider_name,
        provider.phone as provider_phone,
        provider.logo_url as provider_logo,
        receiver.legalname as receiver_name,
        receiver.phone as receiver_phone,
        receiver.logo_url as receiver_logo,
        pw.name as provider_warehouse_name,
        rw.name as receiver_warehouse_name,
        COALESCE(creator.firstname || ' ' || creator.lastname, creator.email) as created_by_name,
        (
          SELECT COUNT(*)
          FROM consignment_order_items coi
          WHERE coi.consignment_order_id = co.id
        ) as item_count
      FROM consignment_orders co
      LEFT JOIN companies provider ON provider.id = co.provider_company_id
      LEFT JOIN companies receiver ON receiver.id = co.receiver_company_id
      LEFT JOIN market_warehouses pw ON pw.id = co.provider_warehouse_id
      LEFT JOIN market_warehouses rw ON rw.id = co.receiver_warehouse_id
      LEFT JOIN users creator ON creator.id = co.created_by
      ${whereClause}
      ORDER BY co.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `, [...params, limit, offset])

    const total = parseInt(countResult.rows[0]?.total) || 0

    return NextResponse.json({
      success: true,
      data: {
        orders: result.rows.map(row => ({
          id: row.id,
          orderNumber: row.order_number,
          status: row.status,
          provider: {
            id: row.provider_company_id,
            name: row.provider_name,
            phone: row.provider_phone,
            logoUrl: row.provider_logo
          },
          receiver: {
            id: row.receiver_company_id,
            name: row.receiver_name,
            phone: row.receiver_phone,
            logoUrl: row.receiver_logo
          },
          providerWarehouse: row.provider_warehouse_name,
          receiverWarehouse: row.receiver_warehouse_name,
          scheduledDeliveryDate: row.scheduled_delivery_date,
          actualDeliveryDate: row.actual_delivery_date,
          subtotal: parseFloat(row.subtotal) || 0,
          totalItems: row.total_items,
          totalUnits: row.total_units,
          itemCount: parseInt(row.item_count) || 0,
          providerNotes: row.provider_notes,
          receiverNotes: row.receiver_notes,
          rejectionReason: row.rejection_reason,
          createdBy: row.created_by_name,
          createdAt: row.created_at,
          approvedAt: row.approved_at,
          receivedAt: row.received_at,
          isProvider: String(row.provider_company_id) === String(currentCompanyId),
          isReceiver: String(row.receiver_company_id) === String(currentCompanyId)
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
    console.error('[Consignment Orders GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener consignaciones'
    }, { status: 500 })
  }
}

/**
 * POST /api/consignments/orders
 * Create a new consignment order
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const companyIdCookie = cookieStore.get('user-company-id')
    const userIdCookie = cookieStore.get('user-id')
    const currentCompanyId = companyIdCookie?.value
    const userId = userIdCookie?.value

    if (!currentCompanyId) {
      return NextResponse.json({
        success: false,
        error: 'No autenticado'
      }, { status: 401 })
    }

    const body: CreateConsignmentRequest = await request.json()
    const {
      receiverCompanyId,
      providerWarehouseId,
      scheduledDeliveryDate,
      providerNotes,
      items,
      submitForApproval = false
    } = body

    // Validations
    if (!receiverCompanyId) {
      return NextResponse.json({
        success: false,
        error: 'Debe seleccionar un mercado receptor'
      }, { status: 400 })
    }

    if (!providerWarehouseId) {
      return NextResponse.json({
        success: false,
        error: 'Debe seleccionar un almacén de origen'
      }, { status: 400 })
    }

    if (!items || items.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Debe agregar al menos un producto'
      }, { status: 400 })
    }

    // Verify receiver company exists and is a market
    const receiverCheck = await db.query(`
      SELECT id, legalname as name FROM companies
      WHERE id = $1 AND companytype = 'market' AND status = 'active'
    `, [receiverCompanyId])

    if (receiverCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'El mercado receptor no existe o no está activo'
      }, { status: 400 })
    }

    // Verify warehouse belongs to current company
    const warehouseCheck = await db.query(`
      SELECT id, name FROM market_warehouses
      WHERE id = $1 AND company_id = $2
    `, [providerWarehouseId, currentCompanyId])

    if (warehouseCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'El almacén seleccionado no pertenece a su empresa'
      }, { status: 400 })
    }

    // Generate order number
    const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '')
    const countResult = await db.query(`
      SELECT COUNT(*) as count FROM consignment_orders
      WHERE order_number LIKE $1
    `, [`CONS-${yearMonth}%`])
    const count = parseInt(countResult.rows[0].count) + 1
    const orderNumber = `CONS-${yearMonth}-${String(count).padStart(4, '0')}`

    // Calculate totals
    let subtotal = 0
    let totalUnits = 0
    for (const item of items) {
      subtotal += item.quantity * item.providerPrice
      totalUnits += item.quantity
    }

    const status = submitForApproval ? 'pending_approval' : 'draft'

    // Start transaction
    await db.query('BEGIN')

    try {
      // Create order
      const orderResult = await db.query(`
        INSERT INTO consignment_orders (
          order_number,
          provider_company_id,
          receiver_company_id,
          provider_warehouse_id,
          status,
          scheduled_delivery_date,
          subtotal,
          total_items,
          total_units,
          provider_notes,
          created_by,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING id
      `, [
        orderNumber,
        currentCompanyId,
        receiverCompanyId,
        providerWarehouseId,
        status,
        scheduledDeliveryDate || null,
        subtotal,
        items.length,
        totalUnits,
        providerNotes || null,
        userId || null
      ])

      const orderId = orderResult.rows[0].id

      // Insert items
      for (const item of items) {
        const itemSubtotal = item.quantity * item.providerPrice

        await db.query(`
          INSERT INTO consignment_order_items (
            consignment_order_id,
            product_id,
            quantity,
            provider_cost,
            provider_price,
            suggested_retail_price,
            subtotal
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          orderId,
          item.productId,
          item.quantity,
          item.providerCost,
          item.providerPrice,
          item.suggestedRetailPrice || null,
          itemSubtotal
        ])
      }

      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        data: {
          id: orderId,
          orderNumber,
          status,
          subtotal,
          totalItems: items.length,
          totalUnits,
          receiverName: receiverCheck.rows[0].name
        },
        message: submitForApproval
          ? 'Consignación enviada para aprobación'
          : 'Borrador de consignación creado'
      })

    } catch (txError) {
      await db.query('ROLLBACK')
      throw txError
    }

  } catch (error) {
    console.error('[Consignment Orders POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear consignación'
    }, { status: 500 })
  }
}
