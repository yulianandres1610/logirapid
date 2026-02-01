/**
 * Weight Label Generator - ZPL format for Zebra printers
 * Etiqueta de peso estilo balanza de supermercado
 * Tamaño: 3x2 pulgadas (76x51mm)
 */

export interface WeightLabelData {
  productName: string
  productSku?: string
  weight: string           // "1.250 kg"
  weightKg: number         // 1.250
  priceCUP: number         // Precio en CUP
  pricePerKg?: number      // Precio USD por kg (opcional para referencia)
  barcode: string          // EAN-13 con peso embebido
  barcodeType?: 'ean13' | 'code128'
  printDate: string        // Fecha de impresión
  companyName?: string     // Nombre de la empresa (opcional)
  exchangeRate?: number    // Tasa de cambio (opcional para referencia)
}

/**
 * Generate ZPL code for a weight label
 * 3x2 inch (76x51mm) label at 203 DPI
 * Diseño optimizado para visibilidad de peso y precio
 */
export function generateWeightLabelZpl(data: WeightLabelData): Buffer {
  // 3x2 inch label at 203 DPI
  // 3 inches = 609 dots, 2 inches = 406 dots
  const dpi = 203
  const labelWidth = 609  // 3 inches
  const labelHeight = 406 // 2 inches

  const zpl: string[] = []
  let y = 15

  // Start label
  zpl.push('^XA')
  zpl.push(`^PW${labelWidth}`)
  zpl.push(`^LL${labelHeight}`)
  zpl.push('^PON')
  zpl.push('^LH0,0')
  zpl.push('^CI28') // UTF-8 character set

  // ============================================
  // PRODUCT NAME (top, centered, larger font)
  // ============================================
  const productName = truncate(data.productName, 26)
  zpl.push(`^FO0,${y}^FB${labelWidth},1,0,C,0^A0N,32,32^FD${escapeZpl(productName)}^FS`)
  y += 42

  // SKU line (smaller, centered)
  if (data.productSku) {
    zpl.push(`^FO0,${y}^FB${labelWidth},1,0,C,0^A0N,20,20^FDSKU: ${escapeZpl(data.productSku)}^FS`)
    y += 25
  }

  // ============================================
  // DIVIDER LINE
  // ============================================
  y += 5
  const lineWidth = 550
  const lineX = (labelWidth - lineWidth) / 2
  zpl.push(`^FO${lineX},${y}^GB${lineWidth},2,2^FS`)
  y += 15

  // ============================================
  // WEIGHT - VERY LARGE AND PROMINENT (centered)
  // ============================================
  // Box around weight
  const weightBoxWidth = 400
  const weightBoxX = (labelWidth - weightBoxWidth) / 2
  zpl.push(`^FO${weightBoxX},${y}^GB${weightBoxWidth},70,3^FS`)

  // Weight value - HUGE font (centered)
  zpl.push(`^FO0,${y + 8}^FB${labelWidth},1,0,C,0^A0N,55,55^FD${escapeZpl(data.weight)}^FS`)
  y += 85

  // ============================================
  // PRICE IN CUP - LARGE AND BOLD (centered)
  // ============================================
  // Format price with thousand separators
  const formattedPrice = data.priceCUP.toLocaleString('es-CU')

  // Price box
  const priceBoxWidth = 350
  const priceBoxX = (labelWidth - priceBoxWidth) / 2
  zpl.push(`^FO${priceBoxX},${y}^GB${priceBoxWidth},75,3^FS`)
  // Filled background for price area
  zpl.push(`^FO${priceBoxX + 2},${y + 2}^GB${priceBoxWidth - 4},71,71,B^FS`)

  // Price value - WHITE on black background, large font
  zpl.push(`^FO0,${y + 8}^FB${labelWidth},1,0,C,0^A0N,50,50^FR^FD${formattedPrice}^FS`)
  // CUP label
  zpl.push(`^FO0,${y + 50}^FB${labelWidth},1,0,C,0^A0N,22,22^FR^FDCUP^FS`)
  y += 90

  // ============================================
  // BARCODE - EAN-13 (centered at bottom)
  // ============================================
  const barcodeHeight = 60

  // Calculate barcode position for centering
  // EAN-13 barcode width: approximately 200-250 dots with BY2
  const estimatedBarcodeWidth = 200
  const barcodeX = Math.max(20, Math.floor((labelWidth - estimatedBarcodeWidth) / 2))

  zpl.push(`^FO${barcodeX},${y}^BY2`)
  zpl.push(`^BEN,${barcodeHeight},Y,N^FD${data.barcode}^FS`)
  y += barcodeHeight + 25

  // ============================================
  // DATE (bottom right, small)
  // ============================================
  const dateText = data.printDate || new Date().toLocaleDateString('es-ES')
  zpl.push(`^FO${labelWidth - 130},${labelHeight - 25}^A0N,18,18^FD${dateText}^FS`)

  // Company name (bottom left, small) - optional
  if (data.companyName) {
    const companyShort = truncate(data.companyName, 15)
    zpl.push(`^FO15,${labelHeight - 25}^A0N,16,16^FD${escapeZpl(companyShort)}^FS`)
  }

  // End label
  zpl.push('^XZ')

  const zplContent = zpl.join('\n')
  console.log('[ZPL Generator] Generated Weight Label ZPL (3x2 inch):', zplContent.substring(0, 500) + '...')

  return Buffer.from(zplContent, 'utf8')
}

/**
 * Generate a simple weight label without the inverted price box
 * Alternative design for printers that don't support reverse printing well
 */
export function generateWeightLabelZplSimple(data: WeightLabelData): Buffer {
  const labelWidth = 609
  const labelHeight = 406

  const zpl: string[] = []
  let y = 20

  zpl.push('^XA')
  zpl.push(`^PW${labelWidth}`)
  zpl.push(`^LL${labelHeight}`)
  zpl.push('^PON')
  zpl.push('^LH0,0')
  zpl.push('^CI28')

  // Product name (centered)
  const productName = truncate(data.productName, 28)
  zpl.push(`^FO0,${y}^FB${labelWidth},1,0,C,0^A0N,30,30^FD${escapeZpl(productName)}^FS`)
  y += 40

  // Divider
  zpl.push(`^FO30,${y}^GB${labelWidth - 60},2,2^FS`)
  y += 15

  // Weight - large (centered)
  zpl.push(`^FO0,${y}^FB${labelWidth},1,0,C,0^A0N,50,50^FD${escapeZpl(data.weight)}^FS`)
  y += 65

  // Price in CUP - large (centered)
  const formattedPrice = data.priceCUP.toLocaleString('es-CU')
  zpl.push(`^FO0,${y}^FB${labelWidth},1,0,C,0^A0N,55,55^FD${formattedPrice} CUP^FS`)
  y += 75

  // Barcode EAN-13 (centered)
  const barcodeX = Math.floor((labelWidth - 200) / 2)
  zpl.push(`^FO${barcodeX},${y}^BY2`)
  zpl.push(`^BEN,55,Y,N^FD${data.barcode}^FS`)

  // Date (bottom right)
  zpl.push(`^FO${labelWidth - 120},${labelHeight - 22}^A0N,16,16^FD${data.printDate}^FS`)

  zpl.push('^XZ')

  return Buffer.from(zpl.join('\n'), 'utf8')
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
