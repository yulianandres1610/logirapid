import { NextRequest, NextResponse } from 'next/server'
import { AgencyRatesService } from '../../../../lib/agency-rates.service'

// POST: Inicializar tasas de agencia para una nueva empresa
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId } = body

    const service = AgencyRatesService.getInstance()

    // Verificar si ya existe configuración
    const existingConfig = service.getConfig()
    if (existingConfig && existingConfig.isActive) {
      return NextResponse.json({
        success: true,
        message: 'Las tasas de agencia ya están configuradas',
        data: {
          rates: service.calculateAgencyRates(),
          config: existingConfig,
          timestamp: new Date().toISOString()
        }
      })
    }

    // Si no hay configuración, usar valores por defecto
    const defaultConfig = {
      adjustmentPercentage: 5.0, // 5% por defecto
      isActive: true,
      companyId: companyId || 'default'
    }

    service.updateConfig(defaultConfig)

    const rates = service.calculateAgencyRates()
    const config = service.getConfig()

    return NextResponse.json({
      success: true,
      data: {
        rates,
        config: config!,
        timestamp: new Date().toISOString()
      },
      message: 'Tasas de agencia inicializadas exitosamente'
    })

  } catch (error) {
    console.error('Error in agency-rates initialize POST:', error)

    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor al inicializar tasas de agencia',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}