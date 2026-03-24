'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Cog, Loader2, X, Check, Weight } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Mixer {
  id: number; name: string; capacityMinKg: number; capacityMaxKg: number
  mixerType: string; isAvailable: boolean; notes: string | null
}

export default function PaintMixersPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [mixers, setMixers] = useState<Mixer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', capacityMinKg: '', capacityMaxKg: '', mixerType: 'large', notes: '' })

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/market/production/paint/mixers')
      const data = await res.json()
      if (data.success) setMixers(data.data)
    } catch { /* ignore */ }
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!form.name || !form.capacityMinKg || !form.capacityMaxKg) return
    setSaving(true)
    try {
      const res = await fetch('/api/market/production/paint/mixers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          capacityMinKg: parseFloat(form.capacityMinKg),
          capacityMaxKg: parseFloat(form.capacityMaxKg),
          mixerType: form.mixerType,
          notes: form.notes || null
        })
      })
      const data = await res.json()
      if (data.success) {
        setShowForm(false)
        setForm({ name: '', capacityMinKg: '', capacityMaxKg: '', mixerType: 'large', notes: '' })
        fetchData()
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  const typeLabel = (t: string) => t === 'small' ? 'Pequeña' : t === 'large' ? 'Grande' : t
  const typeColor = (t: string) => t === 'small'
    ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
    : isDark ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-100 text-blue-700'

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Mezcladoras (Torbas)</h1>
              <p className="text-sm text-gray-500">Equipos de mezclado con capacidades en kg</p>
            </div>
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium text-sm">
              <Plus className="w-4 h-4" /> Nueva Mezcladora
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
          ) : mixers.length === 0 ? (
            <div className={cn('text-center py-20 rounded-2xl border', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50')}>
              <Cog className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 font-medium">No hay mezcladoras registradas</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {mixers.map(m => (
                <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className={cn('p-5 rounded-xl border', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn('p-2.5 rounded-xl', isDark ? 'bg-purple-900/30' : 'bg-purple-100')}>
                        <Cog className={cn('w-5 h-5', isDark ? 'text-purple-400' : 'text-purple-600')} />
                      </div>
                      <h3 className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>{m.name}</h3>
                    </div>
                    <span className={cn('text-xs px-2 py-1 rounded-full font-medium', typeColor(m.mixerType))}>
                      {typeLabel(m.mixerType)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Weight className="w-4 h-4" />
                    <span><strong>{m.capacityMinKg}</strong> — <strong>{m.capacityMaxKg}</strong> kg</span>
                  </div>
                  <div className={cn('mt-3 h-2 rounded-full overflow-hidden', isDark ? 'bg-gray-700' : 'bg-gray-200')}>
                    <div className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full" style={{ width: '70%' }} />
                  </div>
                  {m.notes && <p className="text-xs text-gray-400 mt-2">{m.notes}</p>}
                  <div className="mt-2">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', m.isAvailable
                      ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                      : isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
                    )}>
                      {m.isAvailable ? 'Disponible' : 'En uso'}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Create Modal */}
          <AnimatePresence>
            {showForm && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)}>
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  onClick={e => e.stopPropagation()}
                  className={cn('w-full max-w-md rounded-2xl shadow-2xl p-6', isDark ? 'bg-gray-800' : 'bg-white')}>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>Nueva Mezcladora</h2>
                    <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Nombre *</label>
                      <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Torba Grande A"
                        className={cn('w-full px-3 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Cap. mínima (kg) *</label>
                        <input type="number" step="any" value={form.capacityMinKg} onChange={e => setForm({ ...form, capacityMinKg: e.target.value })}
                          className={cn('w-full px-3 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')} />
                      </div>
                      <div>
                        <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Cap. máxima (kg) *</label>
                        <input type="number" step="any" value={form.capacityMaxKg} onChange={e => setForm({ ...form, capacityMaxKg: e.target.value })}
                          className={cn('w-full px-3 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')} />
                      </div>
                    </div>
                    <div>
                      <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Tipo</label>
                      <select value={form.mixerType} onChange={e => setForm({ ...form, mixerType: e.target.value })}
                        className={cn('w-full px-3 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')}>
                        <option value="small">Pequeña (80-200 kg)</option>
                        <option value="large">Grande (600-1200 kg)</option>
                      </select>
                    </div>
                    <div>
                      <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Notas</label>
                      <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Ubicación, observaciones..."
                        className={cn('w-full px-3 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')} />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button onClick={() => setShowForm(false)} className={cn('px-4 py-2.5 rounded-xl font-medium text-sm', isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700')}>Cancelar</button>
                    <button onClick={handleCreate} disabled={saving || !form.name || !form.capacityMinKg || !form.capacityMaxKg}
                      className="flex-1 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      {saving ? 'Guardando...' : 'Crear Mezcladora'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
