import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import { createClient } from '@supabase/supabase-js'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

const BUCKET_NAME = 'company-private-documents'

// Lazy Supabase client getter
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase configuration missing')
  }
  return createClient(url, key)
}

// Bill denominations by currency
const BILL_DENOMINATIONS: Record<string, number[]> = {
  CUP: [10, 20, 50, 100, 200, 500, 1000],
  USD: [1, 5, 10, 20, 50, 100],
  EUR: [5, 10, 20, 50, 100, 200]
}

interface BillCount {
  [denomination: string]: number
}

interface BillDenominations {
  CUP?: BillCount
  USD?: BillCount
  EUR?: BillCount
}

/**
 * POST /api/broker/orders/[id]/deliver
 * Complete delivery with guided form (denominations, signature, photos)
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

    const body = await request.json()
    const {
      billDenominations,
      deliveryCurrency,
      signerName,
      signerIdNumber,
      signerRelation = 'recipient',
      signatureData,
      photos = [],
      latitude,
      longitude,
      notes,
      sendReceiptVia // 'sms', 'whatsapp', 'both', 'none'
    } = body

    // Validate required fields
    if (!billDenominations || !deliveryCurrency || !signerName) {
      return NextResponse.json({
        success: false,
        error: 'Se requieren denominaciones, moneda y nombre del firmante'
      }, { status: 400 })
    }

    if (!signatureData) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere la firma del cliente'
      }, { status: 400 })
    }

    // Verify order belongs to this broker and is in valid state
    const orderResult = await db.query(`
      SELECT ro.*, c.legalname as broker_name
      FROM remittance_orders ro
      JOIN companies c ON c.id = ro.broker_company_id
      WHERE ro.id = $1 AND ro.broker_company_id = $2
    `, [orderId, payload.companyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Order must be confirmed or in_delivery to complete
    if (!['confirmed', 'in_delivery'].includes(order.status)) {
      return NextResponse.json({
        success: false,
        error: `No se puede completar una orden en estado: ${order.status}`
      }, { status: 400 })
    }

    // Calculate total from denominations
    const totalDelivered = calculateTotalFromDenominations(billDenominations, deliveryCurrency)

    // Verify total matches expected amount
    const expectedAmount = parseFloat(order.receive_amount)
    if (Math.abs(totalDelivered - expectedAmount) > 0.01) {
      return NextResponse.json({
        success: false,
        error: `El total entregado (${totalDelivered} ${deliveryCurrency}) no coincide con el monto esperado (${expectedAmount} ${order.receive_currency})`,
        data: {
          totalDelivered,
          expectedAmount,
          difference: totalDelivered - expectedAmount
        }
      }, { status: 400 })
    }

    await db.query('BEGIN')

    try {
      // Upload signature to storage
      let signatureStoragePath = null
      if (signatureData) {
        signatureStoragePath = await uploadSignature(
          signatureData,
          payload.companyId,
          orderId
        )
      }

      // Process and store photo paths (already uploaded separately or base64)
      const processedPhotos = photos.map((photo: any, index: number) => ({
        path: photo.path || photo.storagePath,
        uploadedAt: photo.uploadedAt || new Date().toISOString(),
        type: photo.type || 'delivery'
      }))

      // Create delivery proof record
      const proofResult = await db.query(`
        INSERT INTO remittance_delivery_proofs (
          remittance_order_id, order_number,
          bill_denominations, total_delivered, delivery_currency,
          signature_data, signature_storage_path,
          signer_name, signer_id_number, signer_relation,
          photos, delivery_latitude, delivery_longitude,
          delivery_notes, delivered_by_user_id, delivered_by_name,
          delivered_at, receipt_sent_via, company_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, NOW(), $17, $18
        )
        ON CONFLICT (remittance_order_id) DO UPDATE SET
          bill_denominations = EXCLUDED.bill_denominations,
          total_delivered = EXCLUDED.total_delivered,
          signature_data = EXCLUDED.signature_data,
          signature_storage_path = EXCLUDED.signature_storage_path,
          signer_name = EXCLUDED.signer_name,
          signer_id_number = EXCLUDED.signer_id_number,
          photos = EXCLUDED.photos,
          delivery_latitude = EXCLUDED.delivery_latitude,
          delivery_longitude = EXCLUDED.delivery_longitude,
          delivery_notes = EXCLUDED.delivery_notes,
          delivered_at = NOW()
        RETURNING *
      `, [
        orderId, order.order_number,
        JSON.stringify(billDenominations), totalDelivered, deliveryCurrency,
        signatureData, signatureStoragePath,
        signerName, signerIdNumber || null, signerRelation,
        JSON.stringify(processedPhotos), latitude || null, longitude || null,
        notes || null, payload.userId, payload.email,
        sendReceiptVia || 'none', payload.companyId
      ])

      const deliveryProof = proofResult.rows[0]

      // Update order status to delivered
      await db.query(`
        UPDATE remittance_orders
        SET
          status = 'delivered',
          delivered_at = NOW(),
          delivered_by_user_id = $2,
          delivery_proof_id = $3,
          updated_at = NOW()
        WHERE id = $1
      `, [orderId, payload.userId, deliveryProof.id])

      // Complete the fund delivery (deduct from reserved)
      const deliveryResult = await db.query(`
        SELECT complete_broker_delivery($1, $2) as completed
      `, [orderId, payload.userId])

      const fundsDeducted = deliveryResult.rows[0]?.completed === true

      await db.query('COMMIT')

      // Send receipt if requested (async, don't wait)
      if (sendReceiptVia && sendReceiptVia !== 'none') {
        sendDeliveryReceipt(order, deliveryProof, sendReceiptVia).catch(err => {
          console.error('[Deliver API] Error sending receipt:', err)
        })
      }

      return NextResponse.json({
        success: true,
        message: 'Entrega completada exitosamente',
        data: {
          status: 'delivered',
          orderNumber: order.order_number,
          totalDelivered,
          currency: deliveryCurrency,
          denominations: billDenominations,
          signerName,
          fundsDeducted,
          receiptSentVia: sendReceiptVia,
          proofId: deliveryProof.id
        }
      })

    } catch (err) {
      await db.query('ROLLBACK')
      throw err
    }

  } catch (error) {
    console.error('[Deliver API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al completar entrega'
    }, { status: 500 })
  }
}

/**
 * GET /api/broker/orders/[id]/deliver
 * Get denomination options and order details for delivery form
 */
