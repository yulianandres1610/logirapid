/**
 * Wholesale Invoice PDF Generator - Generates PDF for standard printers (letter size)
 * Matches the HTML letter format design with brand logo, colors, and clean layout
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
  // Brand support
  brandLogo?: string | null      // Base64 data URL (data:image/png;base64,...)
  brandPrimaryColor?: string     // Hex color (e.g., '#eb5b0c')
  brandDisplayName?: string      // e.g., 'Servisumic'
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16) / 255
  const g = parseInt(h.substring(2, 4), 16) / 255
  const b = parseInt(h.substring(4, 6), 16) / 255
  return rgb(r, g, b)
}

export async function generateWholesaleInvoicePdf(data: WholesaleInvoicePdfData): Promise<Buffer> {
  const displayName = data.brandDisplayName || data.companyName || 'LogiRapid'
  const invoiceNumber = data.invoiceNumber || 'Sin numero'
  const dateStr = formatDate(data.createdAt)
  const hasRate = data.exchangeRate && data.exchangeRate > 0
  const rate = data.exchangeRate || 0

  // Brand color
  const primaryColor = data.brandPrimaryColor ? hexToRgb(data.brandPrimaryColor) : rgb(0.8, 0.04, 0.27) // default LogiRapid red

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792]) // Letter size
  const pageWidth = 612
  const margin = 40

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const lightGray = rgb(0.95, 0.95, 0.95)
  const green = rgb(0.13, 0.55, 0.13)
  const greenBg = rgb(0.9, 0.96, 0.9)
  const amber = rgb(0.72, 0.53, 0)
  const amberBg = rgb(1, 0.97, 0.88)

  let y = 755

  // Helpers
  const drawText = (text: string, x: number, yPos: number, options: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}) => {
    page.drawText(text, {
      x, y: yPos,
      font: options.font || fontRegular,
      size: options.size || 10,
      color: options.color || black
    })
  }

  const rightAlign = (text: string, rightX: number, yPos: number, options: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}) => {
    const f = options.font || fontRegular
    const s = options.size || 10
    const w = f.widthOfTextAtSize(text, s)
    drawText(text, rightX - w, yPos, options)
  }

  const drawLine = (x1: number, y1: number, x2: number, y2: number, color?: ReturnType<typeof rgb>, thickness?: number) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: thickness || 0.5, color: color || gray })
  }

  const contentRight = pageWidth - margin

  // === EMBED BRAND LOGO ===
  let logoImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null
  if (data.brandLogo) {
    try {
      const base64Match = data.brandLogo.match(/^data:image\/(png|jpeg|jpg);base64,(.+)/)
      if (base64Match) {
        const imageBytes = Buffer.from(base64Match[2], 'base64')
        if (base64Match[1] === 'png') {
          logoImage = await pdfDoc.embedPng(imageBytes)
        } else {
          logoImage = await pdfDoc.embedJpg(imageBytes) as any
        }
      }
    } catch (err) {
      console.error('[Wholesale Invoice PDF] Error embedding logo:', err)
    }
  }

  // === GENERATE BARCODE ===
  let barcodeImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null
  try {
    const barcodeData = invoiceNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase()
    if (barcodeData.length > 0 && barcodeData.length <= 20) {
      const barcodePng = await bwipjs.toBuffer({
        bcid: 'code128',
        text: barcodeData,
        scale: 2,
        height: 10,
        includetext: true,
        textsize: 8,
        textgaps: 2
      })
      barcodeImage = await pdfDoc.embedPng(barcodePng)
    }
  } catch (err) {
    console.error('[Wholesale Invoice PDF] Error generating barcode:', err)
  }

  // =============================================
  // HEADER: Logo + Title | Invoice Number + Date
  // =============================================
  const headerY = y

  // Left side: Logo + Title
  let logoEndX = margin
  if (logoImage) {
    const logoHeight = 40
    const logoAspect = logoImage.width / logoImage.height
    const logoWidth = logoHeight * logoAspect
    page.drawImage(logoImage, {
      x: margin,
      y: headerY - 30,
      width: Math.min(logoWidth, 160),
      height: logoHeight
    })
    logoEndX = margin + Math.min(logoWidth, 160) + 12
  }

  drawText('FACTURA', logoEndX, headerY - 5, { font: fontBold, size: 22, color: primaryColor })
  drawText('Venta Mayorista', logoEndX, headerY - 22, { size: 10, color: gray })

  // Right side: Invoice number + date
  rightAlign(invoiceNumber, contentRight, headerY - 2, { font: fontBold, size: 16 })
  rightAlign(`Fecha: ${dateStr}`, contentRight, headerY - 18, { size: 9, color: gray })
  if (data.dueDate) {
    rightAlign(`Vencimiento: ${formatDate(data.dueDate)}`, contentRight, headerY - 30, { size: 9, color: gray })
  }

  // Brand color accent line below header
  y = headerY - 45
  drawLine(margin, y, contentRight, y, primaryColor, 2)
  y -= 20

  // =============================================
  // CUSTOMER INFO | PAYMENT STATUS
  // =============================================
  const infoTop = y

  // Left column: Customer info (with light background)
  const leftBoxWidth = 260
  page.drawRectangle({
    x: margin,
    y: infoTop - 60,
    width: leftBoxWidth,
    height: 70,
    color: lightGray,
    borderWidth: 0
  })
  drawText('FACTURADO A:', margin + 10, infoTop - 2, { font: fontBold, size: 8, color: gray })
  drawText(data.customer.name, margin + 10, infoTop - 16, { font: fontBold, size: 12 })

  let custY = infoTop - 30
  if (data.customer.code) {
    drawText(`Codigo: ${data.customer.code}`, margin + 10, custY, { size: 9, color: gray })
    custY -= 12
  }
  if (data.customer.taxId) {
    drawText(`NIT/CI: ${data.customer.taxId}`, margin + 10, custY, { size: 9, color: gray })
    custY -= 12
  }
  if (data.customer.phone) {
    drawText(`Tel: ${data.customer.phone}`, margin + 10, custY, { size: 9, color: gray })
    custY -= 12
  }

  // Right column: Payment status badge
  const rightBoxX = margin + leftBoxWidth + 15

  // Payment status
  const paymentLabel = data.paymentStatus === 'paid' ? 'PAGADA'
    : data.paymentStatus === 'partial' ? 'PAGO PARCIAL'
    : data.paymentStatus === 'overdue' ? 'VENCIDO'
    : 'PENDIENTE DE PAGO'

  const badgeColor = data.paymentStatus === 'paid' ? green
    : data.paymentStatus === 'overdue' ? rgb(0.8, 0, 0)
    : amber
  const badgeBg = data.paymentStatus === 'paid' ? greenBg
    : data.paymentStatus === 'overdue' ? rgb(1, 0.92, 0.92)
    : amberBg

  drawText('ESTADO DE PAGO:', rightBoxX, infoTop - 2, { font: fontBold, size: 8, color: gray })

  // Badge
  const badgeWidth = fontBold.widthOfTextAtSize(paymentLabel, 10) + 16
  page.drawRectangle({
    x: rightBoxX,
    y: infoTop - 22,
    width: badgeWidth,
    height: 18,
    color: badgeBg,
    borderWidth: 0
  })
  drawText(paymentLabel, rightBoxX + 8, infoTop - 17, { font: fontBold, size: 10, color: badgeColor })

  // Payment amounts
  if (data.amountPaid > 0) {
    drawText(`Pagado: ${formatCurrency(data.amountPaid)}`, rightBoxX, infoTop - 38, { size: 9 })
    if (hasRate) {
      drawText(`(${formatCUP(data.amountPaid, rate)})`, rightBoxX + 100, infoTop - 38, { size: 8, color: gray })
    }
  }
  if (data.amountDue > 0) {
    drawText(`Pendiente: ${formatCurrency(data.amountDue)}`, rightBoxX, infoTop - 52, { font: fontBold, size: 9, color: amber })
    if (hasRate) {
      drawText(`(${formatCUP(data.amountDue, rate)})`, rightBoxX + 110, infoTop - 52, { size: 8, color: amber })
    }
  }

  y = infoTop - 75

  // =============================================
  // ITEMS TABLE
  // =============================================
  const tableLeft = margin
  const tableRight = contentRight

  // Table header with brand color
  const headerHeight = 22
  page.drawRectangle({
    x: tableLeft,
    y: y - 5,
    width: tableRight - tableLeft,
    height: headerHeight,
    color: lightGray,
    borderWidth: 0
  })

  const colProduct = tableLeft + 8
  const colQty = tableLeft + 220
  const colPrice = tableLeft + 280
  const colPriceCup = tableLeft + 360
  const colSubtotal = tableRight - 8

  drawText('Producto', colProduct, y + 2, { font: fontBold, size: 9, color: gray })
  drawText('Cant', colQty, y + 2, { font: fontBold, size: 9, color: gray })
  drawText('Precio USD', colPrice, y + 2, { font: fontBold, size: 9, color: gray })
  if (hasRate) {
    drawText('Precio CUP', colPriceCup, y + 2, { font: fontBold, size: 9, color: gray })
  }
  rightAlign('Subtotal', colSubtotal, y + 2, { font: fontBold, size: 9, color: gray })

  y -= headerHeight + 3

  // Table rows
  for (const item of data.lines) {
    const itemName = item.productName || 'Producto sin nombre'
    const sku = item.productSku || ''

    // Product name and SKU
    drawText(itemName.substring(0, 32), colProduct, y, { size: 9 })
    if (sku) {
      drawText(sku.substring(0, 18), colProduct, y - 11, { size: 7, color: gray })
    }

    // Quantity
    drawText((item.quantity ?? 0).toString(), colQty + 10, y, { size: 9 })

    // Price USD
    drawText(formatCurrency(item.unitPrice), colPrice, y, { size: 9 })

    // Price CUP
    if (hasRate) {
      drawText(formatCUP(item.unitPrice, rate), colPriceCup, y, { size: 8, color: gray })
    }

    // Subtotal
    rightAlign(formatCurrency(item.subtotal), colSubtotal, y, { size: 9, font: fontBold })

    y -= (sku ? 24 : 18)

    // Separator
    drawLine(tableLeft, y + 6, tableRight, y + 6, rgb(0.9, 0.9, 0.9))

    if (y < 170) break
  }

  y -= 8

  // =============================================
  // TOTALS (right-aligned section)
  // =============================================
  const totalsRight = contentRight
  const totalsLeft = totalsRight - 220

  // Subtotal
  drawText('Subtotal:', totalsLeft, y, { size: 10, color: gray })
  rightAlign(formatCurrency(data.subtotal), totalsRight, y, { size: 10 })
  y -= 16

  // Discount
  if (data.discountAmount > 0) {
    drawText(`Descuento (${data.discountPercent}%):`, totalsLeft, y, { size: 10, color: gray })
    rightAlign(`-${formatCurrency(data.discountAmount)}`, totalsRight, y, { size: 10, color: rgb(0.8, 0, 0) })
    y -= 16
  }

  // CUP equivalent
  if (hasRate) {
    drawText('En CUP:', totalsLeft, y, { size: 9, color: gray })
    rightAlign(formatCUP(data.totalAmount, rate), totalsRight, y, { size: 9, color: gray })
    y -= 12
    rightAlign(`Tasa: $1 = ${rate} CUP`, totalsRight, y, { size: 8, color: gray })
    y -= 16
  }

  // Total highlighted with brand color
  drawLine(totalsLeft, y + 5, totalsRight, y + 5, primaryColor, 2)
  y -= 2

  drawText('TOTAL:', totalsLeft, y, { font: fontBold, size: 14 })
  rightAlign(formatCurrency(data.totalAmount), totalsRight, y, { font: fontBold, size: 16, color: primaryColor })
  y -= 20

  // Total CUP bold
  if (hasRate) {
    rightAlign(formatCUP(data.totalAmount, rate), totalsRight, y, { font: fontBold, size: 12 })
    y -= 20
  }

  // =============================================
  // NOTES
  // =============================================
  if (data.notes) {
    y -= 5
    drawText('Notas:', margin, y, { font: fontBold, size: 9, color: gray })
    y -= 14
    const noteLines = wordWrap(data.notes, 85)
    for (const noteLine of noteLines) {
      drawText(noteLine, margin, y, { size: 9, color: gray })
      y -= 12
    }
  }

  // =============================================
  // BARCODE (small, centered at bottom)
  // =============================================
  if (barcodeImage) {
    const bcWidth = 120
    const bcAspect = barcodeImage.width / barcodeImage.height
    const bcHeight = bcWidth / bcAspect
    const bcX = (pageWidth - bcWidth) / 2

    page.drawImage(barcodeImage, {
      x: bcX,
      y: 50,
      width: bcWidth,
      height: bcHeight
    })
  }

  // =============================================
  // FOOTER
  // =============================================
  const footerText = `Documento generado por ${displayName}`
  const footerWidth = fontRegular.widthOfTextAtSize(footerText, 8)
  drawText(footerText, (pageWidth - footerWidth) / 2, 35, { size: 8, color: gray })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

function formatCurrency(amount: number): string {
  return '$' + (amount ?? 0).toFixed(2)
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
