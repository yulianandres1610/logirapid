import { NextRequest, NextResponse } from 'next/server'
import { saveAgencyRatesHistory, getAgencyConfig } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// API de ElToque
const ELTOQUE_API_URL = 'https://api.eltoque.com/v1/rates'

interface ElToqueRate {
  currency: string
  rate: number
  rate_name?: string
}

export async function GET(request: NextRequest) {
  try {
    console.log('[CRON] Starting exchange rates update...')

    // Verificar que sea una llamada de cron (opcional: agregar auth header)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'dev-secret'

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.log('[CRON] Unauthorized cron attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Obtener configuración de ajuste actual
    const config = await getAgencyConfig()

    if (!config) {
      console.log('[CRON] No agency config found, skipping update')
      return NextResponse.json({
        success: false,
        message: 'No agency configuration found'
      }, { status: 200 })
    }

    const adjustmentPercentage = parseFloat(config.adjustmentPercentage) || 0
    console.log(`[CRON] Using adjustment percentage: ${adjustmentPercentage}%`)

    // 2. Consultar tasas de ElToque
    const response = await fetch(ELTOQUE_API_URL, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LogiRapid/1.0'
      }
    })

    if (!response.ok) {
      console.error('[CRON] ElToque API error:', response.status)
      return NextResponse.json({
        success: false,
        error: 'ElToque API error'
      }, { status: 500 })
    }

    const data = await response.json()
    console.log('[CRON] Rates fetched from ElToque:', data.length, 'currencies')

    // 3. Procesar tasas y aplicar ajuste
    const historyRecords = data.map((rate: ElToqueRate) => {
      const baseRate = rate.rate
      const agencyRate = baseRate * (1 + adjustmentPercentage / 100)

      return {
        id: `${config.id}_${rate.currency}_${Date.now()}`,
        configId: config.id,
        currency: rate.currency,
        baseRate: baseRate,
        agencyRate: agencyRate,
        adjustmentPercentage: adjustmentPercentage
      }
    })

    // 4. Guardar en historial
    const saved = await saveAgencyRatesHistory(historyRecords)

    console.log(`[CRON] Saved ${saved.length} rate records to history`)

    return NextResponse.json({
      success: true,
      message: `Updated ${saved.length} exchange rates`,
      timestamp: new Date().toISOString(),
      adjustmentPercentage: adjustmentPercentage,
      rates: saved.map(r => ({
        currency: r.currency,
        baseRate: r.baseRate,
        agencyRate: r.agencyRate
      }))
    })

  } catch (error) {
    console.error('[CRON] Error updating exchange rates:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
