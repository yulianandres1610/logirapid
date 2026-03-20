/**
 * Product Label Generator - TSPL format for TSC/4BARCODE/Chinese label printers
 * TSPL (TSC Printer Language) is widely supported by non-Zebra label printers
 */

interface ProductLabelItem {
  productName: string
  sku?: string
  barcode: string
  barcodeType?: 'code128' | 'ean13' | 'upc' | 'qrcode'
  price?: number
  priceCUP?: number
  currency?: string
  copies?: number
}

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
  // Support for bulk printing
  items?: ProductLabelItem[]
}

/**
 * Generate TSPL for a single label (returns commands without PRINT)
 */
function generateSingleLabelTspl(
  item: ProductLabelItem,
  includePrice: boolean,
  labelWidthDots: number
): string[] {
  const tspl: string[] = []
  tspl.push('CLS') // Clear buffer

  const shouldIncludePrice = includePrice && (item.priceCUP !== undefined || item.price !== undefined)

  if (!shouldIncludePrice) {
    const maxNameLength = 28
    const productName = item.productName.length > maxNameLength
      ? item.productName.substring(0, maxNameLength - 2) + '..'
      : item.productName

    const nameWidth = productName.length * 16
    const nameX = Math.max(10, Math.round((labelWidthDots - nameWidth) / 2))
    tspl.push(`TEXT ${nameX},5,"3",0,1,1,"${escapeTspl(productName)}"`)

    const barcodeY = 50
    const barcodeHeight = 100
    const barcodeType = getTsplBarcodeType(item.barcode, item.barcodeType)
    const barcodeX = Math.round((labelWidthDots - 300) / 2)
    tspl.push(`BARCODE ${barcodeX},${barcodeY},"${barcodeType}",${barcodeHeight},1,0,2,4,"${item.barcode}"`)
  } else {
    const maxNameLength = 24
    const productName = item.productName.length > maxNameLength
      ? item.productName.substring(0, maxNameLength - 2) + '..'
      : item.productName

    tspl.push(`TEXT 10,8,"2",0,1,1,"${escapeTspl(productName)}"`)

    const barcodeY = 50
    const barcodeHeight = 75
    const barcodeType = getTsplBarcodeType(item.barcode, item.barcodeType)
    tspl.push(`BARCODE 25,${barcodeY},"${barcodeType}",${barcodeHeight},1,0,2,3,"${item.barcode}"`)

    const priceValue = item.priceCUP !== undefined ? item.priceCUP : item.price!
    const isCUP = item.priceCUP !== undefined
    const formattedPrice = isCUP ? Math.round(priceValue).toLocaleString() : priceValue.toFixed(2)

    if (isCUP) {
      const priceX = 260
      const priceY = barcodeY + 10
      tspl.push(`TEXT ${priceX},${priceY},"4",0,1,1,"${formattedPrice}"`)
      tspl.push(`TEXT ${priceX + 10},${priceY + 35},"2",0,1,1,"CUP"`)
    } else {
      const symbolMap: Record<string, string> = {
        'USD': '$', 'usd': '$', 'EUR': '\u20ac', 'eur': '\u20ac',
        'GBP': '\u00a3', 'gbp': '\u00a3', 'MXN': '$', 'mxn': '$',
        'COP': '$', 'cop': '$', '$': '$', '\u20ac': '\u20ac', '\u00a3': '\u00a3'
      }
      const currencySymbol = (item.currency && symbolMap[item.currency]) || '$'
      const priceText = `${currencySymbol}${formattedPrice}`
      tspl.push(`TEXT 265,${barcodeY + 20},"4",0,1,1,"${priceText}"`)
    }
  }

  return tspl
}

/**
 * Generate TSPL code for a product label
 * Default size: 2" wide x 1" tall (51mm x 25mm)
 *
 * TSPL coordinate system: 8 dots per mm (203 DPI)
 * For 51mm x 25mm label: 408 x 200 dots
 *
 * Supports bulk printing: if data.items is provided, generates all labels in one job
 */
export function generateProductLabelTspl(data: ProductLabelData): Buffer {
  const labelWidthMm = data.labelWidth || 51
  const labelHeightMm = data.labelHeight || 25
  const labelWidthDots = Math.round(labelWidthMm * 8)
  const gapMm = 3
  const includePrice = data.includePrice !== false

  const tspl: string[] = []

  // Setup commands (only once at the beginning)
  tspl.push(`SIZE ${labelWidthMm} mm, ${labelHeightMm} mm`)
  tspl.push(`GAP ${gapMm} mm, 0 mm`)
  tspl.push('DIRECTION 1')
  tspl.push('DENSITY 8')

  // Check if bulk mode
  if (data.items && data.items.length > 0) {
    for (const item of data.items) {
      const copies = item.copies || 1
      const labelCommands = generateSingleLabelTspl(item, includePrice, labelWidthDots)

      // Add CLS and label content, then PRINT with copies
      tspl.push(...labelCommands)
      tspl.push(`PRINT 1,${copies}`)
    }
  } else {
    // Single label mode
    const singleItem: ProductLabelItem = {
      productName: data.productName,
      sku: data.sku,
      barcode: data.barcode,
      barcodeType: data.barcodeType,
      price: data.price,
      priceCUP: data.priceCUP,
      currency: data.currency
    }

    const labelCommands = generateSingleLabelTspl(singleItem, includePrice, labelWidthDots)
    tspl.push(...labelCommands)
    tspl.push('PRINT 1,1')
  }

  const tsplContent = tspl.join('\r\n') + '\r\n'
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
