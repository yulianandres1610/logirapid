/**
 * Asset Label Generator - ZPL format for Zebra printers
 * ZPL (Zebra Programming Language) is the native format for Zebra printers
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
 * Generate ZPL code for an asset label (2x1 inch)
 * 2x1 inch (51x25mm) label at 203 DPI
 *
 * Layout:
 * ┌─────────────────────────────────────────┐
 * │ SERVIDOR DELL R740        $5,000 USD    │  <- Nombre + Valor
 * │ ASSET-2025-0001           Almacén A1    │  <- Código + Ubicación
 * │ ████████████████████████████████████    │  <- Código de barras Code128
 * │         ASSET20250001                   │  <- Texto del barcode
 * └─────────────────────────────────────────┘
 */
export function generateAssetLabelZpl(data: AssetLabelData): Buffer {
  // Check if 3x2 format requested
  if (data.labelSize === '3x2') {
    return generateAssetLabelZpl3x2(data)
  }

  const dpi = 203
  const dotsPerMm = dpi / 25.4
  const labelWidthMm = 51
  const labelHeightMm = 25
  const labelWidth = Math.round(labelWidthMm * dotsPerMm)  // ~408 dots
  const labelHeight = Math.round(labelHeightMm * dotsPerMm) // ~200 dots
  const margin = 8

  const zpl: string[] = []

  // Setup commands
  zpl.push('^XA')                        // Start format
  zpl.push(`^PW${labelWidth}`)           // Print width
  zpl.push(`^LL${labelHeight}`)          // Label length
  zpl.push('^PON')                       // Print orientation normal
  zpl.push('^LH0,0')                     // Label home position

  // ========== ROW 1: Asset Name (NO price for security) ==========
  const assetName = truncate(data.assetName.toUpperCase(), 25)
  zpl.push(`^FO${margin},${margin}^A0N,20,20^FD${escapeZpl(assetName)}^FS`)

  // ========== ROW 2: Asset Code (left) + Location (right) ==========
  const row2Y = 38
  zpl.push(`^FO${margin},${row2Y}^A0N,18,18^FD${escapeZpl(data.assetCode)}^FS`)

  if (data.location) {
    const locationText = truncate(data.location, 15)
    const locationOffset = 100
    zpl.push(`^FO${labelWidth - locationOffset},${row2Y}^A0N,16,16^FD${escapeZpl(locationText)}^FS`)
  }

  // ========== Divider line ==========
  const lineY = 60
  zpl.push(`^FO${margin},${lineY}^GB${labelWidth - (margin * 2)},1,1^FS`)

  // ========== Barcode (Code128) ==========
  const barcodeData = data.barcode || data.assetCode.replace(/-/g, '')
  const barcodeY = 70
  const barcodeHeight = 50
  const barcodeX = 30

  // ^BCN = Code 128 barcode, N = normal orientation
  // Y = print interpretation line, N = no check digit
  zpl.push(`^FO${barcodeX},${barcodeY}^BY2`)
  zpl.push(`^BCN,${barcodeHeight},Y,N,N^FD${barcodeData}^FS`)

  // End format
  zpl.push('^XZ')

  const zplContent = zpl.join('\n')
  console.log('[ZPL Generator] Generated Asset Label 2x1":', zplContent.substring(0, 300) + '...')

  return Buffer.from(zplContent, 'utf8')
}

/**
 * Generate ZPL code for an asset label with more details (3x2 inch)
 * 3x2 inch (76x51mm) label at 203 DPI
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
export function generateAssetLabelZpl3x2(data: AssetLabelData): Buffer {
  const dpi = 203
  const dotsPerMm = dpi / 25.4
  const labelWidthMm = 76
  const labelHeightMm = 51
  const labelWidth = Math.round(labelWidthMm * dotsPerMm)   // ~608 dots
  const labelHeight = Math.round(labelHeightMm * dotsPerMm) // ~408 dots
  const margin = 15

  const zpl: string[] = []

  // Setup commands
  zpl.push('^XA')
  zpl.push(`^PW${labelWidth}`)
  zpl.push(`^LL${labelHeight}`)
  zpl.push('^PON')
  zpl.push('^LH0,0')

  // ========== ROW 1: Asset Name (LARGE) - moved down ==========
  const assetName = truncate(data.assetName.toUpperCase(), 28)
  zpl.push(`^FO${margin},25^A0N,32,32^FD${escapeZpl(assetName)}^FS`)

  // ========== ROW 2: Category (NO price for security) - moved down ==========
  let row2Y = 65
  if (data.categoryName) {
    const category = truncate(data.categoryName, 30)
    zpl.push(`^FO${margin},${row2Y}^A0N,22,22^FD${escapeZpl(category)}^FS`)
  }

  // ========== Divider line - moved down ==========
  const lineY = 100
  zpl.push(`^FO${margin},${lineY}^GB${labelWidth - (margin * 2)},2,2^FS`)

  // ========== Details Section - moved down ==========
  let yPos = 115

  // Asset Code - BIGGER font (28 instead of 20)
  zpl.push(`^FO${margin},${yPos}^A0N,28,28^FDCodigo: ${escapeZpl(data.assetCode)}^FS`)
  yPos += 35

  // Location
  if (data.location) {
    const location = truncate(`Ubicacion: ${data.location}`, 35)
    zpl.push(`^FO${margin},${yPos}^A0N,22,22^FD${escapeZpl(location)}^FS`)
    yPos += 30
  }

  // Responsible - ALWAYS show, bigger font
  const responsibleText = data.responsibleName || 'Sin asignar'
  const responsible = truncate(`Responsable: ${responsibleText}`, 35)
  zpl.push(`^FO${margin},${yPos}^A0N,24,24^FD${escapeZpl(responsible)}^FS`)
  yPos += 32

  // Serial Number
  if (data.serialNumber) {
    const serial = truncate(`S/N: ${data.serialNumber}`, 35)
    zpl.push(`^FO${margin},${yPos}^A0N,20,20^FD${escapeZpl(serial)}^FS`)
    yPos += 28
  }

  // ========== Barcode (Code128) CENTERED at bottom ==========
  const barcodeData = data.barcode || data.assetCode.replace(/-/g, '')
  // Calculate center position: barcode width is approx chars * 11 modules * moduleWidth
  // For Code128 with BY2, each char ~22 dots, so 13 chars = ~286 dots
  // Center: (608 - 286) / 2 = ~161, but barcode has quiet zones, so use ~120
  const barcodeX = Math.round((labelWidth - 350) / 2)  // Centered
  const barcodeY = Math.max(yPos + 20, 300)
  const barcodeHeight = 65

  zpl.push(`^FO${barcodeX},${barcodeY}^BY2`)
  zpl.push(`^BCN,${barcodeHeight},Y,N,N^FD${barcodeData}^FS`)

  // End format
  zpl.push('^XZ')

  const zplContent = zpl.join('\n')
  console.log('[ZPL Generator] Generated Asset Label 3x2":', zplContent.substring(0, 400) + '...')

  return Buffer.from(zplContent, 'utf8')
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
    .replace(/[\x00-\x1F]/g, '') // Remove control characters
    // Replace accented characters with ASCII equivalents for compatibility
    .replace(/á/gi, 'a')
    .replace(/é/gi, 'e')
    .replace(/í/gi, 'i')
    .replace(/ó/gi, 'o')
    .replace(/ú/gi, 'u')
    .replace(/ñ/gi, 'n')
    .replace(/ü/gi, 'u')
}

export type { AssetLabelData as AssetLabelZplData }
