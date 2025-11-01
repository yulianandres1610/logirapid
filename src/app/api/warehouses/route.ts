import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const type = searchParams.get('type') || ''

    // Import database connection locally
    const Database = require('better-sqlite3')
    const path = require('path')
    const fs = require('fs')

    const DB_PATH = path.join(process.cwd(), 'data', 'cubarapid.db')

    // Create directory if it doesn't exist
    if (!fs.existsSync(path.dirname(DB_PATH))) {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
    }

    // Open database connection
    const db = new Database(DB_PATH)

    // Create warehouses table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS warehouses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        zip_code TEXT NOT NULL,
        country TEXT NOT NULL DEFAULT 'Estados Unidos',
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        manager_name TEXT,
        manager_email TEXT,
        manager_phone TEXT,
        operating_hours TEXT NOT NULL DEFAULT 'standard',
        custom_operating_hours TEXT,
        total_area REAL DEFAULT 0,
        capacity INTEGER DEFAULT 0,
        current_stock INTEGER DEFAULT 0,
        opening_date TEXT,
        notes TEXT,
        latitude REAL,
        longitude REAL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Build WHERE conditions
    const conditions = []
    const params = []

    if (search) {
      conditions.push('(name LIKE ? OR code LIKE ? OR address LIKE ? OR city LIKE ?)')
      const searchTerm = `%${search}%`
      params.push(searchTerm, searchTerm, searchTerm, searchTerm)
    }

    if (status && status !== 'all') {
      conditions.push('status = ?')
      params.push(status)
    }

    if (type && type !== 'all') {
      conditions.push('type = ?')
      params.push(type)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Count total records
    const countQuery = `SELECT COUNT(*) as total FROM warehouses ${whereClause}`
    const countResult = db.prepare(countQuery).get(...params) as { total: number }

    // Get paginated results
    const offset = (page - 1) * limit
    const dataQuery = `
      SELECT * FROM warehouses
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `
    const warehouses = db.prepare(dataQuery).all(...params, limit, offset)

    // Close database connection
    db.close()

    return NextResponse.json({
      success: true,
      data: warehouses,
      pagination: {
        page,
        limit,
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / limit)
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

    // Import database connection locally
    const Database = require('better-sqlite3')
    const path = require('path')
    const fs = require('fs')

    const DB_PATH = path.join(process.cwd(), 'data', 'cubarapid.db')

    // Create directory if it doesn't exist
    if (!fs.existsSync(path.dirname(DB_PATH))) {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
    }

    // Open database connection
    const db = new Database(DB_PATH)

    // Create warehouses table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS warehouses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        zip_code TEXT NOT NULL,
        country TEXT NOT NULL DEFAULT 'Estados Unidos',
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        manager_name TEXT,
        manager_email TEXT,
        manager_phone TEXT,
        operating_hours TEXT NOT NULL DEFAULT 'standard',
        custom_operating_hours TEXT,
        total_area REAL DEFAULT 0,
        capacity INTEGER DEFAULT 0,
        current_stock INTEGER DEFAULT 0,
        opening_date TEXT,
        notes TEXT,
        latitude REAL,
        longitude REAL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Validate required fields
    const requiredFields = ['name', 'code', 'type', 'address', 'city', 'state', 'zipCode']
    for (const field of requiredFields) {
      const value = warehouseData[field]
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        console.error(`❌ Campo requerido faltante o vacío: ${field}`, value)
        db.close()
        return NextResponse.json(
          { success: false, error: `Field ${field} is required` },
          { status: 400 }
        )
      }
    }

    // Check if warehouse code already exists
    const existingWarehouse = db.prepare('SELECT id FROM warehouses WHERE code = ?').get(warehouseData.code)
    if (existingWarehouse) {
      db.close()
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
        opening_date, notes, latitude, longitude, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `

    console.log('🗄️ Insertando warehouse con datos:', warehouseData)

    let result: any = null

    try {
      console.log('📋 Valores a insertar:', [
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
      ])

      result = db.prepare(insertQuery).run(
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
      )
      console.log('✅ Warehouse insertado exitosamente con ID:', result.lastInsertRowid)
    } catch (dbError) {
      console.error('❌ Error en base de datos:', dbError)
      console.error('❌ Stack trace:', dbError instanceof Error ? dbError.stack : 'No stack trace available')
      db.close()
      return NextResponse.json(
        { success: false, error: `Database error: ${dbError instanceof Error ? dbError.message : 'Unknown error'}` },
        { status: 500 }
      )
    }

    // Close database connection
    db.close()

    // Verify that result exists before using it
    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Failed to create warehouse - no result from database' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Warehouse created successfully',
      data: {
        id: result.lastInsertRowid,
        ...warehouseData
      }
    })
  } catch (error) {
    console.error('Error creating warehouse:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create warehouse' },
      { status: 500 }
    )
  }
}