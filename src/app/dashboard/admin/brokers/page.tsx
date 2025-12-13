'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import {
  Users,
  MapPin,
  DollarSign,
  Package,
  TrendingUp,
  TrendingDown,
  Building2,
  RefreshCw,
  Globe,
  Layers,
  Map as MapIcon,
  Satellite,
  ArrowUp,
  ArrowDown,
  Wallet
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

mapboxgl.accessToken = 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'

interface Broker {
  id: number
  name: string
  walletBalance: number
  walletBalanceFormatted: string
  currency: string
  province: string
  municipality: string
  latitude: number | null
  longitude: number | null
  contactPhone?: string
  isActive: boolean
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

interface ExchangeRate {
  rate: number
  formatted: string
  lastUpdate: string
  variacion: number
}

interface RateHistory {
  timestamp: string
  baserate: number
}

// Mapeo de IDs de provincias a nombres completos
const PROVINCE_ID_TO_NAME: Record<string, string> = {
  'pinar-del-rio': 'Pinar del Río',
  'artemisa': 'Artemisa',
  'la-habana': 'La Habana',
  'mayabeque': 'Mayabeque',
  'matanzas': 'Matanzas',
  'cienfuegos': 'Cienfuegos',
  'villa-clara': 'Villa Clara',
  'sancti-spiritus': 'Sancti Spíritus',
  'ciego-de-avila': 'Ciego de Ávila',
  'camaguey': 'Camagüey',
  'las-tunas': 'Las Tunas',
  'holguin': 'Holguín',
  'granma': 'Granma',
  'santiago-de-cuba': 'Santiago',
  'santiago': 'Santiago',
  'guantanamo': 'Guantánamo',
  'isla-de-la-juventud': 'Isla de la Juventud'
}

// Provinces with coordinates
const PROVINCES: Record<string, { coords: [number, number], color: string }> = {
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
  'Santiago': { coords: [-75.8219, 20.0247], color: '#f59e0b' },
  'Guantánamo': { coords: [-75.2092, 20.1447], color: '#84cc16' },
  'Isla de la Juventud': { coords: [-82.8500, 21.7000], color: '#10b981' }
}

const ORDER_COLORS = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  inDelivery: '#8b5cf6',
  delivered: '#10b981',
  cancelled: '#ef4444'
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

  const [exchangeRates, setExchangeRates] = useState<Record<string, ExchangeRate>>({})
  const [rateHistory, setRateHistory] = useState<RateHistory[]>([])
  const [selectedCurrency, setSelectedCurrency] = useState<'USD' | 'EUR' | 'MLC'>('USD')

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

