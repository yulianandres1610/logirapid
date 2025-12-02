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
  cached?: boolean
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

const STORAGE_KEY = 'publishedRates'

/**
 * Hook para obtener tasas publicadas para agencias
 * - Solo retorna tasas finales (sin ajuste% ni tasa base)
 * - OPTIMIZACIÓN: Stale-While-Revalidate pattern
 *   - Muestra datos cacheados inmediatamente
 *   - Refresca en background sin bloquear UI
 */
export function usePublishedRates(): UsePublishedRatesReturn {
  const [rates, setRates] = useState<PublishedRate[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchRates = async () => {
    // 1. Intentar mostrar datos cacheados inmediatamente (stale)
    let hasCachedData = false
    try {
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached) {
        const { data, timestamp } = JSON.parse(cached)
        if (data && data.length > 0) {
          setRates(data)
          setLastRefresh(new Date(timestamp))
          setLoading(false) // No mostrar loading si hay caché
          hasCachedData = true
          console.log(`[usePublishedRates] Showing ${data.length} cached rates (stale-while-revalidate)`)
        }
      }
    } catch (e) {
      console.warn('[usePublishedRates] Error reading cache:', e)
    }

    // 2. Refrescar en background (revalidate)
    try {
      console.log('[usePublishedRates] Fetching fresh rates in background...')
      if (!hasCachedData) {
        setLoading(true)
      }
      setError(null)

      const response = await fetch('/api/published-rates', {
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

        // Guardar en localStorage para próxima visita
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          data: data.rates,
          timestamp: new Date().toISOString()
        }))

        console.log(`[usePublishedRates] Loaded ${data.rates.length} fresh rates from ${data.source || 'unknown'}${data.cached ? ' (server cache)' : ''}`)
      } else {
        // Solo mostrar error si no hay datos cacheados
        if (!hasCachedData) {
          setError(data.error || data.message || 'Failed to load rates')
          setRates([])
        }
      }
    } catch (err) {
      console.error('[usePublishedRates] Error fetching rates:', err)
      // Solo mostrar error si no hay datos cacheados
      if (!hasCachedData) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setRates([])
      }
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
