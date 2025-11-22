import { NextRequest, NextResponse } from 'next/server'
import { saveAgencyRatesHistory, getAgencyConfig } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// API de ElToque via CubaRAPID
const ELTOQUE_API_URL = 'https://eltoque.cubarapid.com/api/tasas'

interface ElToqueRate {
  moneda: string
  tasa: number
  variacion?: number
  fechaActualizacion?: string
}

interface ElToqueResponse {
  exito: boolean
  datos: ElToqueRate[]
  timestamp: string
  ultimaActualizacion?: any
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

    const adjustmentPercentage = typeof config.adjustmentPercentage === 'number'
      ? config.adjustmentPercentage
      : parseFloat(config.adjustmentPercentage) || 0
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

    const data: ElToqueResponse = await response.json()

    if (!data.exito || !data.datos || !Array.isArray(data.datos)) {
      console.error('[CRON] Invalid response from ElToque:', data)
      return NextResponse.json({
        success: false,
        error: 'Invalid response from ElToque API'
      }, { status: 500 })
    }

    console.log('[CRON] Rates fetched from ElToque:', data.datos.length, 'currencies')

    // 3. Procesar tasas y aplicar ajuste
    const timestamp = Date.now()
    const historyRecords = data.datos.map((rate: ElToqueRate, index: number) => {
      const baseRate = rate.tasa
      const agencyRate = baseRate * (1 + adjustmentPercentage / 100)

      return {
        id: `${config.id}_${rate.moneda}_${timestamp}_${index}`,
        configId: config.id,
        currency: rate.moneda,
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
      currencies: saved.length
    })

  } catch (error) {
    console.error('[CRON] Error updating exchange rates:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
