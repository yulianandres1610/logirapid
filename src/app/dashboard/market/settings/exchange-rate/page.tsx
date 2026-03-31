'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign, RefreshCw, Save, Loader2, Clock, TrendingUp,
  AlertTriangle, CheckCircle, Package, ArrowRight, Calendar,
  Search, ArrowUpDown
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface RateConfig {
  manualRate: number | null
  elToqueRate: number
  effectiveRate: number
  source: string
  updatedAt: string | null
  updatedBy: string | null
  lastPriceUpdateAt?: string | null
}

interface PriceChange {
  productId: number
  name: string
  sku: string
  category: string | null
  currentUSD: number
  currentCUP: number
  newUSD: number
  newCUP: number
  verifyCUP: number
  diffUSD: number
  diffCUP: number
}

interface PreviewData {
  currentRate: number
  newRate: number
  totalProducts: number
  affectedCount: number
  unchangedCount: number
  changes: PriceChange[]
}

export default function ExchangeRatePage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [config, setConfig] = useState<RateConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [newRate, setNewRate] = useState('')
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    fetchConfig()
    fetchHistory()
  }, [])

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/market/exchange-rate-config')
      const data = await res.json()
      if (data.success) {
        setConfig(data.data)
        if (data.data.effectiveRate) setNewRate(String(data.data.effectiveRate))
      }
    } catch {} finally { setLoading(false) }
  }

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/market/exchange-rate-config/history')
      const data = await res.json()
      if (data.success) setHistory(data.data || [])
    } catch { setHistory([]) }
  }

  const handleCalculatePreview = async () => {
    const rate = parseFloat(newRate)
    if (!rate || rate <= 0) return
    setCalculating(true)
    setPreview(null)
    setApplied(false)
    try {
      const res = await fetch('/api/market/exchange-rate-config/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newRate: rate })
      })
      const data = await res.json()
      if (data.success) setPreview(data.data)
    } catch {} finally { setCalculating(false) }
  }

  const handleApplyPrices = async () => {
    if (!preview) return
    setApplying(true)
    try {
      const res = await fetch('/api/market/exchange-rate-config/apply-prices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newRate: preview.newRate, changes: preview.changes })
      })
      const data = await res.json()
      if (data.success) {
        setApplied(true)
        fetchConfig()
        fetchHistory()
      }
    } catch {} finally { setApplying(false) }
  }

  const daysSinceUpdate = config?.lastPriceUpdateAt
    ? Math.floor((Date.now() - new Date(config.lastPriceUpdateAt).getTime()) / 86400000)
    : config?.updatedAt
      ? Math.floor((Date.now() - new Date(config.updatedAt).getTime()) / 86400000)
      : null

  const filteredChanges = preview?.changes.filter(c =>
    c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (c.sku && c.sku.toLowerCase().includes(searchFilter.toLowerCase()))
  ) || []

  // Format USD: show enough decimals to be exact, strip trailing zeros
  const fmtUSD = (v: number) => '$' + v.toFixed(6).replace(/\.?0+$/, '')
  const fmt = (v: number, dec = 2) => '$' + v.toFixed(dec)
  const fmtCUP = (v: number) => v.toLocaleString('en-US') + ' CUP'

  if (loading) return (
    <ProtectedRoute><DashboardLayout>
      <div className="flex items-center justify-center h-[80vh]"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
    </DashboardLayout></ProtectedRoute>
  )

  return (
    <ProtectedRoute><DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Tasa de Cambio</h1>
          <p className="text-sm text-gray-500">Gestión inteligente de precios por tasa de cambio</p>
        </div>

        {/* Section 1: Current Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Current Rate */}
          <div className={cn('p-5 rounded-2xl border', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-orange-500" />
              <span className="text-sm text-gray-500">Tasa Actual</span>
            </div>
            <p className={cn('text-3xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
              {config?.effectiveRate || '—'}
            </p>
            <span className={cn('text-xs px-2 py-0.5 rounded-full mt-1 inline-block',
              config?.source === 'manual' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            )}>{config?.source === 'manual' ? 'Manual' : 'ElToque'}</span>
          </div>

          {/* Last Update */}
          <div className={cn('p-5 rounded-2xl border', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-gray-500">Última Actualización</span>
            </div>
            <p className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
              {config?.updatedAt ? new Date(config.updatedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Nunca'}
            </p>
            {config?.updatedBy && <p className="text-xs text-gray-500">por {config.updatedBy}</p>}
          </div>

          {/* Days Since Update */}
          <div className={cn('p-5 rounded-2xl border', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-amber-500" />
              <span className="text-sm text-gray-500">Días sin Actualizar Precios</span>
            </div>
            <p className={cn('text-3xl font-bold', daysSinceUpdate !== null && daysSinceUpdate > 7 ? 'text-red-500' : daysSinceUpdate !== null && daysSinceUpdate > 3 ? 'text-amber-500' : isDark ? 'text-white' : 'text-gray-900')}>
              {daysSinceUpdate !== null ? daysSinceUpdate : '—'}
            </p>
            {daysSinceUpdate !== null && daysSinceUpdate > 7 && (
              <span className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertTriangle className="w-3 h-3" /> Revisar precios</span>
            )}
          </div>
        </div>

        {/* Section 2: Change Rate */}
        <div className={cn('rounded-2xl border p-6 mb-6', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
          <h2 className={cn('font-bold text-lg mb-4 flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}>
            <TrendingUp className="w-5 h-5 text-orange-500" /> Cambiar Tasa y Recalcular Precios
          </h2>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-sm text-gray-500 mb-1 block">Nueva tasa CUP/USD</label>
              <input
                type="number" step="any" value={newRate}
                onChange={e => { setNewRate(e.target.value); setPreview(null); setApplied(false) }}
                className={cn('w-full px-4 py-3 rounded-xl border text-lg font-bold focus:outline-none focus:ring-2 focus:ring-orange-500/30',
                  isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900')}
              />
            </div>
            <div className="flex items-end">
              <button onClick={handleCalculatePreview} disabled={calculating || !newRate || parseFloat(newRate) <= 0}
                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-medium disabled:opacity-50 flex items-center gap-2">
                {calculating ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowUpDown className="w-5 h-5" />}
                {calculating ? 'Calculando...' : 'Calcular Impacto'}
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Los precios en CUP se ajustarán a múltiplos de 5 para ser comercializables</p>
        </div>

        {/* Section 3: Preview */}
        <AnimatePresence>
          {preview && !applied && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={cn('rounded-2xl border mb-6', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>

              {/* Summary */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className={cn('font-bold text-lg mb-3 flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}>
                  <Package className="w-5 h-5 text-blue-500" /> Preview de Impacto
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  <div className={cn('p-3 rounded-xl text-center', isDark ? 'bg-orange-900/20' : 'bg-orange-50')}>
                    <p className="text-2xl font-bold text-orange-600">{preview.affectedCount}</p>
                    <p className="text-xs text-gray-500">Productos afectados</p>
                  </div>
                  <div className={cn('p-3 rounded-xl text-center', isDark ? 'bg-gray-700' : 'bg-gray-50')}>
                    <p className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>{preview.unchangedCount}</p>
                    <p className="text-xs text-gray-500">Sin cambios</p>
                  </div>
                  <div className={cn('p-3 rounded-xl text-center', isDark ? 'bg-blue-900/20' : 'bg-blue-50')}>
                    <p className="text-2xl font-bold text-blue-600">{preview.currentRate} → {preview.newRate}</p>
                    <p className="text-xs text-gray-500">Tasa</p>
                  </div>
                </div>
              </div>

              {/* Search + Table */}
              <div className="p-4">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input value={searchFilter} onChange={e => setSearchFilter(e.target.value)} placeholder="Buscar producto..."
                    className={cn('w-full pl-10 pr-4 py-2 rounded-xl border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')} />
                </div>

                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0">
                      <tr className={cn('text-xs uppercase', isDark ? 'bg-gray-900 text-gray-400' : 'bg-gray-100 text-gray-500')}>
                        <th className="text-left px-3 py-2">Producto</th>
                        <th className="text-right px-3 py-2">USD Actual</th>
                        <th className="text-right px-3 py-2">CUP Actual</th>
                        <th className="text-center px-3 py-2"><ArrowRight className="w-3 h-3 inline" /></th>
                        <th className="text-right px-3 py-2">Nuevo USD</th>
                        <th className="text-right px-3 py-2">Nuevo CUP</th>
                        <th className="text-right px-3 py-2">Dif</th>
                      </tr>
                    </thead>
                    <tbody className={cn('divide-y', isDark ? 'divide-gray-700' : 'divide-gray-200')}>
                      {filteredChanges.map(c => (
                        <tr key={c.productId} className={cn(isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50')}>
                          <td className="px-3 py-2">
                            <p className={cn('font-medium truncate max-w-[200px]', isDark ? 'text-white' : 'text-gray-900')}>{c.name}</p>
                            <p className="text-xs text-gray-500">{c.sku}</p>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-gray-500">{fmtUSD(c.currentUSD)}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-500">{fmtCUP(c.currentCUP)}</td>
                          <td className="px-3 py-2 text-center"><ArrowRight className="w-3 h-3 text-gray-300 inline" /></td>
                          <td className={cn('px-3 py-2 text-right font-mono font-bold', isDark ? 'text-white' : 'text-gray-900')}>{fmtUSD(c.newUSD)}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-orange-600">{fmtCUP(c.newCUP)}</td>
                          <td className={cn('px-3 py-2 text-right font-mono text-xs', c.diffCUP > 0 ? 'text-red-500' : c.diffCUP < 0 ? 'text-green-500' : 'text-gray-400')}>
                            {c.diffCUP > 0 ? '+' : ''}{fmtCUP(c.diffCUP)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Apply Button */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                <button onClick={handleApplyPrices} disabled={applying}
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 disabled:opacity-50">
                  {applying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {applying ? 'Aplicando cambios...' : `Aplicar Cambios a ${preview.affectedCount} Productos`}
                </button>
                <p className="text-xs text-gray-400 text-center mt-2">Esto actualizará los precios de venta USD de todos los productos afectados</p>
              </div>
            </motion.div>
          )}

          {/* Applied success */}
          {applied && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className={cn('rounded-2xl border p-8 mb-6 text-center', isDark ? 'border-green-800 bg-green-900/20' : 'border-green-200 bg-green-50')}>
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Precios Actualizados</h3>
              <p className="text-gray-500 mt-1">{preview?.affectedCount} productos actualizados con tasa {preview?.newRate} CUP/USD</p>
              <p className="text-xs text-gray-400 mt-2">Todos los precios CUP son múltiplos de 5</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Section 4: ElToque Reference */}
        {config?.elToqueRate && (
          <div className={cn('rounded-2xl border p-5 mb-6', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50')}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Tasa de Referencia ElToque</p>
                <p className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>{config.elToqueRate} CUP/USD</p>
              </div>
              <button onClick={fetchConfig} className={cn('p-2 rounded-xl', isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200')}>
                <RefreshCw className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        )}

        {/* Section 5: History */}
        {history.length > 0 && (
          <div className={cn('rounded-2xl border', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className={cn('font-bold flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}>
                <Clock className="w-4 h-4 text-gray-400" /> Historial de Cambios
              </h3>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {history.map((h: any, i: number) => (
                <div key={h.id || i} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                      {h.previousRate} → {h.exchangeRate} CUP/USD
                    </p>
                    <p className="text-xs text-gray-500">{h.productsAffected} productos · por {h.appliedByEmail}</p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(h.appliedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout></ProtectedRoute>
  )
}
