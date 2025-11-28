import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST: Crear un nuevo comprobante de entrega
export async function POST(request: NextRequest) {
  try {
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)
    const body = await request.json()

    const {
      orderId,
      signatureData,
      signatureStoragePath,
      signerName,
      signerRelation,
      photos = [],
      latitude,
      longitude,
      notes,
      createdBy,
      createdByName,
      markAsDelivered = false
    } = body

    // Validaciones básicas
    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: 'orderId es requerido'
      }, { status: 400 })
    }

    // Validar que tenga firma Y foto para marcar como entregado
    if (markAsDelivered) {
      if (!signatureData || signatureData.trim() === '') {
        return NextResponse.json({
          success: false,
          error: 'La firma electrónica es obligatoria para marcar como entregado'
        }, { status: 400 })
      }

      if (!photos || photos.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Al menos una foto es obligatoria para marcar como entregado'
        }, { status: 400 })
      }
    }

    // Obtener la orden para validar acceso y obtener order_number
    let orderQuery = 'SELECT id, ordernumber, company_id, status FROM package_orders WHERE id = $1'
    const orderParams: any[] = [orderId]

    if (!isSuperAdmin && headerCompanyId) {
      orderQuery += ' AND company_id = $2'
      orderParams.push(headerCompanyId)
    }

    const orderResult = await db.query(orderQuery, orderParams)

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada o no tiene acceso'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]
    const companyId = order.company_id

    // Verificar si ya existe un comprobante para esta orden
    const existingProof = await db.query(
      'SELECT id FROM delivery_proofs WHERE order_id = $1 AND company_id = $2',
      [orderId, companyId]
    )

    let proofId: number

    if (existingProof.rows.length > 0) {
      // Actualizar comprobante existente
      proofId = existingProof.rows[0].id

      const updateQuery = `
        UPDATE delivery_proofs SET
          signature_data = COALESCE($1, signature_data),
          signature_storage_path = COALESCE($2, signature_storage_path),
          signer_name = COALESCE($3, signer_name),
          signer_relation = COALESCE($4, signer_relation),
          photos = CASE WHEN $5::jsonb IS NOT NULL THEN $5::jsonb ELSE photos END,
          delivery_latitude = COALESCE($6, delivery_latitude),
          delivery_longitude = COALESCE($7, delivery_longitude),
          notes = COALESCE($8, notes),
          updated_at = NOW()
        WHERE id = $9
        RETURNING *
      `

      await db.query(updateQuery, [
        signatureData || null,
        signatureStoragePath || null,
        signerName || null,
        signerRelation || null,
        photos.length > 0 ? JSON.stringify(photos) : null,
        latitude || null,
        longitude || null,
        notes || null,
        proofId
      ])
    } else {
      // Crear nuevo comprobante
      const insertQuery = `
        INSERT INTO delivery_proofs (
          order_id, order_number,
          signature_data, signature_storage_path, signer_name, signer_relation,
          photos,
          delivery_latitude, delivery_longitude,
          notes,
          created_by, created_by_name,
          company_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `

      const insertResult = await db.query(insertQuery, [
        orderId,
        order.ordernumber,
        signatureData || null,
        signatureStoragePath || null,
        signerName || null,
        signerRelation || null,
        JSON.stringify(photos),
        latitude || null,
        longitude || null,
        notes || null,
        createdBy || null,
        createdByName || null,
        companyId
      ])

      proofId = insertResult.rows[0].id
    }

    // Actualizar la orden con referencia al comprobante y estado
    const hasSignature = signatureData && signatureData.trim() !== ''
    const hasPhotos = photos && photos.length > 0
    const proofStatus = (hasSignature && hasPhotos) ? 'completed' : 'pending'

    let orderUpdateQuery = `
      UPDATE package_orders SET
        delivery_proof_id = $1,
        proof_status = $2
    `
    const orderUpdateParams: any[] = [proofId, proofStatus]

    // Si se solicita marcar como entregado y tiene todos los requisitos
    if (markAsDelivered && hasSignature && hasPhotos) {
      orderUpdateQuery += `,
        status = 'delivered',
        delivered_at = NOW()
      `
    }

    orderUpdateQuery += ` WHERE id = $${orderUpdateParams.length + 1}`
    orderUpdateParams.push(orderId)

    await db.query(orderUpdateQuery, orderUpdateParams)

    // Si se marcó como entregado, actualizar el contador de la ruta
    if (markAsDelivered && hasSignature && hasPhotos) {
      try {
        // Buscar si la orden está asociada a una ruta
        const routeCheck = await db.query(
          'SELECT routeid FROM package_orders WHERE id = $1',
          [orderId]
        )

        if (routeCheck.rows.length > 0 && routeCheck.rows[0].routeid) {
          const routeId = routeCheck.rows[0].routeid

          // Incrementar el contador de entregas completadas
          await db.query(
            `UPDATE routes SET
              deliveredpackages = COALESCE(deliveredpackages, 0) + 1,
              updatedat = NOW()
            WHERE id = $1`,
            [routeId]
          )

          console.log(`📦 Actualizado contador de ruta ${routeId}: +1 entrega`)
        }
      } catch (routeError) {
        console.error('Error updating route counter:', routeError)
        // No falla la operación principal
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: proofId,
        orderId,
        orderNumber: order.ordernumber,
        proofStatus,
        hasSignature,
        hasPhotos,
        photosCount: photos.length,
        markedAsDelivered: markAsDelivered && hasSignature && hasPhotos
      }
    }, { status: existingProof.rows.length > 0 ? 200 : 201 })

  } catch (error) {
    console.error('Error creating delivery proof:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al crear comprobante de entrega'
    }, { status: 500 })
  }
}

