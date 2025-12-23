import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/print/services/[id]
 * Get a specific print service with its printers
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    const { id } = await params
    const serviceId = parseInt(id)

    if (isNaN(serviceId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    // Get service
    const serviceResult = await db.query(`
      SELECT
        ps.*,
        mw.name as warehouse_name,
        u.email as created_by_email
      FROM print_services ps
      LEFT JOIN market_warehouses mw ON ps.warehouse_id = mw.id
      LEFT JOIN users u ON ps.created_by = u.id
      WHERE ps.id = $1 AND ps.company_id = $2
    `, [serviceId, payload.companyId])

    if (serviceResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Servicio no encontrado'
      }, { status: 404 })
    }

    const service = serviceResult.rows[0]

    // Get printers for this service
    const printersResult = await db.query(`
      SELECT
        id,
        printer_name,
        printer_id,
        driver_name,
        printer_type,
        connection_type,
        network_address,
        is_online,
        is_default,
        last_status_check,
        supports_escpos,
        supports_raw,
        paper_width_mm,
        dpi,
        created_at,
        updated_at
      FROM print_service_printers
      WHERE print_service_id = $1
      ORDER BY is_default DESC, printer_name ASC
    `, [serviceId])

    // Get recent jobs for this service
    const jobsResult = await db.query(`
      SELECT
        id,
        job_number,
        document_type,
        status,
        copies,
        created_at,
        completed_at,
        error_message
      FROM print_jobs
      WHERE print_service_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [serviceId])

    // Check if service is offline
    const lastSeen = service.last_seen_at ? new Date(service.last_seen_at) : null
    const isOffline = lastSeen && (Date.now() - lastSeen.getTime()) > 2 * 60 * 1000

    return NextResponse.json({
      success: true,
      data: {
        service: {
          id: service.id,
          serviceCode: service.service_code,
          serviceName: service.service_name,
          warehouseId: service.warehouse_id,
          warehouseName: service.warehouse_name,
          status: isOffline && service.status === 'active' ? 'offline' : service.status,
          lastSeenAt: service.last_seen_at,
          lastIpAddress: service.last_ip_address,
          version: service.version,
          platform: service.platform,
          hostname: service.hostname,
          createdAt: service.created_at,
          createdByEmail: service.created_by_email,
          apiKey: service.api_key // Return API key for display (secret is not stored)
        },
        printers: printersResult.rows.map(p => ({
          id: p.id,
          printerName: p.printer_name,
          printerId: p.printer_id,
          driverName: p.driver_name,
          printerType: p.printer_type,
          connectionType: p.connection_type,
          networkAddress: p.network_address,
          isOnline: p.is_online,
          isDefault: p.is_default,
          lastStatusCheck: p.last_status_check,
          supportsEscpos: p.supports_escpos,
          supportsRaw: p.supports_raw,
          paperWidthMm: p.paper_width_mm,
          dpi: p.dpi,
          createdAt: p.created_at
        })),
        recentJobs: jobsResult.rows.map(j => ({
          id: j.id,
          jobNumber: j.job_number,
          documentType: j.document_type,
          status: j.status,
          copies: j.copies,
          createdAt: j.created_at,
          completedAt: j.completed_at,
          errorMessage: j.error_message
        }))
      }
    })

  } catch (error) {
    console.error('[Print Services API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener servicio'
    }, { status: 500 })
  }
}

/**
 * PUT /api/print/services/[id]
 * Update a print service
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    if (!['ADMIN', 'SUPER_ADMIN'].includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'No tienes permisos para modificar servicios de impresión'
      }, { status: 403 })
    }

    const { id } = await params
    const serviceId = parseInt(id)

    if (isNaN(serviceId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    // Verify service belongs to company
    const serviceCheck = await db.query(
      'SELECT id FROM print_services WHERE id = $1 AND company_id = $2',
      [serviceId, payload.companyId]
    )

    if (serviceCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Servicio no encontrado'
      }, { status: 404 })
    }

    const body = await request.json()
    const { serviceName, warehouseId, status, regenerateCredentials } = body

    // Build update query dynamically
    const updates: string[] = []
    const updateParams: (string | number | null)[] = []
    let paramIndex = 1

    if (serviceName !== undefined) {
      updates.push(`service_name = $${paramIndex}`)
      updateParams.push(serviceName)
      paramIndex++
    }

    if (warehouseId !== undefined) {
      // Verify warehouse if provided
      if (warehouseId !== null) {
        const warehouseCheck = await db.query(
          'SELECT id FROM market_warehouses WHERE id = $1 AND company_id = $2',
          [warehouseId, payload.companyId]
        )
        if (warehouseCheck.rows.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'Almacén no encontrado'
          }, { status: 400 })
        }
      }
      updates.push(`warehouse_id = $${paramIndex}`)
      updateParams.push(warehouseId)
      paramIndex++
    }

    if (status !== undefined && ['active', 'disabled'].includes(status)) {
      updates.push(`status = $${paramIndex}`)
      updateParams.push(status)
      paramIndex++
    }

    // Regenerate API credentials if requested
    let newCredentials = null
    if (regenerateCredentials) {
      const apiKey = `pk_${crypto.randomBytes(24).toString('hex')}`
      const apiSecret = `sk_${crypto.randomBytes(32).toString('hex')}`
      const apiSecretHash = crypto.createHash('sha256').update(apiSecret).digest('hex')

      updates.push(`api_key = $${paramIndex}`)
      updateParams.push(apiKey)
      paramIndex++

      updates.push(`api_secret_hash = $${paramIndex}`)
      updateParams.push(apiSecretHash)
      paramIndex++

      newCredentials = { apiKey, apiSecret }
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay campos para actualizar'
      }, { status: 400 })
    }

    updates.push('updated_at = NOW()')
    updateParams.push(serviceId)

    await db.query(
      `UPDATE print_services SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      updateParams
    )

    const response: { success: boolean; message: string; data?: { apiKey: string; apiSecret: string } } = {
      success: true,
      message: 'Servicio actualizado correctamente'
    }

    if (newCredentials) {
      response.data = newCredentials
      response.message = 'Servicio actualizado. Nuevas credenciales API generadas. Guárdelas de forma segura.'
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('[Print Services API] Error updating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar servicio'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/print/services/[id]
 * Delete a print service
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    if (!['ADMIN', 'SUPER_ADMIN'].includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'No tienes permisos para eliminar servicios de impresión'
      }, { status: 403 })
    }

    const { id } = await params
    const serviceId = parseInt(id)

    if (isNaN(serviceId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    // Verify service belongs to company
    const serviceCheck = await db.query(
      'SELECT service_code FROM print_services WHERE id = $1 AND company_id = $2',
      [serviceId, payload.companyId]
    )

    if (serviceCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Servicio no encontrado'
      }, { status: 404 })
    }

    const serviceCode = serviceCheck.rows[0].service_code

    // Delete service (cascades to printers and clears references in jobs/configs)
    await db.query('DELETE FROM print_services WHERE id = $1', [serviceId])

    console.log(`[Print Services] Deleted service ${serviceCode} by user ${payload.email}`)

    return NextResponse.json({
      success: true,
      message: 'Servicio de impresión eliminado'
    })

  } catch (error) {
    console.error('[Print Services API] Error deleting:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar servicio'
    }, { status: 500 })
  }
}
