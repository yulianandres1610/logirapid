// Servicio para consumir el API de tasas de cambio de ElToque
// Endpoint: http://173.249.39.167:8000/tasas

export interface ExchangeRate {
  moneda: string
  tasa: number
  fechaActualizacion: string
  variacion?: number
}

// Dynamic type that accepts any currency from the API
export type AllExchangeRates = Record<string, ExchangeRate>

// Currency metadata for UI display
export interface CurrencyMeta {
  flag: string
  name: string
  symbol?: string
}

// Comprehensive currency metadata - add new currencies here
export const CURRENCY_METADATA: Record<string, CurrencyMeta> = {
  USD: { flag: '🇺🇸', name: 'Dólar Americano', symbol: '$' },
  EUR: { flag: '🇪🇺', name: 'Euro', symbol: '€' },
  MLC: { flag: '💳', name: 'Tarjeta MLC', symbol: 'MLC' },
  CUP: { flag: '🇨🇺', name: 'Peso Cubano', symbol: '₱' },
  GBP: { flag: '🇬🇧', name: 'Libra Esterlina', symbol: '£' },
  CAD: { flag: '🇨🇦', name: 'Dólar Canadiense', symbol: 'C$' },
  MXN: { flag: '🇲🇽', name: 'Peso Mexicano', symbol: 'MX$' },
  BRL: { flag: '🇧🇷', name: 'Real Brasileño', symbol: 'R$' },
  ZELLE: { flag: '💸', name: 'Zelle', symbol: 'Z' },
  CLA: { flag: '🏦', name: 'Classic', symbol: 'CLA' },
  USDT: { flag: '💰', name: 'Tether USDT', symbol: '₮' },
  BTC: { flag: '₿', name: 'Bitcoin', symbol: '₿' },
  ETH: { flag: '⟠', name: 'Ethereum', symbol: 'Ξ' },
  TRX: { flag: '🔷', name: 'Tron', symbol: 'TRX' },
  ECU: { flag: '🇪🇨', name: 'Dólar Ecuatoriano', symbol: '$' },
}

// Helper function to get currency metadata with fallback
export function getCurrencyMeta(currency: string): CurrencyMeta {
  return CURRENCY_METADATA[currency.toUpperCase()] || {
    flag: '💱',
    name: currency,
    symbol: currency
  }
}

class ElToqueAPI {
  private static readonly BASE_URL = 'http://173.249.39.167:8000'
  private static readonly ACCESS_TOKEN = 'tu_clave_secreta_aqui'
  private static lastFetchTime = 0
  private static readonly MIN_FETCH_INTERVAL = 300000 // 5 minutos mínimo entre peticiones para reducir latencia
  private static cachedRates: AllExchangeRates | null = null

