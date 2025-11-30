import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

// PATCH: Actualizar el estado de una ruta
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const routeId = parseInt(resolvedParams.id)
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)

    if (isNaN(routeId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de ruta inválido'
      }, { status: 400 })
    }

    const body = await request.json()
    const { status } = body

    // Validar status
    const validStatuses = ['planificada', 'asignada', 'en_curso', 'completada', 'cancelada']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({
        success: false,
        error: 'Estado inválido. Debe ser: planificada, asignada, en_curso, completada o cancelada'
      }, { status: 400 })
    }

    // Verificar que la ruta existe
    let checkQuery = 'SELECT id, status, company_id FROM routes WHERE id = $1'
    const checkParams: any[] = [routeId]

    if (!isSuperAdmin && headerCompanyId) {
      checkQuery += ' AND company_id = $2'
      checkParams.push(headerCompanyId)
    }

    const checkResult = await db.query(checkQuery, checkParams)

    if (checkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Ruta no encontrada'
      }, { status: 404 })
    }

    const currentRoute = checkResult.rows[0]

    // Actualizar el estado
    const updateQuery = `
      UPDATE routes SET
        status = $1,
        updatedat = NOW()
        ${status === 'completada' ? ', endtime = NOW()' : ''}
        ${status === 'en_curso' && currentRoute.status === 'asignada' ? ', starttime = NOW()' : ''}
      WHERE id = $2
      RETURNING *
    `

    const result = await db.query(updateQuery, [status, routeId])

    // Si se marca como completada, actualizar también deliveredpackages
    if (status === 'completada') {
      // Contar órdenes entregadas
      const stopsQuery = 'SELECT stops FROM routes WHERE id = $1'
      const stopsResult = await db.query(stopsQuery, [routeId])

      if (stopsResult.rows.length > 0) {
        let stops = stopsResult.rows[0].stops
        if (typeof stops === 'string') {
          try {
            stops = JSON.parse(stops)
          } catch (e) {
            stops = []
          }
        }

        // Contar total de órdenes
        let totalOrders = 0
        for (const stop of stops || []) {
          if (stop.orderId) totalOrders++
          if (stop.orderIds) totalOrders += stop.orderIds.length
        }

        // Actualizar deliveredpackages
        await db.query(
          'UPDATE routes SET deliveredpackages = $1 WHERE id = $2',
          [totalOrders, routeId]
        )
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result.rows[0].id,
        status: result.rows[0].status,
        previousStatus: currentRoute.status,
        updatedAt: result.rows[0].updatedat
      }
    })

  } catch (error) {
    console.error('Error updating route status:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar estado de la ruta'
    }, { status: 500 })
  }
}
