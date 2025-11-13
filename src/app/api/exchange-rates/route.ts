import { NextRequest, NextResponse } from 'next/server'
import ElToqueAPI, { ExchangeRate } from '@/lib/eltoque-api'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


// Función para obtener tasas de emergencia formateadas
function getEmergencyFormattedRates() {
  const now = new Date().toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  return {
    USD: { rate: 470, formatted: "470.00", lastUpdate: now, variacion: -0.5 },
    EUR: { rate: 525, formatted: "525.00", lastUpdate: now, variacion: 0.3 },
    MLC: { rate: 200, formatted: "200.00", lastUpdate: now, variacion: 0.0 },
    GBP: { rate: 487.91, formatted: "487.91", lastUpdate: now, variacion: 1.2 },
    CAD: { rate: 304.48, formatted: "304.48", lastUpdate: now, variacion: -0.8 },
    MXN: { rate: 23.46, formatted: "23.46", lastUpdate: now, variacion: 0.1 },
    BRL: { rate: 77.90, formatted: "77.90", lastUpdate: now, variacion: -0.3 },
    ZELLE: { rate: 449.21, formatted: "449.21", lastUpdate: now, variacion: 0.7 },
    CLA: { rate: 432.65, formatted: "432.65", lastUpdate: now, variacion: -0.2 }
  }
}

// GET - Obtener todas las tasas de cambio
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  console.log('🚀 Exchange rates API called at:', new Date().toISOString())

  try {
    const { searchParams } = new URL(request.url)
    const currency = searchParams.get('currency')
    const convert = searchParams.get('convert')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const amount = searchParams.get('amount')
    const forceRefresh = searchParams.get('forceRefresh')

    console.log('📋 Request params:', { currency, convert, from, to, amount, forceRefresh })

    // Lista de monedas válidas
    const validCurrencies = ['USD', 'EUR', 'MLC', 'GBP', 'CAD', 'MXN', 'BRL', 'ZELLE', 'CLA', 'CUP']

    // Si se solicita conversión
    if (convert === 'true' && from && to && amount) {
      const fromCurrency = from.toUpperCase()
      const toCurrency = to.toUpperCase()
      const amountNum = parseFloat(amount)

      if (!validCurrencies.includes(fromCurrency) ||
          !validCurrencies.includes(toCurrency)) {
        return NextResponse.json(
          { success: false, error: `Invalid currency. Must be one of: ${validCurrencies.join(', ')}` },
          { status: 400 }
        )
      }

      if (isNaN(amountNum) || amountNum <= 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid amount' },
          { status: 400 }
        )
      }

      const conversion = await ElToqueAPI.convertCurrency(
        fromCurrency as any,
        toCurrency as any,
        amountNum
      )

      return NextResponse.json({
        success: true,
        data: conversion,
        message: `Conversión de ${amountNum} ${fromCurrency} a ${toCurrency}`
      })
    }

    // Si se solicita una moneda específica
    if (currency) {
      const currencyUpper = currency.toUpperCase()
      if (!validCurrencies.filter(c => c !== 'CUP').includes(currencyUpper)) {
        return NextResponse.json(
          { success: false, error: `Invalid currency. Must be one of: ${validCurrencies.filter(c => c !== 'CUP').join(', ')}` },
          { status: 400 }
        )
      }

      const rate = await ElToqueAPI.getRate(currencyUpper as any)

      return NextResponse.json({
        success: true,
        data: {
          currency: rate.moneda,
          rate: rate.tasa,
          variacion: rate.variacion || 0,
          formatted: rate.tasa.toFixed(2),
          lastUpdate: new Date(rate.fechaActualizacion).toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        }
      })
    }

    // Obtener todas las tasas formateadas
    console.log('📈 Fetching all exchange rates...')

    try {
      const rates = await ElToqueAPI.getFormattedRates()

      const duration = Date.now() - startTime
      console.log(`✅ API request completed in ${duration}ms`)

      const response = {
        success: true,
        data: rates,
        message: 'Tasas de cambio actualizadas',
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`
      }

      console.log('📤 Sending response:', response)
      return NextResponse.json(response)

    } catch (apiError) {
      console.error('❌ ElToqueAPI.getFormattedRates failed:', apiError)

      // Si el API falla, devolver tasas de emergencia formateadas
      const emergencyRates = getEmergencyFormattedRates()

      const duration = Date.now() - startTime
      return NextResponse.json({
        success: true,
        data: emergencyRates,
        warning: 'Usando tasas de emergencia. El servicio externo no está disponible.',
        message: 'Tasas de cambio (emergencia)',
        error: apiError instanceof Error ? apiError.message : 'API Error',
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`
      }, { status: 200 })
    }
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`❌ Error in exchange rates API after ${duration}ms:`, error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    })

    // Devolver tasas de emergencia en caso de fallo del API externo
    const fallbackRates = {
      USD: { rate: 350, formatted: "350.00", lastUpdate: new Date().toLocaleString('es-ES'), variacion: 0 },
      EUR: { rate: 380, formatted: "380.00", lastUpdate: new Date().toLocaleString('es-ES'), variacion: 0 },
      MLC: { rate: 360, formatted: "360.00", lastUpdate: new Date().toLocaleString('es-ES'), variacion: 0 },
      GBP: { rate: 487.91, formatted: "487.91", lastUpdate: new Date().toLocaleString('es-ES'), variacion: 0 },
      CAD: { rate: 304.36, formatted: "304.36", lastUpdate: new Date().toLocaleString('es-ES'), variacion: 0 },
      MXN: { rate: 23.3, formatted: "23.30", lastUpdate: new Date().toLocaleString('es-ES'), variacion: 0 },
      BRL: { rate: 77.9, formatted: "77.90", lastUpdate: new Date().toLocaleString('es-ES'), variacion: 0 },
      ZELLE: { rate: 449.25, formatted: "449.25", lastUpdate: new Date().toLocaleString('es-ES'), variacion: 0 },
      CLA: { rate: 429.59, formatted: "429.59", lastUpdate: new Date().toLocaleString('es-ES'), variacion: 0 }
    }

    console.log('🛡️ Using fallback rates due to API failure')

    const errorResponse = {
      success: true,
      data: fallbackRates,
      warning: 'Usando tasas de respaldo. No se pudo conectar con el servicio externo.',
      message: 'Tasas de cambio (respaldo)',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    }

    console.log('📤 Sending error fallback response:', errorResponse)

    try {
      return NextResponse.json(errorResponse, { status: 200 })
    } catch (jsonError) {
      console.error('❌ Failed to serialize JSON response:', jsonError)
      // Si incluso el fallback falla, devolver una respuesta JSON mínima
      return NextResponse.json({
        success: false,
        error: 'Critical error in exchange rates API',
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }
  }
}