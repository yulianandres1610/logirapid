import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * GET /api/driver-app/empaques/list-disponibles
 *
 * Precargar todos los empaques en estado 'disponible' (cajas vacías) de la empresa
 * para validación local instantánea al escanear.
 *
 * Roles permitidos: DRIVER, ADMIN, MANAGER, USER
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     empaques: [...],
 *     codigos: ['EMP001', 'EMP002', ...],
 *     total: number,
 *     companyId: number
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Obtener información de autenticación desde headers (inyectados por middleware)
    const { isSuperAdmin, companyId } = getCompanyFilter(request)
    const userRole = request.headers.get('x-user-role') || request.cookies.get('user-role')?.value

    // Verificar autenticación
    if (!userRole) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Verificar roles permitidos
    const allowedRoles = ['DRIVER', 'ADMIN', 'MANAGER', 'USER', 'SUPER_ADMIN']
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado. Rol no autorizado.' },
        { status: 403 }
      )
    }

    // Verificar company_id para usuarios no SUPER_ADMIN
    if (!isSuperAdmin && !companyId) {
      return NextResponse.json(
        { success: false, error: 'No se pudo determinar la empresa del usuario' },
        { status: 400 }
      )
    }

    // Obtener parámetros de query opcionales
    const { searchParams } = new URL(request.url)
    const warehouseId = searchParams.get('warehouseId')
    const tipo = searchParams.get('tipo') // CAJA, BULTO, etc.

    // Construir query
    let query = `
      SELECT
        e.id,
        e.codigo,
        e.tipo,
        e.estado,
        e.package_size_id as "packageSizeId",
        ps.name as "packageSizeName",
        ps.dimensions,
        ps.max_weight_lb as "maxWeightLb",
        e.warehouse_id as "warehouseId",
        w.name as "warehouseName",
        e.company_id as "companyId",
        e.created_at as "createdAt"
      FROM empaques e
      LEFT JOIN package_sizes ps ON e.package_size_id = ps.id
      LEFT JOIN warehouses w ON e.warehouse_id = w.id
      WHERE e.estado = 'disponible'
    `
    const params: any[] = []
    let paramIndex = 1

    // Filtrar por compañía (obligatorio para no SUPER_ADMIN)
    if (!isSuperAdmin) {
      query += ` AND e.company_id = $${paramIndex}`
      params.push(companyId)
      paramIndex++
    }

    // Filtrar por almacén si se especifica
    if (warehouseId) {
      query += ` AND e.warehouse_id = $${paramIndex}`
      params.push(parseInt(warehouseId))
      paramIndex++
    }

    // Filtrar por tipo si se especifica
    if (tipo) {
      query += ` AND UPPER(e.tipo) = UPPER($${paramIndex})`
      params.push(tipo)
      paramIndex++
    }

    // Ordenar por código
    query += ` ORDER BY e.codigo ASC`

    const result = await db.query(query, params)

    // Formatear respuesta
    const empaques = result.rows.map((emp: any) => ({
      id: emp.id,
      codigo: emp.codigo,
      tipo: emp.tipo,
      estado: emp.estado,
      packageSizeId: emp.packageSizeId,
      packageSizeName: emp.packageSizeName,
      dimensions: emp.dimensions,
      maxWeightLb: emp.maxWeightLb,
      warehouseId: emp.warehouseId,
      warehouseName: emp.warehouseName,
      createdAt: emp.createdAt
    }))

    // Extraer array de códigos para búsqueda rápida
    const codigos = empaques.map((e: any) => e.codigo)

    return NextResponse.json({
      success: true,
      data: {
        empaques,
        codigos,
        total: empaques.length,
        companyId: companyId
      }
    })

  } catch (error) {
    console.error('[list-disponibles] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener empaques disponibles' },
      { status: 500 }
    )
  }
}
