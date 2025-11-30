import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * POST /api/driver-app/location
 * Actualizar ubicación del driver en tiempo real
 * Se usa para tracking en vivo durante rutas activas
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
        { success: false, error: 'Acceso denegado. Solo drivers pueden actualizar ubicación.' },
        { status: 403 }
      )
    }

    // Obtener datos del body
    const body = await request.json()
    const {
      latitude,
      longitude,
      accuracy,
      speed,
      heading,
      routeId
    } = body

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { success: false, error: 'Coordenadas requeridas (latitude, longitude)' },
        { status: 400 }
      )
    }

    // Validar coordenadas
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json(
        { success: false, error: 'Coordenadas inválidas' },
        { status: 400 }
      )
    }

    // Actualizar ubicación del driver en la tabla users
    await db.query(`
      UPDATE users
      SET
        last_location_lat = $1,
        last_location_lng = $2,
        last_location_accuracy = $3,
        last_location_speed = $4,
        last_location_heading = $5,
        last_location_at = NOW()
      WHERE id = $6
    `, [latitude, longitude, accuracy || null, speed || null, heading || null, userId])

    // Si hay ruta activa, actualizar también la posición en la ruta
    if (routeId) {
      // Verificar que el driver está asignado a esta ruta
      const routeCheck = await db.query(`
        SELECT id, driver_id
        FROM routes
        WHERE id = $1 AND driver_id = $2 AND status = 'en_curso'
      `, [routeId, userId])

      if (routeCheck.rows.length > 0) {
        // Agregar posición al historial de la ruta
        await db.query(`
          UPDATE routes
          SET
            driver_current_lat = $1,
            driver_current_lng = $2,
            driver_location_updated = NOW()
          WHERE id = $3
        `, [latitude, longitude, routeId])
      }
    }

    // Insertar en tabla de historial de ubicaciones (si existe)
    try {
      await db.query(`
        INSERT INTO driver_location_history (
          driver_id,
          latitude,
          longitude,
          accuracy,
          speed,
          heading,
          route_id,
          recorded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [userId, latitude, longitude, accuracy || null, speed || null, heading || null, routeId || null])
    } catch (e) {
      // Si la tabla no existe, ignorar
      console.log('Location history table may not exist:', e)
    }

    return NextResponse.json({
      success: true,
      message: 'Ubicación actualizada',
      data: {
        latitude,
        longitude,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error updating driver location:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar ubicación' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/driver-app/location
 * Obtener última ubicación conocida del driver
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
        { success: false, error: 'Acceso denegado.' },
        { status: 403 }
      )
    }

    // Obtener última ubicación
    const result = await db.query(`
      SELECT
        last_location_lat as "latitude",
        last_location_lng as "longitude",
        last_location_accuracy as "accuracy",
        last_location_speed as "speed",
        last_location_heading as "heading",
        last_location_at as "timestamp"
      FROM users
      WHERE id = $1
    `, [userId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    const location = result.rows[0]

    if (!location.latitude || !location.longitude) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No hay ubicación registrada'
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        speed: location.speed,
        heading: location.heading,
        timestamp: location.timestamp
      }
    })

  } catch (error) {
    console.error('Error getting driver location:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener ubicación' },
      { status: 500 }
    )
  }
}
