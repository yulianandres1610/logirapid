'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Palette, Loader2, X, Check, Droplets, Search, Trash2 } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface ColorCard {
  id: number; code: string; name: string; baseTypeId: number; baseTypeName: string
  baseTypeCode: string; hexColor: string | null; isActive: boolean; tintCount: number; notes: string | null
}
interface BaseType { id: number; code: string; name: string }
interface Product { id: number; name: string; sku: string }
interface TintLine { id: string; tintProductId: number | null; tintProductName: string; quantityPerKg: string; unit: string }

export default function PaintColorCardsPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [colorCards, setColorCards] = useState<ColorCard[]>([])
  const [baseTypes, setBaseTypes] = useState<BaseType[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', baseTypeId: '', hexColor: '#FFFFFF', notes: '' })
  const [tintLines, setTintLines] = useState<TintLine[]>([])

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [ccRes, btRes, pRes] = await Promise.all([
        fetch('/api/market/production/paint/color-cards'),
        fetch('/api/market/production/paint/base-types'),
        fetch('/api/market/products?limit=500')
      ])
      const ccData = await ccRes.json()
      const btData = await btRes.json()
      const pData = await pRes.json()
      if (ccData.success) setColorCards(ccData.data)
      if (btData.success) setBaseTypes(btData.data)
      if (pData.success) setProducts((pData.data?.products || []).map((p: any) => ({ id: p.id, name: p.name, sku: p.sku })))
    } catch { /* ignore */ }
    setLoading(false)
  }

  const addTintLine = () => {
    setTintLines([...tintLines, { id: Date.now().toString(), tintProductId: null, tintProductName: '', quantityPerKg: '', unit: 'g' }])
  }

  const removeTintLine = (id: string) => {
    setTintLines(tintLines.filter(t => t.id !== id))
  }

  const handleCreate = async () => {
    if (!form.code || !form.name || !form.baseTypeId) return
    setSaving(true)
    try {
      const res = await fetch('/api/market/production/paint/color-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code,
          name: form.name,
          baseTypeId: parseInt(form.baseTypeId),
          hexColor: form.hexColor,
          notes: form.notes || null,
          tints: tintLines.filter(t => t.tintProductId && t.quantityPerKg).map(t => ({
            tintProductId: t.tintProductId,
            quantityPerKg: parseFloat(t.quantityPerKg),
            unit: t.unit
          }))
        })
      })
      const data = await res.json()
      if (data.success) {
        setShowForm(false)
        setForm({ code: '', name: '', baseTypeId: '', hexColor: '#FFFFFF', notes: '' })
        setTintLines([])
        fetchData()
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  const filtered = colorCards.filter(cc =>
    cc.name.toLowerCase().includes(search.toLowerCase()) ||
    cc.code.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Cartas de Color</h1>
              <p className="text-sm text-gray-500">Colores con receta de tintas por kg de base</p>
            </div>
            <button onClick={() => { setShowForm(true); addTintLine() }} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm">
              <Plus className="w-4 h-4" /> Nuevo Color
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar color..."
              className={cn('w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm', isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200')}
            />
          </div>

          {/* Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className={cn('text-center py-20 rounded-2xl border', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50')}>
              <Palette className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 font-medium">No hay colores registrados</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(cc => (
                <motion.div
                  key={cc.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn('rounded-xl border overflow-hidden', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}
                >
                  {/* Color strip */}
                  <div className="h-3" style={{ backgroundColor: cc.hexColor || '#ccc' }} />
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg border-2 border-white shadow" style={{ backgroundColor: cc.hexColor || '#ccc' }} />
                      <div>
                        <h3 className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>{cc.name}</h3>
                        <p className="text-xs text-gray-500">{cc.code}</p>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-3 text-xs text-gray-500">
                      <span className={cn('px-2 py-0.5 rounded-full', isDark ? 'bg-gray-700' : 'bg-gray-100')}>
                        {cc.baseTypeName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Droplets className="w-3 h-3" /> {cc.tintCount} tinta{cc.tintCount !== 1 ? 's' : ''}
                      </span>
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
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                onClick={() => setShowForm(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  onClick={e => e.stopPropagation()}
                  className={cn('w-full max-w-2xl rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto', isDark ? 'bg-gray-800' : 'bg-white')}
                >
                  <div className="flex items-center justify-between mb-5">
                    <h2 className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>Nueva Carta de Color</h2>
                    <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Basic info */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Código *</label>
                        <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="COL-001"
                          className={cn('w-full px-3 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')} />
                      </div>
                      <div>
                        <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Nombre *</label>
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Marfil"
                          className={cn('w-full px-3 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')} />
                      </div>
                      <div>
                        <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Color</label>
                        <div className="flex gap-2">
                          <input type="color" value={form.hexColor} onChange={e => setForm({ ...form, hexColor: e.target.value })}
                            className="w-10 h-10 rounded-lg border cursor-pointer" />
                          <input value={form.hexColor} onChange={e => setForm({ ...form, hexColor: e.target.value })}
                            className={cn('flex-1 px-3 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')} />
                        </div>
                      </div>
                    </div>

                    {/* Base type */}
                    <div>
                      <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Tipo de Base *</label>
                      <select value={form.baseTypeId} onChange={e => setForm({ ...form, baseTypeId: e.target.value })}
                        className={cn('w-full px-3 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')}>
                        <option value="">Seleccionar...</option>
                        {baseTypes.map(bt => <option key={bt.id} value={bt.id}>{bt.name} ({bt.code})</option>)}
                      </select>
                    </div>

                    {/* Tints */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className={cn('text-sm font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>Receta de Tintas (por kg de base)</label>
                        <button onClick={addTintLine} className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Agregar tinta
                        </button>
                      </div>
                      <div className="space-y-2">
                        {tintLines.map(tl => (
                          <div key={tl.id} className="flex gap-2 items-center">
                            <select
                              value={tl.tintProductId || ''}
                              onChange={e => setTintLines(tintLines.map(t => t.id === tl.id ? { ...t, tintProductId: parseInt(e.target.value) || null, tintProductName: '' } : t))}
                              className={cn('flex-1 px-3 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')}
                            >
                              <option value="">Seleccionar tinta...</option>
                              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                            </select>
                            <input
                              type="number" step="any" placeholder="Cant."
                              value={tl.quantityPerKg}
                              onChange={e => setTintLines(tintLines.map(t => t.id === tl.id ? { ...t, quantityPerKg: e.target.value } : t))}
                              className={cn('w-24 px-3 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')}
                            />
                            <select
                              value={tl.unit}
                              onChange={e => setTintLines(tintLines.map(t => t.id === tl.id ? { ...t, unit: e.target.value } : t))}
                              className={cn('w-16 px-2 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')}
                            >
                              <option value="g">g</option>
                              <option value="ml">ml</option>
                              <option value="kg">kg</option>
                            </select>
                            <button onClick={() => removeTintLine(tl.id)} className="p-1.5 text-red-400 hover:text-red-500">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Cantidad de cada tinta necesaria por cada kilogramo de base</p>
                    </div>

                    <div>
                      <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Notas</label>
                      <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                        className={cn('w-full px-3 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')} />
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button onClick={() => setShowForm(false)} className={cn('px-4 py-2.5 rounded-xl font-medium text-sm', isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700')}>
                      Cancelar
                    </button>
                    <button onClick={handleCreate} disabled={saving || !form.code || !form.name || !form.baseTypeId}
                      className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      {saving ? 'Guardando...' : 'Crear Color'}
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
