import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const type = searchParams.get('type') || ''
    const companyIdParam = searchParams.get('companyId')
    const companyIdFilter = companyIdParam ? parseInt(companyIdParam) : headerCompanyId

    // Build WHERE conditions
    const conditions = []
    const params = []

    if (search) {
      conditions.push('(w.name ILIKE $' + (params.length + 1) + ' OR w.code ILIKE $' + (params.length + 2) + ' OR w.address ILIKE $' + (params.length + 3) + ' OR w.city ILIKE $' + (params.length + 4) + ')')
      const searchTerm = `%${search}%`
      params.push(searchTerm, searchTerm, searchTerm, searchTerm)
    }

    if (status && status !== 'all') {
      params.push(status)
      conditions.push('w.status = $' + params.length)
    }

    if (type && type !== 'all') {
      params.push(type)
      conditions.push('w.type = $' + params.length)
    }

    if (!isSuperAdmin) {
      if (!headerCompanyId) {
        return NextResponse.json(
          { success: false, error: 'No se pudo determinar la empresa del usuario' },
          { status: 400 }
        )
      }
      params.push(headerCompanyId)
      conditions.push('w.company_id = $' + params.length)
    } else if (companyIdParam) {
      params.push(parseInt(companyIdParam))
      conditions.push('w.company_id = $' + params.length)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Count total records
    const countQuery = `SELECT COUNT(*) as total FROM warehouses w ${whereClause}`
    const countResult = await db.query(countQuery, params)

    // Get paginated results
    const offset = (page - 1) * limit
    params.push(limit, offset)
    const dataQuery = `
      SELECT
        w.id,
        w.name,
        w.code,
        w.address,
        w.city,
        w.state,
        w.zip_code as "zipCode",
        w.country,
        w.type,
        w.status,
        w.manager_name as "managerName",
        w.manager_email as "managerEmail",
        w.manager_phone as "managerPhone",
        w.operating_hours as "operatingHours",
        w.custom_operating_hours as "customOperatingHours",
        w.total_area as "totalArea",
        w.capacity,
        w.cajas_vacias_capacity as "cajas_vacias_capacity",
        w.bultos_capacity as "bultos_capacity",
        w.opening_date as "openingDate",
        w.notes,
        w.latitude,
        w.longitude,
        w.created_at as "createdAt",
        w.updated_at as "updatedAt",
        COALESCE(
          (SELECT COUNT(*) FROM empaques e
           WHERE e.warehouse_id = w.id
           AND e.estado IN ('disponible', 'disponible_almacen', 'recogida')
           AND (e.order_number IS NULL OR e.order_number = '')),
          0
        ) as "cajas_vacias_count",
        COALESCE(
          (SELECT COUNT(*) FROM empaques e
           WHERE e.warehouse_id = w.id
           AND e.estado = 'en_almacen'),
          0
        ) as "bultos_count"
      FROM warehouses w
      ${whereClause}
      ORDER BY w.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `
    const result = await db.query(dataQuery, params)

    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching warehouses:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch warehouses' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const warehouseData = await request.json()
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)
    const companyId = isSuperAdmin ? (warehouseData.companyId || headerCompanyId) : headerCompanyId

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'No se pudo determinar la empresa para el almacén' },
        { status: 400 }
      )
    }

    // Validate required fields
    const requiredFields = ['name', 'code', 'type', 'address', 'city', 'state', 'zipCode']
    for (const field of requiredFields) {
      const value = warehouseData[field]
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        console.error(`❌ Campo requerido faltante o vacío: ${field}`, value)
        return NextResponse.json(
          { success: false, error: `Field ${field} is required` },
          { status: 400 }
        )
      }
    }

    // Check if warehouse code already exists
    const existingQuery = 'SELECT id FROM warehouses WHERE code = $1'
    const existingResult = await db.query(existingQuery, [warehouseData.code])

    if (existingResult.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Warehouse code already exists' },
        { status: 400 }
      )
    }

    // Insert new warehouse
    const insertQuery = `
      INSERT INTO warehouses (
        name, code, address, city, state, zip_code, country,
        type, status, manager_name, manager_email, manager_phone,
        operating_hours, custom_operating_hours, total_area, capacity,
        cajas_vacias_capacity, bultos_capacity,
        opening_date, notes, latitude, longitude, company_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING *
    `

    console.log('🗄️ Insertando warehouse con datos:', warehouseData)

    const values = [
      warehouseData.name,
      warehouseData.code,
      warehouseData.address,
      warehouseData.city,
      warehouseData.state,
      warehouseData.zipCode,
      warehouseData.country || 'Estados Unidos',
      warehouseData.type,
      warehouseData.status || 'active',
      warehouseData.managerName,
      warehouseData.managerEmail,
      warehouseData.managerPhone,
      warehouseData.operatingHours,
      warehouseData.customOperatingHours || null,
      warehouseData.totalArea,
      warehouseData.capacity || 0,
      warehouseData.cajas_vacias_capacity || 0,
      warehouseData.bultos_capacity || 0,
      warehouseData.openingDate || null,
      warehouseData.notes || null,
      warehouseData.latitude || null,
      warehouseData.longitude || null,
      companyId
    ]

    console.log('📋 Valores a insertar:', values)

    const result = await db.query(insertQuery, values)
    console.log('✅ Warehouse insertado exitosamente con ID:', result.rows[0].id)

    return NextResponse.json({
      success: true,
      message: 'Warehouse created successfully',
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Error creating warehouse:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create warehouse' },
      { status: 500 }
    )
  }
}
