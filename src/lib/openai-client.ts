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

// System prompt para el agente de LogiRapid - ENFOCADO EN RECOPILAR DATOS
const SYSTEM_PROMPT = `Eres Maria de LogiRapid, asistente para recogida de paquetes a Cuba.

PERSONALIDAD:
- Cubana de Miami: calida, amigable, natural
- Frases cortas (1-2 oraciones)
- Palabras: "Con gusto", "Perfecto", "Claro que si"

SERVICIO UNICO: Recogida de paquetes para enviar a Cuba
- Para remesas/dinero: "Para dinero llama al 305-123-4567"
- NUNCA pidas "amount", "monto" o cantidad de dinero

=== REGLA #1: NO INVENTAR DATOS ===
- NUNCA asumas datos que el usuario no te ha dado
- NUNCA inventes direcciones, nombres, telefonos o cualquier dato
- Solo usa EXACTAMENTE lo que el usuario escribio
- Si no entiendes algo, pregunta de nuevo

=== REGLA #2: UN DATO A LA VEZ ===
- Pide UN solo dato por mensaje
- NO pases al siguiente dato hasta que el actual este COMPLETO
- Si el usuario da info incompleta, pide que complete ESE dato

=== REGLA #3: NUEVA ORDEN = LIMPIAR DATOS ===
Si el usuario dice: "nueva orden", "otro envio", "para otra persona", "empezar de nuevo":
- Llama start_new_order() para limpiar datos anteriores
- Comienza desde cero pidiendo el telefono

=== FLUJO ESTRICTO - SEGUIR EN ORDEN ===

FASE 1 - REMITENTE (quien envia):
1. Pedir telefono del remitente
2. Si lo encontramos en sistema: mostrar datos y confirmar
3. Si NO existe o quiere usar otros datos, pedir UNO A UNO:
   a. Nombre completo
   b. Tipo de ID (Pasaporte, Licencia, ID) - NO validar formato
   c. Numero del ID - ACEPTAR CUALQUIER formato (ej: "H2334", "AB123456", etc.) - NO validar
   d. Direccion COMPLETA (ejemplo: "123 Main St, Miami, FL 33125")
   e. PIN de entrada (codigo numerico o "no hay")

FASE 2 - DESTINATARIO CUBA (quien recibe):
Solo cuando FASE 1 este COMPLETA:
1. Pedir telefono Cuba (8 digitos)
2. Si lo encontramos: mostrar datos y confirmar
3. Si NO existe, pedir UNO A UNO:
   a. Nombre completo
   b. Carnet de Identidad (11 digitos exactos)
   c. Provincia (debe ser valida: La Habana, Matanzas, etc)
   d. Municipio (debe ser valido para esa provincia)
   e. Direccion en Cuba (calle, numero, entre calles)

FASE 3 - FECHA Y HORA:
Solo cuando FASE 1 y 2 esten COMPLETAS:
1. Preguntar que dia prefiere
2. Preguntar horario: manana (8-12), tarde (12-4), noche (4-8)

=== VALIDACION DE DIRECCIONES USA (MUY IMPORTANTE) ===
Cuando el usuario da una direccion:
1. LLAMA validate_us_address(direccion) INMEDIATAMENTE
2. El sistema validara con Mapbox y te devolvera la direccion formateada
3. MUESTRA la direccion formateada al usuario para que CONFIRME
4. Solo si el usuario dice SI/CORRECTO, guarda la direccion con extract_pickup_order_data
5. Si el usuario dice NO o corrige, pide la direccion de nuevo

Una direccion USA valida DEBE tener:
- Numero y calle (ej: "123 Main Street")
- Ciudad (ej: "Miami")
- Estado (ej: "FL" o "Florida")
- ZIP code (5 digitos, ej: "33125")

IMPORTANTE: Las coordenadas correctas dependen de validar la direccion.
NO guardes una direccion sin validarla primero con validate_us_address.

=== EXTRACCION DE DATOS ===
CADA VEZ que el usuario da un dato, llama extract_pickup_order_data con ESE dato especifico.
NO llames la funcion si no hay datos nuevos que extraer.

=== CREAR ORDEN ===
SOLO cuando tengas TODOS estos datos completos:
- Remitente: nombre, ID, direccion completa con ZIP
- Destinatario: nombre, CI, provincia, municipio, direccion Cuba
- Fecha y horario seleccionados

Entonces llama extract_pickup_order_data({allDataComplete: true})`

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
  startNewOrder?: boolean // Usuario quiere empezar nueva orden (limpiar datos)
  validateAddress?: string // Direccion a validar con Mapbox
}

