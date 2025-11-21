import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)
    const tipo = searchParams.get('tipo')
    const codigo = searchParams.get('codigo')
    const warehouseId = searchParams.get('warehouseId')
    const estado = searchParams.get('estado')
    const packageSizeId = searchParams.get('packageSizeId')
    const orderNumber = searchParams.get('orderNumber')
    const hasOrder = searchParams.get('hasOrder') // Filter: only empaques with orden_id
    const companyIdParam = searchParams.get('companyId')
    const companyIdFilter = companyIdParam ? parseInt(companyIdParam) : headerCompanyId

    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''

    // Build WHERE conditions
    const conditions: string[] = ['1=1']
    const params: any[] = []
    let paramIndex = 1

    if (packageSizeId) {
      conditions.push(`e.package_size_id = $${paramIndex++}`)
      params.push(parseInt(packageSizeId))
    }

    if (tipo) {
      conditions.push(`e.tipo = $${paramIndex++}`)
      params.push(tipo)
    }

    if (codigo) {
      conditions.push(`e.codigo = $${paramIndex++}`)
      params.push(codigo)
    }

    if (warehouseId) {
      conditions.push(`e.warehouse_id = $${paramIndex++}`)
      params.push(parseInt(warehouseId))
    }

    // Solo filtrar por estado si se pasa explícitamente
    if (estado) {
      conditions.push(`e.estado = $${paramIndex++}`)
      params.push(estado)
    }

    if (orderNumber) {
      conditions.push(`e.order_number = $${paramIndex++}`)
      params.push(orderNumber)
    }

    // Filter by empaques with orders assigned
    if (hasOrder === 'true') {
      conditions.push(`e.orden_id IS NOT NULL`)
    }

    // Search functionality - busca en BD
    if (search && search.trim() !== '') {
      conditions.push(`(
        e.codigo ILIKE $${paramIndex} OR
        e.tipo ILIKE $${paramIndex + 1} OR
        e.estado ILIKE $${paramIndex + 2} OR
        ps.name ILIKE $${paramIndex + 3}
      )`)
      const searchTerm = `%${search}%`
      params.push(searchTerm, searchTerm, searchTerm, searchTerm)
      paramIndex += 4
    }

    // Filtro por empresa
    if (!isSuperAdmin) {
      if (!headerCompanyId) {
        return NextResponse.json({
          success: false,
          error: 'No se pudo determinar la empresa del usuario'
        }, { status: 400 })
      }
      conditions.push(`e.company_id = $${paramIndex++}`)
      params.push(headerCompanyId)
    } else if (companyIdParam) {
      conditions.push(`e.company_id = $${paramIndex++}`)
      params.push(parseInt(companyIdParam))
    }

    const whereClause = conditions.join(' AND ')

    // Count total records
    const countQuery = `
      SELECT COUNT(*) as total
      FROM empaques e
      LEFT JOIN package_sizes ps ON e.package_size_id = ps.id
      WHERE ${whereClause}
    `
    const countResult = await db.query(countQuery, params)
    const total = parseInt(countResult.rows[0].total)

    // Get paginated results
    const offset = (page - 1) * limit
    const dataQuery = `
      SELECT
        e.*,
        ps.name as package_size_name,
        ps.dimensions as package_size_dimensions,
        ps.weight as package_size_weight,
        ps.price as package_size_price,
        c.legalname as company_name
      FROM empaques e
      LEFT JOIN package_sizes ps ON e.package_size_id = ps.id
      LEFT JOIN companies c ON e.company_id = c.id
      WHERE ${whereClause}
      ORDER BY e.created_at DESC, e.codigo ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    params.push(limit, offset)

    const result = await db.query(dataQuery, params)

    return NextResponse.json({
      success: true,
      empaques: result.rows,
      data: result.rows, // Keep backwards compatibility
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error al buscar empaques:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al buscar empaques',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      codigo,
      packageSizeId,
      tipo,
      estado = 'disponible',
      warehouseId,
      warehouseName,
      clienteId,
      ordenId,
      descripcion,
      usuarioId,
      usuarioNombre
    } = body

    // Validate required fields
    if (!codigo || !packageSizeId) {
      return NextResponse.json(
        { success: false, error: 'Código y tamaño de empaque son requeridos' },
        { status: 400 }
      )
    }

    // Validate estado
    const estadosValidos = ['disponible', 'asignado', 'en_transito', 'entregado', 'recogido', 'devuelto']
    if (!estadosValidos.includes(estado)) {
      return NextResponse.json(
        { success: false, error: `Estado inválido. Debe ser: ${estadosValidos.join(', ')}` },
        { status: 400 }
      )
    }

    // Check if codigo already exists
    const existingEmpaque = await db.query(
      'SELECT id FROM empaques WHERE codigo = $1',
      [codigo]
    )

    if (existingEmpaque.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un empaque con ese código' },
        { status: 400 }
      )
    }

    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)
    const companyId = isSuperAdmin ? (body.companyId || headerCompanyId) : headerCompanyId

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'No se pudo determinar la empresa para este empaque' },
        { status: 400 }
      )
    }

    // Insert new empaque
    const result = await db.query(
      `INSERT INTO empaques (
        codigo, package_size_id, tipo, estado, warehouse_id, warehouse_name,
        cliente_id, orden_id, descripcion, company_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *`,
      [codigo, packageSizeId, tipo, estado, warehouseId, warehouseName, clienteId, ordenId, descripcion, companyId]
    )

    const empaque = result.rows[0]

    // Crear registro de trazabilidad inicial
    await db.query(
      `INSERT INTO empaques_trazabilidad (
        empaque_id, accion, ubicacion, warehouse_id, warehouse_name,
        usuario_id, usuario_nombre, notas
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        empaque.id,
        'creado',
        warehouseName || 'Sin ubicación',
        warehouseId,
        warehouseName,
        usuarioId,
        usuarioNombre,
        `Empaque creado con código ${codigo}`
      ]
    )

    return NextResponse.json({
      success: true,
      empaque: empaque
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating empaque:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear empaque' },
      { status: 500 }
    )
  }
}
