/**
 * Product Label Generator - ZPL format for Zebra printers
 */

interface ProductLabelData {
  productName: string
  sku: string
  barcode: string
  barcodeType?: 'code128' | 'ean13' | 'upc' | 'qrcode'
  price?: number
  currency?: string
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
 */
export function generateProductLabelZpl(data: ProductLabelData): Buffer {
  // Default label size: 2" x 1" (50mm x 25mm) at 203 DPI
  // 203 DPI = 8 dots per mm
  const dpi = 203
  const dotsPerMm = dpi / 25.4

  // Label dimensions in dots
  const labelWidthMm = data.labelWidth || 50
  const labelHeightMm = data.labelHeight || 25
  const labelWidth = Math.round(labelWidthMm * dotsPerMm)
  const labelHeight = Math.round(labelHeightMm * dotsPerMm)

  // Calculate positions
  const margin = 10
  let y = margin

  // Truncate product name if too long
  const maxNameLength = Math.floor(labelWidthMm / 2.5)
  const productName = data.productName.length > maxNameLength
    ? data.productName.substring(0, maxNameLength - 3) + '...'
    : data.productName

  // Build ZPL commands
  const zpl: string[] = []

  // Start label
  zpl.push('^XA') // Start format
  zpl.push(`^PW${labelWidth}`) // Print width
  zpl.push(`^LL${labelHeight}`) // Label length
  zpl.push('^PON') // Print orientation normal
  zpl.push('^LH0,0') // Label home position

  // Product name (larger font)
  zpl.push(`^FO${margin},${y}^ADN,24,12^FD${escapeZpl(productName)}^FS`)
  y += 30

  // SKU
  if (data.sku) {
    zpl.push(`^FO${margin},${y}^ADN,18,10^FDSKU: ${escapeZpl(data.sku)}^FS`)
    y += 22
  }

  // Price (if provided)
  if (data.price !== undefined) {
    const priceText = `${data.currency || '$'}${data.price.toFixed(2)}`
    zpl.push(`^FO${margin},${y}^ADN,28,14^FD${priceText}^FS`)
    y += 32
  }

  // Category (if provided)
  if (data.category) {
    zpl.push(`^FO${margin},${y}^ADN,14,8^FD${escapeZpl(data.category)}^FS`)
    y += 18
  }

  // Expiration date (if provided)
  if (data.expirationDate) {
    zpl.push(`^FO${margin},${y}^ADN,14,8^FDVence: ${data.expirationDate}^FS`)
    y += 18
  }

  // Barcode - position at bottom of label
  const barcodeY = labelHeight - 80 // Leave space for barcode + text
  const barcodeHeight = 50

  // Determine barcode type
  const barcodeCmd = getBarcodeCommand(data.barcode, data.barcodeType)

  // Center the barcode
  const barcodeX = margin

  // Draw barcode
  zpl.push(`^FO${barcodeX},${barcodeY}^BY2`) // Barcode field origin and bar width
  zpl.push(`${barcodeCmd},${barcodeHeight},Y,N,N^FD${data.barcode}^FS`)

  // End label
  zpl.push('^XZ') // End format

  const zplContent = zpl.join('\n')
  console.log('[ZPL Generator] Generated ZPL:', zplContent)

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
