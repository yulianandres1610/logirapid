'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign,
  TrendingUp,
  RefreshCw,
  Euro,
  CreditCard,
  ArrowUpDown,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  Server,
  Wifi,
  WifiOff,
  Building2,
  Settings,
  Save,
  Edit,
  Eye,
  EyeOff,
  Calculator,
  Info,
  Plus,
  BarChart3
} from 'lucide-react'
import RatesReportTab from '@/components/exchange-rates/RatesReportTab'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

import { getCurrencyMeta, CURRENCY_METADATA } from '@/lib/eltoque-api'

interface ExchangeRate {
  rate: number
  formatted: string
  lastUpdate: string
  variacion: number
}

// Dynamic type - accepts any currency from the API
type ExchangeRatesData = Record<string, ExchangeRate>

interface ConversionResult {
  amount: number
  rate: number
  result: number
}

interface GlobalRateConfig {
  id: string
  adjustmentPercentage: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  createdBy: string
}

interface HealthTest {
  endpoint: string
  url: string
  status: 'success' | 'parse_error' | 'empty_response' | 'http_error' | 'connection_error' | 'unknown'
  responseTime: number
  statusCode: number | null
  error: string | null
  dataSample: any
}

interface HealthStatus {
  status: 'healthy' | 'partial' | 'unhealthy' | 'error' | 'unknown'
  timestamp: string
  duration: number
  tests: HealthTest[]
  endpoints: Record<string, HealthTest>
  rates: {
    success: boolean
    count?: number
    currencies?: string[]
    sample?: any
    error?: string
  } | null
  error?: string | null
}

interface SimpleHealthStatus {
  status: 'healthy' | 'partial' | 'unhealthy' | 'error' | 'unknown'
  timestamp: string
  duration: number
  rates: {
    success: boolean
    count?: number
    currencies?: string[]
    error?: string
  } | null
  error?: string | null
}

// Componente para contador animado
function AnimatedCounter({ value, duration = 2000 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const startTime = Date.now()
    const endTime = startTime + duration

    const animate = () => {
      const now = Date.now()
      const remaining = Math.max(0, endTime - now)
      const progress = 1 - remaining / duration

      // Easing function para smooth animation
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const currentValue = value * easeOut

      setDisplayValue(currentValue)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setDisplayValue(value)
      }
    }

    requestAnimationFrame(animate)
  }, [value, duration])

  return <>{displayValue.toFixed(2)}</>
}

