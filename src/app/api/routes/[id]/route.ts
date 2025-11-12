import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

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

    const result = await db.query('SELECT * FROM routes WHERE id = $1', [id])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Ruta no encontrada'
      }, { status: 404 })
    }

    const route = result.rows[0]

    // Parsear JSON fields
    try {
      route.waypoints = route.stops ? JSON.parse(route.stops) : []
      route.optimizedRoute = route.optimizedroute ? JSON.parse(route.optimizedroute) : null
      route.timeWindows = route.timewindows ? JSON.parse(route.timewindows) : []
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