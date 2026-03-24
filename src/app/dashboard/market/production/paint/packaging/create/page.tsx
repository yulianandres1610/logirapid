'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, X, Check, ArrowLeft, ArrowRight, Box, Tag, CheckCircle2, Weight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Product { id: number; name: string; sku: string }
type Step = 'info' | 'components' | 'review'
const STEPS: { id: Step; label: string; icon: any }[] = [{ id: 'info', label: 'Información', icon: Box }, { id: 'components', label: 'Componentes', icon: Tag }, { id: 'review', label: 'Confirmar', icon: CheckCircle2 }]

export default function CreatePackagingPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<Step>('info')
  const [form, setForm] = useState({ name: '', volumeLiters: '', netWeightKg: '', containerProductId: '', labelProductId: '', lidProductId: '', laborCostPerUnit: '0' })

  useEffect(() => { fetch('/api/market/products?limit=500').then(r => r.json()).then(d => { if (d.success) setProducts((d.data?.products || []).map((p: any) => ({ id: p.id, name: p.name, sku: p.sku }))) }).finally(() => setLoading(false)) }, [])

  const si = STEPS.findIndex(s => s.id === step)
  const canNext = () => { if (step === 'info') return !!form.name && !!form.volumeLiters && !!form.netWeightKg; return true }
  const goNext = () => { if (canNext() && si + 1 < STEPS.length) setStep(STEPS[si + 1].id) }
  const goPrev = () => { if (si > 0) setStep(STEPS[si - 1].id) }

  const handleCreate = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/market/production/paint/packaging-specs', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, volumeLiters: parseFloat(form.volumeLiters), netWeightKg: parseFloat(form.netWeightKg),
          containerProductId: form.containerProductId ? parseInt(form.containerProductId) : null, labelProductId: form.labelProductId ? parseInt(form.labelProductId) : null,
          lidProductId: form.lidProductId ? parseInt(form.lidProductId) : null, laborCostPerUnit: parseFloat(form.laborCostPerUnit) || 0 }) })
      if ((await res.json()).success) router.push('/dashboard/market/production/paint/packaging')
    } catch {} setSaving(false)
  }

  const ic = cn('w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30', isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200')
  const lc = cn('block text-sm font-medium mb-1.5', isDark ? 'text-gray-300' : 'text-gray-700')
  const getP = (id: string) => products.find(p => p.id === parseInt(id))

  if (loading) return <ProtectedRoute><DashboardLayout><div className="flex items-center justify-center h-[80vh]"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div></DashboardLayout></ProtectedRoute>

  return (
    <ProtectedRoute><DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 pt-10 pb-20 relative">
        <button onClick={() => router.back()} className={cn('absolute top-4 right-4 p-2 rounded-xl z-10', isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100')}><X className="w-5 h-5 text-gray-400" /></button>
        <div className="text-center mb-8"><h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Nuevo Envase</h1><p className="text-sm text-gray-500 mt-1">Configura tamaño, peso y componentes</p></div>

        <div className="flex items-center justify-center gap-2 mb-10">
          {STEPS.map((s, i) => { const active = s.id === step; const done = i < si; const Icon = s.icon; return (<div key={s.id} className="flex items-center">
            <div className="flex flex-col items-center"><motion.div animate={{ scale: active ? 1.1 : 1 }} className={cn('w-10 h-10 rounded-full flex items-center justify-center relative', done ? 'bg-green-500 text-white' : active ? 'bg-orange-500 text-white' : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-400')}>{done ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}{active && <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-0 rounded-full bg-orange-500" />}</motion.div>
            <span className={cn('text-xs mt-1.5 font-medium', active ? 'text-orange-500' : done ? 'text-green-500' : 'text-gray-400')}>{s.label}</span></div>
            {i < STEPS.length - 1 && <div className={cn('w-14 h-0.5 mx-2 mt-[-16px]', done ? 'bg-green-500' : isDark ? 'bg-gray-700' : 'bg-gray-200')} />}
          </div>) })}
        </div>

        <AnimatePresence mode="wait">
          {step === 'info' && <motion.div key="info" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5 max-w-lg mx-auto">
            <div><label className={lc}>Nombre *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Envase 1 Litro" className={ic} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lc}>Volumen (litros) *</label><input type="number" step="any" value={form.volumeLiters} onChange={e => setForm({ ...form, volumeLiters: e.target.value })} placeholder="1" className={ic} /></div>
              <div><label className={lc}>Peso neto (kg) *</label><input type="number" step="any" value={form.netWeightKg} onChange={e => setForm({ ...form, netWeightKg: e.target.value })} placeholder="1.3" className={ic} /><p className="text-xs text-gray-400 mt-1">Peso de pintura que cabe</p></div>
            </div>
            <div><label className={lc}>Costo M.O. por unidad ($)</label><input type="number" step="0.01" value={form.laborCostPerUnit} onChange={e => setForm({ ...form, laborCostPerUnit: e.target.value })} className={ic} /></div>
          </motion.div>}

          {step === 'components' && <motion.div key="comp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5 max-w-lg mx-auto">
            <p className={cn('text-center font-bold text-lg mb-6', isDark ? 'text-white' : 'text-gray-900')}>Componentes del Envase</p>
            {[{ label: 'Envase / Recipiente', key: 'containerProductId', icon: Box },
              { label: 'Etiqueta', key: 'labelProductId', icon: Tag },
              { label: 'Tapa', key: 'lidProductId', icon: Box }].map(c => (
              <div key={c.key}><label className={lc}>{c.label}</label>
                <select value={(form as any)[c.key]} onChange={e => setForm({ ...form, [c.key]: e.target.value })} className={ic}>
                  <option value="">Sin asignar</option>{products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
              </div>))}
          </motion.div>}

          {step === 'review' && <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-md mx-auto text-center">
            <div className={cn('rounded-2xl border p-8', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white')}>
              <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4', isDark ? 'bg-orange-900/30' : 'bg-orange-100')}><Box className="w-8 h-8 text-orange-600" /></div>
              <h3 className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>{form.name}</h3>
              <div className="flex justify-center gap-4 mt-2 text-sm text-gray-500"><span>{form.volumeLiters}L</span><span>{form.netWeightKg}kg</span></div>
              <div className={cn('p-4 rounded-xl text-left mt-4 space-y-1', isDark ? 'bg-gray-900' : 'bg-gray-50')}>
                {form.containerProductId && <p className="text-sm"><strong>Envase:</strong> {getP(form.containerProductId)?.name}</p>}
                {form.labelProductId && <p className="text-sm"><strong>Etiqueta:</strong> {getP(form.labelProductId)?.name}</p>}
                {form.lidProductId && <p className="text-sm"><strong>Tapa:</strong> {getP(form.lidProductId)?.name}</p>}
                {parseFloat(form.laborCostPerUnit) > 0 && <p className="text-sm"><strong>M.O.:</strong> ${form.laborCostPerUnit}/ud</p>}
              </div>
            </div>
          </motion.div>}
        </AnimatePresence>

        <div className="flex items-center justify-between mt-10">
          <button onClick={si > 0 ? goPrev : () => router.back()} className={cn('flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm', isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-200 text-gray-700')}><ArrowLeft className="w-4 h-4" /> {si > 0 ? 'Anterior' : 'Cancelar'}</button>
          {step === 'review'
            ? <button onClick={handleCreate} disabled={saving} className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium text-sm disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {saving ? 'Guardando...' : 'Crear Envase'}</button>
            : <button onClick={goNext} disabled={!canNext()} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium text-sm disabled:opacity-30">Siguiente <ArrowRight className="w-4 h-4" /></button>}
        </div>
      </div>
    </DashboardLayout></ProtectedRoute>
  )
}
