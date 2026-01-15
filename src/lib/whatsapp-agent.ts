import { db } from '@/lib/database'
import { processMessage, generateGreeting, getErrorMessage, ConversationMessage, GPTResponse } from '@/lib/openai-client'
import { sendWhatsApp } from '@/lib/sms-service'
import { validateProvince, validateMunicipality, validateCubaAddress, findClosestMatch, CUBA_PROVINCES } from '@/lib/cuba-locations'

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

// Horarios disponibles para recogida
const ALL_TIME_SLOTS = [
  '8:00 AM - 12:00 PM',
  '12:00 PM - 4:00 PM',
  '4:00 PM - 8:00 PM'
]

/**
 * Obtiene las fechas y horarios disponibles para recogida
 * Sigue la misma logica del wizard:
 * - Antes de 8am: todos los slots de hoy
 * - 8-12: solo tarde y noche de hoy
 * - 12-16: solo noche de hoy
 * - Despues de 16: empieza con manana
 */
function getAvailableDates(): { date: string; dayName: string; slots: string[] }[] {
  const now = new Date()
  const currentHour = now.getHours()
  const result: { date: string; dayName: string; slots: string[] }[] = []

  // Nombres de dias en espanol
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']

  // Formato de fecha para mostrar
  const formatDateStr = (d: Date): string => {
    const day = d.getDate()
    const month = d.getMonth() + 1
    return `${day}/${month}`
  }

  // Calcular slots disponibles para hoy
  let todaySlots: string[] = []
  if (currentHour < 8) {
    todaySlots = [...ALL_TIME_SLOTS]
  } else if (currentHour < 12) {
    todaySlots = ALL_TIME_SLOTS.slice(1) // Solo tarde y noche
  } else if (currentHour < 16) {
    todaySlots = ALL_TIME_SLOTS.slice(2) // Solo noche
  }
  // Despues de las 16, no hay slots para hoy

  // Agregar hoy si tiene slots disponibles
  if (todaySlots.length > 0) {
    result.push({
      date: formatDateStr(now),
      dayName: 'Hoy',
      slots: todaySlots
    })
  }

  // Agregar proximos 6 dias (todos los slots)
  for (let i = 1; i <= 6; i++) {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + i)

    result.push({
      date: formatDateStr(futureDate),
      dayName: i === 1 ? 'Manana' : dayNames[futureDate.getDay()],
      slots: [...ALL_TIME_SLOTS]
    })
  }

  return result
}

/**
 * Formatea las fechas disponibles en un mensaje amigable para WhatsApp
 */
function formatAvailableDatesMessage(dates: { date: string; dayName: string; slots: string[] }[]): string {
  let msg = 'Estas son las fechas disponibles:\n\n'

  // Mostrar solo las primeras 3 fechas para no abrumar
  const datesToShow = dates.slice(0, 3)

  datesToShow.forEach((d, idx) => {
    msg += `${idx + 1}. ${d.dayName} (${d.date}):\n`
    d.slots.forEach((slot, slotIdx) => {
      const slotLabel = slot.includes('8:00 AM') ? 'Manana' :
                        slot.includes('12:00 PM') ? 'Tarde' : 'Noche'
      msg += `   ${slotIdx + 1}. ${slotLabel} (${slot})\n`
    })
    msg += '\n'
  })

  msg += 'Dime cual prefieres (ej: "manana en la tarde" o "1-2")'

  return msg
}

/**
 * Geocodifica una dirección USA usando el API de address-lookup
 */
async function geocodeUSAddress(address: string): Promise<{
  formattedAddress: string
  street: string
  city: string
  state: string
  zipcode: string
  latitude: number
  longitude: number
} | null> {
  try {
    // Usar Mapbox Geocoding API directamente
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'

    // Limpiar la dirección
    let cleanAddress = address.trim()
      .replace(/,\s*us$/i, '')
      .replace(/,\s*usa$/i, '')
      .replace(/,\s*united states$/i, '')

    const encodedAddress = encodeURIComponent(cleanAddress)

    console.log('[WhatsApp Agent] Geocodificando con Mapbox:', cleanAddress)

    // Primer intento: buscar como dirección exacta
    let response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?` +
      `access_token=${mapboxToken}&` +
      `country=US&` +
      `types=address,place&` +
      `autocomplete=true&` +
      `limit=5`
    )

    if (!response.ok) {
      console.log('[WhatsApp Agent] Mapbox API error:', response.status)
      return null
    }

    let data = await response.json()

    // Si no hay resultados, intentar sin restricción de tipo
    if (!data.features || data.features.length === 0) {
      console.log('[WhatsApp Agent] Sin resultados con types=address, intentando búsqueda general')
      response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?` +
        `access_token=${mapboxToken}&` +
        `country=US&` +
        `autocomplete=true&` +
        `limit=5`
      )
      data = await response.json()
    }

    if (data.features && data.features.length > 0) {
      // Buscar el mejor resultado (preferir el que tenga más componentes)
      let bestFeature = data.features[0]
      for (const feature of data.features) {
        if (feature.place_type?.includes('address')) {
          bestFeature = feature
          break
        }
      }

      const feature = bestFeature
      const [longitude, latitude] = feature.center

      // Extraer componentes de la dirección
      let street = ''
      let city = ''
      let state = ''
      let zipcode = ''

      // Extraer de context array (más confiable)
      if (feature.context) {
        for (const ctx of feature.context) {
          if (ctx.id.startsWith('postcode')) {
            zipcode = ctx.text
          } else if (ctx.id.startsWith('place') || ctx.id.startsWith('locality')) {
            city = ctx.text
          } else if (ctx.id.startsWith('region')) {
            // Convertir nombre de estado a abreviación
            state = ctx.short_code?.replace('US-', '') || ctx.text
          }
        }
      }

      // Street viene del texto principal
      street = feature.text || ''
      if (feature.address) {
        street = `${feature.address} ${street}`
      }

      // Si no hay street pero tenemos place_name, usarlo
      if (!street && feature.place_name) {
        const parts = feature.place_name.split(',')
        street = parts[0]?.trim() || ''
      }

      // Formatear dirección completa
      let formattedAddress = ''
      if (street) formattedAddress += street
      if (city) formattedAddress += formattedAddress ? `, ${city}` : city
      if (state) formattedAddress += formattedAddress ? `, ${state}` : state
      if (zipcode) formattedAddress += ` ${zipcode}`
      formattedAddress = formattedAddress.trim()

      // Si no pudimos extraer bien, usar place_name directamente
      if (!formattedAddress || formattedAddress.length < 5) {
        formattedAddress = feature.place_name?.replace(/, United States$/, '') || address
      }

      console.log('[WhatsApp Agent] Geocodificación exitosa:', {
        formattedAddress,
        latitude,
        longitude,
        relevance: feature.relevance
      })

      return {
        formattedAddress,
        street: street || formattedAddress.split(',')[0] || '',
        city: city || 'Miami',
        state: state || 'FL',
        zipcode: zipcode || '',
        latitude,
        longitude
      }
    }

    console.log('[WhatsApp Agent] Sin resultados de Mapbox para:', address)
    return null
  } catch (error) {
    console.error('[WhatsApp Agent] Error en geocodificación Mapbox:', error)
    return null
  }
}

