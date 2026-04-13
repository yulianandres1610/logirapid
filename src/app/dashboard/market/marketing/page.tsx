'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Users,
  Search as SearchIcon,
  Megaphone,
  ShoppingBag,
  ArrowRight,
  RefreshCw,
  Calendar,
  TrendingUp,
  BarChart3,
  Trophy,
  Wifi,
  Target
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface DashboardData {
  metrics: {
    agentsOnline: number
    findings7d: number
    activeCampaigns: number
    agentSales30d: number
  }
  pricePositioning: {
    cheaper: number
    same: number
    expensive: number
  }
  topSellingAgent: {
    name: string
    channel: string
    sales: number
    revenue: number
  } | null
}

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

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
  delay = 0
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: any
  color?: 'blue' | 'green' | 'amber' | 'purple' | 'red' | 'cyan'
  delay?: number
}) {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    purple: 'from-purple-500 to-purple-600',
    red: 'from-red-500 to-red-600',
    cyan: 'from-cyan-500 to-cyan-600'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${colors[color]} p-5 text-white shadow-lg`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm">
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <p className="text-3xl font-bold mb-1">
          {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
        </p>
        <p className="text-sm font-medium text-white/90">{title}</p>
        {subtitle && <p className="text-xs text-white/70 mt-0.5">{subtitle}</p>}
      </div>
    </motion.div>
  )
}

function QuickAction({
  title,
  description,
  icon: Icon,
  href,
  color,
  badge,
  delay = 0
}: {
  title: string
  description: string
  icon: any
  href: string
  color: string
  badge?: number
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="h-full"
    >
      <Link href={href} className="block h-full">
        <div className={`relative group h-full p-4 rounded-2xl bg-gradient-to-br ${color} text-white hover:scale-[1.02] transition-all cursor-pointer shadow-lg flex items-center gap-3`}>
          {badge !== undefined && badge > 0 && (
            <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow-lg">
              {badge}
            </div>
          )}
          <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm flex-shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{title}</p>
            <p className="text-xs text-white/80 truncate">{description}</p>
          </div>
          <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform flex-shrink-0" />
        </div>
      </Link>
    </motion.div>
  )
}

export default function MarketingDashboardPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Buenos dias')
    else if (hour < 18) setGreeting('Buenas tardes')
    else setGreeting('Buenas noches')

    fetchData()
    const interval = setInterval(() => fetchData(true), 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    try {
      const response = await fetch('/api/mkt/dashboard')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setData(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching marketing dashboard:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const totalFindings = data?.pricePositioning
    ? data.pricePositioning.cheaper + data.pricePositioning.same + data.pricePositioning.expensive
    : 0

  const getBarWidth = (val: number) => totalFindings > 0 ? Math.max((val / totalFindings) * 100, 2) : 0

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6">
            <div className="animate-pulse space-y-6">
              <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
                ))}
              </div>
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
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                {greeting}, <span className="text-purple-600 dark:text-purple-400">Marketing</span>
              </h1>
              <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                <Megaphone className="w-4 h-4" />
                Panel de Marketing IA
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <Calendar className="w-4 h-4" />
                {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            <button
              onClick={() => fetchData()}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium">Actualizar</span>
            </button>
          </motion.div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Agentes Online"
              value={data?.metrics?.agentsOnline || 0}
              subtitle="Activos ahora"
              icon={Wifi}
              color="green"
              delay={0.1}
            />
            <MetricCard
              title="Hallazgos 7d"
              value={data?.metrics?.findings7d || 0}
              subtitle="Precios encontrados"
              icon={SearchIcon}
              color="blue"
              delay={0.15}
            />
            <MetricCard
              title="Campanas Activas"
              value={data?.metrics?.activeCampaigns || 0}
              subtitle="En progreso"
              icon={Megaphone}
              color="purple"
              delay={0.2}
            />
            <MetricCard
              title="Ventas Agentes 30d"
              value={`$${(data?.metrics?.agentSales30d || 0).toLocaleString()}`}
              subtitle="Ultimos 30 dias"
              icon={ShoppingBag}
              color="amber"
              delay={0.25}
            />
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickAction
              title="Agentes"
              description="Gestionar agentes IA"
              icon={Users}
              href="/dashboard/market/marketing/agents"
              color="from-purple-500 to-purple-600"
              delay={0.3}
            />
            <QuickAction
              title="Precios"
              description="Hallazgos de precios"
              icon={Target}
              href="/dashboard/market/marketing/prices"
              color="from-blue-500 to-blue-600"
              delay={0.35}
            />
            <QuickAction
              title="Campanas"
              description="Gestionar campanas"
              icon={Megaphone}
              href="/dashboard/market/marketing/campaigns"
              color="from-emerald-500 to-emerald-600"
              badge={data?.metrics?.activeCampaigns}
              delay={0.4}
            />
            <QuickAction
              title="Ventas"
              description="Ranking de agentes"
              icon={ShoppingBag}
              href="/dashboard/market/marketing/sales"
              color="from-amber-500 to-amber-600"
              delay={0.45}
            />
          </div>

          {/* Bottom Grid: Price Positioning + Top Agent */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Price Positioning Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={cn(
                'rounded-2xl border p-5 shadow-sm',
                theme === 'dark' ? 'bg-gray-900 border-gray-700/50' : 'bg-white border-gray-200'
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  Posicionamiento de Precios
                </h3>
                <span className="text-xs text-gray-400">{totalFindings} hallazgos</span>
              </div>
              <div className="space-y-4">
                {/* Cheaper */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Mas barato</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{data?.pricePositioning?.cheaper || 0}</span>
                  </div>
                  <div className={cn('h-6 rounded-full overflow-hidden', theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100')}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${getBarWidth(data?.pricePositioning?.cheaper || 0)}%` }}
                      transition={{ duration: 0.8, delay: 0.6 }}
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
                    />
                  </div>
                </div>
                {/* Same */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-amber-600 dark:text-amber-400">Similar</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{data?.pricePositioning?.same || 0}</span>
                  </div>
                  <div className={cn('h-6 rounded-full overflow-hidden', theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100')}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${getBarWidth(data?.pricePositioning?.same || 0)}%` }}
                      transition={{ duration: 0.8, delay: 0.7 }}
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full"
                    />
                  </div>
                </div>
                {/* Expensive */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">Mas caro</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{data?.pricePositioning?.expensive || 0}</span>
                  </div>
                  <div className={cn('h-6 rounded-full overflow-hidden', theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100')}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${getBarWidth(data?.pricePositioning?.expensive || 0)}%` }}
                      transition={{ duration: 0.8, delay: 0.8 }}
                      className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Top Selling Agent */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className={cn(
                'rounded-2xl border p-5 shadow-sm',
                theme === 'dark' ? 'bg-gray-900 border-gray-700/50' : 'bg-white border-gray-200'
              )}
            >
              <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-amber-500" />
                Mejor Agente Vendedor
              </h3>
              {data?.topSellingAgent ? (
                <div className="flex flex-col items-center text-center py-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, delay: 0.7 }}
                    className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mb-4 shadow-lg"
                  >
                    <Trophy className="w-10 h-10 text-white" />
                  </motion.div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white mb-1">{data.topSellingAgent.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{data.topSellingAgent.channel}</p>
                  <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
                    <div className={cn('p-3 rounded-xl text-center', theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50')}>
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{data.topSellingAgent.sales}</p>
                      <p className="text-xs text-gray-500">Ventas</p>
                    </div>
                    <div className={cn('p-3 rounded-xl text-center', theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50')}>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">${data.topSellingAgent.revenue.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">Ingresos</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-gray-400">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sin datos de ventas aun</p>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
