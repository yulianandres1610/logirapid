import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * GET /api/driver-app/packages
 * Lista de bultos (paquetes con contenido) asignados al driver
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
        { success: false, error: 'Acceso denegado. Solo drivers pueden ver sus bultos.' },
        { status: 403 }
      )
    }

    // Obtener parámetros de búsqueda
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''

    // Construir condiciones WHERE
    // Bultos son empaques con order_number asignado
    const conditions = [
      'e.driver_id = $1',
      'e.order_number IS NOT NULL'
    ]
    const params: any[] = [userId]

    // Filtro por estado
    if (status && status !== 'all') {
      params.push(status)
      conditions.push(`e.estado = $${params.length}`)
    } else {
      // Por defecto mostrar solo bultos activos (no entregados)
      conditions.push("e.estado IN ('en_almacen', 'en_transito', 'en_reparto', 'recogida', 'recibido_destino')")
    }

    // Filtro de búsqueda
    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(
        e.codigo ILIKE $${params.length} OR
        e.order_number ILIKE $${params.length} OR
        e.recipient_name ILIKE $${params.length} OR
        e.recipient_city ILIKE $${params.length}
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
        e.order_number as "orderNumber",
        e.service_name as "serviceName",
        e.recipient_name as "recipientName",
        e.recipient_city as "recipientCity",
        e.recipient_state as "recipientState",
        e.weight_lb as "weightLb",
        e.weight_kg as "weightKg",
        e.box_number as "boxNumber",
        e.total_boxes as "totalBoxes",
        e.company_id as "companyId",
        c.legalname as "companyName",
        e.warehouse_id as "warehouseId",
        w.name as "warehouseName",
        e.assigned_to_driver_at as "assignedAt",
        e.created_at as "createdAt",
        e.updated_at as "updatedAt"
      FROM empaques e
      LEFT JOIN package_sizes ps ON e.package_size_id = ps.id
      LEFT JOIN companies c ON e.company_id = c.id
      LEFT JOIN warehouses w ON e.warehouse_id = w.id
      ${whereClause}
      ORDER BY
        CASE e.estado
          WHEN 'en_reparto' THEN 1
          WHEN 'recibido_destino' THEN 2
          WHEN 'en_transito' THEN 3
          WHEN 'en_almacen' THEN 4
          WHEN 'recogida' THEN 5
          ELSE 6
        END,
        e.assigned_to_driver_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `

    const result = await db.query(dataQuery, params)

    // Agrupar por orden para mostrar bultos relacionados
    const bultosAgrupados: { [key: string]: any } = {}
    for (const row of result.rows) {
      const orderKey = row.orderNumber || row.id.toString()
      if (!bultosAgrupados[orderKey]) {
        bultosAgrupados[orderKey] = {
          orderNumber: row.orderNumber,
          recipientName: row.recipientName,
          recipientCity: row.recipientCity,
          recipientState: row.recipientState,
          serviceName: row.serviceName,
          totalBoxes: row.totalBoxes || 1,
          bultos: []
        }
      }
      bultosAgrupados[orderKey].bultos.push({
        id: row.id,
        codigo: row.codigo,
        tipo: row.tipo,
        estado: row.estado,
        packageSizeName: row.packageSizeName,
        dimensions: row.dimensions,
        weightLb: row.weightLb,
        weightKg: row.weightKg,
        boxNumber: row.boxNumber,
        assignedAt: row.assignedAt,
        warehouseName: row.warehouseName
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        bultos: result.rows,
        agrupados: Object.values(bultosAgrupados)
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching driver packages:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener bultos del driver' },
      { status: 500 }
    )
  }
}
