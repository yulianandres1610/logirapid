'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Loader2, Trash2, ArrowLeft, ArrowRight, Check, Factory, Palette, Box,
  Calculator, Cog, Search, Package, FlaskConical, Calendar, Warehouse as WarehouseIcon,
  CheckCircle2, X, Clock, Weight
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface ColorCard { id: number; code: string; name: string; baseTypeName: string; hexColor: string | null; tintCount: number }
interface PackagingSpec { id: number; name: string; volumeLiters: number; netWeightKg: number }
interface WarehouseItem { id: number; name: string; code: string }
interface OrderLine { id: string; colorCardId: number | null; colorName: string; hexColor: string | null; packagingSpecId: number | null; packagingName: string; quantityUnits: string }

type Step = 'products' | 'config' | 'calculate' | 'confirm'

const STEPS: { id: Step; label: string; icon: any }[] = [
  { id: 'products', label: 'Productos', icon: Palette },
  { id: 'config', label: 'Configuración', icon: Cog },
  { id: 'calculate', label: 'Cálculo', icon: Calculator },
  { id: 'confirm', label: 'Confirmar', icon: CheckCircle2 },
]

export default function CreatePaintOrderPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const router = useRouter()

  const [currentStep, setCurrentStep] = useState<Step>('products')
  const [colorCards, setColorCards] = useState<ColorCard[]>([])
  const [packagingSpecs, setPackagingSpecs] = useState<PackagingSpec[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [calcResult, setCalcResult] = useState<any>(null)
  const [colorSearch, setColorSearch] = useState('')

  const [lines, setLines] = useState<OrderLine[]>([])
  const [warehouseId, setWarehouseId] = useState('')
  const [targetWarehouseId, setTargetWarehouseId] = useState('')
  const [plannedDate, setPlannedDate] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/market/production/paint/color-cards').then(r => r.json()),
      fetch('/api/market/production/paint/packaging-specs').then(r => r.json()),
      fetch('/api/market/warehouses').then(r => r.json())
    ]).then(([ccData, psData, wData]) => {
      if (ccData.success) setColorCards(ccData.data)
      if (psData.success) setPackagingSpecs(psData.data)
      if (wData.success) setWarehouses(wData.data?.warehouses || wData.data || [])
    }).finally(() => setLoading(false))
  }, [])

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  const addLine = (cc: ColorCard) => {
    const defaultPkg = packagingSpecs[0]
    setLines([...lines, {
      id: Date.now().toString(), colorCardId: cc.id, colorName: cc.name, hexColor: cc.hexColor,
      packagingSpecId: defaultPkg?.id || null, packagingName: defaultPkg?.name || '', quantityUnits: '100'
    }])
  }

  const updateLine = (id: string, updates: Partial<OrderLine>) => {
    setLines(lines.map(l => {
      if (l.id !== id) return l
      const updated = { ...l, ...updates }
      if (updates.packagingSpecId) {
        const pkg = packagingSpecs.find(p => p.id === updates.packagingSpecId)
        if (pkg) updated.packagingName = pkg.name
      }
      return updated
    }))
  }

  const removeLine = (id: string) => setLines(lines.filter(l => l.id !== id))

  const validLines = useMemo(() => lines.filter(l => l.colorCardId && l.packagingSpecId && parseInt(l.quantityUnits) > 0), [lines])
  const totalWeight = useMemo(() => validLines.reduce((sum, l) => {
    const pkg = packagingSpecs.find(p => p.id === l.packagingSpecId)
    return sum + (parseInt(l.quantityUnits) || 0) * (pkg?.netWeightKg || 0)
  }, 0), [validLines, packagingSpecs])
  const totalUnits = useMemo(() => validLines.reduce((sum, l) => sum + (parseInt(l.quantityUnits) || 0), 0), [validLines])

  const filteredColors = useMemo(() =>
    colorCards.filter(cc => cc.name.toLowerCase().includes(colorSearch.toLowerCase()) || cc.code.toLowerCase().includes(colorSearch.toLowerCase())),
    [colorCards, colorSearch])

  const canAdvance = (): boolean => {
    switch (currentStep) {
      case 'products': return validLines.length > 0
      case 'config': return true
      case 'calculate': return calcResult !== null
      default: return false
    }
  }

  const goNext = async () => {
    if (!canAdvance()) return
    if (currentStep === 'config') { await doCalculate() }
    const nextIdx = currentStepIndex + 1
    if (nextIdx < STEPS.length) setCurrentStep(STEPS[nextIdx].id)
  }

  const goPrev = () => {
    const prevIdx = currentStepIndex - 1
    if (prevIdx >= 0) setCurrentStep(STEPS[prevIdx].id)
  }

  const doCalculate = async () => {
    setCalculating(true)
    try {
      const createRes = await fetch('/api/market/production/paint/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: validLines.map(l => ({ colorCardId: l.colorCardId, packagingSpecId: l.packagingSpecId, quantityUnits: parseInt(l.quantityUnits) })),
          warehouseId: warehouseId ? parseInt(warehouseId) : null,
          targetWarehouseId: targetWarehouseId ? parseInt(targetWarehouseId) : null,
          plannedDate: plannedDate || null, notes: notes || null
        })
      })
      const createData = await createRes.json()
      if (!createData.success) return

      const calcRes = await fetch(`/api/market/production/paint/orders/${createData.data.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'calculate' })
      })
      const calcData = await calcRes.json()
      if (calcData.success) setCalcResult({ ...calcData.data, orderId: createData.data.id, orderNumber: createData.data.orderNumber })
    } catch { /* ignore */ }
    setCalculating(false)
  }

  const handleConfirm = () => { if (calcResult?.orderId) router.push(`/dashboard/market/production/paint/orders/${calcResult.orderId}`) }

  const inputCls = cn('w-full px-3 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500/30',
    isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900')
  const labelCls = cn('block text-sm font-medium mb-1.5', isDark ? 'text-gray-300' : 'text-gray-700')

  if (loading) return (<ProtectedRoute><DashboardLayout><div className="flex items-center justify-center h-[80vh]"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div></DashboardLayout></ProtectedRoute>)

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="max-w-4xl mx-auto px-4 pt-8 pb-20 relative">
          <button onClick={() => router.back()} className={cn('absolute top-2 right-2 p-2 rounded-xl z-10', isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100')}>
            <X className="w-5 h-5 text-gray-400" />
          </button>

          <div className="text-center mb-8">
            <h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Nueva Orden de Producción</h1>
            <p className="text-sm text-gray-500 mt-1">Fabricación de pintura con cálculo automático</p>
          </div>

          {/* Stepper */}
          <div className="flex items-center justify-center gap-2 mb-10">
            {STEPS.map((step, idx) => {
              const isActive = step.id === currentStep
              const isCompleted = idx < currentStepIndex
              const StepIcon = step.icon
              return (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <motion.div animate={{ scale: isActive ? 1.1 : 1 }}
                      className={cn('w-10 h-10 rounded-full flex items-center justify-center relative',
                        isCompleted ? 'bg-green-500 text-white' : isActive ? 'bg-orange-500 text-white' : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-400')}>
                      {isCompleted ? <Check className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
                      {isActive && <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-0 rounded-full bg-orange-500" />}
                    </motion.div>
                    <span className={cn('text-xs mt-1.5 font-medium', isActive ? 'text-orange-500' : isCompleted ? 'text-green-500' : 'text-gray-400')}>{step.label}</span>
                  </div>
                  {idx < STEPS.length - 1 && <div className={cn('w-12 h-0.5 mx-2 mt-[-16px]', isCompleted ? 'bg-green-500' : isDark ? 'bg-gray-700' : 'bg-gray-200')} />}
                </div>
              )
            })}
          </div>

          <AnimatePresence mode="wait">
            {/* STEP 1: Products */}
            {currentStep === 'products' && (
              <motion.div key="products" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className={cn('rounded-2xl border p-5', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50')}>
                    <h3 className={cn('font-bold mb-3 flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}><Palette className="w-5 h-5 text-orange-500" /> Colores</h3>
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input value={colorSearch} onChange={e => setColorSearch(e.target.value)} placeholder="Buscar..."
                        className={cn('w-full pl-10 pr-4 py-2 rounded-xl border text-sm', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200')} />
                    </div>
                    <div className="space-y-1 max-h-[400px] overflow-y-auto">
                      {filteredColors.map(cc => (
                        <button key={cc.id} onClick={() => addLine(cc)}
                          className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all',
                            isDark ? 'hover:bg-gray-700' : 'hover:bg-white hover:shadow-sm')}>
                          <div className="w-8 h-8 rounded-lg border shadow-sm shrink-0" style={{ backgroundColor: cc.hexColor || '#ccc' }} />
                          <div className="flex-1 min-w-0">
                            <p className={cn('font-medium text-sm truncate', isDark ? 'text-white' : 'text-gray-900')}>{cc.name}</p>
                            <p className="text-xs text-gray-500">{cc.baseTypeName} · {cc.tintCount} tintas</p>
                          </div>
                          <Plus className="w-4 h-4 text-orange-500 shrink-0" />
                        </button>
                      ))}
                      {filteredColors.length === 0 && <p className="text-center text-sm text-gray-400 py-8">No hay colores registrados</p>}
                    </div>
                  </div>

                  <div>
                    <h3 className={cn('font-bold mb-3 flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}>
                      <Package className="w-5 h-5 text-orange-500" /> Productos ({lines.length})
                    </h3>
                    {lines.length === 0 ? (
                      <div className={cn('text-center py-16 rounded-2xl border border-dashed', isDark ? 'border-gray-700' : 'border-gray-300')}>
                        <Factory className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                        <p className="text-gray-400 text-sm">Selecciona colores de la lista</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {lines.map(line => (
                          <motion.div key={line.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            className={cn('p-3 rounded-xl border', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 rounded-md border shadow-sm" style={{ backgroundColor: line.hexColor || '#ccc' }} />
                              <span className={cn('font-medium text-sm flex-1', isDark ? 'text-white' : 'text-gray-900')}>{line.colorName}</span>
                              <button onClick={() => removeLine(line.id)} className="p-1 text-red-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <select value={line.packagingSpecId || ''} onChange={e => updateLine(line.id, { packagingSpecId: parseInt(e.target.value) || null })}
                                className={cn('px-2 py-1.5 rounded-lg border text-xs', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')}>
                                <option value="">Envase...</option>
                                {packagingSpecs.map(p => <option key={p.id} value={p.id}>{p.name} ({p.netWeightKg}kg)</option>)}
                              </select>
                              <input type="number" min="1" value={line.quantityUnits} onChange={e => updateLine(line.id, { quantityUnits: e.target.value })}
                                placeholder="Cant." className={cn('px-2 py-1.5 rounded-lg border text-xs text-center', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200')} />
                            </div>
                          </motion.div>
                        ))}
                        <div className={cn('p-3 rounded-xl', isDark ? 'bg-orange-900/20 border border-orange-900/30' : 'bg-orange-50 border border-orange-200')}>
                          <div className="flex justify-between text-sm">
                            <span className="text-orange-600 flex items-center gap-1"><Palette className="w-3.5 h-3.5" /> {validLines.length} prod.</span>
                            <span className="text-orange-600 flex items-center gap-1"><Box className="w-3.5 h-3.5" /> {totalUnits.toLocaleString()} uds</span>
                            <span className="text-orange-600 flex items-center gap-1"><Weight className="w-3.5 h-3.5" /> {totalWeight.toLocaleString()} kg</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: Config */}
            {currentStep === 'config' && (
              <motion.div key="config" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-lg mx-auto space-y-5">
                <div className={cn('rounded-2xl border p-6', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white')}>
                  <h3 className={cn('font-bold mb-4 flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}><WarehouseIcon className="w-5 h-5 text-orange-500" /> Almacenes</h3>
                  <div className="space-y-4">
                    <div><label className={labelCls}>Almacén Materias Primas</label><select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className={inputCls}><option value="">Automático (central)</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
                    <div><label className={labelCls}>Almacén Destino</label><select value={targetWarehouseId} onChange={e => setTargetWarehouseId(e.target.value)} className={inputCls}><option value="">Mismo almacén</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
                  </div>
                </div>
                <div className={cn('rounded-2xl border p-6', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white')}>
                  <h3 className={cn('font-bold mb-4 flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}><Calendar className="w-5 h-5 text-orange-500" /> Detalles</h3>
                  <div className="space-y-4">
                    <div><label className={labelCls}>Fecha Planificada</label><input type="date" value={plannedDate} onChange={e => setPlannedDate(e.target.value)} className={inputCls} /></div>
                    <div><label className={labelCls}>Notas</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Observaciones..." className={inputCls} /></div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 3: Calculate */}
            {currentStep === 'calculate' && (
              <motion.div key="calculate" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                {calculating ? (
                  <div className="text-center py-20">
                    <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
                    <p className={cn('font-bold text-lg', isDark ? 'text-white' : 'text-gray-900')}>Calculando producción...</p>
                    <p className="text-sm text-gray-500 mt-1">Asignando mezcladoras, materiales y costos</p>
                  </div>
                ) : calcResult ? (
                  <div className="space-y-4">
                    <div className={cn('rounded-2xl border p-5', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white')}>
                      <h3 className={cn('font-bold mb-3 flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}><FlaskConical className="w-5 h-5 text-amber-500" /> Bases Requeridas</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {calcResult.baseSummary?.map((bs: any, i: number) => (
                          <div key={i} className={cn('p-3 rounded-xl', isDark ? 'bg-amber-900/20' : 'bg-amber-50')}>
                            <p className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>{bs.baseTypeName}</p>
                            <p className="text-2xl font-bold text-amber-600">{bs.totalKg?.toLocaleString()} kg</p>
                            <p className="text-xs text-gray-500">{bs.mixerName} · {bs.batches} tanda{bs.batches > 1 ? 's' : ''}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className={cn('rounded-2xl border p-5', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white')}>
                      <h3 className={cn('font-bold mb-3 flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}><Clock className="w-5 h-5 text-orange-500" /> {calcResult.steps?.length} Pasos</h3>
                      <div className="space-y-2">
                        {calcResult.steps?.map((step: any, i: number) => (
                          <div key={i} className={cn('flex items-center gap-3 px-3 py-2 rounded-xl', isDark ? 'bg-gray-800' : 'bg-gray-50')}>
                            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
                              step.stepType === 'base_preparation' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                              step.stepType === 'tinting' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                              'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400')}>{i + 1}</div>
                            <div className="flex-1 min-w-0">
                              <p className={cn('text-sm font-medium truncate', isDark ? 'text-white' : 'text-gray-900')}>{step.description}</p>
                              <p className="text-xs text-gray-500">{step.mixerName ? `${step.mixerName} · ` : ''}{step.materials?.length || 0} mat.{step.estimatedTimeMinutes ? ` · ~${step.estimatedTimeMinutes} min` : ''}</p>
                            </div>
                            <span className="text-xs text-gray-500">${(step.materialsCost + step.laborCost).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className={cn('rounded-2xl border p-5', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white')}>
                      <h3 className={cn('font-bold mb-3 flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}><Calculator className="w-5 h-5 text-green-500" /> Costos</h3>
                      <div className="space-y-2">
                        {[{ l: 'Base', v: calcResult.totals?.baseCost, I: FlaskConical }, { l: 'Tintas', v: calcResult.totals?.tintCost, I: Palette }, { l: 'Empaque', v: calcResult.totals?.packagingCost, I: Box }, { l: 'M.O.', v: calcResult.totals?.laborCost, I: Cog }].map(c => (
                          <div key={c.l} className="flex items-center justify-between">
                            <span className="text-sm text-gray-500 flex items-center gap-2"><c.I className="w-4 h-4" /> {c.l}</span>
                            <span className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>${(c.v || 0).toFixed(2)}</span>
                          </div>
                        ))}
                        <div className={cn('flex items-center justify-between pt-3 border-t font-bold text-lg', isDark ? 'border-gray-700' : 'border-gray-200')}>
                          <span>TOTAL</span><span className="text-orange-600">${(calcResult.totals?.totalCost || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20"><Calculator className="w-12 h-12 mx-auto mb-4 text-gray-300" /><p className="text-gray-500">Error al calcular.</p></div>
                )}
              </motion.div>
            )}

            {/* STEP 4: Confirm */}
            {currentStep === 'confirm' && calcResult && (
              <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-lg mx-auto text-center">
                <div className={cn('rounded-2xl border p-8', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white')}>
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-8 h-8 text-green-500" /></div>
                  <h2 className={cn('text-xl font-bold mb-2', isDark ? 'text-white' : 'text-gray-900')}>Orden Lista</h2>
                  <p className="text-gray-500 mb-6"><strong className="text-orange-500">{calcResult.orderNumber}</strong> — {calcResult.steps?.length} pasos · <strong>${(calcResult.totals?.totalCost || 0).toFixed(2)}</strong></p>
                  <div className="space-y-2 mb-6">
                    {calcResult.lines?.map((line: any, i: number) => (
                      <div key={i} className={cn('flex items-center justify-between px-4 py-2 rounded-xl text-sm', isDark ? 'bg-gray-800' : 'bg-gray-50')}>
                        <span>{line.quantityUnits?.toLocaleString()} × {line.colorName} {line.packagingName}</span>
                        <span className="font-medium">${(line.costPerUnit || 0).toFixed(4)}/ud</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleConfirm} className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2">
                    <Factory className="w-5 h-5" /> Ver Orden y Comenzar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          {currentStep !== 'confirm' && (
            <div className="flex items-center justify-between mt-8">
              <button onClick={goPrev} disabled={currentStepIndex === 0}
                className={cn('flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm disabled:opacity-30',
                  isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-200 text-gray-700')}>
                <ArrowLeft className="w-4 h-4" /> Anterior
              </button>
              <button onClick={goNext} disabled={!canAdvance() || calculating}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium text-sm disabled:opacity-30">
                {calculating && <Loader2 className="w-4 h-4 animate-spin" />}
                {currentStep === 'config' ? 'Calcular Producción' : 'Siguiente'} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
