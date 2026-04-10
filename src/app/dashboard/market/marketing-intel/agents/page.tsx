'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Users, Loader2, Trophy, Medal, DollarSign, ShoppingCart, TrendingUp } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Agent {
  agentId: string
  name: string
  channel: string
  sales: number
  revenue: number
  averageTicket: number
}

interface AgentsResponse {
  agents: Agent[]
  period: string
  totalRevenue: number
  totalSales: number
}

const PERIODS = [
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
  { value: 'all', label: 'Todo' },
]

export default function AgentRankingsPage() {
  const { theme } = useTheme()
  const [data, setData] = useState<AgentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30d')

  const fetchData = useCallback(() => {
    setLoading(true)
    fetch(`/api/marketing-intel/agent-rankings?period=${period}`)
      .then(r => r.json())
      .then(res => { if (res.success) setData(res.data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [period])

  useEffect(() => { fetchData() }, [fetchData])

  const formatCurrency = (n: number) => `$${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const getMedalColor = (rank: number) => {
    if (rank === 1) return 'from-yellow-400 to-yellow-600'
    if (rank === 2) return 'from-gray-300 to-gray-500'
    if (rank === 3) return 'from-amber-600 to-amber-800'
    return ''
  }

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '1'
    if (rank === 2) return '2'
    if (rank === 3) return '3'
    return String(rank)
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 sm:p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                <Trophy className="w-6 h-6 inline mr-2" />Ranking de Agentes
              </h1>
              <p className="text-gray-500 text-sm mt-1">Rendimiento de agentes de venta por periodo</p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg border bg-opacity-50"
              style={{ borderColor: theme === 'dark' ? '#374151' : '#e5e7eb', backgroundColor: theme === 'dark' ? '#1f2937' : '#f9fafb' }}>
              {PERIODS.map(p => (
                <button key={p.value} onClick={() => { setPeriod(p.value); }}
                  className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                    period === p.value
                      ? 'bg-orange-500 text-white shadow-sm'
                      : theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900')}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Summary Cards */}
          {data && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: 'Agentes Activos', value: String(data.agents.length), icon: Users, color: 'blue' },
                { label: 'Revenue Total', value: formatCurrency(data.totalRevenue), icon: DollarSign, color: 'emerald' },
                { label: 'Ventas Totales', value: String(data.totalSales), icon: ShoppingCart, color: 'orange' },
              ].map((kpi, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={cn('p-4 rounded-xl border', theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center',
                      `bg-${kpi.color}-100 dark:bg-${kpi.color}-900/30`)}>
                      <kpi.icon className={`w-5 h-5 text-${kpi.color}-500`} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{kpi.label}</p>
                      <p className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{kpi.value}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Leaderboard */}
          {loading ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className={cn('rounded-xl border overflow-hidden', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
              {/* Top 3 Podium (desktop) */}
              {data?.agents && data.agents.length >= 3 && (
                <div className={cn('hidden sm:flex items-end justify-center gap-6 py-8 px-4',
                  theme === 'dark' ? 'bg-gray-800/50' : 'bg-gradient-to-b from-gray-50 to-white')}>
                  {[1, 0, 2].map(idx => {
                    const agent = data.agents[idx]
                    const rank = idx + 1
                    const heights = ['h-28', 'h-36', 'h-24']
                    return (
                      <motion.div key={agent.agentId} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + idx * 0.15 }}
                        className="flex flex-col items-center">
                        <div className={cn('w-14 h-14 rounded-full bg-gradient-to-br flex items-center justify-center mb-2 shadow-lg',
                          getMedalColor(rank))}>
                          <span className="text-xl font-bold text-white">{getMedalEmoji(rank)}</span>
                        </div>
                        <p className={cn('text-sm font-bold text-center', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {agent.name}
                        </p>
                        <p className="text-xs text-gray-500">{agent.channel}</p>
                        <p className="text-sm font-bold text-orange-500 mt-1">{formatCurrency(agent.revenue)}</p>
                        <div className={cn('w-20 mt-2 rounded-t-lg', heights[idx],
                          rank === 1 ? 'bg-gradient-to-t from-yellow-500 to-yellow-400' :
                          rank === 2 ? 'bg-gradient-to-t from-gray-400 to-gray-300' :
                          'bg-gradient-to-t from-amber-700 to-amber-500')} />
                      </motion.div>
                    )
                  })}
                </div>
              )}

              {/* Full Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={cn(theme === 'dark' ? 'bg-gray-800/80' : 'bg-gray-50')}>
                      {['Rank', 'Nombre', 'Canal', 'Ventas', 'Revenue', 'Ticket Promedio'].map(h => (
                        <th key={h} className={cn('px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data?.agents && data.agents.length > 0 ? data.agents.map((agent, i) => {
                      const rank = i + 1
                      return (
                        <motion.tr key={agent.agentId} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.03 }}
                          className={cn('border-t',
                            rank <= 3 ? (theme === 'dark' ? 'bg-orange-900/10' : 'bg-orange-50/50') : '',
                            theme === 'dark' ? 'border-gray-700' : 'border-gray-100')}>
                          <td className="px-4 py-3">
                            {rank <= 3 ? (
                              <div className={cn('w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center shadow',
                                getMedalColor(rank))}>
                                <span className="text-xs font-bold text-white">{rank}</span>
                              </div>
                            ) : (
                              <span className={cn('text-sm font-medium pl-2', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                {rank}
                              </span>
                            )}
                          </td>
                          <td className={cn('px-4 py-3 font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {agent.name}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                              theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600')}>
                              {agent.channel}
                            </span>
                          </td>
                          <td className={cn('px-4 py-3 font-mono', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                            {agent.sales}
                          </td>
                          <td className={cn('px-4 py-3 font-mono font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {formatCurrency(agent.revenue)}
                          </td>
                          <td className={cn('px-4 py-3 font-mono', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                            {formatCurrency(agent.averageTicket)}
                          </td>
                        </motion.tr>
                      )
                    }) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                          Sin agentes activos en este periodo
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
