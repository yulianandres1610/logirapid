import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * GET /api/driver-app/empty-boxes
 * Lista de cajas vacías asignadas al driver
 */
export async function GET(request: NextRequest) {
  try {
    // Obtener usuario del token
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Decodificar token
    let userId: number
    let userRole: string
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const [id, , role] = decoded.split(':')
      userId = parseInt(id)
      userRole = role
    } catch {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    // Verificar rol DRIVER
    if (userRole !== 'DRIVER') {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado. Solo drivers pueden ver sus cajas vacías.' },
        { status: 403 }
      )
    }

    // Obtener parámetros de búsqueda
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const tamano = searchParams.get('tamano') || ''

    // Construir condiciones WHERE
    // Cajas vacías son empaques SIN order_number
    const conditions = [
      'e.driver_id = $1',
      'e.order_number IS NULL'
    ]
    const params: any[] = [userId]

    // Filtro por tamaño
    if (tamano && tamano !== 'all') {
      params.push(parseInt(tamano))
      conditions.push(`e.package_size_id = $${params.length}`)
    }

    // Filtro de búsqueda
    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(
        e.codigo ILIKE $${params.length} OR
        e.tipo ILIKE $${params.length}
      )`)
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`

    // Contar total
    const countQuery = `SELECT COUNT(*) as total FROM empaques e ${whereClause}`
    const countResult = await db.query(countQuery, params)
    const total = parseInt(countResult.rows[0].total)

    // Obtener resultados paginados
    const offset = (page - 1) * limit
    params.push(limit, offset)

    const dataQuery = `
      SELECT
        e.id,
        e.codigo,
        e.tipo,
        e.estado,
        e.package_size_id as "packageSizeId",
        ps.name as "packageSizeName",
        ps.dimensions,
        ps.max_weight_lb as "maxWeightLb",
        e.company_id as "companyId",
        c.legalname as "companyName",
        e.warehouse_id as "warehouseId",
        w.name as "warehouseName",
        e.assigned_to_driver_at as "assignedAt",
        e.created_at as "createdAt"
      FROM empaques e
      LEFT JOIN package_sizes ps ON e.package_size_id = ps.id
      LEFT JOIN companies c ON e.company_id = c.id
      LEFT JOIN warehouses w ON e.warehouse_id = w.id
      ${whereClause}
      ORDER BY e.assigned_to_driver_at DESC, e.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `

    const result = await db.query(dataQuery, params)

    // Obtener resumen por tamaño
    const summaryQuery = `
      SELECT
        ps.id as "sizeId",
        ps.name as "sizeName",
        ps.dimensions,
        COUNT(e.id) as count
      FROM empaques e
      LEFT JOIN package_sizes ps ON e.package_size_id = ps.id
      WHERE e.driver_id = $1 AND e.order_number IS NULL
      GROUP BY ps.id, ps.name, ps.dimensions
      ORDER BY ps.name
    `
    const summaryResult = await db.query(summaryQuery, [userId])

    return NextResponse.json({
      success: true,
      data: {
        cajasVacias: result.rows,
        resumenPorTamano: summaryResult.rows.map(row => ({
          sizeId: row.sizeId,
          sizeName: row.sizeName || 'Sin clasificar',
          dimensions: row.dimensions,
          count: parseInt(row.count)
        }))
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching driver empty boxes:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener cajas vacías del driver' },
      { status: 500 }
    )
  }
}
