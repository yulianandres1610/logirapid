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

// System prompt para el agente de LogiRapid - FLUJO ESTRUCTURADO
const SYSTEM_PROMPT = `Eres Maria de LogiRapid. Hablas natural, como cubana de Miami. Corto y directo, maximo 2 oraciones.

SERVICIOS:
1. Recogida de paquetes (USA a Cuba)
2. Envio de dinero (remesas)

REGLA CRITICA:
- SIEMPRE llama extract_pickup_order_data cuando el usuario da cualquier dato
- Pregunta UN dato a la vez
- Respuestas cortas y naturales

FLUJO RECOGIDA:

1. "Dame tu numero pa buscarte" -> search_customer con el telefono

2. Si no existe, pide UNO A UNO:
   - Nombre completo
   - Tipo ID (Pasaporte/Licencia/ID)
   - Numero del ID
   - Direccion completa (calle, ciudad, estado, ZIP)
   - PIN de entrada (numero/codigo para entrar al edificio, o "NO" si no hay)

3. "Y el telefono en Cuba?" -> search_recipient

4. Si no existe, pide UNO A UNO:
   - Nombre completo
   - Carnet de Identidad (11 digitos)
   - Provincia
   - Municipio
   - Calle y numero

5. Cuando tengas TODO -> request_summary({ready: true})
   Si confirma -> extract_pickup_order_data({allDataComplete: true})

SOBRE EL PIN DE ENTRADA:
- Es un codigo numerico para entrar al edificio/comunidad (ej: "1234", "4567#")
- Si no hay codigo, el usuario dira "no", "no hay", "ninguno"
- Guarda "NO" si no hay PIN
- NO confundir con la direccion

EJEMPLOS:
Usuario: "Pedro Lopez"
-> extract_pickup_order_data({senderName: "Pedro Lopez"})
-> "Que tipo de ID tienes Pedro?"

Usuario: "Licencia"
-> extract_pickup_order_data({senderIdType: "Licencia"})
-> "Y el numero de la licencia?"

Usuario: "D123456"
-> extract_pickup_order_data({senderIdNumber: "D123456"})
-> "Dame la direccion completa"

Usuario: "123 Main St Miami FL 33186"
-> extract_pickup_order_data({senderAddress: "123 Main St Miami FL 33186"})
-> "Hay codigo o PIN pa entrar al edificio?"

Usuario: "No hay"
-> extract_pickup_order_data({senderEntryPin: "NO"})
-> "Ok. Y el telefono de quien recibe en Cuba?"

Usuario: "El codigo es 4567"
-> extract_pickup_order_data({senderEntryPin: "4567"})
-> "Perfecto. Y el telefono en Cuba?"

IMPORTANTE: Extrae SOLO el dato que corresponde, no mezcles campos.`

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
  // Nuevas acciones de busqueda
  searchSender?: string    // Telefono para buscar remitente
  searchRecipient?: string // Telefono para buscar destinatario Cuba
  requestSummary?: boolean // Solicita mostrar resumen
}

// Function definitions para extraer datos estructurados
const functions: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_customer',
      description: 'Buscar cliente remitente por telefono. USAR cuando el usuario da su numero de telefono para buscarlo en el sistema.',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: 'Numero de telefono del remitente a buscar' }
        },
        required: ['phone']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_recipient',
      description: 'Buscar destinatario Cuba por telefono. USAR cuando el usuario da el telefono del destinatario en Cuba.',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: 'Numero de telefono del destinatario en Cuba a buscar' }
        },
        required: ['phone']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'request_summary',
      description: 'LLAMAR cuando ya tienes todos los datos y quieres mostrar el resumen al usuario para confirmacion',
      parameters: {
        type: 'object',
        properties: {
          ready: { type: 'boolean', description: 'true cuando todos los datos estan completos y quieres mostrar resumen' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'extract_pickup_order_data',
      description: 'LLAMAR SIEMPRE que el usuario da cualquier dato de recogida. Extraer CADA dato que mencione.',
      parameters: {
        type: 'object',
        properties: {
          // Datos del remitente (USA)
          senderName: { type: 'string', description: 'Nombre completo del remitente' },
          senderPhone: { type: 'string', description: 'Telefono del remitente' },
          senderIdType: { type: 'string', description: 'Tipo de ID: Pasaporte, Licencia, ID estatal' },
          senderIdNumber: { type: 'string', description: 'Numero del documento de identidad' },
          senderAddress: { type: 'string', description: 'Direccion completa con calle, ciudad, estado y ZIP. NO incluir PIN aqui.' },
          senderEntryPin: { type: 'string', description: 'SOLO el codigo numerico para entrar al edificio (ej: "1234", "4567#"). Guardar "NO" si el usuario dice que no hay codigo. NUNCA poner la direccion aqui.' },
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
            description: 'TRUE SOLO cuando el usuario CONFIRMA que los datos estan correctos (dice SI, OK, Correcto, etc)'
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

    // Variables para busquedas
    let searchSender: string | undefined
    let searchRecipient: string | undefined
    let requestSummary = false

    // Procesar tool calls si existen
    if (message.tool_calls && message.tool_calls.length > 0) {
      for (const toolCall of message.tool_calls) {
        // Solo procesar tool calls de tipo function
        if (toolCall.type !== 'function') continue

        const functionName = toolCall.function.name
        const args = JSON.parse(toolCall.function.arguments)

        if (functionName === 'detect_intent') {
          intent = args.intent
        } else if (functionName === 'search_customer') {
          searchSender = args.phone
          console.log('[OpenAI] GPT solicita buscar sender:', args.phone)
        } else if (functionName === 'search_recipient') {
          searchRecipient = args.phone
          console.log('[OpenAI] GPT solicita buscar recipient:', args.phone)
        } else if (functionName === 'request_summary') {
          requestSummary = args.ready === true
          console.log('[OpenAI] GPT solicita mostrar resumen')
        } else if (functionName === 'extract_pickup_order_data') {
          // Filtrar solo campos con valor
          const cleanArgs = Object.fromEntries(
            Object.entries(args).filter(([_, v]) => v !== null && v !== undefined && v !== '')
          )
          extractedData = { ...extractedData, ...cleanArgs }
          console.log('[OpenAI] Datos extraidos pickup:', cleanArgs)
          if (args.allDataComplete) {
            flowComplete = true
            readyToCreateOrder = true
          }
        } else if (functionName === 'extract_remittance_order_data') {
          const cleanArgs = Object.fromEntries(
            Object.entries(args).filter(([_, v]) => v !== null && v !== undefined && v !== '')
          )
          extractedData = { ...extractedData, ...cleanArgs }
          console.log('[OpenAI] Datos extraidos remesa:', cleanArgs)
          if (args.allDataComplete) {
            flowComplete = true
            readyToCreateOrder = true
          }
        }
      }

      // Si hubo tool calls pero no hay respuesta, generar una
      if (!response) {
        // Crear respuestas para TODOS los tool calls
        const toolResponses: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = message.tool_calls.map(tc => ({
          role: 'tool' as const,
          tool_call_id: tc.id,
          content: JSON.stringify({ success: true, extracted: extractedData })
        }))

        const followUp = await getOpenAI().chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            ...messages,
            {
              role: 'assistant',
              content: null,
              tool_calls: message.tool_calls
            },
            ...toolResponses
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
      readyToCreateOrder,
      searchSender,
      searchRecipient,
      requestSummary
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
