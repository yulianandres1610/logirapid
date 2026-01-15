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
  'senderIdType',        // Tipo de ID (Pasaporte, Licencia, etc.)
  'senderIdNumber',      // Numero de ID
  'senderAddress',
  'senderEntryPin',      // PIN de entrada (puede ser "NO")
  'recipientName',
  'recipientPhone',
  'recipientCI',         // Carnet de Identidad Cuba (11 digitos)
  'recipientProvince',
  'recipientMunicipality',
  'recipientStreet'      // Calle y numero en Cuba
]

const REMITTANCE_REQUIRED_FIELDS = [
  'amount',
  'senderName',
  'recipientName',
  'recipientPhone',
  'province',
  'municipality',
  'address'
]

/**
 * Valida el formato del Carnet de Identidad de Cuba
 * Debe tener exactamente 11 digitos
 */
function validateCubanCI(ci: string): boolean {
  if (!ci) return false
  const cleanCI = ci.replace(/\D/g, '')
  return cleanCI.length === 11
}

/**
 * Valida si los datos de recogida estan completos
 */
function validatePickupData(data: Record<string, unknown>): { valid: boolean; missing: string[]; errors: string[] } {
  const missing: string[] = []
  const errors: string[] = []

  for (const field of PICKUP_REQUIRED_FIELDS) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].toString().trim() === '')) {
      missing.push(field)
    }
  }

  // Validar CI de Cuba si esta presente
  if (data.recipientCI && !validateCubanCI(String(data.recipientCI))) {
    errors.push('El Carnet de Identidad debe tener 11 digitos')
  }

  return { valid: missing.length === 0 && errors.length === 0, missing, errors }
}

/**
 * Valida si los datos de remesa estan completos
 */
function validateRemittanceData(data: Record<string, unknown>): { valid: boolean; missing: string[]; errors: string[] } {
  const missing: string[] = []
  const errors: string[] = []

  for (const field of REMITTANCE_REQUIRED_FIELDS) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].toString().trim() === '')) {
      missing.push(field)
    }
  }

  return { valid: missing.length === 0 && errors.length === 0, missing, errors }
}

/**
 * Interface para datos de cliente con direcciones
 */
interface CustomerSearchResult {
  found: boolean
  id?: number
  name?: string
  phone?: string
  idType?: string
  idNumber?: string
  addresses?: Array<{
    id: number
    address: string
    city?: string
    state?: string
    zipcode?: string
    entryPin?: string
    isDefault?: boolean
  }>
}

/**
 * Interface para datos de destinatario Cuba
 */
interface RecipientSearchResult {
  found: boolean
  id?: number
  name?: string
  phone?: string
  ci?: string
  addresses?: Array<{
    province: string
    municipality: string
    street: string
    reparto?: string
    instructions?: string
  }>
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
 * Busca un remitente (sender) por telefono con sus datos y direcciones guardadas
 */
async function searchSenderByPhone(phoneNumber: string): Promise<CustomerSearchResult> {
  const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10)
  console.log('[WhatsApp Agent] Buscando sender por telefono:', cleanPhone)

  // Buscar en customers con direcciones
  const customerResult = await db.query(`
    SELECT
      c.id, c.firstname, c.lastname, c.phone,
      c.idtype, c.idnumber, c.entry_pin as customer_entry_pin,
      ca.id as address_id, ca.street, ca.city, ca.state, ca.zipcode,
      ca.isprimary
    FROM customers c
    LEFT JOIN customer_addresses ca ON ca.customerid = c.id
    WHERE c.phone LIKE $1
    ORDER BY ca.isprimary DESC NULLS LAST, ca.id DESC
  `, [`%${cleanPhone}%`])

  if (customerResult.rows.length > 0) {
    const first = customerResult.rows[0]
    const addresses = customerResult.rows
      .filter(r => r.address_id)
      .map(r => ({
        id: r.address_id,
        address: `${r.street || ''}, ${r.city || ''}, ${r.state || ''} ${r.zipcode || ''}`.trim(),
        city: r.city,
        state: r.state,
        zipcode: r.zipcode,
        entryPin: first.customer_entry_pin, // Usar entry_pin del customer
        isDefault: r.isprimary
      }))

    return {
      found: true,
      id: first.id,
      name: `${first.firstname || ''} ${first.lastname || ''}`.trim(),
      phone: first.phone,
      idType: first.idtype,
      idNumber: first.idnumber,
      addresses
    }
  }

