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
  priceUSD?: number
  currency?: string
  description?: string
  copies?: number
}

interface ProductLabelData {
  productName: string
  sku: string
  barcode: string
  barcodeType?: 'code128' | 'ean13' | 'upc' | 'qrcode'
  price?: number
  priceCUP?: number // Price already converted to CUP
  priceUSD?: number // Price in USD
  currency?: string
  includePrice?: boolean // Set to false to exclude price from label
  description?: string
  category?: string
  expirationDate?: string
  lotNumber?: string
  weight?: string
  labelWidth?: number // in mm
  labelHeight?: number // in mm
  labelSize?: '2x1' | '3x2' | '4x6' // Predefined label sizes
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
 * Generate TSPL for a 3x2" (76x51mm, 608x408 dots @203dpi) product label
 */
function generateSingleLabel3x2Tspl(
  item: ProductLabelItem,
  includePrice: boolean,
  labelWidthDots: number
): string[] {
  const tspl: string[] = []
  tspl.push('CLS')

  const maxNameLength = 30
  const productName = item.productName.length > maxNameLength
    ? item.productName.substring(0, maxNameLength - 2) + '..'
    : item.productName

  let y = 16

  // Product Name (larger font - font "4")
  tspl.push(`TEXT 16,${y},"4",0,1,1,"${escapeTspl(productName)}"`)
  y += 48

  // SKU line
  if (item.sku) {
    tspl.push(`TEXT 16,${y},"2",0,1,1,"SKU: ${escapeTspl(item.sku)}"`)
    y += 32
  }

  // Barcode (centered, taller)
  const barcodeHeight = 120
  const barcodeType = getTsplBarcodeType(item.barcode, item.barcodeType)
  const barcodeX = Math.round((labelWidthDots - 350) / 2)
  tspl.push(`BARCODE ${barcodeX},${y + 8},"${barcodeType}",${barcodeHeight},1,0,2,4,"${item.barcode}"`)

  // Price (bottom-right corner, large font) - only if includePrice
  const shouldShowPrice = includePrice && (item.priceCUP !== undefined || item.price !== undefined || item.priceUSD !== undefined)
  if (shouldShowPrice) {
    const priceValue = item.priceCUP !== undefined ? item.priceCUP : item.price
    const isCUP = item.priceCUP !== undefined

    if (priceValue !== undefined) {
      const formattedPrice = isCUP ? Math.round(priceValue).toLocaleString() : priceValue.toFixed(2)
      const currencyLabel = isCUP ? 'CUP' : (item.currency || 'USD')
      const priceText = isCUP ? formattedPrice : `$${formattedPrice}`
      const priceY = 408 - 60
      tspl.push(`TEXT ${labelWidthDots - 180},${priceY},"4",0,1,1,"${priceText}"`)
      tspl.push(`TEXT ${labelWidthDots - 80},${priceY + 36},"2",0,1,1,"${currencyLabel}"`)
    }
  }

  return tspl
}

/**
 * Generate TSPL for a 4x6" (102x152mm, 812x1216 dots @203dpi) full product label
 */
function generateSingleLabel4x6Tspl(
  item: ProductLabelItem,
  includePrice: boolean,
  labelWidthDots: number
): string[] {
  const labelHeightDots = 1216
  const tspl: string[] = []
  tspl.push('CLS')

  const margin = 24

  const maxNameLength = 36
  const productName = item.productName.length > maxNameLength
    ? item.productName.substring(0, maxNameLength - 2) + '..'
    : item.productName

  let y = margin

  // Product Name (very large - font "5")
  tspl.push(`TEXT ${margin},${y},"5",0,1,1,"${escapeTspl(productName)}"`)
  y += 64

  // Description (up to 2 lines, if available)
  if (item.description) {
    const maxDescLine = 48
    const desc = item.description
    if (desc.length <= maxDescLine) {
      tspl.push(`TEXT ${margin},${y},"3",0,1,1,"${escapeTspl(desc)}"`)
      y += 34
    } else {
      let splitIdx = desc.lastIndexOf(' ', maxDescLine)
      if (splitIdx <= 0) splitIdx = maxDescLine
      const line1 = desc.substring(0, splitIdx)
      let line2 = desc.substring(splitIdx).trim()
      if (line2.length > maxDescLine) {
        line2 = line2.substring(0, maxDescLine - 2) + '..'
      }
      tspl.push(`TEXT ${margin},${y},"3",0,1,1,"${escapeTspl(line1)}"`)
      y += 32
      tspl.push(`TEXT ${margin},${y},"3",0,1,1,"${escapeTspl(line2)}"`)
      y += 34
    }
  }

  // SKU line
  if (item.sku) {
    tspl.push(`TEXT ${margin},${y},"3",0,1,1,"SKU: ${escapeTspl(item.sku)}"`)
    y += 38
  }

  // Separator line (horizontal rule)
  y += 10
  tspl.push(`BAR ${margin},${y},${labelWidthDots - margin * 2},2`)
  y += 20

  // Prices section
  const shouldShowPrice = includePrice && (item.priceCUP !== undefined || item.price !== undefined || item.priceUSD !== undefined)
  if (shouldShowPrice) {
    // Price CUP (large, bold)
    if (item.priceCUP !== undefined) {
      const formattedCUP = Math.round(item.priceCUP).toLocaleString()
      tspl.push(`TEXT ${margin},${y},"5",0,1,1,"${formattedCUP} CUP"`)
      y += 56
    } else if (item.price !== undefined && item.priceCUP === undefined && item.priceUSD === undefined) {
      const currencySymbol = item.currency || '$'
      const formattedPrice = item.price.toFixed(2)
      tspl.push(`TEXT ${margin},${y},"5",0,1,1,"${currencySymbol}${formattedPrice}"`)
      y += 56
    }

    // Price USD (smaller)
    if (item.priceUSD !== undefined) {
      const formattedUSD = item.priceUSD.toFixed(2)
      tspl.push(`TEXT ${margin},${y},"3",0,1,1,"$${formattedUSD} USD"`)
      y += 42
    }
  }

  // Barcode (bottom, centered, tall)
  const barcodeHeight = 160
  const barcodeType = getTsplBarcodeType(item.barcode, item.barcodeType)
  const barcodeX = Math.round((labelWidthDots - 400) / 2)
  const barcodeY = labelHeightDots - barcodeHeight - 80
  tspl.push(`BARCODE ${barcodeX},${barcodeY},"${barcodeType}",${barcodeHeight},1,0,3,4,"${item.barcode}"`)

  return tspl
}

/**
 * Generate TSPL code for a product label
 * Default size: 2" wide x 1" tall (51mm x 25mm)
 *
 * TSPL coordinate system: 8 dots per mm (203 DPI)
 * For 51mm x 25mm label: 408 x 200 dots
 *
 * Supports label sizes: '2x1' (default), '3x2', '4x6'
 * Supports bulk printing: if data.items is provided, generates all labels in one job
 */
export function generateProductLabelTspl(data: ProductLabelData): Buffer {
  const labelSize = data.labelSize || '2x1'
  const includePrice = data.includePrice !== false

  // Resolve dimensions based on labelSize
  let labelWidthMm: number
  let labelHeightMm: number
  switch (labelSize) {
    case '3x2':
      labelWidthMm = 76
      labelHeightMm = 51
      break
    case '4x6':
      labelWidthMm = 102
      labelHeightMm = 152
      break
    case '2x1':
    default:
      labelWidthMm = data.labelWidth || 51
      labelHeightMm = data.labelHeight || 25
      break
  }

  const labelWidthDots = Math.round(labelWidthMm * 8)
  const gapMm = 3

  const tspl: string[] = []

  // Setup commands (only once at the beginning)
  tspl.push(`SIZE ${labelWidthMm} mm, ${labelHeightMm} mm`)
  tspl.push(`GAP ${gapMm} mm, 0 mm`)
  tspl.push('DIRECTION 1')
  tspl.push('DENSITY 8')

  // Dispatcher: select the right generator based on label size
  function generateLabel(item: ProductLabelItem): string[] {
    switch (labelSize) {
      case '3x2':
        return generateSingleLabel3x2Tspl(item, includePrice, labelWidthDots)
      case '4x6':
        return generateSingleLabel4x6Tspl(item, includePrice, labelWidthDots)
      case '2x1':
      default:
        return generateSingleLabelTspl(item, includePrice, labelWidthDots)
    }
  }

  // Check if bulk mode
  if (data.items && data.items.length > 0) {
    for (const item of data.items) {
      const copies = item.copies || 1
      const labelCommands = generateLabel(item)

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
      priceUSD: data.priceUSD,
      currency: data.currency,
      description: data.description
    }

    const labelCommands = generateLabel(singleItem)
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
