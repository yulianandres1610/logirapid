/**
 * Product Label Generator - ZPL format for Zebra printers
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
  copies?: number // Number of copies for this specific item
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
  // Support for bulk printing multiple different labels in one job
  items?: ProductLabelItem[]
}

/**
 * Generate ZPL code for a single product label
 */
function generateSingleLabelZpl(
  item: ProductLabelItem,
  includePrice: boolean,
  labelWidthMm: number,
  labelHeightMm: number
): string {
  const dpi = 203
  const dotsPerMm = dpi / 25.4
  const labelWidth = Math.round(labelWidthMm * dotsPerMm)
  const labelHeight = Math.round(labelHeightMm * dotsPerMm)
  const margin = 8
  const isCompact = labelHeightMm <= 26

  const maxNameLength = isCompact ? 24 : Math.floor(labelWidthMm / 2.5)
  const productName = item.productName.length > maxNameLength
    ? item.productName.substring(0, maxNameLength - 2) + '..'
    : item.productName

  const zpl: string[] = []

  zpl.push('^XA')
  zpl.push(`^PW${labelWidth}`)
  zpl.push(`^LL${labelHeight}`)
  zpl.push('^PON')
  zpl.push('^LH0,0')

  if (isCompact) {
    const shouldIncludePrice = includePrice && (item.priceCUP !== undefined || item.price !== undefined)

    if (!shouldIncludePrice) {
      const noPriceProductName = item.productName.length > 28
        ? item.productName.substring(0, 26) + '..'
        : item.productName
      const nameWidth = noPriceProductName.length * 13
      const nameX = Math.max(margin, Math.round((labelWidth - nameWidth) / 2))
      zpl.push(`^FO${nameX},${margin}^A0N,26,26^FD${escapeZpl(noPriceProductName)}^FS`)

      const barcodeY = 55
      const barcodeHeight = 55
      const barcodeCmd = getBarcodeCommand(item.barcode, item.barcodeType)
      const barcodeX = Math.round(labelWidth / 2) - 100
      zpl.push(`^FO${barcodeX},${barcodeY}^BY2`)
      zpl.push(`${barcodeCmd},${barcodeHeight},Y,N,N^FD${item.barcode}^FS`)
    } else {
      zpl.push(`^FO${margin},${margin}^A0N,20,20^FD${escapeZpl(productName)}^FS`)

      const priceValue = item.priceCUP !== undefined ? item.priceCUP : item.price!
      const isCUP = item.priceCUP !== undefined
      const formattedPrice = isCUP ? Math.round(priceValue).toLocaleString() : priceValue.toFixed(2)

      if (isCUP) {
        const priceOffset = 90
        zpl.push(`^FO${labelWidth - priceOffset},${margin}^A0N,24,24^FD${formattedPrice}^FS`)
        zpl.push(`^FO${labelWidth - priceOffset + 10},${margin + 22}^A0N,16,16^FDCUP^FS`)
      } else {
        const priceText = `${item.currency || '$'}${formattedPrice}`
        const priceOffset = 100
        zpl.push(`^FO${labelWidth - priceOffset},${margin}^A0N,24,24^FD${priceText}^FS`)
      }

      const barcodeY = 55
      const barcodeHeight = 35
      const barcodeCmd = getBarcodeCommand(item.barcode, item.barcodeType)
      zpl.push(`^FO${margin + 20},${barcodeY}^BY1.5`)
      zpl.push(`${barcodeCmd},${barcodeHeight},Y,N,N^FD${item.barcode}^FS`)
    }
  } else {
    let y = margin
    zpl.push(`^FO${margin},${y}^A0N,24,24^FD${escapeZpl(productName)}^FS`)
    y += 30

    if (item.sku) {
      zpl.push(`^FO${margin},${y}^A0N,18,18^FDSKU: ${escapeZpl(item.sku)}^FS`)
      y += 22
    }

    const shouldShowPrice = includePrice && (item.priceCUP !== undefined || item.price !== undefined)
    if (shouldShowPrice) {
      const priceValue = item.priceCUP !== undefined ? item.priceCUP : item.price!
      const isCUP = item.priceCUP !== undefined
      const formattedPrice = isCUP ? Math.round(priceValue).toLocaleString() : priceValue.toFixed(2)

      if (isCUP) {
        zpl.push(`^FO${margin},${y}^A0N,28,28^FD${formattedPrice}^FS`)
        y += 28
        zpl.push(`^FO${margin},${y}^A0N,18,18^FDCUP^FS`)
        y += 22
      } else {
        const priceText = `${item.currency || '$'}${formattedPrice}`
        zpl.push(`^FO${margin},${y}^A0N,28,28^FD${priceText}^FS`)
        y += 32
      }
    }

    const barcodeY = labelHeight - 80
    const barcodeHeight = 50
    const barcodeCmd = getBarcodeCommand(item.barcode, item.barcodeType)
    zpl.push(`^FO${margin},${barcodeY}^BY2`)
    zpl.push(`${barcodeCmd},${barcodeHeight},Y,N,N^FD${item.barcode}^FS`)
  }

  zpl.push('^XZ')
  return zpl.join('\n')
}

