import { useState, useEffect } from 'react'

interface PublishedRate {
  currency: string
  rate: number
  lastUpdated: string
}

interface PublishedRatesResponse {
  success: boolean
  rates: PublishedRate[]
  lastUpdated: string
  source?: 'history' | 'calculated'
  error?: string
  message?: string
}

interface UsePublishedRatesReturn {
  rates: PublishedRate[]
  loading: boolean
  error: string | null
  lastRefresh: Date | null
  refreshRates: () => Promise<void>
}

/**
 * Hook para obtener tasas publicadas para agencias
 * - Solo retorna tasas finales (sin ajuste% ni tasa base)
 * - Fetch on mount (sin auto-refresh)
 * - Sin localStorage cache (siempre datos frescos)
 */
export function usePublishedRates(): UsePublishedRatesReturn {
  const [rates, setRates] = useState<PublishedRate[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchRates = async () => {
    try {
      console.log('[usePublishedRates] Fetching published rates...')
      setLoading(true)
      setError(null)

      const response = await fetch('/api/published-rates', {
        cache: 'no-store', // Siempre datos frescos
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: PublishedRatesResponse = await response.json()

      if (data.success) {
        setRates(data.rates)
        setLastRefresh(new Date())
        console.log(`[usePublishedRates] Loaded ${data.rates.length} rates from ${data.source || 'unknown'}`)
      } else {
        setError(data.error || data.message || 'Failed to load rates')
        setRates([])
      }
    } catch (err) {
      console.error('[usePublishedRates] Error fetching rates:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setRates([])
    } finally {
      setLoading(false)
    }
  }

  const refreshRates = async () => {
    await fetchRates()
  }

  // Fetch on mount only (no auto-refresh)
  useEffect(() => {
    fetchRates()
  }, [])

  return {
    rates,
    loading,
    error,
    lastRefresh,
    refreshRates
  }
}
