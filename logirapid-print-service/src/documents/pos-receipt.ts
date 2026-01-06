/**
 * POS Receipt Generator - Generates ESC/POS commands for thermal printers (80mm)
 */

interface ReceiptItem {
  name: string
  quantity: number
  price: number
  total?: number
}

interface ReceiptPayment {
  method: string
  amount: number
}

interface ReceiptData {
  // Header
  companyName: string
  companyAddress?: string
  companyPhone?: string
  companyEmail?: string
  terminalName?: string
  receiptNumber: string
  date: string
  time?: string
  cashierName?: string

  // Items
  items: ReceiptItem[]

  // Totals
  subtotal: number
  tax?: number
  taxRate?: number
  discount?: number
  discountLabel?: string
  total: number

  // Payment
  payments: ReceiptPayment[]
  change?: number

  // Footer
  footerText?: string
  thankYouMessage?: string
  barcode?: string
  qrCode?: string
}

// ESC/POS Commands
const ESC = '\x1b'
const GS = '\x1d'
const LF = '\x0a'

const Commands = {
  INIT: `${ESC}@`, // Initialize printer
  CUT: `${GS}V\x00`, // Full cut
  PARTIAL_CUT: `${GS}V\x01`, // Partial cut

  // Text alignment
  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  ALIGN_RIGHT: `${ESC}a\x02`,

  // Text formatting
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  DOUBLE_HEIGHT_ON: `${GS}!\x10`,
  DOUBLE_WIDTH_ON: `${GS}!\x20`,
  DOUBLE_SIZE_ON: `${GS}!\x30`,
  NORMAL_SIZE: `${GS}!\x00`,
  UNDERLINE_ON: `${ESC}-\x01`,
  UNDERLINE_OFF: `${ESC}-\x00`,
  INVERSE_ON: `${GS}B\x01`,
  INVERSE_OFF: `${GS}B\x00`,

  // Line spacing
  LINE_SPACING_DEFAULT: `${ESC}2`,
  LINE_SPACING: (n: number) => `${ESC}3${String.fromCharCode(n)}`,

  // Feed
  FEED_LINE: LF,
  FEED_LINES: (n: number) => `${ESC}d${String.fromCharCode(n)}`,

  // Cash drawer
  OPEN_DRAWER: `${ESC}p\x00\x19\xfa`
}