/**
 * Parsea una expresión de fecha del usuario (hoy, mañana, lunes, etc)
 * y devuelve la fecha correspondiente con slots disponibles
 */
function parseUserDateExpression(dateExpression: string, preferredSlot?: string): {
  success: boolean
  date?: string
  dayName?: string
  slots?: string[]
  selectedSlot?: string
  error?: string
  suggestion?: { date: string; dayName: string; slot: string }
} {
  const availableDates = getAvailableDates()
  const lower = dateExpression.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  let targetDate: { date: string; dayName: string; slots: string[] } | null = null

  // Detectar "hoy"
  if (lower.includes('hoy')) {
    targetDate = availableDates.find(d => d.dayName === 'Hoy') || null
    if (!targetDate) {
      // Hoy no tiene slots disponibles
      const tomorrow = availableDates.find(d => d.dayName === 'Manana')
      return {
        success: false,
        error: 'Para hoy ya no tenemos horarios disponibles.',
        suggestion: tomorrow ? {
          date: tomorrow.date,
          dayName: 'mañana',
          slot: tomorrow.slots[0]
        } : undefined
      }
    }
  }
  // Detectar "mañana" / "manana"
  else if (lower.includes('manana') && !lower.includes('por la manana')) {
    targetDate = availableDates.find(d => d.dayName === 'Manana') || null
  }
  // Detectar "pasado mañana"
  else if (lower.includes('pasado')) {
    targetDate = availableDates[2] || null // El tercer día
  }
  // Detectar días de la semana
  else {
    const dayMappings: Record<string, string> = {
      'lunes': 'Lunes',
      'martes': 'Martes',
      'miercoles': 'Miercoles',
      'jueves': 'Jueves',
      'viernes': 'Viernes',
      'sabado': 'Sabado',
      'domingo': 'Domingo'
    }

    for (const [key, dayName] of Object.entries(dayMappings)) {
      if (lower.includes(key)) {
        targetDate = availableDates.find(d => d.dayName === dayName) || null
        break
      }
    }
  }

  // Si no encontró fecha específica, intentar con números (ej: "el 20")
  if (!targetDate) {
    const dayMatch = lower.match(/(?:el\s+)?(\d{1,2})/)
    if (dayMatch) {
      const dayNum = parseInt(dayMatch[1])
      const now = new Date()

      // Buscar en fechas disponibles
      for (const d of availableDates) {
        const [day] = d.date.split('/')
        if (parseInt(day) === dayNum) {
          targetDate = d
          break
        }
      }
    }
  }

  if (!targetDate) {
    return {
      success: false,
      error: 'No entendi la fecha. Puedes decirme "hoy", "mañana", o un dia de la semana?'
    }
  }

  // Detectar horario preferido
  let selectedSlot: string | undefined

  // Mapear preferredSlot de GPT
  if (preferredSlot === 'morning') {
    selectedSlot = '8:00 AM - 12:00 PM'
  } else if (preferredSlot === 'afternoon') {
    selectedSlot = '12:00 PM - 4:00 PM'
  } else if (preferredSlot === 'evening') {
    selectedSlot = '4:00 PM - 8:00 PM'
  }

  // También detectar del texto
  if (!selectedSlot) {
    if (lower.includes('por la manana') || lower.includes('temprano') || lower.includes('en la manana')) {
      selectedSlot = '8:00 AM - 12:00 PM'
    } else if (lower.includes('tarde') || lower.includes('mediodia')) {
      selectedSlot = '12:00 PM - 4:00 PM'
    } else if (lower.includes('noche') || lower.includes('despues de las 4')) {
      selectedSlot = '4:00 PM - 8:00 PM'
    }
  }

  // Verificar que el slot esté disponible
  if (selectedSlot && !targetDate.slots.includes(selectedSlot)) {
    // El slot solicitado no está disponible
    const slotNames: Record<string, string> = {
      '8:00 AM - 12:00 PM': 'en la mañana',
      '12:00 PM - 4:00 PM': 'en la tarde',
      '4:00 PM - 8:00 PM': 'en la noche'
    }

    return {
      success: false,
      error: `${targetDate.dayName} ${slotNames[selectedSlot] || ''} ya no está disponible.`,
      date: targetDate.date,
      dayName: targetDate.dayName,
      slots: targetDate.slots,
      suggestion: {
        date: targetDate.date,
        dayName: targetDate.dayName.toLowerCase(),
        slot: targetDate.slots[0]
      }
    }
  }

  return {
    success: true,
    date: targetDate.date,
    dayName: targetDate.dayName,
    slots: targetDate.slots,
    selectedSlot
  }
}

/**
 * Formatea un mensaje sobre disponibilidad de horarios
 */
function formatSlotSelectionMessage(dayName: string, date: string, slots: string[]): string {
  const slotNames: Record<string, string> = {
    '8:00 AM - 12:00 PM': 'Mañana (8AM-12PM)',
    '12:00 PM - 4:00 PM': 'Tarde (12PM-4PM)',
    '4:00 PM - 8:00 PM': 'Noche (4PM-8PM)'
  }

  let msg = `Para ${dayName} (${date}) tengo estos horarios:\n\n`
  slots.forEach((slot, idx) => {
    msg += `${idx + 1}. ${slotNames[slot] || slot}\n`
  })
  msg += '\nCual prefieres?'

  return msg
}

// Configuracion de remesas (para uso futuro)
const REMITTANCE_FEE_PERCENTAGE = 5 // 5% comision
const REMITTANCE_REQUIRED_FIELDS = [
  'amount',
  'recipientName',
  'recipientPhone',
  'province',
  'municipality',
  'address'
]

