/**
 * Product Label Generator - ZPL format for Zebra printers
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
 * Generate ZPL code for a product label
 * ZPL is Zebra Programming Language - native format for Zebra printers
 * Default size: 2" wide x 1" tall (standard price label)
 */
export function generateProductLabelZpl(data: ProductLabelData): Buffer {
  // Default label size: 2" x 1" (51mm x 25mm) at 203 DPI
  // 203 DPI = 8 dots per mm
  const dpi = 203
  const dotsPerMm = dpi / 25.4

  // Label dimensions in dots - Default 2" x 1"
  const labelWidthMm = data.labelWidth || 51 // 2 inches
  const labelHeightMm = data.labelHeight || 25 // 1 inch
  const labelWidth = Math.round(labelWidthMm * dotsPerMm) // ~406 dots
  const labelHeight = Math.round(labelHeightMm * dotsPerMm) // ~203 dots

  const margin = 8
  const isCompact = labelHeightMm <= 26 // 1 inch or less

  // Truncate product name (allow more chars for price labels)
  const maxNameLength = isCompact ? 24 : Math.floor(labelWidthMm / 2.5)
  const productName = data.productName.length > maxNameLength
    ? data.productName.substring(0, maxNameLength - 2) + '..'
    : data.productName

  // Build ZPL commands
  const zpl: string[] = []

  // Start label
  zpl.push('^XA') // Start format
  zpl.push(`^PW${labelWidth}`) // Print width
  zpl.push(`^LL${labelHeight}`) // Label length
  zpl.push('^PON') // Print orientation normal
  zpl.push('^LH0,0') // Label home position

  if (isCompact) {
    // Compact layout for 2x1 inch labels
    const shouldIncludePrice = data.includePrice !== false && (data.priceCUP !== undefined || data.price !== undefined)

    if (!shouldIncludePrice) {
      // === LABEL WITHOUT PRICE ===
      // Centered name at top, barcode centered and full width

      // Product name (bigger font, allow more chars, centered)
      const noPriceProductName = data.productName.length > 28
        ? data.productName.substring(0, 26) + '..'
        : data.productName
      // Center the name using ^FB (field block) with ^FO centered
      const nameWidth = noPriceProductName.length * 13 // Approx width per char
      const nameX = Math.max(margin, Math.round((labelWidth - nameWidth) / 2))
      zpl.push(`^FO${nameX},${margin}^A0N,26,26^FD${escapeZpl(noPriceProductName)}^FS`)

      // Barcode (centered, full width, taller)
      const barcodeY = 55
      const barcodeHeight = 55

      const barcodeCmd = getBarcodeCommand(data.barcode, data.barcodeType)

      // Centered barcode
      const barcodeX = Math.round(labelWidth / 2) - 100 // Center offset
      zpl.push(`^FO${barcodeX},${barcodeY}^BY2`) // Wider bars
      zpl.push(`${barcodeCmd},${barcodeHeight},Y,N,N^FD${data.barcode}^FS`)

    } else {
      // === LABEL WITH PRICE ===
      // Product name (top left)
      zpl.push(`^FO${margin},${margin}^A0N,20,20^FD${escapeZpl(productName)}^FS`)

      // Price (top right) - format with price on top, CUP below
      const priceValue = data.priceCUP !== undefined ? data.priceCUP : data.price!
      const isCUP = data.priceCUP !== undefined
      const formattedPrice = isCUP ? Math.round(priceValue).toLocaleString() : priceValue.toFixed(2)

      if (isCUP) {
        // Precio arriba, CUP abajo
        const priceOffset = 90
        zpl.push(`^FO${labelWidth - priceOffset},${margin}^A0N,24,24^FD${formattedPrice}^FS`)
        zpl.push(`^FO${labelWidth - priceOffset + 10},${margin + 22}^A0N,16,16^FDCUP^FS`)
      } else {
        const priceText = `${data.currency || '$'}${formattedPrice}`
        const priceOffset = 100
        zpl.push(`^FO${labelWidth - priceOffset},${margin}^A0N,24,24^FD${priceText}^FS`)
      }

      // Barcode (bottom, centered) - smaller for compact label
      const barcodeY = 55
      const barcodeHeight = 35

      const barcodeCmd = getBarcodeCommand(data.barcode, data.barcodeType)

      zpl.push(`^FO${margin + 20},${barcodeY}^BY1.5`) // Narrower bars for compact
      zpl.push(`${barcodeCmd},${barcodeHeight},Y,N,N^FD${data.barcode}^FS`)
    }

  } else {
    // Standard layout for larger labels
    let y = margin

    // Product name (larger font)
    zpl.push(`^FO${margin},${y}^A0N,24,24^FD${escapeZpl(productName)}^FS`)
    y += 30

    // SKU
    if (data.sku) {
      zpl.push(`^FO${margin},${y}^A0N,18,18^FDSKU: ${escapeZpl(data.sku)}^FS`)
      y += 22
    }

    // Price - only if includePrice is not false
    const shouldShowPrice = data.includePrice !== false && (data.priceCUP !== undefined || data.price !== undefined)
    if (shouldShowPrice) {
      // Use priceCUP if available, otherwise use price
      const priceValue = data.priceCUP !== undefined ? data.priceCUP : data.price!
      const isCUP = data.priceCUP !== undefined

      // Format price: CUP uses integer format, others use 2 decimals
      const formattedPrice = isCUP ? Math.round(priceValue).toLocaleString() : priceValue.toFixed(2)

      if (isCUP) {
        // Precio arriba, CUP abajo
        zpl.push(`^FO${margin},${y}^A0N,28,28^FD${formattedPrice}^FS`)
        y += 28
        zpl.push(`^FO${margin},${y}^A0N,18,18^FDCUP^FS`)
        y += 22
      } else {
        const priceText = `${data.currency || '$'}${formattedPrice}`
        zpl.push(`^FO${margin},${y}^A0N,28,28^FD${priceText}^FS`)
        y += 32
      }
    }

    // Category
    if (data.category) {
      zpl.push(`^FO${margin},${y}^A0N,16,16^FD${escapeZpl(data.category)}^FS`)
      y += 20
    }

    // Expiration date
    if (data.expirationDate) {
      zpl.push(`^FO${margin},${y}^A0N,16,16^FDVence: ${data.expirationDate}^FS`)
      y += 20
    }

    // Barcode at bottom
    const barcodeY = labelHeight - 80
    const barcodeHeight = 50
    const barcodeCmd = getBarcodeCommand(data.barcode, data.barcodeType)

    zpl.push(`^FO${margin},${barcodeY}^BY2`)
    zpl.push(`${barcodeCmd},${barcodeHeight},Y,N,N^FD${data.barcode}^FS`)
  }

  // End label
  zpl.push('^XZ')

  const zplContent = zpl.join('\n')
  console.log('[ZPL Generator] Generated ZPL for', isCompact ? '2x1 inch' : 'large', 'label')

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
