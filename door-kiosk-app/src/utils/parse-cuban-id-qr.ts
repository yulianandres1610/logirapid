/**
 * Parser for Cuban Identity Card QR code
 *
 * QR Format:
 * N:IDALMISA
 * A:GARCIA GONZALEZ
 * CI:83021616257
 * FV:ADN776657
 */

export interface CubanIdQrData {
  fullName: string       // "IDALMISA GARCIA GONZALEZ"
  firstName: string      // "IDALMISA"
  lastNames: string      // "GARCIA GONZALEZ"
  idNumber: string       // "83021616257"
  dateOfBirth: string    // "1983-02-16" (ISO)
  validationCode: string // "ADN776657"
  isValid: boolean
}

/**
 * Parse the date of birth from the CI number.
 * First 6 digits: YYMMDD
 * Year logic: >30 → 19XX, ≤30 → 20XX
 */
function parseDobFromCi(ci: string): string | null {
  if (ci.length < 6) return null

  const yy = parseInt(ci.substring(0, 2), 10)
  const mm = ci.substring(2, 4)
  const dd = ci.substring(4, 6)

  if (isNaN(yy) || isNaN(parseInt(mm)) || isNaN(parseInt(dd))) return null

  const year = yy > 30 ? 1900 + yy : 2000 + yy
  const month = parseInt(mm, 10)
  const day = parseInt(dd, 10)

  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  return `${year}-${mm}-${dd}`
}

/**
 * Detect if a scanned text is a Cuban ID QR code.
 * Looks for N: and CI: fields.
 */
export function isCubanIdQr(text: string): boolean {
  if (!text || text.length < 10) return false
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean)

  let hasN = false
  let hasCI = false

  for (const line of lines) {
    if (line.startsWith('N:')) hasN = true
    if (line.startsWith('CI:')) hasCI = true
  }

  return hasN && hasCI
}

/**
 * Convert ALL CAPS name to Title Case.
 */
function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase())
}

/**
 * Parse a Cuban ID QR code string into structured data.
 * Returns null if the format is invalid.
 */
export function parseCubanIdQr(raw: string): CubanIdQrData | null {
  if (!raw) return null

  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean)

  const fields: Record<string, string> = {}

  for (const line of lines) {
    const colonIdx = line.indexOf(':')
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim().toUpperCase()
      const value = line.substring(colonIdx + 1).trim()
      fields[key] = value
    }
  }

  const firstName = toTitleCase(fields['N'] || '')
  const lastNames = toTitleCase(fields['A'] || '')
  const idNumber = fields['CI'] || ''
  const validationCode = fields['FV'] || ''

  if (!firstName || !idNumber) return null

  if (!/^\d{11}$/.test(idNumber)) return null

  const dateOfBirth = parseDobFromCi(idNumber)

  return {
    fullName: `${firstName} ${lastNames}`.trim(),
    firstName,
    lastNames,
    idNumber,
    dateOfBirth: dateOfBirth || '',
    validationCode,
    isValid: !!dateOfBirth && !!firstName && !!idNumber
  }
}
