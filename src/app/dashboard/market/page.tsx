'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Package,
  ArrowRight,
  ShoppingCart,
  RefreshCw,
  DollarSign,
  Calendar,
  Target,
  Boxes,
  Store,
  Truck,
  FileBox,
  Monitor,
  Users
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

interface ProductStats {
  total: number
  inStock: number
  lowStock: number
  outOfStock: number
}

interface ConsignmentStats {
  total: number
  pending: number
  partial: number
  received: number
  totalCost: number
  totalSold: number
  totalReturned: number
  thisMonth: number
  costThisMonth: number
}

interface RecentConsignment {
  id: number
  orderNumber: string
  supplierName: string
  status: string
  totalCost: number
  totalSold: number
  consignmentDate: string
}

interface PurchaseStats {
  total: number
  pending: number
  received: number
  totalAmount: number
  thisMonth: number
  amountThisMonth: number
}

interface RecentPurchase {
  id: number
  orderNumber: string
  supplierName: string
  status: string
  totalAmount: number
  purchaseDate: string
}

interface POSSales {
  today: number
  ordersToday: number
  month: number
  ordersMonth: number
  year: number
  ordersYear: number
}

interface POSTerminal {
  terminalId: number
  terminalName: string
  salesToday: number
  salesMonth: number
}

interface ConsignmentBySupplier {
  supplierId: number
  supplierName: string
  totalOrders: number
  totalCost: number
  totalSold: number
  pendingToPay: number
}

interface DashboardData {
  products: ProductStats
  consignments: ConsignmentStats
  recentConsignments: RecentConsignment[]
  purchases: PurchaseStats
  recentPurchases: RecentPurchase[]
  posSales: POSSales
  posByTerminal: POSTerminal[]
  consignmentsBySupplier: ConsignmentBySupplier[]
}

// Animated number component
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

// Metric Card Component
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

// Quick Action Button - Fixed height
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

// Stat Card for sections
function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`p-3 rounded-xl ${color} text-center`}>
      <p className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      <p className="text-xs font-medium opacity-80">{label}</p>
    </div>
  )
}

