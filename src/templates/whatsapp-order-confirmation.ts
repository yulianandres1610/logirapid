// WhatsApp Order Confirmation Templates

export interface OrderConfirmationData {
  orderNumber: string
  customerName: string
  orderType: 'pickup' | 'delivery' | 'office'
  scheduledDate: string
  timeSlot: string
  address: string
  boxCount: number
  services?: { name: string; quantity: number }[]
  totalAmount?: number
  trackingUrl?: string
  companyName?: string
  companyPhone?: string
}

// Mapeo de timeSlots a texto legible
const timeSlotLabels: Record<string, string> = {
  'morning': '8:00 AM - 12:00 PM',
  'afternoon': '12:00 PM - 5:00 PM',
  'evening': '5:00 PM - 8:00 PM',
  'all_day': '8:00 AM - 8:00 PM'
}

// Mapeo de tipos de orden
const orderTypeLabels: Record<string, { emoji: string; label: string }> = {
  'pickup': { emoji: '📦', label: 'Recogida' },
  'delivery': { emoji: '🚚', label: 'Entrega' },
  'office': { emoji: '🏢', label: 'Oficina' }
}

/**
 * Template 1: Moderno y Minimalista
 */
export function generateModernTemplate(data: OrderConfirmationData): string {
  const orderInfo = orderTypeLabels[data.orderType] || orderTypeLabels['pickup']
  const timeSlotText = timeSlotLabels[data.timeSlot] || data.timeSlot

  let message = `━━━━━━━━━━━━━━━━━━━━
${orderInfo.emoji} *ORDEN CONFIRMADA*
━━━━━━━━━━━━━━━━━━━━

Hola *${data.customerName}* 👋

Tu orden ha sido registrada exitosamente.

📋 *Detalles de la Orden*
├ Numero: \`${data.orderNumber}\`
├ Tipo: ${orderInfo.label}
├ Fecha: ${data.scheduledDate}
├ Horario: ${timeSlotText}
└ Cajas: ${data.boxCount}

📍 *Direccion*
${data.address}`

  if (data.services && data.services.length > 0) {
    message += `

🛍️ *Servicios*`
    data.services.forEach((service, index) => {
      const isLast = index === data.services!.length - 1
      message += `
${isLast ? '└' : '├'} ${service.name} x${service.quantity}`
    })
  }

  if (data.totalAmount) {
    message += `

💰 *Total: $${data.totalAmount.toFixed(2)}*`
  }

  if (data.trackingUrl) {
    message += `

🔗 *Rastrea tu orden:*
${data.trackingUrl}`
  }

  message += `

━━━━━━━━━━━━━━━━━━━━
${data.companyName || 'LogiRapid'} ✨
${data.companyPhone ? `📞 ${data.companyPhone}` : ''}
━━━━━━━━━━━━━━━━━━━━`

  return message
}

/**
 * Template 2: Compacto con Iconos
 */
export function generateCompactTemplate(data: OrderConfirmationData): string {
  const orderInfo = orderTypeLabels[data.orderType] || orderTypeLabels['pickup']
  const timeSlotText = timeSlotLabels[data.timeSlot] || data.timeSlot

  let message = `✅ *Orden Confirmada*

Hola ${data.customerName}! Tu ${orderInfo.label.toLowerCase()} esta programada.

📦 \`${data.orderNumber}\`
📅 ${data.scheduledDate}
⏰ ${timeSlotText}
📍 ${data.address}
📦 ${data.boxCount} ${data.boxCount === 1 ? 'caja' : 'cajas'}`

  if (data.totalAmount) {
    message += `
💵 $${data.totalAmount.toFixed(2)}`
  }

  if (data.trackingUrl) {
    message += `

🔍 Rastrea aqui: ${data.trackingUrl}`
  }

  message += `

_${data.companyName || 'LogiRapid'}_`

  return message
}

/**
 * Template 3: Premium con Gradiente Visual
 */
export function generatePremiumTemplate(data: OrderConfirmationData): string {
  const orderInfo = orderTypeLabels[data.orderType] || orderTypeLabels['pickup']
  const timeSlotText = timeSlotLabels[data.timeSlot] || data.timeSlot

  let message = `┏━━━━━━━━━━━━━━━━━━━┓
┃  ✨ *CONFIRMACION* ✨  ┃
┗━━━━━━━━━━━━━━━━━━━┛

Hola *${data.customerName}*,
Gracias por tu confianza 🙏

▸ *Orden:* \`${data.orderNumber}\`
▸ *Tipo:* ${orderInfo.emoji} ${orderInfo.label}
▸ *Fecha:* 📅 ${data.scheduledDate}
▸ *Hora:* ⏰ ${timeSlotText}
▸ *Cajas:* 📦 ${data.boxCount}

📍 *Direccion de ${orderInfo.label}*
_${data.address}_`

  if (data.services && data.services.length > 0) {
    message += `

🎁 *Servicios Incluidos*`
    data.services.forEach(service => {
      message += `
   • ${service.name} (${service.quantity})`
    })
  }

  if (data.totalAmount) {
    message += `

┏━━━━━━━━━━━━━━━━━━━┓
┃ 💎 *TOTAL: $${data.totalAmount.toFixed(2)}* 💎 ┃
┗━━━━━━━━━━━━━━━━━━━┛`
  }

  if (data.trackingUrl) {
    message += `

🔗 *Seguimiento en vivo:*
${data.trackingUrl}`
  }

  message += `

━━━━━━━━━━━━━━━━━━━━━
${data.companyName || 'LogiRapid'} 🚀
_Entregas rapidas y seguras_
${data.companyPhone ? `📱 ${data.companyPhone}` : ''}`

  return message
}

