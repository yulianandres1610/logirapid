'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Palette, Loader2, X, Check, Droplets, Search, Trash2, ArrowLeft, ArrowRight, FlaskConical, CheckCircle2 } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface ColorCard { id: number; code: string; name: string; baseTypeId: number; baseTypeName: string; hexColor: string | null; isActive: boolean; tintCount: number }
interface BaseType { id: number; code: string; name: string }
interface Product { id: number; name: string; sku: string }
interface TintLine { id: string; tintProductId: number | null; quantityPerKg: string; unit: string }

type WStep = 'info' | 'base' | 'tints' | 'review'
const WSTEPS: { id: WStep; label: string }[] = [{ id: 'info', label: 'Info' }, { id: 'base', label: 'Base' }, { id: 'tints', label: 'Tintas' }, { id: 'review', label: 'Confirmar' }]

export default function PaintColorCardsPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [colorCards, setColorCards] = useState<ColorCard[]>([])
  const [baseTypes, setBaseTypes] = useState<BaseType[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showWizard, setShowWizard] = useState(false)
  const [ws, setWs] = useState<WStep>('info')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', baseTypeId: '', hexColor: '#FFFFFF', notes: '' })
  const [tints, setTints] = useState<TintLine[]>([{ id: '1', tintProductId: null, quantityPerKg: '', unit: 'g' }])

  useEffect(() => {
    Promise.all([
      fetch('/api/market/production/paint/color-cards').then(r => r.json()),
      fetch('/api/market/production/paint/base-types').then(r => r.json()),
      fetch('/api/market/products?limit=500').then(r => r.json())
    ]).then(([a, b, c]) => {
      if (a.success) setColorCards(a.data)
      if (b.success) setBaseTypes(b.data)
      if (c.success) setProducts((c.data?.products || []).map((p: any) => ({ id: p.id, name: p.name, sku: p.sku })))
    }).finally(() => setLoading(false))
  }, [])

  const wsIdx = WSTEPS.findIndex(s => s.id === ws)
  const openW = () => { setForm({ code: '', name: '', baseTypeId: '', hexColor: '#FFFFFF', notes: '' }); setTints([{ id: '1', tintProductId: null, quantityPerKg: '', unit: 'g' }]); setWs('info'); setShowWizard(true) }
  const canNext = () => { if (ws === 'info') return !!form.code && !!form.name; if (ws === 'base') return !!form.baseTypeId; return true }
  const goNext = () => { if (!canNext()) return; const n = wsIdx + 1; if (n < WSTEPS.length) setWs(WSTEPS[n].id) }
  const goPrev = () => { const p = wsIdx - 1; if (p >= 0) setWs(WSTEPS[p].id) }
  const validTints = tints.filter(t => t.tintProductId && parseFloat(t.quantityPerKg) > 0)
  const selectedBase = baseTypes.find(bt => bt.id === parseInt(form.baseTypeId))

  const handleCreate = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/market/production/paint/color-cards', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: form.code, name: form.name, baseTypeId: parseInt(form.baseTypeId), hexColor: form.hexColor, notes: form.notes || null,
          tints: validTints.map(t => ({ tintProductId: t.tintProductId, quantityPerKg: parseFloat(t.quantityPerKg), unit: t.unit })) }) })
      if ((await res.json()).success) { setShowWizard(false); const r = await fetch('/api/market/production/paint/color-cards').then(r2 => r2.json()); if (r.success) setColorCards(r.data) }
    } catch {} setSaving(false)
  }

  const filtered = colorCards.filter(cc => cc.name.toLowerCase().includes(search.toLowerCase()) || cc.code.toLowerCase().includes(search.toLowerCase()))
  const ic = cn('w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30', isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200')

  return (
    <ProtectedRoute><DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Cartas de Color</h1><p className="text-sm text-gray-500">Colores con receta de tintas por kg de base</p></div>
          <button onClick={openW} className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium text-sm"><Plus className="w-4 h-4" /> Nuevo Color</button>
        </div>
        <div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className={cn('w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm', isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200')} /></div>

        {loading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
        : filtered.length === 0 ? <div className={cn('text-center py-20 rounded-2xl border', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50')}><Palette className="w-12 h-12 mx-auto mb-3 text-gray-300" /><p className="text-gray-500">No hay colores</p><button onClick={openW} className="mt-3 text-orange-500 text-sm font-medium">+ Crear primer color</button></div>
        : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{filtered.map(cc => (
          <motion.div key={cc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn('rounded-xl border overflow-hidden', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
            <div className="h-3" style={{ backgroundColor: cc.hexColor || '#ccc' }} />
            <div className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg border-2 border-white shadow" style={{ backgroundColor: cc.hexColor || '#ccc' }} /><div><h3 className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>{cc.name}</h3><p className="text-xs text-gray-500">{cc.code}</p></div></div>
            <div className="flex gap-3 mt-3 text-xs text-gray-500"><span className={cn('px-2 py-0.5 rounded-full', isDark ? 'bg-gray-700' : 'bg-gray-100')}>{cc.baseTypeName}</span><span className="flex items-center gap-1"><Droplets className="w-3 h-3" /> {cc.tintCount} tintas</span></div></div>
          </motion.div>))}</div>}
      </div>

      {/* WIZARD */}
      <AnimatePresence>{showWizard && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowWizard(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()}
            className={cn('w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] flex flex-col', isDark ? 'bg-gray-900' : 'bg-white')}>

            {/* Header + Stepper */}
            <div className={cn('px-6 py-4 border-b shrink-0', isDark ? 'border-gray-700' : 'border-gray-200')}>
              <div className="flex items-center justify-between mb-3"><h2 className={cn('font-bold text-lg', isDark ? 'text-white' : 'text-gray-900')}>Nuevo Color</h2><button onClick={() => setShowWizard(false)}><X className="w-5 h-5 text-gray-400" /></button></div>
              <div className="flex items-center justify-center gap-1.5">{WSTEPS.map((s, i) => (<div key={s.id} className="flex items-center">
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold', i < wsIdx ? 'bg-green-500 text-white' : s.id === ws ? 'bg-orange-500 text-white' : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-400')}>{i < wsIdx ? <Check className="w-4 h-4" /> : i + 1}</div>
                {i < WSTEPS.length - 1 && <div className={cn('w-8 h-0.5 mx-1', i < wsIdx ? 'bg-green-500' : isDark ? 'bg-gray-700' : 'bg-gray-200')} />}
              </div>))}</div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <AnimatePresence mode="wait">
                {ws === 'info' && <motion.div key="info" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                  <div className="text-center mb-2"><div className="w-20 h-20 rounded-2xl mx-auto mb-3 border-4 border-white shadow-lg" style={{ backgroundColor: form.hexColor }} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Código *</label><input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="COL-001" className={ic} /></div>
                    <div><label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Nombre *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Marfil" className={ic} /></div>
                  </div>
                  <div><label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Color</label><div className="flex gap-3 items-center"><input type="color" value={form.hexColor} onChange={e => setForm({ ...form, hexColor: e.target.value })} className="w-12 h-12 rounded-xl border cursor-pointer" /><input value={form.hexColor} onChange={e => setForm({ ...form, hexColor: e.target.value })} className={cn(ic, 'flex-1')} /></div></div>
                  <div><label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Notas</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Observaciones..." className={ic} /></div>
                </motion.div>}

                {ws === 'base' && <motion.div key="base" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                  <p className={cn('text-center font-bold mb-4', isDark ? 'text-white' : 'text-gray-900')}>¿Qué tipo de base usa este color?</p>
                  {baseTypes.map(bt => (
                    <motion.button key={bt.id} whileTap={{ scale: 0.99 }} onClick={() => setForm({ ...form, baseTypeId: String(bt.id) })}
                      className={cn('w-full p-4 rounded-xl border text-left flex items-center gap-4', form.baseTypeId === String(bt.id) ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
                      <div className={cn('p-3 rounded-xl', form.baseTypeId === String(bt.id) ? 'bg-orange-100 dark:bg-orange-900/30' : isDark ? 'bg-gray-700' : 'bg-gray-100')}><FlaskConical className={cn('w-6 h-6', form.baseTypeId === String(bt.id) ? 'text-orange-600' : 'text-gray-400')} /></div>
                      <div className="flex-1"><p className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>{bt.name}</p><p className="text-xs text-gray-500">{bt.code}</p></div>
                      {form.baseTypeId === String(bt.id) && <CheckCircle2 className="w-5 h-5 text-orange-500" />}
                    </motion.button>))}
                  {baseTypes.length === 0 && <div className="text-center py-8"><FlaskConical className="w-10 h-10 mx-auto mb-2 text-gray-300" /><p className="text-gray-500 text-sm">No hay tipos de base</p></div>}
                </motion.div>}

                {ws === 'tints' && <motion.div key="tints" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <p className={cn('text-center font-bold mb-1', isDark ? 'text-white' : 'text-gray-900')}>Receta de Tintas</p>
                  <p className="text-center text-xs text-gray-500 mb-4">Cantidad por kg de base</p>
                  <div className="space-y-3">{tints.map((t, i) => (
                    <div key={t.id} className={cn('p-3 rounded-xl border', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50')}>
                      <div className="flex items-center gap-2 mb-2"><span className={cn('text-xs font-bold w-5 h-5 rounded flex items-center justify-center', isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200')}>{i + 1}</span><span className={cn('text-sm flex-1', isDark ? 'text-white' : 'text-gray-700')}>Tinta {i + 1}</span>{tints.length > 1 && <button onClick={() => setTints(tints.filter(x => x.id !== t.id))} className="p-1 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>}</div>
                      <div className="grid grid-cols-[1fr_80px_60px] gap-2">
                        <select value={t.tintProductId || ''} onChange={e => setTints(tints.map(x => x.id === t.id ? { ...x, tintProductId: parseInt(e.target.value) || null } : x))} className={cn('px-2 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200')}><option value="">Seleccionar...</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                        <input type="number" step="any" placeholder="Cant." value={t.quantityPerKg} onChange={e => setTints(tints.map(x => x.id === t.id ? { ...x, quantityPerKg: e.target.value } : x))} className={cn('px-2 py-2 rounded-lg border text-sm text-center', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200')} />
                        <select value={t.unit} onChange={e => setTints(tints.map(x => x.id === t.id ? { ...x, unit: e.target.value } : x))} className={cn('px-1 py-2 rounded-lg border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200')}><option value="g">g</option><option value="ml">ml</option><option value="kg">kg</option></select>
                      </div>
                    </div>))}</div>
                  <button onClick={() => setTints([...tints, { id: Date.now().toString(), tintProductId: null, quantityPerKg: '', unit: 'g' }])} className="w-full mt-3 py-2.5 rounded-xl border border-dashed text-sm font-medium flex items-center justify-center gap-2 text-orange-500 border-orange-300 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-900/20"><Plus className="w-4 h-4" /> Agregar tinta</button>
                </motion.div>}

                {ws === 'review' && <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                  <div className="text-center"><div className="w-16 h-16 rounded-2xl mx-auto mb-3 border-4 border-white shadow-lg" style={{ backgroundColor: form.hexColor }} /><h3 className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>{form.name}</h3><p className="text-sm text-gray-500">{form.code}</p></div>
                  <div className={cn('p-4 rounded-xl', isDark ? 'bg-gray-800' : 'bg-gray-50')}>
                    <p className="text-sm mb-1"><FlaskConical className="w-4 h-4 inline text-amber-500 mr-1" /><strong>Base:</strong> {selectedBase?.name || '—'}</p>
                    <p className="text-sm"><Droplets className="w-4 h-4 inline text-purple-500 mr-1" /><strong>{validTints.length} tinta{validTints.length !== 1 ? 's' : ''}</strong></p>
                    {validTints.length > 0 && <div className="mt-2 space-y-1">{validTints.map(t => { const p = products.find(pr => pr.id === t.tintProductId); return <div key={t.id} className="flex justify-between text-xs text-gray-500"><span>{p?.name}</span><span className="font-mono">{t.quantityPerKg} {t.unit}/kg</span></div> })}</div>}
                  </div>
                </motion.div>}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className={cn('px-6 py-4 border-t flex gap-3 shrink-0', isDark ? 'border-gray-700' : 'border-gray-200')}>
              {wsIdx > 0 ? <button onClick={goPrev} className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm', isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700')}><ArrowLeft className="w-4 h-4" /> Anterior</button>
              : <button onClick={() => setShowWizard(false)} className={cn('px-4 py-2.5 rounded-xl font-medium text-sm', isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700')}>Cancelar</button>}
              {ws === 'review'
                ? <button onClick={handleCreate} disabled={saving} className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {saving ? 'Guardando...' : 'Crear Color'}</button>
                : <button onClick={goNext} disabled={!canNext()} className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">Siguiente <ArrowRight className="w-4 h-4" /></button>}
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </DashboardLayout></ProtectedRoute>
  )
}
