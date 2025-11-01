import { NextRequest, NextResponse } from 'next/server'
import {
  getCustomerByPhoneGlobal,
  searchCustomersGlobal,
  getCustomerByIdGlobal,
  getAllCustomersGlobal,
  getCustomerSelectOptions,
  isPhoneUniqueGlobal,
  getCustomersStats
} from '@/lib/database'

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

    // Obtener estadísticas de clientes
    if (stats === 'true') {
      const customersStats = getCustomersStats()
      return NextResponse.json({
        success: true,
        data: customersStats
      })
    }

    // Verificar si teléfono es único
    if (checkUnique) {
      const isUnique = isPhoneUniqueGlobal(
        checkUnique,
        excludeId ? parseInt(excludeId) : undefined
      )
      return NextResponse.json({
        success: true,
        data: { isUnique }
      })
    }

    // Obtener opciones para selects
    if (options === 'true') {
      const customerOptions = getCustomerSelectOptions()
      return NextResponse.json({
        success: true,
        data: customerOptions
      })
    }

    // Buscar por ID específico
    if (id) {
      const customer = getCustomerByIdGlobal(parseInt(id))
      return NextResponse.json({
        success: true,
        data: customer ? [customer] : []
      })
    }

    // Buscar por teléfono específico
    if (phone) {
      const customer = getCustomerByPhoneGlobal(phone)
      return NextResponse.json({
        success: true,
        data: customer ? [customer] : []
      })
    }

    // Buscar por texto
    if (search) {
      const customers = searchCustomersGlobal(search)
      return NextResponse.json({
        success: true,
        data: customers
      })
    }

    // Obtener todos los clientes
    const customers = getAllCustomersGlobal()
    return NextResponse.json({
      success: true,
      data: customers
    })

  } catch (error) {
    console.error('Error in global customers API:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener información de clientes'
    }, { status: 500 })
  }
}