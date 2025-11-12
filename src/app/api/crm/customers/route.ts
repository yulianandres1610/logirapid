import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Función para validar formato de teléfono según país
function validatePhoneNumber(phone: string, country?: string): { valid: boolean; error?: string } {
  // Limpiar el número de teléfono (quitar espacios, guiones, paréntesis)
  const cleanedPhone = phone.replace(/\s+/g, '').replace(/[-()]/g, '')

  // Eliminar prefijo + si existe
  const digitsOnly = cleanedPhone.replace(/^\+/, '')

  if (!digitsOnly || isNaN(Number(digitsOnly))) {
    return { valid: false, error: 'El teléfono debe contener solo números' }
  }

  // Validar según el país
  if (country === 'Cuba' || country === 'CU') {
    // Para Cuba: 8 dígitos (ej: 5xxxxxxxx)
    if (digitsOnly.length !== 8) {
      return { valid: false, error: 'El teléfono para Cuba debe tener 8 dígitos (ej: 5xxxxxxxx)' }
    }
    // Validar que comience con 5 para móviles cubanos
    if (!digitsOnly.startsWith('5')) {
      return { valid: false, error: 'El teléfono móvil para Cuba debe comenzar con 5 (ej: 5xxxxxxxx)' }
    }
  } else if (country === 'Estados Unidos' || country === 'United States' || country === 'US' || country === 'USA') {
    // Para Estados Unidos: 10 dígitos
    if (digitsOnly.length !== 10) {
      return { valid: false, error: 'El teléfono para Estados Unidos debe tener 10 dígitos' }
    }
  } else {
    // Si no se especifica país, validar longitud común (8-10 dígitos)
    if (digitsOnly.length < 8 || digitsOnly.length > 15) {
      return { valid: false, error: 'El teléfono debe tener entre 8 y 15 dígitos' }
    }
  }

  return { valid: true }
}

// GET: Obtener todos los clientes o buscar por parámetro
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')
    const search = searchParams.get('search')

    let query: string
    let params: any[] = []

    if (phone) {
      // Buscar por teléfono específico
      query = `
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
      params = [phone]
    } else if (search) {
      // Buscar por texto
      const searchPattern = `%${search}%`
      query = `
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
      params = [searchPattern]
    } else {
      // Obtener todos los clientes
      query = `
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
        LIMIT 100
      `
      params = []
    }

    const result = await db.query(query, params)

    return NextResponse.json({
      success: true,
      data: result.rows
    })

  } catch (error) {
    console.error('Error getting customers:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener clientes'
    }, { status: 500 })
  }
}

