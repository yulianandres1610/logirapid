/**
 * Product Label Generator - TSPL format for TSC/4BARCODE/Chinese label printers
 * TSPL (TSC Printer Language) is widely supported by non-Zebra label printers
 */

interface ProductLabelData {
  productName: string
  sku: string
  barcode: string
  barcodeType?: 'code128' | 'ean13' | 'upc' | 'qrcode'
  price?: number
  priceCUP?: number // Price already converted to CUP
  currency?: string
  includePrice?: boolean // Set to false to exclude price from label
  description?: string
  category?: string
  expirationDate?: string
  lotNumber?: string
  weight?: string
  labelWidth?: number // in mm
  labelHeight?: number // in mm
  companyName?: string
}

/**
 * Generate TSPL code for a product label
 * Default size: 2" wide x 1" tall (51mm x 25mm)
 *
 * TSPL coordinate system: 8 dots per mm (203 DPI)
 * For 51mm x 25mm label: 408 x 200 dots
 */
export function generateProductLabelTspl(data: ProductLabelData): Buffer {
  // Default label size: 2" x 1" (51mm x 25mm)
  const labelWidthMm = data.labelWidth || 51
  const labelHeightMm = data.labelHeight || 25

  // Convert to dots (8 dots per mm at 203 DPI)
  const labelWidthDots = Math.round(labelWidthMm * 8)
  const labelHeightDots = Math.round(labelHeightMm * 8)

  // Gap between labels (typically 2-3mm)
  const gapMm = 3

  const tspl: string[] = []

  // Setup commands
  tspl.push(`SIZE ${labelWidthMm} mm, ${labelHeightMm} mm`)
  tspl.push(`GAP ${gapMm} mm, 0 mm`)
  tspl.push('DIRECTION 1')
  tspl.push('DENSITY 8') // Print darkness (0-15)
  tspl.push('CLS') // Clear buffer

  // Check if we should include price
  const shouldIncludePrice = data.includePrice !== false && (data.priceCUP !== undefined || data.price !== undefined)

  if (!shouldIncludePrice) {
    // === LABEL WITHOUT PRICE ===
    // Centered name at top, barcode centered and full width

    const maxNameLength = 28
    const productName = data.productName.length > maxNameLength
      ? data.productName.substring(0, maxNameLength - 2) + '..'
      : data.productName

    // Row 1: Product name (bigger font "3", centered)
    const nameWidth = productName.length * 16 // Approx width per char with font 3
    const nameX = Math.max(10, Math.round((labelWidthDots - nameWidth) / 2))
    tspl.push(`TEXT ${nameX},5,"3",0,1,1,"${escapeTspl(productName)}"`)

    // Barcode - centered, full width
    const barcodeY = 50
    const barcodeHeight = 100 // Taller barcode
    const barcodeType = getTsplBarcodeType(data.barcode, data.barcodeType)

    // Center barcode
    const barcodeX = Math.round((labelWidthDots - 300) / 2) // Approx barcode width 300 dots
    // BARCODE X,Y,"type",height,human_readable,rotation,narrow,wide,"content"
    tspl.push(`BARCODE ${barcodeX},${barcodeY},"${barcodeType}",${barcodeHeight},1,0,2,4,"${data.barcode}"`)

  } else {
    // === LABEL WITH PRICE ===
    const maxNameLength = 24 // Allow more chars for name
    const productName = data.productName.length > maxNameLength
      ? data.productName.substring(0, maxNameLength - 2) + '..'
      : data.productName

    // Row 1: Product name (full width at top)
    tspl.push(`TEXT 10,8,"2",0,1,1,"${escapeTspl(productName)}"`)

    // Row 2: Barcode - centered
    const barcodeY = 50
    const barcodeHeight = 75
    const barcodeType = getTsplBarcodeType(data.barcode, data.barcodeType)
    const barcodeX = 25 // Slightly more margin from edge

    tspl.push(`BARCODE ${barcodeX},${barcodeY},"${barcodeType}",${barcodeHeight},1,0,2,3,"${data.barcode}"`)

    // Price - format with price on top, CUP below
    const priceValue = data.priceCUP !== undefined ? data.priceCUP : data.price!
    const isCUP = data.priceCUP !== undefined
    const formattedPrice = isCUP ? Math.round(priceValue).toLocaleString() : priceValue.toFixed(2)

    if (isCUP) {
      // Precio arriba, CUP abajo
      const priceX = 260
      const priceY = barcodeY + 10
      tspl.push(`TEXT ${priceX},${priceY},"4",0,1,1,"${formattedPrice}"`)
      tspl.push(`TEXT ${priceX + 10},${priceY + 35},"2",0,1,1,"CUP"`)
    } else {
      const symbolMap: Record<string, string> = {
        'USD': '$', 'usd': '$', 'EUR': '€', 'eur': '€',
        'GBP': '£', 'gbp': '£', 'MXN': '$', 'mxn': '$',
        'COP': '$', 'cop': '$', '$': '$', '€': '€', '£': '£'
      }
      const currencySymbol = (data.currency && symbolMap[data.currency]) || '$'
      const priceText = `${currencySymbol}${formattedPrice}`
      const priceX = 265
      const priceY = barcodeY + 20
      tspl.push(`TEXT ${priceX},${priceY},"4",0,1,1,"${priceText}"`)
    }
  }

  // Print command
  tspl.push('PRINT 1,1') // Print 1 copy

  const tsplContent = tspl.join('\r\n') + '\r\n'
  console.log('[TSPL Generator] Generated TSPL label')
  console.log('[TSPL Generator] Size:', labelWidthMm, 'x', labelHeightMm, 'mm')
  console.log('[TSPL Generator] Content:\n' + tsplContent)

  return Buffer.from(tsplContent, 'ascii')
}

/**
 * Get TSPL barcode type code
 */
function getTsplBarcodeType(barcode: string, type?: string): string {
  const barcodeType = type || detectBarcodeType(barcode)

  switch (barcodeType) {
    case 'ean13':
      return 'EAN13'
    case 'ean8':
      return 'EAN8'
    case 'upca':
      return 'UPCA'
    case 'qrcode':
      return 'QRCODE'
    case 'code128':
    default:
      return '128'
  }
}

/**
 * Detect barcode type from content
 */
function detectBarcodeType(barcode: string): string {
  if (/^\d{13}$/.test(barcode)) return 'ean13'
  if (/^\d{12}$/.test(barcode)) return 'upca'
  if (/^\d{8}$/.test(barcode)) return 'ean8'
  return 'code128'
}

/**
 * Escape special characters for TSPL
 */
function escapeTspl(text: string): string {
  return text
    .replace(/"/g, '\\"')
    .replace(/[\x00-\x1F]/g, '') // Remove control characters
}

export type { ProductLabelData }