// Componente para tarjeta de tasa con contador animado
function RateCard({
  currency,
  data,
  index,
  theme,
  adjustmentPercentage = 0
}: {
  currency: string
  data: ExchangeRate
  index: number
  theme: 'light' | 'dark'
  adjustmentPercentage: number
}) {
  // Get currency metadata dynamically
  const currencyMeta = getCurrencyMeta(currency)
  // Hook para contador animado - ahora dentro de su propio componente
  const [count, setCount] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    // Aplicar fórmula: baseRate * (1 + adjustmentPercentage / 100)
    const endValue = data.rate * (1 + adjustmentPercentage / 100)
    if (endValue === 0) return

    setIsAnimating(true)
    const startTime = Date.now()
    const startValue = 0

    const animate = () => {
      const now = Date.now()
      const progress = Math.min((now - startTime) / 1500, 1)

      // Función de easing para animación suave
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)

      const currentCount = startValue + (endValue - startValue) * easeOutQuart
      setCount(currentCount)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setIsAnimating(false)
      }
    }

    requestAnimationFrame(animate)
  }, [data.rate, adjustmentPercentage])

  return (
    <motion.div
      key={currency}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "rounded-xl p-4 border relative overflow-hidden transition-all duration-300 hover:shadow-lg",
        theme === 'dark'
          ? "bg-gray-800 border-gray-700"
          : "bg-white border-gray-200"
      )}
      style={{
        borderColor: theme === 'dark' ? '#374151' : '#e5e7eb',
        background: theme === 'dark'
          ? 'linear-gradient(135deg, rgba(31,41,55,0.9), rgba(17,24,39,0.95))'
          : 'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(249,250,251,1))'
      }}
    >
      {/* Background sutil animado */}
      <motion.div
        className="absolute inset-0 opacity-3"
        animate={{
          background: [
            'linear-gradient(135deg, #f9fafb00, #f3f4f620)',
            'linear-gradient(135deg, #f3f4f610, #e5e7eb30)',
            'linear-gradient(135deg, #f9fafb00, #f3f4f620)'
          ]
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <motion.div
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center text-xl",
                theme === 'dark'
                  ? "bg-gray-700 text-gray-300"
                  : "bg-gray-100 text-gray-600"
              )}
              whileHover={{
                scale: 1.1,
                rotate: [0, -5, 5, 0],
                backgroundColor: theme === 'dark' ? '#374151' : '#f3f4f6'
              }}
              transition={{ duration: 0.3 }}
            >
              {currencyMeta.flag}
            </motion.div>
            <div>
              <h3 className={cn(
                "font-semibold text-sm",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                {currency} / CUP
              </h3>
              <p className={cn(
                "text-xs",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                {currencyMeta.name}
              </p>
            </div>
          </div>

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: index * 0.05 + 0.2 }}
          >
            <CheckCircle
              className={cn(
                "w-4 h-4",
                theme === 'dark' ? "text-green-400" : "text-green-500"
              )}
            />
          </motion.div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-xs",
              theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>
              Tasa actual
            </span>
            <div className="text-right">
              <motion.span
                className={cn(
                  "text-lg font-bold",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}
                animate={{
                  scale: isAnimating ? [1, 1.05, 1] : 1,
                  color: isAnimating
                    ? [theme === 'dark' ? '#ffffff' : '#111827',
                       theme === 'dark' ? '#10b981' : '#059669',
                       theme === 'dark' ? '#ffffff' : '#111827']
                    : theme === 'dark' ? '#ffffff' : '#111827'
                }}
                transition={{
                  duration: 0.3,
                  repeat: isAnimating ? 1 : 0
                }}
              >
                ${count.toFixed(2)}
              </motion.span>

              {/* Etiqueta del tipo de cálculo */}
              {adjustmentPercentage !== 0 && (
                <motion.div
                  className={cn(
                    "text-xs px-2 py-1 rounded-full font-medium",
                    adjustmentPercentage > 0
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                  )}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  {adjustmentPercentage > 0 ? '+' : ''}{adjustmentPercentage}%
                </motion.div>
              )}

              {adjustmentPercentage === 0 && (
                <motion.div
                  className={cn(
                    "text-xs px-2 py-1 rounded-full font-medium",
                    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                  )}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  🎯 Al toque
                </motion.div>
              )}

              {data.variacion !== 0 && (
                <motion.div
                  className={cn(
                    "text-xs font-medium flex items-center justify-end gap-1",
                    data.variacion > 0
                      ? theme === 'dark' ? "text-green-400" : "text-green-600"
                      : theme === 'dark' ? "text-red-400" : "text-red-600"
                  )}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 + 0.4 }}
                >
                  {data.variacion > 0 ? '↑' : '↓'}
                  {Math.abs(data.variacion).toFixed(2)}%
                </motion.div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className={cn(
              theme === 'dark' ? "text-gray-500" : "text-gray-500"
            )}>
              1 {currency} = {data.formatted} CUP
            </span>
            <div className="flex items-center gap-1">
              <motion.div
                animate={{
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Clock
                  className={cn(
                    "w-3 h-3",
                    theme === 'dark' ? "text-gray-400" : "text-gray-500"
                  )}
                />
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Efecto de brillo sutil en hover */}
      <motion.div
        className={cn(
          "absolute inset-0 rounded-xl opacity-0 pointer-events-none",
          theme === 'dark'
            ? "bg-gradient-to-r from-transparent via-gray-600/10 to-transparent"
            : "bg-gradient-to-r from-transparent via-gray-300/20 to-transparent"
        )}
        whileHover={{
          opacity: 1,
          transition: { duration: 0.3 }
        }}
      />
    </motion.div>
  )
}

export default function ExchangeRatePage() {
  const { theme } = useTheme()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Estados principales
  const [activeTab, setActiveTab] = useState<'rates' | 'agency' | 'report'>('rates')
  const [rates, setRates] = useState<ExchangeRatesData | null>(null)
  const [agencyRates, setAgencyRates] = useState<ExchangeRatesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [usingCache, setUsingCache] = useState(false)

  // Ref para evitar múltiples refresh seguidos
  const isRefreshingRef = useRef(false)

  // Estados para configuración global de agencias
  const [globalConfig, setGlobalConfig] = useState<GlobalRateConfig | null>(null)
  const [isEditingConfig, setIsEditingConfig] = useState(false)
  const [adjustmentPercentage, setAdjustmentPercentage] = useState(5.0)
  const [savingConfig, setSavingConfig] = useState(false)

  // Estados para salud del API
  const [healthStatus, setHealthStatus] = useState<SimpleHealthStatus | null>(null)
  const [loadingHealth, setLoadingHealth] = useState(false)
  const [autoRefreshHealth, setAutoRefreshHealth] = useState(true)

  // Estados para conversor
  const [showConverter, setShowConverter] = useState(false)
  const [fromCurrency, setFromCurrency] = useState('USD')
  const [toCurrency, setToCurrency] = useState('CUP')
  const [amount, setAmount] = useState('')
  const [conversion, setConversion] = useState<ConversionResult | null>(null)
  const [converting, setConverting] = useState(false)

  // Ref para evitar múltiples llamadas iniciales
  const initialFetchDone = useRef(false)

  // Ref para manejar AbortController
  const abortControllerRef = useRef<AbortController | null>(null)

  // Ref para debounce del ajuste de porcentaje
  const percentageTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Cargar tasas de cambio
  const fetchRates = async (forceRefresh = false) => {
    // Evitar múltiples refresh seguidos
    if (forceRefresh && isRefreshingRef.current) {
      console.log('🚫 Refresh already in progress, ignoring...')
      return
    }

    // Evitar múltiples solicitudes simultáneas
    if (abortControllerRef.current) {
      console.log('🚫 Cancelling previous request...')
      abortControllerRef.current.abort()
    }

    try {
      console.log('🔄 Fetching exchange rates, forceRefresh:', forceRefresh)

      if (forceRefresh) {
        isRefreshingRef.current = true
      }

      // Solo mostrar loading si es un refresh forzado o si no hay tasas
      if (forceRefresh || !rates) {
        setLoading(true)
      }

      setError(null)
      setWarning(null)
      setUsingCache(false) // Estamos intentando obtener datos frescos

      const url = forceRefresh ? '/api/exchange-rates?forceRefresh=true' : '/api/exchange-rates'

      console.log('📡 Making request to:', url)

      // Crear un controller para el timeout y cancelación
      const controller = new AbortController()
      abortControllerRef.current = controller

      // Timeout más corto pero más razonable
      const timeoutId = setTimeout(() => {
        console.log('⏰ Request timeout reached - using emergency rates')
        controller.abort()
      }, 15000) // 15 segundos para dar más tiempo al API

      let response: Response

      try {
        response = await fetch(url, {
          cache: 'no-store',
          signal: controller.signal
        })
      } catch (fetchError) {
        // Si el error es por aborto del timeout, manejar error
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.log('🚫 Request timed out')
          setError('El servidor está tardando en responder. Por favor, intenta de nuevo.')
          setRates(null)
          clearTimeout(timeoutId)
          abortControllerRef.current = null
          return
        }
        throw fetchError // Re-lanzar otros errores
      }

      // Limpiar el timeout y el controller si la respuesta es exitosa
      clearTimeout(timeoutId)
      abortControllerRef.current = null

      console.log('📡 Response status:', response.status, response.statusText)
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()))

      // Verificar si la respuesta es OK
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`)
      }

      // Obtener el texto de la respuesta primero para debugging
      const responseText = await response.text()
      console.log('📡 Raw response text:', responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''))

      // Verificar si la respuesta está vacía
      if (!responseText || responseText.trim() === '') {
        throw new Error('Empty response from server')
      }

      // Intentar parsear el JSON
      let data
      try {
        // Verificar si el request fue abortado antes de parsear
        if (controller.signal.aborted) {
          console.log('🚫 Request was aborted before JSON parsing')
          setError('Conexión cancelada. Por favor, intenta de nuevo.')
          setRates(null)
          return
        }

        data = JSON.parse(responseText)
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError)

        // Si el error es por aborto, mostrar error
        if (controller.signal.aborted || (parseError instanceof Error && parseError.name === 'AbortError')) {
          console.log('🚫 JSON parsing aborted')
          setError('Conexión interrumpida. Por favor, intenta de nuevo.')
          setRates(null)
          return
        }

        throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}...`)
      }

      console.log('📊 Frontend received data:', data)

      if (data.success) {
        setRates(data.data)
        if (data.warning) {
          setWarning(data.warning)
        }
        setLastRefresh(new Date())
        setUsingCache(false) // Ya no estamos usando caché

        // Guardar en caché las tasas frescas
        saveRatesToCache(data.data)

        console.log('✅ Exchange rates updated successfully')
      } else {
        setError(data.error || 'Error al cargar las tasas de cambio')
      }
    } catch (err) {
      console.error('❌ Error fetching exchange rates:', err)

      // Limpiar el controller y timeout si no se han limpiado ya
      if (abortControllerRef.current) {
        abortControllerRef.current = null
      }

      // Manejo mejorado de errores de aborto
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('🚫 Request was cancelled or timed out')
        setError('Conexión interrumpida o tiempo de espera agotado. Por favor, intenta de nuevo.')
        setRates(null)
        return
      }

      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      console.error('❌ Error details:', {
        message: errorMessage,
        timestamp: new Date().toISOString()
      })

      // Mensaje de error más específico para el usuario
      if (errorMessage.includes('Empty response')) {
        setError('El servidor no respondió. Por favor, intenta de nuevo.')
      } else if (errorMessage.includes('JSON')) {
        setError('Error en el formato de respuesta del servidor. Por favor, intenta de nuevo.')
      } else if (errorMessage.includes('HTTP error')) {
        setError('Error del servidor. Por favor, intenta de nuevo más tarde.')
      } else if (errorMessage.includes('timeout') || errorMessage.includes('12 segundos')) {
        setError('El servidor está tardando en responder. Por favor, intenta de nuevo.')
      } else {
        setError('No se pudieron cargar las tasas de cambio. Por favor, intenta de nuevo.')
      }

      setRates(null)
    } finally {
      setLoading(false)
      isRefreshingRef.current = false // Resetear el estado de refresh
    }
  }

  // Nota: Las tasas de emergencia hardcodeadas fueron eliminadas
  // Ahora el sistema solo usa tasas reales desde ElToque API o base de datos

  // Manejador de ajuste de porcentaje con debounce
  const handlePercentageChange = (value: number) => {
    // Limpiar timeout anterior
    if (percentageTimeoutRef.current) {
      clearTimeout(percentageTimeoutRef.current)
    }

    // Establecer nuevo valor inmediatamente para feedback visual
    setAdjustmentPercentage(value)

    // Debounce para calcular tasas actualizadas
    percentageTimeoutRef.current = setTimeout(() => {
      calculateAgencyRates()
    }, 300) // 300ms de debounce
  }

  // Funciones para configuración global de agencias
  const fetchGlobalConfig = async () => {
    try {
      console.log('🔄 Fetching global config from database...')

      // Obtener configuración desde el API
      const response = await fetch('/api/agency-rates')

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('📊 Config fetched from API:', data)

      if (data.success && data.data?.config) {
        const config = data.data.config
        setGlobalConfig(config)
        setAdjustmentPercentage(config.adjustmentPercentage)
        console.log('✅ Global config loaded from database:', config)
      } else {
        console.warn('⚠️ No config found in database, using default')
        // Configuración por defecto
        const defaultConfig: GlobalRateConfig = {
          id: 'global_config_1',
          adjustmentPercentage: 5.0,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system'
        }
        setGlobalConfig(defaultConfig)
        setAdjustmentPercentage(5.0)
      }
    } catch (error) {
      console.error('❌ Error fetching global config:', error)
      // Fallback a configuración por defecto en caso de error
      const defaultConfig: GlobalRateConfig = {
        id: 'global_config_1',
        adjustmentPercentage: 5.0,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system'
      }
      setGlobalConfig(defaultConfig)
      setAdjustmentPercentage(5.0)
    }
  }

  const saveGlobalConfig = async () => {
    try {
      setSavingConfig(true)
      console.log('💾 Saving global config to database...', {
        adjustmentPercentage,
        isActive: globalConfig?.isActive ?? true
      })

      // Guardar en la base de datos vía API
      const response = await fetch('/api/agency-rates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adjustmentPercentage,
          isActive: globalConfig?.isActive ?? true
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('📊 Config saved to API:', data)

      if (data.success && data.data?.config) {
        const updatedConfig = data.data.config
        setGlobalConfig(updatedConfig)
        console.log('✅ Global config saved to database:', updatedConfig)

        // Recalcular tasas de agencias
        if (rates) {
          calculateAgencyRates()
        }

        setIsEditingConfig(false)
      } else {
        throw new Error(data.error || 'Error al guardar configuración')
      }
    } catch (error) {
      console.error('❌ Error saving global config:', error)
      setError(error instanceof Error ? error.message : 'Error al guardar configuración')
    } finally {
      setSavingConfig(false)
    }
  }

  const calculateAgencyRates = () => {
    if (!rates) return

    const calculatedRates: ExchangeRatesData = {} as ExchangeRatesData

    Object.entries(rates).forEach(([currency, rateData]) => {
      const baseRate = rateData.rate
      const calculatedRate = baseRate * (1 + adjustmentPercentage / 100)

      calculatedRates[currency as keyof ExchangeRatesData] = {
        ...rateData,
        rate: Math.round(calculatedRate * 100) / 100,
        formatted: calculatedRate.toFixed(2)
      }
    })

    setAgencyRates(calculatedRates)
    console.log('✅ Agency rates calculated with', adjustmentPercentage, '%')
  }

  // Funciones para salud del API
  const fetchHealthStatus = async () => {
    try {
      setLoadingHealth(true)
      const response = await fetch('/api/health/exchange-rate/')
      const data = await response.json()
      setHealthStatus(data)
    } catch (error) {
      console.error('Error fetching health status:', error)
      setHealthStatus({
        status: 'error',
        timestamp: new Date().toISOString(),
        duration: 0,
        rates: null,
        error: error instanceof Error ? error.message : 'Error desconocido'
      })
    } finally {
      setLoadingHealth(false)
    }
  }

  // Leer tab inicial desde URL
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'agency' || tab === 'rates') {
      setActiveTab(tab)
    }
  }, [searchParams])

  // Efectos secundarios
  useEffect(() => {
    fetchGlobalConfig()
  }, [])

  useEffect(() => {
    if (rates) {
      calculateAgencyRates()
    }
  }, [rates, adjustmentPercentage])

  useEffect(() => {
    if (autoRefreshHealth) {
      const interval = setInterval(fetchHealthStatus, 30000) // 30 segundos
      return () => clearInterval(interval)
    }
  }, [autoRefreshHealth])

  // Funciones de caché para robustez
  const saveRatesToCache = (rates: ExchangeRatesData, isEmergency = false) => {
    try {
      const cacheData = {
        rates,
        timestamp: new Date().toISOString(),
        version: '1.0',
        isEmergency
      }
      localStorage.setItem('exchange_rates_cache', JSON.stringify(cacheData))
      console.log(`💾 ${isEmergency ? 'Emergency' : 'Fresh'} rates saved to cache`)
    } catch (error) {
      console.warn('⚠️ Failed to save rates to cache:', error)
    }
  }

  const loadRatesFromCache = () => {
    try {
      const cached = localStorage.getItem('exchange_rates_cache')
      if (!cached) return null

      const cacheData = JSON.parse(cached)

      // Verificar si el caché es válido
      const cacheTime = new Date(cacheData.timestamp)
      const now = new Date()
      const ageInMinutes = (now.getTime() - cacheTime.getTime()) / (1000 * 60)

      // Tiempos de expiración diferentes según el tipo
      const maxAge = cacheData.isEmergency ? 5 : 30 // 5 min para emergencia, 30 min para datos reales

      if (ageInMinutes > maxAge) {
        console.log(`🕐 Cache expired (${Math.round(ageInMinutes)} min > ${maxAge} min), removing old data`)
        localStorage.removeItem('exchange_rates_cache')
        return null
      }

      console.log(`✅ Using ${cacheData.isEmergency ? 'emergency' : 'cached'} rates from ${Math.round(ageInMinutes)} minutes ago`)
      return { ...cacheData, isEmergency: cacheData.isEmergency || false }
    } catch (error) {
      console.warn('⚠️ Failed to load from cache:', error)
      localStorage.removeItem('exchange_rates_cache')
      return null
    }
  }

  // Convertir moneda
  const handleConvert = async () => {
    if (!amount || parseFloat(amount) <= 0) return

    try {
      setConverting(true)
      setError(null)

      const response = await fetch(
        `/api/exchange-rates?convert=true&from=${fromCurrency}&to=${toCurrency}&amount=${amount}`
      )
      const data = await response.json()

      if (data.success) {
        setConversion(data.data)
      } else {
        setError(data.error || 'Error en la conversión')
      }
    } catch (err) {
      console.error('Error converting currency:', err)
      setError('Error al realizar la conversión')
    } finally {
      setConverting(false)
    }
  }

  // Cargar tasas desde caché al inicio
  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true

      // Intentar cargar desde caché primero
      const cachedRates = loadRatesFromCache()
      if (cachedRates) {
        console.log('📦 Loading rates from cache on mount')
        setRates(cachedRates.rates)
        setLastRefresh(new Date(cachedRates.timestamp))
        setError(null)
        setUsingCache(true)

        // Calcular tasas de agencias inmediatamente
        calculateAgencyRates()
      }

      // Luego intentar obtener tasas frescas forzando sincronización inicial
      fetchRates(true) // Forzar refresh al cargar para obtener tasas actualizadas
    }
  }, [])

  // Auto-refresh cada 5 minutos para respetar los límites del API
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('⏰ Auto-refreshing exchange rates...')
      fetchRates(false) // No forzar refresh para usar caché si está disponible
    }, 5 * 60 * 1000) // 5 minutos

    return () => {
      clearInterval(interval)
      // Cancelar cualquier solicitud pendiente cuando el componente se desmonte
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [])

  // Cleanup effect para cancelar solicitudes cuando el componente se desmonte
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort()
        } catch (error) {
          // Ignore abort errors during cleanup
          console.log('Cleanup: AbortController aborted')
        }
        abortControllerRef.current = null
      }
      if (percentageTimeoutRef.current) {
        clearTimeout(percentageTimeoutRef.current)
        percentageTimeoutRef.current = null
      }
    }
  }, [])

  // Currency metadata is now imported from eltoque-api.ts (getCurrencyMeta, CURRENCY_METADATA)

  // Función para verificar salud del API en tiempo real
  const checkAPIHealth = async () => {
    setLoadingHealth(true)
    try {
      const response = await fetch('/api/health/exchange-rate/')
      const data = await response.json()

      if (response.ok) {
        setHealthStatus(data)
      } else {
        setHealthStatus({
          status: 'error',
          timestamp: new Date().toISOString(),
          duration: 0,
          rates: null,
          error: 'Error al verificar salud del API'
        })
      }
    } catch (error) {
      setHealthStatus({
        status: 'error',
        timestamp: new Date().toISOString(),
        duration: 0,
        rates: null,
        error: 'No se puede conectar al API'
      })
    } finally {
      setLoadingHealth(false)
    }
  }

  // Auto-refresco de salud del API
  useEffect(() => {
    if (autoRefreshHealth) {
      checkAPIHealth() // Verificar inmediatamente
      const interval = setInterval(checkAPIHealth, 30000) // Cada 30 segundos
      return () => clearInterval(interval)
    }
  }, [autoRefreshHealth])

  // Limpieza al desmontar el componente
  useEffect(() => {
    return () => {
      // Cancelar cualquier petición pendiente
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Limpiar timeouts de porcentaje
      if (percentageTimeoutRef.current) {
        clearTimeout(percentageTimeoutRef.current)
      }
    }
  }, [])


  if (loading && !rates) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "max-w-md w-full mx-auto p-8 rounded-2xl border text-center",
              theme === 'dark'
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-200"
            )}
          >
            {/* Optimized Progress Bar */}
            <div className="mb-6">
              <div className={cn(
                "w-full h-2 rounded-full overflow-hidden",
                theme === 'dark' ? "bg-gray-700" : "bg-gray-200"
              )}>
                <motion.div
                  className="h-full bg-exa-primary"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{
                    duration: 3,
                    ease: [0.4, 0, 0.2, 1], // Custom cubic-bezier for smoother animation
                    delay: 0.1
                  }}
                />
              </div>
            </div>

            {/* Optimized Animated Icon */}
            <div className="flex justify-center mb-6">
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                  rotate: [0, 3, -3, 0]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: [0.4, 0, 0.6, 1] // Smoother cubic-bezier
                }}
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center",
                  theme === 'dark' ? "bg-exa-primary" : "bg-exa-primary"
                )}
              >
                <Activity className="w-8 h-8 text-white" />
              </motion.div>
            </div>

            {/* Loading Text */}
            <div className="space-y-3">
              <h3 className={cn(
                "text-lg font-semibold",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                Obteniendo tasas de cambio
              </h3>
              <p className={cn(
                "text-sm font-mono",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                eltoque.cubarapid.com
              </p>
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className={cn(
                  "text-xs",
                  theme === 'dark' ? "text-gray-500" : "text-gray-500"
                )}
              >
                Conectando con el servidor...
              </motion.div>
            </div>
          </motion.div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div>
              <h1 className={cn(
                "text-3xl font-bold",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                Tasa de Cambio
              </h1>
              <p className={cn(
                "mt-2 text-sm",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                Gestión de tasas de cambio y configuración para agencias
              </p>
            </div>

            <div className="flex items-center gap-4">
              {activeTab === 'rates' && lastRefresh && (
                <div className={cn(
                  "flex items-center gap-2 text-sm",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  <Clock className="w-4 h-4" />
                  <span>
                    Última actualización: {lastRefresh.toLocaleTimeString('es-ES')}
                  </span>

                  {/* Indicador de caché o emergencia */}
                  {usingCache && (
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      warning ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                             : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                    )}>
                      {warning ? "🔄 Emergencia" : "📦 Caché"}
                    </span>
                  )}
                </div>
              )}

              {activeTab === 'rates' && (
                <button
                  onClick={() => fetchRates(true)}
                  disabled={loading}
                  className={cn(
                    "p-2 rounded-lg transition-all duration-300",
                    loading && "opacity-50",
                    theme === 'dark'
                      ? "bg-exa-secondary text-white hover:bg-exa-primary"
                      : "bg-exa-primary text-white hover:bg-exa-secondary"
                  )}
                  title="Forzar actualización"
                >
                  <motion.div
                    animate={loading ? { rotate: 360 } : {}}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </motion.div>
                </button>
              )}

              {activeTab === 'rates' && (
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg border text-xs",
                  theme === 'dark'
                    ? "border-gray-700 bg-gray-800/50 text-gray-300"
                    : "border-gray-200 bg-gray-50 text-gray-700"
                )}>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full animate-pulse",
                      healthStatus?.status === 'healthy'
                        ? "bg-green-500"
                        : healthStatus?.status === 'partial'
                          ? "bg-yellow-500"
                          : healthStatus?.status === 'unhealthy'
                            ? "bg-red-500"
                            : "bg-gray-400"
                    )} />
                    <span className="font-medium">
                      {healthStatus?.status === 'healthy'
                        ? 'API Saludable'
                        : healthStatus?.status === 'partial'
                          ? 'API Parcial'
                          : healthStatus?.status === 'unhealthy'
                            ? 'API Caída'
                            : 'Verificando...'
                      }
                    </span>
                  </div>

                  {healthStatus && (
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className={cn(
                        "font-mono",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>
                        {healthStatus.duration}ms
                      </span>

                      {healthStatus.rates?.success && (
                        <span className={cn(
                          "font-medium",
                          theme === 'dark' ? 'text-green-400' : 'text-green-600'
                        )}>
                          {healthStatus.rates.count} monedas
                        </span>
                      )}

                      {healthStatus.timestamp && (
                        <span className={cn(
                          "font-mono",
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        )}>
                          {new Date(healthStatus.timestamp).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      )}

                      <div className={cn(
                        "flex items-center gap-1",
                        theme === 'dark' ? 'text-green-400' : 'text-green-600'
                      )}>
                        <div className="w-1 h-1 rounded-full bg-current animate-pulse" />
                        <span className="font-medium">Live</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>

          {/* Pestañas */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex border-b rounded-t-xl",
              theme === 'dark' ? "border-gray-700" : "border-gray-200"
            )}
          >
            {[
              { id: 'rates', label: 'Tasas deltoque', icon: TrendingUp },
              { id: 'agency', label: 'Tasas Agencias', icon: Building2 },
              { id: 'report', label: 'Reporte', icon: BarChart3 }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any)
                  router.push(`?tab=${tab.id}`, { scroll: false })
                }}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 font-medium transition-all duration-300 relative",
                  activeTab === tab.id
                    ? theme === 'dark'
                      ? "text-exa-secondary border-b-2 border-exa-secondary bg-gray-800/50"
                      : "text-exa-primary border-b-2 border-exa-primary bg-white"
                    : theme === 'dark'
                      ? "text-gray-400 hover:text-white hover:bg-gray-800/30"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    className={cn(
                      "absolute bottom-0 left-0 right-0 h-0.5",
                      theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary"
                    )}
                    layoutId="activeTab"
                  />
                )}
              </button>
            ))}
          </motion.div>

          {/* Alertas */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={cn(
                  "p-4 rounded-lg flex items-center gap-3",
                  theme === 'dark'
                    ? "bg-red-900/20 border border-red-800 text-red-400"
                    : "bg-red-50 border border-red-200 text-red-700"
                )}
              >
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </motion.div>
            )}

            {warning && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={cn(
                  "p-4 rounded-lg flex items-center gap-3",
                  theme === 'dark'
                    ? "bg-yellow-900/20 border border-yellow-800 text-yellow-400"
                    : "bg-yellow-50 border border-yellow-200 text-yellow-700"
                )}
              >
                <AlertCircle className="w-5 h-5" />
                <span>{warning}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Contenido de las Pestañas */}
          <AnimatePresence mode="wait">
            {activeTab === 'rates' && (
              <motion.div
                key="rates"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={cn(
                  "rounded-xl p-6 border-x border-b",
                  theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                )}
              >
                {/* Tarjetas de Tasas deltoque - Dynamic grid based on currency count */}
                <div className={cn(
                  "grid gap-4",
                  rates && Object.keys(rates).length <= 3
                    ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                    : rates && Object.keys(rates).length <= 6
                      ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                      : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                )}>
                  {rates && Object.entries(rates).map(([currency, data], index) => (
                    <RateCard
                      key={currency}
                      currency={currency}
                      data={data}
                      index={index}
                      theme={theme}
                      adjustmentPercentage={adjustmentPercentage}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'agency' && (
              <motion.div
                key="agency"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={cn(
                  "rounded-xl p-6 border-x border-b space-y-6",
                  theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                )}
              >
                {/* Configuración Global de Agencias */}
                <div className={cn(
                  "rounded-xl p-6 border",
                  theme === 'dark' ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
                )}>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Building2 className={cn(
                        "w-6 h-6",
                        theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                      )} />
                      <div>
                        <h3 className={cn(
                          "text-lg font-semibold",
                          theme === 'dark' ? "text-white" : "text-gray-900"
                        )}>
                          Configuración Global de Tasas
                        </h3>
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          Define el margen para todas las agencias
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {!isEditingConfig ? (
                        <button
                          onClick={() => setIsEditingConfig(true)}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
                            theme === 'dark' ? "bg-gray-600 text-white hover:bg-gray-500" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                          )}
                        >
                          <Edit className="w-4 h-4" />
                          Editar Configuración
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setIsEditingConfig(false)
                              setAdjustmentPercentage(globalConfig?.adjustmentPercentage || 5.0)
                            }}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
                              theme === 'dark' ? "bg-gray-600 text-white hover:bg-gray-500" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                            )}
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={saveGlobalConfig}
                            disabled={savingConfig}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
                              savingConfig && "opacity-50",
                              theme === 'dark' ? "bg-green-600 text-white hover:bg-green-700" : "bg-green-500 text-white hover:bg-green-600"
                            )}
                          >
                            {savingConfig ? (
                              <>
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </motion.div>
                                Guardando...
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4" />
                                Guardar Cambios
                              </>
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2 flex items-center gap-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        <TrendingUp className="w-4 h-4" />
                        Porcentaje de Ajuste
                      </label>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            value={adjustmentPercentage}
                            onChange={(e) => handlePercentageChange(parseFloat(e.target.value) || 0)}
                            disabled={!isEditingConfig}
                            className={cn(
                              "flex-1 p-3 rounded-lg border font-bold text-center text-lg transition-all duration-200",
                              !isEditingConfig && "opacity-50 cursor-not-allowed",
                              theme === 'dark'
                                ? "bg-gray-600 border-gray-500 text-white"
                                : "bg-white border-gray-300 text-gray-900"
                            )}
                            step="0.1"
                            min="-50"
                            max="100"
                          />
                          <span className={cn(
                            "font-bold text-lg",
                            theme === 'dark' ? "text-white" : "text-gray-900"
                          )}>
                            %
                          </span>
                        </div>

                        {isEditingConfig && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handlePercentageChange(0)}
                              className={cn(
                                "px-3 py-1 rounded-md text-sm font-medium transition-all transform hover:scale-105",
                                theme === 'dark'
                                  ? "bg-blue-600 text-white hover:bg-blue-700"
                                  : "bg-blue-500 text-white hover:bg-blue-600"
                              )}
                            >
                              🎯 Al toque (0%)
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePercentageChange(5)}
                              className={cn(
                                "px-3 py-1 rounded-md text-sm font-medium transition-all transform hover:scale-105",
                                theme === 'dark'
                                  ? "bg-green-600 text-white hover:bg-green-700"
                                  : "bg-green-500 text-white hover:bg-green-600"
                              )}
                            >
                              📈 +5%
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePercentageChange(10)}
                              className={cn(
                                "px-3 py-1 rounded-md text-sm font-medium transition-all transform hover:scale-105",
                                theme === 'dark'
                                  ? "bg-green-600 text-white hover:bg-green-700"
                                  : "bg-green-500 text-white hover:bg-green-600"
                              )}
                            >
                              📈 +10%
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePercentageChange(-5)}
                              className={cn(
                                "px-3 py-1 rounded-md text-sm font-medium transition-all transform hover:scale-105",
                                theme === 'dark'
                                  ? "bg-red-600 text-white hover:bg-red-700"
                                  : "bg-red-500 text-white hover:bg-red-600"
                              )}
                            >
                              📉 -5%
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePercentageChange(-10)}
                              className={cn(
                                "px-3 py-1 rounded-md text-sm font-medium transition-all transform hover:scale-105",
                                theme === 'dark'
                                  ? "bg-red-600 text-white hover:bg-red-700"
                                  : "bg-red-500 text-white hover:bg-red-600"
                              )}
                            >
                              📉 -10%
                            </button>
                          </div>
                        )}
                      </div>
                      <p className={cn(
                        "text-xs mt-2",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        <span className="font-medium">¿Cómo funciona?</span><br/>
                        • <span className="text-green-500">Positivo (+):</span> Las agencias venden más caro que la tasa base<br/>
                        • <span className="text-red-500">Negativo (-):</span> Las agencias venden más barato que la tasa base<br/>
                        • <span className="text-blue-500">Cero (0%):</span> "Al toque" - misma tasa que eltoque.cubarapid.com
                      </p>
                    </div>

                    <div className={cn(
                      "p-4 rounded-lg border",
                      theme === 'dark' ? "bg-gray-600 border-gray-500" : "bg-gray-100 border-gray-300"
                    )}>
                      <div className={cn(
                        "text-sm font-medium mb-3 flex items-center gap-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        <Calculator className="w-4 h-4" />
                        Ejemplo de Cálculo
                      </div>
                      <div className={cn(
                        "p-3 rounded-lg border font-mono text-sm",
                        theme === 'dark' ? "bg-gray-700 border-gray-600 text-gray-300" : "bg-white border-gray-200 text-gray-800"
                      )}>
                        <div className="flex items-center justify-between">
                          <span>Tasa eltoque:</span>
                          <span className="font-bold">
                            $<AnimatedCounter value={475} duration={1500} />
                          </span>
                        </div>
                        <div className="flex items-center justify-center my-2">
                          <span className="text-gray-500">+</span>
                          <span className={cn(
                            "mx-2 font-bold",
                            adjustmentPercentage > 0 ? "text-green-500" :
                            adjustmentPercentage < 0 ? "text-red-500" :
                            "text-blue-500"
                          )}>
                            {adjustmentPercentage === 0 ? '🎯 Al toque' :
                             adjustmentPercentage > 0 ? `+${adjustmentPercentage}%` :
                             `${adjustmentPercentage}%`}
                          </span>
                          <span className="text-gray-500">=</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Tasa Agencia:</span>
                          <span className={cn(
                            "font-bold",
                            adjustmentPercentage > 0 ? "text-green-500" :
                            adjustmentPercentage < 0 ? "text-orange-500" :
                            "text-blue-500"
                          )}>
                            $<AnimatedCounter value={475 * (1 + adjustmentPercentage / 100)} duration={2000} />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                
                {/* Tarjetas de Tasas para Agencias */}
                <div>
                  <h3 className={cn(
                    "text-lg font-semibold mb-4 flex items-center gap-2",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    <Calculator className="w-5 h-5" />
                    Tasas Calculadas para Agencias
                    <span className={cn(
                      "text-sm font-normal",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      (Base + {adjustmentPercentage}%)
                    </span>
                  </h3>

                  <div className={cn(
                    "grid gap-4",
                    agencyRates && Object.keys(agencyRates).length <= 3
                      ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                      : agencyRates && Object.keys(agencyRates).length <= 6
                        ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                        : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                  )}>
                    {agencyRates && Object.entries(agencyRates).map(([currency, data], index) => {
                      const baseRate = rates?.[currency]?.rate || 0
                      const isAdjusted = globalConfig?.isActive && baseRate !== data.rate
                      const currencyMeta = getCurrencyMeta(currency)

                      return (
                        <motion.div
                          key={currency}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={cn(
                            "rounded-xl p-4 border relative overflow-hidden transition-all duration-300 hover:shadow-lg",
                            isAdjusted
                              ? theme === 'dark'
                                ? "bg-gradient-to-br from-gray-800 to-gray-700 border-exa-secondary/50"
                                : "bg-gradient-to-br from-white to-gray-50 border-exa-primary/30"
                              : theme === 'dark'
                                ? "bg-gray-800 border-gray-700 opacity-60"
                                : "bg-white border-gray-200 opacity-60"
                          )}
                        >
                          {/* Background gradient effect */}
                          {isAdjusted && (
                            <div className={cn(
                              "absolute inset-0 rounded-xl opacity-10",
                              theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary"
                            )} />
                          )}

                          <div className="relative z-10">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <motion.div
                                  className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center text-xl",
                                    isAdjusted
                                      ? theme === 'dark' ? "bg-exa-secondary/20" : "bg-exa-primary/20"
                                      : theme === 'dark' ? "bg-gray-700" : "bg-gray-100"
                                  )}
                                  whileHover={{ scale: 1.05, rotate: [0, -5, 5, 0] }}
                                >
                                  {currencyMeta.flag}
                                </motion.div>
                                <div>
                                  <h3 className={cn(
                                    "font-semibold text-sm",
                                    theme === 'dark' ? "text-white" : "text-gray-900"
                                  )}>
                                    {currency} / CUP
                                  </h3>
                                  <p className={cn(
                                    "text-xs",
                                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                  )}>
                                    {currencyMeta.name}
                                  </p>
                                </div>
                              </div>

                              {isAdjusted && (
                                <CheckCircle className={cn(
                                  "w-4 h-4",
                                  theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                                )} />
                              )}
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between text-xs">
                                <span className={cn(theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
                                  eltoque:
                                </span>
                                <span className={cn(theme === 'dark' ? "text-gray-300" : "text-gray-700")}>
                                  ${baseRate.toFixed(2)}
                                </span>
                              </div>

                              {/* Al Toque Representation con fórmula aplicada */}
                              <div className={cn(
                                "flex justify-between text-xs p-2 rounded",
                                theme === 'dark' ? "bg-blue-900/30 border border-blue-700/30" : "bg-blue-50 border border-blue-200"
                              )}>
                                <span className={cn(
                                  "font-medium flex items-center gap-1",
                                  theme === 'dark' ? "text-blue-400" : "text-blue-600"
                                )}>
                                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                                  Tasa Agencia:
                                </span>
                                <span className={cn(
                                  "font-bold",
                                  theme === 'dark' ? "text-blue-400" : "text-blue-600"
                                )}>
                                  $<AnimatedCounter
                                    value={baseRate * (1 + adjustmentPercentage / 100)}
                                    duration={1200}
                                  />
                                </span>
                              </div>

                              {isAdjusted && (
                                <div className="flex justify-between text-xs">
                                  <span className={cn(
                                    "font-medium",
                                    theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                                  )}>
                                    Agencia ({adjustmentPercentage > 0 ? '+' : ''}{adjustmentPercentage}%):
                                  </span>
                                  <span className={cn(
                                    "font-bold",
                                    theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                                  )}>
                                    ${data.rate.toFixed(2)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'report' && (
              <motion.div
                key="report"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={cn(
                  "rounded-xl p-6 border-x border-b",
                  theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                )}
              >
                <RatesReportTab theme={theme} />
              </motion.div>
            )}

          </AnimatePresence>

          {/* Convertidor de Moneda (solo visible en pestaña de tasas) */}
          <AnimatePresence>
            {activeTab === 'rates' && showConverter && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={cn(
                  "rounded-xl p-6 border",
                  theme === 'dark'
                    ? "bg-gray-800 border-gray-700"
                    : "bg-white border-gray-200"
                )}
              >
                <h3 className={cn(
                  "text-lg font-semibold mb-6 flex items-center gap-2",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  <ArrowUpDown className="w-5 h-5" />
                  Convertidor de Moneda
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      De
                    </label>
                    <select
                      value={fromCurrency}
                      onChange={(e) => setFromCurrency(e.target.value)}
                      className={cn(
                        "w-full p-3 rounded-lg border",
                        theme === 'dark'
                          ? "bg-gray-700 border-gray-600 text-white"
                          : "bg-white border-gray-300 text-gray-900"
                      )}
                    >
                      {/* Dynamic currency options from available rates + CUP */}
                      {rates && Object.keys(rates).map(currency => {
                        const meta = getCurrencyMeta(currency)
                        return (
                          <option key={currency} value={currency}>
                            {meta.flag} {currency} - {meta.name}
                          </option>
                        )
                      })}
                      <option value="CUP">{getCurrencyMeta('CUP').flag} CUP - {getCurrencyMeta('CUP').name}</option>
                    </select>
                  </div>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      Cantidad
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className={cn(
                        "w-full p-3 rounded-lg border",
                        theme === 'dark'
                          ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                          : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                      )}
                    />
                  </div>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      A
                    </label>
                    <select
                      value={toCurrency}
                      onChange={(e) => setToCurrency(e.target.value)}
                      className={cn(
                        "w-full p-3 rounded-lg border",
                        theme === 'dark'
                          ? "bg-gray-700 border-gray-600 text-white"
                          : "bg-white border-gray-300 text-gray-900"
                      )}
                    >
                      {/* CUP first as default target */}
                      <option value="CUP">{getCurrencyMeta('CUP').flag} CUP - {getCurrencyMeta('CUP').name}</option>
                      {/* Then all other currencies from rates */}
                      {rates && Object.keys(rates).map(currency => {
                        const meta = getCurrencyMeta(currency)
                        return (
                          <option key={currency} value={currency}>
                            {meta.flag} {currency} - {meta.name}
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={handleConvert}
                      disabled={!amount || parseFloat(amount) <= 0 || converting}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300",
                        (!amount || parseFloat(amount) <= 0 || converting) && "opacity-50",
                        theme === 'dark'
                          ? "bg-exa-secondary text-white hover:bg-exa-primary"
                          : "bg-exa-primary text-white hover:bg-exa-secondary"
                      )}
                    >
                      {converting ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <RefreshCw className="w-4 h-4" />
                        </motion.div>
                      ) : (
                        'Convertir'
                      )}
                    </button>
                  </div>
                </div>

                
                {/* Resultado de conversión */}
                {conversion && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "mt-6 p-4 rounded-lg border",
                      theme === 'dark'
                        ? "bg-gray-700/50 border-gray-600"
                        : "bg-gray-50 border-gray-200"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          {conversion.amount} {fromCurrency} =
                        </p>
                        <p className={cn(
                          "text-2xl font-bold",
                          theme === 'dark' ? "text-white" : "text-gray-900"
                        )}>
                          {conversion.result.toFixed(2)} {toCurrency}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "text-xs",
                          theme === 'dark' ? "text-gray-500" : "text-gray-500"
                        )}>
                          Tasa utilizada
                        </p>
                        <p className={cn(
                          "text-sm font-medium",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          1 {fromCurrency} = {conversion.rate} CUP
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </DashboardLayout>
  )
}