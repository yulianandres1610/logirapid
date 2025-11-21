import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

/**
 * POST /api/empaques/validate
 * Valida si un código de empaque existe y está disponible
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)
    const companyId = headerCompanyId
    const { codigo } = body

    // Validar que se proporcione el código
    if (!codigo || typeof codigo !== 'string' || codigo.trim() === '') {
      return NextResponse.json({
        success: false,
        valid: false,
        error: 'Debe proporcionar un código de empaque válido'
      }, { status: 400 })
    }

    // Buscar el empaque en la base de datos
    const conditions = ['codigo = $1']
    const params: any[] = [codigo.trim()]

    if (!isSuperAdmin) {
      if (!companyId) {
        return NextResponse.json({
          success: false,
          valid: false,
          error: 'No se pudo determinar la empresa del usuario'
        }, { status: 400 })
      }
      conditions.push('company_id = $2')
      params.push(companyId)
    }

    const result = await db.query(
      `SELECT
        id,
        codigo,
        tipo,
        estado,
        package_size_id,
        warehouse_id,
        warehouse_name,
        supplier_id,
        supplier_name,
        cliente_id,
        orden_id,
        fecha_asignacion,
        descripcion,
        created_at,
        updated_at
      FROM empaques
      WHERE ${conditions.join(' AND ')}`,
      params
    )

    // Verificar si existe el empaque
    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        valid: false,
        error: 'Código no encontrado'
      }, { status: 404 })
    }

    const empaque = result.rows[0]

    // Verificar si está disponible
    if (empaque.estado !== 'disponible') {
      return NextResponse.json({
        success: false,
        valid: false,
        error: `Empaque no disponible. Estado actual: ${empaque.estado}`,
        empaque: {
          id: empaque.id,
          codigo: empaque.codigo,
          estado: empaque.estado,
          tipo: empaque.tipo,
          warehouse_name: empaque.warehouse_name
        }
      }, { status: 400 })
    }

    // Empaque válido y disponible
    return NextResponse.json({
      success: true,
      valid: true,
      empaque: {
        id: empaque.id,
        codigo: empaque.codigo,
        tipo: empaque.tipo,
        estado: empaque.estado,
        packageSizeId: empaque.package_size_id,
        warehouseId: empaque.warehouse_id,
        warehouseName: empaque.warehouse_name,
        supplierName: empaque.supplier_name,
        descripcion: empaque.descripcion
      }
    }, { status: 200 })

  } catch (error) {
    console.error('Error validating empaque:', error)
    return NextResponse.json({
      success: false,
      valid: false,
      error: 'Error al validar el código de empaque'
    }, { status: 500 })
  }
}
