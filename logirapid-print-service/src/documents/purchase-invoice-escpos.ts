/**
 * Purchase Invoice ESC/POS Generator - Generates ESC/POS commands for thermal printers (80mm)
 * For printing purchase invoices on thermal receipt printers
 */

interface InvoiceItem {
  name: string
  sku?: string
  barcode?: string
  quantity: number
  unitCost: number
  total?: number
  // Variant information
  variantId?: number | null
  variantName?: string | null
  variantSku?: string | null
  variantBarcode?: string | null
}

interface PurchaseInvoiceData {
  // Header
  companyName?: string
  companyAddress?: string

  // Supplier info
  supplierName?: string
  supplierRuc?: string
  supplierAddress?: string
  supplierPhone?: string
  supplier?: {
    code?: string
    name?: string
  }

  // Invoice info
  invoiceNumber?: string
  purchaseNumber?: string
  date?: string
  purchaseDate?: string
  dueDate?: string
  receivedBy?: string
  warehouseName?: string

  // Items
  items?: InvoiceItem[]
  lines?: InvoiceItem[]

  // Totals
  subtotal?: number
  tax?: number
  taxRate?: number
  discount?: number
  shipping?: number
  total?: number
  totalCost?: number
  totalItems?: number
  totalUnits?: number

  // Payment info
  paymentMethod?: string
  paymentStatus?: string
  amountPaid?: number
  amountDue?: number

  // Notes
  notes?: string
}

// ESC/POS Commands
const ESC = '\x1b'
const GS = '\x1d'
const LF = '\x0a'

const Commands = {
  INIT: `${ESC}@`,
  CUT: `${GS}V\x00`,
  PARTIAL_CUT: `${GS}V\x01`,

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

  // Feed
  FEED_LINE: LF,
  FEED_LINES: (n: number) => `${ESC}d${String.fromCharCode(n)}`
}

