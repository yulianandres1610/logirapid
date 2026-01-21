/**
 * Audit Count Report Generator - Generates ESC/POS commands for thermal printers (80mm)
 * For printing audit inventory count reports with dual valuation (cost and sale)
 */

interface AuditCountLine {
  productName: string
  productSku?: string
  systemQuantity: number
  countedQuantity: number
  difference: number
  differenceValueCost: number
  differenceValueSale: number
}

interface AuditCountReportData {
  // Header
  companyName?: string
  warehouseName: string

  // Count info
  countNumber: string
  countId?: number
  status: string // 'in_progress', 'completed'
  startedAt?: string
  completedAt?: string
  countedBy?: string

  // Summary
  totalProducts: number
  productsWithDifferences: number
  totalShortageValue?: number
  totalExcessValue?: number
  totalStockAtCost?: number
  totalStockAtSale?: number

  // Lines (optional - for detailed report)
  lines?: AuditCountLine[]

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

export function generateAuditCountReport(data: AuditCountReportData): Buffer {
  const lines: string[] = []
  const width = 32

  // Initialize
  lines.push(Commands.INIT)

  // Header
  lines.push(Commands.ALIGN_CENTER)
  lines.push(Commands.DOUBLE_SIZE_ON)
  lines.push(Commands.BOLD_ON)
  lines.push('REPORTE AUDITORIA')
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

  if (data.startedAt) {
    const date = new Date(data.startedAt)
    lines.push(`Fecha: ${date.toLocaleDateString('es-ES')}`)
    lines.push(Commands.FEED_LINE)
    lines.push(`Hora: ${date.toLocaleTimeString('es-ES')}`)
    lines.push(Commands.FEED_LINE)
  }

  if (data.countedBy) {
    lines.push(`Auditor: ${data.countedBy}`)
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

  lines.push(formatLine('Con diferencias:', data.productsWithDifferences.toString(), width))
  lines.push(Commands.FEED_LINE)

  lines.push('--------------------------------')
  lines.push(Commands.FEED_LINE)

  // Dual valuation section
  lines.push(Commands.ALIGN_CENTER)
  lines.push(Commands.BOLD_ON)
  lines.push('VALORACION A COSTO')
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)
  lines.push(Commands.ALIGN_LEFT)

  if (data.totalStockAtCost !== undefined) {
    lines.push(formatLine('Stock contado:', formatCurrency(data.totalStockAtCost), width))
    lines.push(Commands.FEED_LINE)
  }

  if (data.totalShortageValue !== undefined && data.totalShortageValue > 0) {
    lines.push(Commands.BOLD_ON)
    lines.push(formatLine('Faltantes:', `-${formatCurrency(data.totalShortageValue)}`, width))
    lines.push(Commands.BOLD_OFF)
    lines.push(Commands.FEED_LINE)
  }

  lines.push('--------------------------------')
  lines.push(Commands.FEED_LINE)

  lines.push(Commands.ALIGN_CENTER)
  lines.push(Commands.BOLD_ON)
  lines.push('VALORACION A VENTA')
  lines.push(Commands.BOLD_OFF)
  lines.push(Commands.FEED_LINE)
  lines.push(Commands.ALIGN_LEFT)

  if (data.totalStockAtSale !== undefined) {
    lines.push(formatLine('Stock contado:', formatCurrency(data.totalStockAtSale), width))
    lines.push(Commands.FEED_LINE)
  }

  // Detailed lines (if provided and not too many)
  if (data.lines && data.lines.length > 0) {
    lines.push('================================')
    lines.push(Commands.FEED_LINE)
    lines.push(Commands.ALIGN_CENTER)
    lines.push(Commands.BOLD_ON)
    lines.push('DETALLE DIFERENCIAS')
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

      // Show quantities
      const diffStr = line.difference > 0 ? `-${line.difference}` : `+${Math.abs(line.difference)}`
      lines.push(`Sist: ${line.systemQuantity} | Cont: ${line.countedQuantity} | Dif: ${diffStr}`)
      lines.push(Commands.FEED_LINE)

      // Show dual values
      lines.push(`Costo: ${formatCurrency(Math.abs(line.differenceValueCost))} | Venta: ${formatCurrency(Math.abs(line.differenceValueSale))}`)
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
  lines.push('Firma del Auditor')
  lines.push(Commands.FEED_LINE)

  lines.push(Commands.FEED_LINES(3))
  lines.push('--------------------------------')
  lines.push(Commands.FEED_LINE)
  lines.push('Firma del Supervisor')
  lines.push(Commands.FEED_LINE)

  // Footer
  lines.push(Commands.FEED_LINES(2))
  lines.push(Commands.ALIGN_CENTER)
  lines.push('--- Reporte de Auditoria ---')
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

export type { AuditCountReportData, AuditCountLine }
