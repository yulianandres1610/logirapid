import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Caché en memoria simple
interface CachedData {
  rates: any[]
  lastUpdated: string
  baseRates: Record<string, number>
}
let cachedRates: CachedData | null = null
let cacheTimestamp = 0
const CACHE_TTL = 30000 // 30 segundos

/**
 * Endpoint para que las AGENCIAS consulten las tasas publicadas
 *
 * SIMPLIFICADO: Obtiene tasas directamente de ElToque y aplica ajuste
 * No depende de la tabla agency_rates_history para evitar problemas de sincronización
 */
export async function GET(request: NextRequest) {
  try {
    const now = Date.now()
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('refresh') === 'true'

    // Si hay caché válido Y no se fuerza refresh, retornar inmediatamente
    if (!forceRefresh && cachedRates && (now - cacheTimestamp) < CACHE_TTL) {
      console.log('[PUBLISHED_RATES] Returning cached rates')
      return NextResponse.json({
        success: true,
        rates: cachedRates.rates,
        lastUpdated: cachedRates.lastUpdated,
        source: 'cache',
        cached: true
      })
    }

    console.log('[PUBLISHED_RATES] Fetching fresh rates from ElToque...')

    // 1. Obtener tasas frescas de ElToque
    let baseRates: Record<string, number> = {}

    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://agencias.logirapid.com'
      const elToqueResponse = await fetch(`${baseUrl}/api/exchange-rates?forceRefresh=true`, {
        signal: AbortSignal.timeout(10000),
        cache: 'no-store'
      })
      const elToqueData = await elToqueResponse.json()

      if (elToqueData.success && elToqueData.data) {
        Object.entries(elToqueData.data).forEach(([currency, rateData]: [string, any]) => {
          if (typeof rateData === 'object' && rateData.rate) {
            baseRates[currency] = rateData.rate
          }
        })
        console.log('[PUBLISHED_RATES] Got', Object.keys(baseRates).length, 'rates from ElToque:',
          `USD=${baseRates['USD']}, EUR=${baseRates['EUR']}`)
      }
    } catch (elToqueError) {
      console.error('[PUBLISHED_RATES] ElToque fetch failed:', elToqueError)
      // Usar caché anterior si existe
      if (cachedRates?.baseRates) {
        baseRates = cachedRates.baseRates
        console.log('[PUBLISHED_RATES] Using previous cached rates as fallback')
      }
    }

    if (Object.keys(baseRates).length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No hay tasas disponibles',
        rates: []
      }, { status: 200 })
    }

    // 2. Obtener configuración de ajuste desde la base de datos
    let adjustmentPercentage = 0
    try {
      const { getAgencyConfig } = await import('@/lib/database')
      const config = await getAgencyConfig()
      if (config && config.isActive) {
        adjustmentPercentage = config.adjustmentPercentage || 0
      }
    } catch (configError) {
      console.warn('[PUBLISHED_RATES] Could not load config, using 0% adjustment')
    }

    // 3. Calcular tasas con ajuste
    const lastUpdated = new Date().toISOString()
    const formattedRates = Object.entries(baseRates).map(([currency, baseRate]) => {
      const agencyRate = baseRate * (1 + adjustmentPercentage / 100)
      return {
        currency,
        rate: Math.round(agencyRate * 100) / 100,
        lastUpdated
      }
    })

    // 4. Guardar en caché
    cachedRates = {
      rates: formattedRates,
      lastUpdated,
      baseRates
    }
    cacheTimestamp = now

    console.log(`[PUBLISHED_RATES] Returning ${formattedRates.length} rates (${adjustmentPercentage}% adjustment)`)

    return NextResponse.json({
      success: true,
      rates: formattedRates,
      lastUpdated,
      source: 'eltoque',
      adjustmentPercentage
    })

  } catch (error) {
    console.error('[PUBLISHED_RATES] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener tasas publicadas',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
