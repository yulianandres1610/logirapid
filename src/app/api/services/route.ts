import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

// GET: Obtener todos los servicios con paginación y filtros
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const search = searchParams.get('search') || ''
    const serviceType = searchParams.get('serviceType') || ''
    const activeOnly = searchParams.get('activeOnly') === 'true'

    // Build WHERE conditions
    const conditions = []
    const params = []

    if (search) {
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
      conditions.push(`(
        name ILIKE $${params.length - 2} OR
        code ILIKE $${params.length - 1} OR
        description ILIKE $${params.length}
      )`)
    }

    if (serviceType && serviceType !== 'all') {
      params.push(serviceType)
      conditions.push(`service_type = $${params.length}`)
    }

    if (activeOnly) {
      conditions.push('active = true')
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Count total records
    const countQuery = `SELECT COUNT(*) as total FROM services ${whereClause}`
    const countResult = await db.query(countQuery, params)
    const total = parseInt(countResult.rows[0].total)

    // Get paginated results
    const offset = (page - 1) * limit
    params.push(limit, offset)

    const dataQuery = `
      SELECT
        id,
        name,
        code,
        description,
        service_type as "serviceType",
        pricing_model as "pricingModel",
        base_price as "basePrice",
        price_per_unit as "pricePerUnit",
        unit_type as "unitType",
        requires_box_code as "requiresBoxCode",
        requires_dimensions as "requiresDimensions",
        requires_weight as "requiresWeight",
        requires_recipient as "requiresRecipient",
        requires_content_type as "requiresContentType",
        box_type as "boxType",
        active,
        display_order as "displayOrder",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM services
      ${whereClause}
      ORDER BY display_order ASC, name ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `

    const result = await db.query(dataQuery, params)

    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: page > 1
      }
    })

  } catch (error) {
    console.error('Error getting services:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener servicios'
    }, { status: 500 })
  }
}

// POST: Crear nuevo servicio
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar campos requeridos
    if (!body.name || !body.code || !body.serviceType || !body.pricingModel) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos (name, code, serviceType, pricingModel)'
      }, { status: 400 })
    }

    // Verificar si el código ya existe
    const existingService = await db.query(
      'SELECT id FROM services WHERE code = $1',
      [body.code]
    )

    if (existingService.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Ya existe un servicio con este código'
      }, { status: 400 })
    }

    const insertQuery = `
      INSERT INTO services (
        name, code, description, service_type, pricing_model,
        base_price, price_per_unit, unit_type,
        requires_box_code, requires_dimensions, requires_weight,
        requires_recipient, requires_content_type, box_type,
        active, display_order, company_id
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11,
        $12, $13, $14,
        $15, $16, $17
      )
      RETURNING
        id,
        name,
        code,
        description,
        service_type as "serviceType",
        pricing_model as "pricingModel",
        base_price as "basePrice",
        price_per_unit as "pricePerUnit",
        unit_type as "unitType",
        requires_box_code as "requiresBoxCode",
        requires_dimensions as "requiresDimensions",
        requires_weight as "requiresWeight",
        requires_recipient as "requiresRecipient",
        requires_content_type as "requiresContentType",
        box_type as "boxType",
        active,
        display_order as "displayOrder",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `

    const values = [
      body.name,
      body.code,
      body.description || null,
      body.serviceType,
      body.pricingModel,
      body.basePrice || 0,
      body.pricePerUnit || 0,
      body.unitType || null,
      body.requiresBoxCode || false,
      body.requiresDimensions || false,
      body.requiresWeight || false,
      body.requiresRecipient !== undefined ? body.requiresRecipient : true,
      body.requiresContentType || false,
      body.boxType || null,
      body.active !== undefined ? body.active : true,
      body.displayOrder || 0,
      body.companyId || 1
    ]

    const result = await db.query(insertQuery, values)

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Servicio creado exitosamente'
    })

  } catch (error) {
    console.error('Error creating service:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al crear servicio'
    }, { status: 500 })
  }
}

// PUT: Actualizar servicio existente
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere ID del servicio'
      }, { status: 400 })
    }

    // Build UPDATE query dynamically
    const updateFields = []
    const values = []
    let valueIndex = 1

    const fieldMapping = {
      name: 'name',
      code: 'code',
      description: 'description',
      serviceType: 'service_type',
      pricingModel: 'pricing_model',
      basePrice: 'base_price',
      pricePerUnit: 'price_per_unit',
      unitType: 'unit_type',
      requiresBoxCode: 'requires_box_code',
      requiresDimensions: 'requires_dimensions',
      requiresWeight: 'requires_weight',
      requiresRecipient: 'requires_recipient',
      requiresContentType: 'requires_content_type',
      boxType: 'box_type',
      active: 'active',
      displayOrder: 'display_order'
    }

    for (const [key, value] of Object.entries(updateData)) {
      if (fieldMapping[key as keyof typeof fieldMapping]) {
        updateFields.push(`${fieldMapping[key as keyof typeof fieldMapping]} = $${valueIndex}`)
        values.push(value)
        valueIndex++
      }
    }

    if (updateFields.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay campos para actualizar'
      }, { status: 400 })
    }

    // Add id to values
    values.push(id)

    const updateQuery = `
      UPDATE services
      SET ${updateFields.join(', ')}
      WHERE id = $${valueIndex}
      RETURNING
        id,
        name,
        code,
        description,
        service_type as "serviceType",
        pricing_model as "pricingModel",
        base_price as "basePrice",
        price_per_unit as "pricePerUnit",
        unit_type as "unitType",
        requires_box_code as "requiresBoxCode",
        requires_dimensions as "requiresDimensions",
        requires_weight as "requiresWeight",
        requires_recipient as "requiresRecipient",
        requires_content_type as "requiresContentType",
        box_type as "boxType",
        active,
        display_order as "displayOrder",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `

    const result = await db.query(updateQuery, values)

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró el servicio'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Servicio actualizado exitosamente'
    })

  } catch (error) {
    console.error('Error updating service:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar servicio'
    }, { status: 500 })
  }
}

// DELETE: Eliminar servicio permanentemente de la base de datos
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    console.log('[DELETE /api/services] Received id:', id)

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere ID del servicio'
      }, { status: 400 })
    }

    const serviceId = parseInt(id)
    if (isNaN(serviceId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de servicio inválido'
      }, { status: 400 })
    }

    // Hard delete - eliminar permanentemente de la base de datos
    const deleteQuery = `
      DELETE FROM services
      WHERE id = $1
      RETURNING id
    `

    console.log('[DELETE /api/services] Executing query with id:', serviceId)
    const result = await db.query(deleteQuery, [serviceId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró el servicio'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Servicio eliminado exitosamente'
    })

  } catch (error) {
    console.error('Error deleting service:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al eliminar servicio'
    }, { status: 500 })
  }
}
