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

  // Truncate product name for label
  const maxNameLength = 20
  const productName = data.productName.length > maxNameLength
    ? data.productName.substring(0, maxNameLength - 2) + '..'
    : data.productName

  // Layout for 2x1 inch label (51mm x 25mm = 408 x 200 dots)
  // ┌─────────────────────────────────────┐
  // │ Nombre del Producto                 │  <- Row 1: Product name
  // │  |||||||||||| $15.99                │  <- Row 2: Barcode + Price (close)
  // │  7501234567890                      │  <- Row 3: Barcode number
  // └─────────────────────────────────────┘

  const barcodeX = 30 // More margin from left edge

  // Row 1: Product name (full width at top)
  tspl.push(`TEXT 10,8,"2",0,1,1,"${escapeTspl(productName)}"`)

  // Row 2: Barcode - better positioned away from edge
  const barcodeY = 50 // Start below the text row
  const barcodeHeight = 75 // Height of barcode bars
  const barcodeType = getTsplBarcodeType(data.barcode, data.barcodeType)

  // Barcode with better positioning - more to the right
  // BARCODE X,Y,"type",height,human_readable,rotation,narrow,wide,"content"
  tspl.push(`BARCODE ${barcodeX},${barcodeY},"${barcodeType}",${barcodeHeight},1,0,2,3,"${data.barcode}"`)

  // Price - bigger and closer to barcode (only if includePrice is not false)
  const shouldIncludePrice = data.includePrice !== false && (data.priceCUP !== undefined || data.price !== undefined)
  if (shouldIncludePrice) {
    // Use priceCUP if available, otherwise use price
    const priceValue = data.priceCUP !== undefined ? data.priceCUP : data.price!
    const isCUP = data.priceCUP !== undefined

    // Format price: CUP uses integer format, others use 2 decimals
    const formattedPrice = isCUP ? Math.round(priceValue).toLocaleString() : priceValue.toFixed(2)
    const currencyLabel = isCUP ? ' CUP' : ''

    // Convert currency code to symbol (only for non-CUP)
    let currencySymbol = '$'
    if (!isCUP && data.currency) {
      const symbolMap: Record<string, string> = {
        'USD': '$', 'usd': '$',
        'EUR': '€', 'eur': '€',
        'GBP': '£', 'gbp': '£',
        'MXN': '$', 'mxn': '$',
        'COP': '$', 'cop': '$',
        '$': '$', '€': '€', '£': '£'
      }
      currencySymbol = symbolMap[data.currency] || '$'
    }

    const priceText = `${currencySymbol}${formattedPrice}${currencyLabel}`
    // Position price closer to barcode (adjust for CUP which is longer)
    const priceX = isCUP ? 220 : 255
    const priceY = barcodeY + 20 // Vertically centered with barcode
    // TEXT x,y,"font",rotation,x-mult,y-mult,"content"
    // Font "4" is bigger, multiplier 1,1 for clean look
    tspl.push(`TEXT ${priceX},${priceY},"4",0,1,1,"${priceText}"`)
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
