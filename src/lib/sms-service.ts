/**
 * SMS Service - Twilio Integration
 *
 * Servicio para enviar mensajes SMS usando Twilio
 * Usado para notificaciones de ordenes a clientes
 */

// Dynamic import to avoid build-time initialization
// Twilio SDK requires credentials at import time in some cases
let twilioClient: any = null
let twilioModule: any = null

async function getClient(): Promise<any> {
  // Always read env vars fresh in case they were loaded after module init
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN')
  }

  // Dynamically import twilio only when needed (not at build time)
  if (!twilioModule) {
    twilioModule = (await import('twilio')).default
  }

  // Create new client if not exists
  if (!twilioClient) {
    twilioClient = twilioModule(accountSid, authToken)
  }
  return twilioClient
}

/**
 * Formatea un numero de telefono para asegurar formato E.164
 * Acepta formatos: 1234567890, +11234567890, (123) 456-7890
 */
export function formatPhoneNumber(phone: string): string {
  // Remover todo excepto digitos
  const digits = phone.replace(/\D/g, '')

  // Si tiene 10 digitos, agregar codigo de pais US
  if (digits.length === 10) {
    return `+1${digits}`
  }

  // Si tiene 11 digitos y empieza con 1, agregar +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }

  // Si ya tiene el formato correcto
  if (digits.length > 10) {
    return `+${digits}`
  }

  // Retornar como esta si no se puede formatear
  return phone
}

/**
 * Valida que un numero de telefono sea valido para SMS
 */
export function isValidPhoneNumber(phone: string): boolean {
  const formatted = formatPhoneNumber(phone)
  // Validar formato E.164 basico
  return /^\+1\d{10}$/.test(formatted)
}

/**
 * Resultado del envio de SMS
 */
export interface SMSResult {
  success: boolean
  messageId?: string
  error?: string
  to?: string
}

/**
 * Envia un SMS usando Twilio
 */
export async function sendSMS(to: string, message: string): Promise<SMSResult> {
  try {
    // Debug: log current env vars status
    console.log('[SMS Service] Environment check:', {
      hasSid: !!process.env.TWILIO_ACCOUNT_SID,
      hasToken: !!process.env.TWILIO_AUTH_TOKEN,
      hasPhone: !!process.env.TWILIO_PHONE_NUMBER,
      phoneValue: process.env.TWILIO_PHONE_NUMBER ? process.env.TWILIO_PHONE_NUMBER.substring(0, 5) + '...' : 'NOT SET',
      to: to
    })

    // Validar configuracion
    if (!process.env.TWILIO_PHONE_NUMBER) {
      console.error('[SMS Service] TWILIO_PHONE_NUMBER not configured')
      return {
        success: false,
        error: 'SMS service not configured'
      }
    }

    // Formatear y validar numero destino
    const formattedTo = formatPhoneNumber(to)

    if (!isValidPhoneNumber(formattedTo)) {
      console.warn(`[SMS Service] Invalid phone number: ${to}`)
      return {
        success: false,
        error: `Invalid phone number: ${to}`,
        to: formattedTo
      }
    }

    // Obtener cliente de Twilio
    const client = await getClient()

    // Enviar mensaje
    console.log(`[SMS Service] Sending SMS to ${formattedTo}`)

    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedTo
    })

    console.log(`[SMS Service] SMS sent successfully. SID: ${result.sid}`)

    return {
      success: true,
      messageId: result.sid,
      to: formattedTo
    }

  } catch (error: any) {
    console.error('[SMS Service] Error sending SMS:', error)

    return {
      success: false,
      error: error.message || 'Unknown error sending SMS',
      to
    }
  }
}

/**
 * Convierte el codigo de timeSlot a texto legible
 */
function formatTimeSlot(timeSlot: string | null | undefined): string {
  if (!timeSlot) return ''

  const timeSlotMap: { [key: string]: string } = {
    'morning': '8:00 AM - 12:00 PM',
    'afternoon': '12:00 PM - 5:00 PM',
    'evening': '5:00 PM - 8:00 PM',
    'all_day': '8:00 AM - 8:00 PM'
  }

  return timeSlotMap[timeSlot] || timeSlot
}

