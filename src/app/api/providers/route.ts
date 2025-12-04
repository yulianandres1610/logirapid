import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

// Helper to get user from token
async function getUserFromToken() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value

  if (!token) return null

  try {
    return jwt.verify(token, JWT_SECRET) as {
      userId: number
      email: string
      role: string
      companyId: number
    }
  } catch {
    return null
  }
}

// GET /api/providers - List all provider companies
// Query params: ?category=paqueteria&type=products
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken()

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const type = searchParams.get('type') // products, services, both

    let query = `
      SELECT
        c.id,
        c.legalname,
        c.phone,
        c.email,
        c.status,
        c.is_provider,
        c.provider_type,
        c.provider_categories,
        c.provider_services,
        c.created_at
      FROM companies c
      WHERE c.is_provider = true
    `
    const params: any[] = []

    if (type) {
      params.push(type)
      query += ` AND (c.provider_type = $${params.length} OR c.provider_type = 'both')`
    }

    query += ` ORDER BY c.legalname`

    const result = await db.query(query, params)

    // Filter by category if needed (JSON field)
    let providers = result.rows

    if (category) {
      providers = providers.filter(p => {
        const categories = p.provider_categories || []
        return Array.isArray(categories) && categories.includes(category)
      })
    }

    // Format response
    const formattedProviders = providers.map(p => ({
      id: p.id,
      legalName: p.legalname,
      phone: p.phone,
      email: p.email,
      status: p.status,
      isProvider: p.is_provider,
      providerType: p.provider_type,
      providerCategories: p.provider_categories || [],
      providerServices: p.provider_services || [],
      createdAt: p.created_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        providers: formattedProviders,
        total: formattedProviders.length
      }
    })

  } catch (error: any) {
    console.error('[Providers API] GET error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al obtener proveedores'
    }, { status: 500 })
  }
}

// POST /api/providers - Mark a company as provider (SUPER_ADMIN only)
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken()

    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Solo SUPER_ADMIN puede configurar proveedores'
      }, { status: 403 })
    }

    const body = await request.json()
    const {
      companyId,
      isProvider,
      providerType,
      providerCategories
    } = body

    if (!companyId) {
      return NextResponse.json({
        success: false,
        error: 'companyId requerido'
      }, { status: 400 })
    }

    // Validate provider type
    const validTypes = ['products', 'services', 'both']
    if (isProvider && providerType && !validTypes.includes(providerType)) {
      return NextResponse.json({
        success: false,
        error: `providerType debe ser uno de: ${validTypes.join(', ')}`
      }, { status: 400 })
    }

    // Validate categories
    const validCategories = ['paqueteria', 'remesa', 'recarga', 'mercado']
    if (isProvider && providerCategories) {
      for (const cat of providerCategories) {
        if (!validCategories.includes(cat)) {
          return NextResponse.json({
            success: false,
            error: `Categoria invalida: ${cat}. Debe ser una de: ${validCategories.join(', ')}`
          }, { status: 400 })
        }
      }
    }

    // Update company
    await db.query(`
      UPDATE companies
      SET is_provider = $1,
          provider_type = $2,
          provider_categories = $3,
          updated_at = NOW()
      WHERE id = $4
    `, [
      isProvider ?? false,
      isProvider ? (providerType || 'both') : null,
      isProvider ? JSON.stringify(providerCategories || []) : '[]',
      companyId
    ])

    // Get updated company
    const result = await db.query(`
      SELECT id, legalname, is_provider, provider_type, provider_categories
      FROM companies
      WHERE id = $1
    `, [companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empresa no encontrada'
      }, { status: 404 })
    }

    const company = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        id: company.id,
        legalName: company.legalname,
        isProvider: company.is_provider,
        providerType: company.provider_type,
        providerCategories: company.provider_categories || []
      }
    })

  } catch (error: any) {
    console.error('[Providers API] POST error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al configurar proveedor'
    }, { status: 500 })
  }
}
