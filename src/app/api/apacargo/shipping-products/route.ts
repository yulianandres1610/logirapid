import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticacion
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value
    const userRole = cookieStore.get('user-role')?.value

    if (!authToken) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Solo SUPER_ADMIN y ADMIN pueden ver productos
    if (!['SUPER_ADMIN', 'ADMIN'].includes(userRole || '')) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      )
    }

    // Obtener parametros de busqueda
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const supportsAir = searchParams.get('supportsAir')
    const supportsSea = searchParams.get('supportsSea')
    const active = searchParams.get('active')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Construir query con filtros
    let whereConditions = []
    const params: (string | boolean | number)[] = []
    let paramIndex = 1

    if (search) {
      whereConditions.push(`(custom_name ILIKE $${paramIndex} OR original_name ILIKE $${paramIndex})`)
      params.push(`%${search}%`)
      paramIndex++
    }

    if (supportsAir === 'true') {
      whereConditions.push(`supports_air = true`)
    } else if (supportsAir === 'false') {
      whereConditions.push(`supports_air = false`)
    }

    if (supportsSea === 'true') {
      whereConditions.push(`supports_sea = true`)
    } else if (supportsSea === 'false') {
      whereConditions.push(`supports_sea = false`)
    }

    if (active === 'true') {
      whereConditions.push(`is_active = true`)
    } else if (active === 'false') {
      whereConditions.push(`is_active = false`)
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : ''

    // Obtener total
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM apacargo_shipping_products
      ${whereClause}
    `, params)
    const total = parseInt(countResult.rows[0]?.total || '0')

    // Obtener productos
    const productsResult = await db.query(`
      SELECT
        id,
        apacargo_product_id,
        original_name,
        original_description,
        custom_name,
        custom_description,
        slug,
        supports_air,
        supports_sea,
        mi_costo,
        precio_mayorista,
        precio_publico,
        is_active,
        created_at,
        updated_at
      FROM apacargo_shipping_products
      ${whereClause}
      ORDER BY custom_name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset])

    const products = productsResult.rows.map((row: {
      id: number
      apacargo_product_id: number
      original_name: string
      original_description: string | null
      custom_name: string
      custom_description: string | null
      slug: string | null
      supports_air: boolean
      supports_sea: boolean
      mi_costo: string
      precio_mayorista: string
      precio_publico: string | null
      is_active: boolean
      created_at: Date
      updated_at: Date
    }) => ({
      id: row.id,
      apacargoProductId: row.apacargo_product_id,
      originalName: row.original_name,
      originalDescription: row.original_description,
      customName: row.custom_name,
      customDescription: row.custom_description,
      slug: row.slug,
      supportsAir: row.supports_air,
      supportsSea: row.supports_sea,
      miCosto: parseFloat(row.mi_costo),
      precioMayorista: parseFloat(row.precio_mayorista),
      precioPublico: row.precio_publico ? parseFloat(row.precio_publico) : null,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        products,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    console.error('Error obteniendo productos ApaCargo:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al obtener productos',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
