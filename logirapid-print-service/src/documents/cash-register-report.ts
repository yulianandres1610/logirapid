/**
 * Cash Register Report Generator - Generates ESC/POS commands for thermal printers (80mm)
 * For printing cash register close/audit reports
 */

interface CashDenomination {
  denomination: number
  count: number
  total: number
}

interface CurrencyTotal {
  currency: string
  expected: number
  counted: number
  difference: number
}

interface CashRegisterReportData {
  // Header
  companyName: string
  terminalName: string
  terminalCode?: string
  warehouseName?: string

  // Session info
  sessionNumber?: string
  openedAt: string
  closedAt: string
  openedBy?: string
  closedBy?: string

  // Opening cash
  openingCashUsd?: number
  openingCashCup?: number
  openingCashMlc?: number

  // Sales summary
  totalTransactions: number
  grossSales: number
  discounts?: number
  netSales: number

  // Cash movements
  cashIn?: number
  cashOut?: number

  // Expected vs Counted
  currencyTotals?: CurrencyTotal[]

  // Denominations (optional)
  usdDenominations?: CashDenomination[]
  cupDenominations?: CashDenomination[]
  mlcDenominations?: CashDenomination[]

  // Final totals
  totalExpected: number
  totalCounted: number
  totalDifference: number

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

export function generateCashRegisterReport(data: CashRegisterReportData): Buffer {
  const lines: string[] = []
  const width = 32

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

  if (data.sessionNumber) {
    lines.push(`Sesion: ${data.sessionNumber}`)
    lines.push(Commands.FEED_LINE)
  }

  lines.push('================================')
  lines.push(Commands.FEED_LINE)

  // Session times
  lines.push(Commands.ALIGN_LEFT)
  lines.push(`Apertura: ${data.openedAt}`)
  lines.push(Commands.FEED_LINE)
  lines.push(`Cierre:   ${data.closedAt}`)
  lines.push(Commands.FEED_LINE)

  if (data.openedBy) {
    lines.push(`Abrio: ${data.openedBy}`)
    lines.push(Commands.FEED_LINE)
  }

  if (data.closedBy) {
    lines.push(`Cerro: ${data.closedBy}`)
    lines.push(Commands.FEED_LINE)
  }

  lines.push('================================')
  lines.push(Commands.FEED_LINE)

  // Opening cash
  lines.push(Commands.ALIGN_CENTER)
  lines.push(Commands.BOLD_ON)
  lines.push('EFECTIVO INICIAL')
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)
  lines.push('--------------------------------')
  lines.push(Commands.FEED_LINE)

  lines.push(Commands.ALIGN_LEFT)
  if (data.openingCashUsd !== undefined) {
    lines.push(formatLine('USD:', `$${data.openingCashUsd.toFixed(2)}`, width))
    lines.push(Commands.FEED_LINE)
  }
  if (data.openingCashCup !== undefined) {
    lines.push(formatLine('CUP:', `$${data.openingCashCup.toFixed(0)}`, width))
    lines.push(Commands.FEED_LINE)
  }
  if (data.openingCashMlc !== undefined) {
    lines.push(formatLine('MLC:', `€${data.openingCashMlc.toFixed(2)}`, width))
    lines.push(Commands.FEED_LINE)
  }

  lines.push('================================')
  lines.push(Commands.FEED_LINE)

  // Sales summary
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
  lines.push(formatLine('Ventas brutas:', formatCurrency(data.grossSales), width))
  lines.push(Commands.FEED_LINE)

  if (data.discounts !== undefined && data.discounts > 0) {
    lines.push(formatLine('Descuentos:', `-${formatCurrency(data.discounts)}`, width))
    lines.push(Commands.FEED_LINE)
  }

