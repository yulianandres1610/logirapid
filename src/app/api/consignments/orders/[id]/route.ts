import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

// Ensure validation columns exist
async function ensureColumns() {
  try {
    await db.query(`ALTER TABLE consignment_orders ADD COLUMN IF NOT EXISTS accepted_by INTEGER REFERENCES users(id)`)
    await db.query(`ALTER TABLE consignment_orders ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE`)
    // Validation columns for rejection workflow
    await db.query(`ALTER TABLE consignment_orders ADD COLUMN IF NOT EXISTS validation_status VARCHAR(50) DEFAULT 'pending_validation'`)
    await db.query(`ALTER TABLE consignment_orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT`)
    await db.query(`ALTER TABLE consignment_orders ADD COLUMN IF NOT EXISTS validated_by INTEGER REFERENCES users(id)`)
    await db.query(`ALTER TABLE consignment_orders ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE`)
  } catch (e) {
    // Columns might already exist, ignore
  }
}
ensureColumns()

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
 * GET /api/consignments/orders/[id]
 * Obtener orden por ID con sus lineas
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
    const orderId = parseInt(id)

    // Get order with supplier and warehouse info
    const orderResult = await db.query(`
      SELECT
        o.*,
        s.supplier_code as supplier_code,
        s.name as supplier_name,
        s.contact_person as supplier_contact,
        s.email as supplier_email,
        s.phone as supplier_phone,
        w.name as warehouse_name,
        w.code as warehouse_code,
        u.firstname || ' ' || u.lastname as created_by_name,
        u.role as created_by_role,
        COALESCE(u2.firstname || ' ' || u2.lastname, u2.email) as accepted_by_name,
        o.accepted_by,
        o.accepted_at,
        o.validation_status,
        o.rejection_reason,
        o.validated_by,
        o.validated_at,
        COALESCE(u3.firstname || ' ' || u3.lastname, u3.email) as validated_by_name,
        COALESCE((
          SELECT SUM(ol.quantity_sold * ol.unit_cost)
          FROM consignment_order_lines ol
          WHERE ol.order_id = o.id
        ), 0) as calculated_total_sold
      FROM consignment_orders o
      JOIN market_suppliers s ON s.id = o.supplier_id
      JOIN market_warehouses w ON w.id = o.warehouse_id
      LEFT JOIN users u ON u.id = o.created_by
      LEFT JOIN users u2 ON u2.id = o.accepted_by
      LEFT JOIN users u3 ON u3.id = o.validated_by
      WHERE o.id = $1 AND o.company_id = $2
    `, [orderId, payload.companyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const o = orderResult.rows[0]

    // Get order lines with product and variant info
    const linesResult = await db.query(`
      SELECT
        ol.id,
        ol.product_id,
        ol.variant_id,
        ol.quantity_ordered,
        ol.quantity_received,
        ol.quantity_sold,
        ol.quantity_returned,
        ol.unit_cost,
        ol.unit_price,
        ol.lot_number,
        ol.expiration_date,
        p.name as product_name,
        p.sku as product_sku,
        p.barcode as product_barcode,
        p.image_url as product_image,
        v.variant_name,
        v.sku as variant_sku
      FROM consignment_order_lines ol
      JOIN market_products p ON p.id = ol.product_id
      LEFT JOIN market_product_variants v ON v.id = ol.variant_id
      WHERE ol.order_id = $1
      ORDER BY ol.id
    `, [orderId])

    // Get completed returns for this order
    const returnsResult = await db.query(`
      SELECT
        r.id,
        r.return_number,
        r.status,
        r.total_units,
        r.total_value,
        r.reason,
        r.validated_at,
        r.created_at,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as validated_by_name
      FROM consignment_returns r
      LEFT JOIN users u ON u.id = r.validated_by
      WHERE r.order_id = $1
      ORDER BY r.created_at DESC
    `, [orderId])

    const order = {
      id: o.id,
      orderNumber: o.order_number,
      supplier: {
        id: o.supplier_id,
        code: o.supplier_code,
        name: o.supplier_name,
        contactName: o.supplier_contact,
        email: o.supplier_email,
        phone: o.supplier_phone
      },
      warehouse: {
        id: o.warehouse_id,
        code: o.warehouse_code,
        name: o.warehouse_name
      },
      status: o.status,
      totalItems: parseInt(o.total_items) || 0,
      totalUnits: parseInt(o.total_units) || 0,
      totalCost: parseFloat(o.total_cost) || 0,
      totalSold: parseFloat(o.calculated_total_sold) || parseFloat(o.total_sold) || 0,
      totalPaid: parseFloat(o.total_paid) || 0,
      totalReturned: parseFloat(o.total_returned) || 0,
      consignmentDate: o.consignment_date,
      receivedAt: o.received_at,
      completedAt: o.completed_at,
      notes: o.notes,
      createdBy: o.created_by_name,
      createdByRole: o.created_by_role || null,
      acceptedByName: o.accepted_by_name || null,
      acceptedAt: o.accepted_at || null,
      needsAcceptance: o.created_by_role === 'MARKET_COMERCIAL' && !o.accepted_by,
      // Validation fields
      validationStatus: o.validation_status || 'pending_validation',
      rejectionReason: o.rejection_reason || null,
      validatedByName: o.validated_by_name || null,
      validatedAt: o.validated_at || null,
      createdAt: o.created_at,
      lines: linesResult.rows.map(l => ({
        id: l.id,
        product: {
          id: l.product_id,
          name: l.product_name,
          sku: l.product_sku,
          barcode: l.product_barcode,
          imageUrl: l.product_image
        },
        variantId: l.variant_id || null,
        variantName: l.variant_name || null,
        variantSku: l.variant_sku || null,
        quantityOrdered: parseInt(l.quantity_ordered) || 0,
        quantityReceived: parseInt(l.quantity_received) || 0,
        quantitySold: parseInt(l.quantity_sold) || 0,
        quantityReturned: parseInt(l.quantity_returned) || 0,
        unitCost: parseFloat(l.unit_cost) || 0,
        unitPrice: parseFloat(l.unit_price) || 0,
        lotNumber: l.lot_number,
        expirationDate: l.expiration_date
      })),
      returns: returnsResult.rows.map(r => ({
        id: r.id,
        returnNumber: r.return_number,
        status: r.status,
        totalUnits: parseInt(r.total_units) || 0,
        totalValue: parseFloat(r.total_value) || 0,
        reason: r.reason,
        validatedAt: r.validated_at,
        validatedByName: r.validated_by_name,
        createdAt: r.created_at
      }))
    }

    return NextResponse.json({
      success: true,
      data: order
    })

  } catch (error) {
    console.error('[Order GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener orden'
    }, { status: 500 })
  }
}

