/**
 * Sales Report PDF Generator - Generates PDF for standard printers
 * For printing daily/period sales reports
 */

import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib'

interface SalesSummary {
  paymentMethod: string
  transactionCount: number
  total: number
}

interface TopProduct {
  name: string
  quantity: number
  total: number
}

interface SalesReportData {
  // Header
  companyName: string
  terminalName?: string
  terminalCode?: string
  warehouseName?: string

  // Report info
  reportTitle?: string
  reportType?: string // 'daily', 'weekly', 'monthly', 'custom'
  reportDate: string
  periodStart?: string
  periodEnd?: string
  generatedAt?: string
  generatedBy?: string

  // Summary
  totalTransactions: number
  totalProducts: number
  grossSales: number
  discounts?: number
  taxes?: number
  netSales: number

  // Sales by payment method
  salesByPayment?: SalesSummary[]

  // Sales by currency
  salesByCurrency?: {
    currency: string
    amount: number
    transactionCount: number
  }[]

  // Top products
  topProducts?: TopProduct[]

  // Cash register info
  openingCash?: number
  closingCash?: number
  cashDifference?: number

  // Notes
  notes?: string
}

export async function generateSalesReportPdf(data: SalesReportData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792]) // Letter size

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const lightGray = rgb(0.9, 0.9, 0.9)
  const darkBlue = rgb(0.1, 0.2, 0.4)
  const green = rgb(0, 0.5, 0)

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
  drawText(data.reportTitle || 'REPORTE DE VENTAS', 200, y, { font: fontBold, size: 18, color: darkBlue })
  y -= 25

  drawText(data.companyName, 50, y, { font: fontBold, size: 14 })
  y -= 18

  if (data.terminalName) {
    drawText(`Terminal: ${data.terminalName}`, 50, y, { size: 10, color: gray })
    y -= 15
  }

  if (data.warehouseName) {
    drawText(`Almacén: ${data.warehouseName}`, 50, y, { size: 10, color: gray })
    y -= 15
  }

  // Date info on the right
  if (data.periodStart && data.periodEnd) {
    drawText(`Período: ${data.periodStart} - ${data.periodEnd}`, 380, 725, { size: 10 })
  } else {
    drawText(`Fecha: ${data.reportDate}`, 450, 725, { size: 10 })
  }

  if (data.generatedAt) {
    drawText(`Generado: ${data.generatedAt}`, 400, 710, { size: 9, color: gray })
  }

  if (data.generatedBy) {
    drawText(`Por: ${data.generatedBy}`, 450, 695, { size: 9, color: gray })
  }

  y -= 10
  drawLine(50, y, 562, y)
  y -= 25

  // === SALES SUMMARY ===
  page.drawRectangle({
    x: 50,
    y: y - 5,
    width: 250,
    height: 20,
    color: lightGray
  })
  drawText('RESUMEN DE VENTAS', 55, y, { font: fontBold, size: 11, color: darkBlue })
  y -= 25

  drawText('Transacciones:', 55, y, { size: 10 })
  drawText(data.totalTransactions.toString(), 180, y, { font: fontBold, size: 10 })
  y -= 18

  drawText('Productos vendidos:', 55, y, { size: 10 })
  drawText(data.totalProducts.toString(), 180, y, { font: fontBold, size: 10 })
  y -= 18

  drawLine(55, y + 5, 280, y + 5)
  y -= 5

  drawText('Ventas brutas:', 55, y, { size: 10 })
  drawText(formatCurrency(data.grossSales), 180, y, { size: 10 })
  y -= 18

  if (data.discounts !== undefined && data.discounts > 0) {
    drawText('Descuentos:', 55, y, { size: 10 })
    drawText(`-${formatCurrency(data.discounts)}`, 180, y, { size: 10, color: rgb(0.8, 0, 0) })
    y -= 18
  }

  if (data.taxes !== undefined) {
    drawText('Impuestos:', 55, y, { size: 10 })
    drawText(formatCurrency(data.taxes), 180, y, { size: 10 })
    y -= 18
  }

  // Net sales box
  y -= 5
  page.drawRectangle({
    x: 50,
    y: y - 8,
    width: 250,
    height: 28,
    color: darkBlue
  })
  drawText('VENTAS NETAS:', 55, y, { font: fontBold, size: 12, color: rgb(1, 1, 1) })
  drawText(formatCurrency(data.netSales), 170, y, { font: fontBold, size: 14, color: rgb(1, 1, 1) })
  y -= 40

  // === SALES BY PAYMENT METHOD ===
  if (data.salesByPayment && data.salesByPayment.length > 0) {
    page.drawRectangle({
      x: 50,
      y: y - 5,
      width: 250,
      height: 20,
      color: lightGray
    })
    drawText('VENTAS POR MÉTODO DE PAGO', 55, y, { font: fontBold, size: 11, color: darkBlue })
    y -= 25

    for (const payment of data.salesByPayment) {
      drawText(`${payment.paymentMethod}:`, 55, y, { size: 10 })
      drawText(formatCurrency(payment.total), 180, y, { font: fontBold, size: 10 })
      y -= 15
      drawText(`(${payment.transactionCount} transacciones)`, 70, y, { size: 9, color: gray })
      y -= 18
    }

    y -= 10
  }

  // === SALES BY CURRENCY (on the right side) ===
  if (data.salesByCurrency && data.salesByCurrency.length > 0) {
    let currY = 660
    page.drawRectangle({
      x: 320,
      y: currY - 5,
      width: 242,
      height: 20,
      color: lightGray
    })
    drawText('VENTAS POR MONEDA', 325, currY, { font: fontBold, size: 11, color: darkBlue })
    currY -= 25

    for (const currency of data.salesByCurrency) {
      const symbol = currency.currency === 'MLC' ? '€' : '$'
      drawText(`${currency.currency}:`, 325, currY, { size: 10 })
      drawText(`${symbol}${currency.amount.toFixed(2)}`, 420, currY, { font: fontBold, size: 10 })
      currY -= 15
      drawText(`(${currency.transactionCount} transacciones)`, 340, currY, { size: 9, color: gray })
      currY -= 18
    }
  }

  // === TOP PRODUCTS ===
  if (data.topProducts && data.topProducts.length > 0) {
    page.drawRectangle({
      x: 50,
      y: y - 5,
      width: 512,
      height: 20,
      color: lightGray
    })
    drawText('PRODUCTOS MÁS VENDIDOS', 55, y, { font: fontBold, size: 11, color: darkBlue })
    y -= 25

    // Table header
    drawText('#', 55, y, { font: fontBold, size: 9 })
    drawText('Producto', 75, y, { font: fontBold, size: 9 })
    drawText('Cantidad', 380, y, { font: fontBold, size: 9 })
    drawText('Total', 480, y, { font: fontBold, size: 9 })
    y -= 18

    for (let i = 0; i < Math.min(10, data.topProducts.length); i++) {
      const product = data.topProducts[i]
      drawText(`${i + 1}.`, 55, y, { size: 9 })
      drawText(product.name.substring(0, 45), 75, y, { size: 9 })
      drawText(product.quantity.toString(), 395, y, { size: 9 })
      drawText(formatCurrency(product.total), 480, y, { font: fontBold, size: 9 })
      y -= 16
    }

    y -= 10
  }

  // === CASH REGISTER INFO ===
  if (data.openingCash !== undefined || data.closingCash !== undefined) {
    drawLine(50, y + 5, 300, y + 5)
    y -= 10

    drawText('MOVIMIENTO DE CAJA', 55, y, { font: fontBold, size: 10, color: darkBlue })
    y -= 18

    if (data.openingCash !== undefined) {
      drawText('Apertura:', 55, y, { size: 10 })
      drawText(formatCurrency(data.openingCash), 150, y, { size: 10 })
      y -= 15
    }

    if (data.closingCash !== undefined) {
      drawText('Cierre:', 55, y, { size: 10 })
      drawText(formatCurrency(data.closingCash), 150, y, { size: 10 })
      y -= 15
    }

    if (data.cashDifference !== undefined) {
      const diffLabel = data.cashDifference >= 0 ? 'Sobrante:' : 'Faltante:'
      const diffColor = data.cashDifference >= 0 ? green : rgb(0.8, 0, 0)
      drawText(diffLabel, 55, y, { font: fontBold, size: 10 })
      drawText(formatCurrency(Math.abs(data.cashDifference)), 150, y, { font: fontBold, size: 10, color: diffColor })
      y -= 15
    }
  }

  // === NOTES ===
  if (data.notes) {
    y -= 10
    drawLine(50, y + 5, 300, y + 5)
    drawText('Notas:', 55, y - 10, { font: fontBold, size: 9 })
    drawText(data.notes.substring(0, 80), 55, y - 25, { size: 9, color: gray })
  }

  // === FOOTER ===
  drawText('--- Reporte generado por LogiRapid ---', 200, 30, { size: 8, color: gray })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

function formatCurrency(amount: number): string {
  return '$' + amount.toFixed(2)
}

export type { SalesReportData, SalesSummary, TopProduct }
