/**
 * Purchase Invoice PDF Generator - Generates PDF for standard printers
 * For printing purchase invoices from suppliers
 */

import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib'
import bwipjs from 'bwip-js'

interface InvoiceItem {
  name: string
  sku?: string
  quantity: number
  unitCost: number
  total?: number
}

interface PurchaseInvoiceData {
  // Header
  companyName?: string
  companyAddress?: string

  // Supplier info - accept both formats
  supplierName?: string
  supplierRuc?: string
  supplierAddress?: string
  supplierPhone?: string
  supplier?: {
    code?: string
    name?: string
  }

  // Invoice info
  invoiceNumber?: string
  purchaseNumber?: string
  date?: string
  purchaseDate?: string
  dueDate?: string
  receivedBy?: string
  warehouseName?: string

  // Items - accept both 'items' and 'lines'
  items?: InvoiceItem[]
  lines?: InvoiceItem[]

  // Totals
  subtotal?: number
  tax?: number
  taxRate?: number
  discount?: number
  shipping?: number
  total?: number
  totalCost?: number
  totalItems?: number
  totalUnits?: number

  // Payment info
  paymentMethod?: string
  paymentStatus?: string // 'paid', 'pending', 'partial'
  amountPaid?: number
  amountDue?: number

  // Notes
  notes?: string
}

