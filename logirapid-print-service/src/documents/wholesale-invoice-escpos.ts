/**
 * Wholesale Invoice ESC/POS Generator - Generates ESC/POS commands for thermal printers (80mm)
 * For printing wholesale (mayorista) invoices on thermal receipt printers
 */

interface InvoiceLine {
  productName: string
  productSku: string | null
  quantity: number
  unitPrice: number
  discountPercent: number
  discountAmount: number
  subtotal: number
}

interface WholesaleInvoiceData {
  invoiceNumber: string
  customer: {
    code: string
    name: string
    taxId?: string
    address?: string
    phone?: string
  }
  warehouseName?: string | null
  lines: InvoiceLine[]
  subtotal: number
  discountPercent: number
  discountAmount: number
  totalAmount: number
  amountPaid: number
  amountDue: number
  currency: string
  status: string
  paymentStatus: string
  dueDate?: string | null
  createdAt: string
  notes?: string
  companyName?: string
}

// ESC/POS Commands
const ESC = '\x1b'
const GS = '\x1d'
const LF = '\x0a'

const Commands = {
  INIT: `${ESC}@`,
  CUT: `${GS}V\x00`,
  PARTIAL_CUT: `${GS}V\x01`,

  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  ALIGN_RIGHT: `${ESC}a\x02`,

  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  DOUBLE_HEIGHT_ON: `${GS}!\x10`,
  DOUBLE_WIDTH_ON: `${GS}!\x20`,
  DOUBLE_SIZE_ON: `${GS}!\x30`,
  NORMAL_SIZE: `${GS}!\x00`,
  UNDERLINE_ON: `${ESC}-\x01`,
  UNDERLINE_OFF: `${ESC}-\x00`,

  FEED_LINE: LF,
  FEED_LINES: (n: number) => `${ESC}d${String.fromCharCode(n)}`
}

