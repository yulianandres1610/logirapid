'use client'

import { useState, useEffect } from 'react'

interface ExchangeRatesState {
  USD_CUP: number          // Tasa informal (ElToque) - para costo
  USD_CUP_BCC: number      // Tasa oficial BCC (Segmento 3) - para venta
  USD_MLC: number          // Tasa MLC
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
    USD_CUP: 400,      // Fallback ElToque
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
        // Fetch ambas tasas en paralelo
        const [elToqueRes, bccRes] = await Promise.all([
          fetch('/api/market/pos/exchange-rates'),
          fetch('https://eltoque.cubarapid.com/api/tasas/bcc')
        ])

        const elToqueData = await elToqueRes.json()
        let bccData = null

        try {
          bccData = await bccRes.json()
        } catch (e) {
          console.warn('[Exchange Rates] Failed to parse BCC response:', e)
        }

        // Procesar tasa BCC
        let bccRate = 411 // Fallback
        let bccTimestamp = ''
        if (bccData && bccData.exito && bccData.tasas) {
          const usdRate = bccData.tasas.find((t: { moneda: string; tasa: number }) => t.moneda === 'USD')
          if (usdRate?.tasa) {
            bccRate = usdRate.tasa
            bccTimestamp = bccData.timestamp || new Date().toISOString()
          }
        }

        // Procesar tasa ElToque
        if (elToqueData.success && elToqueData.rates) {
          setRates({
            USD_CUP: elToqueData.rates.CUP || 400,
            USD_CUP_BCC: bccRate,
            USD_MLC: elToqueData.rates.MLC || 1.10,
            timestamp: elToqueData.timestamp || new Date().toISOString(),
            timestampBCC: bccTimestamp,
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
              USD_CUP_BCC: bccRate,
              USD_MLC: mlcRate,
              timestamp: fallbackData.timestamp || new Date().toISOString(),
              timestampBCC: bccTimestamp,
              loading: false,
              error: null
            })
          } else {
            setRates(prev => ({
              ...prev,
              USD_CUP_BCC: bccRate,
              timestampBCC: bccTimestamp,
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
