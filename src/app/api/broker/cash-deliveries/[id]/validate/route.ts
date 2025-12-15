import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'
import {
  generateOTP,
  sendCashDeliveryOTPByChannel,
  maskPhoneNumber,
  OTP_EXPIRATION_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTPChannel
} from '@/lib/sms-service'

// Calculate total from bill denominations
function calculateTotalFromDenominations(denominations: { [key: string]: number }): number {
  let total = 0
  for (const [denomination, quantity] of Object.entries(denominations)) {
    total += parseInt(denomination) * (Number(quantity) || 0)
  }
  return total
}

// POST - Validate received amounts and send OTP
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const companyId = cookieStore.get('user-company-id')?.value

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params
    const orderId = parseInt(id)
    const brokerCompanyId = parseInt(companyId)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    const body = await request.json()
    const { receivedBillDenominations, channel = 'sms' } = body
    const otpChannel: OTPChannel = channel === 'whatsapp' ? 'whatsapp' : 'sms'

    if (!receivedBillDenominations || typeof receivedBillDenominations !== 'object') {
      return NextResponse.json({
        success: false,
        error: 'Se requiere receivedBillDenominations'
      }, { status: 400 })
    }

    // Get order and verify it belongs to this broker
    // Note: broker_company_name is already stored in cash_delivery_orders, so we don't need to join
    const orderResult = await db.query(`
      SELECT cdo.*
      FROM cash_delivery_orders cdo
      WHERE cdo.id = $1 AND cdo.broker_company_id = $2
    `, [orderId, brokerCompanyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Allow validation from multiple statuses (be more permissive)
    const allowedStatuses = ['pending', 'in_transit', 'pending_reception', 'validating']
    if (!allowedStatuses.includes(order.status)) {
      return NextResponse.json({
        success: false,
        error: `No se puede validar una orden en estado: ${order.status}. Estados permitidos: ${allowedStatuses.join(', ')}`
      }, { status: 400 })
    }

    // Check if blocked (only if otp_attempts column exists)
    const otpAttempts = order.otp_attempts || 0
    if (otpAttempts >= OTP_MAX_ATTEMPTS) {
      return NextResponse.json({
        success: false,
        error: 'Orden bloqueada por demasiados intentos. Contacte al administrador.'
      }, { status: 400 })
    }

    // Calculate received total
    const receivedTotal = calculateTotalFromDenominations(receivedBillDenominations)
    const expectedTotal = parseFloat(order.total_amount)

    console.log(`[Validate API] Order ${orderId}: Expected ${expectedTotal}, Received ${receivedTotal}`)

    // Try to update with new columns, fallback to basic update if columns don't exist
    try {
      await db.query(`
        UPDATE cash_delivery_orders
        SET
          received_bill_denominations = $1,
          received_total_amount = $2,
          amount_matches = $3,
          updated_at = NOW()
        WHERE id = $4
      `, [
        JSON.stringify(receivedBillDenominations),
        receivedTotal,
        receivedTotal === expectedTotal,
        orderId
      ])
    } catch (updateError: any) {
      console.error('[Validate API] Error updating received amounts, columns might not exist:', updateError.message)
      // Continue anyway - we can still validate amounts
    }

    // If amounts don't match, return error with details
    if (receivedTotal !== expectedTotal) {
      return NextResponse.json({
        success: false,
        error: `Los montos no coinciden. Esperado: $${expectedTotal.toLocaleString()}, Recibido: $${receivedTotal.toLocaleString()}`,
        data: {
          expectedTotal,
          receivedTotal,
          difference: receivedTotal - expectedTotal,
          currency: order.currency
        }
      }, { status: 400 })
    }

    // Amounts match - generate and send OTP
    const otpCode = generateOTP()
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000)

    console.log(`[Validate API] Amounts match! Generating OTP for order ${orderId}`)

    // Update order with OTP
    try {
      await db.query(`
        UPDATE cash_delivery_orders
        SET
          status = 'validating',
          otp_code = $1,
          otp_sent_at = NOW(),
          otp_expires_at = $2,
          updated_at = NOW()
        WHERE id = $3
      `, [otpCode, otpExpiresAt, orderId])
    } catch (otpUpdateError: any) {
      console.error('[Validate API] Error updating OTP columns:', otpUpdateError.message)
      // Try minimal update
      await db.query(`
        UPDATE cash_delivery_orders
        SET status = 'validating', updated_at = NOW()
        WHERE id = $1
      `, [orderId])
    }

    // Send OTP via selected channel (SMS or WhatsApp)
    // broker_company_name is stored directly in the cash_delivery_orders table
    const brokerName = order.broker_company_name || 'Broker'
    const otpResult = await sendCashDeliveryOTPByChannel(
      order.delivery_user_phone,
      otpCode,
      expectedTotal.toFixed(2),
      order.currency,
      brokerName,
      otpChannel
    )

    if (!otpResult.success) {
      console.error(`[Validate API] Failed to send OTP via ${otpChannel}:`, otpResult.error)
    }

    const channelLabel = otpChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'

    return NextResponse.json({
      success: true,
      message: `Montos coinciden. OTP enviado al repartidor por ${channelLabel}.`,
      data: {
        status: 'validating',
        otpSentTo: maskPhoneNumber(order.delivery_user_phone),
        expiresIn: OTP_EXPIRATION_MINUTES * 60,
        messageSent: otpResult.success,
        channel: otpChannel,
        // Debug info - remove in production
        debugOtp: process.env.NODE_ENV === 'development' ? otpCode : undefined
      }
    })

  } catch (error: any) {
    console.error('[Validate API] Error:', error)
    return NextResponse.json({
      success: false,
      error: `Error al validar: ${error.message || 'Error desconocido'}`,
      debug: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        name: error.name
      } : undefined
    }, { status: 500 })
  }
}
