import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import crypto from 'crypto'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// System prompt para el agente de voz SIP - mas natural y conversacional
const VOICE_SYSTEM_PROMPT = `Eres Sofia, la asistente telefonica de LogiRapid, una empresa de envios y logistica a Cuba ubicada en Miami.

PERSONALIDAD:
- Eres amable, calida y profesional
- Hablas de forma natural y conversacional, como una persona real
- Usas frases cortas y claras, faciles de entender por telefono
- Muestras empatia y paciencia
- Tuteas a los clientes para crear cercania

COMO HABLAR:
- Usa contracciones naturales: "esta bien", "no hay problema", "perfecto"
- Evita respuestas largas - maximo 2-3 oraciones por turno
- Confirma lo que entendiste antes de continuar
- Si no entiendes algo, pide amablemente que lo repitan
- Deletrea numeros importantes para confirmar

SERVICIOS QUE OFRECES:
- Envio de paquetes a Cuba (recogida a domicilio en USA)
- Consulta de estado de pedidos
- Informacion de tarifas y tiempos de entrega
- Ayuda general

PARA CREAR UN ENVIO necesitas:
1. Datos del remitente: nombre, direccion en USA, telefono
2. Datos del destinatario: nombre, telefono (8 digitos), carnet de identidad (11 digitos), provincia, municipio, direccion en Cuba
3. Fecha de recogida preferida

VALIDACIONES IMPORTANTES:
- Telefono de Cuba: exactamente 8 digitos
- Carnet de identidad: exactamente 11 digitos
- Siempre confirma datos criticos antes de procesar

EJEMPLOS DE RESPUESTAS NATURALES:
- "Hola! Gracias por llamar a LogiRapid. Soy Sofia, en que puedo ayudarte hoy?"
- "Perfecto! Entonces quieres hacer un envio a Cuba, verdad?"
- "Claro que si, con gusto te ayudo. Me das tu nombre completo?"
- "Muy bien, ya tengo tu direccion. Ahora necesito los datos de quien recibe en Cuba."
- "No te preocupes, tomemonos el tiempo que necesites."

IMPORTANTE:
- Nunca inventes informacion
- Si no sabes algo, di que lo verificaras
- Si el cliente quiere hablar con un humano, ofrece el numero de servicio al cliente
- Despidete siempre de forma calida`

// Tools disponibles para el agente de voz
const VOICE_TOOLS = [
  {
    type: 'function',
    name: 'search_customer',
    description: 'Buscar un cliente existente por numero de telefono',
    parameters: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Numero de telefono del cliente'
        }
      },
      required: ['phone']
    }
  },
  {
    type: 'function',
    name: 'search_recipient',
    description: 'Buscar un destinatario existente en Cuba por telefono',
    parameters: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Telefono del destinatario (8 digitos)'
        }
      },
      required: ['phone']
    }
  },
  {
    type: 'function',
    name: 'get_available_dates',
    description: 'Obtener fechas y horarios disponibles para recogida',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    type: 'function',
    name: 'create_pickup_order',
    description: 'Crear una orden de recogida con todos los datos recopilados',
    parameters: {
      type: 'object',
      properties: {
        senderName: { type: 'string', description: 'Nombre completo del remitente' },
        senderPhone: { type: 'string', description: 'Telefono del remitente' },
        senderAddress: { type: 'string', description: 'Direccion completa del remitente en USA' },
        senderCity: { type: 'string', description: 'Ciudad del remitente' },
        senderState: { type: 'string', description: 'Estado del remitente (ej: FL, TX)' },
        senderZipcode: { type: 'string', description: 'Codigo postal del remitente' },
        recipientName: { type: 'string', description: 'Nombre completo del destinatario' },
        recipientPhone: { type: 'string', description: 'Telefono del destinatario (8 digitos)' },
        recipientCI: { type: 'string', description: 'Carnet de identidad (11 digitos)' },
        recipientProvince: { type: 'string', description: 'Provincia del destinatario' },
        recipientMunicipality: { type: 'string', description: 'Municipio del destinatario' },
        recipientAddress: { type: 'string', description: 'Direccion del destinatario en Cuba' },
        pickupDate: { type: 'string', description: 'Fecha de recogida (YYYY-MM-DD)' },
        pickupTimeSlot: { type: 'string', description: 'Horario de recogida' }
      },
      required: [
        'senderName', 'senderPhone', 'senderAddress', 'senderCity', 'senderState', 'senderZipcode',
        'recipientName', 'recipientPhone', 'recipientProvince', 'recipientMunicipality', 'recipientAddress',
        'pickupDate', 'pickupTimeSlot'
      ]
    }
  },
  {
    type: 'function',
    name: 'check_order_status',
    description: 'Consultar el estado de una orden existente',
    parameters: {
      type: 'object',
      properties: {
        orderNumber: {
          type: 'string',
          description: 'Numero de orden (ej: ORD-2025-0001)'
        }
      },
      required: ['orderNumber']
    }
  }
]

// Configuracion de la sesion para aceptar llamadas
const SESSION_CONFIG = {
  type: 'realtime',
  model: 'gpt-4o-realtime-preview-2024-12-17',
  instructions: VOICE_SYSTEM_PROMPT,
  voice: 'coral', // Voz calida y natural para espanol
  tools: VOICE_TOOLS,
  tool_choice: 'auto',
  input_audio_format: 'g711_ulaw',
  output_audio_format: 'g711_ulaw',
  input_audio_transcription: {
    model: 'whisper-1'
  },
  turn_detection: {
    type: 'server_vad',
    threshold: 0.6,
    prefix_padding_ms: 400,
    silence_duration_ms: 800
  },
  temperature: 0.8,
  max_response_output_tokens: 300
}

