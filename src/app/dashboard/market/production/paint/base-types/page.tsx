'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Beaker, Loader2, X, Check, FlaskConical, Package } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface BaseType {
  id: number
  code: string
  name: string
  description: string | null
  formulaId: number | null
  formulaName: string | null
  formulaCode: string | null
  targetProductName: string | null
  yieldKg: number
  isActive: boolean
}

interface Formula {
  id: number
  code: string
  name: string
  targetProductName: string | null
}

export default function PaintBaseTypesPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [baseTypes, setBaseTypes] = useState<BaseType[]>([])
  const [formulas, setFormulas] = useState<Formula[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', description: '', formulaId: '', yieldKg: '1' })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [btRes, fRes] = await Promise.all([
        fetch('/api/market/production/paint/base-types'),
        fetch('/api/market/production/formulas?limit=100&isActive=true')
      ])
      const btData = await btRes.json()
      const fData = await fRes.json()
      if (btData.success) setBaseTypes(btData.data)
      if (fData.success) setFormulas((fData.data?.formulas || fData.data || []).map((f: any) => ({
        id: f.id, code: f.code, name: f.name, targetProductName: f.targetProductName || f.target_product_name || null
      })))
    } catch { /* ignore */ }
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!form.code || !form.name) return
    setSaving(true)
    try {
      const res = await fetch('/api/market/production/paint/base-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code,
          name: form.name,
          description: form.description || null,
          formulaId: form.formulaId ? parseInt(form.formulaId) : null,
          yieldKg: parseFloat(form.yieldKg) || 1
        })
      })
      const data = await res.json()
      if (data.success) {
        setShowForm(false)
        setForm({ code: '', name: '', description: '', formulaId: '', yieldKg: '1' })
        fetchData()
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Tipos de Base</h1>
              <p className="text-sm text-gray-500">Base clara, oscura y otras bases para fabricación de pintura</p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm"
            >
              <Plus className="w-4 h-4" /> Nuevo Tipo de Base
            </button>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : baseTypes.length === 0 ? (
            <div className={cn('text-center py-20 rounded-2xl border', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50')}>
              <Beaker className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 font-medium">No hay tipos de base registrados</p>
              <p className="text-sm text-gray-400 mt-1">Crea el primer tipo de base para empezar</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {baseTypes.map(bt => (
                <motion.div
                  key={bt.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn('p-5 rounded-xl border', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn('p-2.5 rounded-xl', isDark ? 'bg-amber-900/30' : 'bg-amber-100')}>
                        <FlaskConical className={cn('w-5 h-5', isDark ? 'text-amber-400' : 'text-amber-600')} />
                      </div>
                      <div>
                        <h3 className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>{bt.name}</h3>
                        <p className="text-xs text-gray-500">{bt.code}</p>
                      </div>
                    </div>
                    <span className={cn(
                      'text-xs px-2 py-1 rounded-full font-medium',
                      bt.isActive
                        ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                        : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                    )}>
                      {bt.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>

                  {bt.description && (
                    <p className="text-sm text-gray-500 mt-2">{bt.description}</p>
                  )}

                  <div className="flex flex-wrap gap-4 mt-3 text-sm">
                    {bt.formulaName && (
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Package className="w-3.5 h-3.5" />
                        <span>Fórmula: <strong>{bt.formulaCode}</strong> — {bt.formulaName}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <Beaker className="w-3.5 h-3.5" />
                      <span>Rendimiento: <strong>{bt.yieldKg} kg</strong> por tanda</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Create Form Modal */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                onClick={() => setShowForm(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={e => e.stopPropagation()}
                  className={cn('w-full max-w-lg rounded-2xl shadow-2xl p-6', isDark ? 'bg-gray-800' : 'bg-white')}
                >
                  <div className="flex items-center justify-between mb-5">
                    <h2 className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>Nuevo Tipo de Base</h2>
                    <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Código *</label>
                        <input
                          value={form.code}
                          onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                          placeholder="BASE_CLARA"
                          className={cn('w-full px-3 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')}
                        />
                      </div>
                      <div>
                        <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Nombre *</label>
                        <input
                          value={form.name}
                          onChange={e => setForm({ ...form, name: e.target.value })}
                          placeholder="Base Clara"
                          className={cn('w-full px-3 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Descripción</label>
                      <textarea
                        value={form.description}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                        rows={2}
                        placeholder="Descripción del tipo de base..."
                        className={cn('w-full px-3 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')}
                      />
                    </div>

                    <div>
                      <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Fórmula de Producción</label>
                      <select
                        value={form.formulaId}
                        onChange={e => setForm({ ...form, formulaId: e.target.value })}
                        className={cn('w-full px-3 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')}
                      >
                        <option value="">Sin fórmula</option>
                        {formulas.map(f => (
                          <option key={f.id} value={f.id}>{f.code} — {f.name}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-400 mt-1">Enlaza con una fórmula existente que define las materias primas por tanda</p>
                    </div>

                    <div>
                      <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Rendimiento por tanda (kg)</label>
                      <input
                        type="number"
                        step="any"
                        value={form.yieldKg}
                        onChange={e => setForm({ ...form, yieldKg: e.target.value })}
                        className={cn('w-full px-3 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')}
                      />
                      <p className="text-xs text-gray-400 mt-1">Cuántos kg de mezcla produce una tanda de la fórmula</p>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button onClick={() => setShowForm(false)} className={cn('px-4 py-2.5 rounded-xl font-medium text-sm', isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700')}>
                      Cancelar
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={saving || !form.code || !form.name}
                      className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      {saving ? 'Guardando...' : 'Crear Tipo de Base'}
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
