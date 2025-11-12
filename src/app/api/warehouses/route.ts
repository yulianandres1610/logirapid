import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const type = searchParams.get('type') || ''

    // Build WHERE conditions
    const conditions = []
    const params = []

    if (search) {
      conditions.push('(name ILIKE $' + (params.length + 1) + ' OR code ILIKE $' + (params.length + 2) + ' OR address ILIKE $' + (params.length + 3) + ' OR city ILIKE $' + (params.length + 4) + ')')
      const searchTerm = `%${search}%`
      params.push(searchTerm, searchTerm, searchTerm, searchTerm)
    }

    if (status && status !== 'all') {
      params.push(status)
      conditions.push('status = $' + params.length)
    }

    if (type && type !== 'all') {
      params.push(type)
      conditions.push('type = $' + params.length)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Count total records
    const countQuery = `SELECT COUNT(*) as total FROM warehouses ${whereClause}`
    const countResult = await db.query(countQuery, params)

    // Get paginated results
    const offset = (page - 1) * limit
    params.push(limit, offset)
    const dataQuery = `
      SELECT * FROM warehouses
      ${whereClause}
      ORDER BY created_at DESC
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
        opening_date, notes, latitude, longitude
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
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
      warehouseData.capacity,
      warehouseData.openingDate || null,
      warehouseData.notes || null,
      warehouseData.latitude || null,
      warehouseData.longitude || null
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