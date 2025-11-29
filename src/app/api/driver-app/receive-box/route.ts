import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * POST /api/driver-app/receive-box
 * Recibir una caja vacía (empaque sin orden asignada)
 */
export async function POST(request: NextRequest) {
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
    let userName: string
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const [id, email, role] = decoded.split(':')
      userId = parseInt(id)
      userRole = role
      userName = email
    } catch {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    // Verificar rol DRIVER
    if (userRole !== 'DRIVER') {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado. Solo drivers pueden recibir cajas.' },
        { status: 403 }
      )
    }

    // Obtener datos del request
    const body = await request.json()
    const { codigo, warehouseId } = body

    if (!codigo) {
      return NextResponse.json(
        { success: false, error: 'El código del empaque es requerido' },
        { status: 400 }
      )
    }

    // Buscar el empaque
    const empaqueQuery = `
      SELECT
        e.id,
        e.codigo,
        e.tipo,
        e.estado,
        e.order_number,
        e.driver_id,
        e.company_id,
        e.warehouse_id,
        ps.name as "packageSizeName"
      FROM empaques e
      LEFT JOIN package_sizes ps ON e.package_size_id = ps.id
      WHERE UPPER(e.codigo) = UPPER($1)
    `
    const empaqueResult = await db.query(empaqueQuery, [codigo])

    if (empaqueResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Empaque no encontrado' },
        { status: 404 }
      )
    }

    const empaque = empaqueResult.rows[0]

    // Validar que es una caja vacía (sin orden asignada)
    if (empaque.order_number) {
      return NextResponse.json(
        { success: false, error: 'Este empaque tiene una orden asignada. Use "Recibir Bulto" en su lugar.' },
        { status: 400 }
      )
    }

    // Validar estado
    if (empaque.estado !== 'disponible') {
      return NextResponse.json(
        { success: false, error: `El empaque no está disponible. Estado actual: ${empaque.estado}` },
        { status: 400 }
      )
    }

    // Validar que no está asignado a otro driver
    if (empaque.driver_id && empaque.driver_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Este empaque ya está asignado a otro driver' },
        { status: 400 }
      )
    }

    // Verificar capacidad del driver
    const capacityQuery = `
      SELECT
        COALESCE(cajas_vacias_count, 0) as "cajasVacias",
        COALESCE(cajas_vacias_capacity, 50) as "capacity"
      FROM driver_inventory
      WHERE driver_id = $1
    `
    const capacityResult = await db.query(capacityQuery, [userId])

    let currentCount = 0
    let capacity = 50

    if (capacityResult.rows.length > 0) {
      currentCount = capacityResult.rows[0].cajasVacias
      capacity = capacityResult.rows[0].capacity
    }

    if (currentCount >= capacity) {
      return NextResponse.json(
        { success: false, error: `Capacidad de cajas vacías alcanzada (${currentCount}/${capacity})` },
        { status: 400 }
      )
    }

    // Obtener nombre del driver
    const driverQuery = `SELECT firstname, lastname FROM users WHERE id = $1`
    const driverResult = await db.query(driverQuery, [userId])
    const driverName = driverResult.rows.length > 0
      ? `${driverResult.rows[0].firstname} ${driverResult.rows[0].lastname}`
      : userName

    // Actualizar empaque: asignar al driver
    const updateQuery = `
      UPDATE empaques
      SET
        driver_id = $1,
        driver_name = $2,
        assigned_to_driver_at = NOW(),
        estado = 'en_reparto',
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `
    const updateResult = await db.query(updateQuery, [userId, driverName, empaque.id])

    // Registrar en trazabilidad
    const trazabilidadQuery = `
      INSERT INTO empaques_trazabilidad (
        empaque_id,
        accion,
        warehouse_id,
        usuario_id,
        usuario_nombre,
        notas,
        fecha
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `
    await db.query(trazabilidadQuery, [
      empaque.id,
      'recibido_por_driver',
      warehouseId || empaque.warehouse_id,
      userId,
      driverName,
      'Caja vacía recibida por driver desde app móvil'
    ])

    // Obtener inventario actualizado
    const inventoryQuery = `
      SELECT
        COALESCE(cajas_vacias_count, 0) as "cajasVacias",
        COALESCE(bultos_count, 0) as "bultos"
      FROM driver_inventory
      WHERE driver_id = $1
    `
    const inventoryResult = await db.query(inventoryQuery, [userId])
    const inventory = inventoryResult.rows[0] || { cajasVacias: 1, bultos: 0 }

    return NextResponse.json({
      success: true,
      message: 'Caja recibida exitosamente',
      data: {
        empaque: {
          id: updateResult.rows[0].id,
          codigo: updateResult.rows[0].codigo,
          tipo: updateResult.rows[0].tipo,
          estado: updateResult.rows[0].estado,
          packageSizeName: empaque.packageSizeName
        },
        inventarioActualizado: {
          cajasVacias: inventory.cajasVacias,
          bultos: inventory.bultos
        }
      }
    })

  } catch (error) {
    console.error('Error receiving box:', error)
    return NextResponse.json(
      { success: false, error: 'Error al recibir caja' },
      { status: 500 }
    )
  }
}
