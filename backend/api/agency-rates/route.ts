import { NextRequest, NextResponse } from 'next/server'
import { AgencyRatesService } from '../../services/agency-rates.service'
import { AgencyRatesResponse, AgencyRateUpdateRequest, CalculationBreakdown } from '../../types/agency-rates'

// GET: Obtener todas las tasas de agencia
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const currency = searchParams.get('currency')
    const breakdown = searchParams.get('breakdown') === 'true'
    const history = searchParams.get('history')
    const days = parseInt(searchParams.get('days') || '30')

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

    // Obtener tasas base desde eltoque (simulado)
    const baseRates = service.getBaseRates()

    // Si hay tasas base reales, actualizarlas en el servicio
    if (Object.keys(baseRates).length > 0) {
      service.updateBaseRates(baseRates)
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

    service.updateConfig(updateData)

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

    service.updateConfig(defaultConfig)

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