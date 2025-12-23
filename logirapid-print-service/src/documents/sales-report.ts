/**
 * Sales Report Generator - Generates ESC/POS commands for thermal printers (80mm)
 * For printing daily/period sales reports
 */

interface SalesSummary {
  paymentMethod: string
  transactionCount: number
  total: number
}

interface TopProduct {
  name: string
  quantity: number
  total: number
}

interface SalesReportData {
  // Header
  companyName: string
  terminalName?: string
  terminalCode?: string
  warehouseName?: string

  // Report info
  reportTitle?: string
  reportType?: string // 'daily', 'weekly', 'monthly', 'custom'
  reportDate: string
  periodStart?: string
  periodEnd?: string
  generatedAt?: string
  generatedBy?: string

  // Summary
  totalTransactions: number
  totalProducts: number
  grossSales: number
  discounts?: number
  taxes?: number
  netSales: number

  // Sales by payment method
  salesByPayment?: SalesSummary[]

  // Sales by currency
  salesByCurrency?: {
    currency: string
    amount: number
    transactionCount: number
  }[]

  // Top products
  topProducts?: TopProduct[]

  // Cash register info
  openingCash?: number
  closingCash?: number
  cashDifference?: number

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
  DOUBLE_SIZE_ON: `${GS}!\x30`,
  NORMAL_SIZE: `${GS}!\x00`,

  FEED_LINE: LF,
  FEED_LINES: (n: number) => `${ESC}d${String.fromCharCode(n)}`
}

