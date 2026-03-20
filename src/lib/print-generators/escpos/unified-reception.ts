/**
 * Unified Reception Receipt Generator - ESC/POS format for thermal printers (80mm)
 * Generates receipts with barcodes for consignment and purchase order reception
 */

interface ProductLine {
  productName: string
  sku: string
  barcode: string | null
  quantity: number
  lotNumber: string
  expirationDate: string | null
}

interface UnifiedReceptionData {
  orderType: 'consignment' | 'purchase'
  orderNumber: string
  supplier: {
    id: number
    code: string
    name: string
  }
  warehouse: {
    id: number
    code: string
    name: string
  }
  products: ProductLine[]
  totalProducts: number
  totalUnits: number
  receivedAt: string
  receivedBy?: string
  companyName?: string
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
  FEED_LINES: (n: number) => `${ESC}d${String.fromCharCode(n)}`
}

/**
 * Generate ESC/POS barcode commands
 * Uses CODE128 for better data density, falls back to CODE39 for compatibility
 */
function generateBarcodeCommands(data: string): string {
  if (!data || data.length === 0) return ''

  const lines: string[] = []

  // Clean data for barcode (CODE128 supports more characters)
  const barcodeContent = data.replace(/[^\x20-\x7F]/g, '').substring(0, 20)

  if (barcodeContent.length > 0) {
    lines.push(Commands.ALIGN_CENTER)

    // GS h n - Set barcode height (n = 1-255 dots)
    lines.push(`${GS}h\x30`) // height = 48 dots (~6mm)

    // GS w n - Set barcode width (n = 2-6)
    lines.push(`${GS}w\x02`) // width = 2 (narrow)

    // GS H n - Set HRI position (0=none, 1=above, 2=below, 3=both)
    lines.push(`${GS}H\x02`) // HRI below barcode

    // GS f n - Set HRI font (0=Font A, 1=Font B)
    lines.push(`${GS}f\x01`) // Font B (smaller) for HRI

    // Try CODE128 first (better density)
    // GS k m n d1...dn
    // m = 73 for CODE128
    const len = barcodeContent.length
    lines.push(`${GS}k\x49${String.fromCharCode(len)}${barcodeContent}`)

    lines.push(Commands.FEED_LINE)
    lines.push(Commands.ALIGN_LEFT)
  }

  return lines.join('')
}

export function generateUnifiedReceptionEscpos(data: UnifiedReceptionData): Buffer {
  const lines: string[] = []

  // Paper width for 80mm thermal printer (42 chars with Font A)
  const PAPER_WIDTH = 42
  const SEPARATOR = '='.repeat(PAPER_WIDTH)
  const THIN_SEPARATOR = '-'.repeat(PAPER_WIDTH)

  // Initialize printer
  lines.push(Commands.INIT)

  // Set left margin
  lines.push(`${GS}L\x30\x00`)

  // === HEADER ===
  lines.push(Commands.ALIGN_CENTER)
  lines.push(Commands.BOLD_ON)
  lines.push(Commands.DOUBLE_HEIGHT_ON)

  // Order type badge
  const orderTypeName = data.orderType === 'consignment' ? 'CONSIGNACION' : 'COMPRA'
  lines.push(`RECEPCION ${orderTypeName}`)
  lines.push(Commands.NORMAL_SIZE)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  // Company name
  if (data.companyName) {
    lines.push(data.companyName)
    lines.push(Commands.FEED_LINE)
  }

  // Order number
  lines.push(Commands.BOLD_ON)
  lines.push(data.orderNumber)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  // Order number barcode
  lines.push(generateBarcodeCommands(data.orderNumber))

  // Date/time
  lines.push(formatDateTime(data.receivedAt))
  lines.push(Commands.FEED_LINE)

  lines.push(Commands.ALIGN_LEFT)
  lines.push(SEPARATOR)
  lines.push(Commands.FEED_LINE)

  // === SUPPLIER & WAREHOUSE ===
  lines.push(Commands.BOLD_ON)
  lines.push('PROVEEDOR:')
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)
  lines.push(`${data.supplier.code} - ${data.supplier.name}`)
  lines.push(Commands.FEED_LINE)
  lines.push(Commands.FEED_LINE)

  lines.push(Commands.BOLD_ON)
  lines.push('ALMACEN:')
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)
  lines.push(`${data.warehouse.code} - ${data.warehouse.name}`)
  lines.push(Commands.FEED_LINE)

  lines.push(THIN_SEPARATOR)
  lines.push(Commands.FEED_LINE)

  // === SUMMARY ===
  lines.push(Commands.INVERSE_ON)
  lines.push(formatLine(`PRODUCTOS: ${data.totalProducts}`, `UNIDADES: ${data.totalUnits}`, PAPER_WIDTH))
  lines.push(Commands.INVERSE_OFF)
  lines.push(Commands.FEED_LINE)

  lines.push(THIN_SEPARATOR)
  lines.push(Commands.FEED_LINE)

  // === PRODUCTS LIST WITH BARCODES ===
  for (let i = 0; i < data.products.length; i++) {
    const product = data.products[i]

    // Product number
    lines.push(Commands.BOLD_ON)
    lines.push(`[${i + 1}/${data.products.length}]`)
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)

    // Product name (truncate if too long)
    const productName = truncateText(product.productName || 'Producto sin nombre', PAPER_WIDTH)
    lines.push(productName)
    lines.push(Commands.FEED_LINE)

    // SKU
    if (product.sku) {
      lines.push(`SKU: ${product.sku}`)
      lines.push(Commands.FEED_LINE)
    }

    // Product barcode
    const barcodeValue = product.barcode || product.sku
    if (barcodeValue) {
      lines.push(generateBarcodeCommands(barcodeValue))
    }

    // Quantity - bold and larger
    lines.push(Commands.BOLD_ON)
    lines.push(Commands.DOUBLE_HEIGHT_ON)
    lines.push(`CANT: ${product.quantity}`)
    lines.push(Commands.NORMAL_SIZE)
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)

    // Lot and expiration
    lines.push(`Lote: ${product.lotNumber || '-'}`)
    lines.push(Commands.FEED_LINE)

    if (product.expirationDate) {
      lines.push(`Vence: ${formatDate(product.expirationDate)}`)
      lines.push(Commands.FEED_LINE)
    }

    // Separator between products
    if (i < data.products.length - 1) {
      lines.push(THIN_SEPARATOR)
      lines.push(Commands.FEED_LINE)
    }
  }

  // === FOOTER ===
  lines.push(SEPARATOR)
  lines.push(Commands.FEED_LINE)

  // Signature area
  lines.push(Commands.FEED_LINE)
  lines.push('Recibido por:')
  lines.push(Commands.FEED_LINE)
  lines.push(THIN_SEPARATOR)
  lines.push(Commands.FEED_LINE)
  lines.push(Commands.FEED_LINE)

  lines.push('Entregado por:')
  lines.push(Commands.FEED_LINE)
  lines.push(THIN_SEPARATOR)
  lines.push(Commands.FEED_LINE)

  // Generated timestamp
  lines.push(Commands.FEED_LINE)
  lines.push(Commands.ALIGN_CENTER)
  lines.push(`Impreso: ${formatDateTime(new Date().toISOString())}`)
  lines.push(Commands.FEED_LINE)

  // Final order barcode for scanning
  lines.push(Commands.FEED_LINE)
  lines.push(generateBarcodeCommands(data.orderNumber))

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

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  } catch {
    return dateStr
  }
}

function formatDateTime(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateStr
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

export type { UnifiedReceptionData, ProductLine }
