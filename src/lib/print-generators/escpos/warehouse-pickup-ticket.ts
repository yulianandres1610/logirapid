/**
 * Warehouse Pickup Ticket ESC/POS Generator - 80mm thermal
 * Vale de entrega de almacén para impresora térmica
 */

interface PickupProduct {
  name: string
  sku: string
  barcode: string
  quantity: number
  warehouseName?: string
}

interface WarehousePickupTicketData {
  invoiceNumber: string
  customerName: string
  warehouseName: string
  warehouseId?: number
  products: PickupProduct[]
  createdAt: string
  companyName?: string
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
  FEED: LF,
  FEED_N: (n: number) => `${ESC}d${String.fromCharCode(n)}`
}

export function generateWarehousePickupTicketEscpos(data: WarehousePickupTicketData): Buffer {
  const out: string[] = []
  const W = 42
  const SEP = '='.repeat(W)
  const THIN = '-'.repeat(W)
  const companyName = data.companyName || 'LogiRapid'
  const dateStr = formatDate(data.createdAt)

  out.push(Cmd.INIT)
  out.push(`${GS}L\x30\x00`)

  // Header
  out.push(Cmd.ALIGN_CENTER)
  out.push(Cmd.BOLD_ON)
  out.push(Cmd.DOUBLE_HEIGHT)
  out.push('VALE DE ENTREGA')
  out.push(Cmd.NORMAL)
  out.push(Cmd.BOLD_OFF)
  out.push(Cmd.FEED)
  out.push(companyName)
  out.push(Cmd.FEED)
  out.push(SEP)
  out.push(Cmd.FEED)

  // Info
  out.push(Cmd.ALIGN_LEFT)
  out.push(Cmd.BOLD_ON)
  out.push(`Factura: ${data.invoiceNumber}`)
  out.push(Cmd.BOLD_OFF)
  out.push(Cmd.FEED)
  out.push(`Fecha: ${dateStr}`)
  out.push(Cmd.FEED)
  out.push(THIN)
  out.push(Cmd.FEED)

  out.push(Cmd.BOLD_ON)
  out.push('CLIENTE')
  out.push(Cmd.BOLD_OFF)
  out.push(Cmd.FEED)
  out.push(data.customerName)
  out.push(Cmd.FEED)
  out.push(THIN)
  out.push(Cmd.FEED)

  out.push(Cmd.BOLD_ON)
  out.push(`ALMACEN: ${data.warehouseName}`)
  out.push(Cmd.BOLD_OFF)
  out.push(Cmd.FEED)
  out.push(SEP)
  out.push(Cmd.FEED)

  // Products header
  out.push(Cmd.BOLD_ON)
  out.push(fmtLine('#  SKU/CODIGO', 'CANT', W))
  out.push(Cmd.BOLD_OFF)
  out.push(Cmd.FEED)
  out.push('   PRODUCTO')
  out.push(Cmd.FEED)
  out.push(THIN)
  out.push(Cmd.FEED)

  let totalUnits = 0

  for (let i = 0; i < data.products.length; i++) {
    const p = data.products[i]
    totalUnits += p.quantity
    const num = (i + 1).toString().padStart(2)
    const code = p.sku || p.barcode || '-'
    const qtyStr = p.quantity.toString()

    // Line 1: number + SKU + quantity
    out.push(Cmd.BOLD_ON)
    out.push(fmtLine(`${num} ${code}`, qtyStr, W))
    out.push(Cmd.BOLD_OFF)
    out.push(Cmd.FEED)

    // Line 2: product name
    const displayName = p.name.length > W - 3 ? p.name.substring(0, W - 5) + '..' : p.name
    out.push(`   ${displayName}`)
    out.push(Cmd.FEED)

    if (p.warehouseName) {
      out.push(`   Alm: ${p.warehouseName}`)
      out.push(Cmd.FEED)
    }

    // Barcode for product (if available)
    const barcodeData = (p.barcode || p.sku || '').replace(/[^A-Z0-9]/gi, '').toUpperCase()
    if (barcodeData.length > 0 && barcodeData.length <= 20) {
      out.push(Cmd.ALIGN_CENTER)
      out.push(`${GS}h\x30`) // height = 48
      out.push(`${GS}w\x02`) // width = 2
      out.push(`${GS}H\x02`) // HRI below
      out.push(`${GS}f\x00`) // Font A
      out.push(`${GS}k\x04${barcodeData}\x00`)
      out.push(Cmd.FEED)
      out.push(Cmd.ALIGN_LEFT)
    }

    out.push(THIN)
    out.push(Cmd.FEED)
  }

  // Totals
  out.push(SEP)
  out.push(Cmd.FEED)
  out.push(Cmd.BOLD_ON)
  out.push(fmtLine('Total Productos:', data.products.length.toString(), W))
  out.push(Cmd.FEED)
  out.push(Cmd.DOUBLE_HEIGHT)
  out.push(fmtLine('Total Unidades:', totalUnits.toString(), Math.floor(W / 2)))
  out.push(Cmd.NORMAL)
  out.push(Cmd.BOLD_OFF)
  out.push(Cmd.FEED)
  out.push(SEP)
  out.push(Cmd.FEED)

  // Invoice barcode
  const invBarcode = data.invoiceNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase()
  if (invBarcode.length > 0 && invBarcode.length <= 20) {
    out.push(Cmd.ALIGN_CENTER)
    out.push(`${GS}h\x40`)
    out.push(`${GS}w\x02`)
    out.push(`${GS}H\x02`)
    out.push(`${GS}f\x00`)
    out.push(`${GS}k\x04${invBarcode}\x00`)
    out.push(Cmd.FEED)
    out.push(data.invoiceNumber)
    out.push(Cmd.FEED)
  }

  // Signatures
  out.push(Cmd.FEED)
  out.push(Cmd.ALIGN_LEFT)
  out.push(THIN)
  out.push(Cmd.FEED)
  out.push('Entregado por (Almacen):')
  out.push(Cmd.FEED)
  out.push(Cmd.FEED)
  out.push(Cmd.FEED)
  out.push(THIN)
  out.push(Cmd.FEED)
  out.push('Recibido por (Cliente):')
  out.push(Cmd.FEED)
  out.push(Cmd.FEED)
  out.push(Cmd.FEED)
  out.push(THIN)
  out.push(Cmd.FEED)

  // Footer
  out.push(Cmd.ALIGN_CENTER)
  out.push(`--- ${companyName} ---`)
  out.push(Cmd.FEED)
  out.push(Cmd.FEED_N(4))
  out.push(Cmd.CUT)

  return Buffer.from(out.join(''), 'binary')
}

function fmtLine(left: string, right: string, width: number): string {
  const spaces = width - left.length - right.length
  return spaces < 1 ? left + ' ' + right : left + ' '.repeat(spaces) + right
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return dateStr }
}