  // Buscar en ordenes anteriores
  const orderResult = await db.query(`
    SELECT
      customername, phone, customeraddress, city, state, zipcode,
      office_order_data
    FROM package_orders
    WHERE phone LIKE $1
    ORDER BY createdat DESC
    LIMIT 1
  `, [`%${cleanPhone}%`])

  if (orderResult.rows.length > 0) {
    const order = orderResult.rows[0]
    const officeData = order.office_order_data || {}

    return {
      found: true,
      name: order.customername,
      phone: order.phone,
      idType: officeData.senderIdType,
      idNumber: officeData.senderIdNumber,
      addresses: order.customeraddress ? [{
        id: 0,
        address: `${order.customeraddress}, ${order.city || ''}, ${order.state || ''} ${order.zipcode || ''}`,
        city: order.city,
        state: order.state,
        zipcode: order.zipcode,
        entryPin: officeData.senderEntryPin
      }] : []
    }
  }

  return { found: false }
}

/**
 * Busca un destinatario en Cuba por telefono
 */
async function searchRecipientByPhone(phoneNumber: string): Promise<RecipientSearchResult> {
  const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-8) // Telefonos cubanos 8 digitos
  console.log('[WhatsApp Agent] Buscando destinatario Cuba por telefono:', cleanPhone)

  // Buscar en ordenes anteriores
  const orderResult = await db.query(`
    SELECT
      office_order_data
    FROM package_orders
    WHERE office_order_data IS NOT NULL
      AND office_order_data::text LIKE $1
    ORDER BY createdat DESC
    LIMIT 5
  `, [`%${cleanPhone}%`])

  if (orderResult.rows.length > 0) {
    // Buscar en los datos del destinatario
    for (const row of orderResult.rows) {
      const data = row.office_order_data
      if (data && data.receiverPhone && data.receiverPhone.includes(cleanPhone)) {
        return {
          found: true,
          name: data.receiverName,
          phone: data.receiverPhone,
          ci: data.receiverCI,
          addresses: data.destination ? [{
            province: data.destination.provinceName,
            municipality: data.destination.municipalityName,
            street: data.destination.street,
            reparto: data.destination.reparto,
            instructions: data.destination.deliveryInstructions
          }] : []
        }
      }
    }
  }

  // Buscar en remesas
  const remitResult = await db.query(`
    SELECT
      recipient_name, recipient_phone,
      recipient_province, recipient_municipality, recipient_address
    FROM remittance_orders
    WHERE recipient_phone LIKE $1
    ORDER BY created_at DESC
    LIMIT 1
  `, [`%${cleanPhone}%`])

  if (remitResult.rows.length > 0) {
    const r = remitResult.rows[0]
    return {
      found: true,
      name: r.recipient_name,
      phone: r.recipient_phone,
      addresses: [{
        province: r.recipient_province,
        municipality: r.recipient_municipality,
        street: r.recipient_address,
      }]
    }
  }

  return { found: false }
}

/**
 * Genera un resumen de los datos recopilados para mostrar al cliente
 */
