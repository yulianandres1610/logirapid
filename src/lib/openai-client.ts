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

// System prompt para el agente de LogiRapid - NATURAL COMO PERSONA REAL
const SYSTEM_PROMPT = `Eres Maria, trabajas en LogiRapid atendiendo clientes por WhatsApp. Hablas como una persona real de Miami, cubana, amigable.

TU PERSONALIDAD:
- Hablas natural, como si escribieras a un amigo
- Usas "jaja", "ok", "dale", "perfecto", "listo"
- Maximo 1-2 oraciones por mensaje
- NO suenas robotico ni formal
- Puedes usar emojis pero pocos

SERVICIOS:
1. Recogida de paquetes (pasamos a buscar el paquete en USA y lo enviamos a Cuba)
2. Envio de dinero a Cuba (cupones/remesas)

PARA RECOGIDA pregunta uno por uno:
- Tu nombre
- Direccion donde recogemos (con ciudad y ZIP)
- Nombre de quien recibe en Cuba
- Telefono en Cuba
- Provincia y municipio
- Direccion en Cuba

PARA REMESAS pregunta uno por uno:
- Cuanto quieres enviar
- Tu nombre
- Nombre de quien recibe
- Telefono en Cuba
- Provincia y municipio
- Direccion

FLUJO:
1. Pregunta que necesita
2. Pide los datos UNO A UNO
3. Cuando tengas todo, haz un resumen corto tipo "Ok, entonces envias $100 a Maria Garcia en La Habana, correcto?"
4. Si dice si/correcto/dale -> llama la funcion con allDataComplete=true
5. Si dice no o quiere cambiar algo -> corrige y vuelve a confirmar

EJEMPLOS DE COMO HABLAS:
- "Hola! En que te ayudo hoy?"
- "Dale, y tu nombre cual es?"
- "Perfecto, y la direccion donde pasamos?"
- "Ok ya casi, solo me falta el telefono de alla"
- "Listo! Ya te creo la orden"`

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
      description: 'LLAMAR SIEMPRE que el usuario da datos de recogida. Marcar allDataComplete=true SOLO cuando el usuario CONFIRMA que todos los datos son correctos.',
      parameters: {
        type: 'object',
        properties: {
          senderName: { type: 'string', description: 'Nombre del remitente en USA' },
          senderPhone: { type: 'string', description: 'Telefono del remitente' },
          senderAddress: { type: 'string', description: 'Direccion completa (calle, ciudad, estado, ZIP)' },
          recipientName: { type: 'string', description: 'Nombre del destinatario en Cuba' },
          recipientPhone: { type: 'string', description: 'Telefono en Cuba' },
          recipientProvince: { type: 'string', description: 'Provincia en Cuba' },
          recipientMunicipality: { type: 'string', description: 'Municipio en Cuba' },
          recipientAddress: { type: 'string', description: 'Direccion en Cuba' },
          allDataComplete: {
            type: 'boolean',
            description: 'TRUE solo cuando: 1) Tienes senderName, senderPhone, senderAddress, recipientName, recipientPhone, recipientProvince, recipientMunicipality, recipientAddress Y 2) El usuario CONFIRMO que los datos son correctos'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'extract_remittance_order_data',
      description: 'LLAMAR SIEMPRE que el usuario da datos de remesa/cupon. Marcar allDataComplete=true SOLO cuando el usuario CONFIRMA.',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'Monto en USD' },
          senderName: { type: 'string', description: 'Nombre de quien envia' },
          recipientName: { type: 'string', description: 'Nombre del beneficiario en Cuba' },
          recipientPhone: { type: 'string', description: 'Telefono en Cuba' },
          province: { type: 'string', description: 'Provincia' },
          municipality: { type: 'string', description: 'Municipio' },
          address: { type: 'string', description: 'Direccion de entrega' },
          allDataComplete: {
            type: 'boolean',
            description: 'TRUE solo cuando: 1) Tienes amount, senderName, recipientName, recipientPhone, province, municipality, address Y 2) El usuario CONFIRMO'
          }
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
 * Genera un mensaje de saludo inicial - NATURAL
 */
export async function generateGreeting(customerName?: string | null): Promise<string> {
  if (customerName) {
    return `Hola ${customerName}! Que tal? Soy Maria de LogiRapid. En que te puedo ayudar?`
  }

  return `Hola! Soy Maria de LogiRapid. En que te puedo ayudar hoy?`
}

/**
 * Genera un mensaje de error amigable
 */
export function getErrorMessage(): string {
  return `Ay disculpa, se me trabo el sistema. Puedes repetirme eso?`
}

export { getOpenAI }
