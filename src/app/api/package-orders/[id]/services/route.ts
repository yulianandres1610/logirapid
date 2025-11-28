import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

// POST: Agregar un servicio a la orden
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const orderId = parseInt(resolvedParams.id)
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    const body = await request.json()
    const {
      serviceId,
      type,
      name,
      quantity = 1,
      price = 0,
      weight = null,
      basePrice = null,
      pricePerUnit = null,
      pricingModel = null
    } = body

    if (!type || !name) {
      return NextResponse.json({
        success: false,
        error: 'Tipo y nombre de servicio son requeridos'
      }, { status: 400 })
    }

    // Verificar que la orden existe y obtener servicios actuales
    let orderQuery = 'SELECT id, services, totalamount, company_id FROM package_orders WHERE id = $1'
    const orderParams: any[] = [orderId]

    if (!isSuperAdmin && headerCompanyId) {
      orderQuery += ' AND company_id = $2'
      orderParams.push(headerCompanyId)
    }

    const orderResult = await db.query(orderQuery, orderParams)

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Parsear servicios existentes
    let services = []
    try {
      services = typeof order.services === 'string'
        ? JSON.parse(order.services)
        : (order.services || [])
    } catch (e) {
      services = []
    }

    // Agregar nuevo servicio
    const newService: any = {
      id: serviceId || Date.now(), // ID único
      type,
      name,
      quantity: parseInt(quantity.toString()) || 1,
      price: parseFloat(price.toString()) || 0,
      addedAt: new Date().toISOString()
    }

    // Agregar campos opcionales si existen
    if (weight !== null) newService.weight = parseFloat(weight.toString()) || 0
    if (basePrice !== null) newService.basePrice = parseFloat(basePrice.toString()) || 0
    if (pricePerUnit !== null) newService.pricePerUnit = parseFloat(pricePerUnit.toString()) || 0
    if (pricingModel) newService.pricingModel = pricingModel

    services.push(newService)

    // Recalcular total
    const currentTotal = parseFloat(order.totalamount) || 0
    const serviceSubtotal = newService.price * newService.quantity
    const newTotal = currentTotal + serviceSubtotal

    // Actualizar la orden
    const updateQuery = `
      UPDATE package_orders SET
        services = $1,
        totalamount = $2,
        updatedat = NOW()
      WHERE id = $3
      RETURNING id, services, totalamount
    `

    const updateResult = await db.query(updateQuery, [
      JSON.stringify(services),
      newTotal,
      orderId
    ])

    return NextResponse.json({
      success: true,
      data: {
        service: newService,
        totalServices: services.length,
        newTotal: newTotal
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Error adding service:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al agregar servicio'
    }, { status: 500 })
  }
}

// DELETE: Eliminar un servicio de la orden
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const orderId = parseInt(resolvedParams.id)
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const serviceIndex = parseInt(searchParams.get('index') || '-1')
    const serviceId = searchParams.get('serviceId')

    if (serviceIndex < 0 && !serviceId) {
      return NextResponse.json({
        success: false,
        error: 'Índice o ID de servicio es requerido'
      }, { status: 400 })
    }

    // Verificar que la orden existe
    let orderQuery = 'SELECT id, services, totalamount, company_id FROM package_orders WHERE id = $1'
    const orderParams: any[] = [orderId]

    if (!isSuperAdmin && headerCompanyId) {
      orderQuery += ' AND company_id = $2'
      orderParams.push(headerCompanyId)
    }

    const orderResult = await db.query(orderQuery, orderParams)

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Parsear servicios existentes
    let services = []
    try {
      services = typeof order.services === 'string'
        ? JSON.parse(order.services)
        : (order.services || [])
    } catch (e) {
      services = []
    }

    // Encontrar y eliminar el servicio
    let removedService = null
    if (serviceId) {
      const idx = services.findIndex((s: any) => s.id?.toString() === serviceId)
      if (idx >= 0) {
        removedService = services.splice(idx, 1)[0]
      }
    } else if (serviceIndex >= 0 && serviceIndex < services.length) {
      removedService = services.splice(serviceIndex, 1)[0]
    }

    if (!removedService) {
      return NextResponse.json({
        success: false,
        error: 'Servicio no encontrado'
      }, { status: 404 })
    }

    // Recalcular total
    const removedAmount = (removedService.price || 0) * (removedService.quantity || 1)
    const currentTotal = parseFloat(order.totalamount) || 0
    const newTotal = Math.max(0, currentTotal - removedAmount)

    // Actualizar la orden
    const updateQuery = `
      UPDATE package_orders SET
        services = $1,
        totalamount = $2,
        updatedat = NOW()
      WHERE id = $3
      RETURNING id, services, totalamount
    `

    await db.query(updateQuery, [
      JSON.stringify(services),
      newTotal,
      orderId
    ])

    return NextResponse.json({
      success: true,
      data: {
        removedService,
        totalServices: services.length,
        newTotal: newTotal
      }
    })

  } catch (error) {
    console.error('Error removing service:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al eliminar servicio'
    }, { status: 500 })
  }
}