/**
 * Genera el mensaje de confirmacion de orden creada
 */
export function generateOrderCreatedMessage(
  companyName: string,
  orderNumber: string,
  scheduledDate: string,
  timeSlot?: string | null,
  customerServicePhone?: string | null
): string {
  // Formatear fecha en espanol
  let formattedDate = scheduledDate
  try {
    const date = new Date(scheduledDate)
    formattedDate = date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch (e) {
    // Si falla el formateo, usar la fecha original
  }

  // Agregar horario si existe
  const formattedTime = formatTimeSlot(timeSlot)
  const timeInfo = formattedTime ? ` entre ${formattedTime}` : ''

  // Construir mensaje con teléfono de atención al cliente si existe
  const contactInfo = customerServicePhone
    ? `Para cualquier consulta puede llamarnos al ${customerServicePhone}.`
    : ''

  return `Gracias por confiar en ${companyName}! Su numero de orden: ${orderNumber}. Un driver pasara por su direccion el ${formattedDate}${timeInfo}. ${contactInfo} Para ayuda: HELP | Cancelar SMS: STOP`
}

/**
 * Genera el mensaje de WhatsApp para confirmación de orden
 * Formato más visual con emojis y saltos de línea
 */
export function generateWhatsAppOrderMessage(
  companyName: string,
  orderNumber: string,
  scheduledDate: string,
  customerName?: string | null,
  address?: string | null,
  timeSlot?: string | null,
  customerServicePhone?: string | null
): string {
  // Formatear fecha en español
  let formattedDate = scheduledDate
  try {
    const date = new Date(scheduledDate)
    formattedDate = date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch (e) {
    // Si falla el formateo, usar la fecha original
  }

  // Formatear horario
  const formattedTime = formatTimeSlot(timeSlot)
  const timeInfo = formattedTime ? `🕐 *Horario:* ${formattedTime}` : ''

  // Construir mensaje con formato WhatsApp
  let message = `✅ *Confirmación de Orden*\n\n`
  message += `¡Gracias por confiar en *${companyName}*!\n\n`
  message += `📦 *Número de orden:* ${orderNumber}\n`

  if (customerName) {
    message += `👤 *Cliente:* ${customerName}\n`
  }

  message += `📅 *Fecha de entrega:* ${formattedDate}\n`

  if (timeInfo) {
    message += `${timeInfo}\n`
  }

  if (address) {
    message += `📍 *Dirección:* ${address}\n`
  }

  message += `\n🚚 Un driver pasará por su dirección en la fecha indicada.\n`

  if (customerServicePhone) {
    message += `\n📞 *Atención al cliente:* ${customerServicePhone}\n`
    message += `Para cualquier consulta puede llamarnos.\n`
  }

  message += `\n¡Gracias por su preferencia! 🙏`

  return message
}

/**
 * Envia SMS de confirmacion cuando se crea una orden
 */
export async function sendOrderCreatedSMS(
  customerPhone: string,
  companyName: string,
  orderNumber: string,
  scheduledDate: string,
  timeSlot?: string | null,
  customerServicePhone?: string | null
): Promise<SMSResult> {
  const message = generateOrderCreatedMessage(companyName, orderNumber, scheduledDate, timeSlot, customerServicePhone)
  return sendSMS(customerPhone, message)
}

/**
 * Formatea fecha en español para WhatsApp
 */
function formatDateSpanish(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch {
    return dateString
  }
}

/**
 * Envía mensaje WhatsApp de confirmación de orden usando Content Template
 * Usa el template aprobado por Meta/WhatsApp con ContentSid
 */
// ==========================================
// WALLET SMS NOTIFICATIONS
// ==========================================

/**
 * SMS notification types for wallet transactions
 */
export type WalletSMSType = 'recharge' | 'commission' | 'transfer_in' | 'transfer_out' | 'debit'

/**
 * Generates wallet recharge notification message
 */
export function generateWalletRechargeMessage(
  ownerName: string,
  amount: number,
  newBalance: number,
  paymentMethod: string,
  transactionNumber?: string
): string {
  const methodText = paymentMethod === 'card_manual' ? 'tarjeta' :
    paymentMethod === 'terminal' ? 'terminal' :
    paymentMethod === 'cash' ? 'efectivo' : paymentMethod

  const txnInfo = transactionNumber ? ` Ref: ${transactionNumber}.` : ''
  return `${ownerName}: Su billetera ha sido recargada con $${amount.toFixed(2)} mediante ${methodText}.${txnInfo} Nuevo balance: $${newBalance.toFixed(2)}. Para ayuda: HELP | Cancelar SMS: STOP`
}

/**
 * Generates commission notification message
 */
export function generateCommissionMessage(
  ownerName: string,
  amount: number,
  newBalance: number,
  description?: string,
  transactionNumber?: string
): string {
  const txnInfo = transactionNumber ? ` Ref: ${transactionNumber}.` : ''
  return `LogiRapid: Se ha agregado una comision de $${amount.toFixed(2)} a su billetera. ${description ? `Concepto: ${description}. ` : ''}${txnInfo} Nuevo balance: $${newBalance.toFixed(2)}. Para ayuda: HELP | Cancelar SMS: STOP`
}

/**
 * Generates transfer received notification message
 */
export function generateTransferInMessage(
  ownerName: string,
  amount: number,
  newBalance: number,
  senderName: string,
  transactionNumber?: string
): string {
  const txnInfo = transactionNumber ? ` Ref: ${transactionNumber}.` : ''
  return `LogiRapid: Ha recibido una transferencia de $${amount.toFixed(2)} de ${senderName}.${txnInfo} Nuevo balance: $${newBalance.toFixed(2)}. Para ayuda: HELP | Cancelar SMS: STOP`
}

/**
 * Generates transfer sent notification message
 */
export function generateTransferOutMessage(
  ownerName: string,
  amount: number,
  newBalance: number,
  recipientName: string,
  transactionNumber?: string
): string {
  const txnInfo = transactionNumber ? ` Ref: ${transactionNumber}.` : ''
  return `LogiRapid: Se ha transferido $${amount.toFixed(2)} a ${recipientName} desde su billetera.${txnInfo} Nuevo balance: $${newBalance.toFixed(2)}. Para ayuda: HELP | Cancelar SMS: STOP`
}

/**
 * Generates wallet debit notification message
 */
export function generateWalletDebitMessage(
  ownerName: string,
  amount: number,
  newBalance: number,
  description?: string,
  transactionNumber?: string
): string {
  const txnInfo = transactionNumber ? ` Ref: ${transactionNumber}.` : ''
  return `LogiRapid: Se ha debitado $${amount.toFixed(2)} de su billetera. ${description ? `Concepto: ${description}. ` : ''}${txnInfo} Nuevo balance: $${newBalance.toFixed(2)}. Para ayuda: HELP | Cancelar SMS: STOP`
}

/**
 * Send wallet notification SMS
 * Generic function to send any wallet-related SMS
 */
export async function sendWalletNotificationSMS(
  phone: string,
  type: WalletSMSType,
  ownerName: string,
  amount: number,
  newBalance: number,
  options?: {
    paymentMethod?: string
    description?: string
    otherPartyName?: string
    transactionNumber?: string
  }
): Promise<SMSResult> {
  let message: string
  const txn = options?.transactionNumber

  switch (type) {
    case 'recharge':
      message = generateWalletRechargeMessage(ownerName, amount, newBalance, options?.paymentMethod || 'recarga', txn)
      break
    case 'commission':
      message = generateCommissionMessage(ownerName, amount, newBalance, options?.description, txn)
      break
    case 'transfer_in':
      message = generateTransferInMessage(ownerName, amount, newBalance, options?.otherPartyName || 'otra cuenta', txn)
      break
    case 'transfer_out':
      message = generateTransferOutMessage(ownerName, amount, newBalance, options?.otherPartyName || 'otra cuenta', txn)
      break
    case 'debit':
      message = generateWalletDebitMessage(ownerName, amount, newBalance, options?.description, txn)
      break
    default:
      message = `LogiRapid: Su billetera ha sido actualizada.${txn ? ` Ref: ${txn}.` : ''} Nuevo balance: $${newBalance.toFixed(2)}. Para ayuda: HELP | Cancelar SMS: STOP`
  }

  return sendSMS(phone, message)
}

export async function sendWhatsAppOrderConfirmation(
  customerPhone: string,
  customerName: string,
  companyName: string,
  orderNumber: string,
  scheduledDate: string,
  timeSlot: string | null | undefined,
  address: string,
  customerServicePhone: string | null | undefined
): Promise<SMSResult> {
  try {
    const contentSid = process.env.TWILIO_CONTENT_SID_ORDER_CREATED
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER
    const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER ||
      (twilioPhone ? `whatsapp:${twilioPhone}` : null)

    if (!contentSid) {
      console.error('[WhatsApp Service] TWILIO_CONTENT_SID_ORDER_CREATED not configured')
      return {
        success: false,
        error: 'WhatsApp Content Template not configured'
      }
    }

    if (!whatsappNumber) {
      console.error('[WhatsApp Service] WhatsApp number not configured')
      return {
        success: false,
        error: 'WhatsApp number not configured'
      }
    }

    // Formatear y validar número destino
    const formattedPhone = formatPhoneNumber(customerPhone)

    if (!isValidPhoneNumber(formattedPhone)) {
      console.warn(`[WhatsApp Service] Invalid phone number: ${customerPhone}`)
      return {
        success: false,
        error: `Invalid phone number: ${customerPhone}`,
        to: formattedPhone
      }
    }

    // Obtener cliente de Twilio
    const client = await getClient()

    // Formatear datos para el template
    const formattedDate = formatDateSpanish(scheduledDate)
    const formattedTime = formatTimeSlot(timeSlot) || 'A coordinar'
    const formattedAddress = address || 'Por confirmar'
    const formattedServicePhone = customerServicePhone || 'No disponible'

    // Función para sanitizar variables - eliminar newlines, tabs y espacios múltiples
    const sanitize = (value: string | null | undefined, defaultVal: string): string => {
      if (!value) return defaultVal
      return String(value)
        .replace(/[\n\r\t]/g, ' ')  // Reemplazar newlines y tabs por espacios
        .replace(/\s{4,}/g, '   ')  // Reducir 4+ espacios a 3
        .trim() || defaultVal
    }

    // Preparar variables del template - asegurar que todas sean strings válidos y sanitizados
    const contentVars = {
      "1": sanitize(customerName, 'Cliente'),
      "2": sanitize(companyName, 'LogiRapid'),
      "3": sanitize(orderNumber, 'N/A'),
      "4": sanitize(formattedDate, 'Por confirmar'),
      "5": sanitize(formattedTime, 'A coordinar'),
      "6": sanitize(formattedAddress, 'Por confirmar'),
      "7": sanitize(formattedServicePhone, 'No disponible')
    }

    console.log(`[WhatsApp Service] Sending WhatsApp to ${formattedPhone}`)
    console.log(`[WhatsApp Service] Using ContentSid: ${contentSid}`)
    console.log(`[WhatsApp Service] Content Variables:`, JSON.stringify(contentVars, null, 2))

    // Enviar mensaje usando Content Template
    // Variables: 1=nombre, 2=empresa, 3=orden, 4=fecha, 5=horario, 6=dirección, 7=teléfono
    const result = await client.messages.create({
      contentSid,
      contentVariables: JSON.stringify(contentVars),
      from: whatsappNumber.startsWith('whatsapp:') ? whatsappNumber : `whatsapp:${whatsappNumber}`,
      to: `whatsapp:${formattedPhone}`
    })

    console.log(`[WhatsApp Service] WhatsApp sent successfully. SID: ${result.sid}`)

    return {
      success: true,
      messageId: result.sid,
      to: formattedPhone
    }

  } catch (error: any) {
    console.error('[WhatsApp Service] Error sending WhatsApp:', error)

    return {
      success: false,
      error: error.message || 'Unknown error sending WhatsApp',
      to: customerPhone
    }
  }
}

// ==========================================
// OTP SYSTEM FOR CASH DELIVERY VERIFICATION
// ==========================================

/**
 * Generates a 6-digit OTP code
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * OTP expiration time in minutes
 */
export const OTP_EXPIRATION_MINUTES = 5

/**
 * Maximum OTP attempts before blocking
 */
export const OTP_MAX_ATTEMPTS = 3

/**
 * Maximum OTP resends per order
 */
export const OTP_MAX_RESENDS = 3

/**
 * Generates OTP message for cash delivery verification
 */
export function generateCashDeliveryOTPMessage(
  otpCode: string,
  amount: string,
  currency: string,
  brokerName: string
): string {
  return `LogiRapid: Tu codigo de verificacion es ${otpCode}. Entregalo al broker "${brokerName}" para confirmar la recepcion de ${currency} ${amount}. Valido por ${OTP_EXPIRATION_MINUTES} minutos. Para ayuda: HELP | Cancelar SMS: STOP`
}

/**
 * Generates message when cash delivery order is created (for delivery person)
 */
export function generateCashDeliveryAssignedMessage(
  orderNumber: string,
  amount: string,
  currency: string,
  brokerName: string,
  brokerProvince: string,
  deadlineDate: string
): string {
  return `LogiRapid: Se te ha asignado la entrega ${orderNumber}. Monto: ${currency} ${amount} para broker "${brokerName}" en ${brokerProvince}. Fecha limite: ${deadlineDate}. Para ayuda: HELP | Cancelar SMS: STOP`
}

/**
 * Generates message when cash delivery order is created (for broker)
 */
export function generateCashDeliveryPendingMessage(
  orderNumber: string,
  amount: string,
  currency: string,
  deliveryPersonName: string,
  deadlineDate: string
): string {
  return `LogiRapid: Tienes una entrega de efectivo pendiente (${orderNumber}). Monto: ${currency} ${amount}. Repartidor: ${deliveryPersonName}. Fecha limite: ${deadlineDate}. Para ayuda: HELP | Cancelar SMS: STOP`
}

/**
 * Generates message when cash is received successfully
 */
export function generateCashReceivedConfirmationMessage(
  orderNumber: string,
  amount: string,
  currency: string,
  newBalance: string
): string {
  return `LogiRapid: Efectivo recibido exitosamente (${orderNumber}). ${currency} ${amount} ha sido acreditado a tu wallet. Nuevo balance: ${currency} ${newBalance}. Para ayuda: HELP | Cancelar SMS: STOP`
}

/**
 * Sends OTP SMS for cash delivery verification
 */
export async function sendCashDeliveryOTP(
  deliveryPersonPhone: string,
  otpCode: string,
  amount: string,
  currency: string,
  brokerName: string
): Promise<SMSResult> {
  const message = generateCashDeliveryOTPMessage(otpCode, amount, currency, brokerName)
  return sendSMS(deliveryPersonPhone, message)
}

/**
 * Sends notification to delivery person when cash delivery order is assigned
 */
export async function sendCashDeliveryAssignedSMS(
  deliveryPersonPhone: string,
  orderNumber: string,
  amount: string,
  currency: string,
  brokerName: string,
  brokerProvince: string,
  deadlineDate: string
): Promise<SMSResult> {
  const message = generateCashDeliveryAssignedMessage(
    orderNumber, amount, currency, brokerName, brokerProvince, deadlineDate
  )
  return sendSMS(deliveryPersonPhone, message)
}

/**
 * Sends notification to broker when cash delivery order is pending
 */
export async function sendCashDeliveryPendingSMS(
  brokerPhone: string,
  orderNumber: string,
  amount: string,
  currency: string,
  deliveryPersonName: string,
  deadlineDate: string
): Promise<SMSResult> {
  const message = generateCashDeliveryPendingMessage(
    orderNumber, amount, currency, deliveryPersonName, deadlineDate
  )
  return sendSMS(brokerPhone, message)
}

/**
 * Sends confirmation to broker when cash is received
 */
export async function sendCashReceivedConfirmationSMS(
  brokerPhone: string,
  orderNumber: string,
  amount: string,
  currency: string,
  newBalance: string
): Promise<SMSResult> {
  const message = generateCashReceivedConfirmationMessage(orderNumber, amount, currency, newBalance)
  return sendSMS(brokerPhone, message)
}

// ==========================================
// BROKER REMITTANCE ORDER NOTIFICATION
// ==========================================

/**
 * Sends WhatsApp notification to broker when a new remittance order is assigned
 * Template: HX0e2324c2ee3839c08b8425fba9263387
 * Variables:
 *   {{1}} - Order number
 *   {{2}} - Recipient name
 *   {{3}} - Contact phone
 *   {{4}} - Contact address/location
 *   {{5}} - Delivery deadline
 */
export async function sendBrokerRemittanceNotification(
  brokerPhone: string,
  orderNumber: string,
  recipientName: string,
  recipientPhone: string,
  recipientLocation: string,
  deliveryDeadline: string
): Promise<SMSResult> {
  try {
    const contentSid = process.env.TWILIO_CONTENT_SID_BROKER_ORDER || 'HX0e2324c2ee3839c08b8425fba9263387'
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER
    const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER ||
      (twilioPhone ? `whatsapp:${twilioPhone}` : null)

    if (!whatsappNumber) {
      console.error('[WhatsApp Service] WhatsApp number not configured')
      return {
        success: false,
        error: 'WhatsApp service not configured'
      }
    }

    // Formatear y validar número destino
    const formattedPhone = formatPhoneNumber(brokerPhone)

    if (!isValidPhoneNumber(formattedPhone)) {
      console.warn(`[WhatsApp Service] Invalid broker phone number: ${brokerPhone}`)
      return {
        success: false,
        error: `Invalid phone number: ${brokerPhone}`,
        to: formattedPhone
      }
    }

    // Obtener cliente de Twilio
    const client = await getClient()

    // Función para sanitizar variables
    const sanitize = (value: string | null | undefined, defaultVal: string): string => {
      if (!value) return defaultVal
      return String(value)
        .replace(/[\n\r\t]/g, ' ')
        .replace(/\s{4,}/g, '   ')
        .trim() || defaultVal
    }

    // Preparar variables del template
    // Template: 📦 Nueva orden recibida
    // Se ha registrado una nueva orden en el sistema con el número de orden {{1}}.
    // El pedido está a nombre de {{2}}.
    // Información de contacto del cliente: {{3}} – {{4}}.
    // La fecha límite de entrega establecida para esta orden es el {{5}}.
    const contentVars = {
      "1": sanitize(orderNumber, 'N/A'),
      "2": sanitize(recipientName, 'Cliente'),
      "3": sanitize(recipientPhone, 'No disponible'),
      "4": sanitize(recipientLocation, 'No especificada'),
      "5": sanitize(deliveryDeadline, 'Por confirmar')
    }

    console.log(`[WhatsApp Broker] Sending notification to broker ${formattedPhone}`)
    console.log(`[WhatsApp Broker] Using ContentSid: ${contentSid}`)
    console.log(`[WhatsApp Broker] Order: ${orderNumber}, Recipient: ${recipientName}`)

    // Enviar mensaje usando Content Template
    const result = await client.messages.create({
      contentSid,
      contentVariables: JSON.stringify(contentVars),
      from: whatsappNumber.startsWith('whatsapp:') ? whatsappNumber : `whatsapp:${whatsappNumber}`,
      to: `whatsapp:${formattedPhone}`
    })

    console.log(`[WhatsApp Broker] Notification sent successfully. SID: ${result.sid}`)

    return {
      success: true,
      messageId: result.sid,
      to: formattedPhone
    }

  } catch (error: any) {
    console.error('[WhatsApp Broker] Error sending notification:', error)

    return {
      success: false,
      error: error.message || 'Unknown error sending WhatsApp',
      to: brokerPhone
    }
  }
}

/**
 * Masks a phone number for display (shows first 4 and last 3 digits)
 * Example: +17861234567 -> +1786***567
 */
export function maskPhoneNumber(phone: string): string {
  const formatted = formatPhoneNumber(phone)
  if (formatted.length < 10) return formatted

  // Keep first 5 chars (+1786) and last 3 chars (567)
  const start = formatted.substring(0, 5)
  const end = formatted.substring(formatted.length - 3)
  return `${start}***${end}`
}

// ==========================================
// WHATSAPP MESSAGE SUPPORT
// ==========================================

/**
 * Sends a WhatsApp message using Twilio
 * Uses free-form messages (session messages) - not templates
 */
export async function sendWhatsApp(to: string, message: string): Promise<SMSResult> {
  try {
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER
    const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER ||
      (twilioPhone ? `whatsapp:${twilioPhone}` : null)

    if (!whatsappNumber) {
      console.error('[WhatsApp Service] WhatsApp number not configured')
      return {
        success: false,
        error: 'WhatsApp service not configured'
      }
    }

    // Formatear y validar número destino
    const formattedTo = formatPhoneNumber(to)

    if (!isValidPhoneNumber(formattedTo)) {
      console.warn(`[WhatsApp Service] Invalid phone number: ${to}`)
      return {
        success: false,
        error: `Invalid phone number: ${to}`,
        to: formattedTo
      }
    }

    // Obtener cliente de Twilio
    const client = await getClient()

    console.log(`[WhatsApp Service] Sending WhatsApp to ${formattedTo}`)

    // Enviar mensaje WhatsApp
    const result = await client.messages.create({
      body: message,
      from: whatsappNumber.startsWith('whatsapp:') ? whatsappNumber : `whatsapp:${whatsappNumber}`,
      to: `whatsapp:${formattedTo}`
    })

    console.log(`[WhatsApp Service] WhatsApp sent successfully. SID: ${result.sid}`)

    return {
      success: true,
      messageId: result.sid,
      to: formattedTo
    }

  } catch (error: any) {
    console.error('[WhatsApp Service] Error sending WhatsApp:', error)

    return {
      success: false,
      error: error.message || 'Unknown error sending WhatsApp',
      to
    }
  }
}

/**
 * Generates OTP message for WhatsApp (with emojis and formatting)
 */
export function generateCashDeliveryOTPWhatsAppMessage(
  otpCode: string,
  amount: string,
  currency: string,
  brokerName: string
): string {
  return `🔐 *LogiRapid - Código de Verificación*

Tu código OTP es: *${otpCode}*

📦 Entrega de efectivo:
💵 Monto: ${currency} ${amount}
🏢 Broker: ${brokerName}

⏰ Este código expira en ${OTP_EXPIRATION_MINUTES} minutos.

_Entrega este código al broker para confirmar la recepción del efectivo._`
}

/**
 * Sends OTP via WhatsApp for cash delivery verification
 */
export async function sendCashDeliveryOTPWhatsApp(
  deliveryPersonPhone: string,
  otpCode: string,
  amount: string,
  currency: string,
  brokerName: string
): Promise<SMSResult> {
  const message = generateCashDeliveryOTPWhatsAppMessage(otpCode, amount, currency, brokerName)
  return sendWhatsApp(deliveryPersonPhone, message)
}

/**
 * Type for OTP delivery channel
 */
export type OTPChannel = 'sms' | 'whatsapp'

/**
 * Sends OTP via specified channel (SMS or WhatsApp)
 */
export async function sendCashDeliveryOTPByChannel(
  deliveryPersonPhone: string,
  otpCode: string,
  amount: string,
  currency: string,
  brokerName: string,
  channel: OTPChannel = 'sms'
): Promise<SMSResult> {
  if (channel === 'whatsapp') {
    return sendCashDeliveryOTPWhatsApp(deliveryPersonPhone, otpCode, amount, currency, brokerName)
  }
  return sendCashDeliveryOTP(deliveryPersonPhone, otpCode, amount, currency, brokerName)
}
