/**
 * Session Close Report Generator - Generates ESC/POS commands for thermal printers (80mm)
 * For printing POS session closing reports with sales summary, payments, and products sold
 */

interface CashSummary {
  collected: number
  tendered: number
  change: number
  count: number
}

interface OtherPayment {
  method: string
  currency: string
  amount: number
  count: number
}

interface ProductSold {
  productName: string
  quantity: number
  avgPrice: number
  total: number
}

interface DenominationItem {
  label: string
  count: number
  total: number
}

interface SessionCloseReportData {
  // Header
  reportNumber: string
  companyName: string
  terminalName: string
  terminalCode?: string
  warehouseName?: string

  // Session info
  openedBy: string
  closedBy?: string
  openedAt: string
  closedAt: string
  duration: string

  // Opening/Closing cash
  openingCash: { usd: number; cup: number; mlc: number }
  closingCash?: { usd: number; cup: number; mlc: number } | null
  cashDifference?: number | null
  inventoryShortage?: number

  // Sales summary
  summary: {
    paidOrders: number
    voidedOrders?: number
    refundedOrders?: number
    totalSales: number
    totalRefunds?: number
    totalDiscounts?: number
    totalProducts?: number
  }

  // Payment breakdown
  cashSummary?: Record<string, CashSummary>
  otherPayments?: OtherPayment[]

  // Denominations
  denominationsSummary?: Record<string, DenominationItem[]>

  // Products sold (top items)
  productsSold?: ProductSold[]

  // Notes
  closingNotes?: string
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
  DOUBLE_SIZE_ON: `${GS}!\x30`,
  NORMAL_SIZE: `${GS}!\x00`,

  FEED_LINE: LF,
  FEED_LINES: (n: number) => `${ESC}d${String.fromCharCode(n)}`
}

