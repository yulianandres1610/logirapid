/**
 * Weight Label Generator - ZPL format for Zebra printers
 * Diseño estilo Publix - Simple y limpio
 * Tamaño: 3x2 pulgadas (76x51mm)
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
}

/**
 * Generate ZPL code for a weight label - Publix style (simple)
 * 3x2 inch (76x51mm) label at 203 DPI
 *
 * Layout:
 * ┌─────────────────────────────────────────┐
 * │ PRECIO/kg              PRECIO           │
 * │ 1,230 CUP               1,230           │
 * │                          CUP            │
 * │─────────────────────────────────────────│
 * │ LOMO DE CERDO                           │
 * │ 1.000 kg                     02/02/2026 │
 * │                                         │
 * │       |||||||||||||||||||||||           │
 * │         2000010100X                     │
 * └─────────────────────────────────────────┘
 */
export function generateWeightLabelZpl(data: WeightLabelData): Buffer {
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
  // Left: "PRECIO/kg"
  zpl.push(`^FO20,15^A0N,22,22^FDPRECIO/${unit}^FS`)
  // Right: "PRECIO"
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
  console.log('[ZPL Generator] Generated Weight Label (Publix style):', zplContent.substring(0, 300) + '...')

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
