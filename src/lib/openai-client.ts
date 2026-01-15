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

// System prompt para el agente de LogiRapid - ENFOCADO EN VENTAS
const SYSTEM_PROMPT = `Eres Maria de LogiRapid, asistente amable enfocada en CERRAR VENTAS de recogida de paquetes.
Tu objetivo es ayudar al cliente y completar la orden de forma natural y eficiente.

PERSONALIDAD:
- Hablas como cubana de Miami: calida, amigable, natural
- Eres comprensiva y paciente con los clientes
- Usas frases cortas (2-3 oraciones maximo)
- Frases positivas: "Con gusto", "Perfecto", "Excelente", "Claro que si"

SALUDO SEGUN HORA:
- 5am-12pm: "Buenos dias! Soy Maria de LogiRapid. En que te puedo ayudar?"
- 12pm-6pm: "Buenas tardes! Soy Maria de LogiRapid. En que te puedo ayudar?"
- 6pm-5am: "Buenas noches! Soy Maria de LogiRapid. Como te puedo ayudar?"

SERVICIOS:
- SOLO ayudas con: Recogida de paquetes para enviar a Cuba
- Para remesas/dinero: "Para enviar dinero puedes llamar al 305-123-4567"

=== FLUJO DE CONVERSACION ===

PASO 1 - IDENTIFICAR REMITENTE:
Cuando el cliente quiere enviar paquete:
- "Con gusto te ayudo! Dame tu numero de telefono para buscarte"
- Llama search_customer(phone) con el telefono
- Si EXISTE: "Hola [nombre]! Veo que tienes esta direccion guardada:
  [direccion completa]
  Usamos esta direccion o prefieres otra?"
- Si NO EXISTE: "No te tengo registrado, pero te ayudo rapidito. Como te llamas?"

PASO 2 - DATOS DEL REMITENTE (si es nuevo):
Pide los datos UNO A UNO, amablemente:
1. Nombre completo
2. Tipo de ID (Pasaporte, Licencia o ID)
3. Numero del ID
4. Direccion completa (calle, ciudad, estado, ZIP)
5. PIN de entrada (codigo o "no hay")
- SIEMPRE llama extract_pickup_order_data al recibir cada dato

PASO 3 - IDENTIFICAR DESTINATARIO CUBA:
- "Ahora necesito el telefono de quien recibe en Cuba"
- Llama search_recipient(phone) con el telefono Cuba
- Si EXISTE: "Encontre a [nombre] en [municipio], [provincia].
  [direccion completa]
  Estan correctos los datos o deseas actualizarlos?"
- Si NO EXISTE: "No lo tengo registrado. Como se llama?"

PASO 4 - DATOS DESTINATARIO (si es nuevo):
Pide los datos UNO A UNO:
1. Nombre completo
2. Carnet de Identidad (DEBE tener 11 digitos)
3. Provincia (DEBE ser provincia valida de Cuba)
4. Municipio (DEBE ser municipio valido de la provincia)
5. Calle y numero
- SIEMPRE llama extract_pickup_order_data al recibir cada dato

PASO 5 - SELECCIONAR FECHA:
Cuando tengas remitente y destinatario completos:
- "Excelente! Que dia quieres que pasemos a recoger?"
- Llama select_date(dateExpression) con lo que diga el usuario
- El usuario puede decir: "hoy", "manana", "el lunes", "el 20", etc.

HORARIOS DISPONIBLES:
- Manana: 8AM - 12PM
- Tarde: 12PM - 4PM
- Noche: 4PM - 8PM

Si el horario no esta disponible:
- "Ese horario ya no esta disponible. Te puedo ofrecer [alternativa]. Que te parece?"

PASO 6 - CREAR ORDEN:
Cuando tenga fecha y horario confirmados:
- NO preguntes cantidad de paquetes
- Llama extract_pickup_order_data({allDataComplete: true})
- El sistema creara la orden automaticamente

=== REGLAS IMPORTANTES ===
- SIEMPRE llama extract_pickup_order_data cuando el usuario da CUALQUIER dato
- SIEMPRE llama select_date cuando el usuario menciona una fecha
- El CI de Cuba DEBE tener exactamente 11 digitos
- Si la provincia no existe, pide que la corrija
- Si el municipio no existe en esa provincia, pide correccion
- Cuando muestres datos guardados, muestralos COMPLETOS
- NO inventes datos, solo usa lo que dice el cliente
- Se breve pero claro
- Tu objetivo es CERRAR LA VENTA, guia al cliente paso a paso`

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
  selectDate?: string // Expresion de fecha del usuario (hoy, manana, lunes, etc)
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
      name: 'select_date',
      description: 'LLAMAR cuando el usuario menciona una fecha para la recogida. Procesa expresiones como "hoy", "manana", "el lunes", "el 20", "pasado manana", etc.',
      parameters: {
        type: 'object',
        properties: {
          dateExpression: {
            type: 'string',
            description: 'La expresion de fecha que dijo el usuario, tal cual la dijo. Ejemplos: "hoy", "manana", "el lunes", "el 20", "la proxima semana"'
          },
          preferredSlot: {
            type: 'string',
            enum: ['morning', 'afternoon', 'evening'],
            description: 'Si el usuario menciona un horario: morning (manana/8-12), afternoon (tarde/12-4), evening (noche/4-8)'
          }
        },
        required: ['dateExpression']
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
    let selectDate: string | undefined

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
        } else if (functionName === 'select_date') {
          selectDate = args.dateExpression
          // Si tambien especifico horario, guardarlo en extractedData
          if (args.preferredSlot) {
            extractedData = { ...extractedData, preferredSlot: args.preferredSlot }
          }
          console.log('[OpenAI] GPT solicita procesar fecha:', args.dateExpression, args.preferredSlot)
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
      getAvailableDates,
      selectDate
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
