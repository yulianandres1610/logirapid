import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * POST /api/driver-app/routes/assign
 * Asignar usuario a una ruta mediante escaneo de código QR
 *
 * Request Body:
 * - routeCode: (requerido) Código QR o número de ruta
 * - userId: (opcional) ID del usuario a asignar. Si no se especifica, usa el usuario del token
 *
 * Roles permitidos: Cualquier usuario autenticado puede asignarse a sí mismo.
 * ADMIN/SUPER_ADMIN/MANAGER pueden asignar rutas a otros usuarios.
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
    let tokenUserId: number
    let userRole: string
    let userName: string
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const [id, email, role] = decoded.split(':')
      tokenUserId = parseInt(id)
      userRole = role
      userName = email
    } catch {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    // Obtener datos del request
    const body = await request.json()
    const { routeCode, userId: requestedUserId } = body

    if (!routeCode) {
      return NextResponse.json(
        { success: false, error: 'El código de ruta es requerido' },
        { status: 400 }
      )
    }

    // Determinar el usuario a asignar
    let targetUserId = tokenUserId

    // Si se especifica un userId diferente, verificar permisos
    if (requestedUserId && requestedUserId !== tokenUserId) {
      const adminRoles = ['ADMIN', 'SUPER_ADMIN', 'MANAGER']
      if (!adminRoles.includes(userRole)) {
        return NextResponse.json(
          { success: false, error: 'No tienes permisos para asignar rutas a otros usuarios' },
          { status: 403 }
        )
      }
      targetUserId = requestedUserId
    }

    // Obtener información del usuario a asignar
    const userQuery = `
      SELECT
        u.id,
        u.firstname,
        u.lastname,
        u.email,
        uc.company_id
      FROM users u
      LEFT JOIN user_companies uc ON u.id = uc.user_id
      WHERE u.id = $1
      LIMIT 1
    `
    const userResult = await db.query(userQuery, [targetUserId])

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    const targetUser = userResult.rows[0]
    const targetUserName = `${targetUser.firstname || ''} ${targetUser.lastname || ''}`.trim() || targetUser.email || userName
    const targetUserCompanyId = targetUser.company_id

    // Buscar ruta por código QR o route_number
    const routeQuery = `
      SELECT
        r.id,
        r.route_number as "routeNumber",
        r.qr_code as "qrCode",
        r.status,
        r.driver_id as "driverId",
        r.driver_name as "driverName",
        r.company_id as "companyId",
        r.stops,
        r.distance,
        r.duration,
        r.scheduled_date as "scheduledDate",
        r.vehicle_plate as "vehiclePlate",
        r.vehicle_id as "vehicleId"
      FROM routes r
      WHERE r.qr_code = $1 OR r.route_number = $1
    `
    const routeResult = await db.query(routeQuery, [routeCode])

    if (routeResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Ruta no encontrada con el código proporcionado' },
        { status: 404 }
      )
    }

    const route = routeResult.rows[0]

    // Validar que la ruta pertenece a la misma compañía del usuario
    if (targetUserCompanyId && route.companyId && targetUserCompanyId !== route.companyId) {
      return NextResponse.json(
        { success: false, error: 'No tiene permisos para asignarse a esta ruta' },
        { status: 403 }
      )
    }

    // Validar que la ruta está disponible para asignación
    if (route.driverId && route.driverId !== targetUserId) {
      return NextResponse.json(
        { success: false, error: `Esta ruta ya está asignada a otro usuario: ${route.driverName}` },
        { status: 400 }
      )
    }

    // Validar estado de la ruta
    const validStatuses = ['planning', 'pending', 'active']
    if (!validStatuses.includes(route.status) && route.status !== null) {
      return NextResponse.json(
        { success: false, error: `La ruta no está disponible para asignación. Estado actual: ${route.status}` },
        { status: 400 }
      )
    }

    // Asignar usuario a la ruta
    const updateQuery = `
      UPDATE routes
      SET
        driver_id = $1,
        driver_name = $2,
        status = 'active',
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `
    const updateResult = await db.query(updateQuery, [targetUserId, targetUserName, route.id])
    const updatedRoute = updateResult.rows[0]

    // Parsear stops para calcular resumen
    let stops: any[] = []
    try {
      stops = typeof updatedRoute.stops === 'string'
        ? JSON.parse(updatedRoute.stops)
        : (Array.isArray(updatedRoute.stops) ? updatedRoute.stops : [])
    } catch {
      stops = []
    }

    // Filtrar paradas con órdenes
    const orderStops = stops.filter((s: any) => s.orderId || s.orderIds)
    const totalStops = orderStops.length

    return NextResponse.json({
      success: true,
      message: 'Ruta asignada exitosamente',
      data: {
        route: {
          id: updatedRoute.id,
          routeNumber: updatedRoute.route_number,
          qrCode: updatedRoute.qr_code,
          status: updatedRoute.status,
          totalStops,
          distance: updatedRoute.distance,
          duration: updatedRoute.duration,
          scheduledDate: updatedRoute.scheduled_date,
          vehiclePlate: updatedRoute.vehicle_plate,
          vehicleId: updatedRoute.vehicle_id,
          assignedUserName: targetUserName,
          assignedUserId: targetUserId
        }
      }
    })

  } catch (error) {
    console.error('Error assigning route to user:', error)
    return NextResponse.json(
      { success: false, error: 'Error al asignar ruta al usuario' },
      { status: 500 }
    )
  }
}
