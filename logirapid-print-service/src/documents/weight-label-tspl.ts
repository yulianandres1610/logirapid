/**
 * Weight Label Generator - TSPL format for TSC/4BARCODE/Chinese label printers
 * TSPL (TSC Printer Language) is widely supported by non-Zebra label printers
 * Sizes: 3x2 inches (76x51mm) and 2x1 inches (51x25mm)
 */

export interface WeightLabelTsplData {
  productName: string
  productSku?: string
  weight: string           // "1.250 kg"
  weightKg: number         // 1.250
  priceCUP: number         // Precio total en CUP
  pricePerUnit?: number    // Precio CUP por unidad (kg/lb)
  unitOfMeasure?: string   // kg, lb, g
  barcode: string          // EAN-13 con peso embebido
  printDate: string        // Fecha de impresion
  labelSize?: '3x2' | '2x1' // Tamano de etiqueta (default: 3x2)
}

/**
 * Generate TSPL code for a weight label - Auto-select by size
 */
export function generateWeightLabelTspl(data: WeightLabelTsplData): Buffer {
  const labelSize = data.labelSize || '3x2'

  if (labelSize === '2x1') {
    return generateWeightLabel2x1Tspl(data)
  }
  return generateWeightLabel3x2Tspl(data)
}

/**
 * Generate TSPL code for a 3x2 inch weight label
 * 3x2 inch (76x51mm) label at 203 DPI (8 dots/mm)
 *
 * Layout:
 * +-----------------------------------------------+
 * | PRECIO/kg              TOTAL        2/2/2026  |
 * | $1,230                 $104,547               |
 * |-----------------------------------------------|
 * | LOMO DE CERDO                    [QR CODE]    |
 * | 85.000 kg                                     |
 * |   ||||||||||||||||||||||||||||||||||||        |
 * |          2 0 2 2 2 0 2  8 5 0 0 0 7           |
 * +-----------------------------------------------+
 */
function generateWeightLabel3x2Tspl(data: WeightLabelTsplData): Buffer {
  const labelWidthMm = 76
  const labelHeightMm = 51
  const labelWidthDots = labelWidthMm * 8  // 608 dots
  const labelHeightDots = labelHeightMm * 8 // 408 dots

  const tspl: string[] = []

  // Setup commands
  tspl.push(`SIZE ${labelWidthMm} mm, ${labelHeightMm} mm`)
  tspl.push('GAP 3 mm, 0 mm')
  tspl.push('DIRECTION 1')
  tspl.push('DENSITY 8')
  tspl.push('CLS')

  const unit = data.unitOfMeasure || 'kg'
  const pricePerUnit = data.pricePerUnit || 0

  // Format prices with $ symbol
  const formattedPricePerUnit = '$' + Math.round(pricePerUnit).toLocaleString('es-ES')
  const formattedTotalPrice = '$' + Math.round(data.priceCUP).toLocaleString('es-ES')

  // ========== ROW 1: Headers ==========
  // PRECIO/unit (left)
  tspl.push(`TEXT 15,10,"2",0,1,1,"PRECIO/${unit}"`)
  // TOTAL (center)
  tspl.push(`TEXT 200,10,"2",0,1,1,"TOTAL"`)
  // Date (right)
  const dateText = data.printDate || new Date().toLocaleDateString('es-ES')
  tspl.push(`TEXT ${labelWidthDots - 100},10,"1",0,1,1,"${dateText}"`)

  // ========== ROW 2: Price Values ==========
  // Price per unit (left, medium)
  tspl.push(`TEXT 15,40,"4",0,1,1,"${escapeTspl(formattedPricePerUnit)}"`)

  // Total price (center-right, LARGE)
  // Using font "5" for larger text if available, otherwise "4"
  tspl.push(`TEXT 180,35,"5",0,1,1,"${escapeTspl(formattedTotalPrice)}"`)

  // ========== Divider line ==========
  tspl.push(`BAR 15,100,${labelWidthDots - 30},3`)

  // ========== Product Name (LEFT, LARGE, bold) ==========
  const productName = truncate(data.productName.toUpperCase(), 18)
  tspl.push(`TEXT 15,115,"4",0,1,1,"${escapeTspl(productName)}"`)

  // ========== Weight (LEFT) ==========
  tspl.push(`TEXT 15,165,"3",0,1,1,"${escapeTspl(data.weight)}"`)

  // ========== QR Code (right side) ==========
  const qrContent = data.productSku || data.barcode
  const qrX = labelWidthDots - 130
  const qrY = 115
  // QRCODE x,y,ECC level,cell width,mode,rotation,"data"
  tspl.push(`QRCODE ${qrX},${qrY},H,5,A,0,"${qrContent}"`)

  // ========== Barcode at BOTTOM ==========
  const barcodeX = 50
  const barcodeY = 240
  // Detect barcode type
  const barcodeType = detectBarcodeType(data.barcode)
  if (barcodeType === 'ean13') {
    tspl.push(`BARCODE ${barcodeX},${barcodeY},"EAN13",100,1,0,3,4,"${data.barcode}"`)
  } else {
    tspl.push(`BARCODE ${barcodeX},${barcodeY},"128",100,1,0,3,4,"${data.barcode}"`)
  }

  // Print command
  tspl.push('PRINT 1,1')

  const tsplContent = tspl.join('\r\n') + '\r\n'
  console.log('[TSPL Generator] Generated Weight Label 3x2":', tsplContent.substring(0, 300) + '...')

  return Buffer.from(tsplContent, 'ascii')
}

