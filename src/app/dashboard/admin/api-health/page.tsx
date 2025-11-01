'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCw,
  Globe,
  Clock,
  Zap,
  Database,
  TrendingUp,
  Server,
  Wifi,
  WifiOff
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

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

export default function APIHealthPage() {
  const { theme } = useTheme()
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const fetchHealthStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/health/exchange-rate')
      const data = await response.json()
      setHealthStatus(data)
    } catch (error) {
      console.error('Error fetching health status:', error)
      setHealthStatus({
        status: 'error',
        timestamp: new Date().toISOString(),
        duration: 0,
        tests: [],
        endpoints: {},
        rates: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealthStatus()
  }, [])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchHealthStatus, 30000) // 30 segundos
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'partial':
      case 'parse_error':
      case 'empty_response':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />
      case 'unhealthy':
      case 'http_error':
      case 'connection_error':
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return <Activity className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'success':
        return theme === 'dark' ? 'text-green-400' : 'text-green-600'
      case 'partial':
      case 'parse_error':
      case 'empty_response':
        return theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
      case 'unhealthy':
      case 'http_error':
      case 'connection_error':
      case 'error':
        return theme === 'dark' ? 'text-red-400' : 'text-red-600'
      default:
        return theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
    }
  }

  const getOverallStatusIcon = () => {
    if (!healthStatus) return <Activity className="w-8 h-8 text-gray-500" />
    return getStatusIcon(healthStatus.status)
  }

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
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
                Salud del API
              </h1>
              <p className={cn(
                "mt-2 text-sm",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                Monitoreo del estado de conexión con eltoque.cubarapid.com
              </p>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
                  autoRefresh
                    ? theme === 'dark' ? "bg-green-600 text-white" : "bg-green-500 text-white"
                    : theme === 'dark' ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-700"
                )}
              >
                {autoRefresh ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                Auto-refresh
              </button>

              <button
                onClick={fetchHealthStatus}
                disabled={loading}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300",
                  loading && "opacity-50",
                  theme === 'dark'
                    ? "bg-exa-secondary text-white hover:bg-exa-primary"
                    : "bg-exa-primary text-white hover:bg-exa-secondary"
                )}
              >
                <motion.div
                  animate={loading ? { rotate: 360 } : {}}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <RefreshCw className="w-4 h-4" />
                </motion.div>
                {loading ? 'Verificando...' : 'Verificar Ahora'}
              </button>
            </div>
          </motion.div>

          {/* Estado General */}
          <AnimatePresence>
            {healthStatus && (
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <motion.div
                      animate={{
                        scale: healthStatus.status === 'healthy' ? [1, 1.1, 1] : 1,
                      }}
                      transition={{
                        duration: 2,
                        repeat: healthStatus.status === 'healthy' ? Infinity : 0,
                        ease: "easeInOut"
                      }}
                    >
                      {getOverallStatusIcon()}
                    </motion.div>
                    <div>
                      <h2 className={cn(
                        "text-xl font-semibold",
                        theme === 'dark' ? "text-white" : "text-gray-900"
                      )}>
                        Estado General: {healthStatus.status.toUpperCase()}
                      </h2>
                      <p className={cn(
                        "text-sm mt-1",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        Última verificación: {new Date(healthStatus.timestamp).toLocaleString('es-ES')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className={cn(
                        "text-2xl font-bold",
                        getStatusColor(healthStatus.status)
                      )}>
                        {formatResponseTime(healthStatus.duration)}
                      </div>
                      <div className={cn(
                        "text-xs",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        Tiempo de respuesta
                      </div>
                    </div>

                    {healthStatus.rates && (
                      <div className="text-center">
                        <div className={cn(
                          "text-2xl font-bold",
                          healthStatus.rates.success
                            ? theme === 'dark' ? "text-green-400" : "text-green-600"
                            : theme === 'dark' ? "text-red-400" : "text-red-600"
                        )}>
                          {healthStatus.rates.count || 0}
                        </div>
                        <div className={cn(
                          "text-xs",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          Tasas disponibles
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {healthStatus.error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={cn(
                      "mt-4 p-3 rounded-lg",
                      theme === 'dark' ? "bg-red-900/20 border border-red-800" : "bg-red-50 border border-red-200"
                    )}
                  >
                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-red-400" : "text-red-700"
                    )}>
                      Error: {healthStatus.error}
                    </p>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tests de Endpoints */}
          {healthStatus?.tests && healthStatus.tests.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={cn(
                "rounded-xl p-6 border",
                theme === 'dark'
                  ? "bg-gray-800 border-gray-700"
                  : "bg-white border-gray-200"
              )}
            >
              <h3 className={cn(
                "text-lg font-semibold mb-4 flex items-center gap-2",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                <Server className="w-5 h-5" />
                Tests de Endpoints
              </h3>

              <div className="space-y-3">
                {healthStatus.tests.map((test, index) => (
                  <motion.div
                    key={test.endpoint}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                    className={cn(
                      "p-4 rounded-lg border",
                      theme === 'dark' ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(test.status)}
                        <div>
                          <div className={cn(
                            "font-medium",
                            theme === 'dark' ? "text-white" : "text-gray-900"
                          )}>
                            {test.endpoint}
                          </div>
                          <div className={cn(
                            "text-xs",
                            theme === 'dark' ? "text-gray-400" : "text-gray-600"
                          )}>
                            {test.url}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className={cn(
                            "text-sm font-medium",
                            getStatusColor(test.status)
                          )}>
                            {test.status.toUpperCase()}
                          </div>
                          {test.responseTime > 0 && (
                            <div className={cn(
                              "text-xs",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              {formatResponseTime(test.responseTime)}
                            </div>
                          )}
                        </div>

                        {test.statusCode && (
                          <div className={cn(
                            "px-2 py-1 rounded text-xs font-medium",
                            test.statusCode === 200
                              ? theme === 'dark' ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700"
                              : theme === 'dark' ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-700"
                          )}>
                            {test.statusCode}
                          </div>
                        )}
                      </div>
                    </div>

                    {test.error && (
                      <div className={cn(
                        "mt-2 text-xs",
                        theme === 'dark' ? "text-red-400" : "text-red-600"
                      )}>
                        {test.error}
                      </div>
                    )}

                    {test.dataSample && (
                      <div className={cn(
                        "mt-2 p-2 rounded text-xs font-mono",
                        theme === 'dark' ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-700"
                      )}>
                        <div>Type: {test.dataSample.type}</div>
                        <div>Keys: {test.dataSample.keys?.join(', ') || 'N/A'}</div>
                        <div>Array: {test.dataSample.isArray ? 'Yes' : 'No'}</div>
                        <div className="mt-1 opacity-70">{test.dataSample.sample}</div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Estado de Tasas */}
          {healthStatus?.rates && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={cn(
                "rounded-xl p-6 border",
                theme === 'dark'
                  ? "bg-gray-800 border-gray-700"
                  : "bg-white border-gray-200"
              )}
            >
              <h3 className={cn(
                "text-lg font-semibold mb-4 flex items-center gap-2",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                <TrendingUp className="w-5 h-5" />
                Estado de Tasas de Cambio
              </h3>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {healthStatus.rates.success ? (
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-500" />
                  )}
                  <div>
                    <div className={cn(
                      "font-medium",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      {healthStatus.rates.success ? 'Tasas disponibles' : 'Error al obtener tasas'}
                    </div>
                    {healthStatus.rates.error && (
                      <div className={cn(
                        "text-sm",
                        theme === 'dark' ? "text-red-400" : "text-red-600"
                      )}>
                        {healthStatus.rates.error}
                      </div>
                    )}
                  </div>
                </div>

                {healthStatus.rates.success && healthStatus.rates.currencies && (
                  <div className={cn(
                    "px-3 py-1 rounded-lg text-sm",
                    theme === 'dark' ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700"
                  )}>
                    {healthStatus.rates.currencies.length} monedas
                  </div>
                )}
              </div>

              {healthStatus.rates.success && healthStatus.rates.sample && (
                <div className={cn(
                  "mt-4 p-3 rounded-lg text-xs font-mono",
                  theme === 'dark' ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700"
                )}>
                  <div className="font-medium mb-2">Muestra de tasas:</div>
                  {Object.entries(healthStatus.rates.sample).slice(0, 3).map(([currency, data]: [string, any]) => (
                    <div key={currency} className="flex justify-between">
                      <span>{currency}:</span>
                      <span>${data.rate?.toFixed(2) || 'N/A'}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}