'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Loader2, Plus, X, Calendar, Percent, Tag, Clock, CheckCircle, PauseCircle, XCircle, AlertCircle } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Campaign {
  id: number
  name: string
  description: string
  type: string
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'
  discountType: 'percentage' | 'fixed'
  discountValue: number
  startDate: string
  endDate: string
  productsCount: number
  createdAt: string
}

interface CampaignsResponse {
  campaigns: Campaign[]
  total: number
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; bg: string; darkBg: string; label: string }> = {
  draft: { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100', darkBg: 'bg-gray-700', label: 'Borrador' },
  active: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-100', darkBg: 'bg-emerald-900/30', label: 'Activa' },
  paused: { icon: PauseCircle, color: 'text-amber-500', bg: 'bg-amber-100', darkBg: 'bg-amber-900/30', label: 'Pausada' },
  completed: { icon: CheckCircle, color: 'text-blue-500', bg: 'bg-blue-100', darkBg: 'bg-blue-900/30', label: 'Completada' },
  cancelled: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100', darkBg: 'bg-red-900/30', label: 'Cancelada' },
}

const TYPE_LABELS: Record<string, string> = {
  discount: 'Descuento',
  bundle: 'Bundle',
  flash_sale: 'Flash Sale',
  seasonal: 'Temporal',
  loyalty: 'Fidelidad',
}

export default function CampaignsPage() {
  const { theme } = useTheme()
  const [data, setData] = useState<CampaignsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'discount',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: '',
    startDate: '',
    endDate: '',
  })

  const fetchData = useCallback(() => {
    setLoading(true)
    fetch('/api/marketing-intel/campaigns')
      .then(r => r.json())
      .then(res => { if (res.success) setData(res.data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleCreate = async () => {
    if (!form.name || !form.startDate || !form.endDate) return
    setCreating(true)
    try {
      const res = await fetch('/api/marketing-intel/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          discountValue: parseFloat(form.discountValue) || 0,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setShowModal(false)
        setForm({ name: '', description: '', type: 'discount', discountType: 'percentage', discountValue: '', startDate: '', endDate: '' })
        fetchData()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })

  const inputClass = cn('w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-orange-500/50',
    theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900')

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 sm:p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                <Zap className="w-6 h-6 inline mr-2" />Campanas
              </h1>
              <p className="text-gray-500 text-sm mt-1">Gestiona descuentos, promociones y campanas de marketing</p>
            </div>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" />Nueva Campana
            </button>
          </div>

          {/* Campaign Cards */}
          {loading ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : !data?.campaigns?.length ? (
            <div className={cn('text-center py-16 rounded-xl border',
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
              <Zap className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-400">Sin campanas creadas</p>
              <button onClick={() => setShowModal(true)}
                className="mt-3 text-orange-500 hover:text-orange-400 text-sm font-medium">
                Crear primera campana
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.campaigns.map((c, i) => {
                const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.draft
                const StatusIcon = sc.icon
                return (
                  <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={cn('p-5 rounded-xl border flex flex-col gap-3',
                      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                    {/* Status + Type */}
                    <div className="flex items-center justify-between">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1',
                        theme === 'dark' ? sc.darkBg : sc.bg, sc.color)}>
                        <StatusIcon className="w-3 h-3" />{sc.label}
                      </span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium',
                        theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600')}>
                        {TYPE_LABELS[c.type] || c.type}
                      </span>
                    </div>

                    {/* Name + Description */}
                    <div>
                      <h3 className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {c.name}
                      </h3>
                      {c.description && (
                        <p className={cn('text-sm mt-1 line-clamp-2', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          {c.description}
                        </p>
                      )}
                    </div>

                    {/* Discount */}
                    <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg',
                      theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50')}>
                      {c.discountType === 'percentage' ? (
                        <Percent className="w-4 h-4 text-orange-500" />
                      ) : (
                        <Tag className="w-4 h-4 text-orange-500" />
                      )}
                      <span className={cn('text-sm font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {c.discountType === 'percentage' ? `${c.discountValue}% descuento` : `$${c.discountValue} descuento`}
                      </span>
                    </div>

                    {/* Dates */}
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDate(c.startDate)} - {formatDate(c.endDate)}</span>
                    </div>

                    {/* Products count */}
                    {c.productsCount > 0 && (
                      <p className="text-xs text-gray-500">
                        {c.productsCount} producto{c.productsCount !== 1 ? 's' : ''} incluido{c.productsCount !== 1 ? 's' : ''}
                      </p>
                    )}
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* Create Campaign Modal */}
        <AnimatePresence>
          {showModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
              onClick={() => setShowModal(false)}>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                onClick={e => e.stopPropagation()}
                className={cn('w-full max-w-lg rounded-2xl p-6 shadow-xl',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white')}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    Nueva Campana
                  </h2>
                  <button onClick={() => setShowModal(false)}
                    className={cn('p-1 rounded-lg', theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100')}>
                    <X className={cn('w-5 h-5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Nombre *
                    </label>
                    <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Ej: Black Friday 2026" className={inputClass} />
                  </div>

                  <div>
                    <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Descripcion
                    </label>
                    <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      rows={2} placeholder="Descripcion de la campana..." className={inputClass} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        Tipo
                      </label>
                      <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                        className={inputClass}>
                        <option value="discount">Descuento</option>
                        <option value="bundle">Bundle</option>
                        <option value="flash_sale">Flash Sale</option>
                        <option value="seasonal">Temporal</option>
                        <option value="loyalty">Fidelidad</option>
                      </select>
                    </div>
                    <div>
                      <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        Tipo de Descuento
                      </label>
                      <select value={form.discountType}
                        onChange={e => setForm(f => ({ ...f, discountType: e.target.value as 'percentage' | 'fixed' }))}
                        className={inputClass}>
                        <option value="percentage">Porcentaje (%)</option>
                        <option value="fixed">Monto Fijo ($)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Valor de Descuento
                    </label>
                    <input type="number" value={form.discountValue}
                      onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))}
                      placeholder={form.discountType === 'percentage' ? 'Ej: 15' : 'Ej: 5.00'}
                      className={inputClass} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        Fecha Inicio *
                      </label>
                      <input type="date" value={form.startDate}
                        onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                        className={inputClass} />
                    </div>
                    <div>
                      <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        Fecha Fin *
                      </label>
                      <input type="date" value={form.endDate}
                        onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                        className={inputClass} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 mt-6">
                  <button onClick={() => setShowModal(false)}
                    className={cn('px-4 py-2 rounded-lg text-sm font-medium border',
                      theme === 'dark' ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-100')}>
                    Cancelar
                  </button>
                  <button onClick={handleCreate} disabled={creating || !form.name || !form.startDate || !form.endDate}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Crear Campana
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
