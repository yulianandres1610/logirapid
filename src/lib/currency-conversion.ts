/**
 * Currency Conversion Utilities for LogiRapid
 * Converts between USD, CUP, and MLC using ElToque rates
 */

export type SupportedCurrency = 'USD' | 'CUP' | 'MLC'

export interface ExchangeRates {
  USD_CUP: number  // How many CUP per 1 USD
  USD_MLC: number  // How many MLC per 1 USD
}

export interface ConversionResult {
  originalAmount: number
  originalCurrency: SupportedCurrency
  convertedAmount: number
  targetCurrency: SupportedCurrency
  rate: number
  rateDescription: string
}

// Default fallback rates if API fails
export const DEFAULT_RATES: ExchangeRates = {
  USD_CUP: 400,
  USD_MLC: 1.10
}

/**
 * Convert an amount from one currency to USD
 * @param amount - The amount to convert
 * @param fromCurrency - Source currency
 * @param rates - Exchange rates object
 * @returns Conversion result with details
 */
export function convertToUSD(
  amount: number,
  fromCurrency: SupportedCurrency,
  rates: ExchangeRates = DEFAULT_RATES
): ConversionResult {
  let convertedAmount: number
  let rate: number
  let rateDescription: string

  switch (fromCurrency) {
    case 'USD':
      convertedAmount = amount
      rate = 1
      rateDescription = '1 USD = 1 USD'
      break

    case 'CUP':
      rate = rates.USD_CUP || DEFAULT_RATES.USD_CUP
      convertedAmount = amount / rate
      rateDescription = `1 USD = ${rate.toLocaleString()} CUP`
      break

    case 'MLC':
      rate = rates.USD_MLC || DEFAULT_RATES.USD_MLC
      convertedAmount = amount / rate
      rateDescription = `1 USD = ${rate.toFixed(2)} MLC`
      break

    default:
      convertedAmount = amount
      rate = 1
      rateDescription = 'Unknown currency'
  }

  return {
    originalAmount: amount,
    originalCurrency: fromCurrency,
    // No redondear - mantener precisión completa para cálculos exactos
    convertedAmount: convertedAmount,
    targetCurrency: 'USD',
    rate,
    rateDescription
  }
}

/**
 * Convert an amount from USD to another currency
 * @param amountUSD - The USD amount to convert
 * @param toCurrency - Target currency
 * @param rates - Exchange rates object
 * @returns Conversion result with details
 */
export function convertFromUSD(
  amountUSD: number,
  toCurrency: SupportedCurrency,
  rates: ExchangeRates = DEFAULT_RATES
): ConversionResult {
  let convertedAmount: number
  let rate: number
  let rateDescription: string

  switch (toCurrency) {
    case 'USD':
      convertedAmount = amountUSD
      rate = 1
      rateDescription = '1 USD = 1 USD'
      break

    case 'CUP':
      rate = rates.USD_CUP || DEFAULT_RATES.USD_CUP
      convertedAmount = amountUSD * rate
      rateDescription = `1 USD = ${rate.toLocaleString()} CUP`
      break

    case 'MLC':
      rate = rates.USD_MLC || DEFAULT_RATES.USD_MLC
      convertedAmount = amountUSD * rate
      rateDescription = `1 USD = ${rate.toFixed(2)} MLC`
      break

    default:
      convertedAmount = amountUSD
      rate = 1
      rateDescription = 'Unknown currency'
  }

  return {
    originalAmount: amountUSD,
    originalCurrency: 'USD',
    // No redondear - mantener precisión completa para cálculos exactos
    convertedAmount: convertedAmount,
    targetCurrency: toCurrency,
    rate,
    rateDescription
  }
}

/**
 * Convert all items in an OCR result to USD
 * @param items - Array of items with unitCost and totalCost
 * @param fromCurrency - Source currency
 * @param rates - Exchange rates object
 * @returns Items with converted prices
 */
export function convertOcrItemsToUSD<T extends { unitCost: number; totalCost: number }>(
  items: T[],
  fromCurrency: SupportedCurrency,
  rates: ExchangeRates = DEFAULT_RATES
): (T & { originalUnitCost: number; originalTotalCost: number; originalCurrency: SupportedCurrency })[] {
  if (fromCurrency === 'USD') {
    return items.map(item => ({
      ...item,
      originalUnitCost: item.unitCost,
      originalTotalCost: item.totalCost,
      originalCurrency: 'USD' as SupportedCurrency
    }))
  }

  return items.map(item => {
    const unitCostConversion = convertToUSD(item.unitCost, fromCurrency, rates)
    const totalCostConversion = convertToUSD(item.totalCost, fromCurrency, rates)

    return {
      ...item,
      originalUnitCost: item.unitCost,
      originalTotalCost: item.totalCost,
      originalCurrency: fromCurrency,
      unitCost: unitCostConversion.convertedAmount,
      totalCost: totalCostConversion.convertedAmount
    }
  })
}

/**
 * Format currency for display
 * @param amount - Amount to format
 * @param currency - Currency type
 * @returns Formatted string
 */
export function formatCurrency(amount: number, currency: SupportedCurrency): string {
  switch (currency) {
    case 'USD':
      return `$${amount.toFixed(2)} USD`
    case 'CUP':
      return `$${Math.round(amount).toLocaleString()} CUP`
    case 'MLC':
      return `$${amount.toFixed(2)} MLC`
    default:
      return `$${amount.toFixed(2)}`
  }
}

/**
 * Calculate suggested selling price with margin
 * @param costPrice - Cost price in USD
 * @param marginPercent - Margin percentage (default 4%)
 * @returns Suggested selling price
 */
export function calculateSuggestedPrice(costPrice: number, marginPercent: number = 4): number {
  // No redondear - mantener precisión completa
  return costPrice * (1 + marginPercent / 100)
}

/**
 * Calculate healthy/recommended selling price with 40% margin
 * @param costPrice - Cost price in USD
 * @returns Healthy selling price
 */
export function calculateHealthyPrice(costPrice: number): number {
  return calculateSuggestedPrice(costPrice, 40)
}

/**
 * Calculate margin percentage
 * @param costPrice - Cost price
 * @param sellingPrice - Selling price
 * @returns Margin percentage
 */
export function calculateMargin(costPrice: number, sellingPrice: number): number {
  if (costPrice === 0) return 0
  return ((sellingPrice - costPrice) / costPrice) * 100
}

/**
 * Check if margin is below recommended (40%)
 * @param costPrice - Cost price
 * @param sellingPrice - Selling price
 * @param recommendedMargin - Recommended margin (default 40%)
 * @returns true if margin is below recommended
 */
export function isLowMargin(
  costPrice: number,
  sellingPrice: number,
  recommendedMargin: number = 40
): boolean {
  const margin = calculateMargin(costPrice, sellingPrice)
  return margin < recommendedMargin
}
