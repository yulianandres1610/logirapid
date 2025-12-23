/**
 * Purchase Invoice Generator - Generates ESC/POS commands for thermal printers (80mm)
 * For printing purchase invoices from suppliers
 */

interface InvoiceItem {
  name: string
  sku?: string
  quantity: number
  unitCost: number
  total?: number
}

interface PurchaseInvoiceData {
  // Header
  companyName: string
  companyAddress?: string

  // Supplier info
  supplierName: string
  supplierRuc?: string
  supplierAddress?: string
  supplierPhone?: string

  // Invoice info
  invoiceNumber: string
  purchaseNumber?: string
  date: string
  dueDate?: string
  receivedBy?: string
  warehouseName?: string

  // Items
  items: InvoiceItem[]

  // Totals
  subtotal: number
  tax?: number
  taxRate?: number
  discount?: number
  shipping?: number
  total: number

  // Payment info
  paymentMethod?: string
  paymentStatus?: string // 'paid', 'pending', 'partial'
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

  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  ALIGN_RIGHT: `${ESC}a\x02`,

  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  DOUBLE_HEIGHT_ON: `${GS}!\x10`,
  DOUBLE_WIDTH_ON: `${GS}!\x20`,
  DOUBLE_SIZE_ON: `${GS}!\x30`,
  NORMAL_SIZE: `${GS}!\x00`,

  FEED_LINE: LF,
  FEED_LINES: (n: number) => `${ESC}d${String.fromCharCode(n)}`
}

