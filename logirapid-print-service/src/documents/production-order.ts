/**
 * Production Order Generator - Generates ESC/POS commands for thermal printers (80mm)
 * For printing production/dosification orders for workers
 */

interface ProductInfo {
  id: number
  name: string
  sku: string
}

interface MaterialInfo {
  productId: number
  name: string
  sku: string
  quantity: number
  warehouseName: string
}

interface WarehouseInfo {
  id: number
  name: string
  code: string
}

export interface ProductionOrderData {
  // Order identification
  orderNumber: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  documentType?: 'materials' | 'reception' // Which type of receipt to print

  // Source product (raw material)
  sourceProduct: ProductInfo
  sourceWarehouse: WarehouseInfo
  sourceWeightKg: number
  sourceCostPerKg?: number

  // Materials
  materials: MaterialInfo[]

  // Target product (manufactured)
  targetProduct: ProductInfo
  targetWarehouse: WarehouseInfo
  targetPortionWeightKg: number
  targetQuantity: number

  // Calculations
  expectedTotalWeightKg: number
  wasteSurplusKg: number
  wasteSurplusType: 'waste' | 'surplus' | 'exact'

  // Costs
  materialsCost: number
  laborCost: number
  totalCost: number
  costPerUnit: number

  // Lot info (for reception)
  lotNumber?: string | null
  expirationDate?: string | null

  // Metadata
  notes?: string | null
  createdAt: string
  createdBy?: string
  companyName?: string
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

const STATUS_LABELS: Record<string, string> = {
  pending: 'PENDIENTE',
  in_progress: 'EN PROCESO',
  completed: 'COMPLETADA',
  cancelled: 'CANCELADA'
}

export function generateProductionOrder(data: ProductionOrderData): Buffer {
  const lines: string[] = []
  const width = 42 // 80mm thermal printer width

  // Initialize
  lines.push(Commands.INIT)

  // Determine document type
  const isReception = data.documentType === 'reception'

  // Header
  lines.push(Commands.ALIGN_CENTER)
  lines.push(Commands.DOUBLE_SIZE_ON)
  lines.push(Commands.BOLD_ON)
  if (isReception) {
    lines.push('RECEPCION DE PRODUCCION')
  } else {
    lines.push('ENTREGA DE MATERIALES')
  }
  lines.push(Commands.FEED_LINE)
  lines.push(Commands.NORMAL_SIZE)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  // Company name
  if (data.companyName) {
    lines.push(data.companyName)
    lines.push(Commands.FEED_LINE)
  }

  // Order number with barcode
  lines.push(Commands.BOLD_ON)
  lines.push(Commands.DOUBLE_HEIGHT_ON)
  lines.push(data.orderNumber)
  lines.push(Commands.NORMAL_SIZE)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  // Generate CODE39 barcode for order number
  const barcodeDataOrder = data.orderNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase()
  if (barcodeDataOrder.length > 0 && barcodeDataOrder.length <= 20) {
    lines.push(`${GS}h\x50`) // height = 80 dots
    lines.push(`${GS}w\x02`) // width = 2
    lines.push(`${GS}H\x00`) // HRI none
    lines.push(`${GS}k\x04${barcodeDataOrder}\x00`)
    lines.push(Commands.FEED_LINE)
  }

  lines.push('==========================================')
  lines.push(Commands.FEED_LINE)

  // Operation details
  lines.push(Commands.ALIGN_LEFT)

  // Date/Time
  const dateStr = formatDate(data.createdAt)
  lines.push(`Fecha: ${dateStr}`)
  lines.push(Commands.FEED_LINE)

  if (data.createdBy) {
    lines.push(`Usuario: ${data.createdBy}`)
    lines.push(Commands.FEED_LINE)
  }

  // Status
  lines.push(`Estado: ${STATUS_LABELS[data.status] || data.status}`)
  lines.push(Commands.FEED_LINE)

  lines.push('------------------------------------------')
  lines.push(Commands.FEED_LINE)

  if (isReception) {
    // === RECEPTION DOCUMENT ===

    // Lot information (important for reception)
    if (data.lotNumber) {
      lines.push(Commands.BOLD_ON)
      lines.push('LOTE:')
      lines.push(Commands.BOLD_OFF)
      lines.push(Commands.FEED_LINE)

      lines.push(Commands.DOUBLE_HEIGHT_ON)
      lines.push(Commands.BOLD_ON)
      lines.push(data.lotNumber)
      lines.push(Commands.NORMAL_SIZE)
      lines.push(Commands.BOLD_OFF)
      lines.push(Commands.FEED_LINE)

      // Barcode for lot number
      const lotBarcode = data.lotNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase()
      if (lotBarcode.length > 0 && lotBarcode.length <= 20) {
        lines.push(Commands.ALIGN_CENTER)
        lines.push(`${GS}h\x40`) // height = 64 dots
        lines.push(`${GS}w\x02`)
        lines.push(`${GS}H\x00`)
        lines.push(`${GS}k\x04${lotBarcode}\x00`)
        lines.push(Commands.FEED_LINE)
        lines.push(Commands.ALIGN_LEFT)
      }

      if (data.expirationDate) {
        lines.push(`Vencimiento: ${formatDateShort(data.expirationDate)}`)
        lines.push(Commands.FEED_LINE)
      }

      lines.push('------------------------------------------')
      lines.push(Commands.FEED_LINE)
    }

    // Product received
    lines.push(Commands.BOLD_ON)
    lines.push('PRODUCTO RECIBIDO:')
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)

    lines.push(truncate(data.targetProduct.name, 38))
    lines.push(Commands.FEED_LINE)

    if (data.targetProduct.sku) {
      lines.push(`SKU: ${data.targetProduct.sku}`)
      lines.push(Commands.FEED_LINE)
    }

    lines.push(Commands.DOUBLE_HEIGHT_ON)
    lines.push(Commands.BOLD_ON)
    lines.push(`${data.targetQuantity} x ${data.targetPortionWeightKg.toFixed(3)} kg`)
    lines.push(Commands.NORMAL_SIZE)
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)

