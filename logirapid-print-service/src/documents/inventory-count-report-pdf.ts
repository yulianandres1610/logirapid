/**
 * Inventory Count Report PDF Generator - Generates PDF for standard printers
 * For printing inventory count/audit reports
 */

import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib'

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

export async function generateInventoryCountReportPdf(data: InventoryCountReportData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792]) // Letter size

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const lightGray = rgb(0.9, 0.9, 0.9)
  const darkBlue = rgb(0.1, 0.2, 0.4)
  const green = rgb(0, 0.5, 0)
  const red = rgb(0.8, 0, 0)
  const orange = rgb(0.9, 0.5, 0)

  let y = 750

  const drawText = (
    text: string,
    x: number,
    yPos: number,
    options: { font?: PDFFont; size?: number; color?: typeof black } = {}
  ) => {
    page.drawText(text, {
      x,
      y: yPos,
      font: options.font || fontRegular,
      size: options.size || 10,
      color: options.color || black
    })
  }

  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: 0.5,
      color: gray
    })
  }

  // === HEADER ===
  drawText('REPORTE DE CONTEO', 210, y, { font: fontBold, size: 20, color: darkBlue })
  y -= 25

  drawText(data.countNumber, 50, y, { font: fontBold, size: 14 })

  // Status badge
  const statusText = data.status === 'completed' ? 'COMPLETADO' : 'EN PROGRESO'
  const statusColor = data.status === 'completed' ? green : orange
  drawText(statusText, 200, y, { font: fontBold, size: 11, color: statusColor })
  y -= 20

  if (data.companyName) {
    drawText(data.companyName, 50, y, { size: 11 })
    y -= 15
  }

  drawText(`Almacén: ${data.warehouseName}`, 50, y, { size: 10, color: gray })
  y -= 15

  if (data.terminalName) {
    drawText(`Terminal: ${data.terminalName}`, 50, y, { size: 10, color: gray })
    y -= 15
  }

  // Dates on the right
  drawText(`Iniciado: ${data.startedAt}`, 380, 725, { size: 10 })
  if (data.completedAt) {
    drawText(`Completado: ${data.completedAt}`, 380, 710, { size: 10 })
  }
  if (data.countedBy) {
    drawText(`Contado por: ${data.countedBy}`, 380, 695, { size: 9, color: gray })
  }

  y -= 10
  drawLine(50, y, 562, y)
  y -= 25

  // === SUMMARY ===
  page.drawRectangle({
    x: 50,
    y: y - 5,
    width: 250,
    height: 20,
    color: lightGray
  })
  drawText('RESUMEN', 55, y, { font: fontBold, size: 11, color: darkBlue })
  y -= 25

  drawText('Total productos:', 55, y, { size: 10 })
  drawText(data.totalProducts.toString(), 180, y, { font: fontBold, size: 10 })
  y -= 18

  if (data.totalExpected !== undefined) {
    drawText('Cantidad esperada:', 55, y, { size: 10 })
    drawText(data.totalExpected.toString(), 180, y, { size: 10 })
    y -= 18
  }

  if (data.totalCounted !== undefined) {
    drawText('Cantidad contada:', 55, y, { size: 10 })
    drawText(data.totalCounted.toString(), 180, y, { size: 10 })
    y -= 18
  }

  drawLine(55, y + 5, 280, y + 5)
  y -= 5

  drawText('Con diferencias:', 55, y, { size: 10 })
  drawText(data.productsWithDifferences.toString(), 180, y, { font: fontBold, size: 10, color: data.productsWithDifferences > 0 ? orange : black })
  y -= 18

  if (data.productsWithExcess !== undefined && data.productsWithExcess > 0) {
    drawText('  - Sobrantes:', 55, y, { size: 10 })
    drawText(data.productsWithExcess.toString(), 180, y, { size: 10, color: green })
    y -= 15
  }

  if (data.productsWithShortage !== undefined && data.productsWithShortage > 0) {
    drawText('  - Faltantes:', 55, y, { size: 10 })
    drawText(data.productsWithShortage.toString(), 180, y, { size: 10, color: red })
    y -= 15
  }

  y -= 10

  // Total difference value box
  const diffSign = data.totalDifferenceValue >= 0 ? '+' : '-'
  const diffColor = data.totalDifferenceValue >= 0 ? green : red
  const boxColor = data.totalDifferenceValue >= 0 ? rgb(0.9, 1, 0.9) : rgb(1, 0.9, 0.9)

  page.drawRectangle({
    x: 50,
    y: y - 8,
    width: 250,
    height: 30,
    color: boxColor
  })
  drawText('VALOR DIFERENCIA:', 55, y, { font: fontBold, size: 11, color: diffColor })
  drawText(`${diffSign}${formatCurrency(Math.abs(data.totalDifferenceValue))}`, 185, y, { font: fontBold, size: 14, color: diffColor })
  y -= 50

  // === DETAILED LINES ===
  if (data.lines && data.lines.length > 0) {
    // Only show items with differences
    const itemsWithDiff = data.lines.filter(l => l.difference !== 0)

    if (itemsWithDiff.length > 0) {
      page.drawRectangle({
        x: 50,
        y: y - 5,
        width: 512,
        height: 20,
        color: lightGray
      })
      drawText('DETALLE DE DIFERENCIAS', 55, y, { font: fontBold, size: 11, color: darkBlue })
      y -= 25

      // Table header
      drawText('Producto', 55, y, { font: fontBold, size: 9 })
      drawText('SKU', 230, y, { font: fontBold, size: 9 })
      drawText('Esperado', 320, y, { font: fontBold, size: 9 })
      drawText('Contado', 390, y, { font: fontBold, size: 9 })
      drawText('Diferencia', 460, y, { font: fontBold, size: 9 })
      y -= 5
      drawLine(50, y, 562, y)
      y -= 13

      const maxItems = Math.min(20, itemsWithDiff.length)
      for (let i = 0; i < maxItems; i++) {
        const line = itemsWithDiff[i]
        const lineDiffColor = line.difference > 0 ? green : red
        const diffStr = line.difference > 0 ? `+${line.difference}` : line.difference.toString()

        drawText(line.productName.substring(0, 28), 55, y, { size: 9 })
        drawText(line.productSku || '-', 230, y, { size: 8, color: gray })
        drawText(line.expectedQuantity.toString(), 335, y, { size: 9 })
        drawText(line.countedQuantity.toString(), 405, y, { size: 9 })
        drawText(diffStr, 470, y, { font: fontBold, size: 9, color: lineDiffColor })

        y -= 16

        if (y < 150) break
      }

      if (itemsWithDiff.length > maxItems) {
        drawText(`... y ${itemsWithDiff.length - maxItems} productos más con diferencias`, 55, y, { size: 9, color: gray })
        y -= 15
      }

      // Bottom line
      drawLine(50, y + 8, 562, y + 8)
      y -= 10
    }
  }

  // === NOTES ===
  if (data.notes) {
    drawLine(50, y + 5, 400, y + 5)
    drawText('Notas:', 55, y - 10, { font: fontBold, size: 9 })
    drawText(data.notes.substring(0, 80), 55, y - 25, { size: 9, color: gray })
    y -= 45
  }

  // === SIGNATURE LINES ===
  y = Math.min(y, 120)
  drawLine(55, y, 200, y)
  drawText('Firma del Contador', 85, y - 15, { size: 9, color: gray })

  drawLine(320, y, 465, y)
  drawText('Firma del Supervisor', 350, y - 15, { size: 9, color: gray })

  // === FOOTER ===
  drawText('--- Reporte de Conteo generado por LogiRapid ---', 175, 30, { size: 8, color: gray })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

function formatCurrency(amount: number): string {
  return '$' + amount.toFixed(2)
}

export type { InventoryCountReportData, CountLine }