// Campos MINIMOS requeridos para orden de recogida (sin estos no se puede crear)
const PICKUP_MINIMUM_FIELDS = [
  'senderName',
  'senderAddress',
  'recipientName',
  'recipientPhone',
  'recipientProvince',
  'recipientMunicipality',
  'scheduledDate',
  'timeSlot'
]

// Campos opcionales pero deseables
const PICKUP_OPTIONAL_FIELDS = [
  'senderIdType',        // Tipo de ID (Pasaporte, Licencia, etc.)
  'senderIdNumber',      // Numero de ID
  'senderEntryPin',      // PIN de entrada (puede ser "NO")
  'recipientCI',         // Carnet de Identidad Cuba (11 digitos)
  'recipientStreet'      // Calle y numero en Cuba
]

// Todos los campos de recogida (para backward compatibility)
const PICKUP_REQUIRED_FIELDS = [...PICKUP_MINIMUM_FIELDS, ...PICKUP_OPTIONAL_FIELDS]

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
 * Ahora distingue entre campos minimos y opcionales
 */
function validatePickupData(data: Record<string, unknown>): {
  valid: boolean
  minimumMet: boolean
  missing: string[]
  missingOptional: string[]
  errors: string[]
} {
  const missing: string[] = []
  const missingOptional: string[] = []
  const errors: string[] = []

  // Verificar campos minimos
  for (const field of PICKUP_MINIMUM_FIELDS) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].toString().trim() === '')) {
      missing.push(field)
    }
  }

  // Verificar campos opcionales
  for (const field of PICKUP_OPTIONAL_FIELDS) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].toString().trim() === '')) {
      missingOptional.push(field)
    }
  }

  // Validar CI de Cuba si esta presente
  if (data.recipientCI && !validateCubanCI(String(data.recipientCI))) {
    errors.push('El Carnet de Identidad debe tener 11 digitos')
  }

  const minimumMet = missing.length === 0 && errors.length === 0

  return {
    valid: missing.length === 0 && missingOptional.length === 0 && errors.length === 0,
    minimumMet,
    missing,
    missingOptional,
    errors
  }
}

/**
 * Valida si los datos de remesa estan completos (para uso futuro)
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
    entryInstructions?: string
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
      c.idtype, c.idnumber,
      ca.id as address_id, ca.street, ca.city, ca.state, ca.zipcode,
      ca.entry_pin, ca.entry_instructions, ca.isprimary
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
        entryPin: r.entry_pin, // PIN de cada direccion
        entryInstructions: r.entry_instructions,
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
 * @param sentBy - Identifica quién envió: 'customer' | 'ai' | 'agent'
 */
