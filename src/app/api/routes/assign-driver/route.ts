import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


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

    // Buscar ruta por QR code
    const routeResult = await db.query(
      'SELECT * FROM routes WHERE qrcode = $1',
      [body.qrCode]
    )

    if (routeResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Ruta no encontrada con ese código QR' },
        { status: 404 }
      )
    }

    const route = routeResult.rows[0]

    console.log(`✅ [Ruta Encontrada] ${route.routenumber} (ID: ${route.id})`)

    // Verificar que la ruta esté en estado planning
    if (route.status !== 'planning') {
      return NextResponse.json(
        {
          error: `La ruta está en estado "${route.status}" y no puede ser asignada. Solo rutas en "planning" pueden ser asignadas.`,
          routeStatus: route.status
        },
        { status: 400 }
      )
    }

    // Actualizar driver en la ruta
    const updateResult = await db.query(
      'UPDATE routes SET driverid = $1, drivername = $2, updatedat = NOW() WHERE id = $3 RETURNING *',
      [body.driverId, body.driverName || 'Driver', route.id]
    )

    if (updateResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'No se pudo actualizar la ruta' },
        { status: 500 }
      )
    }

    const updatedRoute = updateResult.rows[0]

    console.log(`✅ [Driver Asignado] ${body.driverName} (ID: ${body.driverId}) → Ruta ${route.routenumber}`)

    return NextResponse.json({
      success: true,
      message: `Driver ${body.driverName} asignado exitosamente a la ruta ${route.routenumber}`,
      route: {
        id: updatedRoute.id,
        routeNumber: updatedRoute.routenumber,
        name: updatedRoute.name,
        driverId: updatedRoute.driverid,
        driverName: updatedRoute.drivername,
        vehicleId: updatedRoute.vehicleid,
        vehiclePlate: updatedRoute.vehicleplate,
        status: updatedRoute.status,
        totalPackages: updatedRoute.totalpackages,
        date: updatedRoute.date,
        distance: updatedRoute.distance,
        estimatedDuration: updatedRoute.estimatedduration
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

    const result = await db.query(
      'SELECT * FROM routes WHERE qrcode = $1',
      [qrCode]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Ruta no encontrada' },
        { status: 404 }
      )
    }

    const route = result.rows[0]

    return NextResponse.json({
      success: true,
      route: {
        id: route.id,
        routeNumber: route.routenumber,
        name: route.name,
        driverId: route.driverid,
        driverName: route.drivername,
        vehicleId: route.vehicleid,
        vehiclePlate: route.vehicleplate,
        status: route.status,
        totalPackages: route.totalpackages,
        date: route.date,
        distance: route.distance,
        estimatedDuration: route.estimatedduration,
        stops: route.stops ? JSON.parse(route.stops) : [],
        canAssignDriver: route.status === 'planning' && !route.driverid
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
