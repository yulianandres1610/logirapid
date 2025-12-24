'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Store,
  Package,
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  Loader2,
  Phone,
  MapPin,
  Calendar,
  FileText,
  DollarSign,
  User,
  Warehouse
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface ConsignmentOrder {
  id: number
  orderNumber: string
  status: string
  provider: {
    id: number
    name: string
    phone: string | null
    email: string | null
    address: string | null
    logoUrl: string | null
  }
  receiver: {
    id: number
    name: string
    phone: string | null
    email: string | null
    address: string | null
    logoUrl: string | null
  }
  providerWarehouse: {
    id: number
    name: string
    address: string | null
  }
  receiverWarehouse: {
    id: number
    name: string
    address: string | null
  } | null
  scheduledDeliveryDate: string | null
  actualDeliveryDate: string | null
  subtotal: number
  totalItems: number
  totalUnits: number
  providerNotes: string | null
  receiverNotes: string | null
  rejectionReason: string | null
  createdBy: string | null
  approvedBy: string | null
  receivedBy: string | null
  createdAt: string
  approvedAt: string | null
  receivedAt: string | null
  completedAt: string | null
  isProvider: boolean
  isReceiver: boolean
  items: OrderItem[]
}

interface OrderItem {
  id: number
  product: {
    id: number
    name: string
    sku: string | null
    barcode: string | null
    imageUrl: string | null
  }
  quantity: number
  quantityReceived: number | null
  quantitySold: number
  quantityReturned: number
  providerCost: number
  providerPrice: number
  suggestedRetailPrice: number | null
  actualRetailPrice: number | null
  subtotal: number
  remainingQuantity: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Borrador', color: 'gray', icon: FileText },
  pending_approval: { label: 'Pendiente', color: 'yellow', icon: Clock },
  approved: { label: 'Aprobada', color: 'blue', icon: CheckCircle },
  in_transit: { label: 'En Tránsito', color: 'purple', icon: Truck },
  received: { label: 'Recibida', color: 'green', icon: CheckCircle },
  completed: { label: 'Completada', color: 'green', icon: CheckCircle },
  rejected: { label: 'Rechazada', color: 'red', icon: XCircle },
  cancelled: { label: 'Cancelada', color: 'red', icon: XCircle }
}

