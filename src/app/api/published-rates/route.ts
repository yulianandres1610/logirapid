import { NextRequest, NextResponse } from 'next/server'
import { getPublishedRates } from '@/lib/database'
import { AgencyRatesService } from '@/lib/agency-rates.service'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Endpoint para que las AGENCIAS consulten las tasas publicadas
 * Solo retorna las tasas finales (con ajuste aplicado)
 * NO retorna el porcentaje de ajuste ni las tasas base de ElToque
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[PUBLISHED_RATES] Fetching published rates for agencies...')

    // Intentar obtener tasas publicadas desde historial
    let rates = await getPublishedRates()

    // Si no hay historial, calcular en tiempo real desde AgencyRatesService
    if (!rates || rates.length === 0) {
      console.log('[PUBLISHED_RATES] No history found, calculating from AgencyRatesService...')

      const service = AgencyRatesService.getInstance()
      const agencyRates = service.calculateAgencyRates()

      if (!agencyRates || Object.keys(agencyRates).length === 0) {
        console.log('[PUBLISHED_RATES] No rates available from service')
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

      console.log(`[PUBLISHED_RATES] Returning ${formattedRates.length} calculated rates (no history)`)

      return NextResponse.json({
        success: true,
        rates: formattedRates,
        lastUpdated: new Date().toISOString(),
        source: 'calculated'
      })
    }

    // Formatear respuesta para agencias (solo datos necesarios)
    const formattedRates = rates.map(r => ({
      currency: r.currency,
      rate: parseFloat(r.rate),
      lastUpdated: r.timestamp
    }))

    console.log(`[PUBLISHED_RATES] Returning ${formattedRates.length} published rates from history`)

    return NextResponse.json({
      success: true,
      rates: formattedRates,
      lastUpdated: rates[0]?.timestamp || new Date().toISOString(),
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
