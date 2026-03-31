'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign, RefreshCw, Save, Loader2, Clock, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, Package, ArrowRight, Calendar, ArrowLeft,
  Search, Zap, Printer, Tag
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { PrintDocumentModal } from '@/components/print/PrintDocumentModal'

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
  productId: number; name: string; sku: string; category: string | null
  currentUSD: number; currentCUP: number; newUSD: number; newCUP: number
  verifyCUP: number; diffUSD: number; diffCUP: number
}

interface PreviewData {
  currentRate: number; newRate: number; totalProducts: number
  affectedCount: number; unchangedCount: number; changes: PriceChange[]
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
  const [showPrintLabels, setShowPrintLabels] = useState(false)
  const [printingLabels, setPrintingLabels] = useState(false)

  useEffect(() => { fetchConfig(); fetchHistory() }, [])

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/market/exchange-rate-config')
      const data = await res.json()
      if (data.success) { setConfig(data.data); if (data.data.effectiveRate) setNewRate(String(data.data.effectiveRate)) }
    } catch {} finally { setLoading(false) }
  }

  const fetchHistory = async () => {
    try { const res = await fetch('/api/market/exchange-rate-config/history'); const data = await res.json(); if (data.success) setHistory(data.data || []) } catch { setHistory([]) }
  }

  const handleCalculatePreview = async () => {
    const rate = parseFloat(newRate)
    if (!rate || rate <= 0) return
    setCalculating(true); setPreview(null); setApplied(false)
    try {
      const res = await fetch('/api/market/exchange-rate-config/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newRate: rate }) })
      const data = await res.json()
      if (data.success) setPreview(data.data)
    } catch {} finally { setCalculating(false) }
  }

  const handleApplyPrices = async () => {
    if (!preview) return
    setApplying(true)
    try {
      const res = await fetch('/api/market/exchange-rate-config/apply-prices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newRate: preview.newRate, changes: preview.changes }) })
      const data = await res.json()
      if (data.success) { setApplied(true); fetchConfig(); fetchHistory() }
    } catch {} finally { setApplying(false) }
  }

  const daysSinceUpdate = config?.lastPriceUpdateAt
    ? Math.floor((Date.now() - new Date(config.lastPriceUpdateAt).getTime()) / 86400000)
    : config?.updatedAt ? Math.floor((Date.now() - new Date(config.updatedAt).getTime()) / 86400000) : null

  // Live difference calculation as user types
  const rateDiff = useMemo(() => {
    const input = parseFloat(newRate)
    const current = config?.effectiveRate || 0
    if (!input || !current) return null
    const diff = input - current
    const pct = current > 0 ? (diff / current) * 100 : 0
    return { diff, pct, direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same' }
  }, [newRate, config?.effectiveRate])

  const filteredChanges = preview?.changes.filter(c =>
    c.name.toLowerCase().includes(searchFilter.toLowerCase()) || (c.sku && c.sku.toLowerCase().includes(searchFilter.toLowerCase()))
  ) || []

  const fmtUSD = (v: number) => '$' + v.toFixed(10).replace(/0+$/, '').replace(/\.$/, '')
  const fmtCUP = (v: number) => v.toLocaleString('en-US') + ' CUP'

  if (loading) return (<ProtectedRoute><DashboardLayout><div className="flex items-center justify-center h-[80vh]"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div></DashboardLayout></ProtectedRoute>)

  return (
    <ProtectedRoute><DashboardLayout>
      <div className="min-h-screen p-6">
        <div className="max-w-6xl mx-auto">

          {/* Navigation */}
          <div className="flex items-center justify-between mb-6">
            <Link href="/dashboard/market/settings">
              <motion.button whileHover={{ scale: 1.02, x: -2 }} whileTap={{ scale: 0.98 }}
                className={cn('flex items-center gap-2 px-4 py-2 rounded-xl transition-colors', isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                <ArrowLeft className="w-4 h-4" /><span className="font-medium">Volver</span>
              </motion.button>
            </Link>
          </div>

          {/* Hero Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className={cn('p-6 rounded-2xl border mb-6', isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm')}>
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
              <div className={cn('w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 bg-gradient-to-br from-orange-500 to-amber-500')}>
                <DollarSign className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                  <span className={cn('text-2xl sm:text-3xl font-bold font-mono', isDark ? 'text-white' : 'text-gray-900')}>
                    {config?.effectiveRate || '—'} CUP/USD
                  </span>
                  <span className={cn('text-xs px-3 py-1 rounded-lg font-medium',
                    config?.source === 'manual' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  )}>{config?.source === 'manual' ? 'Manual' : 'ElToque'}</span>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                  {config?.updatedAt && (
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Actualizada {new Date(config.updatedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  )}
                  {config?.updatedBy && <span>por {config.updatedBy}</span>}
                  {daysSinceUpdate !== null && (
                    <span className={cn('flex items-center gap-1 font-medium', daysSinceUpdate > 7 ? 'text-red-500' : daysSinceUpdate > 3 ? 'text-amber-500' : 'text-green-500')}>
                      <Calendar className="w-3.5 h-3.5" />
                      {daysSinceUpdate === 0 ? 'Precios actualizados hoy' : `${daysSinceUpdate} días sin actualizar precios`}
                      {daysSinceUpdate > 7 && <AlertTriangle className="w-3.5 h-3.5" />}
                    </span>
                  )}
                </div>
              </div>
              {config?.elToqueRate && (
                <div className={cn('text-right shrink-0 p-3 rounded-xl', isDark ? 'bg-gray-700/50' : 'bg-gray-50')}>
                  <p className="text-xs text-gray-500">Referencia ElToque</p>
                  <p className={cn('text-lg font-bold font-mono', isDark ? 'text-white' : 'text-gray-900')}>{config.elToqueRate}</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Rate Input Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className={cn('p-6 rounded-2xl border mb-6', isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm')}>
            <div className="flex items-center gap-3 mb-4">
              <div className={cn('p-2 rounded-xl', isDark ? 'bg-orange-900/30' : 'bg-orange-100')}>
                <TrendingUp className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <h2 className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Nueva Tasa de Cambio</h2>
                <p className="text-xs text-gray-500">Los precios en CUP se ajustarán a múltiplos de 5</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input type="number" step="any" value={newRate}
                  onChange={e => { setNewRate(e.target.value); setPreview(null); setApplied(false) }}
                  className={cn('w-full px-4 py-3.5 pr-24 rounded-xl border text-xl font-bold font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/30',
                    isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900')}
                  placeholder="Ej: 520"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">CUP/USD</span>
              </div>

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handleCalculatePreview} disabled={calculating || !newRate || parseFloat(newRate) <= 0}
                className="px-6 py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap">
                {calculating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                {calculating ? 'Calculando...' : 'Calcular Impacto'}
              </motion.button>
            </div>

            {/* Live difference animation */}
            <AnimatePresence mode="wait">
              {rateDiff && rateDiff.diff !== 0 && (
                <motion.div key={newRate} initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mt-3 flex items-center gap-2">
                  {rateDiff.direction === 'up' ? (
                    <TrendingUp className="w-4 h-4 text-red-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-green-500" />
                  )}
                  <span className={cn('text-sm font-bold font-mono', rateDiff.direction === 'up' ? 'text-red-500' : 'text-green-500')}>
                    {rateDiff.diff > 0 ? '+' : ''}{rateDiff.diff.toFixed(2)} ({rateDiff.pct > 0 ? '+' : ''}{rateDiff.pct.toFixed(1)}%)
                  </span>
                  <span className="text-xs text-gray-400">vs tasa actual</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Preview Section */}
          <AnimatePresence>
            {preview && !applied && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={cn('rounded-2xl border mb-6 overflow-hidden', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white shadow-sm')}>

                {/* Summary */}
                <div className={cn('p-6 border-b', isDark ? 'border-gray-700' : 'border-gray-200')}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn('p-2 rounded-xl', isDark ? 'bg-blue-900/30' : 'bg-blue-100')}>
                      <Package className="w-5 h-5 text-blue-500" />
                    </div>
                    <h2 className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Preview de Impacto</h2>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className={cn('p-4 rounded-xl text-center', isDark ? 'bg-orange-900/20' : 'bg-orange-50')}>
                      <p className="text-3xl font-bold text-orange-600">{preview.affectedCount}</p>
                      <p className="text-xs text-gray-500 mt-1">Productos afectados</p>
                    </div>
                    <div className={cn('p-4 rounded-xl text-center', isDark ? 'bg-gray-700' : 'bg-gray-50')}>
                      <p className={cn('text-3xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>{preview.unchangedCount}</p>
                      <p className="text-xs text-gray-500 mt-1">Sin cambios</p>
                    </div>
                    <div className={cn('p-4 rounded-xl text-center', isDark ? 'bg-blue-900/20' : 'bg-blue-50')}>
                      <p className="text-xl font-bold text-blue-600 font-mono">{preview.currentRate} → {preview.newRate}</p>
                      <p className="text-xs text-gray-500 mt-1">Cambio de tasa</p>
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="p-4">
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input value={searchFilter} onChange={e => setSearchFilter(e.target.value)} placeholder="Buscar producto..."
                      className={cn('w-full pl-10 pr-4 py-2 rounded-xl border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')} />
                  </div>

                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto rounded-xl border dark:border-gray-700">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr className={cn('text-xs uppercase tracking-wider', isDark ? 'bg-gray-900 text-gray-400' : 'bg-gray-100 text-gray-500')}>
                          <th className="text-left px-3 py-2.5">Producto</th>
                          <th className="text-right px-3 py-2.5">USD Actual</th>
                          <th className="text-right px-3 py-2.5">CUP Actual</th>
                          <th className="text-center px-2 py-2.5 w-8"></th>
                          <th className="text-right px-3 py-2.5">Nuevo USD</th>
                          <th className="text-right px-3 py-2.5">Nuevo CUP</th>
                          <th className="text-right px-3 py-2.5">Dif CUP</th>
                        </tr>
                      </thead>
                      <tbody className={cn('divide-y', isDark ? 'divide-gray-700' : 'divide-gray-100')}>
                        {filteredChanges.map((c, i) => (
                          <motion.tr key={c.productId} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                            className={cn(isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50')}>
                            <td className="px-3 py-2.5">
                              <p className={cn('font-medium truncate max-w-[200px]', isDark ? 'text-white' : 'text-gray-900')}>{c.name}</p>
                              {c.sku && <p className="text-[10px] text-gray-500 font-mono">{c.sku}</p>}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-gray-500 text-xs">{fmtUSD(c.currentUSD)}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-gray-500">{fmtCUP(c.currentCUP)}</td>
                            <td className="px-2 py-2.5 text-center"><ArrowRight className="w-3 h-3 text-gray-300 inline" /></td>
                            <td className={cn('px-3 py-2.5 text-right font-mono text-xs font-bold', isDark ? 'text-white' : 'text-gray-900')}>{fmtUSD(c.newUSD)}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-orange-600">{fmtCUP(c.newCUP)}</td>
                            <td className={cn('px-3 py-2.5 text-right font-mono text-xs font-medium', c.diffCUP > 0 ? 'text-red-500' : c.diffCUP < 0 ? 'text-green-500' : 'text-gray-400')}>
                              {c.diffCUP > 0 ? '+' : ''}{fmtCUP(c.diffCUP)}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-center">Todos los precios CUP terminan en 0 o 5 · USD ajustado para cálculo exacto</p>
                </div>

                {/* Apply Button */}
                <div className={cn('p-6 border-t', isDark ? 'border-gray-700' : 'border-gray-200')}>
                  <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    onClick={handleApplyPrices} disabled={applying}
                    className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 disabled:opacity-50 shadow-lg shadow-orange-500/20">
                    {applying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {applying ? 'Aplicando cambios...' : `Aplicar Cambios a ${preview.affectedCount} Productos`}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* Success + Print Labels */}
            {applied && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className={cn('rounded-2xl border p-8 mb-6', isDark ? 'border-green-800 bg-green-900/20' : 'border-green-200 bg-green-50')}>
                <div className="text-center">
                  <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-3" />
                  <h3 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Precios Actualizados</h3>
                  <p className="text-gray-500 mt-1">{preview?.affectedCount} productos · Tasa: {preview?.newRate} CUP/USD</p>
                  <p className="text-xs text-gray-400 mt-2">Todos los precios CUP son múltiplos de 5 · USD ajustado para exactitud</p>
                </div>

                {/* Print Labels Button */}
                <div className="mt-6 flex justify-center">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => setShowPrintLabels(true)}
                    className={cn('flex items-center gap-3 px-6 py-3.5 rounded-xl font-medium transition-colors',
                      isDark ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-200 shadow-sm')}>
                    <Tag className="w-5 h-5 text-orange-500" />
                    <div className="text-left">
                      <span className="block font-bold">Imprimir Etiquetas de Precio</span>
                      <span className="block text-xs text-gray-500">{preview?.affectedCount} productos con nuevos precios</span>
                    </div>
                    <Printer className="w-5 h-5 text-gray-400" />
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* History */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className={cn('rounded-2xl border', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white shadow-sm')}>
            <div className={cn('p-4 border-b flex items-center justify-between', isDark ? 'border-gray-700' : 'border-gray-200')}>
              <h3 className={cn('font-semibold flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}>
                <Clock className="w-4 h-4 text-gray-400" /> Historial de Cambios de Tasa
              </h3>
              <button onClick={fetchHistory} className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Actualizar
              </button>
            </div>
            {history.length === 0 ? (
              <div className="p-8 text-center">
                <Clock className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>No hay cambios de tasa registrados</p>
                <p className="text-xs text-gray-400 mt-1">Los cambios aparecerán aquí cuando apliques una nueva tasa</p>
              </div>
            ) : (
              <div className={cn('divide-y', isDark ? 'divide-gray-700' : 'divide-gray-200')}>
                {history.map((h: any, i: number) => (
                  <div key={h.id || i} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className={cn('text-sm font-medium font-mono', isDark ? 'text-white' : 'text-gray-900')}>
                        {h.previousRate || '?'} → <span className="text-orange-500">{h.exchangeRate}</span> CUP/USD
                      </p>
                      <p className="text-xs text-gray-500">{h.productsAffected} productos · {h.appliedByEmail}</p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(h.appliedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </DashboardLayout>

    {/* Print Labels Modal - uses existing product_label document type */}
    {applied && preview && (
      <PrintDocumentModal
        isOpen={showPrintLabels}
        onClose={() => setShowPrintLabels(false)}
        documentType={'product_label' as any}
        documentData={{
          batchMode: true,
          items: preview.changes.map(c => ({
            productId: c.productId,
            productName: c.name,
            name: c.name,
            sku: c.sku,
            sellingPrice: c.newUSD,
            priceUSD: c.newUSD,
            priceCUP: c.newCUP,
            price: c.newCUP,
            barcode: c.sku || '',
            copies: 1
          })),
          exchangeRate: preview.newRate,
          totalLabels: preview.affectedCount
        }}
        documentTitle={`Etiquetas de Precio (${preview.affectedCount} productos)`}
        sourceType="price_change"
        sourceId={0}
      />
    )}
    </ProtectedRoute>
  )
}
