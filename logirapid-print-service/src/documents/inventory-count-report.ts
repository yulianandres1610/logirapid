/**
 * Inventory Count Report Generator - Generates ESC/POS commands for thermal printers (80mm)
 * For printing inventory count/audit reports
 */

interface CountLine {
  productName: string
  productSku?: string
  expectedQuantity: number
  countedQuantity: number
  difference: number
  differenceValue: number
}

interface InventoryCountReportData {
  // Header
  companyName?: string
  warehouseName: string
  terminalName?: string

  // Count info
  countNumber: string
  countId?: number
  status: string // 'in_progress', 'completed'
  startedAt: string
  completedAt?: string
  countedBy?: string

  // Summary
  totalProducts: number
  productsWithDifferences: number
  productsWithExcess?: number
  productsWithShortage?: number
  totalExpected?: number
  totalCounted?: number
  totalDifferenceValue: number

  // Lines (optional - for detailed report)
  lines?: CountLine[]

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

export function generateInventoryCountReport(data: InventoryCountReportData): Buffer {
  const lines: string[] = []
  const width = 32

  // Initialize
  lines.push(Commands.INIT)

  // Header
  lines.push(Commands.ALIGN_CENTER)
  lines.push(Commands.DOUBLE_SIZE_ON)
  lines.push(Commands.BOLD_ON)
  lines.push('REPORTE DE CONTEO')
  lines.push(Commands.FEED_LINE)
  lines.push(Commands.NORMAL_SIZE)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  // Count number
  lines.push(Commands.BOLD_ON)
  lines.push(data.countNumber)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  if (data.companyName) {
    lines.push(data.companyName)
    lines.push(Commands.FEED_LINE)
  }

  lines.push('================================')
  lines.push(Commands.FEED_LINE)

  // Count info
  lines.push(Commands.ALIGN_LEFT)
  lines.push(`Almacen: ${data.warehouseName}`)
  lines.push(Commands.FEED_LINE)

  if (data.terminalName) {
    lines.push(`Terminal: ${data.terminalName}`)
    lines.push(Commands.FEED_LINE)
  }

  lines.push(`Iniciado: ${data.startedAt}`)
  lines.push(Commands.FEED_LINE)

  if (data.completedAt) {
    lines.push(`Completado: ${data.completedAt}`)
    lines.push(Commands.FEED_LINE)
  }

  if (data.countedBy) {
    lines.push(`Contado por: ${data.countedBy}`)
    lines.push(Commands.FEED_LINE)
  }

  const statusText = data.status === 'completed' ? 'COMPLETADO' : 'EN PROGRESO'
  lines.push(Commands.BOLD_ON)
  lines.push(`Estado: ${statusText}`)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  lines.push('================================')
  lines.push(Commands.FEED_LINE)

  // Summary
  lines.push(Commands.ALIGN_CENTER)
  lines.push(Commands.BOLD_ON)
  lines.push('RESUMEN')
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)
  lines.push('--------------------------------')
  lines.push(Commands.FEED_LINE)

  lines.push(Commands.ALIGN_LEFT)
  lines.push(formatLine('Total productos:', data.totalProducts.toString(), width))
  lines.push(Commands.FEED_LINE)

  if (data.totalExpected !== undefined) {
    lines.push(formatLine('Cant. esperada:', data.totalExpected.toString(), width))
    lines.push(Commands.FEED_LINE)
  }

  if (data.totalCounted !== undefined) {
    lines.push(formatLine('Cant. contada:', data.totalCounted.toString(), width))
    lines.push(Commands.FEED_LINE)
  }

  lines.push('--------------------------------')
  lines.push(Commands.FEED_LINE)

  lines.push(formatLine('Con diferencias:', data.productsWithDifferences.toString(), width))
  lines.push(Commands.FEED_LINE)

  if (data.productsWithExcess !== undefined) {
    lines.push(formatLine('  - Sobrantes:', data.productsWithExcess.toString(), width))
    lines.push(Commands.FEED_LINE)
  }

  if (data.productsWithShortage !== undefined) {
    lines.push(formatLine('  - Faltantes:', data.productsWithShortage.toString(), width))
    lines.push(Commands.FEED_LINE)
  }

  lines.push('--------------------------------')
  lines.push(Commands.FEED_LINE)

  // Total difference value
  lines.push(Commands.BOLD_ON)
  lines.push(Commands.DOUBLE_HEIGHT_ON)
  const diffSign = data.totalDifferenceValue >= 0 ? '+' : '-'
  lines.push(formatLine('VALOR DIF:', `${diffSign}${formatCurrency(Math.abs(data.totalDifferenceValue))}`, width))
  lines.push(Commands.NORMAL_SIZE)
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)

  // Detailed lines (if provided and not too many)
  if (data.lines && data.lines.length > 0 && data.lines.length <= 20) {
    lines.push('================================')
    lines.push(Commands.FEED_LINE)
    lines.push(Commands.ALIGN_CENTER)
    lines.push(Commands.BOLD_ON)
    lines.push('DETALLE DE DIFERENCIAS')
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)
    lines.push('--------------------------------')
    lines.push(Commands.FEED_LINE)

    lines.push(Commands.ALIGN_LEFT)

    // Only show items with differences
    const itemsWithDiff = data.lines.filter(l => l.difference !== 0)

    for (const line of itemsWithDiff.slice(0, 15)) {
      lines.push(line.productName.substring(0, 24))
      lines.push(Commands.FEED_LINE)

      if (line.productSku) {
        lines.push(`SKU: ${line.productSku}`)
        lines.push(Commands.FEED_LINE)
      }

      const diffStr = line.difference > 0 ? `+${line.difference}` : line.difference.toString()
      lines.push(`Esper: ${line.expectedQuantity} | Cont: ${line.countedQuantity} | Dif: ${diffStr}`)
      lines.push(Commands.FEED_LINE)
      lines.push('- - - - - - - - - - - - - - - -')
      lines.push(Commands.FEED_LINE)
    }

    if (itemsWithDiff.length > 15) {
      lines.push(`... y ${itemsWithDiff.length - 15} items mas`)
      lines.push(Commands.FEED_LINE)
    }
  }

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
  lines.push('--- Reporte de Conteo ---')
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

export type { InventoryCountReportData, CountLine }
