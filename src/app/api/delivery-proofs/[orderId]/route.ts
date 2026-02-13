import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'
import * as storageAdapter from '@/lib/storage-adapter'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

const BUCKET_NAME = 'company-private-documents'

// GET: Obtener comprobante de entrega por order ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const resolvedParams = await params
    const orderId = parseInt(resolvedParams.orderId)
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    // Construir query con validación de empresa
    let query = `
      SELECT
        dp.*,
        po.ordernumber,
        po.status as order_status,
        po.customername,
        po.phone as customerphone,
        po.customeraddress,
        po.city,
        po.state,
        po.office_order_data
      FROM delivery_proofs dp
      LEFT JOIN package_orders po ON dp.order_id = po.id
      WHERE dp.order_id = $1
    `
    const queryParams: any[] = [orderId]

    if (!isSuperAdmin && headerCompanyId) {
      query += ' AND dp.company_id = $2'
      queryParams.push(headerCompanyId)
    }

    const result = await db.query(query, queryParams)

    if (result.rows.length === 0) {
      // Verificar si la orden existe pero no tiene comprobante
      const orderCheck = await db.query(
        'SELECT id, ordernumber, status FROM package_orders WHERE id = $1',
        [orderId]
      )

      if (orderCheck.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Orden no encontrada'
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        data: null,
        message: 'La orden no tiene comprobante de entrega'
      })
    }

    const row = result.rows[0]

    // Parsear photos
    let photos: any[] = []
    try {
      photos = typeof row.photos === 'string' ? JSON.parse(row.photos) : (row.photos || [])
    } catch (e) {
      photos = []
    }

    // Generar URLs firmadas para las fotos
    if (photos.length > 0 && storageAdapter.isConfigured()) {
      for (const photo of photos) {
        if (photo.storagePath) {
          try {
            photo.signedUrl = await storageAdapter.createSignedUrl(BUCKET_NAME, photo.storagePath, 3600)
          } catch (e) {
            console.error('Error generating signed URL for photo:', e)
          }
        }
      }
    }

    // Parsear office_order_data para obtener datos del destinatario
    let officeData: any = {}
    try {
      officeData = typeof row.office_order_data === 'string'
        ? JSON.parse(row.office_order_data)
        : (row.office_order_data || {})
    } catch (e) {
      officeData = {}
    }

    // Extraer datos del destinatario
    const recipientName = officeData.receiverName || officeData.recipientName || row.customername || ''
    const recipientPhone = officeData.receiverPhone || officeData.recipientPhone || row.customerphone || ''
    const destination = officeData.destination || {}
    const recipientAddress = destination.fullAddress || destination.street || row.customeraddress || ''
    const recipientCity = destination.city || row.city || ''
    const recipientState = destination.state || row.state || ''

    const proof = {
      id: row.id,
      orderId: row.order_id,
      orderNumber: row.order_number || row.ordernumber,
      orderStatus: row.order_status,
      recipient: {
        name: recipientName,
        phone: recipientPhone,
        address: recipientAddress,
        city: recipientCity,
        state: recipientState
      },
      signature: {
        hasSignature: !!row.signature_data,
        data: row.signature_data,
        storagePath: row.signature_storage_path,
        signerName: row.signer_name,
        signerRelation: row.signer_relation
      },
      photos: photos,
      location: {
        latitude: row.delivery_latitude,
        longitude: row.delivery_longitude
      },
      notes: row.notes,
      metadata: {
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by,
        createdByName: row.created_by_name
      }
    }

    return NextResponse.json({
      success: true,
      data: proof
    })

  } catch (error) {
    console.error('Error getting delivery proof:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener comprobante de entrega'
    }, { status: 500 })
  }
}

