import { NextRequest, NextResponse } from 'next/server'
import {
  getAllCustomers,
  getCustomerByPhone,
  searchCustomers,
  saveCustomer,
  updateCustomer,
  updateCustomerWithHistory,
  deleteCustomer
} from '@/lib/database'

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

    let customers

    if (phone) {
      // Buscar por teléfono específico
      const customer = getCustomerByPhone(phone)
      customers = customer ? [customer] : []
    } else if (search) {
      // Buscar por texto
      customers = searchCustomers(search)
    } else {
      // Obtener todos los clientes
      customers = getAllCustomers()
    }

    return NextResponse.json({
      success: true,
      data: customers
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

    const newCustomer = saveCustomer({
      firstName: firstName, // Use split firstName
      lastName: lastName,  // Use split lastName
      idNumber: body.idNumber,
      idType: body.idType,
      phone: body.phone,
      email: body.email,
      address: address,
      city: city,
      state: state,
      zipCode: zipCode,
      country: country,
      notes: body.notes,
      createdBy: body.createdBy || 'system'
    })

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

    const updatedCustomer = updateCustomerWithHistory(id, updateData, changedBy)

    if (updatedCustomer.changes === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró el cliente o no hay cambios'
      }, { status: 404 })
    }

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

    // Eliminar cliente
    const result = deleteCustomer(customerId)

    return NextResponse.json({
      success: true,
      message: 'Cliente eliminado exitosamente',
      changes: result.changes
    })

  } catch (error) {
    console.error('Error deleting customer:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar cliente'
    }, { status: 500 })
  }
}