/**
 * Generate ZPL code for a 3x2" (76x51mm, 608x408 dots @203dpi) product label
 */
function generateSingleLabel3x2Zpl(
  item: ProductLabelItem,
  includePrice: boolean
): string {
  const labelWidth = 608
  const labelHeight = 408
  const margin = 16

  const maxNameLength = 30
  const productName = item.productName.length > maxNameLength
    ? item.productName.substring(0, maxNameLength - 2) + '..'
    : item.productName

  const zpl: string[] = []

  zpl.push('^XA')
  zpl.push(`^PW${labelWidth}`)
  zpl.push(`^LL${labelHeight}`)
  zpl.push('^PON')
  zpl.push('^LH0,0')

  let y = margin

  // Product Name (larger font)
  zpl.push(`^FO${margin},${y}^A0N,34,34^FD${escapeZpl(productName)}^FS`)
  y += 44

  // SKU line
  if (item.sku) {
    zpl.push(`^FO${margin},${y}^A0N,22,22^FDSKU: ${escapeZpl(item.sku)}^FS`)
    y += 32
  }

  // Barcode (centered, taller)
  const barcodeHeight = 90
  const barcodeCmd = getBarcodeCommand(item.barcode, item.barcodeType)
  const barcodeX = Math.round((labelWidth - 350) / 2)
  const barcodeY = y + 10
  zpl.push(`^FO${barcodeX},${barcodeY}^BY2`)
  zpl.push(`${barcodeCmd},${barcodeHeight},Y,N,N^FD${item.barcode}^FS`)

  // Price (bottom-right corner, large font) - only if includePrice
  const shouldShowPrice = includePrice && (item.priceCUP !== undefined || item.price !== undefined || item.priceUSD !== undefined)
  if (shouldShowPrice) {
    const priceValue = item.priceCUP !== undefined ? item.priceCUP : item.price
    const isCUP = item.priceCUP !== undefined

    if (priceValue !== undefined) {
      const formattedPrice = isCUP ? Math.round(priceValue).toLocaleString() : priceValue.toFixed(2)
      const currencyLabel = isCUP ? 'CUP' : (item.currency || 'USD')
      const priceText = isCUP ? formattedPrice : `$${formattedPrice}`
      const priceY = labelHeight - 60
      zpl.push(`^FO${labelWidth - 200},${priceY}^A0N,36,36^FD${priceText}^FS`)
      zpl.push(`^FO${labelWidth - 80},${priceY + 36}^A0N,18,18^FD${currencyLabel}^FS`)
    }
  }

  zpl.push('^XZ')
  return zpl.join('\n')
}

/**
 * Generate ZPL code for a 4x6" (102x152mm, 812x1216 dots @203dpi) full product label
 */
