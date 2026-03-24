'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Box, Loader2, X, Check, Weight, Tag } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface PackagingSpec {
  id: number; name: string; volumeLiters: number; netWeightKg: number
  containerProductId: number | null; containerName: string | null; containerSku: string | null
  labelProductId: number | null; labelName: string | null
  lidProductId: number | null; lidName: string | null
  laborCostPerUnit: number; isActive: boolean
}
interface Product { id: number; name: string; sku: string }

export default function PaintPackagingPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [specs, setSpecs] = useState<PackagingSpec[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', volumeLiters: '', netWeightKg: '', containerProductId: '', labelProductId: '', lidProductId: '', laborCostPerUnit: '0' })

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [sRes, pRes] = await Promise.all([
        fetch('/api/market/production/paint/packaging-specs'),
        fetch('/api/market/products?limit=500')
      ])
      const sData = await sRes.json()
      const pData = await pRes.json()
      if (sData.success) setSpecs(sData.data)
      if (pData.success) setProducts((pData.data?.products || []).map((p: any) => ({ id: p.id, name: p.name, sku: p.sku })))
    } catch { /* ignore */ }
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!form.name || !form.volumeLiters || !form.netWeightKg) return
    setSaving(true)
    try {
      const res = await fetch('/api/market/production/paint/packaging-specs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          volumeLiters: parseFloat(form.volumeLiters),
          netWeightKg: parseFloat(form.netWeightKg),
          containerProductId: form.containerProductId ? parseInt(form.containerProductId) : null,
          labelProductId: form.labelProductId ? parseInt(form.labelProductId) : null,
          lidProductId: form.lidProductId ? parseInt(form.lidProductId) : null,
          laborCostPerUnit: parseFloat(form.laborCostPerUnit) || 0
        })
      })
      const data = await res.json()
      if (data.success) {
        setShowForm(false)
        setForm({ name: '', volumeLiters: '', netWeightKg: '', containerProductId: '', labelProductId: '', lidProductId: '', laborCostPerUnit: '0' })
        fetchData()
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Especificaciones de Envase</h1>
              <p className="text-sm text-gray-500">Tamaños de envase con peso neto y componentes</p>
            </div>
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm">
              <Plus className="w-4 h-4" /> Nuevo Envase
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
          ) : specs.length === 0 ? (
            <div className={cn('text-center py-20 rounded-2xl border', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50')}>
              <Box className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 font-medium">No hay envases registrados</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {specs.map(s => (
                <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className={cn('p-5 rounded-xl border text-center', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
                  <div className={cn('w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-3', isDark ? 'bg-blue-900/30' : 'bg-blue-100')}>
                    <Box className={cn('w-8 h-8', isDark ? 'text-blue-400' : 'text-blue-600')} />
                  </div>
                  <h3 className={cn('font-bold text-lg', isDark ? 'text-white' : 'text-gray-900')}>{s.name}</h3>
                  <div className="flex justify-center gap-4 mt-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><Box className="w-3 h-3" />{s.volumeLiters}L</span>
                    <span className="flex items-center gap-1"><Weight className="w-3 h-3" />{s.netWeightKg}kg</span>
                  </div>
                  {s.containerName && <p className="text-xs text-gray-400 mt-2 flex items-center justify-center gap-1"><Tag className="w-3 h-3" />{s.containerName}</p>}
                  {s.laborCostPerUnit > 0 && <p className="text-xs text-gray-400 mt-1">M.O: ${s.laborCostPerUnit}/ud</p>}
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
                  className={cn('w-full max-w-lg rounded-2xl shadow-2xl p-6', isDark ? 'bg-gray-800' : 'bg-white')}>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>Nueva Especificación</h2>
                    <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Nombre *</label>
                      <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Envase 1 Litro"
                        className={cn('w-full px-3 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Volumen (litros) *</label>
                        <input type="number" step="any" value={form.volumeLiters} onChange={e => setForm({ ...form, volumeLiters: e.target.value })}
                          className={cn('w-full px-3 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')} />
                      </div>
                      <div>
                        <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Peso neto (kg) *</label>
                        <input type="number" step="any" value={form.netWeightKg} onChange={e => setForm({ ...form, netWeightKg: e.target.value })}
                          className={cn('w-full px-3 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')} />
                        <p className="text-xs text-gray-400 mt-1">Peso de pintura que cabe en el envase</p>
                      </div>
                    </div>
                    <div>
                      <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Envase (producto de inventario)</label>
                      <select value={form.containerProductId} onChange={e => setForm({ ...form, containerProductId: e.target.value })}
                        className={cn('w-full px-3 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')}>
                        <option value="">Ninguno</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Etiqueta</label>
                        <select value={form.labelProductId} onChange={e => setForm({ ...form, labelProductId: e.target.value })}
                          className={cn('w-full px-3 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')}>
                          <option value="">Ninguna</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Tapa</label>
                        <select value={form.lidProductId} onChange={e => setForm({ ...form, lidProductId: e.target.value })}
                          className={cn('w-full px-3 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')}>
                          <option value="">Ninguna</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Costo M.O. por unidad ($)</label>
                      <input type="number" step="0.01" value={form.laborCostPerUnit} onChange={e => setForm({ ...form, laborCostPerUnit: e.target.value })}
                        className={cn('w-full px-3 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')} />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button onClick={() => setShowForm(false)} className={cn('px-4 py-2.5 rounded-xl font-medium text-sm', isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700')}>Cancelar</button>
                    <button onClick={handleCreate} disabled={saving || !form.name || !form.volumeLiters || !form.netWeightKg}
                      className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      {saving ? 'Guardando...' : 'Crear Envase'}
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
