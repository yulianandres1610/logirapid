/**
 * Session Close Report - ESC/POS for 80mm thermal printers
 * Compatible with: Epson TM-T20III, TM-T30, Rongta, XPrinter
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
  FEED: LF,
  FEED_N: (n: number) => `${ESC}d${String.fromCharCode(Math.min(n, 10))}`
}

const W = 42
const SEP = '='.repeat(W)
const THIN = '-'.repeat(W)

function lr(left: string, right: string): string {
  const sp = W - left.length - right.length
  return sp > 0 ? left + ' '.repeat(sp) + right : (left + ' ' + right).substring(0, W)
}

function safe(v: any): string { return v == null ? '' : String(v) }
function num(v: any): number { const n = parseFloat(v); return isNaN(n) ? 0 : n }
function fmt(v: any): string { return '$' + num(v).toFixed(2) }
function fmtCUP(v: any): string { return Math.round(num(v)).toLocaleString('es-ES') }

export function generateSessionCloseEscpos(data: any): Buffer {
  const l: string[] = []

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
  if (data.companyName) { l.push(safe(data.companyName)); l.push(C.FEED) }
  l.push(C.BOLD_ON)
  l.push(safe(data.reportNumber))
  l.push(C.BOLD_OFF)
  l.push(C.FEED)
  l.push(SEP)
  l.push(C.FEED)

  // === SESSION INFO ===
  l.push(C.ALIGN_LEFT)
  if (data.terminalName) { l.push(lr('Terminal:', safe(data.terminalName))); l.push(C.FEED) }
  if (data.warehouseName) { l.push(lr('Almacen:', safe(data.warehouseName))); l.push(C.FEED) }
  if (data.openedAt) { l.push(lr('Apertura:', safe(data.openedAt))); l.push(C.FEED) }
  if (data.closedAt) { l.push(lr('Cierre:', safe(data.closedAt))); l.push(C.FEED) }
  if (data.duration) { l.push(lr('Duracion:', safe(data.duration))); l.push(C.FEED) }
  if (data.openedBy) { l.push(lr('Abrio:', safe(data.openedBy))); l.push(C.FEED) }
  if (data.closedBy) { l.push(lr('Cerro:', safe(data.closedBy))); l.push(C.FEED) }
  l.push(SEP)
  l.push(C.FEED)

  // === SALES SUMMARY ===
  l.push(C.BOLD_ON)
  l.push(' RESUMEN DE VENTAS')
  l.push(C.BOLD_OFF)
  l.push(C.FEED)
  l.push(THIN)
  l.push(C.FEED)

  const summary = data.summary || {}
  if (summary.paidOrders !== undefined) { l.push(lr('Ordenes pagadas:', String(num(summary.paidOrders)))); l.push(C.FEED) }
  if (summary.totalProducts !== undefined) { l.push(lr('Productos vendidos:', String(num(summary.totalProducts)))); l.push(C.FEED) }
  if (num(summary.voidedOrders) > 0) { l.push(lr('Ordenes anuladas:', String(num(summary.voidedOrders)))); l.push(C.FEED) }
  if (num(summary.refundedOrders) > 0) { l.push(lr('Devoluciones:', String(num(summary.refundedOrders)))); l.push(C.FEED) }
  l.push(THIN)
  l.push(C.FEED)
  if (summary.totalSales !== undefined) {
    l.push(C.BOLD_ON)
    l.push(lr('TOTAL VENTAS:', fmt(summary.totalSales)))
    l.push(C.BOLD_OFF)
    l.push(C.FEED)
  }
  if (num(summary.totalDiscounts) > 0) { l.push(lr('Descuentos:', '-' + fmt(summary.totalDiscounts))); l.push(C.FEED) }
  if (num(summary.totalRefunds) > 0) { l.push(lr('Devoluciones:', '-' + fmt(summary.totalRefunds))); l.push(C.FEED) }
  l.push(SEP)
  l.push(C.FEED)

  // === CASH SUMMARY ===
  try {
    const rawCS = data.cashSummary
    if (rawCS && typeof rawCS === 'object' && !Array.isArray(rawCS)) {
      const entries = Object.entries(rawCS) as [string, any][]
      const valid = entries.filter(([, i]) => i && typeof i === 'object' && num(i.collected) > 0)
      if (valid.length > 0) {
        l.push(C.BOLD_ON)
        l.push(' COBROS POR METODO')
        l.push(C.BOLD_OFF)
        l.push(C.FEED)
        l.push(THIN)
        l.push(C.FEED)
        for (const [method, info] of valid) {
          const nm = method === 'cash_usd' ? 'Efectivo USD' : method === 'cash_cup' ? 'Efectivo CUP' :
            method === 'cash_mlc' ? 'Efectivo MLC' : method === 'transfer' ? 'Transferencia' :
            method === 'qr' ? 'QR' : method === 'credit' ? 'Credito' : safe(method)
          l.push(lr(nm + ' (' + num(info.count) + '):', fmt(info.collected)))
          l.push(C.FEED)
        }
        l.push(THIN)
        l.push(C.FEED)
      }
    }
  } catch {}

  // === OPENING / CLOSING CASH ===
  try {
    const oc = data.openingCash || { usd: 0, cup: 0, mlc: 0 }
    const cc = data.closingCash || { usd: 0, cup: 0, mlc: 0 }
    const rd = data.cashDifference
    const df = typeof rd === 'number' ? { usd: rd, cup: 0, mlc: 0 } : (rd && typeof rd === 'object' ? rd : { usd: 0, cup: 0, mlc: 0 })
    const curs = ['usd', 'cup', 'mlc'] as const
    const lbl: Record<string, string> = { usd: 'USD', cup: 'CUP', mlc: 'MLC' }
    let any = false
    for (const c of curs) { if (num(oc[c]) > 0 || num(cc[c]) > 0) { any = true; break } }
    if (any) {
      l.push(C.BOLD_ON)
      l.push(' EFECTIVO EN CAJA')
      l.push(C.BOLD_OFF)
      l.push(C.FEED)
      l.push(THIN)
      l.push(C.FEED)
      for (const c of curs) {
        const o = num(oc[c]), cl = num(cc[c]), d = num(df[c])
        if (o > 0 || cl > 0) {
          const f = c === 'cup' ? fmtCUP : fmt
          l.push(C.BOLD_ON); l.push(lbl[c] + ':'); l.push(C.BOLD_OFF); l.push(C.FEED)
          l.push(lr('  Apertura:', f(o))); l.push(C.FEED)
          l.push(lr('  Cierre:', f(cl))); l.push(C.FEED)
          l.push(lr('  Diferencia:', (d >= 0 ? '+' : '') + f(d))); l.push(C.FEED)
        }
      }
      // Denominations
      try {
        const dn = data.denominationsSummary
        if (dn && typeof dn === 'object') {
          for (const [cur, items] of Object.entries(dn) as [string, any[]][]) {
            if (Array.isArray(items) && items.length > 0) {
              l.push(THIN); l.push(C.FEED)
              l.push(C.BOLD_ON); l.push('Denom ' + safe(cur) + ':'); l.push(C.BOLD_OFF); l.push(C.FEED)
              for (const d of items) {
                if (d && d.label) {
                  l.push(lr('  ' + safe(d.label) + ' x ' + num(d.count), cur === 'CUP' ? fmtCUP(d.total) : fmt(d.total)))
                  l.push(C.FEED)
                }
              }
            }
          }
        }
      } catch {}
      l.push(SEP); l.push(C.FEED)
    }
  } catch {}

  // === OTHER PAYMENTS ===
  try {
    const op = data.otherPayments
    if (Array.isArray(op) && op.length > 0) {
      l.push(C.BOLD_ON); l.push('Otros pagos:'); l.push(C.BOLD_OFF); l.push(C.FEED)
      for (const p of op) {
        if (p && num(p.amount) > 0) {
          l.push(lr('  ' + safe(p.method) + ' (' + num(p.count) + '):', fmt(p.amount) + ' ' + safe(p.currency)))
          l.push(C.FEED)
        }
      }
      l.push(THIN); l.push(C.FEED)
    }
  } catch {}

  // === TOP PRODUCTS ===
  try {
    const pr = data.productsSold
    if (Array.isArray(pr) && pr.length > 0) {
      l.push(C.BOLD_ON); l.push(' PRODUCTOS VENDIDOS'); l.push(C.BOLD_OFF); l.push(C.FEED)
      l.push(THIN); l.push(C.FEED)
      l.push(C.BOLD_ON); l.push(lr('CANT  PRODUCTO', 'TOTAL')); l.push(C.BOLD_OFF); l.push(C.FEED)
      l.push(THIN); l.push(C.FEED)
      for (const p of pr.slice(0, 20)) {
        if (!p) continue
        l.push(lr(String(num(p.quantity)).padStart(3) + '  ' + safe(p.productName || p.name).substring(0, 24), fmt(p.total)))
        l.push(C.FEED)
      }
      if (pr.length > 20) { l.push('... y ' + (pr.length - 20) + ' mas'); l.push(C.FEED) }
      l.push(SEP); l.push(C.FEED)
    }
  } catch {}

  // === NOTES ===
  if (data.closingNotes) {
    l.push('Notas: ' + safe(data.closingNotes).substring(0, W * 2)); l.push(C.FEED)
    l.push(THIN); l.push(C.FEED)
  }

  // === SIGNATURES ===
  l.push(C.FEED)
  l.push('Cajero:'); l.push(C.FEED); l.push(THIN); l.push(C.FEED); l.push(C.FEED)
  l.push('Supervisor:'); l.push(C.FEED); l.push(THIN); l.push(C.FEED)

  // Footer
  l.push(C.FEED)
  l.push(C.ALIGN_CENTER)
  try {
    const now = new Date()
    l.push('Impreso: ' + now.toLocaleDateString('es-ES') + ' ' + now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }))
  } catch { l.push('Impreso: ' + new Date().toISOString().substring(0, 16)) }
  l.push(C.FEED)
  l.push(C.FEED_N(4))
  l.push(C.CUT)

  return Buffer.from(l.join(''), 'binary')
}
