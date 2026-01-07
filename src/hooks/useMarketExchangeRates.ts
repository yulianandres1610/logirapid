'use client'

import { useState, useEffect } from 'react'

interface ExchangeRatesState {
  USD_CUP: number
  USD_MLC: number
  timestamp: string
  loading: boolean
  error: string | null
}

interface UseMarketExchangeRatesReturn extends ExchangeRatesState {
  convertPrice: (priceUSD: number, toCurrency: 'CUP' | 'MLC') => number
  formatCUP: (amount: number) => string
  formatMLC: (amount: number) => string
  formatUSD: (amount: number) => string
}

export function useMarketExchangeRates(): UseMarketExchangeRatesReturn {
  const [rates, setRates] = useState<ExchangeRatesState>({
    USD_CUP: 400,  // Fallback
    USD_MLC: 1.10, // Fallback
    timestamp: '',
    loading: true,
    error: null
  })

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch('/api/market/pos/exchange-rates')
        const data = await res.json()

        if (data.success && data.rates) {
          setRates({
            USD_CUP: data.rates.CUP || 400,
            USD_MLC: data.rates.MLC || 1.10,
            timestamp: data.timestamp || new Date().toISOString(),
            loading: false,
            error: null
          })
        } else {
          // Intentar con el endpoint principal de exchange-rates
          const fallbackRes = await fetch('/api/exchange-rates')
          const fallbackData = await fallbackRes.json()

          if (fallbackData.success && fallbackData.data) {
            const cupRate = fallbackData.data.find((r: any) => r.currency === 'USD')?.rate || 400
            const mlcRate = fallbackData.data.find((r: any) => r.currency === 'MLC')?.rate || 1.10

            setRates({
              USD_CUP: cupRate,
              USD_MLC: mlcRate,
              timestamp: fallbackData.timestamp || new Date().toISOString(),
              loading: false,
              error: null
            })
          } else {
            setRates(prev => ({
              ...prev,
              loading: false,
              error: 'No se pudieron obtener las tasas'
            }))
          }
        }
      } catch (error) {
        console.error('Error fetching exchange rates:', error)
        setRates(prev => ({
          ...prev,
          loading: false,
          error: 'Error de conexión al obtener tasas'
        }))
      }
    }

    fetchRates()

    // Refrescar cada 5 minutos
    const interval = setInterval(fetchRates, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Función para convertir precios
  const convertPrice = (priceUSD: number, toCurrency: 'CUP' | 'MLC'): number => {
    if (toCurrency === 'CUP') return priceUSD * rates.USD_CUP
    if (toCurrency === 'MLC') return priceUSD * rates.USD_MLC
    return priceUSD
  }

  // Funciones de formateo
  const formatCUP = (amount: number): string => {
    return Math.round(amount).toLocaleString('es-CU')
  }

  const formatMLC = (amount: number): string => {
    return amount.toFixed(2)
  }

  const formatUSD = (amount: number): string => {
    return amount.toFixed(2)
  }

  return {
    ...rates,
    convertPrice,
    formatCUP,
    formatMLC,
    formatUSD
  }
}
