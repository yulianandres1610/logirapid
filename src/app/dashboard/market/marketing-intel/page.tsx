'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3, TrendingUp, Users, Tag, Package, Zap, ArrowUp, ArrowDown, Minus,
  Loader2, ShoppingCart, AlertCircle, RefreshCw, ArrowRight, Target, Eye
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

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

// Animated number counter (same pattern as main dashboard)
function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const duration = 800
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

  return <span className="tabular-nums">{decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString()}</span>
}

// Metric Card (same as main dashboard)
function MetricCard({ title, value, subtitle, icon: Icon, color = 'blue', delay = 0 }: {
  title: string; value: string | number; subtitle?: string; icon: any
  color?: 'blue' | 'green' | 'amber' | 'purple' | 'red' | 'cyan'; delay?: number
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
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${colors[color]} p-5 text-white shadow-lg`}>
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

// Quick Action Button (same as main dashboard)
function QuickAction({ title, description, icon: Icon, href, color, badge, delay = 0 }: {
  title: string; description: string; icon: any; href: string; color: string; badge?: number; delay?: number
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Link href={href}
        className={`block relative overflow-hidden rounded-2xl bg-gradient-to-br ${color} p-4 text-white shadow-lg hover:scale-[1.02] transition-all h-full`}>
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        {badge !== undefined && badge > 0 && (
          <div className="absolute top-3 right-3 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold shadow-lg">
            {badge}
          </div>
        )}
        <div className="relative">
          <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm w-fit mb-3">
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm mb-0.5">{title}</h3>
          <p className="text-xs text-white/80">{description}</p>
          <ArrowRight className="w-4 h-4 mt-2 text-white/60" />
        </div>
      </Link>
    </motion.div>
  )
}

const formatCurrency = (n: number) => `$${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function MarketingIntelDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/marketing-intel/dashboard')
      const json = await res.json()
      if (json.success) setData(json.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { fetchData() }, [])

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return (
    <ProtectedRoute><DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Marketing Intelligence</h1>
              <p className="text-gray-500 text-sm mt-0.5">Análisis competitivo, agentes de venta y campañas</p>
            </div>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => fetchData(true)} disabled={refreshing}
              className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors">
              <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
            </motion.button>
          </div>

          {/* KPI Cards - Same gradient style as main dashboard */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard title="Productos Rastreados" value={data?.productsTracked || 0} icon={Package} color="blue" delay={0} subtitle={`${data?.competitors || 0} competidores`} />
            <MetricCard title="Revenue Agentes (30d)" value={formatCurrency(data?.agentRevenue30d || 0)} icon={ShoppingCart} color="green" delay={0.1} subtitle={data?.topAgent ? `Top: ${data.topAgent.name}` : 'Sin agentes activos'} />
            <MetricCard title="Campañas Activas" value={data?.activeCampaigns || 0} icon={Zap} color="amber" delay={0.2} />
            <MetricCard title="Capturas (7 días)" value={data?.recentCaptures || 0} icon={Target} color="purple" delay={0.3} subtitle="Precios investigados" />
          </div>

          {/* Quick Actions - Same style as main dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickAction title="Precios Competencia" description="Comparar precios del mercado" icon={Tag}
              href="/dashboard/market/marketing-intel/prices" color="from-blue-600 to-blue-700" delay={0.2} />
            <QuickAction title="Agentes de Venta" description="Ranking y performance" icon={Users}
              href="/dashboard/market/marketing-intel/agents" color="from-emerald-600 to-emerald-700" delay={0.25} />
            <QuickAction title="Sugerencias IA" description="Revisar recomendaciones" icon={AlertCircle}
              href="/dashboard/market/marketing-intel/suggestions" color="from-amber-600 to-amber-700" delay={0.3}
              badge={data?.pendingSuggestions || 0} />
            <QuickAction title="Campañas" description="Gestionar promociones" icon={Zap}
              href="/dashboard/market/marketing-intel/campaigns" color="from-purple-600 to-purple-700" delay={0.35} />
          </div>

          {/* Two column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Price Positioning */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/50 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">Posición de Precios</h3>
                  <p className="text-xs text-gray-500">{pos.total} productos analizados</p>
                </div>
              </div>
              {pos.total > 0 ? (
                <div className="space-y-4">
                  {[
                    { label: 'Más baratos que competencia', value: pos.cheaper, pct: Math.round(pos.cheaper / posTotal * 100), color: 'bg-emerald-500', icon: ArrowDown, textColor: 'text-emerald-600' },
                    { label: 'Precio similar (±5%)', value: pos.same, pct: Math.round(pos.same / posTotal * 100), color: 'bg-amber-500', icon: Minus, textColor: 'text-amber-600' },
                    { label: 'Más caros que competencia', value: pos.moreExpensive, pct: Math.round(pos.moreExpensive / posTotal * 100), color: 'bg-red-500', icon: ArrowUp, textColor: 'text-red-600' },
                  ].map((row, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <row.icon className={`w-4 h-4 ${row.textColor}`} />
                          <span className="text-sm text-gray-600 dark:text-gray-400">{row.label}</span>
                        </div>
                        <span className={`text-sm font-bold ${row.textColor}`}>{row.value} ({row.pct}%)</span>
                      </div>
                      <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${row.pct}%` }} transition={{ delay: 0.5 + i * 0.1, duration: 0.8 }}
                          className={`h-full ${row.color} rounded-full`} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Eye className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">Sin datos de precios aún</p>
                  <p className="text-gray-400 text-xs mt-1">Conecta un agente OpenClaw para empezar a investigar</p>
                </div>
              )}
            </motion.div>

            {/* Top Agent */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
              className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/50 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">Agentes de Venta</h3>
                  <p className="text-xs text-gray-500">Últimos 30 días</p>
                </div>
              </div>
              {data?.topAgent ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-3 shadow-lg">
                    <span className="text-2xl font-bold text-white">#1</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{data.topAgent.name}</p>
                  <p className="text-xs text-gray-500 mb-3">{data.topAgent.channel} · {data.topAgent.sales} ventas</p>
                  <p className="text-3xl font-bold text-emerald-500">{formatCurrency(data.topAgent.revenue)}</p>
                  <p className="text-xs text-gray-400 mt-2">Revenue total agentes: {formatCurrency(data.agentRevenue30d)}</p>
                  <Link href="/dashboard/market/marketing-intel/agents"
                    className="inline-flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600 mt-3 font-medium">
                    Ver ranking completo <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">Sin agentes de venta activos</p>
                  <p className="text-gray-400 text-xs mt-1">Conecta un agente de venta OpenClaw para rastrear ventas</p>
                  <Link href="/dashboard/market/marketing-intel/settings"
                    className="inline-flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600 mt-3 font-medium">
                    Configurar <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </motion.div>
          </div>

          {/* Pending Suggestions Banner */}
          {(data?.pendingSuggestions || 0) > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
              <Link href="/dashboard/market/marketing-intel/suggestions"
                className="block rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 p-5 text-white shadow-lg hover:scale-[1.01] transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-lg">{data?.pendingSuggestions} sugerencias pendientes</p>
                      <p className="text-sm text-white/80">Los agentes de IA han encontrado oportunidades para mejorar precios</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/60" />
                </div>
              </Link>
            </motion.div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
