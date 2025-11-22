import { NextRequest, NextResponse } from 'next/server'
import ElToqueAPI, { ExchangeRate } from '@/lib/eltoque-api'
import { db } from '@/lib/database'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * Obtiene las últimas tasas desde la base de datos
 * Fallback cuando ElToque API no está disponible
 */
async function getRatesFromDatabase() {
  try {
    const query = `
      SELECT currency, baserate as rate, timestamp
      FROM agency_rates_history
      WHERE timestamp = (
        SELECT MAX(timestamp)
        FROM agency_rates_history
      )
      ORDER BY currency
    `

    const result = await db.query(query)

    if (result.rows.length === 0) {
      return null
    }

    // Formatear tasas de BD al mismo formato que ElToque
    const formattedRates: Record<string, any> = {}

    result.rows.forEach((row: any) => {
      const rate = parseFloat(row.rate)
      formattedRates[row.currency] = {
        rate: rate,
        formatted: rate.toFixed(2),
        lastUpdate: new Date(row.timestamp).toLocaleString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        variacion: 0 // BD no tiene variación histórica
      }
    })

    return formattedRates
  } catch (error) {
    console.error('[getRatesFromDatabase] Error:', error)
    return null
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

      // Intentar obtener tasas desde la base de datos
      console.log('🔄 Attempting to load rates from database...')
      const dbRates = await getRatesFromDatabase()

      if (dbRates) {
        const duration = Date.now() - startTime
        console.log('✅ Loaded rates from database')
        return NextResponse.json({
          success: true,
          data: dbRates,
          source: 'database',
          warning: 'El servicio externo no está disponible. Usando últimas tasas guardadas.',
          message: 'Tasas de cambio (base de datos)',
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`
        }, { status: 200 })
      }

      // Si no hay tasas en BD, retornar error
      const duration = Date.now() - startTime
      console.error('❌ No rates available in database')
      return NextResponse.json({
        success: false,
        error: 'No se pudieron obtener las tasas de cambio',
        message: 'El servicio externo no está disponible y no hay tasas guardadas',
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`
      }, { status: 503 })
    }
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`❌ Error in exchange rates API after ${duration}ms:`, error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    })

    // Intentar cargar desde BD como último recurso
    try {
      console.log('🔄 Final attempt: loading from database...')
      const dbRates = await getRatesFromDatabase()

      if (dbRates) {
        console.log('✅ Recovered using database rates')
        return NextResponse.json({
          success: true,
          data: dbRates,
          source: 'database',
          warning: 'Error crítico en el servicio. Usando últimas tasas guardadas.',
          message: 'Tasas de cambio (recuperación)',
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`
        }, { status: 200 })
      }
    } catch (dbError) {
      console.error('❌ Database fallback also failed:', dbError)
    }

    // Sin tasas disponibles - retornar error
    return NextResponse.json({
      success: false,
      error: 'No se pudieron obtener las tasas de cambio',
      message: 'Error crítico: servicio externo no disponible y sin tasas guardadas',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`
    }, { status: 503 })
  }
}