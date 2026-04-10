'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, Users, Tag, Package, Zap, ArrowUp, ArrowDown, Minus, Loader2, ShoppingCart, AlertCircle } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface DashboardData {
  productsTracked: number
  competitors: number
  recentCaptures: number
  pricePosition: { cheaper: number; same: number; moreExpensive: number; total: number }
  activeCampaigns: number
  pendingSuggestions: number
  agentRevenue30d: number
  topAgent: { name: string; agentId: string; channel: string; revenue: number; sales: number } | null
}

export default function MarketingIntelDashboard() {
  const { theme } = useTheme()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/marketing-intel/dashboard')
      .then(r => r.json())
      .then(res => { if (res.success) setData(res.data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const formatCurrency = (n: number) => `$${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  if (loading) return (
    <ProtectedRoute><DashboardLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    </DashboardLayout></ProtectedRoute>
  )

  const pos = data?.pricePosition || { cheaper: 0, same: 0, moreExpensive: 0, total: 0 }
  const posTotal = pos.total || 1

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 sm:p-6 space-y-6">
          {/* Header */}
          <div>
            <h1 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              Inteligencia de Marketing
            </h1>
            <p className="text-gray-500 text-sm mt-1">Análisis competitivo, agentes de venta y campañas</p>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Productos Rastreados', value: data?.productsTracked || 0, icon: Package, color: 'blue' },
              { label: 'Competidores', value: data?.competitors || 0, icon: Users, color: 'purple' },
              { label: 'Campañas Activas', value: data?.activeCampaigns || 0, icon: Zap, color: 'orange' },
              { label: 'Sugerencias Pendientes', value: data?.pendingSuggestions || 0, icon: AlertCircle, color: 'amber' },
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
                    <p className={cn('text-xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{kpi.value}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Price Positioning */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className={cn('p-5 rounded-xl border', theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
              <h3 className={cn('font-semibold mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                <Tag className="w-4 h-4 inline mr-2" />Posición de Precios
              </h3>
              {pos.total > 0 ? (
                <div className="space-y-3">
                  {[
                    { label: 'Más baratos', value: pos.cheaper, pct: (pos.cheaper / posTotal * 100).toFixed(0), color: 'emerald', icon: ArrowDown },
                    { label: 'Precio similar', value: pos.same, pct: (pos.same / posTotal * 100).toFixed(0), color: 'amber', icon: Minus },
                    { label: 'Más caros', value: pos.moreExpensive, pct: (pos.moreExpensive / posTotal * 100).toFixed(0), color: 'red', icon: ArrowUp },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <row.icon className={`w-4 h-4 text-${row.color}-500`} />
                        <span className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>{row.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full bg-${row.color}-500 rounded-full`} style={{ width: `${row.pct}%` }} />
                        </div>
                        <span className={cn('text-sm font-bold w-12 text-right', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {row.value} ({row.pct}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm text-center py-8">Sin datos de precios. Los agentes OpenClaw enviarán datos pronto.</p>
              )}
            </motion.div>

            {/* Top Agent */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className={cn('p-5 rounded-xl border', theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
              <h3 className={cn('font-semibold mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                <ShoppingCart className="w-4 h-4 inline mr-2" />Agentes de Venta (30 días)
              </h3>
              {data?.topAgent ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl font-bold text-white">#1</span>
                  </div>
                  <p className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{data.topAgent.name}</p>
                  <p className="text-xs text-gray-500 mb-3">{data.topAgent.channel} · {data.topAgent.sales} ventas</p>
                  <p className="text-2xl font-bold text-orange-500">{formatCurrency(data.topAgent.revenue)}</p>
                  <p className="text-xs text-gray-400 mt-1">Revenue total: {formatCurrency(data.agentRevenue30d)}</p>
                </div>
              ) : (
                <p className="text-gray-400 text-sm text-center py-8">Sin agentes de venta activos. Conecta un agente OpenClaw para empezar.</p>
              )}
            </motion.div>
          </div>

          {/* Recent captures */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className={cn('p-5 rounded-xl border', theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
            <h3 className={cn('font-semibold mb-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              <BarChart3 className="w-4 h-4 inline mr-2" />Actividad Reciente
            </h3>
            <p className="text-gray-500 text-sm">
              {data?.recentCaptures || 0} capturas de precios en los últimos 7 días
            </p>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
