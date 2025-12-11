import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * GET /api/boxes/[code]/services
 * Get all services sold for a box
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const resolvedParams = await params
    const trackingCode = resolvedParams.code
    const { companyId, isSuperAdmin } = getCompanyFilter(request)

    // Find the box
    let boxQuery = 'SELECT * FROM box_tracking WHERE tracking_code = $1'
    const boxParams: any[] = [trackingCode]

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

    // Get sold services
    const salesQuery = `
      SELECT
        ss.*,
        ps.inclusion_type,
        ps.sequence_order,
        ps.generates_box_tracking
      FROM service_sales ss
      JOIN product_services ps ON ss.product_service_id = ps.id
      WHERE ss.box_tracking_id = $1
      ORDER BY ps.sequence_order ASC, ss.created_at ASC
    `
    const salesResult = await db.query(salesQuery, [box.id])

    // Get available services for this product
    const availableQuery = `
      SELECT
        ps.*,
        CASE WHEN EXISTS (
          SELECT 1 FROM service_sales ss
          WHERE ss.box_tracking_id = $1 AND ss.product_service_id = ps.id
        ) THEN true ELSE false END as is_sold
      FROM product_services ps
      WHERE ps.product_id = $2 AND ps.is_active = true
      ORDER BY ps.sequence_order ASC
    `
    const availableResult = await db.query(availableQuery, [box.id, box.product_id])

    const soldServices = salesResult.rows.map(row => ({
      id: row.id,
      serviceCode: row.service_code,
      serviceName: row.service_name,
      precioUnitario: parseFloat(row.precio_unitario),
      cantidad: row.cantidad,
      subtotal: parseFloat(row.subtotal),
      descuento: parseFloat(row.descuento) || 0,
      total: parseFloat(row.total),
      status: row.status,
      soldByUserId: row.sold_by_user_id,
      soldByUserName: row.sold_by_user_name,
      paidAt: row.paid_at,
      completedAt: row.completed_at,
      packageOrderId: row.package_order_id,
      createdAt: row.created_at
    }))

    const availableServices = availableResult.rows.map(row => ({
      id: row.id,
      serviceCode: row.service_code,
      serviceName: row.service_name,
      description: row.description,
      inclusionType: row.inclusion_type,
      basePrice: parseFloat(row.base_price) || 0,
      isMandatory: row.is_mandatory,
      sequenceOrder: row.sequence_order,
      isSold: row.is_sold
    }))

    const pendingServices = availableServices.filter(s => !s.isSold)

    return NextResponse.json({
      success: true,
      data: {
        box: {
          id: box.id,
          trackingCode: box.tracking_code,
          productId: box.product_id,
          productName: box.product_name,
          currentStatus: box.current_status,
          customerName: box.customer_name
        },
        soldServices,
        availableServices,
        pendingServices,
        summary: {
          totalSold: soldServices.length,
          totalAvailable: availableServices.length,
          totalPending: pendingServices.length,
          totalPaid: soldServices.reduce((sum, s) => sum + s.total, 0)
        }
      }
    })

  } catch (error) {
    console.error('❌ [Error] GET /api/boxes/[code]/services:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener servicios de la caja',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * POST /api/boxes/[code]/services
 * Add a service to an existing box (partial sale)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const resolvedParams = await params
    const trackingCode = resolvedParams.code
    const { companyId, isSuperAdmin, userId, userRole } = getCompanyFilter(request)

    const body = await request.json()
    const {
      serviceCode,
      userName,
      packageOrderId,
      discount = 0,
      discountReason,
      notes
    } = body

    if (!serviceCode) {
      return NextResponse.json({
        success: false,
        error: 'Código de servicio es requerido'
      }, { status: 400 })
    }

    // Find the box
    let boxQuery = `
      SELECT bt.*, pc.id as product_id
      FROM box_tracking bt
      JOIN product_catalog pc ON bt.product_id = pc.id
      WHERE bt.tracking_code = $1
    `
    const boxParams: any[] = [trackingCode]

    if (!isSuperAdmin && companyId) {
      boxQuery += ' AND bt.company_id = $2'
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

    // Verify the service exists for this product
    const serviceQuery = `
      SELECT ps.*, csp.precio_venta as company_price
      FROM product_services ps
      LEFT JOIN company_service_pricing csp
        ON ps.id = csp.product_service_id AND csp.company_id = $2
      WHERE ps.product_id = $1 AND ps.service_code = $3 AND ps.is_active = true
    `
    const serviceResult = await db.query(serviceQuery, [box.product_id, box.company_id, serviceCode])

    if (serviceResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Servicio "${serviceCode}" no disponible para este producto`
      }, { status: 400 })
    }

    const productService = serviceResult.rows[0]

    // Check if already sold
    const existingQuery = `
      SELECT * FROM service_sales
      WHERE box_tracking_id = $1 AND service_code = $2
    `
    const existingResult = await db.query(existingQuery, [box.id, serviceCode])

    if (existingResult.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: `El servicio "${productService.service_name}" ya fue vendido para esta caja`
      }, { status: 400 })
    }

    // Get price (company price or base price)
    const price = productService.company_price
      ? parseFloat(productService.company_price)
      : parseFloat(productService.base_price) || 0

    const subtotal = price
    const discountAmount = parseFloat(discount) || 0
    const total = Math.max(0, subtotal - discountAmount)

    // Create service sale
    const saleResult = await db.query(`
      INSERT INTO service_sales (
        box_tracking_id, product_service_id, service_code, service_name,
        company_id, customer_id, sold_by_user_id, sold_by_user_name,
        precio_unitario, cantidad, subtotal, descuento, descuento_reason,
        total, status, package_order_id, paid_at, notes, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, $10, $11, $12, $13, 'paid', $14, NOW(), $15, NOW())
      RETURNING *
    `, [
      box.id, productService.id, serviceCode, productService.service_name,
      box.company_id, box.customer_id, userId || null, userName || null,
      price, subtotal, discountAmount, discountReason || null,
      total, packageOrderId || null, notes || null
    ])

    const sale = saleResult.rows[0]

    // Record in box history
    await db.query(`
      INSERT INTO box_tracking_history (
        box_tracking_id, previous_status, new_status,
        changed_by_user_id, changed_by_user_name, changed_at, notes
      ) VALUES ($1, $2, $2, $3, $4, NOW(), $5)
    `, [
      box.id, box.current_status, userId || null, userName || null,
      `Servicio ${productService.service_name} agregado`
    ])

    return NextResponse.json({
      success: true,
      message: `Servicio "${productService.service_name}" agregado exitosamente`,
      data: {
        sale: {
          id: sale.id,
          serviceCode: sale.service_code,
          serviceName: sale.service_name,
          precioUnitario: parseFloat(sale.precio_unitario),
          subtotal: parseFloat(sale.subtotal),
          descuento: parseFloat(sale.descuento) || 0,
          total: parseFloat(sale.total),
          status: sale.status,
          paidAt: sale.paid_at
        },
        box: {
          trackingCode,
          currentStatus: box.current_status
        }
      }
    }, { status: 201 })

  } catch (error) {
    console.error('❌ [Error] POST /api/boxes/[code]/services:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al agregar servicio a la caja',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * PATCH /api/boxes/[code]/services
 * Update service sale status (complete or cancel)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const resolvedParams = await params
    const trackingCode = resolvedParams.code
    const { companyId, isSuperAdmin, userId } = getCompanyFilter(request)

    const body = await request.json()
    const { saleId, serviceCode, action } = body

    if (!action || !['complete', 'cancel'].includes(action)) {
      return NextResponse.json({
        success: false,
        error: 'Acción inválida. Use: complete o cancel'
      }, { status: 400 })
    }

    // Find the box
    let boxQuery = 'SELECT * FROM box_tracking WHERE tracking_code = $1'
    const boxParams: any[] = [trackingCode]

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

    // Find the sale
    let saleQuery = 'SELECT * FROM service_sales WHERE box_tracking_id = $1'
    const saleParams: any[] = [box.id]

    if (saleId) {
      saleQuery += ' AND id = $2'
      saleParams.push(saleId)
    } else if (serviceCode) {
      saleQuery += ' AND service_code = $2'
      saleParams.push(serviceCode)
    } else {
      return NextResponse.json({
        success: false,
        error: 'saleId o serviceCode requerido'
      }, { status: 400 })
    }

    const saleResult = await db.query(saleQuery, saleParams)

    if (saleResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Venta de servicio no encontrada'
      }, { status: 404 })
    }

    const sale = saleResult.rows[0]

    // Update based on action
    let updateQuery: string
    let newStatus: string

    if (action === 'complete') {
      updateQuery = `
        UPDATE service_sales
        SET status = 'completed', completed_at = NOW()
        WHERE id = $1
        RETURNING *
      `
      newStatus = 'completed'
    } else {
      updateQuery = `
        UPDATE service_sales
        SET status = 'cancelled', cancelled_at = NOW()
        WHERE id = $1
        RETURNING *
      `
      newStatus = 'cancelled'
    }

    const updateResult = await db.query(updateQuery, [sale.id])
    const updatedSale = updateResult.rows[0]

    return NextResponse.json({
      success: true,
      message: `Servicio ${action === 'complete' ? 'completado' : 'cancelado'} exitosamente`,
      data: {
        sale: {
          id: updatedSale.id,
          serviceCode: updatedSale.service_code,
          serviceName: updatedSale.service_name,
          status: updatedSale.status,
          completedAt: updatedSale.completed_at,
          cancelledAt: updatedSale.cancelled_at
        }
      }
    })

  } catch (error) {
    console.error('❌ [Error] PATCH /api/boxes/[code]/services:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar servicio',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
