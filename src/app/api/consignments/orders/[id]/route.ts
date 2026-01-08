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
        COALESCE((
          SELECT SUM(ol.quantity_sold * ol.unit_price)
          FROM consignment_order_lines ol
          WHERE ol.order_id = o.id
        ), 0) as calculated_total_sold
      FROM consignment_orders o
      JOIN market_suppliers s ON s.id = o.supplier_id
      JOIN market_warehouses w ON w.id = o.warehouse_id
      LEFT JOIN users u ON u.id = o.created_by
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

    // Debug log to check variant data
    console.log('[Order GET] Lines data:', linesResult.rows.map(l => ({
      id: l.id,
      variant_id: l.variant_id,
      variant_name: l.variant_name
    })))

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
    const { status, notes } = body

    // Verify order exists
    const existing = await db.query(
      'SELECT id, status FROM consignment_orders WHERE id = $1 AND company_id = $2',
      [orderId, payload.companyId]
    )
    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
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
