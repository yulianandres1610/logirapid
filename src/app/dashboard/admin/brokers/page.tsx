'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  PieChart,
  Globe,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

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

// Cuba provinces SVG paths (simplified for visualization)
const CUBA_PROVINCES: Record<string, { path: string, center: [number, number], name: string }> = {
  'Pinar del Río': {
    path: 'M 20 120 L 60 100 L 80 110 L 70 140 L 30 150 Z',
    center: [45, 125],
    name: 'Pinar del Río'
  },
  'Artemisa': {
    path: 'M 80 110 L 100 100 L 115 105 L 105 130 L 70 140 Z',
    center: [92, 118],
    name: 'Artemisa'
  },
  'La Habana': {
    path: 'M 115 105 L 140 95 L 155 100 L 145 120 L 105 130 Z',
    center: [130, 110],
    name: 'La Habana'
  },
  'Mayabeque': {
    path: 'M 145 120 L 155 100 L 185 95 L 180 125 L 150 135 Z',
    center: [165, 115],
    name: 'Mayabeque'
  },
  'Matanzas': {
    path: 'M 180 125 L 185 95 L 250 80 L 260 110 L 200 140 Z',
    center: [215, 108],
    name: 'Matanzas'
  },
  'Cienfuegos': {
    path: 'M 200 140 L 260 110 L 280 115 L 260 150 L 210 155 Z',
    center: [240, 135],
    name: 'Cienfuegos'
  },
  'Villa Clara': {
    path: 'M 260 110 L 280 100 L 330 90 L 340 120 L 280 115 Z',
    center: [300, 106],
    name: 'Villa Clara'
  },
  'Sancti Spíritus': {
    path: 'M 340 120 L 330 90 L 380 80 L 400 100 L 380 135 Z',
    center: [360, 106],
    name: 'Sancti Spíritus'
  },
  'Ciego de Ávila': {
    path: 'M 400 100 L 380 80 L 430 70 L 460 90 L 440 115 Z',
    center: [420, 90],
    name: 'Ciego de Ávila'
  },
  'Camagüey': {
    path: 'M 460 90 L 430 70 L 520 55 L 560 80 L 510 110 Z',
    center: [490, 80],
    name: 'Camagüey'
  },
  'Las Tunas': {
    path: 'M 560 80 L 520 55 L 580 45 L 620 65 L 590 95 Z',
    center: [575, 68],
    name: 'Las Tunas'
  },
  'Holguín': {
    path: 'M 620 65 L 580 45 L 650 35 L 700 55 L 660 85 Z',
    center: [640, 55],
    name: 'Holguín'
  },
  'Granma': {
    path: 'M 590 95 L 620 65 L 660 85 L 640 115 L 600 120 Z',
    center: [625, 95],
    name: 'Granma'
  },
  'Santiago de Cuba': {
    path: 'M 660 85 L 700 55 L 750 65 L 740 95 L 680 110 Z',
    center: [710, 80],
    name: 'Santiago de Cuba'
  },
  'Guantánamo': {
    path: 'M 750 65 L 790 55 L 810 75 L 780 100 L 740 95 Z',
    center: [775, 75],
    name: 'Guantánamo'
  },
  'Isla de la Juventud': {
    path: 'M 90 180 L 130 165 L 145 185 L 120 210 L 85 200 Z',
    center: [115, 188],
    name: 'Isla de la Juventud'
  }
}

// Animated counter component
function AnimatedCounter({ value, duration = 1.5, prefix = '', suffix = '' }: { value: number, duration?: number, prefix?: string, suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    let startTime: number
    let animationFrame: number

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1)

      setDisplayValue(Math.floor(progress * value))

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [value, duration])

  return <span>{prefix}{displayValue.toLocaleString()}{suffix}</span>
}

// Mini bar chart component
function MiniBarChart({ data, maxValue }: { data: { label: string, value: number, color: string }[], maxValue: number }) {
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((item, index) => (
        <motion.div
          key={item.label}
          initial={{ height: 0 }}
          animate={{ height: `${(item.value / maxValue) * 100}%` }}
          transition={{ delay: index * 0.1, duration: 0.5 }}
          className={cn("flex-1 rounded-t-sm min-h-[4px]", item.color)}
          title={`${item.label}: ${item.value}`}
        />
      ))}
    </div>
  )
}

