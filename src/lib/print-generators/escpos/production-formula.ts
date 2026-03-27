/**
 * Production Formula ESC/POS Generator - 80mm thermal ticket
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

function fmt(v: number): string { return '$' + v.toFixed(2) }

export function generateProductionFormulaEscpos(data: any): Buffer {
  const l: string[] = []

  l.push(C.INIT)
  l.push(`${GS}L\x30\x00`)

  // Header
  l.push(C.ALIGN_CENTER)
  l.push(C.BOLD_ON)
  l.push(C.DBL_H)
  l.push('FORMULA DE PRODUCCION')
  l.push(C.NORMAL)
  l.push(C.BOLD_OFF)
  l.push(C.FEED)

  l.push(C.BOLD_ON)
  l.push(data.formulaCode || '')
  l.push(C.BOLD_OFF)
  l.push(C.FEED)
  l.push(data.formulaName || '')
  l.push(C.FEED)

  l.push(SEP)
  l.push(C.FEED)

  // Target product
  l.push(C.ALIGN_LEFT)
  if (data.targetProductName) {
    l.push(C.BOLD_ON)
    l.push('PRODUCTO FINAL:')
    l.push(C.BOLD_OFF)
    l.push(C.FEED)
    l.push(data.targetProductName)
    l.push(C.FEED)
    if (data.targetProductSku) {
      l.push(`SKU: ${data.targetProductSku}`)
      l.push(C.FEED)
    }
    l.push(C.FEED)
  }

  // Yield
  l.push(lr('Rendimiento:', `${data.yieldQuantity || 1} ${data.yieldUnit || 'unidad'}`))
  l.push(C.FEED)
  l.push(lr('Costo M.O.:', fmt(data.laborCostPerBatch || 0)))
  l.push(C.FEED)

  l.push(SEP)
  l.push(C.FEED)

  // Materials
  l.push(C.INVERSE_ON)
  l.push(C.BOLD_ON)
  l.push(' MATERIAS PRIMAS'.padEnd(W))
  l.push(C.BOLD_OFF)
  l.push(C.INVERSE_OFF)
  l.push(C.FEED)

  l.push(C.BOLD_ON)
  l.push(lr('MATERIAL', 'CANT    COSTO'))
  l.push(C.BOLD_OFF)
  l.push(C.FEED)
  l.push(THIN)
  l.push(C.FEED)

  const lines = Array.isArray(data.lines) ? data.lines : []
  for (const line of lines) {
    const name = (line.name || 'Material').substring(0, 28)
    l.push(name)
    l.push(C.FEED)
    const qty = String(line.quantity || 0).padStart(6)
    const cost = fmt(line.subtotal || 0)
    l.push(lr(`  ${line.sku || ''}`, `${qty}  ${cost}`))
    l.push(C.FEED)
  }

  l.push(THIN)
  l.push(C.FEED)

  // Totals
  l.push(lr('Total Materiales:', fmt(data.totalMaterialsCost || 0)))
  l.push(C.FEED)
  l.push(lr('Mano de Obra:', fmt(data.laborCostPerBatch || 0)))
  l.push(C.FEED)

  l.push(C.BOLD_ON)
  l.push(C.DBL_H)
  l.push(lr('TOTAL:', fmt(data.totalCost || 0)))
  l.push(C.NORMAL)
  l.push(C.BOLD_OFF)
  l.push(C.FEED)

  const yield_ = data.yieldQuantity || 1
  const costPerUnit = (data.totalCost || 0) / yield_
  l.push(lr('Costo por unidad:', fmt(costPerUnit)))
  l.push(C.FEED)

  // Notes
  if (data.notes) {
    l.push(SEP)
    l.push(C.FEED)
    l.push(`Notas: ${String(data.notes).substring(0, W * 3)}`)
    l.push(C.FEED)
  }

  // Footer
  l.push(SEP)
  l.push(C.FEED)
  l.push(C.ALIGN_CENTER)
  const now = new Date()
  l.push(`Impreso: ${now.toLocaleDateString('es-ES')} ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`)
  l.push(C.FEED)

  l.push(C.FEED_N(4))
  l.push(C.CUT)

  return Buffer.from(l.join(''), 'binary')
}
