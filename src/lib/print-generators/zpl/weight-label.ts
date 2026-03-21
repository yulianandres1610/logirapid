/**
 * Weight Label Generator - ZPL format for Zebra printers
 * Diseño estilo Publix - Simple y limpio
 * Tamaños: 3x2 pulgadas (76x51mm) y 2x1 pulgadas (51x25mm)
 */

export interface WeightLabelData {
  productName: string
  productSku?: string
  weight: string           // "1.250 kg"
  weightKg: number         // 1.250
  priceCUP: number         // Precio total en CUP
  priceUSD?: number        // Precio total en USD
  pricePerKg?: number      // Precio USD por kg
  pricePerUnit?: number    // Precio CUP por unidad (kg/lb)
  unitOfMeasure?: string   // kg, lb, g
  barcode: string          // EAN-13 con peso embebido
  barcodeType?: 'ean13' | 'code128'
  printDate: string        // Fecha de impresión
  companyName?: string     // Nombre de la empresa (opcional)
  exchangeRate?: number    // Tasa de cambio (opcional para referencia)
  labelSize?: '3x2' | '2x1' | '4x6' // Tamaño de etiqueta (default: 3x2)
}

/**
 * Generate ZPL code for a weight label - Auto-select by size
 */
export function generateWeightLabelZpl(data: WeightLabelData): Buffer {
  const labelSize = data.labelSize || '3x2'

  if (labelSize === '4x6') {
    return generateWeightLabel4x6(data)
  }
  if (labelSize === '2x1') {
    return generateWeightLabel2x1(data)
  }
  return generateWeightLabel3x2(data)
}

/**
 * Generate ZPL code for a 3x2 inch weight label - Publix style
 * 3x2 inch (76x51mm) label at 203 DPI
 * Barcode at BOTTOM, QR code on right side
 */
export function generateWeightLabel3x2(data: WeightLabelData): Buffer {
  const labelWidth = 609  // 3 inches at 203 DPI
  const labelHeight = 406 // 2 inches at 203 DPI

  const zpl: string[] = []

  // Start label
  zpl.push('^XA')
  zpl.push(`^PW${labelWidth}`)
  zpl.push(`^LL${labelHeight}`)
  zpl.push('^PON')
  zpl.push('^LH0,0')
  zpl.push('^CI28') // UTF-8

  const unit = data.unitOfMeasure || 'kg'
  const pricePerUnit = data.pricePerUnit || Math.round((data.pricePerKg || 0) * (data.exchangeRate || 1))

  // Format prices
  const formattedPricePerUnit = pricePerUnit.toLocaleString('es-ES')
  const formattedTotalPrice = data.priceCUP.toLocaleString('es-ES')

  // ========== ROW 1: Headers ==========
  zpl.push(`^FO15,8^A0N,22,22^FDPRECIO/${unit}^FS`)
  zpl.push(`^FO200,8^A0N,22,22^FDTOTAL^FS`)

  // ========== Date (top right corner) ==========
  const dateText = data.printDate || new Date().toLocaleDateString('es-ES')
  zpl.push(`^FO${labelWidth - 85},8^A0N,18,18^FD${dateText}^FS`)

  // ========== ROW 2: Price Values (BELOW headers, with $ symbol) ==========
  // Left: Price per unit with $
  zpl.push(`^FO15,35^A0N,55,55^FD$${formattedPricePerUnit}^FS`)
  zpl.push(`^FO16,35^A0N,55,55^FD$${formattedPricePerUnit}^FS`) // Bold

  // Center: Total price (LARGE) with $ - positioned below "TOTAL" header
  const priceBlockWidth = 280
  const priceBlockX = 170
  zpl.push(`^FO${priceBlockX},32^FB${priceBlockWidth},1,0,R,0^A0N,70,70^FD$${formattedTotalPrice}^FS`)
  zpl.push(`^FO${priceBlockX + 1},32^FB${priceBlockWidth},1,0,R,0^A0N,70,70^FD$${formattedTotalPrice}^FS`) // Bold

  // ========== Divider line ==========
  zpl.push(`^FO15,115^GB${labelWidth - 30},3,3^FS`)

  // ========== ROW 3: Product Name (LEFT aligned, LARGE, bold) ==========
  const productName = truncate(data.productName.toUpperCase(), 16)
  zpl.push(`^FO15,130^A0N,48,48^FD${escapeZpl(productName)}^FS`)
  zpl.push(`^FO16,130^A0N,48,48^FD${escapeZpl(productName)}^FS`) // Bold

  // ========== ROW 4: Weight (LEFT aligned, LARGE) ==========
  zpl.push(`^FO15,185^A0N,42,42^FD${escapeZpl(data.weight)}^FS`)
  zpl.push(`^FO16,185^A0N,42,42^FD${escapeZpl(data.weight)}^FS`) // Bold

  // ========== QR Code (right side, BIGGER - magnification 5) ==========
  const qrContent = data.productSku || data.barcode
  const qrX = labelWidth - 140
  const qrY = 125
  zpl.push(`^FO${qrX},${qrY}^BQN,2,5^FDQA,${qrContent}^FS`)

  // ========== ROW 5: Barcode at BOTTOM (horizontal, wide) ==========
  const barcodeX = 50
  zpl.push(`^FO${barcodeX},280^BY3`) // BY3 = wider barcode
  zpl.push(`^BEN,80,Y,N^FD${data.barcode}^FS`)

  // End label
  zpl.push('^XZ')

  const zplContent = zpl.join('\n')

  return Buffer.from(zplContent, 'utf8')
}

