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
 * Generate ZPL code for a weight label
 * 3x2 inch (76x51mm) label at 203 DPI
 * Diseño optimizado para visibilidad de peso y precio
 * Muestra: Peso (bold), Precio USD, Precio CUP (bold)
 */
export function generateWeightLabelZpl(data: WeightLabelData): Buffer {
  // 3x2 inch label at 203 DPI
  // 3 inches = 609 dots, 2 inches = 406 dots
  const labelWidth = 609  // 3 inches
  const labelHeight = 406 // 2 inches

  const zpl: string[] = []
  let y = 10

  // Start label
  zpl.push('^XA')
  zpl.push(`^PW${labelWidth}`)
  zpl.push(`^LL${labelHeight}`)
  zpl.push('^PON')
  zpl.push('^LH0,0')
  zpl.push('^CI28') // UTF-8 character set

  // ============================================
  // PRODUCT NAME (top, centered)
  // ============================================
  const productName = truncate(data.productName, 28)
  zpl.push(`^FO0,${y}^FB${labelWidth},1,0,C,0^A0N,28,28^FD${escapeZpl(productName)}^FS`)
  y += 32

  // ============================================
  // DIVIDER LINE
  // ============================================
  const lineWidth = 580
  const lineX = (labelWidth - lineWidth) / 2
  zpl.push(`^FO${lineX},${y}^GB${lineWidth},2,2^FS`)
  y += 10

  // ============================================
  // WEIGHT - VERY LARGE AND BOLD (centered)
  // Using double-print technique for bold effect
  // ============================================
  const weightBoxWidth = 380
  const weightBoxX = (labelWidth - weightBoxWidth) / 2
  zpl.push(`^FO${weightBoxX},${y}^GB${weightBoxWidth},55,3^FS`)

  // Weight value - BOLD (print twice with offset for bold effect)
  const weightText = escapeZpl(data.weight)
  zpl.push(`^FO0,${y + 5}^FB${labelWidth},1,0,C,0^A0N,45,45^FD${weightText}^FS`)
  zpl.push(`^FO1,${y + 5}^FB${labelWidth},1,0,C,0^A0N,45,45^FD${weightText}^FS`) // Bold offset
  y += 65

  // ============================================
  // PRICES SECTION - Two columns
  // Left: USD | Right: CUP
  // ============================================
  const colWidth = labelWidth / 2

  // Calculate USD price
  const priceUSD = data.priceUSD || (data.pricePerKg ? data.pricePerKg * data.weightKg : 0)
  const formattedUSD = priceUSD.toFixed(2)

  // Calculate price per unit in USD
  const pricePerUnit = data.pricePerKg || 0
  const unit = data.unitOfMeasure || 'kg'

  // Format CUP price with thousand separators
  const formattedCUP = data.priceCUP.toLocaleString('es-CU')

  // ---- USD PRICE (left side) ----
  // Header
  zpl.push(`^FO10,${y}^A0N,18,18^FDPRECIO USD^FS`)

  // USD Total - BOLD
  zpl.push(`^FO10,${y + 22}^A0N,38,38^FD$${formattedUSD}^FS`)
  zpl.push(`^FO11,${y + 22}^A0N,38,38^FD$${formattedUSD}^FS`) // Bold offset

  // Price per kg (base price)
  zpl.push(`^FO10,${y + 62}^A0N,16,16^FD$${pricePerUnit.toFixed(2)}/${unit}^FS`)

  // ---- CUP PRICE (right side, with black background) ----
  const cupBoxX = colWidth + 10
  const cupBoxWidth = colWidth - 25
  const cupBoxHeight = 80

  // Black box background
  zpl.push(`^FO${cupBoxX},${y}^GB${cupBoxWidth},${cupBoxHeight},${cupBoxHeight},B^FS`)

  // CUP Header - WHITE text
  zpl.push(`^FO${cupBoxX},${y + 5}^FB${cupBoxWidth},1,0,C,0^A0N,16,16^FR^FDPRECIO CUP^FS`)

  // CUP Total - WHITE, BOLD (double print)
  zpl.push(`^FO${cupBoxX},${y + 25}^FB${cupBoxWidth},1,0,C,0^A0N,42,42^FR^FD${formattedCUP}^FS`)
  zpl.push(`^FO${cupBoxX + 1},${y + 25}^FB${cupBoxWidth},1,0,C,0^A0N,42,42^FR^FD${formattedCUP}^FS`) // Bold

  // Price per unit in CUP
  const pricePerUnitCUP = data.pricePerUnit || Math.round(pricePerUnit * (data.exchangeRate || 1))
  zpl.push(`^FO${cupBoxX},${y + 62}^FB${cupBoxWidth},1,0,C,0^A0N,14,14^FR^FD${pricePerUnitCUP.toLocaleString('es-CU')} CUP/${unit}^FS`)

  y += 90

  // ============================================
  // BARCODE - EAN-13 (centered at bottom)
  // ============================================
  const barcodeHeight = 50

  // Calculate barcode position for centering
  const estimatedBarcodeWidth = 200
  const barcodeX = Math.max(20, Math.floor((labelWidth - estimatedBarcodeWidth) / 2))

  zpl.push(`^FO${barcodeX},${y}^BY2`)
  zpl.push(`^BEN,${barcodeHeight},Y,N^FD${data.barcode}^FS`)
  y += barcodeHeight + 20

  // ============================================
  // DATE (bottom right, small)
  // ============================================
  const dateText = data.printDate || new Date().toLocaleDateString('es-ES')
  zpl.push(`^FO${labelWidth - 120},${labelHeight - 22}^A0N,16,16^FD${dateText}^FS`)

  // Company name (bottom left, small) - optional
  if (data.companyName) {
    const companyShort = truncate(data.companyName, 18)
    zpl.push(`^FO10,${labelHeight - 22}^A0N,14,14^FD${escapeZpl(companyShort)}^FS`)
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
 * Muestra: Peso (bold), USD, CUP (bold)
 */
export function generateWeightLabelZplSimple(data: WeightLabelData): Buffer {
  const labelWidth = 609
  const labelHeight = 406

  const zpl: string[] = []
  let y = 15

  zpl.push('^XA')
  zpl.push(`^PW${labelWidth}`)
  zpl.push(`^LL${labelHeight}`)
  zpl.push('^PON')
  zpl.push('^LH0,0')
  zpl.push('^CI28')

  // Product name (centered)
  const productName = truncate(data.productName, 28)
  zpl.push(`^FO0,${y}^FB${labelWidth},1,0,C,0^A0N,26,26^FD${escapeZpl(productName)}^FS`)
  y += 32

  // Divider
  zpl.push(`^FO30,${y}^GB${labelWidth - 60},2,2^FS`)
  y += 12

  // Weight - BOLD (double print)
  const weightText = escapeZpl(data.weight)
  zpl.push(`^FO0,${y}^FB${labelWidth},1,0,C,0^A0N,48,48^FD${weightText}^FS`)
  zpl.push(`^FO1,${y}^FB${labelWidth},1,0,C,0^A0N,48,48^FD${weightText}^FS`) // Bold
  y += 55

  // Calculate USD price
  const priceUSD = data.priceUSD || (data.pricePerKg ? data.pricePerKg * data.weightKg : 0)
  const pricePerUnit = data.pricePerKg || 0
  const unit = data.unitOfMeasure || 'kg'

  // Price USD line
  zpl.push(`^FO0,${y}^FB${labelWidth},1,0,C,0^A0N,32,32^FD$${priceUSD.toFixed(2)} USD^FS`)
  zpl.push(`^FO1,${y}^FB${labelWidth},1,0,C,0^A0N,32,32^FD$${priceUSD.toFixed(2)} USD^FS`) // Bold
  y += 38

  // Base price per unit
  zpl.push(`^FO0,${y}^FB${labelWidth},1,0,C,0^A0N,18,18^FD($${pricePerUnit.toFixed(2)}/${unit})^FS`)
  y += 25

  // Price in CUP - BOLD (double print)
  const formattedPrice = data.priceCUP.toLocaleString('es-CU')
  zpl.push(`^FO0,${y}^FB${labelWidth},1,0,C,0^A0N,45,45^FD${formattedPrice} CUP^FS`)
  zpl.push(`^FO1,${y}^FB${labelWidth},1,0,C,0^A0N,45,45^FD${formattedPrice} CUP^FS`) // Bold
  y += 55

  // Barcode EAN-13 (centered)
  const barcodeX = Math.floor((labelWidth - 200) / 2)
  zpl.push(`^FO${barcodeX},${y}^BY2`)
  zpl.push(`^BEN,50,Y,N^FD${data.barcode}^FS`)

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
