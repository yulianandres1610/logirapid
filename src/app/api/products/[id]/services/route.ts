import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * GET /api/products/[id]/services
 * List all services for a product
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const productId = parseInt(resolvedParams.id)
    const { companyId, isSuperAdmin } = getCompanyFilter(request)

    if (isNaN(productId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de producto inválido'
      }, { status: 400 })
    }

    // Verify product exists
    const productResult = await db.query(
      'SELECT id, name, is_composite, has_box_tracking FROM product_catalog WHERE id = $1',
      [productId]
    )

    if (productResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Producto no encontrado'
      }, { status: 404 })
    }

    const product = productResult.rows[0]

    // Get services with company-specific pricing if available
    let query = `
      SELECT
        ps.id,
        ps.product_id,
        ps.service_code,
        ps.service_name,
        ps.description,
        ps.sequence_order,
        ps.inclusion_type,
        ps.base_price,
        ps.generates_box_tracking,
        ps.requires_prior_box,
        ps.is_mandatory,
        ps.is_active,
        ps.created_at,
        ps.updated_at
    `

    const queryParams: any[] = [productId]

    if (companyId) {
      query += `,
        csp.id as company_pricing_id,
        csp.mi_costo as company_mi_costo,
        csp.precio_venta as company_precio_venta,
        csp.margen as company_margen,
        csp.is_active as company_pricing_active
      FROM product_services ps
      LEFT JOIN company_service_pricing csp
        ON ps.id = csp.product_service_id AND csp.company_id = $2
      WHERE ps.product_id = $1
      `
      queryParams.push(companyId)
    } else {
      query += `
      FROM product_services ps
      WHERE ps.product_id = $1
      `
    }

    query += ' ORDER BY ps.sequence_order ASC, ps.id ASC'

    const servicesResult = await db.query(query, queryParams)

    // Map services with effective pricing
    const services = servicesResult.rows.map(row => ({
      id: row.id,
      productId: row.product_id,
      serviceCode: row.service_code,
      serviceName: row.service_name,
      description: row.description,
      sequenceOrder: row.sequence_order,
      inclusionType: row.inclusion_type,
      basePrice: parseFloat(row.base_price) || 0,
      generatesBoxTracking: row.generates_box_tracking,
      requiresPriorBox: row.requires_prior_box,
      isMandatory: row.is_mandatory,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // Company-specific pricing (if available)
      companyPricing: row.company_pricing_id ? {
        id: row.company_pricing_id,
        miCosto: parseFloat(row.company_mi_costo) || 0,
        precioVenta: parseFloat(row.company_precio_venta) || 0,
        margen: parseFloat(row.company_margen) || 0,
        isActive: row.company_pricing_active
      } : null,
      // Effective price (company price or base price)
      effectivePrice: row.company_precio_venta
        ? parseFloat(row.company_precio_venta)
        : parseFloat(row.base_price) || 0
    }))

    return NextResponse.json({
      success: true,
      data: {
        product: {
          id: product.id,
          name: product.name,
          isComposite: product.is_composite,
          hasBoxTracking: product.has_box_tracking
        },
        services,
        total: services.length
      }
    })

  } catch (error) {
    console.error('❌ [Error] GET /api/products/[id]/services:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener servicios del producto',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * POST /api/products/[id]/services
 * Create a new service for a product
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const productId = parseInt(resolvedParams.id)
    const { isSuperAdmin } = getCompanyFilter(request)

    // Only SUPER_ADMIN can create services
    if (!isSuperAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Solo SUPER_ADMIN puede crear servicios de producto'
      }, { status: 403 })
    }

    if (isNaN(productId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de producto inválido'
      }, { status: 400 })
    }

    const body = await request.json()
    const {
      serviceCode,
      serviceName,
      description,
      sequenceOrder = 1,
      inclusionType = 'included',
      basePrice = 0,
      generatesBoxTracking = false,
      requiresPriorBox = false,
      isMandatory = true,
      isActive = true
    } = body

    if (!serviceCode || !serviceName) {
      return NextResponse.json({
        success: false,
        error: 'Código y nombre del servicio son requeridos'
      }, { status: 400 })
    }

    // Verify product exists
    const productResult = await db.query(
      'SELECT id, name FROM product_catalog WHERE id = $1',
      [productId]
    )

    if (productResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Producto no encontrado'
      }, { status: 404 })
    }

    // Check if service code already exists for this product
    const existingResult = await db.query(
      'SELECT id FROM product_services WHERE product_id = $1 AND service_code = $2',
      [productId, serviceCode]
    )

    if (existingResult.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Ya existe un servicio con código "${serviceCode}" para este producto`
      }, { status: 409 })
    }

    // Create the service
    const result = await db.query(`
      INSERT INTO product_services (
        product_id, service_code, service_name, description,
        sequence_order, inclusion_type, base_price,
        generates_box_tracking, requires_prior_box,
        is_mandatory, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *
    `, [
      productId, serviceCode, serviceName, description,
      sequenceOrder, inclusionType, basePrice,
      generatesBoxTracking, requiresPriorBox,
      isMandatory, isActive
    ])

    const service = result.rows[0]

    // Mark product as composite if it has services
    await db.query(`
      UPDATE product_catalog
      SET is_composite = true,
          has_box_tracking = has_box_tracking OR $2,
          updated_at = NOW()
      WHERE id = $1
    `, [productId, generatesBoxTracking])

    return NextResponse.json({
      success: true,
      message: 'Servicio creado exitosamente',
      data: {
        id: service.id,
        productId: service.product_id,
        serviceCode: service.service_code,
        serviceName: service.service_name,
        description: service.description,
        sequenceOrder: service.sequence_order,
        inclusionType: service.inclusion_type,
        basePrice: parseFloat(service.base_price) || 0,
        generatesBoxTracking: service.generates_box_tracking,
        requiresPriorBox: service.requires_prior_box,
        isMandatory: service.is_mandatory,
        isActive: service.is_active
      }
    }, { status: 201 })

  } catch (error) {
    console.error('❌ [Error] POST /api/products/[id]/services:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al crear servicio',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * PUT /api/products/[id]/services
 * Update a service (requires serviceId in body)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const productId = parseInt(resolvedParams.id)
    const { isSuperAdmin } = getCompanyFilter(request)

    if (!isSuperAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Solo SUPER_ADMIN puede actualizar servicios de producto'
      }, { status: 403 })
    }

    const body = await request.json()
    const { serviceId, ...updateData } = body

    if (!serviceId) {
      return NextResponse.json({
        success: false,
        error: 'ID del servicio es requerido'
      }, { status: 400 })
    }

    // Verify service exists and belongs to product
    const existingResult = await db.query(
      'SELECT * FROM product_services WHERE id = $1 AND product_id = $2',
      [serviceId, productId]
    )

    if (existingResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Servicio no encontrado para este producto'
      }, { status: 404 })
    }

    // Build update query dynamically
    const updateFields: string[] = []
    const updateParams: any[] = []
    let paramIndex = 1

    const fieldMap: Record<string, string> = {
      serviceName: 'service_name',
      description: 'description',
      sequenceOrder: 'sequence_order',
      inclusionType: 'inclusion_type',
      basePrice: 'base_price',
      generatesBoxTracking: 'generates_box_tracking',
      requiresPriorBox: 'requires_prior_box',
      isMandatory: 'is_mandatory',
      isActive: 'is_active'
    }

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (updateData[key] !== undefined) {
        updateFields.push(`${dbField} = $${paramIndex}`)
        updateParams.push(updateData[key])
        paramIndex++
      }
    }

    if (updateFields.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay campos para actualizar'
      }, { status: 400 })
    }

    updateFields.push('updated_at = NOW()')
    updateParams.push(serviceId)

    const query = `
      UPDATE product_services
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    const result = await db.query(query, updateParams)
    const service = result.rows[0]

    return NextResponse.json({
      success: true,
      message: 'Servicio actualizado exitosamente',
      data: {
        id: service.id,
        productId: service.product_id,
        serviceCode: service.service_code,
        serviceName: service.service_name,
        description: service.description,
        sequenceOrder: service.sequence_order,
        inclusionType: service.inclusion_type,
        basePrice: parseFloat(service.base_price) || 0,
        generatesBoxTracking: service.generates_box_tracking,
        requiresPriorBox: service.requires_prior_box,
        isMandatory: service.is_mandatory,
        isActive: service.is_active
      }
    })

  } catch (error) {
    console.error('❌ [Error] PUT /api/products/[id]/services:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar servicio',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/products/[id]/services
 * Delete a service (requires serviceId in query params)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const productId = parseInt(resolvedParams.id)
    const { isSuperAdmin } = getCompanyFilter(request)

    if (!isSuperAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Solo SUPER_ADMIN puede eliminar servicios de producto'
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const serviceId = searchParams.get('serviceId')

    if (!serviceId) {
      return NextResponse.json({
        success: false,
        error: 'ID del servicio es requerido'
      }, { status: 400 })
    }

    // Verify service exists
    const existingResult = await db.query(
      'SELECT * FROM product_services WHERE id = $1 AND product_id = $2',
      [serviceId, productId]
    )

    if (existingResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Servicio no encontrado'
      }, { status: 404 })
    }

    // Check if service has been used in sales
    const salesResult = await db.query(
      'SELECT COUNT(*) as count FROM service_sales WHERE product_service_id = $1',
      [serviceId]
    )

    if (parseInt(salesResult.rows[0].count) > 0) {
      // Soft delete - just deactivate
      await db.query(
        'UPDATE product_services SET is_active = false, updated_at = NOW() WHERE id = $1',
        [serviceId]
      )

      return NextResponse.json({
        success: true,
        message: 'Servicio desactivado (tiene ventas asociadas)',
        data: { softDeleted: true }
      })
    }

    // Hard delete - remove completely
    await db.query('DELETE FROM product_services WHERE id = $1', [serviceId])

    // Check if product still has services
    const remainingResult = await db.query(
      'SELECT COUNT(*) as count FROM product_services WHERE product_id = $1',
      [productId]
    )

    if (parseInt(remainingResult.rows[0].count) === 0) {
      // No more services - mark product as non-composite
      await db.query(
        'UPDATE product_catalog SET is_composite = false, updated_at = NOW() WHERE id = $1',
        [productId]
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Servicio eliminado exitosamente',
      data: { deleted: true }
    })

  } catch (error) {
    console.error('❌ [Error] DELETE /api/products/[id]/services:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al eliminar servicio',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