/**
 * Generate ZPL code for a 2x1 inch weight label - Compact Publix style
 * 2x1 inch (51x25mm) label at 203 DPI
 */
export function generateWeightLabel2x1(data: WeightLabelData): Buffer {
  const labelWidth = 406  // 2 inches at 203 DPI
  const labelHeight = 203 // 1 inch at 203 DPI

  const zpl: string[] = []

  // Start label
  zpl.push('^XA')
  zpl.push(`^PW${labelWidth}`)
  zpl.push(`^LL${labelHeight}`)
  zpl.push('^PON')
  zpl.push('^LH0,0')
  zpl.push('^CI28') // UTF-8

  // Format total price with $ symbol
  const formattedTotalPrice = '$' + data.priceCUP.toLocaleString('es-ES')

  // ========== ROW 1: Product Name (left) + Price (right) ==========
  const productName = truncate(data.productName.toUpperCase(), 14)
  zpl.push(`^FO8,8^A0N,28,28^FD${escapeZpl(productName)}^FS`)
  zpl.push(`^FO9,8^A0N,28,28^FD${escapeZpl(productName)}^FS`) // Bold

  // Price - right aligned using field block to prevent overflow (with $ symbol)
  const priceBlockWidth = 140
  zpl.push(`^FO${labelWidth - priceBlockWidth - 5},5^FB${priceBlockWidth},1,0,R,0^A0N,42,42^FD${formattedTotalPrice}^FS`)
  zpl.push(`^FO${labelWidth - priceBlockWidth - 4},5^FB${priceBlockWidth},1,0,R,0^A0N,42,42^FD${formattedTotalPrice}^FS`) // Bold

  // ========== ROW 2: Weight (left) ==========
  zpl.push(`^FO8,45^A0N,26,26^FD${escapeZpl(data.weight)}^FS`)

  // ========== Divider line ==========
  zpl.push(`^FO8,75^GB${labelWidth - 16},2,2^FS`)

  // ========== ROW 3: Barcode (centered, full width) ==========
  const barcodeX = 30
  zpl.push(`^FO${barcodeX},90^BY2`)
  zpl.push(`^BEN,55,Y,N^FD${data.barcode}^FS`)

  // ========== Date (bottom right, tiny) ==========
  const dateText = data.printDate || new Date().toLocaleDateString('es-ES')
  zpl.push(`^FO${labelWidth - 70},${labelHeight - 18}^A0N,14,14^FD${dateText}^FS`)

  // End label
  zpl.push('^XZ')

  const zplContent = zpl.join('\n')

  return Buffer.from(zplContent, 'utf8')
}

/**
 * Generate ZPL code for a 4x6 inch weight label - Full detail
 * 4x6 inch (102x152mm) label at 203 DPI = 812 x 1218 dots
 */
