import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import {
  apaCargoClient,
  apaCargoMapper,
  ApaCargoOrderRequest,
  ApaCargoProduct
} from '@/lib/apacargo-client'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

interface OfficeOrderData {
  senderName?: string
  senderPhone?: string
  senderEmail?: string
  senderAddress?: string
  senderIdentification?: string
  receiverName?: string
  receiverPhone?: string
  receiverEmail?: string
  receiverIdentification?: string
  destination?: {
    street?: string
    streetNo?: string
    apartment?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
    provinceName?: string
    provinceId?: number | null
    municipalityName?: string
    municipalityId?: number | null
    reparto?: string
    fullAddress?: string
    deliveryInstructions?: string
  }
  serviceConfigs?: Array<{
    serviceId: number
    serviceName: string
    boxes: Array<{
      boxCode: string
      weight: string
      dimensions?: {
        length?: string
        width?: string
        height?: string
      }
      description?: string
    }>
  }>
}

/**
 * POST /api/office-orders/[id]/sync-apacargo
 * Sincroniza una orden de oficina con ApaCargo
 */
export async function POST(
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
        error: 'ApaCargo no está configurado. Verifique las variables de entorno APACARGO_USERNAME, APACARGO_PASSWORD y APACARGO_AGENCY_ID'
      }, { status: 500 })
    }

    // Obtener la orden de la base de datos
    const orderResult = await db.query(`
      SELECT
        po.*,
        c.firstname as customer_firstname,
        c.lastname as customer_lastname,
        c.phone as customer_phone,
        c.email as customer_email,
        ca.address_line1,
        ca.city as customer_city,
        ca.state as customer_state,
        ca.zipcode as customer_zipcode
      FROM package_orders po
      LEFT JOIN customers c ON po.customerid = c.id
      LEFT JOIN customer_addresses ca ON c.id = ca.customer_id AND ca.is_default = true
      WHERE po.id = $1
    `, [orderId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Verificar permisos (misma empresa o SUPER_ADMIN)
    if (payload.role !== 'SUPER_ADMIN' && order.company_id !== payload.companyId) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para sincronizar esta orden'
      }, { status: 403 })
    }

    // Verificar que no esté ya sincronizada
    if (order.apacargo_code) {
      return NextResponse.json({
        success: false,
        error: `La orden ya está sincronizada con ApaCargo (código: ${order.apacargo_code})`
      }, { status: 400 })
    }

    // Parsear office_order_data
    let officeOrderData: OfficeOrderData = {}
    try {
      officeOrderData = typeof order.office_order_data === 'string'
        ? JSON.parse(order.office_order_data)
        : order.office_order_data || {}
    } catch (e) {
      console.error('[ApaCargo Sync] Error parsing office_order_data:', e)
    }

    // Obtener datos adicionales del body si se proporcionan
    let bodyData: Partial<{
      senderIdentification: string
      receiverIdentification: string
      municipalityId: number
      streetNo: string
      serviceId: number
      shippingProductId: number
    }> = {}

    try {
      bodyData = await request.json()
    } catch {
      // Body vacío es válido
    }

    // Construir datos del remitente (sender)
    const senderName = officeOrderData.senderName || order.customername || ''
    const senderNameParts = apaCargoMapper.splitName(senderName)

    // Construir datos del destinatario (receiver)
    const receiverName = officeOrderData.receiverName ||
      `${order.firstname || ''} ${order.lastname || ''}`.trim()
    const receiverNameParts = apaCargoMapper.splitName(receiverName)

    // Construir productos (bultos/cajas)
    const products: ApaCargoProduct[] = []
    const serviceConfigs = officeOrderData.serviceConfigs || []

    for (const config of serviceConfigs) {
      for (const box of config.boxes || []) {
        // Parsear peso (puede ser "2.5 lbs" o "1.13 kg")
        let weightKg = 0
        if (box.weight) {
          const weightStr = box.weight.toLowerCase()
          const weightNum = parseFloat(weightStr)
          if (weightStr.includes('kg')) {
            weightKg = weightNum
          } else {
            // Asumimos libras
            weightKg = apaCargoMapper.lbsToKg(weightNum)
          }
        }

        // Parsear dimensiones
        const length = box.dimensions?.length ? parseFloat(box.dimensions.length) : 10
        const width = box.dimensions?.width ? parseFloat(box.dimensions.width) : 10
        const height = box.dimensions?.height ? parseFloat(box.dimensions.height) : 10

        products.push({
          shippingProductId: bodyData.shippingProductId || 1, // ID del tipo de producto (configurable)
          weight: weightKg || 1, // Mínimo 1 kg
          length: length || 10,
          width: width || 10,
          height: height || 10,
          description: box.description || `Bulto ${box.boxCode || ''}`,
        })
      }
    }

    // Si no hay productos de serviceConfigs, crear uno por defecto
    if (products.length === 0) {
      products.push({
        shippingProductId: bodyData.shippingProductId || 1,
        weight: 1,
        length: 10,
        width: 10,
        height: 10,
        description: 'Paquete',
      })
    }

    // Obtener dirección del destinatario
    const destination = officeOrderData.destination || {}
    const street = destination.street || order.street || ''
    const streetNo = bodyData.streetNo || destination.streetNo || apaCargoMapper.extractStreetNumber(street) || '1'
    const streetName = destination.streetNo ? street : apaCargoMapper.extractStreetName(street)

    // Construir petición para ApaCargo
    const apaCargoOrder: ApaCargoOrderRequest = {
      agencyId: apaCargoClient.getAgencyId(),
      serviceId: bodyData.serviceId,
      priority: false,
      comment: `Orden LogiRapid: ${order.ordernumber}`,
      sender: {
        firstName: senderNameParts.firstName || 'N/A',
        lastName: senderNameParts.lastName || 'N/A',
        cellPhone: apaCargoMapper.formatPhone(officeOrderData.senderPhone || order.customer_phone || ''),
        email: officeOrderData.senderEmail || order.customer_email,
        identification: bodyData.senderIdentification || officeOrderData.senderIdentification || '00000000',
        address: {
          addressLine1: officeOrderData.senderAddress || order.address_line1 || 'N/A',
          city: order.customer_city || 'Miami',
          stateId: 10, // Florida por defecto - TODO: mapear estados USA
          zipCode: order.customer_zipcode || '33101',
        }
      },
      receiver: {
        firstName: receiverNameParts.firstName || 'N/A',
        lastName: receiverNameParts.lastName || 'N/A',
        cellPhone: apaCargoMapper.formatPhone(officeOrderData.receiverPhone || ''),
        email: officeOrderData.receiverEmail,
        identification: bodyData.receiverIdentification || officeOrderData.receiverIdentification || '00000000000',
        street: streetName || 'Calle',
        streetNo: streetNo,
        apt: destination.apartment || order.apartment,
        city: destination.city || order.city || 'La Habana',
        municipalityId: bodyData.municipalityId || destination.municipalityId || 1, // Municipio por defecto
      },
      products
    }

    console.log('[ApaCargo Sync] Enviando orden a ApaCargo:', JSON.stringify(apaCargoOrder, null, 2))

    // Enviar a ApaCargo
    const apaCargoResponse = await apaCargoClient.createOrder(apaCargoOrder)

    console.log('[ApaCargo Sync] Respuesta de ApaCargo:', apaCargoResponse)

    // Guardar datos de ApaCargo en la orden
    await db.query(`
      UPDATE package_orders
      SET
        apacargo_order_id = $1,
        apacargo_code = $2,
        apacargo_synced_at = NOW(),
        apacargo_status = $3,
        apacargo_error = NULL,
        updatedat = NOW()
      WHERE id = $4
    `, [
      apaCargoResponse.id,
      apaCargoResponse.code,
      apaCargoResponse.status || 'created',
      orderId
    ])

    return NextResponse.json({
      success: true,
      message: 'Orden sincronizada con ApaCargo exitosamente',
      data: {
        orderId,
        orderNumber: order.ordernumber,
        apacargoOrderId: apaCargoResponse.id,
        apacargoCode: apaCargoResponse.code,
        apacargoStatus: apaCargoResponse.status,
      }
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[ApaCargo Sync] Error:', err)

    // Intentar guardar el error en la orden
    try {
      const { id } = await params
      const orderId = parseInt(id)
      if (!isNaN(orderId)) {
        await db.query(`
          UPDATE package_orders
          SET apacargo_error = $1, updatedat = NOW()
          WHERE id = $2
        `, [err.message, orderId])
      }
    } catch (e) {
      console.error('[ApaCargo Sync] Error guardando error:', e)
    }

    return NextResponse.json({
      success: false,
      error: err.message || 'Error al sincronizar con ApaCargo'
    }, { status: 500 })
  }
}

/**
 * GET /api/office-orders/[id]/sync-apacargo
 * Obtiene el estado de sincronización con ApaCargo
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

    // Verificar autenticación
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    // Obtener datos de sincronización
    const result = await db.query(`
      SELECT
        id,
        ordernumber,
        apacargo_order_id,
        apacargo_code,
        apacargo_synced_at,
        apacargo_status,
        apacargo_error
      FROM package_orders
      WHERE id = $1
    `, [orderId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.ordernumber,
        isSynced: !!order.apacargo_code,
        apacargoOrderId: order.apacargo_order_id,
        apacargoCode: order.apacargo_code,
        apacargoSyncedAt: order.apacargo_synced_at,
        apacargoStatus: order.apacargo_status,
        apacargoError: order.apacargo_error,
        isConfigured: apaCargoClient.isConfigured()
      }
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[ApaCargo Sync] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message
    }, { status: 500 })
  }
}