function generateDataSummary(data: Record<string, unknown>, flowType: string): string {
  if (flowType === 'pickup_order') {
    const lines = [
      'Ok, confirma los datos:',
      '',
      'REMITENTE:',
      `- ${data.senderName || 'Sin nombre'}`,
      `- ${data.senderIdType || 'ID'}: ${data.senderIdNumber || 'Sin numero'}`,
      `- ${data.senderAddress || 'Sin direccion'}`,
      `- PIN: ${data.senderEntryPin || 'NO'}`,
      '',
      'DESTINATARIO CUBA:',
      `- ${data.recipientName || 'Sin nombre'}`,
      `- CI: ${data.recipientCI || 'Sin CI'}`,
      `- ${data.recipientStreet || ''}, ${data.recipientReparto || ''}`,
      `- ${data.recipientMunicipality || ''}, ${data.recipientProvince || ''}`,
      `- Tel: ${data.recipientPhone || 'Sin telefono'}`,
      '',
      'Todo correcto?'
    ]
    return lines.join('\n')
  }

  if (flowType === 'remittance_order') {
    const amount = Number(data.amount) || 0
    const fee = amount * 0.05
    const total = amount + fee

    const lines = [
      'Ok, confirma los datos:',
      '',
      `Monto: $${amount.toFixed(2)} USD`,
      `Comision: $${fee.toFixed(2)}`,
      `Total: $${total.toFixed(2)}`,
      '',
      'BENEFICIARIO:',
      `- ${data.recipientName || 'Sin nombre'}`,
      `- ${data.province || ''}, ${data.municipality || ''}`,
      `- ${data.address || 'Sin direccion'}`,
      `- Tel: ${data.recipientPhone || 'Sin telefono'}`,
      '',
      'Todo correcto?'
    ]
    return lines.join('\n')
  }

  return 'Datos incompletos'
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

    // 3. Preparar datos completos de la orden
    const officeOrderData = {
      // Datos del remitente (USA)
      senderName: data.senderName,
      senderPhone: data.senderPhone || phoneNumber,
      senderIdType: data.senderIdType || '',
      senderIdNumber: data.senderIdNumber || '',
      senderAddress: data.senderAddress,
      senderEntryPin: data.senderEntryPin || 'NO',
      senderEntryInstructions: data.senderInstructions || null,
      // Datos del destinatario (Cuba)
      receiverName: data.recipientName,
      receiverPhone: data.recipientPhone,
      receiverCI: data.recipientCI || '',
      destination: {
        provinceName: data.recipientProvince,
        municipalityName: data.recipientMunicipality,
        street: data.recipientStreet,
        reparto: data.recipientReparto || '',
        deliveryInstructions: data.recipientInstructions || '',
        fullAddress: `${data.recipientStreet || ''}, ${data.recipientReparto || ''}, ${data.recipientMunicipality}, ${data.recipientProvince}`,
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
      `ID: ${data.senderIdType} ${data.senderIdNumber} | PIN: ${data.senderEntryPin || 'NO'} | Cuba: ${data.recipientName} (CI: ${data.recipientCI}) - ${data.recipientStreet}, ${data.recipientMunicipality}, ${data.recipientProvince} | Tel: ${data.recipientPhone}`,
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

    // 4. Verificar si es primera interaccion CON saludo simple
    // Solo si el mensaje es un saludo simple (Hola, Hi, etc) sin intención específica
    const simpleGreetings = ['hola', 'hi', 'hello', 'buenos dias', 'buenas tardes', 'buenas noches', 'hey', 'buenas']
    const isSimpleGreeting = simpleGreetings.some(g => messageBody.toLowerCase().trim() === g)

    if (conversation.current_flow === 'idle' && conversation.messages_history.length === 0 && isSimpleGreeting) {
      console.log('[WhatsApp Agent] Primera interaccion con saludo simple')
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

    // 8. Manejar busquedas de cliente si GPT lo solicita
    let response = gptResponse.response

    // Buscar remitente por telefono
    if (gptResponse.searchSender) {
      console.log('[WhatsApp Agent] Buscando sender por telefono:', gptResponse.searchSender)
      const senderResult = await searchSenderByPhone(gptResponse.searchSender)

      if (senderResult.found) {
        // Cliente encontrado - cargar sus datos
        newCollectedData.senderName = senderResult.name
        newCollectedData.senderPhone = senderResult.phone || gptResponse.searchSender
        if (senderResult.idType) newCollectedData.senderIdType = senderResult.idType
        if (senderResult.idNumber) newCollectedData.senderIdNumber = senderResult.idNumber

        // Construir respuesta con datos encontrados
        let foundMsg = `Te encontre! Eres ${senderResult.name}.`
        if (senderResult.addresses && senderResult.addresses.length > 0) {
          foundMsg += ` Tienes esta direccion guardada: ${senderResult.addresses[0].address}`
          if (senderResult.addresses[0].entryPin) {
            foundMsg += ` (PIN: ${senderResult.addresses[0].entryPin})`
          }
          foundMsg += `. La usamos?`
          // Guardar direccion temporalmente
          newCollectedData._pendingAddress = senderResult.addresses[0]
        } else {
          foundMsg += ` Dame tu direccion de recogida.`
        }
        response = foundMsg
      } else {
        // Cliente no encontrado
        newCollectedData.senderPhone = gptResponse.searchSender
        response = 'No te tengo en el sistema. Como te llamas?'
      }
    }

    // Buscar destinatario Cuba por telefono
    if (gptResponse.searchRecipient) {
      console.log('[WhatsApp Agent] Buscando recipient Cuba:', gptResponse.searchRecipient)
      const recipientResult = await searchRecipientByPhone(gptResponse.searchRecipient)

      if (recipientResult.found) {
        // Destinatario encontrado
        newCollectedData.recipientName = recipientResult.name
        newCollectedData.recipientPhone = recipientResult.phone || gptResponse.searchRecipient
        if (recipientResult.ci) newCollectedData.recipientCI = recipientResult.ci

        let foundMsg = `Encontre a ${recipientResult.name}.`
        if (recipientResult.addresses && recipientResult.addresses.length > 0) {
          const addr = recipientResult.addresses[0]
          foundMsg += ` Direccion: ${addr.street || ''}, ${addr.municipality || ''}, ${addr.province || ''}.`
          newCollectedData.recipientProvince = addr.province
          newCollectedData.recipientMunicipality = addr.municipality
          newCollectedData.recipientStreet = addr.street
          if (addr.reparto) newCollectedData.recipientReparto = addr.reparto
          foundMsg += ` La usamos?`
        } else {
          foundMsg += ` Pero no tengo su direccion. En que provincia esta?`
        }
        response = foundMsg
      } else {
        // Destinatario no encontrado
        newCollectedData.recipientPhone = gptResponse.searchRecipient
        response = 'No lo tengo registrado. Como se llama la persona que recibe?'
      }
    }

    // Detectar si el usuario confirma usar datos existentes
    const confirmWords = ['si', 'sí', 'ok', 'yes', 'correcto', 'esa', 'eso', 'dale', 'bien', 'perfecto']
    const userConfirms = confirmWords.some(w => messageBody.toLowerCase().includes(w))

    // Si hay direccion pendiente y usuario confirma, aplicarla
    if (newCollectedData._pendingAddress && userConfirms) {
      const addr = newCollectedData._pendingAddress as { address: string; city?: string; state?: string; zipcode?: string; entryPin?: string }
      newCollectedData.senderAddress = addr.address
      if (addr.entryPin) newCollectedData.senderEntryPin = addr.entryPin
      delete newCollectedData._pendingAddress
      console.log('[WhatsApp Agent] Direccion confirmada:', addr.address)
    }

    // Mostrar resumen si GPT lo solicita O si tenemos todos los datos
    if (gptResponse.requestSummary && newFlow) {
      const validation = newFlow === 'pickup_order'
        ? validatePickupData(newCollectedData)
        : validateRemittanceData(newCollectedData)

      if (validation.valid) {
        console.log('[WhatsApp Agent] Mostrando resumen con datos reales')
        response = generateDataSummary(newCollectedData, newFlow)
      } else {
        console.log('[WhatsApp Agent] Faltan datos para resumen:', validation.missing)
        // Pedir el primer dato faltante
        const fieldNames: Record<string, string> = {
          senderName: 'tu nombre completo',
          senderIdType: 'el tipo de ID (Pasaporte, Licencia o ID)',
          senderIdNumber: 'el numero del ID',
          senderAddress: 'la direccion de recogida',
          senderEntryPin: 'si hay PIN o codigo para entrar',
          recipientName: 'el nombre de quien recibe en Cuba',
          recipientPhone: 'el telefono del destinatario en Cuba',
          recipientCI: 'el carnet de identidad (11 digitos)',
          recipientProvince: 'la provincia en Cuba',
          recipientMunicipality: 'el municipio',
          recipientStreet: 'la calle y numero en Cuba'
        }
        const firstMissing = validation.missing[0]
        response = `Me falta ${fieldNames[firstMissing] || firstMissing}. Cual es?`
      }
    }

    // 9. Si el flujo esta completo, crear orden
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
