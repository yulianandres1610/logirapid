/**
 * Warehouse Operation Receipt Generator - ESC/POS format for 80mm thermal printers
 */

interface WarehouseOperationData {
  operationType: 'reception' | 'transfer' | 'scrap' | 'adjustment'
  operationNumber: string
  warehouse: { id: number; name: string; code: string }
  destinationWarehouse?: { id: number; name: string; code: string } | null
  products: { productId: number; name: string; sku: string; quantity: number; currentStock?: number; realStock?: number }[]
  scrapReason?: string | null
  adjustmentReason?: string | null
  notes?: string | null
  createdAt: string
}

const ESC = '\x1b'
const GS = '\x1d'
const LF = '\x0a'

const Cmd = {
  INIT: `${ESC}@`,
  CUT: `${GS}V\x00`,
  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  DOUBLE_HEIGHT: `${GS}!\x10`,
  DOUBLE_SIZE: `${GS}!\x30`,
  NORMAL: `${GS}!\x00`,
  INVERSE_ON: `${GS}B\x01`,
  INVERSE_OFF: `${GS}B\x00`,
  FEED: LF,
  FEED_N: (n: number) => `${ESC}d${String.fromCharCode(n)}`
}

const W = 42 // 80mm paper width in chars
const SEP = '='.repeat(W)
const THIN = '-'.repeat(W)

const TYPE_LABELS: Record<string, string> = {
  reception: 'RECEPCION',
  transfer: 'TRANSFERENCIA',
  scrap: 'MERMA / DESECHO',
  adjustment: 'AJUSTE DE INVENTARIO'
}

function line(left: string, right: string): string {
  const sp = W - left.length - right.length
  return sp > 0 ? left + ' '.repeat(sp) + right : left + ' ' + right
}

function truncate(text: string, max: number = W): string {
  return text.length > max ? text.substring(0, max - 3) + '...' : text
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

function barcode(data: string): string {
  const clean = data.replace(/[^\x20-\x7F]/g, '').substring(0, 20)
  if (!clean) return ''
  const out: string[] = []
  out.push(Cmd.ALIGN_CENTER)
  out.push(`${GS}h\x30`) // height 48
  out.push(`${GS}w\x02`) // width 2
  out.push(`${GS}H\x02`) // HRI below
  out.push(`${GS}f\x01`) // Font B
  out.push(`${GS}k\x49${String.fromCharCode(clean.length)}${clean}`)
  out.push(Cmd.FEED)
  out.push(Cmd.ALIGN_LEFT)
  return out.join('')
}

export function generateWarehouseOperationEscpos(data: WarehouseOperationData): Buffer {
  const l: string[] = []
  const typeLabel = TYPE_LABELS[data.operationType] || data.operationType.toUpperCase()

  l.push(Cmd.INIT)
  l.push(`${GS}L\x30\x00`) // left margin

  // === HEADER ===
  l.push(Cmd.ALIGN_CENTER)
  l.push(Cmd.BOLD_ON)
  l.push(Cmd.DOUBLE_SIZE)
  l.push(typeLabel)
  l.push(Cmd.NORMAL)
  l.push(Cmd.BOLD_OFF)
  l.push(Cmd.FEED)

  l.push(Cmd.BOLD_ON)
  l.push(data.operationNumber)
  l.push(Cmd.BOLD_OFF)
  l.push(Cmd.FEED)

  l.push(barcode(data.operationNumber.replace(/-/g, '')))

  l.push(fmtDate(data.createdAt))
  l.push(Cmd.FEED)
  l.push(Cmd.ALIGN_LEFT)
  l.push(SEP)
  l.push(Cmd.FEED)

  // === WAREHOUSE INFO ===
  l.push(Cmd.BOLD_ON)
  l.push('ALMACEN ORIGEN:')
  l.push(Cmd.BOLD_OFF)
  l.push(Cmd.FEED)
  l.push(`${data.warehouse.code} - ${data.warehouse.name}`)
  l.push(Cmd.FEED)

  if (data.destinationWarehouse) {
    l.push(Cmd.FEED)
    l.push(Cmd.BOLD_ON)
    l.push('ALMACEN DESTINO:')
    l.push(Cmd.BOLD_OFF)
    l.push(Cmd.FEED)
    l.push(`${data.destinationWarehouse.code} - ${data.destinationWarehouse.name}`)
    l.push(Cmd.FEED)
  }

  // Reason if applicable
  if (data.scrapReason) {
    l.push(Cmd.FEED)
    l.push(`Razon: ${data.scrapReason}`)
    l.push(Cmd.FEED)
  }
  if (data.adjustmentReason) {
    l.push(Cmd.FEED)
    l.push(`Razon: ${data.adjustmentReason}`)
    l.push(Cmd.FEED)
  }

  l.push(THIN)
  l.push(Cmd.FEED)

  // === SUMMARY ===
  const totalQty = data.products.reduce((s, p) => s + p.quantity, 0)
  l.push(Cmd.INVERSE_ON)
  l.push(line(`PRODUCTOS: ${data.products.length}`, `UNIDADES: ${totalQty}`))
  l.push(Cmd.INVERSE_OFF)
  l.push(Cmd.FEED)
  l.push(THIN)
  l.push(Cmd.FEED)

  // === PRODUCTS ===
  for (let i = 0; i < data.products.length; i++) {
    const p = data.products[i]

    l.push(Cmd.BOLD_ON)
    l.push(`[${i + 1}/${data.products.length}]`)
    l.push(Cmd.BOLD_OFF)
    l.push(Cmd.FEED)

    l.push(truncate(p.name))
    l.push(Cmd.FEED)

    if (p.sku) {
      l.push(`SKU: ${p.sku}`)
      l.push(Cmd.FEED)
    }

    l.push(Cmd.BOLD_ON)
    l.push(Cmd.DOUBLE_HEIGHT)
    l.push(`CANT: ${p.quantity}`)
    l.push(Cmd.NORMAL)
    l.push(Cmd.BOLD_OFF)
    l.push(Cmd.FEED)

    if (data.operationType === 'adjustment' && p.realStock !== undefined) {
      l.push(`Stock actual: ${p.currentStock || 0}  Real: ${p.realStock}`)
      l.push(Cmd.FEED)
    }

    if (i < data.products.length - 1) {
      l.push(THIN)
      l.push(Cmd.FEED)
    }
  }

  // === NOTES ===
  if (data.notes) {
    l.push(Cmd.FEED)
    l.push(SEP)
    l.push(Cmd.FEED)
    l.push(`Notas: ${truncate(data.notes, W - 7)}`)
    l.push(Cmd.FEED)
  }

  // === SIGNATURES ===
  l.push(SEP)
  l.push(Cmd.FEED)
  l.push(Cmd.FEED)
  l.push('Realizado por:')
  l.push(Cmd.FEED)
  l.push(THIN)
  l.push(Cmd.FEED)
  l.push(Cmd.FEED)
  l.push('Autorizado por:')
  l.push(Cmd.FEED)
  l.push(THIN)
  l.push(Cmd.FEED)

  // === FOOTER ===
  l.push(Cmd.FEED)
  l.push(Cmd.ALIGN_CENTER)
  l.push(`Impreso: ${fmtDate(new Date().toISOString())}`)
  l.push(Cmd.FEED)
  l.push(barcode(data.operationNumber.replace(/-/g, '')))

  l.push(Cmd.FEED_N(4))
  l.push(Cmd.CUT)

  return Buffer.from(l.join(''), 'binary')
}
