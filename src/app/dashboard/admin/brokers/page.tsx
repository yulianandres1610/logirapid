'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  Users,
  MapPin,
  DollarSign,
  Package,
  TrendingUp,
  Building2,
  Clock,
  CheckCircle,
  ChevronRight,
  Activity,
  RefreshCw,
  XCircle,
  Truck,
  Zap,
  Globe,
  Layers,
  Map as MapIcon,
  Satellite,
  ArrowUpRight,
  Sparkles
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

// Mapbox token
mapboxgl.accessToken = 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'

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

interface OrderStats {
  total: number
  pending: number
  confirmed: number
  inDelivery: number
  delivered: number
  cancelled: number
  totalAmount: number
}

// Cuba provinces with coordinates and colors
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

// Stat card configurations
const statCards = [
  { key: 'totalBrokers', label: 'Total Brokers', icon: Users, gradient: 'from-blue-500 to-blue-600', bg: 'bg-blue-500/10' },
  { key: 'activeBrokers', label: 'Activos', icon: Zap, gradient: 'from-emerald-500 to-green-600', bg: 'bg-emerald-500/10' },
  { key: 'provinces', label: 'Provincias', icon: MapPin, gradient: 'from-purple-500 to-indigo-600', bg: 'bg-purple-500/10' },
  { key: 'balance', label: 'Balance Total', icon: DollarSign, gradient: 'from-amber-500 to-orange-600', bg: 'bg-amber-500/10' },
  { key: 'orders', label: 'Órdenes', icon: Package, gradient: 'from-pink-500 to-rose-600', bg: 'bg-pink-500/10' },
  { key: 'volume', label: 'Volumen', icon: TrendingUp, gradient: 'from-cyan-500 to-teal-600', bg: 'bg-cyan-500/10' },
]

