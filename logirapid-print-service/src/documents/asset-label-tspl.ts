/**
 * Asset Label Generator - TSPL format for TSC/4BARCODE/Chinese label printers
 * TSPL (TSC Printer Language) is widely supported by non-Zebra label printers
 * Size: 2x1 inches (51x25mm) with Code128 barcode
 */

export interface AssetLabelData {
  assetCode: string        // "ASSET-2025-0001"
  assetName: string        // "Servidor Dell R740"
  barcode: string          // "ASSET20250001" (sin guiones para barcode)
  location?: string        // "Almacén A1"
  value?: number           // 5000
  currency?: string        // "USD"
  responsibleName?: string // "Juan Pérez" (opcional)
  categoryName?: string    // "Equipos de Cómputo"
  serialNumber?: string    // "SN123456"
  labelSize?: '2x1' | '3x2' // Label size, defaults to 2x1
}

/**
 * Generate TSPL code for an asset label (2x1 inch)
 * 2x1 inch (51x25mm) label at 203 DPI (8 dots/mm)
 *
 * Layout:
 * ┌─────────────────────────────────────────┐
 * │ SERVIDOR DELL R740        $5,000 USD    │  <- Nombre + Valor
 * │ ASSET-2025-0001           Almacén A1    │  <- Código + Ubicación
 * │ ████████████████████████████████████    │  <- Código de barras Code128
 * │         ASSET20250001                   │  <- Texto del barcode
 * └─────────────────────────────────────────┘
 */
export function generateAssetLabelTspl(data: AssetLabelData): Buffer {
  // Check if 3x2 format requested
  if (data.labelSize === '3x2') {
    return generateAssetLabelTspl3x2(data)
  }

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

  // ========== ROW 1: Asset Name (left) + Value (right) ==========
  const assetName = truncate(data.assetName.toUpperCase(), 18)
  tspl.push(`TEXT 8,5,"2",0,1,1,"${escapeTspl(assetName)}"`)

  // Value - right side (if provided)
  if (data.value && data.value > 0) {
    const currency = data.currency || 'USD'
    const formattedValue = `$${Math.round(data.value).toLocaleString('es-ES')} ${currency}`
    const valueX = labelWidthDots - 10 - (formattedValue.length * 7)
    tspl.push(`TEXT ${Math.max(valueX, 200)},5,"1",0,1,1,"${escapeTspl(formattedValue)}"`)
  }

  // ========== ROW 2: Asset Code (left) + Location (right) ==========
  tspl.push(`TEXT 8,30,"2",0,1,1,"${escapeTspl(data.assetCode)}"`)

  if (data.location) {
    const locationText = truncate(data.location, 15)
    const locationX = labelWidthDots - 10 - (locationText.length * 7)
    tspl.push(`TEXT ${Math.max(locationX, 220)},30,"1",0,1,1,"${escapeTspl(locationText)}"`)
  }

  // ========== Divider line ==========
  tspl.push(`BAR 8,55,${labelWidthDots - 16},1`)

  // ========== Barcode (Code128) ==========
  // Use Code128 for alphanumeric barcode (asset code without dashes)
  const barcodeData = data.barcode || data.assetCode.replace(/-/g, '')
  const barcodeX = 40
  const barcodeY = 65

  // Code128 barcode with human readable text below
  // BARCODE x,y,"code type",height,human readable,rotation,narrow,wide,"data"
  // narrow=2, wide=2 for standard Code128
  tspl.push(`BARCODE ${barcodeX},${barcodeY},"128",80,1,0,2,2,"${barcodeData}"`)

  // Print command
  tspl.push('PRINT 1,1')

  const tsplContent = tspl.join('\r\n') + '\r\n'
  console.log('[TSPL Generator] Generated Asset Label 2x1":', tsplContent.substring(0, 300) + '...')

  return Buffer.from(tsplContent, 'ascii')
}