// POST: Crear nuevo cliente
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar campos obligatorios
    const fullName = body.fullName || `${body.firstName || ''} ${body.lastName || ''}`.trim()

    // Handle address validation - accept both string and object format
    let address = ''
    let city = ''
    let state = ''
    let zipCode = ''
    let country = ''

    if (typeof body.address === 'string') {
      address = body.address
    } else if (body.address?.street) {
      address = body.address.street
      city = body.address.city || ''
      state = body.address.state || ''
      zipCode = body.address.zipCode || ''
      country = body.address.country || ''
    } else if (body.address && typeof body.address === 'object') {
      // For backwards compatibility, try to construct address from object
      address = body.address.street || ''
      city = body.address.city || ''
      state = body.address.state || ''
      zipCode = body.address.zipCode || ''
      country = body.address.country || ''
    }

    if (!body || !fullName || !body.phone || !address) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos (fullName, phone, address)'
      }, { status: 400 })
    }

    // ✅ VALIDACIÓN CRÍTICA: Asegurar dirección completa para geocodificación precisa
    if (!city || !state || !zipCode) {
      console.error('❌ Validación fallida: dirección incompleta', { address, city, state, zipCode })
      return NextResponse.json({
        success: false,
        error: 'La dirección debe incluir ciudad, estado y código postal para garantizar coordenadas precisas en la entrega'
      }, { status: 400 })
    }

    // Validar formato de código postal (5 dígitos para US)
    if (!/^\d{5}(-\d{4})?$/.test(zipCode)) {
      return NextResponse.json({
        success: false,
        error: 'El código postal debe tener 5 dígitos (ej: 33012)'
      }, { status: 400 })
    }

    // Validar que el nombre no esté vacío después de limpiar
    if (fullName.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'El campo nombre completo no puede estar vacío'
      }, { status: 400 })
    }

    // Validar formato de teléfono según el país
    const phoneValidation = validatePhoneNumber(body.phone, country || body.country)
    if (!phoneValidation.valid) {
      return NextResponse.json({
        success: false,
        error: phoneValidation.error
      }, { status: 400 })
    }

    // Split fullName into firstName and lastName for database compatibility
    const nameParts = fullName.trim().split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    console.log('🔝 NAME SPLITTING:', { fullName, firstName, lastName })
    console.log('📍 ADDRESS FIELDS:', { address, city, state, zipCode, country })

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
      firstName,
      lastName,
      body.idNumber || null,
      body.idType || null,
      body.phone,
      body.email || null,
      address,
      city || null,
      state || null,
      country || null,
      body.notes || null,
      body.createdBy || 'system',
      zipCode || null,
      body.apartment || null
    ]

    const result = await db.query(insertQuery, values)
    const newCustomer = result.rows[0]

    console.log('✅ CUSTOMER CREATED:', newCustomer)

    return NextResponse.json({
      success: true,
      data: newCustomer,
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

// PUT: Actualizar cliente existente
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, changedBy, ...updateData } = body

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere ID del cliente'
      }, { status: 400 })
    }

    if (!changedBy) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere el usuario que realiza el cambio (changedBy)'
      }, { status: 400 })
    }

    // Primero obtener el cliente actual para el historial
    const currentQuery = `
      SELECT * FROM customers WHERE id = $1
    `
    const currentResult = await db.query(currentQuery, [id])

    if (currentResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró el cliente'
      }, { status: 404 })
    }

    const currentCustomer = currentResult.rows[0]

    // Guardar en el historial de cambios
    const historyQuery = `
      INSERT INTO customer_change_history (
        customerid, changedate, changedby,
        oldfirstname, newfirstname,
        oldlastname, newlastname,
        oldidnumber, newidnumber,
        oldidtype, newidtype,
        oldphone, newphone,
        oldemail, newemail,
        oldaddress, newaddress,
        oldcity, newcity,
        oldstate, newstate,
        oldcountry, newcountry,
        oldnotes, newnotes,
        oldzipcode, newzipcode,
        oldapartment, newapartment
      ) VALUES (
        $1, NOW(), $2,
        $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22,
        $23, $24, $25, $26, $27, $28
      )
    `

    const historyValues = [
      id,
      changedBy,
      currentCustomer.firstname, updateData.firstName || currentCustomer.firstname,
      currentCustomer.lastname, updateData.lastName || currentCustomer.lastname,
      currentCustomer.idnumber, updateData.idNumber || currentCustomer.idnumber,
      currentCustomer.idtype, updateData.idType || currentCustomer.idtype,
      currentCustomer.phone, updateData.phone || currentCustomer.phone,
      currentCustomer.email, updateData.email || currentCustomer.email,
      currentCustomer.address, updateData.address || currentCustomer.address,
      currentCustomer.city, updateData.city || currentCustomer.city,
      currentCustomer.state, updateData.state || currentCustomer.state,
      currentCustomer.country, updateData.country || currentCustomer.country,
      currentCustomer.notes, updateData.notes || currentCustomer.notes,
      currentCustomer.zipcode, updateData.zipCode || currentCustomer.zipcode,
      currentCustomer.apartment, updateData.apartment || currentCustomer.apartment
    ]

    await db.query(historyQuery, historyValues)

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
    `

    await db.query(updateQuery, values)

    return NextResponse.json({
      success: true,
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

// DELETE: Eliminar cliente (solo para superadmins)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere ID del cliente'
      }, { status: 400 })
    }

    const customerId = parseInt(id)
    if (isNaN(customerId)) {
      return NextResponse.json({
        success: false,
        error: 'ID del cliente inválido'
      }, { status: 400 })
    }

    // Verificar rol de superadmin (usando headers del middleware)
    const userRole = request.headers.get('x-user-role')

    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'No tienes permisos para eliminar clientes'
      }, { status: 403 })
    }

    // Verificar si el cliente tiene órdenes asociadas
    const ordersQuery = 'SELECT COUNT(*) as count FROM package_orders WHERE customerid = $1'
    const ordersResult = await db.query(ordersQuery, [customerId])

    if (parseInt(ordersResult.rows[0].count) > 0) {
      return NextResponse.json({
        success: false,
        error: 'No se puede eliminar el cliente porque tiene órdenes asociadas'
      }, { status: 400 })
    }

    // Eliminar direcciones asociadas primero
    await db.query('DELETE FROM customer_addresses WHERE customer_id = $1', [customerId])

    // Eliminar historial de cambios
    await db.query('DELETE FROM customer_change_history WHERE customerid = $1', [customerId])

    // Eliminar el cliente
    const deleteQuery = 'DELETE FROM customers WHERE id = $1 RETURNING id'
    const result = await db.query(deleteQuery, [customerId])

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
      error: error instanceof Error ? error.message : 'Error al eliminar cliente'
    }, { status: 500 })
  }
}