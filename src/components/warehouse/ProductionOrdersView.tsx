'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Factory,
  ArrowLeft,
  Calendar,
  Package,
  Truck,
  PlayCircle,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  ChevronRight,
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface ProductionPlan {
  id: number
  plan_number: string
  formula_name: string
  target_product_name: string
  target_product_sku: string
  planned_date: string
  planned_quantity: number
  yield_unit: string
  status: string
  materials_count: number
  warehouse_name: string
}

interface ProductionOrdersViewProps {
  warehouseId: number
  warehouseName: string
  onBack: () => void
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; action: string }> = {
  scheduled: {
    label: 'Programado',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    action: 'Entregar Materiales'
  },
  materials_issued: {
    label: 'Materiales Entregados',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    action: 'Iniciar Producción'
  },
  in_production: {
    label: 'En Producción',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    action: 'Completar Producción'
  }
}

export default function ProductionOrdersView({ warehouseId, warehouseName, onBack }: ProductionOrdersViewProps) {
  const [plans, setPlans] = useState<ProductionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'materials_issued' | 'in_production'>('all')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchPlans()
  }, [warehouseId])

  const fetchPlans = async () => {
    try {
      const response = await fetch(`/api/market/production/plans?warehouseId=${warehouseId}&status=scheduled,materials_issued,in_production`)
      const data = await response.json()

      if (data.success) {
        setPlans(data.data.plans || [])
      } else {
        setError(data.error || 'Error al cargar planes')
      }
    } catch (error) {
      console.error('Error:', error)
      setError('Error al cargar planes de producción')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (plan: ProductionPlan) => {
    setActionLoading(plan.id)

    try {
      let endpoint = ''
      let method = 'POST'
      let body: any = {}

      switch (plan.status) {
        case 'scheduled':
          endpoint = `/api/market/production/plans/${plan.id}/issue-materials`
          break
        case 'materials_issued':
          endpoint = `/api/market/production/plans/${plan.id}/start`
          break
        case 'in_production':
          // For completion, redirect to detail page for quantity input
          window.location.href = `/dashboard/market/production/planning/${plan.id}`
          return
        default:
          return
      }

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(data.message)
        fetchPlans()
      } else {
        setError(data.error)
      }
    } catch (error) {
      setError('Error al procesar la acción')
    } finally {
      setActionLoading(null)
    }
  }

  const filteredPlans = filter === 'all'
    ? plans
    : plans.filter(p => p.status === filter)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short'
    })
  }

  const counts = {
    all: plans.length,
    scheduled: plans.filter(p => p.status === 'scheduled').length,
    materials_issued: plans.filter(p => p.status === 'materials_issued').length,
    in_production: plans.filter(p => p.status === 'in_production').length
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className={cn(
            "p-2 rounded-lg border transition-colors",
            "border-gray-200 dark:border-gray-700",
            "hover:bg-gray-100 dark:hover:bg-gray-800"
          )}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Factory className="w-6 h-6 text-violet-600" />
            Órdenes de Producción
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {warehouseName} • {plans.length} órdenes pendientes
          </p>
        </div>
        <button
          onClick={fetchPlans}
          disabled={loading}
          className={cn(
            "p-2 rounded-lg border transition-colors",
            "border-gray-200 dark:border-gray-700",
            "hover:bg-gray-100 dark:hover:bg-gray-800"
          )}
        >
          <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
        </button>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-600">×</button>
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <span className="text-green-700 dark:text-green-300 text-sm">{success}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {[
          { key: 'all' as const, label: 'Todos' },
          { key: 'scheduled' as const, label: 'Por Entregar' },
          { key: 'materials_issued' as const, label: 'Por Iniciar' },
          { key: 'in_production' as const, label: 'En Producción' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              filter === tab.key
                ? "bg-violet-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            )}
          >
            {tab.label}
            {counts[tab.key] > 0 && (
              <span className={cn(
                "ml-2 px-1.5 py-0.5 rounded text-xs",
                filter === tab.key
                  ? "bg-white/20"
                  : "bg-violet-100 dark:bg-violet-900/30 text-violet-600"
              )}>
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Plans List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="text-center py-12">
          <Factory className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">No hay órdenes de producción pendientes</p>
          <Link
            href="/dashboard/market/production/planning/create"
            className="inline-flex items-center gap-2 mt-4 text-violet-600 hover:underline"
          >
            Crear nuevo plan de producción
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filteredPlans.map((plan, index) => {
              const config = statusConfig[plan.status]
              const isToday = new Date(plan.planned_date).toDateString() === new Date().toDateString()
              const isPast = new Date(plan.planned_date) < new Date() && !isToday

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "p-4 rounded-xl border",
                    "bg-white dark:bg-gray-800",
                    "border-gray-200 dark:border-gray-700",
                    isPast && "border-l-4 border-l-red-500"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">
                          {plan.plan_number}
                        </span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          config.bgColor,
                          config.color
                        )}>
                          {config.label}
                        </span>
                        {isPast && (
                          <span className="flex items-center gap-1 text-xs text-red-600">
                            <AlertTriangle className="w-3 h-3" />
                            Atrasado
                          </span>
                        )}
                      </div>

                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {plan.target_product_name}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {plan.formula_name}
                      </p>

                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(plan.planned_date)}
                          {isToday && <span className="text-green-600 font-medium">Hoy</span>}
                        </span>
                        <span className="flex items-center gap-1">
                          <Package className="w-4 h-4" />
                          {plan.planned_quantity} {plan.yield_unit}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {plan.materials_count} materiales
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <button
                        onClick={() => handleAction(plan)}
                        disabled={actionLoading === plan.id}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors",
                          plan.status === 'scheduled' && "bg-blue-600 hover:bg-blue-700 text-white",
                          plan.status === 'materials_issued' && "bg-orange-600 hover:bg-orange-700 text-white",
                          plan.status === 'in_production' && "bg-green-600 hover:bg-green-700 text-white",
                          actionLoading === plan.id && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {actionLoading === plan.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : plan.status === 'scheduled' ? (
                          <Truck className="w-4 h-4" />
                        ) : plan.status === 'materials_issued' ? (
                          <PlayCircle className="w-4 h-4" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        {config.action}
                      </button>

                      <Link
                        href={`/dashboard/market/production/planning/${plan.id}`}
                        className="text-xs text-violet-600 hover:underline"
                      >
                        Ver detalles
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