  const fetchExchangeRates = useCallback(async () => {
    try {
      const res = await fetch('/api/exchange-rates')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data) {
          setExchangeRates(data.data)
        }
      }
    } catch (error) {
      console.error('Error fetching exchange rates:', error)
    }
  }, [])

  const fetchRateHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/agency-rates/history?currency=${selectedCurrency}&days=7`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data) {
          setRateHistory(data.data)
        }
      }
    } catch (error) {
      console.error('Error fetching rate history:', error)
    }
  }, [selectedCurrency])

  useEffect(() => {
    fetchData()
    fetchExchangeRates()
  }, [fetchData, fetchExchangeRates])

  useEffect(() => {
    fetchRateHistory()
  }, [fetchRateHistory])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
    fetchExchangeRates()
    fetchRateHistory()
  }

  // Chart data: Rate history
  const rateChartData = rateHistory.map(item => ({
    date: new Date(item.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
    rate: item.baserate
  }))

  // Chart data: Orders by status
  const orderChartData = orderStats ? [
    { name: 'Pendientes', value: orderStats.pending, color: ORDER_COLORS.pending },
    { name: 'Confirmadas', value: orderStats.confirmed, color: ORDER_COLORS.confirmed },
    { name: 'En Entrega', value: orderStats.inDelivery, color: ORDER_COLORS.inDelivery },
    { name: 'Entregadas', value: orderStats.delivered, color: ORDER_COLORS.delivered },
    { name: 'Canceladas', value: orderStats.cancelled, color: ORDER_COLORS.cancelled },
  ].filter(d => d.value > 0) : []

  // Chart data: Brokers by province (convert IDs to display names)
  const provinceData = brokers.reduce((acc, broker) => {
    // Convertir ID de provincia a nombre completo
    const provinceId = broker.province || ''
    const prov = PROVINCE_ID_TO_NAME[provinceId] || broker.province || 'Sin asignar'
    if (!acc[prov]) acc[prov] = { count: 0, balance: 0, brokers: [] as Broker[] }
    acc[prov].count++
    acc[prov].balance += broker.walletBalance || 0
    acc[prov].brokers.push(broker)
    return acc
  }, {} as Record<string, { count: number, balance: number, brokers: Broker[] }>)

  const provinceChartData = Object.entries(provinceData)
    .filter(([name]) => name !== 'Sin asignar')
    .map(([name, data]) => ({
      name: name.length > 12 ? name.slice(0, 12) + '...' : name,
      fullName: name,
      brokers: data.count,
      balance: data.balance
    }))
    .sort((a, b) => b.brokers - a.brokers)
    .slice(0, 8)

  // Chart data: Balance by currency (from rates)
  const currencyBalanceData = Object.entries(exchangeRates)
    .slice(0, 6)
    .map(([currency, rate]) => ({
      currency,
      rate: rate.rate,
      variacion: rate.variacion || 0
    }))

  const currentRate = exchangeRates[selectedCurrency]
  const isPositive = (currentRate?.variacion || 0) >= 0

  // Map markers - usando coordenadas individuales de cada broker
  const addMarkersToMap = useCallback(() => {
    if (!map.current) return
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    // Agregar estilos de animación una sola vez
    if (!document.getElementById('broker-marker-styles')) {
      const styleEl = document.createElement('style')
      styleEl.id = 'broker-marker-styles'
      styleEl.textContent = `
        @keyframes brokerMarkerBounce {
          0%, 100% { transform: rotate(-45deg) scale(1); }
          50% { transform: rotate(-45deg) scale(1.1); }
        }
        @keyframes brokerPulseAnimation {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
        }
      `
      document.head.appendChild(styleEl)
    }

    // Crear marcador para cada broker con coordenadas válidas
    brokers.forEach((broker, index) => {
      if (!broker.latitude || !broker.longitude) return

      const provinceName = PROVINCE_ID_TO_NAME[broker.province] || broker.province || ''
      const markerColor = PROVINCES[provinceName]?.color || '#3b82f6'

      const el = document.createElement('div')
      el.className = 'broker-marker'
      el.innerHTML = `
        <div class="marker-container" style="
          position: relative;
          cursor: pointer;
          transition: all 0.3s ease;
          filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3));
        ">
          <!-- Pin principal con animación -->
          <div class="marker-pin" style="
            width: 36px;
            height: 36px;
            background: ${markerColor};
            border-radius: 50% 50% 50% 15%;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
            position: relative;
            animation: brokerMarkerBounce 2s infinite ease-in-out;
          ">
            <span style="
              transform: rotate(45deg);
              font-size: 16px;
              filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
            ">🏪</span>
          </div>

          <!-- Círculo exterior pulsante -->
          <div class="pulse-ring" style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 50px;
            height: 50px;
            border: 2px solid ${markerColor};
            border-radius: 50%;
            opacity: 0;
            animation: brokerPulseAnimation 2s infinite;
            animation-delay: ${index * 0.2}s;
          "></div>
        </div>
      `

      const municipalityName = PROVINCE_ID_TO_NAME[broker.municipality] || broker.municipality || ''
      const popup = new mapboxgl.Popup({ offset: 25, closeButton: false })
        .setHTML(`
          <div style="padding: 12px; min-width: 180px;">
            <h4 style="font-weight: 700; margin: 0 0 8px 0; color: #1f2937; font-size: 14px;">${broker.name}</h4>
            <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 6px;">
              <span style="color: #6b7280; font-size: 11px;">📍</span>
              <span style="color: #374151; font-size: 12px;">${municipalityName}, ${provinceName}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: #6b7280; font-size: 12px;">Balance:</span>
              <span style="font-weight: 600; color: #059669;">${broker.walletBalanceFormatted}</span>
            </div>
            ${broker.contactPhone ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: #6b7280; font-size: 12px;">Teléfono:</span>
              <span style="font-weight: 500; color: #374151;">${broker.contactPhone}</span>
            </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #6b7280; font-size: 12px;">Estado:</span>
              <span style="font-weight: 500; color: ${broker.isActive ? '#059669' : '#dc2626'};">${broker.isActive ? '✓ Activo' : '✗ Inactivo'}</span>
            </div>
          </div>
        `)

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([broker.longitude, broker.latitude])
        .setPopup(popup)
        .addTo(map.current!)

      markersRef.current.push(marker)
    })

    // Ajustar bounds para mostrar todos los brokers
    if (brokers.filter(b => b.latitude && b.longitude).length > 0) {
      const bounds = new mapboxgl.LngLatBounds()
      brokers.forEach(broker => {
        if (broker.latitude && broker.longitude) {
          bounds.extend([broker.longitude, broker.latitude])
        }
      })
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 10 })
    }
  }, [brokers])

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-79.0, 22.0],
      zoom: 6,
      minZoom: 5.5,
      maxZoom: 10,
      attributionControl: false
    })

    map.current.fitBounds([[-85.2, 19.5], [-74.0, 23.5]], { padding: 20 })
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    map.current.on('load', () => {
      setMapLoading(false)
      addMarkersToMap()
    })

    return () => {
      markersRef.current.forEach(m => m.remove())
      if (map.current) { map.current.remove(); map.current = null }
    }
  }, [addMarkersToMap])

  useEffect(() => {
    if (!map.current) return
    const style = mapStyle === 'streets' ? 'mapbox://styles/mapbox/streets-v12' : 'mapbox://styles/mapbox/satellite-streets-v12'
    map.current.setStyle(style)
    map.current.once('style.load', addMarkersToMap)
  }, [mapStyle, addMarkersToMap])

  useEffect(() => {
    if (!map.current || brokers.length === 0) return
    if (map.current.isStyleLoaded()) addMarkersToMap()
    else map.current.once('style.load', addMarkersToMap)
  }, [brokers, addMarkersToMap])

  if (loading) {
    return (
      <DashboardLayout>
        <div className={cn("min-h-screen p-4", theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50')}>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl" />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-[350px] bg-gray-200 dark:bg-gray-700 rounded-xl" />
              <div className="h-[350px] bg-gray-200 dark:bg-gray-700 rounded-xl" />
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className={cn("min-h-screen p-4", theme === 'dark' ? 'bg-gray-900' : 'bg-slate-50')}>

        {/* Header Stats - Compact */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[
            { icon: Users, label: 'Brokers', value: summary?.totalBrokers || 0, sub: `${summary?.activeBrokers || 0} activos`, color: 'blue' },
            { icon: MapPin, label: 'Provincias', value: summary?.provincesCovered || 0, sub: 'con cobertura', color: 'purple' },
            { icon: Wallet, label: 'Balance Total', value: summary?.totalBalanceFormatted || '$0', sub: 'en wallets', color: 'emerald' },
            { icon: Package, label: 'Órdenes', value: orderStats?.total || 0, sub: `$${(orderStats?.totalAmount || 0).toLocaleString()}`, color: 'amber' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "p-4 rounded-xl border",
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  stat.color === 'blue' && 'bg-blue-100 dark:bg-blue-900/30',
                  stat.color === 'purple' && 'bg-purple-100 dark:bg-purple-900/30',
                  stat.color === 'emerald' && 'bg-emerald-100 dark:bg-emerald-900/30',
                  stat.color === 'amber' && 'bg-amber-100 dark:bg-amber-900/30'
                )}>
                  <stat.icon className={cn(
                    "w-5 h-5",
                    stat.color === 'blue' && 'text-blue-600 dark:text-blue-400',
                    stat.color === 'purple' && 'text-purple-600 dark:text-purple-400',
                    stat.color === 'emerald' && 'text-emerald-600 dark:text-emerald-400',
                    stat.color === 'amber' && 'text-amber-600 dark:text-amber-400'
                  )} />
                </div>
                <div>
                  <p className={cn("text-xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.sub}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Main Content - Map + Rate Chart */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
          {/* Map */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={cn(
              "xl:col-span-2 relative rounded-xl overflow-hidden border",
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            )}
          >
            {mapLoading && (
              <div className={cn("absolute inset-0 z-20 flex items-center justify-center", theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100')}>
                <Layers className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            )}
            <div ref={mapContainer} className="w-full h-[320px]" />

            <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
              <div className={cn("px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2", theme === 'dark' ? 'bg-gray-900/80 text-white' : 'bg-white/90 text-gray-900')}>
                <MapPin className="w-4 h-4 text-blue-500" />
                <span>{brokers.filter(b => b.latitude && b.longitude).length} brokers en mapa</span>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className={cn("p-1.5 rounded-lg", theme === 'dark' ? 'bg-gray-900/80 text-white' : 'bg-white/90 text-gray-900')}
              >
                <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
              </button>
            </div>

            <button
              onClick={() => setMapStyle(prev => prev === 'streets' ? 'satellite' : 'streets')}
              className={cn("absolute bottom-3 right-3 z-10 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2", theme === 'dark' ? 'bg-gray-900/80 text-white' : 'bg-white/90 text-gray-900')}
            >
              {mapStyle === 'streets' ? <Satellite className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
              {mapStyle === 'streets' ? 'Satélite' : 'Calles'}
            </button>
          </motion.div>

          {/* Exchange Rate Chart */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className={cn("rounded-xl border p-4", theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className={cn("font-semibold text-sm", theme === 'dark' ? 'text-white' : 'text-gray-900')}>Tasa de Cambio</h3>
                {currentRate && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{currentRate.formatted}</span>
                    <span className={cn("text-xs flex items-center gap-0.5", isPositive ? "text-emerald-500" : "text-red-500")}>
                      {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                      {Math.abs(currentRate.variacion || 0).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-1">
                {(['USD', 'EUR', 'MLC'] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => setSelectedCurrency(c)}
                    className={cn(
                      "px-2 py-1 text-xs rounded-md transition-all",
                      selectedCurrency === c
                        ? "bg-blue-500 text-white"
                        : theme === 'dark' ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-600"
                    )}
                  >{c}</button>
                ))}
              </div>
            </div>

            <div className="h-[200px]">
              {rateChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={rateChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: theme === 'dark' ? '#9ca3af' : '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: theme === 'dark' ? '#9ca3af' : '#6b7280' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#fff', border: 'none', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      formatter={(value: number) => [`${value.toFixed(2)} CUP`, 'Tasa']}
                    />
                    <Area type="monotone" dataKey="rate" stroke={isPositive ? "#10b981" : "#ef4444"} strokeWidth={2} fill="url(#rateGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm">Sin datos</div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {/* Brokers by Province Chart */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className={cn("rounded-xl border p-4", theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}
          >
            <h3 className={cn("font-semibold text-sm mb-3", theme === 'dark' ? 'text-white' : 'text-gray-900')}>Brokers por Provincia</h3>
            <div className="h-[220px]">
              {provinceChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={provinceChartData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: theme === 'dark' ? '#9ca3af' : '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: theme === 'dark' ? '#9ca3af' : '#6b7280' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip
                      contentStyle={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#fff', border: 'none', borderRadius: '8px' }}
                      formatter={(value: number, name: string) => [value, name === 'brokers' ? 'Brokers' : 'Balance']}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                    />
                    <Bar dataKey="brokers" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm">Sin datos</div>
              )}
            </div>
          </motion.div>

          {/* Orders by Status Chart */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className={cn("rounded-xl border p-4", theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}
          >
            <h3 className={cn("font-semibold text-sm mb-3", theme === 'dark' ? 'text-white' : 'text-gray-900')}>Órdenes por Estado</h3>
            <div className="h-[220px]">
              {orderChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={orderChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {orderChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#fff', border: 'none', borderRadius: '8px' }}
                      formatter={(value: number) => [value, 'Órdenes']}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => <span className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm">Sin órdenes</div>
              )}
            </div>
          </motion.div>

          {/* Currency Rates Chart */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className={cn("rounded-xl border p-4", theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}
          >
            <h3 className={cn("font-semibold text-sm mb-3", theme === 'dark' ? 'text-white' : 'text-gray-900')}>Tasas por Moneda</h3>
            <div className="h-[220px]">
              {currencyBalanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={currencyBalanceData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} vertical={false} />
                    <XAxis dataKey="currency" tick={{ fontSize: 10, fill: theme === 'dark' ? '#9ca3af' : '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: theme === 'dark' ? '#9ca3af' : '#6b7280' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#fff', border: 'none', borderRadius: '8px' }}
                      formatter={(value: number) => [`${value.toFixed(2)} CUP`, 'Tasa']}
                    />
                    <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                      {currencyBalanceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.variacion >= 0 ? '#10b981' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm">Sin datos</div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Bottom: Balance by Province + Top Brokers List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Balance by Province */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className={cn("rounded-xl border p-4", theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}
          >
            <h3 className={cn("font-semibold text-sm mb-3", theme === 'dark' ? 'text-white' : 'text-gray-900')}>Balance por Provincia</h3>
            <div className="h-[200px]">
              {provinceChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={provinceChartData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: theme === 'dark' ? '#9ca3af' : '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: theme === 'dark' ? '#9ca3af' : '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#fff', border: 'none', borderRadius: '8px' }}
                      formatter={(value: number) => [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 'Balance']}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                    />
                    <Bar dataKey="balance" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm">Sin datos</div>
              )}
            </div>
          </motion.div>

          {/* Top Brokers List */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className={cn("rounded-xl border p-4", theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className={cn("font-semibold text-sm", theme === 'dark' ? 'text-white' : 'text-gray-900')}>Top Brokers</h3>
              <span className={cn("text-xs px-2 py-1 rounded-full", theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600')}>
                {brokers.length} total
              </span>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {brokers
                .sort((a, b) => b.walletBalance - a.walletBalance)
                .slice(0, 6)
                .map((broker, i) => (
                  <div
                    key={broker.id}
                    className={cn(
                      "flex items-center justify-between p-2.5 rounded-lg",
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                        i < 3 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-400"
                      )}>
                        {i + 1}
                      </span>
                      <div>
                        <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{broker.name}</p>
                        <p className="text-xs text-gray-500">{PROVINCE_ID_TO_NAME[broker.province] || broker.province || 'Sin provincia'}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {broker.walletBalanceFormatted}
                    </span>
                  </div>
                ))}
              {brokers.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No hay brokers
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  )
}
