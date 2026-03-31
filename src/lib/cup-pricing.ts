/**
 * CUP Pricing Utilities
 *
 * In Cuba, CUP (Cuban Peso) prices must be:
 * - Whole integers (no decimals)
 * - Multiples of 10 (500, 510, 520, etc.)
 *
 * To achieve exact CUP prices, USD prices need 4 decimal places.
 *
 * Example flow:
 * 1. Admin sets desired CUP price: 510 CUP
 * 2. Current rate: 400 CUP/USD
 * 3. System calculates: 510 / 400 = 1.2750 USD
 * 4. When selling: 1.2750 * 400 = 510 CUP (exact!)
 */

/**
 * Convert CUP price to USD with 4 decimal precision
 * Use this when setting product prices from a desired CUP amount
 *
 * @param priceCUP - Price in CUP (should be multiple of 10)
 * @param rate - Exchange rate (CUP per USD)
 * @returns USD price with 4 decimal places
 *
 * @example
 * cupToUSD(510, 400) // returns 1.2750
 * cupToUSD(1000, 400) // returns 2.5000
 */
export function cupToUSD(priceCUP: number, rate: number): number {
  if (rate <= 0) return 0
  // Round to 4 decimal places
  return Math.round((priceCUP / rate) * 10000) / 10000
}

/**
 * Convert USD price to CUP, rounded to nearest integer
 * Use this for displaying prices at point of sale
 *
 * @param priceUSD - Price in USD
 * @param rate - Exchange rate (CUP per USD)
 * @returns CUP price as integer
 *
 * @example
 * usdToCUP(1.2750, 400) // returns 510
 * usdToCUP(2.50, 400) // returns 1000
 */
export function usdToCUP(priceUSD: number, rate: number): number {
  return Math.round(priceUSD * rate)
}

/**
 * Convert USD price to CUP, rounded to nearest multiple of 10
 * Use this when you need CUP amounts to be "cash friendly"
 *
 * @param priceUSD - Price in USD
 * @param rate - Exchange rate (CUP per USD)
 * @returns CUP price rounded to nearest 10
 *
 * @example
 * usdToCUPRounded10(1.2750, 400) // returns 510
 * usdToCUPRounded10(1.28, 400) // returns 510 (512 rounded)
 */
export function usdToCUPRounded10(priceUSD: number, rate: number): number {
  const exact = priceUSD * rate
  return Math.round(exact / 10) * 10
}

/**
 * Format USD amount with 2 decimal places (display)
 * Backend stores full precision but UI shows 2 decimals
 *
 * @param amount - USD amount
 * @returns Formatted string like "$1.28"
 */
export function formatUSD4(amount: number): string {
  return `$${amount.toFixed(2)}`
}

/**
 * Format USD amount with 2 decimal places (standard display)
 *
 * @param amount - USD amount
 * @returns Formatted string like "$1.28"
 */
export function formatUSD2(amount: number): string {
  return `$${amount.toFixed(2)}`
}

/**
 * Format CUP amount as integer (no decimals)
 *
 * @param amount - CUP amount
 * @returns Formatted string like "$510 CUP" or "$1,530 CUP"
 */
export function formatCUP(amount: number): string {
  const rounded = Math.round(amount)
  return `$${rounded.toLocaleString('es-ES')} CUP`
}

/**
 * Format CUP amount as integer without currency suffix
 *
 * @param amount - CUP amount
 * @returns Formatted string like "$510" or "$1,530"
 */
export function formatCUPShort(amount: number): string {
  const rounded = Math.round(amount)
  return `$${rounded.toLocaleString('es-ES')}`
}

/**
 * Validate that a CUP price is a valid multiple of 10
 *
 * @param price - CUP price to validate
 * @returns true if price is integer and multiple of 10
 */
export function isValidCUPPrice(price: number): boolean {
  return Number.isInteger(price) && price % 10 === 0 && price >= 0
}

/**
 * Round a CUP price to the nearest multiple of 10
 *
 * @param price - CUP price
 * @returns Price rounded to nearest 10
 */
export function roundToCUP10(price: number): number {
  return Math.round(price / 10) * 10
}

/**
 * Calculate the exact USD price needed for a target CUP price
 * and validate the result
 *
 * @param targetCUP - Desired CUP price (should be multiple of 10)
 * @param rate - Exchange rate (CUP per USD)
 * @returns Object with USD price and validation
 */
export function calculatePriceFromCUP(
  targetCUP: number,
  rate: number
): {
  usdPrice: number
  cupPrice: number
  isExact: boolean
  formatted: {
    usd: string
    cup: string
  }
} {
  const usdPrice = cupToUSD(targetCUP, rate)
  const cupPrice = usdToCUP(usdPrice, rate)
  const isExact = cupPrice === targetCUP

  return {
    usdPrice,
    cupPrice,
    isExact,
    formatted: {
      usd: formatUSD4(usdPrice),
      cup: formatCUP(cupPrice)
    }
  }
}

/**
 * Calculate cart total in both USD and CUP
 *
 * @param items - Array of cart items with unitPrice and quantity
 * @param rate - Exchange rate (CUP per USD)
 * @returns Totals in both currencies
 */
export function calculateCartTotals(
  items: Array<{ unitPrice: number; quantity: number; discountAmount?: number }>,
  rate: number
): {
  totalUSD: number
  totalCUP: number
  formatted: {
    usd: string
    cup: string
  }
} {
  const totalUSD = items.reduce((sum, item) => {
    const lineTotal = item.unitPrice * item.quantity
    const discount = item.discountAmount || 0
    return sum + lineTotal - discount
  }, 0)

  const totalCUP = Math.round(totalUSD * rate)

  return {
    totalUSD,
    totalCUP,
    formatted: {
      usd: formatUSD2(totalUSD),
      cup: formatCUPShort(totalCUP)
    }
  }
}
