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

  // Metadata
  notes?: string | null
  createdAt: string
  createdBy?: string
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
  const width = 32

  // Initialize
  lines.push(Commands.INIT)

  // Header
  lines.push(Commands.ALIGN_CENTER)
  lines.push(Commands.DOUBLE_SIZE_ON)
  lines.push(Commands.BOLD_ON)
  lines.push('ORDEN DE PRODUCCION')
  lines.push(Commands.FEED_LINE)
  lines.push(Commands.NORMAL_SIZE)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  // Order number
  lines.push(Commands.BOLD_ON)
  lines.push(data.orderNumber)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  // Status
  lines.push(`Estado: ${STATUS_LABELS[data.status] || data.status}`)
  lines.push(Commands.FEED_LINE)

  lines.push('================================')
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

  lines.push('--------------------------------')
  lines.push(Commands.FEED_LINE)

  // Source Product Section
  lines.push(Commands.BOLD_ON)
  lines.push('PRODUCTO A DOSIFICAR:')
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  lines.push(truncate(data.sourceProduct.name, 28))
  lines.push(Commands.FEED_LINE)

  lines.push(`SKU: ${data.sourceProduct.sku}`)
  lines.push(Commands.FEED_LINE)

  lines.push(Commands.DOUBLE_HEIGHT_ON)
  lines.push(`Peso: ${data.sourceWeightKg.toFixed(3)} kg`)
  lines.push(Commands.NORMAL_SIZE)
  lines.push(Commands.FEED_LINE)

  lines.push(`Almacen: ${truncate(data.sourceWarehouse.name, 20)}`)
  lines.push(Commands.FEED_LINE)

  lines.push('--------------------------------')
  lines.push(Commands.FEED_LINE)

  // Materials Section
  if (data.materials.length > 0) {
    lines.push(Commands.BOLD_ON)
    lines.push('MATERIALES A USAR:')
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)

    for (const material of data.materials) {
      lines.push(`[ ] ${material.quantity} x ${truncate(material.name, 18)}`)
      lines.push(Commands.FEED_LINE)
    }

    lines.push('--------------------------------')
    lines.push(Commands.FEED_LINE)
  }

  // Target Product Section
  lines.push(Commands.BOLD_ON)
  lines.push('PRODUCCION ESPERADA:')
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  lines.push(truncate(data.targetProduct.name, 28))
  lines.push(Commands.FEED_LINE)

  lines.push(Commands.DOUBLE_HEIGHT_ON)
  lines.push(`${data.targetQuantity} x ${data.targetPortionWeightKg.toFixed(3)} kg`)
  lines.push(Commands.NORMAL_SIZE)
  lines.push(Commands.FEED_LINE)

  lines.push(`Total: ${data.expectedTotalWeightKg.toFixed(3)} kg`)
  lines.push(Commands.FEED_LINE)

  lines.push(`Almacen: ${truncate(data.targetWarehouse.name, 20)}`)
  lines.push(Commands.FEED_LINE)

  lines.push('================================')
  lines.push(Commands.FEED_LINE)

  // Waste/Surplus Section
  lines.push(Commands.ALIGN_CENTER)
  lines.push(Commands.BOLD_ON)

  if (data.wasteSurplusType === 'surplus') {
    lines.push(Commands.DOUBLE_HEIGHT_ON)
    lines.push(`SOBRANTE: +${data.wasteSurplusKg.toFixed(3)} kg`)
    lines.push(Commands.NORMAL_SIZE)
  } else if (data.wasteSurplusType === 'waste') {
    lines.push(Commands.DOUBLE_HEIGHT_ON)
    lines.push(`MERMA: ${data.wasteSurplusKg.toFixed(3)} kg`)
    lines.push(Commands.NORMAL_SIZE)
  } else {
    lines.push('PESO EXACTO')
  }

  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  lines.push('================================')
  lines.push(Commands.FEED_LINE)

  // Cost Summary (if available)
  if (data.costPerUnit > 0) {
    lines.push(Commands.ALIGN_LEFT)
    lines.push(formatLine('Costo/Unidad:', `$${data.costPerUnit.toFixed(2)}`, width))
    lines.push(Commands.FEED_LINE)
  }

  // Notes
  if (data.notes) {
    lines.push('--------------------------------')
    lines.push(Commands.FEED_LINE)
    lines.push('NOTAS:')
    lines.push(Commands.FEED_LINE)
    const noteLines = wordWrap(data.notes, width - 2)
    for (const line of noteLines) {
      lines.push(line)
      lines.push(Commands.FEED_LINE)
    }
  }

  // Barcode of order number
  lines.push(Commands.FEED_LINE)
  lines.push(Commands.ALIGN_CENTER)

  // Generate Code 128 barcode
  // GS k m d1...dk NUL
  const barcodeData = data.orderNumber.replace(/-/g, '')
  lines.push(`${GS}k\x49${String.fromCharCode(barcodeData.length)}${barcodeData}`)
  lines.push(Commands.FEED_LINE)
  lines.push(data.orderNumber)
  lines.push(Commands.FEED_LINE)

  // Footer
  lines.push(Commands.FEED_LINES(2))
  lines.push('--- Documento de Produccion ---')
  lines.push(Commands.FEED_LINE)
  lines.push('LogiRapid')
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