export function generateSalesReport(data: SalesReportData): Buffer {
  const lines: string[] = []
  const width = 32

  // Initialize
  lines.push(Commands.INIT)

  // Header
  lines.push(Commands.ALIGN_CENTER)
  lines.push(Commands.DOUBLE_SIZE_ON)
  lines.push(Commands.BOLD_ON)
  lines.push(data.reportTitle || 'REPORTE DE VENTAS')
  lines.push(Commands.FEED_LINE)
  lines.push(Commands.NORMAL_SIZE)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  // Company info
  lines.push(Commands.BOLD_ON)
  lines.push(data.companyName)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  if (data.terminalName) {
    lines.push(`Terminal: ${data.terminalName}`)
    lines.push(Commands.FEED_LINE)
  }

  if (data.warehouseName) {
    lines.push(`Almacen: ${data.warehouseName}`)
    lines.push(Commands.FEED_LINE)
  }

  lines.push('================================')
  lines.push(Commands.FEED_LINE)

  // Report period
  lines.push(Commands.ALIGN_LEFT)

  if (data.periodStart && data.periodEnd) {
    lines.push(`Periodo: ${data.periodStart}`)
    lines.push(Commands.FEED_LINE)
    lines.push(`      a: ${data.periodEnd}`)
  } else {
    lines.push(`Fecha: ${data.reportDate}`)
  }
  lines.push(Commands.FEED_LINE)

  if (data.generatedAt) {
    lines.push(`Generado: ${data.generatedAt}`)
    lines.push(Commands.FEED_LINE)
  }

  if (data.generatedBy) {
    lines.push(`Por: ${data.generatedBy}`)
    lines.push(Commands.FEED_LINE)
  }

  lines.push('================================')
  lines.push(Commands.FEED_LINE)

  // Main Summary
  lines.push(Commands.ALIGN_CENTER)
  lines.push(Commands.BOLD_ON)
  lines.push('RESUMEN DE VENTAS')
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)
  lines.push('--------------------------------')
  lines.push(Commands.FEED_LINE)

  lines.push(Commands.ALIGN_LEFT)
  lines.push(formatLine('Transacciones:', data.totalTransactions.toString(), width))
  lines.push(Commands.FEED_LINE)
  lines.push(formatLine('Productos vendidos:', data.totalProducts.toString(), width))
  lines.push(Commands.FEED_LINE)
  lines.push('--------------------------------')
  lines.push(Commands.FEED_LINE)

  lines.push(formatLine('Ventas brutas:', formatCurrency(data.grossSales), width))
  lines.push(Commands.FEED_LINE)

  if (data.discounts !== undefined && data.discounts > 0) {
    lines.push(formatLine('Descuentos:', `-${formatCurrency(data.discounts)}`, width))
    lines.push(Commands.FEED_LINE)
  }

  if (data.taxes !== undefined) {
    lines.push(formatLine('Impuestos:', formatCurrency(data.taxes), width))
    lines.push(Commands.FEED_LINE)
  }

  lines.push('--------------------------------')
  lines.push(Commands.FEED_LINE)

  lines.push(Commands.BOLD_ON)
  lines.push(Commands.DOUBLE_HEIGHT_ON)
  lines.push(formatLine('VENTAS NETAS:', formatCurrency(data.netSales), width))
  lines.push(Commands.NORMAL_SIZE)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  // Sales by payment method
  if (data.salesByPayment && data.salesByPayment.length > 0) {
    lines.push('================================')
    lines.push(Commands.FEED_LINE)
    lines.push(Commands.ALIGN_CENTER)
    lines.push(Commands.BOLD_ON)
    lines.push('VENTAS POR METODO')
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)
    lines.push('--------------------------------')
    lines.push(Commands.FEED_LINE)

    lines.push(Commands.ALIGN_LEFT)
    for (const payment of data.salesByPayment) {
      lines.push(formatLine(`${payment.paymentMethod}:`, formatCurrency(payment.total), width))
      lines.push(Commands.FEED_LINE)
      lines.push(`  (${payment.transactionCount} transacciones)`)
      lines.push(Commands.FEED_LINE)
    }
  }

  // Sales by currency
  if (data.salesByCurrency && data.salesByCurrency.length > 0) {
    lines.push('================================')
    lines.push(Commands.FEED_LINE)
    lines.push(Commands.ALIGN_CENTER)
    lines.push(Commands.BOLD_ON)
    lines.push('VENTAS POR MONEDA')
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)
    lines.push('--------------------------------')
    lines.push(Commands.FEED_LINE)

    lines.push(Commands.ALIGN_LEFT)
    for (const currency of data.salesByCurrency) {
      const currSymbol = currency.currency === 'MLC' ? '€' : '$'
      lines.push(formatLine(`${currency.currency}:`, `${currSymbol}${currency.amount.toFixed(2)}`, width))
      lines.push(Commands.FEED_LINE)
    }
  }

  // Top products
  if (data.topProducts && data.topProducts.length > 0) {
    lines.push('================================')
    lines.push(Commands.FEED_LINE)
    lines.push(Commands.ALIGN_CENTER)
    lines.push(Commands.BOLD_ON)
    lines.push('PRODUCTOS MAS VENDIDOS')
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)
    lines.push('--------------------------------')
    lines.push(Commands.FEED_LINE)

    lines.push(Commands.ALIGN_LEFT)
    for (let i = 0; i < Math.min(5, data.topProducts.length); i++) {
      const product = data.topProducts[i]
      lines.push(`${i + 1}. ${product.name.substring(0, 20)}`)
      lines.push(Commands.FEED_LINE)
      lines.push(`   Cant: ${product.quantity} | ${formatCurrency(product.total)}`)
      lines.push(Commands.FEED_LINE)
    }
  }

  // Cash register info
  if (data.openingCash !== undefined || data.closingCash !== undefined) {
    lines.push('================================')
    lines.push(Commands.FEED_LINE)
    lines.push(Commands.ALIGN_CENTER)
    lines.push(Commands.BOLD_ON)
    lines.push('MOVIMIENTO DE CAJA')
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)
    lines.push('--------------------------------')
    lines.push(Commands.FEED_LINE)

    lines.push(Commands.ALIGN_LEFT)

    if (data.openingCash !== undefined) {
      lines.push(formatLine('Apertura:', formatCurrency(data.openingCash), width))
      lines.push(Commands.FEED_LINE)
    }

    if (data.closingCash !== undefined) {
      lines.push(formatLine('Cierre:', formatCurrency(data.closingCash), width))
      lines.push(Commands.FEED_LINE)
    }

    if (data.cashDifference !== undefined) {
      const diffLabel = data.cashDifference >= 0 ? 'Sobrante:' : 'Faltante:'
      lines.push(Commands.BOLD_ON)
      lines.push(formatLine(diffLabel, formatCurrency(Math.abs(data.cashDifference)), width))
      lines.push(Commands.BOLD_OFF)
      lines.push(Commands.FEED_LINE)
    }
  }

  // Notes
  if (data.notes) {
    lines.push('--------------------------------')
    lines.push(Commands.FEED_LINE)
    lines.push('Notas: ' + data.notes.substring(0, 50))
    lines.push(Commands.FEED_LINE)
  }

  // Footer
  lines.push(Commands.FEED_LINES(2))
  lines.push(Commands.ALIGN_CENTER)
  lines.push('--- Reporte Generado ---')
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

export type { SalesReportData, SalesSummary, TopProduct }
