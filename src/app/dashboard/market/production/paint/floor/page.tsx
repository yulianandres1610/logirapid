'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Factory, Timer, Play, CheckCircle2, Clock, Pause, Package, FlaskConical, Palette, Box } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface PaintOrder {
  id: number; orderNumber: string; status: string; plannedDate: string | null
  lineCount: number; totalUnits: number; stepCount: number; completedSteps: number
  totalCost: number; createdAt: string
}

const STEP_ICONS: Record<string, any> = { base_preparation: FlaskConical, tinting: Palette, packaging: Box }

export default function PaintFloorListPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const router = useRouter()

  const [orders, setOrders] = useState<PaintOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/market/production/paint/orders')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          // Only show planned and in_progress orders
          setOrders(d.data.filter((o: PaintOrder) => ['planned', 'in_progress'].includes(o.status)))
        }
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className={cn('text-2xl font-bold flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}>
              <Timer className="w-6 h-6 text-orange-500" /> Piso de Producción
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Selecciona una orden para controlar los tiempos de cada paso
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : orders.length === 0 ? (
            <div className={cn('text-center py-20 rounded-2xl border', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50')}>
              <Factory className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 font-medium">No hay órdenes activas</p>
              <p className="text-sm text-gray-400 mt-1">Las órdenes planificadas o en producción aparecerán aquí</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map(order => {
                const progress = order.stepCount > 0 ? Math.round(order.completedSteps / order.stepCount * 100) : 0
                const isInProgress = order.status === 'in_progress'

                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'rounded-2xl border overflow-hidden',
                      isInProgress
                        ? isDark ? 'border-orange-500/50 bg-orange-900/10' : 'border-orange-300 bg-orange-50/50'
                        : isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
                    )}
                  >
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={cn('p-2.5 rounded-xl', isInProgress ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-gray-100 dark:bg-gray-700')}>
                            {isInProgress
                              ? <Play className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                              : <Clock className="w-5 h-5 text-gray-500" />
                            }
                          </div>
                          <div>
                            <h3 className={cn('font-bold text-lg', isDark ? 'text-white' : 'text-gray-900')}>
                              {order.orderNumber}
                            </h3>
                            <p className="text-xs text-gray-500">
                              {order.lineCount} producto{order.lineCount > 1 ? 's' : ''} · {order.totalUnits?.toLocaleString()} unidades
                              {order.plannedDate && ` · ${new Date(order.plannedDate).toLocaleDateString('es-ES')}`}
                            </p>
                          </div>
                        </div>

                        <span className={cn('text-xs px-3 py-1.5 rounded-full font-medium',
                          isInProgress
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        )}>
                          {isInProgress ? 'En Producción' : 'Planificada'}
                        </span>
                      </div>

                      {/* Progress */}
                      <div className="mb-4">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{order.completedSteps} de {order.stepCount} pasos completados</span>
                          <span>{progress}%</span>
                        </div>
                        <div className={cn('h-2.5 rounded-full overflow-hidden', isDark ? 'bg-gray-700' : 'bg-gray-200')}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5 }}
                            className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
                          />
                        </div>
                      </div>

                      {/* Action button */}
                      <button
                        onClick={() => router.push(`/dashboard/market/production/paint/orders/${order.id}/floor`)}
                        className={cn(
                          'w-full py-3.5 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all',
                          isInProgress
                            ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white'
                            : 'bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white'
                        )}
                      >
                        <Timer className="w-5 h-5" />
                        {isInProgress ? 'Continuar Producción' : 'Iniciar Producción'}
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}

          {/* Help text */}
          <div className={cn('mt-8 p-4 rounded-xl border', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50')}>
            <h4 className={cn('font-bold text-sm mb-2', isDark ? 'text-white' : 'text-gray-900')}>¿Cómo funciona?</h4>
            <div className="space-y-2 text-sm text-gray-500">
              <p className="flex items-center gap-2"><span className="w-5 h-5 rounded bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xs font-bold text-amber-600">1</span> <strong>Entregar materiales</strong> — El almacén entrega las materias primas del paso</p>
              <p className="flex items-center gap-2"><span className="w-5 h-5 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs font-bold text-green-600">2</span> <strong>Iniciar paso</strong> — Empieza el cronómetro automáticamente</p>
              <p className="flex items-center gap-2"><span className="w-5 h-5 rounded bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-xs font-bold text-orange-600">3</span> <strong>Pausar / Reanudar</strong> — Si necesita parar, el tiempo de pausa se resta</p>
              <p className="flex items-center gap-2"><span className="w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-bold text-blue-600">4</span> <strong>Completar paso</strong> — Registra el tiempo real y avanza al siguiente</p>
              <p className="flex items-center gap-2"><span className="w-5 h-5 rounded bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xs font-bold text-red-600">!</span> <strong>Rechazar (Calidad)</strong> — Si la mezcla no pasa control de calidad</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