function generateSingleLabel4x6Zpl(
  item: ProductLabelItem,
  includePrice: boolean
): string {
  // 4x6 label at 203 DPI = 812 x 1218 dots
  const W = 812
  const H = 1218
  const M = 30 // margin
  const CW = W - M * 2 // content width

  const zpl: string[] = []
  zpl.push('^XA')
  zpl.push(`^PW${W}`)
  zpl.push(`^LL${H}`)
  zpl.push('^PON')
  zpl.push('^LH0,0')

  let y = M

  // ═══ HEADER: PRODUCT NAME (large, auto-wrap up to 3 lines) ═══
  zpl.push(`^FO${M},${y}^A0N,52,52^FB${CW},3,4,L,0^FD${escapeZpl(item.productName)}^FS`)
  y += 175

  // ═══ THIN SEPARATOR ═══
  zpl.push(`^FO${M},${y}^GB${CW},2,2^FS`)
  y += 18

  // ═══ DESCRIPTION (auto-wrap up to 5 lines) ═══
  if (item.description) {
    zpl.push(`^FO${M},${y}^A0N,26,26^FB${CW},5,2,L,0^FD${escapeZpl(item.description)}^FS`)
    y += 155
  }

  // ═══ SKU ═══
  if (item.sku) {
    zpl.push(`^FO${M},${y}^A0N,28,28^FDSKU: ${escapeZpl(item.sku)}^FS`)
    y += 42
  }

  // ═══ BARCODE NUMBER (human readable, small) ═══
  if (item.barcode) {
    zpl.push(`^FO${M},${y}^A0N,24,24^FDCodigo: ${escapeZpl(item.barcode)}^FS`)
    y += 38
  }

  // ═══ THICK SEPARATOR ═══
  y += 10
  zpl.push(`^FO${M},${y}^GB${CW},4,4^FS`)
  y += 25

  // ═══ PRICES (large, centered, prominent) ═══
  const shouldShowPrice = includePrice && (item.priceCUP !== undefined || item.price !== undefined || item.priceUSD !== undefined)
  if (shouldShowPrice) {
    // Price CUP - HUGE centered
    if (item.priceCUP !== undefined) {
      const cupStr = Math.round(item.priceCUP).toLocaleString()
      zpl.push(`^FO${M},${y}^A0N,90,90^FB${CW},1,0,C,0^FD${cupStr} CUP^FS`)
      y += 110

      // USD price below
      if (item.priceUSD !== undefined) {
        const usdStr = item.priceUSD.toFixed(2)
        zpl.push(`^FO${M},${y}^A0N,44,44^FB${CW},1,0,C,0^FD$${usdStr} USD^FS`)
        y += 60
      }
    } else if (item.price !== undefined) {
      const priceStr = item.price.toFixed(2)
      zpl.push(`^FO${M},${y}^A0N,90,90^FB${CW},1,0,C,0^FD$${priceStr}^FS`)
      y += 110
    }
  } else {
    // No price - add spacing
    y += 80
  }

  // ═══ SEPARATOR BEFORE BARCODE ═══
  y += 15
  zpl.push(`^FO${M},${y}^GB${CW},2,2^FS`)
  y += 25

  // ═══ BARCODE (large, centered, fills remaining space) ═══
  if (item.barcode) {
    const barcodeCmd = getBarcodeCommand(item.barcode, item.barcodeType)
    // Calculate remaining space for barcode
    const remainingHeight = H - y - 60
    const barcodeHeight = Math.min(Math.max(remainingHeight - 30, 120), 250)
    const barcodeX = Math.round((W - 500) / 2)
    zpl.push(`^FO${barcodeX},${y}^BY3`)
    zpl.push(`${barcodeCmd},${barcodeHeight},Y,N,N^FD${item.barcode}^FS`)
  }

  zpl.push('^XZ')
  return zpl.join('\n')
}

/**
 * Generate ZPL code for a product label
 * ZPL is Zebra Programming Language - native format for Zebra printers
 * Default size: 2" wide x 1" tall (standard price label)
 *
 * Supports label sizes: '2x1' (default), '3x2', '4x6'
 * Supports bulk printing: if data.items is provided, generates all labels in one job
 */