// PATCH: Actualizar comprobante de entrega existente
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const resolvedParams = await params
    const orderId = parseInt(resolvedParams.orderId)
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)
    const body = await request.json()

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    const {
      signatureData,
      signerName,
      signerRelation,
      photos,
      latitude,
      longitude,
      notes,
      markAsDelivered = false
    } = body

    // Verificar que existe el comprobante
    let checkQuery = 'SELECT dp.*, po.status as order_status FROM delivery_proofs dp LEFT JOIN package_orders po ON dp.order_id = po.id WHERE dp.order_id = $1'
    const checkParams: any[] = [orderId]

    if (!isSuperAdmin && headerCompanyId) {
      checkQuery += ' AND dp.company_id = $2'
      checkParams.push(headerCompanyId)
    }

    const existing = await db.query(checkQuery, checkParams)

    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Comprobante no encontrado para esta orden'
      }, { status: 404 })
    }

    const currentProof = existing.rows[0]

    // Preparar datos actualizados
    const newSignature = signatureData !== undefined ? signatureData : currentProof.signature_data
    let newPhotos = photos !== undefined ? photos : currentProof.photos
    if (typeof newPhotos === 'string') {
      try {
        newPhotos = JSON.parse(newPhotos)
      } catch (e) {
        newPhotos = []
      }
    }

    // Validar para marcar como entregado
    if (markAsDelivered) {
      const hasSignature = newSignature && newSignature.trim() !== ''
      const hasPhotos = newPhotos && newPhotos.length > 0

      if (!hasSignature) {
        return NextResponse.json({
          success: false,
          error: 'La firma electrónica es obligatoria para marcar como entregado'
        }, { status: 400 })
      }

      if (!hasPhotos) {
        return NextResponse.json({
          success: false,
          error: 'Al menos una foto es obligatoria para marcar como entregado'
        }, { status: 400 })
      }
    }

    // Actualizar comprobante
    const updateQuery = `
      UPDATE delivery_proofs SET
        signature_data = COALESCE($1, signature_data),
        signer_name = COALESCE($2, signer_name),
        signer_relation = COALESCE($3, signer_relation),
        photos = CASE WHEN $4::jsonb IS NOT NULL THEN $4::jsonb ELSE photos END,
        delivery_latitude = COALESCE($5, delivery_latitude),
        delivery_longitude = COALESCE($6, delivery_longitude),
        notes = COALESCE($7, notes),
        updated_at = NOW()
      WHERE order_id = $8
      RETURNING *
    `

    const updateResult = await db.query(updateQuery, [
      signatureData || null,
      signerName || null,
      signerRelation || null,
      photos !== undefined ? JSON.stringify(photos) : null,
      latitude || null,
      longitude || null,
      notes || null,
      orderId
    ])

    const updatedProof = updateResult.rows[0]

    // Actualizar estado de la orden
    const hasSignature = updatedProof.signature_data && updatedProof.signature_data.trim() !== ''
    let photosArray = updatedProof.photos
    if (typeof photosArray === 'string') {
      try {
        photosArray = JSON.parse(photosArray)
      } catch (e) {
        photosArray = []
      }
    }
    const hasPhotos = photosArray && photosArray.length > 0
    const proofStatus = (hasSignature && hasPhotos) ? 'completed' : 'pending'

    let orderUpdateQuery = `
      UPDATE package_orders SET
        proof_status = $1
    `
    const orderUpdateParams: any[] = [proofStatus]

    if (markAsDelivered && hasSignature && hasPhotos) {
      orderUpdateQuery += `,
        status = 'delivered',
        delivered_at = NOW()
      `
    }

    orderUpdateQuery += ` WHERE id = $${orderUpdateParams.length + 1}`
    orderUpdateParams.push(orderId)

    await db.query(orderUpdateQuery, orderUpdateParams)

    return NextResponse.json({
      success: true,
      data: {
        id: updatedProof.id,
        orderId: updatedProof.order_id,
        proofStatus,
        hasSignature,
        hasPhotos,
        photosCount: photosArray.length,
        markedAsDelivered: markAsDelivered && hasSignature && hasPhotos,
        updatedAt: updatedProof.updated_at
      }
    })

  } catch (error) {
    console.error('Error updating delivery proof:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar comprobante de entrega'
    }, { status: 500 })
  }
}

// DELETE: Eliminar comprobante de entrega
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const resolvedParams = await params
    const orderId = parseInt(resolvedParams.orderId)
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    // Verificar acceso
    let checkQuery = 'SELECT id FROM delivery_proofs WHERE order_id = $1'
    const checkParams: any[] = [orderId]

    if (!isSuperAdmin && headerCompanyId) {
      checkQuery += ' AND company_id = $2'
      checkParams.push(headerCompanyId)
    }

    const existing = await db.query(checkQuery, checkParams)

    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Comprobante no encontrado'
      }, { status: 404 })
    }

    // Eliminar comprobante
    await db.query('DELETE FROM delivery_proofs WHERE order_id = $1', [orderId])

    // Actualizar orden para quitar referencia
    await db.query(
      `UPDATE package_orders SET
        delivery_proof_id = NULL,
        proof_status = 'none'
      WHERE id = $1`,
      [orderId]
    )

    return NextResponse.json({
      success: true,
      message: 'Comprobante eliminado correctamente'
    })

  } catch (error) {
    console.error('Error deleting delivery proof:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al eliminar comprobante de entrega'
    }, { status: 500 })
  }
}
