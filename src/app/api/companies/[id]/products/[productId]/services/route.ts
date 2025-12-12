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

interface RouteParams {
  params: Promise<{
    id: string
    productId: string
  }>
}

/**
 * GET /api/companies/[id]/products/[productId]/services
 *
 * Get all services for a product within a company
 * Returns services with product info and margin calculations
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id, productId: prodId } = await params
    const companyId = parseInt(id)
    const productId = parseInt(prodId)

    if (isNaN(companyId) || isNaN(productId)) {
      return NextResponse.json({
        success: false,
        error: 'IDs inválidos'
      }, { status: 400 })
    }

    // Verify auth
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
        error: 'Token invalido'
      }, { status: 401 })
    }

    // Authorization: SUPER_ADMIN can view any company, others only their own
    if (payload.role !== 'SUPER_ADMIN' && payload.companyId !== companyId) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado para ver servicios de esta empresa'
      }, { status: 403 })
    }

    // Get product info
    const productResult = await db.query(`
      SELECT id, code, name, service_category, product_type
      FROM product_catalog
      WHERE id = $1 AND is_active = true
    `, [productId])

    if (productResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Producto no encontrado'
      }, { status: 404 })
    }

    const product = productResult.rows[0]

    // Get company product pricing (to calculate total margins)
    const pricingResult = await db.query(`
      SELECT cost_price, sell_price, margin
      FROM company_product_pricing
      WHERE company_id = $1 AND product_id = $2
    `, [companyId, productId])

    const productPricing = pricingResult.rows[0] || { cost_price: 0, sell_price: 0, margin: 0 }

    // Get all services for this company/product
    console.log('Fetching services for companyId:', companyId, 'productId:', productId)
    const servicesResult = await db.query(`
      SELECT
        id,
        company_id,
        product_id,
        service_code,
        service_name,
        service_description,
        cost_price,
        sell_price,
        margin,
        margin_percentage,
        is_required,
        is_default_selected,
        is_taxable,
        commission_enabled,
        commission_type,
        commission_value,
        max_commission,
        display_order,
        icon_name,
        color_code,
        is_active,
        created_at,
        updated_at
      FROM company_product_services
      WHERE company_id = $1 AND product_id = $2
      ORDER BY is_required DESC, display_order ASC, service_name ASC
    `, [companyId, productId])
    console.log('Services found:', servicesResult.rows.length, 'rows:', servicesResult.rows)

    // Calculate total services margin
    const services = servicesResult.rows
    const totalServicesCost = services.reduce((sum, s) => sum + parseFloat(s.cost_price || 0), 0)
    const totalServicesSell = services.reduce((sum, s) => sum + parseFloat(s.sell_price || 0), 0)
    const totalServicesMargin = totalServicesSell - totalServicesCost

    // Calculate required services margin
    const requiredServices = services.filter(s => s.is_required)
    const requiredServicesCost = requiredServices.reduce((sum, s) => sum + parseFloat(s.cost_price || 0), 0)
    const requiredServicesSell = requiredServices.reduce((sum, s) => sum + parseFloat(s.sell_price || 0), 0)
    const requiredServicesMargin = requiredServicesSell - requiredServicesCost

    return NextResponse.json({
      success: true,
      data: {
        product: {
          id: product.id,
          code: product.code,
          name: product.name,
          category: product.service_category,
          type: product.product_type
        },
        productPricing: {
          costPrice: parseFloat(productPricing.cost_price) || 0,
          sellPrice: parseFloat(productPricing.sell_price) || 0,
          margin: parseFloat(productPricing.margin) || 0
        },
        services: services.map(s => ({
          id: s.id,
          serviceCode: s.service_code,
          serviceName: s.service_name,
          serviceDescription: s.service_description,
          costPrice: parseFloat(s.cost_price) || 0,
          sellPrice: parseFloat(s.sell_price) || 0,
          margin: parseFloat(s.margin) || 0,
          marginPercentage: parseFloat(s.margin_percentage) || 0,
          isRequired: s.is_required,
          isDefaultSelected: s.is_default_selected,
          isTaxable: s.is_taxable,
          commissionEnabled: s.commission_enabled,
          commissionType: s.commission_type,
          commissionValue: parseFloat(s.commission_value) || 0,
          maxCommission: s.max_commission ? parseFloat(s.max_commission) : null,
          displayOrder: s.display_order,
          iconName: s.icon_name,
          colorCode: s.color_code,
          isActive: s.is_active,
          createdAt: s.created_at,
          updatedAt: s.updated_at
        })),
        summary: {
          totalServices: services.length,
          requiredServices: requiredServices.length,
          optionalServices: services.length - requiredServices.length,
          totalServicesCost,
          totalServicesSell,
          totalServicesMargin,
          requiredServicesCost,
          requiredServicesSell,
          requiredServicesMargin,
          // Combined totals
          totalCost: parseFloat(productPricing.cost_price || 0) + requiredServicesCost,
          totalSell: parseFloat(productPricing.sell_price || 0) + requiredServicesSell,
          totalMargin: parseFloat(productPricing.margin || 0) + requiredServicesMargin
        }
      }
    })

  } catch (error) {
    console.error('Error fetching services:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener servicios'
    }, { status: 500 })
  }
}

/**
 * POST /api/companies/[id]/products/[productId]/services
 *
 * Create a new service for a product within a company
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id, productId: prodId } = await params
    const companyId = parseInt(id)
    const productId = parseInt(prodId)

    // Verify auth
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
        error: 'Token invalido'
      }, { status: 401 })
    }

    // Authorization: SUPER_ADMIN or ADMIN of the company
    if (payload.role !== 'SUPER_ADMIN' &&
        !(payload.role === 'ADMIN' && payload.companyId === companyId)) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado. Solo ADMIN puede crear servicios.'
      }, { status: 403 })
    }

    // Parse body
    const body = await request.json()
    const {
      serviceCode,
      serviceName,
      serviceDescription,
      costPrice,
      sellPrice,
      isRequired = false,
      isDefaultSelected = false,
      isTaxable = true,
      commissionEnabled = false,
      commissionType,
      commissionValue = 0,
      maxCommission,
      displayOrder = 0,
      iconName,
      colorCode
    } = body

    // Validate required fields
    if (!serviceName || serviceName.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'El nombre del servicio es requerido'
      }, { status: 400 })
    }

    if (costPrice === undefined || sellPrice === undefined) {
      return NextResponse.json({
        success: false,
        error: 'El precio de costo y venta son requeridos'
      }, { status: 400 })
    }

    // Validate prices
    const costNum = parseFloat(costPrice)
    const sellNum = parseFloat(sellPrice)

    if (isNaN(costNum) || costNum < 0) {
      return NextResponse.json({
        success: false,
        error: 'El precio de costo debe ser un numero positivo'
      }, { status: 400 })
    }

    if (isNaN(sellNum) || sellNum < 0) {
      return NextResponse.json({
        success: false,
        error: 'El precio de venta debe ser un numero positivo'
      }, { status: 400 })
    }

    // Verify product exists
    const productCheck = await db.query(
      'SELECT id FROM product_catalog WHERE id = $1',
      [productId]
    )
    if (productCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Producto no encontrado'
      }, { status: 404 })
    }

    // Verify company exists
    const companyCheck = await db.query(
      'SELECT id, legalname FROM companies WHERE id = $1',
      [companyId]
    )
    if (companyCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empresa no encontrada'
      }, { status: 404 })
    }

    // Check for duplicate service name
    const duplicateCheck = await db.query(`
      SELECT id FROM company_product_services
      WHERE company_id = $1 AND product_id = $2 AND LOWER(service_name) = LOWER($3)
    `, [companyId, productId, serviceName.trim()])

    if (duplicateCheck.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Ya existe un servicio llamado "${serviceName}" para este producto`
      }, { status: 400 })
    }

    // Insert service
    const result = await db.query(`
      INSERT INTO company_product_services (
        company_id,
        product_id,
        service_code,
        service_name,
        service_description,
        cost_price,
        sell_price,
        is_required,
        is_default_selected,
        is_taxable,
        commission_enabled,
        commission_type,
        commission_value,
        max_commission,
        display_order,
        icon_name,
        color_code,
        created_by_user_id,
        created_by_user_name
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
      RETURNING *
    `, [
      companyId,
      productId,
      serviceCode || null,
      serviceName.trim(),
      serviceDescription || null,
      costNum,
      sellNum,
      isRequired,
      isDefaultSelected,
      isTaxable,
      commissionEnabled,
      commissionType || null,
      commissionValue,
      maxCommission || null,
      displayOrder,
      iconName || null,
      colorCode || null,
      payload.userId,
      `${payload.companyName} - ${payload.email}`
    ])

    const newService = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        id: newService.id,
        serviceCode: newService.service_code,
        serviceName: newService.service_name,
        serviceDescription: newService.service_description,
        costPrice: parseFloat(newService.cost_price),
        sellPrice: parseFloat(newService.sell_price),
        margin: parseFloat(newService.margin),
        marginPercentage: parseFloat(newService.margin_percentage),
        isRequired: newService.is_required,
        isDefaultSelected: newService.is_default_selected,
        isTaxable: newService.is_taxable,
        commissionEnabled: newService.commission_enabled,
        commissionType: newService.commission_type,
        commissionValue: parseFloat(newService.commission_value),
        maxCommission: newService.max_commission ? parseFloat(newService.max_commission) : null,
        displayOrder: newService.display_order,
        iconName: newService.icon_name,
        colorCode: newService.color_code,
        isActive: newService.is_active
      },
      message: 'Servicio creado exitosamente'
    })

  } catch (error) {
    console.error('Error creating service:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear servicio'
    }, { status: 500 })
  }
}

/**
 * PUT /api/companies/[id]/products/[productId]/services
 *
 * Update an existing service
 * Body must include serviceId
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id, productId: prodId } = await params
    const companyId = parseInt(id)
    const productId = parseInt(prodId)

    // Verify auth
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
        error: 'Token invalido'
      }, { status: 401 })
    }

    // Authorization: SUPER_ADMIN or ADMIN of the company
    if (payload.role !== 'SUPER_ADMIN' &&
        !(payload.role === 'ADMIN' && payload.companyId === companyId)) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado. Solo ADMIN puede actualizar servicios.'
      }, { status: 403 })
    }

    // Parse body
    const body = await request.json()
    const { serviceId, ...updates } = body

    if (!serviceId) {
      return NextResponse.json({
        success: false,
        error: 'serviceId es requerido'
      }, { status: 400 })
    }

    // Verify service exists and belongs to this company/product
    const serviceCheck = await db.query(`
      SELECT id FROM company_product_services
      WHERE id = $1 AND company_id = $2 AND product_id = $3
    `, [serviceId, companyId, productId])

    if (serviceCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Servicio no encontrado'
      }, { status: 404 })
    }

    // Build update query dynamically
    const updateFields: string[] = []
    const values: any[] = []
    let paramIndex = 1

    const fieldMappings: Record<string, string> = {
      serviceCode: 'service_code',
      serviceName: 'service_name',
      serviceDescription: 'service_description',
      costPrice: 'cost_price',
      sellPrice: 'sell_price',
      isRequired: 'is_required',
      isDefaultSelected: 'is_default_selected',
      isTaxable: 'is_taxable',
      commissionEnabled: 'commission_enabled',
      commissionType: 'commission_type',
      commissionValue: 'commission_value',
      maxCommission: 'max_commission',
      displayOrder: 'display_order',
      iconName: 'icon_name',
      colorCode: 'color_code',
      isActive: 'is_active'
    }

    for (const [key, dbField] of Object.entries(fieldMappings)) {
      if (updates[key] !== undefined) {
        updateFields.push(`${dbField} = $${paramIndex}`)
        values.push(updates[key])
        paramIndex++
      }
    }

    if (updateFields.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay campos para actualizar'
      }, { status: 400 })
    }

    // Add service ID at the end
    values.push(serviceId)

    const result = await db.query(`
      UPDATE company_product_services
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `, values)

    const updatedService = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        id: updatedService.id,
        serviceCode: updatedService.service_code,
        serviceName: updatedService.service_name,
        serviceDescription: updatedService.service_description,
        costPrice: parseFloat(updatedService.cost_price),
        sellPrice: parseFloat(updatedService.sell_price),
        margin: parseFloat(updatedService.margin),
        marginPercentage: parseFloat(updatedService.margin_percentage),
        isRequired: updatedService.is_required,
        isDefaultSelected: updatedService.is_default_selected,
        isTaxable: updatedService.is_taxable,
        commissionEnabled: updatedService.commission_enabled,
        commissionType: updatedService.commission_type,
        commissionValue: parseFloat(updatedService.commission_value),
        maxCommission: updatedService.max_commission ? parseFloat(updatedService.max_commission) : null,
        displayOrder: updatedService.display_order,
        iconName: updatedService.icon_name,
        colorCode: updatedService.color_code,
        isActive: updatedService.is_active
      },
      message: 'Servicio actualizado exitosamente'
    })

  } catch (error) {
    console.error('Error updating service:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar servicio'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/companies/[id]/products/[productId]/services
 *
 * Delete a service
 * Body must include serviceId
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id, productId: prodId } = await params
    const companyId = parseInt(id)
    const productId = parseInt(prodId)

    // Verify auth
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
        error: 'Token invalido'
      }, { status: 401 })
    }

    // Authorization: SUPER_ADMIN or ADMIN of the company
    if (payload.role !== 'SUPER_ADMIN' &&
        !(payload.role === 'ADMIN' && payload.companyId === companyId)) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado. Solo ADMIN puede eliminar servicios.'
      }, { status: 403 })
    }

    // Parse body
    const body = await request.json()
    const { serviceId } = body

    if (!serviceId) {
      return NextResponse.json({
        success: false,
        error: 'serviceId es requerido'
      }, { status: 400 })
    }

    // Verify service exists and belongs to this company/product
    const serviceCheck = await db.query(`
      SELECT id, service_name FROM company_product_services
      WHERE id = $1 AND company_id = $2 AND product_id = $3
    `, [serviceId, companyId, productId])

    if (serviceCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Servicio no encontrado'
      }, { status: 404 })
    }

    const serviceName = serviceCheck.rows[0].service_name

    // Delete the service
    await db.query(
      'DELETE FROM company_product_services WHERE id = $1',
      [serviceId]
    )

    return NextResponse.json({
      success: true,
      message: `Servicio "${serviceName}" eliminado exitosamente`
    })

  } catch (error) {
    console.error('Error deleting service:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar servicio'
    }, { status: 500 })
  }
}