export async function GET(
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

    // Get order details
    const orderResult = await db.query(`
      SELECT
        ro.*,
        c.legalname as broker_name,
        sc.legalname as selling_company_name
      FROM remittance_orders ro
      JOIN companies c ON c.id = ro.broker_company_id
      LEFT JOIN companies sc ON sc.id = ro.selling_company_id
      WHERE ro.id = $1 AND ro.broker_company_id = $2
    `, [orderId, payload.companyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Check if already delivered
    let existingProof = null
    if (order.status === 'delivered') {
      const proofResult = await db.query(`
        SELECT * FROM remittance_delivery_proofs
        WHERE remittance_order_id = $1
      `, [orderId])
      if (proofResult.rows.length > 0) {
        existingProof = proofResult.rows[0]
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        order: {
          id: order.id,
          orderNumber: order.order_number,
          status: order.status,
          receiveAmount: parseFloat(order.receive_amount),
          receiveCurrency: order.receive_currency,
          recipientName: order.recipient_name,
          recipientPhone: order.recipient_phone,
          recipientAddress: order.recipient_address,
          recipientProvince: order.recipient_province,
          recipientMunicipality: order.recipient_municipality,
          hasAlternateContact: order.has_alternate_contact,
          alternateContactName: order.alternate_contact_name,
          alternateContactPhone: order.alternate_contact_phone,
          sellingCompanyName: order.selling_company_name,
          createdAt: order.created_at
        },
        denominations: BILL_DENOMINATIONS,
        existingProof: existingProof ? {
          id: existingProof.id,
          billDenominations: existingProof.bill_denominations,
          totalDelivered: parseFloat(existingProof.total_delivered),
          signerName: existingProof.signer_name,
          deliveredAt: existingProof.delivered_at
        } : null
      }
    })

  } catch (error) {
    console.error('[Deliver API] GET error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener datos'
    }, { status: 500 })
  }
}

