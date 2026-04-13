'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Trophy,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  ArrowLeft,
  RefreshCw,
  Medal,
  Star,
  Users
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface SalesData {
  summary: {
    totalSales: number
    totalRevenue: number
    avgTicket: number
  }
  leaderboard: Array<{
    rank: number
    agentName: string
    channel: string
    salesCount: number
    revenue: number
    avgOrder: number
  }>
}

const PERIOD_OPTIONS = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: 'all', label: 'Todo' }
]

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const duration = 1000
    const start = Date.now()
    const startVal = display

    const animate = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(startVal + (value - startVal) * eased)
      if (progress < 1) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }, [value])

  const formatted = decimals > 0
    ? display.toFixed(decimals)
    : Math.round(display).toLocaleString()

  return <span className="tabular-nums">{formatted}</span>
}

function getMedalColor(rank: number): { bg: string; text: string; icon: string } {
  switch (rank) {
    case 1: return { bg: 'from-amber-400 to-amber-600', text: 'text-amber-600 dark:text-amber-400', icon: 'text-amber-400' }
    case 2: return { bg: 'from-gray-300 to-gray-500', text: 'text-gray-500 dark:text-gray-400', icon: 'text-gray-400' }
    case 3: return { bg: 'from-orange-400 to-orange-600', text: 'text-orange-600 dark:text-orange-400', icon: 'text-orange-400' }
    default: return { bg: '', text: 'text-gray-500', icon: '' }
  }
}

export default function SalesPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const [data, setData] = useState<SalesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30d')

  useEffect(() => {
    fetchSales()
  }, [period])

  const fetchSales = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/mkt/sales?period=${period}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setData(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching sales:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading && !data) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl w-1/3" />
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
                ))}
              </div>
              <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

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
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Ventas de Agentes</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Ranking y metricas de ventas</p>
              </div>
            </div>
          </motion.div>

          {/* Period Filter */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex gap-2"
          >
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-all',
                  period === opt.value
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg'
                    : theme === 'dark'
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-lg"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative">
                <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm w-fit mb-3">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <p className="text-3xl font-bold mb-1">
                  <AnimatedNumber value={data?.summary?.totalSales || 0} />
                </p>
                <p className="text-sm font-medium text-white/90">Total Ventas</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-5 text-white shadow-lg"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative">
                <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm w-fit mb-3">
                  <DollarSign className="w-5 h-5" />
                </div>
                <p className="text-3xl font-bold mb-1">
                  $<AnimatedNumber value={data?.summary?.totalRevenue || 0} />
                </p>
                <p className="text-sm font-medium text-white/90">Ingresos Totales</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 p-5 text-white shadow-lg"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative">
                <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm w-fit mb-3">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <p className="text-3xl font-bold mb-1">
                  $<AnimatedNumber value={data?.summary?.avgTicket || 0} decimals={2} />
                </p>
                <p className="text-sm font-medium text-white/90">Ticket Promedio</p>
              </div>
            </motion.div>
          </div>

          {/* Leaderboard */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={cn(
              'rounded-2xl border shadow-sm overflow-hidden',
              theme === 'dark' ? 'bg-gray-900 border-gray-700/50' : 'bg-white border-gray-200'
            )}
          >
            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Leaderboard
              </h3>
            </div>

            {data?.leaderboard && data.leaderboard.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={cn(
                      'text-xs font-medium uppercase',
                      theme === 'dark' ? 'bg-gray-800/50 text-gray-400' : 'bg-gray-50 text-gray-500'
                    )}>
                      <th className="text-center py-3 px-4 w-16">Rank</th>
                      <th className="text-left py-3 px-4">Agente</th>
                      <th className="text-left py-3 px-4">Canal</th>
                      <th className="text-right py-3 px-4">Ventas</th>
                      <th className="text-right py-3 px-4">Ingresos</th>
                      <th className="text-right py-3 px-4">Ticket Prom.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {data.leaderboard.map((entry, i) => {
                      const medal = getMedalColor(entry.rank)
                      const isTopThree = entry.rank <= 3

                      return (
                        <motion.tr
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.35 + i * 0.05 }}
                          className={cn(
                            'transition-colors',
                            theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50',
                            isTopThree && (theme === 'dark' ? 'bg-gray-800/20' : 'bg-gray-50/50')
                          )}
                        >
                          <td className="py-3 px-4 text-center">
                            {isTopThree ? (
                              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${medal.bg} flex items-center justify-center mx-auto shadow-md`}>
                                {entry.rank === 1 ? (
                                  <Trophy className="w-4 h-4 text-white" />
                                ) : (
                                  <Medal className="w-4 h-4 text-white" />
                                )}
                              </div>
                            ) : (
                              <span className="text-sm font-bold text-gray-400">{entry.rank}</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold',
                                isTopThree
                                  ? `bg-gradient-to-br ${medal.bg} text-white`
                                  : theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'
                              )}>
                                {entry.agentName.charAt(0).toUpperCase()}
                              </div>
                              <span className={cn(
                                'text-sm font-medium',
                                isTopThree ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'
                              )}>
                                {entry.agentName}
                              </span>
                              {entry.rank === 1 && <Star className="w-4 h-4 text-amber-400 fill-amber-400" />}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-gray-500 dark:text-gray-400">{entry.channel}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={cn(
                              'text-sm font-semibold',
                              isTopThree ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'
                            )}>
                              {entry.salesCount.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={cn(
                              'text-sm font-bold',
                              isTopThree ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'
                            )}>
                              ${entry.revenue.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-sm text-gray-500 dark:text-gray-400">${entry.avgOrder.toFixed(2)}</span>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-medium">Sin datos de ventas</p>
                <p className="text-sm">No hay ventas registradas en este periodo</p>
              </div>
            )}
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