/**
 * Verificar firma del webhook de OpenAI
 */
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  try {
    const parts = signature.split(',')
    const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1]
    const sig = parts.find(p => p.startsWith('v1='))?.split('=')[1]

    if (!timestamp || !sig) return false

    const signedPayload = `${timestamp}.${payload}`
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex')

    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
  } catch {
    return false
  }
}

/**
 * Webhook para recibir eventos de llamadas SIP de OpenAI
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('openai-webhook-signature') || ''
    const webhookSecret = process.env.OPENAI_WEBHOOK_SECRET || ''

    // Verificar firma si hay secret configurado
    if (webhookSecret && !verifyWebhookSignature(body, signature, webhookSecret)) {
      console.error('[SIP Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(body)
    console.log('[SIP Webhook] Event received:', event.type)

    // Manejar evento de llamada entrante
    if (event.type === 'realtime.call.incoming') {
      const callId = event.data?.call_id
      const callerNumber = event.data?.from || 'unknown'

      console.log('[SIP Webhook] Incoming call:', { callId, callerNumber })

      // Buscar cliente existente
      const cleanPhone = callerNumber.replace(/\D/g, '')
      let customerName = null
      let customerId = null

      try {
        const customerResult = await db.query(
          `SELECT id, firstname, lastname FROM customers WHERE phone LIKE $1 LIMIT 1`,
          [`%${cleanPhone.slice(-10)}%`]
        )
        if (customerResult.rows[0]) {
          customerId = customerResult.rows[0].id
          customerName = `${customerResult.rows[0].firstname} ${customerResult.rows[0].lastname}`.trim()
        }
      } catch (dbError) {
        console.error('[SIP Webhook] DB error:', dbError)
      }

      // Obtener company ID para el agente
      let companyId = 1
      const companyName = process.env.WHATSAPP_AGENT_COMPANY_NAME || process.env.VOICE_AGENT_COMPANY_NAME
      if (companyName) {
        try {
          const companyResult = await db.query(
            `SELECT id FROM companies WHERE legalname ILIKE $1 LIMIT 1`,
            [`%${companyName}%`]
          )
          companyId = companyResult.rows[0]?.id || 1
        } catch {
          // Use default
        }
      }

      // Registrar llamada en base de datos
      try {
        await db.query(`
          INSERT INTO voice_calls (callsid, fromnumber, tonumber, companyid, customerid, status, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (callsid) DO UPDATE SET
            status = EXCLUDED.status,
            metadata = voice_calls.metadata || EXCLUDED.metadata
        `, [
          callId,
          callerNumber,
          event.data?.to || 'sip',
          companyId,
          customerId,
          'in-progress',
          JSON.stringify({
            customerName,
            startedAt: new Date().toISOString(),
            type: 'sip-realtime'
          })
        ])
      } catch (dbError) {
        console.error('[SIP Webhook] Failed to log call:', dbError)
      }

      // Personalizar instrucciones si conocemos al cliente
      let customInstructions = VOICE_SYSTEM_PROMPT
      if (customerName) {
        customInstructions = `El cliente que llama se llama ${customerName}. Saludalo por su nombre de forma calida.\n\n${VOICE_SYSTEM_PROMPT}`
      }

      // Aceptar la llamada con configuracion de sesion
      const acceptPayload = {
        ...SESSION_CONFIG,
        instructions: customInstructions
      }

      const acceptResponse = await fetch(
        `https://api.openai.com/v1/realtime/calls/${encodeURIComponent(callId)}/accept`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(acceptPayload)
        }
      )

      if (!acceptResponse.ok) {
        const errorText = await acceptResponse.text()
        console.error('[SIP Webhook] Failed to accept call:', acceptResponse.status, errorText)
        return NextResponse.json({ error: 'Failed to accept call' }, { status: 500 })
      }

      const acceptResult = await acceptResponse.json()
      console.log('[SIP Webhook] Call accepted:', acceptResult)

      // Opcional: Conectar WebSocket para manejar tool calls
      // Esto requiere un proceso de larga duracion (no serverless)
      // Por ahora, el agente funcionara sin tools ejecutables

      return NextResponse.json({ success: true, callId })
    }

    // Manejar evento de llamada terminada
    if (event.type === 'realtime.call.ended') {
      const callId = event.data?.call_id
      console.log('[SIP Webhook] Call ended:', callId)

      try {
        await db.query(`
          UPDATE voice_calls
          SET status = 'completed',
              endedat = CURRENT_TIMESTAMP,
              metadata = metadata || $2::jsonb
          WHERE callsid = $1
        `, [
          callId,
          JSON.stringify({
            endedAt: new Date().toISOString(),
            duration: event.data?.duration_seconds
          })
        ])
      } catch (dbError) {
        console.error('[SIP Webhook] Failed to update call end:', dbError)
      }

      return NextResponse.json({ success: true })
    }

    // Otros eventos
    console.log('[SIP Webhook] Unhandled event type:', event.type)
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[SIP Webhook] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Health check
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'OpenAI SIP Webhook is active',
    timestamp: new Date().toISOString()
  })
}
