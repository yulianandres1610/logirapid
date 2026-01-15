import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

// Ensure Cuba-specific and entry columns exist
async function ensureCubaColumns() {
  const alterStatements = [
    "ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS number VARCHAR(50)",
    "ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS reparto VARCHAR(200)",
    "ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS floor VARCHAR(100)",
    "ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS province_id INTEGER",
    "ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS province_name VARCHAR(100)",
    "ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS municipality_id INTEGER",
    "ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS municipality_name VARCHAR(100)",
    "ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS delivery_instructions TEXT",
    "ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS address_type VARCHAR(20) DEFAULT 'usa'",
    "ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8)",
    "ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8)",
    "ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS entry_pin VARCHAR(50)",
    "ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS entry_instructions TEXT"
  ]

  for (const stmt of alterStatements) {
    try {
      await db.query(stmt)
    } catch (error: any) {
      // Ignore errors if column already exists
      if (!error.message?.includes('already exists')) {
        console.error('Error adding column:', error.message)
      }
    }
  }
}

// Initialize columns on first request
let columnsInitialized = false

// GET: Obtener direcciones de un cliente
export async function GET(request: NextRequest) {
  try {
    // Ensure Cuba columns exist
    if (!columnsInitialized) {
      await ensureCubaColumns()
      columnsInitialized = true
    }

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')
    const primary = searchParams.get('primary')
    const addressType = searchParams.get('addressType') // 'usa' | 'cuba' | null (all)

    if (!customerId) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere ID del cliente'
      }, { status: 400 })
    }

    const customerIdNum = parseInt(customerId)
    if (isNaN(customerIdNum)) {
      return NextResponse.json({
        success: false,
        error: 'ID de cliente inválido'
      }, { status: 400 })
    }

    let query: string
    let params: any[] = [customerIdNum]

    const selectFields = `
      id,
      customerid as "customerId",
      street,
      number,
      apartment,
      reparto,
      floor,
      city,
      state,
      zipcode as "zipCode",
      country,
      province_id as "provinceId",
      province_name as "provinceName",
      municipality_id as "municipalityId",
      municipality_name as "municipalityName",
      delivery_instructions as "deliveryInstructions",
      address_type as "addressType",
      latitude,
      longitude,
      entry_pin as "entryPin",
      entry_instructions as "entryInstructions",
      notes,
      isprimary as "isPrimary",
      createdat as "createdAt"
    `

    if (primary === 'true') {
      query = `
        SELECT ${selectFields}
        FROM customer_addresses
        WHERE customerid = $1 AND isprimary = true
        ${addressType ? `AND address_type = $2` : ''}
        LIMIT 1
      `
      if (addressType) params.push(addressType)
    } else {
      query = `
        SELECT ${selectFields}
        FROM customer_addresses
        WHERE customerid = $1
        ${addressType ? `AND address_type = $2` : ''}
        ORDER BY isprimary DESC, createdat DESC
      `
      if (addressType) params.push(addressType)
    }

    const result = await db.query(query, params)

    return NextResponse.json({
      success: true,
      data: primary === 'true' ? result.rows[0] || null : result.rows
    })

  } catch (error) {
    console.error('Error getting customer addresses:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener direcciones del cliente'
    }, { status: 500 })
  }
}

// POST: Crear nueva dirección para cliente
export async function POST(request: NextRequest) {
  try {
    // Ensure Cuba columns exist
    if (!columnsInitialized) {
      await ensureCubaColumns()
      columnsInitialized = true
    }

    const body = await request.json()

    // Determine address type
    const addressType = body.addressType || (body.country === 'CU' || body.country === 'Cuba' ? 'cuba' : 'usa')
    const isCubaAddress = addressType === 'cuba'

    // Validar campos requeridos según tipo
    if (!body || !body.customerId || !body.street) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos (customerId, street)'
      }, { status: 400 })
    }

    // Validaciones específicas para direcciones USA
    if (!isCubaAddress) {
      if (!body.city || !body.country) {
        return NextResponse.json({
          success: false,
          error: 'Faltan campos requeridos (city, country)'
        }, { status: 400 })
      }

      if (!body.state || !body.zipCode) {
        return NextResponse.json({
          success: false,
          error: 'La dirección debe incluir estado y código postal para garantizar coordenadas precisas'
        }, { status: 400 })
      }

      // Validar formato de código postal (5 dígitos para US)
      if (!/^\d{5}(-\d{4})?$/.test(body.zipCode)) {
        return NextResponse.json({
          success: false,
          error: 'El código postal debe tener 5 dígitos (ej: 33012)'
        }, { status: 400 })
      }
    }

    // Validaciones específicas para direcciones Cuba
    if (isCubaAddress) {
      if (!body.provinceId || !body.municipalityId) {
        return NextResponse.json({
          success: false,
          error: 'Las direcciones de Cuba requieren provincia y municipio'
        }, { status: 400 })
      }
    }

    // Si esta dirección será primaria, actualizar las otras a no primarias
    if (body.isPrimary) {
      await db.query(
        'UPDATE customer_addresses SET isprimary = false WHERE customerid = $1',
        [body.customerId]
      )
    }

    // Insertar nueva dirección con todos los campos
    const insertQuery = `
      INSERT INTO customer_addresses (
        customerid, street, number, apartment, reparto, floor,
        city, state, zipcode, country,
        province_id, province_name, municipality_id, municipality_name,
        delivery_instructions, address_type, latitude, longitude,
        entry_pin, entry_instructions,
        notes, isprimary, createdat
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW()
      )
      RETURNING
        id,
        customerid as "customerId",
        street,
        number,
        apartment,
        reparto,
        floor,
        city,
        state,
        zipcode as "zipCode",
        country,
        province_id as "provinceId",
        province_name as "provinceName",
        municipality_id as "municipalityId",
        municipality_name as "municipalityName",
        delivery_instructions as "deliveryInstructions",
        address_type as "addressType",
        latitude,
        longitude,
        entry_pin as "entryPin",
        entry_instructions as "entryInstructions",
        notes,
        isprimary as "isPrimary",
        createdat as "createdAt"
    `

    const values = [
      body.customerId,
      body.street,
      body.number || null,
      body.apartment || null,
      body.reparto || null,
      body.floor || null,
      isCubaAddress ? body.municipalityName : body.city,
      isCubaAddress ? body.provinceName : body.state,
      body.zipCode || null,
      isCubaAddress ? 'Cuba' : (body.country || 'US'),
      body.provinceId || null,
      body.provinceName || null,
      body.municipalityId || null,
      body.municipalityName || null,
      body.deliveryInstructions || null,
      addressType,
      body.latitude || null,
      body.longitude || null,
      body.entryPin || null,
      body.entryInstructions || null,
      body.notes || null,
      body.isPrimary || false
    ]

    const result = await db.query(insertQuery, values)

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Dirección agregada exitosamente'
    })

  } catch (error) {
    console.error('Error creating customer address:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al crear dirección del cliente'
    }, { status: 500 })
  }
}