export function generatePurchaseInvoiceEscpos(data: PurchaseInvoiceData): Buffer {
  const lines: string[] = []

  // Paper width for 80mm thermal printer (42 chars with Font A)
  const PAPER_WIDTH = 42
  const SEPARATOR = '='.repeat(PAPER_WIDTH)
  const THIN_SEPARATOR = '-'.repeat(PAPER_WIDTH)

  // Normalize data
  const companyName = data.companyName || 'LogiRapid'
  const supplierName = data.supplierName || data.supplier?.name || 'Proveedor'
  const supplierCode = data.supplierRuc || data.supplier?.code || ''
  const invoiceNumber = data.invoiceNumber || data.purchaseNumber || 'Sin numero'
  const dateStr = data.date || data.purchaseDate || new Date().toLocaleDateString('es-ES')
  const items = data.items || data.lines || []
  const total = data.total ?? data.totalCost ?? 0
  const subtotal = data.subtotal ?? total

  // Initialize printer
  lines.push(Commands.INIT)

  // Set left margin
  lines.push(`${GS}L\x30\x00`)

  // === HEADER ===
  lines.push(Commands.ALIGN_CENTER)
  lines.push(Commands.BOLD_ON)
  lines.push(Commands.DOUBLE_HEIGHT_ON)
  lines.push('FACTURA DE COMPRA')
  lines.push(Commands.NORMAL_SIZE)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  // Company name
  lines.push(companyName)
  lines.push(Commands.FEED_LINE)

  if (data.companyAddress) {
    lines.push(data.companyAddress)
    lines.push(Commands.FEED_LINE)
  }

  // === SCANNABLE BARCODE AT TOP FOR EASY SCANNING ===
  // This is the main barcode for the almacenero to scan when receiving
  // Use CODE128B for better compatibility with most thermal printers
  const barcodeDataTop = invoiceNumber.replace(/[^A-Z0-9-]/gi, '').toUpperCase()
  if (barcodeDataTop.length > 0 && barcodeDataTop.length <= 20) {
    lines.push(Commands.ALIGN_CENTER)

    // Print invoice number first as large text (always visible)
    lines.push(Commands.BOLD_ON)
    lines.push(Commands.DOUBLE_SIZE_ON)
    lines.push(invoiceNumber)
    lines.push(Commands.NORMAL_SIZE)
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)

    // ESC/POS Barcode settings for CODE128
    lines.push(`${GS}h\x50`) // height = 80 dots
    lines.push(`${GS}w\x02`) // width = 2
    lines.push(`${GS}H\x00`) // HRI none (already printed text above)
    lines.push(`${GS}f\x00`) // Font A for HRI

    // Print CODE128B barcode (better compatibility than CODE39)
    // Format: GS k 73 n d1...dn (CODE128 with length prefix)
    const barcodeClean = barcodeDataTop.replace(/-/g, '')
    lines.push(`${GS}k\x49${String.fromCharCode(barcodeClean.length)}${barcodeClean}`)
    lines.push(Commands.FEED_LINE)
  } else {
    // Fallback: just print the number as text if barcode can't be generated
    lines.push(Commands.ALIGN_CENTER)
    lines.push(Commands.BOLD_ON)
    lines.push(Commands.DOUBLE_SIZE_ON)
    lines.push(invoiceNumber)
    lines.push(Commands.NORMAL_SIZE)
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)
  }

  lines.push(SEPARATOR)
  lines.push(Commands.FEED_LINE)

  // === INVOICE INFO ===
  lines.push(Commands.ALIGN_LEFT)
  lines.push(Commands.BOLD_ON)
  lines.push(`No: ${invoiceNumber}`)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  lines.push(`Fecha: ${dateStr}`)
  lines.push(Commands.FEED_LINE)

  if (data.purchaseNumber && data.invoiceNumber) {
    lines.push(`Orden: ${data.purchaseNumber}`)
    lines.push(Commands.FEED_LINE)
  }

  if (data.dueDate) {
    lines.push(`Vence: ${data.dueDate}`)
    lines.push(Commands.FEED_LINE)
  }

  lines.push(THIN_SEPARATOR)
  lines.push(Commands.FEED_LINE)

  // === SUPPLIER INFO ===
  lines.push(Commands.BOLD_ON)
  lines.push('PROVEEDOR')
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  lines.push(supplierName)
  lines.push(Commands.FEED_LINE)

  if (supplierCode) {
    lines.push(`Codigo: ${supplierCode}`)
    lines.push(Commands.FEED_LINE)
  }

  if (data.supplierAddress) {
    lines.push(data.supplierAddress)
    lines.push(Commands.FEED_LINE)
  }

  if (data.supplierPhone) {
    lines.push(`Tel: ${data.supplierPhone}`)
    lines.push(Commands.FEED_LINE)
  }

  if (data.warehouseName) {
    lines.push(`Almacen: ${data.warehouseName}`)
    lines.push(Commands.FEED_LINE)
  }

  if (data.receivedBy) {
    lines.push(`Recibido: ${data.receivedBy}`)
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

  // Items
  for (const item of items) {
    const itemTotal = item.total ?? (item.quantity ?? 0) * (item.unitCost ?? 0)
    const itemName = item.name || 'Producto sin nombre'
    const qtyStr = formatQty(item.quantity ?? 0).padStart(5)
    const totalStr = formatCurrency(itemTotal)
    const maxNameLen = PAPER_WIDTH - 8 - totalStr.length - 2

    // Truncate name if too long
    const displayName = itemName.length > maxNameLen
      ? itemName.substring(0, maxNameLen - 2) + '..'
      : itemName

    const itemLine = `${qtyStr} x ${displayName}`
    lines.push(formatLine(itemLine, totalStr, PAPER_WIDTH))
    lines.push(Commands.FEED_LINE)

    // Show variant name if exists
    if (item.variantName) {
      lines.push(`     VAR: ${item.variantName}`)
      lines.push(Commands.FEED_LINE)
    }

    // Get product code for barcode - prefer variant barcode/sku, then product barcode/sku
    const productCode = item.variantBarcode || item.variantSku || item.barcode || item.sku

    if (productCode) {
      // Print product code as text
      lines.push(`     COD: ${productCode}`)
      lines.push(Commands.FEED_LINE)

      // Print scannable barcode for the product using CODE128B
      const cleanBarcode = productCode.replace(/[^A-Z0-9]/gi, '').toUpperCase()

      if (cleanBarcode.length > 0 && cleanBarcode.length <= 20) {
        lines.push(Commands.ALIGN_CENTER)

        // Barcode settings for product code (smaller than invoice barcode)
        lines.push(`${GS}h\x28`) // height = 40 dots (smaller)
        lines.push(`${GS}w\x02`) // width = 2
        lines.push(`${GS}H\x00`) // HRI none (we already printed the code)

        // Print CODE128B barcode (better compatibility)
        // Format: GS k 73 n d1...dn
        lines.push(`${GS}k\x49${String.fromCharCode(cleanBarcode.length)}${cleanBarcode}`)
        lines.push(Commands.FEED_LINE)

        lines.push(Commands.ALIGN_LEFT)
      }
    }
  }

  lines.push(THIN_SEPARATOR)
  lines.push(Commands.FEED_LINE)

  // === TOTALS ===
  lines.push(formatLine('Subtotal:', formatCurrency(subtotal), PAPER_WIDTH))
  lines.push(Commands.FEED_LINE)

  // Tax
  if (data.tax !== undefined && data.tax > 0) {
    const taxLabel = data.taxRate ? `IVA (${data.taxRate}%):` : 'IVA:'
    lines.push(formatLine(taxLabel, formatCurrency(data.tax), PAPER_WIDTH))
    lines.push(Commands.FEED_LINE)
  }

  // Discount
  if (data.discount !== undefined && data.discount > 0) {
    lines.push(formatLine('Descuento:', `-${formatCurrency(data.discount)}`, PAPER_WIDTH))
    lines.push(Commands.FEED_LINE)
  }

  // Shipping
  if (data.shipping !== undefined && data.shipping > 0) {
    lines.push(formatLine('Envio:', formatCurrency(data.shipping), PAPER_WIDTH))
    lines.push(Commands.FEED_LINE)
  }

  // Total
  lines.push(SEPARATOR)
  lines.push(Commands.FEED_LINE)
  lines.push(Commands.BOLD_ON)
  lines.push(Commands.DOUBLE_HEIGHT_ON)
  lines.push(formatLine('TOTAL:', formatCurrency(total), Math.floor(PAPER_WIDTH / 2)))
  lines.push(Commands.NORMAL_SIZE)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  // === PAYMENT INFO ===
  if (data.paymentStatus || data.paymentMethod) {
    lines.push(THIN_SEPARATOR)
    lines.push(Commands.FEED_LINE)

    if (data.paymentMethod) {
      lines.push(`Metodo pago: ${data.paymentMethod}`)
      lines.push(Commands.FEED_LINE)
    }

    if (data.paymentStatus) {
      const statusText = data.paymentStatus === 'paid' ? 'PAGADO' :
                        data.paymentStatus === 'pending' ? 'PENDIENTE' : 'PAGO PARCIAL'
      lines.push(Commands.BOLD_ON)
      lines.push(`Estado: ${statusText}`)
      lines.push(Commands.BOLD_OFF)
      lines.push(Commands.FEED_LINE)
    }

    if (data.amountPaid !== undefined && data.amountPaid > 0) {
      lines.push(formatLine('Pagado:', formatCurrency(data.amountPaid), PAPER_WIDTH))
      lines.push(Commands.FEED_LINE)
    }

    if (data.amountDue !== undefined && data.amountDue > 0) {
      lines.push(Commands.BOLD_ON)
      lines.push(formatLine('Por pagar:', formatCurrency(data.amountDue), PAPER_WIDTH))
      lines.push(Commands.BOLD_OFF)
      lines.push(Commands.FEED_LINE)
    }
  }

  // === NOTES ===
  if (data.notes) {
    lines.push(THIN_SEPARATOR)
    lines.push(Commands.FEED_LINE)
    lines.push('Notas:')
    lines.push(Commands.FEED_LINE)
    // Word wrap notes
    const noteLines = wordWrap(data.notes, PAPER_WIDTH)
    for (const noteLine of noteLines) {
      lines.push(noteLine)
      lines.push(Commands.FEED_LINE)
    }
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

function formatCurrency(amount: number): string {
  return '$' + amount.toFixed(2)
}

function formatQty(value: number): string {
  // Show decimals only if not an integer
  if (Number.isInteger(value)) return value.toString()
  return value.toFixed(2)
}

function wordWrap(text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = word
    }
  }
  if (currentLine) lines.push(currentLine)

  return lines
}

export type { PurchaseInvoiceData, InvoiceItem }
