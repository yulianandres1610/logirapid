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
 *
 * Layout:
 * ┌─────────────────────────────────────────┐
 * │ PRECIO/kg              PRECIO           │
 * │ 1,230                    1,230          │
 * │ CUP                       CUP           │
 * │─────────────────────────────────────────│
 * │ LOMO DE CERDO                           │
 * │ 1.000 kg                     02/02/2026 │
 * │       |||||||||||||||||||||||           │
 * │         2000010100X                     │
 * └─────────────────────────────────────────┘
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
  zpl.push(`^FO20,15^A0N,22,22^FDPRECIO/${unit}^FS`)
  zpl.push(`^FO${labelWidth - 180},15^A0N,22,22^FDPRECIO^FS`)

  // ========== ROW 2: Price Values ==========
  // Left: Price per unit
  zpl.push(`^FO20,42^A0N,40,40^FD${formattedPricePerUnit}^FS`)
  zpl.push(`^FO21,42^A0N,40,40^FD${formattedPricePerUnit}^FS`) // Bold
  zpl.push(`^FO20,85^A0N,20,20^FDCUP^FS`)

  // Right: Total price (LARGE)
  zpl.push(`^FO${labelWidth - 180},38^A0N,70,70^FD${formattedTotalPrice}^FS`)
  zpl.push(`^FO${labelWidth - 179},38^A0N,70,70^FD${formattedTotalPrice}^FS`) // Bold
  zpl.push(`^FO${labelWidth - 178},38^A0N,70,70^FD${formattedTotalPrice}^FS`) // Extra bold
  zpl.push(`^FO${labelWidth - 70},108^A0N,24,24^FDCUP^FS`)

  // ========== Divider line ==========
  zpl.push(`^FO20,140^GB${labelWidth - 40},2,2^FS`)

  // ========== ROW 3: Product Name (bold) ==========
  const productName = truncate(data.productName.toUpperCase(), 30)
  zpl.push(`^FO20,155^A0N,36,36^FD${escapeZpl(productName)}^FS`)
  zpl.push(`^FO21,155^A0N,36,36^FD${escapeZpl(productName)}^FS`) // Bold

  // ========== ROW 4: Weight and Date ==========
  zpl.push(`^FO20,200^A0N,30,30^FD${escapeZpl(data.weight)}^FS`)

  const dateText = data.printDate || new Date().toLocaleDateString('es-ES')
  zpl.push(`^FO${labelWidth - 130},205^A0N,24,24^FD${dateText}^FS`)

  // ========== ROW 5: Barcode (centered) ==========
  const barcodeX = Math.floor((labelWidth - 220) / 2)
  zpl.push(`^FO${barcodeX},250^BY2`)
  zpl.push(`^BEN,70,Y,N^FD${data.barcode}^FS`)

  // ========== SKU (optional, bottom left) ==========
  if (data.productSku) {
    zpl.push(`^FO20,${labelHeight - 25}^A0N,18,18^FD${escapeZpl(data.productSku)}^FS`)
  }

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
  const productName = truncate(data.productName.toUpperCase(), 18)
  zpl.push(`^FO10,8^A0N,24,24^FD${escapeZpl(productName)}^FS`)
  zpl.push(`^FO11,8^A0N,24,24^FD${escapeZpl(productName)}^FS`) // Bold

  // Price - right aligned, large
  zpl.push(`^FO${labelWidth - 100},5^A0N,36,36^FD${formattedTotalPrice}^FS`)
  zpl.push(`^FO${labelWidth - 99},5^A0N,36,36^FD${formattedTotalPrice}^FS`) // Bold

  // ========== ROW 2: Weight (left) + CUP label (right) ==========
  zpl.push(`^FO10,40^A0N,22,22^FD${escapeZpl(data.weight)}^FS`)
  zpl.push(`^FO${labelWidth - 45},42^A0N,18,18^FDCUP^FS`)

  // ========== Divider line ==========
  zpl.push(`^FO10,65^GB${labelWidth - 20},1,1^FS`)

  // ========== ROW 3: Barcode (centered) ==========
  const barcodeX = Math.floor((labelWidth - 180) / 2)
  zpl.push(`^FO${barcodeX},75^BY1.5`)
  zpl.push(`^BEN,50,Y,N^FD${data.barcode}^FS`)

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