/**
 * Generate TSPL code for a 2x1 inch weight label - Compact
 * 2x1 inch (51x25mm) label at 203 DPI (8 dots/mm)
 *
 * Layout:
 * +-------------------------------+
 * | LOMO DE CERDO        $1,230   |
 * | 1.000 kg                      |
 * |   |||||||||||||||||||||||     |
 * |     2000010100X               |
 * +-------------------------------+
 */
function generateWeightLabel2x1Tspl(data: WeightLabelTsplData): Buffer {
  const labelWidthMm = 51
  const labelHeightMm = 25
  const labelWidthDots = labelWidthMm * 8  // 408 dots
  // const labelHeightDots = labelHeightMm * 8 // 200 dots

  const tspl: string[] = []

  // Setup commands
  tspl.push(`SIZE ${labelWidthMm} mm, ${labelHeightMm} mm`)
  tspl.push('GAP 3 mm, 0 mm')
  tspl.push('DIRECTION 1')
  tspl.push('DENSITY 8')
  tspl.push('CLS')

  // Format price with $ symbol
  const formattedTotalPrice = '$' + Math.round(data.priceCUP).toLocaleString('es-ES')

  // ========== ROW 1: Product Name (left) + Price (right) ==========
  const productName = truncate(data.productName.toUpperCase(), 14)
  tspl.push(`TEXT 8,8,"2",0,1,1,"${escapeTspl(productName)}"`)

  // Price - right side
  const priceX = labelWidthDots - 120
  tspl.push(`TEXT ${priceX},5,"3",0,1,1,"${escapeTspl(formattedTotalPrice)}"`)

  // ========== ROW 2: Weight ==========
  tspl.push(`TEXT 8,40,"2",0,1,1,"${escapeTspl(data.weight)}"`)

  // ========== Divider line ==========
  tspl.push(`BAR 8,65,${labelWidthDots - 16},2`)

  // ========== Barcode ==========
  const barcodeX = 25
  const barcodeY = 75
  const barcodeType = detectBarcodeType(data.barcode)
  if (barcodeType === 'ean13') {
    tspl.push(`BARCODE ${barcodeX},${barcodeY},"EAN13",70,1,0,2,3,"${data.barcode}"`)
  } else {
    tspl.push(`BARCODE ${barcodeX},${barcodeY},"128",70,1,0,2,3,"${data.barcode}"`)
  }

  // ========== Date (bottom right, tiny) ==========
  const dateText = data.printDate || new Date().toLocaleDateString('es-ES')
  tspl.push(`TEXT ${labelWidthDots - 80},180,"1",0,1,1,"${dateText}"`)

  // Print command
  tspl.push('PRINT 1,1')

  const tsplContent = tspl.join('\r\n') + '\r\n'
  console.log('[TSPL Generator] Generated Weight Label 2x1":', tsplContent.substring(0, 300) + '...')

  return Buffer.from(tsplContent, 'ascii')
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
 * Truncate text to max length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 2) + '..'
}

/**
 * Escape special characters for TSPL
 */
function escapeTspl(text: string): string {
  return text
    .replace(/"/g, '\\"')
    .replace(/[\x00-\x1F]/g, '') // Remove control characters
}

export type { WeightLabelTsplData as WeightLabelData }
