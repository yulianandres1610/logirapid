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
 * Genera el mensaje de confirmacion de orden creada
 */
export function generateOrderCreatedMessage(
  companyName: string,
  orderNumber: string,
  scheduledDate: string
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

  return `Gracias por confiar en ${companyName}! Su numero de orden: ${orderNumber}. Un driver pasara por su casa el ${formattedDate}. Para ayuda: HELP | Cancelar SMS: STOP`
}

/**
 * Envia SMS de confirmacion cuando se crea una orden
 */
export async function sendOrderCreatedSMS(
  customerPhone: string,
  companyName: string,
  orderNumber: string,
  scheduledDate: string
): Promise<SMSResult> {
  const message = generateOrderCreatedMessage(companyName, orderNumber, scheduledDate)
  return sendSMS(customerPhone, message)
}
