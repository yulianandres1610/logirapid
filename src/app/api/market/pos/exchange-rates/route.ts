import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

// Constante para margen mayorista sobre ElToque
const WHOLESALE_MARGIN_CUP = 15

// Cache para evitar múltiples llamadas
let cachedRates: {
  CUP: number           // Tasa principal (manual o ElToque)
  CUP_BCC: number       // BCC Banco Central (para referencia)
  CUP_WHOLESALE: number // Tasa + margen para mayoreo
  CUP_ELTOQUE: number   // Siempre ElToque (para referencia)
  MLC: number
  EUR: number
  timestamp: string
  timestampBCC: string
  source: string        // 'manual' | 'eltoque' | 'fallback'
  companyId?: number
} | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos

// Helper to get company ID from cookies
async function getCompanyIdFromCookies(): Promise<number | null> {
  try {
    const cookieStore = await cookies()
    const companyId = cookieStore.get('user-company-id')?.value
    return companyId ? parseInt(companyId) : null
  } catch {
    return null
  }
}

// Get manual rate from database
async function getManualRate(companyId: number): Promise<{ rate: number; updatedAt: string } | null> {
  try {
    const result = await db.query(
      `SELECT manual_rate, updated_at FROM market_exchange_rate_config WHERE company_id = $1`,
      [companyId]
    )

    if (result.rows[0]?.manual_rate) {
      const rate = parseFloat(result.rows[0].manual_rate)
      if (rate > 0) {
        return {
          rate,
          updatedAt: result.rows[0].updated_at
        }
      }
    }
    return null
  } catch (error) {
    console.warn('[POS Exchange Rates] Error fetching manual rate:', error)
    return null
  }
}

/**
 * GET /api/market/pos/exchange-rates
 * Obtiene tasas de cambio actualizadas para el POS
 * - Prioridad: Tasa manual configurada > ElToque
 * - CUP: Tasa principal (manual si existe, sino ElToque)
 * - CUP_ELTOQUE: Siempre ElToque (para referencia)
 * - CUP_BCC: Tasa BCC (para referencia)
 */
export async function GET(request: NextRequest) {
  try {
    const now = Date.now()

    // Get company ID from query params or cookies
    const { searchParams } = new URL(request.url)
    const queryCompanyId = searchParams.get('companyId')
    const cookieCompanyId = await getCompanyIdFromCookies()
    const companyId = queryCompanyId ? parseInt(queryCompanyId) : cookieCompanyId

    // Check if we can use cache (same company)
    if (cachedRates && (now - cacheTimestamp) < CACHE_DURATION && cachedRates.companyId === companyId) {
      return NextResponse.json({
        success: true,
        rates: cachedRates,
        cached: true
      })
    }

    // Check for manual rate first
    let manualRateData: { rate: number; updatedAt: string } | null = null
    if (companyId) {
      manualRateData = await getManualRate(companyId)
    }

    // Fetch desde ambas APIs en paralelo
    console.log('[POS Exchange Rates] Fetching from external APIs...')

    const [elToqueResponse, bccResponse] = await Promise.all([
      fetch('https://scrapping-z2dx.onrender.com/api/data', {
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

    // Procesar tasa BCC (para referencia)
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

    // Procesar tasa ElToque (siempre se obtiene para referencia)
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
            // Handle both "USD" and "1 USD" formats
            const code = moneda.moneda.replace(/^\d+\s*/, '').trim()
            rates[code] = moneda.precio_cup
          }
          elToqueRate = rates.USD || 440
          mlcRate = rates.MLC ? (rates.USD / rates.MLC) : 1.11
          eurRate = rates.EUR || 485
          elToqueTimestamp = data.fecha_actualizacion
          elToqueSource = 'eltoque'
        }
      } catch (e) {
        console.warn('[POS Exchange Rates] Error parsing ElToque response:', e)
      }
    }

    // Determinar tasa principal: manual si existe, sino ElToque
    let mainRate: number
    let mainSource: string
    let mainTimestamp: string

    if (manualRateData) {
      mainRate = manualRateData.rate
      mainSource = 'manual'
      mainTimestamp = manualRateData.updatedAt
      console.log('[POS Exchange Rates] Using manual rate:', mainRate)
    } else {
      mainRate = elToqueRate
      mainSource = elToqueSource
      mainTimestamp = elToqueTimestamp
      console.log('[POS Exchange Rates] Using ElToque rate:', mainRate)
    }

    // Calcular tasa mayoreo (tasa principal + margen)
    const wholesaleRate = mainRate + WHOLESALE_MARGIN_CUP

    // Construir respuesta para el POS
    const posRates = {
      CUP: mainRate,               // Tasa principal (manual o ElToque)
      CUP_BCC: bccRate,            // BCC para referencia
      CUP_WHOLESALE: wholesaleRate, // Tasa principal + 15 para mayoreo
      CUP_ELTOQUE: elToqueRate,    // Siempre ElToque (para referencia)
      MLC: mlcRate,
      EUR: eurRate,
      USD_CUP: mainRate,           // Alias para compatibilidad
      USD_CUP_BCC: bccRate,
      USD_CUP_WHOLESALE: wholesaleRate,
      USD_CUP_ELTOQUE: elToqueRate,
      timestamp: mainTimestamp,
      timestampBCC: bccTimestamp,
      timestampElToque: elToqueTimestamp,
      source: mainSource,
      companyId
    }

    // Actualizar cache
    cachedRates = {
      CUP: posRates.CUP,
      CUP_BCC: posRates.CUP_BCC,
      CUP_WHOLESALE: posRates.CUP_WHOLESALE,
      CUP_ELTOQUE: posRates.CUP_ELTOQUE,
      MLC: posRates.MLC,
      EUR: eurRate,
      timestamp: mainTimestamp,
      timestampBCC: bccTimestamp,
      source: mainSource,
      companyId
    }
    cacheTimestamp = now

    console.log('[POS Exchange Rates] Updated rates:', {
      CUP: posRates.CUP,
      CUP_ELTOQUE: posRates.CUP_ELTOQUE,
      CUP_BCC: posRates.CUP_BCC,
      CUP_WHOLESALE: posRates.CUP_WHOLESALE,
      source: mainSource
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
      CUP_WHOLESALE: 440 + WHOLESALE_MARGIN_CUP, // 455
      CUP_ELTOQUE: 440,
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
