'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Store,
  Package,
  ArrowLeft,
  Clock,
  Loader2,
  Eye,
  Phone,
  CheckCircle,
  XCircle,
  Truck,
  Warehouse as WarehouseIcon,
  PackageCheck
} from 'lucide-react'
import Link from 'next/link'
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
    logoUrl: string | null
  }
  subtotal: number
  totalItems: number
  totalUnits: number
  itemCount: number
  providerNotes: string | null
  scheduledDeliveryDate: string | null
  createdAt: string
  sentAt?: string | null
}

interface OrderItem {
  id: number
  product: {
    id: number
    name: string
    sku: string
    imageUrl: string | null
  }
  quantity: number
  providerPrice: number
  suggestedRetailPrice: number | null
  subtotal: number
}

interface Warehouse {
  id: number
  name: string
  address: string | null
}

type TabType = 'pending_approval' | 'in_transit'

export default function PendingApprovalsPage() {
  const { theme } = useTheme()
  const [activeTab, setActiveTab] = useState<TabType>('pending_approval')
  const [loading, setLoading] = useState(true)
  const [pendingOrders, setPendingOrders] = useState<ConsignmentOrder[]>([])
  const [inTransitOrders, setInTransitOrders] = useState<ConsignmentOrder[]>([])
  const [selectedOrder, setSelectedOrder] = useState<ConsignmentOrder | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null)
  const [receiverNotes, setReceiverNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [processing, setProcessing] = useState(false)

  const currentOrders = activeTab === 'pending_approval' ? pendingOrders : inTransitOrders

  // Load orders
  useEffect(() => {
    const loadOrders = async () => {
      setLoading(true)
      try {
        const [pendingRes, transitRes] = await Promise.all([
          fetch('/api/consignments/orders?role=receiver&status=pending_approval'),
          fetch('/api/consignments/orders?role=receiver&status=in_transit')
        ])
        const [pendingData, transitData] = await Promise.all([
          pendingRes.json(),
          transitRes.json()
        ])
        if (pendingData.success) {
          setPendingOrders(pendingData.data.orders || [])
        }
        if (transitData.success) {
          setInTransitOrders(transitData.data.orders || [])
        }
      } catch (error) {
        console.error('Error loading orders:', error)
      } finally {
        setLoading(false)
      }
    }

    const loadWarehouses = async () => {
      try {
        const response = await fetch('/api/market/warehouses')
        const data = await response.json()
        if (data.success && data.data?.warehouses) {
          setWarehouses(data.data.warehouses)
          if (data.data.warehouses.length > 0) {
            setSelectedWarehouse(data.data.warehouses[0].id)
          }
        } else if (data.success && Array.isArray(data.data)) {
          setWarehouses(data.data)
          if (data.data.length > 0) {
            setSelectedWarehouse(data.data[0].id)
          }
        }
      } catch (error) {
        console.error('Error loading warehouses:', error)
      }
    }

    loadOrders()
    loadWarehouses()
  }, [])

  // Load order details
  const loadOrderDetails = async (order: ConsignmentOrder) => {
    setSelectedOrder(order)
    setLoadingItems(true)
    try {
      const response = await fetch(`/api/consignments/orders/${order.id}`)
      const data = await response.json()
      if (data.success) {
        setOrderItems(data.data.items || [])
      }
    } catch (error) {
      console.error('Error loading order details:', error)
    } finally {
      setLoadingItems(false)
    }
  }

  // Approve order
  const handleApprove = async () => {
    if (!selectedOrder) return
    setProcessing(true)
    try {
      const response = await fetch(`/api/consignments/orders/${selectedOrder.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverNotes: receiverNotes || null
        })
      })
      const data = await response.json()
      if (data.success) {
        setShowApproveModal(false)
        setPendingOrders(prev => prev.filter(o => o.id !== selectedOrder.id))
        setSelectedOrder(null)
        setOrderItems([])
        setReceiverNotes('')
      }
    } catch (error) {
      console.error('Error approving order:', error)
    } finally {
      setProcessing(false)
    }
  }

  // Reject order
  const handleReject = async () => {
    if (!selectedOrder || !rejectionReason.trim()) return
    setProcessing(true)
    try {
      const response = await fetch(`/api/consignments/orders/${selectedOrder.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rejectionReason,
          receiverNotes: receiverNotes || null
        })
      })
      const data = await response.json()
      if (data.success) {
        setShowRejectModal(false)
        setPendingOrders(prev => prev.filter(o => o.id !== selectedOrder.id))
        setSelectedOrder(null)
        setOrderItems([])
        setRejectionReason('')
        setReceiverNotes('')
      }
    } catch (error) {
      console.error('Error rejecting order:', error)
    } finally {
      setProcessing(false)
    }
  }

  // Receive order
  const handleReceive = async () => {
    if (!selectedOrder || !selectedWarehouse) return
    setProcessing(true)
    try {
      const response = await fetch(`/api/consignments/orders/${selectedOrder.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverWarehouseId: selectedWarehouse,
          receiverNotes: receiverNotes || null
        })
      })
      const data = await response.json()
      if (data.success) {
        setShowReceiveModal(false)
        setInTransitOrders(prev => prev.filter(o => o.id !== selectedOrder.id))
        setSelectedOrder(null)
        setOrderItems([])
        setReceiverNotes('')
      }
    } catch (error) {
      console.error('Error receiving order:', error)
    } finally {
      setProcessing(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  return (
    <ProtectedRoute requiredRole={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER']}>
      <DashboardLayout>
        <div className={cn(
          "min-h-screen py-6 px-4 sm:px-6 lg:px-8",
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
        )}>
          <div className="max-w-7xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-center gap-4">
              <Link href="/dashboard/market/consignments">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'p-2 rounded-lg',
                    theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                  )}
                >
                  <ArrowLeft className="w-5 h-5" />
                </motion.button>
              </Link>
              <div>
                <h1 className={cn(
                  "text-2xl sm:text-3xl font-bold",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Consignaciones Pendientes
                </h1>
                <p className={cn(
                  "text-sm mt-1",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  Revisa, aprueba y recibe las consignaciones enviadas por otros mercados
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className={cn(
              'flex rounded-xl p-1',
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
            )}>
              <button
                onClick={() => { setActiveTab('pending_approval'); setSelectedOrder(null); }}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all',
                  activeTab === 'pending_approval'
                    ? 'bg-amber-500 text-white shadow-lg'
                    : theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <Clock className="w-5 h-5" />
                Pendientes de Aprobación
                {pendingOrders.length > 0 && (
                  <span className={cn(
                    'px-2 py-0.5 text-xs rounded-full',
                    activeTab === 'pending_approval'
                      ? 'bg-white/20 text-white'
                      : 'bg-amber-500 text-white'
                  )}>
                    {pendingOrders.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setActiveTab('in_transit'); setSelectedOrder(null); }}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all',
                  activeTab === 'in_transit'
                    ? 'bg-blue-500 text-white shadow-lg'
                    : theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <Truck className="w-5 h-5" />
                En Tránsito
                {inTransitOrders.length > 0 && (
                  <span className={cn(
                    'px-2 py-0.5 text-xs rounded-full',
                    activeTab === 'in_transit'
                      ? 'bg-white/20 text-white'
                      : 'bg-blue-500 text-white'
                  )}>
                    {inTransitOrders.length}
                  </span>
                )}
              </button>
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              </div>
            ) : currentOrders.length === 0 ? (
              <div className={cn(
                'text-center py-20 rounded-2xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
              )}>
                {activeTab === 'pending_approval' ? (
                  <>
                    <CheckCircle className={cn('w-16 h-16 mx-auto mb-4', 'text-green-500')} />
                    <p className={cn('text-lg font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      No hay consignaciones pendientes de aprobación
                    </p>
                    <p className={cn('text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                      Todas las consignaciones han sido revisadas
                    </p>
                  </>
                ) : (
                  <>
                    <Truck className={cn('w-16 h-16 mx-auto mb-4', theme === 'dark' ? 'text-gray-600' : 'text-gray-400')} />
                    <p className={cn('text-lg font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      No hay consignaciones en tránsito
                    </p>
                    <p className={cn('text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                      Cuando un proveedor envíe una consignación aprobada, aparecerá aquí
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Orders List */}
                <div className="space-y-4">
                  <h2 className={cn('font-semibold', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    {currentOrders.length} consignaciones {activeTab === 'pending_approval' ? 'pendientes' : 'en tránsito'}
                  </h2>
                  {currentOrders.map((order, index) => (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => loadOrderDetails(order)}
                      className={cn(
                        'p-5 rounded-xl border cursor-pointer transition-all',
                        selectedOrder?.id === order.id
                          ? theme === 'dark'
                            ? 'bg-purple-900/30 border-purple-500'
                            : 'bg-purple-50 border-purple-300'
                          : theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 hover:border-purple-500/50'
                            : 'bg-white border-gray-200 hover:border-purple-300'
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          'w-12 h-12 rounded-xl flex items-center justify-center',
                          activeTab === 'pending_approval'
                            ? 'bg-gradient-to-br from-amber-500 to-amber-600'
                            : 'bg-gradient-to-br from-blue-500 to-blue-600'
                        )}>
                          {activeTab === 'pending_approval' ? (
                            <Clock className="w-6 h-6 text-white" />
                          ) : (
                            <Truck className="w-6 h-6 text-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {order.orderNumber}
                            </h3>
                            <span className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              ${order.subtotal.toFixed(2)}
                            </span>
                          </div>
                          <p className={cn('text-sm flex items-center gap-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                            <Store className="w-4 h-4" />
                            {order.provider.name}
                          </p>
                          <div className={cn('flex items-center gap-4 mt-2 text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                            <span className="flex items-center gap-1">
                              <Package className="w-4 h-4" />
                              {order.itemCount} productos
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {formatDate(order.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Order Detail */}
                <div className={cn(
                  'rounded-2xl border p-6 sticky top-6',
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}>
                  {!selectedOrder ? (
                    <div className="text-center py-12">
                      <Eye className={cn('w-12 h-12 mx-auto mb-4', theme === 'dark' ? 'text-gray-600' : 'text-gray-400')} />
                      <p className={cn('text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                        Selecciona una consignación para ver los detalles
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Provider Info */}
                      <div className={cn('p-4 rounded-xl', theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50')}>
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                            <Store className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <p className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {selectedOrder.provider.name}
                            </p>
                            {selectedOrder.provider.phone && (
                              <p className={cn('text-sm flex items-center gap-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                                <Phone className="w-3 h-3" />{selectedOrder.provider.phone}
                              </p>
                            )}
                          </div>
                        </div>
                        {selectedOrder.providerNotes && (
                          <div className={cn('mt-3 p-3 rounded-lg', theme === 'dark' ? 'bg-gray-800' : 'bg-white')}>
                            <p className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                              <span className="font-medium">Notas:</span> {selectedOrder.providerNotes}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Status Badge */}
                      <div className={cn(
                        'p-3 rounded-xl flex items-center gap-3',
                        activeTab === 'pending_approval'
                          ? theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-50'
                          : theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50'
                      )}>
                        {activeTab === 'pending_approval' ? (
                          <>
                            <Clock className={cn('w-5 h-5', theme === 'dark' ? 'text-amber-400' : 'text-amber-600')} />
                            <span className={cn('text-sm font-medium', theme === 'dark' ? 'text-amber-300' : 'text-amber-700')}>
                              Esperando tu aprobación
                            </span>
                          </>
                        ) : (
                          <>
                            <Truck className={cn('w-5 h-5', theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
                            <span className={cn('text-sm font-medium', theme === 'dark' ? 'text-blue-300' : 'text-blue-700')}>
                              En camino - Listo para recibir
                            </span>
                          </>
                        )}
                      </div>

                      {/* Products */}
                      <div>
                        <h3 className={cn('font-semibold mb-3', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          Productos ({selectedOrder.itemCount})
                        </h3>
                        {loadingItems ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-64 overflow-y-auto">
                            {orderItems.map((item) => (
                              <div key={item.id} className={cn('flex items-center gap-3 p-3 rounded-lg', theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50')}>
                                {item.product.imageUrl ? (
                                  <img src={item.product.imageUrl} alt={item.product.name} className="w-10 h-10 rounded-lg object-cover" />
                                ) : (
                                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')}>
                                    <Package className="w-5 h-5 text-gray-400" />
                                  </div>
                                )}
                                <div className="flex-1">
                                  <p className={cn('font-medium text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{item.product.name}</p>
                                  <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                    x{item.quantity} @ ${item.providerPrice.toFixed(2)}
                                  </p>
                                </div>
                                <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                  ${item.subtotal.toFixed(2)}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Summary */}
                      <div className={cn('p-4 rounded-xl', theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50')}>
                        <div className="flex justify-between items-center">
                          <span className={cn('font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Total a pagar:</span>
                          <span className={cn('text-xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            ${selectedOrder.subtotal.toFixed(2)}
                          </span>
                        </div>
                        <p className={cn('text-xs mt-1', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                          Este monto se acumulará en tu saldo con el proveedor
                        </p>
                      </div>

                      {/* Warehouse Selection - Only for in_transit orders */}
                      {activeTab === 'in_transit' && (
                        <div>
                          <label className={cn('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                            Almacén de Destino
                          </label>
                          <select
                            value={selectedWarehouse || ''}
                            onChange={(e) => setSelectedWarehouse(parseInt(e.target.value))}
                            className={cn(
                              'w-full px-4 py-3 rounded-xl border',
                              theme === 'dark'
                                ? 'bg-gray-900/50 border-gray-600 text-white'
                                : 'bg-gray-50 border-gray-200 text-gray-900'
                            )}
                          >
                            {warehouses.map(wh => (
                              <option key={wh.id} value={wh.id}>{wh.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-3">
                        {activeTab === 'pending_approval' ? (
                          <>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setShowRejectModal(true)}
                              className={cn(
                                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium',
                                theme === 'dark'
                                  ? 'bg-red-900/30 text-red-400 border border-red-500/30'
                                  : 'bg-red-50 text-red-600 border border-red-200'
                              )}
                            >
                              <XCircle className="w-5 h-5" />
                              Rechazar
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setShowApproveModal(true)}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg"
                            >
                              <CheckCircle className="w-5 h-5" />
                              Aprobar
                            </motion.button>
                          </>
                        ) : (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowReceiveModal(true)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg"
                          >
                            <PackageCheck className="w-5 h-5" />
                            Recibir en Almacén
                          </motion.button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Approve Modal */}
          <AnimatePresence>
            {showApproveModal && selectedOrder && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowApproveModal(false)}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                >
                  <div className={cn('w-full max-w-md rounded-2xl shadow-xl', theme === 'dark' ? 'bg-gray-800' : 'bg-white')} onClick={(e) => e.stopPropagation()}>
                    <div className={cn('p-6 border-b', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <h3 className={cn('text-xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            Aprobar Consignación
                          </h3>
                          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                            {selectedOrder.orderNumber}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <p className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        Al aprobar, los productos se importarán a tu catálogo. El proveedor recibirá la notificación y podrá marcar la consignación como enviada.
                      </p>
                      <div className={cn('p-3 rounded-lg', theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50')}>
                        <p className={cn('text-sm', theme === 'dark' ? 'text-blue-300' : 'text-blue-700')}>
                          <strong>Nota:</strong> El stock se agregará a tu inventario cuando recibas la mercancía en tu almacén.
                        </p>
                      </div>
                      <div>
                        <label className={cn('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          Notas (opcional)
                        </label>
                        <textarea
                          value={receiverNotes}
                          onChange={(e) => setReceiverNotes(e.target.value)}
                          placeholder="Agregar notas..."
                          rows={2}
                          className={cn('w-full px-4 py-2 rounded-lg border resize-none', theme === 'dark' ? 'bg-gray-900 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900')}
                        />
                      </div>
                    </div>
                    <div className={cn('p-6 border-t flex gap-3', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                      <button
                        onClick={() => setShowApproveModal(false)}
                        className={cn('flex-1 px-4 py-3 rounded-xl font-medium', theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700')}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleApprove}
                        disabled={processing}
                        className="flex-1 px-4 py-3 rounded-xl font-medium bg-green-600 text-white disabled:opacity-50"
                      >
                        {processing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Aprobar'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Reject Modal */}
          <AnimatePresence>
            {showRejectModal && selectedOrder && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowRejectModal(false)}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                >
                  <div className={cn('w-full max-w-md rounded-2xl shadow-xl', theme === 'dark' ? 'bg-gray-800' : 'bg-white')} onClick={(e) => e.stopPropagation()}>
                    <div className={cn('p-6 border-b', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                          <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <h3 className={cn('text-xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            Rechazar Consignación
                          </h3>
                          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                            {selectedOrder.orderNumber}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div>
                        <label className={cn('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          Motivo del rechazo *
                        </label>
                        <select
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          className={cn('w-full px-4 py-3 rounded-lg border', theme === 'dark' ? 'bg-gray-900 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900')}
                        >
                          <option value="">Selecciona un motivo</option>
                          <option value="No tengo capacidad de almacenamiento">No tengo capacidad de almacenamiento</option>
                          <option value="Precios no competitivos">Precios no competitivos</option>
                          <option value="Productos no adecuados para mi mercado">Productos no adecuados para mi mercado</option>
                          <option value="Ya tengo stock suficiente">Ya tengo stock suficiente</option>
                          <option value="Otro">Otro</option>
                        </select>
                      </div>
                      <div>
                        <label className={cn('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          Comentarios adicionales (opcional)
                        </label>
                        <textarea
                          value={receiverNotes}
                          onChange={(e) => setReceiverNotes(e.target.value)}
                          placeholder="Agregar comentarios..."
                          rows={2}
                          className={cn('w-full px-4 py-2 rounded-lg border resize-none', theme === 'dark' ? 'bg-gray-900 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900')}
                        />
                      </div>
                    </div>
                    <div className={cn('p-6 border-t flex gap-3', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                      <button
                        onClick={() => setShowRejectModal(false)}
                        className={cn('flex-1 px-4 py-3 rounded-xl font-medium', theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700')}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleReject}
                        disabled={processing || !rejectionReason}
                        className="flex-1 px-4 py-3 rounded-xl font-medium bg-red-600 text-white disabled:opacity-50"
                      >
                        {processing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Rechazar'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Receive Modal */}
          <AnimatePresence>
            {showReceiveModal && selectedOrder && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowReceiveModal(false)}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                >
                  <div className={cn('w-full max-w-md rounded-2xl shadow-xl', theme === 'dark' ? 'bg-gray-800' : 'bg-white')} onClick={(e) => e.stopPropagation()}>
                    <div className={cn('p-6 border-b', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <PackageCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className={cn('text-xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            Recibir Consignación
                          </h3>
                          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                            {selectedOrder.orderNumber}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <p className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        Al confirmar la recepción, los {selectedOrder.itemCount} productos ({selectedOrder.totalUnits} unidades) se agregarán al inventario del almacén seleccionado.
                      </p>
                      <div>
                        <label className={cn('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          Almacén de Destino
                        </label>
                        <select
                          value={selectedWarehouse || ''}
                          onChange={(e) => setSelectedWarehouse(parseInt(e.target.value))}
                          className={cn('w-full px-4 py-3 rounded-lg border', theme === 'dark' ? 'bg-gray-900 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900')}
                        >
                          {warehouses.map(wh => (
                            <option key={wh.id} value={wh.id}>{wh.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={cn('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          Notas de recepción (opcional)
                        </label>
                        <textarea
                          value={receiverNotes}
                          onChange={(e) => setReceiverNotes(e.target.value)}
                          placeholder="Ej: Recibido en buen estado, faltó 1 caja..."
                          rows={2}
                          className={cn('w-full px-4 py-2 rounded-lg border resize-none', theme === 'dark' ? 'bg-gray-900 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900')}
                        />
                      </div>
                      <div className={cn('p-4 rounded-xl', theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50')}>
                        <div className="flex justify-between items-center">
                          <span className={cn('font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Saldo pendiente:</span>
                          <span className={cn('text-xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            ${selectedOrder.subtotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className={cn('p-6 border-t flex gap-3', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                      <button
                        onClick={() => setShowReceiveModal(false)}
                        className={cn('flex-1 px-4 py-3 rounded-xl font-medium', theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700')}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleReceive}
                        disabled={processing || !selectedWarehouse}
                        className="flex-1 px-4 py-3 rounded-xl font-medium bg-blue-600 text-white disabled:opacity-50"
                      >
                        {processing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Confirmar Recepción'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
