import { NextRequest, NextResponse } from 'next/server'
import { getPublishedRates } from '@/lib/database'

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

    // Obtener tasas publicadas más recientes
    const rates = await getPublishedRates()

    if (!rates || rates.length === 0) {
      console.log('[PUBLISHED_RATES] No rates found in database')
      return NextResponse.json({
        success: false,
        message: 'No published rates available',
        rates: []
      }, { status: 200 })
    }

    // Formatear respuesta para agencias (solo datos necesarios)
    const formattedRates = rates.map(r => ({
      currency: r.currency,
      rate: parseFloat(r.rate),
      lastUpdated: r.timestamp
    }))

    console.log(`[PUBLISHED_RATES] Returning ${formattedRates.length} published rates`)

    return NextResponse.json({
      success: true,
      rates: formattedRates,
      lastUpdated: rates[0]?.timestamp || new Date().toISOString()
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
