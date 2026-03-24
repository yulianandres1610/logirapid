/**
 * Wholesale Quote ESC/POS Generator - Thermal ticket (80mm) for quotes/offers
 */

interface QuoteLine {
  productName: string
  productSku?: string | null
  quantity: number
  unitPrice: number
  originalPrice?: number
  subtotal: number
}

interface WholesaleQuoteData {
  quoteNumber: string
  customer: {
    businessName: string
    code?: string
    taxId?: string
    address?: string
    phone?: string
    email?: string
  }
  warehouseName?: string | null
  lines: QuoteLine[]
  subtotal: number
  discountPercent: number
  discountAmount: number
  totalAmount: number
  validUntil?: string | null
  createdAt: string
  notes?: string
  exchangeRate?: number
  salesRepName?: string | null
}

const ESC = '\x1b'
const GS = '\x1d'
const LF = '\x0a'

const C = {
  INIT: `${ESC}@`,
  CUT: `${GS}V\x00`,
  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  DBL_H: `${GS}!\x10`,
  DBL_SIZE: `${GS}!\x30`,
  NORMAL: `${GS}!\x00`,
  INVERSE_ON: `${GS}B\x01`,
  INVERSE_OFF: `${GS}B\x00`,
  FEED: LF,
  FEED_N: (n: number) => `${ESC}d${String.fromCharCode(n)}`
}

const W = 42
const SEP = '='.repeat(W)
const THIN = '-'.repeat(W)

function lr(left: string, right: string): string {
  const sp = W - left.length - right.length
  return sp > 0 ? left + ' '.repeat(sp) + right : left + ' ' + right
}

function trunc(text: string, max: number = W): string {
  return text.length > max ? text.substring(0, max - 2) + '..' : text
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return iso }
}

