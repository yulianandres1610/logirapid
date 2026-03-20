/**
 * Production Order PDF Generator - Generates PDF for standard printers
 * For printing production/dosification orders for workers
 */

import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib'

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

export interface ProductionOrderPdfData {
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

const STATUS_LABELS: Record<string, string> = {
  pending: 'PENDIENTE',
  in_progress: 'EN PROCESO',
  completed: 'COMPLETADA',
  cancelled: 'CANCELADA'
}

const STATUS_COLORS: Record<string, ReturnType<typeof rgb>> = {
  pending: rgb(0.6, 0.5, 0.1),    // Amber
  in_progress: rgb(0.1, 0.3, 0.6), // Blue
  completed: rgb(0.1, 0.5, 0.2),   // Green
  cancelled: rgb(0.6, 0.1, 0.1)    // Red
}

export async function generateProductionOrderPdf(data: ProductionOrderPdfData): Promise<Buffer> {
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
  const lightGray = rgb(0.95, 0.95, 0.95)
  const primaryColor = rgb(0.2, 0.4, 0.6) // Blue
  const surplusColor = rgb(0.1, 0.5, 0.2) // Green
  const wasteColor = rgb(0.6, 0.1, 0.1)   // Red

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
    color: primaryColor
  })

  // Title
  drawText('ORDEN DE PRODUCCION', 50, y + 5, { font: fontBold, size: 18, color: rgb(1, 1, 1) })

  // Order number on the right
  drawText(data.orderNumber, 400, y + 5, { font: fontBold, size: 14, color: rgb(1, 1, 1) })

  y -= 70

  // === STATUS AND DATE ===
  // Status badge
  const statusColor = STATUS_COLORS[data.status] || gray
  page.drawRectangle({
    x: 50,
    y: y - 5,
    width: 100,
    height: 20,
    color: statusColor
  })
  drawText(STATUS_LABELS[data.status] || data.status, 60, y, { font: fontBold, size: 10, color: rgb(1, 1, 1) })

  // Date
  const dateStr = formatDate(data.createdAt)
  drawText(`Fecha: ${dateStr}`, 170, y, { size: 10 })

  if (data.createdBy) {
    drawText(`Usuario: ${data.createdBy}`, 350, y, { size: 10 })
  }

  y -= 30

  // Separator
  drawLine(50, y, 562, y, primaryColor)
  y -= 25

  // === SOURCE PRODUCT SECTION ===
  page.drawRectangle({
    x: 50,
    y: y - 80,
    width: 250,
    height: 95,
    color: lightGray
  })

  drawText('PRODUCTO A DOSIFICAR', 60, y - 5, { font: fontBold, size: 10, color: primaryColor })
  y -= 20

  drawText(data.sourceProduct.name.substring(0, 35), 60, y, { font: fontBold, size: 11 })
  y -= 15

  drawText(`SKU: ${data.sourceProduct.sku}`, 60, y, { size: 9, color: gray })
  y -= 18

  drawText(`Peso:`, 60, y, { size: 10 })
  drawText(`${data.sourceWeightKg.toFixed(3)} kg`, 100, y, { font: fontBold, size: 14, color: primaryColor })
  y -= 18

  drawText(`Almacen: ${data.sourceWarehouse.name.substring(0, 25)}`, 60, y, { size: 9, color: gray })

  // === TARGET PRODUCT SECTION ===
  const targetY = y + 71 // Same level as source
  page.drawRectangle({
    x: 320,
    y: targetY - 80,
    width: 242,
    height: 95,
    color: lightGray
  })

  drawText('PRODUCCION ESPERADA', 330, targetY - 5, { font: fontBold, size: 10, color: primaryColor })

  drawText(data.targetProduct.name.substring(0, 30), 330, targetY - 25, { font: fontBold, size: 11 })

  drawText(`${data.targetQuantity} porciones x ${data.targetPortionWeightKg.toFixed(3)} kg`, 330, targetY - 43, { size: 10 })

  drawText(`Total:`, 330, targetY - 61, { size: 10 })
  drawText(`${data.expectedTotalWeightKg.toFixed(3)} kg`, 370, targetY - 61, { font: fontBold, size: 14, color: primaryColor })

  drawText(`Almacen: ${data.targetWarehouse.name.substring(0, 22)}`, 330, targetY - 79, { size: 9, color: gray })

  // Arrow between sections
  drawText('-->', 285, targetY - 40, { font: fontBold, size: 16, color: primaryColor })

  y -= 30

  // === WASTE/SURPLUS SECTION ===
  y -= 25

  const wasteSurplusColor = data.wasteSurplusType === 'surplus' ? surplusColor :
                            data.wasteSurplusType === 'waste' ? wasteColor : gray

  page.drawRectangle({
    x: 200,
    y: y - 35,
    width: 212,
    height: 50,
    color: wasteSurplusColor
  })

  if (data.wasteSurplusType === 'surplus') {
    drawText('SOBRANTE ESPERADO', 230, y - 8, { font: fontBold, size: 10, color: rgb(1, 1, 1) })
    drawText(`+${data.wasteSurplusKg.toFixed(3)} kg`, 255, y - 28, { font: fontBold, size: 16, color: rgb(1, 1, 1) })
  } else if (data.wasteSurplusType === 'waste') {
    drawText('MERMA ESPERADA', 240, y - 8, { font: fontBold, size: 10, color: rgb(1, 1, 1) })
    drawText(`${data.wasteSurplusKg.toFixed(3)} kg`, 260, y - 28, { font: fontBold, size: 16, color: rgb(1, 1, 1) })
  } else {
    drawText('PESO EXACTO', 260, y - 18, { font: fontBold, size: 12, color: rgb(1, 1, 1) })
  }

  y -= 60

  // === MATERIALS SECTION ===
  if (data.materials.length > 0) {
    drawLine(50, y, 562, y, primaryColor)
    y -= 20

    drawText('MATERIALES A USAR', 50, y, { font: fontBold, size: 12, color: primaryColor })
    y -= 20

    // Table header
    page.drawRectangle({
      x: 50,
      y: y - 5,
      width: 512,
      height: 20,
      color: primaryColor
    })

    drawText('', 55, y, { font: fontBold, size: 9, color: rgb(1, 1, 1) })
    drawText('Cantidad', 60, y, { font: fontBold, size: 9, color: rgb(1, 1, 1) })
    drawText('Material', 130, y, { font: fontBold, size: 9, color: rgb(1, 1, 1) })
    drawText('SKU', 350, y, { font: fontBold, size: 9, color: rgb(1, 1, 1) })
    drawText('Almacen', 450, y, { font: fontBold, size: 9, color: rgb(1, 1, 1) })

    y -= 25

    // Materials rows
    for (let i = 0; i < data.materials.length; i++) {
      const material = data.materials[i]

      // Alternate row background
      if (i % 2 === 0) {
        page.drawRectangle({
          x: 50,
          y: y - 5,
          width: 512,
          height: 20,
          color: rgb(0.97, 0.97, 0.97)
        })
      }

      // Checkbox
      page.drawRectangle({
        x: 60,
        y: y - 2,
        width: 12,
        height: 12,
        borderColor: gray,
        borderWidth: 1
      })

      drawText(`x${material.quantity}`, 80, y, { font: fontBold, size: 10 })
      drawText(material.name.substring(0, 35), 130, y, { size: 9 })
      drawText(material.sku.substring(0, 15), 350, y, { size: 8, color: gray })
      drawText(material.warehouseName.substring(0, 15), 450, y, { size: 8, color: gray })

      y -= 20

      if (y < 200) break // Prevent overflow
    }

    drawLine(50, y + 8, 562, y + 8)
    y -= 15
  }

  // === COST SUMMARY ===
  if (data.costPerUnit > 0) {
    page.drawRectangle({
      x: 380,
      y: y - 60,
      width: 180,
      height: 70,
      color: lightGray
    })

    drawText('COSTOS', 400, y - 10, { font: fontBold, size: 10, color: primaryColor })

    if (data.materialsCost > 0) {
      drawText(`Materiales:`, 400, y - 28, { size: 9 })
      drawText(`$${data.materialsCost.toFixed(2)}`, 490, y - 28, { size: 9 })
    }

    if (data.laborCost > 0) {
      drawText(`Mano de obra:`, 400, y - 40, { size: 9 })
      drawText(`$${data.laborCost.toFixed(2)}`, 490, y - 40, { size: 9 })
    }

    drawText(`Costo/Unidad:`, 400, y - 55, { font: fontBold, size: 10 })
    drawText(`$${data.costPerUnit.toFixed(2)}`, 490, y - 55, { font: fontBold, size: 12, color: primaryColor })

    y -= 80
  }

  // === NOTES ===
  if (data.notes) {
    drawLine(50, y, 350, y)
    y -= 15
    drawText('Notas:', 50, y, { font: fontBold, size: 9 })
    y -= 15

    const noteLines = wordWrap(data.notes, 60)
    for (const line of noteLines.slice(0, 3)) {
      drawText(line, 50, y, { size: 9, color: gray })
      y -= 12
    }
  }

  // === SIGNATURE LINES ===
  y = 80
  drawLine(50, y, 200, y)
  drawText('Firma Produccion', 85, y - 12, { size: 8, color: gray })

  drawLine(250, y, 400, y)
  drawText('Firma Supervisor', 290, y - 12, { size: 8, color: gray })

  drawLine(450, y, 550, y)
  drawText('Fecha', 485, y - 12, { size: 8, color: gray })

  // === FOOTER ===
  drawText('--- Documento de Produccion - LogiRapid ---', 185, 25, { size: 8, color: gray })

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