export function generatePosReceipt(data: ReceiptData): Buffer {
  const lines: string[] = []

  // Paper width for 80mm thermal printer (EPSON TM-T20III uses 42 chars with Font A)
  const PAPER_WIDTH = 42
  const SEPARATOR = '='.repeat(PAPER_WIDTH)
  const THIN_SEPARATOR = '-'.repeat(PAPER_WIDTH)

  // Initialize printer
  lines.push(Commands.INIT)

  // Set left margin for proper centering on 80mm paper
  // GS L nL nH - Sets left margin in dots (at 203 DPI, 8 dots = 1mm)
  // Setting ~6mm margin (48 dots) to center content
  lines.push(`${GS}L\x30\x00`) // Left margin = 48 dots (~6mm)

  // Header - Company info centered and bold
  lines.push(Commands.ALIGN_CENTER)
  lines.push(Commands.DOUBLE_SIZE_ON)
  lines.push(Commands.BOLD_ON)
  lines.push(data.companyName)
  lines.push(Commands.FEED_LINE)
  lines.push(Commands.NORMAL_SIZE)
  lines.push(Commands.BOLD_OFF)

  if (data.companyAddress) {
    lines.push(data.companyAddress)
    lines.push(Commands.FEED_LINE)
  }

  if (data.companyPhone) {
    lines.push(`Tel: ${data.companyPhone}`)
    lines.push(Commands.FEED_LINE)
  }

  // Separator
  lines.push(Commands.ALIGN_LEFT)
  lines.push(SEPARATOR)
  lines.push(Commands.FEED_LINE)

  // Receipt info - left aligned
  lines.push(`Recibo: ${data.receiptNumber}`)
  lines.push(Commands.FEED_LINE)
  lines.push(`Fecha: ${data.date}${data.time ? ' ' + data.time : ''}`)
  lines.push(Commands.FEED_LINE)

  if (data.terminalName) {
    lines.push(`Terminal: ${data.terminalName}`)
    lines.push(Commands.FEED_LINE)
  }

  if (data.cashierName) {
    lines.push(`Cajero: ${data.cashierName}`)
    lines.push(Commands.FEED_LINE)
  }

  // Separator
  lines.push(THIN_SEPARATOR)
  lines.push(Commands.FEED_LINE)

  // Column headers
  lines.push(Commands.BOLD_ON)
  lines.push(formatLine('CANT  DESCRIPCION', 'TOTAL', PAPER_WIDTH))
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)
  lines.push(THIN_SEPARATOR)
  lines.push(Commands.FEED_LINE)

  // Items
  for (const item of data.items) {
    const itemTotal = item.total ?? item.quantity * item.price
    const qtyStr = item.quantity.toString().padStart(2)
    const totalStr = formatCurrency(itemTotal)
    const maxNameLen = PAPER_WIDTH - 6 - totalStr.length - 2 // 6 for "XX x ", 2 for spacing

    // If item name is too long, truncate it
    const itemName = item.name.length > maxNameLen
      ? item.name.substring(0, maxNameLen - 2) + '..'
      : item.name
    const itemLine = `${qtyStr} x ${itemName}`

    lines.push(formatLine(itemLine, totalStr, PAPER_WIDTH))
    lines.push(Commands.FEED_LINE)
  }

  // Separator
  lines.push(THIN_SEPARATOR)
  lines.push(Commands.FEED_LINE)

  // Subtotal
  lines.push(formatLine('Subtotal:', formatCurrency(data.subtotal), PAPER_WIDTH))
  lines.push(Commands.FEED_LINE)

  // Tax
  if (data.tax !== undefined && data.tax > 0) {
    const taxLabel = data.taxRate ? `IVA (${data.taxRate}%):` : 'IVA:'
    lines.push(formatLine(taxLabel, formatCurrency(data.tax), PAPER_WIDTH))
    lines.push(Commands.FEED_LINE)
  }

  // Discount
  if (data.discount !== undefined && data.discount > 0) {
    const discLabel = data.discountLabel || 'Descuento:'
    lines.push(formatLine(discLabel, `-${formatCurrency(data.discount)}`, PAPER_WIDTH))
    lines.push(Commands.FEED_LINE)
  }

  // Total - bold and larger
  lines.push(SEPARATOR)
  lines.push(Commands.FEED_LINE)
  lines.push(Commands.BOLD_ON)
  lines.push(Commands.DOUBLE_HEIGHT_ON)
  // For double height, use half the width
  lines.push(formatLine('TOTAL:', formatCurrency(data.total), Math.floor(PAPER_WIDTH / 2)))
  lines.push(Commands.NORMAL_SIZE)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  // Payments
  lines.push(THIN_SEPARATOR)
  lines.push(Commands.FEED_LINE)

  for (const payment of data.payments) {
    lines.push(formatLine(payment.method + ':', formatCurrency(payment.amount), PAPER_WIDTH))
    lines.push(Commands.FEED_LINE)
  }

  // Change
  if (data.change !== undefined && data.change > 0) {
    lines.push(Commands.BOLD_ON)
    lines.push(formatLine('Cambio:', formatCurrency(data.change), PAPER_WIDTH))
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)
  }

  // Footer
  lines.push(Commands.FEED_LINES(2))
  lines.push(Commands.ALIGN_CENTER)

  if (data.thankYouMessage) {
    lines.push(data.thankYouMessage)
    lines.push(Commands.FEED_LINE)
  } else {
    lines.push('Gracias por su compra!')
    lines.push(Commands.FEED_LINE)
  }

  if (data.footerText) {
    lines.push(data.footerText)
    lines.push(Commands.FEED_LINE)
  }

  // Feed and cut
  lines.push(Commands.FEED_LINES(4))
  lines.push(Commands.CUT)

  return Buffer.from(lines.join(''), 'binary')
}

function formatLine(left: string, right: string, width: number): string {
  const spaces = width - left.length - right.length
  if (spaces < 1) {
    return left + ' ' + right
  }
  return left + ' '.repeat(spaces) + right
}

function formatCurrency(amount: number): string {
  return '$' + amount.toFixed(2)
}

export function generateOpenDrawerCommand(): Buffer {
  return Buffer.from(Commands.OPEN_DRAWER, 'binary')
}

export type { ReceiptData, ReceiptItem, ReceiptPayment }
