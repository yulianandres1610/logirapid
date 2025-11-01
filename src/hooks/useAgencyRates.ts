'use client'

import { useState, useEffect, useCallback } from 'react'
import { AgencyRate, AgencyRatesConfig } from '@/types/agency-rates'

interface UseAgencyRatesReturn {
  rates: Record<string, AgencyRate> | null
  config: AgencyRatesConfig | null
  loading: boolean
  error: string | null
  lastRefresh: Date | null
  refreshRates: (forceRefresh?: boolean) => Promise<void>
  getRateForCurrency: (currency: string) => AgencyRate | null
  isConfigured: boolean
}

export function useAgencyRates(autoRefresh: boolean = true): UseAgencyRatesReturn {
  const [rates, setRates] = useState<Record<string, AgencyRate> | null>(null)
  const [config, setConfig] = useState<AgencyRatesConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchRates = useCallback(async (forceRefresh: boolean = false) => {
    try {
      setLoading(true)
      setError(null)

      const url = forceRefresh ? '/api/agency-rates?forceRefresh=true' : '/api/agency-rates'
      const response = await fetch(url)
      const data = await response.json()

      if (data.success && data.data) {
        setRates(data.data.rates)
        setConfig(data.data.config)
        setLastRefresh(new Date())

        // Guardar en localStorage para persistencia
        if (typeof window !== 'undefined') {
          localStorage.setItem('agencyRates', JSON.stringify({
            rates: data.data.rates,
            config: data.data.config,
            timestamp: new Date().toISOString()
          }))
        }
      } else {
        setError(data.error || 'Error al cargar las tasas de agencia')
      }
    } catch (err) {
      console.error('Error fetching agency rates:', err)
      setError('No se pudieron cargar las tasas de agencia. Verifique su conexión.')

      // Intentar cargar desde localStorage como fallback
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('agencyRates')
        if (cached) {
          try {
            const parsed = JSON.parse(cached)
            setRates(parsed.rates)
            setConfig(parsed.config)
            setLastRefresh(new Date(parsed.timestamp))
          } catch (e) {
            console.error('Error parsing cached rates:', e)
          }
        }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const getRateForCurrency = useCallback((currency: string): AgencyRate | null => {
    if (!rates || !rates[currency]) return null
    return rates[currency]
  }, [rates])

  const isConfigured = Boolean(config && config.isActive)

  // Cargar tasas iniciales forzando refresh para obtener tasas actualizadas
  useEffect(() => {
    fetchRates(true) // Forzar refresh al cargar para obtener tasas actualizadas
  }, [fetchRates])

  // Auto-refresh si está habilitado
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchRates()
    }, 5 * 60 * 1000) // 5 minutos

    return () => clearInterval(interval)
  }, [fetchRates, autoRefresh])

  return {
    rates,
    config,
    loading,
    error,
    lastRefresh,
    refreshRates: fetchRates,
    getRateForCurrency,
    isConfigured
  }
}

// Hook específico para nuevas empresas - inicializa automáticamente las tasas
export function useInitializeAgencyRates(companyId?: string) {
  const { rates, config, loading, error, refreshRates } = useAgencyRates()

  useEffect(() => {
    if (!loading && !error && (!rates || Object.keys(rates).length === 0)) {
      // Si no hay tasas configuradas, intentar inicializarlas
      initializeAgencyRates(companyId)
    }
  }, [loading, error, rates, companyId])

  const initializeAgencyRates = async (companyId?: string) => {
    try {
      const response = await fetch('/api/agency-rates/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ companyId })
      })

      const data = await response.json()

      if (data.success) {
        refreshRates()
      }
    } catch (error) {
      console.error('Error initializing agency rates:', error)
    }
  }

  return {
    rates,
    config,
    loading,
    error,
    refreshRates,
    isInitialized: Boolean(rates && Object.keys(rates).length > 0)
  }
}