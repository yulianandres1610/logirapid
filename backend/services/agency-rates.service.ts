import { AgencyRate, AgencyRatesConfig, CalculationBreakdown } from '../types/agency-rates'

export class AgencyRatesService {
  private static instance: AgencyRatesService
  private baseRates: Record<string, number> = {}
  private config: AgencyRatesConfig | null = null

  private constructor() {
    this.initializeBaseRates()
    this.loadConfig()
  }

  public static getInstance(): AgencyRatesService {
    if (!AgencyRatesService.instance) {
      AgencyRatesService.instance = new AgencyRatesService()
    }
    return AgencyRatesService.instance
  }

  private createDefaultConfig(): AgencyRatesConfig {
    const now = new Date().toISOString()

    return {
      id: 'global_config_1',
      adjustmentPercentage: 5.0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      createdBy: 'system'
    }
  }

  private ensureConfig(): AgencyRatesConfig {
    if (!this.config) {
      this.config = this.createDefaultConfig()
    }

    return this.config
  }

  private initializeBaseRates(): void {
    // Tasas base simuladas desde eltoque
    this.baseRates = {
      USD: 475,
      EUR: 530,
      MLC: 200,
      GBP: 488.84,
      CAD: 310,
      MXN: 22.33,
      BRL: 77.14,
      ZELLE: 453.08,
      CLA: 438.27
    }
  }

  private loadConfig(): void {
    // Cargar configuración desde localStorage o usar valores por defecto
    if (typeof window !== 'undefined') {
      const savedConfig = localStorage.getItem('globalAgencyConfig')
      if (savedConfig) {
        this.config = JSON.parse(savedConfig)
        return
      }
    }

    // En entornos de servidor o si no hay configuración guardada, usamos valores por defecto
    this.config = this.createDefaultConfig()
  }

  public updateBaseRates(rates: Record<string, number>): void {
    this.baseRates = { ...rates }
  }

  public updateConfig(config: Partial<AgencyRatesConfig>): void {
    const currentConfig = this.ensureConfig()

    this.config = { ...currentConfig, ...config, updatedAt: new Date().toISOString() }

    // Guardar en localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('globalAgencyConfig', JSON.stringify(this.config))
    }
  }

  public calculateAgencyRates(): Record<string, AgencyRate> {
    const config = this.ensureConfig()

    if (!config.isActive) {
      return {}
    }

    const agencyRates: Record<string, AgencyRate> = {}

    Object.entries(this.baseRates).forEach(([currency, baseRate]) => {
      const calculatedRate = baseRate * (1 + config.adjustmentPercentage / 100)

      agencyRates[currency] = {
        currency,
        baseRate,
        agencyRate: Math.round(calculatedRate * 100) / 100,
        adjustmentPercentage: config.adjustmentPercentage,
        lastUpdate: new Date().toISOString(),
        formattedBaseRate: baseRate.toFixed(2),
        formattedAgencyRate: calculatedRate.toFixed(2)
      }
    })

    return agencyRates
  }

  public getCalculationBreakdown(currency: string): CalculationBreakdown | null {
    const config = this.ensureConfig()

    if (!this.baseRates[currency]) {
      return null
    }

    const baseRate = this.baseRates[currency]
    const calculatedRate = baseRate * (1 + config.adjustmentPercentage / 100)
    const adjustment = calculatedRate - baseRate

    return {
      currency,
      baseRate,
      adjustmentPercentage: config.adjustmentPercentage,
      calculatedRate: Math.round(calculatedRate * 100) / 100,
      formula: `baseRate * (1 + ${config.adjustmentPercentage}% / 100)`,
      breakdown: {
        baseAmount: baseRate,
        adjustment: Math.round(adjustment * 100) / 100,
        finalAmount: Math.round(calculatedRate * 100) / 100
      }
    }
  }

  public getConfig(): AgencyRatesConfig {
    return this.ensureConfig()
  }

  public getBaseRates(): Record<string, number> {
    return { ...this.baseRates }
  }

  public validateConfig(adjustmentPercentage: number): { isValid: boolean; error?: string } {
    if (typeof adjustmentPercentage !== 'number' || isNaN(adjustmentPercentage)) {
      return { isValid: false, error: 'El porcentaje debe ser un número válido' }
    }

    if (adjustmentPercentage < -50) {
      return { isValid: false, error: 'El porcentaje no puede ser menor a -50%' }
    }

    if (adjustmentPercentage > 100) {
      return { isValid: false, error: 'El porcentaje no puede ser mayor a 100%' }
    }

    return { isValid: true }
  }

  public getRateHistory(currency: string, days: number = 30): Array<{
    date: string
    baseRate: number
    agencyRate: number
    adjustment: number
  }> {
    const config = this.ensureConfig()

    if (!this.baseRates[currency]) {
      return []
    }

    // Simular historial de tasas
    const history = []
    const today = new Date()

    for (let i = 0; i < days; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)

      const variation = (Math.random() - 0.5) * 10 // Variación aleatoria de ±5%
      const historicalBaseRate = this.baseRates[currency] * (1 + variation / 100)
      const historicalAgencyRate = historicalBaseRate * (1 + config.adjustmentPercentage / 100)

      history.push({
        date: date.toISOString(),
        baseRate: Math.round(historicalBaseRate * 100) / 100,
        agencyRate: Math.round(historicalAgencyRate * 100) / 100,
        adjustment: config.adjustmentPercentage
      })
    }

    return history.reverse()
  }
}