export function generatePurchaseInvoice(data: PurchaseInvoiceData): Buffer {
  const lines: string[] = []
  const width = 32

  // Initialize
  lines.push(Commands.INIT)

  // Header
  lines.push(Commands.ALIGN_CENTER)
  lines.push(Commands.DOUBLE_SIZE_ON)
  lines.push(Commands.BOLD_ON)
  lines.push('FACTURA DE COMPRA')
  lines.push(Commands.FEED_LINE)
  lines.push(Commands.NORMAL_SIZE)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  // Company name
  lines.push(Commands.BOLD_ON)
  lines.push(data.companyName)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  if (data.companyAddress) {
    lines.push(data.companyAddress)
    lines.push(Commands.FEED_LINE)
  }

  lines.push('================================')
  lines.push(Commands.FEED_LINE)

  // Invoice info
  lines.push(Commands.ALIGN_LEFT)
  lines.push(Commands.BOLD_ON)
  lines.push(`Factura: ${data.invoiceNumber}`)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  if (data.purchaseNumber) {
    lines.push(`Orden: ${data.purchaseNumber}`)
    lines.push(Commands.FEED_LINE)
  }

  lines.push(`Fecha: ${data.date}`)
  lines.push(Commands.FEED_LINE)

  if (data.dueDate) {
    lines.push(`Vence: ${data.dueDate}`)
    lines.push(Commands.FEED_LINE)
  }

  lines.push('--------------------------------')
  lines.push(Commands.FEED_LINE)

  // Supplier info
  lines.push(Commands.BOLD_ON)
  lines.push('PROVEEDOR:')
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)
  lines.push(data.supplierName)
  lines.push(Commands.FEED_LINE)

  if (data.supplierRuc) {
    lines.push(`RUC/NIT: ${data.supplierRuc}`)
    lines.push(Commands.FEED_LINE)
  }

  if (data.supplierAddress) {
    lines.push(data.supplierAddress)
    lines.push(Commands.FEED_LINE)
  }

  if (data.warehouseName) {
    lines.push(`Almacen: ${data.warehouseName}`)
    lines.push(Commands.FEED_LINE)
  }

  if (data.receivedBy) {
    lines.push(`Recibido por: ${data.receivedBy}`)
    lines.push(Commands.FEED_LINE)
  }

  lines.push('================================')
  lines.push(Commands.FEED_LINE)

  // Column headers
  lines.push(Commands.BOLD_ON)
  lines.push(formatLine('CANT PRODUCTO', 'TOTAL', width))
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)
  lines.push('--------------------------------')
  lines.push(Commands.FEED_LINE)

  // Items
  for (const item of data.items) {
    const itemTotal = item.total ?? item.quantity * item.unitCost
    const qtyStr = item.quantity.toString().padStart(3)
    const itemLine = `${qtyStr} ${item.name.substring(0, 18)}`

    lines.push(formatLine(itemLine, formatCurrency(itemTotal), width))
    lines.push(Commands.FEED_LINE)

    // Show unit price on second line
    lines.push(`    @ ${formatCurrency(item.unitCost)} c/u`)
    lines.push(Commands.FEED_LINE)

    if (item.sku) {
      lines.push(`    SKU: ${item.sku}`)
      lines.push(Commands.FEED_LINE)
    }
  }

  lines.push('--------------------------------')
  lines.push(Commands.FEED_LINE)

  // Totals
  lines.push(formatLine('Subtotal:', formatCurrency(data.subtotal), width))
  lines.push(Commands.FEED_LINE)

  if (data.tax !== undefined && data.tax > 0) {
    const taxLabel = data.taxRate ? `IVA (${data.taxRate}%):` : 'IVA:'
    lines.push(formatLine(taxLabel, formatCurrency(data.tax), width))
    lines.push(Commands.FEED_LINE)
  }

  if (data.discount !== undefined && data.discount > 0) {
    lines.push(formatLine('Descuento:', `-${formatCurrency(data.discount)}`, width))
    lines.push(Commands.FEED_LINE)
  }

  if (data.shipping !== undefined && data.shipping > 0) {
    lines.push(formatLine('Envio:', formatCurrency(data.shipping), width))
    lines.push(Commands.FEED_LINE)
  }

  lines.push('================================')
  lines.push(Commands.FEED_LINE)

  // Total
  lines.push(Commands.BOLD_ON)
  lines.push(Commands.DOUBLE_HEIGHT_ON)
  lines.push(formatLine('TOTAL:', formatCurrency(data.total), width))
  lines.push(Commands.NORMAL_SIZE)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  // Payment info
  if (data.paymentStatus || data.paymentMethod) {
    lines.push('--------------------------------')
    lines.push(Commands.FEED_LINE)

    if (data.paymentMethod) {
      lines.push(`Metodo: ${data.paymentMethod}`)
      lines.push(Commands.FEED_LINE)
    }

    if (data.paymentStatus) {
      const statusText = data.paymentStatus === 'paid' ? 'PAGADO' :
                         data.paymentStatus === 'pending' ? 'PENDIENTE' : 'PARCIAL'
      lines.push(Commands.BOLD_ON)
      lines.push(`Estado: ${statusText}`)
      lines.push(Commands.BOLD_OFF)
      lines.push(Commands.FEED_LINE)
    }

    if (data.amountPaid !== undefined && data.amountPaid > 0) {
      lines.push(formatLine('Pagado:', formatCurrency(data.amountPaid), width))
      lines.push(Commands.FEED_LINE)
    }

    if (data.amountDue !== undefined && data.amountDue > 0) {
      lines.push(Commands.BOLD_ON)
      lines.push(formatLine('Por pagar:', formatCurrency(data.amountDue), width))
      lines.push(Commands.BOLD_OFF)
      lines.push(Commands.FEED_LINE)
    }
  }

  // Notes
  if (data.notes) {
    lines.push('--------------------------------')
    lines.push(Commands.FEED_LINE)
    lines.push('Notas:')
    lines.push(Commands.FEED_LINE)
    lines.push(data.notes.substring(0, 64))
    lines.push(Commands.FEED_LINE)
  }

  // Footer
  lines.push(Commands.FEED_LINES(2))
  lines.push(Commands.ALIGN_CENTER)
  lines.push('--- Documento Interno ---')
  lines.push(Commands.FEED_LINE)

  lines.push(Commands.FEED_LINES(4))
  lines.push(Commands.CUT)

  return Buffer.from(lines.join(''), 'binary')
}

function formatLine(left: string, right: string, width: number): string {
  const spaces = width - left.length - right.length
  if (spaces < 1) return left + ' ' + right
  return left + ' '.repeat(spaces) + right
}

function formatCurrency(amount: number): string {
  return '$' + amount.toFixed(2)
}

export type { PurchaseInvoiceData, InvoiceItem }
