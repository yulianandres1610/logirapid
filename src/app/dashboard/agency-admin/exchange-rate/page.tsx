'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle,
  TrendingUp
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { usePublishedRates } from '@/hooks/usePublishedRates'

export default function ExchangeRatePage() {
  const { theme } = useTheme()
  const { rates, loading, error, lastRefresh, refreshRates } = usePublishedRates()

  const currencyFlags: Record<string, string> = {
    USD: '🇺🇸',
    EUR: '🇪🇺',
    MLC: '💳',
    GBP: '🇬🇧',
    CAD: '🇨🇦',
    MXN: '🇲🇽',
    BRL: '🇧🇷',
    ZELLE: '💸',
    CLA: '📱'
  }

  const currencyNames: Record<string, string> = {
    USD: 'Dólar Americano',
    EUR: 'Euro',
    MLC: 'Tarjeta de Débito',
    GBP: 'Libra Esterlina',
    CAD: 'Dólar Canadiense',
    MXN: 'Peso Mexicano',
    BRL: 'Real Brasileño',
    ZELLE: 'Zelle',
    CLA: 'CashApp'
  }

  if (loading && rates.length === 0) {
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
                Tasas de Cambio
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
                {loading ? 'Actualizando...' : 'Actualizar Tasas'}
              </button>
            </div>
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

            {/* Alerta informativa */}
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
                <span className="font-medium">Tasas actualizadas en tiempo real</span>
                <p className="text-xs mt-1 opacity-80">
                  Estas tasas se aplican automáticamente en sus operaciones de remesas y servicios.
                </p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Grid de Tasas - 9 monedas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rates.map((rateData, index) => (
              <motion.div
                key={rateData.currency}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "rounded-xl p-6 border relative overflow-hidden transition-all duration-300 hover:shadow-lg",
                  theme === 'dark'
                    ? "bg-gray-800 border-gray-700"
                    : "bg-white border-gray-200"
                )}
              >
                {/* Background gradient sutil */}
                <div className="absolute inset-0 opacity-5 bg-gradient-to-br from-exa-primary to-exa-secondary" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-12 h-12 rounded-lg flex items-center justify-center text-2xl",
                        theme === 'dark' ? "bg-gray-700" : "bg-gray-100"
                      )}>
                        {currencyFlags[rateData.currency] || '💱'}
                      </div>
                      <div>
                        <h3 className={cn(
                          "font-semibold text-lg",
                          theme === 'dark' ? "text-white" : "text-gray-900"
                        )}>
                          {rateData.currency} / CUP
                        </h3>
                        <p className={cn(
                          "text-xs",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          {currencyNames[rateData.currency] || rateData.currency}
                        </p>
                      </div>
                    </div>

                    <CheckCircle className="w-5 h-5 text-green-500" />
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
                        theme === 'dark' ? "text-white" : "text-gray-900"
                      )}>
                        ${rateData.rate.toFixed(2)}
                      </span>
                    </div>

                    <div className={cn(
                      "text-xs pt-2 border-t",
                      theme === 'dark' ? "border-gray-700 text-gray-500" : "border-gray-200 text-gray-500"
                    )}>
                      1 {rateData.currency} = {rateData.rate.toFixed(2)} CUP
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Mensaje si no hay tasas */}
          {rates.length === 0 && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                "text-center py-12 rounded-xl border",
                theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"
              )}
            >
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className={cn(
                "text-lg font-medium",
                theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>
                No hay tasas disponibles
              </p>
              <p className={cn(
                "text-sm mt-2",
                theme === 'dark' ? "text-gray-500" : "text-gray-600"
              )}>
                Contacte al administrador para configurar las tasas de cambio
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
