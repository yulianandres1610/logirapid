import { AgencyRate, AgencyRatesConfig, CalculationBreakdown } from '../types/agency-rates'
import {
  saveAgencyConfig,
  getAgencyConfig,
  updateAgencyConfig,
  saveAgencyRatesHistory,
  getAgencyRatesHistory,
  saveCompanyAgencyConfig,
  getCompanyAgencyConfig
} from './database'

export class AgencyRatesService {
  private static instance: AgencyRatesService
  private baseRates: Record<string, number> = {}
  private config: AgencyRatesConfig | null = null
  private isInitialized = false

  private constructor() {
    // Inicializar baseRates vacío - se cargará desde BD o API externa
    this.baseRates = {}
    this.loadConfigFromDB()
    this.loadBaseRatesFromDB()
  }

  public static getInstance(): AgencyRatesService {
    if (!AgencyRatesService.instance) {
      AgencyRatesService.instance = new AgencyRatesService()
    }
    return AgencyRatesService.instance
  }

  /**
   * Carga tasas base desde la base de datos (agency_rates_history)
   * Usa las tasas más recientes disponibles
   */
  private async loadBaseRatesFromDB(): Promise<void> {
    try {
      const { db } = await import('./database')

      const query = `
        SELECT currency, baserate
        FROM agency_rates_history
        WHERE timestamp = (
          SELECT MAX(timestamp)
          FROM agency_rates_history
        )
      `

      const result = await db.query(query)

      if (result.rows.length > 0) {
        const rates: Record<string, number> = {}
        result.rows.forEach((row: any) => {
          rates[row.currency] = parseFloat(row.baserate)
        })

        this.baseRates = rates
        console.log('[AgencyRatesService] Loaded base rates from database:', Object.keys(rates))
      } else {
        console.warn('[AgencyRatesService] No base rates found in database')
        this.baseRates = {}
      }
    } catch (error) {
      console.error('[AgencyRatesService] Error loading base rates from database:', error)
      this.baseRates = {}
    }
  }

  private async loadConfigFromDB(companyId?: string): Promise<void> {
    try {
      // Obtener configuración desde la base de datos
      const dbConfig: any = await getAgencyConfig(companyId)

      if (dbConfig) {
        this.config = {
          id: dbConfig.id,
          adjustmentPercentage: dbConfig.adjustmentPercentage,
          isActive: Boolean(dbConfig.isActive),
          createdAt: dbConfig.createdAt,
          updatedAt: dbConfig.updatedAt,
          createdBy: dbConfig.createdBy,
          companyId: dbConfig.companyId
        }
      } else {
        // Si no hay configuración, crear una por defecto
        this.config = {
          id: `config_${Date.now()}`,
          adjustmentPercentage: 5.0,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system'
        }

        // Guardar en base de datos
        await saveAgencyConfig({
          id: this.config.id,
          adjustmentPercentage: this.config.adjustmentPercentage,
          isActive: this.config.isActive,
          createdBy: this.config.createdBy
        })
      }

      this.isInitialized = true
    } catch (error) {
      console.error('❌ Error al cargar configuración desde la base de datos:', error)
      // Usar configuración por defecto en caso de error
      this.config = {
        id: `fallback_config_${Date.now()}`,
        adjustmentPercentage: 5.0,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system_fallback'
      }
      this.isInitialized = true
    }
  }

  public updateBaseRates(rates: Record<string, number>): void {
    this.baseRates = { ...rates }
  }

