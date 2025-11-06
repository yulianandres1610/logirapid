import { NextRequest, NextResponse } from 'next/server'
import { Database } from 'sqlite3'
import { open } from 'sqlite'

// GET: Obtener una ruta específica por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id)
    if (isNaN(id)) {
      return NextResponse.json({
        success: false,
        error: 'ID de ruta inválido'
      }, { status: 400 })
    }

    const db = await open({
      filename: './data/cubarapid.db',
      driver: Database
    })

    const route = await db.get('SELECT * FROM routes WHERE id = ?', [id])
    await db.close()

    if (!route) {
      return NextResponse.json({
        success: false,
        error: 'Ruta no encontrada'
      }, { status: 404 })
    }

    // Parsear JSON fields
    try {
      route.waypoints = route.stops ? JSON.parse(route.stops) : []
      route.optimizedRoute = route.optimizedRoute ? JSON.parse(route.optimizedRoute) : null
      route.timeWindows = route.timeWindows ? JSON.parse(route.timeWindows) : []
    } catch (parseError) {
      console.error('Error parsing route JSON fields:', parseError)
      route.waypoints = []
      route.optimizedRoute = null
      route.timeWindows = []
    }

    return NextResponse.json({
      success: true,
      data: route
    })

  } catch (error) {
    console.error('Error getting route:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener ruta'
    }, { status: 500 })
  }
}