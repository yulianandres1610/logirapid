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
  private static initializationPromise: Promise<void> | null = null
  private baseRates: Record<string, number> = {}
  private config: AgencyRatesConfig | null = null
  private isInitialized = false

  private constructor() {
    // Inicializar baseRates vacío - se cargará desde BD o API externa
    this.baseRates = {}
  }

  /**
   * Método de inicialización async que carga config y tasas base
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      await this.loadConfigFromDB()
      await this.loadBaseRatesFromDB()
      this.isInitialized = true
      console.log('[AgencyRatesService] Initialization complete')
    } catch (error) {
      console.error('[AgencyRatesService] Error during initialization:', error)
      this.isInitialized = true // Mark as initialized even on error to prevent infinite retries
    }
  }

  public static getInstance(): AgencyRatesService {
    if (!AgencyRatesService.instance) {
      AgencyRatesService.instance = new AgencyRatesService()
      // Start initialization but don't block
      AgencyRatesService.initializationPromise = AgencyRatesService.instance.initialize()
    }
    return AgencyRatesService.instance
  }

  /**
   * Espera a que la inicialización termine antes de continuar
   */
  public async waitForInitialization(): Promise<void> {
    if (AgencyRatesService.initializationPromise) {
      await AgencyRatesService.initializationPromise
    }
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

  /**
   * Asegura que las tasas base estén cargadas antes de usarlas
   * Método público para que los endpoints puedan esperar a que las tasas estén listas
   */
  public async ensureBaseRatesLoaded(): Promise<void> {
    // Primero esperar a que la inicialización termine
    await this.waitForInitialization()

    // Si ya hay tasas cargadas, no hacer nada
    if (Object.keys(this.baseRates).length > 0) {
      return
    }

    // Si no hay tasas, cargar desde BD
    await this.loadBaseRatesFromDB()
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

  /**
   * Actualiza las tasas base y opcionalmente guarda en historial
   * @param rates Las nuevas tasas base
   * @param persistToHistory Si es true, guarda las tasas calculadas en el historial
   */
  public async updateBaseRates(rates: Record<string, number>, persistToHistory: boolean = false): Promise<void> {
    this.baseRates = { ...rates }

    if (persistToHistory && this.config) {
      await this.saveCurrentRatesToHistory()
    }
  }

  public async updateConfig(config: Partial<AgencyRatesConfig>, companyId?: string): Promise<void> {
    if (!this.config) {
      await this.loadConfigFromDB(companyId)
    }

    if (this.config) {
      this.config = { ...this.config, ...config, updatedAt: new Date().toISOString() }

      try {
        // Actualizar en base de datos
        await updateAgencyConfig(this.config.id, {
          adjustmentPercentage: this.config.adjustmentPercentage,
          isActive: this.config.isActive
        })

        // SIEMPRE guardar historial cuando se actualiza la configuración
        // Esto asegura que las agencias siempre vean tasas actualizadas
        await this.saveCurrentRatesToHistory()

        console.log('✅ Configuración de tasas actualizada en base de datos')
      } catch (error) {
        console.error('❌ Error al actualizar configuración en base de datos:', error)
      }
    }
  }

  /**
   * Guarda las tasas actuales calculadas en el historial
   * Esto permite que las agencias vean las tasas desde /api/published-rates
   */
  public async saveCurrentRatesToHistory(): Promise<void> {
    if (!this.config || Object.keys(this.baseRates).length === 0) {
      console.warn('[AgencyRatesService] No se puede guardar historial: falta config o baseRates')
      return
    }

    const agencyRates = this.calculateAgencyRates()
    if (Object.keys(agencyRates).length === 0) {
      console.warn('[AgencyRatesService] No hay tasas calculadas para guardar')
      return
    }

    const timestamp = new Date().toISOString()
    const historyData = Object.entries(agencyRates).map(([currency, rate]) => ({
      id: `${this.config!.id}_${currency}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      configId: this.config!.id,
      currency,
      baseRate: rate.baseRate,
      agencyRate: rate.agencyRate,
      adjustmentPercentage: this.config!.adjustmentPercentage,
      timestamp
    }))

    await saveAgencyRatesHistory(historyData)
    console.log('📈 Historial de tasas guardado:', Object.keys(agencyRates).join(', '))
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