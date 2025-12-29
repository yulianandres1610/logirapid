import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
}

/**
 * POST /api/print/download
 * Generate and download PDF for various document types
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    const body = await request.json()
    const { documentType, documentData } = body

    if (!documentType || !documentData) {
      return NextResponse.json({
        success: false,
        error: 'documentType y documentData son requeridos'
      }, { status: 400 })
    }

    let pdfBytes: Uint8Array
    let filename: string

    switch (documentType) {
      case 'sales_report':
        pdfBytes = await generateSalesReportPdf(documentData)
        filename = `reporte-ventas-${Date.now()}.pdf`
        break

      case 'cash_register_report':
        pdfBytes = await generateCashRegisterReportPdf(documentData)
        filename = `cierre-caja-${Date.now()}.pdf`
        break

      case 'inventory_count_report':
        pdfBytes = await generateInventoryCountReportPdf(documentData)
        filename = `reporte-conteo-${Date.now()}.pdf`
        break

      case 'purchase_invoice':
        pdfBytes = await generatePurchaseInvoicePdf(documentData)
        filename = `factura-compra-${documentData.invoiceNumber || Date.now()}.pdf`
        break

      case 'lot_label':
        pdfBytes = await generateLotLabelPdf(documentData)
        filename = `etiqueta-lote-${documentData.lotNumber || Date.now()}.pdf`
        break

      case 'unified_reception':
        pdfBytes = await generateUnifiedReceptionPdf(documentData)
        filename = `recepcion-${documentData.orderNumber || Date.now()}.pdf`
        break

      default:
        return NextResponse.json({
          success: false,
          error: `Tipo de documento no soportado para descarga: ${documentType}`
        }, { status: 400 })
    }

    // Return PDF as downloadable file
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBytes.length.toString()
      }
    })

  } catch (error) {
    console.error('[Print Download API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al generar PDF'
    }, { status: 500 })
  }
}

// =============================================
// PDF Generators (server-side versions)
// =============================================

function formatCurrency(amount: number): string {
  return '$' + amount.toFixed(2)
}

// Sales Report PDF
async function generateSalesReportPdf(data: Record<string, unknown>): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792])

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const lightGray = rgb(0.9, 0.9, 0.9)
  const darkBlue = rgb(0.1, 0.2, 0.4)
  const green = rgb(0, 0.5, 0)

  let y = 750

  const drawText = (text: string, x: number, yPos: number, options: { font?: PDFFont; size?: number; color?: typeof black } = {}) => {
    page.drawText(text, {
      x, y: yPos,
      font: options.font || fontRegular,
      size: options.size || 10,
      color: options.color || black
    })
  }

  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: gray })
  }

  // Header
  drawText((data.reportTitle as string) || 'REPORTE DE VENTAS', 200, y, { font: fontBold, size: 18, color: darkBlue })
  y -= 25

  drawText((data.companyName as string) || 'Empresa', 50, y, { font: fontBold, size: 14 })
  y -= 18

  if (data.terminalName) {
    drawText(`Terminal: ${data.terminalName}`, 50, y, { size: 10, color: gray })
    y -= 15
  }

  if (data.warehouseName) {
    drawText(`Almacén: ${data.warehouseName}`, 50, y, { size: 10, color: gray })
    y -= 15
  }

  // Date info
  if (data.periodStart && data.periodEnd) {
    drawText(`Período: ${data.periodStart} - ${data.periodEnd}`, 380, 725, { size: 10 })
  } else if (data.reportDate) {
    drawText(`Fecha: ${data.reportDate}`, 450, 725, { size: 10 })
  }

  if (data.generatedAt) {
    drawText(`Generado: ${data.generatedAt}`, 400, 710, { size: 9, color: gray })
  }

  y -= 10
  drawLine(50, y, 562, y)
  y -= 25

  // Summary
  page.drawRectangle({ x: 50, y: y - 5, width: 250, height: 20, color: lightGray })
  drawText('RESUMEN DE VENTAS', 55, y, { font: fontBold, size: 11, color: darkBlue })
  y -= 25

  drawText('Transacciones:', 55, y, { size: 10 })
  drawText(String(data.totalTransactions || 0), 180, y, { font: fontBold, size: 10 })
  y -= 18

  drawText('Productos vendidos:', 55, y, { size: 10 })
  drawText(String(data.totalProducts || 0), 180, y, { font: fontBold, size: 10 })
  y -= 18

  drawLine(55, y + 5, 280, y + 5)
  y -= 5

  drawText('Ventas brutas:', 55, y, { size: 10 })
  drawText(formatCurrency(Number(data.grossSales) || 0), 180, y, { size: 10 })
  y -= 18

  if (data.discounts && Number(data.discounts) > 0) {
    drawText('Descuentos:', 55, y, { size: 10 })
    drawText(`-${formatCurrency(Number(data.discounts))}`, 180, y, { size: 10, color: rgb(0.8, 0, 0) })
    y -= 18
  }

  if (data.taxes !== undefined) {
    drawText('Impuestos:', 55, y, { size: 10 })
    drawText(formatCurrency(Number(data.taxes) || 0), 180, y, { size: 10 })
    y -= 18
  }

  // Net sales box
  y -= 5
  page.drawRectangle({ x: 50, y: y - 8, width: 250, height: 28, color: darkBlue })
  drawText('VENTAS NETAS:', 55, y, { font: fontBold, size: 12, color: rgb(1, 1, 1) })
  drawText(formatCurrency(Number(data.netSales) || 0), 170, y, { font: fontBold, size: 14, color: rgb(1, 1, 1) })
  y -= 40

  // Sales by payment
  const salesByPayment = data.salesByPayment as Array<{ paymentMethod: string; transactionCount: number; total: number }> | undefined
  if (salesByPayment && salesByPayment.length > 0) {
    page.drawRectangle({ x: 50, y: y - 5, width: 250, height: 20, color: lightGray })
    drawText('VENTAS POR MÉTODO DE PAGO', 55, y, { font: fontBold, size: 11, color: darkBlue })
    y -= 25

    for (const payment of salesByPayment) {
      drawText(`${payment.paymentMethod}:`, 55, y, { size: 10 })
      drawText(formatCurrency(payment.total), 180, y, { font: fontBold, size: 10 })
      y -= 15
      drawText(`(${payment.transactionCount} transacciones)`, 70, y, { size: 9, color: gray })
      y -= 18
    }
    y -= 10
  }

  // Top products
  const topProducts = data.topProducts as Array<{ name: string; quantity: number; total: number }> | undefined
  if (topProducts && topProducts.length > 0) {
    page.drawRectangle({ x: 50, y: y - 5, width: 512, height: 20, color: lightGray })
    drawText('PRODUCTOS MÁS VENDIDOS', 55, y, { font: fontBold, size: 11, color: darkBlue })
    y -= 25

    drawText('#', 55, y, { font: fontBold, size: 9 })
    drawText('Producto', 75, y, { font: fontBold, size: 9 })
    drawText('Cantidad', 380, y, { font: fontBold, size: 9 })
    drawText('Total', 480, y, { font: fontBold, size: 9 })
    y -= 18

    for (let i = 0; i < Math.min(10, topProducts.length); i++) {
      const product = topProducts[i]
      drawText(`${i + 1}.`, 55, y, { size: 9 })
      drawText(product.name.substring(0, 45), 75, y, { size: 9 })
      drawText(String(product.quantity), 395, y, { size: 9 })
      drawText(formatCurrency(product.total), 480, y, { font: fontBold, size: 9 })
      y -= 16
    }
  }

  // Footer
  drawText('--- Reporte generado por LogiRapid ---', 200, 30, { size: 8, color: gray })

  return pdfDoc.save()
}

// Cash Register Report PDF
async function generateCashRegisterReportPdf(data: Record<string, unknown>): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792])

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const lightGray = rgb(0.9, 0.9, 0.9)
  const darkBlue = rgb(0.1, 0.2, 0.4)
  const green = rgb(0, 0.5, 0)
  const red = rgb(0.8, 0, 0)

  let y = 750

  const drawText = (text: string, x: number, yPos: number, options: { font?: PDFFont; size?: number; color?: typeof black } = {}) => {
    page.drawText(text, {
      x, y: yPos,
      font: options.font || fontRegular,
      size: options.size || 10,
      color: options.color || black
    })
  }

  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: gray })
  }

  // Header
  drawText('CIERRE DE CAJA', 230, y, { font: fontBold, size: 20, color: darkBlue })
  y -= 30

  drawText((data.companyName as string) || 'Empresa', 50, y, { font: fontBold, size: 14 })
  y -= 18

  drawText(`Terminal: ${data.terminalName || 'N/A'}`, 50, y, { size: 11 })
  y -= 15

  if (data.warehouseName) {
    drawText(`Almacén: ${data.warehouseName}`, 50, y, { size: 10, color: gray })
    y -= 15
  }

  // Session times
  drawText(`Apertura: ${data.openedAt || 'N/A'}`, 380, 720, { size: 10 })
  drawText(`Cierre: ${data.closedAt || 'N/A'}`, 380, 705, { size: 10 })

  y -= 10
  drawLine(50, y, 562, y)
  y -= 25

  // Sales Summary
  page.drawRectangle({ x: 50, y: y - 5, width: 250, height: 20, color: lightGray })
  drawText('RESUMEN DE VENTAS', 55, y, { font: fontBold, size: 11, color: darkBlue })
  y -= 25

  drawText('Transacciones:', 55, y, { size: 10 })
  drawText(String(data.totalTransactions || 0), 180, y, { font: fontBold, size: 10 })
  y -= 18

  drawText('Ventas brutas:', 55, y, { size: 10 })
  drawText(formatCurrency(Number(data.grossSales) || 0), 180, y, { size: 10 })
  y -= 18

  drawText('Ventas netas:', 55, y, { font: fontBold, size: 10 })
  drawText(formatCurrency(Number(data.netSales) || 0), 180, y, { font: fontBold, size: 10 })
  y -= 30

  // Totals
  page.drawRectangle({ x: 50, y: y - 5, width: 250, height: 20, color: lightGray })
  drawText('TOTALES', 55, y, { font: fontBold, size: 11, color: darkBlue })
  y -= 25

  drawText('Esperado:', 55, y, { size: 11 })
  drawText(formatCurrency(Number(data.totalExpected) || 0), 180, y, { font: fontBold, size: 11 })
  y -= 20

  drawText('Contado:', 55, y, { size: 11 })
  drawText(formatCurrency(Number(data.totalCounted) || 0), 180, y, { font: fontBold, size: 11 })
  y -= 20

  drawLine(55, y + 5, 280, y + 5)
  y -= 5

  // Difference
  const totalDifference = Number(data.totalDifference) || 0
  const diffLabel = totalDifference >= 0 ? 'SOBRANTE:' : 'FALTANTE:'
  const diffColor = totalDifference >= 0 ? green : red

  page.drawRectangle({
    x: 50, y: y - 10, width: 250, height: 30,
    color: totalDifference >= 0 ? rgb(0.9, 1, 0.9) : rgb(1, 0.9, 0.9)
  })
  drawText(diffLabel, 55, y - 2, { font: fontBold, size: 14, color: diffColor })
  drawText(formatCurrency(Math.abs(totalDifference)), 160, y - 2, { font: fontBold, size: 16, color: diffColor })
  y -= 60

  // Signature lines
  drawLine(55, y, 200, y)
  drawText('Firma del Cajero', 90, y - 15, { size: 9, color: gray })

  drawLine(320, y, 465, y)
  drawText('Firma del Supervisor', 350, y - 15, { size: 9, color: gray })

  // Footer
  drawText('--- Cierre de Caja generado por LogiRapid ---', 180, 30, { size: 8, color: gray })

  return pdfDoc.save()
}

// Inventory Count Report PDF
async function generateInventoryCountReportPdf(data: Record<string, unknown>): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792])

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

  const drawText = (text: string, x: number, yPos: number, options: { font?: PDFFont; size?: number; color?: typeof black } = {}) => {
    page.drawText(text, {
      x, y: yPos,
      font: options.font || fontRegular,
      size: options.size || 10,
      color: options.color || black
    })
  }

  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: gray })
  }

  // Header
  drawText('REPORTE DE CONTEO', 210, y, { font: fontBold, size: 20, color: darkBlue })
  y -= 25

  drawText((data.countNumber as string) || 'N/A', 50, y, { font: fontBold, size: 14 })

  const statusText = data.status === 'completed' ? 'COMPLETADO' : 'EN PROGRESO'
  const statusColor = data.status === 'completed' ? green : orange
  drawText(statusText, 200, y, { font: fontBold, size: 11, color: statusColor })
  y -= 20

  if (data.companyName) {
    drawText(data.companyName as string, 50, y, { size: 11 })
    y -= 15
  }

  drawText(`Almacén: ${data.warehouseName || 'N/A'}`, 50, y, { size: 10, color: gray })
  y -= 15

  // Dates
  drawText(`Iniciado: ${data.startedAt || 'N/A'}`, 380, 725, { size: 10 })
  if (data.completedAt) {
    drawText(`Completado: ${data.completedAt}`, 380, 710, { size: 10 })
  }

  y -= 10
  drawLine(50, y, 562, y)
  y -= 25

  // Summary
  page.drawRectangle({ x: 50, y: y - 5, width: 250, height: 20, color: lightGray })
  drawText('RESUMEN', 55, y, { font: fontBold, size: 11, color: darkBlue })
  y -= 25

  drawText('Total productos:', 55, y, { size: 10 })
  drawText(String(data.totalProducts || 0), 180, y, { font: fontBold, size: 10 })
  y -= 18

  drawText('Con diferencias:', 55, y, { size: 10 })
  const prodWithDiff = Number(data.productsWithDifferences) || 0
  drawText(String(prodWithDiff), 180, y, { font: fontBold, size: 10, color: prodWithDiff > 0 ? orange : black })
  y -= 18

  drawLine(55, y + 5, 280, y + 5)
  y -= 15

  // Difference value
  const totalDiffValue = Number(data.totalDifferenceValue) || 0
  const diffSign = totalDiffValue >= 0 ? '+' : '-'
  const diffColor = totalDiffValue >= 0 ? green : red

  page.drawRectangle({
    x: 50, y: y - 8, width: 250, height: 30,
    color: totalDiffValue >= 0 ? rgb(0.9, 1, 0.9) : rgb(1, 0.9, 0.9)
  })
  drawText('VALOR DIFERENCIA:', 55, y, { font: fontBold, size: 11, color: diffColor })
  drawText(`${diffSign}${formatCurrency(Math.abs(totalDiffValue))}`, 185, y, { font: fontBold, size: 14, color: diffColor })
  y -= 60

  // Signature lines
  drawLine(55, y, 200, y)
  drawText('Firma del Contador', 85, y - 15, { size: 9, color: gray })

  drawLine(320, y, 465, y)
  drawText('Firma del Supervisor', 350, y - 15, { size: 9, color: gray })

  // Footer
  drawText('--- Reporte de Conteo generado por LogiRapid ---', 175, 30, { size: 8, color: gray })

  return pdfDoc.save()
}

// Purchase Invoice PDF
async function generatePurchaseInvoicePdf(data: Record<string, unknown>): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792])

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const lightGray = rgb(0.9, 0.9, 0.9)
  const darkBlue = rgb(0.1, 0.2, 0.4)

  let y = 750

  const drawText = (text: string, x: number, yPos: number, options: { font?: PDFFont; size?: number; color?: typeof black } = {}) => {
    page.drawText(text, {
      x, y: yPos,
      font: options.font || fontRegular,
      size: options.size || 10,
      color: options.color || black
    })
  }

  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: gray })
  }

  // Header
  drawText((data.companyName as string) || 'Empresa', 50, y, { font: fontBold, size: 18, color: darkBlue })
  y -= 20

  if (data.companyAddress) {
    drawText(data.companyAddress as string, 50, y, { size: 9, color: gray })
    y -= 15
  }

  // Invoice title
  drawText('FACTURA DE COMPRA', 400, 750, { font: fontBold, size: 16, color: darkBlue })
  drawText(`No: ${data.invoiceNumber || 'N/A'}`, 400, 730, { font: fontBold, size: 11 })
  drawText(`Fecha: ${data.date || 'N/A'}`, 400, 715, { size: 10 })

  y = 660
  drawLine(50, y, 562, y)
  y -= 25

  // Supplier info
  drawText('PROVEEDOR', 50, y, { font: fontBold, size: 11, color: darkBlue })
  y -= 18
  drawText((data.supplierName as string) || 'N/A', 50, y, { font: fontBold, size: 11 })
  y -= 15

  if (data.supplierRuc) {
    drawText(`RUC/NIT: ${data.supplierRuc}`, 50, y, { size: 9 })
    y -= 13
  }

  y -= 20

  // Items table header
  const tableTop = y
  page.drawRectangle({ x: 50, y: tableTop - 5, width: 512, height: 20, color: lightGray })

  drawText('Cant', 55, tableTop, { font: fontBold, size: 9 })
  drawText('Descripción', 95, tableTop, { font: fontBold, size: 9 })
  drawText('SKU', 320, tableTop, { font: fontBold, size: 9 })
  drawText('Precio Unit.', 400, tableTop, { font: fontBold, size: 9 })
  drawText('Total', 500, tableTop, { font: fontBold, size: 9 })

  y = tableTop - 25

  // Items
  const items = data.items as Array<{ name: string; sku?: string; quantity: number; unitCost: number; total?: number }> | undefined
  if (items) {
    for (const item of items) {
      const itemTotal = item.total ?? item.quantity * item.unitCost
      drawText(String(item.quantity), 55, y, { size: 9 })
      drawText(item.name.substring(0, 35), 95, y, { size: 9 })
      drawText(item.sku || '-', 320, y, { size: 8, color: gray })
      drawText(formatCurrency(item.unitCost), 400, y, { size: 9 })
      drawText(formatCurrency(itemTotal), 500, y, { size: 9, font: fontBold })
      y -= 20
      if (y < 150) break
    }
  }

  drawLine(50, y + 8, 562, y + 8)
  y -= 20

  // Totals
  const totalsX = 400
  const totalsValueX = 510

  drawText('Subtotal:', totalsX, y, { size: 10 })
  drawText(formatCurrency(Number(data.subtotal) || 0), totalsValueX, y, { size: 10 })
  y -= 18

  if (data.tax !== undefined && Number(data.tax) > 0) {
    const taxLabel = data.taxRate ? `IVA (${data.taxRate}%):` : 'IVA:'
    drawText(taxLabel, totalsX, y, { size: 10 })
    drawText(formatCurrency(Number(data.tax)), totalsValueX, y, { size: 10 })
    y -= 18
  }

  y -= 10

  // Total box
  page.drawRectangle({ x: totalsX - 10, y: y - 8, width: 172, height: 28, color: darkBlue })
  drawText('TOTAL:', totalsX, y, { font: fontBold, size: 12, color: rgb(1, 1, 1) })
  drawText(formatCurrency(Number(data.total) || 0), totalsValueX - 10, y, { font: fontBold, size: 14, color: rgb(1, 1, 1) })

  // Footer
  drawText('--- Documento generado por LogiRapid ---', 200, 30, { size: 8, color: gray })

  return pdfDoc.save()
}

// Lot Label PDF (4x6 inches = 288 x 432 points)
async function generateLotLabelPdf(data: Record<string, unknown>): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  // 4x6 inches in points (1 inch = 72 points)
  const pageWidth = 4 * 72  // 288 points
  const pageHeight = 6 * 72 // 432 points
  const page = pdfDoc.addPage([pageWidth, pageHeight])

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.3, 0.3, 0.3)
  const darkGray = rgb(0.5, 0.5, 0.5)
  const purple = rgb(0.4, 0.2, 0.6)

  const margin = 12
  let y = pageHeight - margin

  const drawText = (text: string, x: number, yPos: number, options: { font?: PDFFont; size?: number; color?: typeof black; maxWidth?: number } = {}) => {
    let displayText = text
    const font = options.font || fontRegular
    const size = options.size || 12

    // Truncate if too long
    if (options.maxWidth) {
      while (font.widthOfTextAtSize(displayText, size) > options.maxWidth && displayText.length > 3) {
        displayText = displayText.slice(0, -4) + '...'
      }
    }

    page.drawText(displayText, {
      x, y: yPos,
      font,
      size,
      color: options.color || black
    })
  }

  const centerText = (text: string, yPos: number, options: { font?: PDFFont; size?: number; color?: typeof black } = {}) => {
    const font = options.font || fontRegular
    const size = options.size || 12
    const textWidth = font.widthOfTextAtSize(text, size)
    const x = (pageWidth - textWidth) / 2
    drawText(text, x, yPos, options)
  }

  // ============================================
  // HEADER: Type indicator
  // ============================================
  const sourceType = (data.source as string) || 'consignment'
  const sourceLabel = sourceType === 'consignment' ? 'CONSIGNACION' : sourceType === 'purchase' ? 'COMPRA' : 'LOTE'

  page.drawRectangle({
    x: 0, y: y - 20, width: pageWidth, height: 24,
    color: purple
  })
  centerText(sourceLabel, y - 14, { font: fontBold, size: 14, color: rgb(1, 1, 1) })
  y -= 35

  // ============================================
  // SUPPLIER NAME (VERY LARGE)
  // ============================================
  const supplierName = ((data.supplierName as string) || 'PROVEEDOR').toUpperCase()
  centerText(supplierName, y, { font: fontBold, size: 24, color: black })
  y -= 35

  // ============================================
  // PRODUCT NAME
  // ============================================
  const productName = (data.productName as string) || 'Producto'
  centerText(productName, y, { font: fontBold, size: 16, color: gray })
  y -= 25

  // ============================================
  // BARCODE FOR LOT NUMBER
  // ============================================
  const lotNumber = (data.lotNumber as string) || 'SIN-LOTE'

  // Draw a simulated barcode (vertical lines pattern)
  const barcodeHeight = 50
  const barcodeWidth = pageWidth - (margin * 4)
  const barcodeX = margin * 2
  const barcodeY = y - barcodeHeight

  // Generate barcode pattern from lot number
  const barcodePattern = generateBarcodePattern(lotNumber)
  const barWidth = barcodeWidth / barcodePattern.length

  for (let i = 0; i < barcodePattern.length; i++) {
    if (barcodePattern[i] === '1') {
      page.drawRectangle({
        x: barcodeX + (i * barWidth),
        y: barcodeY,
        width: barWidth,
        height: barcodeHeight,
        color: black
      })
    }
  }

  y = barcodeY - 8

  // Lot number text below barcode
  centerText(lotNumber, y, { font: fontBold, size: 18, color: black })
  y -= 35

  // ============================================
  // DATES SECTION
  // ============================================
  const labelWidth = 70
  const valueX = margin + labelWidth + 5

  // Expiration date (LARGE)
  const expirationDate = data.expirationDate
    ? new Date(data.expirationDate as string).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'SIN VENCIMIENTO'

  page.drawRectangle({
    x: margin, y: y - 3, width: pageWidth - (margin * 2), height: 38,
    color: rgb(0.95, 0.95, 0.95),
    borderColor: black,
    borderWidth: 1
  })

  drawText('VENCE:', margin + 8, y + 8, { font: fontBold, size: 12, color: darkGray })
  centerText(expirationDate.toUpperCase(), y - 18, { font: fontBold, size: 22, color: black })
  y -= 50

  // Reception date
  const receptionDate = data.receptionDate
    ? new Date(data.receptionDate as string).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })

  page.drawRectangle({
    x: margin, y: y - 3, width: pageWidth - (margin * 2), height: 32,
    color: rgb(0.9, 0.95, 0.9),
    borderColor: gray,
    borderWidth: 0.5
  })

  drawText('RECIBIDO:', margin + 8, y + 5, { font: fontBold, size: 10, color: darkGray })
  drawText(receptionDate.toUpperCase(), margin + 75, y + 5, { font: fontBold, size: 16, color: black })
  y -= 42

  // ============================================
  // QUANTITY AND COST
  // ============================================
  const quantity = data.quantity || 0
  const unitCost = data.unitCost || 0

  const halfWidth = (pageWidth - (margin * 3)) / 2

  // Quantity box
  page.drawRectangle({
    x: margin, y: y - 3, width: halfWidth, height: 32,
    color: rgb(0.95, 0.95, 1),
    borderColor: gray,
    borderWidth: 0.5
  })
  drawText('CANTIDAD', margin + 5, y + 10, { font: fontRegular, size: 8, color: darkGray })
  drawText(String(quantity), margin + 5, y - 10, { font: fontBold, size: 20, color: black })

  // Cost box
  page.drawRectangle({
    x: margin * 2 + halfWidth, y: y - 3, width: halfWidth, height: 32,
    color: rgb(1, 0.98, 0.95),
    borderColor: gray,
    borderWidth: 0.5
  })
  drawText('COSTO', margin * 2 + halfWidth + 5, y + 10, { font: fontRegular, size: 8, color: darkGray })
  drawText(`$${Number(unitCost).toFixed(2)}`, margin * 2 + halfWidth + 5, y - 10, { font: fontBold, size: 18, color: black })

  y -= 45

  // ============================================
  // WAREHOUSE
  // ============================================
  const warehouseName = (data.warehouseName as string) || ''
  if (warehouseName) {
    drawText('Almacén:', margin, y, { font: fontRegular, size: 9, color: darkGray })
    drawText(warehouseName, margin + 50, y, { font: fontBold, size: 10, color: black, maxWidth: pageWidth - margin - 60 })
    y -= 18
  }

  // ============================================
  // ORDER NUMBER
  // ============================================
  const orderNumber = (data.orderNumber as string) || ''
  if (orderNumber) {
    drawText('Orden:', margin, y, { font: fontRegular, size: 9, color: darkGray })
    drawText(orderNumber, margin + 40, y, { font: fontBold, size: 10, color: purple })
  }

  return pdfDoc.save()
}

// Generate a simple barcode pattern from text (Code 128 inspired)
function generateBarcodePattern(text: string): string {
  // Simplified barcode pattern generator
  // Returns a string of 1s and 0s representing bars and spaces
  let pattern = '11010'  // Start pattern

  for (const char of text) {
    const code = char.charCodeAt(0)
    // Convert each character to a 6-bit binary pattern
    const binary = code.toString(2).padStart(8, '0')
    // Take alternating bits and add spacers
    pattern += binary.slice(0, 4) + '0' + binary.slice(4) + '0'
  }

  pattern += '11010'  // End pattern

  // Add some randomization based on actual barcode rules
  // This creates a more realistic-looking barcode
  let result = ''
  for (let i = 0; i < pattern.length; i++) {
    result += pattern[i]
    // Add some thickness variation
    if (pattern[i] === '1' && i < pattern.length - 1 && pattern[i + 1] === '1') {
      result += '1'
    }
  }

  return result
}

// Generate Unified Reception PDF (80mm thermal receipt)
async function generateUnifiedReceptionPdf(data: Record<string, unknown>): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  // 80mm thermal paper width (about 3.15 inches = 226 points), dynamic height
  const pageWidth = 226
  const pageHeight = 500 // Will adjust based on content
  const page = pdfDoc.addPage([pageWidth, pageHeight])

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)

  const margin = 10
  let y = pageHeight - margin

  const drawText = (text: string, x: number, yPos: number, options: { font?: PDFFont; size?: number; color?: typeof black; maxWidth?: number } = {}) => {
    let displayText = text
    const font = options.font || fontRegular
    const size = options.size || 10

    if (options.maxWidth) {
      while (font.widthOfTextAtSize(displayText, size) > options.maxWidth && displayText.length > 3) {
        displayText = displayText.slice(0, -4) + '...'
      }
    }

    page.drawText(displayText, {
      x, y: yPos,
      font,
      size,
      color: options.color || black
    })
  }

  const centerText = (text: string, yPos: number, options: { font?: PDFFont; size?: number; color?: typeof black } = {}) => {
    const font = options.font || fontRegular
    const size = options.size || 10
    const textWidth = font.widthOfTextAtSize(text, size)
    const x = (pageWidth - textWidth) / 2
    drawText(text, x, yPos, options)
  }

  const drawLine = (yPos: number) => {
    page.drawLine({
      start: { x: margin, y: yPos },
      end: { x: pageWidth - margin, y: yPos },
      thickness: 0.5,
      color: gray
    })
  }

  // Header
  const orderType = (data.orderType as string) || 'consignment'
  const typeLabel = orderType === 'consignment' ? 'CONSIGNACION' : 'COMPRA'

  centerText('RECEPCION DE ' + typeLabel, y, { font: fontBold, size: 12 })
  y -= 18

  const orderNumber = (data.orderNumber as string) || ''
  centerText(orderNumber, y, { font: fontBold, size: 10 })
  y -= 16

  drawLine(y)
  y -= 12

  // Supplier info
  const supplier = data.supplier as { name?: string; code?: string } | undefined
  if (supplier) {
    drawText('Proveedor:', margin, y, { font: fontBold, size: 9, color: gray })
    y -= 12
    drawText(supplier.name || '', margin, y, { font: fontBold, size: 10, maxWidth: pageWidth - margin * 2 })
    y -= 10
    drawText(`Codigo: ${supplier.code || ''}`, margin, y, { font: fontRegular, size: 8, color: gray })
    y -= 14
  }

  // Warehouse info
  const warehouse = data.warehouse as { name?: string; code?: string } | undefined
  if (warehouse) {
    drawText('Almacen:', margin, y, { font: fontBold, size: 9, color: gray })
    y -= 12
    drawText(warehouse.name || '', margin, y, { font: fontBold, size: 10 })
    y -= 14
  }

  drawLine(y)
  y -= 12

  // Date
  const receivedAt = data.receivedAt
    ? new Date(data.receivedAt as string).toLocaleString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    : new Date().toLocaleString('es-ES')

  drawText(`Fecha: ${receivedAt}`, margin, y, { font: fontRegular, size: 9 })
  y -= 16

  drawLine(y)
  y -= 12

  // Products header
  drawText('PRODUCTOS', margin, y, { font: fontBold, size: 9 })
  y -= 14

  // Products list
  const products = (data.products as Array<{
    productName?: string
    sku?: string
    quantity?: number
    lotNumber?: string
  }>) || []

  for (const product of products) {
    drawText(product.productName || 'Producto', margin, y, { font: fontBold, size: 9, maxWidth: pageWidth - margin * 2 })
    y -= 10
    drawText(`SKU: ${product.sku || '-'}`, margin + 5, y, { font: fontRegular, size: 8, color: gray })
    y -= 10
    drawText(`Lote: ${product.lotNumber || '-'}`, margin + 5, y, { font: fontRegular, size: 8 })
    drawText(`Cant: ${product.quantity || 0}`, pageWidth - margin - 40, y, { font: fontBold, size: 9 })
    y -= 14
  }

  drawLine(y)
  y -= 12

  // Totals
  const totalProducts = (data.totalProducts as number) || products.length
  const totalUnits = (data.totalUnits as number) || 0

  drawText(`Total Productos:`, margin, y, { font: fontRegular, size: 9 })
  drawText(`${totalProducts}`, pageWidth - margin - 25, y, { font: fontBold, size: 9 })
  y -= 12

  drawText(`Total Unidades:`, margin, y, { font: fontRegular, size: 9 })
  drawText(`${totalUnits}`, pageWidth - margin - 25, y, { font: fontBold, size: 11 })
  y -= 16

  drawLine(y)
  y -= 12

  // Footer
  centerText('Recepcion completada', y, { font: fontRegular, size: 8, color: gray })

  return pdfDoc.save()
}
