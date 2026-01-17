import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const VoiceResponse = twilio.twiml.VoiceResponse

/**
 * Webhook para recibir llamadas entrantes de Twilio
 * Genera TwiML para conectar a un stream de media WebSocket
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
      'ringing',
      JSON.stringify({
        customerName,
        startedAt: new Date().toISOString()
      })
    ])

    console.log('[Twilio Voice] Call recorded in database:', { callSid, companyId, customerId })

    // Generate TwiML response
    const response = new VoiceResponse()

    // Get the host for WebSocket URL
    const host = request.headers.get('host') || 'agencias.logirapid.com'
    const protocol = host.includes('localhost') ? 'ws' : 'wss'
    const streamUrl = `${protocol}://${host}/api/twilio/media-stream`

    // Add a greeting message while connecting
    response.say({
      voice: 'Polly.Lucia-Neural',
      language: 'es-US'
    }, 'Bienvenido a LogiRapid. Un momento por favor mientras lo conectamos con nuestro asistente.')

    // Connect to the media stream
    const connect = response.connect()
    const stream = connect.stream({
      url: streamUrl
    })

    // Pass custom parameters to the stream
    stream.parameter({ name: 'callSid', value: callSid })
    stream.parameter({ name: 'from', value: from })
    stream.parameter({ name: 'customerId', value: customerId?.toString() || '' })
    stream.parameter({ name: 'customerName', value: customerName || '' })
    stream.parameter({ name: 'companyId', value: companyId.toString() })

    console.log('[Twilio Voice] TwiML generated, connecting to:', streamUrl)

    // Return TwiML response
    return new NextResponse(response.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml'
      }
    })

  } catch (error) {
    console.error('[Twilio Voice] Error:', error)

    // Return error TwiML
    const response = new VoiceResponse()
    response.say({
      voice: 'Polly.Lucia-Neural',
      language: 'es-US'
    }, 'Lo sentimos, hubo un error al procesar su llamada. Por favor intente de nuevo mas tarde.')
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