export function generateProductLabelZpl(data: ProductLabelData): Buffer {
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

  // Dispatcher: select the right generator based on label size
  function generateLabel(item: ProductLabelItem): string {
    switch (labelSize) {
      case '3x2':
        return generateSingleLabel3x2Zpl(item, includePrice)
      case '4x6':
        return generateSingleLabel4x6Zpl(item, includePrice)
      case '2x1':
      default:
        return generateSingleLabelZpl(item, includePrice, labelWidthMm, labelHeightMm)
    }
  }

  // Check if bulk mode (multiple items)
  if (data.items && data.items.length > 0) {
    const allLabels: string[] = []

    for (const item of data.items) {
      const copies = item.copies || 1
      const labelZpl = generateLabel(item)

      // Add the label multiple times for copies
      for (let i = 0; i < copies; i++) {
        allLabels.push(labelZpl)
      }
    }

    return Buffer.from(allLabels.join('\n'), 'utf8')
  }

  // Single label mode (original behavior)
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

  const zplContent = generateLabel(singleItem)

  return Buffer.from(zplContent, 'utf8')
}

/**
 * Generate ZPL for shipping label
 */
export function generateShippingLabelZpl(data: {
  trackingNumber: string
  senderName: string
  senderAddress: string
  recipientName: string
  recipientAddress: string
  recipientCity: string
  recipientState: string
  recipientZip: string
  weight?: string
  service?: string
}): Buffer {
  const zpl: string[] = []

  // 4x6 label at 203 DPI
  const labelWidth = 812 // 4 inches
  const labelHeight = 1218 // 6 inches

  zpl.push('^XA')
  zpl.push(`^PW${labelWidth}`)
  zpl.push(`^LL${labelHeight}`)
  zpl.push('^PON')
  zpl.push('^LH0,0')

  let y = 20

  // From section
  zpl.push(`^FO20,${y}^ADN,18,10^FDFROM:^FS`)
  y += 25
  zpl.push(`^FO20,${y}^ADN,24,12^FD${escapeZpl(data.senderName)}^FS`)
  y += 30
  zpl.push(`^FO20,${y}^ADN,18,10^FD${escapeZpl(data.senderAddress)}^FS`)
  y += 50

  // Divider line
  zpl.push(`^FO10,${y}^GB${labelWidth - 20},2,2^FS`)
  y += 20

  // To section (larger)
  zpl.push(`^FO20,${y}^ADN,24,12^FDTO:^FS`)
  y += 35
  zpl.push(`^FO20,${y}^ADN,36,20^FD${escapeZpl(data.recipientName)}^FS`)
  y += 50
  zpl.push(`^FO20,${y}^ADN,28,14^FD${escapeZpl(data.recipientAddress)}^FS`)
  y += 40
  zpl.push(`^FO20,${y}^ADN,28,14^FD${escapeZpl(data.recipientCity)}, ${data.recipientState} ${data.recipientZip}^FS`)
  y += 60

  // Service type
  if (data.service) {
    zpl.push(`^FO20,${y}^ADN,24,12^FD${escapeZpl(data.service)}^FS`)
    y += 40
  }

  // Weight
  if (data.weight) {
    zpl.push(`^FO${labelWidth - 150},${y}^ADN,24,12^FD${data.weight}^FS`)
  }

  // Tracking barcode at bottom
  const barcodeY = labelHeight - 200
  zpl.push(`^FO50,${barcodeY}^BY3^BCN,120,Y,N,N^FD${data.trackingNumber}^FS`)

  zpl.push('^XZ')

  return Buffer.from(zpl.join('\n'), 'utf8')
}

/**
 * Get ZPL barcode command based on type
 */
function getBarcodeCommand(barcode: string, type?: string): string {
  const barcodeType = type || detectBarcodeType(barcode)

  switch (barcodeType) {
    case 'ean13':
      return '^BEN' // EAN-13
    case 'ean8':
      return '^B8N' // EAN-8
    case 'upca':
      return '^BUN' // UPC-A
    case 'qrcode':
      return '^BQN,2,4' // QR Code
    case 'code128':
    default:
      return '^BCN' // Code 128
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
 * Escape special characters for ZPL
 */
function escapeZpl(text: string): string {
  // ZPL uses ^ and ~ as control characters
  return text
    .replace(/\^/g, ' ')
    .replace(/~/g, ' ')
    .replace(/[\x00-\x1F]/g, '') // Remove control characters
}

export type { ProductLabelData }
