'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign,
  Save,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Clock,
  ArrowRight,
  Info
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface ExchangeRateConfig {
  companyId: number
  manualRate: number | null
  elToqueRate: number
  elToqueTimestamp: string | null
  effectiveRate: number
  source: 'manual' | 'eltoque' | 'none'
  updatedAt: string | null
  updatedBy: string | null
}

export default function ExchangeRateConfigPage() {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [config, setConfig] = useState<ExchangeRateConfig | null>(null)
  const [manualRate, setManualRate] = useState<string>('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Fetch current configuration
  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/market/exchange-rate-config')
      const data = await response.json()

      if (data.success && data.data) {
        setConfig(data.data)
        setManualRate(data.data.manualRate?.toString() || '')
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al cargar configuración' })
      }
    } catch (error) {
      console.error('Error fetching config:', error)
      setMessage({ type: 'error', text: 'Error de conexión' })
    } finally {
      setLoading(false)
    }
  }

  const refreshElToque = async () => {
    setRefreshing(true)
    try {
      // Re-fetch to get latest ElToque rate
      await fetchConfig()
      setMessage({ type: 'success', text: 'Tasa de ElToque actualizada' })
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al actualizar tasa de ElToque' })
    } finally {
      setRefreshing(false)
    }
  }

  const handleSave = async () => {
    if (!manualRate || parseFloat(manualRate) <= 0) {
      setMessage({ type: 'error', text: 'Ingrese una tasa válida mayor a 0' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/market/exchange-rate-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manualRate: parseFloat(manualRate)
        })
      })

      const data = await response.json()

      if (data.success) {
        setConfig(data.data)
        setMessage({ type: 'success', text: 'Tasa de cambio guardada correctamente' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al guardar' })
      }
    } catch (error) {
      console.error('Error saving config:', error)
      setMessage({ type: 'error', text: 'Error de conexión al guardar' })
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No disponible'
    try {
      return new Date(dateStr).toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  const getTimeSince = (dateStr: string | null) => {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / 60000)

      if (diffMins < 1) return 'hace un momento'
      if (diffMins < 60) return `hace ${diffMins} minutos`
      if (diffMins < 1440) return `hace ${Math.floor(diffMins / 60)} horas`
      return `hace ${Math.floor(diffMins / 1440)} días`
    } catch {
      return ''
    }
  }

  return (
    <ProtectedRoute requiredRole={['ADMIN', 'SUPER_ADMIN', 'MARKET_ADMIN', 'MARKET_MANAGER']}>
      <DashboardLayout>
        <div className="p-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className={cn(
              "text-2xl font-bold mb-2",
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              Tasa de Cambio Manual
            </h1>
            <p className={cn(
              "text-sm",
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            )}>
              Configure la tasa de cambio USD/CUP que se usará en todo el sistema (POS, inventario, reportes)
            </p>
          </div>

          {/* Message */}
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "mb-6 p-4 rounded-lg flex items-center gap-3",
                message.type === 'success'
                  ? theme === 'dark' ? 'bg-green-900/30 border border-green-700' : 'bg-green-50 border border-green-200'
                  : theme === 'dark' ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'
              )}
            >
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
              <span className={cn(
                "text-sm",
                message.type === 'success'
                  ? theme === 'dark' ? 'text-green-300' : 'text-green-700'
                  : theme === 'dark' ? 'text-red-300' : 'text-red-700'
              )}>
                {message.text}
              </span>
            </motion.div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-exa-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Current Effective Rate Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-6 rounded-xl border",
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-green-700/30'
                    : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    "p-2 rounded-lg",
                    theme === 'dark' ? 'bg-green-900/50' : 'bg-green-100'
                  )}>
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <h3 className={cn(
                      "text-sm font-medium",
                      theme === 'dark' ? 'text-green-300' : 'text-green-700'
                    )}>
                      Tasa Efectiva Actual
                    </h3>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? 'text-green-400/70' : 'text-green-600/70'
                    )}>
                      Esta es la tasa que usa todo el sistema
                    </p>
                  </div>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className={cn(
                    "text-4xl font-bold",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {config?.effectiveRate?.toFixed(2) || '---'}
                  </span>
                  <span className={cn(
                    "text-lg",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    CUP por USD
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <span className={cn(
                    "px-2 py-1 rounded text-xs font-medium",
                    config?.source === 'manual'
                      ? theme === 'dark' ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'
                      : theme === 'dark' ? 'bg-yellow-900/50 text-yellow-300' : 'bg-yellow-100 text-yellow-700'
                  )}>
                    {config?.source === 'manual' ? 'Tasa Manual' : config?.source === 'eltoque' ? 'ElToque' : 'Sin configurar'}
                  </span>
                  {config?.updatedAt && config?.source === 'manual' && (
                    <span className={cn(
                      "text-xs",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    )}>
                      Actualizado {getTimeSince(config.updatedAt)}
                    </span>
                  )}
                </div>
              </motion.div>

              {/* Manual Rate Input Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  "p-6 rounded-xl border",
                  theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700'
                    : 'bg-white border-gray-200'
                )}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className={cn(
                    "p-2 rounded-lg",
                    theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-100'
                  )}>
                    <DollarSign className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className={cn(
                      "font-semibold",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Configurar Tasa Manual
                    </h3>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    )}>
                      Una vez guardada, esta tasa se usa en todo el sistema
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Tasa USD/CUP
                    </label>
                    <div className="relative">
                      <span className={cn(
                        "absolute left-3 top-1/2 -translate-y-1/2 text-lg font-medium",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}>
                        $1 =
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={manualRate}
                        onChange={(e) => setManualRate(e.target.value)}
                        placeholder="385.00"
                        className={cn(
                          "w-full pl-14 pr-16 py-3 text-xl font-semibold rounded-lg border transition-colors",
                          theme === 'dark'
                            ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500 focus:border-exa-primary'
                            : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-exa-primary'
                        )}
                      />
                      <span className={cn(
                        "absolute right-3 top-1/2 -translate-y-1/2 text-lg font-medium",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}>
                        CUP
                      </span>
                    </div>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={handleSave}
                      disabled={saving || !manualRate}
                      className={cn(
                        "flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all",
                        "bg-exa-primary hover:bg-exa-primary/90 text-white",
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      {saving ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Save className="w-5 h-5" />
                      )}
                      Guardar Tasa
                    </button>
                  </div>
                </div>

                {config?.updatedBy && config?.source === 'manual' && (
                  <div className={cn(
                    "mt-4 pt-4 border-t flex items-center gap-2 text-xs",
                    theme === 'dark' ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'
                  )}>
                    <Clock className="w-4 h-4" />
                    <span>
                      Última actualización: {formatDate(config.updatedAt)} por {config.updatedBy}
                    </span>
                  </div>
                )}
              </motion.div>

              {/* ElToque Reference Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  "p-6 rounded-xl border",
                  theme === 'dark'
                    ? 'bg-gray-800/30 border-gray-700/50'
                    : 'bg-gray-50 border-gray-200'
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      theme === 'dark' ? 'bg-yellow-900/30' : 'bg-yellow-100'
                    )}>
                      <Info className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div>
                      <h3 className={cn(
                        "font-medium",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Tasa de Referencia (ElToque)
                      </h3>
                      <p className={cn(
                        "text-xs",
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                      )}>
                        Solo como referencia para comparar
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={refreshElToque}
                    disabled={refreshing}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                      theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-300'
                    )}
                  >
                    <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
                    Actualizar
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-baseline gap-2">
                    <span className={cn(
                      "text-2xl font-semibold",
                      theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
                    )}>
                      {config?.elToqueRate?.toFixed(2) || '---'}
                    </span>
                    <span className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>
                      CUP por USD
                    </span>
                  </div>

                  {config?.elToqueTimestamp && (
                    <span className={cn(
                      "text-xs",
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>
                      {getTimeSince(config.elToqueTimestamp)}
                    </span>
                  )}
                </div>

                {/* Comparison if manual rate is set */}
                {config?.manualRate && config?.elToqueRate && (
                  <div className={cn(
                    "mt-4 pt-4 border-t",
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
                        Diferencia con tu tasa:
                      </span>
                      <span className={cn(
                        "font-medium",
                        config.manualRate > config.elToqueRate
                          ? 'text-green-500'
                          : config.manualRate < config.elToqueRate
                            ? 'text-red-500'
                            : theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        {config.manualRate > config.elToqueRate ? '+' : ''}
                        {(config.manualRate - config.elToqueRate).toFixed(2)} CUP
                        ({config.manualRate > config.elToqueRate ? '+' : ''}
                        {(((config.manualRate - config.elToqueRate) / config.elToqueRate) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Info Box */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  "p-4 rounded-lg border",
                  theme === 'dark'
                    ? 'bg-blue-900/20 border-blue-800/30'
                    : 'bg-blue-50 border-blue-200'
                )}
              >
                <h4 className={cn(
                  "font-medium mb-2 flex items-center gap-2",
                  theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                )}>
                  <Info className="w-4 h-4" />
                  Cómo funciona
                </h4>
                <ul className={cn(
                  "text-sm space-y-1 list-disc list-inside",
                  theme === 'dark' ? 'text-blue-200/70' : 'text-blue-600'
                )}>
                  <li>Una vez que configuras la tasa manual, se usa en todo el sistema automáticamente</li>
                  <li>El POS, inventario y reportes mostrarán precios en CUP usando esta tasa</li>
                  <li>La tasa de ElToque se muestra solo como referencia para que compares</li>
                  <li>Recomendamos actualizar la tasa diariamente según el mercado</li>
                </ul>
              </motion.div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
