/**
 * Transport Invoice PDF Generator - Letter size
 * Factura de transporte con datos del transportista y productos (sin precios ni monto)
 */

import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib'
import bwipjs from 'bwip-js'

interface TransportProduct {
  name: string
  sku?: string
  quantity: number
}

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
  products?: TransportProduct[]
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
  const displayName = data.brandDisplayName || 'Servisumic'
  const primaryColor = data.brandPrimaryColor ? hexToRgb(data.brandPrimaryColor) : rgb(0.92, 0.36, 0.05) // Servisumic orange
  const dateStr = formatDate(data.createdAt)
  const white = rgb(1, 1, 1)

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

  // =============================================
  // HEADER: Logo + Title
  // =============================================
  let logoEndX = margin
  if (data.brandLogo) {
    try {
      const base64Match = data.brandLogo.match(/^data:image\/(png|jpeg|jpg);base64,(.+)/)
      if (base64Match) {
        const imageBytes = Buffer.from(base64Match[2], 'base64')
        const img = base64Match[1] === 'png' ? await pdfDoc.embedPng(imageBytes) : await pdfDoc.embedJpg(imageBytes)
        const logoH = 40
        const logoW = logoH * (img.width / img.height)
        page.drawImage(img, { x: margin, y: y - 30, width: Math.min(logoW, 160), height: logoH })
        logoEndX = margin + Math.min(logoW, 160) + 12
      }
    } catch {}
  }

  drawText('FACTURA TRANSPORTE', logoEndX, y - 5, { font: fontBold, size: 20, color: primaryColor })
  drawText('Servicio de Transporte', logoEndX, y - 22, { size: 10, color: gray })

  // Right: transport number + date
  rightAlign(data.transportNumber, contentRight, y - 2, { font: fontBold, size: 14 })
  rightAlign(`Fecha: ${dateStr}`, contentRight, y - 18, { size: 9, color: gray })

  y -= 42
  drawLine(margin, y, contentRight, y, primaryColor, 2)
  y -= 22

  // =============================================
  // INFO SECTION: Transport + Customer
  // =============================================
  const col1 = margin
  const col2 = margin + 280

  // Left: Transport + Invoice
  page.drawRectangle({ x: col1, y: y - 55, width: 260, height: 65, color: lightGray })
  drawText('FACTURA ASOCIADA:', col1 + 10, y - 2, { font: fontBold, size: 8, color: gray })
  drawText(data.invoiceNumber, col1 + 10, y - 16, { font: fontBold, size: 12 })
  drawText('TRANSPORTE:', col1 + 10, y - 32, { font: fontBold, size: 8, color: gray })
  drawText(data.transportNumber, col1 + 10, y - 44, { font: fontBold, size: 11, color: primaryColor })

  // Right: Customer
  page.drawRectangle({ x: col2, y: y - 55, width: contentRight - col2, height: 65, color: lightGray })
  drawText('CLIENTE:', col2 + 10, y - 2, { font: fontBold, size: 8, color: gray })
  drawText(data.customer.name, col2 + 10, y - 16, { font: fontBold, size: 12 })
  if (data.customer.code) drawText(`Codigo: ${data.customer.code}`, col2 + 10, y - 32, { size: 9, color: gray })
  if (data.customer.phone) drawText(`Tel: ${data.customer.phone}`, col2 + 10, y - 44, { size: 9, color: gray })

  y -= 75

  // =============================================
  // DRIVER SECTION
  // =============================================
  drawText('DATOS DEL TRANSPORTISTA', margin, y, { font: fontBold, size: 12, color: primaryColor })
  y -= 5
  drawLine(margin, y, contentRight, y, primaryColor, 1.5)
  y -= 18

  page.drawRectangle({ x: margin, y: y - 62, width: contentRight - margin, height: 75, color: lightGray })

  const lc1 = margin + 15
  const vc1 = margin + 150
  const lc2 = margin + 290
  const vc2 = margin + 400

  drawText('Nombre:', lc1, y, { font: fontBold, size: 10, color: gray })
  drawText(data.driver.name, vc1, y, { size: 11 })
  drawText('Apellidos:', lc2, y, { font: fontBold, size: 10, color: gray })
  drawText(data.driver.lastname, vc2, y, { size: 11 })
  y -= 20

  drawText('Carnet de Identidad:', lc1, y, { font: fontBold, size: 10, color: gray })
  drawText(data.driver.idCard, vc1, y, { font: fontBold, size: 12 })
  y -= 20

  drawText('Marca Vehiculo:', lc1, y, { font: fontBold, size: 10, color: gray })
  drawText(data.driver.vehicleBrand || 'N/A', vc1, y, { size: 11 })
  drawText('Placa:', lc2, y, { font: fontBold, size: 10, color: gray })
  drawText(data.driver.vehiclePlate, vc2, y, { font: fontBold, size: 14, color: primaryColor })
  y -= 30

  // =============================================
  // PRODUCTS TABLE (no prices)
  // =============================================
  const products = data.products || []
  if (products.length > 0) {
    drawText('PRODUCTOS TRANSPORTADOS', margin, y, { font: fontBold, size: 12, color: primaryColor })
    y -= 5
    drawLine(margin, y, contentRight, y, primaryColor, 1.5)
    y -= 5

    // Table header
    const headerH = 20
    page.drawRectangle({ x: margin, y: y - headerH + 5, width: contentRight - margin, height: headerH, color: primaryColor })
    drawText('#', margin + 8, y - 8, { font: fontBold, size: 9, color: white })
    drawText('Producto', margin + 30, y - 8, { font: fontBold, size: 9, color: white })
    drawText('SKU', margin + 320, y - 8, { font: fontBold, size: 9, color: white })
    rightAlign('Cantidad', contentRight - 8, y - 8, { font: fontBold, size: 9, color: white })

    y -= headerH + 3
    let totalUnits = 0

    for (let i = 0; i < products.length; i++) {
      const p = products[i]
      totalUnits += p.quantity

      if (i % 2 === 0) {
        page.drawRectangle({ x: margin, y: y - 8, width: contentRight - margin, height: 18, color: lightGray })
      }

      drawText((i + 1).toString(), margin + 8, y - 2, { size: 9, color: gray })
      const displayName = p.name.length > 42 ? p.name.substring(0, 40) + '..' : p.name
      drawText(displayName, margin + 30, y - 2, { size: 9 })
      if (p.sku) drawText(p.sku, margin + 320, y - 2, { size: 8, color: gray })
      rightAlign(p.quantity.toString(), contentRight - 8, y - 2, { font: fontBold, size: 11 })

      y -= 18
      if (y < 160) break
    }

    y -= 5
    drawLine(margin, y, contentRight, y, primaryColor, 1)
    y -= 16

    // Totals
    page.drawRectangle({ x: contentRight - 200, y: y - 8, width: 200, height: 30, color: lightGray })
    drawText('Total Productos:', contentRight - 190, y + 3, { font: fontBold, size: 10 })
    rightAlign(products.length.toString(), contentRight - 10, y + 3, { font: fontBold, size: 12, color: primaryColor })
    drawText('Total Unidades:', contentRight - 190, y - 9, { font: fontBold, size: 10 })
    rightAlign(totalUnits.toString(), contentRight - 10, y - 9, { font: fontBold, size: 12, color: primaryColor })

    y -= 30
  }

  // =============================================
  // NOTES
  // =============================================
  if (data.notes) {
    drawText('Observaciones:', margin, y, { font: fontBold, size: 9, color: gray })
    y -= 14
    const noteLines = wordWrap(data.notes, 85)
    for (const line of noteLines) {
      drawText(line, margin, y, { size: 9, color: gray })
      y -= 12
    }
  }

  // =============================================
  // SIGNATURES
  // =============================================
  const sigY = 90
  drawLine(margin, sigY, margin + 220, sigY, gray)
  drawText('Firma del Transportista', margin + 50, sigY - 12, { size: 8, color: gray })
  drawText(`${data.driver.name} ${data.driver.lastname}`, margin + 40, sigY - 24, { size: 8, color: gray })

  drawLine(contentRight - 220, sigY, contentRight, sigY, gray)
  drawText('Firma del Cliente', contentRight - 160, sigY - 12, { size: 8, color: gray })
  drawText(data.customer.name, contentRight - 180, sigY - 24, { size: 8, color: gray })

  // =============================================
  // BARCODE at bottom center
  // =============================================
  try {
    const barcodeData = (data.transportNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase()
    if (barcodeData.length > 0 && barcodeData.length <= 20) {
      const barcodePng = await bwipjs.toBuffer({ bcid: 'code128', text: barcodeData, scale: 2, height: 8, includetext: true, textsize: 7, textgaps: 2 })
      const barcodeImg = await pdfDoc.embedPng(barcodePng)
      const bcW = 120
      const bcH = bcW / (barcodeImg.width / barcodeImg.height)
      page.drawImage(barcodeImg, { x: (pageWidth - bcW) / 2, y: 48, width: bcW, height: bcH })
    }
  } catch {}

  // Footer
  const footerText = `Documento generado por ${displayName}`
  drawText(footerText, (pageWidth - fontRegular.widthOfTextAtSize(footerText, 8)) / 2, 35, { size: 8, color: gray })

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
