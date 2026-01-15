import OpenAI from 'openai'

// Lazy initialization del cliente OpenAI para evitar errores en build time
let _openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured')
    }
    _openai = new OpenAI({ apiKey })
  }
  return _openai
}

// System prompt para el agente de LogiRapid
const SYSTEM_PROMPT = `Eres un asistente virtual de LogiRapid, empresa de envios y remesas a Cuba.
Tu nombre es "Asistente LogiRapid" y ayudas a los clientes por WhatsApp.

## SERVICIOS QUE OFRECES:

1. **RECOGIDA DE PAQUETES**: Programar recogida de paquetes en USA para enviar a Cuba
2. **CUPONES FAMILIARES (REMESAS)**: Enviar dinero a familiares en Cuba
3. **CONSULTAS GENERALES**: Responder preguntas sobre servicios, precios y estado de envios

## INSTRUCCIONES IMPORTANTES:

- Se amable, profesional y conciso
- Recopila los datos necesarios paso a paso, no pidas todo a la vez
- Confirma datos importantes antes de continuar
- Si no entiendes algo, pide clarificacion amablemente
- Responde SIEMPRE en espanol
- Usa emojis moderadamente para hacer la conversacion mas amigable
- Si el cliente pregunta precios, indica que varian segun el servicio

## DATOS NECESARIOS PARA RECOGIDA DE PAQUETES:

Del remitente (USA):
- Nombre completo
- Direccion de recogida (calle, numero, ciudad, estado, codigo postal)
- Telefono de contacto
- Instrucciones especiales de acceso (opcional)

Del destinatario (Cuba):
- Nombre completo
- Telefono
- Provincia
- Municipio
- Direccion (calle, numero, entre calles, reparto)

Programacion:
- Fecha preferida de recogida
- Horario preferido (manana 8-12, tarde 12-4, o noche 4-8)

## DATOS NECESARIOS PARA CUPONES FAMILIARES:

- Monto a enviar (en USD)
- Nombre completo del beneficiario
- Telefono del beneficiario en Cuba
- Provincia de Cuba
- Municipio
- Direccion de entrega
- Nombre del remitente (quien envia)

## FLUJO DE CONVERSACION:

1. Saluda e identifica que servicio necesita el cliente
2. Recopila datos uno por uno
3. Confirma el resumen de datos
4. Indica que vas a crear la orden
5. Para cupones familiares, menciona que recibiran un link de pago

## EJEMPLOS DE RESPUESTAS:

Saludo inicial:
"Hola! Bienvenido a LogiRapid. Soy tu asistente virtual y puedo ayudarte con:
1. Programar recogida de paquetes para Cuba
2. Enviar dinero a tu familia en Cuba
3. Consultar estado de envios

Como puedo ayudarte hoy?"

Al completar datos de cupones:
"Perfecto! He registrado tu solicitud de envio:
- Monto: $[MONTO] USD
- Beneficiario: [NOMBRE]
- Destino: [MUNICIPIO], [PROVINCIA]

El total a pagar incluyendo comision es $[TOTAL] USD.
Te enviare un link de pago seguro para completar la transaccion."

Recuerda: Cuando tengas TODOS los datos necesarios, debes indicar claramente que vas a proceder a crear la orden.`

// Interfaces
export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GPTResponse {
  response: string
  intent?: 'pickup_order' | 'remittance_order' | 'support' | 'greeting' | 'unknown'
  extractedData?: Record<string, unknown>
  flowComplete?: boolean
  readyToCreateOrder?: boolean
}

// Function definitions para extraer datos estructurados
const functions: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'extract_pickup_order_data',
      description: 'Extrae datos de una orden de recogida de paquetes cuando el cliente proporciona informacion',
      parameters: {
        type: 'object',
        properties: {
          senderName: { type: 'string', description: 'Nombre completo del remitente' },
          senderPhone: { type: 'string', description: 'Telefono del remitente' },
          senderAddress: { type: 'string', description: 'Direccion completa de recogida' },
          senderCity: { type: 'string', description: 'Ciudad del remitente' },
          senderState: { type: 'string', description: 'Estado (2 letras, ej: FL, TX)' },
          senderZipCode: { type: 'string', description: 'Codigo postal (5 digitos)' },
          senderInstructions: { type: 'string', description: 'Instrucciones de acceso' },
          recipientName: { type: 'string', description: 'Nombre del destinatario en Cuba' },
          recipientPhone: { type: 'string', description: 'Telefono del destinatario' },
          recipientProvince: { type: 'string', description: 'Provincia en Cuba' },
          recipientMunicipality: { type: 'string', description: 'Municipio en Cuba' },
          recipientAddress: { type: 'string', description: 'Direccion en Cuba' },
          scheduledDate: { type: 'string', description: 'Fecha de recogida (YYYY-MM-DD)' },
          timeSlot: { type: 'string', description: 'Horario preferido' },
          allDataComplete: { type: 'boolean', description: 'True si TODOS los datos estan completos' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'extract_remittance_order_data',
      description: 'Extrae datos de una orden de cupon familiar/remesa cuando el cliente proporciona informacion',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'Monto a enviar en USD' },
          senderName: { type: 'string', description: 'Nombre de quien envia' },
          senderPhone: { type: 'string', description: 'Telefono de quien envia' },
          recipientName: { type: 'string', description: 'Nombre del beneficiario' },
          recipientPhone: { type: 'string', description: 'Telefono del beneficiario en Cuba' },
          province: { type: 'string', description: 'Provincia de Cuba' },
          municipality: { type: 'string', description: 'Municipio de Cuba' },
          address: { type: 'string', description: 'Direccion de entrega' },
          allDataComplete: { type: 'boolean', description: 'True si TODOS los datos estan completos' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'detect_intent',
      description: 'Detecta la intencion del usuario cuando inicia una conversacion o cambia de tema',
      parameters: {
        type: 'object',
        properties: {
          intent: {
            type: 'string',
            enum: ['pickup_order', 'remittance_order', 'support', 'greeting', 'unknown'],
            description: 'La intencion detectada del usuario'
          },
          confidence: {
            type: 'number',
            description: 'Nivel de confianza de 0 a 1'
          }
        },
        required: ['intent']
      }
    }
  }
]

