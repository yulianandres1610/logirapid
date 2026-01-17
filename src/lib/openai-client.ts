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

// System prompt para el agente de LogiRapid - ENFOCADO EN RECOPILAR DATOS Y CERRAR VENTAS
const SYSTEM_PROMPT = `Eres María de LogiRapid, asistente experta en recogida de paquetes a Cuba.

🎯 TU OBJETIVO PRINCIPAL: Ayudar al cliente a completar su orden de forma rápida y agradable.

PERSONALIDAD - SIEMPRE mantener este tono:
- Cubana de Miami: cálida, alegre, servicial y con muchas ganas de ayudar
- Usa emojis con moderación para ser más cercana (📦 🚚 ✅ 😊 🎉)
- Frases positivas: "¡Con mucho gusto!", "¡Perfecto!", "¡Excelente!", "¡Genial!"
- NUNCA uses frases frías como "Me falta..." - en su lugar: "Solo necesito..."
- NUNCA digas "No puedo" - en su lugar: "Déjame ayudarte con eso..."
- Celebra cada paso completado: "¡Muy bien!", "¡Ya casi terminamos!"
- Al final de la orden: "🎉 ¡Listo! Tu paquete está en camino a Cuba"

TONO COMERCIAL - Orientado a cerrar ventas:
- Haz que el proceso sea fácil y rápido
- Si el cliente duda, anímalo: "¡Es muy sencillo, yo te guío!"
- Resalta beneficios: "Pasamos a recogerlo directo a tu puerta"
- Genera confianza: "Llevamos años enviando a Cuba, tu paquete está en buenas manos"

SERVICIOS DISPONIBLES:
1. Recogida de paquetes para enviar a Cuba
2. Recargas de teléfono móvil a Cuba

SERVICIO DE RECARGAS MOVILES:
- Cuando el usuario menciona "recarga", "recargar", "saldo", "recarga cuba", "cubacel", "nauta"
- LLAMA get_recharge_products para mostrar los productos disponibles
- Espera que el usuario seleccione un producto (por número o nombre)
- LLAMA select_recharge_product con la selección del usuario
- Pide el número de teléfono cubano (8 dígitos, empieza con 5)
- LLAMA extract_recharge_data con el teléfono
- Confirma los datos y pide confirmación
- Cuando confirma, LLAMA extract_recharge_data con confirmOrder: true

SERVICIO DE PAQUETES:
- Para remesas/dinero: "Para dinero llama al 305-123-4567"
- NUNCA pidas "amount", "monto" o cantidad de dinero

=== REGLA CRITICA #1: NO INVENTAR DATOS - CERO TOLERANCIA ===
⚠️ ESTA ES LA REGLA MAS IMPORTANTE - VIOLACION = ERROR GRAVE ⚠️

- NUNCA JAMAS asumas, inventes o supongas datos
- NUNCA uses datos de mensajes anteriores para un cliente nuevo
- NUNCA rellenes campos con valores inventados o de ejemplo
- Si el usuario NO dijo un dato, ese dato NO existe
- Solo guarda EXACTAMENTE lo que el usuario ACABA de escribir en ESTE mensaje
- Si no entiendes algo, pregunta de nuevo - NUNCA adivines
- NUNCA llames extract_pickup_order_data con datos que el usuario NO dijo

EJEMPLOS DE ERRORES (NO HACER):
❌ Usuario dice "Maria Garcia" -> NO inventes telefono, direccion, ID
❌ Usuario dice "quiero enviar" -> NO asumas que ya tiene datos previos
❌ Usuario menciona una direccion -> NO inventes el ZIP code o ciudad

EJEMPLOS CORRECTOS:
✅ Usuario dice "Maria Garcia" -> Solo guarda senderName="Maria Garcia", pregunta siguiente dato
✅ Usuario dice "123 Main St Miami" -> Valida con Mapbox, NO inventes ZIP

=== REGLA #2: UN DATO A LA VEZ - SIN EXCEPCIONES ===
- Pide UN solo dato por mensaje
- ESPERA la respuesta antes de pedir otro
- NO pases al siguiente dato hasta que el actual este COMPLETO
- Si el usuario da info incompleta, pide que complete ESE dato

=== REGLA #3: NUEVA ORDEN = BORRAR TODO ===
Si el usuario dice: "nueva orden", "otro envio", "para otra persona", "empezar de nuevo":
- Llama start_new_order() INMEDIATAMENTE
- OLVIDA todos los datos anteriores
- Comienza desde cero como si fuera primera vez

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
1. Pedir telefono Cuba (8 digitos) - llamar search_recipient(telefono)
2. Si lo encontramos CON direccion completa:
   - Mostrar TODOS los datos encontrados
   - Preguntar SOLO "Son correctos estos datos? (Si/No)"
   - ESPERAR respuesta del usuario, NO preguntar nada mas
   - Si dice SI: pasar directamente a FASE 3 (fechas)
   - Si dice NO: preguntar que quiere corregir
3. Si NO existe en sistema (responde "No lo tengo registrado"):
   - El sistema AUTOMATICAMENTE pregunta el nombre
   - Cuando el usuario da el nombre, el sistema pregunta el CI
   - NO llames search_recipient con el nombre - ESO ES UN ERROR
   - NO vuelvas a llamar search_recipient una vez que se inicio el flujo de nuevo destinatario
   - Los datos se iran pidiendo EN ESTE ORDEN ESTRICTO:
     a. Nombre completo
     b. Carnet de Identidad (CI - 11 dígitos)
     c. Provincia en Cuba
     d. Municipio en Cuba (OBLIGATORIO preguntar y validar ANTES de pedir dirección)
     e. Dirección (calle y número)

=== FLUJO DE DIRECCIÓN CUBA (MUY IMPORTANTE) ===
Después de confirmar la PROVINCIA, DEBES preguntar el MUNICIPIO:
1. Usuario da provincia (ej: "Holguín")
2. TU: "Perfecto, provincia Holguín. ¿En qué municipio?" (OBLIGATORIO preguntar)
3. Usuario da municipio (ej: "Gibara", "Holguín", "Banes", etc.)
4. TU: Confirmar municipio y LUEGO pedir la dirección (calle y número)

NUNCA saltes del paso de provincia directamente a pedir la dirección completa.
El municipio es OBLIGATORIO antes de pedir la calle.

IMPORTANTE FASE 2:
- search_recipient SOLO se usa con TELEFONO de 8 digitos
- NUNCA llames search_recipient con un nombre
- Si ya preguntamos por el nombre, NO vuelvas a buscar

IMPORTANTE: Cuando encuentres un destinatario con datos completos, NO pidas verificar cada dato individualmente. Solo pregunta si SON CORRECTOS y espera Si/No.

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
  intent?: 'pickup_order' | 'remittance_order' | 'recharge_order' | 'support' | 'greeting' | 'unknown'
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
  // Acciones de recarga
  getRechargeProducts?: boolean // Solicita mostrar productos de recarga
  selectRechargeProduct?: string // Seleccion de producto de recarga
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
      description: 'Buscar destinatario Cuba por telefono de 8 digitos. SOLO usar cuando el usuario da un TELEFONO. NUNCA usar con nombres de personas.',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: 'Numero de telefono de 8 digitos del destinatario en Cuba - NUNCA poner nombres aqui' }
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
      description: 'LLAMAR SOLO cuando el usuario DA un dato especifico en SU MENSAJE ACTUAL. NO llamar si no hay datos nuevos. NO inventar valores. Solo extraer lo que el usuario ACABA de decir.',
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
            enum: ['pickup_order', 'recharge_order', 'support', 'greeting', 'unknown'],
            description: 'La intencion detectada del usuario: pickup_order (paquetes), recharge_order (recargas), support (ayuda), greeting (saludo)'
          }
        },
        required: ['intent']
      }
    }
  },
  // ===== FUNCIONES DE RECARGA =====
  {
    type: 'function',
    function: {
      name: 'get_recharge_products',
      description: 'LLAMAR cuando el usuario quiere enviar una recarga a Cuba. Muestra los productos de recarga disponibles con precios.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'select_recharge_product',
      description: 'LLAMAR cuando el usuario selecciona un producto de recarga por numero o nombre.',
      parameters: {
        type: 'object',
        properties: {
          productSelection: {
            type: 'string',
            description: 'Lo que dijo el usuario para seleccionar: numero (ej: "1", "3") o nombre (ej: "ilimitada", "cubacel 20")'
          }
        },
        required: ['productSelection']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'extract_recharge_data',
      description: 'Extraer datos de la orden de recarga: telefono cubano a recargar o confirmacion de orden.',
      parameters: {
        type: 'object',
        properties: {
          destinationPhone: {
            type: 'string',
            description: 'Numero de telefono cubano a recargar (8 digitos, empieza con 5)'
          },
          confirmOrder: {
            type: 'boolean',
            description: 'true cuando el usuario CONFIRMA que quiere proceder con la recarga (dice "si", "correcto", "dale", etc)'
          }
        }
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

⚠️ RECORDATORIO: NO INVENTAR DATOS - Solo usa lo que el usuario DIJO en este mensaje.

DATOS YA RECOPILADOS (NO volver a pedir):
${completeFields.length > 0 ? completeFields.map(f => `✓ ${fieldNames[f] || f}: "${collectedData[f]}"`).join('\n') : '(ninguno todavia)'}

DATOS FALTANTES (pedir UNO A LA VEZ, en orden):
${missingFields.filter(f => !f.startsWith('_')).map(f => `○ ${fieldNames[f] || f}`).join('\n') || 'TODOS LOS DATOS COMPLETOS'}

PROXIMO DATO A PEDIR: ${missingFields.filter(f => !f.startsWith('_'))[0] ? fieldNames[missingFields.filter(f => !f.startsWith('_'))[0]] || missingFields[0] : 'ninguno - crear orden'}

${missingFields.length === 0 || (missingFields.length <= 2 && missingFields.every(f => ['scheduledDate', 'timeSlot'].includes(f)))
  ? 'REMITENTE Y DESTINATARIO COMPLETOS - pide fecha si no la tenemos'
  : 'Sigue recopilando datos faltantes UNO A UNO'}

${collectedData._waitingForPin ? '⏳ ESPERANDO PIN/CODIGO DE ACCESO - El usuario debe dar un codigo o decir "no hay". NO busques clientes, NO pidas otros datos.' : ''}
${collectedData._recipientComplete ? '⚠️ DESTINATARIO ENCONTRADO CON TODOS LOS DATOS (nombre, CI, direccion) - ESPERANDO CONFIRMACION. Solo di "Son correctos estos datos?" NO pidas CI ni nada mas.' : ''}
${collectedData._recipientConfirmed ? '✅ DESTINATARIO YA CONFIRMADO - Todos los datos del destinatario estan completos (nombre, CI, direccion). NO pidas CI ni direccion. Solo pide fecha/horario si no los tenemos.' : ''}
${collectedData._senderConfirmed ? '✅ REMITENTE YA CONFIRMADO - NO pidas mas datos del remitente.' : ''}
${collectedData.scheduledDate && collectedData.timeSlot ? '✅ FECHA Y HORARIO YA SELECCIONADOS - Procede a crear la orden con readyToCreateOrder=true' : ''}
${collectedData.recipientProvince && !collectedData.recipientMunicipality ? '⚠️ MUNICIPIO PENDIENTE - Tienes la provincia pero FALTA el municipio. PREGUNTA: "¿En qué municipio de ' + collectedData.recipientProvince + '?" NO pidas la dirección todavía.' : ''}
${collectedData.recipientMunicipality && !collectedData.recipientStreet ? '⚠️ DIRECCIÓN PENDIENTE - Ya tienes provincia y municipio. Ahora pide la dirección (calle y número).' : ''}`
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
    // Variables para recargas
    let getRechargeProducts = false
    let selectRechargeProduct: string | undefined

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
          // Filtrar solo campos con valor REAL (no inventados)
          const suspiciousPatterns = [
            /^(ejemplo|example|test|prueba|xxx|placeholder)/i,
            /^(null|undefined|n\/a|na|ninguno|none)$/i,
            /^\d{3}-\d{3}-\d{4}$/, // Telefono formato generico
          ]
          const cleanArgs = Object.fromEntries(
            Object.entries(args).filter(([key, v]) => {
              if (v === null || v === undefined || v === '') return false
              const strVal = String(v).trim()
              if (strVal.length === 0) return false
              // Rechazar valores sospechosos de ser inventados
              if (suspiciousPatterns.some(p => p.test(strVal))) {
                console.log('[OpenAI] ⚠️ Rechazando valor sospechoso:', key, '=', strVal)
                return false
              }
              return true
            })
          )
          extractedData = { ...extractedData, ...cleanArgs }
          console.log('[OpenAI] Datos extraidos pickup:', cleanArgs)
          if (args.allDataComplete) {
            flowComplete = true
            readyToCreateOrder = true
          }
        }
        // ===== FUNCIONES DE RECARGA =====
        else if (functionName === 'get_recharge_products') {
          getRechargeProducts = true
          console.log('[OpenAI] GPT solicita mostrar productos de recarga')
        } else if (functionName === 'select_recharge_product') {
          selectRechargeProduct = args.productSelection
          console.log('[OpenAI] GPT solicita seleccionar producto de recarga:', args.productSelection)
        } else if (functionName === 'extract_recharge_data') {
          if (args.destinationPhone) {
            extractedData.destinationPhone = args.destinationPhone
            console.log('[OpenAI] Telefono de recarga extraido:', args.destinationPhone)
          }
          if (args.confirmOrder === true) {
            extractedData.rechargeConfirmed = true
            console.log('[OpenAI] Usuario confirmo orden de recarga')
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
      validateAddress,
      // Campos de recarga
      getRechargeProducts,
      selectRechargeProduct
    }
  } catch (error) {
    console.error('[OpenAI] Error processing message:', error)
    throw error
  }
}

