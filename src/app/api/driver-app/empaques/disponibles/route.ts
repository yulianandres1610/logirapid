import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * GET /api/driver-app/empaques/disponibles
 * Obtener todos los empaques en estado 'disponible' para validar códigos al escanear
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
        { success: false, error: 'Acceso denegado. Solo drivers pueden acceder.' },
        { status: 403 }
      )
    }

    // Obtener compañía del driver
    const driverQuery = `
      SELECT uc.company_id
      FROM users u
      LEFT JOIN user_companies uc ON u.id = uc.user_id
      WHERE u.id = $1
      LIMIT 1
    `
    const driverResult = await db.query(driverQuery, [userId])
    const companyId = driverResult.rows[0]?.company_id

    // Obtener parámetros de query
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const tipo = searchParams.get('tipo') || '' // CAJA, BULTO, etc.

    // Consultar empaques disponibles
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
        e.created_at as "createdAt"
      FROM empaques e
      LEFT JOIN package_sizes ps ON e.package_size_id = ps.id
      LEFT JOIN warehouses w ON e.warehouse_id = w.id
      WHERE e.estado = 'disponible'
    `
    const params: any[] = []
    let paramIndex = 1

    // Filtrar por compañía si existe
    if (companyId) {
      query += ` AND e.company_id = $${paramIndex}`
      params.push(companyId)
      paramIndex++
    }

    // Filtrar por tipo si se especifica
    if (tipo) {
      query += ` AND UPPER(e.tipo) = UPPER($${paramIndex})`
      params.push(tipo)
      paramIndex++
    }

    // Búsqueda por código
    if (search) {
      query += ` AND UPPER(e.codigo) LIKE UPPER($${paramIndex})`
      params.push(`%${search}%`)
      paramIndex++
    }

    // Ordenar por código
    query += ` ORDER BY e.codigo ASC`

    const empaquesResult = await db.query(query, params)

    // Crear un mapa para búsqueda rápida por código
    const codigosMap: Record<string, any> = {}
    const empaques = empaquesResult.rows.map((emp: any) => {
      const empaque = {
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
      }

      // Agregar al mapa para validación rápida
      codigosMap[emp.codigo.toUpperCase()] = empaque

      return empaque
    })

    // Agrupar por tipo para resumen
    const resumenPorTipo: Record<string, number> = {}
    empaques.forEach((emp: any) => {
      const tipo = emp.tipo || 'OTRO'
      resumenPorTipo[tipo] = (resumenPorTipo[tipo] || 0) + 1
    })

    return NextResponse.json({
      success: true,
      data: {
        empaques,
        codigosDisponibles: Object.keys(codigosMap),
        totalDisponibles: empaques.length,
        resumenPorTipo
      }
    })

  } catch (error) {
    console.error('Error getting available empaques:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener empaques disponibles' },
      { status: 500 }
    )
  }
}
