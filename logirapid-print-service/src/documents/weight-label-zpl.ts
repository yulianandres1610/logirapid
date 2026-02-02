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
 * │ 1,230                  104,547                        │
 * │───────────────────────────────────────────────────────│
 * │ LOMO DE CERDO                            ┌──────────┐ │
 * │ 85.000 lb                                │    QR    │ │
 * │                                          │   CODE   │ │
 * │                                          └──────────┘ │
 * │  ||||||||||||||||||||||||||||||||||||||||||||||||     │
 * │          2 0 2 2 2 0 2  8 5 0 0 0 7                   │
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
  zpl.push(`^FO15,8^A0N,22,22^FDPRECIO/${unit}^FS`)
  zpl.push(`^FO200,8^A0N,22,22^FDPRECIO^FS`)

  // ========== Date (top right corner) ==========
  const dateText = data.printDate || new Date().toLocaleDateString('es-ES')
  zpl.push(`^FO${labelWidth - 85},8^A0N,18,18^FD${dateText}^FS`)

  // ========== ROW 2: Price Values (BELOW headers, no CUP label) ==========
  // Left: Price per unit
  zpl.push(`^FO15,35^A0N,55,55^FD${formattedPricePerUnit}^FS`)
  zpl.push(`^FO16,35^A0N,55,55^FD${formattedPricePerUnit}^FS`) // Bold

  // Center: Total price (LARGE) - positioned below "PRECIO" header
  const priceBlockWidth = 280
  const priceBlockX = 170
  zpl.push(`^FO${priceBlockX},32^FB${priceBlockWidth},1,0,R,0^A0N,70,70^FD${formattedTotalPrice}^FS`)
  zpl.push(`^FO${priceBlockX + 1},32^FB${priceBlockWidth},1,0,R,0^A0N,70,70^FD${formattedTotalPrice}^FS`) // Bold

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
  // QR positioned in the right area, fills empty space
  const qrContent = data.productSku || data.barcode
  const qrX = labelWidth - 140
  const qrY = 125
  // ^BQN,2,5 = QR code, Normal orientation, magnification 5 (bigger)
  zpl.push(`^FO${qrX},${qrY}^BQN,2,5^FDQA,${qrContent}^FS`)

  // ========== ROW 5: Barcode at BOTTOM (horizontal, wide) ==========
  const barcodeX = 50
  zpl.push(`^FO${barcodeX},280^BY3`) // BY3 = wider barcode
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
 * │ 1.000 kg                     │
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
  const productName = truncate(data.productName.toUpperCase(), 14)
  zpl.push(`^FO8,8^A0N,28,28^FD${escapeZpl(productName)}^FS`)
  zpl.push(`^FO9,8^A0N,28,28^FD${escapeZpl(productName)}^FS`) // Bold

  // Price - right aligned using field block to prevent overflow
  const priceBlockWidth = 130
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
