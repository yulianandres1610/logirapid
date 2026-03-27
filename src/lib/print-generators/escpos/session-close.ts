/**
 * Session Close Report - ESC/POS for 80mm thermal printers
 * Matches the data structure from buildPrintData in session-receipt page
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

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

function fmt(v: any): string {
  const n = parseFloat(v)
  return '$' + (isNaN(n) ? '0.00' : n.toFixed(2))
}

export function generateSessionCloseEscpos(data: any): Buffer {
  const l: string[] = []

  try {
  l.push(C.INIT)
  l.push(`${GS}L\x30\x00`)

  // === HEADER ===
  l.push(C.ALIGN_CENTER)
  l.push(C.BOLD_ON)
  l.push(C.DBL_H)
  l.push('CIERRE DE CAJA')
  l.push(C.NORMAL)
  l.push(C.BOLD_OFF)
  l.push(C.FEED)

  if (data.companyName) {
    l.push(data.companyName)
    l.push(C.FEED)
  }

  l.push(C.BOLD_ON)
  l.push(data.reportNumber || '')
  l.push(C.BOLD_OFF)
  l.push(C.FEED)

  l.push(SEP)
  l.push(C.FEED)

  // === SESSION INFO ===
  l.push(C.ALIGN_LEFT)
  if (data.terminalName) {
    l.push(lr('Terminal:', data.terminalName))
    l.push(C.FEED)
  }
  if (data.warehouseName) {
    l.push(lr('Almacen:', data.warehouseName))
    l.push(C.FEED)
  }
  if (data.openedAt) {
    l.push(lr('Apertura:', data.openedAt))
    l.push(C.FEED)
  }
  if (data.closedAt) {
    l.push(lr('Cierre:', data.closedAt))
    l.push(C.FEED)
  }
  if (data.duration) {
    l.push(lr('Duracion:', data.duration))
    l.push(C.FEED)
  }
  if (data.openedBy) {
    l.push(lr('Abrio:', data.openedBy))
    l.push(C.FEED)
  }
  if (data.closedBy) {
    l.push(lr('Cerro:', data.closedBy))
    l.push(C.FEED)
  }

  l.push(SEP)
  l.push(C.FEED)

  // === SALES SUMMARY ===
  l.push(C.INVERSE_ON)
  l.push(C.BOLD_ON)
  l.push(' RESUMEN DE VENTAS'.padEnd(W))
  l.push(C.BOLD_OFF)
  l.push(C.INVERSE_OFF)
  l.push(C.FEED)

  const summary = data.summary || {}
  if (summary.paidOrders !== undefined) {
    l.push(lr('Ordenes pagadas:', String(summary.paidOrders || 0)))
    l.push(C.FEED)
  }
  if (summary.totalProducts !== undefined) {
    l.push(lr('Productos vendidos:', String(summary.totalProducts || 0)))
    l.push(C.FEED)
  }
  if (summary.voidedOrders > 0) {
    l.push(lr('Ordenes anuladas:', String(summary.voidedOrders)))
    l.push(C.FEED)
  }
  if (summary.refundedOrders > 0) {
    l.push(lr('Devoluciones:', String(summary.refundedOrders)))
    l.push(C.FEED)
  }

  l.push(THIN)
  l.push(C.FEED)

  if (summary.totalSales !== undefined) {
    l.push(C.BOLD_ON)
    l.push(lr('TOTAL VENTAS:', fmt(summary.totalSales || 0)))
    l.push(C.BOLD_OFF)
    l.push(C.FEED)
  }
  if (summary.totalDiscounts > 0) {
    l.push(lr('Descuentos:', '-' + fmt(summary.totalDiscounts)))
    l.push(C.FEED)
  }
  if (summary.totalRefunds > 0) {
    l.push(lr('Devoluciones:', '-' + fmt(summary.totalRefunds)))
    l.push(C.FEED)
  }

  l.push(SEP)
  l.push(C.FEED)

  // === CASH SUMMARY ===
  try {
  const rawCashSummary = data.cashSummary
  const cashSummary = (rawCashSummary && typeof rawCashSummary === 'object' && !Array.isArray(rawCashSummary)) ? rawCashSummary : {}
  const hasCashData = Object.keys(cashSummary).length > 0

  if (hasCashData) {
    l.push(C.INVERSE_ON)
    l.push(C.BOLD_ON)
    l.push(' COBROS POR METODO'.padEnd(W))
    l.push(C.BOLD_OFF)
    l.push(C.INVERSE_OFF)
    l.push(C.FEED)

    for (const [method, info] of Object.entries(cashSummary) as [string, any][]) {
      if (info && typeof info === 'object' && (parseFloat(info.collected) || 0) > 0) {
        const methodName = method === 'cash_usd' ? 'Efectivo USD' :
          method === 'cash_cup' ? 'Efectivo CUP' :
          method === 'cash_mlc' ? 'Efectivo MLC' :
          method === 'transfer' ? 'Transferencia' :
          method === 'qr' ? 'QR' :
          method === 'credit' ? 'Credito' : method
        l.push(lr(`${methodName} (${info.count || 0}):`, fmt(info.collected)))
        l.push(C.FEED)
      }
    }

    l.push(THIN)
    l.push(C.FEED)
  }

  // === OPENING / CLOSING CASH ===
  // openingCash/closingCash can be {usd, cup, mlc} or null
  const openingCash = data.openingCash || { usd: 0, cup: 0, mlc: 0 }
  const closingCash = data.closingCash || { usd: 0, cup: 0, mlc: 0 }
  // cashDifference can be a number or {usd, cup, mlc} or null
  const rawDiff = data.cashDifference
  const cashDiff = typeof rawDiff === 'number'
    ? { usd: rawDiff, cup: 0, mlc: 0 }
    : (rawDiff || { usd: 0, cup: 0, mlc: 0 })

  const currencies = ['usd', 'cup', 'mlc']
  const currLabels: Record<string, string> = { usd: 'USD', cup: 'CUP', mlc: 'MLC' }

  let hasAnyCash = false
  for (const cur of currencies) {
    if ((openingCash[cur] || 0) > 0 || (closingCash[cur] || 0) > 0) {
      hasAnyCash = true
      break
    }
  }

  if (hasAnyCash) {
    l.push(C.INVERSE_ON)
    l.push(C.BOLD_ON)
    l.push(' EFECTIVO EN CAJA'.padEnd(W))
    l.push(C.BOLD_OFF)
    l.push(C.INVERSE_OFF)
    l.push(C.FEED)

    for (const cur of currencies) {
      const opening = openingCash[cur] || 0
      const closing = closingCash[cur] || 0
      const diff = cashDiff[cur] || 0

      if (opening > 0 || closing > 0) {
        l.push(C.BOLD_ON)
        l.push(`${currLabels[cur]}:`)
        l.push(C.BOLD_OFF)
        l.push(C.FEED)
        l.push(lr('  Apertura:', cur === 'cup' ? Math.round(opening).toLocaleString() : fmt(opening)))
        l.push(C.FEED)
        l.push(lr('  Cierre:', cur === 'cup' ? Math.round(closing).toLocaleString() : fmt(closing)))
        l.push(C.FEED)
        const diffStr = cur === 'cup'
          ? `${diff >= 0 ? '+' : ''}${Math.round(diff).toLocaleString()}`
          : `${diff >= 0 ? '+' : ''}${fmt(diff)}`
        l.push(lr('  Diferencia:', diffStr))
        l.push(C.FEED)
      }
    }

    // Denominations detail
    const denoms = data.denominationsSummary || {}
    for (const [cur, items] of Object.entries(denoms) as [string, any[]][]) {
      if (Array.isArray(items) && items.length > 0) {
        l.push(THIN)
        l.push(C.FEED)
        l.push(C.BOLD_ON)
        l.push(`Denominaciones ${cur}:`)
        l.push(C.BOLD_OFF)
        l.push(C.FEED)
        for (const d of items) {
          if (d && d.label) {
            l.push(lr(`  ${d.label} x ${d.count || 0}`, cur === 'CUP' ? Math.round(d.total || 0).toLocaleString() : fmt(d.total || 0)))
            l.push(C.FEED)
          }
        }
      }
    }

    l.push(SEP)
    l.push(C.FEED)
  }

  } catch (cashErr) { console.error('[SessionClose] Cash section error:', cashErr) }

  // === OTHER PAYMENTS (array format) ===
  try {
  const otherPayments = data.otherPayments
  if (Array.isArray(otherPayments) && otherPayments.length > 0) {
    l.push(C.BOLD_ON)
    l.push('Otros pagos:')
    l.push(C.BOLD_OFF)
    l.push(C.FEED)

    for (const p of otherPayments) {
      if (p.amount > 0) {
        l.push(lr(`  ${p.method} (${p.count}):`, `${fmt(p.amount)} ${p.currency || ''}`))
        l.push(C.FEED)
      }
    }
    l.push(THIN)
    l.push(C.FEED)
  }

  } catch (payErr) { console.error('[SessionClose] Payments error:', payErr) }

  // === TOP PRODUCTS ===
  try {
  const products = data.productsSold
  if (Array.isArray(products) && products.length > 0) {
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

    const top = products.slice(0, 20)
    for (const p of top) {
      const qty = String(p.quantity || 0).padStart(3)
      const name = (p.productName || p.name || '').substring(0, 24)
      l.push(lr(`${qty}  ${name}`, fmt(p.total || 0)))
      l.push(C.FEED)
    }
    if (products.length > 20) {
      l.push(`... y ${products.length - 20} mas`)
      l.push(C.FEED)
    }

    l.push(SEP)
    l.push(C.FEED)
  }

  } catch (prodErr) { console.error('[SessionClose] Products error:', prodErr) }

  // === NOTES ===
  if (data.closingNotes) {
    l.push(`Notas: ${String(data.closingNotes).substring(0, W * 2)}`)
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
  const now = new Date()
  l.push(`Impreso: ${now.toLocaleDateString('es-ES')} ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`)
  l.push(C.FEED)

  l.push(C.FEED_N(4))
  l.push(C.CUT)

  } catch (err) {
    console.error('[SessionCloseEscpos] Error generating receipt:', err)
    // Fallback: print minimal receipt
    l.length = 0
    l.push(C.INIT)
    l.push(C.ALIGN_CENTER)
    l.push(C.BOLD_ON)
    l.push('CIERRE DE CAJA')
    l.push(C.NORMAL)
    l.push(C.BOLD_OFF)
    l.push(C.FEED)
    l.push(data.reportNumber || 'Sin numero')
    l.push(C.FEED)
    l.push(`Error al generar recibo completo`)
    l.push(C.FEED)
    l.push(C.FEED_N(4))
    l.push(C.CUT)
  }

  return Buffer.from(l.join(''), 'binary')
}