  /**
   * Obtener todas las tasas de cambio
   */
  static async getAllRates(): Promise<AllExchangeRates> {
    try {
      const now = Date.now()

      // Si tenemos caché reciente y no ha pasado el tiempo mínimo, usar caché
      if (this.cachedRates && (now - this.lastFetchTime) < this.MIN_FETCH_INTERVAL) {
        console.log('📦 Using cached rates (age:', now - this.lastFetchTime, 'ms)')
        return this.cachedRates
      }

      console.log('🔄 Fetching fresh exchange rates from ElToque API...')

      // Autenticación con access_token header
      const url = `${this.BASE_URL}/tasas`
      console.log('📡 Fetching from:', url)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 segundos timeout

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'access_token': this.ACCESS_TOKEN
        },
        cache: 'no-store',
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      console.log('📡 Response status:', response.status, response.statusText)

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('📊 API Response:', JSON.stringify(data).substring(0, 500))

      // El nuevo formato devuelve { datos: [{ moneda: 'USD', tasa: 440 }, ...] }
      let apiResponse = data

      if (apiResponse) {
        // Procesar la respuesta
        const processedRates = this.processAPIResponse(apiResponse)

        // Actualizar caché
        this.cachedRates = processedRates
        this.lastFetchTime = now

        console.log('✅ Exchange rates updated successfully')
        return processedRates
      }

      throw new Error('Empty response from API')

    } catch (error) {
      console.error('❌ Error fetching all exchange rates:', error)
      console.log('🔄 Using local agency rates as fallback')
      return this.getLocalFallbackRates()
    }
  }

  /**
   * Intentar parsear respuesta de texto plano o CSV
   */
  private static parseTextResponse(responseText: string): boolean {
    try {
      // Intentar parsear como CSV simple
      const lines = responseText.trim().split('\n')
      if (lines.length > 1) {
        console.log('📊 Attempting to parse as text/CSV format')
        // Aquí podríamos implementar parsing de CSV si es necesario
        return true
      }
      return false
    } catch (error) {
      console.warn('Failed to parse text response:', error)
      return false
    }
  }

  /**
   * Procesar la respuesta del API según diferentes formatos posibles
   */
  private static processAPIResponse(apiResponse: any): AllExchangeRates {
    console.log('🔍 Analyzing API response structure:', {
      type: typeof apiResponse,
      isArray: Array.isArray(apiResponse),
      keys: Object.keys(apiResponse || {}),
      constructor: apiResponse?.constructor?.name
    })

    // Verificar diferentes formatos de respuesta posibles
    if (apiResponse && typeof apiResponse === 'object') {
      // Formato ElToque nuevo: { monedas: [...], fecha_actualizacion: "..." }
      if (Array.isArray(apiResponse.monedas) && apiResponse.monedas.length > 0) {
        console.log('📋 Processing ElToque format: monedas array')
        return this.processRatesArray(apiResponse.monedas, apiResponse.fecha_actualizacion)
      }

      // Formato 1: { exito: true, datos: [...] }
      if (apiResponse.exito && Array.isArray(apiResponse.datos)) {
        console.log('📋 Processing Spanish format: exito/datos')
        return this.processRatesArray(apiResponse.datos)
      }

      // Formato 2: { success: true, data: [...] }
      if (apiResponse.success && Array.isArray(apiResponse.data)) {
        console.log('📋 Processing English format: success/data')
        return this.processRatesArray(apiResponse.data)
      }

      // Formato 3: { rates: {...} }
      if (apiResponse.rates && typeof apiResponse.rates === 'object') {
        console.log('📋 Processing nested rates format')
        return this.processRatesObject(apiResponse.rates)
      }

      // Formato 4: { result: {...} }
      if (apiResponse.result && typeof apiResponse.result === 'object') {
        console.log('📋 Processing result format')
        return this.processRatesObject(apiResponse.result)
      }

      // Formato 5: { data: {...} }
      if (apiResponse.data && typeof apiResponse.data === 'object') {
        console.log('📋 Processing data format')
        return this.processRatesObject(apiResponse.data)
      }

      // Formato 6: { payload: {...} }
      if (apiResponse.payload && typeof apiResponse.payload === 'object') {
        console.log('📋 Processing payload format')
        return this.processRatesObject(apiResponse.payload)
      }

      // Formato 7: Objeto directo de tasas
      if (this.isValidRatesObject(apiResponse)) {
        console.log('📋 Processing direct rates object')
        return this.processRatesObject(apiResponse)
      }

      // Formato 8: Array directo de tasas
      if (Array.isArray(apiResponse)) {
        console.log('📋 Processing direct array format')
        return this.processRatesArray(apiResponse)
      }

      // Formato 9: Buscar arrays anidados
      for (const [key, value] of Object.entries(apiResponse)) {
        if (Array.isArray(value) && value.length > 0) {
          console.log(`📋 Processing nested array in key: ${key}`)
          const result = this.processRatesArray(value)
          if (result && Object.keys(result).length > 0) {
            return result
          }
        }
      }

      // Formato 10: Buscar objetos anidados que puedan ser tasas
      for (const [key, value] of Object.entries(apiResponse)) {
        if (value && typeof value === 'object' && this.isValidRatesObject(value)) {
          console.log(`📋 Processing nested object in key: ${key}`)
          const result = this.processRatesObject(value)
          if (result && Object.keys(result).length > 0) {
            return result
          }
        }
      }
    }

    // Si no encontramos formato válido, lanzar error (nunca tasas simuladas)
    console.error('❌ No valid format found in API response')
    throw new Error('No se pudo procesar la respuesta del API. Formato no reconocido.')
  }

  /**
   * Procesar array de tasas de cambio
   * @param datos Array de tasas
   * @param globalTimestamp Timestamp global opcional (para formato ElToque)
   */
  private static processRatesArray(datos: any[], globalTimestamp?: string): AllExchangeRates {
    const ratesObject: AllExchangeRates = {} as AllExchangeRates

    datos.forEach((rateData: any, index) => {
      // Campos posibles para la moneda
      const currency = rateData.moneda || rateData.currency || rateData.code || rateData.sigla ||
                      rateData.coin || rateData.short_name || rateData.symbol || rateData.name

      // Campos posibles para la tasa (prioridad) - incluyendo precio_cup del nuevo ElToque
      const rate = rateData.precio_cup || rateData.tasa || rateData.rate || rateData.value || rateData.price ||
                  rateData.buy || rateData.sell || rateData.compra || rateData.venta ||
                  rateData.amount || rateData.cantidad || rateData.quantity

      if (currency && typeof rate === 'number' && rate > 0) {
        console.log(`💱 Processing ${currency}: ${rate} (index: ${index})`)

        // Manejar variación - puede venir como string "+5" o número
        let variacion = 0
        if (rateData.cambio) {
          // Formato ElToque: "+5" o "-3"
          variacion = parseFloat(rateData.cambio) || 0
        } else if (rateData.variacion !== undefined) {
          variacion = typeof rateData.variacion === 'number' ? rateData.variacion : parseFloat(rateData.variacion) || 0
        } else if (rateData.change !== undefined) {
          variacion = typeof rateData.change === 'number' ? rateData.change : parseFloat(rateData.change) || 0
        }

        ratesObject[currency as keyof AllExchangeRates] = {
          moneda: currency,
          tasa: rate,
          fechaActualizacion: globalTimestamp || rateData.fechaActualizacion || rateData.updatedAt || rateData.timestamp ||
                          rateData.date || rateData.last_update || rateData.lastUpdate ||
                          rateData.fecha || new Date().toISOString(),
          variacion: variacion
        }
      } else {
        console.warn(`⚠️ Skipping invalid rate data:`, { currency, rate, rateData })
      }
    })

    return ratesObject
  }

  /**
   * Procesar objeto de tasas de cambio
   */
  private static processRatesObject(ratesObj: any): AllExchangeRates {
    const ratesObject: AllExchangeRates = {} as AllExchangeRates

    Object.entries(ratesObj).forEach(([currency, rateData]: [string, any]) => {
      if (typeof rateData === 'number') {
        // Formato simple: USD: 350
        if (rateData > 0) {
          ratesObject[currency as keyof AllExchangeRates] = {
            moneda: currency,
            tasa: rateData,
            fechaActualizacion: new Date().toISOString(),
            variacion: 0
          }
        }
      } else if (rateData && typeof rateData === 'object') {
        // Buscar el campo de tasa con diferentes nombres posibles
        const rate = rateData.tasa || rateData.rate || rateData.value || rateData.price ||
                    rateData.buy || rateData.sell || rateData.compra || rateData.venta ||
                    rateData.amount || rateData.cantidad || rateData.quantity

        if (typeof rate === 'number' && rate > 0) {
          ratesObject[currency as keyof AllExchangeRates] = {
            moneda: currency,
            tasa: rate,
            fechaActualizacion: rateData.fechaActualizacion || rateData.updatedAt || rateData.timestamp ||
                            rateData.date || rateData.last_update || rateData.lastUpdate ||
                            rateData.fecha || new Date().toISOString(),
            variacion: rateData.variacion || rateData.change || rateData.variation ||
                      rateData.diferencia || rateData.difference || 0
          }
        } else {
          console.warn(`⚠️ Skipping invalid rate object for ${currency}:`, rateData)
        }
      } else {
        console.warn(`⚠️ Skipping invalid rate data type for ${currency}:`, typeof rateData)
      }
    })

    return ratesObject
  }

  /**
   * Verificar si es un objeto de tasas válido
   */
  private static isValidRatesObject(obj: any): boolean {
    if (!obj || typeof obj !== 'object') return false

    // Accept any currency that's in our metadata or looks like a valid currency code
    const knownCurrencies = Object.keys(CURRENCY_METADATA)
    const keys = Object.keys(obj)

    // Verificar si alguna clave es una moneda válida (insensible a mayúsculas)
    return keys.some(key => {
      const upperKey = key.toUpperCase().trim()
      // Check if it's a known currency or looks like a 3-letter currency code
      return knownCurrencies.includes(upperKey) ||
             (upperKey.length >= 2 && upperKey.length <= 5 && /^[A-Z]+$/.test(upperKey))
    })
  }

  /**
   * Obtener tasas de fallback cuando el API no está disponible
   * Solo usa el caché si está disponible, nunca tasas simuladas
   */
  private static getLocalFallbackRates(): AllExchangeRates {
    console.log('🏠 Using fallback rates from cache')

    // Solo usar caché real, nunca tasas simuladas
    if (this.cachedRates && Object.keys(this.cachedRates).length > 0) {
      console.log('✅ Using cached rates as fallback')
      return this.cachedRates
    }

    // Si no hay caché, lanzar error para que el endpoint maneje el fallback a BD
    console.error('❌ No cached rates available, API must be used or database fallback')
    throw new Error('No hay tasas en caché. El servidor debe usar la base de datos como fallback.')
  }

  /**
   * Obtener tasa de cambio específica por moneda
   */
  static async getRate(currency: keyof AllExchangeRates): Promise<ExchangeRate> {
    try {
      console.log(`🔄 Fetching ${currency} rate from ElToque API...`)

      // En lugar de hacer una petición individual, usemos getAllRates y extraigamos la moneda
      const allRates = await this.getAllRates()
      const rate = allRates[currency]

      if (!rate) {
        throw new Error(`Rate for ${currency} not found in response`)
      }

      console.log(`📊 ${currency} rate:`, rate)
      return rate

    } catch (error) {
      console.error(`❌ Error fetching ${currency} exchange rate:`, error)
      throw error
    }
  }

  /**
   * Verificar el estado de la conexión con el API
   */
  static async getConnectionStatus(): Promise<{
    isConnected: boolean
    lastCheck: string
    message: string
    usingFallback: boolean
  }> {
    try {
      const now = new Date().toISOString()
      const rates = await this.getAllRates()

      // Verificar si estamos usando tasas simuladas
      const isUsingSimulated = JSON.stringify(rates).includes('simulated') ||
                                rates.USD?.tasa < 200 // Las tasas reales de USD no deberían ser tan bajas

      return {
        isConnected: true,
        lastCheck: now,
        message: isUsingSimulated ?
          'Conectado usando tasas de respaldo (API temporalmente no disponible)' :
          'Conectado al API de ElToque',
        usingFallback: isUsingSimulated
      }
    } catch (error) {
      return {
        isConnected: false,
        lastCheck: new Date().toISOString(),
        message: 'No se pudo conectar al API de ElToque',
        usingFallback: true
      }
    }
  }

  /**
   * Obtener tasas formateadas para la UI
   * Returns all currencies dynamically from the API
   */
  static async getFormattedRates(): Promise<Record<string, { rate: number; formatted: string; lastUpdate: string; variacion: number }>> {
    try {
      const rates = await this.getAllRates()

      const formatRate = (rate: ExchangeRate | undefined) => ({
        rate: rate?.tasa || 0,
        formatted: rate ? rate.tasa.toFixed(2) : '0.00',
        lastUpdate: rate ? new Date(rate.fechaActualizacion).toLocaleString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : new Date().toLocaleString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        variacion: rate?.variacion || 0
      })

      // Dynamically format all currencies from the API response
      const formattedRates: Record<string, { rate: number; formatted: string; lastUpdate: string; variacion: number }> = {}

      Object.entries(rates).forEach(([currency, rate]) => {
        formattedRates[currency] = formatRate(rate)
      })

      return formattedRates
    } catch (error) {
      console.error('Error formatting exchange rates:', error)
      throw error
    }
  }

  /**
   * Convertir moneda usando tasas reales
   * Accepts any currency code dynamically
   */
  static async convertCurrency(
    from: string,
    to: string,
    amount: number
  ): Promise<{ amount: number; rate: number; result: number }> {
    try {
      console.log(`💱 Converting ${amount} ${from} to ${to}`)
      const rates = await this.getAllRates()

      // Normalize currency codes
      const fromCurrency = from.toUpperCase()
      const toCurrency = to.toUpperCase()

      // Get available currencies from rates + CUP
      const availableCurrencies = [...Object.keys(rates), 'CUP']

      // Validate currencies
      if (!availableCurrencies.includes(fromCurrency) || !availableCurrencies.includes(toCurrency)) {
        throw new Error(`Invalid currency. From: ${fromCurrency}, To: ${toCurrency}. Available: ${availableCurrencies.join(', ')}`)
      }

      // Obtener tasa de la moneda de origen
      let fromRate: number
      if (fromCurrency === 'CUP') {
        fromRate = 1
      } else {
        const rateData = rates[fromCurrency]
        fromRate = rateData?.tasa || 0
        if (fromRate === 0) {
          throw new Error(`No rate found for currency: ${fromCurrency}`)
        }
      }

      let result: number
      let usedRate: number

      if (fromCurrency === 'CUP') {
        // Convertir de CUP a moneda extranjera
        if (toCurrency === 'CUP') {
          return { amount, rate: 1, result: amount }
        }
        const toRateData = rates[toCurrency]
        const toRate = toRateData?.tasa || 0
        if (toRate === 0) {
          throw new Error(`No rate found for currency: ${toCurrency}`)
        }
        result = amount / toRate
        usedRate = 1 / toRate
      } else if (toCurrency === 'CUP') {
        // Convertir de moneda extranjera a CUP
        result = amount * fromRate
        usedRate = fromRate
      } else {
        // Convertir entre monedas extranjeras
        const amountInCup = amount * fromRate
        const toRateData = rates[toCurrency]
        const toRate = toRateData?.tasa || 0
        if (toRate === 0) {
          throw new Error(`No rate found for currency: ${toCurrency}`)
        }
        result = amountInCup / toRate
        usedRate = fromRate / toRate
      }

      const finalResult = Math.round(result * 100) / 100 // Redondear a 2 decimales
      console.log(`💱 Conversion result: ${amount} ${fromCurrency} = ${finalResult} ${toCurrency} (rate: ${usedRate})`)

      return {
        amount,
        rate: usedRate,
        result: finalResult
      }
    } catch (error) {
      console.error('❌ Error converting currency:', error)
      // En caso de error, devolver conversión 1:1 con aviso
      return {
        amount,
        rate: 1,
        result: amount
      }
    }
  }
}

export default ElToqueAPI