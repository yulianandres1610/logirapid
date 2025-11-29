import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * POST /api/driver-app/receive-package
 * Recibir un bulto (empaque con orden asignada)
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
        { success: false, error: 'Acceso denegado. Solo drivers pueden recibir bultos.' },
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
        e.service_name,
        e.recipient_name,
        e.recipient_city,
        e.recipient_state,
        e.weight_lb,
        e.weight_kg,
        e.box_number,
        e.total_boxes,
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

    // Validar que es un bulto (tiene orden asignada)
    if (!empaque.order_number) {
      return NextResponse.json(
        { success: false, error: 'Este empaque no tiene orden asignada. Use "Recibir Caja Vacía" en su lugar.' },
        { status: 400 }
      )
    }

    // Validar estado (debe estar en almacén, en tránsito o recibido en destino)
    const validStates = ['en_almacen', 'en_transito', 'recibido_destino', 'recogida']
    if (!validStates.includes(empaque.estado)) {
      return NextResponse.json(
        { success: false, error: `El bulto no está listo para reparto. Estado actual: ${empaque.estado}` },
        { status: 400 }
      )
    }

    // Validar que no está asignado a otro driver
    if (empaque.driver_id && empaque.driver_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Este bulto ya está asignado a otro driver' },
        { status: 400 }
      )
    }

    // Verificar capacidad del driver
    const capacityQuery = `
      SELECT
        COALESCE(bultos_count, 0) as "bultos",
        COALESCE(bultos_capacity, 100) as "capacity"
      FROM driver_inventory
      WHERE driver_id = $1
    `
    const capacityResult = await db.query(capacityQuery, [userId])

    let currentCount = 0
    let capacity = 100

    if (capacityResult.rows.length > 0) {
      currentCount = capacityResult.rows[0].bultos
      capacity = capacityResult.rows[0].capacity
    }

    if (currentCount >= capacity) {
      return NextResponse.json(
        { success: false, error: `Capacidad de bultos alcanzada (${currentCount}/${capacity})` },
        { status: 400 }
      )
    }

    // Obtener nombre del driver
    const driverQuery = `SELECT firstname, lastname FROM users WHERE id = $1`
    const driverResult = await db.query(driverQuery, [userId])
    const driverName = driverResult.rows.length > 0
      ? `${driverResult.rows[0].firstname} ${driverResult.rows[0].lastname}`
      : userName

    // Actualizar empaque: asignar al driver y cambiar estado a en_reparto
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
        orden_numero,
        servicio_nombre,
        warehouse_id,
        usuario_id,
        usuario_nombre,
        notas,
        fecha
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `
    await db.query(trazabilidadQuery, [
      empaque.id,
      'asignado_a_reparto',
      empaque.order_number,
      empaque.service_name,
      warehouseId || empaque.warehouse_id,
      userId,
      driverName,
      'Bulto asignado a driver para reparto desde app móvil'
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
    const inventory = inventoryResult.rows[0] || { cajasVacias: 0, bultos: 1 }

    return NextResponse.json({
      success: true,
      message: 'Bulto recibido exitosamente',
      data: {
        empaque: {
          id: updateResult.rows[0].id,
          codigo: updateResult.rows[0].codigo,
          tipo: updateResult.rows[0].tipo,
          estado: updateResult.rows[0].estado,
          orderNumber: empaque.order_number,
          serviceName: empaque.service_name,
          recipientName: empaque.recipient_name,
          recipientCity: empaque.recipient_city,
          recipientState: empaque.recipient_state,
          weightLb: empaque.weight_lb,
          weightKg: empaque.weight_kg,
          boxNumber: empaque.box_number,
          totalBoxes: empaque.total_boxes,
          packageSizeName: empaque.packageSizeName
        },
        inventarioActualizado: {
          cajasVacias: inventory.cajasVacias,
          bultos: inventory.bultos
        }
      }
    })

  } catch (error) {
    console.error('Error receiving package:', error)
    return NextResponse.json(
      { success: false, error: 'Error al recibir bulto' },
      { status: 500 }
    )
  }
}
