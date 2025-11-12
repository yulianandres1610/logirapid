import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// GET: Obtener direcciones de un cliente
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')
    const primary = searchParams.get('primary')

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

    if (primary === 'true') {
      query = `
        SELECT
          id,
          customerid as "customerId",
          street,
          apartment,
          city,
          state,
          zipcode as "zipCode",
          country,
          notes,
          isprimary as "isPrimary",
          createdat as "createdAt"
        FROM customer_addresses
        WHERE customerid = $1 AND isprimary = true
        LIMIT 1
      `
    } else {
      query = `
        SELECT
          id,
          customerid as "customerId",
          street,
          apartment,
          city,
          state,
          zipcode as "zipCode",
          country,
          notes,
          isprimary as "isPrimary",
          createdat as "createdAt"
        FROM customer_addresses
        WHERE customerid = $1
        ORDER BY isprimary DESC, createdat DESC
      `
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
    const body = await request.json()

    // Validar campos requeridos
    if (!body || !body.customerId || !body.street || !body.city || !body.country) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos (customerId, street, city, country)'
      }, { status: 400 })
    }

    // ✅ VALIDACIÓN CRÍTICA: Asegurar dirección completa para geocodificación precisa
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

    // Si esta dirección será primaria, actualizar las otras a no primarias
    if (body.isPrimary) {
      await db.query(
        'UPDATE customer_addresses SET isprimary = false WHERE customerid = $1',
        [body.customerId]
      )
    }

    // Insertar nueva dirección
    const insertQuery = `
      INSERT INTO customer_addresses (
        customerid, street, apartment, city, state, zipcode,
        country, notes, isprimary, createdat
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
      )
      RETURNING
        id,
        customerid as "customerId",
        street,
        apartment,
        city,
        state,
        zipcode as "zipCode",
        country,
        notes,
        isprimary as "isPrimary",
        createdat as "createdAt"
    `

    const values = [
      body.customerId,
      body.street,
      body.apartment || null,
      body.city,
      body.state,
      body.zipCode,
      body.country,
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
      apartment: 'apartment',
      city: 'city',
      state: 'state',
      zipCode: 'zipcode',
      country: 'country',
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
        apartment,
        city,
        state,
        zipcode as "zipCode",
        country,
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