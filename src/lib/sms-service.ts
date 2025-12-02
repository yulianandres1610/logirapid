/**
 * SMS Service - Twilio Integration
 *
 * Servicio para enviar mensajes SMS usando Twilio
 * Usado para notificaciones de ordenes a clientes
 */

import twilio from 'twilio'

// Configuracion de Twilio desde variables de entorno
const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER

// Inicializar cliente de Twilio
let twilioClient: twilio.Twilio | null = null

function getClient(): twilio.Twilio {
  if (!twilioClient) {
    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN')
    }
    twilioClient = twilio(accountSid, authToken)
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
    // Validar configuracion
    if (!twilioPhoneNumber) {
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
    const client = getClient()

    // Enviar mensaje
    console.log(`[SMS Service] Sending SMS to ${formattedTo}`)

    const result = await client.messages.create({
      body: message,
      from: twilioPhoneNumber,
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
