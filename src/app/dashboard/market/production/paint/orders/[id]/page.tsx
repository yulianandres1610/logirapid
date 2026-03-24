'use client'

import { useState, useEffect, use } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Factory, Loader2, CheckCircle2, Clock, FlaskConical,
  Palette, Box, Cog, Package, DollarSign, Beaker, Timer
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

const STEP_ICONS: Record<string, any> = {
  base_preparation: FlaskConical,
  tinting: Palette,
  packaging: Box
}
const STEP_COLORS: Record<string, string> = {
  base_preparation: 'amber',
  tinting: 'purple',
  packaging: 'blue'
}
const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300' },
  materials_issued: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  in_progress: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-blue-700 dark:text-orange-400' },
  completed: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
}

export default function PaintOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const router = useRouter()
  const resolvedParams = use(params)
  const orderId = resolvedParams.id

  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/market/production/paint/orders/${orderId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setOrder(d.data) })
      .finally(() => setLoading(false))
  }, [orderId])

  if (loading) return (
    <ProtectedRoute><DashboardLayout>
      <div className="flex items-center justify-center h-[80vh]"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
    </DashboardLayout></ProtectedRoute>
  )

  if (!order) return (
    <ProtectedRoute><DashboardLayout>
      <div className="p-6 text-center"><p className="text-gray-500">Orden no encontrada</p></div>
    </DashboardLayout></ProtectedRoute>
  )

  const fmtCost = (v: number) => '$' + v.toFixed(2)

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => router.back()} className={cn('p-2 rounded-xl', isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100')}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className={cn('text-2xl font-bold flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}>
                <Factory className="w-6 h-6 text-orange-500" /> {order.orderNumber}
              </h1>
              <p className="text-sm text-gray-500">
                {order.lines?.length || 0} productos · {order.steps?.length || 0} pasos
              </p>
            </div>
            <span className={cn('px-3 py-1.5 rounded-full text-sm font-medium',
              order.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
              order.status === 'in_progress' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
              order.status === 'planned' ? 'bg-orange-100 text-blue-700 dark:bg-orange-900/30 dark:text-orange-400' :
              'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            )}>
              {order.status === 'draft' ? 'Borrador' : order.status === 'planned' ? 'Planificada' :
               order.status === 'in_progress' ? 'En Producción' : order.status === 'completed' ? 'Completada' : order.status}
            </span>
            <button
              onClick={() => router.push(`/dashboard/market/production/paint/orders/${orderId}/floor`)}
              className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-medium text-sm flex items-center gap-2"
            >
              <Timer className="w-4 h-4" /> Vista de Piso
            </button>
          </div>

          {/* Cost Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Base', value: order.totalBaseCost, icon: FlaskConical, color: 'amber' },
              { label: 'Tintas', value: order.totalTintCost, icon: Palette, color: 'purple' },
              { label: 'Empaque', value: order.totalPackagingCost, icon: Box, color: 'blue' },
              { label: 'M.O.', value: order.totalLaborCost, icon: Cog, color: 'gray' },
              { label: 'TOTAL', value: order.totalCost, icon: DollarSign, color: 'green' },
            ].map(card => (
              <div key={card.label} className={cn('p-4 rounded-xl border text-center',
                isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
                <card.icon className={cn('w-5 h-5 mx-auto mb-1', `text-${card.color}-500`)} />
                <p className="text-xs text-gray-500">{card.label}</p>
                <p className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>{fmtCost(card.value)}</p>
              </div>
            ))}
          </div>

          {/* Lines */}
          <div className={cn('rounded-xl border mb-6', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className={cn('font-bold flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}>
                <Package className="w-5 h-5 text-orange-500" /> Productos ({order.lines.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {order.lines.map((line: any) => (
                <div key={line.id} className="p-4 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg border shadow-sm shrink-0" style={{ backgroundColor: line.hexColor || '#ccc' }} />
                  <div className="flex-1">
                    <p className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                      {line.colorName} — {line.packagingName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {line.quantityUnits.toLocaleString()} unidades · {line.totalWeightKg.toLocaleString()} kg · {line.baseTypeName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>{fmtCost(line.totalCost)}</p>
                    <p className="text-xs text-gray-500">{fmtCost(line.costPerUnit)}/ud</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Steps Timeline */}
          <div className={cn('rounded-xl border', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className={cn('font-bold flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}>
                <Timer className="w-5 h-5 text-amber-500" /> Pasos de Producción ({order.steps.length})
              </h2>
            </div>
            <div className="p-4 space-y-3">
              {order.steps.map((step: any) => {
                const StepIcon = STEP_ICONS[step.stepType] || Factory
                const color = STEP_COLORS[step.stepType] || 'gray'
                const statusStyle = STATUS_STYLES[step.status] || STATUS_STYLES.pending

                return (
                  <motion.div key={step.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    className={cn('p-4 rounded-xl border', isDark ? 'border-gray-700' : 'border-gray-200')}>
                    <div className="flex items-start gap-3">
                      <div className={cn('p-2 rounded-lg shrink-0', `bg-${color}-100 dark:bg-${color}-900/30`)}>
                        <StepIcon className={cn('w-5 h-5', `text-${color}-600 dark:text-${color}-400`)} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                            Paso {step.stepNumber}: {step.description}
                          </h3>
                          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusStyle.bg, statusStyle.text)}>
                            {step.status === 'pending' ? 'Pendiente' :
                             step.status === 'materials_issued' ? 'Materiales Entregados' :
                             step.status === 'in_progress' ? 'En Progreso' :
                             step.status === 'completed' ? 'Completado' : step.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                          {step.mixerName && <span className="flex items-center gap-1"><Cog className="w-3 h-3" /> {step.mixerName} ({step.mixerBatches} tanda{step.mixerBatches > 1 ? 's' : ''})</span>}
                          {step.weightKg > 0 && <span className="flex items-center gap-1"><Beaker className="w-3 h-3" /> {step.weightKg.toLocaleString()} kg</span>}
                          {step.quantityUnits > 0 && <span className="flex items-center gap-1"><Box className="w-3 h-3" /> {step.quantityUnits.toLocaleString()} uds</span>}
                          {step.estimatedTimeMinutes > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> ~{step.estimatedTimeMinutes} min</span>}
                          <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> {fmtCost(step.materialsCost + step.laborCost)}</span>
                        </div>

                        {/* Materials list */}
                        {step.materials.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {step.materials.map((mat: any, i: number) => (
                              <div key={i} className="flex justify-between text-xs">
                                <span className="text-gray-500">{mat.productName}</span>
                                <span className={cn('font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>
                                  {mat.quantityRequired.toLocaleString()} {mat.totalCost > 0 ? `· ${fmtCost(mat.totalCost)}` : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Time tracking */}
                        {step.status === 'completed' && step.actualTimeMinutes && (
                          <div className="mt-2 flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-xs text-green-600">
                              Completado en {step.actualTimeMinutes} min
                              {step.estimatedTimeMinutes ? ` (estimado: ${step.estimatedTimeMinutes} min)` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
