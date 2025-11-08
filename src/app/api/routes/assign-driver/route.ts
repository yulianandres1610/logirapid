import { NextRequest, NextResponse } from 'next/server'
import { Database } from 'sqlite3'
import { open } from 'sqlite'

/**
 * POST /api/routes/assign-driver
 * Asocia un driver a una ruta mediante código QR
 *
 * Body:
 * - qrCode: string (código QR de la ruta)
 * - driverId: number (ID del driver)
 * - driverName: string (nombre del driver)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log('🚗 [Assign Driver] Iniciando asignación de conductor')
    console.log('📦 [Payload]', JSON.stringify(body, null, 2))

    // Validaciones
    if (!body.qrCode) {
      return NextResponse.json(
        { error: 'Código QR es requerido' },
        { status: 400 }
      )
    }

    if (!body.driverId) {
      return NextResponse.json(
        { error: 'Driver ID es requerido' },
        { status: 400 }
      )
    }

    const db = await open({
      filename: './data/cubarapid.db',
      driver: Database
    })

    // Buscar ruta por QR code
    const route = await db.get(
      'SELECT * FROM routes WHERE qrCode = ?',
      [body.qrCode]
    )

    if (!route) {
      await db.close()
      return NextResponse.json(
        { error: 'Ruta no encontrada con ese código QR' },
        { status: 404 }
      )
    }

    console.log(`✅ [Ruta Encontrada] ${route.routeNumber} (ID: ${route.id})`)

    // Verificar que la ruta esté en estado planning
    if (route.status !== 'planning') {
      await db.close()
      return NextResponse.json(
        {
          error: `La ruta está en estado "${route.status}" y no puede ser asignada. Solo rutas en "planning" pueden ser asignadas.`,
          routeStatus: route.status
        },
        { status: 400 }
      )
    }

    // Actualizar driver en la ruta
    const result = await db.run(
      'UPDATE routes SET driverId = ?, driverName = ?, updatedAt = ? WHERE id = ?',
      [body.driverId, body.driverName || 'Driver', new Date().toISOString(), route.id]
    )

    if (result.changes === 0) {
      await db.close()
      return NextResponse.json(
        { error: 'No se pudo actualizar la ruta' },
        { status: 500 }
      )
    }

    console.log(`✅ [Driver Asignado] ${body.driverName} (ID: ${body.driverId}) → Ruta ${route.routeNumber}`)

    // Obtener ruta actualizada
    const updatedRoute = await db.get(
      'SELECT * FROM routes WHERE id = ?',
      [route.id]
    )

    await db.close()

    return NextResponse.json({
      success: true,
      message: `Driver ${body.driverName} asignado exitosamente a la ruta ${route.routeNumber}`,
      route: {
        id: updatedRoute.id,
        routeNumber: updatedRoute.routeNumber,
        name: updatedRoute.name,
        driverId: updatedRoute.driverId,
        driverName: updatedRoute.driverName,
        vehicleId: updatedRoute.vehicleId,
        vehiclePlate: updatedRoute.vehiclePlate,
        status: updatedRoute.status,
        totalPackages: updatedRoute.totalPackages,
        date: updatedRoute.date,
        distance: updatedRoute.distance,
        estimatedDuration: updatedRoute.estimatedDuration
      }
    })

  } catch (error) {
    console.error('❌ [Error] POST /api/routes/assign-driver:', error)
    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/routes/assign-driver?qrCode=XXX
 * Obtiene información de la ruta mediante código QR
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const qrCode = searchParams.get('qrCode')

    if (!qrCode) {
      return NextResponse.json(
        { error: 'Código QR es requerido' },
        { status: 400 }
      )
    }

    const db = await open({
      filename: './data/cubarapid.db',
      driver: Database
    })

    const route = await db.get(
      'SELECT * FROM routes WHERE qrCode = ?',
      [qrCode]
    )

    await db.close()

    if (!route) {
      return NextResponse.json(
        { error: 'Ruta no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      route: {
        id: route.id,
        routeNumber: route.routeNumber,
        name: route.name,
        driverId: route.driverId,
        driverName: route.driverName,
        vehicleId: route.vehicleId,
        vehiclePlate: route.vehiclePlate,
        status: route.status,
        totalPackages: route.totalPackages,
        date: route.date,
        distance: route.distance,
        estimatedDuration: route.estimatedDuration,
        stops: route.stops ? JSON.parse(route.stops) : [],
        canAssignDriver: route.status === 'planning' && !route.driverId
      }
    })

  } catch (error) {
    console.error('❌ [Error] GET /api/routes/assign-driver:', error)
    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
