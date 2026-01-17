import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import OpenAI from 'openai'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const VoiceResponse = twilio.twiml.VoiceResponse

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// System prompt para el agente de voz - conversacional y amigable
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

SERVICIOS QUE OFRECES:
- Envio de paquetes a Cuba (recogida a domicilio en USA)
- Consulta de estado de pedidos
- Informacion de tarifas y tiempos de entrega
- Ayuda general

PARA CREAR UN ENVIO necesitas:
1. Datos del remitente: nombre, direccion en USA, telefono
2. Datos del destinatario: nombre, telefono (8 digitos), carnet de identidad (11 digitos), provincia, municipio, direccion en Cuba
3. Fecha de recogida preferida

EJEMPLOS DE RESPUESTAS NATURALES:
- "¡Perfecto! Entonces quieres hacer un envio a Cuba, ¿verdad?"
- "Claro que si, con gusto te ayudo. ¿Me das tu nombre completo?"
- "Muy bien, ya tengo tu direccion. Ahora necesito los datos de quien recibe en Cuba."
- "No te preocupes, tomemonos el tiempo que necesites."

IMPORTANTE:
- Nunca inventes informacion
- Si no sabes algo, di que lo verificaras
- Si el cliente quiere hablar con un humano, indicale que puede llamar al numero de servicio al cliente
- Despidete siempre de forma calida`

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/**
 * Endpoint que procesa la respuesta del usuario y genera respuesta con OpenAI
 */
export async function POST(request: NextRequest) {
  try {
    // Parse form data from Twilio
    const formData = await request.formData()
    const callSid = formData.get('CallSid') as string
    const speechResult = formData.get('SpeechResult') as string
    const confidence = formData.get('Confidence') as string

    console.log('[Voice Respond] Speech received:', { callSid, speechResult, confidence })

    if (!speechResult) {
      // No speech detected, ask again
      const response = new VoiceResponse()
      response.say({
        voice: 'Polly.Lupe-Neural',
        language: 'es-US'
      }, 'Disculpa, no te escuche bien. ¿Puedes repetirme eso?')

      const gather = response.gather({
        input: ['speech'],
        language: 'es-US',
        speechTimeout: 'auto',
        speechModel: 'phone_call',
        enhanced: true,
        action: '/api/twilio/voice/respond',
        method: 'POST'
      })

      return new NextResponse(response.toString(), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      })
    }

    // Get call data and conversation history
    const callData = await db.query(`
      SELECT metadata, fromnumber, companyid, customerid
      FROM voice_calls
      WHERE callsid = $1
    `, [callSid])

    let conversationHistory: ConversationMessage[] = []
    let metadata = {}

    if (callData.rows[0]) {
      metadata = callData.rows[0].metadata || {}
      conversationHistory = (metadata as any).conversationHistory || []
    }

    // Add user message to history
    conversationHistory.push({
      role: 'user',
      content: speechResult
    })

    // Check for goodbye phrases
    const goodbyePhrases = ['adios', 'hasta luego', 'chao', 'gracias adios', 'bye', 'eso es todo', 'nada mas']
    const isGoodbye = goodbyePhrases.some(phrase =>
      speechResult.toLowerCase().includes(phrase)
    )

    let assistantResponse: string

    if (isGoodbye) {
      assistantResponse = '¡Fue un placer ayudarte! Que tengas un excelente dia. Si necesitas algo mas, no dudes en llamarnos. ¡Hasta pronto!'
    } else {
      // Generate response with OpenAI
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: VOICE_SYSTEM_PROMPT },
            ...conversationHistory.map(msg => ({
              role: msg.role as 'user' | 'assistant' | 'system',
              content: msg.content
            }))
          ],
          max_tokens: 150, // Keep responses short for voice
          temperature: 0.7
        })

        assistantResponse = completion.choices[0]?.message?.content ||
          'Disculpa, tuve un problema procesando tu solicitud. ¿Puedes repetirme eso?'
      } catch (openaiError) {
        console.error('[Voice Respond] OpenAI error:', openaiError)
        assistantResponse = 'Disculpa, tuve un pequeno problema. ¿Me repites lo que necesitas?'
      }
    }

    // Add assistant response to history
    conversationHistory.push({
      role: 'assistant',
      content: assistantResponse
    })

    // Update conversation history in database
    await db.query(`
      UPDATE voice_calls
      SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{conversationHistory}',
        $2::jsonb
      ),
      transcript = COALESCE(transcript, '') || $3
      WHERE callsid = $1
    `, [
      callSid,
      JSON.stringify(conversationHistory),
      `\n[USUARIO]: ${speechResult}\n[SOFIA]: ${assistantResponse}`
    ])

    // Generate TwiML response
    const response = new VoiceResponse()

    // Say the response with natural voice
    response.say({
      voice: 'Polly.Lupe-Neural',
      language: 'es-US'
    }, assistantResponse)

    if (isGoodbye) {
      // End the call gracefully
      response.hangup()
    } else {
      // Continue listening for more input
      const gather = response.gather({
        input: ['speech'],
        language: 'es-US',
        speechTimeout: 'auto',
        speechModel: 'phone_call',
        enhanced: true,
        action: '/api/twilio/voice/respond',
        method: 'POST'
      })

      // If no response after gathering, prompt again
      response.say({
        voice: 'Polly.Lupe-Neural',
        language: 'es-US'
      }, '¿Hay algo mas en lo que pueda ayudarte?')

      response.redirect({
        method: 'POST'
      }, '/api/twilio/voice/respond')
    }

    console.log('[Voice Respond] Response generated:', assistantResponse.substring(0, 100))

    return new NextResponse(response.toString(), {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    })

  } catch (error) {
    console.error('[Voice Respond] Error:', error)

    const response = new VoiceResponse()
    response.say({
      voice: 'Polly.Lupe-Neural',
      language: 'es-US'
    }, 'Disculpa, tuve un problema tecnico. Dejame intentar de nuevo.')

    response.redirect({
      method: 'POST'
    }, '/api/twilio/voice')

    return new NextResponse(response.toString(), {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    })
  }
}

/**
 * Health check
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Voice Respond endpoint active'
  })
}
