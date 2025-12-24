/**
 * Warehouse Operation Generator - Generates ESC/POS commands for thermal printers (80mm)
 * For printing warehouse operations: reception, transfer, scrap, adjustment
 */

interface OperationProduct {
  productId: number
  name: string
  sku: string
  quantity: number
  currentStock?: number
  realStock?: number // For adjustments: physical stock count
}

interface WarehouseInfo {
  id: number
  name: string
  code: string
}

interface WarehouseOperationData {
  // Operation type
  operationType: 'reception' | 'transfer' | 'scrap' | 'adjustment'
  operationNumber: string

  // Warehouse info
  warehouse: WarehouseInfo
  destinationWarehouse?: WarehouseInfo | null // For transfers

  // Products
  products: OperationProduct[]

  // Reasons
  scrapReason?: string | null
  adjustmentReason?: string | null

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

const OPERATION_TITLES: Record<string, string> = {
  reception: 'RECEPCION DE MERCANCIA',
  transfer: 'TRANSFERENCIA INTERNA',
  scrap: 'SALIDA POR MERMA',
  adjustment: 'AJUSTE DE INVENTARIO'
}

const OPERATION_ICONS: Record<string, string> = {
  reception: '[+]',
  transfer: '[->]',
  scrap: '[-]',
  adjustment: '[=]'
}

const SCRAP_REASONS: Record<string, string> = {
  damaged: 'Danado',
  expired: 'Vencido',
  defective: 'Defectuoso',
  other: 'Otro'
}

const ADJUSTMENT_REASONS: Record<string, string> = {
  physical_count: 'Conteo fisico',
  system_error: 'Error de sistema',
  theft_loss: 'Robo/Perdida',
  other: 'Otro'
}

export function generateWarehouseOperation(data: WarehouseOperationData): Buffer {
  const lines: string[] = []
  const width = 32

  // Initialize
  lines.push(Commands.INIT)

  // Header
  lines.push(Commands.ALIGN_CENTER)
  lines.push(Commands.DOUBLE_SIZE_ON)
  lines.push(Commands.BOLD_ON)
  lines.push(OPERATION_TITLES[data.operationType] || 'OPERACION DE ALMACEN')
  lines.push(Commands.FEED_LINE)
  lines.push(Commands.NORMAL_SIZE)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  // Operation number
  lines.push(Commands.BOLD_ON)
  lines.push(`${OPERATION_ICONS[data.operationType]} ${data.operationNumber}`)
  lines.push(Commands.BOLD_OFF)
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

  // Warehouse info (depends on operation type)
  if (data.operationType === 'transfer') {
    lines.push(Commands.BOLD_ON)
    lines.push('ORIGEN:')
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)
    lines.push(`${data.warehouse.name}`)
    lines.push(Commands.FEED_LINE)
    lines.push(`Codigo: ${data.warehouse.code}`)
    lines.push(Commands.FEED_LINE)
    lines.push(Commands.FEED_LINE)

    if (data.destinationWarehouse) {
      lines.push(Commands.BOLD_ON)
      lines.push('DESTINO:')
      lines.push(Commands.BOLD_OFF)
      lines.push(Commands.FEED_LINE)
      lines.push(`${data.destinationWarehouse.name}`)
      lines.push(Commands.FEED_LINE)
      lines.push(`Codigo: ${data.destinationWarehouse.code}`)
      lines.push(Commands.FEED_LINE)
    }
  } else {
    lines.push(Commands.BOLD_ON)
    lines.push('ALMACEN:')
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)
    lines.push(`${data.warehouse.name}`)
    lines.push(Commands.FEED_LINE)
    lines.push(`Codigo: ${data.warehouse.code}`)
    lines.push(Commands.FEED_LINE)
  }

  // Scrap reason
  if (data.operationType === 'scrap' && data.scrapReason) {
    lines.push(Commands.FEED_LINE)
    lines.push(Commands.BOLD_ON)
    lines.push('MOTIVO DE SALIDA:')
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)
    lines.push(SCRAP_REASONS[data.scrapReason] || data.scrapReason)
    lines.push(Commands.FEED_LINE)
  }

  // Adjustment reason
  if (data.operationType === 'adjustment' && data.adjustmentReason) {
    lines.push(Commands.FEED_LINE)
    lines.push(Commands.BOLD_ON)
    lines.push('MOTIVO DE AJUSTE:')
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)
    lines.push(ADJUSTMENT_REASONS[data.adjustmentReason] || data.adjustmentReason)
    lines.push(Commands.FEED_LINE)
  }

  lines.push('================================')
  lines.push(Commands.FEED_LINE)

  // Products header
  lines.push(Commands.BOLD_ON)
  if (data.operationType === 'adjustment') {
    lines.push(formatLine('PRODUCTO', 'SIST/REAL', width))
  } else {
    lines.push(formatLine('PRODUCTO', 'CANT', width))
  }
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)
  lines.push('--------------------------------')
  lines.push(Commands.FEED_LINE)

  // Products list
  let totalQuantity = 0

  for (const product of data.products) {
    // Product name (truncate if too long)
    const productName = product.name.substring(0, 24)
    lines.push(productName)
    lines.push(Commands.FEED_LINE)

    // SKU and quantity on second line
    if (data.operationType === 'adjustment') {
      // Show system stock vs real stock
      const diff = (product.realStock || 0) - (product.currentStock || 0)
      const diffStr = diff >= 0 ? `+${diff}` : `${diff}`
      lines.push(formatLine(
        `  ${product.sku}`,
        `${product.currentStock || 0}/${product.realStock || 0} (${diffStr})`,
        width
      ))
      totalQuantity += Math.abs(diff)
    } else {
      lines.push(formatLine(
        `  ${product.sku}`,
        `x${product.quantity}`,
        width
      ))
      totalQuantity += product.quantity
    }
    lines.push(Commands.FEED_LINE)

    // Show current stock for operations that reduce it
    if (['transfer', 'scrap'].includes(data.operationType) && product.currentStock !== undefined) {
      lines.push(`  Stock actual: ${product.currentStock}`)
      lines.push(Commands.FEED_LINE)
    }
  }

  lines.push('--------------------------------')
  lines.push(Commands.FEED_LINE)

  // Summary
  lines.push(Commands.BOLD_ON)
  lines.push(Commands.DOUBLE_HEIGHT_ON)
  if (data.operationType === 'adjustment') {
    lines.push(formatLine('ITEMS:', `${data.products.length}`, width))
  } else {
    lines.push(formatLine('TOTAL:', `${totalQuantity} unid.`, width))
  }
  lines.push(Commands.NORMAL_SIZE)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  lines.push(`Productos: ${data.products.length}`)
  lines.push(Commands.FEED_LINE)

  // Notes
  if (data.notes) {
    lines.push('================================')
    lines.push(Commands.FEED_LINE)
    lines.push('NOTAS:')
    lines.push(Commands.FEED_LINE)
    // Word wrap notes
    const noteLines = wordWrap(data.notes, width - 2)
    for (const line of noteLines) {
      lines.push(line)
      lines.push(Commands.FEED_LINE)
    }
  }

  // Footer
  lines.push(Commands.FEED_LINES(2))
  lines.push(Commands.ALIGN_CENTER)
  lines.push('--- Documento Interno ---')
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

export type { WarehouseOperationData, OperationProduct, WarehouseInfo }
