// Types and utilities for agency rate management

export interface AgencyRateAdjustment {
  percentage: number
  enabled: boolean
}

export interface AgencyRateConfig {
  id: string
  agencyId: string
  agencyName: string
  adjustments: {
    USD: AgencyRateAdjustment
    EUR: AgencyRateAdjustment
    MLC: AgencyRateAdjustment
    GBP: AgencyRateAdjustment
    CAD: AgencyRateAdjustment
    MXN: AgencyRateAdjustment
    BRL: AgencyRateAdjustment
    ZELLE: AgencyRateAdjustment
    CLA: AgencyRateAdjustment
  }
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface CalculatedAgencyRate {
  currency: string
  baseRate: number
  adjustmentPercentage: number
  calculatedRate: number
  formatted: string
  lastUpdate: string
}

class AgencyRatesManager {
  private static instance: AgencyRatesManager
  private configs: AgencyRateConfig[] = []

  private constructor() {
    // Initialize with some default configs if needed
    this.loadDefaultConfigs()
  }

  static getInstance(): AgencyRatesManager {
    if (!AgencyRatesManager.instance) {
      AgencyRatesManager.instance = new AgencyRatesManager()
    }
    return AgencyRatesManager.instance
  }

  private loadDefaultConfigs() {
    // In production, this would load from database
    // For now, initialize with empty array
    this.configs = []
  }

  async getAllConfigs(): Promise<AgencyRateConfig[]> {
    // In production, fetch from database
    return this.configs
  }

  async getConfigById(agencyId: string): Promise<AgencyRateConfig | null> {
    const config = this.configs.find(c => c.agencyId === agencyId)
    return config || null
  }

  async createConfig(config: Omit<AgencyRateConfig, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<AgencyRateConfig> {
    const newConfig: AgencyRateConfig = {
      id: `config_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
      ...config
    }

    this.configs.push(newConfig)
    return newConfig
  }

  async updateConfig(agencyId: string, updates: Partial<AgencyRateConfig>): Promise<AgencyRateConfig | null> {
    const configIndex = this.configs.findIndex(c => c.agencyId === agencyId)
    if (configIndex === -1) return null

    this.configs[configIndex] = {
      ...this.configs[configIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    }

    return this.configs[configIndex]
  }

  async deleteConfig(agencyId: string): Promise<boolean> {
    const configIndex = this.configs.findIndex(c => c.agencyId === agencyId)
    if (configIndex === -1) return false

    this.configs.splice(configIndex, 1)
    return true
  }

  calculateAgencyRate(baseRate: number, adjustment: AgencyRateAdjustment): CalculatedAgencyRate {
    if (!adjustment.enabled) {
      return {
        currency: '',
        baseRate,
        adjustmentPercentage: 0,
        calculatedRate: baseRate,
        formatted: baseRate.toFixed(2),
        lastUpdate: new Date().toISOString()
      }
    }

    const calculatedRate = baseRate * (1 + adjustment.percentage / 100)

    return {
      currency: '',
      baseRate,
      adjustmentPercentage: adjustment.percentage,
      calculatedRate: Math.round(calculatedRate * 100) / 100,
      formatted: calculatedRate.toFixed(2),
      lastUpdate: new Date().toISOString()
    }
  }

  async calculateAllRates(agencyId: string, baseRates: Record<string, any>): Promise<Record<string, CalculatedAgencyRate>> {
    const config = await this.getConfigById(agencyId)
    if (!config) return {}

    const calculatedRates: Record<string, CalculatedAgencyRate> = {}

    Object.entries(baseRates).forEach(([currency, rateData]) => {
      const adjustment = config.adjustments[currency as keyof typeof config.adjustments]
      if (adjustment) {
        const baseRate = rateData.rate || 0
        const calculatedRate = this.calculateAgencyRate(baseRate, adjustment)
        calculatedRates[currency] = {
          ...calculatedRate,
          currency
        }
      }
    })

    return calculatedRates
  }

  async getAgencyFormattedRates(agencyId: string): Promise<Record<string, CalculatedAgencyRate>> {
    // Mock base rates - in production, these would come from eltoque API
    const mockBaseRates = {
      USD: { rate: 170.5 },
      EUR: { rate: 185.2 },
      MLC: { rate: 160.8 },
      GBP: { rate: 215.3 },
      CAD: { rate: 125.7 },
      MXN: { rate: 8.5 },
      BRL: { rate: 34.2 },
      ZELLE: { rate: 172.1 },
      CLA: { rate: 171.8 }
    }

    return this.calculateAllRates(agencyId, mockBaseRates)
  }

  async saveAgencyConfig(data: {
    agencyId: string
    agencyName: string
    adjustments: AgencyRateConfig['adjustments']
  }): Promise<AgencyRateConfig> {
    const existingConfig = await this.getConfigById(data.agencyId)

    if (existingConfig) {
      // Update existing config
      return await this.updateConfig(data.agencyId, {
        agencyName: data.agencyName,
        adjustments: data.adjustments
      }) as AgencyRateConfig
    } else {
      // Create new config
      return await this.createConfig({
        agencyId: data.agencyId,
        agencyName: data.agencyName,
        adjustments: data.adjustments
      })
    }
  }

  async deleteAgencyConfig(agencyId: string): Promise<boolean> {
    return await this.deleteConfig(agencyId)
  }
}

// Export singleton instance
export default AgencyRatesManager.getInstance()