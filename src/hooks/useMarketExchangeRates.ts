'use client'

import { useState, useEffect } from 'react'

interface ExchangeRatesState {
  USD_CUP: number          // Tasa informal (ElToque) - para costo
  USD_CUP_BCC: number      // Tasa oficial BCC (Segmento 3) - para venta
  USD_MLC: number          // Tasa MLC (ElToque)
  timestamp: string
  timestampBCC: string
  loading: boolean
  error: string | null
}

interface UseMarketExchangeRatesReturn extends ExchangeRatesState {
  convertPrice: (priceUSD: number, toCurrency: 'CUP' | 'MLC') => number
  convertPriceBCC: (priceUSD: number) => number  // Conversión usando tasa BCC
  formatCUP: (amount: number) => string
  formatMLC: (amount: number) => string
  formatUSD: (amount: number) => string
}

export function useMarketExchangeRates(): UseMarketExchangeRatesReturn {
  const [rates, setRates] = useState<ExchangeRatesState>({
    USD_CUP: 450,      // Fallback ElToque
    USD_CUP_BCC: 411,  // Fallback BCC Segmento 3
    USD_MLC: 1.10,     // Fallback
    timestamp: '',
    timestampBCC: '',
    loading: true,
    error: null
  })

  useEffect(() => {
    const fetchRates = async () => {
      try {
        // El API interno ya obtiene ambas tasas (ElToque y BCC)
        const response = await fetch('/api/market/pos/exchange-rates')
        const data = await response.json()

        if (data.success && data.rates) {
          setRates({
            USD_CUP: data.rates.CUP || 450,           // ElToque para costo
            USD_CUP_BCC: data.rates.CUP_BCC || 411,   // BCC para venta
            USD_MLC: data.rates.MLC || 1.10,          // ElToque para MLC
            timestamp: data.rates.timestamp || new Date().toISOString(),
            timestampBCC: data.rates.timestampBCC || new Date().toISOString(),
            loading: false,
            error: null
          })
          console.log('[useMarketExchangeRates] Tasas actualizadas:', {
            CUP_ElToque: data.rates.CUP,
            CUP_BCC: data.rates.CUP_BCC,
            MLC: data.rates.MLC
          })
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

    fetchRates()

    // Refrescar cada 5 minutos
    const interval = setInterval(fetchRates, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Función para convertir precios (tasa informal ElToque)
  const convertPrice = (priceUSD: number, toCurrency: 'CUP' | 'MLC'): number => {
    if (toCurrency === 'CUP') return priceUSD * rates.USD_CUP
    if (toCurrency === 'MLC') return priceUSD * rates.USD_MLC
    return priceUSD
  }

  // Función para convertir precios usando tasa BCC (oficial)
  const convertPriceBCC = (priceUSD: number): number => {
    return priceUSD * rates.USD_CUP_BCC
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
    formatCUP,
    formatMLC,
    formatUSD
  }
}
