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
  Wallet,
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
  Satellite
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

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle === 'streets'
        ? 'mapbox://styles/mapbox/streets-v12'
        : 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-79.5, 22.0],
      zoom: 6,
      attributionControl: false
    })

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    map.current.on('load', () => {
      setMapLoading(false)
    })

    return () => {
      markersRef.current.forEach(m => m.remove())
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Update map style
  useEffect(() => {
    if (!map.current) return
    map.current.setStyle(
      mapStyle === 'streets'
        ? 'mapbox://styles/mapbox/streets-v12'
        : 'mapbox://styles/mapbox/satellite-streets-v12'
    )
  }, [mapStyle])

  // Add markers when data changes
  useEffect(() => {
    if (!map.current || brokers.length === 0) return

    // Wait for style to load
    const addMarkers = () => {
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
              animation: markerBounce 2s infinite ease-in-out;
            ">
              <span style="
                transform: rotate(45deg);
                color: white;
                font-weight: 700;
                font-size: 16px;
              ">${data.count}</span>
            </div>
            <div class="pulse-ring" style="
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 60px;
              height: 60px;
              border: 2px solid ${color};
              border-radius: 50%;
              opacity: 0;
              animation: pulseAnimation 2s infinite;
            "></div>
          </div>
          <style>
            @keyframes markerBounce {
              0%, 100% { transform: rotate(-45deg) scale(1); }
              50% { transform: rotate(-45deg) scale(1.08); }
            }
            @keyframes pulseAnimation {
              0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.8; }
              100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
            }
          </style>
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
    }

    // Add markers after style loads
    if (map.current.isStyleLoaded()) {
      addMarkers()
    } else {
      map.current.once('styledata', addMarkers)
    }
  }, [provinceData, brokers])

  const toggleMapStyle = () => {
    setMapStyle(prev => prev === 'streets' ? 'satellite' : 'streets')
  }

  const successRate = orderStats && orderStats.total > 0
    ? (orderStats.delivered / orderStats.total) * 100
    : 0

  if (loading) {
    return (
      <DashboardLayout>
        <div className={cn(
          "min-h-screen p-4",
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
        )}>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
              ))}
            </div>
            <div className="h-[400px] bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
              <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className={cn(
        "min-h-screen",
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        {/* Top Stats Row */}
        <div className="p-4 pb-0">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* Total Brokers */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "rounded-xl p-4 border",
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Users className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{summary?.totalBrokers || 0}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Brokers</p>
                </div>
              </div>
            </motion.div>

            {/* Active */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className={cn(
                "rounded-xl p-4 border",
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Zap className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{summary?.activeBrokers || 0}</p>
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
                "rounded-xl p-4 border",
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <MapPin className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {summary?.provincesCovered || 0}<span className="text-sm text-gray-400">/16</span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Provincias</p>
                </div>
              </div>
            </motion.div>

            {/* Balance */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className={cn(
                "rounded-xl p-4 border",
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <DollarSign className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{summary?.totalBalanceFormatted || '$0'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Balance Total</p>
                </div>
              </div>
            </motion.div>

            {/* Orders */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={cn(
                "rounded-xl p-4 border",
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Package className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{orderStats?.total || 0}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Órdenes</p>
                </div>
              </div>
            </motion.div>

            {/* Volume */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className={cn(
                "rounded-xl p-4 border",
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10">
                  <TrendingUp className="w-5 h-5 text-cyan-500" />
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    ${(orderStats?.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Volumen</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Map Section - Full Width */}
        <div className="p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className={cn(
              "relative rounded-xl overflow-hidden border",
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
            <div ref={mapContainer} className="w-full h-[400px]" />

            {/* Map Controls */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
              <div className={cn(
                "px-3 py-2 rounded-lg shadow-lg flex items-center gap-2",
                theme === 'dark' ? 'bg-gray-800/95 backdrop-blur-sm' : 'bg-white/95 backdrop-blur-sm'
              )}>
                <Globe className={cn("w-4 h-4", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
                <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Cuba
                </span>
                <span className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  {Object.keys(provinceData).filter(k => k !== 'Sin asignar').length} provincias con brokers
                </span>
              </div>
            </div>

            {/* Map Style Toggle */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleMapStyle}
              className={cn(
                "absolute bottom-4 right-4 z-10 px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 transition-colors",
                theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-white hover:bg-gray-50 text-gray-900'
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
                "absolute bottom-4 left-4 z-10 p-2 rounded-lg shadow-lg transition-colors",
                theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-white hover:bg-gray-50 text-gray-900'
              )}
            >
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            </motion.button>
          </motion.div>
        </div>

        {/* Order Status Row */}
        <div className="px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className={cn(
              "rounded-xl p-4 border",
              theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                <span className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Estado de Órdenes
                </span>
              </div>
              <div className="flex items-center gap-4">
                <Link href="/dashboard/admin/brokers/orders" className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1">
                  Ver todas <ChevronRight className="w-4 h-4" />
                </Link>
                <Link href="/dashboard/admin/brokers/wallets" className="text-sm text-emerald-500 hover:text-emerald-600 flex items-center gap-1">
                  Wallets <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className={cn(
                "flex items-center gap-3 p-3 rounded-xl",
                theme === 'dark' ? 'bg-yellow-900/20' : 'bg-yellow-50'
              )}>
                <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                <div>
                  <p className="text-xl font-bold text-yellow-700 dark:text-yellow-300">{orderStats?.pending || 0}</p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">Pendientes</p>
                </div>
              </div>

              <div className={cn(
                "flex items-center gap-3 p-3 rounded-xl",
                theme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-50'
              )}>
                <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{orderStats?.confirmed || 0}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">Confirmadas</p>
                </div>
              </div>

              <div className={cn(
                "flex items-center gap-3 p-3 rounded-xl",
                theme === 'dark' ? 'bg-purple-900/20' : 'bg-purple-50'
              )}>
                <Truck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <div>
                  <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{orderStats?.inDelivery || 0}</p>
                  <p className="text-xs text-purple-600 dark:text-purple-400">En Entrega</p>
                </div>
              </div>

              <div className={cn(
                "flex items-center gap-3 p-3 rounded-xl",
                theme === 'dark' ? 'bg-green-900/20' : 'bg-green-50'
              )}>
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-xl font-bold text-green-700 dark:text-green-300">{orderStats?.delivered || 0}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">Entregadas</p>
                </div>
              </div>

              <div className={cn(
                "flex items-center gap-3 p-3 rounded-xl",
                theme === 'dark' ? 'bg-red-900/20' : 'bg-red-50'
              )}>
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <div>
                  <p className="text-xl font-bold text-red-700 dark:text-red-300">{orderStats?.cancelled || 0}</p>
                  <p className="text-xs text-red-600 dark:text-red-400">Canceladas</p>
                </div>
              </div>

              <div className={cn(
                "flex items-center gap-3 p-3 rounded-xl",
                theme === 'dark' ? 'bg-emerald-900/20' : 'bg-emerald-50'
              )}>
                <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{successRate.toFixed(0)}%</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Tasa Éxito</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom Section - Top Brokers & All Brokers */}
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Brokers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={cn(
              "rounded-xl p-4 border",
              theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-500" />
                <span className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Top Brokers
                </span>
              </div>
              <Link href="/dashboard/admin/brokers/wallets" className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1">
                Ver todos <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-2">
              {topBrokers.map((broker, i) => (
                <motion.div
                  key={broker.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.45 + i * 0.05 }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl transition-colors",
                    theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm",
                    i === 0 && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                    i === 1 && "bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300",
                    i === 2 && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
                    i > 2 && "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                  )}>
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{broker.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {broker.province || 'Sin provincia'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400 text-sm">
                      {broker.walletBalanceFormatted}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {broker.stats?.totalTransactions || 0} tx
                    </p>
                  </div>
                </motion.div>
              ))}
              {topBrokers.length === 0 && (
                <div className="text-center py-8">
                  <Building2 className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No hay brokers</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* All Brokers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className={cn(
              "rounded-xl p-4 border",
              theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-500" />
                <span className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Todos los Brokers
                </span>
              </div>
              <span className={cn(
                "text-xs px-2 py-1 rounded-full",
                theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
              )}>
                {brokers.length}
              </span>
            </div>

            <div className="space-y-1 max-h-[280px] overflow-y-auto scrollbar-thin pr-1">
              {brokers.map((broker, i) => (
                <motion.div
                  key={broker.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 + i * 0.02 }}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer",
                    theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      broker.isActive ? "bg-green-500" : "bg-gray-400"
                    )} />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{broker.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {broker.municipality ? `${broker.municipality}, ` : ''}{broker.province || 'Sin ubicación'}
                      </p>
                    </div>
                  </div>
                  <p className="font-medium text-emerald-600 dark:text-emerald-400 text-sm">
                    {broker.walletBalanceFormatted}
                  </p>
                </motion.div>
              ))}
              {brokers.length === 0 && (
                <div className="text-center py-8">
                  <Building2 className="w-12 h-12 mx-auto text-gray-200 dark:text-gray-700 mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No hay brokers registrados</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  )
}
