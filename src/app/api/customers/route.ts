import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// GET: Endpoint global para consulta de clientes desde cualquier vista
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')
    const search = searchParams.get('search')
    const id = searchParams.get('id')
    const options = searchParams.get('options')
    const stats = searchParams.get('stats')
    const checkUnique = searchParams.get('checkUnique')
    const excludeId = searchParams.get('excludeId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')

    // Obtener estadísticas de clientes
    if (stats === 'true') {
      const totalQuery = 'SELECT COUNT(*) as total FROM customers'
      const activeQuery = 'SELECT COUNT(*) as active FROM customers WHERE createdat >= NOW() - INTERVAL \'30 days\''

      const totalResult = await db.query(totalQuery)
      const activeResult = await db.query(activeQuery)

      return NextResponse.json({
        success: true,
        data: {
          total: parseInt(totalResult.rows[0].total),
          active: parseInt(activeResult.rows[0].active),
          inactive: parseInt(totalResult.rows[0].total) - parseInt(activeResult.rows[0].active)
        }
      })
    }

    // Verificar si teléfono es único
    if (checkUnique) {
      let query = 'SELECT COUNT(*) as count FROM customers WHERE phone = $1'
      let params: any[] = [checkUnique]

      if (excludeId) {
        query += ' AND id != $2'
        params.push(parseInt(excludeId))
      }

      const result = await db.query(query, params)
      const isUnique = parseInt(result.rows[0].count) === 0

      return NextResponse.json({
        success: true,
        data: { isUnique }
      })
    }

    // Obtener opciones para selects (lista simplificada para dropdowns)
    if (options === 'true') {
      const query = `
        SELECT
          id,
          firstname as "firstName",
          lastname as "lastName",
          phone
        FROM customers
        ORDER BY firstname, lastname
      `
      const result = await db.query(query)

      const customerOptions = result.rows.map(customer => ({
        value: customer.id,
        label: `${customer.firstName} ${customer.lastName}`,
        phone: customer.phone
      }))

      return NextResponse.json({
        success: true,
        data: customerOptions
      })
    }

    // Buscar por ID específico
    if (id) {
      const query = `
        SELECT
          id,
          firstname as "firstName",
          lastname as "lastName",
          idnumber as "idNumber",
          idtype as "idType",
          phone,
          email,
          address,
          city,
          state,
          country,
          notes,
          createdby as "createdBy",
          createdat as "createdAt",
          zipcode as "zipCode",
          apartment
        FROM customers
        WHERE id = $1
      `
      const result = await db.query(query, [parseInt(id)])

      return NextResponse.json({
        success: true,
        data: result.rows
      })
    }

    // Buscar por teléfono específico
    if (phone) {
      const query = `
        SELECT
          id,
          firstname as "firstName",
          lastname as "lastName",
          idnumber as "idNumber",
          idtype as "idType",
          phone,
          email,
          address,
          city,
          state,
          country,
          notes,
          createdby as "createdBy",
          createdat as "createdAt",
          zipcode as "zipCode",
          apartment
        FROM customers
        WHERE phone = $1
      `
      const result = await db.query(query, [phone])

      return NextResponse.json({
        success: true,
        data: result.rows
      })
    }

    // Buscar por texto
    if (search) {
      const searchPattern = `%${search}%`
      const query = `
        SELECT
          id,
          firstname as "firstName",
          lastname as "lastName",
          idnumber as "idNumber",
          idtype as "idType",
          phone,
          email,
          address,
          city,
          state,
          country,
          notes,
          createdby as "createdBy",
          createdat as "createdAt",
          zipcode as "zipCode",
          apartment
        FROM customers
        WHERE
          firstname ILIKE $1 OR
          lastname ILIKE $1 OR
          phone ILIKE $1 OR
          email ILIKE $1 OR
          idnumber ILIKE $1 OR
          CONCAT(firstname, ' ', lastname) ILIKE $1
        ORDER BY firstname, lastname
        LIMIT 50
      `
      const result = await db.query(query, [searchPattern])

      return NextResponse.json({
        success: true,
        data: result.rows
      })
    }

    // Obtener todos los clientes con paginación
    const offset = (page - 1) * limit
    const query = `
      SELECT
        id,
        firstname as "firstName",
        lastname as "lastName",
        idnumber as "idNumber",
        idtype as "idType",
        phone,
        email,
        address,
        city,
        state,
        country,
        notes,
        createdby as "createdBy",
        createdat as "createdAt",
        zipcode as "zipCode",
        apartment
      FROM customers
      ORDER BY createdat DESC
      LIMIT $1 OFFSET $2
    `
    const result = await db.query(query, [limit, offset])

    // Get total count for pagination
    const countResult = await db.query('SELECT COUNT(*) as total FROM customers')
    const total = parseInt(countResult.rows[0].total)

    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error in global customers API:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener información de clientes'
    }, { status: 500 })
  }
}