export async function saveMessage(
  conversationId: number,
  direction: 'inbound' | 'outbound',
  content: string,
  messageSid?: string,
  intent?: string,
  extractedData?: Record<string, unknown>,
  sentBy?: 'customer' | 'ai' | 'agent'
): Promise<void> {
  // Determinar sent_by automáticamente si no se proporciona
  const sender = sentBy || (direction === 'inbound' ? 'customer' : 'ai')

  await db.query(`
    INSERT INTO whatsapp_messages (
      conversation_id, direction, message_sid, content, detected_intent, extracted_data, sent_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [
    conversationId,
    direction,
    messageSid || null,
    content,
    intent || null,
    extractedData ? JSON.stringify(extractedData) : null,
    sender
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
 * Marca la conversacion como completada con la orden creada
 */
export async function markConversationCompleted(
  conversationId: number,
  orderId: number,
  orderType: 'pickup' | 'remittance'
): Promise<void> {
  await db.query(`
    UPDATE whatsapp_conversations
    SET
      conversation_status = 'completed',
      completed_order_id = $1,
      completed_order_type = $2,
      completed_at = NOW(),
      current_flow = 'idle',
      current_step = NULL,
      updated_at = NOW()
    WHERE id = $3
  `, [orderId, orderType, conversationId])
  console.log('[WhatsApp Agent] Conversacion marcada como completada:', conversationId, 'Orden:', orderId)
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
  try {
    const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10)
    console.log('[WhatsApp Agent] getOrCreateCustomer - Phone:', phoneNumber, 'Clean:', cleanPhone, 'Name:', name)

    // Buscar cliente existente por telefono Y nombre similar (para evitar duplicados)
    const existingResult = await db.query(`
      SELECT id, firstname, lastname, phone FROM customers
      WHERE phone LIKE $1 OR phone LIKE $2
      ORDER BY id DESC
      LIMIT 1
    `, [`%${cleanPhone}%`, `%${cleanPhone}%`])

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0]
      console.log('[WhatsApp Agent] Cliente existente encontrado:', existing.id, existing.firstname, existing.lastname)
      return { customerId: existing.id, isNew: false }
    }

    // Crear nuevo cliente
    const nameParts = (name || 'Cliente WhatsApp').trim().split(' ')
    const firstName = nameParts[0] || 'Cliente'
    const lastName = nameParts.slice(1).join(' ') || ''

    console.log('[WhatsApp Agent] Creando nuevo cliente:', firstName, lastName, phoneNumber)

    // Obtener company_id por defecto (primera compañia disponible)
    const companyResult = await db.query(`SELECT id FROM companies ORDER BY id LIMIT 1`)
    const companyId = companyResult.rows[0]?.id || 1

    const insertResult = await db.query(`
      INSERT INTO customers (firstname, lastname, phone, address, createdat, createdby, company_id)
      VALUES ($1, $2, $3, $4, NOW(), 'whatsapp-agent', $5)
      RETURNING id
    `, [firstName, lastName, phoneNumber, address || '', companyId])

    console.log('[WhatsApp Agent] ✅ Nuevo cliente creado con ID:', insertResult.rows[0].id)
    return { customerId: insertResult.rows[0].id, isNew: true }
  } catch (error) {
    console.error('[WhatsApp Agent] ❌ Error creando cliente:', error)
    // Si falla la creación, intentar buscar de nuevo por si ya existe
    const fallbackResult = await db.query(`
      SELECT id FROM customers WHERE phone LIKE $1 LIMIT 1
    `, [`%${phoneNumber.replace(/\D/g, '').slice(-10)}%`])

    if (fallbackResult.rows.length > 0) {
      console.log('[WhatsApp Agent] Cliente encontrado en fallback:', fallbackResult.rows[0].id)
      return { customerId: fallbackResult.rows[0].id, isNew: false }
    }

    throw error
  }
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
    console.log('[WhatsApp Agent] senderAddress:', data.senderAddress)
    console.log('[WhatsApp Agent] scheduledDate:', data.scheduledDate)
    console.log('[WhatsApp Agent] timeSlot:', data.timeSlot)

    // 1. Preparar dirección - usar coordenadas pre-validadas si existen
    const rawAddress = String(data.senderAddress || '').trim()
    let fullAddress = rawAddress
    let street = rawAddress
    let city = 'Miami'  // Default
    let state = 'FL'    // Default
    let zipcode = ''
    let latitude: number | null = null
    let longitude: number | null = null

    // Verificar si hay coordenadas pre-validadas (de validate_us_address)
    const preValidatedCoords = data._addressCoordinates as { latitude: number; longitude: number } | undefined
    if (preValidatedCoords && preValidatedCoords.latitude && preValidatedCoords.longitude) {
      console.log('[WhatsApp Agent] Usando coordenadas PRE-VALIDADAS:', preValidatedCoords)
      latitude = preValidatedCoords.latitude
      longitude = preValidatedCoords.longitude
      fullAddress = rawAddress  // Ya está formateado
    }

    // Si no hay coordenadas pre-validadas, geocodificar ahora
    if (!latitude || !longitude) {
      if (rawAddress && rawAddress.length > 5) {
        console.log('[WhatsApp Agent] Geocodificando dirección:', rawAddress)
        const geoResult = await geocodeUSAddress(rawAddress)

        if (geoResult) {
          console.log('[WhatsApp Agent] Geocodificación exitosa:', geoResult)
          // Guardar la dirección formateada completa
          fullAddress = geoResult.formattedAddress
          street = geoResult.street || rawAddress
          city = geoResult.city || 'Miami'
          state = geoResult.state || 'FL'
          zipcode = geoResult.zipcode || ''
          latitude = geoResult.latitude
          longitude = geoResult.longitude
        } else {
          console.log('[WhatsApp Agent] No se pudo geocodificar, parseando manualmente')
          // Intentar parsear la dirección manualmente
          fullAddress = rawAddress  // Mantener la dirección original
          const addressParts = rawAddress.split(',').map(p => p.trim())
          if (addressParts.length >= 2) {
            street = addressParts[0] || rawAddress
            city = addressParts[1] || 'Miami'
            if (addressParts.length >= 3) {
              // El último puede ser "FL 33125" o "Florida 33125"
              const lastPart = addressParts[addressParts.length - 1] || ''
              const stateZipMatch = lastPart.match(/([A-Za-z]{2,})\s*(\d{5})?/)
              if (stateZipMatch) {
                state = stateZipMatch[1] || 'FL'
                zipcode = stateZipMatch[2] || ''
              }
            }
          }
        }
      } else {
        console.log('[WhatsApp Agent] Sin dirección válida, usando valores por defecto')
        fullAddress = 'Dirección pendiente'
      }
    }

    console.log('[WhatsApp Agent] Dirección final:', { fullAddress, street, city, state, zipcode, latitude, longitude })

    // 2. Obtener o crear cliente
    const { customerId } = await getOrCreateCustomer(
      phoneNumber,
      String(data.senderName || 'Cliente'),
      String(data.senderAddress || '')
    )
    console.log('[WhatsApp Agent] Customer ID:', customerId)

    // 3. Generar numero de orden
    const orderNumber = await generateOrderNumber('PICKUP')
    console.log('[WhatsApp Agent] Order Number:', orderNumber)

    // 4. Preparar datos completos de la orden
    const officeOrderData = {
      // Datos del remitente (USA)
      senderName: data.senderName,
      senderPhone: data.senderPhone || phoneNumber,
      senderIdType: data.senderIdType || '',
      senderIdNumber: data.senderIdNumber || '',
      senderAddress: data.senderAddress,
      senderEntryPin: data.senderEntryPin || 'NO',
      senderEntryInstructions: data.senderInstructions || null,
      // Coordenadas de recogida
      pickupCoordinates: latitude && longitude ? {
        latitude,
        longitude
      } : null,
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

    // 5. Preparar servicios (formato que espera el API)
    const services = [{
      name: 'Recogida a Domicilio',
      type: 'pickup',
      quantity: 1,
      unitPrice: 0,
      subtotal: 0
    }]

    // 6. Determinar fecha y horario
    let scheduledDate: string | null = null
    const rawDate = data.scheduledDate ? String(data.scheduledDate).trim() : ''

    console.log('[WhatsApp Agent] Procesando fecha raw:', rawDate)

    if (rawDate) {
      // Verificar si ya está en formato ISO (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        scheduledDate = rawDate
      }
      // Convertir fecha de formato "16/1" o "16/01" a formato ISO "YYYY-MM-DD"
      else if (rawDate.includes('/')) {
        const dateParts = rawDate.split('/')
        if (dateParts.length === 2) {
          const day = parseInt(dateParts[0])
          const month = parseInt(dateParts[1])
          const year = new Date().getFullYear()
          // Si el mes es menor al actual, puede ser del próximo año
          const currentMonth = new Date().getMonth() + 1
          const actualYear = month < currentMonth ? year + 1 : year
          scheduledDate = `${actualYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        }
      }
      // Si no se pudo convertir, intentar parsear como fecha
      else {
        try {
          const parsed = new Date(rawDate)
          if (!isNaN(parsed.getTime())) {
            scheduledDate = parsed.toISOString().split('T')[0]
          }
        } catch {
          console.log('[WhatsApp Agent] No se pudo parsear fecha:', rawDate)
        }
      }
    }

    // Si no hay fecha, usar mañana por defecto
    if (!scheduledDate) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      scheduledDate = tomorrow.toISOString().split('T')[0]
      console.log('[WhatsApp Agent] Sin fecha, usando mañana:', scheduledDate)
    }

    // Horario - asegurar que siempre tenga un valor
    const rawTimeSlot = data.timeSlot ? String(data.timeSlot).trim() : ''
    const timeSlot = rawTimeSlot || '8:00 AM - 12:00 PM'

    console.log('[WhatsApp Agent] Fecha final:', scheduledDate, 'Horario final:', timeSlot)

    // Obtener company_id
    const companyResult = await db.query(`SELECT id FROM companies ORDER BY id LIMIT 1`)
    const companyId = companyResult.rows[0]?.id || 1

    // 7. Insertar orden con todos los campos requeridos incluyendo coordenadas
    // Usar dirección completa formateada para customeraddress
    const customerAddressFormatted = fullAddress || `${street}, ${city}, ${state} ${zipcode}`.trim()

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
        latitude,
        longitude,
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
        updatedat,
        company_id
      ) VALUES (
        $1, $2, 'recogida', $3, $4, $5, $6, $7, $8, $9, $10, 'US',
        $11, $12, $13, $14, 0, 0, 0, $15, $16, 'cod', 'pending_payment', 'pending',
        $17, 'whatsapp-agent', NOW(), NOW(), $18
      )
      RETURNING id, ordernumber
    `, [
      customerId,
      orderNumber,
      data.senderName || 'Cliente WhatsApp',
      String(data.senderName || '').split(' ')[0] || 'Cliente',
      String(data.senderName || '').split(' ').slice(1).join(' ') || '',
      phoneNumber,
      customerAddressFormatted,  // Dirección completa formateada
      city,
      state,
      zipcode,
      latitude,
      longitude,
      JSON.stringify(services),
      `ID: ${data.senderIdType} ${data.senderIdNumber} | PIN: ${data.senderEntryPin || 'NO'} | Cuba: ${data.recipientName} (CI: ${data.recipientCI}) - ${data.recipientStreet}, ${data.recipientMunicipality}, ${data.recipientProvince} | Tel: ${data.recipientPhone}`,
      scheduledDate,
      timeSlot,
      JSON.stringify(officeOrderData),
      companyId
    ])

    console.log('[WhatsApp Agent] ===== ORDEN CREADA EXITOSAMENTE =====')
    console.log('[WhatsApp Agent] Order ID:', result.rows[0].id)
    console.log('[WhatsApp Agent] Order Number:', result.rows[0].ordernumber)
    console.log('[WhatsApp Agent] Coordenadas:', latitude, longitude)

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

    // 2. Detectar si el usuario quiere empezar una nueva orden (respaldo manual)
    const newOrderPhrases = ['nueva orden', 'nuevo envio', 'nuevo envío', 'otra persona', 'empezar de nuevo', 'empezar de cero', 'borrar datos', 'otro cliente', 'reiniciar']
    const msgLowerTrimmed = messageBody.toLowerCase().trim()
    const wantsNewOrder = newOrderPhrases.some(phrase => msgLowerTrimmed.includes(phrase))

    if (wantsNewOrder && conversation.current_flow !== 'idle') {
      console.log('[WhatsApp Agent] Usuario solicita nueva orden (detección manual) - limpiando datos')
      await resetConversation(conversation.id)
      await saveMessage(conversation.id, 'inbound', messageBody, messageSid)
      const response = 'Perfecto, empezamos de nuevo. Dame tu numero de telefono para buscarte en el sistema.'
      await saveMessage(conversation.id, 'outbound', response)
      return { message: response }
    }

    // 3. Guardar mensaje entrante
    await saveMessage(conversation.id, 'inbound', messageBody, messageSid)

    // 5. Agregar mensaje al historial
    const updatedHistory: ConversationMessage[] = [
      ...conversation.messages_history,
      { role: 'user', content: messageBody }
    ]

    // 6. Verificar si es primera interaccion CON saludo simple
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

    // 7. Procesar con GPT
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

    // 8. Manejar solicitud de nueva orden (limpiar datos) - desde GPT
    if (gptResponse.startNewOrder) {
      console.log('[WhatsApp Agent] Usuario solicita nueva orden (GPT) - limpiando datos')
      await resetConversation(conversation.id)
      const response = 'Perfecto, empezamos de nuevo. Dame tu numero de telefono para buscarte en el sistema.'
      await saveMessage(conversation.id, 'outbound', response)
      return { message: response }
    }

    // 9. Actualizar datos recopilados (ACUMULAR datos)
    const newCollectedData = {
      ...conversation.collected_data,
      ...(gptResponse.extractedData || {})
    }
    // Eliminar allDataComplete de los datos guardados
    delete newCollectedData.allDataComplete

    // === EXTRACCION MANUAL DE RESPALDO ===
    // Si GPT no extrajo datos pero el contexto sugiere que el usuario dio información
    if (!gptResponse.extractedData || Object.keys(gptResponse.extractedData).length === 0) {
      const msgLower = messageBody.toLowerCase().trim()
      const prevData = conversation.collected_data

      // Si tenemos senderPhone pero no senderName, el mensaje probablemente es el nombre
      if (prevData.senderPhone && !prevData.senderName && !newCollectedData.senderName) {
        // Verificar que no sea un número o comando
        if (!/^\d+$/.test(msgLower) && !msgLower.startsWith('/') && messageBody.length > 2 && messageBody.length < 50) {
          newCollectedData.senderName = messageBody.trim()
          console.log('[WhatsApp Agent] Extraccion manual: senderName =', newCollectedData.senderName)
        }
      }

      // Si tenemos recipientPhone pero no recipientName, el mensaje probablemente es el nombre
      if (prevData.recipientPhone && !prevData.recipientName && !newCollectedData.recipientName) {
        if (!/^\d+$/.test(msgLower) && !msgLower.startsWith('/') && messageBody.length > 2 && messageBody.length < 50) {
          newCollectedData.recipientName = messageBody.trim()
          console.log('[WhatsApp Agent] Extraccion manual: recipientName =', newCollectedData.recipientName)
        }
      }

      // Detectar CI cubano (11 dígitos)
      const ciMatch = messageBody.match(/\b(\d{11})\b/)
      if (ciMatch && prevData.recipientName && !prevData.recipientCI && !newCollectedData.recipientCI) {
        newCollectedData.recipientCI = ciMatch[1]
        console.log('[WhatsApp Agent] Extraccion manual: recipientCI =', newCollectedData.recipientCI)
      }

      // Detectar provincia de Cuba mencionada
      if (prevData.recipientName && !prevData.recipientProvince && !newCollectedData.recipientProvince) {
        const validatedProvince = validateProvince(messageBody)
        if (validatedProvince) {
          newCollectedData.recipientProvince = validatedProvince
          console.log('[WhatsApp Agent] Extraccion manual: recipientProvince =', newCollectedData.recipientProvince)
        }
      }

      // Detectar municipio si ya tenemos provincia
      if (prevData.recipientProvince && !prevData.recipientMunicipality && !newCollectedData.recipientMunicipality) {
        const validation = validateCubaAddress(String(prevData.recipientProvince), messageBody)
        if (validation.valid && validation.municipality) {
          newCollectedData.recipientMunicipality = validation.municipality
          console.log('[WhatsApp Agent] Extraccion manual: recipientMunicipality =', newCollectedData.recipientMunicipality)
        }
      }

      // Detectar calle en Cuba si ya tenemos municipio
      if (prevData.recipientMunicipality && !prevData.recipientStreet && !newCollectedData.recipientStreet) {
        if (messageBody.length > 5 && messageBody.length < 200 && !/^\d{11}$/.test(messageBody)) {
          newCollectedData.recipientStreet = messageBody.trim()
          console.log('[WhatsApp Agent] Extraccion manual: recipientStreet =', newCollectedData.recipientStreet)
        }
      }
    }

    console.log('[WhatsApp Agent] Datos acumulados:', JSON.stringify(newCollectedData))

    // 7. Determinar nuevo flujo
    let newFlow = conversation.current_flow

    // Detectar flujo por intent explícito de GPT
    if (gptResponse.intent && conversation.current_flow === 'idle') {
      if (gptResponse.intent === 'pickup_order') {
        newFlow = 'pickup_order'
        console.log('[WhatsApp Agent] Nuevo flujo por intent: pickup_order')
      } else if (gptResponse.intent === 'remittance_order') {
        newFlow = 'remittance_order'
        console.log('[WhatsApp Agent] Nuevo flujo por intent: remittance_order')
      }
    }

    // Auto-detectar flujo pickup_order si hay indicadores
    // (GPT a veces no devuelve intent pero sí busca datos)
    if (newFlow === 'idle') {
      const hasPickupIndicators =
        gptResponse.searchSender ||                    // Buscó remitente
        gptResponse.searchRecipient ||                 // Buscó destinatario
        gptResponse.getAvailableDates ||               // Pidió fechas
        gptResponse.selectDate ||                      // Seleccionó fecha
        newCollectedData.senderName ||                 // Ya tiene nombre sender
        newCollectedData.recipientName ||              // Ya tiene nombre recipient
        conversation.collected_data.senderPhone        // Ya tiene teléfono sender

      if (hasPickupIndicators) {
        newFlow = 'pickup_order'
        console.log('[WhatsApp Agent] Nuevo flujo auto-detectado: pickup_order')
      }
    }

    // 8. Manejar busquedas de cliente si GPT lo solicita
    let response = gptResponse.response

    // Buscar remitente por telefono
    if (gptResponse.searchSender) {
      console.log('[WhatsApp Agent] Buscando sender por telefono:', gptResponse.searchSender)
      const senderResult = await searchSenderByPhone(gptResponse.searchSender)

      if (senderResult.found) {
        // Cliente encontrado - cargar TODOS sus datos
        newCollectedData.senderName = senderResult.name
        newCollectedData.senderPhone = senderResult.phone || gptResponse.searchSender
        if (senderResult.idType) newCollectedData.senderIdType = senderResult.idType
        if (senderResult.idNumber) newCollectedData.senderIdNumber = senderResult.idNumber

        // Construir respuesta con TODOS los datos encontrados
        let foundMsg = `Te encontre! Eres ${senderResult.name}.\n\n`
        if (senderResult.idType && senderResult.idNumber) {
          foundMsg += `${senderResult.idType}: ${senderResult.idNumber}\n`
        }

        if (senderResult.addresses && senderResult.addresses.length > 0) {
          const addr = senderResult.addresses[0]
          foundMsg += `Direccion: ${addr.address}\n`
          if (addr.entryPin && addr.entryPin !== 'NO') {
            foundMsg += `PIN entrada: ${addr.entryPin}\n`
          }
          foundMsg += `\nSon correctos estos datos?`
          // Guardar direccion temporalmente para confirmar
          newCollectedData._pendingAddress = addr
        } else {
          foundMsg += `\nDame tu direccion de recogida.`
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
        // Destinatario encontrado - guardar TODOS sus datos
        newCollectedData.recipientName = recipientResult.name
        newCollectedData.recipientPhone = recipientResult.phone || gptResponse.searchRecipient
        if (recipientResult.ci) newCollectedData.recipientCI = recipientResult.ci

        // Construir mensaje con TODOS los datos encontrados
        let foundMsg = `Encontre a ${recipientResult.name}!\n\n`
        foundMsg += `Tel: ${recipientResult.phone || gptResponse.searchRecipient}\n`
        if (recipientResult.ci) {
          foundMsg += `CI: ${recipientResult.ci}\n`
        }

        if (recipientResult.addresses && recipientResult.addresses.length > 0) {
          const addr = recipientResult.addresses[0]
          foundMsg += `Direccion: ${addr.street || ''}`
          if (addr.reparto) foundMsg += `, ${addr.reparto}`
          foundMsg += `\n${addr.municipality || ''}, ${addr.province || ''}\n`

          // Guardar todos los datos de direccion
          newCollectedData.recipientProvince = addr.province
          newCollectedData.recipientMunicipality = addr.municipality
          newCollectedData.recipientStreet = addr.street
          if (addr.reparto) newCollectedData.recipientReparto = addr.reparto
          if (addr.instructions) newCollectedData.recipientInstructions = addr.instructions

          foundMsg += `\nSon correctos estos datos?`
        } else {
          foundMsg += `\nPero no tengo su direccion guardada. En que provincia esta?`
        }
        response = foundMsg
      } else {
        // Destinatario no encontrado
        newCollectedData.recipientPhone = gptResponse.searchRecipient
        response = 'No lo tengo registrado. Como se llama la persona que recibe?'
      }
    }

    // Validar direccion USA con Mapbox
    if (gptResponse.validateAddress) {
      console.log('[WhatsApp Agent] Validando direccion con Mapbox:', gptResponse.validateAddress)
      const geoResult = await geocodeUSAddress(gptResponse.validateAddress)

      if (geoResult && geoResult.formattedAddress) {
        // Direccion validada exitosamente
        console.log('[WhatsApp Agent] Direccion validada:', geoResult)

        // Guardar temporalmente para que el usuario confirme
        newCollectedData._pendingValidatedAddress = {
          original: gptResponse.validateAddress,
          formatted: geoResult.formattedAddress,
          street: geoResult.street,
          city: geoResult.city,
          state: geoResult.state,
          zipcode: geoResult.zipcode,
          latitude: geoResult.latitude,
          longitude: geoResult.longitude
        }

        response = `📍 Encontre esta direccion:\n\n*${geoResult.formattedAddress}*\n\nEsta es correcta?`
      } else {
        // No se pudo validar la direccion
        console.log('[WhatsApp Agent] No se pudo validar direccion:', gptResponse.validateAddress)
        response = `No pude encontrar esa direccion. Por favor dame la direccion completa con:\n- Numero y calle\n- Ciudad\n- Estado (ej: FL)\n- Codigo postal (5 digitos)`
      }
    }

    // Detectar confirmacion de direccion validada
    if (newCollectedData._pendingValidatedAddress && !gptResponse.validateAddress) {
      const msgLower = messageBody.toLowerCase().trim()
      const confirmed = ['si', 'sí', 'ok', 'correcto', 'correcta', 'yes', 'esta bien', 'esa es', 'esa misma'].some(
        word => msgLower === word || msgLower.startsWith(word + ' ') || msgLower.endsWith(' ' + word)
      )
      const denied = ['no', 'incorrecta', 'incorrecto', 'otra', 'cambiar'].some(
        word => msgLower === word || msgLower.startsWith(word + ' ')
      )

      if (confirmed) {
        // Guardar la direccion validada
        const validatedAddr = newCollectedData._pendingValidatedAddress as {
          formatted: string
          street: string
          city: string
          state: string
          zipcode: string
          latitude: number
          longitude: number
        }
        newCollectedData.senderAddress = validatedAddr.formatted
        newCollectedData._addressValidated = true
        newCollectedData._addressCoordinates = {
          latitude: validatedAddr.latitude,
          longitude: validatedAddr.longitude
        }
        delete newCollectedData._pendingValidatedAddress
        console.log('[WhatsApp Agent] Direccion confirmada:', validatedAddr.formatted)
        response = 'Perfecto! Direccion confirmada. Ahora necesito el codigo o PIN para entrar al edificio. Si no hay, dime "no hay".'
      } else if (denied) {
        delete newCollectedData._pendingValidatedAddress
        response = 'Ok, dame la direccion correcta por favor.'
      }
    }

    // Mostrar fechas disponibles si GPT lo solicita
    if (gptResponse.getAvailableDates) {
      console.log('[WhatsApp Agent] GPT solicita mostrar fechas disponibles')
      const availableDates = getAvailableDates()
      response = formatAvailableDatesMessage(availableDates)
      // Guardar fechas disponibles para referencia al parsear la respuesta del usuario
      newCollectedData._availableDates = availableDates
    }

    // Manejar selección de fecha inteligente
    if (gptResponse.selectDate) {
      console.log('[WhatsApp Agent] GPT solicita procesar fecha:', gptResponse.selectDate)
      const preferredSlot = gptResponse.extractedData?.preferredSlot as string | undefined
      const dateResult = parseUserDateExpression(gptResponse.selectDate, preferredSlot)

      if (dateResult.success && dateResult.date && dateResult.dayName) {
        if (dateResult.selectedSlot) {
          // Fecha y horario seleccionados
          newCollectedData.scheduledDate = dateResult.date
          newCollectedData.timeSlot = dateResult.selectedSlot
          const slotName = dateResult.selectedSlot.includes('8:00 AM') ? 'en la mañana' :
                           dateResult.selectedSlot.includes('12:00 PM') ? 'en la tarde' : 'en la noche'
          response = `Perfecto! Pasamos ${dateResult.dayName.toLowerCase()} (${dateResult.date}) ${slotName}. Dejame confirmar los datos...`
          // Solicitar mostrar resumen
          gptResponse.requestSummary = true
        } else if (dateResult.slots) {
          // Fecha seleccionada pero falta horario
          response = formatSlotSelectionMessage(dateResult.dayName, dateResult.date, dateResult.slots)
          newCollectedData._pendingDate = dateResult.date
          newCollectedData._pendingDayName = dateResult.dayName
        }
      } else {
        // Error con sugerencia
        if (dateResult.suggestion) {
          const slotName = dateResult.suggestion.slot.includes('8:00 AM') ? 'en la mañana' :
                           dateResult.suggestion.slot.includes('12:00 PM') ? 'en la tarde' : 'en la noche'
          response = `${dateResult.error} Te puedo ofrecer ${dateResult.suggestion.dayName} ${slotName}. Que te parece?`
          newCollectedData._suggestedDate = dateResult.suggestion.date
          newCollectedData._suggestedSlot = dateResult.suggestion.slot
        } else {
          response = dateResult.error || 'No entendi la fecha. Puedes decirme cuando prefieres?'
        }
      }
    }

    // Validar provincia/municipio de Cuba si se extrae
    if (gptResponse.extractedData?.recipientProvince) {
      const province = String(gptResponse.extractedData.recipientProvince)
      const validatedProvince = validateProvince(province)

      if (!validatedProvince) {
        // Provincia no válida - buscar sugerencia
        const suggestion = findClosestMatch(province, CUBA_PROVINCES)
        if (suggestion) {
          response = `No encontre "${province}". Quisiste decir "${suggestion}"?`
        } else {
          response = `No reconozco esa provincia. Las provincias de Cuba son: La Habana, Matanzas, Santiago de Cuba, Holguin...`
        }
        // No guardar la provincia inválida
        delete newCollectedData.recipientProvince
      } else {
        // Provincia válida - guardar el nombre correcto
        newCollectedData.recipientProvince = validatedProvince
      }
    }

    if (gptResponse.extractedData?.recipientMunicipality && newCollectedData.recipientProvince) {
      const province = String(newCollectedData.recipientProvince)
      const municipality = String(gptResponse.extractedData.recipientMunicipality)
      const validation = validateCubaAddress(province, municipality)

      if (!validation.valid && validation.error) {
        response = validation.error
        // No guardar el municipio inválido
        delete newCollectedData.recipientMunicipality
      } else if (validation.municipality) {
        // Municipio válido - guardar el nombre correcto
        newCollectedData.recipientMunicipality = validation.municipality
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

    // Parsear seleccion de fecha si hay fechas disponibles guardadas
    if (newCollectedData._availableDates && !newCollectedData.scheduledDate) {
      const availableDates = newCollectedData._availableDates as { date: string; dayName: string; slots: string[] }[]
      const msgLower = messageBody.toLowerCase()

      // Intentar parsear formato "1-2" (fecha-horario)
      const numericMatch = msgLower.match(/(\d)-(\d)/)
      if (numericMatch) {
        const dateIdx = parseInt(numericMatch[1]) - 1
        const slotIdx = parseInt(numericMatch[2]) - 1
        if (availableDates[dateIdx] && availableDates[dateIdx].slots[slotIdx]) {
          newCollectedData.scheduledDate = availableDates[dateIdx].date
          newCollectedData.timeSlot = availableDates[dateIdx].slots[slotIdx]
          delete newCollectedData._availableDates
          console.log('[WhatsApp Agent] Fecha seleccionada:', newCollectedData.scheduledDate, newCollectedData.timeSlot)
        }
      }

      // Intentar parsear texto natural
      if (!newCollectedData.scheduledDate) {
        // Detectar dia
        let selectedDateIdx = -1
        if (msgLower.includes('hoy')) {
          selectedDateIdx = availableDates.findIndex(d => d.dayName === 'Hoy')
        } else if (msgLower.includes('mañana') || msgLower.includes('manana')) {
          selectedDateIdx = availableDates.findIndex(d => d.dayName === 'Manana')
        } else if (msgLower.includes('lunes')) {
          selectedDateIdx = availableDates.findIndex(d => d.dayName === 'Lunes')
        } else if (msgLower.includes('martes')) {
          selectedDateIdx = availableDates.findIndex(d => d.dayName === 'Martes')
        } else if (msgLower.includes('miercoles') || msgLower.includes('miércoles')) {
          selectedDateIdx = availableDates.findIndex(d => d.dayName === 'Miercoles')
        } else if (msgLower.includes('jueves')) {
          selectedDateIdx = availableDates.findIndex(d => d.dayName === 'Jueves')
        } else if (msgLower.includes('viernes')) {
          selectedDateIdx = availableDates.findIndex(d => d.dayName === 'Viernes')
        } else if (msgLower.includes('sabado') || msgLower.includes('sábado')) {
          selectedDateIdx = availableDates.findIndex(d => d.dayName === 'Sabado')
        } else if (msgLower.includes('domingo')) {
          selectedDateIdx = availableDates.findIndex(d => d.dayName === 'Domingo')
        }

        // Detectar horario
        let selectedSlot = ''
        if (msgLower.includes('mañana') && !msgLower.includes('manana')) {
          // "mañana" como hora del dia, no como "tomorrow"
          selectedSlot = '8:00 AM - 12:00 PM'
        } else if (msgLower.includes('temprano') || (msgLower.includes('manana') && selectedDateIdx >= 0)) {
          // Si dice "mañana temprano" = tomorrow morning
          if (selectedDateIdx >= 0) {
            selectedSlot = '8:00 AM - 12:00 PM'
          }
        }
        if (msgLower.includes('tarde')) {
          selectedSlot = '12:00 PM - 4:00 PM'
        } else if (msgLower.includes('noche')) {
          selectedSlot = '4:00 PM - 8:00 PM'
        }

        // Si encontro ambos, guardar
        if (selectedDateIdx >= 0 && selectedSlot) {
          // Verificar que el slot este disponible para esa fecha
          if (availableDates[selectedDateIdx].slots.includes(selectedSlot)) {
            newCollectedData.scheduledDate = availableDates[selectedDateIdx].date
            newCollectedData.timeSlot = selectedSlot
            delete newCollectedData._availableDates
            console.log('[WhatsApp Agent] Fecha seleccionada (texto):', newCollectedData.scheduledDate, newCollectedData.timeSlot)
          }
        }
      }
    }

    // Mostrar resumen si GPT lo solicita O si tenemos todos los datos
    if (gptResponse.requestSummary && newFlow) {
      if (newFlow === 'pickup_order') {
        const validation = validatePickupData(newCollectedData)

        // Mostrar resumen si tenemos los datos minimos
        if (validation.minimumMet) {
          console.log('[WhatsApp Agent] Mostrando resumen con datos minimos OK')
          response = generateDataSummary(newCollectedData, newFlow)
        } else {
          console.log('[WhatsApp Agent] Faltan datos minimos para resumen:', validation.missing)
          // Pedir el primer dato faltante (solo minimos)
          const fieldNames: Record<string, string> = {
            senderName: 'tu nombre completo',
            senderAddress: 'la direccion de recogida',
            recipientName: 'el nombre de quien recibe en Cuba',
            recipientPhone: 'el telefono del destinatario en Cuba',
            recipientProvince: 'la provincia en Cuba',
            recipientMunicipality: 'el municipio',
            scheduledDate: 'que dia quieres que pasemos',
            timeSlot: 'a que hora prefieres'
          }
          const firstMissing = validation.missing[0]
          response = `Me falta ${fieldNames[firstMissing] || firstMissing}. Me lo puedes dar?`
        }
      } else if (newFlow === 'remittance_order') {
        // Solo validar remesa si estamos explícitamente en ese flujo
        const validation = validateRemittanceData(newCollectedData)
        if (validation.valid) {
          response = generateDataSummary(newCollectedData, newFlow)
        } else {
          const firstMissing = validation.missing[0]
          response = `Me falta ${firstMissing}. Cual es?`
        }
      }
      // Si newFlow es 'idle' pero pidió summary, ignorar (no debería pasar)
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
        console.log('[WhatsApp Agent] minimumMet:', validation.minimumMet)
        console.log('[WhatsApp Agent] missing:', validation.missing)

        // Crear orden si tenemos los datos MINIMOS (aunque falten opcionales)
        if (validation.minimumMet) {
          console.log('[WhatsApp Agent] Creando orden de recogida (datos minimos OK)...')
          const result = await createPickupOrder(newCollectedData, phoneNumber)
          console.log('[WhatsApp Agent] Resultado createPickupOrder:', result)

          if (result.success && result.orderId) {
            orderCreated = true
            orderId = result.orderId
            orderNumber = result.orderNumber
            response = `Listo! Ya quedo registrada tu orden ${orderNumber}. Te llamamos para coordinar la recogida. Gracias!`
            // Marcar conversacion como completada
            await markConversationCompleted(conversation.id, result.orderId, 'pickup')
          } else {
            console.error('[WhatsApp Agent] Error creando orden:', result.error)
            response = 'Uy perdon, se me trabo el sistema. Puedes decirme los datos otra vez?'
          }
        } else {
          console.log('[WhatsApp Agent] Faltan datos minimos:', validation.missing)
          // Informar que datos faltan
          const fieldNames: Record<string, string> = {
            senderName: 'tu nombre',
            senderAddress: 'tu direccion',
            recipientName: 'nombre del destinatario',
            recipientPhone: 'telefono de Cuba',
            recipientProvince: 'provincia',
            recipientMunicipality: 'municipio',
            scheduledDate: 'fecha de recogida',
            timeSlot: 'horario'
          }
          const missingNames = validation.missing.map(f => fieldNames[f] || f).slice(0, 2)
          response = `Me falta ${missingNames.join(' y ')} para crear la orden. Me lo puedes dar?`
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
            // Marcar conversacion como completada
            await markConversationCompleted(conversation.id, result.orderId, 'remittance')
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
