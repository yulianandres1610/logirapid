import { NextRequest, NextResponse } from 'next/server'
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
const CACHE_TTL = 30000 // 30 segundos (reducido para reflejar cambios más rápido)

/**
 * Endpoint para que las AGENCIAS consulten las tasas publicadas
 *
 * IMPORTANTE: Este endpoint SIEMPRE calcula las tasas en tiempo real usando:
 * - Tasas base de ElToque (o las más recientes disponibles)
 * - Porcentaje de ajuste configurado globalmente en /dashboard/admin/exchange-rate?tab=agency
 *
 * Fórmula: tasaAgencia = tasaBase * (1 + ajuste% / 100)
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
      console.log('[PUBLISHED_RATES] Force refresh requested, calculating fresh rates...')
      // Limpiar caché al forzar refresh
      cachedRates = null
      cacheTimestamp = 0
    } else {
      console.log('[PUBLISHED_RATES] Cache miss, calculating rates...')
    }

    // SIEMPRE calcular tasas desde AgencyRatesService (usa configuración global actual)
    const service = AgencyRatesService.getInstance()

    // Esperar a que el servicio esté inicializado
    await service.ensureBaseRatesLoaded()

    let agencyRates = service.calculateAgencyRates()

    // Si no hay tasas base cargadas, intentar obtener de ElToque
    if (!agencyRates || Object.keys(agencyRates).length === 0) {
      console.log('[PUBLISHED_RATES] No base rates loaded, fetching from ElToque API...')

      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const elToqueResponse = await fetch(`${baseUrl}/api/exchange-rates?forceRefresh=true`, {
          signal: AbortSignal.timeout(8000)
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
            console.log('[PUBLISHED_RATES] Loaded', Object.keys(freshBaseRates).length, 'base rates from ElToque')
            // Actualizar servicio con las nuevas tasas base
            await service.updateBaseRates(freshBaseRates, true)
            agencyRates = service.calculateAgencyRates()
          }
        }
      } catch (elToqueError) {
        console.warn('[PUBLISHED_RATES] Failed to fetch from ElToque:', elToqueError)
      }
    }

    // Si aún no hay tasas, retornar error
    if (!agencyRates || Object.keys(agencyRates).length === 0) {
      console.log('[PUBLISHED_RATES] No rates available')
      return NextResponse.json({
        success: false,
        message: 'No hay tasas disponibles. El administrador debe configurar las tasas.',
        rates: []
      }, { status: 200 })
    }

    // Obtener configuración para logging
    const config = service.getConfig()
    console.log(`[PUBLISHED_RATES] Calculating rates with ${config?.adjustmentPercentage || 0}% adjustment`)

    // Formatear tasas calculadas
    const lastUpdated = new Date().toISOString()
    const formattedRates = Object.entries(agencyRates).map(([currency, rateData]) => ({
      currency,
      rate: rateData.agencyRate,
      lastUpdated
    }))

    // Guardar en caché
    cachedRates = { rates: formattedRates, lastUpdated, source: 'calculated' }
    cacheTimestamp = now

    console.log(`[PUBLISHED_RATES] Returning ${formattedRates.length} calculated rates (adjustment: ${config?.adjustmentPercentage || 0}%)`)

    return NextResponse.json({
      success: true,
      rates: formattedRates,
      lastUpdated,
      source: 'calculated',
      adjustmentPercentage: config?.adjustmentPercentage
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