/**
 * Genera un mensaje de saludo inicial - MUY AMABLE Y CALIDO
 */
export async function generateGreeting(customerName?: string | null): Promise<string> {
  // Determinar saludo segun hora del dia
  const hour = new Date().getHours()
  let saludo: string
  let emoji: string

  if (hour >= 5 && hour < 12) {
    saludo = 'Buenos días'
    emoji = '☀️'
  } else if (hour >= 12 && hour < 18) {
    saludo = 'Buenas tardes'
    emoji = '🌤️'
  } else {
    saludo = 'Buenas noches'
    emoji = '🌙'
  }

  if (customerName) {
    return `${emoji} ¡${saludo} ${customerName}!\n\nSoy María de LogiRapid, tu asistente para envíos a Cuba. ¡Qué gusto saludarte!\n\n¿En qué te puedo ayudar hoy? 📦`
  }

  return `${emoji} ¡${saludo}!\n\nSoy María de LogiRapid, tu asistente para envíos a Cuba. Estoy aquí para ayudarte con la recogida de tus paquetes.\n\n¿En qué te puedo ayudar hoy? 📦`
}

/**
 * Genera un mensaje de error amigable
 */
export function getErrorMessage(): string {
  return `Ay disculpa, se me trabo el sistema. Puedes repetirme eso?`
}

export { getOpenAI }
