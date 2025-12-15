'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  ArrowLeft,
  DollarSign,
  Send,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Banknote,
  Building2,
  CreditCard,
  FileText,
  Copy,
  Printer,
  Map as MapIcon,
  Satellite,
  Layers
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'

// Mapbox token
mapboxgl.accessToken = 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

interface PageProps {
  params: Promise<{ id: string }>
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  pending: { label: 'Pendiente', color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', icon: Clock },
  confirmed: { label: 'Confirmada', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', icon: CheckCircle },
  in_delivery: { label: 'En Entrega', color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30', icon: Send },
  delivered: { label: 'Entregada', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircle },
  cancelled: { label: 'Cancelada', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', icon: XCircle },
  rejected: { label: 'Rechazada', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', icon: XCircle }
}

export default function RemittanceOrderDetailsPage({ params }: PageProps) {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
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

  useEffect(() => {
    params.then(({ id }) => {
      setOrderId(parseInt(id))
    })
  }, [params])

  useEffect(() => {
    if (!orderId) return

    const fetchOrderDetails = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/remittance-orders/${orderId}`)
        const data = await response.json()

        if (!data.success) {
          throw new Error(data.error || 'Error al cargar la orden')
        }

        setOrderData(data.data)
      } catch (err) {
        console.error('Error fetching order details:', err)
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }

    fetchOrderDetails()
  }, [orderId])

  // Initialize map when order data is loaded
  useEffect(() => {
    if (!orderData?.order || !mapContainer.current || map.current) return

    const order = orderData.order
    const lat = order.recipientLatitude
    const lng = order.recipientLongitude

    // Cuba municipality coordinates fallback
    const CUBA_LOCATIONS: Record<string, Record<string, [number, number]>> = {
      'Villa Clara': { 'Santa Clara': [-79.9658, 22.4058], 'Remedios': [-79.5458, 22.4917] },
      'La Habana': { 'Playa': [-82.4208, 23.1147], 'Centro Habana': [-82.3667, 23.1367] },
      'Santiago de Cuba': { 'Santiago de Cuba': [-75.8219, 20.0247] },
      'Camagüey': { 'Camagüey': [-77.9169, 21.3808] }
    }

    let center: [number, number] = [-79.5, 22.0] // Cuba center default

    if (lat && lng) {
      center = [lng, lat]
    } else if (order.recipientProvince && order.recipientMunicipality) {
      const provinceData = CUBA_LOCATIONS[order.recipientProvince]
      if (provinceData && provinceData[order.recipientMunicipality]) {
        center = provinceData[order.recipientMunicipality]
      }
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle === 'streets'
        ? 'mapbox://styles/mapbox/streets-v12'
        : 'mapbox://styles/mapbox/satellite-streets-v12',
      center: center,
      zoom: lat && lng ? 14 : 10
    })

    map.current.on('load', () => {
      setMapLoading(false)

      if (!map.current) return

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

      // Create custom marker
      const el = document.createElement('div')
      const statusColor = order.status === 'delivered' ? '#10B981' : '#CC0A46'
      el.innerHTML = `
        <div style="
          position: relative;
          cursor: pointer;
          filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3));
        ">
          <div style="
            width: 40px;
            height: 40px;
            background: ${statusColor};
            border-radius: 50% 50% 50% 15%;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
            animation: markerBounce 2s infinite ease-in-out;
          ">
            <span style="transform: rotate(45deg); font-size: 18px;">💵</span>
          </div>
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 60px;
            height: 60px;
            border: 2px solid ${statusColor};
            border-radius: 50%;
            opacity: 0;
            animation: pulseAnimation 2s infinite;
          "></div>
        </div>
        <style>
          @keyframes markerBounce {
            0%, 100% { transform: rotate(-45deg) scale(1); }
            50% { transform: rotate(-45deg) scale(1.1); }
          }
          @keyframes pulseAnimation {
            0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.8; }
            100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
          }
        </style>
      `

      // Popup content
      const popupContent = `
        <div style="padding: 8px; min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold;">${order.orderNumber}</h3>
          <p style="margin: 4px 0; font-size: 12px;"><strong>Destinatario:</strong> ${order.recipientName}</p>
          <p style="margin: 4px 0; font-size: 12px;"><strong>Monto:</strong> ${order.receiveAmount.toLocaleString()} ${order.receiveCurrency}</p>
          <p style="margin: 4px 0; font-size: 12px;"><strong>Provincia:</strong> ${order.recipientProvince}</p>
          <p style="margin: 4px 0; font-size: 12px;"><strong>Municipio:</strong> ${order.recipientMunicipality}</p>
          ${order.recipientAddress ? `<p style="margin: 4px 0; font-size: 12px;"><strong>Dirección:</strong> ${order.recipientAddress}</p>` : ''}
        </div>
      `

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(popupContent)

      new mapboxgl.Marker(el)
        .setLngLat(center)
        .setPopup(popup)
        .addTo(map.current!)
    })

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [orderData, mapStyle])

  const toggleMapStyle = () => {
    if (map.current) {
      map.current.remove()
      map.current = null
      setMapLoading(true)
    }
    setMapStyle(prev => prev === 'streets' ? 'satellite' : 'streets')
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showNotification('success', 'Copiado', 'Texto copiado al portapapeles')
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
              {/* Skeleton Header */}
              <div className={cn(
                'rounded-2xl p-6 h-32 animate-pulse',
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )} />
              {/* Skeleton Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className={cn(
                    'rounded-2xl p-6 h-24 animate-pulse',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                  )} />
                ))}
              </div>
              {/* Skeleton Content */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <div className={cn(
                    'rounded-2xl p-6 h-96 animate-pulse',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                  )} />
                </div>
                <div className="space-y-6">
                  {[1, 2].map(i => (
                    <div key={i} className={cn(
                      'rounded-2xl p-6 h-48 animate-pulse',
                      theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                    )} />
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
            <div className={cn(
              'rounded-2xl p-12 text-center',
              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            )}>
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
              <p className={cn(
                'text-xl font-semibold mb-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Error al cargar la orden
              </p>
              <p className={cn(
                'text-sm mb-6',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                {error || 'No se pudo cargar la información de la orden'}
              </p>
              <Button onClick={() => router.back()}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver
              </Button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const { order } = orderData
  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
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
                ? 'bg-gray-800/95 border-gray-700/50'
                : 'bg-white border-gray-200'
            )}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.back()}
                  className="rounded-xl"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className={cn(
                      'text-2xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {order.orderNumber}
                    </h1>
                    <button
                      onClick={() => copyToClipboard(order.orderNumber)}
                      className={cn(
                        'p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700',
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <p className={cn(
                    'text-sm mt-1',
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Creada el {new Date(order.createdAt).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn(
                  'px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2',
                  statusConfig.bgColor,
                  statusConfig.color
                )}>
                  <StatusIcon className="w-4 h-4" />
                  {statusConfig.label}
                </span>
                <Button variant="outline" size="sm" className="rounded-xl">
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Monto Enviado */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'rounded-2xl border p-6 shadow-lg',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-700/50'
                  : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn(
                    'text-sm font-medium mb-1',
                    theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                  )}>
                    Monto Enviado
                  </p>
                  <p className={cn(
                    'text-3xl font-bold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    ${order.sendAmount.toFixed(2)}
                  </p>
                  <p className={cn(
                    'text-xs mt-1',
                    theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                  )}>
                    {order.sendCurrency}
                  </p>
                </div>
                <div className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center',
                  theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-200'
                )}>
                  <Send className={cn(
                    'w-6 h-6',
                    theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                  )} />
                </div>
              </div>
            </motion.div>

            {/* Monto a Recibir */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={cn(
                'rounded-2xl border p-6 shadow-lg',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-700/50'
                  : 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn(
                    'text-sm font-medium mb-1',
                    theme === 'dark' ? 'text-green-300' : 'text-green-700'
                  )}>
                    Monto a Recibir
                  </p>
                  <p className={cn(
                    'text-3xl font-bold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {order.receiveAmount.toLocaleString()}
                  </p>
                  <p className={cn(
                    'text-xs mt-1',
                    theme === 'dark' ? 'text-green-400' : 'text-green-600'
                  )}>
                    {order.receiveCurrency} (Tasa: {order.exchangeRate})
                  </p>
                </div>
                <div className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center',
                  theme === 'dark' ? 'bg-green-500/20' : 'bg-green-200'
                )}>
                  <Banknote className={cn(
                    'w-6 h-6',
                    theme === 'dark' ? 'text-green-400' : 'text-green-600'
                  )} />
                </div>
              </div>
            </motion.div>

            {/* Total Cobrado */}
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
                  <p className={cn(
                    'text-sm font-medium mb-1',
                    theme === 'dark' ? 'text-purple-300' : 'text-purple-700'
                  )}>
                    Total Cobrado
                  </p>
                  <p className={cn(
                    'text-3xl font-bold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    ${order.totalCharged.toFixed(2)}
                  </p>
                  <p className={cn(
                    'text-xs mt-1',
                    theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                  )}>
                    Comisión: ${order.serviceFee.toFixed(2)} ({order.serviceFeePercentage}%)
                  </p>
                </div>
                <div className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center',
                  theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-200'
                )}>
                  <DollarSign className={cn(
                    'w-6 h-6',
                    theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                  )} />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Map & Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Map */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'rounded-2xl border shadow-lg overflow-hidden',
                  theme === 'dark' ? 'bg-gray-800/95 border-gray-700/50' : 'bg-white border-gray-200'
                )}
              >
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className={cn(
                    'text-lg font-semibold flex items-center gap-2',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    <MapPin className="w-5 h-5 text-red-500" />
                    Ubicación de Entrega
                  </h3>
                </div>
                <div className="relative" style={{ height: '400px' }}>
                  {mapLoading && (
                    <div className={cn(
                      'absolute inset-0 z-10 flex items-center justify-center',
                      theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                    )}>
                      <div className="text-center">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                          <Layers className={cn(
                            'w-8 h-8 mx-auto mb-2',
                            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                          )} />
                        </motion.div>
                        <p className={cn(
                          'text-sm',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          Cargando mapa...
                        </p>
                      </div>
                    </div>
                  )}
                  <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={toggleMapStyle}
                    className={cn(
                      'absolute bottom-4 right-4 z-10',
                      'px-3 py-2 rounded-lg shadow-lg',
                      'flex items-center gap-2',
                      theme === 'dark'
                        ? 'bg-gray-800 hover:bg-gray-700 text-white'
                        : 'bg-white hover:bg-gray-50 text-gray-900'
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
                </div>
              </motion.div>

              {/* Recipient Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'rounded-2xl border p-6 shadow-lg',
                  theme === 'dark' ? 'bg-gray-800/95 border-gray-700/50' : 'bg-white border-gray-200'
                )}
              >
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-green-500 to-green-600 shadow-md">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <h3 className={cn(
                    'text-xl font-bold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Destinatario
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <User className={cn('w-5 h-5 mt-0.5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                      <div>
                        <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Nombre</p>
                        <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {order.recipientName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Phone className={cn('w-5 h-5 mt-0.5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                      <div>
                        <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Teléfono</p>
                        <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {order.recipientPhone}
                        </p>
                      </div>
                    </div>
                    {order.recipientIdNumber && (
                      <div className="flex items-start gap-3">
                        <FileText className={cn('w-5 h-5 mt-0.5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                        <div>
                          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Carnet de Identidad</p>
                          <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {order.recipientIdNumber}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <MapPin className={cn('w-5 h-5 mt-0.5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                      <div>
                        <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Ubicación</p>
                        <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {order.recipientMunicipality}, {order.recipientProvince}
                        </p>
                        {order.recipientAddress && (
                          <p className={cn('text-sm mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                            {order.recipientAddress}
                          </p>
                        )}
                      </div>
                    </div>
                    {order.hasAlternateContact && (
                      <div className="flex items-start gap-3">
                        <Phone className={cn('w-5 h-5 mt-0.5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                        <div>
                          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Contacto Alternativo</p>
                          <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {order.alternateContactName}
                          </p>
                          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                            {order.alternateContactPhone}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Sender Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'rounded-2xl border p-6 shadow-lg',
                  theme === 'dark' ? 'bg-gray-800/95 border-gray-700/50' : 'bg-white border-gray-200'
                )}
              >
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600 shadow-md">
                    <Send className="w-6 h-6 text-white" />
                  </div>
                  <h3 className={cn(
                    'text-xl font-bold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Remitente
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <User className={cn('w-5 h-5 mt-0.5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                      <div>
                        <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Nombre</p>
                        <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {order.senderName}
                        </p>
                      </div>
                    </div>
                    {order.senderPhone && (
                      <div className="flex items-start gap-3">
                        <Phone className={cn('w-5 h-5 mt-0.5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                        <div>
                          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Teléfono</p>
                          <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {order.senderPhone}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    {order.senderEmail && (
                      <div className="flex items-start gap-3">
                        <Mail className={cn('w-5 h-5 mt-0.5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                        <div>
                          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Email</p>
                          <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {order.senderEmail}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Right Column - Info Cards */}
            <div className="space-y-6">
              {/* Delivery Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'rounded-2xl border p-6 shadow-lg',
                  theme === 'dark' ? 'bg-gray-800/95 border-gray-700/50' : 'bg-white border-gray-200'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    theme === 'dark' ? 'bg-orange-900/30' : 'bg-orange-100'
                  )}>
                    <Clock className="w-5 h-5 text-orange-500" />
                  </div>
                  <h3 className={cn(
                    'text-lg font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Información de Entrega
                  </h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      Tiempo Estimado
                    </span>
                    <span className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {order.estimatedDelivery || 'N/A'}
                    </span>
                  </div>
                  {order.deliveredAt && (
                    <div className="flex justify-between">
                      <span className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        Entregada el
                      </span>
                      <span className={cn('font-semibold text-green-500')}>
                        {new Date(order.deliveredAt).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                  )}
                  {order.confirmedAt && (
                    <div className="flex justify-between">
                      <span className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        Confirmada el
                      </span>
                      <span className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {new Date(order.confirmedAt).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Broker Info */}
              {order.brokerCompanyName && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'rounded-2xl border p-6 shadow-lg',
                    theme === 'dark' ? 'bg-gray-800/95 border-gray-700/50' : 'bg-white border-gray-200'
                  )}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center',
                      theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                    )}>
                      <Building2 className="w-5 h-5 text-purple-500" />
                    </div>
                    <h3 className={cn(
                      'text-lg font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Broker Asignado
                    </h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Nombre</p>
                      <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {order.brokerCompanyName}
                      </p>
                    </div>
                    {order.brokerPhone && (
                      <div>
                        <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Teléfono</p>
                        <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {order.brokerPhone}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Payment Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'rounded-2xl border p-6 shadow-lg',
                  theme === 'dark' ? 'bg-gray-800/95 border-gray-700/50' : 'bg-white border-gray-200'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    theme === 'dark' ? 'bg-green-900/30' : 'bg-green-100'
                  )}>
                    <CreditCard className="w-5 h-5 text-green-500" />
                  </div>
                  <h3 className={cn(
                    'text-lg font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Información de Pago
                  </h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      Método
                    </span>
                    <span className={cn('font-semibold capitalize', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {order.paymentMethod || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      Estado
                    </span>
                    <span className={cn(
                      'font-semibold capitalize',
                      order.paymentStatus === 'completed' ? 'text-green-500' : 'text-yellow-500'
                    )}>
                      {order.paymentStatus === 'completed' ? 'Pagado' : 'Pendiente'}
                    </span>
                  </div>
                  {order.paymentReference && (
                    <div className="flex justify-between">
                      <span className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        Referencia
                      </span>
                      <span className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {order.paymentReference}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Sold By Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'rounded-2xl border p-6 shadow-lg',
                  theme === 'dark' ? 'bg-gray-800/95 border-gray-700/50' : 'bg-white border-gray-200'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                  )}>
                    <User className="w-5 h-5 text-blue-500" />
                  </div>
                  <h3 className={cn(
                    'text-lg font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Vendido Por
                  </h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Agente</p>
                    <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {order.soldByName || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Empresa</p>
                    <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {order.sellingCompanyName || 'N/A'}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
