// Types para el sistema de tasas de agencias

export interface AgencyRate {
  currency: string
  baseRate: number
  agencyRate: number
  adjustmentPercentage: number
  lastUpdate: string
  formattedBaseRate: string
  formattedAgencyRate: string
  variation?: number
}

export interface AgencyRatesConfig {
  id: string
  adjustmentPercentage: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  createdBy: string
  companyId?: string
}

export interface AgencyRatesResponse {
  success: boolean
  data: {
    rates: Record<string, AgencyRate>
    config: AgencyRatesConfig
    timestamp: string
  }
  message?: string
  error?: string
}

export interface AgencyRateUpdateRequest {
  adjustmentPercentage: number
  isActive?: boolean
}

export interface CalculationBreakdown {
  currency: string
  baseRate: number
  adjustmentPercentage: number
  calculatedRate: number
  formula: string
  breakdown: {
    baseAmount: number
    adjustment: number
    finalAmount: number
  }
}