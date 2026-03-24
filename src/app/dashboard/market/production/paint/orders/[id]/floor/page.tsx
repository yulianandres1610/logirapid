'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Play, Pause, Square, CheckCircle2, Clock, Loader2,
  FlaskConical, Palette, Box, Cog, AlertTriangle, MessageSquare, ThermometerSun,
  Package, Timer, SkipForward
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const STEP_ICONS: Record<string, any> = { base_preparation: FlaskConical, tinting: Palette, packaging: Box }
const STEP_LABELS: Record<string, string> = { base_preparation: 'Preparación Base', tinting: 'Tinturación', packaging: 'Empaque' }

interface Step {
  id: number; stepNumber: number; stepType: string; description: string
  status: string; mixerName: string | null; mixerBatches: number
  weightKg: number; quantityUnits: number | null
  estimatedTimeMinutes: number | null; actualTimeMinutes: number | null
  startedAt: string | null; completedAt: string | null; pausedAt?: string | null
  totalPauseMinutes?: number; operatorNotes: string | null; qualityCheck: string | null
  hexColor?: string | null; colorName?: string | null; baseTypeName?: string | null
  materials: { productName: string; quantityRequired: number; quantityIssued: number; status: string }[]
}

export default function PaintFloorPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const resolvedParams = use(params)
  const orderId = resolvedParams.id

  const [order, setOrder] = useState<any>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [showNoteModal, setShowNoteModal] = useState<number | null>(null)
  const [noteText, setNoteText] = useState('')

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/market/production/paint/orders/${orderId}`)
      const data = await res.json()
      if (data.success) {
        setOrder(data.data)
        setSteps(data.data.steps)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [orderId])

  useEffect(() => { fetchOrder() }, [fetchOrder])

  // Live timer for active step
  const activeStep = steps.find(s => s.status === 'in_progress')
  const pausedStep = steps.find(s => s.status === 'paused')

  useEffect(() => {
    if (!activeStep?.startedAt) { setElapsed(0); return }
    const start = new Date(activeStep.startedAt).getTime()
    const pauseMs = (activeStep.totalPauseMinutes || 0) * 60000

    const tick = () => {
      const now = Date.now()
      setElapsed(Math.floor((now - start - pauseMs) / 1000))
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [activeStep?.startedAt, activeStep?.totalPauseMinutes])

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h > 0 ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const doAction = async (stepId: number, action: string, extra?: Record<string, any>) => {
    setActing(true)
    try {
      await fetch(`/api/market/production/paint/orders/${orderId}/steps/${stepId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra })
      })
      await fetchOrder()
    } catch { /* ignore */ }
    setActing(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-gray-950">
      <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
    </div>
  )

  if (!order) return (
    <div className="flex items-center justify-center h-screen bg-gray-950">
      <p className="text-gray-500 text-xl">Orden no encontrada</p>
    </div>
  )

  const currentStep = activeStep || pausedStep || steps.find(s => s.status !== 'completed')
  const completedCount = steps.filter(s => s.status === 'completed').length
  const progress = steps.length > 0 ? Math.round(completedCount / steps.length * 100) : 0

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-800">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-lg">{order.orderNumber}</h1>
            <p className="text-xs text-gray-400">Piso de Producción</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-gray-400">{completedCount}/{steps.length} pasos</p>
            <div className="w-32 h-2 rounded-full bg-gray-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {/* Active Step - Big Card */}
        {currentStep && (
          <motion.div
            key={currentStep.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-6"
          >
            {/* Step type badge */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {(() => { const Icon = STEP_ICONS[currentStep.stepType] || Package; return <Icon className="w-6 h-6 text-blue-400" /> })()}
                <span className="text-sm font-medium text-blue-400">{STEP_LABELS[currentStep.stepType] || currentStep.stepType}</span>
                <span className="text-sm text-gray-500">· Paso {currentStep.stepNumber}</span>
              </div>
              {currentStep.hexColor && (
                <div className="w-8 h-8 rounded-lg border-2 border-gray-700" style={{ backgroundColor: currentStep.hexColor }} />
              )}
            </div>

            {/* Description */}
            <h2 className="text-xl font-bold mb-2">{currentStep.description}</h2>

            {/* Details */}
            <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-6">
              {currentStep.mixerName && (
                <span className="flex items-center gap-1"><Cog className="w-4 h-4" /> {currentStep.mixerName} ({currentStep.mixerBatches} tanda{currentStep.mixerBatches > 1 ? 's' : ''})</span>
              )}
              {currentStep.weightKg > 0 && <span className="flex items-center gap-1"><FlaskConical className="w-4 h-4" /> {currentStep.weightKg.toLocaleString()} kg</span>}
              {currentStep.quantityUnits && currentStep.quantityUnits > 0 && <span className="flex items-center gap-1"><Box className="w-4 h-4" /> {currentStep.quantityUnits.toLocaleString()} uds</span>}
              {currentStep.estimatedTimeMinutes && <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> ~{currentStep.estimatedTimeMinutes} min estimado</span>}
            </div>

            {/* Timer */}
            {currentStep.status === 'in_progress' && (
              <div className="text-center mb-6">
                <p className="text-6xl font-mono font-bold tracking-wider">
                  {pausedStep ? (
                    <span className="text-amber-400">{formatTime(elapsed)}</span>
                  ) : (
                    <span className="text-green-400">{formatTime(elapsed)}</span>
                  )}
                </p>
                {pausedStep && <p className="text-amber-400 text-sm mt-1 animate-pulse">PAUSADO</p>}
                {currentStep.estimatedTimeMinutes && (
                  <p className="text-xs text-gray-500 mt-1">
                    Estimado: {currentStep.estimatedTimeMinutes} min
                    {elapsed > currentStep.estimatedTimeMinutes * 60 && <span className="text-red-400 ml-2">EXCEDIDO</span>}
                  </p>
                )}
              </div>
            )}

            {/* Materials checklist */}
            {currentStep.materials.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Materiales</p>
                <div className="space-y-1.5">
                  {currentStep.materials.map((mat, i) => (
                    <div key={i} className={cn('flex items-center justify-between px-3 py-2 rounded-lg',
                      mat.status === 'issued' ? 'bg-green-900/20 border border-green-900/30' : 'bg-gray-800 border border-gray-700')}>
                      <span className="text-sm">{mat.productName}</span>
                      <span className="text-sm font-mono">
                        {mat.status === 'issued' ? <CheckCircle2 className="w-4 h-4 text-green-400 inline mr-1" /> : null}
                        {mat.quantityRequired.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons - Big and touch-friendly */}
            <div className="grid grid-cols-2 gap-3">
              {currentStep.status === 'pending' && (
                <>
                  <button onClick={() => doAction(currentStep.id, 'issue-materials')} disabled={acting}
                    className="col-span-1 py-4 rounded-xl bg-amber-600 hover:bg-amber-700 font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50">
                    <Package className="w-6 h-6" /> Entregar Materiales
                  </button>
                  <button onClick={() => doAction(currentStep.id, 'start')} disabled={acting}
                    className="col-span-1 py-4 rounded-xl bg-green-600 hover:bg-green-700 font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50">
                    <Play className="w-6 h-6" /> Iniciar
                  </button>
                </>
              )}

              {currentStep.status === 'materials_issued' && (
                <button onClick={() => doAction(currentStep.id, 'start')} disabled={acting}
                  className="col-span-2 py-5 rounded-xl bg-green-600 hover:bg-green-700 font-bold text-xl flex items-center justify-center gap-3 disabled:opacity-50">
                  {acting ? <Loader2 className="w-7 h-7 animate-spin" /> : <Play className="w-7 h-7" />}
                  INICIAR PASO
                </button>
              )}

              {currentStep.status === 'in_progress' && !pausedStep && (
                <>
                  <button onClick={() => doAction(currentStep.id, 'pause')} disabled={acting}
                    className="py-4 rounded-xl bg-amber-600 hover:bg-amber-700 font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50">
                    <Pause className="w-6 h-6" /> Pausar
                  </button>
                  <button onClick={() => doAction(currentStep.id, 'complete')} disabled={acting}
                    className="py-4 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50">
                    {acting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Square className="w-6 h-6" />}
                    Completar
                  </button>
                </>
              )}

              {pausedStep && (
                <>
                  <button onClick={() => doAction(currentStep.id, 'resume')} disabled={acting}
                    className="py-4 rounded-xl bg-green-600 hover:bg-green-700 font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50">
                    <Play className="w-6 h-6" /> Reanudar
                  </button>
                  <button onClick={() => doAction(currentStep.id, 'complete')} disabled={acting}
                    className="py-4 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50">
                    <Square className="w-6 h-6" /> Completar
                  </button>
                </>
              )}
            </div>

            {/* Secondary actions */}
            <div className="flex gap-2 mt-3">
              <button onClick={() => { setShowNoteModal(currentStep.id); setNoteText('') }}
                className="flex-1 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm flex items-center justify-center gap-2">
                <MessageSquare className="w-4 h-4" /> Agregar Nota
              </button>
              {currentStep.status === 'in_progress' && (
                <button onClick={() => doAction(currentStep.id, 'reject', { notes: 'Control de calidad' })}
                  className="flex-1 py-2.5 rounded-xl bg-red-900/30 hover:bg-red-900/50 text-red-400 text-sm flex items-center justify-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Rechazar (Calidad)
                </button>
              )}
            </div>

            {/* Operator notes */}
            {currentStep.operatorNotes && (
              <div className="mt-4 p-3 rounded-lg bg-gray-800 border border-gray-700">
                <p className="text-xs text-gray-400 mb-1">Notas del operario:</p>
                <p className="text-sm whitespace-pre-wrap">{currentStep.operatorNotes}</p>
              </div>
            )}
          </motion.div>
        )}

        {/* All steps completed */}
        {!currentStep && completedCount === steps.length && steps.length > 0 && (
          <div className="text-center py-12">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-2xl font-bold mb-2">Producción Completada</h2>
            <p className="text-gray-400">Todos los {steps.length} pasos han sido completados</p>
          </div>
        )}

        {/* Steps timeline */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            <Timer className="w-3.5 h-3.5 inline mr-1" /> Todos los pasos
          </p>
          {steps.map(step => {
            const Icon = STEP_ICONS[step.stepType] || Package
            const isActive = step.id === currentStep?.id
            const isCompleted = step.status === 'completed'

            return (
              <div key={step.id} className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all',
                isActive ? 'border-blue-500 bg-blue-900/20' :
                isCompleted ? 'border-green-900/30 bg-green-900/10' :
                'border-gray-800 bg-gray-900/50'
              )}>
                <div className={cn('p-1.5 rounded-lg',
                  isCompleted ? 'bg-green-900/30' : isActive ? 'bg-blue-900/30' : 'bg-gray-800')}>
                  {isCompleted ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Icon className={cn('w-4 h-4', isActive ? 'text-blue-400' : 'text-gray-500')} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium truncate', isCompleted ? 'text-green-400' : isActive ? 'text-white' : 'text-gray-500')}>
                    {step.stepNumber}. {step.description}
                  </p>
                </div>
                {isCompleted && step.actualTimeMinutes && (
                  <span className="text-xs text-green-400 shrink-0">{step.actualTimeMinutes} min</span>
                )}
                {isActive && !isCompleted && (
                  <span className="text-xs text-blue-400 shrink-0 animate-pulse">EN CURSO</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Note Modal */}
      <AnimatePresence>
        {showNoteModal !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70"
            onClick={() => setShowNoteModal(null)}>
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-gray-900 rounded-2xl p-5 border border-gray-700">
              <h3 className="font-bold mb-3">Agregar Nota</h3>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                rows={3}
                placeholder="Observación del operario..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm mb-3"
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={() => setShowNoteModal(null)} className="flex-1 py-2.5 rounded-xl bg-gray-800 text-sm">Cancelar</button>
                <button
                  onClick={async () => {
                    if (noteText.trim() && showNoteModal) {
                      await doAction(showNoteModal, 'add-note', { notes: noteText.trim() })
                      setShowNoteModal(null)
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm font-medium">Guardar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
