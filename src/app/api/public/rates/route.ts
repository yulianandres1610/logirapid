import { NextRequest, NextResponse } from 'next/server'
import ElToqueAPI from '@/lib/eltoque-api'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


interface GlobalRateConfig {
  id: string
  adjustmentPercentage: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  createdBy: string
}

export async function GET(request: NextRequest) {
  try {
    console.log('🏦 Public API: Fetching global agency rates')

    // Obtener configuración global (simulada desde localStorage o base de datos)
    let globalConfig: GlobalRateConfig | null = null

    // En producción, esto vendría de una base de datos
    // Por ahora, usamos una configuración por defecto
    globalConfig = {
      id: 'global_config_1',
      adjustmentPercentage: 5.0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system'
    }

    // Obtener tasas base deltoque
    const baseRates = await ElToqueAPI.getFormattedRates()

    // Calcular tasas para agencias
    const agencyRates: Record<string, any> = {}

    Object.entries(baseRates).forEach(([currency, rateData]) => {
      if (globalConfig?.isActive) {
        const baseRate = rateData.rate
        const calculatedRate = baseRate * (1 + globalConfig.adjustmentPercentage / 100)

        agencyRates[currency] = {
          currency,
          baseRate,
          adjustmentPercentage: globalConfig.adjustmentPercentage,
          calculatedRate: Math.round(calculatedRate * 100) / 100,
          formatted: calculatedRate.toFixed(2),
          lastUpdate: rateData.lastUpdate || new Date().toISOString(),
          variacion: rateData.variacion || 0,
          source: 'eltoque_agency'
        }
      } else {
        agencyRates[currency] = {
          ...rateData,
          source: 'eltoque_direct'
        }
      }
    })

    const response = {
      success: true,
      data: {
        rates: agencyRates,
        config: {
          adjustmentPercentage: globalConfig?.adjustmentPercentage || 0,
          isActive: globalConfig?.isActive || false,
          lastUpdated: globalConfig?.updatedAt || new Date().toISOString()
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          source: 'CUBARAPID Agency Rates API'
        }
      },
      message: 'Agency rates retrieved successfully'
    }

    // Agregar headers CORS para permitir acceso desde cualquier origen
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': 'public, max-age=300', // Caché por 5 minutos
      'Content-Type': 'application/json'
    }

    console.log('✅ Public API: Agency rates served successfully')
    console.log(`📊 Rates provided: ${Object.keys(agencyRates).length} currencies`)
    console.log(`💱 Adjustment: ${globalConfig?.adjustmentPercentage || 0}%`)

    return NextResponse.json(response, { headers })

  } catch (error) {
    console.error('❌ Public API: Error fetching agency rates:', error)

    const errorResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      meta: {
        version: '1.0.0',
        source: 'CUBARAPID Agency Rates API'
      }
    }

    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    }

    return NextResponse.json(errorResponse, {
      status: 500,
      headers
    })
  }
}

// Manejar solicitudes OPTIONS para CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  })
}