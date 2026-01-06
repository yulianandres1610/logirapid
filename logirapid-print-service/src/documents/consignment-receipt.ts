/**
 * Consignment Receipt Generator
 * Generates a receipt with barcodes for warehouse reception
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import bwipjs from 'bwip-js'

interface ConsignmentLine {
  productName: string
  sku: string
  barcode: string | null
  quantity: number
  unitCost: number
  totalCost: number
}

interface ConsignmentReceiptData {
  orderNumber: string
  supplier: {
    code: string
    name: string
    contactName?: string
  }
  warehouse: {
    code: string
    name: string
  }
  lines: ConsignmentLine[]
  totalItems: number
  totalUnits: number
  totalCost: number
  consignmentDate: string
  notes?: string
  createdBy?: string
  companyName?: string
}

export async function generateConsignmentReceipt(data: ConsignmentReceiptData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()

  // Letter size in points (8.5 x 11 inches)
  const pageWidth = 612
  const pageHeight = 792
  const margin = 40
  const contentWidth = pageWidth - margin * 2

  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Helper function to add new page if needed
  const checkPageBreak = (requiredHeight: number) => {
    if (y - requiredHeight < margin + 50) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
  }

  // === HEADER ===
  // Company name
  if (data.companyName) {
    page.drawText(data.companyName, {
      x: margin,
      y,
      size: 14,
      font: boldFont
    })
    y -= 18
  }

  // Title
  page.drawText('RECEPCION DE CONSIGNACION', {
    x: margin,
    y,
    size: 18,
    font: boldFont
  })
  y -= 30

  // Order number with barcode
  page.drawText('Orden:', {
    x: margin,
    y,
    size: 10,
    font,
    color: rgb(0.4, 0.4, 0.4)
  })
  page.drawText(data.orderNumber, {
    x: margin + 45,
    y,
    size: 14,
    font: boldFont
  })
  y -= 15

  // Generate and embed order barcode
  const orderNumberStr = data.orderNumber || 'SIN-NUMERO'
  try {
    const orderBarcodeBuffer = await bwipjs.toBuffer({
      bcid: 'code128',
      text: orderNumberStr,
      scale: 2,
      height: 12,
      includetext: true,
      textxalign: 'center',
      textsize: 10
    })

    const orderBarcodeImage = await pdfDoc.embedPng(orderBarcodeBuffer)
    const barcodeWidth = 200
    const barcodeHeight = 50

    page.drawImage(orderBarcodeImage, {
      x: margin,
      y: y - barcodeHeight,
      width: barcodeWidth,
      height: barcodeHeight
    })
    y -= barcodeHeight + 10
  } catch (error) {
    console.error('Error generating order barcode:', error)
    y -= 10
  }

  // Date
  page.drawText(`Fecha: ${formatDate(data.consignmentDate)}`, {
    x: pageWidth - margin - 150,
    y: pageHeight - margin - 48,
    size: 10,
    font
  })

  // === SUPPLIER & WAREHOUSE INFO ===
  y -= 15
  page.drawRectangle({
    x: margin,
    y: y - 60,
    width: contentWidth / 2 - 10,
    height: 60,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1
  })

  page.drawText('PROVEEDOR', {
    x: margin + 10,
    y: y - 15,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.4)
  })
  page.drawText(data.supplier.code, {
    x: margin + 10,
    y: y - 30,
    size: 12,
    font: boldFont
  })
  page.drawText(data.supplier.name, {
    x: margin + 10,
    y: y - 45,
    size: 10,
    font
  })
  if (data.supplier.contactName) {
    page.drawText(data.supplier.contactName, {
      x: margin + 10,
      y: y - 57,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5)
    })
  }

  page.drawRectangle({
    x: margin + contentWidth / 2 + 10,
    y: y - 60,
    width: contentWidth / 2 - 10,
    height: 60,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1
  })

  page.drawText('ALMACEN DESTINO', {
    x: margin + contentWidth / 2 + 20,
    y: y - 15,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.4)
  })
  page.drawText(data.warehouse.code, {
    x: margin + contentWidth / 2 + 20,
    y: y - 30,
    size: 12,
    font: boldFont
  })
  page.drawText(data.warehouse.name, {
    x: margin + contentWidth / 2 + 20,
    y: y - 45,
    size: 10,
    font
  })

  y -= 80

  // === SUMMARY ===
  page.drawRectangle({
    x: margin,
    y: y - 30,
    width: contentWidth,
    height: 30,
    color: rgb(0.95, 0.95, 0.95)
  })

  const summaryY = y - 20
  page.drawText(`Productos: ${data.totalItems}`, {
    x: margin + 20,
    y: summaryY,
    size: 10,
    font: boldFont
  })
  page.drawText(`Unidades: ${data.totalUnits}`, {
    x: margin + 150,
    y: summaryY,
    size: 10,
    font: boldFont
  })
  page.drawText(`Total: $${data.totalCost.toFixed(2)}`, {
    x: margin + 300,
    y: summaryY,
    size: 10,
    font: boldFont
  })

  y -= 50

  // === PRODUCTS TABLE HEADER ===
  const colWidths = {
    barcode: 120,
    product: 200,
    qty: 50,
    cost: 70,
    total: 80
  }

  page.drawRectangle({
    x: margin,
    y: y - 20,
    width: contentWidth,
    height: 20,
    color: rgb(0.2, 0.2, 0.2)
  })

  let colX = margin + 5
  page.drawText('CODIGO', {
    x: colX,
    y: y - 14,
    size: 8,
    font: boldFont,
    color: rgb(1, 1, 1)
  })
  colX += colWidths.barcode

  page.drawText('PRODUCTO', {
    x: colX,
    y: y - 14,
    size: 8,
    font: boldFont,
    color: rgb(1, 1, 1)
  })
  colX += colWidths.product

  page.drawText('CANT.', {
    x: colX,
    y: y - 14,
    size: 8,
    font: boldFont,
    color: rgb(1, 1, 1)
  })
  colX += colWidths.qty

  page.drawText('COSTO', {
    x: colX,
    y: y - 14,
    size: 8,
    font: boldFont,
    color: rgb(1, 1, 1)
  })
  colX += colWidths.cost

  page.drawText('TOTAL', {
    x: colX,
    y: y - 14,
    size: 8,
    font: boldFont,
    color: rgb(1, 1, 1)
  })

  y -= 25

  // === PRODUCTS LIST WITH BARCODES ===
  for (let i = 0; i < data.lines.length; i++) {
    const line = data.lines[i]
    const rowHeight = 55 // Height for each row including barcode

    checkPageBreak(rowHeight + 20)

    // Alternate row background
    if (i % 2 === 0) {
      page.drawRectangle({
        x: margin,
        y: y - rowHeight,
        width: contentWidth,
        height: rowHeight,
        color: rgb(0.97, 0.97, 0.97)
      })
    }

    // Row border
    page.drawLine({
      start: { x: margin, y: y - rowHeight },
      end: { x: margin + contentWidth, y: y - rowHeight },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.85)
    })

    colX = margin + 5

    // Barcode column - generate barcode image
    const barcodeValue = line.barcode || line.sku || `SKU-${i + 1}`
    if (barcodeValue) {
      try {
        const productBarcodeBuffer = await bwipjs.toBuffer({
          bcid: 'code128',
          text: String(barcodeValue), // Ensure it's a string
          scale: 1.5,
          height: 8,
          includetext: true,
          textxalign: 'center',
          textsize: 7
        })

        const productBarcodeImage = await pdfDoc.embedPng(productBarcodeBuffer)

        page.drawImage(productBarcodeImage, {
          x: colX,
          y: y - rowHeight + 5,
          width: 100,
          height: 35
        })
      } catch (error) {
        // Fallback to text
        page.drawText(barcodeValue, {
          x: colX,
          y: y - 25,
          size: 8,
          font
        })
      }
    }
    colX += colWidths.barcode

    // Product name and SKU
    const productName = truncateText(line.productName || 'Producto sin nombre', 35)
    page.drawText(productName, {
      x: colX,
      y: y - 20,
      size: 9,
      font: boldFont
    })
    page.drawText(`SKU: ${line.sku || '-'}`, {
      x: colX,
      y: y - 32,
      size: 7,
      font,
      color: rgb(0.5, 0.5, 0.5)
    })
    colX += colWidths.product

    // Quantity
    page.drawText(line.quantity.toString(), {
      x: colX + 10,
      y: y - 25,
      size: 12,
      font: boldFont
    })
    colX += colWidths.qty

    // Unit cost
    page.drawText(`$${line.unitCost.toFixed(2)}`, {
      x: colX,
      y: y - 25,
      size: 9,
      font
    })
    colX += colWidths.cost

    // Total
    page.drawText(`$${line.totalCost.toFixed(2)}`, {
      x: colX,
      y: y - 25,
      size: 9,
      font: boldFont
    })

    y -= rowHeight
  }

  // === FOOTER ===
  y -= 20
  checkPageBreak(100)

  // Notes
  if (data.notes) {
    page.drawText('Notas:', {
      x: margin,
      y,
      size: 9,
      font: boldFont
    })
    page.drawText(data.notes, {
      x: margin,
      y: y - 12,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4)
    })
    y -= 30
  }

  // Signature area
  y -= 30
  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + 200, y },
    thickness: 1,
    color: rgb(0, 0, 0)
  })
  page.drawText('Recibido por:', {
    x: margin,
    y: y - 15,
    size: 8,
    font
  })

  page.drawLine({
    start: { x: pageWidth - margin - 200, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: rgb(0, 0, 0)
  })
  page.drawText('Fecha de Recepcion:', {
    x: pageWidth - margin - 200,
    y: y - 15,
    size: 8,
    font
  })

  // Created by
  if (data.createdBy) {
    page.drawText(`Creado por: ${data.createdBy}`, {
      x: margin,
      y: margin,
      size: 8,
      font,
      color: rgb(0.6, 0.6, 0.6)
    })
  }

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  } catch {
    return dateStr
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

export type { ConsignmentReceiptData, ConsignmentLine }