/**
 * Template 4: Simple y Limpio
 */
export function generateSimpleTemplate(data: OrderConfirmationData): string {
  const orderInfo = orderTypeLabels[data.orderType] || orderTypeLabels['pickup']
  const timeSlotText = timeSlotLabels[data.timeSlot] || data.timeSlot

  let message = `🎉 *Orden Confirmada*

${data.customerName}, tu orden esta lista.

*${data.orderNumber}*
${orderInfo.emoji} ${orderInfo.label}
📅 ${data.scheduledDate} | ⏰ ${timeSlotText}
📍 ${data.address}
📦 ${data.boxCount} ${data.boxCount === 1 ? 'caja' : 'cajas'}`

  if (data.totalAmount) {
    message += `
💰 Total: *$${data.totalAmount.toFixed(2)}*`
  }

  if (data.trackingUrl) {
    message += `

Rastrea tu envio 👇
${data.trackingUrl}`
  }

  message += `

—
${data.companyName || 'LogiRapid'} ✓`

  return message
}

/**
 * Template 5: Con Lista de Verificacion
 */
export function generateChecklistTemplate(data: OrderConfirmationData): string {
  const orderInfo = orderTypeLabels[data.orderType] || orderTypeLabels['pickup']
  const timeSlotText = timeSlotLabels[data.timeSlot] || data.timeSlot

  let message = `☑️ *ORDEN REGISTRADA*

Hola *${data.customerName}*!

Tu solicitud fue procesada correctamente:

✅ Orden: \`${data.orderNumber}\`
✅ Tipo: ${orderInfo.emoji} ${orderInfo.label}
✅ Fecha: ${data.scheduledDate}
✅ Horario: ${timeSlotText}
✅ Direccion: ${data.address}
✅ Cantidad: ${data.boxCount} ${data.boxCount === 1 ? 'caja' : 'cajas'}`

  if (data.totalAmount) {
    message += `
✅ Total: $${data.totalAmount.toFixed(2)}`
  }

  message += `

⏳ *Proximos pasos:*
1️⃣ Nuestro equipo te contactara
2️⃣ Confirmacion de recogida
3️⃣ Actualizaciones en tiempo real`

  if (data.trackingUrl) {
    message += `

🔗 Seguimiento: ${data.trackingUrl}`
  }

  message += `

${data.companyName || 'LogiRapid'} 📦✨`

  return message
}

/**
 * Template 6: Elegante con Bordes
 */
export function generateElegantTemplate(data: OrderConfirmationData): string {
  const orderInfo = orderTypeLabels[data.orderType] || orderTypeLabels['pickup']
  const timeSlotText = timeSlotLabels[data.timeSlot] || data.timeSlot

  let message = `╔═══════════════════╗
║  📬 *CONFIRMADO*  ║
╚═══════════════════╝

Estimado/a *${data.customerName}*,

Su orden ha sido procesada.

▪️ *Referencia*
   ${data.orderNumber}

▪️ *Servicio*
   ${orderInfo.emoji} ${orderInfo.label}

▪️ *Programacion*
   📅 ${data.scheduledDate}
   ⏰ ${timeSlotText}

▪️ *Ubicacion*
   📍 ${data.address}

▪️ *Paquetes*
   📦 ${data.boxCount} unidad${data.boxCount !== 1 ? 'es' : ''}`

  if (data.totalAmount) {
    message += `

▪️ *Importe*
   💵 $${data.totalAmount.toFixed(2)}`
  }

  if (data.trackingUrl) {
    message += `

▪️ *Seguimiento*
   🔗 ${data.trackingUrl}`
  }

  message += `

╔═══════════════════╗
║ ${data.companyName || 'LogiRapid'} 🌟
║ ${data.companyPhone || ''}
╚═══════════════════╝`

  return message
}

// Exportar funcion principal que permite elegir template
export type TemplateType = 'modern' | 'compact' | 'premium' | 'simple' | 'checklist' | 'elegant'

export function generateOrderConfirmation(
  data: OrderConfirmationData,
  template: TemplateType = 'modern'
): string {
  switch (template) {
    case 'modern':
      return generateModernTemplate(data)
    case 'compact':
      return generateCompactTemplate(data)
    case 'premium':
      return generatePremiumTemplate(data)
    case 'simple':
      return generateSimpleTemplate(data)
    case 'checklist':
      return generateChecklistTemplate(data)
    case 'elegant':
      return generateElegantTemplate(data)
    default:
      return generateModernTemplate(data)
  }
}

// Ejemplo de uso:
/*
const orderData: OrderConfirmationData = {
  orderNumber: 'PICKUP-2024-0001',
  customerName: 'Maria Garcia',
  orderType: 'pickup',
  scheduledDate: '15 de Diciembre, 2024',
  timeSlot: 'morning',
  address: '123 Main St, Apt 4B, Miami, FL 33101',
  boxCount: 3,
  services: [
    { name: 'Envio Aereo', quantity: 2 },
    { name: 'Seguro Premium', quantity: 1 }
  ],
  totalAmount: 125.50,
  trackingUrl: 'https://logirapid.com/tracking/PICKUP-2024-0001',
  companyName: 'LogiRapid',
  companyPhone: '+1 (305) 555-0123'
}

const message = generateOrderConfirmation(orderData, 'modern')
console.log(message)
*/