// POST: Crear nuevo cliente
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar campos requeridos
    if (!body.firstName || !body.lastName || !body.phone) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos (firstName, lastName, phone)'
      }, { status: 400 })
    }

    // Verificar si el teléfono ya existe
    const existingQuery = 'SELECT id FROM customers WHERE phone = $1'
    const existingResult = await db.query(existingQuery, [body.phone])

    if (existingResult.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Ya existe un cliente con este número de teléfono'
      }, { status: 400 })
    }

    // Insertar nuevo cliente
    const insertQuery = `
      INSERT INTO customers (
        firstname, lastname, idnumber, idtype, phone, email,
        address, city, state, country, notes, createdby,
        createdat, zipcode, apartment
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13, $14
      )
      RETURNING
        id,
        firstname as "firstName",
        lastname as "lastName",
        idnumber as "idNumber",
        idtype as "idType",
        phone,
        email,
        address,
        city,
        state,
        country,
        notes,
        createdby as "createdBy",
        createdat as "createdAt",
        zipcode as "zipCode",
        apartment
    `

    const values = [
      body.firstName,
      body.lastName,
      body.idNumber || null,
      body.idType || null,
      body.phone,
      body.email || null,
      body.address || null,
      body.city || null,
      body.state || null,
      body.country || null,
      body.notes || null,
      body.createdBy || 'system',
      body.zipCode || null,
      body.apartment || null
    ]

    const result = await db.query(insertQuery, values)

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Cliente creado exitosamente'
    })

  } catch (error) {
    console.error('Error creating customer:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al crear cliente'
    }, { status: 500 })
  }
}

// PUT: Actualizar cliente
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID del cliente es requerido'
      }, { status: 400 })
    }

    // Construir query de actualización dinámica
    const updateFields = []
    const values = []
    let valueIndex = 1

    const fieldMapping: { [key: string]: string } = {
      firstName: 'firstname',
      lastName: 'lastname',
      idNumber: 'idnumber',
      idType: 'idtype',
      phone: 'phone',
      email: 'email',
      address: 'address',
      city: 'city',
      state: 'state',
      country: 'country',
      notes: 'notes',
      zipCode: 'zipcode',
      apartment: 'apartment'
    }

    for (const [key, value] of Object.entries(updateData)) {
      if (fieldMapping[key]) {
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
      UPDATE customers
      SET ${updateFields.join(', ')}
      WHERE id = $${valueIndex}
      RETURNING
        id,
        firstname as "firstName",
        lastname as "lastName",
        idnumber as "idNumber",
        idtype as "idType",
        phone,
        email,
        address,
        city,
        state,
        country,
        notes,
        createdby as "createdBy",
        createdat as "createdAt",
        zipcode as "zipCode",
        apartment
    `

    const result = await db.query(updateQuery, values)

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Cliente no encontrado'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Cliente actualizado exitosamente'
    })

  } catch (error) {
    console.error('Error updating customer:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar cliente'
    }, { status: 500 })
  }
}

// DELETE: Eliminar cliente
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID del cliente es requerido'
      }, { status: 400 })
    }

    // Verificar si el cliente tiene órdenes asociadas
    const ordersQuery = 'SELECT COUNT(*) as count FROM package_orders WHERE customerid = $1'
    const ordersResult = await db.query(ordersQuery, [parseInt(id)])

    if (parseInt(ordersResult.rows[0].count) > 0) {
      return NextResponse.json({
        success: false,
        error: 'No se puede eliminar el cliente porque tiene órdenes asociadas'
      }, { status: 400 })
    }

    // Eliminar direcciones asociadas primero
    await db.query('DELETE FROM customer_addresses WHERE customer_id = $1', [parseInt(id)])

    // Eliminar el cliente
    const deleteQuery = 'DELETE FROM customers WHERE id = $1 RETURNING id'
    const result = await db.query(deleteQuery, [parseInt(id)])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Cliente no encontrado'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Cliente eliminado exitosamente'
    })

  } catch (error) {
    console.error('Error deleting customer:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al eliminar cliente'
    }, { status: 500 })
  }
}