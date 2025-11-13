import { NextRequest, NextResponse } from 'next/server'
import { AgencyRatesService } from '../../../lib/agency-rates.service'
import { AgencyRatesResponse, AgencyRateUpdateRequest, CalculationBreakdown } from '../../../types/agency-rates'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


// GET: Obtener todas las tasas de agencia
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const currency = searchParams.get('currency')
    const breakdown = searchParams.get('breakdown') === 'true'
    const history = searchParams.get('history')
    const days = parseInt(searchParams.get('days') || '30')
    const forceRefresh = searchParams.get('forceRefresh') === 'true'

    const service = AgencyRatesService.getInstance()

    // Si se solicita el breakdown de una moneda específica
    if (currency && breakdown) {
      const calcBreakdown: CalculationBreakdown | null = service.getCalculationBreakdown(currency)

      if (!calcBreakdown) {
        return NextResponse.json({
          success: false,
          error: `No se encontró información para la moneda ${currency}`
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        data: calcBreakdown
      })
    }

    // Si se solicita historial
    if (currency && history) {
      const rateHistory = service.getRateHistory(currency, days)

      return NextResponse.json({
        success: true,
        data: {
          currency,
          history: rateHistory,
          period: `${days} días`
        }
      })
    }

    // Obtener tasas base desde el API de eltoque
    let baseRates = service.getBaseRates()

    // Si las tasas base están vacías o se fuerza refresh, obtenerlas del API de exchange-rates con timeout mejorado
    if (Object.keys(baseRates).length === 0 || forceRefresh) {
      try {
        // Usar Promise.race para manejar timeout de forma más elegante
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout obteniendo tasas del API externa')), 20000) // 20 segundos
        })

        const fetchPromise = fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'}/api/exchange-rates`)
          .then(response => response.json())

        const exchangeRatesData = await Promise.race([fetchPromise, timeoutPromise]) as any

        if (exchangeRatesData.success && exchangeRatesData.data) {
          // Convertir tasas de exchange-rates al formato baseRates
          const freshBaseRates: Record<string, number> = {}
          Object.entries(exchangeRatesData.data).forEach(([currency, rateData]: [string, any]) => {
            if (typeof rateData === 'object' && rateData.rate) {
              freshBaseRates[currency] = rateData.rate
            }
          })

          if (Object.keys(freshBaseRates).length > 0) {
            service.updateBaseRates(freshBaseRates)
            baseRates = freshBaseRates
          }
        }
      } catch (apiError) {
        console.error('Error fetching base rates from exchange-rates API:', apiError)
      }
    }

    // Calcular tasas de agencia
    const agencyRates = service.calculateAgencyRates()
    const config = service.getConfig()

    const response: AgencyRatesResponse = {
      success: true,
      data: {
        rates: agencyRates,
        config: config!,
        timestamp: new Date().toISOString()
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error in agency-rates GET:', error)

    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor al obtener tasas de agencia',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// POST: Actualizar configuración de tasas de agencia
export async function POST(request: NextRequest) {
  try {
    const body: AgencyRateUpdateRequest = await request.json()

    // Validar cuerpo de la solicitud
    if (!body || typeof body.adjustmentPercentage !== 'number') {
      return NextResponse.json({
        success: false,
        error: 'Se requiere adjustmentPercentage como número'
      }, { status: 400 })
    }

    const service = AgencyRatesService.getInstance()

    // Validar configuración
    const validation = service.validateConfig(body.adjustmentPercentage)
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        error: validation.error
      }, { status: 400 })
    }

    // Actualizar configuración
    const updateData = {
      adjustmentPercentage: body.adjustmentPercentage,
      ...(body.isActive !== undefined && { isActive: body.isActive })
    }

    await service.updateConfig(updateData)

    // Recalcular tasas con nueva configuración
    const agencyRates = service.calculateAgencyRates()
    const config = service.getConfig()

    return NextResponse.json({
      success: true,
      data: {
        rates: agencyRates,
        config: config!,
        timestamp: new Date().toISOString()
      },
      message: 'Configuración de tasas actualizada exitosamente'
    })

  } catch (error) {
    console.error('Error in agency-rates POST:', error)

    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor al actualizar configuración',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// PUT: Actualizar tasas base (desde eltoque)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.rates || typeof body.rates !== 'object') {
      return NextResponse.json({
        success: false,
        error: 'Se requiere objeto rates con las tasas base'
      }, { status: 400 })
    }

    const service = AgencyRatesService.getInstance()
    service.updateBaseRates(body.rates)

    // Recalcular tasas de agencia con nuevas tasas base
    const agencyRates = service.calculateAgencyRates()
    const config = service.getConfig()

    return NextResponse.json({
      success: true,
      data: {
        rates: agencyRates,
        config: config!,
        baseRates: service.getBaseRates(),
        timestamp: new Date().toISOString()
      },
      message: 'Tasas base actualizadas y recalculadas exitosamente'
    })

  } catch (error) {
    console.error('Error in agency-rates PUT:', error)

    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor al actualizar tasas base',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// DELETE: Restablecer configuración por defecto
export async function DELETE(request: NextRequest) {
  try {
    const service = AgencyRatesService.getInstance()

    // Restablecer configuración por defecto
    const defaultConfig = {
      adjustmentPercentage: 5.0,
      isActive: true
    }

    await service.updateConfig(defaultConfig)

    // Recalcular tasas
    const agencyRates = service.calculateAgencyRates()
    const config = service.getConfig()

    return NextResponse.json({
      success: true,
      data: {
        rates: agencyRates,
        config: config!,
        timestamp: new Date().toISOString()
      },
      message: 'Configuración restablecida a valores por defecto'
    })

  } catch (error) {
    console.error('Error in agency-rates DELETE:', error)

    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor al restablecer configuración',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}