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
- Usas "ok", "dale", "perfecto", "listo"
- Maximo 1-2 oraciones por mensaje
- NO suenas robotico ni formal
- Puedes usar emojis pero pocos

SERVICIOS:
1. Recogida de paquetes (pasamos a buscar el paquete en USA y lo enviamos a Cuba)
2. Envio de dinero a Cuba (cupones/remesas)

PARA RECOGIDA pregunta UNO POR UNO en este orden:

Del remitente (USA):
1. senderName - "Tu nombre completo"
2. senderPhone - "Tu telefono" (si no te lo da, usa el de WhatsApp)
3. senderIdType - "Que tipo de ID tienes? (Pasaporte, Licencia, ID estatal)"
4. senderIdNumber - "Numero de tu ID"
5. senderAddress - "Direccion donde recogemos" (calle, ciudad, estado y ZIP)
6. senderEntryPin - "Hay codigo o PIN para entrar al edificio?" (puede ser NO)
7. senderInstructions - "Alguna instruccion para llegar?" (opcional)

Del destinatario (Cuba):
8. recipientName - "Nombre completo de quien recibe en Cuba"
9. recipientPhone - "Telefono en Cuba"
10. recipientCI - "Carnet de identidad" (DEBE ser 11 digitos, validar formato)
11. recipientProvince - "Provincia"
12. recipientMunicipality - "Municipio"
13. recipientStreet - "Calle y numero"
14. recipientReparto - "Entre que calles o reparto"
15. recipientInstructions - "Referencia para encontrar la casa" (opcional)

VALIDACION CARNET CUBA:
- Debe tener exactamente 11 digitos
- Si el usuario da un numero incorrecto, pide que lo verifique
- Ejemplo valido: 85010112345

PARA REMESAS pregunta UNO POR UNO:
1. amount - "Cuanto quieres enviar?"
2. senderName - "Tu nombre completo"
3. recipientName - "Nombre de quien recibe"
4. recipientPhone - "Telefono en Cuba"
5. province - "Provincia"
6. municipality - "Municipio"
7. address - "Direccion completa"

FLUJO:
1. Pregunta que necesita
2. Pide los datos UNO A UNO (no pidas varios a la vez)
3. Cuando tengas TODO, haz un resumen corto
4. Pregunta "Esta todo bien?"
5. Si dice si/correcto/dale -> llama la funcion con allDataComplete=true

EJEMPLOS:
- "Hola! En que te ayudo?"
- "Dale, tu nombre completo?"
- "Perfecto, y la direccion donde pasamos a recoger? Con ciudad y ZIP"
- "Hay codigo o PIN para entrar al edificio?"
- "Ahora los datos de Cuba. Nombre de quien recibe?"`

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
      description: 'LLAMAR SIEMPRE que el usuario da datos de recogida. Extraer cada dato que mencione.',
      parameters: {
        type: 'object',
        properties: {
          // Datos del remitente (USA)
          senderName: { type: 'string', description: 'Nombre completo del remitente' },
          senderPhone: { type: 'string', description: 'Telefono del remitente' },
          senderIdType: { type: 'string', description: 'Tipo de ID: Pasaporte, Licencia, ID estatal' },
          senderIdNumber: { type: 'string', description: 'Numero del documento de identidad' },
          senderAddress: { type: 'string', description: 'Direccion completa con calle, ciudad, estado y ZIP' },
          senderEntryPin: { type: 'string', description: 'Codigo/PIN para entrar al edificio. "NO" si no hay' },
          senderInstructions: { type: 'string', description: 'Instrucciones de acceso' },
          // Datos del destinatario (Cuba)
          recipientName: { type: 'string', description: 'Nombre completo de quien recibe en Cuba' },
          recipientPhone: { type: 'string', description: 'Telefono en Cuba' },
          recipientCI: { type: 'string', description: 'Carnet de Identidad de Cuba - DEBE ser 11 digitos' },
          recipientProvince: { type: 'string', description: 'Provincia en Cuba' },
          recipientMunicipality: { type: 'string', description: 'Municipio en Cuba' },
          recipientStreet: { type: 'string', description: 'Calle y numero en Cuba' },
          recipientReparto: { type: 'string', description: 'Entre calles o reparto' },
          recipientInstructions: { type: 'string', description: 'Referencias para encontrar la casa' },
          // Control
          allDataComplete: {
            type: 'boolean',
            description: 'TRUE SOLO cuando tienes TODOS los datos requeridos (senderName, senderIdType, senderIdNumber, senderAddress, senderEntryPin, recipientName, recipientPhone, recipientCI con 11 digitos, recipientProvince, recipientMunicipality, recipientStreet) Y el usuario CONFIRMO'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'extract_remittance_order_data',
      description: 'LLAMAR SIEMPRE que el usuario da datos de remesa/cupon.',
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
            description: 'TRUE solo cuando tienes amount, senderName, recipientName, recipientPhone, province, municipality, address Y el usuario CONFIRMO'
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
