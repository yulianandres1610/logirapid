import { NextRequest, NextResponse } from 'next/server'

// Cache para evitar múltiples llamadas
let cachedRates: {
  CUP: number
  MLC: number
  EUR: number
  timestamp: string
  source: string
} | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos

/**
 * GET /api/market/pos/exchange-rates
 * Obtiene tasas de cambio actualizadas para el POS
 * Fuente: API externa de tasas de Cuba
 */
export async function GET(request: NextRequest) {
  try {
    const now = Date.now()

    // Usar cache si es válido
    if (cachedRates && (now - cacheTimestamp) < CACHE_DURATION) {
      return NextResponse.json({
        success: true,
        rates: cachedRates,
        cached: true
      })
    }

    // Fetch desde API externa
    console.log('[POS Exchange Rates] Fetching from external API...')

    const response = await fetch('http://173.249.39.167:8000/tasas', {
      method: 'GET',
      headers: {
        'access_token': 'tu_clave_secreta_aqui'
      },
      // Timeout de 10 segundos
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`)
    }

    const data = await response.json()

    if (!data.monedas || !Array.isArray(data.monedas)) {
      throw new Error('Invalid API response format')
    }

    // Extraer tasas relevantes
    const rates: Record<string, number> = {}
    for (const moneda of data.monedas) {
      rates[moneda.moneda] = moneda.precio_cup
    }

    // Construir respuesta para el POS
    const posRates = {
      CUP: rates.USD || 440, // Tasa USD -> CUP
      MLC: rates.MLC ? (rates.USD / rates.MLC) : 1.11, // Tasa USD -> MLC
      EUR: rates.EUR || 485,
      USD_CUP: rates.USD || 440,
      MLC_CUP: rates.MLC || 395,
      EUR_CUP: rates.EUR || 485,
      ZELLE_CUP: rates.ZELLE || 450,
      timestamp: data.fecha_actualizacion,
      source: data.origen
    }

    // Actualizar cache
    cachedRates = {
      CUP: posRates.CUP,
      MLC: posRates.MLC,
      EUR: rates.EUR || 485,
      timestamp: data.fecha_actualizacion,
      source: data.origen
    }
    cacheTimestamp = now

    console.log('[POS Exchange Rates] Updated rates:', {
      CUP: posRates.CUP,
      MLC: posRates.MLC,
      source: data.origen,
      updated: data.fecha_actualizacion
    })

    return NextResponse.json({
      success: true,
      rates: posRates,
      allRates: data.monedas.map((m: any) => ({
        currency: m.moneda,
        priceCUP: m.precio_cup,
        trend: m.tendencia,
        change: m.cambio
      })),
      lastUpdate: data.fecha_actualizacion,
      source: data.origen,
      cached: false
    })

  } catch (error) {
    console.error('[POS Exchange Rates] Error:', error)

    // Si hay cache, usarlo aunque esté expirado
    if (cachedRates) {
      console.log('[POS Exchange Rates] Using expired cache as fallback')
      return NextResponse.json({
        success: true,
        rates: cachedRates,
        cached: true,
        stale: true,
        error: 'Using cached rates (API unavailable)'
      })
    }

    // Tasas por defecto si todo falla
    const defaultRates = {
      CUP: 440,
      MLC: 1.11,
      EUR: 485,
      timestamp: new Date().toISOString(),
      source: 'default'
    }

    return NextResponse.json({
      success: true,
      rates: defaultRates,
      cached: false,
      default: true,
      error: 'Using default rates (API unavailable)'
    })
  }
}
