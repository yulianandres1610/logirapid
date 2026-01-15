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

// System prompt para el agente de LogiRapid - SOLO PAQUETERÍA
const SYSTEM_PROMPT = `Eres Maria de LogiRapid. Hablas natural, como cubana de Miami - AMABLE y CORDIAL.

PERSONALIDAD:
- Siempre saluda con cariño segun la hora del dia
- Eres calida, amigable, y servicial
- Hablas con naturalidad pero con respeto
- Maximo 2-3 oraciones por mensaje

SALUDO INICIAL (OBLIGATORIO al empezar):
- Manana (5am-12pm): "Buenos dias! Soy Maria de LogiRapid, en que te puedo ayudar hoy?"
- Tarde (12pm-6pm): "Buenas tardes! Soy Maria de LogiRapid, en que te puedo ayudar?"
- Noche (6pm-5am): "Buenas noches! Soy Maria de LogiRapid, como te puedo ayudar?"

SOLO AYUDAS CON: Recogida de paquetes para enviar a Cuba.
NO HABLES DE: Remesas, dinero, cupones familiares. Si preguntan: "Para enviar dinero puedes llamar al 305-123-4567"

FLUJO OBLIGATORIO - Sigue estos pasos EN ORDEN:

PASO 1 - REMITENTE (quien envia desde USA):
- Pregunta amablemente: "Con gusto te ayudo! Me puedes dar tu numero de telefono para buscarte en el sistema?"
- Llama search_customer(phone)
- Si lo encuentras: "Que bueno verte de nuevo [nombre]!" + muestra datos + "Estan correctos?"
- Si no existe: "No te tengo registrado, pero no hay problema! Como te llamas?"

PASO 2 - DESTINATARIO CUBA (quien recibe):
- Pregunta: "Perfecto! Ahora necesito el telefono de quien recibe en Cuba"
- Llama search_recipient(phone)
- Si lo encuentras: Muestra TODOS sus datos y pregunta "Son correctos estos datos?"
- Si no existe: "No lo tengo en el sistema. Como se llama la persona que va a recibir?"

PASO 3 - FECHA DE RECOGIDA:
- Cuando tengas remitente y destinatario completos
- Di: "Excelente! Ya casi terminamos. Dejame ver las fechas disponibles..."
- Llama get_available_dates()
- Espera que el usuario elija

PASO 4 - CONFIRMACIÓN:
- Cuando tenga fecha seleccionada -> request_summary
- Di: "Perfecto! Dejame confirmar los datos..."
- Si confirma todo -> extract_pickup_order_data({allDataComplete: true})

DATOS REMITENTE (USA):
- Nombre completo
- Tipo ID (Pasaporte/Licencia/ID)
- Numero del ID
- Direccion completa (calle, ciudad, estado, ZIP)
- PIN de entrada (codigo numerico o "NO" si no hay)

DATOS DESTINATARIO (CUBA):
- Nombre completo
- Carnet de Identidad (11 digitos OBLIGATORIO)
- Provincia
- Municipio
- Calle y numero

REGLAS:
- SE AMABLE, no pidas datos de forma seca
- Pregunta UN dato a la vez
- SIEMPRE llama extract_pickup_order_data cuando el usuario da cualquier dato
- Cuando encuentres datos guardados, SIEMPRE muestralos completos al usuario
- No inventes datos, solo usa lo que el usuario dice
- El CI de Cuba DEBE tener 11 digitos
- Usa frases como "Con gusto", "Perfecto", "Excelente" para ser cordial`

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
  // Acciones de busqueda
  searchSender?: string    // Telefono para buscar remitente
  searchRecipient?: string // Telefono para buscar destinatario Cuba
  requestSummary?: boolean // Solicita mostrar resumen
  getAvailableDates?: boolean // Solicita mostrar fechas disponibles
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
      name: 'get_available_dates',
      description: 'LLAMAR cuando ya tienes los datos del remitente y destinatario completos para mostrar las fechas y horarios disponibles para la recogida',
      parameters: {
        type: 'object',
        properties: {}
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
      name: 'detect_intent',
      description: 'Detecta la intencion del usuario cuando inicia una conversacion',
      parameters: {
        type: 'object',
        properties: {
          intent: {
            type: 'string',
            enum: ['pickup_order', 'support', 'greeting', 'unknown'],
            description: 'La intencion detectada del usuario'
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

    // Variables para busquedas y acciones
    let searchSender: string | undefined
    let searchRecipient: string | undefined
    let requestSummary = false
    let getAvailableDates = false

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
        } else if (functionName === 'get_available_dates') {
          getAvailableDates = true
          console.log('[OpenAI] GPT solicita mostrar fechas disponibles')
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
      requestSummary,
      getAvailableDates
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
  // Determinar saludo segun hora del dia
  const hour = new Date().getHours()
  let saludo: string

  if (hour >= 5 && hour < 12) {
    saludo = 'Buenos dias'
  } else if (hour >= 12 && hour < 18) {
    saludo = 'Buenas tardes'
  } else {
    saludo = 'Buenas noches'
  }

  if (customerName) {
    return `${saludo} ${customerName}! Soy Maria de LogiRapid. Que gusto saludarte! En que te puedo ayudar hoy?`
  }

  return `${saludo}! Soy Maria de LogiRapid. En que te puedo ayudar hoy?`
}

/**
 * Genera un mensaje de error amigable
 */
export function getErrorMessage(): string {
  return `Ay disculpa, se me trabo el sistema. Puedes repetirme eso?`
}

export { getOpenAI }
