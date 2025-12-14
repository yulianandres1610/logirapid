'use client'

import { useState, useEffect } from 'react'
import {
  DollarSign,
  Clock,
  CheckCircle,
  Truck,
  AlertCircle,
  Loader2,
  RefreshCw,
  User,
  Calendar,
  Banknote
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

interface CashDelivery {
  id: number
  order_number: string
  delivery_user_name: string
  delivery_user_phone: string
  currency: string
  total_amount: string | number
  total_bills: number
  bill_denominations?: { [key: string]: number }
  deadline_date: string
  status: string
  created_at: string
}

const STATUS_CONFIG: { [key: string]: { label: string; color: string; bgColor: string; icon: any } } = {
  pending: { label: 'Pendiente', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', icon: Clock },
  in_transit: { label: 'En Tránsito', color: 'text-blue-500', bgColor: 'bg-blue-500/10', icon: Truck },
  pending_reception: { label: 'Recibiendo', color: 'text-purple-500', bgColor: 'bg-purple-500/10', icon: DollarSign },
  validating: { label: 'Validando OTP', color: 'text-orange-500', bgColor: 'bg-orange-500/10', icon: AlertCircle },
  completed: { label: 'Completado', color: 'text-green-500', bgColor: 'bg-green-500/10', icon: CheckCircle }
}

export default function BrokerCashDeliveriesPage() {
  const [deliveries, setDeliveries] = useState<CashDelivery[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDeliveries()
  }, [])

  const loadDeliveries = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/broker/cash-deliveries')
      const data = await res.json()

      if (data.success) {
        // API returns { deliveries: [...], summary: {...} }
        setDeliveries(data.data?.deliveries || data.data || [])
      } else {
        setError(data.error || 'Error al cargar las entregas')
      }
    } catch (err) {
      console.error('Error loading deliveries:', err)
      setError('Error al cargar las entregas')
    } finally {
      setIsLoading(false)
    }
  }

  // Filter deliveries by status
  const pendingDeliveries = deliveries.filter(d => ['pending', 'in_transit'].includes(d.status))
  const inProgressDeliveries = deliveries.filter(d => ['pending_reception', 'validating'].includes(d.status))
  const completedDeliveries = deliveries.filter(d => d.status === 'completed')

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Entregas de Efectivo
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                Recibe efectivo de los repartidores
              </p>
            </div>

            <button
              onClick={loadDeliveries}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{pendingDeliveries.length}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Pendientes</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <AlertCircle className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{inProgressDeliveries.length}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">En Proceso</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{completedDeliveries.length}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Completadas</p>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Deliveries List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : deliveries.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm rounded-2xl p-12 text-center">
              <Banknote className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                No hay entregas pendientes
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Las entregas de efectivo aparecerán aquí cuando sean asignadas
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pending/In Progress Section */}
              {[...pendingDeliveries, ...inProgressDeliveries].length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                    Pendientes de Recibir
                  </h2>
                  <div className="space-y-3">
                    <AnimatePresence>
                      {[...pendingDeliveries, ...inProgressDeliveries].map((delivery, index) => {
                        const statusConfig = STATUS_CONFIG[delivery.status] || STATUS_CONFIG.pending
                        const StatusIcon = statusConfig.icon

                        return (
                          <motion.div
                            key={delivery.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ delay: index * 0.05 }}
                            className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm rounded-xl p-4"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="font-semibold text-gray-900 dark:text-white">
                                    {delivery.order_number}
                                  </span>
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                                    <StatusIcon className="h-3 w-3" />
                                    {statusConfig.label}
                                  </span>
                                </div>

                                <div className="flex flex-wrap gap-4 text-sm">
                                  <div className="flex items-center gap-1.5">
                                    <User className="h-4 w-4 text-gray-400" />
                                    <span className="text-gray-500 dark:text-gray-400">{delivery.delivery_user_name}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <DollarSign className="h-4 w-4 text-gray-400" />
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                      {delivery.currency} ${parseFloat(delivery.total_amount as string).toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="h-4 w-4 text-gray-400" />
                                    <span className="text-gray-500 dark:text-gray-400">
                                      Límite: {new Date(delivery.deadline_date).toLocaleDateString('es-ES')}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <button
                                className={`px-4 py-2 rounded-xl font-medium transition-all ${
                                  delivery.status === 'validating'
                                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                                    : 'bg-gradient-to-r from-green-500 to-green-600 hover:opacity-90 text-white'
                                }`}
                              >
                                {delivery.status === 'validating' ? 'Ingresar OTP' : 'Recibir'}
                              </button>
                            </div>
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Completed Section */}
              {completedDeliveries.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                    Completadas Recientemente
                  </h2>
                  <div className="space-y-3">
                    {completedDeliveries.slice(0, 5).map((delivery) => {
                      const statusConfig = STATUS_CONFIG[delivery.status]
                      const StatusIcon = statusConfig.icon

                      return (
                        <div
                          key={delivery.id}
                          className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm rounded-xl p-4 opacity-75"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-3 mb-1">
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  {delivery.order_number}
                                </span>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                                  <StatusIcon className="h-3 w-3" />
                                  {statusConfig.label}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {delivery.currency} ${parseFloat(delivery.total_amount as string).toLocaleString()} • {delivery.delivery_user_name}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
