import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * GET /api/driver-app/empaques/list-bultos
 *
 * Precargar todos los bultos (empaques con orden asignada) de la empresa
 * para validación local instantánea al escanear.
 *
 * Roles permitidos: DRIVER, ADMIN, MANAGER, USER
 *
 * Query Params (opcionales):
 * - warehouseId: Filtrar por almacén
 * - estado: Filtrar por estado específico
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     bultos: [...],
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
    const estado = searchParams.get('estado')

    // Construir query - Solo empaques con orden asignada (bultos)
    let query = `
      SELECT
        e.id,
        e.codigo,
        e.tipo,
        e.estado,
        e.warehouse_id as "warehouseId",
        w.name as "warehouseName",
        e.orden_id as "ordenId",
        e.order_number as "orderNumber",
        e.package_size_id as "packageSizeId",
        ps.name as "packageSizeName",
        e.peso_lb as "weightLb",
        e.peso_kg as "weightKg",
        e.box_number as "boxNumber",
        e.total_boxes as "totalBoxes",
        e.company_id as "companyId",
        po.recipient_name as "recipientName",
        po.recipient_city as "recipientCity",
        po.recipient_state as "recipientState",
        po.services as "services",
        e.created_at as "createdAt",
        e.updated_at as "updatedAt"
      FROM empaques e
      LEFT JOIN package_sizes ps ON e.package_size_id = ps.id
      LEFT JOIN warehouses w ON e.warehouse_id = w.id
      LEFT JOIN package_orders po ON e.orden_id = po.id
      WHERE e.orden_id IS NOT NULL
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

    // Filtrar por estado si se especifica
    if (estado) {
      query += ` AND e.estado = $${paramIndex}`
      params.push(estado)
      paramIndex++
    }

    // Ordenar por código
    query += ` ORDER BY e.codigo ASC`

    const result = await db.query(query, params)

    // Formatear respuesta
    const bultos = result.rows.map((bulto: any) => {
      // Extraer nombre del servicio del JSON de services si existe
      let serviceName = null
      if (bulto.services) {
        try {
          const services = typeof bulto.services === 'string'
            ? JSON.parse(bulto.services)
            : bulto.services
          if (Array.isArray(services) && services.length > 0) {
            serviceName = services[0]?.name || services[0]?.type || null
          }
        } catch {
          // Ignorar errores de parsing
        }
      }

      return {
        id: bulto.id,
        codigo: bulto.codigo,
        tipo: bulto.tipo,
        estado: bulto.estado,
        warehouseId: bulto.warehouseId,
        warehouseName: bulto.warehouseName,
        ordenId: bulto.ordenId,
        orderNumber: bulto.orderNumber,
        packageSizeId: bulto.packageSizeId,
        packageSizeName: bulto.packageSizeName,
        serviceName,
        recipientName: bulto.recipientName,
        recipientCity: bulto.recipientCity,
        recipientState: bulto.recipientState,
        weightLb: bulto.weightLb,
        weightKg: bulto.weightKg,
        boxNumber: bulto.boxNumber,
        totalBoxes: bulto.totalBoxes,
        createdAt: bulto.createdAt,
        updatedAt: bulto.updatedAt
      }
    })

    // Extraer array de códigos para búsqueda rápida
    const codigos = bultos.map((b: any) => b.codigo)

    return NextResponse.json({
      success: true,
      data: {
        bultos,
        codigos,
        total: bultos.length,
        companyId: companyId
      }
    })

  } catch (error) {
    console.error('[list-bultos] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener bultos' },
      { status: 500 }
    )
  }
}
