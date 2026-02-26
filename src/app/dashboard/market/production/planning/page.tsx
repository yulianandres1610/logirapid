'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  List,
  LayoutGrid,
  Clock,
  Play,
  CheckCircle,
  X,
  Package,
  Eye,
  Factory,
  AlertCircle,
  Truck,
  PackageCheck
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface ProductionPlan {
  id: number
  planNumber: string
  formulaId: number
  formulaCode: string
  formulaName: string
  targetProductName: string
  targetProductImage: string | null
  warehouseName: string
  plannedDate: string
  plannedQuantity: number
  status: string
  lotNumber: string | null
  actualQuantity: number | null
  totalCost: number
  costPerUnit: number | null
  createdAt: string
}

interface Stats {
  total: number
  draft: number
  scheduled: number
  materialsIssued: number
  inProduction: number
  completed: number
  today: number
  thisWeek: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  draft: { label: 'Borrador', color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-700', icon: Clock },
  scheduled: { label: 'Programado', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', icon: CalendarIcon },
  materials_issued: { label: 'Mat. Entregados', color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30', icon: Truck },
  in_production: { label: 'En Producción', color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30', icon: Play },
  completed: { label: 'Completado', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', icon: X }
}

export default function PlanningPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const [plans, setPlans] = useState<ProductionPlan[]>([])
  const [stats, setStats] = useState<Stats>({
    total: 0, draft: 0, scheduled: 0, materialsIssued: 0,
    inProduction: 0, completed: 0, today: 0, thisWeek: 0
  })
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('')

  // Get current month string
  const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`

  useEffect(() => {
    fetchPlans()
  }, [currentMonth, filterStatus])

  const fetchPlans = async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const params = new URLSearchParams({
        month: currentMonth,
        limit: '100'
      })
      if (filterStatus) params.set('status', filterStatus)

      const response = await fetch(`/api/market/production/plans?${params}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setPlans(data.data.plans)
          setStats(data.data.stats)
        }
      }
    } catch (error) {
      console.error('Error fetching plans:', error)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startDayOfWeek = firstDay.getDay()

    const days: { date: Date; isCurrentMonth: boolean }[] = []

    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false
      })
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      })
    }

    // Next month days
    const remainingDays = 42 - days.length
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      })
    }

    return days
  }

  const formatDateKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  const getPlansForDate = (dateKey: string) => {
    return plans.filter(p => p.plannedDate.split('T')[0] === dateKey)
  }

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value)
  }

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const today = formatDateKey(new Date())
  const calendarDays = getDaysInMonth(currentDate)

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CalendarIcon className="w-7 h-7 text-blue-600" />
                Planificación de Producción
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Programa y gestiona las órdenes de producción
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className={cn(
                "flex rounded-lg border",
                "border-gray-200 dark:border-gray-700"
              )}>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={cn(
                    "p-2 transition-colors",
                    viewMode === 'calendar'
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "p-2 transition-colors",
                    viewMode === 'list'
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={() => fetchPlans(true)}
                disabled={isRefreshing}
                className={cn(
                  "p-2 rounded-lg border transition-colors",
                  "border-gray-200 dark:border-gray-700",
                  "hover:bg-gray-100 dark:hover:bg-gray-800",
                  isRefreshing && "animate-spin"
                )}
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <Link
                href="/dashboard/market/production/planning/create"
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
                  "bg-blue-600 hover:bg-blue-700 text-white"
                )}
              >
                <Plus className="w-5 h-5" />
                Nueva Planificación
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
            <div className={cn("p-3 rounded-lg border", "bg-white dark:bg-gray-800", "border-gray-200 dark:border-gray-700")}>
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
            <div className={cn("p-3 rounded-lg border", "bg-gray-50 dark:bg-gray-800", "border-gray-200 dark:border-gray-700")}>
              <p className="text-xs text-gray-500">Borradores</p>
              <p className="text-xl font-bold text-gray-600">{stats.draft}</p>
            </div>
            <div className={cn("p-3 rounded-lg border", "bg-blue-50 dark:bg-blue-900/20", "border-blue-200 dark:border-blue-800")}>
              <p className="text-xs text-blue-600">Programados</p>
              <p className="text-xl font-bold text-blue-600">{stats.scheduled}</p>
            </div>
            <div className={cn("p-3 rounded-lg border", "bg-amber-50 dark:bg-amber-900/20", "border-amber-200 dark:border-amber-800")}>
              <p className="text-xs text-amber-600">Mat. Entregados</p>
              <p className="text-xl font-bold text-amber-600">{stats.materialsIssued}</p>
            </div>
            <div className={cn("p-3 rounded-lg border", "bg-purple-50 dark:bg-purple-900/20", "border-purple-200 dark:border-purple-800")}>
              <p className="text-xs text-purple-600">En Producción</p>
              <p className="text-xl font-bold text-purple-600">{stats.inProduction}</p>
            </div>
            <div className={cn("p-3 rounded-lg border", "bg-green-50 dark:bg-green-900/20", "border-green-200 dark:border-green-800")}>
              <p className="text-xs text-green-600">Completados</p>
              <p className="text-xl font-bold text-green-600">{stats.completed}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 mb-6">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={cn(
                "px-4 py-2 rounded-lg border",
                "bg-white dark:bg-gray-800",
                "border-gray-200 dark:border-gray-700"
              )}
            >
              <option value="">Todos los estados</option>
              <option value="draft">Borradores</option>
              <option value="scheduled">Programados</option>
              <option value="materials_issued">Mat. Entregados</option>
              <option value="in_production">En Producción</option>
              <option value="completed">Completados</option>
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : viewMode === 'calendar' ? (
            /* Calendar View */
            <div className={cn(
              "rounded-xl border overflow-hidden",
              "bg-white dark:bg-gray-800",
              "border-gray-200 dark:border-gray-700"
            )}>
              {/* Calendar Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <button
                    onClick={prevMonth}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white min-w-[200px] text-center">
                    {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </h2>
                  <button
                    onClick={nextMonth}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                <button
                  onClick={goToToday}
                  className={cn(
                    "px-3 py-1 rounded-lg text-sm font-medium",
                    "border border-gray-200 dark:border-gray-700",
                    "hover:bg-gray-100 dark:hover:bg-gray-700"
                  )}
                >
                  Hoy
                </button>
              </div>

              {/* Week Days Header */}
              <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
                {weekDays.map(day => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-gray-600 dark:text-gray-400">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, index) => {
                  const dateKey = formatDateKey(day.date)
                  const dayPlans = getPlansForDate(dateKey)
                  const isToday = dateKey === today
                  const isSelected = dateKey === selectedDate

                  return (
                    <div
                      key={index}
                      onClick={() => setSelectedDate(dateKey === selectedDate ? null : dateKey)}
                      className={cn(
                        "min-h-[100px] p-2 border-b border-r border-gray-200 dark:border-gray-700 cursor-pointer transition-colors",
                        !day.isCurrentMonth && "bg-gray-50 dark:bg-gray-900/50",
                        isToday && "bg-blue-50 dark:bg-blue-900/20",
                        isSelected && "ring-2 ring-blue-500 ring-inset",
                        "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      )}
                    >
                      <div className={cn(
                        "text-sm font-medium mb-1",
                        !day.isCurrentMonth && "text-gray-400",
                        isToday && "text-blue-600 font-bold"
                      )}>
                        {day.date.getDate()}
                      </div>
                      <div className="space-y-1">
                        {dayPlans.slice(0, 3).map(plan => {
                          const config = STATUS_CONFIG[plan.status] || STATUS_CONFIG.draft
                          return (
                            <Link
                              key={plan.id}
                              href={`/dashboard/market/production/planning/${plan.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className={cn(
                                "block px-1.5 py-0.5 rounded text-xs truncate",
                                config.bgColor, config.color
                              )}
                            >
                              {plan.formulaName}
                            </Link>
                          )
                        })}
                        {dayPlans.length > 3 && (
                          <div className="text-xs text-gray-500 px-1">
                            +{dayPlans.length - 3} más
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* List View */
            <div className={cn(
              "rounded-xl border overflow-hidden",
              "bg-white dark:bg-gray-800",
              "border-gray-200 dark:border-gray-700"
            )}>
              {plans.length === 0 ? (
                <div className="text-center py-12">
                  <CalendarIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No hay planes este mes
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Crea tu primera planificación de producción
                  </p>
                  <Link
                    href="/dashboard/market/production/planning/create"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-5 h-5" />
                    Nueva Planificación
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400">Plan</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400">Fórmula</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hidden md:table-cell">Fecha</th>
                        <th className="text-center px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hidden sm:table-cell">Cantidad</th>
                        <th className="text-center px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400">Estado</th>
                        <th className="text-center px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {plans.map((plan, index) => {
                        const config = STATUS_CONFIG[plan.status] || STATUS_CONFIG.draft
                        const StatusIcon = config.icon

                        return (
                          <motion.tr
                            key={plan.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          >
                            <td className="px-4 py-3">
                              <p className="font-mono text-sm text-blue-600 dark:text-blue-400 font-medium">
                                {plan.planNumber}
                              </p>
                              {plan.lotNumber && (
                                <p className="text-xs text-gray-500">Lote: {plan.lotNumber}</p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900 dark:text-white">{plan.formulaName}</p>
                              <p className="text-sm text-gray-500 truncate max-w-[200px]">{plan.targetProductName}</p>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                {new Date(plan.plannedDate).toLocaleDateString('es-ES', {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short'
                                })}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-center hidden sm:table-cell">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {plan.actualQuantity || plan.plannedQuantity}
                              </p>
                              {plan.actualQuantity && plan.actualQuantity !== plan.plannedQuantity && (
                                <p className="text-xs text-gray-500">
                                  Plan: {plan.plannedQuantity}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={cn(
                                "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                                config.bgColor, config.color
                              )}>
                                <StatusIcon className="w-3 h-3" />
                                {config.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                <Link
                                  href={`/dashboard/market/production/planning/${plan.id}`}
                                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                  title="Ver detalle"
                                >
                                  <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                </Link>
                              </div>
                            </td>
                          </motion.tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Selected Date Panel */}
          <AnimatePresence>
            {selectedDate && viewMode === 'calendar' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className={cn(
                  "fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-2xl p-4 rounded-xl shadow-lg border",
                  "bg-white dark:bg-gray-800",
                  "border-gray-200 dark:border-gray-700"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {new Date(selectedDate).toLocaleDateString('es-ES', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </h3>
                  <button onClick={() => setSelectedDate(null)}>
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                <div className="space-y-2 max-h-60 overflow-auto">
                  {getPlansForDate(selectedDate).length === 0 ? (
                    <p className="text-gray-500 text-center py-4">
                      No hay producciones planificadas
                    </p>
                  ) : (
                    getPlansForDate(selectedDate).map(plan => {
                      const config = STATUS_CONFIG[plan.status] || STATUS_CONFIG.draft
                      return (
                        <Link
                          key={plan.id}
                          href={`/dashboard/market/production/planning/${plan.id}`}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg transition-colors",
                            "hover:bg-gray-50 dark:hover:bg-gray-700"
                          )}
                        >
                          <div className={cn("p-2 rounded-lg", config.bgColor)}>
                            <Factory className={cn("w-5 h-5", config.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {plan.formulaName}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                              {plan.planNumber} • {plan.plannedQuantity} unidades
                            </p>
                          </div>
                          <span className={cn(
                            "px-2 py-1 rounded-full text-xs font-medium",
                            config.bgColor, config.color
                          )}>
                            {config.label}
                          </span>
                        </Link>
                      )
                    })
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <Link
                    href={`/dashboard/market/production/planning/create?date=${selectedDate}`}
                    className={cn(
                      "flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium w-full",
                      "bg-blue-600 hover:bg-blue-700 text-white"
                    )}
                  >
                    <Plus className="w-5 h-5" />
                    Planificar para este día
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
