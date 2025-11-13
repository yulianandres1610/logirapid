import { NextRequest, NextResponse } from 'next/server'
import AgencyRatesManager, { AgencyRateConfig } from '@/lib/agency-rates'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


export async function GET(
  request: NextRequest,
  context: { params: Promise<{ agencyId: string }> }
) {
  try {
    const { agencyId } = await context.params
    console.log(`🏦 Fetching rates for agency: ${agencyId}`)

    // Obtener tasas formateadas para la agencia
    const rates = await AgencyRatesManager.getAgencyFormattedRates(agencyId)

    return NextResponse.json({
      success: true,
      data: {
        agencyId,
        rates,
        message: 'Agency rates retrieved successfully',
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error(`❌ Error fetching agency rates:`, error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ agencyId: string }> }
) {
  try {
    const { agencyId } = await context.params
    const body = await request.json()

    console.log(`💾 Saving config for agency: ${agencyId}`, body)

    // Validar datos de entrada
    const { agencyName, adjustments } = body

    if (!agencyName) {
      return NextResponse.json({
        success: false,
        error: 'Agency name is required'
      }, { status: 400 })
    }

    if (!adjustments || typeof adjustments !== 'object') {
      return NextResponse.json({
        success: false,
        error: 'Adjustments are required'
      }, { status: 400 })
    }

    // Validar que cada ajuste tenga la estructura correcta
    const validCurrencies = ['USD', 'EUR', 'MLC', 'GBP', 'CAD', 'MXN', 'BRL', 'ZELLE', 'CLA']
    for (const currency of validCurrencies) {
      const adjustment = adjustments[currency]
      if (!adjustment || typeof adjustment.percentage !== 'number' || typeof adjustment.enabled !== 'boolean') {
        return NextResponse.json({
          success: false,
          error: `Invalid adjustment for ${currency}. Required: { percentage: number, enabled: boolean }`
        }, { status: 400 })
      }
    }

    // Guardar configuración
    const config = await AgencyRatesManager.saveAgencyConfig({
      agencyId,
      agencyName,
      adjustments
    })

    return NextResponse.json({
      success: true,
      data: config,
      message: 'Agency configuration saved successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error(`❌ Error saving agency config:`, error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ agencyId: string }> }
) {
  try {
    const { agencyId } = await context.params
    console.log(`🗑️ Deleting config for agency: ${agencyId}`)

    const success = await AgencyRatesManager.deleteAgencyConfig(agencyId)

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Agency configuration deleted successfully',
        timestamp: new Date().toISOString()
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Failed to delete agency configuration',
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }
  } catch (error) {
    console.error(`❌ Error deleting agency config:`, error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}