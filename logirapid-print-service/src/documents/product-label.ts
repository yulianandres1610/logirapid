/**
 * Product Label Generator - Generates barcode labels for products
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import bwipjs from 'bwip-js'

interface ProductLabelData {
  // Product info
  productName: string
  sku: string
  barcode: string
  barcodeType?: 'code128' | 'ean13' | 'upc' | 'qrcode'

  // Optional fields
  price?: number
  priceCUP?: number // Price already converted to CUP
  currency?: string
  includePrice?: boolean // Set to false to exclude price from label
  description?: string
  category?: string
  expirationDate?: string
  lotNumber?: string
  weight?: string

  // Label size
  labelWidth?: number // in mm
  labelHeight?: number // in mm

  // Company
  companyName?: string
}

// Common label sizes in points (72 points = 1 inch)
// Default: 2" wide x 1" tall (standard price label)
const LABEL_SIZES = {
  small: { width: 144, height: 72 }, // 2x1 inch (DEFAULT - standard price label)
  medium: { width: 180, height: 108 }, // 2.5x1.5 inch
  large: { width: 216, height: 144 }, // 3x2 inch
  barcode: { width: 180, height: 72 } // 2.5x1 inch
}

export async function generateProductLabel(
  data: ProductLabelData,
  size: 'small' | 'medium' | 'large' | 'barcode' = 'small' // Default to 2x1 inch
): Promise<Buffer> {
  const labelSize = LABEL_SIZES[size]

  // If custom size is provided, convert from mm to points
  const width = data.labelWidth ? (data.labelWidth / 25.4) * 72 : labelSize.width
  const height = data.labelHeight ? (data.labelHeight / 25.4) * 72 : labelSize.height

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([width, height])

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const margin = 3
  const isCompact = height <= 72 // 1 inch or less

  if (isCompact) {
    // Compact layout for 2x1 inch labels
    // Layout: [Product Name] [Price] on top row, barcode below

    // Product name (top left, truncated)
    const maxNameWidth = width * 0.65
    const nameSize = 8
    const truncatedName = truncateText(data.productName, 18)
    page.drawText(truncatedName, {
      x: margin,
      y: height - margin - nameSize,
      size: nameSize,
      font: boldFont
    })

    // Price (top right, large and bold) - only if includePrice is not false
    const shouldIncludePrice = data.includePrice !== false && (data.priceCUP !== undefined || data.price !== undefined)
    if (shouldIncludePrice) {
      // Use priceCUP if available, otherwise use price
      const priceValue = data.priceCUP !== undefined ? data.priceCUP : data.price!
      const isCUP = data.priceCUP !== undefined

      // Format price: CUP uses integer format, others use 2 decimals
      const formattedPrice = isCUP ? Math.round(priceValue).toLocaleString() : priceValue.toFixed(2)
      const currencyLabel = isCUP ? ' CUP' : ''

      // Convert currency code to symbol (only for non-CUP prices)
      let currencySymbol = '$'
      if (!isCUP && data.currency) {
        const symbolMap: Record<string, string> = {
          'USD': '$', 'usd': '$', 'EUR': '€', 'eur': '€',
          'GBP': '£', 'gbp': '£', 'MXN': '$', 'mxn': '$',
          'COP': '$', 'cop': '$', '$': '$', '€': '€', '£': '£'
        }
        currencySymbol = symbolMap[data.currency] || '$'
      }

      const priceText = `${currencySymbol}${formattedPrice}${currencyLabel}`
      const priceSize = 10
      const priceWidth = boldFont.widthOfTextAtSize(priceText, priceSize)
      page.drawText(priceText, {
        x: width - margin - priceWidth,
        y: height - margin - priceSize,
        size: priceSize,
        font: boldFont
      })
    }

    // Barcode (bottom, centered)
    const barcodeY = margin + 2
    const barcodeMaxHeight = height - 22 // Leave space for name/price row

    try {
      const barcodeType = data.barcodeType || detectBarcodeType(data.barcode)
      const isQR = barcodeType === 'qrcode'

      const barcodeBuffer = await bwipjs.toBuffer({
        bcid: barcodeType,
        text: data.barcode,
        scale: 2,
        height: isQR ? 15 : 8,
        includetext: !isQR,
        textxalign: 'center',
        textsize: 6
      })

      const barcodeImage = await pdfDoc.embedPng(barcodeBuffer)
      const barcodeAspect = barcodeImage.width / barcodeImage.height
      let barcodeWidth = width - margin * 2
      let finalBarcodeHeight = barcodeWidth / barcodeAspect

      if (finalBarcodeHeight > barcodeMaxHeight) {
        finalBarcodeHeight = barcodeMaxHeight
        barcodeWidth = finalBarcodeHeight * barcodeAspect
      }

      const barcodeX = (width - barcodeWidth) / 2
      page.drawImage(barcodeImage, {
        x: barcodeX,
        y: barcodeY,
        width: barcodeWidth,
        height: finalBarcodeHeight
      })
    } catch (error) {
      console.error('Barcode generation failed:', error)
      page.drawText(data.barcode, {
        x: margin,
        y: barcodeY + 5,
        size: 7,
        font
      })
    }
  } else {
    // Standard layout for larger labels
    let y = height - margin

    // Product name (top)
    const productNameSize = Math.min(10, (width - margin * 2) / (data.productName.length * 0.6))
    page.drawText(truncateText(data.productName, Math.floor((width - margin * 2) / 5)), {
      x: margin,
      y: y - productNameSize,
      size: productNameSize,
      font: boldFont,
      maxWidth: width - margin * 2
    })
    y -= productNameSize + 4

    // SKU
    if (data.sku) {
      page.drawText(`SKU: ${data.sku}`, {
        x: margin,
        y: y - 7,
        size: 7,
        font,
        color: rgb(0.3, 0.3, 0.3)
      })
      y -= 10
    }

    // Price (if provided and includePrice is not false)
    const shouldShowPrice = data.includePrice !== false && (data.priceCUP !== undefined || data.price !== undefined)
    if (shouldShowPrice) {
      // Use priceCUP if available, otherwise use price
      const priceValue = data.priceCUP !== undefined ? data.priceCUP : data.price!
      const isCUP = data.priceCUP !== undefined

      // Format price: CUP uses integer format, others use 2 decimals
      const formattedPrice = isCUP ? Math.round(priceValue).toLocaleString() : priceValue.toFixed(2)
      const currencyLabel = isCUP ? ' CUP' : ''
      const currencySymbol = isCUP ? '$' : (data.currency || '$')

      const priceText = `${currencySymbol}${formattedPrice}${currencyLabel}`
      page.drawText(priceText, {
        x: margin,
        y: y - 12,
        size: 12,
        font: boldFont
      })
      y -= 16
    }

    // Calculate space for barcode
    const barcodeHeight = Math.min(height * 0.35, 40)
    const barcodeY = margin + 10

    // Generate barcode
    try {
      const barcodeType = data.barcodeType || detectBarcodeType(data.barcode)
      const isQR = barcodeType === 'qrcode'

      const barcodeBuffer = await bwipjs.toBuffer({
        bcid: barcodeType,
        text: data.barcode,
        scale: 2,
        height: isQR ? 20 : 10,
        includetext: !isQR,
        textxalign: 'center',
        textsize: 8
      })

      const barcodeImage = await pdfDoc.embedPng(barcodeBuffer)

      const barcodeAspect = barcodeImage.width / barcodeImage.height
      let barcodeWidth = width - margin * 2
      let finalBarcodeHeight = barcodeWidth / barcodeAspect

      if (finalBarcodeHeight > barcodeHeight) {
        finalBarcodeHeight = barcodeHeight
        barcodeWidth = finalBarcodeHeight * barcodeAspect
      }

      const barcodeX = (width - barcodeWidth) / 2

      page.drawImage(barcodeImage, {
        x: barcodeX,
        y: barcodeY,
        width: barcodeWidth,
        height: finalBarcodeHeight
      })
    } catch (error) {
      console.error('Barcode generation failed:', error)
      page.drawText(data.barcode, {
        x: margin,
        y: barcodeY + 10,
        size: 10,
        font: boldFont
      })
    }
  }

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

function detectBarcodeType(barcode: string): string {
  // EAN-13
  if (/^\d{13}$/.test(barcode)) return 'ean13'

  // UPC-A
  if (/^\d{12}$/.test(barcode)) return 'upca'

  // EAN-8
  if (/^\d{8}$/.test(barcode)) return 'ean8'

  // Default to Code128 (alphanumeric)
  return 'code128'
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Generate multiple labels on a single page (for sheet printing)
 */