  public async updateConfig(config: Partial<AgencyRatesConfig>, companyId?: string): Promise<void> {
    if (!this.config) {
      await this.loadConfigFromDB(companyId)
    }

    if (this.config) {
      const previousPercentage = this.config.adjustmentPercentage

      this.config = { ...this.config, ...config, updatedAt: new Date().toISOString() }

      try {
        // Actualizar en base de datos
        await updateAgencyConfig(this.config.id, {
          adjustmentPercentage: this.config.adjustmentPercentage,
          isActive: this.config.isActive
        })

        // Si el porcentaje cambió, guardar historial
        if (previousPercentage !== this.config.adjustmentPercentage) {
          const agencyRates = this.calculateAgencyRates()
          const historyData = Object.entries(agencyRates).map(([currency, rate]) => ({
            id: `${this.config!.id}_${currency}_${Date.now()}`,
            configId: this.config!.id,
            currency,
            baseRate: rate.baseRate,
            agencyRate: rate.agencyRate,
            adjustmentPercentage: this.config!.adjustmentPercentage
          }))

          await saveAgencyRatesHistory(historyData)
          console.log('📈 Historial de tasas guardado para cambio de porcentaje')
        }

        console.log('✅ Configuración de tasas actualizada en base de datos')
      } catch (error) {
        console.error('❌ Error al actualizar configuración en base de datos:', error)
      }
    }
  }

  public calculateAgencyRates(): Record<string, AgencyRate> {
    if (!this.config || !this.config.isActive) {
      return {}
    }

    const agencyRates: Record<string, AgencyRate> = {}

    Object.entries(this.baseRates).forEach(([currency, baseRate]) => {
      const calculatedRate = baseRate * (1 + this.config!.adjustmentPercentage / 100)

      agencyRates[currency] = {
        currency,
        baseRate,
        agencyRate: Math.round(calculatedRate * 100) / 100,
        adjustmentPercentage: this.config!.adjustmentPercentage,
        lastUpdate: new Date().toISOString(),
        formattedBaseRate: baseRate.toFixed(2),
        formattedAgencyRate: calculatedRate.toFixed(2)
      }
    })

    return agencyRates
  }

  public getCalculationBreakdown(currency: string): CalculationBreakdown | null {
    if (!this.config || !this.baseRates[currency]) {
      return null
    }

    const baseRate = this.baseRates[currency]
    const calculatedRate = baseRate * (1 + this.config.adjustmentPercentage / 100)
    const adjustment = calculatedRate - baseRate

    return {
      currency,
      baseRate,
      adjustmentPercentage: this.config.adjustmentPercentage,
      calculatedRate: Math.round(calculatedRate * 100) / 100,
      formula: `baseRate * (1 + ${this.config.adjustmentPercentage}% / 100)`,
      breakdown: {
        baseAmount: baseRate,
        adjustment: Math.round(adjustment * 100) / 100,
        finalAmount: Math.round(calculatedRate * 100) / 100
      }
    }
  }

  public getConfig(): AgencyRatesConfig | null {
    return this.config
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

  public async getRateHistory(currency: string, days: number = 30): Promise<Array<{
    date: string
    baseRate: number
    agencyRate: number
    adjustment: number
  }>> {
    if (!this.config) {
      return []
    }

    try {
      // Obtener historial desde la base de datos
      const dbHistory = await getAgencyRatesHistory(this.config.id, days)

      if (dbHistory.length > 0) {
        return dbHistory
          .filter((record: any) => record.currency === currency)
          .map((record: any) => ({
            date: record.timestamp,
            baseRate: record.baseRate,
            agencyRate: record.agencyRate,
            adjustment: record.adjustmentPercentage
          }))
          .reverse()
      }

      // Si no hay historial en la base de datos, generar simulación
      const history = []
      const today = new Date()

      for (let i = 0; i < days; i++) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)

        const variation = (Math.random() - 0.5) * 10 // Variación aleatoria de ±5%
        const historicalBaseRate = this.baseRates[currency] * (1 + variation / 100)
        const historicalAgencyRate = historicalBaseRate * (1 + this.config!.adjustmentPercentage / 100)

        history.push({
          date: date.toISOString(),
          baseRate: Math.round(historicalBaseRate * 100) / 100,
          agencyRate: Math.round(historicalAgencyRate * 100) / 100,
          adjustment: this.config!.adjustmentPercentage
        })
      }

      return history.reverse()
    } catch (error) {
      console.error('❌ Error al obtener historial de tasas:', error)
      return []
    }
  }
}