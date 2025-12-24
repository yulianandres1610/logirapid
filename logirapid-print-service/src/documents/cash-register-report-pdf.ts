/**
 * Cash Register Report PDF Generator - Generates PDF for standard printers
 * For printing cash register close/audit reports
 */

import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib'

interface CashDenomination {
  denomination: number
  count: number
  total: number
}

interface CurrencyTotal {
  currency: string
  expected: number
  counted: number
  difference: number
}

interface CashRegisterReportData {
  // Header
  companyName: string
  terminalName: string
  terminalCode?: string
  warehouseName?: string

  // Session info
  sessionNumber?: string
  openedAt: string
  closedAt: string
  openedBy?: string
  closedBy?: string

  // Opening cash
  openingCashUsd?: number
  openingCashCup?: number
  openingCashMlc?: number

  // Sales summary
  totalTransactions: number
  grossSales: number
  discounts?: number
  netSales: number

  // Cash movements
  cashIn?: number
  cashOut?: number

  // Expected vs Counted
  currencyTotals?: CurrencyTotal[]

  // Denominations (optional)
  usdDenominations?: CashDenomination[]
  cupDenominations?: CashDenomination[]
  mlcDenominations?: CashDenomination[]

  // Final totals
  totalExpected: number
  totalCounted: number
  totalDifference: number

  // Notes
  notes?: string
}

