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
  currency?: string          // USD, CUP, etc
  amountTendered?: number    // Para efectivo: cuánto entregó el cliente
  changeAmount?: number      // Para efectivo: cambio devuelto
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

  // Exchange rate
  exchangeRate?: number      // Tasa USD -> CUP
  exchangeCurrency?: string  // Moneda local (CUP por defecto)
  totalInLocalCurrency?: number // Total en moneda local

  // Customer info
  customerName?: string

  // Footer
  footerText?: string
  thankYouMessage?: string
  orderNumber?: string       // Número de orden para código de barras
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

  // Helper to format local currency
  const localCurrency = data.exchangeCurrency || 'CUP'
  const formatLocalCurrency = (amount: number): string => {
    return `${Math.round(amount).toLocaleString('es-ES')} ${localCurrency}`
  }

  // Initialize printer
  lines.push(Commands.INIT)

  // Set left margin for proper centering on 80mm paper
  // GS L nL nH - Sets left margin in dots (at 203 DPI, 8 dots = 1mm)
  // Setting ~6mm margin (48 dots) to center content
  lines.push(`${GS}L\x30\x00`) // Left margin = 48 dots (~6mm)

  // Header - Terminal name (tamaño normal para que quepa) y empresa
  lines.push(Commands.ALIGN_CENTER)
  lines.push(Commands.BOLD_ON)
  // Usar nombre del terminal si está disponible, sino el de la empresa
  const headerName = data.terminalName || data.companyName
  lines.push(headerName)
  lines.push(Commands.FEED_LINE)
  lines.push(Commands.BOLD_OFF)

  // Si hay terminal, mostrar empresa debajo
  if (data.terminalName && data.companyName) {
    lines.push(data.companyName)
    lines.push(Commands.FEED_LINE)
  }

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

  if (data.cashierName) {
    lines.push(`Cajero: ${data.cashierName}`)
    lines.push(Commands.FEED_LINE)
  }

  if (data.customerName) {
    lines.push(`Cliente: ${data.customerName}`)
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

  // Total in local currency (CUP) if exchange rate provided
  if (data.exchangeRate && data.exchangeRate > 0) {
    const totalLocal = data.totalInLocalCurrency ?? Math.round(data.total * data.exchangeRate)
    lines.push(Commands.ALIGN_RIGHT)
    lines.push(formatLocalCurrency(totalLocal))
    lines.push(Commands.FEED_LINE)
    lines.push(Commands.ALIGN_LEFT)
  }

  // Exchange rate info
  if (data.exchangeRate && data.exchangeRate > 0) {
    lines.push(Commands.ALIGN_CENTER)
    lines.push(`Tasa: 1 USD = ${data.exchangeRate.toLocaleString('es-ES')} ${localCurrency}`)
    lines.push(Commands.FEED_LINE)
    lines.push(Commands.ALIGN_LEFT)
  }

  // Payments
  lines.push(THIN_SEPARATOR)
  lines.push(Commands.FEED_LINE)
  lines.push(Commands.BOLD_ON)
  lines.push('FORMA DE PAGO')
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)
  lines.push(THIN_SEPARATOR)
  lines.push(Commands.FEED_LINE)

  for (const payment of data.payments) {
    const currency = payment.currency || 'USD'

    // Método de pago: solo $ y número (sin símbolo de moneda)
    lines.push(formatLine(payment.method + ':', formatCurrency(payment.amount), PAPER_WIDTH))
    lines.push(Commands.FEED_LINE)

    // Para efectivo, mostrar monto entregado y cambio CON símbolo de moneda
    if (payment.amountTendered !== undefined && payment.amountTendered > 0) {
      const tenderedStr = currency === 'CUP' || currency === localCurrency
        ? formatLocalCurrency(payment.amountTendered)
        : `${formatCurrency(payment.amountTendered)} USD`
      lines.push(formatLine('  Entregado:', tenderedStr, PAPER_WIDTH))
      lines.push(Commands.FEED_LINE)

      if (payment.changeAmount !== undefined && payment.changeAmount > 0) {
        const changeStr = currency === 'CUP' || currency === localCurrency
          ? formatLocalCurrency(payment.changeAmount)
          : `${formatCurrency(payment.changeAmount)} USD`
        lines.push(Commands.BOLD_ON)
        lines.push(formatLine('  Cambio:', changeStr, PAPER_WIDTH))
        lines.push(Commands.BOLD_OFF)
        lines.push(Commands.FEED_LINE)
      }
    }
  }

  // Legacy change field (if not using per-payment change)
  if (data.change !== undefined && data.change > 0 && !data.payments.some(p => p.changeAmount)) {
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

  // Barcode with order number for returns
  const barcodeData = data.orderNumber || data.receiptNumber
  if (barcodeData) {
    lines.push(Commands.FEED_LINE)
    lines.push(Commands.ALIGN_CENTER)

    // Limpiar datos para CODE39 (solo alfanuméricos y algunos símbolos)
    const barcodeContent = barcodeData.replace(/[^A-Z0-9\-\.\ \$\/\+\%]/gi, '').toUpperCase()

    if (barcodeContent.length > 0) {
      // ESC/POS Barcode settings
      // GS h n - Set barcode height (n = 1-255 dots)
      lines.push(`${GS}h\x40`) // height = 64 dots (~8mm)

      // GS w n - Set barcode width (n = 2-6)
      lines.push(`${GS}w\x02`) // width = 2 (narrow)

      // GS H n - Set HRI position (0=none, 1=above, 2=below, 3=both)
      lines.push(`${GS}H\x02`) // HRI below barcode

      // GS f n - Set HRI font (0=Font A, 1=Font B)
      lines.push(`${GS}f\x00`) // Font A for HRI

      // Print CODE39 barcode (more compatible than CODE128)
      // GS k m d1...dk NUL
      // m = 4 for CODE39
      lines.push(`${GS}k\x04${barcodeContent}\x00`)

      lines.push(Commands.FEED_LINE)
    }

    // También imprimir el número como texto por si el código de barras falla
    lines.push(barcodeData)
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
