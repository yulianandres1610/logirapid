'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Beaker, Loader2, X, Check, FlaskConical, Package, ArrowLeft, ArrowRight, CheckCircle2, FileText } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface BaseType { id: number; code: string; name: string; description: string | null; formulaId: number | null; formulaName: string | null; formulaCode: string | null; yieldKg: number; isActive: boolean }
interface Formula { id: number; code: string; name: string }

type WStep = 'info' | 'formula' | 'review'
const WSTEPS: { id: WStep; label: string }[] = [{ id: 'info', label: 'Información' }, { id: 'formula', label: 'Fórmula' }, { id: 'review', label: 'Confirmar' }]

export default function PaintBaseTypesPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [baseTypes, setBaseTypes] = useState<BaseType[]>([])
  const [formulas, setFormulas] = useState<Formula[]>([])
  const [loading, setLoading] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [ws, setWs] = useState<WStep>('info')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', description: '', formulaId: '', yieldKg: '1' })

  useEffect(() => {
    Promise.all([
      fetch('/api/market/production/paint/base-types').then(r => r.json()),
      fetch('/api/market/production/formulas?limit=100&isActive=true').then(r => r.json())
    ]).then(([a, b]) => {
      if (a.success) setBaseTypes(a.data)
      if (b.success) setFormulas((b.data?.formulas || b.data || []).map((f: any) => ({ id: f.id, code: f.code, name: f.name })))
    }).finally(() => setLoading(false))
  }, [])

  const wsIdx = WSTEPS.findIndex(s => s.id === ws)
  const openW = () => { setForm({ code: '', name: '', description: '', formulaId: '', yieldKg: '1' }); setWs('info'); setShowWizard(true) }
  const canNext = () => { if (ws === 'info') return !!form.code && !!form.name; return true }
  const goNext = () => { if (canNext() && wsIdx + 1 < WSTEPS.length) setWs(WSTEPS[wsIdx + 1].id) }
  const goPrev = () => { if (wsIdx > 0) setWs(WSTEPS[wsIdx - 1].id) }
  const selectedFormula = formulas.find(f => f.id === parseInt(form.formulaId))

  const handleCreate = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/market/production/paint/base-types', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: form.code, name: form.name, description: form.description || null, formulaId: form.formulaId ? parseInt(form.formulaId) : null, yieldKg: parseFloat(form.yieldKg) || 1 }) })
      if ((await res.json()).success) { setShowWizard(false); const r = await fetch('/api/market/production/paint/base-types').then(r2 => r2.json()); if (r.success) setBaseTypes(r.data) }
    } catch {} setSaving(false)
  }

  const ic = cn('w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30', isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200')

  return (
    <ProtectedRoute><DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Tipos de Base</h1><p className="text-sm text-gray-500">Base clara, oscura y otras bases para fabricación</p></div>
          <button onClick={openW} className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium text-sm"><Plus className="w-4 h-4" /> Nuevo Tipo</button>
        </div>

        {loading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
        : baseTypes.length === 0 ? <div className={cn('text-center py-20 rounded-2xl border', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50')}><Beaker className="w-12 h-12 mx-auto mb-3 text-gray-300" /><p className="text-gray-500">No hay tipos de base</p><button onClick={openW} className="mt-3 text-orange-500 text-sm font-medium">+ Crear primer tipo</button></div>
        : <div className="grid gap-4">{baseTypes.map(bt => (
          <motion.div key={bt.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn('p-5 rounded-xl border', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3"><div className={cn('p-2.5 rounded-xl', isDark ? 'bg-amber-900/30' : 'bg-amber-100')}><FlaskConical className={cn('w-5 h-5', isDark ? 'text-amber-400' : 'text-amber-600')} /></div>
              <div><h3 className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>{bt.name}</h3><p className="text-xs text-gray-500">{bt.code}</p></div></div>
              <span className={cn('text-xs px-2 py-1 rounded-full font-medium', bt.isActive ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>{bt.isActive ? 'Activa' : 'Inactiva'}</span>
            </div>
            {bt.description && <p className="text-sm text-gray-500 mt-2">{bt.description}</p>}
            <div className="flex flex-wrap gap-4 mt-3 text-sm">{bt.formulaName && <span className="flex items-center gap-1.5 text-gray-500"><Package className="w-3.5 h-3.5" /> Fórmula: <strong>{bt.formulaCode}</strong> — {bt.formulaName}</span>}<span className="flex items-center gap-1.5 text-gray-500"><Beaker className="w-3.5 h-3.5" /> Rendimiento: <strong>{bt.yieldKg} kg</strong>/tanda</span></div>
          </motion.div>))}</div>}
      </div>

      {/* WIZARD */}
      <AnimatePresence>{showWizard && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowWizard(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()}
            className={cn('w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] flex flex-col', isDark ? 'bg-gray-900' : 'bg-white')}>

            <div className={cn('px-6 py-4 border-b shrink-0', isDark ? 'border-gray-700' : 'border-gray-200')}>
              <div className="flex items-center justify-between mb-3"><h2 className={cn('font-bold text-lg', isDark ? 'text-white' : 'text-gray-900')}>Nuevo Tipo de Base</h2><button onClick={() => setShowWizard(false)}><X className="w-5 h-5 text-gray-400" /></button></div>
              <div className="flex items-center justify-center gap-1.5">{WSTEPS.map((s, i) => (<div key={s.id} className="flex items-center">
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold', i < wsIdx ? 'bg-green-500 text-white' : s.id === ws ? 'bg-orange-500 text-white' : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-400')}>{i < wsIdx ? <Check className="w-4 h-4" /> : i + 1}</div>
                {i < WSTEPS.length - 1 && <div className={cn('w-10 h-0.5 mx-1', i < wsIdx ? 'bg-green-500' : isDark ? 'bg-gray-700' : 'bg-gray-200')} />}
              </div>))}</div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <AnimatePresence mode="wait">
                {ws === 'info' && <motion.div key="info" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                  <p className={cn('text-center font-bold mb-2', isDark ? 'text-white' : 'text-gray-900')}>Información del Tipo de Base</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Código *</label><input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="BASE_CLARA" className={ic} /></div>
                    <div><label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Nombre *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Base Clara" className={ic} /></div>
                  </div>
                  <div><label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Descripción</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Descripción..." className={ic} /></div>
                </motion.div>}

                {ws === 'formula' && <motion.div key="formula" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                  <p className={cn('text-center font-bold mb-2', isDark ? 'text-white' : 'text-gray-900')}>Fórmula y Rendimiento</p>
                  <div><label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Fórmula de Producción</label>
                    {formulas.length > 0 ? <div className="space-y-2">{formulas.map(f => (
                      <motion.button key={f.id} whileTap={{ scale: 0.99 }} onClick={() => setForm({ ...form, formulaId: String(f.id) })}
                        className={cn('w-full p-3 rounded-xl border text-left flex items-center gap-3', form.formulaId === String(f.id) ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200')}>
                        <FileText className={cn('w-5 h-5', form.formulaId === String(f.id) ? 'text-orange-500' : 'text-gray-400')} />
                        <div className="flex-1"><p className={cn('font-medium text-sm', isDark ? 'text-white' : 'text-gray-900')}>{f.name}</p><p className="text-xs text-gray-500">{f.code}</p></div>
                        {form.formulaId === String(f.id) && <CheckCircle2 className="w-4 h-4 text-orange-500" />}
                      </motion.button>))}
                      <button onClick={() => setForm({ ...form, formulaId: '' })} className="text-xs text-gray-400 hover:text-gray-500">Sin fórmula</button>
                    </div> : <p className="text-sm text-gray-400 py-4 text-center">No hay fórmulas activas</p>}
                  </div>
                  <div><label className={cn('block text-sm font-medium mb-1', isDark ? 'text-gray-300' : 'text-gray-700')}>Rendimiento por tanda (kg)</label><input type="number" step="any" value={form.yieldKg} onChange={e => setForm({ ...form, yieldKg: e.target.value })} className={ic} /><p className="text-xs text-gray-400 mt-1">Cuántos kg de mezcla produce una tanda</p></div>
                </motion.div>}

                {ws === 'review' && <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto"><FlaskConical className="w-8 h-8 text-amber-600" /></div>
                  <h3 className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>{form.name}</h3>
                  <p className="text-sm text-gray-500">{form.code}</p>
                  <div className={cn('p-4 rounded-xl text-left', isDark ? 'bg-gray-800' : 'bg-gray-50')}>
                    {selectedFormula && <p className="text-sm mb-1"><strong>Fórmula:</strong> {selectedFormula.code} — {selectedFormula.name}</p>}
                    <p className="text-sm"><strong>Rendimiento:</strong> {form.yieldKg} kg/tanda</p>
                    {form.description && <p className="text-sm mt-1 text-gray-500">{form.description}</p>}
                  </div>
                </motion.div>}
              </AnimatePresence>
            </div>

            <div className={cn('px-6 py-4 border-t flex gap-3 shrink-0', isDark ? 'border-gray-700' : 'border-gray-200')}>
              {wsIdx > 0 ? <button onClick={goPrev} className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm', isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700')}><ArrowLeft className="w-4 h-4" /> Anterior</button>
              : <button onClick={() => setShowWizard(false)} className={cn('px-4 py-2.5 rounded-xl font-medium text-sm', isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700')}>Cancelar</button>}
              {ws === 'review'
                ? <button onClick={handleCreate} disabled={saving} className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {saving ? 'Guardando...' : 'Crear Tipo de Base'}</button>
                : <button onClick={goNext} disabled={!canNext()} className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">Siguiente <ArrowRight className="w-4 h-4" /></button>}
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </DashboardLayout></ProtectedRoute>
  )
}