export async function generateProductLabelSheet(
  items: ProductLabelData[],
  columns: number = 3,
  rows: number = 10,
  pageSize: { width: number; height: number } = { width: 612, height: 792 } // Letter size
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()

  const labelWidth = (pageSize.width - 20) / columns
  const labelHeight = (pageSize.height - 20) / rows
  const margin = 10

  let itemIndex = 0
  const totalLabels = items.length

  while (itemIndex < totalLabels) {
    const page = pdfDoc.addPage([pageSize.width, pageSize.height])
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    for (let row = 0; row < rows && itemIndex < totalLabels; row++) {
      for (let col = 0; col < columns && itemIndex < totalLabels; col++) {
        const item = items[itemIndex]
        const x = margin + col * labelWidth
        const y = pageSize.height - margin - (row + 1) * labelHeight

        // Draw label border (optional, for cutting guide)
        page.drawRectangle({
          x,
          y,
          width: labelWidth - 2,
          height: labelHeight - 2,
          borderColor: rgb(0.8, 0.8, 0.8),
          borderWidth: 0.5
        })

        // Product name
        page.drawText(truncateText(item.productName, 20), {
          x: x + 4,
          y: y + labelHeight - 14,
          size: 8,
          font: boldFont
        })

        // SKU
        page.drawText(item.sku, {
          x: x + 4,
          y: y + labelHeight - 24,
          size: 6,
          font,
          color: rgb(0.4, 0.4, 0.4)
        })

        // Price (if includePrice is not false)
        const shouldShowItemPrice = item.includePrice !== false && (item.priceCUP !== undefined || item.price !== undefined)
        if (shouldShowItemPrice) {
          const priceValue = item.priceCUP !== undefined ? item.priceCUP : item.price!
          const isCUP = item.priceCUP !== undefined
          const formattedPrice = isCUP ? Math.round(priceValue).toLocaleString() : priceValue.toFixed(2)
          const priceText = isCUP ? `$${formattedPrice} CUP` : `$${formattedPrice}`
          page.drawText(priceText, {
            x: x + labelWidth - (isCUP ? 50 : 30),
            y: y + labelHeight - 14,
            size: 8,
            font: boldFont
          })
        }

        // Barcode text (simplified - full barcode would need embedded image)
        page.drawText(item.barcode, {
          x: x + 4,
          y: y + 6,
          size: 7,
          font
        })

        itemIndex++
      }
    }
  }

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

export type { ProductLabelData }
