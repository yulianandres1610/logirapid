import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import { apaCargoClient } from '@/lib/apacargo-client'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/office-orders/[id]/apacargo-label?type=emci|aero
 * Obtiene la etiqueta de ApaCargo como PDF
 *
 * Query params:
 * - type: 'emci' (EMCI Dispatch Label) o 'aero' (Aerovaradero Label)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    // Obtener tipo de etiqueta de query params
    const { searchParams } = new URL(request.url)
    const labelType = searchParams.get('type') || 'emci'

    if (!['emci', 'aero'].includes(labelType)) {
      return NextResponse.json({
        success: false,
        error: 'Tipo de etiqueta inválido. Use "emci" o "aero"'
      }, { status: 400 })
    }

    // Verificar autenticación
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    // Verificar que ApaCargo esté configurado
    if (!apaCargoClient.isConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'ApaCargo no está configurado'
      }, { status: 500 })
    }

    // Obtener la orden de la base de datos
    const orderResult = await db.query(`
      SELECT
        id,
        ordernumber,
        company_id,
        apacargo_order_id,
        apacargo_code
      FROM package_orders
      WHERE id = $1
    `, [orderId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Verificar permisos
    if (payload.role !== 'SUPER_ADMIN' && order.company_id !== payload.companyId) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para acceder a esta orden'
      }, { status: 403 })
    }

    // Verificar que la orden esté sincronizada
    if (!order.apacargo_code) {
      return NextResponse.json({
        success: false,
        error: 'La orden no está sincronizada con ApaCargo. Sincronice primero la orden.'
      }, { status: 400 })
    }

    console.log(`[ApaCargo Label] Obteniendo etiqueta ${labelType} para orden ${order.apacargo_code}`)

    // Obtener el PDF de ApaCargo
    let pdfBlob: Blob

    if (labelType === 'emci') {
      pdfBlob = await apaCargoClient.getEmciDispatchLabel(order.apacargo_code)
    } else {
      pdfBlob = await apaCargoClient.getAeroDispatchLabel(order.apacargo_code)
    }

    // Convertir Blob a ArrayBuffer
    const arrayBuffer = await pdfBlob.arrayBuffer()

    // Crear nombre de archivo
    const labelTypeName = labelType === 'emci' ? 'EMCI' : 'Aerovaradero'
    const filename = `Etiqueta_${labelTypeName}_${order.ordernumber}_${order.apacargo_code}.pdf`

    // Retornar el PDF
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': arrayBuffer.byteLength.toString(),
      }
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[ApaCargo Label] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error al obtener etiqueta de ApaCargo'
    }, { status: 500 })
  }
}
