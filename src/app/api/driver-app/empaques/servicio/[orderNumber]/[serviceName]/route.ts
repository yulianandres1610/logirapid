import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * GET /api/driver-app/empaques/servicio/[orderNumber]/[serviceName]
 * Obtener todos los empaques (bultos) asociados a un servicio específico de una orden
 * para validar que se escaneen todos los bultos correctos
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string; serviceName: string }> }
) {
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

    const resolvedParams = await params
    const orderNumber = decodeURIComponent(resolvedParams.orderNumber)
    const serviceName = decodeURIComponent(resolvedParams.serviceName)

    // Buscar la orden primero
    const orderQuery = `
      SELECT
        id, ordernumber, customername, status, services
      FROM package_orders
      WHERE ordernumber = $1
    `
    const orderResult = await db.query(orderQuery, [orderNumber])

    if (orderResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Orden no encontrada' },
        { status: 404 }
      )
    }

    const order = orderResult.rows[0]

    // Parsear servicios de la orden
    let services: any[] = []
    try {
      services = typeof order.services === 'string'
        ? JSON.parse(order.services)
        : (order.services || [])
    } catch {
      services = []
    }

    // Buscar el servicio específico
    const service = services.find((s: any) => {
      const svcName = typeof s === 'string' ? s : (s.name || s.type || '')
      return svcName.toLowerCase() === serviceName.toLowerCase()
    })

    if (!service) {
      return NextResponse.json(
        { success: false, error: `Servicio '${serviceName}' no encontrado en la orden` },
        { status: 404 }
      )
    }

    // Obtener empaques asociados a este servicio
    // Buscar en empaques_trazabilidad por orden_numero y servicio_nombre
    const empaquesQuery = `
      SELECT DISTINCT
        e.id,
        e.codigo,
        e.tipo,
        e.estado,
        e.order_number as "orderNumber",
        e.service_name as "serviceName",
        e.recipient_name as "recipientName",
        e.recipient_city as "recipientCity",
        e.recipient_state as "recipientState",
        e.weight_lb as "weightLb",
        e.weight_kg as "weightKg",
        e.box_number as "boxNumber",
        e.total_boxes as "totalBoxes",
        e.driver_id as "driverId",
        e.driver_name as "driverName",
        ps.name as "packageSizeName",
        ps.dimensions
      FROM empaques e
      LEFT JOIN package_sizes ps ON e.package_size_id = ps.id
      WHERE e.order_number = $1
        AND (
          LOWER(e.service_name) = LOWER($2)
          OR e.service_name IS NULL
        )
      ORDER BY e.box_number ASC, e.codigo ASC
    `
    const empaquesResult = await db.query(empaquesQuery, [orderNumber, serviceName])

    // Si no hay empaques con service_name, buscar por trazabilidad
    let empaques = empaquesResult.rows
    if (empaques.length === 0) {
      const trazabilidadQuery = `
        SELECT DISTINCT
          e.id,
          e.codigo,
          e.tipo,
          e.estado,
          e.order_number as "orderNumber",
          e.service_name as "serviceName",
          e.recipient_name as "recipientName",
          e.recipient_city as "recipientCity",
          e.recipient_state as "recipientState",
          e.weight_lb as "weightLb",
          e.weight_kg as "weightKg",
          e.box_number as "boxNumber",
          e.total_boxes as "totalBoxes",
          e.driver_id as "driverId",
          e.driver_name as "driverName",
          ps.name as "packageSizeName",
          ps.dimensions
        FROM empaques e
        LEFT JOIN package_sizes ps ON e.package_size_id = ps.id
        LEFT JOIN empaques_trazabilidad t ON e.id = t.empaque_id
        WHERE t.orden_numero = $1
          AND (
            LOWER(t.servicio_nombre) = LOWER($2)
            OR t.servicio_nombre IS NULL
          )
        ORDER BY e.box_number ASC, e.codigo ASC
      `
      const trazResult = await db.query(trazabilidadQuery, [orderNumber, serviceName])
      empaques = trazResult.rows
    }

    // Crear mapa de códigos para validación rápida
    const codigosMap: Record<string, any> = {}
    const codigosEsperados: string[] = []

    empaques.forEach((emp: any) => {
      codigosMap[emp.codigo.toUpperCase()] = {
        id: emp.id,
        codigo: emp.codigo,
        tipo: emp.tipo,
        estado: emp.estado,
        boxNumber: emp.boxNumber,
        totalBoxes: emp.totalBoxes,
        weightLb: emp.weightLb,
        packageSizeName: emp.packageSizeName
      }
      codigosEsperados.push(emp.codigo)
    })

    // Calcular estadísticas
    const totalBultos = empaques.length
    const bultosEnReparto = empaques.filter((e: any) => e.estado === 'en_reparto').length
    const bultosEntregados = empaques.filter((e: any) => e.estado === 'entregado').length
    const bultosPendientes = empaques.filter((e: any) =>
      !['en_reparto', 'entregado'].includes(e.estado)
    ).length

    // Obtener info del servicio
    const serviceObj = typeof service === 'string' ? { name: service } : service

    return NextResponse.json({
      success: true,
      data: {
        orden: {
          orderNumber: order.ordernumber,
          customerName: order.customername,
          status: order.status
        },
        servicio: {
          name: serviceObj.name || serviceName,
          type: serviceObj.type,
          quantity: serviceObj.quantity || totalBultos,
          weight: serviceObj.weight,
          price: serviceObj.price
        },
        empaques: empaques.map((emp: any) => ({
          id: emp.id,
          codigo: emp.codigo,
          tipo: emp.tipo,
          estado: emp.estado,
          boxNumber: emp.boxNumber,
          totalBoxes: emp.totalBoxes,
          recipientName: emp.recipientName,
          recipientCity: emp.recipientCity,
          recipientState: emp.recipientState,
          weightLb: emp.weightLb,
          weightKg: emp.weightKg,
          packageSizeName: emp.packageSizeName,
          dimensions: emp.dimensions,
          driverId: emp.driverId,
          driverName: emp.driverName
        })),
        codigosEsperados,
        validacion: {
          totalBultos,
          bultosEnReparto,
          bultosEntregados,
          bultosPendientes,
          todosAsignados: bultosEnReparto === totalBultos,
          todosEntregados: bultosEntregados === totalBultos
        }
      }
    })

  } catch (error) {
    console.error('Error getting service empaques:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener empaques del servicio' },
      { status: 500 }
    )
  }
}