export async function generateCashRegisterReportPdf(data: CashRegisterReportData): Promise<Buffer> {
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
  drawText('CIERRE DE CAJA', 230, y, { font: fontBold, size: 20, color: darkBlue })
  y -= 30

  drawText(data.companyName, 50, y, { font: fontBold, size: 14 })
  y -= 18

  drawText(`Terminal: ${data.terminalName}`, 50, y, { size: 11 })
  y -= 15

  if (data.warehouseName) {
    drawText(`Almacén: ${data.warehouseName}`, 50, y, { size: 10, color: gray })
    y -= 15
  }

  if (data.sessionNumber) {
    drawText(`Sesión: ${data.sessionNumber}`, 50, y, { size: 10, color: gray })
    y -= 15
  }

  // Session times on the right
  drawText(`Apertura: ${data.openedAt}`, 380, 720, { size: 10 })
  drawText(`Cierre: ${data.closedAt}`, 380, 705, { size: 10 })

  if (data.openedBy) {
    drawText(`Abrió: ${data.openedBy}`, 380, 690, { size: 9, color: gray })
  }
  if (data.closedBy) {
    drawText(`Cerró: ${data.closedBy}`, 380, 675, { size: 9, color: gray })
  }

  y -= 10
  drawLine(50, y, 562, y)
  y -= 25

  // === OPENING CASH ===
  page.drawRectangle({
    x: 50,
    y: y - 5,
    width: 240,
    height: 20,
    color: lightGray
  })
  drawText('EFECTIVO INICIAL', 55, y, { font: fontBold, size: 11, color: darkBlue })
  y -= 25

  if (data.openingCashUsd !== undefined) {
    drawText('USD:', 55, y, { size: 10 })
    drawText(`$${data.openingCashUsd.toFixed(2)}`, 130, y, { font: fontBold, size: 10 })
    y -= 18
  }
  if (data.openingCashCup !== undefined) {
    drawText('CUP:', 55, y, { size: 10 })
    drawText(`$${data.openingCashCup.toFixed(0)}`, 130, y, { font: fontBold, size: 10 })
    y -= 18
  }
  if (data.openingCashMlc !== undefined) {
    drawText('MLC:', 55, y, { size: 10 })
    drawText(`€${data.openingCashMlc.toFixed(2)}`, 130, y, { font: fontBold, size: 10 })
    y -= 18
  }

  y -= 10

  // === SALES SUMMARY (right column) ===
  let salesY = 660
  page.drawRectangle({
    x: 320,
    y: salesY - 5,
    width: 242,
    height: 20,
    color: lightGray
  })
  drawText('RESUMEN DE VENTAS', 325, salesY, { font: fontBold, size: 11, color: darkBlue })
  salesY -= 25

  drawText('Transacciones:', 325, salesY, { size: 10 })
  drawText(data.totalTransactions.toString(), 450, salesY, { font: fontBold, size: 10 })
  salesY -= 18

  drawText('Ventas brutas:', 325, salesY, { size: 10 })
  drawText(formatCurrency(data.grossSales), 450, salesY, { size: 10 })
  salesY -= 18

  if (data.discounts !== undefined && data.discounts > 0) {
    drawText('Descuentos:', 325, salesY, { size: 10 })
    drawText(`-${formatCurrency(data.discounts)}`, 450, salesY, { size: 10, color: red })
    salesY -= 18
  }

  drawText('Ventas netas:', 325, salesY, { font: fontBold, size: 10 })
  drawText(formatCurrency(data.netSales), 450, salesY, { font: fontBold, size: 10 })
  salesY -= 18

  // Cash movements
  if (data.cashIn !== undefined || data.cashOut !== undefined) {
    salesY -= 5
    drawLine(325, salesY + 5, 560, salesY + 5)
    salesY -= 5

    if (data.cashIn !== undefined && data.cashIn > 0) {
      drawText('Entradas:', 325, salesY, { size: 10 })
      drawText(`+${formatCurrency(data.cashIn)}`, 450, salesY, { size: 10, color: green })
      salesY -= 18
    }
    if (data.cashOut !== undefined && data.cashOut > 0) {
      drawText('Salidas:', 325, salesY, { size: 10 })
      drawText(`-${formatCurrency(data.cashOut)}`, 450, salesY, { size: 10, color: red })
      salesY -= 18
    }
  }

  // === CURRENCY TOTALS ===
  if (data.currencyTotals && data.currencyTotals.length > 0) {
    page.drawRectangle({
      x: 50,
      y: y - 5,
      width: 512,
      height: 20,
      color: lightGray
    })
    drawText('ARQUEO POR MONEDA', 55, y, { font: fontBold, size: 11, color: darkBlue })
    y -= 25

    // Table header
    drawText('Moneda', 55, y, { font: fontBold, size: 9 })
    drawText('Esperado', 180, y, { font: fontBold, size: 9 })
    drawText('Contado', 300, y, { font: fontBold, size: 9 })
    drawText('Diferencia', 450, y, { font: fontBold, size: 9 })
    y -= 18

    for (const curr of data.currencyTotals) {
      const symbol = curr.currency === 'MLC' ? '€' : '$'
      drawText(curr.currency, 55, y, { font: fontBold, size: 10 })
      drawText(`${symbol}${curr.expected.toFixed(2)}`, 180, y, { size: 10 })
      drawText(`${symbol}${curr.counted.toFixed(2)}`, 300, y, { size: 10 })

      const diffSign = curr.difference >= 0 ? '+' : ''
      const diffColor = curr.difference >= 0 ? green : red
      drawText(`${diffSign}${symbol}${curr.difference.toFixed(2)}`, 450, y, { font: fontBold, size: 10, color: diffColor })
      y -= 20
    }

    y -= 10
  }

  // === FINAL TOTALS ===
  page.drawRectangle({
    x: 50,
    y: y - 5,
    width: 512,
    height: 20,
    color: lightGray
  })
  drawText('TOTALES', 55, y, { font: fontBold, size: 11, color: darkBlue })
  y -= 25

  drawText('Esperado:', 55, y, { size: 11 })
  drawText(formatCurrency(data.totalExpected), 180, y, { font: fontBold, size: 11 })
  y -= 20

  drawText('Contado:', 55, y, { size: 11 })
  drawText(formatCurrency(data.totalCounted), 180, y, { font: fontBold, size: 11 })
  y -= 20

  drawLine(55, y + 5, 280, y + 5)
  y -= 5

  // Final difference box
  const diffLabel = data.totalDifference >= 0 ? 'SOBRANTE:' : 'FALTANTE:'
  const diffColor = data.totalDifference >= 0 ? green : red

  page.drawRectangle({
    x: 50,
    y: y - 10,
    width: 250,
    height: 30,
    color: data.totalDifference >= 0 ? rgb(0.9, 1, 0.9) : rgb(1, 0.9, 0.9)
  })
  drawText(diffLabel, 55, y - 2, { font: fontBold, size: 14, color: diffColor })
  drawText(formatCurrency(Math.abs(data.totalDifference)), 160, y - 2, { font: fontBold, size: 16, color: diffColor })
  y -= 50

  // === NOTES ===
  if (data.notes) {
    drawLine(50, y + 5, 400, y + 5)
    drawText('Notas:', 55, y - 10, { font: fontBold, size: 9 })
    drawText(data.notes.substring(0, 80), 55, y - 25, { size: 9, color: gray })
    y -= 45
  }

  // === SIGNATURE LINES ===
  y -= 20
  drawLine(55, y, 200, y)
  drawText('Firma del Cajero', 90, y - 15, { size: 9, color: gray })

  drawLine(320, y, 465, y)
  drawText('Firma del Supervisor', 350, y - 15, { size: 9, color: gray })

  // === FOOTER ===
  drawText('--- Cierre de Caja generado por LogiRapid ---', 180, 30, { size: 8, color: gray })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

function formatCurrency(amount: number): string {
  return '$' + amount.toFixed(2)
}

export type { CashRegisterReportData, CashDenomination, CurrencyTotal }
