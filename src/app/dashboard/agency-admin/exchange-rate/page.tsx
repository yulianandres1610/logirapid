'use client'

import { useState, useEffect } from 'react'
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
  CheckCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { useAgencyRates } from '@/hooks/useAgencyRates'

interface ExchangeRate {
  rate: number
  formatted: string
  lastUpdate: string
}

interface ExchangeRatesData {
  USD: ExchangeRate
  EUR: ExchangeRate
  MLC: ExchangeRate
}

interface AgencyRate {
  currency: string
  baseRate: number
  agencyRate: number
  adjustmentPercentage: number
  lastUpdate: string
  formattedBaseRate: string
  formattedAgencyRate: string
}

interface ConversionResult {
  amount: number
  rate: number
  result: number
}

export default function ExchangeRatePage() {
  const { theme } = useTheme()
  const { rates: agencyRates, config, loading, error, lastRefresh, refreshRates } = useAgencyRates()

  // Convertir tasas de agencia al formato existente para compatibilidad
  const [rates, setRates] = useState<ExchangeRatesData | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  // Estados para conversor
  const [showConverter, setShowConverter] = useState(false)
  const [fromCurrency, setFromCurrency] = useState('USD')
  const [toCurrency, setToCurrency] = useState('CUP')
  const [amount, setAmount] = useState('')
  const [conversion, setConversion] = useState<ConversionResult | null>(null)
  const [converting, setConverting] = useState(false)
  const [conversionError, setConversionError] = useState<string | null>(null)

  // Efecto para convertir tasas de agencia al formato existente
  useEffect(() => {
    if (agencyRates) {
      const convertedRates: ExchangeRatesData = {
        USD: {
          rate: agencyRates.USD?.agencyRate || 0,
          formatted: agencyRates.USD?.formattedAgencyRate || '0.00',
          lastUpdate: new Date(agencyRates.USD?.lastUpdate || Date.now()).toLocaleString('es-ES')
        },
        EUR: {
          rate: agencyRates.EUR?.agencyRate || 0,
          formatted: agencyRates.EUR?.formattedAgencyRate || '0.00',
          lastUpdate: new Date(agencyRates.EUR?.lastUpdate || Date.now()).toLocaleString('es-ES')
        },
        MLC: {
          rate: agencyRates.MLC?.agencyRate || 0,
          formatted: agencyRates.MLC?.formattedAgencyRate || '0.00',
          lastUpdate: new Date(agencyRates.MLC?.lastUpdate || Date.now()).toLocaleString('es-ES')
        }
      }

      setRates(convertedRates)

      }
  }, [agencyRates, config])

  // Convertir moneda
  const handleConvert = async () => {
    if (!amount || parseFloat(amount) <= 0) return

    try {
      setConverting(true)
      setConversionError(null)

      const response = await fetch(
        `/api/exchange-rates?convert=true&from=${fromCurrency}&to=${toCurrency}&amount=${amount}`
      )
      const data = await response.json()

      if (data.success) {
        setConversion(data.data)
      } else {
        setConversionError(data.error || 'Error en la conversión')
      }
    } catch (err) {
      console.error('Error converting currency:', err)
      setConversionError('Error al realizar la conversión')
    } finally {
      setConverting(false)
    }
  }

  
  const currencyFlags = {
    USD: '🇺🇸',
    EUR: '🇪🇺',
    MLC: '💳',
    CUP: '🇨🇺'
  }

  if (loading && !rates) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-exa-primary border-t-transparent rounded-full"
          />
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
                Tasas configuradas por el administrador para su agencia
              </p>
            </div>

            <div className="flex items-center gap-4">
              {lastRefresh && (
                <div className={cn(
                  "flex items-center gap-2 text-sm",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  <Clock className="w-4 h-4" />
                  <span>
                    Última actualización: {lastRefresh.toLocaleTimeString('es-ES')}
                  </span>
                </div>
              )}

              <button
                onClick={() => refreshRates()}
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
                {loading ? 'Actualizando...' : 'Actualizar'}
              </button>

              <button
                onClick={() => setShowConverter(!showConverter)}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300",
                  theme === 'dark'
                    ? "border border-gray-700 text-gray-300 hover:bg-gray-800"
                    : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                )}
              >
                <ArrowUpDown className="w-4 h-4" />
                Convertidor
              </button>
            </div>
          </motion.div>

          {/* Alertas */}
          <AnimatePresence>
            {conversionError && (
              <motion.div
                key="conversion-error"
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
                <span>{conversionError}</span>
              </motion.div>
            )}

            {warning && (
              <motion.div
                key="warning"
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

            {/* Alerta informativa sobre tasas de agencia */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "p-4 rounded-lg flex items-center gap-3",
                theme === 'dark'
                  ? "bg-blue-900/20 border border-blue-800 text-blue-400"
                  : "bg-blue-50 border border-blue-200 text-blue-700"
              )}
            >
              <TrendingUp className="w-5 h-5" />
              <div>
                <span className="font-medium">Tasas de agencia configuradas</span>
                <p className="text-xs mt-1 opacity-80">
                  Estas tasas son configuradas por el administrador y se aplican automáticamente en sus operaciones de remesas.
                </p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Tarjetas de Tasas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {rates && Object.entries(rates).map(([currency, data], index) => (
              <motion.div
                key={currency}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "rounded-xl p-6 border relative overflow-hidden",
                  theme === 'dark'
                    ? "bg-gray-800 border-gray-700"
                    : "bg-white border-gray-200"
                )}
              >
                {/* Background gradient */}
                <div className={cn(
                  "absolute inset-0 opacity-10",
                  currency === 'USD' && "bg-gradient-to-br from-blue-500 to-blue-600",
                  currency === 'EUR' && "bg-gradient-to-br from-green-500 to-green-600",
                  currency === 'MLC' && "bg-gradient-to-br from-purple-500 to-purple-600"
                )} />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-12 h-12 rounded-lg flex items-center justify-center text-2xl",
                        currency === 'USD' && "bg-blue-500/20",
                        currency === 'EUR' && "bg-green-500/20",
                        currency === 'MLC' && "bg-purple-500/20"
                      )}>
                        {currencyFlags[currency as keyof typeof currencyFlags]}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">
                          {currency} / CUP
                        </h3>
                        <p className={cn(
                          "text-xs",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          1 {currency} = {data.formatted} CUP
                        </p>
                      </div>
                    </div>

                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: index * 0.1 + 0.2 }}
                    >
                      <CheckCircle className={cn(
                        "w-5 h-5",
                        currency === 'USD' && "text-blue-500",
                        currency === 'EUR' && "text-green-500",
                        currency === 'MLC' && "text-purple-500"
                      )} />
                    </motion.div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-sm font-medium",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        Tasa actual
                      </span>
                      <span className={cn(
                        "text-2xl font-bold",
                        currency === 'USD' && "text-blue-500",
                        currency === 'EUR' && "text-green-500",
                        currency === 'MLC' && "text-purple-500"
                      )}>
                        ${data.formatted}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <Clock className="w-3 h-3" />
                      <span className={cn(
                        theme === 'dark' ? "text-gray-500" : "text-gray-500"
                      )}>
                        Última actualización: {data.lastUpdate}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Convertidor de Moneda */}
          <AnimatePresence>
            {showConverter && (
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
                      <option value="USD">🇺🇸 USD</option>
                      <option value="EUR">🇪🇺 EUR</option>
                      <option value="MLC">💳 MLC</option>
                      <option value="CUP">🇨🇺 CUP</option>
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
                      <option value="CUP">🇨🇺 CUP</option>
                      <option value="USD">🇺🇸 USD</option>
                      <option value="EUR">🇪🇺 EUR</option>
                      <option value="MLC">💳 MLC</option>
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