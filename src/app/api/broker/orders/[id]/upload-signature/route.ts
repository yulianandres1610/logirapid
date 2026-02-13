import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import * as storageAdapter from '@/lib/storage-adapter'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

const BUCKET_NAME = 'company-private-documents'
const MAX_SIGNATURE_SIZE = 2 * 1024 * 1024 // 2MB

/**
 * POST /api/broker/orders/[id]/upload-signature
 * Upload signature for delivery proof
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    // Verify order belongs to this broker
    const orderResult = await db.query(`
      SELECT id, order_number, broker_company_id, status
      FROM remittance_orders
      WHERE id = $1 AND broker_company_id = $2
    `, [orderId, payload.companyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Get signature data from request
    const body = await request.json()
    const { signatureData, signerName } = body

    if (!signatureData) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere datos de firma'
      }, { status: 400 })
    }

    // Remove data URL prefix if present
    let base64Data = signatureData
    let contentType = 'image/png'

    if (signatureData.startsWith('data:')) {
      const matches = signatureData.match(/^data:(.+);base64,(.+)$/)
      if (matches) {
        contentType = matches[1]
        base64Data = matches[2]
      }
    }

    // Convert to buffer and check size
    const buffer = Buffer.from(base64Data, 'base64')

    if (buffer.length > MAX_SIGNATURE_SIZE) {
      return NextResponse.json({
        success: false,
        error: 'La firma excede el tamaño máximo de 2MB'
      }, { status: 400 })
    }

    // Generate storage path
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 10)
    const extension = contentType.split('/')[1] || 'png'
    const storagePath = `company-${payload.companyId}/remittance-proofs/order-${orderId}/signature-${timestamp}-${randomSuffix}.${extension}`

    // Upload to Storage
    const uploadResult = await storageAdapter.upload(BUCKET_NAME, storagePath, buffer, {
      contentType,
      upsert: true
    })

    if (!uploadResult.success) {
      console.error('[Upload Signature] Storage error:', uploadResult.error)
      return NextResponse.json({
        success: false,
        error: 'Error al guardar firma'
      }, { status: 500 })
    }

    // Update or create delivery proof with signature
    await db.query(`
      INSERT INTO remittance_delivery_proofs (
        remittance_order_id, order_number,
        signature_data, signature_storage_path, signer_name,
        bill_denominations, total_delivered, delivery_currency,
        company_id
      ) VALUES ($1, $2, $3, $4, $5, '{}', 0, 'CUP', $6)
      ON CONFLICT (remittance_order_id) DO UPDATE SET
        signature_data = EXCLUDED.signature_data,
        signature_storage_path = EXCLUDED.signature_storage_path,
        signer_name = COALESCE(EXCLUDED.signer_name, remittance_delivery_proofs.signer_name)
    `, [orderId, order.order_number, signatureData, storagePath, signerName || null, payload.companyId])

    console.log(`[Upload Signature] Signature uploaded for order ${orderId}: ${storagePath}`)

    return NextResponse.json({
      success: true,
      data: {
        storagePath,
        orderId,
        orderNumber: order.order_number
      },
      message: 'Firma guardada exitosamente'
    })

  } catch (error) {
    console.error('[Upload Signature] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al subir firma'
    }, { status: 500 })
  }
}