// Donut chart component
function DonutChart({ active, inactive, size = 80 }: { active: number, inactive: number, size?: number }) {
  const total = active + inactive
  const activePercentage = total > 0 ? (active / total) * 100 : 0
  const circumference = 2 * Math.PI * 35
  const activeOffset = circumference - (circumference * activePercentage) / 100

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 80 80" className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx="40"
          cy="40"
          r="35"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-gray-200 dark:text-gray-700"
        />
        {/* Active portion */}
        <motion.circle
          cx="40"
          cy="40"
          r="35"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          className="text-green-500"
          initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: activeOffset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold">{Math.round(activePercentage)}%</span>
      </div>
    </div>
  )
}

export default function AdminBrokersDashboardPage() {
  const { theme } = useTheme()
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [provinces, setProvinces] = useState<Province[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null)
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null)

  useEffect(() => {
    fetchBrokers()
  }, [])

  const fetchBrokers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/brokers')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setBrokers(data.data.brokers || [])
          setSummary(data.data.summary)
          setProvinces(data.data.provinces || [])
        }
      }
    } catch (error) {
      console.error('Error fetching brokers:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate province data
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

  // Top provinces for chart
  const topProvinces = useMemo(() => {
    return Object.entries(provinceData)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6)
      .map(([name, data]) => ({ name, ...data }))
  }, [provinceData])

  const maxProvinceCount = Math.max(...topProvinces.map(p => p.count), 1)

  // Get province color based on broker count
  const getProvinceColor = (provinceName: string) => {
    const data = provinceData[provinceName]
    if (!data || data.count === 0) {
      return theme === 'dark' ? 'fill-gray-700' : 'fill-gray-200'
    }
    if (data.count >= 3) return 'fill-green-500'
    if (data.count >= 2) return 'fill-green-400'
    return 'fill-green-300'
  }

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
                <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
              ))}
            </div>
            <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
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
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
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
              Red de brokers en Cuba
            </motion.p>
          </div>
          <div className="flex gap-3">
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={fetchBrokers}
              className={cn(
                "p-2 rounded-xl transition-all",
                theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700 text-gray-400' : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200'
              )}
            >
              <RefreshCw className="w-5 h-5" />
            </motion.button>
            <Link href="/dashboard/admin/brokers/orders">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl shadow-lg"
              >
                <Package className="w-4 h-4" />
                Órdenes
              </motion.div>
            </Link>
            <Link href="/dashboard/admin/brokers/wallets">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl shadow-lg"
              >
                <Wallet className="w-4 h-4" />
                Wallets
              </motion.div>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Brokers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "relative overflow-hidden rounded-2xl p-5",
              theme === 'dark' ? 'bg-gray-800' : 'bg-white',
              "border",
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}
          >
            <div className="absolute top-0 right-0 w-20 h-20 transform translate-x-6 -translate-y-6">
              <div className="w-full h-full rounded-full bg-blue-500/10"></div>
            </div>
            <div className="flex items-start justify-between">
              <div>
                <p className={cn(
                  "text-sm font-medium",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                )}>Total Brokers</p>
                <p className={cn(
                  "text-3xl font-bold mt-1",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  <AnimatedCounter value={summary?.totalBrokers || 0} />
                </p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
                <Users className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-500 font-medium">
                {summary?.activeBrokers || 0} activos
              </span>
            </div>
          </motion.div>

          {/* Provincias Cubiertas */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(
              "relative overflow-hidden rounded-2xl p-5",
              theme === 'dark' ? 'bg-gray-800' : 'bg-white',
              "border",
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}
          >
            <div className="absolute top-0 right-0 w-20 h-20 transform translate-x-6 -translate-y-6">
              <div className="w-full h-full rounded-full bg-purple-500/10"></div>
            </div>
            <div className="flex items-start justify-between">
              <div>
                <p className={cn(
                  "text-sm font-medium",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                )}>Provincias</p>
                <p className={cn(
                  "text-3xl font-bold mt-1",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  <AnimatedCounter value={summary?.provincesCovered || 0} />
                  <span className="text-lg text-gray-400">/16</span>
                </p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600">
                <MapPin className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="mt-3">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${((summary?.provincesCovered || 0) / 16) * 100}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                  className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-purple-600"
                />
              </div>
            </div>
          </motion.div>

          {/* Balance Total */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cn(
              "relative overflow-hidden rounded-2xl p-5",
              theme === 'dark' ? 'bg-gray-800' : 'bg-white',
              "border",
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}
          >
            <div className="absolute top-0 right-0 w-20 h-20 transform translate-x-6 -translate-y-6">
              <div className="w-full h-full rounded-full bg-green-500/10"></div>
            </div>
            <div className="flex items-start justify-between">
              <div>
                <p className={cn(
                  "text-sm font-medium",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                )}>Balance Total</p>
                <p className={cn(
                  "text-2xl font-bold mt-1",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  {summary?.totalBalanceFormatted || '$0.00'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-green-600">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1">
              <Activity className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Fondos disponibles
              </span>
            </div>
          </motion.div>

          {/* Estado de Brokers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={cn(
              "relative overflow-hidden rounded-2xl p-5",
              theme === 'dark' ? 'bg-gray-800' : 'bg-white',
              "border",
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className={cn(
                  "text-sm font-medium",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                )}>Estado</p>
                <div className="flex items-center gap-3 mt-2">
                  <DonutChart
                    active={summary?.activeBrokers || 0}
                    inactive={(summary?.totalBrokers || 0) - (summary?.activeBrokers || 0)}
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {summary?.activeBrokers || 0} Activos
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {(summary?.totalBrokers || 0) - (summary?.activeBrokers || 0)} Inactivos
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cuba Map */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className={cn(
              "lg:col-span-2 rounded-2xl p-6",
              theme === 'dark' ? 'bg-gray-800' : 'bg-white',
              "border",
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className={cn(
                "text-lg font-semibold flex items-center gap-2",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                <Globe className="w-5 h-5 text-blue-500" />
                Mapa de Cobertura
              </h2>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-gray-500 dark:text-gray-400">3+ brokers</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  <span className="text-gray-500 dark:text-gray-400">2 brokers</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-300"></div>
                  <span className="text-gray-500 dark:text-gray-400">1 broker</span>
                </div>
              </div>
            </div>

            {/* Cuba SVG Map */}
            <div className="relative">
              <svg
                viewBox="0 0 850 250"
                className="w-full h-auto"
                style={{ minHeight: '300px' }}
              >
                {/* Background water effect */}
                <defs>
                  <linearGradient id="waterGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={theme === 'dark' ? '#1e3a5f' : '#e0f2fe'} />
                    <stop offset="100%" stopColor={theme === 'dark' ? '#0f172a' : '#bae6fd'} />
                  </linearGradient>
                </defs>
                <rect x="0" y="0" width="850" height="250" fill="url(#waterGradient)" rx="12" />

                {/* Province paths */}
                {Object.entries(CUBA_PROVINCES).map(([name, province]) => {
                  const data = provinceData[name]
                  const isHovered = hoveredProvince === name
                  const isSelected = selectedProvince === name

                  return (
                    <g key={name}>
                      <motion.path
                        d={province.path}
                        className={cn(
                          getProvinceColor(name),
                          "cursor-pointer transition-all duration-300",
                          (isHovered || isSelected) && "stroke-2"
                        )}
                        stroke={theme === 'dark' ? '#374151' : '#9ca3af'}
                        strokeWidth={isHovered || isSelected ? 2 : 1}
                        initial={{ opacity: 0 }}
                        animate={{
                          opacity: 1,
                          scale: isHovered ? 1.02 : 1
                        }}
                        transition={{ duration: 0.3 }}
                        onMouseEnter={() => setHoveredProvince(name)}
                        onMouseLeave={() => setHoveredProvince(null)}
                        onClick={() => setSelectedProvince(selectedProvince === name ? null : name)}
                      />
                      {/* Province marker if has brokers */}
                      {data && data.count > 0 && (
                        <motion.g
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.5, type: 'spring' }}
                        >
                          <circle
                            cx={province.center[0]}
                            cy={province.center[1]}
                            r={8 + data.count * 2}
                            className="fill-blue-500/30"
                          />
                          <circle
                            cx={province.center[0]}
                            cy={province.center[1]}
                            r={6}
                            className="fill-blue-500"
                          />
                          <text
                            x={province.center[0]}
                            y={province.center[1] + 1}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="fill-white text-[8px] font-bold"
                          >
                            {data.count}
                          </text>
                        </motion.g>
                      )}
                    </g>
                  )
                })}
              </svg>

              {/* Tooltip */}
              <AnimatePresence>
                {hoveredProvince && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className={cn(
                      "absolute top-4 left-4 p-4 rounded-xl shadow-lg z-10",
                      theme === 'dark' ? 'bg-gray-700' : 'bg-white'
                    )}
                  >
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {hoveredProvince}
                    </p>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Brokers: <span className="font-medium text-gray-900 dark:text-white">
                          {provinceData[hoveredProvince]?.count || 0}
                        </span>
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Balance: <span className="font-medium text-green-500">
                          {formatCurrency(provinceData[hoveredProvince]?.balance || 0)}
                        </span>
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Right Side Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="space-y-6"
          >
            {/* Distribution by Province Chart */}
            <div className={cn(
              "rounded-2xl p-5",
              theme === 'dark' ? 'bg-gray-800' : 'bg-white',
              "border",
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}>
              <h3 className={cn(
                "text-sm font-semibold mb-4 flex items-center gap-2",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                <BarChart3 className="w-4 h-4 text-blue-500" />
                Distribución por Provincia
              </h3>
              <div className="space-y-3">
                {topProvinces.map((prov, index) => (
                  <motion.div
                    key={prov.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {prov.name}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {prov.count}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(prov.count / maxProvinceCount) * 100}%` }}
                        transition={{ duration: 0.5, delay: 0.7 + index * 0.1 }}
                        className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600"
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Recent Brokers */}
            <div className={cn(
              "rounded-2xl p-5",
              theme === 'dark' ? 'bg-gray-800' : 'bg-white',
              "border",
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}>
              <h3 className={cn(
                "text-sm font-semibold mb-4 flex items-center gap-2",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                <Building2 className="w-4 h-4 text-purple-500" />
                Brokers Recientes
              </h3>
              <div className="space-y-3">
                {brokers.slice(0, 5).map((broker, index) => (
                  <motion.div
                    key={broker.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + index * 0.1 }}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl",
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      broker.isActive
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : 'bg-gray-100 dark:bg-gray-600'
                    )}>
                      <Building2 className={cn(
                        "w-5 h-5",
                        broker.isActive
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-gray-400'
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {broker.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {broker.municipality}, {broker.province}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-500">
                        {broker.walletBalanceFormatted}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
              {brokers.length > 5 && (
                <Link href="/dashboard/admin/brokers/wallets">
                  <motion.div
                    whileHover={{ x: 5 }}
                    className="mt-4 flex items-center justify-center gap-2 text-sm text-blue-500 hover:text-blue-600"
                  >
                    Ver todos los brokers
                    <ChevronRight className="w-4 h-4" />
                  </motion.div>
                </Link>
              )}
            </div>
          </motion.div>
        </div>

        {/* Province Detail Panel */}
        <AnimatePresence>
          {selectedProvince && provinceData[selectedProvince] && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={cn(
                "rounded-2xl p-6 overflow-hidden",
                theme === 'dark' ? 'bg-gray-800' : 'bg-white',
                "border",
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={cn(
                  "text-lg font-semibold flex items-center gap-2",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  <MapPin className="w-5 h-5 text-purple-500" />
                  Brokers en {selectedProvince}
                </h3>
                <button
                  onClick={() => setSelectedProvince(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {provinceData[selectedProvince].brokers.map((broker, index) => (
                  <motion.div
                    key={broker.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className={cn(
                      "p-4 rounded-xl",
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                    )}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        broker.isActive
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : 'bg-gray-100 dark:bg-gray-600'
                      )}>
                        <Building2 className={cn(
                          "w-5 h-5",
                          broker.isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-400'
                        )} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{broker.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{broker.municipality}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className={cn(
                        "p-2 rounded-lg",
                        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                      )}>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Balance</p>
                        <p className="text-sm font-semibold text-green-500">{broker.walletBalanceFormatted}</p>
                      </div>
                      <div className={cn(
                        "p-2 rounded-lg",
                        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                      )}>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Transacciones</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{broker.stats?.totalTransactions || 0}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  )
}