/**
 * PUT /api/consignments/orders/[id]
 * Actualizar estado de orden
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const orderId = parseInt(id)
    const body = await request.json()
    const { status, notes, action } = body

    // Verify order exists
    const existing = await db.query(
      'SELECT id, status, accepted_by FROM consignment_orders WHERE id = $1 AND company_id = $2',
      [orderId, payload.companyId]
    )
    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    // Handle accept action
    if (action === 'accept') {
      // Only MARKET_ADMIN, MARKET_MANAGER, MANAGER, ADMIN, SUPER_ADMIN can accept
      const canAccept = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MARKET_ADMIN', 'MARKET_MANAGER'].includes(payload.role)
      if (!canAccept) {
        return NextResponse.json({
          success: false,
          error: 'No tiene permisos para aceptar órdenes'
        }, { status: 403 })
      }

      if (existing.rows[0].accepted_by) {
        return NextResponse.json({
          success: false,
          error: 'Esta orden ya fue aceptada'
        }, { status: 400 })
      }

      // Update order with acceptance and change validation_status to confirmed
      await db.query(`
        UPDATE consignment_orders
        SET accepted_by = $1,
            accepted_at = NOW(),
            validation_status = 'confirmed',
            validated_by = $1,
            validated_at = NOW(),
            updated_at = NOW()
        WHERE id = $2
      `, [payload.userId, orderId])

      return NextResponse.json({
        success: true,
        message: 'Orden de consignación aceptada exitosamente'
      })
    }

    // Handle reject action
    if (action === 'reject') {
      const { rejectionReason } = body

      // Only MARKET_ADMIN, MARKET_MANAGER, MANAGER, ADMIN, SUPER_ADMIN can reject
      const canReject = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MARKET_ADMIN', 'MARKET_MANAGER'].includes(payload.role)
      if (!canReject) {
        return NextResponse.json({
          success: false,
          error: 'No tiene permisos para rechazar órdenes'
        }, { status: 403 })
      }

      await db.query(`
        UPDATE consignment_orders
        SET validation_status = 'rejected',
            rejection_reason = $1,
            validated_by = $2,
            validated_at = NOW(),
            updated_at = NOW()
        WHERE id = $3
      `, [rejectionReason || 'Sin motivo especificado', payload.userId, orderId])

      return NextResponse.json({
        success: true,
        message: 'Orden de consignación rechazada'
      })
    }

    // Handle resubmit action (for rejected orders)
    if (action === 'resubmit') {
      // Check if order is rejected
      const orderCheck = await db.query(
        'SELECT validation_status FROM consignment_orders WHERE id = $1',
        [orderId]
      )

      if (orderCheck.rows[0]?.validation_status !== 'rejected') {
        return NextResponse.json({
          success: false,
          error: 'Solo se pueden reenviar a revisión órdenes rechazadas'
        }, { status: 400 })
      }

      await db.query(`
        UPDATE consignment_orders
        SET validation_status = 'pending_validation',
            validated_by = NULL,
            validated_at = NULL,
            rejection_reason = NULL,
            updated_at = NOW()
        WHERE id = $1
      `, [orderId])

      return NextResponse.json({
        success: true,
        message: 'Orden reenviada a revisión exitosamente'
      })
    }

    // Handle edit action (full order update with lines)
    const { lines, supplierId, warehouseId, consignmentDate } = body
    if (lines && Array.isArray(lines)) {
      // Check order can be edited (pending or rejected status)
      const orderStatus = existing.rows[0].status
      const validationStatus = await db.query(
        'SELECT validation_status FROM consignment_orders WHERE id = $1',
        [orderId]
      )
      const vs = validationStatus.rows[0]?.validation_status

      // Allow edit if rejected or pending
      if (orderStatus !== 'pending' && vs !== 'rejected') {
        return NextResponse.json({
          success: false,
          error: 'Solo se pueden editar órdenes pendientes o rechazadas'
        }, { status: 400 })
      }

      // Delete existing lines
      await db.query('DELETE FROM consignment_order_lines WHERE order_id = $1', [orderId])

      // Insert new lines
      let totalItems = 0
      let totalUnits = 0
      let totalCost = 0

      for (const line of lines) {
        if (line.productId > 0) {
          await db.query(`
            INSERT INTO consignment_order_lines (
              order_id, product_id, variant_id, quantity_ordered, unit_cost, unit_price
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [orderId, line.productId, line.variantId || null, line.quantity, line.unitCost, line.unitPrice || 0])

          totalItems++
          totalUnits += line.quantity
          totalCost += line.quantity * line.unitCost
        }
      }

      // Update order totals and reset validation status to pending
      await db.query(`
        UPDATE consignment_orders
        SET supplier_id = COALESCE($1, supplier_id),
            warehouse_id = COALESCE($2, warehouse_id),
            consignment_date = COALESCE($3, consignment_date),
            notes = COALESCE($4, notes),
            total_items = $5,
            total_units = $6,
            total_cost = $7,
            validation_status = 'pending_validation',
            validated_by = NULL,
            validated_at = NULL,
            rejection_reason = NULL,
            updated_at = NOW()
        WHERE id = $8
      `, [supplierId, warehouseId, consignmentDate, notes, totalItems, totalUnits, totalCost, orderId])

      return NextResponse.json({
        success: true,
        message: 'Orden actualizada exitosamente',
        data: { id: orderId }
      })
    }

    let query = 'UPDATE consignment_orders SET updated_at = NOW()'
    const params_arr: (string | number)[] = []
    let paramIndex = 1

    if (status) {
      query += `, status = $${paramIndex}`
      params_arr.push(status)
      paramIndex++

      // Update timestamps based on status
      if (status === 'received') {
        query += `, received_at = NOW(), received_by = $${paramIndex}`
        params_arr.push(payload.userId)
        paramIndex++
      } else if (status === 'liquidated') {
        query += `, completed_at = NOW()`
      }
    }

    if (notes !== undefined) {
      query += `, notes = $${paramIndex}`
      params_arr.push(notes)
      paramIndex++
    }

    query += ` WHERE id = $${paramIndex} AND company_id = $${paramIndex + 1}`
    params_arr.push(orderId, payload.companyId)

    await db.query(query, params_arr)

    return NextResponse.json({
      success: true,
      message: 'Orden actualizada exitosamente'
    })

  } catch (error) {
    console.error('[Order PUT] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar orden'
    }, { status: 500 })
  }
}
