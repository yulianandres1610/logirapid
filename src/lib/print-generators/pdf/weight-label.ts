/**
 * Weight Label PDF Generator - Works on any printer
 * Generates PDF labels for products with weight (matching ZPL layout)
 * Sizes: 3x2 inches and 2x1 inches
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import bwipjs from 'bwip-js'

export interface WeightLabelPdfData {
  productName: string
  productSku?: string
  weight: string           // "1.250 kg"
  weightKg: number         // 1.250
  priceCUP: number         // Precio total en CUP
  pricePerUnit?: number    // Precio CUP por unidad (kg/lb)
  unitOfMeasure?: string   // kg, lb, g
  barcode: string          // EAN-13 con peso embebido
  printDate: string        // Fecha de impresion
  labelSize?: '3x2' | '2x1' // Tamano de etiqueta (default: 3x2)
}

// Label sizes in points (72 points = 1 inch)
const SIZES = {
  '3x2': { width: 216, height: 144 }, // 3x2 inches
  '2x1': { width: 144, height: 72 }   // 2x1 inches
}

/**
 * Generate PDF weight label - auto-select by size
 */
export async function generateWeightLabelPdf(data: WeightLabelPdfData): Promise<Buffer> {
  const labelSize = data.labelSize || '3x2'

  if (labelSize === '2x1') {
    return generateWeightLabel2x1Pdf(data)
  }
  return generateWeightLabel3x2Pdf(data)
}

/**
 * Generate 3x2 inch weight label PDF
 */
