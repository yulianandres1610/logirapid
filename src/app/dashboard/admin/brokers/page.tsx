'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  Users,
  MapPin,
  DollarSign,
  Package,
  TrendingUp,
  TrendingDown,
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
  ArrowUpRight,
  ArrowDownRight,
  Send,
  XCircle,
  Truck,
  Calendar,
  CreditCard,
  Eye
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

// Mapbox token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'

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

interface OrderStats {
  total: number
  pending: number
  confirmed: number
  inDelivery: number
  delivered: number
  cancelled: number
  totalAmount: number
}

// Cuba province coordinates for map markers
const CUBA_PROVINCE_COORDS: Record<string, [number, number]> = {
  'Pinar del Río': [-83.6978, 22.4175],
  'Artemisa': [-82.7617, 22.8136],
  'La Habana': [-82.3666, 23.1136],
  'Mayabeque': [-81.9300, 22.9200],
  'Matanzas': [-81.5775, 22.4117],
  'Cienfuegos': [-80.4536, 22.1456],
  'Villa Clara': [-79.9658, 22.4058],
  'Sancti Spíritus': [-79.4428, 21.9303],
  'Ciego de Ávila': [-78.7619, 21.8403],
  'Camagüey': [-77.9169, 21.3808],
  'Las Tunas': [-76.9514, 20.9597],
  'Holguín': [-76.2633, 20.7869],
  'Granma': [-76.6431, 20.3847],
  'Santiago de Cuba': [-75.8219, 20.0247],
  'Guantánamo': [-75.2092, 20.1447],
  'Isla de la Juventud': [-82.8500, 21.7000]
}

// Animated number component
function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0 }: {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
}) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const duration = 1500
    const startTime = Date.now()
    const startValue = displayValue

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const current = startValue + (value - startValue) * easeOut

      setDisplayValue(current)

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [value])

  const formatted = decimals > 0
    ? displayValue.toFixed(decimals)
    : Math.round(displayValue).toLocaleString()

  return <span>{prefix}{formatted}{suffix}</span>
}

// Mini donut chart
function MiniDonut({ percentage, color, size = 48 }: { percentage: number, color: string, size?: number }) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (circumference * percentage) / 100

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size/2}
        cy={size/2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        className="text-gray-200 dark:text-gray-700"
      />
      <motion.circle
        cx={size/2}
        cy={size/2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
    </svg>
  )
}

// Horizontal bar for charts
function HorizontalBar({ value, maxValue, color, label, showValue = true }: {
  value: number
  maxValue: number
  color: string
  label: string
  showValue?: boolean
}) {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400 truncate">{label}</span>
        {showValue && <span className="font-medium text-gray-900 dark:text-white">{value}</span>}
      </div>
      <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={cn("h-full rounded-full", color)}
        />
      </div>
    </div>
  )
}

// Status badge component
function StatusBadge({ status, count }: { status: string, count: number }) {
  const configs: Record<string, { bg: string, text: string, icon: any }> = {
    pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', icon: Clock },
    confirmed: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', icon: CheckCircle },
    in_delivery: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', icon: Truck },
    delivered: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', icon: CheckCircle },
    cancelled: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', icon: XCircle },
  }

  const config = configs[status] || configs.pending
  const Icon = config.icon

  return (
    <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg", config.bg)}>
      <Icon className={cn("w-4 h-4", config.text)} />
      <span className={cn("text-sm font-medium", config.text)}>{count}</span>
    </div>
  )
}