  lines.push(Commands.BOLD_ON)
  lines.push(formatLine('Ventas netas:', formatCurrency(data.netSales), width))
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  // Cash movements
  if (data.cashIn !== undefined || data.cashOut !== undefined) {
    lines.push('--------------------------------')
    lines.push(Commands.FEED_LINE)
    if (data.cashIn !== undefined && data.cashIn > 0) {
      lines.push(formatLine('Entradas:', `+${formatCurrency(data.cashIn)}`, width))
      lines.push(Commands.FEED_LINE)
    }
    if (data.cashOut !== undefined && data.cashOut > 0) {
      lines.push(formatLine('Salidas:', `-${formatCurrency(data.cashOut)}`, width))
      lines.push(Commands.FEED_LINE)
    }
  }

  lines.push('================================')
  lines.push(Commands.FEED_LINE)

  // Currency totals
  if (data.currencyTotals && data.currencyTotals.length > 0) {
    lines.push(Commands.ALIGN_CENTER)
    lines.push(Commands.BOLD_ON)
    lines.push('ARQUEO POR MONEDA')
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)
    lines.push('--------------------------------')
    lines.push(Commands.FEED_LINE)

    lines.push(Commands.ALIGN_LEFT)
    for (const curr of data.currencyTotals) {
      const symbol = curr.currency === 'MLC' ? '€' : '$'
      lines.push(Commands.BOLD_ON)
      lines.push(`${curr.currency}:`)
      lines.push(Commands.BOLD_OFF)
      lines.push(Commands.FEED_LINE)
      lines.push(formatLine('  Esperado:', `${symbol}${curr.expected.toFixed(2)}`, width))
      lines.push(Commands.FEED_LINE)
      lines.push(formatLine('  Contado:', `${symbol}${curr.counted.toFixed(2)}`, width))
      lines.push(Commands.FEED_LINE)

      const diffSign = curr.difference >= 0 ? '+' : ''
      lines.push(formatLine('  Diferencia:', `${diffSign}${symbol}${curr.difference.toFixed(2)}`, width))
      lines.push(Commands.FEED_LINE)
    }
  }

  lines.push('================================')
  lines.push(Commands.FEED_LINE)

  // Final totals
  lines.push(Commands.ALIGN_CENTER)
  lines.push(Commands.BOLD_ON)
  lines.push('TOTALES')
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)
  lines.push('--------------------------------')
  lines.push(Commands.FEED_LINE)

  lines.push(Commands.ALIGN_LEFT)
  lines.push(formatLine('Esperado:', formatCurrency(data.totalExpected), width))
  lines.push(Commands.FEED_LINE)
  lines.push(formatLine('Contado:', formatCurrency(data.totalCounted), width))
  lines.push(Commands.FEED_LINE)
  lines.push('--------------------------------')
  lines.push(Commands.FEED_LINE)

  lines.push(Commands.BOLD_ON)
  lines.push(Commands.DOUBLE_HEIGHT_ON)
  const diffLabel = data.totalDifference >= 0 ? 'SOBRANTE:' : 'FALTANTE:'
  lines.push(formatLine(diffLabel, formatCurrency(Math.abs(data.totalDifference)), width))
  lines.push(Commands.NORMAL_SIZE)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  // Notes
  if (data.notes) {
    lines.push('--------------------------------')
    lines.push(Commands.FEED_LINE)
    lines.push('Notas:')
    lines.push(Commands.FEED_LINE)
    lines.push(data.notes.substring(0, 64))
    lines.push(Commands.FEED_LINE)
  }

  // Signature lines
  lines.push(Commands.FEED_LINES(3))
  lines.push('--------------------------------')
  lines.push(Commands.FEED_LINE)
  lines.push('Firma del Cajero')
  lines.push(Commands.FEED_LINE)

  lines.push(Commands.FEED_LINES(3))
  lines.push('--------------------------------')
  lines.push(Commands.FEED_LINE)
  lines.push('Firma del Supervisor')
  lines.push(Commands.FEED_LINE)

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

export type { CashRegisterReportData, CashDenomination, CurrencyTotal }