export async function generatePurchaseInvoicePdf(data: PurchaseInvoiceData): Promise<Buffer> {
  // Normalize data - accept multiple field names for flexibility
  const companyName = data.companyName || 'LogiRapid'
  const supplierName = data.supplierName || data.supplier?.name || 'Proveedor'
  const supplierCode = data.supplierRuc || data.supplier?.code || ''
  const invoiceNumber = data.invoiceNumber || data.purchaseNumber || 'Sin número'
  const dateStr = data.date || data.purchaseDate || new Date().toLocaleDateString('es-ES')
  const items = data.items || data.lines || []
  const total = data.total ?? data.totalCost ?? 0
  const subtotal = data.subtotal ?? total

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
  const darkBlue = rgb(0.1, 0.2, 0.4)

  let y = 750 // Start from top

  // === GENERATE BARCODE FOR INVOICE NUMBER ===
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
    console.error('Error generating barcode for PDF:', err)
  }

  // Helper function to draw text
  const drawText = (
    text: string,
    x: number,
    yPos: number,
    options: {
      font?: PDFFont
      size?: number
      color?: typeof black
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
  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: 0.5,
      color: gray
    })
  }

  // === HEADER ===
  // Company name
  drawText(companyName, 50, y, { font: fontBold, size: 18, color: darkBlue })
  y -= 20

  if (data.companyAddress) {
    drawText(data.companyAddress, 50, y, { size: 9, color: gray })
    y -= 15
  }

  // Invoice title on the right
  drawText('FACTURA DE COMPRA', 400, 750, { font: fontBold, size: 16, color: darkBlue })

  // === BARCODE AT TOP RIGHT (for easy scanning) ===
  let infoY = 728 // Position for invoice info text

  if (barcodeImage) {
    const barcodeWidth = 150
    const barcodeHeight = 35
    // Draw barcode starting at y=728, going down
    page.drawImage(barcodeImage, {
      x: 400,
      y: infoY - barcodeHeight,
      width: barcodeWidth,
      height: barcodeHeight
    })
    // Move info text below the barcode
    infoY = infoY - barcodeHeight - 8
  }

  // Invoice number and date (below barcode if exists)
  drawText(`No: ${invoiceNumber}`, 400, infoY, { font: fontBold, size: 11 })
  drawText(`Fecha: ${dateStr}`, 400, infoY - 15, { size: 10 })

  if (data.purchaseNumber && data.invoiceNumber) {
    drawText(`Orden: ${data.purchaseNumber}`, 400, infoY - 30, { size: 10 })
  }

  if (data.dueDate) {
    drawText(`Vence: ${data.dueDate}`, 400, infoY - 45, { size: 10, color: gray })
  }

  y = 660

  // Separator line
  drawLine(50, y, 562, y)
  y -= 25

  // === SUPPLIER INFO ===
  drawText('PROVEEDOR', 50, y, { font: fontBold, size: 11, color: darkBlue })
  y -= 18

  drawText(supplierName, 50, y, { font: fontBold, size: 11 })
  y -= 15

  if (supplierCode) {
    drawText(`Código: ${supplierCode}`, 50, y, { size: 9 })
    y -= 13
  }

  if (data.supplierAddress) {
    drawText(data.supplierAddress, 50, y, { size: 9, color: gray })
    y -= 13
  }

  if (data.supplierPhone) {
    drawText(`Tel: ${data.supplierPhone}`, 50, y, { size: 9, color: gray })
    y -= 13
  }

  // Warehouse and receiver on the right
  if (data.warehouseName) {
    drawText(`Almacén: ${data.warehouseName}`, 350, y + 40, { size: 9 })
  }
  if (data.receivedBy) {
    drawText(`Recibido por: ${data.receivedBy}`, 350, y + 25, { size: 9 })
  }

  y -= 20

  // === ITEMS TABLE ===
  // Table header
  const tableTop = y
  page.drawRectangle({
    x: 50,
    y: tableTop - 5,
    width: 512,
    height: 20,
    color: lightGray
  })

  drawText('Cant', 55, tableTop, { font: fontBold, size: 9 })
  drawText('Descripción', 95, tableTop, { font: fontBold, size: 9 })
  drawText('SKU', 320, tableTop, { font: fontBold, size: 9 })
  drawText('Precio Unit.', 400, tableTop, { font: fontBold, size: 9 })
  drawText('Total', 500, tableTop, { font: fontBold, size: 9 })

  y = tableTop - 25

  // Table rows
  for (const item of items) {
    const itemTotal = item.total ?? (item.quantity ?? 0) * (item.unitCost ?? 0)
    const itemName = item.name || 'Producto sin nombre'

    // Draw row
    drawText((item.quantity ?? 0).toString(), 55, y, { size: 9 })
    drawText(itemName.substring(0, 35), 95, y, { size: 9 })
    drawText(item.sku || '-', 320, y, { size: 8, color: gray })
    drawText(formatCurrency(item.unitCost ?? 0), 400, y, { size: 9 })
    drawText(formatCurrency(itemTotal), 500, y, { size: 9, font: fontBold })

    y -= 20

    // Check if we need a new page
    if (y < 150) {
      // In a real implementation, we'd add a new page here
      break
    }
  }

  // Draw bottom line of table
  drawLine(50, y + 8, 562, y + 8)
  y -= 20

  // === TOTALS ===
  const totalsX = 400
  const totalsValueX = 510

  // Subtotal
  drawText('Subtotal:', totalsX, y, { size: 10 })
  drawText(formatCurrency(subtotal), totalsValueX, y, { size: 10 })
  y -= 18

  // Tax
  if (data.tax !== undefined && data.tax > 0) {
    const taxLabel = data.taxRate ? `IVA (${data.taxRate}%):` : 'IVA:'
    drawText(taxLabel, totalsX, y, { size: 10 })
    drawText(formatCurrency(data.tax), totalsValueX, y, { size: 10 })
    y -= 18
  }

  // Discount
  if (data.discount !== undefined && data.discount > 0) {
    drawText('Descuento:', totalsX, y, { size: 10 })
    drawText(`-${formatCurrency(data.discount)}`, totalsValueX, y, { size: 10, color: rgb(0.8, 0, 0) })
    y -= 18
  }

  // Shipping
  if (data.shipping !== undefined && data.shipping > 0) {
    drawText('Envío:', totalsX, y, { size: 10 })
    drawText(formatCurrency(data.shipping), totalsValueX, y, { size: 10 })
    y -= 18
  }

  // Add spacing before total box
  y -= 10

  // Total box
  page.drawRectangle({
    x: totalsX - 10,
    y: y - 8,
    width: 172,
    height: 28,
    color: darkBlue
  })
  drawText('TOTAL:', totalsX, y, { font: fontBold, size: 12, color: rgb(1, 1, 1) })
  drawText(formatCurrency(total), totalsValueX - 10, y, { font: fontBold, size: 14, color: rgb(1, 1, 1) })

  y -= 50

  // === PAYMENT INFO ===
  if (data.paymentStatus || data.paymentMethod) {
    drawLine(50, y + 10, 300, y + 10)

    if (data.paymentMethod) {
      drawText(`Método de pago: ${data.paymentMethod}`, 50, y - 5, { size: 9 })
      y -= 15
    }

    if (data.paymentStatus) {
      const statusText = data.paymentStatus === 'paid' ? 'PAGADO' :
                         data.paymentStatus === 'pending' ? 'PENDIENTE' : 'PAGO PARCIAL'
      const statusColor = data.paymentStatus === 'paid' ? rgb(0, 0.5, 0) :
                          data.paymentStatus === 'pending' ? rgb(0.8, 0.4, 0) : rgb(0.6, 0.3, 0)
      drawText(`Estado: ${statusText}`, 50, y - 5, { font: fontBold, size: 10, color: statusColor })
      y -= 15
    }

    if (data.amountPaid !== undefined && data.amountPaid > 0) {
      drawText(`Pagado: ${formatCurrency(data.amountPaid)}`, 50, y - 5, { size: 9 })
      y -= 15
    }

    if (data.amountDue !== undefined && data.amountDue > 0) {
      drawText(`Por pagar: ${formatCurrency(data.amountDue)}`, 50, y - 5, { font: fontBold, size: 10, color: rgb(0.8, 0, 0) })
      y -= 15
    }
  }

  // === NOTES ===
  if (data.notes) {
    y -= 10
    drawLine(50, y + 5, 300, y + 5)
    drawText('Notas:', 50, y - 10, { font: fontBold, size: 9 })
    drawText(data.notes.substring(0, 80), 50, y - 25, { size: 9, color: gray })
  }

  // === FOOTER ===
  drawText('--- Documento generado por LogiRapid ---', 200, 30, { size: 8, color: gray })

  // Serialize the PDF to bytes
  const pdfBytes = await pdfDoc.save()

  return Buffer.from(pdfBytes)
}

function formatCurrency(amount: number): string {
  return '$' + amount.toFixed(2)
}

export type { PurchaseInvoiceData, InvoiceItem }
