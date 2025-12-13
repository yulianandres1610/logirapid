'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  Users,
  MapPin,
  DollarSign,
  Package,
  TrendingUp,
  Building2,
  Wallet,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Activity,
  BarChart3,
  Globe,
  RefreshCw,
  XCircle,
  Truck,
  Eye,
  Zap,
  ArrowUpRight,
  Sparkles
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

// Mapbox token
const MAPBOX_TOKEN = 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'

interface Broker {
  id: number
  name: string
  tradeName: string
  walletNumber: string
  walletBalance: number
  walletBalanceFormatted: string
  currency: string
  province: string
  municipality: string
  isActive: boolean
  email: string
  contactPhone: string
  stats: {
    totalTransactions: number
    totalDeposits: number
    totalWithdrawals: number
  }
}

interface Summary {
  totalBrokers: number
  activeBrokers: number
  provincesCovered: number
  totalBalance: number
  totalBalanceFormatted: string
}

interface Province {
  name: string
  brokerCount: number
}

// Cuba province coordinates
const CUBA_PROVINCES: Record<string, { coords: [number, number], color: string }> = {
  'Pinar del Río': { coords: [-83.6978, 22.4175], color: '#3b82f6' },
  'Artemisa': { coords: [-82.7617, 22.8136], color: '#8b5cf6' },
  'La Habana': { coords: [-82.3666, 23.1136], color: '#ef4444' },
  'Mayabeque': { coords: [-81.9300, 22.9200], color: '#f97316' },
  'Matanzas': { coords: [-81.5775, 22.4117], color: '#eab308' },
  'Cienfuegos': { coords: [-80.4536, 22.1456], color: '#22c55e' },
  'Villa Clara': { coords: [-79.9658, 22.4058], color: '#14b8a6' },
  'Sancti Spíritus': { coords: [-79.4428, 21.9303], color: '#06b6d4' },
  'Ciego de Ávila': { coords: [-78.7619, 21.8403], color: '#0ea5e9' },
  'Camagüey': { coords: [-77.9169, 21.3808], color: '#6366f1' },
  'Las Tunas': { coords: [-76.9514, 20.9597], color: '#a855f7' },
  'Holguín': { coords: [-76.2633, 20.7869], color: '#ec4899' },
  'Granma': { coords: [-76.6431, 20.3847], color: '#f43f5e' },
  'Santiago de Cuba': { coords: [-75.8219, 20.0247], color: '#f59e0b' },
  'Guantánamo': { coords: [-75.2092, 20.1447], color: '#84cc16' },
  'Isla de la Juventud': { coords: [-82.8500, 21.7000], color: '#10b981' }
}

// Animated counter hook
function useAnimatedCounter(target: number, duration: number = 1500) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let startTime: number
    let animationFrame: number

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(target * easeOut))

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [target, duration])

  return count
}

// Stat Card Component with glassmorphism
function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  gradient,
  delay = 0,
  trend
}: {
  icon: any
  label: string
  value: string | number
  subValue?: string
  gradient: string
  delay?: number
  trend?: { value: number, positive: boolean }
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.5, type: "spring", stiffness: 100 }}
      whileHover={{ scale: 1.02, y: -4 }}
      className="relative group"
    >
      <div className={cn(
        "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500",
        gradient
      )} style={{ filter: 'blur(20px)' }} />
      <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl p-5 border border-white/20 dark:border-gray-700/50 shadow-xl">
        <div className="flex items-start justify-between">
          <div className={cn(
            "p-3 rounded-xl",
            gradient
          )}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
              trend.positive
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            )}>
              <ArrowUpRight className={cn("w-3 h-3", !trend.positive && "rotate-180")} />
              {trend.value}%
            </div>
          )}
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{label}</p>
          {subValue && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subValue}</p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// Order Status Card
function OrderStatusCard({
  icon: Icon,
  label,
  count,
  color,
  bgColor,
  delay
}: {
  icon: any
  label: string
  count: number
  color: string
  bgColor: string
  delay: number
}) {
  const animatedCount = useAnimatedCounter(count)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 200 }}
      whileHover={{ scale: 1.05 }}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all cursor-pointer",
        bgColor
      )}
    >
      <div className={cn("p-2 rounded-xl", bgColor.replace('/10', '/20').replace('/20', '/30'))}>
        <Icon className={cn("w-5 h-5", color)} />
      </div>
      <div>
        <p className={cn("text-2xl font-bold", color)}>{animatedCount}</p>
        <p className={cn("text-xs", color.replace('700', '600').replace('400', '500'))}>{label}</p>
      </div>
    </motion.div>
  )
}

// Progress Ring
function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  color = "#10b981"
}: {
  progress: number
  size?: number
  strokeWidth?: number
  color?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-gray-700"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-gray-900 dark:text-white">{Math.round(progress)}%</span>
      </div>
    </div>
  )
}

