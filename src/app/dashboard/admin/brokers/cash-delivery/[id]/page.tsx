'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  ArrowLeft,
  DollarSign,
  User,
  Phone,
  Mail,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Truck,
  MapPin,
  Banknote,
  FileText,
  XCircle,
  Loader2,
  Map as MapIcon,
  Satellite,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

// Mapbox token
mapboxgl.accessToken = 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'

// Status configuration
const STATUS_CONFIG: { [key: string]: { label: string; color: string; bgColor: string; icon: any } } = {
  pending: { label: 'Pendiente', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', icon: Clock },
  in_transit: { label: 'En Tránsito', color: 'text-blue-500', bgColor: 'bg-blue-500/10', icon: Truck },
  pending_reception: { label: 'Recibiendo', color: 'text-purple-500', bgColor: 'bg-purple-500/10', icon: DollarSign },
  validating: { label: 'Validando OTP', color: 'text-orange-500', bgColor: 'bg-orange-500/10', icon: AlertCircle },
  completed: { label: 'Completado', color: 'text-green-500', bgColor: 'bg-green-500/10', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'text-red-500', bgColor: 'bg-red-500/10', icon: XCircle }
}

// Cuba provinces coordinates (approximate centers)
const CUBA_PROVINCES: { [key: string]: { lat: number; lng: number } } = {
  'pinar-del-rio': { lat: 22.4175, lng: -83.6978 },
  'artemisa': { lat: 22.8136, lng: -82.7622 },
  'la-habana': { lat: 23.1136, lng: -82.3666 },
  'mayabeque': { lat: 22.9256, lng: -81.9525 },
  'matanzas': { lat: 22.4117, lng: -81.5775 },
  'cienfuegos': { lat: 22.1456, lng: -80.4364 },
  'villa-clara': { lat: 22.4072, lng: -79.9544 },
  'sancti-spiritus': { lat: 21.9292, lng: -79.4428 },
  'ciego-de-avila': { lat: 21.8403, lng: -78.7622 },
  'camaguey': { lat: 21.3808, lng: -77.9169 },
  'las-tunas': { lat: 20.9597, lng: -76.9544 },
  'holguin': { lat: 20.7872, lng: -76.2631 },
  'granma': { lat: 20.3853, lng: -76.6428 },
  'santiago-de-cuba': { lat: 20.0247, lng: -75.8219 },
  'guantanamo': { lat: 20.1422, lng: -75.2092 },
  'isla-de-la-juventud': { lat: 21.7083, lng: -82.8217 }
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function CashDeliveryDetailsPage({ params }: PageProps) {
  const { theme } = useTheme()
  const router = useRouter()

  const [orderId, setOrderId] = useState<number | null>(null)
  const [orderData, setOrderData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Map state
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets')
  const [mapLoading, setMapLoading] = useState(true)
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    params.then(({ id }) => {
      setOrderId(parseInt(id))
    })
  }, [params])

  useEffect(() => {
    if (!orderId) return
    fetchOrderDetails()
  }, [orderId])

  const fetchOrderDetails = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/admin/cash-delivery/${orderId}`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al cargar la orden')
      }

      setOrderData(data.data)

      // Get coordinates from province
      if (data.data.broker_province) {
        const provinceKey = data.data.broker_province.toLowerCase().replace(/ /g, '-')
        if (CUBA_PROVINCES[provinceKey]) {
          setCoordinates(CUBA_PROVINCES[provinceKey])
        }
      }
    } catch (err) {
      console.error('Error fetching order details:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !coordinates || !orderData) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle === 'streets'
        ? 'mapbox://styles/mapbox/streets-v12'
        : 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [coordinates.lng, coordinates.lat],
      zoom: 10
    })

    map.current.on('load', () => {
      setMapLoading(false)
      if (!map.current) return

      // Add marker
      const el = document.createElement('div')
      const brokerName = orderData.broker_name || 'Broker'
      const location = `${orderData.broker_municipality || ''}, ${orderData.broker_province || ''}`
      const amount = `${orderData.currency} $${parseFloat(orderData.total_amount).toLocaleString()}`

      el.innerHTML = `
        <div style="
          position: relative;
          cursor: pointer;
          filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3));
        ">
          <div style="
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #10B981, #059669);
            border-radius: 50% 50% 50% 15%;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
            animation: markerPulse 2s infinite ease-in-out;
          ">
            <span style="
              transform: rotate(45deg);
              font-size: 22px;
              filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
            ">🏦</span>
          </div>
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 70px;
            height: 70px;
            border: 2px solid #10B981;
            border-radius: 50%;
            opacity: 0;
            animation: pulseRing 2s infinite;
          "></div>
        </div>
        <style>
          @keyframes markerPulse {
            0%, 100% { transform: rotate(-45deg) scale(1); }
            50% { transform: rotate(-45deg) scale(1.05); }
          }
          @keyframes pulseRing {
            0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.8; }
            100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
          }
        </style>
      `

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="padding: 12px; min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold; color: #059669;">
            ${brokerName}
          </h3>
          <p style="margin: 4px 0; font-size: 12px; color: #666;">
            <strong>Ubicación:</strong> ${location}
          </p>
          <p style="margin: 4px 0; font-size: 12px; color: #666;">
            <strong>Monto:</strong> ${amount}
          </p>
        </div>
      `)

      new mapboxgl.Marker(el)
        .setLngLat([coordinates.lng, coordinates.lat])
        .setPopup(popup)
        .addTo(map.current!)

      map.current!.addControl(new mapboxgl.NavigationControl(), 'top-right')
    })

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [coordinates, mapStyle, orderData])

  const toggleMapStyle = () => {
    setMapStyle(prev => prev === 'streets' ? 'satellite' : 'streets')
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className={cn(
          'min-h-screen pt-20 pb-20 px-4 sm:px-6 lg:px-8',
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
        )}>
          <div className="max-w-7xl mx-auto">
            <div className="space-y-6">
              <div className={cn('rounded-2xl p-6 h-32 animate-pulse', theme === 'dark' ? 'bg-gray-800' : 'bg-white')} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className={cn('rounded-2xl p-6 h-24 animate-pulse', theme === 'dark' ? 'bg-gray-800' : 'bg-white')} />
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <div className={cn('rounded-2xl p-6 h-96 animate-pulse', theme === 'dark' ? 'bg-gray-800' : 'bg-white')} />
                </div>
                <div className="space-y-6">
                  {[1, 2].map(i => (
                    <div key={i} className={cn('rounded-2xl p-6 h-48 animate-pulse', theme === 'dark' ? 'bg-gray-800' : 'bg-white')} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (error || !orderData) {
    return (
      <DashboardLayout>
        <div className={cn(
          'min-h-screen pt-20 pb-20 px-4 sm:px-6 lg:px-8',
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
        )}>
          <div className="max-w-7xl mx-auto">
            <div className={cn('rounded-2xl p-12 text-center', theme === 'dark' ? 'bg-gray-800' : 'bg-white')}>
              <AlertCircle className={cn('w-16 h-16 mx-auto mb-4', theme === 'dark' ? 'text-red-400' : 'text-red-500')} />
              <p className={cn('text-xl font-semibold mb-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Error al cargar la orden
              </p>
              <p className={cn('text-sm mb-4', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                {error || 'No se pudo cargar la información de la orden'}
              </p>
              <button
                onClick={() => router.back()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const statusConfig = STATUS_CONFIG[orderData.status] || STATUS_CONFIG.pending
  const StatusIcon = statusConfig.icon

  return (
    <DashboardLayout>
      <div className={cn(
        'min-h-screen pt-12 sm:pt-16 lg:pt-20 pb-20 px-4 sm:px-6 lg:px-8',
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'rounded-2xl border p-6 shadow-lg',
              theme === 'dark'
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
            )}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.back()}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  )}
                >
                  <ArrowLeft className={cn('w-5 h-5', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')} />
                </button>
                <div>
                  <h1 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {orderData.order_number}
                  </h1>
                  <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    Creado el {new Date(orderData.created_at).toLocaleDateString('es-ES', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium',
                  statusConfig.bgColor,
                  statusConfig.color
                )}>
                  <StatusIcon className="w-4 h-4" />
                  {statusConfig.label}
                </span>
                <button
                  onClick={fetchOrderDetails}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                  )}
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Amount */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'rounded-2xl border p-6 shadow-lg',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-700/50'
                  : 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn('text-sm font-medium mb-1', theme === 'dark' ? 'text-green-300' : 'text-green-700')}>
                    Monto Total
                  </p>
                  <p className={cn('text-3xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    ${parseFloat(orderData.total_amount).toLocaleString()}
                  </p>
                  <p className={cn('text-xs', theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
                    {orderData.currency}
                  </p>
                </div>
                <div className={cn('w-12 h-12 rounded-full flex items-center justify-center', theme === 'dark' ? 'bg-green-500/20' : 'bg-green-200')}>
                  <DollarSign className={cn('w-6 h-6', theme === 'dark' ? 'text-green-400' : 'text-green-600')} />
                </div>
              </div>
            </motion.div>

            {/* Total Bills */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={cn(
                'rounded-2xl border p-6 shadow-lg',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-700/50'
                  : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn('text-sm font-medium mb-1', theme === 'dark' ? 'text-blue-300' : 'text-blue-700')}>
                    Total Billetes
                  </p>
                  <p className={cn('text-3xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {orderData.total_bills}
                  </p>
                  <p className={cn('text-xs', theme === 'dark' ? 'text-blue-400' : 'text-blue-600')}>
                    billetes
                  </p>
                </div>
                <div className={cn('w-12 h-12 rounded-full flex items-center justify-center', theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-200')}>
                  <Banknote className={cn('w-6 h-6', theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
                </div>
              </div>
            </motion.div>

            {/* Deadline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={cn(
                'rounded-2xl border p-6 shadow-lg',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-purple-900/50 to-purple-800/30 border-purple-700/50'
                  : 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200'
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn('text-sm font-medium mb-1', theme === 'dark' ? 'text-purple-300' : 'text-purple-700')}>
                    Fecha Límite
                  </p>
                  <p className={cn('text-xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {new Date(orderData.deadline_date).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </p>
                </div>
                <div className={cn('w-12 h-12 rounded-full flex items-center justify-center', theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-200')}>
                  <Calendar className={cn('w-6 h-6', theme === 'dark' ? 'text-purple-400' : 'text-purple-600')} />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Map */}
            <div className="lg:col-span-2 space-y-6">
              {/* Map */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  'rounded-2xl border overflow-hidden shadow-lg',
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                <div className={cn('px-6 py-4 border-b', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                  <h2 className={cn('text-lg font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    Ubicación del Broker
                  </h2>
                  <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    {orderData.broker_municipality}, {orderData.broker_province}
                  </p>
                </div>
                <div className="relative" style={{ height: '400px' }}>
                  {mapLoading && (
                    <div className={cn(
                      'absolute inset-0 z-10 flex items-center justify-center',
                      theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                    )}>
                      <Loader2 className={cn('w-8 h-8 animate-spin', theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
                    </div>
                  )}
                  <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
                  <button
                    onClick={toggleMapStyle}
                    className={cn(
                      'absolute bottom-4 right-4 z-10 px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 transition-colors',
                      theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-white hover:bg-gray-50 text-gray-900'
                    )}
                  >
                    {mapStyle === 'streets' ? <Satellite className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
                    <span className="text-xs font-medium">{mapStyle === 'streets' ? 'Satélite' : 'Calles'}</span>
                  </button>
                </div>
              </motion.div>

              {/* Bill Denominations */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className={cn(
                  'rounded-2xl border p-6 shadow-lg',
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                <h2 className={cn('text-lg font-semibold mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Nomenclatura de Billetes
                </h2>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {orderData.bill_denominations && Object.entries(orderData.bill_denominations)
                    .sort(([a], [b]) => parseInt(b) - parseInt(a))
                    .map(([denomination, count]) => (
                      <div
                        key={denomination}
                        className={cn(
                          'p-3 rounded-xl text-center',
                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                        )}
                      >
                        <p className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          ${denomination}
                        </p>
                        <p className={cn('text-2xl font-bold text-green-500')}>
                          {count as number}
                        </p>
                        <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          = ${(parseInt(denomination) * (count as number)).toLocaleString()}
                        </p>
                      </div>
                    ))}
                </div>
              </motion.div>
            </div>

            {/* Right Column - Info Cards */}
            <div className="space-y-6">
              {/* Broker Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className={cn(
                  'rounded-2xl border p-6 shadow-lg',
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                <h3 className={cn('text-lg font-semibold mb-4 flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  <MapPin className="w-5 h-5 text-green-500" />
                  Broker Destino
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Nombre</p>
                    <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {orderData.broker_name || orderData.broker_company_name}
                    </p>
                  </div>
                  <div>
                    <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Ubicación</p>
                    <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {[orderData.broker_municipality, orderData.broker_province].filter(Boolean).join(', ') || 'No especificada'}
                    </p>
                  </div>
                  {orderData.broker_contact_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className={cn('w-4 h-4', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                      <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {orderData.broker_contact_phone}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Delivery User Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className={cn(
                  'rounded-2xl border p-6 shadow-lg',
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                <h3 className={cn('text-lg font-semibold mb-4 flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  <User className="w-5 h-5 text-blue-500" />
                  Repartidor
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Nombre</p>
                    <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {orderData.delivery_user_display_name || orderData.delivery_user_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className={cn('w-4 h-4', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                    <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {orderData.delivery_user_phone}
                    </p>
                  </div>
                  {orderData.delivery_user_email && (
                    <div className="flex items-center gap-2">
                      <Mail className={cn('w-4 h-4', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                      <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {orderData.delivery_user_email}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Notes */}
              {orderData.notes && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className={cn(
                    'rounded-2xl border p-6 shadow-lg',
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}
                >
                  <h3 className={cn('text-lg font-semibold mb-4 flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    <FileText className="w-5 h-5 text-yellow-500" />
                    Notas
                  </h3>
                  <p className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    {orderData.notes}
                  </p>
                </motion.div>
              )}

              {/* Created By */}
              {orderData.created_by_name && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className={cn(
                    'rounded-2xl border p-4 shadow-lg',
                    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                  )}
                >
                  <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                    Creado por: <span className="font-medium">{orderData.created_by_name}</span>
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
