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
  labelSize?: '3x2' | '2x1' // Tamaño de etiqueta (default: 3x2)
}

/**
 * Generate ZPL code for a weight label - Auto-select by size
 */
export function generateWeightLabelZpl(data: WeightLabelData): Buffer {
  const labelSize = data.labelSize || '3x2'

  if (labelSize === '2x1') {
    return generateWeightLabel2x1(data)
  }
  return generateWeightLabel3x2(data)
}

/**
 * Generate ZPL code for a 3x2 inch weight label - Publix style
 * 3x2 inch (76x51mm) label at 203 DPI
 * Barcode at BOTTOM, QR code on right side
 *
 * Layout:
 * ┌───────────────────────────────────────────────────────┐
 * │ PRECIO/lb              PRECIO              2/2/2026   │
 * │ 1,230                  95,937                         │
 * │ CUP                    CUP                            │
 * │───────────────────────────────────────────────────────│
 * │ LOMO DE CERDO                            ┌──────────┐ │
 * │ 78.000 lb                                │ QR CODE  │ │
 * │                                          └──────────┘ │
 * │  ||||||||||||||||||||||||||||||||||||||||||||||||     │
 * │          2 0 2 2 2 0 2  7 8 0 0 0 7                   │
 * └───────────────────────────────────────────────────────┘
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
  zpl.push(`^FO15,10^A0N,24,24^FDPRECIO/${unit}^FS`)
  // Center the PRECIO header (between left section and QR area)
  zpl.push(`^FO200,10^A0N,24,24^FDPRECIO^FS`)

  // ========== Date (top right corner) ==========
  const dateText = data.printDate || new Date().toLocaleDateString('es-ES')
  zpl.push(`^FO${labelWidth - 85},10^A0N,20,20^FD${dateText}^FS`)

  // ========== ROW 2: Price Values ==========
  // Left: Price per unit (bigger)
  zpl.push(`^FO15,38^A0N,50,50^FD${formattedPricePerUnit}^FS`)
  zpl.push(`^FO16,38^A0N,50,50^FD${formattedPricePerUnit}^FS`) // Bold
  zpl.push(`^FO15,92^A0N,24,24^FDCUP^FS`)

  // Center: Total price (VERY LARGE) - Using field block with right alignment to prevent overflow
  // Position from x=180 to x=420 (240 pixels wide) - plenty of room
  const priceBlockWidth = 260
  const priceBlockX = 180
  zpl.push(`^FO${priceBlockX},25^FB${priceBlockWidth},1,0,R,0^A0N,85,85^FD${formattedTotalPrice}^FS`)
  zpl.push(`^FO${priceBlockX + 1},25^FB${priceBlockWidth},1,0,R,0^A0N,85,85^FD${formattedTotalPrice}^FS`) // Bold
  zpl.push(`^FO${priceBlockX},115^FB${priceBlockWidth},1,0,R,0^A0N,24,24^FDCUP^FS`)

  // ========== Divider line ==========
  zpl.push(`^FO15,150^GB${labelWidth - 30},3,3^FS`)

  // ========== ROW 3: Product Name (LEFT aligned, LARGE, bold) ==========
  const productName = truncate(data.productName.toUpperCase(), 18)
  zpl.push(`^FO15,165^A0N,46,46^FD${escapeZpl(productName)}^FS`)
  zpl.push(`^FO16,165^A0N,46,46^FD${escapeZpl(productName)}^FS`) // Bold

  // ========== ROW 4: Weight (LEFT aligned, LARGE) ==========
  zpl.push(`^FO15,218^A0N,40,40^FD${escapeZpl(data.weight)}^FS`)
  zpl.push(`^FO16,218^A0N,40,40^FD${escapeZpl(data.weight)}^FS`) // Bold

  // ========== QR Code (right side, contains product SKU/barcode) ==========
  // QR code positioned in the right area, next to product name/weight
  const qrContent = data.productSku || data.barcode
  const qrX = labelWidth - 115
  const qrY = 165
  // ^BQN,2,3 = QR code, Normal orientation, magnification 3
  zpl.push(`^FO${qrX},${qrY}^BQN,2,3^FDQA,${qrContent}^FS`)

  // ========== ROW 5: Barcode at BOTTOM (horizontal, wide) ==========
  const barcodeX = 50
  zpl.push(`^FO${barcodeX},275^BY3`) // BY3 = wider barcode
  zpl.push(`^BEN,80,Y,N^FD${data.barcode}^FS`)

  // End label
  zpl.push('^XZ')

  const zplContent = zpl.join('\n')
  console.log('[ZPL Generator] Generated Weight Label 3x2":', zplContent.substring(0, 300) + '...')

  return Buffer.from(zplContent, 'utf8')
}

/**
 * Generate ZPL code for a 2x1 inch weight label - Compact Publix style
 * 2x1 inch (51x25mm) label at 203 DPI
 *
 * Layout:
 * ┌───────────────────────────────┐
 * │ LOMO DE CERDO        1,230   │
 * │ 1.000 kg               CUP   │
 * │   |||||||||||||||||||||||    │
 * │     2000010100X              │
 * └───────────────────────────────┘
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

  // Format total price
  const formattedTotalPrice = data.priceCUP.toLocaleString('es-ES')

  // ========== ROW 1: Product Name (left) + Price (right) ==========
  const productName = truncate(data.productName.toUpperCase(), 16)
  zpl.push(`^FO8,8^A0N,28,28^FD${escapeZpl(productName)}^FS`)
  zpl.push(`^FO9,8^A0N,28,28^FD${escapeZpl(productName)}^FS`) // Bold

  // Price - right aligned, large
  zpl.push(`^FO${labelWidth - 110},5^A0N,42,42^FD${formattedTotalPrice}^FS`)
  zpl.push(`^FO${labelWidth - 109},5^A0N,42,42^FD${formattedTotalPrice}^FS`) // Bold

  // ========== ROW 2: Weight (left) + CUP label (right) ==========
  zpl.push(`^FO8,45^A0N,26,26^FD${escapeZpl(data.weight)}^FS`)
  zpl.push(`^FO${labelWidth - 50},48^A0N,20,20^FDCUP^FS`)

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
  console.log('[ZPL Generator] Generated Weight Label 2x1":', zplContent.substring(0, 300) + '...')

  return Buffer.from(zplContent, 'utf8')
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