/**
 * Procesa un mensaje del usuario con OpenAI GPT
 */
export async function processMessage(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  currentFlow?: string,
  collectedData?: Record<string, unknown>
): Promise<GPTResponse> {
  try {
    // Construir contexto adicional si hay datos recopilados
    let contextMessage = ''
    if (currentFlow && collectedData && Object.keys(collectedData).length > 0) {
      contextMessage = `\n\n[CONTEXTO INTERNO - No mencionar al usuario]
Flujo actual: ${currentFlow}
Datos ya recopilados: ${JSON.stringify(collectedData, null, 2)}
Continua recopilando los datos faltantes.`
    }

    // Construir mensajes para GPT
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT + contextMessage },
      ...conversationHistory.slice(-10).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      { role: 'user', content: userMessage }
    ]

    // Llamar a OpenAI
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools: functions,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 500
    })

    const choice = completion.choices[0]
    const message = choice.message

    // Procesar respuesta
    let response = message.content || ''
    let intent: GPTResponse['intent']
    let extractedData: Record<string, unknown> = {}
    let flowComplete = false
    let readyToCreateOrder = false

    // Procesar tool calls si existen
    if (message.tool_calls && message.tool_calls.length > 0) {
      for (const toolCall of message.tool_calls) {
        // Solo procesar tool calls de tipo function
        if (toolCall.type !== 'function') continue

        const functionName = toolCall.function.name
        const args = JSON.parse(toolCall.function.arguments)

        if (functionName === 'detect_intent') {
          intent = args.intent
        } else if (functionName === 'extract_pickup_order_data') {
          extractedData = { ...extractedData, ...args }
          if (args.allDataComplete) {
            flowComplete = true
            readyToCreateOrder = true
          }
        } else if (functionName === 'extract_remittance_order_data') {
          extractedData = { ...extractedData, ...args }
          if (args.allDataComplete) {
            flowComplete = true
            readyToCreateOrder = true
          }
        }
      }

      // Si hubo tool calls pero no hay respuesta, generar una
      if (!response) {
        const followUp = await getOpenAI().chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            ...messages,
            {
              role: 'assistant',
              content: null,
              tool_calls: message.tool_calls
            },
            {
              role: 'tool',
              tool_call_id: message.tool_calls[0].id,
              content: JSON.stringify({ success: true, extracted: extractedData })
            }
          ],
          temperature: 0.7,
          max_tokens: 500
        })
        response = followUp.choices[0].message.content || ''
      }
    }

    return {
      response,
      intent,
      extractedData: Object.keys(extractedData).length > 0 ? extractedData : undefined,
      flowComplete,
      readyToCreateOrder
    }
  } catch (error) {
    console.error('[OpenAI] Error processing message:', error)
    throw error
  }
}

/**
 * Genera un mensaje de saludo inicial
 * Si conocemos al cliente, lo saludamos por su nombre
 */
export async function generateGreeting(customerName?: string | null): Promise<string> {
  if (customerName) {
    return `Hola ${customerName}! Que gusto saludarte de nuevo.

Soy tu asistente virtual de LogiRapid. Como puedo ayudarte hoy?

1. Programar recogida de paquetes para Cuba
2. Enviar dinero a tu familia en Cuba (Cupones Familiares)
3. Consultar estado de envios`
  }

  return `Hola! Bienvenido a LogiRapid. Soy tu asistente virtual y puedo ayudarte con:

1. Programar recogida de paquetes para Cuba
2. Enviar dinero a tu familia en Cuba (Cupones Familiares)
3. Consultar estado de envios

Como puedo ayudarte hoy?`
}

/**
 * Genera un mensaje de error amigable
 */
export function getErrorMessage(): string {
  return `Disculpa, estoy teniendo problemas tecnicos en este momento. Por favor intenta de nuevo en unos minutos o contacta a nuestro equipo de soporte al telefono que aparece en nuestra pagina web.`
}

export { getOpenAI }