// PATCH: Modificar un servicio existente
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const orderId = parseInt(resolvedParams.id)
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    const body = await request.json()
    const { serviceIndex, serviceId, updates } = body

    if ((serviceIndex === undefined || serviceIndex < 0) && !serviceId) {
      return NextResponse.json({
        success: false,
        error: 'Índice o ID de servicio es requerido'
      }, { status: 400 })
    }

    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay actualizaciones para aplicar'
      }, { status: 400 })
    }

    // Verificar que la orden existe
    let orderQuery = 'SELECT id, services, totalamount, company_id FROM package_orders WHERE id = $1'
    const orderParams: any[] = [orderId]

    if (!isSuperAdmin && headerCompanyId) {
      orderQuery += ' AND company_id = $2'
      orderParams.push(headerCompanyId)
    }

    const orderResult = await db.query(orderQuery, orderParams)

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Parsear servicios existentes
    let services = []
    try {
      services = typeof order.services === 'string'
        ? JSON.parse(order.services)
        : (order.services || [])
    } catch (e) {
      services = []
    }

    // Encontrar el servicio a modificar
    let targetIndex = -1
    if (serviceId) {
      targetIndex = services.findIndex((s: any) => s.id?.toString() === serviceId)
    } else if (serviceIndex !== undefined && serviceIndex >= 0) {
      targetIndex = serviceIndex
    }

    if (targetIndex < 0 || targetIndex >= services.length) {
      return NextResponse.json({
        success: false,
        error: 'Servicio no encontrado'
      }, { status: 404 })
    }

    // Calcular diferencia de precio antes de actualizar
    const oldService = services[targetIndex]
    const oldAmount = (oldService.price || 0) * (oldService.quantity || 1)

    // Aplicar actualizaciones
    const allowedUpdates = ['type', 'name', 'quantity', 'price']
    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        if (key === 'quantity') {
          services[targetIndex][key] = parseInt(updates[key].toString()) || 1
        } else if (key === 'price') {
          services[targetIndex][key] = parseFloat(updates[key].toString()) || 0
        } else {
          services[targetIndex][key] = updates[key]
        }
      }
    }
    services[targetIndex].updatedAt = new Date().toISOString()

    // Recalcular total
    const newAmount = (services[targetIndex].price || 0) * (services[targetIndex].quantity || 1)
    const currentTotal = parseFloat(order.totalamount) || 0
    const newTotal = Math.max(0, currentTotal - oldAmount + newAmount)

    // Actualizar la orden
    const updateQuery = `
      UPDATE package_orders SET
        services = $1,
        totalamount = $2,
        updatedat = NOW()
      WHERE id = $3
      RETURNING id, services, totalamount
    `

    await db.query(updateQuery, [
      JSON.stringify(services),
      newTotal,
      orderId
    ])

    return NextResponse.json({
      success: true,
      data: {
        service: services[targetIndex],
        totalServices: services.length,
        newTotal: newTotal
      }
    })

  } catch (error) {
    console.error('Error updating service:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar servicio'
    }, { status: 500 })
  }
}