export function generateWeightLabel4x6(data: WeightLabelData): Buffer {
  const W = 812
  const H = 1218
  const M = 30
  const CW = W - M * 2

  const zpl: string[] = []
  zpl.push('^XA')
  zpl.push(`^PW${W}`)
  zpl.push(`^LL${H}`)
  zpl.push('^PON')
  zpl.push('^LH0,0')
  zpl.push('^CI28')

  const unit = data.unitOfMeasure || 'kg'
  const pricePerUnit = data.pricePerUnit || Math.round((data.pricePerKg || 0) * (data.exchangeRate || 1))
  const formattedPricePerUnit = pricePerUnit.toLocaleString('es-ES')
  const formattedTotalCUP = data.priceCUP.toLocaleString('es-ES')
  const dateText = data.printDate || new Date().toLocaleDateString('es-ES')

  let y = M

  // ═══ COMPANY NAME (if available) ═══
  if (data.companyName) {
    zpl.push(`^FO${M},${y}^A0N,28,28^FB${CW},1,0,C,0^FD${escapeZpl(data.companyName)}^FS`)
    y += 38
  }

  // ═══ PRODUCT NAME (large, centered, up to 3 lines) ═══
  zpl.push(`^FO${M},${y}^A0N,52,52^FB${CW},3,4,C,0^FD${escapeZpl(data.productName.toUpperCase())}^FS`)
  y += 175

  // ═══ SEPARATOR ═══
  zpl.push(`^FO${M},${y}^GB${CW},4,4^FS`)
  y += 25

  // ═══ WEIGHT (huge, centered) ═══
  zpl.push(`^FO${M},${y}^A0N,30,30^FB${CW},1,0,C,0^FDPESO NETO^FS`)
  y += 38
  zpl.push(`^FO${M},${y}^A0N,90,90^FB${CW},1,0,C,0^FD${escapeZpl(data.weight)}^FS`)
  y += 110

  // ═══ SEPARATOR ═══
  zpl.push(`^FO${M},${y}^GB${CW},3,3^FS`)
  y += 25

  // ═══ PRICE TABLE ═══
  const colLeft = M
  const colRight = M + Math.round(CW / 2) + 20

  // Price per unit header with unit of measure
  zpl.push(`^FO${colLeft},${y}^A0N,26,26^FDPRECIO POR ${unit.toUpperCase()}^FS`)
  zpl.push(`^FO${colRight},${y}^A0N,26,26^FDTOTAL (${data.weight})^FS`)
  y += 35

  // Values with CUP label inline
  zpl.push(`^FO${colLeft},${y}^A0N,50,50^FD$${formattedPricePerUnit} CUP/${unit}^FS`)
  y += 65
  zpl.push(`^FO${colLeft},${y}^A0N,70,70^FD$${formattedTotalCUP} CUP^FS`)
  y += 90

  // USD price with unit
  if (data.priceUSD !== undefined) {
    const formattedUSD = data.priceUSD.toFixed(2)
    const pricePerKgUSD = data.pricePerKg ? `$${data.pricePerKg.toFixed(2)} USD/${unit}` : ''
    if (pricePerKgUSD) {
      zpl.push(`^FO${colLeft},${y}^A0N,28,28^FD${pricePerKgUSD}^FS`)
      y += 38
    }
    zpl.push(`^FO${colLeft},${y}^A0N,40,40^FDTotal: $${formattedUSD} USD^FS`)
    y += 55
  }

  // ═══ SEPARATOR ═══
  y += 10
  zpl.push(`^FO${M},${y}^GB${CW},3,3^FS`)
  y += 25

  // ═══ INFO LINE: SKU + Date + Rate ═══
  if (data.productSku) {
    zpl.push(`^FO${M},${y}^A0N,24,24^FDSKU: ${escapeZpl(data.productSku)}^FS`)
    y += 32
  }
  zpl.push(`^FO${M},${y}^A0N,22,22^FDFecha: ${dateText}${data.exchangeRate ? '  |  Tasa: 1 USD = ' + Math.round(data.exchangeRate) + ' CUP' : ''}^FS`)
  y += 32

  // ═══ SEPARATOR ═══
  y += 8
  zpl.push(`^FO${M},${y}^GB${CW},2,2^FS`)
  y += 18

  // ═══ BARCODE (wide + short = rectangular, centered) ═══
  // BY5 makes EAN-13 ~650 dots wide (fills most of 812 label width)
  // Height 90 = slim/rectangular look
  const barcodeWidth = 650
  const barcodeX = Math.round((W - barcodeWidth) / 2)
  zpl.push(`^FO${barcodeX},${y}^BY5`)
  zpl.push(`^BEN,90,Y,N^FD${data.barcode}^FS`)

  zpl.push('^XZ')
  return Buffer.from(zpl.join('\n'), 'utf8')
}

/**
 * Alias for backward compatibility
 */
export function generateWeightLabelZplSimple(data: WeightLabelData): Buffer {
  return generateWeightLabelZpl(data)
}

/**
 * Truncate text to max length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 2) + '..'
}

/**
 * Escape special characters for ZPL
 */
function escapeZpl(text: string): string {
  return text
    .replace(/\^/g, ' ')
    .replace(/~/g, ' ')
    .replace(/[\x00-\x1F]/g, '')
}