export default function MarketDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [greeting, setGreeting] = useState('')
  const [companyName, setCompanyName] = useState('Mercado')

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Buenos días')
    else if (hour < 18) setGreeting('Buenas tardes')
    else setGreeting('Buenas noches')

    try {
      const cookies = document.cookie.split(';')
      const companyNameCookie = cookies.find(c => c.trim().startsWith('user-company-name='))
      if (companyNameCookie) {
        setCompanyName(decodeURIComponent(companyNameCookie.split('=')[1]))
      }
    } catch (e) {
      console.error('Error getting company name:', e)
    }

    fetchDashboardData()
    const interval = setInterval(() => fetchDashboardData(true), 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchDashboardData = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    try {
      const response = await fetch('/api/market/dashboard')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setData(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const stockHealth = data?.products?.total
    ? Math.round((data.products.inStock / data.products.total) * 100)
    : 0

  const totalPendingToPay = data?.consignmentsBySupplier?.reduce((sum, s) => sum + s.pendingToPay, 0) || 0

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
                {greeting}, <span className="text-blue-600 dark:text-blue-400">{companyName}</span>
              </h1>
              <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                <Store className="w-4 h-4" />
                Panel de Mercado
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <Calendar className="w-4 h-4" />
                {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            <button
              onClick={() => fetchDashboardData()}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium">Actualizar</span>
            </button>
          </motion.div>

          {/* POS Sales Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Ventas Hoy"
              value={`$${(data?.posSales?.today || 0).toLocaleString()}`}
              subtitle={`${data?.posSales?.ordersToday || 0} órdenes`}
              icon={DollarSign}
              color="green"
              delay={0.1}
            />
            <MetricCard
              title="Ventas del Mes"
              value={`$${(data?.posSales?.month || 0).toLocaleString()}`}
              subtitle={`${data?.posSales?.ordersMonth || 0} órdenes`}
              icon={ShoppingCart}
              color="blue"
              delay={0.15}
            />
            <MetricCard
              title="Ventas del Año"
              value={`$${(data?.posSales?.year || 0).toLocaleString()}`}
              subtitle={`${data?.posSales?.ordersYear || 0} órdenes`}
              icon={Target}
              color="purple"
              delay={0.2}
            />
            <MetricCard
              title="Por Pagar (Consig.)"
              value={`$${totalPendingToPay.toLocaleString()}`}
              subtitle={`${data?.consignmentsBySupplier?.length || 0} proveedores`}
              icon={Users}
              color="amber"
              delay={0.25}
            />
          </div>

          {/* Quick Actions - Fixed height grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickAction
              title="POS"
              description="Punto de venta"
              icon={Monitor}
              href="/dashboard/market/pos"
              color="from-blue-500 to-blue-600"
              delay={0.3}
            />
            <QuickAction
              title="Consignaciones"
              description="Gestionar"
              icon={FileBox}
              href="/dashboard/market/consignments"
              color="from-purple-500 to-purple-600"
              badge={data?.consignments?.pending}
              delay={0.35}
            />
            <QuickAction
              title="Compras"
              description="Ver compras"
              icon={Truck}
              href="/dashboard/market/purchases"
              color="from-emerald-500 to-emerald-600"
              badge={data?.purchases?.pending}
              delay={0.4}
            />
            <QuickAction
              title="Inventario"
              description="Productos"
              icon={Boxes}
              href="/dashboard/market/inventory"
              color="from-cyan-500 to-cyan-600"
              badge={data?.products?.outOfStock}
              delay={0.45}
            />
          </div>

          {/* POS by Terminal */}
          {data?.posByTerminal && data.posByTerminal.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-blue-500" />
                  Ventas por Terminal
                </h3>
                <Link href="/dashboard/market/pos/sessions" className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1">
                  Ver sesiones <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {data.posByTerminal.map((terminal, i) => (
                  <motion.div
                    key={terminal.terminalId}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.55 + i * 0.05 }}
                    className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4"
                  >
                    <p className="font-semibold text-sm text-gray-900 dark:text-white mb-2">{terminal.terminalName}</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-bold text-green-600 dark:text-green-400">
                          ${terminal.salesToday.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-gray-500">Hoy</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          ${terminal.salesMonth.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-gray-500">Mes</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Consignments by Supplier */}
          {data?.consignmentsBySupplier && data.consignmentsBySupplier.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-500" />
                  Por Pagar a Proveedores
                </h3>
                <Link href="/dashboard/market/consignments" className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1">
                  Ver todo <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {data.consignmentsBySupplier.map((supplier, i) => (
                  <motion.div
                    key={supplier.supplierId}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.65 + i * 0.05 }}
                    className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4"
                  >
                    <p className="font-semibold text-sm text-white mb-1 truncate">{supplier.supplierName}</p>
                    <p className="text-xs text-gray-400 mb-2">{supplier.totalOrders} órdenes</p>
                    <p className="text-xl font-bold text-amber-400">
                      ${supplier.pendingToPay.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-gray-500">Por pagar</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Recent Purchases */}
          {data?.recentPurchases && data.recentPurchases.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                  <Truck className="w-5 h-5 text-emerald-500" />
                  Compras Recientes
                </h3>
                <Link href="/dashboard/market/purchases" className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1">
                  Ver todas <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {data.recentPurchases.map((purchase, i) => (
                  <motion.div
                    key={purchase.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.75 + i * 0.05 }}
                    className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm text-white">{purchase.orderNumber}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        purchase.status === 'received'
                          ? 'bg-green-900/50 text-green-400'
                          : 'bg-amber-900/50 text-amber-400'
                      }`}>
                        {purchase.status === 'received' ? 'Recibido' : 'Pendiente'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate mb-2">{purchase.supplierName}</p>
                    <p className="text-lg font-bold text-emerald-400">
                      ${purchase.totalAmount.toLocaleString()}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Consignments Recent */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                  <FileBox className="w-5 h-5 text-purple-500" />
                  Consignaciones Recientes
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {data?.consignments?.total || 0} total • ${(data?.consignments?.totalSold || 0).toLocaleString()} vendido
                </p>
              </div>
              <Link href="/dashboard/market/consignments" className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1">
                Ver todas <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {data?.recentConsignments?.map((consignment, i) => {
                const pendingAmount = consignment.totalCost - consignment.totalSold
                return (
                  <motion.div
                    key={consignment.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.85 + i * 0.05 }}
                    className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm text-white">{consignment.orderNumber}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        consignment.status === 'received'
                          ? 'bg-green-900/50 text-green-400'
                          : consignment.status === 'partial'
                          ? 'bg-blue-900/50 text-blue-400'
                          : 'bg-amber-900/50 text-amber-400'
                      }`}>
                        {consignment.status === 'received' ? 'Recibido' : consignment.status === 'partial' ? 'Parcial' : 'Pendiente'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate mb-2">{consignment.supplierName}</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-bold text-purple-400">
                          ${pendingAmount.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-gray-500">Por pagar</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-green-400">
                          ${consignment.totalSold.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-gray-500">Vendido</p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
              {(!data?.recentConsignments || data.recentConsignments.length === 0) && (
                <div className="col-span-full py-8 text-center text-gray-400">
                  <FileBox className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sin consignaciones recientes</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Bottom Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Product Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-emerald-500" />
                  Estado del Inventario
                </h3>
                <div className={`text-sm px-3 py-1 rounded-full ${
                  stockHealth >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  stockHealth >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {stockHealth}% en stock
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Total Productos" value={data?.products?.total || 0} color="text-gray-600 bg-gray-50 dark:bg-gray-800" />
                <StatCard label="En Stock" value={data?.products?.inStock || 0} color="text-green-600 bg-green-50 dark:bg-green-900/20" />
                <StatCard label="Stock Bajo" value={data?.products?.lowStock || 0} color="text-amber-600 bg-amber-50 dark:bg-amber-900/20" />
                <StatCard label="Sin Stock" value={data?.products?.outOfStock || 0} color="text-red-600 bg-red-50 dark:bg-red-900/20" />
              </div>
            </motion.div>

            {/* Consignment Stats Summary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.95 }}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5 shadow-sm"
            >
              <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-purple-500" />
                Resumen General
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Consignaciones" value={data?.consignments?.total || 0} color="text-purple-600 bg-purple-50 dark:bg-purple-900/20" />
                <StatCard label="Compras" value={data?.purchases?.total || 0} color="text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" />
                <StatCard label="Pendientes" value={(data?.consignments?.pending || 0) + (data?.purchases?.pending || 0)} color="text-amber-600 bg-amber-50 dark:bg-amber-900/20" />
                <StatCard label="Este Mes" value={data?.consignments?.thisMonth || 0} color="text-blue-600 bg-blue-50 dark:bg-blue-900/20" />
              </div>
            </motion.div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
