import { db } from '@/lib/database'
import { processMessage, generateGreeting, getErrorMessage, ConversationMessage, GPTResponse } from '@/lib/openai-client'
import { sendWhatsApp } from '@/lib/sms-service'

// Interfaces
export interface Conversation {
  id: number
  phone_number: string
  current_flow: string | null
  current_step: string | null
  collected_data: Record<string, unknown>
  messages_history: ConversationMessage[]
  customer_id: number | null
  customer_name: string | null
  last_message_at: Date
}

export interface AgentResponse {
  message: string
  orderCreated?: boolean
  orderId?: number
  orderNumber?: string
  paymentLink?: string
}

// Comision por defecto para remesas (5%)
const REMITTANCE_FEE_PERCENTAGE = 5

// Campos requeridos para cada tipo de orden
const PICKUP_REQUIRED_FIELDS = [
  'senderName',
  'senderAddress',
  'recipientName',
  'recipientProvince',
  'recipientMunicipality',
  'recipientAddress'
]

const REMITTANCE_REQUIRED_FIELDS = [
  'amount',
  'senderName',
  'recipientName',
  'province',
  'municipality',
  'address'
]

/**
 * Valida si los datos de recogida estan completos
 */
function validatePickupData(data: Record<string, unknown>): { valid: boolean; missing: string[] } {
  const missing: string[] = []
  for (const field of PICKUP_REQUIRED_FIELDS) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].toString().trim() === '')) {
      missing.push(field)
    }
  }
  return { valid: missing.length === 0, missing }
}

/**
 * Valida si los datos de remesa estan completos
 */
function validateRemittanceData(data: Record<string, unknown>): { valid: boolean; missing: string[] } {
  const missing: string[] = []
  for (const field of REMITTANCE_REQUIRED_FIELDS) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].toString().trim() === '')) {
      missing.push(field)
    }
  }
  return { valid: missing.length === 0, missing }
}

/**
 * Busca un cliente existente por numero de telefono
 */
async function findCustomerByPhone(phoneNumber: string): Promise<{ id: number; name: string } | null> {
  // Limpiar numero
  const cleanPhone = phoneNumber.replace(/\D/g, '')
  const phoneVariants = [
    cleanPhone,
    `+${cleanPhone}`,
    `+1${cleanPhone}`,
    cleanPhone.slice(-10) // Ultimos 10 digitos
  ]

  // Buscar en customers
  const customerResult = await db.query(`
    SELECT id, firstname, lastname
    FROM customers
    WHERE phone LIKE ANY($1) OR phone LIKE ANY($2)
    LIMIT 1
  `, [
    phoneVariants.map(p => `%${p}%`),
    phoneVariants.map(p => `%${p.slice(-10)}%`)
  ])

  if (customerResult.rows.length > 0) {
    const c = customerResult.rows[0]
    return {
      id: c.id,
      name: `${c.firstname || ''} ${c.lastname || ''}`.trim() || 'Cliente'
    }
  }

  // Buscar en package_orders por telefono del sender
  const orderResult = await db.query(`
    SELECT customername, phone, createdat
    FROM package_orders
    WHERE phone LIKE ANY($1)
    ORDER BY createdat DESC
    LIMIT 1
  `, [phoneVariants.map(p => `%${p.slice(-10)}%`)])

  if (orderResult.rows.length > 0 && orderResult.rows[0].customername) {
    return {
      id: 0,
      name: orderResult.rows[0].customername
    }
  }

  // Buscar en remittance_orders
  const remitResult = await db.query(`
    SELECT sender_name, sender_phone, created_at
    FROM remittance_orders
    WHERE sender_phone LIKE ANY($1)
    ORDER BY created_at DESC
    LIMIT 1
  `, [phoneVariants.map(p => `%${p.slice(-10)}%`)])

  if (remitResult.rows.length > 0 && remitResult.rows[0].sender_name) {
    return {
      id: 0,
      name: remitResult.rows[0].sender_name
    }
  }

  return null
}

/**
 * Obtiene o crea una conversacion para un numero de telefono
 */
