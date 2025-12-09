import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { sendSMS, formatPhoneNumber } from '@/lib/sms-service'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

interface ReceiptData {
  amount: number
  fee: number
  totalCharged: number
  newBalance: number
  cardBrand: string
  cardLast4: string
  recipientName: string
  walletNumber: string
}

/**
 * POST /api/wallet/send-receipt
 * Send wallet recharge receipt via SMS or WhatsApp
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token invalido' }, { status: 401 })
    }

    // 2. Validate request body
    const body = await request.json()
    const { transactionNumber, recipientPhone, method, receiptData } = body as {
      transactionNumber: string
      recipientPhone: string
      method: 'sms' | 'whatsapp'
      receiptData: ReceiptData
    }

    if (!transactionNumber || !recipientPhone || !method || !receiptData) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos'
      }, { status: 400 })
    }

    if (!['sms', 'whatsapp'].includes(method)) {
      return NextResponse.json({
        success: false,
        error: 'Metodo invalido. Use "sms" o "whatsapp"'
      }, { status: 400 })
    }

    // 3. Format phone number
    const formattedPhone = formatPhoneNumber(recipientPhone)
    if (!formattedPhone.startsWith('+')) {
      return NextResponse.json({
        success: false,
        error: 'Numero de telefono invalido'
      }, { status: 400 })
    }

    // 4. Generate receipt message
    const formatCurrency = (amount: number) =>
      `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

    const formatDate = () => {
      return new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    const receiptMessage = `RECARGA EXITOSA - LogiRapid

Transaccion: #${transactionNumber}
Fecha: ${formatDate()}

Destinatario: ${receiptData.recipientName}
Wallet: ${receiptData.walletNumber}

Monto Recargado: ${formatCurrency(receiptData.amount)}
Fee: ${formatCurrency(receiptData.fee)}
Total Cobrado: ${formatCurrency(receiptData.totalCharged)}

Metodo: ${receiptData.cardBrand} ****${receiptData.cardLast4}
Nuevo Balance: ${formatCurrency(receiptData.newBalance)}

Gracias por usar LogiRapid!`

    console.log(`[Send Receipt] Sending ${method} to ${formattedPhone}`, { transactionNumber })

    // 5. Send message based on method
    if (method === 'sms') {
      const result = await sendSMS(formattedPhone, receiptMessage)

      if (!result.success) {
        console.error('[Send Receipt] SMS failed:', result.error)
        return NextResponse.json({
          success: false,
          error: result.error || 'Error al enviar SMS'
        }, { status: 500 })
      }

      console.log('[Send Receipt] SMS sent successfully:', result.messageId)

      return NextResponse.json({
        success: true,
        message: 'Recibo enviado por SMS',
        data: {
          messageId: result.messageId,
          to: formattedPhone,
          method: 'sms'
        }
      })
    } else if (method === 'whatsapp') {
      // For WhatsApp, we use the same Twilio sendSMS but with WhatsApp prefix
      // Format: whatsapp:+1234567890
      const whatsappNumber = `whatsapp:${formattedPhone}`

      try {
        // Use Twilio WhatsApp API
        const result = await sendSMS(whatsappNumber, receiptMessage)

        if (!result.success) {
          console.error('[Send Receipt] WhatsApp failed:', result.error)
          return NextResponse.json({
            success: false,
            error: result.error || 'Error al enviar WhatsApp'
          }, { status: 500 })
        }

        console.log('[Send Receipt] WhatsApp sent successfully:', result.messageId)

        return NextResponse.json({
          success: true,
          message: 'Recibo enviado por WhatsApp',
          data: {
            messageId: result.messageId,
            to: formattedPhone,
            method: 'whatsapp'
          }
        })
      } catch (err) {
        console.error('[Send Receipt] WhatsApp error:', err)
        // Fallback to SMS if WhatsApp fails
        console.log('[Send Receipt] Falling back to SMS...')
        const smsResult = await sendSMS(formattedPhone, receiptMessage)

        if (!smsResult.success) {
          return NextResponse.json({
            success: false,
            error: 'Error al enviar por WhatsApp y SMS'
          }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          message: 'Recibo enviado por SMS (WhatsApp no disponible)',
          data: {
            messageId: smsResult.messageId,
            to: formattedPhone,
            method: 'sms',
            fallback: true
          }
        })
      }
    }

    return NextResponse.json({
      success: false,
      error: 'Metodo no soportado'
    }, { status: 400 })

  } catch (error) {
    console.error('[Send Receipt] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al enviar recibo'
    }, { status: 500 })
  }
}
