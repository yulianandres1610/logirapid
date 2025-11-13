import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


// Base de datos simulada (en producción esto sería una base de datos real)
let MARKETPLACES_DB = [
  {
    id: 'market-1',
    name: 'Supermercado Habana',
    address: 'Calle 23 #12, Vedado, La Habana',
    province: 'la-habana',
    municipality: 'vedado',
    coordinates: { lat: 23.1359, lng: -82.3619 },
    rating: 4.5,
    deliveryTime: '30-45 min',
    deliveryCost: 2.50,
    image: '/images/market1.jpg',
    categories: ['Supermercado', 'Comestibles'],
    schedule: 'Lun-Dom: 8:00 AM - 10:00 PM',
    phone: '+53 7-832-1234',
    description: 'Supermercado completo con productos nacionales e importados',
    type: 'marketplace',
    status: 'active',
    createdBy: 'admin-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

// GET - Obtener todos los marketplaces
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const province = searchParams.get('province')
    const municipality = searchParams.get('municipality')
    const type = searchParams.get('type')
    const status = searchParams.get('status')

    let filteredMarketplaces = [...MARKETPLACES_DB]

    // Aplicar filtros
    if (province) {
      filteredMarketplaces = filteredMarketplaces.filter(mp => mp.province === province)
    }
    if (municipality) {
      filteredMarketplaces = filteredMarketplaces.filter(mp => mp.municipality === municipality)
    }
    if (type) {
      filteredMarketplaces = filteredMarketplaces.filter(mp => mp.type === type)
    }
    if (status) {
      filteredMarketplaces = filteredMarketplaces.filter(mp => mp.status === status)
    }

    return NextResponse.json({
      success: true,
      data: filteredMarketplaces,
      total: filteredMarketplaces.length
    })
  } catch (error) {
    console.error('Error fetching marketplaces:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Crear un nuevo marketplace
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      address,
      province,
      municipality,
      coordinates,
      categories,
      schedule,
      phone,
      description,
      deliveryTime,
      deliveryCost,
      rating = 4.0
    } = body

    // Validación de campos requeridos
    if (!name || !address || !province || !municipality || !phone) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Crear nuevo marketplace
    const newMarketplace = {
      id: `market-${Date.now()}`,
      name,
      address,
      province,
      municipality,
      coordinates: coordinates || { lat: 0, lng: 0 },
      rating: parseFloat(rating) || 4.0,
      deliveryTime: deliveryTime || '30-45 min',
      deliveryCost: parseFloat(deliveryCost) || 2.50,
      image: '/images/default-market.jpg',
      categories: categories || ['Supermercado'],
      schedule: schedule || 'Lun-Dom: 8:00 AM - 8:00 PM',
      phone,
      description: description || '',
      type: 'marketplace',
      status: 'active',
      createdBy: 'admin-1', // En producción vendría del token de autenticación
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    MARKETPLACES_DB.push(newMarketplace)

    return NextResponse.json({
      success: true,
      data: newMarketplace,
      message: 'Marketplace created successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating marketplace:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}