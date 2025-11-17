'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Package, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

// Componentes específicos de pickup-orders
import PickupOrderHeader from '@/components/pickup-orders/details/PickupOrderHeader'
import PickupLocationMap from '@/components/pickup-orders/details/PickupLocationMap'
import ZoneInfoCard from '@/components/pickup-orders/details/ZoneInfoCard'
import PickupScheduleCard from '@/components/pickup-orders/details/PickupScheduleCard'
import RouteWaypointsCard from '@/components/pickup-orders/details/RouteWaypointsCard'
import PackageTrackingCard from '@/components/pickup-orders/details/PackageTrackingCard'

// Componentes reutilizables de office-orders
import PersonInfoCard from '@/components/office-orders/details/PersonInfoCard'

//  Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function PickupOrderDetailsPage({ params }: PageProps) {
  const { theme } = useTheme()
  const [orderId, setOrderId] = useState<number | null>(null)
  const [orderData, setOrderData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

        const response = await fetch(`/api/pickup-orders/${orderId}`)
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
                  <div
                    key={i}
                    className={cn(
                      'rounded-2xl p-6 h-24 animate-pulse',
                      theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                    )}
                  />
                ))}
              </div>

              {/* Skeleton Content */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className={cn(
                    'rounded-2xl p-6 h-96 animate-pulse',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                  )} />
                </div>
                <div className="space-y-6">
                  {[1, 2].map(i => (
                    <div
                      key={i}
                      className={cn(
                        'rounded-2xl p-6 h-48 animate-pulse',
                        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                      )}
                    />
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
              <p className={cn(
                'text-xl font-semibold mb-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Error al cargar la orden
              </p>
              <p className={cn(
                'text-sm',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                {error || 'No se pudo cargar la información de la orden'}
              </p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const { order, zone, zipCode, route, empaques, summary } = orderData

  return (
    <DashboardLayout>
      <div className={cn(
        'min-h-screen pt-12 sm:pt-16 lg:pt-20 pb-20 px-4 sm:px-6 lg:px-8',
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <PickupOrderHeader
            orderNumber={order.orderNumber}
            status={order.status}
            createdAt={order.createdAt}
            orderId={order.id}
          />

          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Empaques */}
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
                    Total Empaques
                  </p>
                  <p className={cn(
                    'text-3xl font-bold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {summary.totalEmpaques}
                  </p>
                </div>
                <div className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center',
                  theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-200'
                )}>
                  <Package className={cn(
                    'w-6 h-6',
                    theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                  )} />
                </div>
              </div>
            </motion.div>

            {/* Peso Total */}
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
                    Peso Total
                  </p>
                  <p className={cn(
                    'text-3xl font-bold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {summary.totalWeightLb.toFixed(1)} <span className="text-xl">lb</span>
                  </p>
                  <p className={cn(
                    'text-xs',
                    theme === 'dark' ? 'text-green-400' : 'text-green-600'
                  )}>
                    {summary.totalWeightKg.toFixed(2)} kg
                  </p>
                </div>
                <div className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center',
                  theme === 'dark' ? 'bg-green-500/20' : 'bg-green-200'
                )}>
                  <Package className={cn(
                    'w-6 h-6',
                    theme === 'dark' ? 'text-green-400' : 'text-green-600'
                  )} />
                </div>
              </div>
            </motion.div>

            {/* Monto Total */}
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
                    Monto Total
                  </p>
                  <p className={cn(
                    'text-3xl font-bold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    ${parseFloat(order.totalAmount || 0).toFixed(2)}
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
            {/* Left Column - Map */}
            <div className="lg:col-span-2 space-y-6">
              <PickupLocationMap
                order={order}
                zone={zone}
                route={route}
              />

              {/* Customer Info */}
              <PersonInfoCard
                title="Cliente / Remitente"
                name={order.customerName}
                phone={order.customerPhone}
                email={order.customerEmail}
                address={order.customerAddress}
              />

              {/* Package Tracking */}
              <PackageTrackingCard
                empaques={empaques}
                totalWeightLb={summary.totalWeightLb}
              />
            </div>

            {/* Right Column - Info Cards */}
            <div className="space-y-6">
              <ZoneInfoCard zone={zone} zipCode={zipCode} />
              <PickupScheduleCard
                scheduledDate={order.scheduledDate}
                timeSlot={order.timeSlot}
                pickupInstructions={order.pickupInstructions}
                status={order.status}
              />
              {route && (
                <RouteWaypointsCard
                  route={route}
                  currentOrderId={order.id}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
