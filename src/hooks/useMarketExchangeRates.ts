'use client'

import { useState, useEffect } from 'react'

interface ExchangeRatesState {
  USD_CUP: number          // Tasa principal (manual o ElToque)
  USD_CUP_BCC: number      // Tasa oficial BCC (para referencia)
  USD_CUP_ELTOQUE: number  // Siempre ElToque (para referencia)
  USD_MLC: number          // Tasa MLC
  timestamp: string
  timestampBCC: string
  source: 'manual' | 'eltoque' | 'fallback' | 'default'  // Origen de la tasa principal
  loading: boolean
  error: string | null
}

interface UseMarketExchangeRatesReturn extends ExchangeRatesState {
  convertPrice: (priceUSD: number, toCurrency: 'CUP' | 'MLC') => number
  convertPriceBCC: (priceUSD: number) => number
  convertPriceElToque: (priceUSD: number) => number  // Siempre usa ElToque
  formatCUP: (amount: number) => string
  formatMLC: (amount: number) => string
  formatUSD: (amount: number) => string
  isManualRate: boolean  // Helper para saber si es tasa manual
  refetch: () => Promise<void>  // Función para refrescar tasas
}

export function useMarketExchangeRates(): UseMarketExchangeRatesReturn {
  const [rates, setRates] = useState<ExchangeRatesState>({
    USD_CUP: 450,           // Fallback
    USD_CUP_BCC: 411,       // Fallback BCC
    USD_CUP_ELTOQUE: 450,   // Fallback ElToque
    USD_MLC: 1.10,          // Fallback
    timestamp: '',
    timestampBCC: '',
    source: 'default',
    loading: true,
    error: null
  })

  const fetchRates = async () => {
    try {
      const response = await fetch('/api/market/pos/exchange-rates')
      const data = await response.json()

      if (data.success && data.rates) {
        setRates({
          USD_CUP: data.rates.CUP || 450,               // Tasa principal (manual o ElToque)
          USD_CUP_BCC: data.rates.CUP_BCC || 411,       // BCC para referencia
          USD_CUP_ELTOQUE: data.rates.CUP_ELTOQUE || data.rates.CUP || 450, // Siempre ElToque
          USD_MLC: data.rates.MLC || 1.10,
          timestamp: data.rates.timestamp || new Date().toISOString(),
          timestampBCC: data.rates.timestampBCC || new Date().toISOString(),
          source: data.rates.source || 'default',
          loading: false,
          error: null
        })
        // Rates updated silently
      } else {
        console.warn('[useMarketExchangeRates] No se obtuvieron tasas del API')
        setRates(prev => ({
          ...prev,
          loading: false,
          error: 'No se pudieron obtener las tasas'
        }))
      }
    } catch (error) {
      console.error('[useMarketExchangeRates] Error:', error)
      setRates(prev => ({
        ...prev,
        loading: false,
        error: 'Error de conexión al obtener tasas'
      }))
    }
  }

  useEffect(() => {
    fetchRates()

    // Refrescar cada 5 minutos
    const interval = setInterval(fetchRates, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Función para convertir precios usando tasa principal (manual o ElToque)
  const convertPrice = (priceUSD: number, toCurrency: 'CUP' | 'MLC'): number => {
    if (toCurrency === 'CUP') return priceUSD * rates.USD_CUP
    if (toCurrency === 'MLC') return priceUSD * rates.USD_MLC
    return priceUSD
  }

  // Función para convertir usando tasa principal (alias para compatibilidad)
  const convertPriceBCC = (priceUSD: number): number => {
    return priceUSD * rates.USD_CUP
  }

  // Función para convertir usando siempre ElToque (para comparaciones)
  const convertPriceElToque = (priceUSD: number): number => {
    return priceUSD * rates.USD_CUP_ELTOQUE
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
    convertPriceBCC,
    convertPriceElToque,
    formatCUP,
    formatMLC,
    formatUSD,
    isManualRate: rates.source === 'manual',
    refetch: fetchRates
  }
}
