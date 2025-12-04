'use client'

import { useState, useEffect, useCallback } from 'react'

// Types for service pricing
export interface ServicePrice {
  id?: number
  serviceId: string
  serviceLabel: string
  category: string
  providerCost?: number
  platformPrice: number
  buyPrice: number
  sellPrice: number
  margin: number
  marginPercentage: string
  pricingModel?: string
  unitType?: string | null
  hasCustomPricing?: boolean
  providerCompanyId?: number | null
  providerCompanyName?: string | null
  isActive?: boolean
}

export interface PlatformPricingData {
  global: ServicePrice[]
  byProvider: ServicePrice[]
  serviceDefinitions: Record<string, { label: string; category: string }>
}

export interface CompanyPricingData {
  companyId: number
  companyName: string
  isBranch: boolean
  parentCompanyId: number | null
  pricingCompanyId: number
  isProvider: boolean
  pricing: ServicePrice[]
  enabledServices: string[]
}

// Hook for fetching platform-level pricing (SUPER_ADMIN)
export function usePlatformPricing() {
  const [data, setData] = useState<PlatformPricingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPricing = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/service-pricing')
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Error al obtener precios')
      }

      setData(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [])

  const updatePrice = useCallback(async (price: {
    serviceId: string
    providerCost: number
    platformPrice: number
    providerCompanyId?: number | null
    pricingModel?: string
    unitType?: string | null
    notes?: string
  }) => {
    try {
      const response = await fetch('/api/service-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(price)
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Error al actualizar precio')
      }

      // Refresh data
      await fetchPricing()

      return result.data
    } catch (err) {
      throw err
    }
  }, [fetchPricing])

  const bulkUpdatePrices = useCallback(async (prices: Array<{
    serviceId: string
    providerCost: number
    platformPrice: number
    pricingModel?: string
    unitType?: string | null
  }>, notes?: string) => {
    try {
      const response = await fetch('/api/service-pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prices, notes })
      })

      const result = await response.json()

      if (!result.success && result.data?.errors?.length > 0) {
        console.warn('Some prices failed to update:', result.data.errors)
      }

      // Refresh data
      await fetchPricing()

      return result.data
    } catch (err) {
      throw err
    }
  }, [fetchPricing])

  useEffect(() => {
    fetchPricing()
  }, [fetchPricing])

  return {
    data,
    loading,
    error,
    refresh: fetchPricing,
    updatePrice,
    bulkUpdatePrices
  }
}

// Hook for fetching company-specific pricing
export function useCompanyPricing(companyId: number | null) {
  const [data, setData] = useState<CompanyPricingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPricing = useCallback(async () => {
    if (!companyId) {
      setData(null)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/companies/${companyId}/service-pricing`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Error al obtener precios')
      }

      setData(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  const updatePrices = useCallback(async (prices: Array<{
    serviceId: string
    sellPrice: number
  }>, notes?: string) => {
    if (!companyId) {
      throw new Error('No company ID provided')
    }

    try {
      const response = await fetch(`/api/companies/${companyId}/service-pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prices, notes })
      })

      const result = await response.json()

      if (!result.success && result.data?.errors?.length > 0) {
        const errorMessages = result.data.errors.map((e: { serviceId: string; error: string }) =>
          `${e.serviceId}: ${e.error}`
        ).join('\n')
        throw new Error(errorMessages)
      }

      // Refresh data
      await fetchPricing()

      return result.data
    } catch (err) {
      throw err
    }
  }, [companyId, fetchPricing])

  useEffect(() => {
    fetchPricing()
  }, [fetchPricing])

  return {
    data,
    loading,
    error,
    refresh: fetchPricing,
    updatePrices
  }
}

// Hook for fetching provider companies
export function useProviders(serviceId?: string) {
  const [providers, setProviders] = useState<Array<{
    id: number
    legalName: string
    phone: string
    email: string
    status: string
    isProvider: boolean
    providerServices: string[]
    createdAt: string
  }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const url = serviceId
        ? `/api/service-pricing/providers?serviceId=${encodeURIComponent(serviceId)}`
        : '/api/service-pricing/providers'

      const response = await fetch(url)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Error al obtener proveedores')
      }

      setProviders(result.data.providers || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [serviceId])

  useEffect(() => {
    fetchProviders()
  }, [fetchProviders])

  return {
    providers,
    loading,
    error,
    refresh: fetchProviders
  }
}

// Hook for pricing history
export function usePricingHistory(options?: {
  serviceId?: string
  companyId?: number
  days?: number
  limit?: number
}) {
  const [history, setHistory] = useState<Array<{
    id: number
    changeType: string
    serviceId: string
    companyId?: number
    companyName?: string
    oldValues: {
      providerCost: number | null
      platformPrice: number | null
      buyPrice: number | null
      sellPrice: number | null
    }
    newValues: {
      providerCost: number | null
      platformPrice: number | null
      buyPrice: number | null
      sellPrice: number | null
    }
    changedByUserName: string
    changedAt: string
    notes?: string
  }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (options?.serviceId) params.append('serviceId', options.serviceId)
      if (options?.companyId) params.append('companyId', options.companyId.toString())
      if (options?.days) params.append('days', options.days.toString())
      if (options?.limit) params.append('limit', options.limit.toString())

      const url = `/api/service-pricing/history${params.toString() ? `?${params.toString()}` : ''}`

      const response = await fetch(url)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Error al obtener historial')
      }

      setHistory(result.data.history || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [options?.serviceId, options?.companyId, options?.days, options?.limit])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  return {
    history,
    loading,
    error,
    refresh: fetchHistory
  }
}