export function generateSessionCloseReport(data: SessionCloseReportData): Buffer {
  const lines: string[] = []
  const width = 42 // 80mm thermal printer

  // Initialize
  lines.push(Commands.INIT)

  // Header
  lines.push(Commands.ALIGN_CENTER)
  lines.push(Commands.DOUBLE_SIZE_ON)
  lines.push(Commands.BOLD_ON)
  lines.push('CIERRE DE CAJA')
  lines.push(Commands.FEED_LINE)
  lines.push(Commands.NORMAL_SIZE)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  // Company and terminal
  lines.push(Commands.BOLD_ON)
  lines.push(data.companyName)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)
  lines.push(`Terminal: ${data.terminalName}`)
  lines.push(Commands.FEED_LINE)

  if (data.warehouseName) {
    lines.push(`Almacen: ${data.warehouseName}`)
    lines.push(Commands.FEED_LINE)
  }

  lines.push(`Sesion: ${data.reportNumber}`)
  lines.push(Commands.FEED_LINE)

  lines.push('='.repeat(width))
  lines.push(Commands.FEED_LINE)

  // Session times
  lines.push(Commands.ALIGN_LEFT)
  lines.push(`Apertura: ${data.openedAt}`)
  lines.push(Commands.FEED_LINE)
  lines.push(`Por: ${data.openedBy}`)
  lines.push(Commands.FEED_LINE)

  lines.push(`Cierre: ${data.closedAt}`)
  lines.push(Commands.FEED_LINE)
  if (data.closedBy) {
    lines.push(`Por: ${data.closedBy}`)
    lines.push(Commands.FEED_LINE)
  }

  lines.push(`Duracion: ${data.duration}`)
  lines.push(Commands.FEED_LINE)

  lines.push('='.repeat(width))
  lines.push(Commands.FEED_LINE)

  // Sales Summary
  lines.push(Commands.ALIGN_CENTER)
  lines.push(Commands.BOLD_ON)
  lines.push('RESUMEN DE VENTAS')
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)
  lines.push('-'.repeat(width))
  lines.push(Commands.FEED_LINE)

  lines.push(Commands.ALIGN_LEFT)
  lines.push(formatLine('Ordenes pagadas:', data.summary.paidOrders.toString(), width))
  lines.push(Commands.FEED_LINE)

  if (data.summary.voidedOrders && data.summary.voidedOrders > 0) {
    lines.push(formatLine('Ordenes anuladas:', data.summary.voidedOrders.toString(), width))
    lines.push(Commands.FEED_LINE)
  }

  if (data.summary.refundedOrders && data.summary.refundedOrders > 0) {
    lines.push(formatLine('Ordenes reemb.:', data.summary.refundedOrders.toString(), width))
    lines.push(Commands.FEED_LINE)
  }

  lines.push('-'.repeat(width))
  lines.push(Commands.FEED_LINE)

  lines.push(Commands.BOLD_ON)
  lines.push(formatLine('TOTAL VENTAS:', formatCurrency(data.summary.totalSales), width))
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  if (data.summary.totalDiscounts && data.summary.totalDiscounts > 0) {
    lines.push(formatLine('Descuentos:', `-${formatCurrency(data.summary.totalDiscounts)}`, width))
    lines.push(Commands.FEED_LINE)
  }

  lines.push('='.repeat(width))
  lines.push(Commands.FEED_LINE)

  // Payment Methods
  lines.push(Commands.ALIGN_CENTER)
  lines.push(Commands.BOLD_ON)
  lines.push('COBROS POR METODO')
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)
  lines.push('-'.repeat(width))
  lines.push(Commands.FEED_LINE)

  lines.push(Commands.ALIGN_LEFT)

  // Cash payments
  if (data.cashSummary) {
    for (const [currency, cashData] of Object.entries(data.cashSummary)) {
      lines.push(Commands.BOLD_ON)
      lines.push(`Efectivo ${currency}:`)
      lines.push(Commands.BOLD_OFF)
      lines.push(Commands.FEED_LINE)

      lines.push(formatLine('  Recibido:', formatCurrencyWithSymbol(cashData.tendered, currency), width))
      lines.push(Commands.FEED_LINE)
      lines.push(formatLine('  Cambio:', `-${formatCurrencyWithSymbol(cashData.change, currency)}`, width))
      lines.push(Commands.FEED_LINE)
      lines.push(formatLine('  Neto:', formatCurrencyWithSymbol(cashData.collected, currency), width))
      lines.push(Commands.FEED_LINE)
      lines.push(formatLine('  Trans.:', cashData.count.toString(), width))
      lines.push(Commands.FEED_LINE)
    }
  }

  // Other payments
  if (data.otherPayments && data.otherPayments.length > 0) {
    for (const payment of data.otherPayments) {
      const methodName = getPaymentMethodLabel(payment.method)
      lines.push(formatLine(`${methodName} ${payment.currency}:`, formatCurrencyWithSymbol(payment.amount, payment.currency), width))
      lines.push(Commands.FEED_LINE)
      lines.push(formatLine('  Trans.:', payment.count.toString(), width))
      lines.push(Commands.FEED_LINE)
    }
  }

  lines.push('='.repeat(width))
  lines.push(Commands.FEED_LINE)

  // Cash Balance
  lines.push(Commands.ALIGN_CENTER)
  lines.push(Commands.BOLD_ON)
  lines.push('CUADRE DE CAJA')
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)
  lines.push('-'.repeat(width))
  lines.push(Commands.FEED_LINE)

  lines.push(Commands.ALIGN_LEFT)

  // Opening cash
  lines.push('FONDO APERTURA:')
  lines.push(Commands.FEED_LINE)
  lines.push(formatLine('  USD:', formatCurrency(data.openingCash.usd), width))
  lines.push(Commands.FEED_LINE)
  lines.push(formatLine('  CUP:', formatCUP(data.openingCash.cup), width))
  lines.push(Commands.FEED_LINE)
  if (data.openingCash.mlc > 0) {
    lines.push(formatLine('  MLC:', formatMLC(data.openingCash.mlc), width))
    lines.push(Commands.FEED_LINE)
  }

  // Closing cash
  if (data.closingCash) {
    lines.push(Commands.FEED_LINE)
    lines.push('CIERRE REPORTADO:')
    lines.push(Commands.FEED_LINE)
    lines.push(formatLine('  USD:', formatCurrency(data.closingCash.usd), width))
    lines.push(Commands.FEED_LINE)
    lines.push(formatLine('  CUP:', formatCUP(data.closingCash.cup), width))
    lines.push(Commands.FEED_LINE)
    if (data.closingCash.mlc > 0) {
      lines.push(formatLine('  MLC:', formatMLC(data.closingCash.mlc), width))
      lines.push(Commands.FEED_LINE)
    }
  }

  // Difference
  if (data.cashDifference !== null && data.cashDifference !== undefined) {
    lines.push('-'.repeat(width))
    lines.push(Commands.FEED_LINE)
    lines.push(Commands.BOLD_ON)
    lines.push(Commands.DOUBLE_HEIGHT_ON)
    const diffLabel = data.cashDifference >= 0 ? 'DIFERENCIA:' : 'FALTANTE:'
    const diffValue = data.cashDifference >= 0 ? `+${formatCurrency(data.cashDifference)}` : formatCurrency(data.cashDifference)
    lines.push(formatLine(diffLabel, diffValue, width))
    lines.push(Commands.NORMAL_SIZE)
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)
  }

  // Inventory shortage
  if (data.inventoryShortage && data.inventoryShortage > 0) {
    lines.push(formatLine('Faltante inv.:', formatCurrency(data.inventoryShortage), width))
    lines.push(Commands.FEED_LINE)
  }

  lines.push('='.repeat(width))
  lines.push(Commands.FEED_LINE)

  // Denominations (Desglose de Billetes)
  if (data.denominationsSummary && Object.keys(data.denominationsSummary).length > 0) {
    lines.push(Commands.ALIGN_CENTER)
    lines.push(Commands.BOLD_ON)
    lines.push('DESGLOSE DE BILLETES')
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)
    lines.push('-'.repeat(width))
    lines.push(Commands.FEED_LINE)

    lines.push(Commands.ALIGN_LEFT)

    for (const [currency, denomItems] of Object.entries(data.denominationsSummary)) {
      if (!denomItems || denomItems.length === 0) continue

      lines.push(Commands.BOLD_ON)
      lines.push(`${currency}:`)
      lines.push(Commands.BOLD_OFF)
      lines.push(Commands.FEED_LINE)

      let currencyTotal = 0
      for (const item of denomItems) {
        const denomLabel = `  ${item.label} x ${item.count}`
        const totalFormatted = formatCurrencyWithSymbol(item.total, currency)
        lines.push(formatLine(denomLabel, totalFormatted, width))
        lines.push(Commands.FEED_LINE)
        currencyTotal += item.total
      }

      // Subtotal for this currency
      lines.push(formatLine(`  Total ${currency}:`, formatCurrencyWithSymbol(currencyTotal, currency), width))
      lines.push(Commands.FEED_LINE)
      lines.push(Commands.FEED_LINE)
    }

    lines.push('='.repeat(width))
    lines.push(Commands.FEED_LINE)
  }

  // Products Sold (if available)
  if (data.productsSold && data.productsSold.length > 0) {
    lines.push(Commands.ALIGN_CENTER)
    lines.push(Commands.BOLD_ON)
    const totalProducts = data.productsSold.reduce((sum, p) => sum + p.quantity, 0)
    lines.push(`PRODUCTOS VENDIDOS (${totalProducts})`)
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)
    lines.push('-'.repeat(width))
    lines.push(Commands.FEED_LINE)

    lines.push(Commands.ALIGN_LEFT)

    // Show top 15 products
    const topProducts = data.productsSold.slice(0, 15)
    for (const product of topProducts) {
      const name = product.productName.length > 24
        ? product.productName.substring(0, 21) + '...'
        : product.productName
      lines.push(name)
      lines.push(Commands.FEED_LINE)
      lines.push(formatLine(`  ${product.quantity} x ${formatCurrency(product.avgPrice)}`, formatCurrency(product.total), width))
      lines.push(Commands.FEED_LINE)
    }

    if (data.productsSold.length > 15) {
      lines.push(`... y ${data.productsSold.length - 15} mas`)
      lines.push(Commands.FEED_LINE)
    }

    lines.push('='.repeat(width))
    lines.push(Commands.FEED_LINE)
  }

  // Closing Notes
  if (data.closingNotes) {
    lines.push('NOTAS:')
    lines.push(Commands.FEED_LINE)
    // Split notes into lines of max 40 chars
    const noteLines = splitText(data.closingNotes, width - 2)
    for (const noteLine of noteLines) {
      lines.push(noteLine)
      lines.push(Commands.FEED_LINE)
    }
    lines.push('='.repeat(width))
    lines.push(Commands.FEED_LINE)
  }

  // Footer
  lines.push(Commands.FEED_LINES(2))
  lines.push(Commands.ALIGN_CENTER)
  lines.push('--- Cierre de Caja ---')
  lines.push(Commands.FEED_LINE)
  lines.push(new Date().toLocaleString('es-ES'))
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

function formatCUP(amount: number): string {
  return Math.round(amount).toLocaleString('es-ES') + ' CUP'
}

function formatMLC(amount: number): string {
  return '$' + amount.toFixed(2) + ' MLC'
}

function formatCurrencyWithSymbol(amount: number, currency: string): string {
  if (currency === 'CUP') {
    return formatCUP(amount)
  }
  if (currency === 'MLC') {
    return formatMLC(amount)
  }
  return formatCurrency(amount)
}

function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    transfer: 'Transfer.',
    credit: 'Credito'
  }
  return labels[method] || method
}

function splitText(text: string, maxLength: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxLength) {
      currentLine += (currentLine ? ' ' : '') + word
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = word
    }
  }

  if (currentLine) lines.push(currentLine)
  return lines.slice(0, 3) // Max 3 lines
}

export type { SessionCloseReportData, CashSummary, OtherPayment, ProductSold }