export async function getOrCreateConversation(phoneNumber: string): Promise<Conversation> {
  // Limpiar numero de telefono (remover 'whatsapp:' prefix)
  const cleanPhone = phoneNumber.replace('whatsapp:', '').trim()

  // Buscar conversacion existente
  const result = await db.query(`
    SELECT * FROM whatsapp_conversations
    WHERE phone_number = $1
  `, [cleanPhone])

  if (result.rows.length > 0) {
    const row = result.rows[0]

    // Si no tiene nombre de cliente, intentar buscarlo
    let customerName = row.customer_name
    let customerId = row.customer_id

    if (!customerName) {
      const customer = await findCustomerByPhone(cleanPhone)
      if (customer) {
        customerName = customer.name
        customerId = customer.id || null

        // Actualizar la conversacion con el nombre del cliente
        await db.query(`
          UPDATE whatsapp_conversations
          SET customer_name = $1, customer_id = $2
          WHERE id = $3
        `, [customerName, customerId, row.id])
      }
    }

    return {
      id: row.id,
      phone_number: row.phone_number,
      current_flow: row.current_flow,
      current_step: row.current_step,
      collected_data: row.collected_data || {},
      messages_history: row.messages_history || [],
      customer_id: customerId,
      customer_name: customerName,
      last_message_at: row.last_message_at
    }
  }

  // Buscar si es un cliente conocido
  const customer = await findCustomerByPhone(cleanPhone)

  // Crear nueva conversacion
  const insertResult = await db.query(`
    INSERT INTO whatsapp_conversations (phone_number, current_flow, collected_data, messages_history, customer_id, customer_name)
    VALUES ($1, 'idle', '{}', '[]', $2, $3)
    RETURNING *
  `, [cleanPhone, customer?.id || null, customer?.name || null])

  const row = insertResult.rows[0]
  return {
    id: row.id,
    phone_number: row.phone_number,
    current_flow: row.current_flow,
    current_step: row.current_step,
    collected_data: {},
    messages_history: [],
    customer_id: customer?.id || null,
    customer_name: customer?.name || null,
    last_message_at: row.last_message_at
  }
}

/**
 * Guarda un mensaje en el historial
 */
