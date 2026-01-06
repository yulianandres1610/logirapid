/**
 * Consignment Receipt ESC/POS Generator - Generates ESC/POS commands for thermal printers (80mm)
 * For printing consignment receipts on thermal receipt printers
 */

interface ConsignmentLine {
  productName: string
  sku: string
  barcode: string | null
  quantity: number
  unitCost: number
  totalCost: number
}

interface ConsignmentReceiptData {
  orderNumber: string
  supplier: {
    code: string
    name: string
    contactName?: string
  }
  warehouse: {
    code: string
    name: string
  }
  lines: ConsignmentLine[]
  totalItems: number
  totalUnits: number
  totalCost: number
  consignmentDate: string
  notes?: string
  createdBy?: string
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

export function generateConsignmentReceiptEscpos(data: ConsignmentReceiptData): Buffer {
  const lines: string[] = []

  // Paper width for 80mm thermal printer (42 chars with Font A)
  const PAPER_WIDTH = 42
  const SEPARATOR = '='.repeat(PAPER_WIDTH)
  const THIN_SEPARATOR = '-'.repeat(PAPER_WIDTH)

  // Normalize data
  const companyName = data.companyName || 'LogiRapid'
  const orderNumber = data.orderNumber || 'Sin numero'
  const dateStr = formatDate(data.consignmentDate)

  // Initialize printer
  lines.push(Commands.INIT)

  // Set left margin
  lines.push(`${GS}L\x30\x00`)

  // === HEADER ===
  lines.push(Commands.ALIGN_CENTER)
  lines.push(Commands.BOLD_ON)
  lines.push(Commands.DOUBLE_HEIGHT_ON)
  lines.push('RECEPCION CONSIGNACION')
  lines.push(Commands.NORMAL_SIZE)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  // Company name
  lines.push(companyName)
  lines.push(Commands.FEED_LINE)

  lines.push(SEPARATOR)
  lines.push(Commands.FEED_LINE)

  // === ORDER INFO ===
  lines.push(Commands.ALIGN_LEFT)
  lines.push(Commands.BOLD_ON)
  lines.push(`Orden: ${orderNumber}`)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  lines.push(`Fecha: ${dateStr}`)
  lines.push(Commands.FEED_LINE)

  lines.push(THIN_SEPARATOR)
  lines.push(Commands.FEED_LINE)

  // === SUPPLIER INFO ===
  lines.push(Commands.BOLD_ON)
  lines.push('PROVEEDOR')
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  lines.push(data.supplier.name)
  lines.push(Commands.FEED_LINE)

  if (data.supplier.code) {
    lines.push(`Codigo: ${data.supplier.code}`)
    lines.push(Commands.FEED_LINE)
  }

  if (data.supplier.contactName) {
    lines.push(`Contacto: ${data.supplier.contactName}`)
    lines.push(Commands.FEED_LINE)
  }

  lines.push(THIN_SEPARATOR)
  lines.push(Commands.FEED_LINE)

  // === WAREHOUSE INFO ===
  lines.push(Commands.BOLD_ON)
  lines.push('ALMACEN DESTINO')
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  lines.push(data.warehouse.name)
  lines.push(Commands.FEED_LINE)

  if (data.warehouse.code) {
    lines.push(`Codigo: ${data.warehouse.code}`)
    lines.push(Commands.FEED_LINE)
  }

  lines.push(THIN_SEPARATOR)
  lines.push(Commands.FEED_LINE)

  // === SUMMARY ===
  lines.push(Commands.BOLD_ON)
  lines.push(formatLine(`Productos: ${data.totalItems}`, `Unidades: ${data.totalUnits}`, PAPER_WIDTH))
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

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
  for (const item of data.lines) {
    const itemName = item.productName || 'Producto sin nombre'
    const qtyStr = (item.quantity ?? 0).toString().padStart(2)
    const totalStr = formatCurrency(item.totalCost)
    const maxNameLen = PAPER_WIDTH - 6 - totalStr.length - 2

    // Truncate name if too long
    const displayName = itemName.length > maxNameLen
      ? itemName.substring(0, maxNameLen - 2) + '..'
      : itemName

    const itemLine = `${qtyStr} x ${displayName}`
    lines.push(formatLine(itemLine, totalStr, PAPER_WIDTH))
    lines.push(Commands.FEED_LINE)

    // Get product code for barcode (prefer barcode, then sku)
    const productCode = item.barcode || item.sku

    if (productCode) {
      // Print product code as text
      lines.push(`     COD: ${productCode}`)
      lines.push(Commands.FEED_LINE)

      // Print scannable barcode for the product
      // Only alphanumeric characters for barcode
      const cleanBarcode = productCode.replace(/[^A-Z0-9]/gi, '').toUpperCase()

      if (cleanBarcode.length > 0 && cleanBarcode.length <= 20) {
        lines.push(Commands.ALIGN_CENTER)

        // Barcode settings for product code (smaller)
        lines.push(`${GS}h\x30`) // height = 48 dots
        lines.push(`${GS}w\x02`) // width = 2
        lines.push(`${GS}H\x00`) // HRI none

        // Print CODE39 barcode
        lines.push(`${GS}k\x04${cleanBarcode}\x00`)
        lines.push(Commands.FEED_LINE)

        lines.push(Commands.ALIGN_LEFT)
      }
    }
  }

  lines.push(THIN_SEPARATOR)
  lines.push(Commands.FEED_LINE)

  // === TOTALS ===
  lines.push(SEPARATOR)
  lines.push(Commands.FEED_LINE)
  lines.push(Commands.BOLD_ON)
  lines.push(Commands.DOUBLE_HEIGHT_ON)
  lines.push(formatLine('TOTAL:', formatCurrency(data.totalCost), Math.floor(PAPER_WIDTH / 2)))
  lines.push(Commands.NORMAL_SIZE)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

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

  // === BARCODE with order number ===
  const barcodeData = orderNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase()
  if (barcodeData.length > 0) {
    lines.push(Commands.FEED_LINE)
    lines.push(Commands.ALIGN_CENTER)

    // ESC/POS Barcode settings
    lines.push(`${GS}h\x40`) // height = 64 dots
    lines.push(`${GS}w\x02`) // width = 2
    lines.push(`${GS}H\x02`) // HRI below barcode
    lines.push(`${GS}f\x00`) // Font A for HRI

    // Print CODE39 barcode
    lines.push(`${GS}k\x04${barcodeData}\x00`)
    lines.push(Commands.FEED_LINE)

    // Print number as text
    lines.push(orderNumber)
    lines.push(Commands.FEED_LINE)
  }

  // === FOOTER ===
  lines.push(Commands.FEED_LINE)
  lines.push(Commands.ALIGN_CENTER)

  if (data.createdBy) {
    lines.push(`Creado por: ${data.createdBy}`)
    lines.push(Commands.FEED_LINE)
  }

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

export type { ConsignmentReceiptData, ConsignmentLine }