    lines.push(`Almacen: ${truncate(data.targetWarehouse.name, 30)}`)
    lines.push(Commands.FEED_LINE)

    lines.push('------------------------------------------')
    lines.push(Commands.FEED_LINE)

    // Costs
    lines.push(Commands.BOLD_ON)
    lines.push('COSTOS:')
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)

    lines.push(formatLine('Total:', `$${data.totalCost.toFixed(2)}`, width))
    lines.push(Commands.FEED_LINE)

    lines.push(Commands.BOLD_ON)
    lines.push(Commands.DOUBLE_HEIGHT_ON)
    lines.push(formatLine('Costo/Unidad:', `$${data.costPerUnit.toFixed(2)}`, Math.floor(width / 2)))
    lines.push(Commands.NORMAL_SIZE)
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)

  } else {
    // === MATERIALS DELIVERY DOCUMENT ===

    // Source Product Section
    lines.push(Commands.BOLD_ON)
    lines.push('PRODUCTO A DOSIFICAR:')
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)

    lines.push(truncate(data.sourceProduct.name, 38))
    lines.push(Commands.FEED_LINE)

    if (data.sourceProduct.sku) {
      lines.push(`SKU: ${data.sourceProduct.sku}`)
      lines.push(Commands.FEED_LINE)
    }

    lines.push(Commands.DOUBLE_HEIGHT_ON)
    lines.push(Commands.BOLD_ON)
    lines.push(`Peso: ${data.sourceWeightKg.toFixed(3)} kg`)
    lines.push(Commands.NORMAL_SIZE)
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)

    lines.push(`Almacen: ${truncate(data.sourceWarehouse.name, 30)}`)
    lines.push(Commands.FEED_LINE)

    lines.push('------------------------------------------')
    lines.push(Commands.FEED_LINE)

    // Materials Section with checkboxes
    if (data.materials.length > 0) {
      lines.push(Commands.BOLD_ON)
      lines.push('MATERIALES A ENTREGAR:')
      lines.push(Commands.BOLD_OFF)
      lines.push(Commands.FEED_LINE)

      for (const material of data.materials) {
        lines.push(`[ ] ${material.quantity} x ${truncate(material.name, 26)}`)
        lines.push(Commands.FEED_LINE)
        if (material.warehouseName) {
          lines.push(`    Almacen: ${material.warehouseName}`)
          lines.push(Commands.FEED_LINE)
        }
      }

      lines.push('------------------------------------------')
      lines.push(Commands.FEED_LINE)
    }

    // Target Product Section
    lines.push(Commands.BOLD_ON)
    lines.push('PRODUCCION ESPERADA:')
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)

    lines.push(truncate(data.targetProduct.name, 38))
    lines.push(Commands.FEED_LINE)

    lines.push(Commands.DOUBLE_HEIGHT_ON)
    lines.push(`${data.targetQuantity} x ${data.targetPortionWeightKg.toFixed(3)} kg`)
    lines.push(Commands.NORMAL_SIZE)
    lines.push(Commands.FEED_LINE)

    lines.push(`Total esperado: ${data.expectedTotalWeightKg.toFixed(3)} kg`)
    lines.push(Commands.FEED_LINE)

    lines.push(`Almacen destino: ${truncate(data.targetWarehouse.name, 26)}`)
    lines.push(Commands.FEED_LINE)

    lines.push('------------------------------------------')
    lines.push(Commands.FEED_LINE)

    // Waste/Surplus info
    lines.push(Commands.ALIGN_CENTER)
    lines.push(Commands.BOLD_ON)
    if (data.wasteSurplusType === 'surplus') {
      lines.push(`SOBRANTE ESPERADO: +${data.wasteSurplusKg.toFixed(3)} kg`)
    } else if (data.wasteSurplusType === 'waste') {
      lines.push(`MERMA ESPERADA: ${data.wasteSurplusKg.toFixed(3)} kg`)
    } else {
      lines.push('PESO EXACTO ESPERADO')
    }
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.ALIGN_LEFT)
    lines.push(Commands.FEED_LINE)
  }

  // Notes
  if (data.notes) {
    lines.push('------------------------------------------')
    lines.push(Commands.FEED_LINE)
    lines.push('NOTAS:')
    lines.push(Commands.FEED_LINE)
    const noteLines = wordWrap(data.notes, width - 2)
    for (const line of noteLines) {
      lines.push(line)
      lines.push(Commands.FEED_LINE)
    }
  }

  // Footer
  lines.push('==========================================')
  lines.push(Commands.FEED_LINE)
  lines.push(Commands.ALIGN_CENTER)

  if (isReception) {
    lines.push('Firma Almacenero:')
    lines.push(Commands.FEED_LINE)
    lines.push(Commands.FEED_LINES(3))
    lines.push('____________________________')
    lines.push(Commands.FEED_LINE)
  }

  lines.push(Commands.FEED_LINE)
  lines.push('--- LogiRapid ---')
  lines.push(Commands.FEED_LINE)

  lines.push(Commands.FEED_LINES(4))
  lines.push(Commands.CUT)

  return Buffer.from(lines.join(''), 'binary')
}

function formatDateShort(dateStr: string): string {
  try {
    // Handle date-only strings (YYYY-MM-DD) without timezone conversion
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number)
      return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`
    }
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES')
  } catch {
    return dateStr
  }
}

function formatLine(left: string, right: string, width: number): string {
  const spaces = width - left.length - right.length
  if (spaces < 1) return left + ' ' + right
  return left + ' '.repeat(spaces) + right
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return isoString
  }
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

function wordWrap(text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = word.substring(0, maxWidth)
    }
  }
  if (currentLine) lines.push(currentLine)

  return lines
}
