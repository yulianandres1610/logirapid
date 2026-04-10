'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, Loader2, RefreshCw, Wifi, WifiOff, Search, ShoppingCart,
  TrendingUp, Zap, Clock, CheckCircle, AlertCircle, XCircle, Radio
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface AgentLive {
  agentId: string; name: string; channel: string; role: string
  isOnline: boolean; currentStatus: string; currentAction: string | null
  currentDetails: string | null; currentProgress: number
  lastActivityAt: string | null; totalSales: number; totalOrders: number
}

interface ActivityEntry {
  agentId: string; agentName: string; channel: string
  status: string; action: string; details: string | null
  progress: number; createdAt: string
}

interface ActivityData {
  agents: AgentLive[]
  activityLog: ActivityEntry[]
  summary: { totalAgents: number; online: number; working: number; idle: number; offline: number }
}

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: typeof Search }> = {
  research: { label: 'Investigador', color: 'blue', icon: Search },
  sales: { label: 'Ventas', color: 'emerald', icon: ShoppingCart },
  campaign: { label: 'Campañas', color: 'purple', icon: Zap },
  analyst: { label: 'Analista', color: 'amber', icon: TrendingUp }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle; pulse: boolean }> = {
  working: { label: 'Trabajando', color: 'emerald', icon: Activity, pulse: true },
  idle: { label: 'En espera', color: 'amber', icon: Clock, pulse: false },
  error: { label: 'Error', color: 'red', icon: XCircle, pulse: false },
  offline: { label: 'Desconectado', color: 'gray', icon: WifiOff, pulse: false }
}

function timeAgo(date: string | null) {
  if (!date) return 'Nunca'
  const diff = Date.now() - new Date(date).getTime()
  if (diff < 60000) return 'Hace un momento'
  if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`
  if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)}h`
  return `Hace ${Math.floor(diff / 86400000)}d`
}