async function generateWeightLabel3x2Pdf(data: WeightLabelPdfData): Promise<Buffer> {
  const { width, height } = SIZES['3x2']
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([width, height])

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const margin = 5
  const unit = data.unitOfMeasure || 'kg'
  const pricePerUnit = data.pricePerUnit || 0

  // Format prices with $ symbol (no decimals for CUP)
  const formattedPricePerUnit = '$' + Math.round(pricePerUnit).toLocaleString('es-ES')
  const formattedTotalPrice = '$' + Math.round(data.priceCUP).toLocaleString('es-ES')

  // ========== ROW 1: Headers ==========
  const headerY = height - margin - 8

  // PRECIO/unit (left)
  page.drawText(`PRECIO/${unit}`, {
    x: margin,
    y: headerY,
    size: 7,
    font: font,
    color: rgb(0.3, 0.3, 0.3)
  })

  // TOTAL (center)
  page.drawText('TOTAL', {
    x: 70,
    y: headerY,
    size: 7,
    font: font,
    color: rgb(0.3, 0.3, 0.3)
  })

  // Date (right)
  const dateText = data.printDate || new Date().toLocaleDateString('es-ES')
  const dateWidth = font.widthOfTextAtSize(dateText, 6)
  page.drawText(dateText, {
    x: width - margin - dateWidth,
    y: headerY,
    size: 6,
    font: font,
    color: rgb(0.4, 0.4, 0.4)
  })

  // ========== ROW 2: Price Values ==========
  const priceY = height - margin - 28

  // Price per unit (left)
  page.drawText(formattedPricePerUnit, {
    x: margin,
    y: priceY,
    size: 16,
    font: boldFont
  })

  // Total price (center-right, larger)
  const totalPriceWidth = boldFont.widthOfTextAtSize(formattedTotalPrice, 22)
  page.drawText(formattedTotalPrice, {
    x: 140 - totalPriceWidth,
    y: priceY - 5,
    size: 22,
    font: boldFont
  })

  // ========== Divider line ==========
  const dividerY = height - 45
  page.drawLine({
    start: { x: margin, y: dividerY },
    end: { x: width - margin, y: dividerY },
    thickness: 1,
    color: rgb(0.2, 0.2, 0.2)
  })

  // ========== Product Name (left, large, bold) ==========
  const productName = truncateText(data.productName.toUpperCase(), 16)
  page.drawText(productName, {
    x: margin,
    y: dividerY - 16,
    size: 14,
    font: boldFont
  })

  // ========== Weight (left) ==========
  page.drawText(data.weight, {
    x: margin,
    y: dividerY - 34,
    size: 12,
    font: boldFont
  })

  // ========== QR Code (right side) ==========
  const qrContent = data.productSku || data.barcode
  try {
    const qrBuffer = await bwipjs.toBuffer({
      bcid: 'qrcode',
      text: qrContent,
      scale: 2,
      height: 20,
      width: 20
    })

    const qrImage = await pdfDoc.embedPng(qrBuffer)
    const qrSize = 45
    page.drawImage(qrImage, {
      x: width - margin - qrSize,
      y: dividerY - qrSize - 5,
      width: qrSize,
      height: qrSize
    })
  } catch (error) {
    console.error('[Weight Label PDF] QR generation failed:', error)
  }

  // ========== Barcode at bottom ==========
  const barcodeY = margin + 5
  try {
    const barcodeBuffer = await bwipjs.toBuffer({
      bcid: 'ean13',
      text: data.barcode,
      scale: 2,
      height: 12,
      includetext: true,
      textxalign: 'center',
      textsize: 8
    })

    const barcodeImage = await pdfDoc.embedPng(barcodeBuffer)
    const barcodeAspect = barcodeImage.width / barcodeImage.height
    const maxBarcodeWidth = width - margin * 2 - 50 // Leave space for QR
    let barcodeWidth = maxBarcodeWidth
    let barcodeHeight = barcodeWidth / barcodeAspect

    if (barcodeHeight > 35) {
      barcodeHeight = 35
      barcodeWidth = barcodeHeight * barcodeAspect
    }

    const barcodeX = (width - 50 - barcodeWidth) / 2
    page.drawImage(barcodeImage, {
      x: barcodeX,
      y: barcodeY,
      width: barcodeWidth,
      height: barcodeHeight
    })
  } catch (error) {
    console.error('[Weight Label PDF] Barcode generation failed:', error)
    // Fallback: print barcode text
    page.drawText(data.barcode, {
      x: margin,
      y: barcodeY + 10,
      size: 10,
      font: boldFont
    })
  }

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

/**
 * Generate 2x1 inch weight label PDF (compact)
 */
async function generateWeightLabel2x1Pdf(data: WeightLabelPdfData): Promise<Buffer> {
  const { width, height } = SIZES['2x1']
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([width, height])

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const margin = 3

  // Format price with $ symbol
  const formattedTotalPrice = '$' + Math.round(data.priceCUP).toLocaleString('es-ES')

  // ========== ROW 1: Product Name (left) + Price (right) ==========
  const productName = truncateText(data.productName.toUpperCase(), 14)
  page.drawText(productName, {
    x: margin,
    y: height - margin - 10,
    size: 9,
    font: boldFont
  })

  // Price (right aligned) with $ symbol
  const priceWidth = boldFont.widthOfTextAtSize(formattedTotalPrice, 12)
  page.drawText(formattedTotalPrice, {
    x: width - margin - priceWidth,
    y: height - margin - 12,
    size: 12,
    font: boldFont
  })

  // ========== ROW 2: Weight ==========
  page.drawText(data.weight, {
    x: margin,
    y: height - margin - 24,
    size: 8,
    font: font
  })

  // ========== Divider line ==========
  const dividerY = height - 30
  page.drawLine({
    start: { x: margin, y: dividerY },
    end: { x: width - margin, y: dividerY },
    thickness: 0.5,
    color: rgb(0.3, 0.3, 0.3)
  })

  // ========== Barcode ==========
  const barcodeY = margin + 2
  try {
    const barcodeBuffer = await bwipjs.toBuffer({
      bcid: 'ean13',
      text: data.barcode,
      scale: 2,
      height: 8,
      includetext: true,
      textxalign: 'center',
      textsize: 6
    })

    const barcodeImage = await pdfDoc.embedPng(barcodeBuffer)
    const barcodeAspect = barcodeImage.width / barcodeImage.height
    const maxBarcodeWidth = width - margin * 2
    let barcodeWidth = maxBarcodeWidth
    let barcodeHeight = barcodeWidth / barcodeAspect

    if (barcodeHeight > 28) {
      barcodeHeight = 28
      barcodeWidth = barcodeHeight * barcodeAspect
    }

    const barcodeX = (width - barcodeWidth) / 2
    page.drawImage(barcodeImage, {
      x: barcodeX,
      y: barcodeY,
      width: barcodeWidth,
      height: barcodeHeight
    })
  } catch (error) {
    console.error('[Weight Label PDF] Barcode generation failed:', error)
    page.drawText(data.barcode, {
      x: margin,
      y: barcodeY + 5,
      size: 8,
      font: boldFont
    })
  }

  // Date (bottom right, tiny)
  const dateText = data.printDate || new Date().toLocaleDateString('es-ES')
  const dateWidth = font.widthOfTextAtSize(dateText, 5)
  page.drawText(dateText, {
    x: width - margin - dateWidth,
    y: margin,
    size: 5,
    font: font,
    color: rgb(0.5, 0.5, 0.5)
  })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 2) + '..'
}