function fmtUSD(v: number): string {
  return '$' + v.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

function barcode(data: string): string {
  const clean = data.replace(/[^\x20-\x7F]/g, '').substring(0, 20)
  if (!clean) return ''
  const out: string[] = []
  out.push(C.ALIGN_CENTER)
  out.push(`${GS}h\x30`)
  out.push(`${GS}w\x02`)
  out.push(`${GS}H\x02`)
  out.push(`${GS}f\x01`)
  out.push(`${GS}k\x49${String.fromCharCode(clean.length)}${clean}`)
  out.push(C.FEED)
  out.push(C.ALIGN_LEFT)
  return out.join('')
}

export function generateWholesaleQuoteEscpos(data: WholesaleQuoteData): Buffer {
  const l: string[] = []
  const rate = data.exchangeRate || 0
  const hasRate = rate > 0

  l.push(C.INIT)
  l.push(`${GS}L\x30\x00`)

  // === HEADER ===
  l.push(C.ALIGN_CENTER)
  l.push(C.BOLD_ON)
  l.push(C.DBL_H)
  l.push('OFERTA COMERCIAL')
  l.push(C.NORMAL)
  l.push(C.BOLD_OFF)
  l.push(C.FEED)

  l.push('SERVISUMIC S.U.R.L.')
  l.push(C.FEED)
  l.push('NIT: 50004199243')
  l.push(C.FEED)

  l.push(SEP)
  l.push(C.FEED)

  // === QUOTE INFO ===
  l.push(C.ALIGN_LEFT)
  l.push(C.BOLD_ON)
  l.push(`Oferta: ${data.quoteNumber}`)
  l.push(C.BOLD_OFF)
  l.push(C.FEED)

  l.push(`Fecha: ${fmtDate(data.createdAt)}`)
  l.push(C.FEED)

  if (data.validUntil) {
    l.push(`Valida hasta: ${fmtDate(data.validUntil)}`)
    l.push(C.FEED)
  }

  if (data.warehouseName) {
    l.push(`Almacen: ${data.warehouseName}`)
    l.push(C.FEED)
  }

  if (data.salesRepName) {
    l.push(lr('Comercial:', data.salesRepName))
    l.push(C.FEED)
  }

  l.push(THIN)
  l.push(C.FEED)

  // === CUSTOMER ===
  l.push(C.BOLD_ON)
  l.push('CLIENTE')
  l.push(C.BOLD_OFF)
  l.push(C.FEED)

  l.push(data.customer.businessName || 'Sin nombre')
  l.push(C.FEED)

  if (data.customer.code) {
    l.push(`Codigo: ${data.customer.code}`)
    l.push(C.FEED)
  }
  if (data.customer.taxId) {
    l.push(`NIT: ${data.customer.taxId}`)
    l.push(C.FEED)
  }

  l.push(THIN)
  l.push(C.FEED)

  // === PRODUCTS ===
  l.push(C.BOLD_ON)
  l.push(lr('CANT  DESCRIPCION', 'TOTAL'))
  l.push(C.BOLD_OFF)
  l.push(C.FEED)
  l.push(THIN)
  l.push(C.FEED)

  for (const item of data.lines) {
    const name = trunc(item.productName, W - 10)
    const qty = String(item.quantity).padStart(4)
    const totalUSD = fmtUSD(item.subtotal)

    l.push(lr(`${qty} x ${name}`, totalUSD))
    l.push(C.FEED)

    // Unit price USD
    l.push(`     ${fmtUSD(item.unitPrice)} c/u`)
    l.push(C.FEED)

    // Unit price CUP (rounded)
    if (hasRate) {
      const unitCup = Math.round(item.unitPrice * rate)
      const totalCup = unitCup * item.quantity
      l.push(`     ${unitCup.toLocaleString()} CUP c/u`)
      l.push(C.FEED)
      l.push(lr('', `${totalCup.toLocaleString()} CUP`))
      l.push(C.FEED)
    }
  }

  l.push(THIN)
  l.push(C.FEED)

  // === TOTALS ===
  // Subtotal
  l.push(lr('Subtotal USD:', fmtUSD(data.subtotal)))
  l.push(C.FEED)

  if (hasRate) {
    const cupSubtotal = data.lines.reduce((sum, item) => {
      return sum + Math.round(item.unitPrice * rate) * item.quantity
    }, 0)
    l.push(lr('Subtotal CUP:', `${cupSubtotal.toLocaleString()} CUP`))
    l.push(C.FEED)
  }

  // Discount
  if (data.discountPercent > 0) {
    l.push(lr(`Descuento (${data.discountPercent}%):`, `-${fmtUSD(data.discountAmount)}`))
    l.push(C.FEED)
  }

  l.push(THIN)
  l.push(C.FEED)

  // Total
  l.push(C.BOLD_ON)
  l.push(lr('TOTAL USD:', fmtUSD(data.totalAmount)))
  l.push(C.BOLD_OFF)
  l.push(C.FEED)

  if (hasRate) {
    const cupTotal = data.lines.reduce((sum, item) => {
      return sum + Math.round(item.unitPrice * rate) * item.quantity
    }, 0)
    const cupDiscount = Math.round(cupTotal * (data.discountPercent || 0) / 100)
    const cupFinal = cupTotal - cupDiscount

    l.push(C.BOLD_ON)
    l.push(lr('TOTAL CUP:', `${cupFinal.toLocaleString()} CUP`))
    l.push(C.BOLD_OFF)
    l.push(C.FEED)

    // Tax
    const TAX_RATE = 0.10
    const cupTax = Math.round(cupFinal * TAX_RATE)
    const cupGrand = cupFinal + cupTax
    l.push(lr('Impuesto (10%):', `${cupTax.toLocaleString()} CUP`))
    l.push(C.FEED)

    l.push(C.BOLD_ON)
    l.push(C.DBL_H)
    l.push(lr('TOTAL GENERAL:', `${cupGrand.toLocaleString()} CUP`))
    l.push(C.NORMAL)
    l.push(C.BOLD_OFF)
    l.push(C.FEED)
  }

  l.push(SEP)
  l.push(C.FEED)

  // === PAYMENT INFO ===
  l.push('Pagos: transferencias bancarias')
  l.push(C.FEED)
  l.push('o efectivo a favor de:')
  l.push(C.FEED)
  l.push(C.BOLD_ON)
  l.push('SERVISUMIC S.U.R.L.')
  l.push(C.BOLD_OFF)
  l.push(C.FEED)
  l.push('Cuenta: 0533445000023216')
  l.push(C.FEED)
  l.push('facturacion@servisumic.com')
  l.push(C.FEED)
  l.push('+5363707599')
  l.push(C.FEED)

  // Notes
  if (data.notes) {
    l.push(C.FEED)
    l.push(THIN)
    l.push(C.FEED)
    l.push(`Notas: ${trunc(data.notes, W - 7)}`)
    l.push(C.FEED)
  }

  // === SIGNATURES ===
  l.push(C.FEED)
  l.push(SEP)
  l.push(C.FEED)
  l.push(C.FEED)
  l.push(data.salesRepName ? `Comercial: ${data.salesRepName}` : 'Comercial:')
  l.push(C.FEED)
  l.push(THIN)
  l.push(C.FEED)
  l.push(C.FEED)
  l.push('Cliente:')
  l.push(C.FEED)
  l.push(THIN)
  l.push(C.FEED)

  // Barcode
  l.push(C.FEED)
  l.push(C.ALIGN_CENTER)
  l.push(barcode(data.quoteNumber.replace(/-/g, '')))
  l.push('--- Servisumic ---')
  l.push(C.FEED)

  l.push(C.FEED_N(4))
  l.push(C.CUT)

  return Buffer.from(l.join(''), 'binary')
}
