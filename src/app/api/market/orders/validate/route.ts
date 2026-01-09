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

/**
 * POST /api/market/orders/validate
 * Approve or reject an order (purchase or consignment)
 * Only MARKET_MANAGER can access this endpoint
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
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    // Only MARKET_MANAGER can validate orders
    if (payload.role !== 'MARKET_MANAGER') {
      return NextResponse.json({
        success: false,
        error: 'Solo los managers pueden validar órdenes'
      }, { status: 403 })
    }

    const body = await request.json()
    const { orderId, orderType, action, reason } = body as {
      orderId: number
      orderType: 'purchase' | 'consignment'
      action: 'approve' | 'reject'
      reason?: string
    }

    // Validate required fields
    if (!orderId || !orderType || !action) {
      return NextResponse.json({
        success: false,
        error: 'orderId, orderType y action son requeridos'
      }, { status: 400 })
    }

    if (!['purchase', 'consignment'].includes(orderType)) {
      return NextResponse.json({
        success: false,
        error: 'orderType debe ser "purchase" o "consignment"'
      }, { status: 400 })
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({
        success: false,
        error: 'action debe ser "approve" o "reject"'
      }, { status: 400 })
    }

    // Reject requires a reason
    if (action === 'reject' && !reason) {
      return NextResponse.json({
        success: false,
        error: 'El motivo de rechazo es obligatorio'
      }, { status: 400 })
    }

    const tableName = orderType === 'purchase' ? 'market_purchases' : 'consignment_orders'
    const orderNumberField = orderType === 'purchase' ? 'purchase_number' : 'order_number'

    // Verify order exists and belongs to company
    const orderCheck = await db.query(`
      SELECT id, ${orderNumberField} as order_number, validation_status, status
      FROM ${tableName}
      WHERE id = $1 AND company_id = $2
    `, [orderId, payload.companyId])

    if (orderCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderCheck.rows[0]

    // Check if order is pending validation
    if (order.validation_status !== 'pending_validation') {
      return NextResponse.json({
        success: false,
        error: `Esta orden ya fue ${order.validation_status === 'confirmed' ? 'aprobada' : 'procesada'}`
      }, { status: 400 })
    }

    // Determine new validation status
    const newValidationStatus = action === 'approve' ? 'confirmed' : 'rejected'

    // Update the order
    if (action === 'approve') {
      await db.query(`
        UPDATE ${tableName}
        SET validation_status = $1,
            validated_by = $2,
            validated_at = NOW(),
            rejection_reason = NULL,
            updated_at = NOW()
        WHERE id = $3
      `, [newValidationStatus, payload.userId, orderId])
    } else {
      await db.query(`
        UPDATE ${tableName}
        SET validation_status = $1,
            validated_by = $2,
            validated_at = NOW(),
            rejection_reason = $3,
            updated_at = NOW()
        WHERE id = $4
      `, [newValidationStatus, payload.userId, reason, orderId])
    }

    const actionMessage = action === 'approve' ? 'aprobada' : 'rechazada'

    return NextResponse.json({
      success: true,
      message: `Orden ${order.order_number} ${actionMessage} exitosamente`,
      data: {
        orderId,
        orderNumber: order.order_number,
        orderType,
        validationStatus: newValidationStatus,
        validatedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('[Order Validate API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al validar orden'
    }, { status: 500 })
  }
}

/**
 * GET /api/market/orders/validate
 * Get orders pending validation (for managers)
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

    // Only MARKET_MANAGER can view pending orders
    if (payload.role !== 'MARKET_MANAGER') {
      return NextResponse.json({
        success: false,
        error: 'Solo los managers pueden ver órdenes pendientes de validación'
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const orderType = searchParams.get('type') || 'all' // 'purchase', 'consignment', 'all'

    const pendingOrders: Array<{
      id: number
      orderNumber: string
      type: 'purchase' | 'consignment'
      supplierName: string
      totalAmount: number
      createdBy: string
      createdAt: string
    }> = []

    // Get pending purchases
    if (orderType === 'all' || orderType === 'purchase') {
      const purchases = await db.query(`
        SELECT
          mp.id,
          mp.purchase_number as order_number,
          mp.supplier_name,
          mp.total_amount,
          COALESCE(u.firstname || ' ' || u.lastname, u.email) as created_by_name,
          mp.created_at
        FROM market_purchases mp
        LEFT JOIN users u ON mp.created_by = u.id
        WHERE mp.company_id = $1 AND mp.validation_status = 'pending_validation'
        ORDER BY mp.created_at DESC
      `, [payload.companyId])

      for (const row of purchases.rows) {
        pendingOrders.push({
          id: row.id,
          orderNumber: row.order_number,
          type: 'purchase',
          supplierName: row.supplier_name,
          totalAmount: parseFloat(row.total_amount) || 0,
          createdBy: row.created_by_name || 'Desconocido',
          createdAt: row.created_at
        })
      }
    }

    // Get pending consignments
    if (orderType === 'all' || orderType === 'consignment') {
      const consignments = await db.query(`
        SELECT
          co.id,
          co.order_number,
          s.name as supplier_name,
          co.total_cost,
          COALESCE(u.firstname || ' ' || u.lastname, u.email) as created_by_name,
          co.created_at
        FROM consignment_orders co
        LEFT JOIN market_suppliers s ON co.supplier_id = s.id
        LEFT JOIN users u ON co.created_by = u.id
        WHERE co.company_id = $1 AND co.validation_status = 'pending_validation'
        ORDER BY co.created_at DESC
      `, [payload.companyId])

      for (const row of consignments.rows) {
        pendingOrders.push({
          id: row.id,
          orderNumber: row.order_number,
          type: 'consignment',
          supplierName: row.supplier_name || 'Sin proveedor',
          totalAmount: parseFloat(row.total_cost) || 0,
          createdBy: row.created_by_name || 'Desconocido',
          createdAt: row.created_at
        })
      }
    }

    // Sort by created_at descending
    pendingOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({
      success: true,
      data: {
        orders: pendingOrders,
        total: pendingOrders.length
      }
    })

  } catch (error) {
    console.error('[Order Validate API] GET Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener órdenes pendientes'
    }, { status: 500 })
  }
}
