import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * POST /api/driver-app/empaques/validate
 *
 * Validar un código de empaque individual (fallback cuando no está en lista precargada)
 *
 * Roles permitidos: DRIVER, ADMIN, MANAGER, USER
 *
 * Request Body:
 * {
 *   codigo: string,
 *   tipo: 'empaque' | 'bulto',
 *   operacion?: 'recepcion' | 'envio',  // Solo para bultos
 *   warehouseId?: number
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     valid: boolean,
 *     status: 'valid' | 'invalid' | 'already-here',
 *     empaque: {...},
 *     errorCode?: string,
 *     message?: string
 *   }
 * }
 *
 * Error Codes:
 * - NOT_FOUND: Código no existe
 * - WRONG_COMPANY: Código existe pero pertenece a otra empresa
 * - NOT_AVAILABLE: Empaque no está disponible
 * - INVALID_STATE: Estado no válido para la operación
 * - NO_ORDER: Empaque sin orden asignada (para bultos)
 * - WRONG_WAREHOUSE: Empaque no está en el almacén indicado
 */
export async function POST(request: NextRequest) {
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

    // Obtener body de la request
    const body = await request.json()
    const { codigo, tipo, operacion, warehouseId } = body

    // Validar campos requeridos
    if (!codigo) {
      return NextResponse.json(
        { success: false, error: 'El código es requerido' },
        { status: 400 }
      )
    }

    if (!tipo || !['empaque', 'bulto'].includes(tipo)) {
      return NextResponse.json(
        { success: false, error: 'El tipo debe ser "empaque" o "bulto"' },
        { status: 400 }
      )
    }

    // Buscar empaque por código (SIN filtrar por empresa primero para detectar WRONG_COMPANY)
    const query = `
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
        po.recipient_state as "recipientState"
      FROM empaques e
      LEFT JOIN package_sizes ps ON e.package_size_id = ps.id
      LEFT JOIN warehouses w ON e.warehouse_id = w.id
      LEFT JOIN package_orders po ON e.orden_id = po.id
      WHERE UPPER(e.codigo) = UPPER($1)
    `

    const result = await db.query(query, [codigo.trim()])

    // Si no existe, retornar NOT_FOUND
    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          valid: false,
          status: 'invalid',
          errorCode: 'NOT_FOUND',
          message: 'El código de empaque no existe'
        }
      })
    }

    const empaque = result.rows[0]

    // Verificar que pertenece a la empresa del usuario (si no es SUPER_ADMIN)
    if (!isSuperAdmin && empaque.companyId !== companyId) {
      return NextResponse.json({
        success: true,
        data: {
          valid: false,
          status: 'invalid',
          errorCode: 'WRONG_COMPANY',
          message: 'Este código no pertenece a tu empresa'
        }
      })
    }

    // Validación según el tipo de operación
    if (tipo === 'empaque') {
      // Validación para cajas vacías (empaques disponibles)
      if (empaque.estado !== 'disponible') {
        return NextResponse.json({
          success: true,
          data: {
            valid: false,
            status: 'invalid',
            errorCode: 'NOT_AVAILABLE',
            message: `El empaque no está disponible. Estado actual: ${empaque.estado}`,
            empaque
          }
        })
      }

      // Empaque válido
      return NextResponse.json({
        success: true,
        data: {
          valid: true,
          status: 'valid',
          empaque
        }
      })
    }

    if (tipo === 'bulto') {
      // Validación para bultos (empaques con orden)

      // Debe tener orden asignada
      if (!empaque.ordenId) {
        return NextResponse.json({
          success: true,
          data: {
            valid: false,
            status: 'invalid',
            errorCode: 'NO_ORDER',
            message: 'El empaque no tiene una orden asignada',
            empaque
          }
        })
      }

      // Estados inválidos para cualquier operación
      if (empaque.estado === 'disponible' || empaque.estado === 'entregado') {
        return NextResponse.json({
          success: true,
          data: {
            valid: false,
            status: 'invalid',
            errorCode: 'INVALID_STATE',
            message: `Estado inválido para bulto: ${empaque.estado}`,
            empaque
          }
        })
      }

      // Validaciones específicas según la operación
      if (operacion === 'recepcion') {
        // Para recepción en almacén
        if (warehouseId && empaque.warehouseId === warehouseId && empaque.estado === 'en_almacen') {
          return NextResponse.json({
            success: true,
            data: {
              valid: false,
              status: 'already-here',
              errorCode: 'ALREADY_HERE',
              message: 'El bulto ya se encuentra en este almacén',
              empaque
            }
          })
        }
      }

      if (operacion === 'envio') {
        // Para envío desde almacén
        if (warehouseId && empaque.warehouseId !== warehouseId) {
          return NextResponse.json({
            success: true,
            data: {
              valid: false,
              status: 'invalid',
              errorCode: 'WRONG_WAREHOUSE',
              message: 'El bulto no está en este almacén',
              empaque
            }
          })
        }

        if (empaque.estado !== 'en_almacen') {
          return NextResponse.json({
            success: true,
            data: {
              valid: false,
              status: 'invalid',
              errorCode: 'INVALID_STATE',
              message: `El bulto debe estar en almacén para enviar. Estado actual: ${empaque.estado}`,
              empaque
            }
          })
        }
      }

      // Bulto válido
      return NextResponse.json({
        success: true,
        data: {
          valid: true,
          status: 'valid',
          empaque
        }
      })
    }

    // Por defecto, válido (no debería llegar aquí)
    return NextResponse.json({
      success: true,
      data: {
        valid: true,
        status: 'valid',
        empaque
      }
    })

  } catch (error) {
    console.error('[validate-empaque] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al validar empaque' },
      { status: 500 }
    )
  }
}