export default function AdminBrokersDashboardPage() {
  const { theme } = useTheme()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])

  const [brokers, setBrokers] = useState<Broker[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [provinces, setProvinces] = useState<Province[]>([])
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Fetch data
  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    setLoading(true)
    try {
      // Fetch brokers
      const brokersRes = await fetch('/api/admin/brokers')
      if (brokersRes.ok) {
        const data = await brokersRes.json()
        if (data.success) {
          setBrokers(data.data.brokers || [])
          setSummary(data.data.summary)
          setProvinces(data.data.provinces || [])
        }
      }

      // Fetch order stats (mock for now - you can create this API)
      // For demonstration, using calculated values
      setOrderStats({
        total: 156,
        pending: 23,
        confirmed: 18,
        inDelivery: 12,
        delivered: 98,
        cancelled: 5,
        totalAmount: 45680.50
      })
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate province data for markers
  const provinceData = useMemo(() => {
    const data: Record<string, { count: number, balance: number, brokers: Broker[] }> = {}
    brokers.forEach(broker => {
      const prov = broker.province || 'Sin asignar'
      if (!data[prov]) {
        data[prov] = { count: 0, balance: 0, brokers: [] }
      }
      data[prov].count++
      data[prov].balance += broker.walletBalance || 0
      data[prov].brokers.push(broker)
    })
    return data
  }, [brokers])

  // Top brokers by balance
  const topBrokers = useMemo(() => {
    return [...brokers]
      .sort((a, b) => b.walletBalance - a.walletBalance)
      .slice(0, 5)
  }, [brokers])

  // Province distribution for chart
  const provinceDistribution = useMemo(() => {
    return Object.entries(provinceData)
      .filter(([name]) => name !== 'Sin asignar')
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6)
  }, [provinceData])

  const maxProvinceCount = Math.max(...provinceDistribution.map(([, d]) => d.count), 1)

  // Initialize Mapbox
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: theme === 'dark'
        ? 'mapbox://styles/mapbox/dark-v11'
        : 'mapbox://styles/mapbox/light-v11',
      center: [-79.5, 21.5], // Center of Cuba
      zoom: 5.5,
      attributionControl: false
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')

    map.on('load', () => {
      setMapLoaded(true)
      mapRef.current = map
    })

    return () => {
      markersRef.current.forEach(marker => marker.remove())
      map.remove()
      mapRef.current = null
    }
  }, [theme])

  // Add markers when data loads
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || brokers.length === 0) return

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove())
    markersRef.current = []

    // Add markers for each province with brokers
    Object.entries(provinceData).forEach(([provinceName, data]) => {
      if (data.count === 0 || provinceName === 'Sin asignar') return

      const coords = CUBA_PROVINCE_COORDS[provinceName]
      if (!coords) return

      // Create custom marker element
      const el = document.createElement('div')
      el.className = 'broker-marker'
      el.innerHTML = `
        <div style="
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          color: white;
          padding: 8px 12px;
          border-radius: 20px;
          font-weight: bold;
          font-size: 12px;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: transform 0.2s;
        ">
          <span style="font-size: 14px;">${data.count}</span>
          <span style="font-size: 10px; opacity: 0.9;">brokers</span>
        </div>
      `

      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.1)'
      })
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)'
      })

      // Create popup
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="padding: 8px; min-width: 150px;">
          <h4 style="font-weight: bold; margin-bottom: 8px; color: #1f2937;">${provinceName}</h4>
          <div style="display: flex; flex-direction: column; gap: 4px; font-size: 13px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #6b7280;">Brokers:</span>
              <span style="font-weight: 600; color: #1f2937;">${data.count}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #6b7280;">Balance:</span>
              <span style="font-weight: 600; color: #10b981;">$${data.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      `)

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat(coords)
        .setPopup(popup)
        .addTo(mapRef.current!)

      markersRef.current.push(marker)
    })
  }, [provinceData, mapLoaded, brokers])

  // Update map style when theme changes
  useEffect(() => {
    if (!mapRef.current) return
    mapRef.current.setStyle(
      theme === 'dark'
        ? 'mapbox://styles/mapbox/dark-v11'
        : 'mapbox://styles/mapbox/light-v11'
    )
  }, [theme])

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className={cn(
          "min-h-screen p-6",
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
        )}>
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 h-96 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
              <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className={cn(
        "min-h-screen p-6 space-y-6",
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "text-2xl font-bold flex items-center gap-3",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}
            >
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                <Globe className="w-6 h-6 text-white" />
              </div>
              Dashboard de Brokers
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className={cn(
                "mt-1 ml-14",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )}
            >
              Control completo de la red de brokers en Cuba
            </motion.p>
          </div>
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={fetchAllData}
              className={cn(
                "p-2.5 rounded-xl transition-all",
                theme === 'dark'
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-400'
                  : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 shadow-sm'
              )}
            >
              <RefreshCw className="w-5 h-5" />
            </motion.button>
            <Link href="/dashboard/admin/brokers/orders">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/25"
              >
                <Package className="w-4 h-4" />
                <span className="font-medium">Órdenes</span>
              </motion.div>
            </Link>
            <Link href="/dashboard/admin/brokers/wallets">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-500/25"
              >
                <Wallet className="w-4 h-4" />
                <span className="font-medium">Wallets</span>
              </motion.div>
            </Link>
          </div>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {/* Total Brokers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "rounded-2xl p-4 border",
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  <AnimatedNumber value={summary?.totalBrokers || 0} />
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Brokers</p>
              </div>
            </div>
          </motion.div>

          {/* Active Brokers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className={cn(
              "rounded-2xl p-4 border",
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  <AnimatedNumber value={summary?.activeBrokers || 0} />
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Activos</p>
              </div>
            </div>
          </motion.div>

          {/* Provinces */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(
              "rounded-2xl p-4 border",
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                <MapPin className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  <AnimatedNumber value={summary?.provincesCovered || 0} />
                  <span className="text-sm text-gray-400">/16</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Provincias</p>
              </div>
            </div>
          </motion.div>

          {/* Total Balance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={cn(
              "rounded-2xl p-4 border",
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {summary?.totalBalanceFormatted || '$0.00'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Balance Total</p>
              </div>
            </div>
          </motion.div>

          {/* Total Orders */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cn(
              "rounded-2xl p-4 border",
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-orange-100 dark:bg-orange-900/30">
                <Package className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  <AnimatedNumber value={orderStats?.total || 0} />
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Órdenes Totales</p>
              </div>
            </div>
          </motion.div>

          {/* Revenue */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className={cn(
              "rounded-2xl p-4 border",
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-100 dark:bg-cyan-900/30">
                <CreditCard className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(orderStats?.totalAmount || 0)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Volumen Total</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Order Status Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={cn(
            "rounded-2xl p-5 border",
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          )}
        >
          <h3 className={cn(
            "text-sm font-semibold mb-4 flex items-center gap-2",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            <Activity className="w-4 h-4 text-blue-500" />
            Estado de Órdenes de Cupones Familiares
          </h3>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <div>
                <p className="text-xl font-bold text-yellow-700 dark:text-yellow-300">{orderStats?.pending || 0}</p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400">Pendientes</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{orderStats?.confirmed || 0}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">Confirmadas</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <Truck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <div>
                <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{orderStats?.inDelivery || 0}</p>
                <p className="text-xs text-purple-600 dark:text-purple-400">En Entrega</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-xl font-bold text-green-700 dark:text-green-300">{orderStats?.delivered || 0}</p>
                <p className="text-xs text-green-600 dark:text-green-400">Entregadas</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <div>
                <p className="text-xl font-bold text-red-700 dark:text-red-300">{orderStats?.cancelled || 0}</p>
                <p className="text-xs text-red-600 dark:text-red-400">Canceladas</p>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-end gap-2">
              <div className="text-right">
                <p className="text-xs text-gray-500 dark:text-gray-400">Tasa de Éxito</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  {orderStats && orderStats.total > 0
                    ? ((orderStats.delivered / orderStats.total) * 100).toFixed(1)
                    : 0}%
                </p>
              </div>
              <MiniDonut
                percentage={orderStats && orderStats.total > 0
                  ? (orderStats.delivered / orderStats.total) * 100
                  : 0}
                color="#10b981"
              />
            </div>
          </div>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map Section */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35 }}
            className={cn(
              "lg:col-span-2 rounded-2xl overflow-hidden border",
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            )}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className={cn(
                "font-semibold flex items-center gap-2",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                <Globe className="w-5 h-5 text-blue-500" />
                Mapa de Cobertura - Cuba
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Click en los marcadores para ver detalles de cada provincia
              </p>
            </div>
            <div
              ref={mapContainerRef}
              className="w-full h-[400px]"
              style={{ minHeight: '400px' }}
            />
          </motion.div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Province Distribution */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className={cn(
                "rounded-2xl p-5 border",
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              )}
            >
              <h3 className={cn(
                "text-sm font-semibold mb-4 flex items-center gap-2",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                <BarChart3 className="w-4 h-4 text-indigo-500" />
                Distribución por Provincia
              </h3>
              <div className="space-y-3">
                {provinceDistribution.map(([name, data], index) => (
                  <motion.div
                    key={name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.45 + index * 0.05 }}
                  >
                    <HorizontalBar
                      value={data.count}
                      maxValue={maxProvinceCount}
                      color="bg-gradient-to-r from-indigo-500 to-blue-500"
                      label={name}
                    />
                  </motion.div>
                ))}
                {provinceDistribution.length === 0 && (
                  <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
                    No hay datos de provincias
                  </p>
                )}
              </div>
            </motion.div>

            {/* Active vs Inactive */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className={cn(
                "rounded-2xl p-5 border",
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              )}
            >
              <h3 className={cn(
                "text-sm font-semibold mb-4 flex items-center gap-2",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                <Activity className="w-4 h-4 text-green-500" />
                Estado de Brokers
              </h3>
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <div className="relative inline-flex items-center justify-center">
                    <MiniDonut
                      percentage={summary && summary.totalBrokers > 0
                        ? (summary.activeBrokers / summary.totalBrokers) * 100
                        : 0}
                      color="#10b981"
                      size={80}
                    />
                    <span className="absolute text-lg font-bold text-gray-900 dark:text-white">
                      {summary && summary.totalBrokers > 0
                        ? Math.round((summary.activeBrokers / summary.totalBrokers) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {summary?.activeBrokers || 0} Activos
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {(summary?.totalBrokers || 0) - (summary?.activeBrokers || 0)} Inactivos
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Brokers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className={cn(
              "rounded-2xl p-5 border",
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={cn(
                "text-sm font-semibold flex items-center gap-2",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Top Brokers por Balance
              </h3>
              <Link
                href="/dashboard/admin/brokers/wallets"
                className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
              >
                Ver todos <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {topBrokers.map((broker, index) => (
                <motion.div
                  key={broker.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + index * 0.05 }}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-xl",
                    theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm",
                    index === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    index === 1 ? 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300' :
                    index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  )}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {broker.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {broker.province || 'Sin provincia'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {broker.walletBalanceFormatted}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {broker.stats?.totalTransactions || 0} tx
                    </p>
                  </div>
                </motion.div>
              ))}
              {topBrokers.length === 0 && (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
                  No hay brokers registrados
                </p>
              )}
            </div>
          </motion.div>

          {/* All Brokers Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className={cn(
              "rounded-2xl p-5 border",
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={cn(
                "text-sm font-semibold flex items-center gap-2",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                <Building2 className="w-4 h-4 text-blue-500" />
                Todos los Brokers
              </h3>
              <span className={cn(
                "text-xs px-2 py-1 rounded-full",
                theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
              )}>
                {brokers.length} registrados
              </span>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {brokers.map((broker, index) => (
                <motion.div
                  key={broker.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.65 + index * 0.02 }}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl transition-colors",
                    theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      broker.isActive ? 'bg-green-500' : 'bg-gray-400'
                    )} />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {broker.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {broker.municipality}, {broker.province}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      {broker.walletBalanceFormatted}
                    </p>
                  </div>
                </motion.div>
              ))}
              {brokers.length === 0 && (
                <div className="text-center py-8">
                  <Building2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No hay brokers registrados
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  )
}