// GET: Listar comprobantes (con filtros opcionales)
export async function GET(request: NextRequest) {
  try {
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)
    const { searchParams } = new URL(request.url)

    const orderId = searchParams.get('orderId')
    const orderNumber = searchParams.get('orderNumber')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let query = `
      SELECT
        dp.*,
        po.status as order_status,
        po.recipientname,
        po.recipientaddress
      FROM delivery_proofs dp
      LEFT JOIN package_orders po ON dp.order_id = po.id
      WHERE 1=1
    `
    const queryParams: any[] = []
    let paramIndex = 1

    // Filtro por empresa
    if (!isSuperAdmin && headerCompanyId) {
      query += ` AND dp.company_id = $${paramIndex}`
      queryParams.push(headerCompanyId)
      paramIndex++
    }

    // Filtro por orden específica
    if (orderId) {
      query += ` AND dp.order_id = $${paramIndex}`
      queryParams.push(parseInt(orderId))
      paramIndex++
    }

    if (orderNumber) {
      query += ` AND dp.order_number = $${paramIndex}`
      queryParams.push(orderNumber)
      paramIndex++
    }

    // Ordenar y paginar
    query += ` ORDER BY dp.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    queryParams.push(limit, offset)

    const result = await db.query(query, queryParams)

    // Procesar resultados
    const proofs = result.rows.map(row => ({
      id: row.id,
      orderId: row.order_id,
      orderNumber: row.order_number,
      orderStatus: row.order_status,
      recipientName: row.recipientname,
      recipientAddress: row.recipientaddress,
      hasSignature: !!row.signature_data,
      signerName: row.signer_name,
      signerRelation: row.signer_relation,
      photos: typeof row.photos === 'string' ? JSON.parse(row.photos) : (row.photos || []),
      latitude: row.delivery_latitude,
      longitude: row.delivery_longitude,
      notes: row.notes,
      createdAt: row.created_at,
      createdByName: row.created_by_name
    }))

    return NextResponse.json({
      success: true,
      data: proofs,
      pagination: {
        page,
        limit,
        hasMore: result.rows.length === limit
      }
    })

  } catch (error) {
    console.error('Error listing delivery proofs:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al listar comprobantes de entrega'
    }, { status: 500 })
  }
}
