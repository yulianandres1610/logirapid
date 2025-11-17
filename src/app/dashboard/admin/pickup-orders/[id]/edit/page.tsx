'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

// Edit components
import PackageScanInput from '@/components/pickup-orders/edit/PackageScanInput'
import PackageList from '@/components/pickup-orders/edit/PackageList'
import PickupOrderEditor from '@/components/pickup-orders/edit/PickupOrderEditor'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function PickupOrderEditPage({ params }: PageProps) {
  const { theme } = useTheme()
  const router = useRouter()
  const [orderId, setOrderId] = useState<number | null>(null)
  const [orderData, setOrderData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

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

        // Check if order can be edited (only pending orders)
        if (data.data.order.status !== 'pending') {
          setError('Solo las órdenes en estado "pendiente" pueden ser editadas')
          return
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
  }, [orderId, refreshKey])

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  const handleSaveComplete = () => {
    // Refresh data and navigate back to details
    router.push(`/dashboard/admin/pickup-orders/${orderId}`)
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
                'rounded-2xl p-6 h-24 animate-pulse',
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )} />

              {/* Skeleton Content */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {[1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className={cn(
                        'rounded-2xl p-6 h-48 animate-pulse',
                        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                      )}
                    />
                  ))}
                </div>
                <div className="space-y-6">
                  {[1, 2].map(i => (
                    <div
                      key={i}
                      className={cn(
                        'rounded-2xl p-6 h-64 animate-pulse',
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
            {/* Back Button */}
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => router.back()}
              className={cn(
                'mb-6 flex items-center gap-2 px-4 py-2 rounded-xl',
                'transition-colors duration-200',
                theme === 'dark'
                  ? 'bg-gray-800 hover:bg-gray-700 text-white'
                  : 'bg-white hover:bg-gray-50 text-gray-900'
              )}
            >
              <ArrowLeft className="w-5 h-5" />
              Volver
            </motion.button>

            <div className={cn(
              'rounded-2xl p-12 text-center border',
              theme === 'dark'
                ? 'bg-gray-800 border-red-500/30'
                : 'bg-white border-red-200'
            )}>
              <AlertCircle className={cn(
                'w-16 h-16 mx-auto mb-4',
                theme === 'dark' ? 'text-red-400' : 'text-red-600'
              )} />
              <p className={cn(
                'text-xl font-semibold mb-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {error || 'No se pudo cargar la orden'}
              </p>
              {error?.includes('pendiente') && (
                <p className={cn(
                  'text-sm mt-4',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  Las órdenes solo pueden editarse cuando están en estado pendiente
                </p>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const { order, empaques } = orderData

  // Parse address string into AddressData format
  const parseAddress = (addressString: string) => {
    // Try to parse if it's already a JSON string
    try {
      const parsed = JSON.parse(addressString)
      if (typeof parsed === 'object' && parsed.street) {
        return {
          street: parsed.street || '',
          apartment: parsed.apartment || '',
          city: parsed.city || '',
          state: parsed.state || '',
          zipCode: parsed.zipCode || '',
          country: parsed.country || 'us'
        }
      }
    } catch (e) {
      // Not JSON, parse as plain string
    }

    // Parse plain string format: "street, city, state, zipCode, country"
    const parts = addressString.split(',').map(p => p.trim())
    return {
      street: parts[0] || '',
      apartment: '',
      city: parts[1] || '',
      state: parts[2] || '',
      zipCode: parts[3] || '',
      country: parts[4] || 'us'
    }
  }

  // Parse services - ensure it's always an array
  const parseServices = (services: any): string[] => {
    if (!services) return []
    if (Array.isArray(services)) return services
    if (typeof services === 'string') {
      try {
        const parsed = JSON.parse(services)
        return Array.isArray(parsed) ? parsed : []
      } catch (e) {
        return []
      }
    }
    return []
  }

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
            className="flex items-center gap-4"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.back()}
              className={cn(
                'p-3 rounded-xl transition-colors',
                theme === 'dark'
                  ? 'bg-gray-800 hover:bg-gray-700 text-white'
                  : 'bg-white hover:bg-gray-50 text-gray-900'
              )}
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>

            <div className="flex-1">
              <h1 className={cn(
                'text-2xl sm:text-3xl font-bold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Editar Orden de Recogida
              </h1>
              <p className={cn(
                'text-sm mt-1',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                {order.orderNumber}
              </p>
            </div>

            <div className={cn(
              'px-4 py-2 rounded-xl text-sm font-semibold',
              theme === 'dark'
                ? 'bg-yellow-900/30 text-yellow-400'
                : 'bg-yellow-100 text-yellow-700'
            )}>
              Edición
            </div>
          </motion.div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Order Editor */}
            <div className="lg:col-span-2">
              <PickupOrderEditor
                orderId={order.id}
                initialData={{
                  customerName: order.customerName,
                  customerPhone: order.customerPhone || '',
                  customerEmail: order.customerEmail || '',
                  customerAddress: order.customerAddress,
                  addressData: parseAddress(order.customerAddress),
                  scheduledDate: order.scheduledDate ? order.scheduledDate.split('T')[0] : '',
                  timeSlot: order.timeSlot || '',
                  services: parseServices(order.services),
                  pickupInstructions: order.pickupInstructions || '',
                  latitude: order.latitude,
                  longitude: order.longitude
                }}
                onSave={handleSaveComplete}
              />
            </div>

            {/* Right Column - Package Management */}
            <div className="space-y-6">
              {/* Package Scanner */}
              <PackageScanInput
                orderId={order.id}
                orderNumber={order.orderNumber}
                onPackageAdded={handleRefresh}
              />

              {/* Package List */}
              <PackageList
                orderId={order.id}
                empaques={empaques.map((e: any) => ({
                  id: e.id,
                  codigo: e.codigo,
                  weightLb: e.weightLb,
                  weightKg: e.weightKg,
                  boxNumber: e.boxNumber,
                  totalBoxes: e.totalBoxes,
                  estado: e.estado
                }))}
                onPackageUpdated={handleRefresh}
              />
            </div>
          </div>

          {/* Helper Info */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className={cn(
              'rounded-xl border p-4',
              theme === 'dark'
                ? 'bg-blue-900/20 border-blue-700/30'
                : 'bg-blue-50 border-blue-200'
            )}
          >
            <p className={cn(
              'text-sm font-medium',
              theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
            )}>
              💡 Recuerda: Los cambios solo se pueden realizar en órdenes con estado "pendiente". Una vez guardados, los datos serán actualizados inmediatamente.
            </p>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  )
}
