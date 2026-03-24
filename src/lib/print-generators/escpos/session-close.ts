/**
 * Session Close Report - ESC/POS for 80mm thermal printers
 */

interface SessionCloseData {
  reportNumber: string
  companyName: string
  terminalName: string
  terminalCode: string
  warehouseName?: string
  openedBy: string
  closedBy: string
  openedAt: string
  closedAt: string
  duration: string
  openingCash: { usd: number; cup: number; mlc: number }
  closingCash: { usd: number; cup: number; mlc: number }
  cashDifference: { usd: number; cup: number; mlc: number }
  summary: {
    totalOrders: number
    totalProducts: number
    totalUsd: number
    totalCup: number
    totalMlc: number
    cancelledOrders: number
  }
  cashSummary: { usd: number; cup: number; mlc: number }
  otherPayments: { transfer: number; qr: number; credit: number }
  productsSold: { name: string; sku: string; quantity: number; total: number }[]
  closingNotes?: string
}

const ESC = '\x1b'
const GS = '\x1d'
const LF = '\x0a'

const C = {
  INIT: `${ESC}@`,
  CUT: `${GS}V\x00`,
  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  DBL_H: `${GS}!\x10`,
  DBL_SIZE: `${GS}!\x30`,
  NORMAL: `${GS}!\x00`,
  INVERSE_ON: `${GS}B\x01`,
  INVERSE_OFF: `${GS}B\x00`,
  FEED: LF,
  FEED_N: (n: number) => `${ESC}d${String.fromCharCode(n)}`
}

const W = 42
const SEP = '='.repeat(W)
const THIN = '-'.repeat(W)

function lr(left: string, right: string): string {
  const sp = W - left.length - right.length
  return sp > 0 ? left + ' '.repeat(sp) + right : left + ' ' + right
}

function fmtMoney(v: number, symbol: string = '$'): string {
  return `${symbol}${v.toFixed(2)}`
}

