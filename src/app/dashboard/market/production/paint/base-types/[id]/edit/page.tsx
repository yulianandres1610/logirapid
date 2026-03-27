'use client'

import { useState, useEffect, use } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, X, Check, ArrowLeft, ArrowRight, FlaskConical, CheckCircle2, FileText, Beaker } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Formula { id: number; code: string; name: string }
type Step = 'info' | 'formula' | 'review'
const STEPS: { id: Step; label: string; icon: any }[] = [{ id: 'info', label: 'Información', icon: FlaskConical }, { id: 'formula', label: 'Fórmula', icon: FileText }, { id: 'review', label: 'Confirmar', icon: CheckCircle2 }]

export default function EditBaseTypePage({ params }: { params: Promise<{ id: string }> }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const router = useRouter()
  const resolvedParams = use(params)
  const baseId = resolvedParams.id

  const [formulas, setFormulas] = useState<Formula[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<Step>('info')
  const [form, setForm] = useState({ code: '', name: '', description: '', formulaId: '', yieldKg: '1' })

  useEffect(() => {
    Promise.all([
      fetch(`/api/market/production/paint/base-types/${baseId}`).then(r => r.json()),
      fetch('/api/market/production/formulas?limit=100&isActive=true').then(r => r.json())
    ]).then(([btData, fData]) => {
      if (btData.success) {
        const bt = btData.data
        setForm({ code: bt.code, name: bt.name, description: bt.description || '', formulaId: bt.formulaId ? String(bt.formulaId) : '', yieldKg: String(bt.yieldKg) })
      }
      if (fData.success) setFormulas((fData.data?.formulas || fData.data || []).map((f: any) => ({ id: f.id, code: f.code, name: f.name })))
    }).finally(() => setLoading(false))
  }, [baseId])

  const si = STEPS.findIndex(s => s.id === step)
  const canNext = () => { if (step === 'info') return !!form.name; return true }
  const goNext = () => { if (canNext() && si + 1 < STEPS.length) setStep(STEPS[si + 1].id) }
  const goPrev = () => { if (si > 0) setStep(STEPS[si - 1].id) }
  const selectedFormula = formulas.find(f => f.id === parseInt(form.formulaId))

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/market/production/paint/base-types/${baseId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, description: form.description || null, formulaId: form.formulaId ? parseInt(form.formulaId) : null, yieldKg: parseFloat(form.yieldKg) || 1 })
      })
      if ((await res.json()).success) router.push('/dashboard/market/production/paint/base-types')
    } catch {} setSaving(false)
  }

  const ic = cn('w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30', isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200')
  const lc = cn('block text-sm font-medium mb-1.5', isDark ? 'text-gray-300' : 'text-gray-700')

  if (loading) return <ProtectedRoute><DashboardLayout><div className="flex items-center justify-center h-[80vh]"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div></DashboardLayout></ProtectedRoute>

  return (
    <ProtectedRoute><DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 pt-10 pb-20 relative">
        <button onClick={() => router.back()} className={cn('absolute top-4 right-4 p-2 rounded-xl z-10', isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100')}><X className="w-5 h-5 text-gray-400" /></button>
        <div className="text-center mb-8"><h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Editar Base — {form.code}</h1><p className="text-sm text-gray-500 mt-1">Modifica la información y fórmula</p></div>

        <div className="flex items-center justify-center gap-2 mb-10">
          {STEPS.map((s, i) => { const active = s.id === step; const done = i < si; const Icon = s.icon; return (<div key={s.id} className="flex items-center">
            <div className="flex flex-col items-center"><motion.div animate={{ scale: active ? 1.1 : 1 }} className={cn('w-10 h-10 rounded-full flex items-center justify-center relative', done ? 'bg-green-500 text-white' : active ? 'bg-orange-500 text-white' : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-400')}>{done ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}{active && <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-0 rounded-full bg-orange-500" />}</motion.div>
            <span className={cn('text-xs mt-1.5 font-medium', active ? 'text-orange-500' : done ? 'text-green-500' : 'text-gray-400')}>{s.label}</span></div>
            {i < STEPS.length - 1 && <div className={cn('w-14 h-0.5 mx-2 mt-[-16px]', done ? 'bg-green-500' : isDark ? 'bg-gray-700' : 'bg-gray-200')} />}
          </div>) })}
        </div>

        <AnimatePresence mode="wait">
          {step === 'info' && <motion.div key="info" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5 max-w-lg mx-auto">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lc}>Código</label><input value={form.code} disabled className={cn(ic, 'opacity-60')} /></div>
              <div><label className={lc}>Nombre *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={ic} /></div>
            </div>
            <div><label className={lc}>Descripción</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className={ic} /></div>
          </motion.div>}

          {step === 'formula' && <motion.div key="formula" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-lg mx-auto space-y-4">
            <p className={cn('text-center font-bold text-lg mb-6', isDark ? 'text-white' : 'text-gray-900')}>Fórmula de Producción</p>
            {formulas.map(f => (
              <motion.button key={f.id} whileTap={{ scale: 0.99 }} onClick={() => setForm({ ...form, formulaId: String(f.id) })}
                className={cn('w-full p-5 rounded-2xl border text-left flex items-center gap-4', form.formulaId === String(f.id) ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow-lg shadow-orange-500/10' : isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
                <FileText className={cn('w-6 h-6', form.formulaId === String(f.id) ? 'text-orange-500' : 'text-gray-400')} />
                <div className="flex-1"><p className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>{f.name}</p><p className="text-xs text-gray-500">{f.code}</p></div>
                {form.formulaId === String(f.id) && <CheckCircle2 className="w-5 h-5 text-orange-500" />}
              </motion.button>))}
            <button onClick={() => setForm({ ...form, formulaId: '' })} className="text-xs text-gray-400 hover:text-gray-500 block mx-auto">Sin fórmula</button>
            <div className="pt-4"><label className={lc}>Rendimiento por tanda (kg)</label><input type="number" step="any" value={form.yieldKg} onChange={e => setForm({ ...form, yieldKg: e.target.value })} className={ic} /><p className="text-xs text-gray-400 mt-1">Cuántos kg de mezcla produce una tanda</p></div>
          </motion.div>}

          {step === 'review' && <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-md mx-auto text-center">
            <div className={cn('rounded-2xl border p-8', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white')}>
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4"><FlaskConical className="w-8 h-8 text-amber-600" /></div>
              <h3 className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>{form.name}</h3>
              <p className="text-sm text-gray-500 mb-4">{form.code}</p>
              <div className={cn('p-4 rounded-xl text-left', isDark ? 'bg-gray-900' : 'bg-gray-50')}>
                {selectedFormula ? <p className="text-sm mb-1"><strong>Fórmula:</strong> {selectedFormula.code} — {selectedFormula.name}</p> : <p className="text-sm text-gray-400 mb-1">Sin fórmula</p>}
                <p className="text-sm flex items-center gap-1"><Beaker className="w-4 h-4 text-amber-500" /> <strong>Rendimiento:</strong> {form.yieldKg} kg/tanda</p>
                {form.description && <p className="text-sm mt-2 text-gray-500">{form.description}</p>}
              </div>
            </div>
          </motion.div>}
        </AnimatePresence>

        <div className="flex items-center justify-between mt-10">
          <button onClick={si > 0 ? goPrev : () => router.back()} className={cn('flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm', isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-200 text-gray-700')}><ArrowLeft className="w-4 h-4" /> {si > 0 ? 'Anterior' : 'Cancelar'}</button>
          {step === 'review'
            ? <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium text-sm disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {saving ? 'Guardando...' : 'Guardar Cambios'}</button>
            : <button onClick={goNext} disabled={!canNext()} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium text-sm disabled:opacity-30">Siguiente <ArrowRight className="w-4 h-4" /></button>}
        </div>
      </div>
    </DashboardLayout></ProtectedRoute>
  )
}
