/**
 * Wholesale Invoice PDF Generator - Generates PDF for standard printers (letter size)
 * For printing wholesale (mayorista) invoices on standard printers like Epson ET-2800
 * Includes dual currency (USD/CUP) display
 */

import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib'
import bwipjs from 'bwip-js'

interface InvoiceLine {
  productName: string
  productSku: string | null
  quantity: number
  unitPrice: number
  discountPercent: number
  discountAmount: number
  subtotal: number
}

export interface WholesaleInvoicePdfData {
  invoiceNumber: string
  customer: {
    code: string
    name: string
    taxId?: string
    address?: string
    phone?: string
  }
  warehouseName?: string | null
  lines: InvoiceLine[]
  subtotal: number
  discountPercent: number
  discountAmount: number
  totalAmount: number
  amountPaid: number
  amountDue: number
  currency: string
  status: string
  paymentStatus: string
  dueDate?: string | null
  createdAt: string
  notes?: string
  companyName?: string
  exchangeRate?: number
}

export async function generateWholesaleInvoicePdf(data: WholesaleInvoicePdfData): Promise<Buffer> {
  const companyName = data.companyName || 'LogiRapid'
  const invoiceNumber = data.invoiceNumber || 'Sin numero'
  const dateStr = formatDate(data.createdAt)
  const currencySymbol = data.currency === 'USD' ? '$' : data.currency
  const hasRate = data.exchangeRate && data.exchangeRate > 0
  const rate = data.exchangeRate || 0

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792]) // Letter size

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const lightGray = rgb(0.92, 0.92, 0.92)
  const darkBlue = rgb(0.1, 0.2, 0.4)
  const green = rgb(0, 0.5, 0)
  const red = rgb(0.8, 0, 0)
  const orange = rgb(0.8, 0.4, 0)

  let y = 750

  // Helper functions
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

  const rightAlignText = (
    text: string,
    rightX: number,
    yPos: number,
    options: { font?: PDFFont; size?: number; color?: typeof black } = {}
  ) => {
    const font = options.font || fontRegular
    const size = options.size || 10
    const width = font.widthOfTextAtSize(text, size)
    drawText(text, rightX - width, yPos, options)
  }

  // === GENERATE BARCODE ===
  let barcodeImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null
  try {
    const barcodeData = invoiceNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase()
    if (barcodeData.length > 0 && barcodeData.length <= 20) {
      const barcodePng = await bwipjs.toBuffer({
        bcid: 'code128',
        text: barcodeData,
        scale: 3,
        height: 12,
        includetext: false
      })
      barcodeImage = await pdfDoc.embedPng(barcodePng)
    }
  } catch (err) {
    console.error('[Wholesale Invoice PDF] Error generating barcode:', err)
  }

  // === HEADER ===
  drawText(companyName, 50, y, { font: fontBold, size: 18, color: darkBlue })
  drawText('FACTURA MAYORISTA', 400, y, { font: fontBold, size: 16, color: darkBlue })
  y -= 25

  // Barcode below title on right
  let infoY = y
  if (barcodeImage) {
    const barcodeWidth = 150
    const barcodeHeight = 35
    page.drawImage(barcodeImage, {
      x: 400,
      y: infoY - barcodeHeight,
      width: barcodeWidth,
      height: barcodeHeight
    })
    infoY -= barcodeHeight + 8
  }

  // Invoice info
  drawText(`No: ${invoiceNumber}`, 400, infoY, { font: fontBold, size: 11 })
  drawText(`Fecha: ${dateStr}`, 400, infoY - 15, { size: 10 })

  if (data.warehouseName) {
    drawText(`Almacen: ${data.warehouseName}`, 400, infoY - 30, { size: 9, color: gray })
  }

  if (data.dueDate) {
    drawText(`Vencimiento: ${formatDate(data.dueDate)}`, 400, infoY - 45, { size: 9, color: gray })
  }

  y = 660
  drawLine(50, y, 562, y)
  y -= 25

  // === CUSTOMER INFO ===
  drawText('CLIENTE', 50, y, { font: fontBold, size: 11, color: darkBlue })
  y -= 18

  drawText(data.customer.name, 50, y, { font: fontBold, size: 11 })
  y -= 15

  if (data.customer.code) {
    drawText(`Codigo: ${data.customer.code}`, 50, y, { size: 9 })
    y -= 13
  }

  if (data.customer.taxId) {
    drawText(`NIT/CI: ${data.customer.taxId}`, 50, y, { size: 9 })
    y -= 13
  }

  if (data.customer.address) {
    drawText(data.customer.address, 50, y, { size: 9, color: gray })
    y -= 13
  }

  if (data.customer.phone) {
    drawText(`Tel: ${data.customer.phone}`, 50, y, { size: 9, color: gray })
    y -= 13
  }

  // Payment status box on right side
  const paymentLabel = data.paymentStatus === 'paid' ? 'PAGADO'
    : data.paymentStatus === 'partial' ? 'PAGO PARCIAL'
    : data.paymentStatus === 'overdue' ? 'VENCIDO'
    : 'PENDIENTE'
  const paymentColor = data.paymentStatus === 'paid' ? green
    : data.paymentStatus === 'overdue' ? red : orange

  page.drawRectangle({
    x: 400,
    y: y + 25,
    width: 160,
    height: 25,
    color: paymentColor,
    borderWidth: 0
  })
  drawText(paymentLabel, 440, y + 32, { font: fontBold, size: 12, color: rgb(1, 1, 1) })

  y -= 15
  drawLine(50, y, 562, y)
  y -= 10

  // === ITEMS TABLE ===
  const tableTop = y
  page.drawRectangle({
    x: 50,
    y: tableTop - 5,
    width: 512,
    height: 20,
    color: lightGray
  })

  drawText('Cant', 55, tableTop, { font: fontBold, size: 9 })
  drawText('Descripcion', 90, tableTop, { font: fontBold, size: 9 })
  drawText('SKU', 280, tableTop, { font: fontBold, size: 9 })
  drawText('Precio Unit.', 350, tableTop, { font: fontBold, size: 9 })
  drawText('Desc.', 430, tableTop, { font: fontBold, size: 9 })
  rightAlignText('Total', 560, tableTop, { font: fontBold, size: 9 })

  y = tableTop - 25

  // Items
  for (const item of data.lines) {
    const itemName = item.productName || 'Producto sin nombre'

    // Row
    drawText((item.quantity ?? 0).toString(), 60, y, { size: 9 })
    drawText(itemName.substring(0, 28), 90, y, { size: 9 })
    drawText((item.productSku || '-').substring(0, 12), 280, y, { size: 8, color: gray })
    drawText(formatCurrency(item.unitPrice, currencySymbol), 350, y, { size: 9 })

    if (item.discountPercent > 0) {
      drawText(`${item.discountPercent}%`, 435, y, { size: 8, color: red })
    } else {
      drawText('-', 435, y, { size: 8, color: gray })
    }

    rightAlignText(formatCurrency(item.subtotal, currencySymbol), 560, y, { size: 9, font: fontBold })

    // CUP price below
    if (hasRate) {
      y -= 13
      drawText(formatCUP(item.unitPrice, rate) + ' c/u', 350, y, { size: 7, color: gray })
      rightAlignText(formatCUP(item.subtotal, rate), 560, y, { size: 7, color: gray })
    }

    y -= 18

    if (y < 160) break
  }

  drawLine(50, y + 8, 562, y + 8)
  y -= 15

  // === TOTALS ===
  const totalsLabelX = 380
  const totalsValueX = 560

  // Subtotal
  drawText('Subtotal:', totalsLabelX, y, { size: 10 })
  rightAlignText(formatCurrency(data.subtotal, currencySymbol), totalsValueX, y, { size: 10 })
  y -= 15

  if (hasRate) {
    rightAlignText(formatCUP(data.subtotal, rate), totalsValueX, y, { size: 9, color: gray })
    y -= 15
  }

  // Discount
  if (data.discountAmount > 0) {
    drawText(`Descuento (${data.discountPercent}%):`, totalsLabelX, y, { size: 10 })
    rightAlignText(`-${formatCurrency(data.discountAmount, currencySymbol)}`, totalsValueX, y, { size: 10, color: red })
    y -= 18
  }

  y -= 5

  // Total box
  page.drawRectangle({
    x: totalsLabelX - 10,
    y: y - 8,
    width: totalsValueX - totalsLabelX + 20,
    height: 28,
    color: darkBlue
  })
  drawText('TOTAL:', totalsLabelX, y, { font: fontBold, size: 12, color: rgb(1, 1, 1) })
  rightAlignText(
    formatCurrency(data.totalAmount, currencySymbol),
    totalsValueX,
    y,
    { font: fontBold, size: 14, color: rgb(1, 1, 1) }
  )
  y -= 35

  // Total in CUP
  if (hasRate) {
    drawText('Total CUP:', totalsLabelX, y, { font: fontBold, size: 11 })
    rightAlignText(formatCUP(data.totalAmount, rate), totalsValueX, y, { font: fontBold, size: 12 })
    y -= 18
    drawText(`Tasa: $1 = ${rate} CUP`, totalsLabelX, y, { size: 9, color: gray })
    y -= 25
  }

  // === PAYMENT INFO ===
  drawLine(50, y + 5, 350, y + 5)
  y -= 10

  if (data.amountPaid > 0) {
    drawText('Pagado:', 50, y, { size: 10 })
    drawText(formatCurrency(data.amountPaid, currencySymbol), 130, y, { size: 10 })
    if (hasRate) {
      drawText(formatCUP(data.amountPaid, rate), 220, y, { size: 9, color: gray })
    }
    y -= 18
  }

  if (data.amountDue > 0) {
    drawText('Pendiente:', 50, y, { font: fontBold, size: 10, color: red })
    drawText(formatCurrency(data.amountDue, currencySymbol), 130, y, { font: fontBold, size: 10, color: red })
    if (hasRate) {
      drawText(formatCUP(data.amountDue, rate), 220, y, { size: 9, color: red })
    }
    y -= 18
  }

  // === NOTES ===
  if (data.notes) {
    y -= 5
    drawLine(50, y + 5, 350, y + 5)
    drawText('Notas:', 50, y - 10, { font: fontBold, size: 9 })
    const noteLines = wordWrap(data.notes, 80)
    let noteY = y - 25
    for (const noteLine of noteLines) {
      drawText(noteLine, 50, noteY, { size: 9, color: gray })
      noteY -= 13
    }
  }

  // === FOOTER ===
  drawText(`--- Documento generado por ${companyName} ---`, 180, 30, { size: 8, color: gray })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

function formatCurrency(amount: number, symbol: string = '$'): string {
  return symbol + (amount ?? 0).toFixed(2)
}

function formatCUP(amount: number, rate: number): string {
  return Math.round((amount ?? 0) * rate).toLocaleString('es') + ' CUP'
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  } catch {
    return dateStr
  }
}

function wordWrap(text: string, maxChars: number): string[] {
  const words = text.split(' ')
  const result: string[] = []
  let currentLine = ''

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxChars) {
      currentLine += (currentLine ? ' ' : '') + word
    } else {
      if (currentLine) result.push(currentLine)
      currentLine = word
    }
  }
  if (currentLine) result.push(currentLine)
  return result
}
