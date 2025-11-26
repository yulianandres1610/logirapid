'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  BarChart3,
  Target,
  Activity
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface RateHistoryEntry {
  timestamp: string
  currency: string
  baserate: number
  agencyrate: number
}

interface RatesReportTabProps {
  theme: string
}

// Monedas disponibles
const CURRENCIES = [
  { code: 'USD', name: 'Dólar USD', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
  { code: 'MLC', name: 'MLC', flag: '🇨🇺' },
  { code: 'GBP', name: 'Libra', flag: '🇬🇧' },
  { code: 'CAD', name: 'Dólar CAD', flag: '🇨🇦' },
  { code: 'MXN', name: 'Peso MXN', flag: '🇲🇽' },
  { code: 'BRL', name: 'Real BRL', flag: '🇧🇷' },
  { code: 'ZELLE', name: 'Zelle', flag: '💳' },
  { code: 'CLA', name: 'CLA', flag: '💰' }
]

// Períodos de tiempo
const TIME_PERIODS = [
  { id: 'hour', label: '1H', days: 0.0417 }, // ~1 hora en días (1/24)
  { id: 'day', label: '24H', days: 1 },
  { id: 'week', label: '7D', days: 7 },
  { id: 'month', label: '30D', days: 30 },
  { id: 'quarter', label: '90D', days: 90 },
  { id: 'year', label: '1A', days: 365 }
]

// Función de predicción usando regresión lineal
function predictNextValue(data: { rate: number }[]): { value: number; trend: 'up' | 'down' | 'stable' } {
  const n = data.length
  if (n < 2) return { value: data[n - 1]?.rate || 0, trend: 'stable' }

  // Calcular pendiente usando mínimos cuadrados
  const sumX = data.reduce((acc, _, i) => acc + i, 0)
  const sumY = data.reduce((acc, d) => acc + d.rate, 0)
  const sumXY = data.reduce((acc, d, i) => acc + i * d.rate, 0)
  const sumX2 = data.reduce((acc, _, i) => acc + i * i, 0)

  const denominator = n * sumX2 - sumX * sumX
  if (denominator === 0) return { value: data[n - 1]?.rate || 0, trend: 'stable' }

  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n

  const predictedValue = slope * n + intercept

  // Determinar tendencia basada en la pendiente
  const avgRate = sumY / n
  const slopePercentage = (slope / avgRate) * 100

  let trend: 'up' | 'down' | 'stable'
  if (slopePercentage > 0.5) trend = 'up'
  else if (slopePercentage < -0.5) trend = 'down'
  else trend = 'stable'

  return { value: predictedValue, trend }
}

// Calcular estadísticas del período
function calculateStats(data: { rate: number }[]) {
  if (data.length === 0) return { min: 0, max: 0, avg: 0, variation: 0, current: 0 }

  const rates = data.map(d => d.rate)
  const min = Math.min(...rates)
  const max = Math.max(...rates)
  const avg = rates.reduce((a, b) => a + b, 0) / rates.length
  const first = rates[0]
  const last = rates[rates.length - 1]
  const variation = first !== 0 ? ((last - first) / first) * 100 : 0

  return { min, max, avg, variation, current: last }
}

export default function RatesReportTab({ theme }: RatesReportTabProps) {
  const [selectedCurrency, setSelectedCurrency] = useState('USD')
  const [selectedPeriod, setSelectedPeriod] = useState('day')
  const [historyData, setHistoryData] = useState<RateHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Obtener datos del historial
  const fetchHistory = async () => {
    setLoading(true)
    setError(null)

    const period = TIME_PERIODS.find(p => p.id === selectedPeriod)
    const days = period?.days || 30

    try {
      const response = await fetch(`/api/agency-rates/history?currency=${selectedCurrency}&days=${days}`)
      const data = await response.json()

      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        // Usar datos reales de la base de datos
        setHistoryData(data.data)
      } else {
        // Solo generar datos de ejemplo si NO hay datos reales
        console.log('No hay datos históricos, generando datos de demostración')
        setHistoryData(generateSampleData(days, selectedCurrency))
      }
    } catch (err) {
      console.error('Error fetching history:', err)
      // Generar datos de ejemplo en caso de error
      setHistoryData(generateSampleData(period?.days || 30, selectedCurrency))
    } finally {
      setLoading(false)
    }
  }

  // Generar datos de ejemplo para demo
  function generateSampleData(days: number, currency: string): RateHistoryEntry[] {
    const baseRates: Record<string, number> = {
      USD: 380, EUR: 410, MLC: 280, GBP: 480, CAD: 290,
      MXN: 22, BRL: 78, ZELLE: 375, CLA: 1
    }
    const base = baseRates[currency] || 100
    const data: RateHistoryEntry[] = []
    const now = new Date()

    for (let i = days; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)

      // Variación aleatoria para simular movimiento de mercado
      const variation = (Math.random() - 0.5) * 0.05 * base
      const rate = base + variation + (Math.sin(i / 7) * base * 0.02)

      data.push({
        timestamp: date.toISOString(),
        currency,
        baserate: rate,
        agencyrate: rate * 1.05
      })
    }

    return data
  }

  useEffect(() => {
    fetchHistory()
  }, [selectedCurrency, selectedPeriod])

  // Procesar datos para la gráfica
  const chartData = useMemo(() => {
    const is1Hour = selectedPeriod === 'hour'
    const is24Hours = selectedPeriod === 'day'

    return historyData.map(entry => ({
      date: (is1Hour || is24Hours)
        ? new Date(entry.timestamp).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
          })
        : new Date(entry.timestamp).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short'
          }),
      fullDate: new Date(entry.timestamp).toLocaleString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      rate: entry.baserate
    }))
  }, [historyData, selectedPeriod])

  // Estadísticas
  const stats = useMemo(() => calculateStats(chartData), [chartData])

  // Predicción
  const prediction = useMemo(() => predictNextValue(chartData), [chartData])

  const currencyInfo = CURRENCIES.find(c => c.code === selectedCurrency)

  // Custom tooltip para la gráfica
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={cn(
          "p-3 rounded-lg shadow-lg border",
          theme === 'dark'
            ? "bg-gray-800 border-gray-700 text-white"
            : "bg-white border-gray-200 text-gray-900"
        )}>
          <p className="font-medium text-sm">{payload[0]?.payload?.fullDate}</p>
          <p className={cn(
            "text-lg font-bold mt-1",
            theme === 'dark' ? "text-green-400" : "text-green-600"
          )}>
            {payload[0]?.value?.toFixed(2)} CUP
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header con controles */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Selector de moneda */}
        <div className="flex items-center gap-3">
          <label className={cn(
            "text-sm font-medium",
            theme === 'dark' ? "text-gray-400" : "text-gray-600"
          )}>
            Moneda:
          </label>
          <select
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
            className={cn(
              "px-4 py-2 rounded-lg border font-medium transition-all",
              theme === 'dark'
                ? "bg-gray-700 border-gray-600 text-white"
                : "bg-white border-gray-300 text-gray-900"
            )}
          >
            {CURRENCIES.map(currency => (
              <option key={currency.code} value={currency.code}>
                {currency.flag} {currency.code} - {currency.name}
              </option>
            ))}
          </select>
        </div>

        {/* Filtros de período */}
        <div className="flex items-center gap-2">
          {TIME_PERIODS.map(period => (
            <button
              key={period.id}
              onClick={() => setSelectedPeriod(period.id)}
              className={cn(
                "px-4 py-2 rounded-lg font-medium transition-all text-sm",
                selectedPeriod === period.id
                  ? theme === 'dark'
                    ? "bg-exa-secondary text-white"
                    : "bg-exa-primary text-white"
                  : theme === 'dark'
                    ? "bg-gray-700 text-gray-400 hover:bg-gray-600"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {period.label}
            </button>
          ))}
          <button
            onClick={fetchHistory}
            disabled={loading}
            className={cn(
              "p-2 rounded-lg transition-all",
              theme === 'dark'
                ? "bg-gray-700 text-gray-400 hover:bg-gray-600"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Título de la moneda seleccionada */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">{currencyInfo?.flag}</span>
        <div>
          <h3 className={cn(
            "text-xl font-bold",
            theme === 'dark' ? "text-white" : "text-gray-900"
          )}>
            {currencyInfo?.name} ({selectedCurrency})
          </h3>
          <p className={cn(
            "text-sm",
            theme === 'dark' ? "text-gray-400" : "text-gray-600"
          )}>
            Historial de tasa de cambio vs CUP
          </p>
        </div>
      </div>

      {/* Gráfica principal */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-xl p-4 border",
          theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
        )}
      >
        {loading ? (
          <div className="h-80 flex items-center justify-center">
            <RefreshCw className={cn(
              "w-8 h-8 animate-spin",
              theme === 'dark' ? "text-gray-500" : "text-gray-400"
            )} />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={theme === 'dark' ? "#10B981" : "#059669"}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={theme === 'dark' ? "#10B981" : "#059669"}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={theme === 'dark' ? "#374151" : "#E5E7EB"}
              />
              <XAxis
                dataKey="date"
                stroke={theme === 'dark' ? "#9CA3AF" : "#6B7280"}
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke={theme === 'dark' ? "#9CA3AF" : "#6B7280"}
                fontSize={12}
                tickLine={false}
                domain={['dataMin - 5', 'dataMax + 5']}
                tickFormatter={(value) => value.toFixed(0)}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={stats.avg}
                stroke={theme === 'dark' ? "#6B7280" : "#9CA3AF"}
                strokeDasharray="5 5"
                label={{
                  value: `Prom: ${stats.avg.toFixed(2)}`,
                  position: 'right',
                  fill: theme === 'dark' ? "#9CA3AF" : "#6B7280",
                  fontSize: 10
                }}
              />
              <Area
                type="monotone"
                dataKey="rate"
                stroke={theme === 'dark' ? "#10B981" : "#059669"}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRate)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Valor actual */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={cn(
            "p-4 rounded-xl border",
            theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <Activity className={cn(
              "w-4 h-4",
              theme === 'dark' ? "text-blue-400" : "text-blue-600"
            )} />
            <span className={cn(
              "text-xs font-medium",
              theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>
              Actual
            </span>
          </div>
          <p className={cn(
            "text-xl font-bold",
            theme === 'dark' ? "text-white" : "text-gray-900"
          )}>
            {stats.current.toFixed(2)}
          </p>
          <p className={cn(
            "text-xs",
            theme === 'dark' ? "text-gray-500" : "text-gray-500"
          )}>
            CUP
          </p>
        </motion.div>

        {/* Mínimo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(
            "p-4 rounded-xl border",
            theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <ArrowDown className={cn(
              "w-4 h-4",
              theme === 'dark' ? "text-red-400" : "text-red-600"
            )} />
            <span className={cn(
              "text-xs font-medium",
              theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>
              Mínimo
            </span>
          </div>
          <p className={cn(
            "text-xl font-bold",
            theme === 'dark' ? "text-red-400" : "text-red-600"
          )}>
            {stats.min.toFixed(2)}
          </p>
        </motion.div>

        {/* Máximo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={cn(
            "p-4 rounded-xl border",
            theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <ArrowUp className={cn(
              "w-4 h-4",
              theme === 'dark' ? "text-green-400" : "text-green-600"
            )} />
            <span className={cn(
              "text-xs font-medium",
              theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>
              Máximo
            </span>
          </div>
          <p className={cn(
            "text-xl font-bold",
            theme === 'dark' ? "text-green-400" : "text-green-600"
          )}>
            {stats.max.toFixed(2)}
          </p>
        </motion.div>

        {/* Promedio */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className={cn(
            "p-4 rounded-xl border",
            theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className={cn(
              "w-4 h-4",
              theme === 'dark' ? "text-purple-400" : "text-purple-600"
            )} />
            <span className={cn(
              "text-xs font-medium",
              theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>
              Promedio
            </span>
          </div>
          <p className={cn(
            "text-xl font-bold",
            theme === 'dark' ? "text-purple-400" : "text-purple-600"
          )}>
            {stats.avg.toFixed(2)}
          </p>
        </motion.div>

        {/* Variación */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className={cn(
            "p-4 rounded-xl border",
            theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            {stats.variation >= 0 ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            <span className={cn(
              "text-xs font-medium",
              theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>
              Variación
            </span>
          </div>
          <p className={cn(
            "text-xl font-bold",
            stats.variation >= 0
              ? theme === 'dark' ? "text-green-400" : "text-green-600"
              : theme === 'dark' ? "text-red-400" : "text-red-600"
          )}>
            {stats.variation >= 0 ? '+' : ''}{stats.variation.toFixed(2)}%
          </p>
        </motion.div>
      </div>

      {/* Predicción */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className={cn(
          "p-6 rounded-xl border",
          theme === 'dark'
            ? "bg-gradient-to-r from-gray-800/80 to-gray-800/50 border-gray-700"
            : "bg-gradient-to-r from-gray-50 to-white border-gray-200"
        )}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            theme === 'dark' ? "bg-yellow-500/20" : "bg-yellow-100"
          )}>
            <Target className={cn(
              "w-5 h-5",
              theme === 'dark' ? "text-yellow-400" : "text-yellow-600"
            )} />
          </div>
          <div>
            <h4 className={cn(
              "font-bold",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              Predicción para el próximo período
            </h4>
            <p className={cn(
              "text-sm",
              theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>
              Basado en análisis de tendencia por regresión lineal
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <p className={cn(
                "text-3xl font-bold",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                {prediction.value.toFixed(2)} CUP
              </p>
              <p className={cn(
                "text-sm",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                Valor estimado
              </p>
            </div>
          </div>

          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full",
            prediction.trend === 'up'
              ? theme === 'dark' ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-700"
              : prediction.trend === 'down'
              ? theme === 'dark' ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-700"
              : theme === 'dark' ? "bg-gray-600/50 text-gray-400" : "bg-gray-200 text-gray-600"
          )}>
            {prediction.trend === 'up' && <TrendingUp className="w-5 h-5" />}
            {prediction.trend === 'down' && <TrendingDown className="w-5 h-5" />}
            {prediction.trend === 'stable' && <Minus className="w-5 h-5" />}
            <span className="font-medium">
              {prediction.trend === 'up' && 'Tendencia alcista'}
              {prediction.trend === 'down' && 'Tendencia bajista'}
              {prediction.trend === 'stable' && 'Estable'}
            </span>
          </div>
        </div>

        <p className={cn(
          "text-xs mt-4",
          theme === 'dark' ? "text-gray-500" : "text-gray-500"
        )}>
          * Esta predicción es una estimación basada en datos históricos y no debe considerarse como asesoría financiera.
        </p>
      </motion.div>
    </div>
  )
}
