/**
 * Transport Invoice PDF Generator - Letter size
 * Factura de transporte en CUP con datos del transportista
 */

import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib'
import bwipjs from 'bwip-js'

export interface TransportInvoicePdfData {
  transportNumber: string
  invoiceNumber: string
  customer: {
    name: string
    code?: string
    phone?: string
    address?: string
  }
  driver: {
    name: string
    lastname: string
    idCard: string
    vehicleBrand: string
    vehiclePlate: string
  }
  amount: number
  exchangeRate: number
  createdAt: string
  notes?: string
  brandLogo?: string | null
  brandPrimaryColor?: string
  brandDisplayName?: string
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  return rgb(parseInt(h.substring(0, 2), 16) / 255, parseInt(h.substring(2, 4), 16) / 255, parseInt(h.substring(4, 6), 16) / 255)
}

export async function generateTransportInvoicePdf(data: TransportInvoicePdfData): Promise<Buffer> {
  const displayName = data.brandDisplayName || 'LogiRapid'
  const primaryColor = data.brandPrimaryColor ? hexToRgb(data.brandPrimaryColor) : rgb(0.8, 0.04, 0.27)
  const dateStr = formatDate(data.createdAt)

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792])
  const pageWidth = 612
  const margin = 40

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const lightGray = rgb(0.95, 0.95, 0.95)
  const contentRight = pageWidth - margin

  let y = 755

  const drawText = (text: string, x: number, yPos: number, options: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}) => {
    page.drawText(text || '', { x, y: yPos, font: options.font || fontRegular, size: options.size || 10, color: options.color || black })
  }
  const rightAlign = (text: string, rightX: number, yPos: number, options: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}) => {
    const f = options.font || fontRegular
    const s = options.size || 10
    drawText(text, rightX - f.widthOfTextAtSize(text, s), yPos, options)
  }
  const drawLine = (x1: number, y1: number, x2: number, y2: number, color?: ReturnType<typeof rgb>, thickness?: number) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: thickness || 0.5, color: color || gray })
  }

  // Logo
  if (data.brandLogo) {
    try {
      const base64Match = data.brandLogo.match(/^data:image\/(png|jpeg|jpg);base64,(.+)/)
      if (base64Match) {
        const imageBytes = Buffer.from(base64Match[2], 'base64')
        const img = base64Match[1] === 'png' ? await pdfDoc.embedPng(imageBytes) : await pdfDoc.embedJpg(imageBytes)
        const logoH = 40
        const logoW = logoH * (img.width / img.height)
        page.drawImage(img, { x: margin, y: y - 30, width: Math.min(logoW, 160), height: logoH })
      }
    } catch {}
  }

  // Header
  drawText('FACTURA TRANSPORTE', margin + 170, y - 5, { font: fontBold, size: 20, color: primaryColor })
  drawText('Servicio de Transporte', margin + 170, y - 22, { size: 10, color: gray })

  // Barcode
  try {
    const barcodeData = (data.transportNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase()
    if (barcodeData.length > 0 && barcodeData.length <= 20) {
      const barcodePng = await bwipjs.toBuffer({ bcid: 'code128', text: barcodeData, scale: 2, height: 10, includetext: true, textsize: 8, textgaps: 2 })
      const barcodeImg = await pdfDoc.embedPng(barcodePng)
      const bcW = 130
      page.drawImage(barcodeImg, { x: contentRight - bcW, y: y - 30, width: bcW, height: bcW / (barcodeImg.width / barcodeImg.height) })
    }
  } catch {}

  y -= 45
  drawLine(margin, y, contentRight, y, primaryColor, 2)
  y -= 25

  // === INFO SECTION: 2 columns ===
  const col1 = margin
  const col2 = margin + 280

  // Left: Transport + Invoice info
  page.drawRectangle({ x: col1, y: y - 75, width: 260, height: 85, color: lightGray })
  drawText('TRANSPORTE:', col1 + 10, y - 2, { font: fontBold, size: 8, color: gray })
  drawText(data.transportNumber, col1 + 10, y - 16, { font: fontBold, size: 13 })
  drawText('FACTURA ASOCIADA:', col1 + 10, y - 34, { font: fontBold, size: 8, color: gray })
  drawText(data.invoiceNumber, col1 + 10, y - 48, { font: fontBold, size: 11 })
  drawText('FECHA:', col1 + 10, y - 64, { font: fontBold, size: 8, color: gray })
  drawText(dateStr, col1 + 10, y - 76, { size: 10 })

  // Right: Customer
  page.drawRectangle({ x: col2, y: y - 75, width: 260, height: 85, color: lightGray })
  drawText('CLIENTE:', col2 + 10, y - 2, { font: fontBold, size: 8, color: gray })
  drawText(data.customer.name, col2 + 10, y - 16, { font: fontBold, size: 12 })
  if (data.customer.code) drawText(`Codigo: ${data.customer.code}`, col2 + 10, y - 32, { size: 9, color: gray })
  if (data.customer.phone) drawText(`Tel: ${data.customer.phone}`, col2 + 10, y - 44, { size: 9, color: gray })
  if (data.customer.address) drawText(data.customer.address.substring(0, 40), col2 + 10, y - 56, { size: 9, color: gray })

  y -= 100

  // === DRIVER SECTION ===
  drawText('DATOS DEL TRANSPORTISTA', margin, y, { font: fontBold, size: 12, color: primaryColor })
  y -= 5
  drawLine(margin, y, contentRight, y, primaryColor, 1.5)
  y -= 20

  // Driver info in a styled box
  const driverBoxH = 120
  page.drawRectangle({ x: margin, y: y - driverBoxH + 20, width: contentRight - margin, height: driverBoxH, color: lightGray })

  const labelCol1 = margin + 15
  const valueCol1 = margin + 150
  const labelCol2 = margin + 290
  const valueCol2 = margin + 400

  // Row 1
  drawText('Nombre:', labelCol1, y, { font: fontBold, size: 10, color: gray })
  drawText(data.driver.name, valueCol1, y, { size: 11 })
  drawText('Apellidos:', labelCol2, y, { font: fontBold, size: 10, color: gray })
  drawText(data.driver.lastname, valueCol2, y, { size: 11 })
  y -= 22

  // Row 2
  drawText('Carnet de Identidad:', labelCol1, y, { font: fontBold, size: 10, color: gray })
  drawText(data.driver.idCard, valueCol1, y, { font: fontBold, size: 12 })
  y -= 22

  // Row 3
  drawText('Marca Vehiculo:', labelCol1, y, { font: fontBold, size: 10, color: gray })
  drawText(data.driver.vehicleBrand || 'N/A', valueCol1, y, { size: 11 })
  drawText('Placa:', labelCol2, y, { font: fontBold, size: 10, color: gray })
  drawText(data.driver.vehiclePlate, valueCol2, y, { font: fontBold, size: 14, color: primaryColor })
  y -= 30

  // === AMOUNT SECTION ===
  y -= 20
  drawLine(margin, y + 10, contentRight, y + 10, gray, 0.5)

  // Amount box
  const amountBoxW = 280
  const amountBoxX = contentRight - amountBoxW
  page.drawRectangle({ x: amountBoxX, y: y - 50, width: amountBoxW, height: 55, color: lightGray })

  drawText('MONTO TRANSPORTE:', amountBoxX + 15, y - 8, { font: fontBold, size: 10, color: gray })

  const cupAmount = Math.round(data.amount).toLocaleString('es-ES')
  drawText(`${cupAmount} CUP`, amountBoxX + 15, y - 32, { font: fontBold, size: 20, color: primaryColor })

  if (data.exchangeRate > 0) {
    const usdEquiv = (data.amount / data.exchangeRate).toFixed(2)
    drawText(`(~$${usdEquiv} USD · Tasa: ${data.exchangeRate})`, amountBoxX + 15, y - 48, { size: 8, color: gray })
  }

  y -= 80

  // === NOTES ===
  if (data.notes) {
    drawText('Observaciones:', margin, y, { font: fontBold, size: 9, color: gray })
    y -= 14
    const noteLines = wordWrap(data.notes, 85)
    for (const line of noteLines) {
      drawText(line, margin, y, { size: 9, color: gray })
      y -= 12
    }
  }

  // === SIGNATURES ===
  const sigY = 100
  drawLine(margin, sigY, margin + 220, sigY, gray)
  drawText('Firma del Transportista', margin + 50, sigY - 12, { size: 8, color: gray })
  drawText(`${data.driver.name} ${data.driver.lastname}`, margin + 40, sigY - 24, { size: 8, color: gray })

  drawLine(contentRight - 220, sigY, contentRight, sigY, gray)
  drawText('Firma del Cliente', contentRight - 160, sigY - 12, { size: 8, color: gray })
  drawText(data.customer.name, contentRight - 180, sigY - 24, { size: 8, color: gray })

  // Footer
  const footerText = `Documento generado por ${displayName}`
  drawText(footerText, (pageWidth - fontRegular.widthOfTextAtSize(footerText, 8)) / 2, 45, { size: 8, color: gray })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return dateStr }
}

function wordWrap(text: string, maxChars: number): string[] {
  const words = text.split(' ')
  const result: string[] = []
  let line = ''
  for (const word of words) {
    if (line.length + word.length + 1 <= maxChars) { line += (line ? ' ' : '') + word } else { if (line) result.push(line); line = word }
  }
  if (line) result.push(line)
  return result
}