export function generateWholesaleInvoiceEscpos(data: WholesaleInvoiceData): Buffer {
  const lines: string[] = []

  const PAPER_WIDTH = 42
  const SEPARATOR = '='.repeat(PAPER_WIDTH)
  const THIN_SEPARATOR = '-'.repeat(PAPER_WIDTH)

  const companyName = data.companyName || 'LogiRapid'
  const invoiceNumber = data.invoiceNumber || 'Sin numero'
  const dateStr = formatDate(data.createdAt)
  const currencySymbol = data.currency === 'USD' ? '$' : data.currency

  // Initialize printer
  lines.push(Commands.INIT)
  lines.push(`${GS}L\x30\x00`)

  // === HEADER ===
  lines.push(Commands.ALIGN_CENTER)
  lines.push(Commands.BOLD_ON)
  lines.push(Commands.DOUBLE_HEIGHT_ON)
  lines.push('FACTURA MAYORISTA')
  lines.push(Commands.NORMAL_SIZE)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  lines.push(companyName)
  lines.push(Commands.FEED_LINE)

  lines.push(SEPARATOR)
  lines.push(Commands.FEED_LINE)

  // === INVOICE INFO ===
  lines.push(Commands.ALIGN_LEFT)
  lines.push(Commands.BOLD_ON)
  lines.push(`Factura: ${invoiceNumber}`)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  lines.push(`Fecha: ${dateStr}`)
  lines.push(Commands.FEED_LINE)

  if (data.warehouseName) {
    lines.push(`Almacen: ${data.warehouseName}`)
    lines.push(Commands.FEED_LINE)
  }

  lines.push(THIN_SEPARATOR)
  lines.push(Commands.FEED_LINE)

  // === CUSTOMER INFO ===
  lines.push(Commands.BOLD_ON)
  lines.push('CLIENTE')
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  lines.push(data.customer.name)
  lines.push(Commands.FEED_LINE)

  if (data.customer.code) {
    lines.push(`Codigo: ${data.customer.code}`)
    lines.push(Commands.FEED_LINE)
  }

  if (data.customer.taxId) {
    lines.push(`NIT/CI: ${data.customer.taxId}`)
    lines.push(Commands.FEED_LINE)
  }

  if (data.customer.address) {
    const addrLines = wordWrap(data.customer.address, PAPER_WIDTH)
    for (const addrLine of addrLines) {
      lines.push(addrLine)
      lines.push(Commands.FEED_LINE)
    }
  }

  if (data.customer.phone) {
    lines.push(`Tel: ${data.customer.phone}`)
    lines.push(Commands.FEED_LINE)
  }

  lines.push(THIN_SEPARATOR)
  lines.push(Commands.FEED_LINE)

  // === ITEMS TABLE ===
  lines.push(Commands.BOLD_ON)
  lines.push(formatLine('CANT  DESCRIPCION', 'TOTAL', PAPER_WIDTH))
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)
  lines.push(THIN_SEPARATOR)
  lines.push(Commands.FEED_LINE)

  for (const item of data.lines) {
    const itemName = item.productName || 'Producto sin nombre'
    const qtyStr = (item.quantity ?? 0).toString().padStart(2)
    const totalStr = formatCurrency(item.subtotal, currencySymbol)
    const maxNameLen = PAPER_WIDTH - 6 - totalStr.length - 2

    const displayName = itemName.length > maxNameLen
      ? itemName.substring(0, maxNameLen - 2) + '..'
      : itemName

    const itemLine = `${qtyStr} x ${displayName}`
    lines.push(formatLine(itemLine, totalStr, PAPER_WIDTH))
    lines.push(Commands.FEED_LINE)

    // Show unit price below
    const priceDetail = `     ${formatCurrency(item.unitPrice, currencySymbol)} c/u`
    if (item.discountPercent > 0) {
      lines.push(formatLine(priceDetail, `-${item.discountPercent}%`, PAPER_WIDTH))
    } else {
      lines.push(priceDetail)
    }
    lines.push(Commands.FEED_LINE)
  }

  lines.push(THIN_SEPARATOR)
  lines.push(Commands.FEED_LINE)

  // === TOTALS ===
  lines.push(formatLine('Subtotal:', formatCurrency(data.subtotal, currencySymbol), PAPER_WIDTH))
  lines.push(Commands.FEED_LINE)

  if (data.discountAmount > 0) {
    lines.push(formatLine(`Descuento (${data.discountPercent}%):`, `-${formatCurrency(data.discountAmount, currencySymbol)}`, PAPER_WIDTH))
    lines.push(Commands.FEED_LINE)
  }

  lines.push(SEPARATOR)
  lines.push(Commands.FEED_LINE)
  lines.push(Commands.BOLD_ON)
  lines.push(Commands.DOUBLE_HEIGHT_ON)
  lines.push(formatLine('TOTAL:', formatCurrency(data.totalAmount, currencySymbol), Math.floor(PAPER_WIDTH / 2)))
  lines.push(Commands.NORMAL_SIZE)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  // === PAYMENT STATUS ===
  lines.push(THIN_SEPARATOR)
  lines.push(Commands.FEED_LINE)

  if (data.amountPaid > 0) {
    lines.push(formatLine('Pagado:', formatCurrency(data.amountPaid, currencySymbol), PAPER_WIDTH))
    lines.push(Commands.FEED_LINE)
  }

  if (data.amountDue > 0) {
    lines.push(Commands.BOLD_ON)
    lines.push(formatLine('PENDIENTE:', formatCurrency(data.amountDue, currencySymbol), PAPER_WIDTH))
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)
  }

  const paymentLabel = data.paymentStatus === 'paid' ? 'PAGADO'
    : data.paymentStatus === 'partial' ? 'PAGO PARCIAL'
    : data.paymentStatus === 'overdue' ? 'VENCIDO'
    : 'PENDIENTE'
  lines.push(`Estado pago: ${paymentLabel}`)
  lines.push(Commands.FEED_LINE)

  if (data.dueDate) {
    lines.push(`Vencimiento: ${formatDate(data.dueDate)}`)
    lines.push(Commands.FEED_LINE)
  }

  // === NOTES ===
  if (data.notes) {
    lines.push(THIN_SEPARATOR)
    lines.push(Commands.FEED_LINE)
    lines.push('Notas:')
    lines.push(Commands.FEED_LINE)
    const noteLines = wordWrap(data.notes, PAPER_WIDTH)
    for (const noteLine of noteLines) {
      lines.push(noteLine)
      lines.push(Commands.FEED_LINE)
    }
  }

  // === BARCODE with invoice number ===
  const barcodeData = invoiceNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase()
  if (barcodeData.length > 0 && barcodeData.length <= 20) {
    lines.push(Commands.FEED_LINE)
    lines.push(Commands.ALIGN_CENTER)

    lines.push(`${GS}h\x40`) // height = 64 dots
    lines.push(`${GS}w\x02`) // width = 2
    lines.push(`${GS}H\x02`) // HRI below barcode
    lines.push(`${GS}f\x00`) // Font A for HRI

    lines.push(`${GS}k\x04${barcodeData}\x00`)
    lines.push(Commands.FEED_LINE)

    lines.push(invoiceNumber)
    lines.push(Commands.FEED_LINE)
  }

  // === FOOTER ===
  lines.push(Commands.FEED_LINE)
  lines.push(Commands.ALIGN_CENTER)
  lines.push('--- Documento generado por LogiRapid ---')
  lines.push(Commands.FEED_LINE)

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

function formatCurrency(amount: number, symbol: string = '$'): string {
  return symbol + amount.toFixed(2)
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  } catch {
    return dateStr
  }
}

function wordWrap(text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const result: string[] = []
  let currentLine = ''

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word
    } else {
      if (currentLine) result.push(currentLine)
      currentLine = word
    }
  }
  if (currentLine) result.push(currentLine)

  return result
}

export type { WholesaleInvoiceData, InvoiceLine as WholesaleInvoiceLine }
