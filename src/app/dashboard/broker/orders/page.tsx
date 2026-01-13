'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  MapPin,
  Phone,
  User,
  Truck,
  Search,
  RefreshCw,
  AlertTriangle,
  Banknote,
  MapPinOff,
  UserX,
  FileWarning,
  CalendarX,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  DollarSign,
  X,
  Navigation,
  Calendar,
  Loader2
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { Button } from '@/components/ui/button'

const REJECTION_REASONS = [
  { value: 'insufficient_funds', label: 'Sin fondos suficientes', icon: Banknote },
  { value: 'out_of_coverage', label: 'Fuera de cobertura', icon: MapPinOff },
  { value: 'recipient_unreachable', label: 'Destinatario no localizable', icon: UserX },
  { value: 'invalid_information', label: 'Informacion incorrecta', icon: FileWarning },
  { value: 'schedule_conflict', label: 'Conflicto de horario', icon: CalendarX },
  { value: 'other', label: 'Otro motivo', icon: HelpCircle }
]

interface Order {
  id: number
  orderNumber: string
  status: string
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  recipientProvince: string
  recipientMunicipality: string
  recipientNeighborhood?: string
  receiveAmount: number
  receiveCurrency: string
  estimatedDelivery: string
  createdAt: string
  confirmedAt: string | null
  deliveredAt: string | null
  sellingCompanyName?: string
}

interface Stats {
  pendingCount: number
  confirmedCount: number
  inDeliveryCount: number
  deliveredCount: number
  pendingAmount: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  pending: { label: 'Pendiente', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', icon: Clock },
  confirmed: { label: 'Confirmada', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30', icon: CheckCircle },
  in_delivery: { label: 'En Entrega', color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30', icon: Truck },
  delivered: { label: 'Entregada', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircle },
  cancelled: { label: 'Cancelada', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30', icon: XCircle },
  rejected: { label: 'Rechazada', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30', icon: XCircle }
}

export default function BrokerOrdersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { theme } = useTheme()

  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')

  const [currentPage, setCurrentPage] = useState(1)
  const [totalOrders, setTotalOrders] = useState(0)
  const ORDERS_PER_PAGE = 20

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectingOrder, setRejectingOrder] = useState<Order | null>(null)
  const [selectedReason, setSelectedReason] = useState<string>('')
  const [rejectNotes, setRejectNotes] = useState('')
  const [rejectLoading, setRejectLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    const success = searchParams.get('success')
    if (success === 'delivery') {
      setSuccessMessage('Entrega completada exitosamente')
      router.replace('/dashboard/broker/orders')
      setTimeout(() => setSuccessMessage(null), 5000)
    }
  }, [searchParams, router])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedStatus])