export default function ConsignmentDetailPage() {
  const { theme } = useTheme()
  const params = useParams()
  const id = params.id as string

  const [order, setOrder] = useState<ConsignmentOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadOrder = async () => {
      try {
        const response = await fetch(`/api/consignments/orders/${id}`)
        const data = await response.json()
        if (data.success) {
          setOrder(data.data)
        } else {
          setError(data.error || 'Error al cargar la consignación')
        }
      } catch (err) {
        setError('Error al cargar la consignación')
      } finally {
        setLoading(false)
      }
    }
    loadOrder()
  }, [id])

  const statusConfig = order ? STATUS_CONFIG[order.status] || STATUS_CONFIG.draft : STATUS_CONFIG.draft
  const StatusIcon = statusConfig.icon

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className={cn(
          "min-h-screen p-4 sm:p-6",
          theme === 'dark' ? 'bg-black' : 'bg-gray-50'
        )}>
          {/* Header */}
          <div className="mb-6">
            <Link
              href="/dashboard/market/consignments"
              className={cn(
                "inline-flex items-center gap-2 text-sm mb-4 transition-colors",
                theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
              )}
            >
              <ArrowLeft className="w-4 h-4" />
              Volver a consignaciones
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : error ? (
            <div className={cn(
              "text-center py-20 rounded-xl",
              theme === 'dark' ? 'bg-gray-900' : 'bg-white'
            )}>
              <XCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
              <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>{error}</p>
            </div>
          ) : order ? (
            <div className="space-y-6">
              {/* Order Header */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "rounded-xl p-6",
                  theme === 'dark' ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200'
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className={cn(
                      "text-2xl font-bold",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {order.orderNumber}
                    </h1>
                    <p className={cn(
                      "text-sm mt-1",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    )}>
                      Creada el {new Date(order.createdAt).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className={cn(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium",
                    statusConfig.color === 'green' && 'bg-green-500/20 text-green-400',
                    statusConfig.color === 'yellow' && 'bg-yellow-500/20 text-yellow-400',
                    statusConfig.color === 'blue' && 'bg-blue-500/20 text-blue-400',
                    statusConfig.color === 'purple' && 'bg-purple-500/20 text-purple-400',
                    statusConfig.color === 'red' && 'bg-red-500/20 text-red-400',
                    statusConfig.color === 'gray' && 'bg-gray-500/20 text-gray-400'
                  )}>
                    <StatusIcon className="w-4 h-4" />
                    {statusConfig.label}
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-800">
                  <div>
                    <p className={cn("text-sm", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Total</p>
                    <p className={cn("text-xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      ${order.subtotal.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className={cn("text-sm", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Productos</p>
                    <p className={cn("text-xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {order.totalItems}
                    </p>
                  </div>
                  <div>
                    <p className={cn("text-sm", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Unidades</p>
                    <p className={cn("text-xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {order.totalUnits}
                    </p>
                  </div>
                  <div>
                    <p className={cn("text-sm", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Rol</p>
                    <p className={cn("text-xl font-bold", order.isProvider ? 'text-blue-400' : 'text-green-400')}>
                      {order.isProvider ? 'Proveedor' : 'Receptor'}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Companies Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Provider */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={cn(
                    "rounded-xl p-6",
                    theme === 'dark' ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200'
                  )}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100'
                    )}>
                      <Store className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className={cn("text-xs", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Proveedor</p>
                      <h3 className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {order.provider.name}
                      </h3>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    {order.provider.phone && (
                      <div className={cn("flex items-center gap-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        <Phone className="w-4 h-4" />
                        {order.provider.phone}
                      </div>
                    )}
                    {order.providerWarehouse && (
                      <div className={cn("flex items-center gap-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        <Warehouse className="w-4 h-4" />
                        {order.providerWarehouse.name}
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Receiver */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className={cn(
                    "rounded-xl p-6",
                    theme === 'dark' ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200'
                  )}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      theme === 'dark' ? 'bg-green-500/20' : 'bg-green-100'
                    )}>
                      <Store className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className={cn("text-xs", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Receptor</p>
                      <h3 className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {order.receiver.name}
                      </h3>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    {order.receiver.phone && (
                      <div className={cn("flex items-center gap-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        <Phone className="w-4 h-4" />
                        {order.receiver.phone}
                      </div>
                    )}
                    {order.receiverWarehouse && (
                      <div className={cn("flex items-center gap-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        <Warehouse className="w-4 h-4" />
                        {order.receiverWarehouse.name}
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* Items */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  "rounded-xl p-6",
                  theme === 'dark' ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200'
                )}
              >
                <h3 className={cn(
                  "text-lg font-semibold mb-4 flex items-center gap-2",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  <Package className="w-5 h-5" />
                  Productos ({order.items.length})
                </h3>

                <div className="space-y-3">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "p-4 rounded-lg",
                        theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0",
                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                        )}>
                          {item.product.imageUrl ? (
                            <img
                              src={item.product.imageUrl}
                              alt={item.product.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "font-medium truncate",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {item.product.name}
                          </p>
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            {item.product.sku || 'Sin SKU'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={cn(
                            "font-medium",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {item.quantity} unidades
                          </p>
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            ${item.providerPrice.toFixed(2)} c/u
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={cn(
                            "font-bold text-green-500"
                          )}>
                            ${item.subtotal.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className={cn(
                  "mt-4 pt-4 border-t flex justify-between items-center",
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                )}>
                  <span className={cn(
                    "text-lg font-semibold",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Total
                  </span>
                  <span className="text-2xl font-bold text-green-500">
                    ${order.subtotal.toFixed(2)}
                  </span>
                </div>
              </motion.div>

              {/* Notes */}
              {(order.providerNotes || order.receiverNotes || order.rejectionReason) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className={cn(
                    "rounded-xl p-6",
                    theme === 'dark' ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200'
                  )}
                >
                  <h3 className={cn(
                    "text-lg font-semibold mb-4",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Notas
                  </h3>
                  <div className="space-y-4">
                    {order.providerNotes && (
                      <div>
                        <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          Notas del proveedor
                        </p>
                        <p className={cn("mt-1", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {order.providerNotes}
                        </p>
                      </div>
                    )}
                    {order.receiverNotes && (
                      <div>
                        <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          Notas del receptor
                        </p>
                        <p className={cn("mt-1", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {order.receiverNotes}
                        </p>
                      </div>
                    )}
                    {order.rejectionReason && (
                      <div>
                        <p className="text-sm font-medium text-red-400">
                          Motivo de rechazo
                        </p>
                        <p className={cn("mt-1", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {order.rejectionReason}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          ) : null}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
