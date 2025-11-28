import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * GET /api/drivers/[id]/empaques
 * Lista empaques (cajas vacías) asignados al driver
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const driverId = parseInt(id)
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const estado = searchParams.get('estado') || ''
    const tamano = searchParams.get('tamano') || ''

    if (isNaN(driverId)) {
      return NextResponse.json(
        { success: false, error: 'ID de driver inválido' },
        { status: 400 }
      )
    }

    // Build WHERE conditions
    const conditions = ['e.driver_id = $1']
    const params_array: any[] = [driverId]

    if (search) {
      params_array.push(`%${search}%`)
      conditions.push(`(e.codigo ILIKE $${params_array.length} OR e.tipo ILIKE $${params_array.length})`)
    }

    if (estado && estado !== 'all') {
      params_array.push(estado)
      conditions.push(`e.estado = $${params_array.length}`)
    }

    if (tamano && tamano !== 'all') {
      params_array.push(parseInt(tamano))
      conditions.push(`e.package_size_id = $${params_array.length}`)
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`

    // Count total
    const countQuery = `SELECT COUNT(*) as total FROM empaques e ${whereClause}`
    const countResult = await db.query(countQuery, params_array)

    // Get paginated results
    const offset = (page - 1) * limit
    params_array.push(limit, offset)

    const dataQuery = `
      SELECT
        e.id,
        e.codigo,
        e.tipo,
        e.estado,
        e.package_size_id as "packageSizeId",
        ps.name as "packageSizeName",
        ps.dimensions,
        e.company_id as "companyId",
        c.legalname as "companyName",
        e.order_number as "orderNumber",
        e.service_name as "serviceName",
        e.recipient_name as "recipientName",
        e.recipient_city as "recipientCity",
        e.recipient_state as "recipientState",
        e.assigned_to_driver_at as "assignedAt",
        e.created_at as "createdAt",
        e.updated_at as "updatedAt"
      FROM empaques e
      LEFT JOIN package_sizes ps ON e.package_size_id = ps.id
      LEFT JOIN companies c ON e.company_id = c.id
      ${whereClause}
      ORDER BY e.created_at DESC
      LIMIT $${params_array.length - 1} OFFSET $${params_array.length}
    `

    const result = await db.query(dataQuery, params_array)

    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching driver empaques:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener empaques del driver' },
      { status: 500 }
    )
  }
}