  useEffect(() => {
    fetchOrders()
  }, [currentPage, selectedStatus])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: ORDERS_PER_PAGE.toString()
      })
      if (selectedStatus) params.append('status', selectedStatus)
      if (searchTerm) params.append('search', searchTerm)

      const response = await fetch(`/api/broker/orders?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setOrders(data.data.orders || [])
          setStats(data.data.stats)
          setTotalOrders(data.data.pagination?.total || 0)
        }
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (orderId: number, action: string) => {
    try {
      const response = await fetch('/api/broker/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, action })
      })

      const data = await response.json()
      if (data.success) {
        if (action === 'accept') {
          router.push(`/dashboard/broker/orders/${orderId}/deliver`)
        } else {
          fetchOrders()
        }
      } else {
        alert(data.error || 'Error al procesar la accion')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al procesar la accion')
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === 'CUP') {
      return `${amount.toLocaleString()} CUP`
    }
    return `$${amount.toFixed(2)}`
  }

  const openRejectModal = (order: Order) => {
    setRejectingOrder(order)
    setSelectedReason('')
    setRejectNotes('')
    setRejectModalOpen(true)
    setSelectedOrder(null)
  }

  const handleReject = async () => {
    if (!rejectingOrder || !selectedReason) return
    if (selectedReason === 'other' && !rejectNotes.trim()) {
      alert('Por favor especifique el motivo en las notas')
      return
    }

    setRejectLoading(true)
    try {
      const response = await fetch('/api/broker/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: rejectingOrder.id,
          action: 'reject',
          rejectionReason: selectedReason,
          notes: rejectNotes || undefined
        })
      })

      const data = await response.json()
      if (data.success) {
        setSuccessMessage('Orden rechazada')
        setRejectModalOpen(false)
        fetchOrders()
        setTimeout(() => setSuccessMessage(null), 5000)
      } else {
        alert(data.error || 'Error al rechazar la orden')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al rechazar la orden')
    } finally {
      setRejectLoading(false)
    }
  }

  const goToDeliveryWizard = (orderId: number) => {
    router.push(`/dashboard/broker/orders/${orderId}/deliver`)
  }

  const filteredOrders = orders.filter(order => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      order.orderNumber.toLowerCase().includes(search) ||
      order.recipientName.toLowerCase().includes(search) ||
      order.recipientPhone.includes(search)
    )
  })

  const pendingOrders = filteredOrders.filter(o => o.status === 'pending')
  const confirmedOrders = filteredOrders.filter(o => o.status === 'confirmed')
  const inDeliveryOrders = filteredOrders.filter(o => o.status === 'in_delivery')
  const completedOrders = filteredOrders.filter(o => ['delivered', 'cancelled', 'rejected'].includes(o.status))

  const statusTabs = [
    { value: '', label: 'Todas' },
    { value: 'pending', label: 'Pendientes' },
    { value: 'confirmed', label: 'Confirmadas' },
    { value: 'in_delivery', label: 'En Entrega' },
    { value: 'delivered', label: 'Completadas' }
  ]

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 sm:p-4">
              <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-amber-500">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{stats?.pendingCount || 0}</p>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Pendientes</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 sm:p-4">
              <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-blue-500">
                  <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{(stats?.confirmedCount || 0) + (stats?.inDeliveryCount || 0)}</p>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">En Proceso</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 sm:p-4">
              <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-emerald-500">
                  <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">${(stats?.pendingAmount || 0).toLocaleString()}</p>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Por Entregar</p>
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 sm:p-4 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar orden..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={fetchOrders}
                disabled={loading}
                className="h-10 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                <span className="hidden sm:inline">Actualizar</span>
              </button>
            </div>

            {/* Status Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {statusTabs.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setSelectedStatus(tab.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                    selectedStatus === tab.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Orders List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-12 text-center">
              <Package className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                No hay ordenes
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {selectedStatus ? 'No hay ordenes con este estado' : 'Las ordenes apareceran aqui cuando sean asignadas'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Pending Orders */}
              {pendingOrders.length > 0 && !selectedStatus && (
                <div>
                  <h2 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    Nuevas Ordenes ({pendingOrders.length})
                  </h2>
                  <div className="space-y-2 sm:space-y-3">
                    {pendingOrders.map((order, index) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        index={index}
                        theme={theme}
                        formatCurrency={formatCurrency}
                        onAccept={() => handleAction(order.id, 'accept')}
                        onReject={() => openRejectModal(order)}
                        onDetails={() => setSelectedOrder(order)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Confirmed Orders */}
              {confirmedOrders.length > 0 && !selectedStatus && (
                <div>
                  <h2 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    Listas para Entregar ({confirmedOrders.length})
                  </h2>
                  <div className="space-y-2 sm:space-y-3">
                    {confirmedOrders.map((order, index) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        index={index}
                        theme={theme}
                        formatCurrency={formatCurrency}
                        onDeliver={() => goToDeliveryWizard(order.id)}
                        onReject={() => openRejectModal(order)}
                        onDetails={() => setSelectedOrder(order)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* In Delivery Orders */}
              {inDeliveryOrders.length > 0 && !selectedStatus && (
                <div>
                  <h2 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    En Entrega ({inDeliveryOrders.length})
                  </h2>
                  <div className="space-y-2 sm:space-y-3">
                    {inDeliveryOrders.map((order, index) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        index={index}
                        theme={theme}
                        formatCurrency={formatCurrency}
                        onComplete={() => goToDeliveryWizard(order.id)}
                        onDetails={() => setSelectedOrder(order)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Filtered Results (when status is selected) */}
              {selectedStatus && (
                <div className="space-y-2 sm:space-y-3">
                  {filteredOrders.map((order, index) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      index={index}
                      theme={theme}
                      formatCurrency={formatCurrency}
                      onAccept={order.status === 'pending' ? () => handleAction(order.id, 'accept') : undefined}
                      onReject={['pending', 'confirmed'].includes(order.status) ? () => openRejectModal(order) : undefined}
                      onDeliver={order.status === 'confirmed' ? () => goToDeliveryWizard(order.id) : undefined}
                      onComplete={order.status === 'in_delivery' ? () => goToDeliveryWizard(order.id) : undefined}
                      onDetails={() => setSelectedOrder(order)}
                    />
                  ))}
                </div>
              )}

              {/* Completed Orders */}
              {completedOrders.length > 0 && !selectedStatus && (
                <div className="mt-8">
                  <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                    Completadas Recientemente
                  </h2>
                  <div className="space-y-3">
                    {completedOrders.slice(0, 5).map((order) => {
                      const statusConfig = STATUS_CONFIG[order.status]
                      const StatusIcon = statusConfig?.icon || CheckCircle

                      return (
                        <div
                          key={order.id}
                          onClick={() => setSelectedOrder(order)}
                          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 opacity-70 cursor-pointer hover:opacity-100 transition-opacity"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-3 mb-1">
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  {order.orderNumber}
                                </span>
                                <span className={cn(
                                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                                  statusConfig?.bgColor, statusConfig?.color
                                )}>
                                  <StatusIcon className="h-3 w-3" />
                                  {statusConfig?.label}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {formatCurrency(order.receiveAmount, order.receiveCurrency)} • {order.recipientName}
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

          {/* Pagination */}
          {totalOrders > ORDERS_PER_PAGE && !loading && (
            <div className="flex items-center justify-center gap-3 py-4">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800 disabled:opacity-30"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {currentPage} / {Math.ceil(totalOrders / ORDERS_PER_PAGE)}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalOrders / ORDERS_PER_PAGE), p + 1))}
                disabled={currentPage >= Math.ceil(totalOrders / ORDERS_PER_PAGE)}
                className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800 disabled:opacity-30"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Order Detail Modal */}
        <AnimatePresence>
          {selectedOrder && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 sm:flex sm:items-center sm:justify-center sm:p-4 bg-black/50 backdrop-blur-sm"
              onClick={(e) => e.target === e.currentTarget && setSelectedOrder(null)}
            >
              <motion.div
                initial={{ y: '100%', opacity: 1 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 1 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="absolute bottom-0 left-0 right-0 sm:relative sm:bottom-auto bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              >
                {/* Handle bar - mobile only */}
                <div className="sm:hidden flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
                </div>

                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-lg text-gray-900 dark:text-white">
                        {selectedOrder.orderNumber}
                      </span>
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                        STATUS_CONFIG[selectedOrder.status]?.bgColor,
                        STATUS_CONFIG[selectedOrder.status]?.color
                      )}>
                        {STATUS_CONFIG[selectedOrder.status]?.label}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(selectedOrder.receiveAmount, selectedOrder.receiveCurrency)}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-4 sm:p-5 space-y-4">
                  {/* Recipient Info */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Destinatario
                    </h4>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 dark:text-white">{selectedOrder.recipientName}</p>
                        <a href={`tel:${selectedOrder.recipientPhone}`} className="text-blue-500 text-sm">
                          {selectedOrder.recipientPhone}
                        </a>
                      </div>
                      <a
                        href={`tel:${selectedOrder.recipientPhone}`}
                        className="p-2.5 rounded-full bg-blue-500 text-white"
                      >
                        <Phone className="w-5 h-5" />
                      </a>
                    </div>
                    <div className="flex items-start gap-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {selectedOrder.recipientMunicipality}, {selectedOrder.recipientProvince}
                        </p>
                        {selectedOrder.recipientAddress && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">{selectedOrder.recipientAddress}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Date and Company */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Fecha</p>
                      <p className="font-medium text-gray-900 dark:text-white mt-0.5">
                        {new Date(selectedOrder.createdAt).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                    {selectedOrder.sellingCompanyName && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Agencia</p>
                        <p className="font-medium text-blue-600 dark:text-blue-400 mt-0.5 truncate">
                          {selectedOrder.sellingCompanyName}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-2">
                    {selectedOrder.status === 'pending' && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedOrder(null)
                            handleAction(selectedOrder.id, 'accept')
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors min-h-[48px]"
                        >
                          <CheckCircle className="w-5 h-5" />
                          Aceptar Orden
                        </button>
                        <button
                          onClick={() => openRejectModal(selectedOrder)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-medium text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors min-h-[48px]"
                        >
                          <XCircle className="w-5 h-5" />
                          Rechazar
                        </button>
                      </>
                    )}

                    {selectedOrder.status === 'confirmed' && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedOrder(null)
                            goToDeliveryWizard(selectedOrder.id)
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors min-h-[48px]"
                        >
                          <Navigation className="w-5 h-5" />
                          Iniciar Entrega
                        </button>
                        <button
                          onClick={() => openRejectModal(selectedOrder)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors min-h-[48px]"
                        >
                          Cancelar Orden
                        </button>
                      </>
                    )}

                    {selectedOrder.status === 'in_delivery' && (
                      <button
                        onClick={() => {
                          setSelectedOrder(null)
                          goToDeliveryWizard(selectedOrder.id)
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-colors min-h-[48px]"
                      >
                        <CheckCircle className="w-5 h-5" />
                        Completar Entrega
                      </button>
                    )}

                    {['delivered', 'cancelled', 'rejected'].includes(selectedOrder.status) && (
                      <button
                        onClick={() => {
                          setSelectedOrder(null)
                          router.push(`/dashboard/broker/orders/${selectedOrder.id}`)
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors min-h-[48px]"
                      >
                        <Eye className="w-5 h-5" />
                        Ver Detalles Completos
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reject Modal */}
        <AnimatePresence>
          {rejectModalOpen && rejectingOrder && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 sm:flex sm:items-center sm:justify-center sm:p-4 bg-black/50 backdrop-blur-sm"
              onClick={(e) => e.target === e.currentTarget && !rejectLoading && setRejectModalOpen(false)}
            >
              <motion.div
                initial={{ y: '100%', opacity: 1 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 1 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="absolute bottom-0 left-0 right-0 sm:relative sm:bottom-auto bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              >
                <div className="sm:hidden flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
                </div>

                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30">
                      <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">Rechazar Orden</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{rejectingOrder.orderNumber}</p>
                    </div>
                  </div>
                  {!rejectLoading && (
                    <button
                      onClick={() => setRejectModalOpen(false)}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  )}
                </div>

                <div className="p-4 sm:p-5 space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Seleccione el motivo del rechazo:
                  </p>

                  <div className="space-y-2">
                    {REJECTION_REASONS.map((reason) => {
                      const Icon = reason.icon
                      return (
                        <button
                          key={reason.value}
                          onClick={() => setSelectedReason(reason.value)}
                          className={cn(
                            'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                            selectedReason === reason.value
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                          )}
                        >
                          <Icon className={cn(
                            'w-5 h-5 flex-shrink-0',
                            selectedReason === reason.value ? 'text-red-500' : 'text-gray-400'
                          )} />
                          <span className={cn(
                            'font-medium',
                            selectedReason === reason.value
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-gray-700 dark:text-gray-300'
                          )}>
                            {reason.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {selectedReason === 'other' && (
                    <textarea
                      value={rejectNotes}
                      onChange={(e) => setRejectNotes(e.target.value)}
                      rows={3}
                      placeholder="Especifique el motivo..."
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setRejectModalOpen(false)}
                      disabled={rejectLoading}
                      className="flex-1 px-4 py-3.5 rounded-xl font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={!selectedReason || rejectLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {rejectLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <XCircle className="w-5 h-5" />
                          Confirmar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Toast */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-auto bg-emerald-600 text-white px-5 py-4 rounded-xl shadow-xl flex items-center gap-3 z-50"
              style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
            >
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">{successMessage}</span>
              <button onClick={() => setSuccessMessage(null)} className="p-1 ml-2">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </DashboardLayout>
    </ProtectedRoute>
  )
}

// Order Card Component
function OrderCard({
  order,
  index,
  theme,
  formatCurrency,
  onAccept,
  onReject,
  onDeliver,
  onComplete,
  onDetails
}: {
  order: Order
  index: number
  theme: string
  formatCurrency: (amount: number, currency: string) => string
  onAccept?: () => void
  onReject?: () => void
  onDeliver?: () => void
  onComplete?: () => void
  onDetails: () => void
}) {
  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
  const StatusIcon = statusConfig.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:gap-4">
        {/* Header: Order number + Status + Amount */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm sm:text-base text-gray-900 dark:text-white">
                {order.orderNumber}
              </span>
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                statusConfig.bgColor, statusConfig.color
              )}>
                <StatusIcon className="h-3 w-3" />
                {statusConfig.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {order.recipientName} • {order.recipientMunicipality}
            </p>
          </div>
          <div className="text-right">
            <span className="font-bold text-base sm:text-lg text-emerald-600 dark:text-emerald-400">
              {formatCurrency(order.receiveAmount, order.receiveCurrency)}
            </span>
          </div>
        </div>

        {/* Details - Only visible on larger screens */}
        <div className="hidden sm:grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <a href={`tel:${order.recipientPhone}`} className="text-blue-500 truncate">
              {order.recipientPhone}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-gray-500 dark:text-gray-400">
              {new Date(order.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
            </span>
          </div>
          {order.sellingCompanyName && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-blue-500 truncate">{order.sellingCompanyName}</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {onAccept && (
            <button
              onClick={onAccept}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors min-h-[44px]"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Aceptar</span>
            </button>
          )}

          {onDeliver && (
            <button
              onClick={onDeliver}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors min-h-[44px]"
            >
              <Navigation className="w-4 h-4" />
              <span>Entregar</span>
            </button>
          )}

          {onComplete && (
            <button
              onClick={onComplete}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-colors min-h-[44px]"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Completar</span>
            </button>
          )}

          {onReject && (
            <button
              onClick={onReject}
              className="p-2.5 sm:p-3 rounded-xl text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors min-h-[44px]"
            >
              <XCircle className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={onDetails}
            className="p-2.5 sm:p-3 rounded-xl text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors min-h-[44px] sm:hidden"
          >
            <Eye className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
