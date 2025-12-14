import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'
import {
  generateOTP,
  sendCashDeliveryOTPByChannel,
  maskPhoneNumber,
  OTP_EXPIRATION_MINUTES,
  OTP_MAX_RESENDS,
  OTPChannel
} from '@/lib/sms-service'

// POST - Resend OTP
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

    // Get channel from request body
    let otpChannel: OTPChannel = 'sms'
    try {
      const body = await request.json()
      otpChannel = body.channel === 'whatsapp' ? 'whatsapp' : 'sms'
    } catch {
      // If no body, default to SMS
    }

    // Get order
    const orderResult = await db.query(`
      SELECT cdo.*, c.name as broker_name
      FROM cash_delivery_orders cdo
      LEFT JOIN companies c ON cdo.broker_company_id = c.id
      WHERE cdo.id = $1 AND cdo.broker_company_id = $2
    `, [orderId, brokerCompanyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Check status
    if (order.status !== 'validating') {
      return NextResponse.json({
        success: false,
        error: 'Solo se puede reenviar OTP para órdenes en estado validando'
      }, { status: 400 })
    }

    // Check resend limit
    if ((order.otp_resend_count || 0) >= OTP_MAX_RESENDS) {
      return NextResponse.json({
        success: false,
        error: `Se ha alcanzado el límite máximo de reenvíos (${OTP_MAX_RESENDS}). Contacte al administrador.`
      }, { status: 400 })
    }

    // Generate new OTP
    const otpCode = generateOTP()
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000)
    const newResendCount = (order.otp_resend_count || 0) + 1

    // Update order with new OTP
    await db.query(`
      UPDATE cash_delivery_orders
      SET
        otp_code = $1,
        otp_sent_at = NOW(),
        otp_expires_at = $2,
        otp_resend_count = $3,
        otp_attempts = 0,
        updated_at = NOW()
      WHERE id = $4
    `, [otpCode, otpExpiresAt, newResendCount, orderId])

    // Send OTP via selected channel (SMS or WhatsApp)
    const otpResult = await sendCashDeliveryOTPByChannel(
      order.delivery_user_phone,
      otpCode,
      parseFloat(order.total_amount).toFixed(2),
      order.currency,
      order.broker_name || 'Broker',
      otpChannel
    )

    if (!otpResult.success) {
      console.error(`[Resend OTP API] Failed to send via ${otpChannel}:`, otpResult.error)
    }

    const channelLabel = otpChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'

    return NextResponse.json({
      success: true,
      message: `Nuevo código OTP enviado por ${channelLabel}`,
      data: {
        otpSentTo: maskPhoneNumber(order.delivery_user_phone),
        expiresIn: OTP_EXPIRATION_MINUTES * 60, // seconds
        remainingResends: OTP_MAX_RESENDS - newResendCount,
        messageSent: otpResult.success,
        channel: otpChannel
      }
    })

  } catch (error: any) {
    console.error('[Resend OTP API] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al reenviar el código OTP'
    }, { status: 500 })
  }
}
