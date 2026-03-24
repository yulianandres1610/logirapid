'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Loader2, Factory, Clock, CheckCircle2, FileText, Package } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface PaintOrder {
  id: number; orderNumber: string; status: string; plannedDate: string | null
  lineCount: number; totalUnits: number; stepCount: number; completedSteps: number
  totalCost: number; notes: string | null; createdAt: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; darkColor: string; icon: any }> = {
  draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-700', darkColor: 'bg-gray-700 text-gray-300', icon: FileText },
  planned: { label: 'Planificada', color: 'bg-orange-100 text-blue-700', darkColor: 'bg-orange-900/30 text-orange-400', icon: Clock },
  in_progress: { label: 'En Producción', color: 'bg-amber-100 text-amber-700', darkColor: 'bg-amber-900/30 text-amber-400', icon: Factory },
  completed: { label: 'Completada', color: 'bg-green-100 text-green-700', darkColor: 'bg-green-900/30 text-green-400', icon: CheckCircle2 },
}

export default function PaintOrdersPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const router = useRouter()

  const [orders, setOrders] = useState<PaintOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/market/production/paint/orders')
      .then(r => r.json())
      .then(d => { if (d.success) setOrders(d.data) })
      .finally(() => setLoading(false))
  }, [])

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Órdenes de Producción de Pintura</h1>
              <p className="text-sm text-gray-500">Fabricación con cálculo automático de bases, tintas y empaque</p>
            </div>
            <button
              onClick={() => router.push('/dashboard/market/production/paint/orders/create')}
              className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium text-sm"
            >
              <Plus className="w-4 h-4" /> Nueva Orden
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
          ) : orders.length === 0 ? (
            <div className={cn('text-center py-20 rounded-2xl border', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50')}>
              <Factory className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 font-medium">No hay órdenes de producción</p>
              <p className="text-sm text-gray-400 mt-1">Crea una orden para empezar a fabricar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map(order => {
                const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.draft
                const StatusIcon = cfg.icon
                const progress = order.stepCount > 0 ? Math.round(order.completedSteps / order.stepCount * 100) : 0

                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => router.push(`/dashboard/market/production/paint/orders/${order.id}`)}
                    className={cn('p-5 rounded-xl border cursor-pointer transition-all hover:shadow-md',
                      isDark ? 'border-gray-700 bg-gray-800 hover:border-gray-600' : 'border-gray-200 bg-white hover:border-gray-300')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn('p-2.5 rounded-xl', isDark ? 'bg-orange-900/30' : 'bg-orange-100')}>
                          <Factory className={cn('w-5 h-5', isDark ? 'text-orange-400' : 'text-orange-600')} />
                        </div>
                        <div>
                          <h3 className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>{order.orderNumber}</h3>
                          <p className="text-xs text-gray-500">
                            {order.lineCount} color{order.lineCount !== 1 ? 'es' : ''} · {order.totalUnits?.toLocaleString()} unidades
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {order.totalCost > 0 && (
                          <span className={cn('text-sm font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                            ${order.totalCost.toFixed(2)}
                          </span>
                        )}
                        <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1',
                          isDark ? cfg.darkColor : cfg.color)}>
                          <StatusIcon className="w-3 h-3" /> {cfg.label}
                        </span>
                      </div>
                    </div>

                    {order.stepCount > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>{order.completedSteps}/{order.stepCount} pasos</span>
                          <span>{progress}%</span>
                        </div>
                        <div className={cn('h-1.5 rounded-full overflow-hidden', isDark ? 'bg-gray-700' : 'bg-gray-200')}>
                          <div className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all"
                            style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