export default function AdminBrokersDashboardPage() {
  const { theme } = useTheme()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets')
  const [mapLoading, setMapLoading] = useState(true)

  const [brokers, setBrokers] = useState<Broker[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/brokers')
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setBrokers(data.data.brokers || [])
          setSummary(data.data.summary)
          setOrderStats(data.data.orderStats || null)
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

  // Calculate province data from brokers
  const provinceData = brokers.reduce((acc, broker) => {
    const prov = broker.province || 'Sin asignar'
    if (!acc[prov]) acc[prov] = { count: 0, balance: 0, brokers: [] as Broker[] }
    acc[prov].count++
    acc[prov].balance += broker.walletBalance || 0
    acc[prov].brokers.push(broker)
    return acc
  }, {} as Record<string, { count: number, balance: number, brokers: Broker[] }>)

  // Top brokers by balance
  const topBrokers = [...brokers]
    .sort((a, b) => b.walletBalance - a.walletBalance)
    .slice(0, 5)

  // Function to add markers
  const addMarkersToMap = useCallback(() => {
    if (!map.current) return

    // Clear existing markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    // Add markers for each province with brokers
    Object.entries(provinceData).forEach(([name, data]) => {
      if (name === 'Sin asignar' || !CUBA_PROVINCES[name]) return

      const { coords, color } = CUBA_PROVINCES[name]

      const el = document.createElement('div')
      el.className = 'broker-marker-pin'
      el.innerHTML = `
        <div class="marker-container" style="
          position: relative;
          cursor: pointer;
          transition: all 0.3s ease;
          filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
        ">
          <div class="marker-pin" style="
            width: 44px;
            height: 44px;
            background: ${color};
            border-radius: 50% 50% 50% 15%;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
            position: relative;
          ">
            <span style="
              transform: rotate(45deg);
              color: white;
              font-weight: 700;
              font-size: 16px;
            ">${data.count}</span>
          </div>
        </div>
      `

      const popup = new mapboxgl.Popup({ offset: 25, closeButton: false })
        .setHTML(`
          <div style="padding: 12px; min-width: 180px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
              <div style="width: 12px; height: 12px; border-radius: 50%; background: ${color};"></div>
              <h4 style="font-weight: 700; font-size: 15px; color: #1f2937; margin: 0;">${name}</h4>
            </div>
            <div style="display: grid; gap: 6px;">
              <div style="display: flex; justify-content: space-between; padding: 6px 10px; background: #f3f4f6; border-radius: 6px;">
                <span style="color: #6b7280; font-size: 12px;">Brokers</span>
                <span style="font-weight: 600; color: #1f2937;">${data.count}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 6px 10px; background: #ecfdf5; border-radius: 6px;">
                <span style="color: #059669; font-size: 12px;">Balance</span>
                <span style="font-weight: 600; color: #059669;">$${data.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            ${data.brokers.length > 0 ? `
              <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 10px; color: #9ca3af; margin-bottom: 6px; text-transform: uppercase;">Brokers:</p>
                ${data.brokers.slice(0, 3).map(b => `
                  <div style="display: flex; align-items: center; gap: 6px; padding: 4px 0; font-size: 11px;">
                    <div style="width: 5px; height: 5px; border-radius: 50%; background: ${b.isActive ? '#10b981' : '#9ca3af'};"></div>
                    <span style="color: #374151;">${b.name}</span>
                  </div>
                `).join('')}
                ${data.brokers.length > 3 ? `<p style="font-size: 10px; color: #9ca3af; margin-top: 4px;">+${data.brokers.length - 3} más</p>` : ''}
              </div>
            ` : ''}
          </div>
        `)

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(coords)
        .setPopup(popup)
        .addTo(map.current!)

      markersRef.current.push(marker)
    })
  }, [provinceData])

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-79.5, 21.8],
      zoom: 6.8,
      attributionControl: false
    })

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    map.current.on('load', () => {
      setMapLoading(false)
      addMarkersToMap()
    })

    return () => {
      markersRef.current.forEach(m => m.remove())
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [addMarkersToMap])

  // Update map style and re-add markers
  useEffect(() => {
    if (!map.current) return

    const newStyle = mapStyle === 'streets'
      ? 'mapbox://styles/mapbox/streets-v12'
      : 'mapbox://styles/mapbox/satellite-streets-v12'

    map.current.setStyle(newStyle)

    // Re-add markers after style change
    map.current.once('style.load', () => {
      addMarkersToMap()
    })
  }, [mapStyle, addMarkersToMap])

  // Re-add markers when brokers data changes
  useEffect(() => {
    if (!map.current || brokers.length === 0) return

    if (map.current.isStyleLoaded()) {
      addMarkersToMap()
    } else {
      map.current.once('style.load', addMarkersToMap)
    }
  }, [brokers, addMarkersToMap])

  const toggleMapStyle = () => {
    setMapStyle(prev => prev === 'streets' ? 'satellite' : 'streets')
  }

  const successRate = orderStats && orderStats.total > 0
    ? (orderStats.delivered / orderStats.total) * 100
    : 0

  const getStatValue = (key: string) => {
    switch (key) {
      case 'totalBrokers': return summary?.totalBrokers || 0
      case 'activeBrokers': return summary?.activeBrokers || 0
      case 'provinces': return `${summary?.provincesCovered || 0}/16`
      case 'balance': return summary?.totalBalanceFormatted || '$0'
      case 'orders': return orderStats?.total || 0
      case 'volume': return `$${(orderStats?.totalAmount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
      default: return 0
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className={cn("min-h-screen p-4", theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50')}>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
              ))}
            </div>
            <div className="h-[420px] bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
              <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className={cn("min-h-screen", theme === 'dark' ? 'bg-gray-900' : 'bg-slate-50')}>

        {/* Top Stats Row - Modern Cards */}
        <div className="p-4 pb-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {statCards.map((card, i) => (
              <motion.div
                key={card.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -2, transition: { duration: 0.2 } }}
                className="group relative"
              >
                {/* Gradient glow on hover */}
                <div className={cn(
                  "absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-xl",
                  card.gradient
                )} />

                <div className={cn(
                  "relative rounded-2xl p-4 border backdrop-blur-sm transition-all duration-300",
                  theme === 'dark'
                    ? 'bg-gray-800/60 border-gray-700/50 hover:border-gray-600'
                    : 'bg-white/80 border-gray-200/60 hover:border-gray-300 hover:shadow-lg'
                )}>
                  <div className="flex items-start justify-between">
                    <div className={cn("p-2.5 rounded-xl bg-gradient-to-br", card.gradient)}>
                      <card.icon className="w-4 h-4 text-white" />
                    </div>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.05, type: "spring" }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ArrowUpRight className="w-4 h-4 text-gray-400" />
                    </motion.div>
                  </div>
                  <div className="mt-3">
                    <p className={cn(
                      "text-2xl font-bold tracking-tight",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {getStatValue(card.key)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
                      {card.label}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Map Section */}
        <div className="px-4 pb-3">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className={cn(
              "relative rounded-2xl overflow-hidden border shadow-sm",
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            )}
          >
            {/* Map Loading */}
            {mapLoading && (
              <div className={cn(
                "absolute inset-0 z-20 flex items-center justify-center",
                theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
              )}>
                <div className="text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Layers className={cn("w-8 h-8 mx-auto mb-2", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
                  </motion.div>
                  <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    Cargando mapa...
                  </p>
                </div>
              </div>
            )}

            {/* Map Container */}
            <div ref={mapContainer} className="w-full h-[420px]" />

            {/* Map Controls - Top Left */}
            <div className="absolute top-4 left-4 z-10">
              <div className={cn(
                "px-4 py-2.5 rounded-xl shadow-lg backdrop-blur-md flex items-center gap-3",
                theme === 'dark' ? 'bg-gray-900/90 border border-gray-700' : 'bg-white/90 border border-gray-200'
              )}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <Globe className={cn("w-4 h-4", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
                </div>
                <div>
                  <span className={cn("text-sm font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    Cuba
                  </span>
                  <span className={cn("text-xs ml-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                    {Object.keys(provinceData).filter(k => k !== 'Sin asignar').length} provincias activas
                  </span>
                </div>
              </div>
            </div>

            {/* Map Style Toggle */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleMapStyle}
              className={cn(
                "absolute bottom-4 right-4 z-10 px-4 py-2.5 rounded-xl shadow-lg backdrop-blur-md flex items-center gap-2 transition-all",
                theme === 'dark'
                  ? 'bg-gray-900/90 hover:bg-gray-800 text-white border border-gray-700'
                  : 'bg-white/90 hover:bg-white text-gray-900 border border-gray-200'
              )}
            >
              {mapStyle === 'streets' ? (
                <>
                  <Satellite className="w-4 h-4" />
                  <span className="text-xs font-medium">Satélite</span>
                </>
              ) : (
                <>
                  <MapIcon className="w-4 h-4" />
                  <span className="text-xs font-medium">Calles</span>
                </>
              )}
            </motion.button>

            {/* Refresh Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRefresh}
              disabled={refreshing}
              className={cn(
                "absolute bottom-4 left-4 z-10 p-2.5 rounded-xl shadow-lg backdrop-blur-md transition-all",
                theme === 'dark'
                  ? 'bg-gray-900/90 hover:bg-gray-800 text-white border border-gray-700'
                  : 'bg-white/90 hover:bg-white text-gray-900 border border-gray-200'
              )}
            >
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            </motion.button>
          </motion.div>
        </div>

        {/* Order Status Row - Modern Design */}
        <div className="px-4 pb-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className={cn(
              "rounded-2xl p-5 border backdrop-blur-sm",
              theme === 'dark' ? 'bg-gray-800/60 border-gray-700/50' : 'bg-white/80 border-gray-200/60 shadow-sm'
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                  <Activity className="w-4 h-4 text-white" />
                </div>
                <div>
                  <span className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    Estado de Órdenes
                  </span>
                  <p className="text-xs text-gray-500">Resumen en tiempo real</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/dashboard/admin/brokers/orders">
                  <motion.div
                    whileHover={{ x: 2 }}
                    className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1 font-medium"
                  >
                    Ver todas <ChevronRight className="w-4 h-4" />
                  </motion.div>
                </Link>
                <Link href="/dashboard/admin/brokers/wallets">
                  <motion.div
                    whileHover={{ x: 2 }}
                    className="text-sm text-emerald-500 hover:text-emerald-600 flex items-center gap-1 font-medium"
                  >
                    Wallets <ChevronRight className="w-4 h-4" />
                  </motion.div>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { icon: Clock, label: 'Pendientes', value: orderStats?.pending || 0, color: 'amber', gradient: 'from-amber-500 to-yellow-600' },
                { icon: CheckCircle, label: 'Confirmadas', value: orderStats?.confirmed || 0, color: 'blue', gradient: 'from-blue-500 to-cyan-600' },
                { icon: Truck, label: 'En Entrega', value: orderStats?.inDelivery || 0, color: 'purple', gradient: 'from-purple-500 to-pink-600' },
                { icon: CheckCircle, label: 'Entregadas', value: orderStats?.delivered || 0, color: 'emerald', gradient: 'from-emerald-500 to-green-600' },
                { icon: XCircle, label: 'Canceladas', value: orderStats?.cancelled || 0, color: 'red', gradient: 'from-red-500 to-rose-600' },
                { icon: TrendingUp, label: 'Tasa Éxito', value: `${successRate.toFixed(0)}%`, color: 'teal', gradient: 'from-teal-500 to-cyan-600' },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + i * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  className={cn(
                    "relative overflow-hidden rounded-xl p-4 transition-all cursor-pointer group",
                    theme === 'dark'
                      ? `bg-${item.color}-900/20 hover:bg-${item.color}-900/30`
                      : `bg-${item.color}-50 hover:bg-${item.color}-100/80`
                  )}
                >
                  <div className={cn(
                    "absolute top-0 right-0 w-20 h-20 rounded-full opacity-10 -mr-6 -mt-6 bg-gradient-to-br",
                    item.gradient
                  )} />
                  <div className="relative">
                    <div className={cn("p-2 rounded-lg w-fit bg-gradient-to-br mb-2", item.gradient)}>
                      <item.icon className="w-4 h-4 text-white" />
                    </div>
                    <p className={cn(
                      "text-2xl font-bold",
                      theme === 'dark' ? `text-${item.color}-300` : `text-${item.color}-700`
                    )}>
                      {item.value}
                    </p>
                    <p className={cn(
                      "text-xs font-medium",
                      theme === 'dark' ? `text-${item.color}-400` : `text-${item.color}-600`
                    )}>
                      {item.label}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Bottom Section - Top Brokers & All Brokers */}
        <div className="px-4 pb-4 grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Top Brokers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className={cn(
              "rounded-2xl p-5 border backdrop-blur-sm",
              theme === 'dark' ? 'bg-gray-800/60 border-gray-700/50' : 'bg-white/80 border-gray-200/60 shadow-sm'
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <span className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    Top Brokers
                  </span>
                  <p className="text-xs text-gray-500">Por balance</p>
                </div>
              </div>
              <Link href="/dashboard/admin/brokers/wallets">
                <motion.span whileHover={{ x: 2 }} className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1 font-medium">
                  Ver todos <ChevronRight className="w-3 h-3" />
                </motion.span>
              </Link>
            </div>

            <div className="space-y-2">
              {topBrokers.map((broker, i) => (
                <motion.div
                  key={broker.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.55 + i * 0.05 }}
                  whileHover={{ x: 4 }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer",
                    theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                  )}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm",
                    i === 0 && "bg-gradient-to-br from-yellow-400 to-amber-500 text-white",
                    i === 1 && "bg-gradient-to-br from-gray-300 to-gray-400 text-gray-700",
                    i === 2 && "bg-gradient-to-br from-amber-600 to-orange-700 text-white",
                    i > 2 && (theme === 'dark' ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-500")
                  )}>
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-medium text-sm truncate", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {broker.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {broker.province || 'Sin provincia'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400 text-sm">
                      {broker.walletBalanceFormatted}
                    </p>
                    <p className="text-xs text-gray-500">
                      {broker.stats?.totalTransactions || 0} tx
                    </p>
                  </div>
                </motion.div>
              ))}
              {topBrokers.length === 0 && (
                <div className="text-center py-8">
                  <Building2 className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-sm text-gray-500">No hay brokers</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* All Brokers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className={cn(
              "rounded-2xl p-5 border backdrop-blur-sm",
              theme === 'dark' ? 'bg-gray-800/60 border-gray-700/50' : 'bg-white/80 border-gray-200/60 shadow-sm'
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <span className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    Todos los Brokers
                  </span>
                  <p className="text-xs text-gray-500">Lista completa</p>
                </div>
              </div>
              <span className={cn(
                "text-xs px-3 py-1.5 rounded-full font-medium",
                theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'
              )}>
                {brokers.length} total
              </span>
            </div>

            <div className="space-y-1 max-h-[300px] overflow-y-auto scrollbar-thin pr-1">
              {brokers.map((broker, i) => (
                <motion.div
                  key={broker.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 + i * 0.02 }}
                  whileHover={{ x: 4 }}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer",
                    theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-2.5 h-2.5 rounded-full ring-2",
                      broker.isActive
                        ? "bg-emerald-500 ring-emerald-500/30"
                        : "bg-gray-400 ring-gray-400/30"
                    )} />
                    <div>
                      <p className={cn("font-medium text-sm", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {broker.name}
                      </p>
                      <p className="text-xs text-gray-500">
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
                  <Building2 className="w-12 h-12 mx-auto text-gray-200 dark:text-gray-700 mb-3" />
                  <p className="text-sm text-gray-500">No hay brokers registrados</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  )
}
