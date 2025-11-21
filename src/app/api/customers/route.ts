import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


// GET: Endpoint global para consulta de clientes desde cualquier vista
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)
    const phone = searchParams.get('phone')
    const search = searchParams.get('search')
    const id = searchParams.get('id')
    const options = searchParams.get('options')
    const stats = searchParams.get('stats')
    const checkUnique = searchParams.get('checkUnique')
    const excludeId = searchParams.get('excludeId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')
    const companyIdParam = searchParams.get('companyId')
    const companyIdFilter = companyIdParam ? parseInt(companyIdParam) : headerCompanyId

    // Validar que usuarios no SUPER_ADMIN tengan company_id
    if (!isSuperAdmin && !companyIdFilter) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo determinar la empresa del usuario'
      }, { status: 400 })
    }

    // Obtener estadísticas de clientes
    if (stats === 'true') {
      let totalQuery = 'SELECT COUNT(*) as total FROM customers'
      let activeQuery = 'SELECT COUNT(*) as active FROM customers WHERE createdat >= NOW() - INTERVAL \'30 days\''
      const queryParams: any[] = []

      if (!isSuperAdmin) {
        totalQuery += ' WHERE company_id = $1'
        activeQuery += ' AND company_id = $1'
        queryParams.push(headerCompanyId)
      } else if (companyIdParam) {
        totalQuery += ' WHERE company_id = $1'
        activeQuery += ' AND company_id = $1'
        queryParams.push(parseInt(companyIdParam))
      }

      const totalResult = await db.query(totalQuery, queryParams.length > 0 ? queryParams : undefined)
      const activeResult = await db.query(activeQuery, queryParams.length > 0 ? queryParams : undefined)

      return NextResponse.json({
        success: true,
        data: {
          total: parseInt(totalResult.rows[0].total),
          active: parseInt(activeResult.rows[0].active),
          inactive: parseInt(totalResult.rows[0].total) - parseInt(activeResult.rows[0].active)
        }
      })
    }

    // Verificar si teléfono es único (dentro de la empresa)
    if (checkUnique) {
      let query = 'SELECT COUNT(*) as count FROM customers WHERE phone = $1'
      let params: any[] = [checkUnique]

      // Agregar filtro por empresa
      if (!isSuperAdmin) {
        query += ' AND company_id = $2'
        params.push(headerCompanyId)
      } else if (companyIdParam) {
        query += ' AND company_id = $2'
        params.push(parseInt(companyIdParam))
      }

      if (excludeId) {
        query += ` AND id != $${params.length + 1}`
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
      let query = `
        SELECT
          id,
          firstname as "firstName",
          lastname as "lastName",
          phone
        FROM customers`

      const queryParams: any[] = []

      if (!isSuperAdmin) {
        query += '\n        WHERE company_id = $1'
        queryParams.push(headerCompanyId)
      } else if (companyIdParam) {
        query += '\n        WHERE company_id = $1'
        queryParams.push(parseInt(companyIdParam))
      }

      query += '\n        ORDER BY firstname, lastname'

      const result = await db.query(query, queryParams.length > 0 ? queryParams : undefined)

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
      let query = `
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
          apartment,
          has_alternate_contact as "hasAlternateContact",
          alternate_contact_name as "alternateContactName",
          alternate_contact_phone as "alternateContactPhone"
        FROM customers
        WHERE id = $1`

      const queryParams: any[] = [parseInt(id)]

      if (!isSuperAdmin) {
        query += ' AND company_id = $2'
        queryParams.push(headerCompanyId)
      } else if (companyIdParam) {
        query += ' AND company_id = $2'
        queryParams.push(parseInt(companyIdParam))
      }

      const result = await db.query(query, queryParams)

      return NextResponse.json({
        success: true,
        data: result.rows
      })
    }

    // Buscar por teléfono específico
    if (phone) {
      let query = `
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
          apartment,
          has_alternate_contact as "hasAlternateContact",
          alternate_contact_name as "alternateContactName",
          alternate_contact_phone as "alternateContactPhone"
        FROM customers
        WHERE phone = $1`

      const queryParams: any[] = [phone]

      if (!isSuperAdmin) {
        query += ' AND company_id = $2'
        queryParams.push(headerCompanyId)
      } else if (companyIdParam) {
        query += ' AND company_id = $2'
        queryParams.push(parseInt(companyIdParam))
      }

      const result = await db.query(query, queryParams)

      return NextResponse.json({
        success: true,
        data: result.rows
      })
    }

    // Buscar por texto
    if (search) {
      const searchPattern = `%${search}%`
      let query = `
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
          apartment,
          has_alternate_contact as "hasAlternateContact",
          alternate_contact_name as "alternateContactName",
          alternate_contact_phone as "alternateContactPhone"
        FROM customers
        WHERE
          (firstname ILIKE $1 OR
          lastname ILIKE $1 OR
          phone ILIKE $1 OR
          email ILIKE $1 OR
          idnumber ILIKE $1 OR
          CONCAT(firstname, ' ', lastname) ILIKE $1)`

      const queryParams: any[] = [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern]

      if (!isSuperAdmin) {
        query += '\n          AND company_id = $7'
        queryParams.push(headerCompanyId)
      } else if (companyIdParam) {
        query += '\n          AND company_id = $7'
        queryParams.push(parseInt(companyIdParam))
      }

      query += '\n        ORDER BY firstname, lastname\n        LIMIT 50'

      const result = await db.query(query, queryParams)

      return NextResponse.json({
        success: true,
        data: result.rows
      })
    }

    // Obtener todos los clientes con paginación
    const offset = (page - 1) * limit
    let query = `
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
        apartment,
        has_alternate_contact as "hasAlternateContact",
        alternate_contact_name as "alternateContactName",
        alternate_contact_phone as "alternateContactPhone"
      FROM customers`

    const queryParams: any[] = []
    let countQuery = 'SELECT COUNT(*) as total FROM customers'

    if (!isSuperAdmin) {
      query += '\n      WHERE company_id = $1'
      countQuery += ' WHERE company_id = $1'
      queryParams.push(headerCompanyId)
    } else if (companyIdParam) {
      query += '\n      WHERE company_id = $1'
      countQuery += ' WHERE company_id = $1'
      queryParams.push(parseInt(companyIdParam))
    }

    query += `\n      ORDER BY createdat DESC\n      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`
    queryParams.push(limit, offset)

    const result = await db.query(query, queryParams)

    // Get total count for pagination
    const countParams = queryParams.slice(0, queryParams.length - 2) // Exclude limit and offset
    const countResult = await db.query(countQuery, countParams.length > 0 ? countParams : undefined)
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
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)

    // Determinar el company_id a usar
    const companyIdToUse = body.companyId || headerCompanyId

    // Validar que usuarios no SUPER_ADMIN tengan company_id
    if (!isSuperAdmin && !companyIdToUse) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo determinar la empresa del usuario'
      }, { status: 400 })
    }

    // Validar campos requeridos
    if (!body.firstName || !body.lastName || !body.phone) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos (firstName, lastName, phone)'
      }, { status: 400 })
    }

    // Verificar si el teléfono ya existe (dentro de la misma empresa)
    let existingQuery = 'SELECT id FROM customers WHERE phone = $1'
    const existingParams: any[] = [body.phone]

    if (!isSuperAdmin || companyIdToUse) {
      existingQuery += ' AND company_id = $2'
      existingParams.push(companyIdToUse)
    }

    const existingResult = await db.query(existingQuery, existingParams)

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
        createdat, zipcode, apartment,
        has_alternate_contact, alternate_contact_name, alternate_contact_phone,
        company_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13, $14, $15, $16, $17, $18
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
        apartment,
        has_alternate_contact as "hasAlternateContact",
        alternate_contact_name as "alternateContactName",
        alternate_contact_phone as "alternateContactPhone",
        company_id as "companyId"
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
      body.apartment || null,
      body.hasAlternateContact || false,
      body.alternateContactName || null,
      body.alternateContactPhone || null,
      companyIdToUse
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
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID del cliente es requerido'
      }, { status: 400 })
    }

    // Verificar que el cliente pertenece a la empresa del usuario
    if (!isSuperAdmin && headerCompanyId) {
      const checkQuery = 'SELECT id FROM customers WHERE id = $1 AND company_id = $2'
      const checkResult = await db.query(checkQuery, [id, headerCompanyId])

      if (checkResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No tiene permisos para actualizar este cliente'
        }, { status: 403 })
      }
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
      apartment: 'apartment',
      hasAlternateContact: 'has_alternate_contact',
      alternateContactName: 'alternate_contact_name',
      alternateContactPhone: 'alternate_contact_phone'
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
        apartment,
        has_alternate_contact as "hasAlternateContact",
        alternate_contact_name as "alternateContactName",
        alternate_contact_phone as "alternateContactPhone"
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
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID del cliente es requerido'
      }, { status: 400 })
    }

    // Verificar que el cliente pertenece a la empresa del usuario
    if (!isSuperAdmin && headerCompanyId) {
      const checkQuery = 'SELECT id FROM customers WHERE id = $1 AND company_id = $2'
      const checkResult = await db.query(checkQuery, [parseInt(id), headerCompanyId])

      if (checkResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No tiene permisos para eliminar este cliente'
        }, { status: 403 })
      }
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