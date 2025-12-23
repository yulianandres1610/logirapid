/**
 * Purchase Invoice PDF Generator - Generates PDF for standard printers
 * For printing purchase invoices from suppliers
 */

import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib'

interface InvoiceItem {
  name: string
  sku?: string
  quantity: number
  unitCost: number
  total?: number
}

interface PurchaseInvoiceData {
  // Header
  companyName: string
  companyAddress?: string

  // Supplier info
  supplierName: string
  supplierRuc?: string
  supplierAddress?: string
  supplierPhone?: string

  // Invoice info
  invoiceNumber: string
  purchaseNumber?: string
  date: string
  dueDate?: string
  receivedBy?: string
  warehouseName?: string

  // Items
  items: InvoiceItem[]

  // Totals
  subtotal: number
  tax?: number
  taxRate?: number
  discount?: number
  shipping?: number
  total: number

  // Payment info
  paymentMethod?: string
  paymentStatus?: string // 'paid', 'pending', 'partial'
  amountPaid?: number
  amountDue?: number

  // Notes
  notes?: string
}

export async function generatePurchaseInvoicePdf(data: PurchaseInvoiceData): Promise<Buffer> {
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
  drawText(data.companyName, 50, y, { font: fontBold, size: 18, color: darkBlue })
  y -= 20

  if (data.companyAddress) {
    drawText(data.companyAddress, 50, y, { size: 9, color: gray })
    y -= 15
  }

  // Invoice title on the right
  drawText('FACTURA DE COMPRA', 400, 750, { font: fontBold, size: 16, color: darkBlue })

  // Invoice number and date
  drawText(`No: ${data.invoiceNumber}`, 400, 730, { font: fontBold, size: 11 })
  drawText(`Fecha: ${data.date}`, 400, 715, { size: 10 })

  if (data.purchaseNumber) {
    drawText(`Orden: ${data.purchaseNumber}`, 400, 700, { size: 10 })
  }

  if (data.dueDate) {
    drawText(`Vence: ${data.dueDate}`, 400, 685, { size: 10, color: gray })
  }

  y = 660

  // Separator line
  drawLine(50, y, 562, y)
  y -= 25

  // === SUPPLIER INFO ===
  drawText('PROVEEDOR', 50, y, { font: fontBold, size: 11, color: darkBlue })
  y -= 18

  drawText(data.supplierName, 50, y, { font: fontBold, size: 11 })
  y -= 15

  if (data.supplierRuc) {
    drawText(`RUC/NIT: ${data.supplierRuc}`, 50, y, { size: 9 })
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
  for (const item of data.items) {
    const itemTotal = item.total ?? item.quantity * item.unitCost

    // Draw row
    drawText(item.quantity.toString(), 55, y, { size: 9 })
    drawText(item.name.substring(0, 35), 95, y, { size: 9 })
    drawText(item.sku || '-', 320, y, { size: 8, color: gray })
    drawText(formatCurrency(item.unitCost), 400, y, { size: 9 })
    drawText(formatCurrency(itemTotal), 500, y, { size: 9, font: fontBold })

    y -= 18

    // Draw line between rows
    drawLine(50, y + 5, 562, y + 5)

    // Check if we need a new page
    if (y < 150) {
      // In a real implementation, we'd add a new page here
      break
    }
  }

  y -= 15

  // === TOTALS ===
  const totalsX = 400
  const totalsValueX = 500

  // Subtotal
  drawText('Subtotal:', totalsX, y, { size: 10 })
  drawText(formatCurrency(data.subtotal), totalsValueX, y, { size: 10 })
  y -= 15

  // Tax
  if (data.tax !== undefined && data.tax > 0) {
    const taxLabel = data.taxRate ? `IVA (${data.taxRate}%):` : 'IVA:'
    drawText(taxLabel, totalsX, y, { size: 10 })
    drawText(formatCurrency(data.tax), totalsValueX, y, { size: 10 })
    y -= 15
  }

  // Discount
  if (data.discount !== undefined && data.discount > 0) {
    drawText('Descuento:', totalsX, y, { size: 10 })
    drawText(`-${formatCurrency(data.discount)}`, totalsValueX, y, { size: 10, color: rgb(0.8, 0, 0) })
    y -= 15
  }

  // Shipping
  if (data.shipping !== undefined && data.shipping > 0) {
    drawText('Envío:', totalsX, y, { size: 10 })
    drawText(formatCurrency(data.shipping), totalsValueX, y, { size: 10 })
    y -= 15
  }

  // Total line
  y -= 5
  drawLine(totalsX - 10, y + 20, 562, y + 20)

  // Total
  page.drawRectangle({
    x: totalsX - 10,
    y: y - 5,
    width: 172,
    height: 25,
    color: darkBlue
  })
  drawText('TOTAL:', totalsX, y, { font: fontBold, size: 12, color: rgb(1, 1, 1) })
  drawText(formatCurrency(data.total), totalsValueX - 10, y, { font: fontBold, size: 14, color: rgb(1, 1, 1) })

  y -= 40

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