/**
 * Generate TSPL code for an asset label with more details (3x2 inch)
 * 3x2 inch (76x51mm) label at 203 DPI (8 dots/mm)
 *
 * Layout:
 * +-----------------------------------------------+
 * | SERVIDOR DELL POWEREDGE R740                  |
 * | $5,000 USD                    Equipos Cómputo |
 * |-----------------------------------------------|
 * | Código: ASSET-2025-0001                       |
 * | Ubicación: Almacén Central / Rack A3          |
 * | Responsable: Juan Pérez                       |
 * | S/N: SN123456789                              |
 * |   ||||||||||||||||||||||||||||||||||||        |
 * |          ASSET20250001                        |
 * +-----------------------------------------------+
 */
export function generateAssetLabelTspl3x2(data: AssetLabelData): Buffer {
  const labelWidthMm = 76
  const labelHeightMm = 51
  const labelWidthDots = labelWidthMm * 8  // 608 dots
  // const labelHeightDots = labelHeightMm * 8 // 408 dots

  const tspl: string[] = []

  // Setup commands
  tspl.push(`SIZE ${labelWidthMm} mm, ${labelHeightMm} mm`)
  tspl.push('GAP 3 mm, 0 mm')
  tspl.push('DIRECTION 1')
  tspl.push('DENSITY 8')
  tspl.push('CLS')

  // ========== ROW 1: Asset Name (LARGE) ==========
  const assetName = truncate(data.assetName.toUpperCase(), 28)
  tspl.push(`TEXT 15,10,"4",0,1,1,"${escapeTspl(assetName)}"`)

  // ========== ROW 2: Value + Category ==========
  if (data.value && data.value > 0) {
    const currency = data.currency || 'USD'
    const formattedValue = `$${Math.round(data.value).toLocaleString('es-ES')} ${currency}`
    tspl.push(`TEXT 15,50,"3",0,1,1,"${escapeTspl(formattedValue)}"`)
  }

  if (data.categoryName) {
    const category = truncate(data.categoryName, 18)
    tspl.push(`TEXT ${labelWidthDots - 200},50,"2",0,1,1,"${escapeTspl(category)}"`)
  }

  // ========== Divider line ==========
  tspl.push(`BAR 15,85,${labelWidthDots - 30},2`)

  // ========== Details Section ==========
  let yPos = 95

  // Asset Code
  tspl.push(`TEXT 15,${yPos},"2",0,1,1,"Codigo: ${escapeTspl(data.assetCode)}"`)
  yPos += 30

  // Location
  if (data.location) {
    const location = truncate(`Ubicacion: ${data.location}`, 35)
    tspl.push(`TEXT 15,${yPos},"2",0,1,1,"${escapeTspl(location)}"`)
    yPos += 30
  }

  // Responsible
  if (data.responsibleName) {
    const responsible = truncate(`Responsable: ${data.responsibleName}`, 35)
    tspl.push(`TEXT 15,${yPos},"2",0,1,1,"${escapeTspl(responsible)}"`)
    yPos += 30
  }

  // Serial Number
  if (data.serialNumber) {
    const serial = truncate(`S/N: ${data.serialNumber}`, 35)
    tspl.push(`TEXT 15,${yPos},"1",0,1,1,"${escapeTspl(serial)}"`)
    yPos += 25
  }

  // ========== Barcode (Code128) at bottom ==========
  const barcodeData = data.barcode || data.assetCode.replace(/-/g, '')
  const barcodeX = 80
  const barcodeY = Math.max(yPos + 10, 280)

  tspl.push(`BARCODE ${barcodeX},${barcodeY},"128",90,1,0,3,3,"${barcodeData}"`)

  // Print command
  tspl.push('PRINT 1,1')

  const tsplContent = tspl.join('\r\n') + '\r\n'
  console.log('[TSPL Generator] Generated Asset Label 3x2":', tsplContent.substring(0, 400) + '...')

  return Buffer.from(tsplContent, 'ascii')
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
    // Replace accented characters with ASCII equivalents
    .replace(/á/gi, 'a')
    .replace(/é/gi, 'e')
    .replace(/í/gi, 'i')
    .replace(/ó/gi, 'o')
    .replace(/ú/gi, 'u')
    .replace(/ñ/gi, 'n')
    .replace(/ü/gi, 'u')
}

export type { AssetLabelData as AssetLabelTsplData }
