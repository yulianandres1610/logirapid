'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, X, Check, ArrowLeft, ArrowRight, Cog, CheckCircle2, Weight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

type Step = 'info' | 'review'
const STEPS: { id: Step; label: string; icon: any }[] = [{ id: 'info', label: 'Información', icon: Cog }, { id: 'review', label: 'Confirmar', icon: CheckCircle2 }]

export default function CreateMixerPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<Step>('info')
  const [form, setForm] = useState({ name: '', capacityMinKg: '', capacityMaxKg: '', mixerType: 'large', notes: '' })

  const si = STEPS.findIndex(s => s.id === step)
  const canNext = () => { if (step === 'info') return !!form.name && !!form.capacityMinKg && !!form.capacityMaxKg; return true }
  const goNext = () => { if (canNext() && si + 1 < STEPS.length) setStep(STEPS[si + 1].id) }
  const goPrev = () => { if (si > 0) setStep(STEPS[si - 1].id) }

  const handleCreate = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/market/production/paint/mixers', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, capacityMinKg: parseFloat(form.capacityMinKg), capacityMaxKg: parseFloat(form.capacityMaxKg), mixerType: form.mixerType, notes: form.notes || null }) })
      if ((await res.json()).success) router.push('/dashboard/market/production/paint/mixers')
    } catch {} setSaving(false)
  }

  const ic = cn('w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30', isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200')
  const lc = cn('block text-sm font-medium mb-1.5', isDark ? 'text-gray-300' : 'text-gray-700')

  return (
    <ProtectedRoute><DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 pt-10 pb-20 relative">
        <button onClick={() => router.back()} className={cn('absolute top-4 right-4 p-2 rounded-xl z-10', isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100')}><X className="w-5 h-5 text-gray-400" /></button>
        <div className="text-center mb-8"><h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Nueva Mezcladora</h1><p className="text-sm text-gray-500 mt-1">Registra un equipo de mezclado</p></div>

        <div className="flex items-center justify-center gap-2 mb-10">
          {STEPS.map((s, i) => { const active = s.id === step; const done = i < si; const Icon = s.icon; return (<div key={s.id} className="flex items-center">
            <div className="flex flex-col items-center"><motion.div animate={{ scale: active ? 1.1 : 1 }} className={cn('w-10 h-10 rounded-full flex items-center justify-center relative', done ? 'bg-green-500 text-white' : active ? 'bg-orange-500 text-white' : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-400')}>{done ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}{active && <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-0 rounded-full bg-orange-500" />}</motion.div>
            <span className={cn('text-xs mt-1.5 font-medium', active ? 'text-orange-500' : done ? 'text-green-500' : 'text-gray-400')}>{s.label}</span></div>
            {i < STEPS.length - 1 && <div className={cn('w-14 h-0.5 mx-2 mt-[-16px]', done ? 'bg-green-500' : isDark ? 'bg-gray-700' : 'bg-gray-200')} />}
          </div>) })}
        </div>

        <AnimatePresence mode="wait">
          {step === 'info' && <motion.div key="info" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5 max-w-lg mx-auto">
            <div><label className={lc}>Nombre *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Torba Grande A" className={ic} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lc}>Cap. mínima (kg) *</label><input type="number" step="any" value={form.capacityMinKg} onChange={e => setForm({ ...form, capacityMinKg: e.target.value })} placeholder="600" className={ic} /></div>
              <div><label className={lc}>Cap. máxima (kg) *</label><input type="number" step="any" value={form.capacityMaxKg} onChange={e => setForm({ ...form, capacityMaxKg: e.target.value })} placeholder="1200" className={ic} /></div>
            </div>
            <div><label className={lc}>Tipo</label>
              <div className="grid grid-cols-2 gap-3">
                {[{ id: 'small', label: 'Pequeña', desc: '80-200 kg' }, { id: 'large', label: 'Grande', desc: '600-1200 kg' }].map(t => (
                  <motion.button key={t.id} whileTap={{ scale: 0.99 }} onClick={() => setForm({ ...form, mixerType: t.id })}
                    className={cn('p-4 rounded-xl border text-center', form.mixerType === t.id ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200')}>
                    <p className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>{t.label}</p><p className="text-xs text-gray-500">{t.desc}</p>
                    {form.mixerType === t.id && <CheckCircle2 className="w-4 h-4 text-orange-500 mx-auto mt-1" />}
                  </motion.button>))}
              </div>
            </div>
            <div><label className={lc}>Notas</label><input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Ubicación, observaciones..." className={ic} /></div>
          </motion.div>}

          {step === 'review' && <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-md mx-auto text-center">
            <div className={cn('rounded-2xl border p-8', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white')}>
              <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4', isDark ? 'bg-purple-900/30' : 'bg-purple-100')}><Cog className="w-8 h-8 text-purple-600" /></div>
              <h3 className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>{form.name}</h3>
              <span className={cn('text-xs px-3 py-1 rounded-full inline-block mt-2', form.mixerType === 'small' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')}>{form.mixerType === 'small' ? 'Pequeña' : 'Grande'}</span>
              <div className="flex items-center justify-center gap-2 mt-3 text-sm text-gray-500"><Weight className="w-4 h-4" /><span><strong>{form.capacityMinKg}</strong> — <strong>{form.capacityMaxKg}</strong> kg</span></div>
              {form.notes && <p className="text-sm text-gray-500 mt-3">{form.notes}</p>}
            </div>
          </motion.div>}
        </AnimatePresence>

        <div className="flex items-center justify-between mt-10">
          <button onClick={si > 0 ? goPrev : () => router.back()} className={cn('flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm', isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-200 text-gray-700')}><ArrowLeft className="w-4 h-4" /> {si > 0 ? 'Anterior' : 'Cancelar'}</button>
          {step === 'review'
            ? <button onClick={handleCreate} disabled={saving} className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium text-sm disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {saving ? 'Guardando...' : 'Crear Mezcladora'}</button>
            : <button onClick={goNext} disabled={!canNext()} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium text-sm disabled:opacity-30">Siguiente <ArrowRight className="w-4 h-4" /></button>}
        </div>
      </div>
    </DashboardLayout></ProtectedRoute>
  )
}
