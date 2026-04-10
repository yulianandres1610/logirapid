'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lightbulb, Loader2, Check, X, Tag, TrendingUp, Package, Filter, RefreshCw } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Suggestion {
  id: number
  title: string
  type: string
  description: string
  products: string[]
  marketData: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

interface SuggestionsResponse {
  suggestions: Suggestion[]
  total: number
}

const TYPE_ICONS: Record<string, typeof Tag> = {
  pricing: Tag,
  trend: TrendingUp,
  product: Package,
}

const STATUS_STYLES: Record<string, { bg: string; darkBg: string; text: string; label: string }> = {
  pending: { bg: 'bg-amber-100', darkBg: 'bg-amber-900/30', text: 'text-amber-600', label: 'Pendiente' },
  approved: { bg: 'bg-emerald-100', darkBg: 'bg-emerald-900/30', text: 'text-emerald-600', label: 'Aprobada' },
  rejected: { bg: 'bg-red-100', darkBg: 'bg-red-900/30', text: 'text-red-600', label: 'Rechazada' },
}

export default function SuggestionsPage() {
  const { theme } = useTheme()
  const [data, setData] = useState<SuggestionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter !== 'all') params.set('status', filter)
    fetch(`/api/marketing-intel/suggestions?${params}`)
      .then(r => r.json())
      .then(res => { if (res.success) setData(res.data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAction = async (id: number, status: 'approved' | 'rejected') => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/marketing-intel/suggestions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json()
      if (json.success && data) {
        setData({
          ...data,
          suggestions: data.suggestions.map(s => s.id === id ? { ...s, status } : s),
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setActionLoading(null)
    }
  }

  const filtered = data?.suggestions || []

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 sm:p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                <Lightbulb className="w-6 h-6 inline mr-2" />Sugerencias de Marketing
              </h1>
              <p className="text-gray-500 text-sm mt-1">Sugerencias basadas en datos de mercado y competencia</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 p-1 rounded-lg border"
                style={{ borderColor: theme === 'dark' ? '#374151' : '#e5e7eb', backgroundColor: theme === 'dark' ? '#1f2937' : '#f9fafb' }}>
                {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                      filter === f
                        ? 'bg-orange-500 text-white shadow-sm'
                        : theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900')}>
                    {f === 'all' ? 'Todas' : STATUS_STYLES[f].label}
                  </button>
                ))}
              </div>
              <button onClick={fetchData}
                className={cn('p-2 rounded-lg border', theme === 'dark' ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-100')}>
                <RefreshCw className={cn('w-4 h-4', loading ? 'animate-spin' : '', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')} />
              </button>
            </div>
          </div>

          {/* Cards */}
          {loading ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className={cn('text-center py-16 rounded-xl border',
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
              <Lightbulb className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-400">Sin sugerencias disponibles</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {filtered.map((s, i) => {
                  const TypeIcon = TYPE_ICONS[s.type] || Lightbulb
                  const statusStyle = STATUS_STYLES[s.status] || STATUS_STYLES.pending
                  return (
                    <motion.div key={s.id}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.05 }}
                      className={cn('p-5 rounded-xl border flex flex-col gap-4',
                        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                      {/* Top row: type badge + status */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                            theme === 'dark' ? 'bg-orange-900/30' : 'bg-orange-100')}>
                            <TypeIcon className="w-4 h-4 text-orange-500" />
                          </div>
                          <h3 className={cn('font-semibold truncate', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {s.title}
                          </h3>
                        </div>
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold shrink-0',
                          theme === 'dark' ? statusStyle.darkBg : statusStyle.bg, statusStyle.text)}>
                          {statusStyle.label}
                        </span>
                      </div>

                      {/* Description */}
                      <p className={cn('text-sm leading-relaxed', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                        {s.description}
                      </p>

                      {/* Products */}
                      {s.products && s.products.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {s.products.map((p, pi) => (
                            <span key={pi} className={cn('px-2 py-0.5 rounded text-xs',
                              theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600')}>
                              {p}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Market data */}
                      {s.marketData && (
                        <div className={cn('text-xs px-3 py-2 rounded-lg',
                          theme === 'dark' ? 'bg-gray-900/50 text-gray-400' : 'bg-gray-50 text-gray-500')}>
                          <TrendingUp className="w-3 h-3 inline mr-1" />{s.marketData}
                        </div>
                      )}

                      {/* Actions */}
                      {s.status === 'pending' && (
                        <div className="flex items-center gap-2 pt-1">
                          <button onClick={() => handleAction(s.id, 'approved')}
                            disabled={actionLoading === s.id}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50">
                            {actionLoading === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Aprobar
                          </button>
                          <button onClick={() => handleAction(s.id, 'rejected')}
                            disabled={actionLoading === s.id}
                            className={cn('flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50',
                              theme === 'dark'
                                ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                                : 'border-gray-300 text-gray-600 hover:bg-gray-100')}>
                            <X className="w-4 h-4" />Rechazar
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
