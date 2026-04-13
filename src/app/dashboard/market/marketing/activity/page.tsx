'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  Wifi,
  WifiOff,
  Cpu,
  Clock,
  Zap,
  Eye,
  Target,
  Megaphone,
  ShoppingBag,
  Shield,
  Wrench,
  RefreshCw,
  ArrowLeft,
  Circle,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface AgentActivity {
  id: number
  agentId: string
  name: string
  type: string
  status: string
  currentAction: string | null
  progress: number
  itemsProcessed: number
  lastUpdate: string
}

interface Event {
  id: number
  timestamp: string
  agentName: string
  message: string
  level: 'info' | 'success' | 'warning' | 'error'
}

interface KPIs {
  online: number
  working: number
  idle: number
  offline: number
  itemsProcessed: number
}

interface ActivityData {
  agents: AgentActivity[]
  events: Event[]
  kpis: KPIs
}

const TYPE_CONFIG: Record<string, { icon: any; color: string }> = {
  investigator: { icon: Eye, color: 'from-blue-500 to-blue-600' },
  strategist: { icon: Target, color: 'from-purple-500 to-purple-600' },
  seller: { icon: ShoppingBag, color: 'from-emerald-500 to-emerald-600' },
  publisher: { icon: Megaphone, color: 'from-amber-500 to-amber-600' },
  auditor: { icon: Shield, color: 'from-red-500 to-red-600' },
  custom: { icon: Wrench, color: 'from-gray-500 to-gray-600' }
}

const EVENT_LEVEL_CONFIG: Record<string, { icon: any; color: string; dotColor: string }> = {
  info: { icon: Info, color: 'text-blue-500', dotColor: 'bg-blue-500' },
  success: { icon: CheckCircle, color: 'text-emerald-500', dotColor: 'bg-emerald-500' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', dotColor: 'bg-amber-500' },
  error: { icon: AlertCircle, color: 'text-red-500', dotColor: 'bg-red-500' }
}

export default function ActivityPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const [data, setData] = useState<ActivityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const eventsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchActivity()
    const interval = setInterval(() => fetchActivity(true), 8000)
    return () => clearInterval(interval)
  }, [])

  const fetchActivity = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    try {
      const response = await fetch('/api/mkt/activity')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setData(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching activity:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl w-1/3" />
              <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
                  ))}
                </div>
                <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
              </div>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const kpis = data?.kpis || { online: 0, working: 0, idle: 0, offline: 0, itemsProcessed: 0 }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <Link href="/dashboard/market/marketing">
                <button className={cn(
                  'p-2 rounded-xl transition-colors',
                  theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                )}>
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </Link>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  Actividad en Tiempo Real
                  {refreshing && <RefreshCw className="w-4 h-4 animate-spin text-purple-500" />}
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" />
                  Auto-actualiza cada 8 segundos
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-gray-500 dark:text-gray-400">En vivo</span>
            </div>
          </motion.div>

          {/* KPI Strip */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(
              'rounded-2xl border p-4 shadow-sm',
              theme === 'dark' ? 'bg-gray-900 border-gray-700/50' : 'bg-white border-gray-200'
            )}
          >
            <div className="grid grid-cols-5 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Wifi className="w-4 h-4 text-green-500" />
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">{kpis.online}</span>
                </div>
                <p className="text-xs text-gray-500">Online</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Cpu className="w-4 h-4 text-blue-500" />
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">{kpis.working}</span>
                </div>
                <p className="text-xs text-gray-500">Trabajando</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">{kpis.idle}</span>
                </div>
                <p className="text-xs text-gray-500">Inactivo</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <WifiOff className="w-4 h-4 text-gray-400" />
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">{kpis.offline}</span>
                </div>
                <p className="text-xs text-gray-500">Offline</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Zap className="w-4 h-4 text-purple-500" />
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">{kpis.itemsProcessed.toLocaleString()}</span>
                </div>
                <p className="text-xs text-gray-500">Procesados</p>
              </div>
            </div>
          </motion.div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Agent Cards */}
            <div className="lg:col-span-2 space-y-4">
              <AnimatePresence mode="popLayout">
                {data?.agents?.map((agent, i) => {
                  const typeConf = TYPE_CONFIG[agent.type] || TYPE_CONFIG.custom
                  const AgentIcon = typeConf.icon

                  return (
                    <motion.div
                      key={agent.agentId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: i * 0.05 }}
                      layout
                      className={cn(
                        'rounded-2xl border overflow-hidden shadow-sm',
                        theme === 'dark' ? 'bg-gray-900 border-gray-700/50' : 'bg-white border-gray-200'
                      )}
                    >
                      {/* Gradient header */}
                      <div className={`bg-gradient-to-r ${typeConf.color} px-4 py-2.5 flex items-center justify-between`}>
                        <div className="flex items-center gap-2">
                          <AgentIcon className="w-4 h-4 text-white" />
                          <span className="font-semibold text-white text-sm">{agent.name}</span>
                          <span className="text-xs text-white/60">{agent.agentId}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${
                            agent.status === 'working' ? 'bg-green-400 animate-pulse' :
                            agent.status === 'idle' ? 'bg-amber-400' :
                            'bg-gray-400'
                          }`} />
                          <span className="text-xs text-white/80 capitalize">{agent.status}</span>
                        </div>
                      </div>

                      {/* Body */}
                      <div className="p-4">
                        {agent.currentAction && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                            <span className="text-gray-400 dark:text-gray-500">Accion: </span>
                            {agent.currentAction}
                          </p>
                        )}

                        {/* Progress Bar */}
                        <div className="mb-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500">Progreso</span>
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{agent.progress}%</span>
                          </div>
                          <div className={cn('h-2 rounded-full overflow-hidden', theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100')}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${agent.progress}%` }}
                              transition={{ duration: 0.5 }}
                              className={`h-full rounded-full bg-gradient-to-r ${typeConf.color}`}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>{agent.itemsProcessed} items procesados</span>
                          <span>{new Date(agent.lastUpdate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>

              {(!data?.agents || data.agents.length === 0) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-12 text-center text-gray-400"
                >
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-lg font-medium">Sin actividad</p>
                  <p className="text-sm">No hay agentes activos en este momento</p>
                </motion.div>
              )}
            </div>

            {/* Event Feed Sidebar */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className={cn(
                'rounded-2xl border shadow-sm flex flex-col max-h-[600px]',
                theme === 'dark' ? 'bg-gray-900 border-gray-700/50' : 'bg-white border-gray-200'
              )}
            >
              <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-500" />
                  Eventos
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {data?.events?.map((event, i) => {
                  const levelConf = EVENT_LEVEL_CONFIG[event.level] || EVENT_LEVEL_CONFIG.info

                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex gap-3"
                    >
                      <div className="flex flex-col items-center">
                        <div className={`w-2.5 h-2.5 rounded-full ${levelConf.dotColor} mt-1.5`} />
                        {i < (data?.events?.length || 0) - 1 && (
                          <div className={cn('w-px flex-1 mt-1', theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100')} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pb-3">
                        <p className="text-xs font-medium text-gray-900 dark:text-white">{event.agentName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{event.message}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(event.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                      </div>
                    </motion.div>
                  )
                })}
                {(!data?.events || data.events.length === 0) && (
                  <div className="py-8 text-center text-gray-400">
                    <Circle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Sin eventos recientes</p>
                  </div>
                )}
                <div ref={eventsEndRef} />
              </div>
            </motion.div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
