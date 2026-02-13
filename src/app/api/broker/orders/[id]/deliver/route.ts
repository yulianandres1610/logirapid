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

    // Use dedicated client for transaction to ensure all queries are on the same connection
    const client = await db.getClient()

    try {
      await client.query('BEGIN')

      // Upload signature to storage (outside transaction since it's external storage)
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
      const proofResult = await client.query(`
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

      // Update order status to delivered with all fields
      await client.query(`
        UPDATE remittance_orders
        SET
          status = 'delivered',
          delivered_at = NOW(),
          delivered_by_user_id = $2,
          delivery_proof_id = $3,
          delivery_signature = $4,
          delivery_notes = $5,
          updated_at = NOW()
        WHERE id = $1
      `, [orderId, payload.userId, deliveryProof.id, signatureStoragePath, notes || null])

      // Complete the fund delivery - deduct from wallet
      let fundsDeducted = false
      const deliveryAmount = parseFloat(order.receive_amount)
      const deliveryCurrencyFromOrder = order.receive_currency || deliveryCurrency

      try {
        // First, check if there's a reservation
        const reservationResult = await client.query(`
          SELECT * FROM broker_reservations
          WHERE remittance_order_id = $1 AND status = 'reserved'
          FOR UPDATE
        `, [orderId])

        if (reservationResult.rows.length > 0) {
          // Has reservation - deduct from reserved balance
          const reservation = reservationResult.rows[0]

          // Get current balances
          const balanceResult = await client.query(`
            SELECT available_balance, reserved_balance
            FROM broker_wallet_balances
            WHERE company_id = $1 AND currency = $2
          `, [reservation.broker_company_id, reservation.currency])

          const availableBefore = parseFloat(balanceResult.rows[0]?.available_balance || '0')
          const reservedBefore = parseFloat(balanceResult.rows[0]?.reserved_balance || '0')

          // Reduce reserved balance (money was delivered)
          await client.query(`
            UPDATE broker_wallet_balances
            SET reserved_balance = GREATEST(reserved_balance - $1, 0), updated_at = NOW()
            WHERE company_id = $2 AND currency = $3
          `, [reservation.amount, reservation.broker_company_id, reservation.currency])

          // Update reservation status
          await client.query(`
            UPDATE broker_reservations
            SET status = 'completed', released_at = NOW(), released_by = $1
            WHERE id = $2
          `, [payload.userId, reservation.id])

          // Log to broker_wallet_transactions
          await client.query(`
            INSERT INTO broker_wallet_transactions (
              broker_company_id, currency, transaction_type, amount,
              balance_before, balance_after, reserved_before, reserved_after,
              reference_type, reference_id, created_by, notes
            ) VALUES ($1, $2, 'delivery', $3, $4, $4, $5, $6, 'remittance_order', $7, $8, $9)
          `, [
            reservation.broker_company_id, reservation.currency, reservation.amount,
            availableBefore, reservedBefore, Math.max(0, reservedBefore - parseFloat(reservation.amount)),
            orderId, payload.userId, `Entrega completada - Orden ${order.order_number}`
          ])

          // Log to main wallet_transactions
          await client.query(`
            INSERT INTO wallet_transactions (
              type, source_type, source_company_id, amount, fee, net_amount, currency,
              status, description, notes, created_by
            ) VALUES ('debit', 'company', $1, $2, 0, $2, $3, 'completed', $4, $5, $6)
          `, [
            reservation.broker_company_id, reservation.amount, reservation.currency,
            `Débito - Entrega Remesa`, `Orden: ${order.order_number}`, payload.userId
          ])

          fundsDeducted = true
        } else {
          // No reservation - deduct directly from available balance
          console.log(`[Deliver] No reservation found for order ${orderId}, deducting from available balance`)

          // Get current balance
          const balanceResult = await client.query(`
            SELECT available_balance, reserved_balance
            FROM broker_wallet_balances
            WHERE company_id = $1 AND currency = $2
            FOR UPDATE
          `, [payload.companyId, deliveryCurrencyFromOrder])

          if (balanceResult.rows.length > 0) {
            const availableBefore = parseFloat(balanceResult.rows[0].available_balance || '0')
            const reservedBefore = parseFloat(balanceResult.rows[0].reserved_balance || '0')

            // Deduct from available balance
            await client.query(`
              UPDATE broker_wallet_balances
              SET available_balance = GREATEST(available_balance - $1, 0), updated_at = NOW()
              WHERE company_id = $2 AND currency = $3
            `, [deliveryAmount, payload.companyId, deliveryCurrencyFromOrder])

            // Log to broker_wallet_transactions
            await client.query(`
              INSERT INTO broker_wallet_transactions (
                broker_company_id, currency, transaction_type, amount,
                balance_before, balance_after, reserved_before, reserved_after,
                reference_type, reference_id, created_by, notes
              ) VALUES ($1, $2, 'delivery', $3, $4, $5, $6, $6, 'remittance_order', $7, $8, $9)
            `, [
              payload.companyId, deliveryCurrencyFromOrder, deliveryAmount,
              availableBefore, Math.max(0, availableBefore - deliveryAmount),
              reservedBefore, orderId, payload.userId,
              `Entrega completada - Orden ${order.order_number} (sin reserva previa)`
            ])

            // Log to main wallet_transactions
            await client.query(`
              INSERT INTO wallet_transactions (
                type, source_type, source_company_id, amount, fee, net_amount, currency,
                status, description, notes, created_by
              ) VALUES ('debit', 'company', $1, $2, 0, $2, $3, 'completed', $4, $5, $6)
            `, [
              payload.companyId, deliveryAmount, deliveryCurrencyFromOrder,
              `Débito - Entrega Remesa`, `Orden: ${order.order_number}`, payload.userId
            ])

            fundsDeducted = true
            console.log(`[Deliver] Deducted ${deliveryAmount} ${deliveryCurrencyFromOrder} from available balance`)
          } else {
            console.log(`[Deliver] No wallet balance found for ${deliveryCurrencyFromOrder}, skipping deduction`)
          }
        }
      } catch (fundErr) {
        console.error('[Deliver] Error processing funds:', fundErr)
        // Continue even if funds processing fails - the delivery proof is saved
      }

      await client.query('COMMIT')

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
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
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
          // Amounts
          sendAmount: parseFloat(order.send_amount) || 0,
          sendCurrency: order.send_currency || 'USD',
          receiveAmount: parseFloat(order.receive_amount) || 0,
          receiveCurrency: order.receive_currency || 'CUP',
          exchangeRate: parseFloat(order.exchange_rate) || 1,
          totalCharged: parseFloat(order.total_charged) || 0,
          serviceFee: parseFloat(order.service_fee) || 0,
          // Recipient
          recipientName: order.recipient_name,
          recipientPhone: order.recipient_phone,
          recipientIdNumber: order.recipient_id_number,
          recipientAddress: order.recipient_address,
          recipientNeighborhood: order.recipient_neighborhood,
          recipientProvince: order.recipient_province,
          recipientMunicipality: order.recipient_municipality,
          recipientAddressReferences: order.recipient_address_references,
          // Alternate contact
          hasAlternateContact: order.has_alternate_contact,
          alternateContactName: order.alternate_contact_name,
          alternateContactPhone: order.alternate_contact_phone,
          // Sender
          senderName: order.sender_name,
          senderPhone: order.sender_phone,
          senderEmail: order.sender_email,
          // Companies
          sellingCompanyName: order.selling_company_name,
          brokerCompanyName: order.broker_name,
          // Timing
          estimatedDelivery: order.estimated_delivery,
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
 * Creates bucket automatically if it doesn't exist
 */
async function uploadSignature(
  signatureData: string,
  companyId: number,
  orderId: number
): Promise<string | null> {
  try {
    if (!storageAdapter.isConfigured()) {
      console.log('[Upload Signature] Storage not configured, skipping upload')
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

    // Upload file
    const uploadResult = await storageAdapter.upload(BUCKET_NAME, storagePath, buffer, {
      contentType: 'image/png',
      upsert: true
    })

    if (!uploadResult.success) {
      console.error('[Upload Signature] Storage error:', uploadResult.error)
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
