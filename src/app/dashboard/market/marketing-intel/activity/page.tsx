'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, Loader2, RefreshCw, WifiOff, Search, ShoppingCart,
  TrendingUp, Zap, Clock, CheckCircle, XCircle, Radio, AlertTriangle,
  ExternalLink, Package, Target, BarChart3
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface AgentStatus {
  agentId: string; name: string; role: string; status: string; isOnline: boolean
  currentTask: string | null; currentTarget: string | null; message: string | null
  progressPct: number; itemsProcessed: number; itemsFound: number
  itemsMatched: number; errorsCount: number; startedAt: string | null
  updatedAt: string | null; totalSales: number; totalOrders: number
}

interface EventEntry {
  agentId: string; agentName: string; agentRole: string | null
  type: string; level: string; text: string; target: string | null
  url: string | null; productId: number | null; productName: string | null
  createdAt: string
}

interface Summary {
  totalAgents: number; online: number; working: number; idle: number; offline: number
  totalItemsProcessed: number; totalItemsMatched: number; totalErrors: number
}

const ROLE_CFG: Record<string, { label: string; icon: typeof Search; gradient: string }> = {
  research: { label: 'Investigador', icon: Search, gradient: 'from-blue-500 to-blue-600' },
  sales: { label: 'Ventas', icon: ShoppingCart, gradient: 'from-emerald-500 to-emerald-600' },
  campaign: { label: 'Campañas', icon: Zap, gradient: 'from-purple-500 to-purple-600' },
  analyst: { label: 'Analista', icon: TrendingUp, gradient: 'from-amber-500 to-amber-600' }
}

const STATUS_CFG: Record<string, { label: string; dot: string; text: string }> = {
  running: { label: 'Ejecutando', dot: 'bg-emerald-500 animate-pulse', text: 'text-emerald-600' },
  scraping: { label: 'Scraping', dot: 'bg-blue-500 animate-pulse', text: 'text-blue-600' },
  analyzing: { label: 'Analizando', dot: 'bg-purple-500 animate-pulse', text: 'text-purple-600' },
  posting: { label: 'Publicando', dot: 'bg-orange-500 animate-pulse', text: 'text-orange-600' },
  working: { label: 'Trabajando', dot: 'bg-emerald-500 animate-pulse', text: 'text-emerald-600' },
  idle: { label: 'En espera', dot: 'bg-amber-400', text: 'text-amber-600' },
  error: { label: 'Error', dot: 'bg-red-500', text: 'text-red-600' },
  offline: { label: 'Offline', dot: 'bg-gray-400', text: 'text-gray-500' }
}

const LEVEL_CFG: Record<string, { dot: string; icon: typeof CheckCircle }> = {
  success: { dot: 'bg-emerald-500', icon: CheckCircle },
  info: { dot: 'bg-blue-500', icon: Activity },
  warning: { dot: 'bg-amber-500', icon: AlertTriangle },
  error: { dot: 'bg-red-500', icon: XCircle }
}

function timeAgo(d: string | null) {
  if (!d) return 'Nunca'
  const diff = Date.now() - new Date(d).getTime()
  if (diff < 10000) return 'Ahora'
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  return `${Math.floor(diff / 86400000)}d`
}