/**
 * Calculate total from bill denominations
 */
function calculateTotalFromDenominations(
  denominations: BillDenominations,
  currency: string
): number {
  let total = 0

  const currencyDenoms = denominations[currency as keyof BillDenominations]
  if (currencyDenoms) {
    Object.entries(currencyDenoms).forEach(([denom, count]) => {
      total += parseInt(denom) * (count || 0)
    })
  }

  return total
}

/**
 * Upload signature to Supabase Storage
 * Returns storagePath on success, null on failure
 * Note: If upload fails, the signature will still be saved as base64 in the database
 */
async function uploadSignature(
  signatureData: string,
  companyId: number,
  orderId: number
): Promise<string | null> {
  try {
    // Verify Supabase credentials exist
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.log('[Upload Signature] Supabase not configured, skipping storage upload')
      return null
    }

    // Remove data URL prefix if present
    let base64Data = signatureData
    if (signatureData.startsWith('data:')) {
      base64Data = signatureData.split(',')[1]
    }

    const buffer = Buffer.from(base64Data, 'base64')
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 10)
    const storagePath = `company-${companyId}/remittance-proofs/order-${orderId}/signature-${timestamp}-${randomSuffix}.png`

    const supabase = getSupabaseClient()

    // Try to upload
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: 'image/png',
        upsert: true
      })

    if (error) {
      console.error('[Upload Signature] Storage error:', error.message)
      // Check if bucket doesn't exist
      if (error.message.includes('Bucket not found') || error.message.includes('not found')) {
        console.log('[Upload Signature] Bucket does not exist. Run setup-private-documents-storage.js to create it.')
      }
      return null
    }

    console.log(`[Upload Signature] Successfully uploaded to ${storagePath}`)
    return storagePath
  } catch (error) {
    console.error('[Upload Signature] Error:', error)
    return null
  }
}

/**
 * Send delivery receipt via SMS/WhatsApp
 */
async function sendDeliveryReceipt(
  order: any,
  proof: any,
  method: 'sms' | 'whatsapp' | 'both'
) {
  const message = `[CubaRapid] Entrega confirmada
Orden: ${order.order_number}
Monto: ${proof.total_delivered} ${proof.delivery_currency}
Entregado a: ${proof.signer_name}
Fecha: ${new Date(proof.delivered_at).toLocaleString('es-ES')}
Gracias por usar nuestros servicios.`

  const recipientPhone = order.recipient_phone

  if (!recipientPhone) {
    console.log('[Send Receipt] No recipient phone number')
    return
  }

  if (method === 'sms' || method === 'both') {
    try {
      // Use existing SMS service
      const smsModule = await import('@/lib/sms-service')
      if (smsModule.sendSMS) {
        await smsModule.sendSMS(recipientPhone, message)
        console.log(`[Send Receipt] SMS sent to ${recipientPhone}`)
      }
    } catch (err) {
      console.error('[Send Receipt] SMS error:', err)
    }
  }

  if (method === 'whatsapp' || method === 'both') {
    try {
      // WhatsApp integration - to be implemented
      console.log(`[Send Receipt] WhatsApp would be sent to ${recipientPhone}`)
      // TODO: Implement WhatsApp Business API integration
    } catch (err) {
      console.error('[Send Receipt] WhatsApp error:', err)
    }
  }

  // Update proof with sent timestamp
  await db.query(`
    UPDATE remittance_delivery_proofs
    SET receipt_sent_at = NOW()
    WHERE id = $1
  `, [proof.id])
}
