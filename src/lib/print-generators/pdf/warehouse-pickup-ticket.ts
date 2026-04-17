/**
 * Warehouse Pickup Ticket PDF Generator - Letter size
 * Vale de entrega de almacén con códigos de barra de productos y cantidades
 */

import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib'
import bwipjs from 'bwip-js'

interface PickupProduct {
  name: string
  sku: string
  barcode: string
  quantity: number
  warehouseName?: string
}

export interface WarehousePickupTicketPdfData {
  invoiceNumber: string
  customerName: string
  warehouseName: string
  warehouseId?: number
  products: PickupProduct[]
  createdAt: string
  brandLogo?: string | null
  brandPrimaryColor?: string
  brandDisplayName?: string
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16) / 255
  const g = parseInt(h.substring(2, 4), 16) / 255
  const b = parseInt(h.substring(4, 6), 16) / 255
  return rgb(r, g, b)
}

export async function generateWarehousePickupTicketPdf(data: WarehousePickupTicketPdfData): Promise<Buffer> {
  const displayName = data.brandDisplayName || 'LogiRapid'
  const invoiceNumber = data.invoiceNumber || 'Sin numero'
  const dateStr = formatDate(data.createdAt)
  const primaryColor = data.brandPrimaryColor ? hexToRgb(data.brandPrimaryColor) : rgb(0.92, 0.36, 0.05)

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792]) // Letter
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
    page.drawText(text, { x, y: yPos, font: options.font || fontRegular, size: options.size || 10, color: options.color || black })
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

  // === EMBED BRAND LOGO ===
  let logoImage: any = null
  if (data.brandLogo) {
    try {
      const base64Match = data.brandLogo.match(/^data:image\/(png|jpeg|jpg);base64,(.+)/)
      if (base64Match) {
        const imageBytes = Buffer.from(base64Match[2], 'base64')
        logoImage = base64Match[1] === 'png'
          ? await pdfDoc.embedPng(imageBytes)
          : await pdfDoc.embedJpg(imageBytes)
      }
    } catch {}
  }

  // === INVOICE BARCODE ===
  let invoiceBarcodeImage: any = null
  try {
    const barcodeData = invoiceNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase()
    if (barcodeData.length > 0 && barcodeData.length <= 20) {
      const barcodePng = await bwipjs.toBuffer({
        bcid: 'code128', text: barcodeData, scale: 2, height: 10, includetext: true, textsize: 8, textgaps: 2
      })
      invoiceBarcodeImage = await pdfDoc.embedPng(barcodePng)
    }
  } catch {}

  // =============================================
  // HEADER
  // =============================================
  let logoEndX = margin
  if (logoImage) {
    const logoHeight = 36
    const logoAspect = logoImage.width / logoImage.height
    const logoWidth = logoHeight * logoAspect
    page.drawImage(logoImage, { x: margin, y: y - 26, width: Math.min(logoWidth, 140), height: logoHeight })
    logoEndX = margin + Math.min(logoWidth, 140) + 12
  }

  drawText('VALE DE ENTREGA', logoEndX, y - 3, { font: fontBold, size: 20, color: primaryColor })
  drawText('Ticket de Recogida por Almacen', logoEndX, y - 18, { size: 9, color: gray })

  // Right side: Invoice barcode + number
  if (invoiceBarcodeImage) {
    const bcWidth = 130
    const bcAspect = invoiceBarcodeImage.width / invoiceBarcodeImage.height
    const bcHeight = bcWidth / bcAspect
    page.drawImage(invoiceBarcodeImage, { x: contentRight - bcWidth, y: y - 30, width: bcWidth, height: bcHeight })
  } else {
    rightAlign(invoiceNumber, contentRight, y - 2, { font: fontBold, size: 14 })
  }

  y -= 42
  drawLine(margin, y, contentRight, y, primaryColor, 2)
  y -= 20

  // =============================================
  // INFO SECTION
  // =============================================
  const infoTop = y

  // Left: Customer + Warehouse
  page.drawRectangle({ x: margin, y: infoTop - 55, width: 250, height: 65, color: lightGray })
  drawText('CLIENTE:', margin + 10, infoTop - 2, { font: fontBold, size: 8, color: gray })
  drawText(data.customerName, margin + 10, infoTop - 16, { font: fontBold, size: 12 })
  drawText('ALMACEN:', margin + 10, infoTop - 32, { font: fontBold, size: 8, color: gray })
  drawText(data.warehouseName, margin + 10, infoTop - 44, { font: fontBold, size: 11, color: primaryColor })

  // Right: Date + Invoice
  const rightBoxX = margin + 270
  drawText('FACTURA:', rightBoxX, infoTop - 2, { font: fontBold, size: 8, color: gray })
  drawText(invoiceNumber, rightBoxX, infoTop - 16, { font: fontBold, size: 12 })
  drawText('FECHA:', rightBoxX, infoTop - 32, { font: fontBold, size: 8, color: gray })
  drawText(dateStr, rightBoxX, infoTop - 44, { size: 10 })

  y = infoTop - 70

  // =============================================
  // PRODUCTS TABLE WITH BARCODES
  // =============================================
  const tableLeft = margin
  const tableRight = contentRight

  // Header
  const headerHeight = 22
  page.drawRectangle({ x: tableLeft, y: y - 3, width: tableRight - tableLeft, height: headerHeight, color: primaryColor })

  const colNum = tableLeft + 8
  const colBarcode = tableLeft + 35
  const colProduct = tableLeft + 170
  const colQty = tableRight - 8

  drawText('#', colNum, y + 4, { font: fontBold, size: 9, color: rgb(1, 1, 1) })
  drawText('Codigo de Barras', colBarcode, y + 4, { font: fontBold, size: 9, color: rgb(1, 1, 1) })
  drawText('Producto', colProduct, y + 4, { font: fontBold, size: 9, color: rgb(1, 1, 1) })
  rightAlign('Cantidad', colQty, y + 4, { font: fontBold, size: 9, color: rgb(1, 1, 1) })

  y -= headerHeight + 5

  let totalUnits = 0

  // Generate product barcodes
  const productBarcodes: Map<string, any> = new Map()
  for (const product of data.products) {
    const code = (product.barcode || product.sku || '').replace(/[^A-Z0-9]/gi, '').toUpperCase()
    if (code && code.length > 0 && code.length <= 20 && !productBarcodes.has(code)) {
      try {
        const barcodePng = await bwipjs.toBuffer({
          bcid: 'code128', text: code, scale: 2, height: 8, includetext: true, textsize: 7, textgaps: 1
        })
        productBarcodes.set(code, await pdfDoc.embedPng(barcodePng))
      } catch {}
    }
  }

  for (let i = 0; i < data.products.length; i++) {
    const product = data.products[i]
    const code = (product.barcode || product.sku || '').replace(/[^A-Z0-9]/gi, '').toUpperCase()
    totalUnits += product.quantity

    // Alternate row background
    if (i % 2 === 0) {
      page.drawRectangle({ x: tableLeft, y: y - 12, width: tableRight - tableLeft, height: 36, color: lightGray })
    }

    // Row number
    drawText((i + 1).toString(), colNum, y + 4, { size: 9, color: gray })

    // Barcode image
    const barcodeImg = productBarcodes.get(code)
    if (barcodeImg) {
      const bcW = 120
      const bcAspect = barcodeImg.width / barcodeImg.height
      const bcH = bcW / bcAspect
      page.drawImage(barcodeImg, { x: colBarcode, y: y - 8, width: bcW, height: Math.min(bcH, 28) })
    } else if (code) {
      drawText(code, colBarcode, y + 2, { size: 9, font: fontBold })
    } else {
      drawText('Sin codigo', colBarcode, y + 2, { size: 8, color: gray })
    }

    // Product name
    const displayName = product.name.length > 28 ? product.name.substring(0, 26) + '..' : product.name
    drawText(displayName, colProduct, y + 6, { size: 9 })
    if (product.sku) {
      drawText(product.sku, colProduct, y - 5, { size: 7, color: gray })
    }
    if (product.warehouseName) {
      drawText(`Almacen: ${product.warehouseName}`, colProduct, y - 14, { size: 7, color: primaryColor })
    }

    // Quantity (bold, large)
    rightAlign(product.quantity.toString(), colQty, y + 2, { font: fontBold, size: 14 })

    y -= 38

    // Check page overflow
    if (y < 140) {
      drawText('... continua en siguiente pagina', margin, y, { size: 8, color: gray })
      break
    }
  }

  y -= 5
  drawLine(tableLeft, y, tableRight, y, primaryColor, 1.5)
  y -= 18

  // =============================================
  // TOTALS
  // =============================================
  page.drawRectangle({ x: tableRight - 200, y: y - 10, width: 200, height: 35, color: lightGray })
  drawText('Total Productos:', tableRight - 190, y + 5, { font: fontBold, size: 10 })
  rightAlign(data.products.length.toString(), tableRight - 10, y + 5, { font: fontBold, size: 12, color: primaryColor })
  drawText('Total Unidades:', tableRight - 190, y - 7, { font: fontBold, size: 10 })
  rightAlign(totalUnits.toString(), tableRight - 10, y - 7, { font: fontBold, size: 12, color: primaryColor })

  // =============================================
  // SIGNATURES
  // =============================================
  const sigY = 80
  drawLine(margin, sigY, margin + 200, sigY, gray)
  drawText('Entregado por (Almacen)', margin + 30, sigY - 12, { size: 8, color: gray })

  drawLine(tableRight - 200, sigY, tableRight, sigY, gray)
  drawText('Recibido por (Cliente)', tableRight - 170, sigY - 12, { size: 8, color: gray })

  // =============================================
  // FOOTER
  // =============================================
  const footerText = `Documento generado por ${displayName} · ${dateStr}`
  const footerWidth = fontRegular.widthOfTextAtSize(footerText, 8)
  drawText(footerText, (pageWidth - footerWidth) / 2, 35, { size: 8, color: gray })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return dateStr }
}