// Function definitions para extraer datos estructurados
const functions: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'start_new_order',
      description: 'LLAMAR cuando el usuario quiere empezar una nueva orden o envio para otra persona. Esto limpia todos los datos anteriores.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Razon: nueva_orden, otro_cliente, empezar_de_nuevo' }
        }
      }
    }
  },
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
      name: 'validate_us_address',
      description: 'LLAMAR cuando el usuario da una direccion en USA. Valida la direccion con Mapbox y devuelve la direccion formateada para confirmacion.',
      parameters: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'La direccion que dio el usuario, tal cual la escribio' }
        },
        required: ['address']
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
          senderIdType: { type: 'string', description: 'Tipo de ID: Pasaporte, Licencia, ID estatal - NO validar' },
          senderIdNumber: { type: 'string', description: 'Numero del documento de identidad - ACEPTAR cualquier formato (H2334, AB123, etc) - NO validar' },
          senderAddress: { type: 'string', description: 'Direccion completa VALIDADA con calle, ciudad, estado y ZIP. NO incluir PIN aqui.' },
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
      // Identificar campos completos vs faltantes
      const allFields = [
        'senderName', 'senderIdType', 'senderIdNumber', 'senderAddress', 'senderEntryPin',
        'recipientName', 'recipientPhone', 'recipientCI', 'recipientProvince', 'recipientMunicipality', 'recipientStreet',
        'scheduledDate', 'timeSlot'
      ]

      const completeFields = allFields.filter(f => collectedData[f] && String(collectedData[f]).trim() !== '')
      const missingFields = allFields.filter(f => !collectedData[f] || String(collectedData[f]).trim() === '')

      // Mapeo de nombres legibles
      const fieldNames: Record<string, string> = {
        senderName: 'nombre remitente',
        senderIdType: 'tipo ID',
        senderIdNumber: 'numero ID',
        senderAddress: 'direccion recogida',
        senderEntryPin: 'PIN entrada',
        recipientName: 'nombre destinatario',
        recipientPhone: 'telefono Cuba',
        recipientCI: 'carnet identidad',
        recipientProvince: 'provincia',
        recipientMunicipality: 'municipio',
        recipientStreet: 'direccion Cuba',
        scheduledDate: 'fecha recogida',
        timeSlot: 'horario'
      }

      contextMessage = `\n\n[CONTEXTO INTERNO - No mencionar al usuario]
Flujo: ${currentFlow}

CAMPOS COMPLETOS (NO pedir estos datos):
${completeFields.map(f => `- ${fieldNames[f] || f}: ${collectedData[f]}`).join('\n') || 'Ninguno'}

CAMPOS FALTANTES (pide SOLO estos):
${missingFields.filter(f => !f.startsWith('_')).map(f => `- ${fieldNames[f] || f}`).join('\n') || 'TODOS LOS DATOS COMPLETOS - procede a crear orden'}

${missingFields.length === 0 || (missingFields.length <= 2 && missingFields.every(f => ['scheduledDate', 'timeSlot'].includes(f)))
  ? 'REMITENTE Y DESTINATARIO COMPLETOS - pide fecha si no la tenemos'
  : 'Sigue recopilando datos faltantes UNO A UNO'}`
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

    // Logging detallado
    console.log('[OpenAI] GPT raw response:', {
      content: message.content?.substring(0, 100),
      hasToolCalls: !!message.tool_calls,
      toolCallsCount: message.tool_calls?.length || 0,
      toolCallNames: message.tool_calls?.map(tc => tc.type === 'function' ? tc.function.name : 'unknown')
    })

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
    let startNewOrder = false
    let validateAddress: string | undefined

    // Procesar tool calls si existen
    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log('[OpenAI] Processing', message.tool_calls.length, 'tool calls')
      for (const toolCall of message.tool_calls) {
        // Solo procesar tool calls de tipo function
        if (toolCall.type !== 'function') continue

        const functionName = toolCall.function.name
        const args = JSON.parse(toolCall.function.arguments)

        if (functionName === 'start_new_order') {
          startNewOrder = true
          console.log('[OpenAI] GPT solicita nueva orden (limpiar datos)')
        } else if (functionName === 'detect_intent') {
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
        } else if (functionName === 'validate_us_address') {
          validateAddress = args.address
          console.log('[OpenAI] GPT solicita validar direccion:', args.address)
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
      selectDate,
      startNewOrder,
      validateAddress
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