export function generateSessionCloseEscpos(data: SessionCloseData): Buffer {
  const l: string[] = []

  l.push(C.INIT)
  l.push(`${GS}L\x30\x00`)

  // === HEADER ===
  l.push(C.ALIGN_CENTER)
  l.push(C.BOLD_ON)
  l.push(C.DBL_SIZE)
  l.push('CIERRE DE CAJA')
  l.push(C.NORMAL)
  l.push(C.BOLD_OFF)
  l.push(C.FEED)

  l.push(data.companyName)
  l.push(C.FEED)

  l.push(C.BOLD_ON)
  l.push(data.reportNumber)
  l.push(C.BOLD_OFF)
  l.push(C.FEED)

  l.push(SEP)
  l.push(C.FEED)

  // === SESSION INFO ===
  l.push(C.ALIGN_LEFT)
  l.push(lr('Terminal:', data.terminalName))
  l.push(C.FEED)
  if (data.warehouseName) {
    l.push(lr('Almacen:', data.warehouseName))
    l.push(C.FEED)
  }
  l.push(lr('Apertura:', data.openedAt))
  l.push(C.FEED)
  l.push(lr('Cierre:', data.closedAt))
  l.push(C.FEED)
  l.push(lr('Duracion:', data.duration))
  l.push(C.FEED)
  l.push(lr('Abierto por:', data.openedBy))
  l.push(C.FEED)
  l.push(lr('Cerrado por:', data.closedBy))
  l.push(C.FEED)

  l.push(SEP)
  l.push(C.FEED)

  // === SALES SUMMARY ===
  l.push(C.INVERSE_ON)
  l.push(C.BOLD_ON)
  l.push(' RESUMEN DE VENTAS'.padEnd(W))
  l.push(C.BOLD_OFF)
  l.push(C.INVERSE_OFF)
  l.push(C.FEED)

  l.push(lr('Ordenes:', String(data.summary.totalOrders)))
  l.push(C.FEED)
  l.push(lr('Productos:', String(data.summary.totalProducts)))
  l.push(C.FEED)
  if (data.summary.cancelledOrders > 0) {
    l.push(lr('Canceladas:', String(data.summary.cancelledOrders)))
    l.push(C.FEED)
  }

  l.push(THIN)
  l.push(C.FEED)

  // Sales by currency
  if (data.summary.totalUsd > 0) {
    l.push(C.BOLD_ON)
    l.push(lr('Ventas USD:', fmtMoney(data.summary.totalUsd)))
    l.push(C.BOLD_OFF)
    l.push(C.FEED)
  }
  if (data.summary.totalCup > 0) {
    l.push(C.BOLD_ON)
    l.push(lr('Ventas CUP:', `${Math.round(data.summary.totalCup).toLocaleString()} CUP`))
    l.push(C.BOLD_OFF)
    l.push(C.FEED)
  }
  if (data.summary.totalMlc > 0) {
    l.push(C.BOLD_ON)
    l.push(lr('Ventas MLC:', fmtMoney(data.summary.totalMlc, 'MLC ')))
    l.push(C.BOLD_OFF)
    l.push(C.FEED)
  }

  l.push(SEP)
  l.push(C.FEED)

  // === CASH SUMMARY ===
  l.push(C.INVERSE_ON)
  l.push(C.BOLD_ON)
  l.push(' EFECTIVO EN CAJA'.padEnd(W))
  l.push(C.BOLD_OFF)
  l.push(C.INVERSE_OFF)
  l.push(C.FEED)

  // USD
  if (data.openingCash.usd > 0 || data.closingCash.usd > 0 || data.cashSummary.usd > 0) {
    l.push(C.BOLD_ON)
    l.push('USD:')
    l.push(C.BOLD_OFF)
    l.push(C.FEED)
    l.push(lr('  Apertura:', fmtMoney(data.openingCash.usd)))
    l.push(C.FEED)
    l.push(lr('  Ventas:', fmtMoney(data.cashSummary.usd)))
    l.push(C.FEED)
    l.push(lr('  Cierre:', fmtMoney(data.closingCash.usd)))
    l.push(C.FEED)
    const diff = data.cashDifference.usd
    l.push(lr('  Diferencia:', `${diff >= 0 ? '+' : ''}${fmtMoney(diff)}`))
    l.push(C.FEED)
  }

  // CUP
  if (data.openingCash.cup > 0 || data.closingCash.cup > 0 || data.cashSummary.cup > 0) {
    l.push(C.BOLD_ON)
    l.push('CUP:')
    l.push(C.BOLD_OFF)
    l.push(C.FEED)
    l.push(lr('  Apertura:', `${Math.round(data.openingCash.cup).toLocaleString()}`))
    l.push(C.FEED)
    l.push(lr('  Ventas:', `${Math.round(data.cashSummary.cup).toLocaleString()}`))
    l.push(C.FEED)
    l.push(lr('  Cierre:', `${Math.round(data.closingCash.cup).toLocaleString()}`))
    l.push(C.FEED)
    const diff = Math.round(data.cashDifference.cup)
    l.push(lr('  Diferencia:', `${diff >= 0 ? '+' : ''}${diff.toLocaleString()}`))
    l.push(C.FEED)
  }

  // MLC
  if (data.openingCash.mlc > 0 || data.closingCash.mlc > 0 || data.cashSummary.mlc > 0) {
    l.push(C.BOLD_ON)
    l.push('MLC:')
    l.push(C.BOLD_OFF)
    l.push(C.FEED)
    l.push(lr('  Apertura:', fmtMoney(data.openingCash.mlc, '')))
    l.push(C.FEED)
    l.push(lr('  Ventas:', fmtMoney(data.cashSummary.mlc, '')))
    l.push(C.FEED)
    l.push(lr('  Cierre:', fmtMoney(data.closingCash.mlc, '')))
    l.push(C.FEED)
    const diff = data.cashDifference.mlc
    l.push(lr('  Diferencia:', `${diff >= 0 ? '+' : ''}${fmtMoney(diff, '')}`))
    l.push(C.FEED)
  }

  // Other payments
  if (data.otherPayments.transfer > 0 || data.otherPayments.qr > 0 || data.otherPayments.credit > 0) {
    l.push(THIN)
    l.push(C.FEED)
    l.push(C.BOLD_ON)
    l.push('Otros pagos:')
    l.push(C.BOLD_OFF)
    l.push(C.FEED)
    if (data.otherPayments.transfer > 0) {
      l.push(lr('  Transferencia:', fmtMoney(data.otherPayments.transfer)))
      l.push(C.FEED)
    }
    if (data.otherPayments.qr > 0) {
      l.push(lr('  QR:', fmtMoney(data.otherPayments.qr)))
      l.push(C.FEED)
    }
    if (data.otherPayments.credit > 0) {
      l.push(lr('  Credito:', fmtMoney(data.otherPayments.credit)))
      l.push(C.FEED)
    }
  }

  l.push(SEP)
  l.push(C.FEED)

  // === TOP PRODUCTS ===
  if (data.productsSold && data.productsSold.length > 0) {
    l.push(C.INVERSE_ON)
    l.push(C.BOLD_ON)
    l.push(' PRODUCTOS VENDIDOS'.padEnd(W))
    l.push(C.BOLD_OFF)
    l.push(C.INVERSE_OFF)
    l.push(C.FEED)

    l.push(C.BOLD_ON)
    l.push(lr('CANT  PRODUCTO', 'TOTAL'))
    l.push(C.BOLD_OFF)
    l.push(C.FEED)
    l.push(THIN)
    l.push(C.FEED)

    const top = data.productsSold.slice(0, 20)
    for (const p of top) {
      const qty = String(p.quantity).padStart(3)
      const name = p.name.length > 24 ? p.name.substring(0, 22) + '..' : p.name
      const total = fmtMoney(p.total)
      l.push(lr(`${qty}  ${name}`, total))
      l.push(C.FEED)
    }
    if (data.productsSold.length > 20) {
      l.push(`... y ${data.productsSold.length - 20} mas`)
      l.push(C.FEED)
    }

    l.push(SEP)
    l.push(C.FEED)
  }

  // === NOTES ===
  if (data.closingNotes) {
    l.push('Notas: ' + data.closingNotes.substring(0, W * 2))
    l.push(C.FEED)
    l.push(THIN)
    l.push(C.FEED)
  }

  // === SIGNATURES ===
  l.push(C.FEED)
  l.push('Cajero:')
  l.push(C.FEED)
  l.push(THIN)
  l.push(C.FEED)
  l.push(C.FEED)
  l.push('Supervisor:')
  l.push(C.FEED)
  l.push(THIN)
  l.push(C.FEED)

  // Footer
  l.push(C.FEED)
  l.push(C.ALIGN_CENTER)
  l.push(`Impreso: ${new Date().toLocaleString('es-ES')}`)
  l.push(C.FEED)

  l.push(C.FEED_N(4))
  l.push(C.CUT)

  return Buffer.from(l.join(''), 'binary')
}
