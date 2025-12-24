/**
 * Warehouse Operation PDF Generator - Generates PDF for standard printers
 * For printing warehouse operations: reception, transfer, scrap, adjustment
 */

import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib'

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

const OPERATION_TITLES: Record<string, string> = {
  reception: 'RECEPCION DE MERCANCIA',
  transfer: 'TRANSFERENCIA INTERNA',
  scrap: 'SALIDA POR MERMA',
  adjustment: 'AJUSTE DE INVENTARIO'
}

const OPERATION_COLORS: Record<string, ReturnType<typeof rgb>> = {
  reception: rgb(0.1, 0.5, 0.2),  // Green
  transfer: rgb(0.1, 0.3, 0.6),  // Blue
  scrap: rgb(0.6, 0.1, 0.1),     // Red
  adjustment: rgb(0.6, 0.5, 0.1) // Amber
}

const SCRAP_REASONS: Record<string, string> = {
  damaged: 'Producto Danado',
  expired: 'Producto Vencido',
  defective: 'Producto Defectuoso',
  other: 'Otro Motivo'
}

const ADJUSTMENT_REASONS: Record<string, string> = {
  physical_count: 'Conteo Fisico',
  system_error: 'Error de Sistema',
  theft_loss: 'Robo o Perdida',
  other: 'Otro Motivo'
}

