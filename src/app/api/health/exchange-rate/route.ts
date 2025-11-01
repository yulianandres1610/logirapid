import { NextRequest, NextResponse } from 'next/server'
import ElToqueAPI from '@/lib/eltoque-api'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const healthStatus = {
    status: 'unknown',
    timestamp: new Date().toISOString(),
    duration: 0,
    tests: [] as any[],
    endpoints: {} as any,
    rates: null as any,
    error: null as string | null
  }

  try {
    console.log('🏥 Starting API health check for eltoque.cubarapid.com')

    // Test diferentes endpoints
    const endpoints = [
      { name: 'Principal', url: '/api/tasas' },
      { name: 'Versión 1', url: '/api/v1/tasas' },
      { name: 'Simple', url: '/tasas' },
      { name: 'Exchange Rates', url: '/api/exchange-rates' },
      { name: 'Rates Direct', url: '/exchange-rates' }
    ]

    for (const endpoint of endpoints) {
      const testResult = {
        endpoint: endpoint.name,
        url: `https://eltoque.cubarapid.com${endpoint.url}`,
        status: 'unknown',
        responseTime: 0,
        statusCode: null as number | null,
        error: null as string | null,
        dataSample: null as any
      }

      const testStart = Date.now()

      try {

        const response = await fetch(testResult.url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; CUBARAPID-HealthCheck/1.0)'
          },
          cache: 'no-store'
        })

        testResult.responseTime = Date.now() - testStart
        testResult.statusCode = response.status

        if (response.ok) {
          const responseText = await response.text()

          if (responseText && responseText.trim() !== '') {
            try {
              const data = JSON.parse(responseText)
              testResult.dataSample = {
                type: typeof data,
                keys: Object.keys(data || {}),
                isArray: Array.isArray(data),
                sample: typeof data === 'object' && data !== null ?
                  JSON.stringify(data).substring(0, 200) + '...' :
                  data.toString().substring(0, 200)
              }
              testResult.status = 'success'
            } catch (parseError) {
              testResult.status = 'parse_error'
              testResult.error = 'JSON parse failed'
              testResult.dataSample = responseText.substring(0, 200)
            }
          } else {
            testResult.status = 'empty_response'
            testResult.error = 'Empty response'
          }
        } else {
          testResult.status = 'http_error'
          testResult.error = `HTTP ${response.status}: ${response.statusText}`
        }
      } catch (error) {
        testResult.status = 'connection_error'
        testResult.error = error instanceof Error ? error.message : 'Unknown error'
        testResult.responseTime = Date.now() - testStart
      }

      healthStatus.tests.push(testResult)
      healthStatus.endpoints[endpoint.name] = testResult
    }

    // Intentar obtener tasas reales
    try {
      console.log('🔄 Attempting to fetch real exchange rates...')
      const rates = await ElToqueAPI.getFormattedRates()
      healthStatus.rates = {
        success: true,
        count: Object.keys(rates).length,
        currencies: Object.keys(rates),
        sample: rates
      }
      console.log('✅ Successfully fetched rates:', Object.keys(rates))
    } catch (ratesError) {
      healthStatus.rates = {
        success: false,
        error: ratesError instanceof Error ? ratesError.message : 'Unknown error'
      }
      console.error('❌ Failed to fetch rates:', ratesError)
    }

    // Determinar estado general
    const successfulTests = healthStatus.tests.filter(t => t.status === 'success')
    const hasWorkingEndpoint = successfulTests.length > 0
    const hasRates = healthStatus.rates?.success

    if (hasWorkingEndpoint && hasRates) {
      healthStatus.status = 'healthy'
    } else if (hasWorkingEndpoint) {
      healthStatus.status = 'partial'
    } else {
      healthStatus.status = 'unhealthy'
    }

    healthStatus.duration = Date.now() - startTime

    console.log(`🏥 Health check completed: ${healthStatus.status} (${healthStatus.duration}ms)`)
    console.log(`✅ Successful endpoints: ${successfulTests.length}/${healthStatus.tests.length}`)
    console.log(`📊 Rates available: ${hasRates ? 'Yes' : 'No'}`)

    return NextResponse.json(healthStatus)

  } catch (error) {
    healthStatus.status = 'error'
    healthStatus.duration = Date.now() - startTime
    healthStatus.error = error instanceof Error ? error.message : 'Unknown error'
    healthStatus.tests = healthStatus.tests || []

    console.error('❌ Health check failed:', error)
    return NextResponse.json(healthStatus, { status: 500 })
  }
}