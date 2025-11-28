import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


// GET: Obtener una ruta específica por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id)
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)

    if (isNaN(id)) {
      return NextResponse.json({
        success: false,
        error: 'ID de ruta inválido'
      }, { status: 400 })
    }

    // Construir query con validación de empresa
    let query = 'SELECT * FROM routes WHERE id = $1'
    const queryParams: any[] = [id]

    if (!isSuperAdmin && headerCompanyId) {
      query += ' AND company_id = $2'
      queryParams.push(headerCompanyId)
    }

    const result = await db.query(query, queryParams)

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Ruta no encontrada'
      }, { status: 404 })
    }

    const route = result.rows[0]

    // Helper para parsear JSON (soporta tanto string como objeto)
    const parseJsonField = (field: any, defaultValue: any = []) => {
      if (!field) return defaultValue
      if (typeof field === 'string') {
        try {
          return JSON.parse(field)
        } catch {
          return defaultValue
        }
      }
      return field
    }

    // Parsear JSON fields
    const waypoints = parseJsonField(route.stops, [])
    const optimizedRoute = parseJsonField(route.optimizedroute, null)
    const timeWindows = parseJsonField(route.timewindows, [])

    // Transformar a formato esperado por el frontend
    const formattedRoute = {
      id: route.id,
      routeNumber: route.routenumber,
      name: route.name,
      driverId: route.driverid,
      driverName: route.drivername,
      vehicleId: route.vehicleid,
      vehiclePlate: route.vehicleplate,
      status: route.status,
      totalPackages: route.totalpackages || 0,
      deliveredPackages: route.deliveredpackages || 0,
      estimatedDuration: route.estimatedduration,
      actualDuration: route.actualduration,
      distance: route.distance,
      startTime: route.starttime,
      endTime: route.endtime,
      date: route.date,
      notes: route.notes,
      createdAt: route.createdat,
      updatedAt: route.updatedat,
      waypoints: waypoints,
      mechanism: route.mechanism || 'automatic',
      timeWindows: timeWindows,
      warehouseId: route.warehouseid,
      mapboxJobId: route.mapboxjobid,
      optimizedRoute: optimizedRoute,
      companyId: route.company_id
    }

    return NextResponse.json({
      success: true,
      data: formattedRoute
    })

  } catch (error) {
    console.error('Error getting route:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener ruta'
    }, { status: 500 })
  }
}