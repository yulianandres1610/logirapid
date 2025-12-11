import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * POST /api/routes/[id]/stops/[stopNumber]/complete
 * Completa una parada específica de una ruta
 *
 * - Cambia estado de la parada a 'completada'
 * - Cambia estado de las órdenes de esa parada a 'en_bodega'
 * - Si todas las paradas están completadas, cambia estado de ruta a 'completada'
 * - Procesa distribución de pagos (comisiones a creador y completador, pago a proveedor)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stopNumber: string }> }
) {
  try {
    const resolvedParams = await params
    const routeId = parseInt(resolvedParams.id)
    const stopNumber = parseInt(resolvedParams.stopNumber)
    const { isSuperAdmin, companyId: headerCompanyId, userId, userRole } = getCompanyFilter(request)

    console.log(`✅ [Completar Parada] Ruta ${routeId}, Parada ${stopNumber}`)

    if (isNaN(routeId) || isNaN(stopNumber)) {
      return NextResponse.json({
        success: false,
        error: 'ID de ruta o número de parada inválido'
      }, { status: 400 })
    }

    // Verificar que la ruta existe
    let checkQuery = 'SELECT * FROM routes WHERE id = $1'
    const checkParams: (number | string)[] = [routeId]

    if (!isSuperAdmin && headerCompanyId) {
      checkQuery += ' AND company_id = $2'
      checkParams.push(headerCompanyId)
    }

    const routeResult = await db.query(checkQuery, checkParams)

    if (routeResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Ruta no encontrada'
      }, { status: 404 })
    }

    const route = routeResult.rows[0]

    // Validar que la ruta esté en estado 'en_curso'
    if (route.status !== 'en_curso') {
      return NextResponse.json({
        success: false,
        error: `La ruta debe estar en estado "en_curso" para completar paradas. Estado actual: "${route.status}"`,
        currentStatus: route.status
      }, { status: 400 })
    }

    // Parsear las paradas
    let stops = route.stops
    if (typeof stops === 'string') {
      try {
        stops = JSON.parse(stops)
      } catch (e) {
        stops = []
      }
    }
    stops = stops || []

    // Buscar la parada por índice (stopNumber es 1-based)
    const stopIndex = stopNumber - 1
    if (stopIndex < 0 || stopIndex >= stops.length) {
      return NextResponse.json({
        success: false,
        error: `Parada ${stopNumber} no encontrada. La ruta tiene ${stops.length} paradas.`
      }, { status: 404 })
    }

    const stop = stops[stopIndex]

    // Verificar que la parada no esté ya completada
    if (stop.status === 'completada') {
      return NextResponse.json({
        success: false,
        error: `La parada ${stopNumber} ya está completada`
      }, { status: 400 })
    }

    // Obtener los IDs de órdenes de esta parada
    const orderIds: number[] = []
    if (stop.orderId) {
      orderIds.push(stop.orderId)
    }
    if (stop.orderIds && Array.isArray(stop.orderIds)) {
      orderIds.push(...stop.orderIds)
    }

    console.log(`📦 [Órdenes] ${orderIds.length} órdenes a actualizar a 'en_bodega'`)

    // Variables para resultados de billing
    const billingResults: any[] = []

    // Variables para box tracking
    let boxTrackingUpdates: Array<{
      boxId: number;
      trackingCode: string;
      previousStatus: string;
      newStatus: string;
    }> = []

    // Usar transacción para asegurar consistencia
    await db.transaction(async (client: typeof db) => {
      // 1. Actualizar estado de la parada a 'completada'
      stops[stopIndex].status = 'completada'

      await client.query(`
        UPDATE routes
        SET stops = $1,
            updatedat = NOW()
        WHERE id = $2
      `, [JSON.stringify(stops), routeId])

      console.log(`✅ [Parada] Parada ${stopNumber} actualizada a 'completada'`)

      // 2. Actualizar estado de las órdenes a 'en_bodega'
      if (orderIds.length > 0) {
        await client.query(`
          UPDATE package_orders
          SET status = 'en_bodega',
              updatedat = NOW()
          WHERE id = ANY($1::int[])
        `, [orderIds])

        console.log(`✅ [Órdenes] ${orderIds.length} órdenes actualizadas a 'en_bodega'`)

        // 2.5 Actualizar box_tracking para órdenes de tipo recogida
        // Obtener tipo de orden y actualizar box_tracking relacionados
        for (const orderId of orderIds) {
          const orderResult = await client.query(`
            SELECT order_type FROM package_orders WHERE id = $1
          `, [orderId])

          if (orderResult.rows.length > 0) {
            const orderType = orderResult.rows[0].order_type

            // Obtener boxes asociados a esta orden
            const boxesResult = await client.query(`
              SELECT id, tracking_code, current_status
              FROM box_tracking
              WHERE package_order_id = $1
            `, [orderId])

            for (const box of boxesResult.rows) {
              let newBoxStatus: string | null = null

              // Determinar nuevo estado según tipo de orden y estado actual
              if (orderType === 'recogida') {
                // Orden de recogida completada = caja recogida
                if (box.current_status === 'created' || box.current_status === 'caja_entregada' || box.current_status === 'confeccionada') {
                  newBoxStatus = 'recogida'
                }
              } else if (orderType === 'entrega') {
                // Orden de entrega de caja completada = caja entregada al cliente
                if (box.current_status === 'created') {
                  newBoxStatus = 'caja_entregada'
                }
              }

              if (newBoxStatus) {
                // Actualizar estado de la caja
                await client.query(`
                  UPDATE box_tracking
                  SET current_status = $1,
                      ${newBoxStatus === 'recogida' ? 'recogida_at = NOW(),' : ''}
                      ${newBoxStatus === 'caja_entregada' ? 'box_delivered_at = NOW(),' : ''}
                      updated_at = NOW()
                  WHERE id = $2
                `, [newBoxStatus, box.id])

                // Registrar en historial
                await client.query(`
                  INSERT INTO box_tracking_history (
                    box_tracking_id, previous_status, new_status,
                    changed_by_user_id, changed_at, notes
                  ) VALUES ($1, $2, $3, $4, NOW(), $5)
                `, [
                  box.id,
                  box.current_status,
                  newBoxStatus,
                  userId || null,
                  `Parada ${stopNumber} completada - Ruta ${route.routenumber}`
                ])

                // Actualizar service_sales para el servicio de recogida
                if (newBoxStatus === 'recogida') {
                  await client.query(`
                    UPDATE service_sales
                    SET status = 'completed', completed_at = NOW()
                    WHERE box_tracking_id = $1 AND service_code = 'recogida'
                  `, [box.id])
                }

                boxTrackingUpdates.push({
                  boxId: box.id,
                  trackingCode: box.tracking_code,
                  previousStatus: box.current_status,
                  newStatus: newBoxStatus
                })

                console.log(`📦 [BoxTracking] Caja ${box.tracking_code}: ${box.current_status} → ${newBoxStatus}`)
              }
            }
          }
        }
      }

      // 3. Verificar si todas las paradas están completadas
      const allStopsCompleted = stops.every(
        (s: { status: string }) => s.status === 'completada' || s.status === 'fallida'
      )

      if (allStopsCompleted) {
        // Actualizar ruta a 'completada'
        await client.query(`
          UPDATE routes
          SET status = 'completada',
              endtime = NOW(),
              deliveredpackages = totalpackages,
              updatedat = NOW()
          WHERE id = $1
        `, [routeId])

        console.log(`🎉 [Ruta] Todas las paradas completadas. Ruta marcada como 'completada'`)
      }
    })

    // 4. Procesar distribución de pagos para cada orden completada
    // Esto se hace fuera de la transacción para no bloquear si falla el billing
    // Usa el nuevo API distribute-payment que maneja comisiones multi-usuario y pago a proveedores
    if (orderIds.length > 0) {
      const driverId = route.driverid
      const companyId = route.company_id

      // Determinar quién completó la parada: userId del request o driverId de la ruta
      const completedByUserId = userId || driverId
      const completedByRole = userRole || 'DRIVER'

      for (const orderId of orderIds) {
        try {
          console.log(`💰 [Distribute-Payment] Procesando distribución para orden ${orderId}`)

          // Registrar actividad de delivery antes del billing
          try {
            await db.query(`
              INSERT INTO order_activity_log (
                order_id, company_id, user_id, user_role,
                activity_type, previous_status, new_status,
                route_id, stop_number, source
              ) VALUES ($1, $2, $3, $4, 'delivered', 'in_transit', 'en_bodega', $5, $6, 'web')
            `, [orderId, companyId, completedByUserId, completedByRole, routeId, stopNumber])
          } catch (activityError) {
            console.error(`⚠️ [Activity] Error registrando actividad para orden ${orderId}:`, activityError)
          }

          // Llamar al nuevo API de distribución de pagos
          const billingResponse = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/billing/distribute-payment`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId,
                companyId,
                completedByUserId,
                completedByRole,
                chargeType: 'delivery'
              })
            }
          )

          const billingResult = await billingResponse.json()

          // Mapear resultado al formato esperado para compatibilidad
          const resultData = billingResult.data || {}
          billingResults.push({
            orderId,
            charged: resultData.charged || resultData.success,
            debitAmount: resultData.distribution?.grossAmount || 0,
            debitTransactionId: resultData.debitTransactionId,
            debitTransactionNumber: resultData.debitTransactionNumber,
            commissionAmount: resultData.commissions?.total || 0,
            commissionBreakdown: resultData.commissions?.breakdown || [],
            providerPayments: resultData.providerPayments?.payments || [],
            distribution: resultData.distribution,
            reason: resultData.reason,
            alreadyBilled: resultData.alreadyBilled,
            insufficientFunds: resultData.insufficientFunds
          })

          if (billingResult.success && resultData.charged) {
            const dist = resultData.distribution || {}
            console.log(`✅ [Distribute-Payment] Orden ${orderId}: ` +
              `Gross=$${dist.grossAmount || 0}, ` +
              `Comisiones=$${resultData.commissions?.total || 0}, ` +
              `Proveedores=$${resultData.providerPayments?.total || 0}`)
          } else {
            console.log(`⚠️ [Distribute-Payment] Orden ${orderId}: ${resultData.reason || 'No distribuido'}`)
          }
        } catch (billingError) {
          console.error(`❌ [Distribute-Payment] Error procesando orden ${orderId}:`, billingError)
          billingResults.push({
            orderId,
            charged: false,
            error: billingError instanceof Error ? billingError.message : 'Error de distribución'
          })
        }
      }
    }

    // Obtener datos actualizados
    const updatedRouteResult = await db.query(
      'SELECT * FROM routes WHERE id = $1',
      [routeId]
    )
    const updatedRoute = updatedRouteResult.rows[0]

    // Contar paradas completadas
    let updatedStops = updatedRoute.stops
    if (typeof updatedStops === 'string') {
      updatedStops = JSON.parse(updatedStops)
    }
    const completedStops = updatedStops.filter(
      (s: { status: string }) => s.status === 'completada'
    ).length

    // Calcular resumen de distribución de pagos
    const billedOrders = billingResults.filter(r => r.charged).length
    const totalBilled = billingResults.reduce((sum, r) => sum + (r.debitAmount || 0), 0)
    const totalCommission = billingResults.reduce((sum, r) => sum + (r.commissionAmount || 0), 0)
    const totalProviderPayments = billingResults.reduce((sum, r) => {
      const payments = r.providerPayments || []
      return sum + payments.reduce((ps: number, p: any) => ps + (p.amount || 0), 0)
    }, 0)

    // Extraer breakdown de comisiones (por usuario y tipo de actividad)
    const allCommissionBreakdown = billingResults.flatMap(r => r.commissionBreakdown || [])

    return NextResponse.json({
      success: true,
      message: `Parada ${stopNumber} completada exitosamente`,
      data: {
        routeId: updatedRoute.id,
        routeNumber: updatedRoute.routenumber,
        routeStatus: updatedRoute.status,
        stopNumber,
        stopStatus: 'completada',
        ordersUpdated: orderIds.length,
        completedStops,
        totalStops: updatedStops.length,
        routeCompleted: updatedRoute.status === 'completada',
        // Box tracking updates
        boxTracking: boxTrackingUpdates.length > 0 ? {
          updated: boxTrackingUpdates.length,
          boxes: boxTrackingUpdates
        } : undefined,
        billing: {
          processed: billingResults.length,
          billed: billedOrders,
          totalAmount: totalBilled,
          totalCommission,
          totalProviderPayments,
          // Desglose de comisiones por tipo de actividad
          commissionsByActivity: {
            creation: allCommissionBreakdown
              .filter((c: any) => c.activityType === 'creation')
              .reduce((sum: number, c: any) => sum + (c.amount || 0), 0),
            delivery: allCommissionBreakdown
              .filter((c: any) => c.activityType === 'delivery')
              .reduce((sum: number, c: any) => sum + (c.amount || 0), 0)
          },
          details: billingResults
        }
      }
    })

  } catch (error) {
    console.error('❌ [Error] POST /api/routes/[id]/stops/[stopNumber]/complete:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al completar la parada',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * POST /api/routes/[id]/stops/[stopNumber]/fail
 * Marca una parada como fallida
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stopNumber: string }> }
) {
  try {
    const resolvedParams = await params
    const routeId = parseInt(resolvedParams.id)
    const stopNumber = parseInt(resolvedParams.stopNumber)
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)

    const body = await request.json()
    const { status, reason } = body

    if (!status || !['completada', 'fallida'].includes(status)) {
      return NextResponse.json({
        success: false,
        error: 'Estado inválido. Debe ser: completada o fallida'
      }, { status: 400 })
    }

    console.log(`📝 [Actualizar Parada] Ruta ${routeId}, Parada ${stopNumber} → ${status}`)

    if (isNaN(routeId) || isNaN(stopNumber)) {
      return NextResponse.json({
        success: false,
        error: 'ID de ruta o número de parada inválido'
      }, { status: 400 })
    }

    // Verificar que la ruta existe
    let checkQuery = 'SELECT * FROM routes WHERE id = $1'
    const checkParams: (number | string)[] = [routeId]

    if (!isSuperAdmin && headerCompanyId) {
      checkQuery += ' AND company_id = $2'
      checkParams.push(headerCompanyId)
    }

    const routeResult = await db.query(checkQuery, checkParams)

    if (routeResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Ruta no encontrada'
      }, { status: 404 })
    }

    const route = routeResult.rows[0]

    // Parsear las paradas
    let stops = route.stops
    if (typeof stops === 'string') {
      try {
        stops = JSON.parse(stops)
      } catch (e) {
        stops = []
      }
    }
    stops = stops || []

    // Buscar la parada
    const stopIndex = stopNumber - 1
    if (stopIndex < 0 || stopIndex >= stops.length) {
      return NextResponse.json({
        success: false,
        error: `Parada ${stopNumber} no encontrada`
      }, { status: 404 })
    }

    // Actualizar estado de la parada
    stops[stopIndex].status = status
    if (reason) {
      stops[stopIndex].failReason = reason
    }

    await db.query(`
      UPDATE routes
      SET stops = $1,
          updatedat = NOW()
      WHERE id = $2
    `, [JSON.stringify(stops), routeId])

    // Si es completada, actualizar órdenes a en_bodega
    if (status === 'completada') {
      const stop = stops[stopIndex]
      const orderIds: number[] = []
      if (stop.orderId) orderIds.push(stop.orderId)
      if (stop.orderIds) orderIds.push(...stop.orderIds)

      if (orderIds.length > 0) {
        await db.query(`
          UPDATE package_orders
          SET status = 'en_bodega',
              updatedat = NOW()
          WHERE id = ANY($1::int[])
        `, [orderIds])
      }
    }

    // Verificar si todas las paradas terminaron
    const allDone = stops.every(
      (s: { status: string }) => s.status === 'completada' || s.status === 'fallida'
    )

    if (allDone) {
      await db.query(`
        UPDATE routes
        SET status = 'completada',
            endtime = NOW(),
            updatedat = NOW()
        WHERE id = $1
      `, [routeId])
    }

    return NextResponse.json({
      success: true,
      message: `Parada ${stopNumber} actualizada a '${status}'`,
      data: {
        stopNumber,
        status,
        reason: reason || null,
        routeCompleted: allDone
      }
    })

  } catch (error) {
    console.error('❌ [Error] PATCH /api/routes/[id]/stops/[stopNumber]/complete:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar la parada',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
