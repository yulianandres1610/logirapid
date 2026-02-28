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
  PackageCheck,
  TrendingUp,
  Zap,
  Target
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
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
  formulaUnit: string
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

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any; gradient: string }> = {
  draft: {
    label: 'Borrador',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-700',
    icon: Clock,
    gradient: 'from-gray-400 to-gray-500'
  },
  scheduled: {
    label: 'Programado',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    icon: CalendarIcon,
    gradient: 'from-blue-500 to-blue-600'
  },
  materials_issued: {
    label: 'Mat. Entregados',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    icon: Truck,
    gradient: 'from-amber-500 to-orange-500'
  },
  in_production: {
    label: 'En Producción',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    icon: Play,
    gradient: 'from-purple-500 to-violet-600'
  },
  completed: {
    label: 'Completado',
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    icon: CheckCircle,
    gradient: 'from-green-500 to-emerald-600'
  },
  cancelled: {
    label: 'Cancelado',
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    icon: X,
    gradient: 'from-red-500 to-red-600'
  }
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
}

export default function PlanningPage() {
  const router = useRouter()
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

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startDayOfWeek = firstDay.getDay()

    const days: { date: Date; isCurrentMonth: boolean }[] = []

    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false
      })
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      })
    }

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

  // Stats Cards Component
  const StatsCards = () => (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6"
    >
      {[
        { label: 'Total', value: stats.total, icon: Factory, color: 'blue', gradient: 'from-blue-500 to-blue-600' },
        { label: 'Borradores', value: stats.draft, icon: Clock, color: 'gray', gradient: 'from-gray-400 to-gray-500' },
        { label: 'Programados', value: stats.scheduled, icon: CalendarIcon, color: 'sky', gradient: 'from-sky-500 to-cyan-500' },
        { label: 'Mat. Entregados', value: stats.materialsIssued, icon: Truck, color: 'amber', gradient: 'from-amber-500 to-orange-500' },
        { label: 'En Producción', value: stats.inProduction, icon: Play, color: 'purple', gradient: 'from-purple-500 to-violet-600' },
        { label: 'Completados', value: stats.completed, icon: CheckCircle, color: 'green', gradient: 'from-green-500 to-emerald-600' },
      ].map((stat, index) => {
        const Icon = stat.icon
        return (
          <motion.div
            key={stat.label}
            variants={itemVariants}
            whileHover={{ scale: 1.02, y: -2 }}
            className={cn(
              "relative overflow-hidden rounded-xl p-4",
              "bg-white dark:bg-gray-800",
              "border border-gray-200 dark:border-gray-700",
              "shadow-sm hover:shadow-md transition-shadow"
            )}
          >
            <div className={cn(
              "absolute top-0 right-0 w-20 h-20 opacity-10",
              `bg-gradient-to-br ${stat.gradient}`,
              "rounded-bl-full"
            )} />
            <div className="relative">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center mb-2",
                `bg-gradient-to-br ${stat.gradient}`
              )}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <motion.p
                key={stat.value}
                initial={{ scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-2xl font-bold text-gray-900 dark:text-white"
              >
                {stat.value}
              </motion.p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )

  // Calendar Day Component
  const CalendarDay = ({ day, dateKey, dayPlans, isToday, isSelected, index }: any) => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.01 }}
      onClick={() => setSelectedDate(dateKey === selectedDate ? null : dateKey)}
      className={cn(
        "min-h-[110px] p-2 border-b border-r border-gray-200 dark:border-gray-700",
        "cursor-pointer transition-all duration-200",
        !day.isCurrentMonth && "bg-gray-50/50 dark:bg-gray-900/30",
        isToday && "bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-900/20 dark:to-sky-900/20",
        isSelected && "ring-2 ring-blue-500 ring-inset bg-blue-50/50 dark:bg-blue-900/10",
        "hover:bg-gray-50 dark:hover:bg-gray-700/30"
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={cn(
          "text-sm font-medium",
          !day.isCurrentMonth && "text-gray-400 dark:text-gray-600",
          isToday && "text-blue-600 font-bold"
        )}>
          {day.date.getDate()}
        </span>
        {isToday && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded"
          >
            HOY
          </motion.span>
        )}
      </div>
      <div className="space-y-1">
        <AnimatePresence>
          {dayPlans.slice(0, 3).map((plan: ProductionPlan, idx: number) => {
            const config = STATUS_CONFIG[plan.status] || STATUS_CONFIG.draft
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Link
                  href={`/dashboard/market/production/planning/${plan.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "block px-2 py-1 rounded-md text-xs font-medium truncate",
                    "transition-all hover:scale-[1.02]",
                    config.bgColor, config.color
                  )}
                >
                  <span className="flex items-center gap-1">
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      `bg-gradient-to-r ${config.gradient}`
                    )} />
                    {plan.formulaName}
                  </span>
                </Link>
              </motion.div>
            )
          })}
        </AnimatePresence>
        {dayPlans.length > 3 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[10px] text-gray-500 dark:text-gray-400 font-medium px-1"
          >
            +{dayPlans.length - 3} más
          </motion.div>
        )}
      </div>
    </motion.div>
  )

  // Plan Card for List View
  const PlanCard = ({ plan, index }: { plan: ProductionPlan; index: number }) => {
    const config = STATUS_CONFIG[plan.status] || STATUS_CONFIG.draft
    const StatusIcon = config.icon

    return (
      <motion.div
        variants={itemVariants}
        whileHover={{ scale: 1.01, y: -2 }}
        className={cn(
          "p-4 rounded-xl border transition-all",
          "bg-white dark:bg-gray-800",
          "border-gray-200 dark:border-gray-700",
          "hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800"
        )}
      >
        <div className="flex items-start gap-4">
          {/* Status Badge */}
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
            `bg-gradient-to-br ${config.gradient}`
          )}>
            <StatusIcon className="w-6 h-6 text-white" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                  {plan.formulaName}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {plan.targetProductName}
                </p>
              </div>
              <span className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0",
                config.bgColor, config.color
              )}>
                {config.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-mono text-blue-600 dark:text-blue-400 font-medium">
                {plan.planNumber}
              </span>
              <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <CalendarIcon className="w-3.5 h-3.5" />
                {new Date(plan.plannedDate).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'short'
                })}
              </span>
              <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Package className="w-3.5 h-3.5" />
                {plan.actualQuantity || plan.plannedQuantity} {plan.formulaUnit || 'unidades'}
              </span>
              {plan.lotNumber && (
                <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Target className="w-3.5 h-3.5" />
                  {plan.lotNumber}
                </span>
              )}
            </div>
          </div>

          {/* Action */}
          <Link
            href={`/dashboard/market/production/planning/${plan.id}`}
            className={cn(
              "p-2 rounded-lg transition-colors flex-shrink-0",
              "hover:bg-blue-50 dark:hover:bg-blue-900/30",
              "text-gray-400 hover:text-blue-600"
            )}
          >
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </motion.div>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6"
          >
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <CalendarIcon className="w-5 h-5 text-white" />
                </div>
                Planificación de Producción
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1 ml-[52px]">
                Programa y gestiona las órdenes de producción
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className={cn(
                "flex rounded-xl overflow-hidden border",
                "border-gray-200 dark:border-gray-700",
                "bg-gray-100 dark:bg-gray-800 p-1"
              )}>
                {[
                  { mode: 'calendar' as const, icon: LayoutGrid, label: 'Calendario' },
                  { mode: 'list' as const, icon: List, label: 'Lista' }
                ].map(({ mode, icon: Icon, label }) => (
                  <motion.button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      "p-2 rounded-lg transition-all flex items-center gap-2",
                      viewMode === mode
                        ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600"
                        : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium hidden sm:inline">{label}</span>
                  </motion.button>
                ))}
              </div>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => fetchPlans(true)}
                disabled={isRefreshing}
                className={cn(
                  "p-2.5 rounded-xl border transition-colors",
                  "border-gray-200 dark:border-gray-700",
                  "hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
              >
                <RefreshCw className={cn("w-5 h-5", isRefreshing && "animate-spin")} />
              </motion.button>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href="/dashboard/market/production/planning/create"
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all",
                    "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800",
                    "text-white shadow-lg shadow-blue-500/25"
                  )}
                >
                  <Plus className="w-5 h-5" />
                  <span className="hidden sm:inline">Nueva Planificación</span>
                </Link>
              </motion.div>
            </div>
          </motion.div>

          {/* Stats */}
          <StatsCards />

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-wrap items-center gap-3 mb-6"
          >
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterStatus('')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                  filterStatus === ''
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                )}
              >
                Todos
              </button>
              {Object.entries(STATUS_CONFIG).slice(0, -1).map(([key, config]) => {
                const Icon = config.icon
                return (
                  <button
                    key={key}
                    onClick={() => setFilterStatus(filterStatus === key ? '' : key)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5",
                      filterStatus === key
                        ? cn(config.bgColor, config.color)
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {config.label}
                  </button>
                )
              })}
            </div>
          </motion.div>

          {loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <RefreshCw className="w-10 h-10 text-blue-600" />
              </motion.div>
              <p className="mt-4 text-gray-500">Cargando planificaciones...</p>
            </motion.div>
          ) : viewMode === 'calendar' ? (
            /* Calendar View */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "rounded-2xl border overflow-hidden",
                "bg-white dark:bg-gray-800",
                "border-gray-200 dark:border-gray-700",
                "shadow-sm"
              )}
            >
              {/* Calendar Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-800">
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={prevMonth}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </motion.button>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white min-w-[220px] text-center">
                    {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </h2>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={nextMonth}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </motion.button>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={goToToday}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium",
                    "bg-blue-50 dark:bg-blue-900/30 text-blue-600",
                    "hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                  )}
                >
                  Hoy
                </motion.button>
              </div>

              {/* Week Days Header */}
              <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                {weekDays.map((day, i) => (
                  <div
                    key={day}
                    className={cn(
                      "p-3 text-center text-sm font-semibold",
                      i === 0 || i === 6 ? "text-gray-400" : "text-gray-600 dark:text-gray-400"
                    )}
                  >
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
                    <CalendarDay
                      key={index}
                      day={day}
                      dateKey={dateKey}
                      dayPlans={dayPlans}
                      isToday={isToday}
                      isSelected={isSelected}
                      index={index}
                    />
                  )
                })}
              </div>
            </motion.div>
          ) : (
            /* List View */
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {plans.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "text-center py-16 rounded-2xl border",
                    "bg-white dark:bg-gray-800",
                    "border-gray-200 dark:border-gray-700"
                  )}
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.2 }}
                  >
                    <CalendarIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                  </motion.div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    No hay planes este mes
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    Crea tu primera planificación de producción
                  </p>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Link
                      href="/dashboard/market/production/planning/create"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/25"
                    >
                      <Plus className="w-5 h-5" />
                      Nueva Planificación
                    </Link>
                  </motion.div>
                </motion.div>
              ) : (
                plans.map((plan, index) => (
                  <PlanCard key={plan.id} plan={plan} index={index} />
                ))
              )}
            </motion.div>
          )}

          {/* Selected Date Panel */}
          <AnimatePresence>
            {selectedDate && viewMode === 'calendar' && (
              <motion.div
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className={cn(
                  "fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-2xl p-5 rounded-2xl shadow-2xl border",
                  "bg-white dark:bg-gray-800",
                  "border-gray-200 dark:border-gray-700"
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                      {new Date(selectedDate).toLocaleDateString('es-ES', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long'
                      })}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {getPlansForDate(selectedDate).length} produccion(es) planificada(s)
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setSelectedDate(null)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </motion.button>
                </div>

                <div className="space-y-2 max-h-60 overflow-auto">
                  {getPlansForDate(selectedDate).length === 0 ? (
                    <div className="text-center py-8">
                      <CalendarIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-500">No hay producciones planificadas</p>
                    </div>
                  ) : (
                    getPlansForDate(selectedDate).map((plan, index) => {
                      const config = STATUS_CONFIG[plan.status] || STATUS_CONFIG.draft
                      const Icon = config.icon
                      return (
                        <motion.div
                          key={plan.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <Link
                            href={`/dashboard/market/production/planning/${plan.id}`}
                            className={cn(
                              "flex items-center gap-4 p-4 rounded-xl transition-all",
                              "hover:bg-gray-50 dark:hover:bg-gray-700/50",
                              "border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                            )}
                          >
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center",
                              `bg-gradient-to-br ${config.gradient}`
                            )}>
                              <Icon className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white truncate">
                                {plan.formulaName}
                              </p>
                              <p className="text-sm text-gray-500 truncate">
                                {plan.planNumber} • {plan.plannedQuantity} {plan.formulaUnit || 'unidades'}
                              </p>
                            </div>
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs font-medium",
                              config.bgColor, config.color
                            )}>
                              {config.label}
                            </span>
                          </Link>
                        </motion.div>
                      )
                    })
                  )}
                </div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
                >
                  <Link
                    href={`/dashboard/market/production/planning/create?date=${selectedDate}`}
                    className={cn(
                      "flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium w-full",
                      "bg-gradient-to-r from-blue-600 to-blue-700 text-white",
                      "hover:from-blue-700 hover:to-blue-800 transition-all",
                      "shadow-lg shadow-blue-500/25"
                    )}
                  >
                    <Plus className="w-5 h-5" />
                    Planificar para este día
                  </Link>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
