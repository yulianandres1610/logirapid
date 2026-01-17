import { NextRequest, NextResponse } from 'next/server'
import { getPublishedRates } from '@/lib/database'
import { AgencyRatesService } from '@/lib/agency-rates.service'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Caché en memoria para mejorar rendimiento
interface CachedData {
  rates: any[]
  lastUpdated: string
  source: string
}
let cachedRates: CachedData | null = null
let cacheTimestamp = 0
const CACHE_TTL = 60000 // 60 segundos

/**
 * Endpoint para que las AGENCIAS consulten las tasas publicadas
 * Solo retorna las tasas finales (con ajuste aplicado)
 * NO retorna el porcentaje de ajuste ni las tasas base de ElToque
 *
 * OPTIMIZACIÓN: Caché en memoria con TTL de 60 segundos
 */
export async function GET(request: NextRequest) {
  try {
    const now = Date.now()
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('refresh') === 'true'

    // Si hay caché válido Y no se fuerza refresh, retornar inmediatamente
    if (!forceRefresh && cachedRates && (now - cacheTimestamp) < CACHE_TTL) {
      console.log('[PUBLISHED_RATES] Returning cached rates (TTL remaining: ' + Math.round((CACHE_TTL - (now - cacheTimestamp)) / 1000) + 's)')
      return NextResponse.json({
        success: true,
        rates: cachedRates.rates,
        lastUpdated: cachedRates.lastUpdated,
        source: cachedRates.source,
        cached: true
      })
    }

    if (forceRefresh) {
      console.log('[PUBLISHED_RATES] Force refresh requested, bypassing cache...')
    } else {
      console.log('[PUBLISHED_RATES] Cache miss, fetching fresh rates...')
    }

    // Intentar obtener tasas publicadas desde historial
    let rates = await getPublishedRates()

    // Si no hay historial, calcular en tiempo real desde AgencyRatesService
    if (!rates || rates.length === 0) {
      console.log('[PUBLISHED_RATES] No history found, calculating from AgencyRatesService...')

      const service = AgencyRatesService.getInstance()

      // Esperar a que el servicio esté inicializado
      await service.ensureBaseRatesLoaded()

      let agencyRates = service.calculateAgencyRates()

      // Si aún no hay tasas, intentar obtener de ElToque directamente
      if (!agencyRates || Object.keys(agencyRates).length === 0) {
        console.log('[PUBLISHED_RATES] No rates from service, trying ElToque API...')

        try {
          const elToqueResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/exchange-rates`, {
            signal: AbortSignal.timeout(5000)
          })
          const elToqueData = await elToqueResponse.json()

          if (elToqueData.success && elToqueData.data) {
            const freshBaseRates: Record<string, number> = {}
            Object.entries(elToqueData.data).forEach(([currency, rateData]: [string, any]) => {
              if (typeof rateData === 'object' && rateData.rate) {
                freshBaseRates[currency] = rateData.rate
              }
            })

            if (Object.keys(freshBaseRates).length > 0) {
              // Actualizar servicio Y persistir al historial
              await service.updateBaseRates(freshBaseRates, true)
              agencyRates = service.calculateAgencyRates()
              console.log('[PUBLISHED_RATES] Loaded and persisted rates from ElToque')
            }
          }
        } catch (elToqueError) {
          console.warn('[PUBLISHED_RATES] Failed to fetch from ElToque:', elToqueError)
        }
      }

      if (!agencyRates || Object.keys(agencyRates).length === 0) {
        console.log('[PUBLISHED_RATES] No rates available from any source')
        return NextResponse.json({
          success: false,
          message: 'No published rates available',
          rates: []
        }, { status: 200 })
      }

      // Formatear tasas calculadas al formato de published rates
      const formattedRates = Object.entries(agencyRates).map(([currency, rateData]) => ({
        currency,
        rate: rateData.agencyRate,
        lastUpdated: rateData.lastUpdate
      }))

      // Guardar en caché
      const lastUpdated = new Date().toISOString()
      cachedRates = { rates: formattedRates, lastUpdated, source: 'calculated' }
      cacheTimestamp = now

      console.log(`[PUBLISHED_RATES] Returning ${formattedRates.length} calculated rates - cached`)

      return NextResponse.json({
        success: true,
        rates: formattedRates,
        lastUpdated,
        source: 'calculated'
      })
    }

    // Formatear respuesta para agencias (solo datos necesarios)
    const formattedRates = rates.map(r => ({
      currency: r.currency,
      rate: parseFloat(r.rate),
      lastUpdated: r.timestamp
    }))

    // Guardar en caché
    const lastUpdated = rates[0]?.timestamp || new Date().toISOString()
    cachedRates = { rates: formattedRates, lastUpdated, source: 'history' }
    cacheTimestamp = now

    console.log(`[PUBLISHED_RATES] Returning ${formattedRates.length} published rates from history - cached`)

    return NextResponse.json({
      success: true,
      rates: formattedRates,
      lastUpdated,
      source: 'history'
    })

  } catch (error) {
    console.error('[PUBLISHED_RATES] Error fetching published rates:', error)
    return NextResponse.json({
      success: false,
      error: 'Error fetching published rates',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
