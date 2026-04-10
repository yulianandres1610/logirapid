'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Tag, Loader2, ArrowUp, ArrowDown, Minus, ChevronLeft, ChevronRight, Search, RefreshCw } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface PriceEntry {
  id: number
  productName: string
  competitorName: string
  competitorPrice: number
  ourPrice: number
  difference: number
  percentDifference: number
  capturedAt: string
}

interface PricesResponse {
  prices: PriceEntry[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function CompetitorPricesPage() {
  const { theme } = useTheme()
  const [data, setData] = useState<PricesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const limit = 20

  const fetchData = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search) params.set('search', search)
    fetch(`/api/marketing-intel/competitor-prices?${params}`)
      .then(r => r.json())
      .then(res => { if (res.success) setData(res.data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, search])

  useEffect(() => { fetchData() }, [fetchData])

  const formatCurrency = (n: number) => `$${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const getDiffColor = (pct: number) => {
    if (pct < -5) return 'text-emerald-500' // we're cheaper
    if (pct > 5) return 'text-red-500'       // we're more expensive
    return 'text-amber-500'                   // similar
  }

  const getDiffBg = (pct: number) => {
    if (pct < -5) return theme === 'dark' ? 'bg-emerald-900/20' : 'bg-emerald-50'
    if (pct > 5) return theme === 'dark' ? 'bg-red-900/20' : 'bg-red-50'
    return theme === 'dark' ? 'bg-amber-900/20' : 'bg-amber-50'
  }

  const getDiffIcon = (pct: number) => {
    if (pct < -5) return ArrowDown
    if (pct > 5) return ArrowUp
    return Minus
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 sm:p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                <Tag className="w-6 h-6 inline mr-2" />Precios de Competencia
              </h1>
              <p className="text-gray-500 text-sm mt-1">Comparativa de precios con competidores</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  className={cn('pl-9 pr-3 py-2 text-sm rounded-lg border outline-none',
                    theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900')}
                />
              </div>
              <button onClick={fetchData}
                className={cn('p-2 rounded-lg border', theme === 'dark' ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-100')}>
                <RefreshCw className={cn('w-4 h-4', loading ? 'animate-spin' : '', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')} />
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs">
            {[
              { label: 'Somos más baratos', color: 'emerald' },
              { label: 'Precio similar (±5%)', color: 'amber' },
              { label: 'Somos más caros', color: 'red' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-full bg-${l.color}-500`} />
                <span className="text-gray-500">{l.label}</span>
              </div>
            ))}
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={cn('rounded-xl border overflow-hidden', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={cn(theme === 'dark' ? 'bg-gray-800/80' : 'bg-gray-50')}>
                      {['Producto', 'Competidor', 'Precio Competencia', 'Nuestro Precio', 'Diferencia', '% Diferencia'].map(h => (
                        <th key={h} className={cn('px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data?.prices && data.prices.length > 0 ? data.prices.map((row, i) => {
                      const Icon = getDiffIcon(row.percentDifference)
                      return (
                        <motion.tr key={row.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.02 }}
                          className={cn('border-t', getDiffBg(row.percentDifference),
                            theme === 'dark' ? 'border-gray-700' : 'border-gray-100')}>
                          <td className={cn('px-4 py-3 font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {row.productName}
                          </td>
                          <td className={cn('px-4 py-3', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                            {row.competitorName}
                          </td>
                          <td className={cn('px-4 py-3 font-mono', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                            {formatCurrency(row.competitorPrice)}
                          </td>
                          <td className={cn('px-4 py-3 font-mono font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {formatCurrency(row.ourPrice)}
                          </td>
                          <td className={cn('px-4 py-3 font-mono', getDiffColor(row.percentDifference))}>
                            {row.difference >= 0 ? '+' : ''}{formatCurrency(row.difference)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
                              getDiffColor(row.percentDifference))}>
                              <Icon className="w-3 h-3" />
                              {row.percentDifference >= 0 ? '+' : ''}{row.percentDifference.toFixed(1)}%
                            </span>
                          </td>
                        </motion.tr>
                      )
                    }) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                          Sin datos de precios disponibles
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data && data.totalPages > 1 && (
                <div className={cn('flex items-center justify-between px-4 py-3 border-t',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                  <p className="text-xs text-gray-500">
                    Mostrando {((page - 1) * limit) + 1}-{Math.min(page * limit, data.total)} de {data.total}
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className={cn('p-1.5 rounded-lg disabled:opacity-30',
                        theme === 'dark' ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-600')}>
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className={cn('text-sm px-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      {page} / {data.totalPages}
                    </span>
                    <button onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}
                      className={cn('p-1.5 rounded-lg disabled:opacity-30',
                        theme === 'dark' ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-600')}>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
