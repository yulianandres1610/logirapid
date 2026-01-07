import { NextRequest, NextResponse } from 'next/server'

// Cache para evitar múltiples llamadas
let cachedRates: {
  CUP: number       // ElToque (para costo)
  CUP_BCC: number   // BCC Banco Central (para venta)
  MLC: number
  EUR: number
  timestamp: string
  timestampBCC: string
  source: string
} | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos

/**
 * GET /api/market/pos/exchange-rates
 * Obtiene tasas de cambio actualizadas para el POS
 * - CUP: Tasa ElToque (informal) para COSTO
 * - CUP_BCC: Tasa BCC (oficial) para VENTA
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

    // Fetch desde ambas APIs en paralelo
    console.log('[POS Exchange Rates] Fetching from external APIs...')

    const [elToqueResponse, bccResponse] = await Promise.all([
      fetch('http://173.249.39.167:8000/tasas', {
        method: 'GET',
        headers: { 'access_token': 'tu_clave_secreta_aqui' },
        signal: AbortSignal.timeout(10000)
      }).catch(e => {
        console.warn('[POS Exchange Rates] ElToque API error:', e.message)
        return null
      }),
      fetch('https://eltoque.cubarapid.com/api/tasas/bcc', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000)
      }).catch(e => {
        console.warn('[POS Exchange Rates] BCC API error:', e.message)
        return null
      })
    ])

    // Procesar tasa BCC (para venta)
    let bccRate = 411 // Fallback
    let bccTimestamp = new Date().toISOString()
    if (bccResponse && bccResponse.ok) {
      try {
        const bccData = await bccResponse.json()
        if (bccData.exito && bccData.tasas) {
          const usdRate = bccData.tasas.find((t: { moneda: string; tasa: number }) => t.moneda === 'USD')
          if (usdRate?.tasa) {
            bccRate = usdRate.tasa
            bccTimestamp = bccData.timestamp || new Date().toISOString()
          }
        }
      } catch (e) {
        console.warn('[POS Exchange Rates] Error parsing BCC response:', e)
      }
    }

    // Procesar tasa ElToque (para costo)
    let elToqueRate = 440 // Fallback
    let mlcRate = 1.11
    let eurRate = 485
    let elToqueTimestamp = new Date().toISOString()
    let elToqueSource = 'fallback'

    if (elToqueResponse && elToqueResponse.ok) {
      try {
        const data = await elToqueResponse.json()
        if (data.monedas && Array.isArray(data.monedas)) {
          const rates: Record<string, number> = {}
          for (const moneda of data.monedas) {
            rates[moneda.moneda] = moneda.precio_cup
          }
          elToqueRate = rates.USD || 440
          mlcRate = rates.MLC ? (rates.USD / rates.MLC) : 1.11
          eurRate = rates.EUR || 485
          elToqueTimestamp = data.fecha_actualizacion
          elToqueSource = data.origen || 'eltoque'
        }
      } catch (e) {
        console.warn('[POS Exchange Rates] Error parsing ElToque response:', e)
      }
    }

    // Construir respuesta para el POS
    const posRates = {
      CUP: elToqueRate,       // ElToque para COSTO
      CUP_BCC: bccRate,       // BCC para VENTA
      MLC: mlcRate,
      EUR: eurRate,
      USD_CUP: elToqueRate,
      USD_CUP_BCC: bccRate,
      timestamp: elToqueTimestamp,
      timestampBCC: bccTimestamp,
      source: elToqueSource
    }

    // Actualizar cache
    cachedRates = {
      CUP: posRates.CUP,
      CUP_BCC: posRates.CUP_BCC,
      MLC: posRates.MLC,
      EUR: eurRate,
      timestamp: elToqueTimestamp,
      timestampBCC: bccTimestamp,
      source: elToqueSource
    }
    cacheTimestamp = now

    console.log('[POS Exchange Rates] Updated rates:', {
      CUP: posRates.CUP,
      CUP_BCC: posRates.CUP_BCC,
      MLC: posRates.MLC,
      source: elToqueSource
    })

    return NextResponse.json({
      success: true,
      rates: posRates,
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
      CUP_BCC: 411,
      MLC: 1.11,
      EUR: 485,
      timestamp: new Date().toISOString(),
      timestampBCC: new Date().toISOString(),
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