export default function AgentActivityPage() {
  const { theme } = useTheme()
  const [data, setData] = useState<ActivityData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch('/api/marketing-intel/agent-activity')
      const json = await res.json()
      if (json.success) setData(json.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh every 10 seconds for real-time feel
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 10000)
    return () => clearInterval(interval)
  }, [fetchData])

  const summary = data?.summary || { totalAgents: 0, online: 0, working: 0, idle: 0, offline: 0 }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 sm:p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600">
                <Radio className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Actividad en Tiempo Real
                </h1>
                <p className="text-gray-500 text-sm">Monitoreo de agentes OpenClaw</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">En vivo</span>
              </div>
              <button onClick={() => fetchData(true)}
                className={cn('p-2 rounded-xl transition-colors', theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200')}>
                <RefreshCw className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Status Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Total', value: summary.totalAgents, color: 'gray' },
              { label: 'Online', value: summary.online, color: 'emerald' },
              { label: 'Trabajando', value: summary.working, color: 'blue' },
              { label: 'En espera', value: summary.idle, color: 'amber' },
              { label: 'Offline', value: summary.offline, color: 'gray' },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={cn('p-3 rounded-xl border text-center', theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </motion.div>
            ))}
          </div>

          {loading && !data ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Agent Cards - 2/3 width */}
              <div className="lg:col-span-2 space-y-4">
                <h2 className={cn('font-semibold text-lg', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Agentes ({data?.agents.length || 0})
                </h2>

                {data?.agents.length === 0 && (
                  <div className={cn('p-8 rounded-xl border text-center', theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                    <WifiOff className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">No hay agentes registrados</p>
                    <p className="text-gray-400 text-sm mt-1">Conecta agentes desde Configuración</p>
                  </div>
                )}

                <AnimatePresence>
                  {data?.agents.map((agent, i) => {
                    const role = ROLE_CONFIG[agent.role] || ROLE_CONFIG.sales
                    const status = STATUS_CONFIG[agent.currentStatus] || STATUS_CONFIG.offline
                    const StatusIcon = status.icon

                    return (
                      <motion.div key={agent.agentId}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                        className={cn('p-4 rounded-xl border', theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                        <div className="flex items-start gap-4">
                          {/* Avatar with status indicator */}
                          <div className="relative shrink-0">
                            <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center',
                              `bg-${role.color}-100 dark:bg-${role.color}-900/30`)}>
                              <role.icon className={`w-6 h-6 text-${role.color}-500`} />
                            </div>
                            <div className={cn('absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800',
                              agent.isOnline ? 'bg-emerald-500' : 'bg-gray-400',
                              agent.currentStatus === 'working' && 'animate-pulse'
                            )} />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className={cn('font-bold text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                  {agent.name}
                                </h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded',
                                    `bg-${role.color}-100 text-${role.color}-700 dark:bg-${role.color}-900/30 dark:text-${role.color}-400`)}>
                                    {role.label}
                                  </span>
                                  <span className="text-[10px] text-gray-400">{agent.channel}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <StatusIcon className={`w-3.5 h-3.5 text-${status.color}-500`} />
                                <span className={`text-xs font-medium text-${status.color}-600 dark:text-${status.color}-400`}>
                                  {status.label}
                                </span>
                              </div>
                            </div>

                            {/* Current action */}
                            {agent.currentAction && agent.isOnline && (
                              <div className={cn('mt-2 p-2.5 rounded-lg text-sm',
                                theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50')}>
                                <p className={cn('font-medium', theme === 'dark' ? 'text-gray-200' : 'text-gray-700')}>
                                  {agent.currentAction}
                                </p>
                                {agent.currentDetails && (
                                  <p className="text-xs text-gray-500 mt-0.5">{agent.currentDetails}</p>
                                )}
                                {agent.currentProgress > 0 && agent.currentProgress < 100 && (
                                  <div className="mt-2 w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${agent.currentProgress}%` }}
                                      className="h-full bg-blue-500 rounded-full"
                                    />
                                  </div>
                                )}
                              </div>
                            )}

                            {!agent.isOnline && (
                              <p className="text-xs text-gray-400 mt-2">
                                Última actividad: {timeAgo(agent.lastActivityAt)}
                              </p>
                            )}

                            {/* Stats */}
                            {agent.totalOrders > 0 && (
                              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                <span>{agent.totalOrders} ventas</span>
                                <span>${agent.totalSales.toFixed(2)} revenue</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>

              {/* Activity Feed - 1/3 width */}
              <div>
                <h2 className={cn('font-semibold text-lg mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Feed de Actividad
                </h2>
                <div className={cn('rounded-xl border overflow-hidden', theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                  {data?.activityLog.length === 0 && (
                    <div className="p-6 text-center">
                      <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-400 text-sm">Sin actividad reciente</p>
                    </div>
                  )}
                  <div className="max-h-[600px] overflow-y-auto">
                    {data?.activityLog.map((entry, i) => {
                      const st = STATUS_CONFIG[entry.status] || STATUS_CONFIG.working
                      return (
                        <motion.div key={i}
                          initial={i < 5 ? { opacity: 0, x: 10 } : {}}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i < 5 ? i * 0.05 : 0 }}
                          className={cn('px-4 py-3 border-b last:border-b-0',
                            theme === 'dark' ? 'border-gray-700' : 'border-gray-100')}>
                          <div className="flex items-start gap-2">
                            <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0',
                              `bg-${st.color}-500`,
                              entry.status === 'working' && 'animate-pulse'
                            )} />
                            <div className="min-w-0">
                              <p className={cn('text-xs font-medium', theme === 'dark' ? 'text-gray-200' : 'text-gray-800')}>
                                {entry.action}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-gray-500">{entry.agentName}</span>
                                <span className="text-[10px] text-gray-400">{timeAgo(entry.createdAt)}</span>
                              </div>
                              {entry.details && (
                                <p className="text-[10px] text-gray-400 mt-0.5 truncate">{entry.details}</p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