export default function AdminBrokersDashboardPage() {
  const { theme } = useTheme()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [mapReady, setMapReady] = useState(false)

  const [brokers, setBrokers] = useState<Broker[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [provinces, setProvinces] = useState<Province[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Mock order stats - replace with real API
  const orderStats = {
    total: 156,
    pending: 23,
    confirmed: 18,
    inDelivery: 12,
    delivered: 98,
    cancelled: 5,
    totalAmount: 45680.50
  }

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/brokers')
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setBrokers(data.data.brokers || [])
          setSummary(data.data.summary)
          setProvinces(data.data.provinces || [])
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  // Calculate province data
  const provinceData = brokers.reduce((acc, broker) => {
    const prov = broker.province || 'Sin asignar'
    if (!acc[prov]) acc[prov] = { count: 0, balance: 0, brokers: [] as Broker[] }
    acc[prov].count++
    acc[prov].balance += broker.walletBalance || 0
    acc[prov].brokers.push(broker)
    return acc
  }, {} as Record<string, { count: number, balance: number, brokers: Broker[] }>)

  // Top brokers
  const topBrokers = [...brokers]
    .sort((a, b) => b.walletBalance - a.walletBalance)
    .slice(0, 5)

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-79.5, 22.0],
      zoom: 5.8,
      pitch: 30,
      attributionControl: false,
      antialias: true
    })

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

    map.on('load', () => {
      mapRef.current = map
      setMapReady(true)

      // Add Cuba highlight
      map.addSource('cuba-boundary', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [-85.0, 19.5], [-85.0, 23.5], [-74.0, 23.5], [-74.0, 19.5], [-85.0, 19.5]
            ]]
          }
        }
      })
    })

    return () => {
      markersRef.current.forEach(m => m.remove())
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Add markers when data is ready
  useEffect(() => {
    if (!mapRef.current || !mapReady || brokers.length === 0) return

    // Clear old markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    // Add markers for provinces with brokers
    Object.entries(provinceData).forEach(([name, data]) => {
      if (name === 'Sin asignar' || !CUBA_PROVINCES[name]) return

      const { coords, color } = CUBA_PROVINCES[name]

      // Create marker element
      const el = document.createElement('div')
      el.innerHTML = `
        <div class="broker-marker" style="
          position: relative;
          cursor: pointer;
          transition: transform 0.3s ease;
        ">
          <div style="
            background: ${color};
            color: white;
            padding: 8px 14px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 14px;
            box-shadow: 0 8px 24px ${color}66;
            display: flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
          ">
            <span>${data.count}</span>
            <span style="font-size: 10px; opacity: 0.9;">broker${data.count > 1 ? 's' : ''}</span>
          </div>
          <div style="
            position: absolute;
            bottom: -6px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-top: 8px solid ${color};
          "></div>
        </div>
      `

      el.addEventListener('mouseenter', () => {
        el.querySelector('.broker-marker')?.setAttribute('style',
          (el.querySelector('.broker-marker')?.getAttribute('style') || '') + 'transform: scale(1.15);'
        )
      })
      el.addEventListener('mouseleave', () => {
        el.querySelector('.broker-marker')?.setAttribute('style',
          (el.querySelector('.broker-marker')?.getAttribute('style') || '').replace('transform: scale(1.15);', '')
        )
      })

      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        className: 'broker-popup'
      }).setHTML(`
        <div style="
          padding: 16px;
          min-width: 200px;
          font-family: system-ui, -apple-system, sans-serif;
        ">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <div style="
              width: 10px;
              height: 10px;
              border-radius: 50%;
              background: ${color};
            "></div>
            <h4 style="
              font-weight: 700;
              font-size: 16px;
              color: #1f2937;
              margin: 0;
            ">${name}</h4>
          </div>
          <div style="display: grid; gap: 8px;">
            <div style="
              display: flex;
              justify-content: space-between;
              padding: 8px 12px;
              background: #f3f4f6;
              border-radius: 8px;
            ">
              <span style="color: #6b7280; font-size: 13px;">Brokers</span>
              <span style="font-weight: 600; color: #1f2937;">${data.count}</span>
            </div>
            <div style="
              display: flex;
              justify-content: space-between;
              padding: 8px 12px;
              background: #ecfdf5;
              border-radius: 8px;
            ">
              <span style="color: #059669; font-size: 13px;">Balance</span>
              <span style="font-weight: 600; color: #059669;">$${data.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
          ${data.brokers.length > 0 ? `
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
              <p style="font-size: 11px; color: #9ca3af; margin-bottom: 8px;">BROKERS:</p>
              ${data.brokers.slice(0, 3).map(b => `
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  padding: 6px 0;
                  font-size: 12px;
                ">
                  <div style="
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: ${b.isActive ? '#10b981' : '#9ca3af'};
                  "></div>
                  <span style="color: #374151;">${b.name}</span>
                </div>
              `).join('')}
              ${data.brokers.length > 3 ? `
                <p style="font-size: 11px; color: #9ca3af; margin-top: 4px;">+${data.brokers.length - 3} más</p>
              ` : ''}
            </div>
          ` : ''}
        </div>
      `)

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(coords)
        .setPopup(popup)
        .addTo(mapRef.current!)

      markersRef.current.push(marker)
    })
  }, [provinceData, mapReady, brokers])

  const successRate = orderStats.total > 0
    ? (orderStats.delivered / orderStats.total) * 100
    : 0

  const activeRate = summary && summary.totalBrokers > 0
    ? (summary.activeBrokers / summary.totalBrokers) * 100
    : 0

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="animate-pulse">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl w-64 mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 h-[500px] bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse"></div>
              <div className="h-[500px] bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse"></div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <div className="max-w-7xl mx-auto p-6 space-y-6">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-3">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30"
                >
                  <Globe className="w-7 h-7 text-white" />
                </motion.div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-white dark:via-gray-100 dark:to-white bg-clip-text text-transparent">
                    Dashboard de Brokers
                  </h1>
                  <p className="text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-yellow-500" />
                    Red de distribución en Cuba
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all"
              >
                <RefreshCw className={cn("w-5 h-5 text-gray-600 dark:text-gray-400", refreshing && "animate-spin")} />
              </motion.button>

              <Link href="/dashboard/admin/brokers/orders">
                <motion.div
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-lg shadow-blue-500/30 font-medium"
                >
                  <Package className="w-4 h-4" />
                  Ver Órdenes
                  <ChevronRight className="w-4 h-4" />
                </motion.div>
              </Link>

              <Link href="/dashboard/admin/brokers/wallets">
                <motion.div
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl shadow-lg shadow-emerald-500/30 font-medium"
                >
                  <Wallet className="w-4 h-4" />
                  Wallets
                  <ChevronRight className="w-4 h-4" />
                </motion.div>
              </Link>
            </div>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Users}
              label="Total Brokers"
              value={summary?.totalBrokers || 0}
              subValue="Registrados en sistema"
              gradient="bg-gradient-to-br from-blue-500 to-blue-600"
              delay={0.1}
              trend={{ value: 12, positive: true }}
            />
            <StatCard
              icon={Zap}
              label="Brokers Activos"
              value={summary?.activeBrokers || 0}
              subValue={`${activeRate.toFixed(0)}% del total`}
              gradient="bg-gradient-to-br from-emerald-500 to-green-600"
              delay={0.15}
            />
            <StatCard
              icon={MapPin}
              label="Provincias"
              value={`${summary?.provincesCovered || 0}/16`}
              subValue="Cobertura nacional"
              gradient="bg-gradient-to-br from-purple-500 to-indigo-600"
              delay={0.2}
            />
            <StatCard
              icon={DollarSign}
              label="Balance Total"
              value={summary?.totalBalanceFormatted || '$0.00'}
              subValue="Fondos disponibles"
              gradient="bg-gradient-to-br from-amber-500 to-orange-600"
              delay={0.25}
              trend={{ value: 8, positive: true }}
            />
          </div>

          {/* Order Status Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl p-6 border border-white/20 dark:border-gray-700/50 shadow-xl"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                Estado de Órdenes
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Total: <span className="font-bold text-gray-900 dark:text-white">{orderStats.total}</span>
                </span>
                <div className="h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
                <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                  ${orderStats.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <OrderStatusCard
                icon={Clock}
                label="Pendientes"
                count={orderStats.pending}
                color="text-amber-700 dark:text-amber-400"
                bgColor="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                delay={0.35}
              />
              <OrderStatusCard
                icon={CheckCircle}
                label="Confirmadas"
                count={orderStats.confirmed}
                color="text-blue-700 dark:text-blue-400"
                bgColor="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                delay={0.4}
              />
              <OrderStatusCard
                icon={Truck}
                label="En Entrega"
                count={orderStats.inDelivery}
                color="text-purple-700 dark:text-purple-400"
                bgColor="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800"
                delay={0.45}
              />
              <OrderStatusCard
                icon={CheckCircle}
                label="Entregadas"
                count={orderStats.delivered}
                color="text-emerald-700 dark:text-emerald-400"
                bgColor="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                delay={0.5}
              />
              <OrderStatusCard
                icon={XCircle}
                label="Canceladas"
                count={orderStats.cancelled}
                color="text-red-700 dark:text-red-400"
                bgColor="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                delay={0.55}
              />
            </div>
          </motion.div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Map */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="lg:col-span-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/20 dark:border-gray-700/50 shadow-xl"
            >
              <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                      <Globe className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white">Mapa de Cobertura</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Red de brokers en Cuba</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                    {Object.keys(provinceData).filter(k => k !== 'Sin asignar').length} provincias activas
                  </div>
                </div>
              </div>
              <div
                ref={mapContainerRef}
                className="w-full h-[450px]"
              />
            </motion.div>

            {/* Right Sidebar */}
            <div className="space-y-6">

              {/* Success Rate */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl p-6 border border-white/20 dark:border-gray-700/50 shadow-xl"
              >
                <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                  Tasa de Éxito
                </h3>
                <div className="flex items-center justify-center">
                  <ProgressRing progress={successRate} color="#10b981" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{orderStats.delivered}</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Entregadas</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-100 dark:bg-gray-700">
                    <p className="text-xl font-bold text-gray-700 dark:text-gray-300">{orderStats.total - orderStats.delivered}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">En proceso</p>
                  </div>
                </div>
              </motion.div>

              {/* Province Chart */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.55 }}
                className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl p-6 border border-white/20 dark:border-gray-700/50 shadow-xl"
              >
                <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-500" />
                  Por Provincia
                </h3>
                <div className="space-y-3">
                  {Object.entries(provinceData)
                    .filter(([name]) => name !== 'Sin asignar')
                    .sort((a, b) => b[1].count - a[1].count)
                    .slice(0, 5)
                    .map(([name, data], i) => {
                      const maxCount = Math.max(...Object.values(provinceData).map(d => d.count))
                      const percentage = (data.count / maxCount) * 100
                      const color = CUBA_PROVINCES[name]?.color || '#6b7280'

                      return (
                        <motion.div
                          key={name}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.6 + i * 0.05 }}
                        >
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-gray-600 dark:text-gray-400 truncate">{name}</span>
                            <span className="font-semibold text-gray-900 dark:text-white">{data.count}</span>
                          </div>
                          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ delay: 0.65 + i * 0.05, duration: 0.6 }}
                              className="h-full rounded-full"
                              style={{ background: color }}
                            />
                          </div>
                        </motion.div>
                      )
                    })}
                  {Object.keys(provinceData).filter(k => k !== 'Sin asignar').length === 0 && (
                    <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
                      No hay datos de provincias
                    </p>
                  )}
                </div>
              </motion.div>
            </div>
          </div>

          {/* Bottom Section - Top Brokers & All Brokers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Top Brokers */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
              className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl p-6 border border-white/20 dark:border-gray-700/50 shadow-xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-amber-500" />
                  Top Brokers
                </h3>
                <Link href="/dashboard/admin/brokers/wallets" className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1">
                  Ver todos <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="space-y-3">
                {topBrokers.map((broker, i) => (
                  <motion.div
                    key={broker.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + i * 0.05 }}
                    whileHover={{ scale: 1.01, x: 4 }}
                    className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-gray-50 to-white dark:from-gray-700/50 dark:to-gray-800/50 border border-gray-100 dark:border-gray-700"
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm",
                      i === 0 && "bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg shadow-amber-500/30",
                      i === 1 && "bg-gradient-to-br from-gray-300 to-gray-400 text-white",
                      i === 2 && "bg-gradient-to-br from-amber-600 to-orange-700 text-white",
                      i > 2 && "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                    )}>
                      #{i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{broker.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {broker.province || 'Sin provincia'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600 dark:text-emerald-400">{broker.walletBalanceFormatted}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{broker.stats?.totalTransactions || 0} transacciones</p>
                    </div>
                  </motion.div>
                ))}
                {topBrokers.length === 0 && (
                  <div className="text-center py-8">
                    <Building2 className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No hay brokers registrados</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* All Brokers */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl p-6 border border-white/20 dark:border-gray-700/50 shadow-xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-500" />
                  Todos los Brokers
                </h3>
                <span className="text-sm px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium">
                  {brokers.length} total
                </span>
              </div>

              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 scrollbar-thin">
                {brokers.map((broker, i) => (
                  <motion.div
                    key={broker.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.75 + i * 0.02 }}
                    whileHover={{ backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.5)' : 'rgba(249, 250, 251, 1)' }}
                    className="flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        broker.isActive ? "bg-emerald-500" : "bg-gray-400"
                      )} />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm">{broker.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {broker.municipality ? `${broker.municipality}, ` : ''}{broker.province || 'Sin ubicación'}
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400 text-sm">
                      {broker.walletBalanceFormatted}
                    </p>
                  </motion.div>
                ))}
                {brokers.length === 0 && (
                  <div className="text-center py-12">
                    <Building2 className="w-16 h-16 mx-auto text-gray-200 dark:text-gray-700 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">No hay brokers registrados</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                      Los brokers aparecerán aquí cuando se registren
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
