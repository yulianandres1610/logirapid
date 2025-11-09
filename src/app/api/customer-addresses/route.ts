import { NextRequest, NextResponse } from 'next/server'
import {
  addCustomerAddress,
  getCustomerAddresses,
  getPrimaryCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress
} from '@/lib/database'

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

    let addresses
    if (primary === 'true') {
      addresses = getPrimaryCustomerAddress(customerIdNum)
    } else {
      addresses = getCustomerAddresses(customerIdNum)
    }

    return NextResponse.json({
      success: true,
      data: addresses
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

    const newAddress = addCustomerAddress(body.customerId, {
      street: body.street,
      apartment: body.apartment,
      city: body.city,
      state: body.state,
      zipCode: body.zipCode,
      country: body.country,
      notes: body.notes,
      isPrimary: body.isPrimary || false
    })

    return NextResponse.json({
      success: true,
      data: newAddress,
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

    const updated = updateCustomerAddress(id, updateData)

    if (!updated) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró la dirección o no hay cambios'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
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

    const deleted = deleteCustomerAddress(addressId)

    if (!deleted) {
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