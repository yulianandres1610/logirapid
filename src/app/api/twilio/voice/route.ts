import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const VoiceResponse = twilio.twiml.VoiceResponse

// Mensaje de bienvenida calido y natural
const WELCOME_MESSAGE = `¡Hola! Gracias por llamar a LogiRapid. Soy Sofia, tu asistente virtual.
¿En que puedo ayudarte hoy? Puedes decirme si quieres hacer un envio a Cuba, consultar el estado de un pedido, o cualquier otra cosa que necesites.`

/**
 * Webhook para recibir llamadas entrantes de Twilio
 * Usa Twilio Speech Recognition + OpenAI para conversacion natural
 */
export async function POST(request: NextRequest) {
  try {
    // Parse form data from Twilio
    const formData = await request.formData()
    const callSid = formData.get('CallSid') as string
    const from = formData.get('From') as string
    const to = formData.get('To') as string
    const callStatus = formData.get('CallStatus') as string

    console.log('[Twilio Voice] Incoming call:', { callSid, from, to, callStatus })

    // Get company ID for the agent
    const companyName = process.env.WHATSAPP_AGENT_COMPANY_NAME || process.env.VOICE_AGENT_COMPANY_NAME
    let companyId: number | null = null

    if (companyName) {
      const companyResult = await db.query(
        `SELECT id FROM companies WHERE legalname ILIKE $1 LIMIT 1`,
        [`%${companyName}%`]
      )
      companyId = companyResult.rows[0]?.id || null
    }

    if (!companyId) {
      const fallbackResult = await db.query(`SELECT id FROM companies ORDER BY id LIMIT 1`)
      companyId = fallbackResult.rows[0]?.id || 1
    }

    // Check if customer exists
    const cleanPhone = from.replace(/\D/g, '')
    const customerResult = await db.query(
      `SELECT id, firstname, lastname FROM customers WHERE phone LIKE $1 LIMIT 1`,
      [`%${cleanPhone.slice(-10)}%`]
    )
    const customerId = customerResult.rows[0]?.id || null
    const customerName = customerResult.rows[0]
      ? `${customerResult.rows[0].firstname} ${customerResult.rows[0].lastname}`.trim()
      : null

    // Insert call record into database
    await db.query(`
      INSERT INTO voice_calls (callsid, fromnumber, tonumber, companyid, customerid, status, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (callsid) DO UPDATE SET
        status = EXCLUDED.status,
        metadata = voice_calls.metadata || EXCLUDED.metadata
    `, [
      callSid,
      from,
      to,
      companyId,
      customerId,
      'in-progress',
      JSON.stringify({
        customerName,
        startedAt: new Date().toISOString(),
        conversationHistory: []
      })
    ])

    console.log('[Twilio Voice] Call recorded:', { callSid, companyId, customerId, customerName })

    // Generate TwiML response with natural greeting
    const response = new VoiceResponse()

    // Saludo personalizado si conocemos al cliente
    let greeting = WELCOME_MESSAGE
    if (customerName) {
      greeting = `¡Hola ${customerName.split(' ')[0]}! Que gusto escucharte. Soy Sofia de LogiRapid. ¿En que te puedo ayudar hoy?`
    }

    // Usar voz mas natural y calida (Lupe es una voz femenina espanola muy natural)
    response.say({
      voice: 'Polly.Lupe-Neural',
      language: 'es-US'
    }, greeting)

    // Configurar Gather para escuchar la respuesta del usuario
    const gather = response.gather({
      input: ['speech'],
      language: 'es-US',
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      enhanced: true,
      action: '/api/twilio/voice/respond',
      method: 'POST'
    })

    // Si no hay respuesta, preguntar de nuevo
    response.say({
      voice: 'Polly.Lupe-Neural',
      language: 'es-US'
    }, '¿Sigues ahi? Si necesitas ayuda, solo dime en que puedo asistirte.')

    // Redirect para intentar de nuevo
    response.redirect({
      method: 'POST'
    }, '/api/twilio/voice')

    console.log('[Twilio Voice] TwiML generated for call:', callSid)

    // Return TwiML response
    return new NextResponse(response.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml'
      }
    })

  } catch (error) {
    console.error('[Twilio Voice] Error:', error)

    // Return error TwiML with friendly message
    const response = new VoiceResponse()
    response.say({
      voice: 'Polly.Lupe-Neural',
      language: 'es-US'
    }, 'Disculpa, tuvimos un pequeno problema tecnico. Por favor intenta llamar de nuevo en unos momentos. Gracias por tu paciencia.')
    response.hangup()

    return new NextResponse(response.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml'
      }
    })
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Twilio Voice Webhook is active',
    timestamp: new Date().toISOString()
  })
}
