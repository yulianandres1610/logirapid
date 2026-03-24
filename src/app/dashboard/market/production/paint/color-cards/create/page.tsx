'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Palette, Loader2, X, Check, Droplets, Trash2, ArrowLeft, ArrowRight, FlaskConical, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface BaseType { id: number; code: string; name: string }
interface Product { id: number; name: string; sku: string }
interface TintLine { id: string; tintProductId: number | null; quantityPerKg: string; unit: string }

type Step = 'info' | 'base' | 'tints' | 'review'
const STEPS: { id: Step; label: string; icon: any }[] = [
  { id: 'info', label: 'Información', icon: Palette },
  { id: 'base', label: 'Tipo de Base', icon: FlaskConical },
  { id: 'tints', label: 'Receta de Tintas', icon: Droplets },
  { id: 'review', label: 'Confirmar', icon: CheckCircle2 },
]

export default function CreateColorCardPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const router = useRouter()
  const [baseTypes, setBaseTypes] = useState<BaseType[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<Step>('info')
  const [form, setForm] = useState({ code: '', name: '', baseTypeId: '', hexColor: '#FFFFFF', notes: '' })
  const [tints, setTints] = useState<TintLine[]>([{ id: '1', tintProductId: null, quantityPerKg: '', unit: 'g' }])

  useEffect(() => {
    Promise.all([
      fetch('/api/market/production/paint/base-types').then(r => r.json()),
      fetch('/api/market/products?limit=500').then(r => r.json())
    ]).then(([b, p]) => {
      if (b.success) setBaseTypes(b.data)
      if (p.success) setProducts((p.data?.products || []).map((x: any) => ({ id: x.id, name: x.name, sku: x.sku })))
    }).finally(() => setLoading(false))
  }, [])

  const si = STEPS.findIndex(s => s.id === step)
  const canNext = () => { if (step === 'info') return !!form.code && !!form.name; if (step === 'base') return !!form.baseTypeId; return true }
  const goNext = () => { if (canNext() && si + 1 < STEPS.length) setStep(STEPS[si + 1].id) }
  const goPrev = () => { if (si > 0) setStep(STEPS[si - 1].id) }
  const validTints = tints.filter(t => t.tintProductId && parseFloat(t.quantityPerKg) > 0)
  const selectedBase = baseTypes.find(bt => bt.id === parseInt(form.baseTypeId))

  const handleCreate = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/market/production/paint/color-cards', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: form.code, name: form.name, baseTypeId: parseInt(form.baseTypeId), hexColor: form.hexColor, notes: form.notes || null,
          tints: validTints.map(t => ({ tintProductId: t.tintProductId, quantityPerKg: parseFloat(t.quantityPerKg), unit: t.unit })) }) })
      if ((await res.json()).success) router.push('/dashboard/market/production/paint/color-cards')
    } catch {} setSaving(false)
  }

  const ic = cn('w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30', isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200')
  const lc = cn('block text-sm font-medium mb-1.5', isDark ? 'text-gray-300' : 'text-gray-700')

  if (loading) return <ProtectedRoute><DashboardLayout><div className="flex items-center justify-center h-[80vh]"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div></DashboardLayout></ProtectedRoute>

  return (
    <ProtectedRoute><DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 pt-10 pb-20 relative">
        <button onClick={() => router.back()} className={cn('absolute top-4 right-4 p-2 rounded-xl z-10', isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100')}><X className="w-5 h-5 text-gray-400" /></button>

        <div className="text-center mb-8">
          <h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Nueva Carta de Color</h1>
          <p className="text-sm text-gray-500 mt-1">Configura el color, la base y la receta de tintas</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {STEPS.map((s, i) => {
            const active = s.id === step; const done = i < si; const Icon = s.icon
            return (<div key={s.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <motion.div animate={{ scale: active ? 1.1 : 1 }} className={cn('w-10 h-10 rounded-full flex items-center justify-center relative', done ? 'bg-green-500 text-white' : active ? 'bg-orange-500 text-white' : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-400')}>
                  {done ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  {active && <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-0 rounded-full bg-orange-500" />}
                </motion.div>
                <span className={cn('text-xs mt-1.5 font-medium', active ? 'text-orange-500' : done ? 'text-green-500' : 'text-gray-400')}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={cn('w-12 h-0.5 mx-2 mt-[-16px]', done ? 'bg-green-500' : isDark ? 'bg-gray-700' : 'bg-gray-200')} />}
            </div>)
          })}
        </div>

        <AnimatePresence mode="wait">
          {step === 'info' && <motion.div key="info" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
            <div className="text-center"><div className="w-24 h-24 rounded-2xl mx-auto mb-4 border-4 border-white shadow-xl" style={{ backgroundColor: form.hexColor }} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lc}>Código *</label><input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="COL-001" className={ic} /></div>
              <div><label className={lc}>Nombre *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Marfil" className={ic} /></div>
            </div>
            <div><label className={lc}>Color de Referencia</label><div className="flex gap-3 items-center"><input type="color" value={form.hexColor} onChange={e => setForm({ ...form, hexColor: e.target.value })} className="w-14 h-14 rounded-xl border-2 cursor-pointer" /><input value={form.hexColor} onChange={e => setForm({ ...form, hexColor: e.target.value })} className={cn(ic, 'flex-1')} /></div></div>
            <div><label className={lc}>Notas</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Observaciones..." className={ic} /></div>
          </motion.div>}

          {step === 'base' && <motion.div key="base" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <p className={cn('text-center font-bold text-lg mb-6', isDark ? 'text-white' : 'text-gray-900')}>¿Qué tipo de base usa este color?</p>
            {baseTypes.map(bt => (
              <motion.button key={bt.id} whileTap={{ scale: 0.99 }} onClick={() => setForm({ ...form, baseTypeId: String(bt.id) })}
                className={cn('w-full p-5 rounded-2xl border text-left flex items-center gap-4 transition-all',
                  form.baseTypeId === String(bt.id) ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow-lg shadow-orange-500/10' : isDark ? 'border-gray-700 bg-gray-800 hover:border-gray-600' : 'border-gray-200 bg-white hover:border-gray-300')}>
                <div className={cn('p-3 rounded-xl', form.baseTypeId === String(bt.id) ? 'bg-orange-100 dark:bg-orange-900/30' : isDark ? 'bg-gray-700' : 'bg-gray-100')}><FlaskConical className={cn('w-7 h-7', form.baseTypeId === String(bt.id) ? 'text-orange-600' : 'text-gray-400')} /></div>
                <div className="flex-1"><p className={cn('font-bold text-lg', isDark ? 'text-white' : 'text-gray-900')}>{bt.name}</p><p className="text-sm text-gray-500">{bt.code}</p></div>
                {form.baseTypeId === String(bt.id) && <CheckCircle2 className="w-6 h-6 text-orange-500" />}
              </motion.button>))}
            {baseTypes.length === 0 && <div className="text-center py-12"><FlaskConical className="w-12 h-12 mx-auto mb-3 text-gray-300" /><p className="text-gray-500">No hay tipos de base registrados</p></div>}
          </motion.div>}

          {step === 'tints' && <motion.div key="tints" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <p className={cn('text-center font-bold text-lg mb-1', isDark ? 'text-white' : 'text-gray-900')}>Receta de Tintas</p>
            <p className="text-center text-sm text-gray-500 mb-6">Cantidad de cada tinta por kilogramo de base</p>
            <div className="space-y-3">{tints.map((t, i) => (
              <div key={t.id} className={cn('p-4 rounded-2xl border', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50')}>
                <div className="flex items-center justify-between mb-3"><span className={cn('text-sm font-bold', isDark ? 'text-white' : 'text-gray-700')}>Tinta {i + 1}</span>{tints.length > 1 && <button onClick={() => setTints(tints.filter(x => x.id !== t.id))} className="p-1 text-red-400"><Trash2 className="w-4 h-4" /></button>}</div>
                <div className="grid grid-cols-[1fr_100px_70px] gap-3">
                  <select value={t.tintProductId || ''} onChange={e => setTints(tints.map(x => x.id === t.id ? { ...x, tintProductId: parseInt(e.target.value) || null } : x))}
                    className={cn('px-3 py-2.5 rounded-xl border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200')}><option value="">Seleccionar tinta...</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                  <input type="number" step="any" placeholder="Cantidad" value={t.quantityPerKg} onChange={e => setTints(tints.map(x => x.id === t.id ? { ...x, quantityPerKg: e.target.value } : x))}
                    className={cn('px-3 py-2.5 rounded-xl border text-sm text-center', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200')} />
                  <select value={t.unit} onChange={e => setTints(tints.map(x => x.id === t.id ? { ...x, unit: e.target.value } : x))}
                    className={cn('px-2 py-2.5 rounded-xl border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200')}><option value="g">g</option><option value="ml">ml</option><option value="kg">kg</option></select>
                </div>
              </div>))}</div>
            <button onClick={() => setTints([...tints, { id: Date.now().toString(), tintProductId: null, quantityPerKg: '', unit: 'g' }])}
              className="w-full mt-4 py-3 rounded-2xl border-2 border-dashed text-sm font-medium flex items-center justify-center gap-2 text-orange-500 border-orange-300 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-900/20">
              <Plus className="w-4 h-4" /> Agregar otra tinta
            </button>
          </motion.div>}

          {step === 'review' && <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-md mx-auto text-center">
            <div className={cn('rounded-2xl border p-8', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white')}>
              <div className="w-20 h-20 rounded-2xl mx-auto mb-4 border-4 border-white shadow-xl" style={{ backgroundColor: form.hexColor }} />
              <h3 className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>{form.name}</h3>
              <p className="text-sm text-gray-500 mb-4">{form.code}</p>
              <div className={cn('p-4 rounded-xl text-left space-y-2', isDark ? 'bg-gray-900' : 'bg-gray-50')}>
                <p className="text-sm flex items-center gap-2"><FlaskConical className="w-4 h-4 text-amber-500" /> <strong>Base:</strong> {selectedBase?.name || '—'}</p>
                <p className="text-sm flex items-center gap-2"><Droplets className="w-4 h-4 text-purple-500" /> <strong>{validTints.length} tinta{validTints.length !== 1 ? 's' : ''}</strong></p>
                {validTints.map(t => { const p = products.find(pr => pr.id === t.tintProductId); return <div key={t.id} className="flex justify-between text-xs text-gray-500 pl-6"><span>{p?.name}</span><span className="font-mono">{t.quantityPerKg} {t.unit}/kg</span></div> })}
              </div>
              {form.notes && <p className="text-sm text-gray-500 mt-3">Notas: {form.notes}</p>}
            </div>
          </motion.div>}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-10">
          <button onClick={si > 0 ? goPrev : () => router.back()} className={cn('flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm', isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-200 text-gray-700')}>
            <ArrowLeft className="w-4 h-4" /> {si > 0 ? 'Anterior' : 'Cancelar'}
          </button>
          {step === 'review'
            ? <button onClick={handleCreate} disabled={saving} className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-medium text-sm disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {saving ? 'Guardando...' : 'Crear Color'}
              </button>
            : <button onClick={goNext} disabled={!canNext()} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium text-sm disabled:opacity-30">
                Siguiente <ArrowRight className="w-4 h-4" />
              </button>}
        </div>
      </div>
    </DashboardLayout></ProtectedRoute>
  )
}