// PUT: Actualizar dirección existente
export async function PUT(request: NextRequest) {
  try {
    // Ensure Cuba columns exist
    if (!columnsInitialized) {
      await ensureCubaColumns()
      columnsInitialized = true
    }

    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere ID de la dirección'
      }, { status: 400 })
    }

    // Si esta dirección será primaria, actualizar las otras a no primarias
    if (updateData.isPrimary) {
      // Obtener el customerId de la dirección actual
      const addressQuery = 'SELECT customerid FROM customer_addresses WHERE id = $1'
      const addressResult = await db.query(addressQuery, [id])

      if (addressResult.rows.length > 0) {
        const customerId = addressResult.rows[0].customerid
        await db.query(
          'UPDATE customer_addresses SET isprimary = false WHERE customerid = $1 AND id != $2',
          [customerId, id]
        )
      }
    }

    // Construir query de actualización dinámica
    const updateFields = []
    const values = []
    let valueIndex = 1

    const fieldMapping: { [key: string]: string } = {
      street: 'street',
      number: 'number',
      apartment: 'apartment',
      reparto: 'reparto',
      floor: 'floor',
      city: 'city',
      state: 'state',
      zipCode: 'zipcode',
      country: 'country',
      provinceId: 'province_id',
      provinceName: 'province_name',
      municipalityId: 'municipality_id',
      municipalityName: 'municipality_name',
      deliveryInstructions: 'delivery_instructions',
      addressType: 'address_type',
      latitude: 'latitude',
      longitude: 'longitude',
      entryPin: 'entry_pin',
      entryInstructions: 'entry_instructions',
      notes: 'notes',
      isPrimary: 'isprimary'
    }

    for (const [key, value] of Object.entries(updateData)) {
      if (fieldMapping[key] !== undefined) {
        updateFields.push(`${fieldMapping[key]} = $${valueIndex}`)
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

    values.push(id)

    const updateQuery = `
      UPDATE customer_addresses
      SET ${updateFields.join(', ')}
      WHERE id = $${valueIndex}
      RETURNING
        id,
        customerid as "customerId",
        street,
        number,
        apartment,
        reparto,
        floor,
        city,
        state,
        zipcode as "zipCode",
        country,
        province_id as "provinceId",
        province_name as "provinceName",
        municipality_id as "municipalityId",
        municipality_name as "municipalityName",
        delivery_instructions as "deliveryInstructions",
        address_type as "addressType",
        latitude,
        longitude,
        entry_pin as "entryPin",
        entry_instructions as "entryInstructions",
        notes,
        isprimary as "isPrimary",
        createdat as "createdAt"
    `

    const result = await db.query(updateQuery, values)

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró la dirección'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Dirección actualizada exitosamente'
    })

  } catch (error) {
    console.error('Error updating customer address:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar dirección del cliente'
    }, { status: 500 })
  }
}

// DELETE: Eliminar dirección
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere ID de la dirección'
      }, { status: 400 })
    }

    const addressId = parseInt(id)
    if (isNaN(addressId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de dirección inválido'
      }, { status: 400 })
    }

    // No permitir eliminar si es la única dirección primaria del cliente
    const checkQuery = `
      SELECT
        ca.customerid,
        ca.isprimary,
        COUNT(*) OVER (PARTITION BY ca.customerid) as total_addresses
      FROM customer_addresses ca
      WHERE ca.id = $1
    `
    const checkResult = await db.query(checkQuery, [addressId])

    if (checkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró la dirección'
      }, { status: 404 })
    }

    const addressInfo = checkResult.rows[0]
    if (addressInfo.isprimary && addressInfo.total_addresses === 1) {
      return NextResponse.json({
        success: false,
        error: 'No se puede eliminar la única dirección del cliente'
      }, { status: 400 })
    }

    // Eliminar la dirección
    const deleteQuery = 'DELETE FROM customer_addresses WHERE id = $1 RETURNING id'
    const result = await db.query(deleteQuery, [addressId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró la dirección'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Dirección eliminada exitosamente'
    })

  } catch (error) {
    console.error('Error deleting customer address:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al eliminar dirección del cliente'
    }, { status: 500 })
  }
}