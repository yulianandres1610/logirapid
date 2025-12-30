/**
 * Lot Label Generator - ZPL format for Zebra printers
 * Used for inventory lot tracking labels (4x6 format)
 * All content centered for professional appearance
 */

export interface LotLabelData {
  lotNumber: string
  supplierName: string
  productName: string
  expirationDate?: string | null
  receptionDate: string
  quantity: number
  unitCost?: number
  sku?: string
  barcode?: string
  warehouseName?: string
}

/**
 * Generate ZPL code for a lot label (4x6 inch format)
 * All content is CENTERED on the label
 */
export function generateLotLabelZpl(data: LotLabelData): Buffer {
  // 4x6 label at 203 DPI
  // 4 inches = 812 dots, 6 inches = 1218 dots
  const labelWidth = 812
  const labelHeight = 1218

  const zpl: string[] = []
  let y = 30

  // Start label
  zpl.push('^XA')
  zpl.push(`^PW${labelWidth}`)
  zpl.push(`^LL${labelHeight}`)
  zpl.push('^PON')
  zpl.push('^LH0,0')
  zpl.push('^CI28')

  // ============================================
  // HEADER - "LOTE / LOT" (centered)
  // ============================================
  zpl.push(`^FO0,${y}^FB${labelWidth},1,0,C,0^A0N,45,45^FDLOTE / LOT^FS`)
  y += 60

  // ============================================
  // LOT NUMBER - VERY LARGE AND CENTERED
  // ============================================

  // Box around lot number (centered)
  const boxWidth = 750
  const boxX = (labelWidth - boxWidth) / 2
  zpl.push(`^FO${boxX},${y}^GB${boxWidth},110,4^FS`)

  // Lot number HUGE and centered
  zpl.push(`^FO0,${y + 15}^FB${labelWidth},1,0,C,0^A0N,75,75^FD${escapeZpl(data.lotNumber)}^FS`)
  y += 130

  // ============================================
  // SUPPLIER - BIGGER (centered)
  // ============================================
  y += 25
  zpl.push(`^FO0,${y}^FB${labelWidth},1,0,C,0^A0N,32,32^FDProveedor^FS`)
  y += 45
  // BIGGER font for supplier name - 65pt
  zpl.push(`^FO0,${y}^FB${labelWidth},1,0,C,0^A0N,65,60^FD${escapeZpl(truncate(data.supplierName, 22))}^FS`)
  y += 80

  // ============================================
  // PRODUCT NAME - BIGGER (centered)
  // ============================================
  zpl.push(`^FO0,${y}^FB${labelWidth},1,0,C,0^A0N,32,32^FDProducto^FS`)
  y += 45
  // BIGGER font for product name - 60pt
  zpl.push(`^FO0,${y}^FB${labelWidth},1,0,C,0^A0N,60,55^FD${escapeZpl(truncate(data.productName, 24))}^FS`)
  y += 75

  // ============================================
  // DIVIDER LINE (centered)
  // ============================================
  y += 10
  const lineWidth = 700
  const lineX = (labelWidth - lineWidth) / 2
  zpl.push(`^FO${lineX},${y}^GB${lineWidth},3,3^FS`)
  y += 25

  // ============================================
  // QUANTITY - BIGGER AND CENTERED
  // ============================================
  zpl.push(`^FO0,${y}^FB${labelWidth},1,0,C,0^A0N,38,38^FDCantidad Recibida^FS`)
  y += 55

  // Quantity in centered box - BIGGER font 70pt
  const qtyBoxWidth = 400
  const qtyBoxX = (labelWidth - qtyBoxWidth) / 2
  zpl.push(`^FO${qtyBoxX},${y}^GB${qtyBoxWidth},100,3^FS`)
  zpl.push(`^FO0,${y + 15}^FB${labelWidth},1,0,C,0^A0N,70,70^FD${data.quantity} uds^FS`)
  y += 120

  // ============================================
  // DATES (centered)
  // ============================================
  const receptionDateStr = formatDate(data.receptionDate)
  zpl.push(`^FO0,${y}^FB${labelWidth},1,0,C,0^A0N,30,30^FDRecepcion: ${receptionDateStr}^FS`)
  y += 40

  if (data.expirationDate) {
    const expDateStr = formatDate(data.expirationDate)
    zpl.push(`^FO0,${y}^FB${labelWidth},1,0,C,0^A0N,32,32^FDVence: ${expDateStr}^FS`)
    y += 45
  }

  // ============================================
  // BARCODE - PERFECTLY CENTERED AT BOTTOM
  // ============================================
  const barcodeY = labelHeight - 180

  // Use ^FO with calculated center position for barcode
  // Code 128 barcode width ≈ (characters * 11 + 35) * moduleWidth
  // For BY3 (module width 3), estimate center position
  const barcodeModuleWidth = 3
  const barcodeCharWidth = 11 * barcodeModuleWidth
  const estimatedBarcodeWidth = (data.lotNumber.length * barcodeCharWidth) + (35 * barcodeModuleWidth)
  const barcodeX = Math.max(20, Math.floor((labelWidth - estimatedBarcodeWidth) / 2))

  zpl.push(`^FO${barcodeX},${barcodeY}^BY${barcodeModuleWidth}^BCN,120,Y,N,N^FD${escapeZpl(data.lotNumber)}^FS`)

  // End label
  zpl.push('^XZ')

  const zplContent = zpl.join('\n')
  console.log('[ZPL Generator] Generated Lot Label ZPL:', zplContent.substring(0, 600) + '...')

  return Buffer.from(zplContent, 'utf8')
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  } catch {
    return dateStr
  }
}

/**
 * Truncate text to max length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
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