export default function AgentActivityPage() {
  const { theme } = useTheme()
  const [agents, setAgents] = useState<AgentStatus[]>([])
  const [events, setEvents] = useState<EventEntry[]>([])
  const [summary, setSummary] = useState<Summary>({ totalAgents: 0, online: 0, working: 0, idle: 0, offline: 0, totalItemsProcessed: 0, totalItemsMatched: 0, totalErrors: 0 })
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch('/api/marketing-intel/agent-activity?limit=80')
      const json = await res.json()
      if (json.success) {
        setAgents(json.data.agents || [])
        setEvents(json.data.events || [])
        setSummary(json.data.summary || {})
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => {
    const i = setInterval(() => fetchData(true), 8000)
    return () => clearInterval(i)
  }, [fetchData])

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 sm:p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg">
                <Radio className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className={cn('text-xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Centro de Control
                </h1>
                <p className="text-xs text-gray-500">Agentes OpenClaw en tiempo real</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">LIVE</span>
              </div>
              <button onClick={() => fetchData(true)}
                className={cn('p-2 rounded-lg', theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200')}>
                <RefreshCw className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { label: 'Agentes', value: summary.totalAgents, color: 'gray' },
              { label: 'Online', value: summary.online, color: 'emerald' },
              { label: 'Activos', value: summary.working, color: 'blue' },
              { label: 'Procesados', value: summary.totalItemsProcessed, color: 'purple' },
              { label: 'Matched', value: summary.totalItemsMatched, color: 'orange' },
              { label: 'Errores', value: summary.totalErrors, color: 'red' },
            ].map((s, i) => (
              <div key={i} className={cn('p-2.5 rounded-lg border text-center',
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                <p className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{s.value}</p>
                <p className="text-[10px] text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>

          {loading && agents.length === 0 ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              {/* Agent Cards - 3/5 */}
              <div className="lg:col-span-3 space-y-3">
                <h2 className={cn('font-semibold text-sm uppercase tracking-wide', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  Agentes ({agents.length})
                </h2>

                {agents.length === 0 && (
                  <div className={cn('p-8 rounded-xl border text-center', theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                    <WifiOff className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Sin agentes conectados</p>
                  </div>
                )}

                <AnimatePresence>
                  {agents.map((agent, i) => {
                    const role = ROLE_CFG[agent.role] || ROLE_CFG.research
                    const st = STATUS_CFG[agent.status] || STATUS_CFG.offline
                    const RoleIcon = role.icon

                    return (
                      <motion.div key={agent.agentId}
                        initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                        className={cn('rounded-xl border overflow-hidden', theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                        {/* Agent header bar */}
                        <div className={`flex items-center justify-between px-4 py-2.5 bg-gradient-to-r ${role.gradient} text-white`}>
                          <div className="flex items-center gap-2">
                            <RoleIcon className="w-4 h-4" />
                            <span className="font-bold text-sm">{agent.name}</span>
                            <span className="text-[10px] opacity-80 bg-white/20 px-1.5 py-0.5 rounded">{role.label}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className={cn('w-2.5 h-2.5 rounded-full', st.dot)} />
                            <span className="text-xs font-medium">{st.label}</span>
                          </div>
                        </div>

                        {/* Agent body */}
                        <div className="px-4 py-3">
                          {agent.currentTask && agent.isOnline ? (
                            <div className="space-y-2">
                              <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-200' : 'text-gray-800')}>
                                {agent.currentTask}
                              </p>
                              {agent.currentTarget && (
                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                  <Target className="w-3 h-3" />{agent.currentTarget}
                                </p>
                              )}
                              {agent.message && (
                                <p className="text-xs text-gray-400">{agent.message}</p>
                              )}

                              {/* Progress bar */}
                              {agent.progressPct > 0 && (
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] text-gray-500">
                                    <span>Progreso</span>
                                    <span>{agent.progressPct}%</span>
                                  </div>
                                  <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${agent.progressPct}%` }}
                                      transition={{ duration: 0.5 }}
                                      className={`h-full rounded-full bg-gradient-to-r ${role.gradient}`} />
                                  </div>
                                </div>
                              )}

                              {/* Stats row */}
                              <div className="flex items-center gap-4 text-[10px] text-gray-500 pt-1">
                                {agent.itemsProcessed > 0 && (
                                  <span className="flex items-center gap-1"><Package className="w-3 h-3" />{agent.itemsProcessed} procesados</span>
                                )}
                                {agent.itemsMatched > 0 && (
                                  <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-500" />{agent.itemsMatched} matched</span>
                                )}
                                {agent.errorsCount > 0 && (
                                  <span className="flex items-center gap-1 text-red-500"><XCircle className="w-3 h-3" />{agent.errorsCount} errores</span>
                                )}
                                {agent.startedAt && (
                                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Inicio: {timeAgo(agent.startedAt)}</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-gray-400">
                                {agent.isOnline ? 'En espera de tareas' : `Última actividad: ${timeAgo(agent.updatedAt)}`}
                              </p>
                              {agent.totalOrders > 0 && (
                                <span className="text-[10px] text-gray-500">{agent.totalOrders} ventas · ${agent.totalSales.toFixed(0)}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>

              {/* Event Feed - 2/5 */}
              <div className="lg:col-span-2">
                <h2 className={cn('font-semibold text-sm uppercase tracking-wide mb-3', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  Traza de Actividad ({events.length})
                </h2>
                <div className={cn('rounded-xl border overflow-hidden', theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                  <div className="max-h-[70vh] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/50">
                    {events.length === 0 && (
                      <div className="p-8 text-center">
                        <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-400 text-sm">Sin eventos</p>
                      </div>
                    )}
                    {events.map((evt, i) => {
                      const lvl = LEVEL_CFG[evt.level] || LEVEL_CFG.info
                      return (
                        <motion.div key={i}
                          initial={i < 8 ? { opacity: 0, x: 5 } : {}}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i < 8 ? i * 0.03 : 0 }}
                          className="px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                          <div className="flex items-start gap-2">
                            <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', lvl.dot,
                              evt.level === 'info' && evt.type?.includes('scrape') && 'animate-pulse')} />
                            <div className="min-w-0 flex-1">
                              <p className={cn('text-xs leading-tight', theme === 'dark' ? 'text-gray-200' : 'text-gray-800')}>
                                {evt.text}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-[9px] text-gray-500 font-medium">{evt.agentName}</span>
                                {evt.target && <span className="text-[9px] text-blue-500">{evt.target}</span>}
                                {evt.productName && (
                                  <span className="text-[9px] text-orange-500 flex items-center gap-0.5">
                                    <Package className="w-2.5 h-2.5" />{evt.productName}
                                  </span>
                                )}
                                <span className="text-[9px] text-gray-400">{timeAgo(evt.createdAt)}</span>
                              </div>
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