export async function generateWarehouseOperationPdf(data: WarehouseOperationData): Promise<Buffer> {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create()

  // Add a page (Letter size: 612 x 792 points)
  const page = pdfDoc.addPage([612, 792])

  // Embed fonts
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Colors
  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const lightGray = rgb(0.9, 0.9, 0.9)
  const operationColor = OPERATION_COLORS[data.operationType] || rgb(0.2, 0.2, 0.4)

  let y = 750 // Start from top

  // Helper function to draw text
  const drawText = (
    text: string,
    x: number,
    yPos: number,
    options: {
      font?: PDFFont
      size?: number
      color?: ReturnType<typeof rgb>
    } = {}
  ) => {
    page.drawText(text, {
      x,
      y: yPos,
      font: options.font || fontRegular,
      size: options.size || 10,
      color: options.color || black
    })
  }

  // Helper function to draw a line
  const drawLine = (x1: number, y1: number, x2: number, y2: number, color = gray) => {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: 0.5,
      color
    })
  }

  // === HEADER BANNER ===
  page.drawRectangle({
    x: 0,
    y: y - 10,
    width: 612,
    height: 50,
    color: operationColor
  })

  // Title
  const title = OPERATION_TITLES[data.operationType] || 'OPERACION DE ALMACEN'
  drawText(title, 50, y + 5, { font: fontBold, size: 18, color: rgb(1, 1, 1) })

  // Operation number on the right
  drawText(data.operationNumber, 400, y + 5, { font: fontBold, size: 14, color: rgb(1, 1, 1) })

  y -= 70

  // === DATE AND USER ===
  const dateStr = formatDate(data.createdAt)
  drawText(`Fecha: ${dateStr}`, 50, y, { size: 10 })

  if (data.createdBy) {
    drawText(`Usuario: ${data.createdBy}`, 300, y, { size: 10 })
  }

  y -= 30

  // Separator
  drawLine(50, y, 562, y, operationColor)
  y -= 25

  // === WAREHOUSE INFO ===
  if (data.operationType === 'transfer') {
    // Two columns for transfer
    // Origin
    page.drawRectangle({
      x: 50,
      y: y - 50,
      width: 240,
      height: 65,
      color: lightGray
    })
    drawText('ALMACEN ORIGEN', 60, y - 5, { font: fontBold, size: 10, color: operationColor })
    drawText(data.warehouse.name, 60, y - 22, { font: fontBold, size: 12 })
    drawText(`Codigo: ${data.warehouse.code}`, 60, y - 38, { size: 9, color: gray })

    // Destination
    if (data.destinationWarehouse) {
      page.drawRectangle({
        x: 310,
        y: y - 50,
        width: 240,
        height: 65,
        color: lightGray
      })
      drawText('ALMACEN DESTINO', 320, y - 5, { font: fontBold, size: 10, color: operationColor })
      drawText(data.destinationWarehouse.name, 320, y - 22, { font: fontBold, size: 12 })
      drawText(`Codigo: ${data.destinationWarehouse.code}`, 320, y - 38, { size: 9, color: gray })
    }

    // Arrow between warehouses
    drawText('-->', 270, y - 20, { font: fontBold, size: 16, color: operationColor })

    y -= 70
  } else {
    // Single warehouse for other operations
    page.drawRectangle({
      x: 50,
      y: y - 50,
      width: 250,
      height: 65,
      color: lightGray
    })
    drawText('ALMACEN', 60, y - 5, { font: fontBold, size: 10, color: operationColor })
    drawText(data.warehouse.name, 60, y - 22, { font: fontBold, size: 12 })
    drawText(`Codigo: ${data.warehouse.code}`, 60, y - 38, { size: 9, color: gray })

    // Reason box for scrap/adjustment
    if (data.operationType === 'scrap' && data.scrapReason) {
      page.drawRectangle({
        x: 320,
        y: y - 50,
        width: 230,
        height: 65,
        color: lightGray
      })
      drawText('MOTIVO', 330, y - 5, { font: fontBold, size: 10, color: operationColor })
      drawText(SCRAP_REASONS[data.scrapReason] || data.scrapReason, 330, y - 22, { font: fontBold, size: 11 })
    }

    if (data.operationType === 'adjustment' && data.adjustmentReason) {
      page.drawRectangle({
        x: 320,
        y: y - 50,
        width: 230,
        height: 65,
        color: lightGray
      })
      drawText('MOTIVO DE AJUSTE', 330, y - 5, { font: fontBold, size: 10, color: operationColor })
      drawText(ADJUSTMENT_REASONS[data.adjustmentReason] || data.adjustmentReason, 330, y - 22, { font: fontBold, size: 11 })
    }

    y -= 70
  }

  y -= 20

  // === PRODUCTS TABLE ===
  // Table header
  const tableTop = y
  page.drawRectangle({
    x: 50,
    y: tableTop - 5,
    width: 512,
    height: 20,
    color: operationColor
  })

  drawText('#', 55, tableTop, { font: fontBold, size: 9, color: rgb(1, 1, 1) })
  drawText('SKU', 80, tableTop, { font: fontBold, size: 9, color: rgb(1, 1, 1) })
  drawText('Producto', 160, tableTop, { font: fontBold, size: 9, color: rgb(1, 1, 1) })

  if (data.operationType === 'adjustment') {
    drawText('Stock Sist.', 380, tableTop, { font: fontBold, size: 9, color: rgb(1, 1, 1) })
    drawText('Stock Real', 450, tableTop, { font: fontBold, size: 9, color: rgb(1, 1, 1) })
    drawText('Dif.', 520, tableTop, { font: fontBold, size: 9, color: rgb(1, 1, 1) })
  } else {
    drawText('Cantidad', 450, tableTop, { font: fontBold, size: 9, color: rgb(1, 1, 1) })
    if (['transfer', 'scrap'].includes(data.operationType)) {
      drawText('Stock Act.', 520, tableTop, { font: fontBold, size: 9, color: rgb(1, 1, 1) })
    }
  }

  y = tableTop - 25

  // Table rows
  let totalQuantity = 0
  let rowNum = 1

  for (const product of data.products) {
    // Alternate row background
    if (rowNum % 2 === 0) {
      page.drawRectangle({
        x: 50,
        y: y - 5,
        width: 512,
        height: 20,
        color: rgb(0.97, 0.97, 0.97)
      })
    }

    drawText(rowNum.toString(), 55, y, { size: 9 })
    drawText(product.sku.substring(0, 15), 80, y, { size: 9, color: gray })
    drawText(product.name.substring(0, 35), 160, y, { size: 9 })

    if (data.operationType === 'adjustment') {
      const systemStock = product.currentStock || 0
      const realStock = product.realStock || 0
      const diff = realStock - systemStock
      const diffStr = diff >= 0 ? `+${diff}` : `${diff}`
      const diffColor = diff > 0 ? rgb(0, 0.5, 0) : diff < 0 ? rgb(0.8, 0, 0) : gray

      drawText(systemStock.toString(), 395, y, { size: 9 })
      drawText(realStock.toString(), 465, y, { size: 9, font: fontBold })
      drawText(diffStr, 525, y, { size: 9, font: fontBold, color: diffColor })

      totalQuantity += Math.abs(diff)
    } else {
      drawText(`x${product.quantity}`, 460, y, { size: 10, font: fontBold })
      totalQuantity += product.quantity

      if (['transfer', 'scrap'].includes(data.operationType) && product.currentStock !== undefined) {
        drawText(product.currentStock.toString(), 530, y, { size: 9, color: gray })
      }
    }

    y -= 20
    rowNum++

    // Check if we need a new page
    if (y < 150) {
      break
    }
  }

  // Draw bottom line of table
  drawLine(50, y + 8, 562, y + 8)
  y -= 30

  // === SUMMARY ===
  // Summary box
  page.drawRectangle({
    x: 350,
    y: y - 35,
    width: 200,
    height: 50,
    color: operationColor
  })

  drawText('RESUMEN', 365, y - 5, { font: fontBold, size: 10, color: rgb(1, 1, 1) })
  drawText(`Productos: ${data.products.length}`, 365, y - 20, { size: 10, color: rgb(1, 1, 1) })

  if (data.operationType === 'adjustment') {
    drawText(`Items ajustados: ${totalQuantity}`, 450, y - 20, { size: 10, color: rgb(1, 1, 1) })
  } else {
    drawText(`Total unidades: ${totalQuantity}`, 365, y - 35, { font: fontBold, size: 12, color: rgb(1, 1, 1) })
  }

  y -= 60

  // === NOTES ===
  if (data.notes) {
    drawLine(50, y, 300, y)
    y -= 15
    drawText('Notas:', 50, y, { font: fontBold, size: 9 })
    y -= 15

    // Word wrap notes
    const noteLines = wordWrap(data.notes, 70)
    for (const line of noteLines.slice(0, 3)) { // Max 3 lines
      drawText(line, 50, y, { size: 9, color: gray })
      y -= 12
    }
  }

  // === SIGNATURE LINES ===
  y = 80
  drawLine(50, y, 200, y)
  drawText('Firma Responsable', 80, y - 12, { size: 8, color: gray })

  drawLine(250, y, 400, y)
  drawText('Firma Recibe/Entrega', 280, y - 12, { size: 8, color: gray })

  drawLine(450, y, 550, y)
  drawText('Fecha', 485, y - 12, { size: 8, color: gray })

  // === FOOTER ===
  drawText('--- Documento generado por LogiRapid ---', 200, 25, { size: 8, color: gray })

  // Serialize the PDF to bytes
  const pdfBytes = await pdfDoc.save()

  return Buffer.from(pdfBytes)
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

function wordWrap(text: string, maxChars: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxChars) {
      currentLine += (currentLine ? ' ' : '') + word
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = word.substring(0, maxChars)
    }
  }
  if (currentLine) lines.push(currentLine)

  return lines
}

export type { WarehouseOperationData, OperationProduct, WarehouseInfo }
