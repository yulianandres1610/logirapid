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

      default:
        return NextResponse.json({
          success: false,
          error: `Tipo de documento no soportado para descarga: ${documentType}`
        }, { status: 400 })
    }

    // Return PDF as downloadable file
    return new NextResponse(pdfBytes, {
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