export async function saveMessage(
  conversationId: number,
  direction: 'inbound' | 'outbound',
  content: string,
  messageSid?: string,
  intent?: string,
  extractedData?: Record<string, unknown>
): Promise<void> {
  await db.query(`
    INSERT INTO whatsapp_messages (
      conversation_id, direction, message_sid, content, detected_intent, extracted_data
    ) VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    conversationId,
    direction,
    messageSid || null,
    content,
    intent || null,
    extractedData ? JSON.stringify(extractedData) : null
  ])
}

/**
 * Actualiza el estado de la conversacion
 */
export async function updateConversationState(
  conversationId: number,
  flow: string | null,
  step: string | null,
  collectedData: Record<string, unknown>,
  messagesHistory: ConversationMessage[]
): Promise<void> {
  // Limitar historial a ultimos 20 mensajes
  const limitedHistory = messagesHistory.slice(-20)

  await db.query(`
    UPDATE whatsapp_conversations
    SET
      current_flow = $1,
      current_step = $2,
      collected_data = $3,
      messages_history = $4,
      last_message_at = NOW(),
      updated_at = NOW()
    WHERE id = $5
  `, [
    flow,
    step,
    JSON.stringify(collectedData),
    JSON.stringify(limitedHistory),
    conversationId
  ])
}

/**
 * Resetea la conversacion a estado inicial
 */
export async function resetConversation(conversationId: number): Promise<void> {
  await db.query(`
    UPDATE whatsapp_conversations
    SET
      current_flow = 'idle',
      current_step = NULL,
      collected_data = '{}',
      messages_history = '[]',
      updated_at = NOW()
    WHERE id = $1
  `, [conversationId])
}

/**
 * Genera un numero de orden unico
 */
async function generateOrderNumber(prefix: string): Promise<string> {
  const year = new Date().getFullYear()
  const result = await db.query(`
    SELECT COUNT(*) + 1 as next_num
    FROM package_orders
    WHERE ordernumber LIKE $1
  `, [`${prefix}-${year}-%`])

  const nextNum = result.rows[0]?.next_num || 1
  return `${prefix}-${year}-${String(nextNum).padStart(5, '0')}`
}

/**
 * Obtiene o crea un cliente por numero de telefono
 */
async function getOrCreateCustomer(
  phoneNumber: string,
  name: string,
  address?: string
): Promise<{ customerId: number; isNew: boolean }> {
  const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10)

  // Buscar cliente existente por telefono
  const existingResult = await db.query(`
    SELECT id FROM customers
    WHERE phone LIKE $1 OR phone LIKE $2
    LIMIT 1
  `, [`%${cleanPhone}%`, `%${cleanPhone}%`])

  if (existingResult.rows.length > 0) {
    console.log('[WhatsApp Agent] Cliente existente encontrado:', existingResult.rows[0].id)
    return { customerId: existingResult.rows[0].id, isNew: false }
  }

  // Crear nuevo cliente
  const nameParts = (name || 'Cliente WhatsApp').split(' ')
  const firstName = nameParts[0] || 'Cliente'
  const lastName = nameParts.slice(1).join(' ') || 'WhatsApp'

  const insertResult = await db.query(`
    INSERT INTO customers (firstname, lastname, phone, address, createdat, updatedat)
    VALUES ($1, $2, $3, $4, NOW(), NOW())
    RETURNING id
  `, [firstName, lastName, phoneNumber, address || ''])

  console.log('[WhatsApp Agent] Nuevo cliente creado:', insertResult.rows[0].id)
  return { customerId: insertResult.rows[0].id, isNew: true }
}

/**
 * Crea una orden de recogida de paquetes
 */
async function createPickupOrder(data: Record<string, unknown>, phoneNumber: string): Promise<{
  success: boolean
  orderId?: number
  orderNumber?: string
  error?: string
}> {
  try {
    console.log('[WhatsApp Agent] ===== CREANDO ORDEN DE RECOGIDA =====')
    console.log('[WhatsApp Agent] Datos recibidos:', JSON.stringify(data, null, 2))

    // 1. Obtener o crear cliente
    const { customerId } = await getOrCreateCustomer(
      phoneNumber,
      String(data.senderName || 'Cliente'),
      String(data.senderAddress || '')
    )
    console.log('[WhatsApp Agent] Customer ID:', customerId)

    // 2. Generar numero de orden
    const orderNumber = await generateOrderNumber('PICKUP')
    console.log('[WhatsApp Agent] Order Number:', orderNumber)

    // 3. Preparar datos del destinatario en Cuba
    const officeOrderData = {
      senderName: data.senderName,
      senderPhone: data.senderPhone || phoneNumber,
      senderAddress: data.senderAddress,
      senderEntryInstructions: data.senderInstructions || null,
      receiverName: data.recipientName,
      receiverPhone: data.recipientPhone,
      destination: {
        provinceName: data.recipientProvince,
        municipalityName: data.recipientMunicipality,
        fullAddress: data.recipientAddress,
        country: 'Cuba'
      }
    }

    // 4. Preparar servicios (formato que espera el API)
    const services = [{
      name: 'Recogida a Domicilio',
      type: 'pickup',
      quantity: 1,
      unitPrice: 0,
      subtotal: 0
    }]

    // 5. Insertar orden con todos los campos requeridos
    const result = await db.query(`
      INSERT INTO package_orders (
        customerid,
        ordernumber,
        order_type,
        customername,
        firstname,
        lastname,
        phone,
        customeraddress,
        city,
        state,
        zipcode,
        country,
        services,
        notes,
        subtotal,
        taxamount,
        totalamount,
        scheduleddate,
        timeslot,
        paymentmethod,
        payment_status,
        status,
        office_order_data,
        createdby,
        createdat,
        updatedat
      ) VALUES (
        $1, $2, 'recogida', $3, $4, $5, $6, $7, $8, $9, $10, 'US',
        $11, $12, 0, 0, 0, NULL, '8:00 AM - 12:00 PM', 'cod', 'pending_payment', 'pending',
        $13, 'whatsapp-agent', NOW(), NOW()
      )
      RETURNING id, ordernumber
    `, [
      customerId,
      orderNumber,
      data.senderName || 'Cliente WhatsApp',
      String(data.senderName || '').split(' ')[0] || 'Cliente',
      String(data.senderName || '').split(' ').slice(1).join(' ') || '',
      phoneNumber,
      data.senderAddress || '',
      'Miami', // Default city
      'FL', // Default state
      '33186', // Default ZIP
      JSON.stringify(services),
      `Destinatario Cuba: ${data.recipientName} - ${data.recipientProvince}, ${data.recipientMunicipality}`,
      JSON.stringify(officeOrderData)
    ])

    console.log('[WhatsApp Agent] ===== ORDEN CREADA EXITOSAMENTE =====')
    console.log('[WhatsApp Agent] Order ID:', result.rows[0].id)
    console.log('[WhatsApp Agent] Order Number:', result.rows[0].ordernumber)

    return {
      success: true,
      orderId: result.rows[0].id,
      orderNumber: result.rows[0].ordernumber
    }
  } catch (error) {
    console.error('[WhatsApp Agent] ===== ERROR CREANDO ORDEN =====')
    console.error('[WhatsApp Agent] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Crea una orden de remesa/cupon familiar
 */
async function createRemittanceOrder(data: Record<string, unknown>, phoneNumber: string): Promise<{
  success: boolean
  orderId?: number
  orderNumber?: string
  totalAmount?: number
  error?: string
}> {
  try {
    // Generar numero de orden
    const year = new Date().getFullYear()
    const countResult = await db.query(`
      SELECT COUNT(*) + 1 as next_num
      FROM remittance_orders
      WHERE order_number LIKE $1
    `, [`REM-${year}-%`])

    const nextNum = countResult.rows[0]?.next_num || 1
    const orderNumber = `REM-${year}-${String(nextNum).padStart(6, '0')}`

    // Calcular montos
    const sendAmount = Number(data.amount) || 0
    const serviceFee = sendAmount * (REMITTANCE_FEE_PERCENTAGE / 100)
    const totalCharged = sendAmount + serviceFee

    // Insertar orden
    const result = await db.query(`
      INSERT INTO remittance_orders (
        order_number,
        send_amount,
        send_currency,
        receive_amount,
        receive_currency,
        exchange_rate,
        service_fee,
        service_fee_percentage,
        delivery_fee,
        total_charged,
        recipient_name,
        recipient_phone,
        recipient_province,
        recipient_municipality,
        recipient_address,
        sender_name,
        sender_phone,
        status,
        payment_status,
        estimated_delivery,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, 'USD', $2, 'USD', 1, $3, $4, 0, $5,
        $6, $7, $8, $9, $10, $11, $12,
        'pending', 'pending', '1-3 dias', NOW(), NOW()
      )
      RETURNING id, order_number
    `, [
      orderNumber,
      sendAmount,
      serviceFee,
      REMITTANCE_FEE_PERCENTAGE,
      totalCharged,
      data.recipientName,
      data.recipientPhone,
      data.province,
      data.municipality,
      data.address,
      data.senderName,
      data.senderPhone || phoneNumber
    ])

    return {
      success: true,
      orderId: result.rows[0].id,
      orderNumber: result.rows[0].order_number,
      totalAmount: totalCharged
    }
  } catch (error) {
    console.error('[WhatsApp Agent] Error creating remittance order:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Crea un link de pago para una orden
 */
async function createPaymentLink(
  orderType: string,
  orderId: number,
  orderNumber: string,
  amount: number,
  customerPhone: string,
  customerName: string
): Promise<string> {
  // Generar codigo unico
  const linkCode = generateLinkCode()

  // Calcular expiracion (24 horas)
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 24)

  // Insertar link
  await db.query(`
    INSERT INTO payment_links (
      link_code, order_type, order_id, order_number,
      amount, currency, status,
      customer_phone, customer_name, expires_at
    ) VALUES ($1, $2, $3, $4, $5, 'USD', 'pending', $6, $7, $8)
  `, [
    linkCode,
    orderType,
    orderId,
    orderNumber,
    amount,
    customerPhone,
    customerName,
    expiresAt
  ])

  const baseUrl = process.env.NEXT_PUBLIC_PAY_URL || 'https://pagos.logirapid.com'
  return `${baseUrl}/${linkCode}`
}

/**
 * Genera un codigo de link unico
 */
function generateLinkCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Procesa un mensaje entrante del cliente
 */
export async function handleIncomingMessage(
  phoneNumber: string,
  messageBody: string,
  messageSid?: string
): Promise<AgentResponse> {
  try {
    console.log('[WhatsApp Agent] ========== NUEVO MENSAJE ==========')
    console.log('[WhatsApp Agent] De:', phoneNumber)
    console.log('[WhatsApp Agent] Mensaje:', messageBody)

    // 1. Obtener o crear conversacion
    const conversation = await getOrCreateConversation(phoneNumber)
    console.log('[WhatsApp Agent] Conversacion ID:', conversation.id, 'Flow:', conversation.current_flow)
    console.log('[WhatsApp Agent] Datos previos:', JSON.stringify(conversation.collected_data))

    // 2. Guardar mensaje entrante
    await saveMessage(conversation.id, 'inbound', messageBody, messageSid)

    // 3. Agregar mensaje al historial
    const updatedHistory: ConversationMessage[] = [
      ...conversation.messages_history,
      { role: 'user', content: messageBody }
    ]

    // 4. Verificar si es primera interaccion
    if (conversation.current_flow === 'idle' && conversation.messages_history.length === 0) {
      console.log('[WhatsApp Agent] Primera interaccion - enviando saludo')
      const greeting = await generateGreeting(conversation.customer_name)

      updatedHistory.push({ role: 'assistant', content: greeting })

      await updateConversationState(
        conversation.id,
        'idle',
        null,
        {},
        updatedHistory
      )

      await saveMessage(conversation.id, 'outbound', greeting)

      return { message: greeting }
    }

    // 5. Procesar con GPT
    let gptResponse: GPTResponse
    try {
      console.log('[WhatsApp Agent] Procesando con GPT...')
      gptResponse = await processMessage(
        messageBody,
        updatedHistory,
        conversation.current_flow || undefined,
        conversation.collected_data
      )
      console.log('[WhatsApp Agent] GPT Response:', {
        intent: gptResponse.intent,
        extractedData: gptResponse.extractedData,
        readyToCreateOrder: gptResponse.readyToCreateOrder,
        flowComplete: gptResponse.flowComplete
      })
    } catch (error) {
      console.error('[WhatsApp Agent] GPT Error:', error)
      const errorMsg = getErrorMessage()
      await saveMessage(conversation.id, 'outbound', errorMsg)
      return { message: errorMsg }
    }

    // 6. Actualizar datos recopilados (ACUMULAR datos)
    const newCollectedData = {
      ...conversation.collected_data,
      ...(gptResponse.extractedData || {})
    }
    // Eliminar allDataComplete de los datos guardados
    delete newCollectedData.allDataComplete
    console.log('[WhatsApp Agent] Datos acumulados:', JSON.stringify(newCollectedData))

    // 7. Determinar nuevo flujo
    let newFlow = conversation.current_flow
    if (gptResponse.intent && conversation.current_flow === 'idle') {
      if (gptResponse.intent === 'pickup_order') {
        newFlow = 'pickup_order'
        console.log('[WhatsApp Agent] Nuevo flujo: pickup_order')
      } else if (gptResponse.intent === 'remittance_order') {
        newFlow = 'remittance_order'
        console.log('[WhatsApp Agent] Nuevo flujo: remittance_order')
      }
    }

    // 8. Si el flujo esta completo, crear orden
    let response = gptResponse.response
    let orderCreated = false
    let orderId: number | undefined
    let orderNumber: string | undefined
    let paymentLink: string | undefined

    if (gptResponse.readyToCreateOrder && newFlow) {
      console.log('[WhatsApp Agent] GPT dice readyToCreateOrder=true, validando datos...')

      if (newFlow === 'pickup_order') {
        // Validar datos antes de crear
        const validation = validatePickupData(newCollectedData)
        console.log('[WhatsApp Agent] Validacion pickup:', validation)

        if (validation.valid) {
          console.log('[WhatsApp Agent] Creando orden de recogida...')
          const result = await createPickupOrder(newCollectedData, phoneNumber)
          console.log('[WhatsApp Agent] Resultado createPickupOrder:', result)

          if (result.success) {
            orderCreated = true
            orderId = result.orderId
            orderNumber = result.orderNumber
            response = `Listo! Ya quedo registrado, tu numero de orden es ${orderNumber}. Te llamamos para coordinar la recogida ok?`
            await resetConversation(conversation.id)
          } else {
            console.error('[WhatsApp Agent] Error creando orden:', result.error)
            response = 'Uy perdon, se me trabo el sistema. Puedes decirme los datos otra vez?'
          }
        } else {
          console.log('[WhatsApp Agent] Datos incompletos, faltan:', validation.missing)
          // No crear orden, seguir recopilando
        }
      } else if (newFlow === 'remittance_order') {
        // Validar datos antes de crear
        const validation = validateRemittanceData(newCollectedData)
        console.log('[WhatsApp Agent] Validacion remesa:', validation)

        if (validation.valid) {
          console.log('[WhatsApp Agent] Creando orden de remesa...')
          const result = await createRemittanceOrder(newCollectedData, phoneNumber)
          console.log('[WhatsApp Agent] Resultado createRemittanceOrder:', result)

          if (result.success && result.orderId && result.orderNumber && result.totalAmount) {
            orderCreated = true
            orderId = result.orderId
            orderNumber = result.orderNumber

            // Crear link de pago
            paymentLink = await createPaymentLink(
              'remittance',
              result.orderId,
              result.orderNumber,
              result.totalAmount,
              phoneNumber,
              String(newCollectedData.senderName || '')
            )
            console.log('[WhatsApp Agent] Payment link creado:', paymentLink)

            response = `Perfecto! Ya quedo tu orden ${orderNumber}. El total con la comision es $${result.totalAmount.toFixed(2)}\n\nPaga por aqui: ${paymentLink}\n\nCuando pagues te aviso y se lo llevamos a tu familia`
            await resetConversation(conversation.id)
          } else {
            console.error('[WhatsApp Agent] Error creando remesa:', result.error)
            response = 'Uy perdon, se me trabo. Puedes decirme los datos otra vez?'
          }
        } else {
          console.log('[WhatsApp Agent] Datos remesa incompletos, faltan:', validation.missing)
        }
      }
    } else {
      // Actualizar estado de conversacion
      updatedHistory.push({ role: 'assistant', content: response })

      await updateConversationState(
        conversation.id,
        newFlow,
        null,
        newCollectedData,
        updatedHistory
      )
    }

    // 9. Guardar mensaje de respuesta
    await saveMessage(
      conversation.id,
      'outbound',
      response,
      undefined,
      gptResponse.intent,
      gptResponse.extractedData
    )

    return {
      message: response,
      orderCreated,
      orderId,
      orderNumber,
      paymentLink
    }
  } catch (error) {
    console.error('[WhatsApp Agent] Error handling message:', error)
    return { message: getErrorMessage() }
  }
}

/**
 * Envia respuesta por WhatsApp
 */
export async function sendResponse(phoneNumber: string, message: string): Promise<boolean> {
  try {
    // Limpiar numero de telefono (remover prefijo whatsapp: si existe)
    const cleanPhone = phoneNumber.replace('whatsapp:', '')

    const result = await sendWhatsApp(cleanPhone, message)
    return result.success
  } catch (error) {
    console.error('[WhatsApp Agent] Error sending response:', error)
    return false
  }
}
