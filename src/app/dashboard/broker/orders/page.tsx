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
  Loader2,
  ChevronDown,
  Building2
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

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

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any; gradient: string }> = {
  pending: { label: 'Pendiente', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30', icon: Clock, gradient: 'from-amber-500 to-orange-500' },
  confirmed: { label: 'Confirmada', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30', icon: CheckCircle, gradient: 'from-blue-500 to-cyan-500' },
  in_delivery: { label: 'En Entrega', color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30', icon: Truck, gradient: 'from-purple-500 to-pink-500' },
  delivered: { label: 'Entregada', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', icon: CheckCircle, gradient: 'from-emerald-500 to-teal-500' },
  cancelled: { label: 'Cancelada', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30', icon: XCircle, gradient: 'from-red-500 to-rose-500' },
  rejected: { label: 'Rechazada', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30', icon: XCircle, gradient: 'from-red-500 to-rose-500' }
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
    { value: '', label: 'Todas', count: filteredOrders.length },
    { value: 'pending', label: 'Nuevas', count: stats?.pendingCount || 0 },
    { value: 'confirmed', label: 'Listas', count: stats?.confirmedCount || 0 },
    { value: 'in_delivery', label: 'En Entrega', count: stats?.inDeliveryCount || 0 },
    { value: 'delivered', label: 'Completadas', count: stats?.deliveredCount || 0 }
  ]

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-full">
          {/* Mobile Header with Stats */}
          <div className={cn(
            "sticky top-0 z-10 -mx-3 sm:-mx-6 px-3 sm:px-6 pt-2 pb-3",
            theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
          )}>
            {/* Stats Row */}
            <div className="flex gap-2 mb-3">
              <div className={cn(
                "flex-1 p-3 rounded-xl",
                theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-50 border border-amber-200'
              )}>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{stats?.pendingCount || 0}</span>
                </div>
                <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 mt-0.5">Pendientes</p>
              </div>
              <div className={cn(
                "flex-1 p-3 rounded-xl",
                theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50 border border-blue-200'
              )}>
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-500" />
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{(stats?.confirmedCount || 0) + (stats?.inDeliveryCount || 0)}</span>
                </div>
                <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70 mt-0.5">En Proceso</p>
              </div>
              <div className={cn(
                "flex-1 p-3 rounded-xl",
                theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-50 border border-emerald-200'
              )}>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">${(stats?.pendingAmount || 0).toLocaleString()}</span>
                </div>
                <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">Por Entregar</p>
              </div>
            </div>

            {/* Search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar orden, nombre o telefono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(
                    "w-full h-10 pl-10 pr-4 rounded-xl border text-sm",
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500'
                      : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400',
                    'focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                  )}
                />
              </div>
              <button
                onClick={fetchOrders}
                disabled={loading}
                className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center",
                  theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-white border border-gray-200 text-gray-600'
                )}
              >
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              </button>
            </div>

            {/* Status Tabs - Horizontal scroll */}
            <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1 -mx-3 px-3 scrollbar-hide">
              {statusTabs.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setSelectedStatus(tab.value)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                    selectedStatus === tab.value
                      ? 'bg-blue-600 text-white'
                      : theme === 'dark'
                        ? 'bg-gray-800 text-gray-400'
                        : 'bg-white border border-gray-200 text-gray-600'
                  )}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                      selectedStatus === tab.value
                        ? 'bg-white/20 text-white'
                        : theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Orders List */}
          <div className="py-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
                <p className="text-sm text-gray-500">Cargando ordenes...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className={cn(
                "rounded-2xl p-8 text-center",
                theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200'
              )}>
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4",
                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                )}>
                  <Package className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className={cn(
                  "text-lg font-semibold mb-2",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  No hay ordenes
                </h3>
                <p className="text-sm text-gray-500">
                  {selectedStatus ? 'No hay ordenes con este estado' : 'Las ordenes apareceran aqui cuando sean asignadas'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Section Headers only when not filtering */}
                {!selectedStatus && pendingOrders.length > 0 && (
                  <div className="flex items-center gap-2 px-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className={cn(
                      "text-sm font-semibold",
                      theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                    )}>
                      Nuevas Ordenes ({pendingOrders.length})
                    </span>
                  </div>
                )}

                {/* Orders */}
                {(selectedStatus ? filteredOrders : [...pendingOrders, ...confirmedOrders, ...inDeliveryOrders]).map((order, index) => {
                  // Section dividers
                  const showConfirmedHeader = !selectedStatus && index === pendingOrders.length && confirmedOrders.length > 0
                  const showInDeliveryHeader = !selectedStatus && index === pendingOrders.length + confirmedOrders.length && inDeliveryOrders.length > 0

                  return (
                    <div key={order.id}>
                      {showConfirmedHeader && (
                        <div className="flex items-center gap-2 px-1 mt-6 mb-3">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className={cn(
                            "text-sm font-semibold",
                            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                          )}>
                            Listas para Entregar ({confirmedOrders.length})
                          </span>
                        </div>
                      )}
                      {showInDeliveryHeader && (
                        <div className="flex items-center gap-2 px-1 mt-6 mb-3">
                          <span className="w-2 h-2 rounded-full bg-purple-500" />
                          <span className={cn(
                            "text-sm font-semibold",
                            theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                          )}>
                            En Entrega ({inDeliveryOrders.length})
                          </span>
                        </div>
                      )}

                      <MobileOrderCard
                        order={order}
                        theme={theme}
                        formatCurrency={formatCurrency}
                        onAccept={order.status === 'pending' ? () => handleAction(order.id, 'accept') : undefined}
                        onReject={['pending', 'confirmed'].includes(order.status) ? () => openRejectModal(order) : undefined}
                        onDeliver={order.status === 'confirmed' ? () => goToDeliveryWizard(order.id) : undefined}
                        onComplete={order.status === 'in_delivery' ? () => goToDeliveryWizard(order.id) : undefined}
                        onDetails={() => setSelectedOrder(order)}
                      />
                    </div>
                  )
                })}

                {/* Completed Orders */}
                {!selectedStatus && completedOrders.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 px-1 mt-6 mb-3">
                      <span className="w-2 h-2 rounded-full bg-gray-400" />
                      <span className="text-sm font-semibold text-gray-500">
                        Completadas Recientemente
                      </span>
                    </div>
                    {completedOrders.slice(0, 5).map((order) => (
                      <MobileOrderCard
                        key={order.id}
                        order={order}
                        theme={theme}
                        formatCurrency={formatCurrency}
                        onDetails={() => setSelectedOrder(order)}
                        isCompleted
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalOrders > ORDERS_PER_PAGE && !loading && (
            <div className="flex items-center justify-center gap-3 py-4">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={cn(
                  "p-3 rounded-xl disabled:opacity-30",
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200'
                )}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-medium text-gray-500">
                {currentPage} / {Math.ceil(totalOrders / ORDERS_PER_PAGE)}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalOrders / ORDERS_PER_PAGE), p + 1))}
                disabled={currentPage >= Math.ceil(totalOrders / ORDERS_PER_PAGE)}
                className={cn(
                  "p-3 rounded-xl disabled:opacity-30",
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200'
                )}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Order Detail Bottom Sheet */}
        <AnimatePresence>
          {selectedOrder && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={(e) => e.target === e.currentTarget && setSelectedOrder(null)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className={cn(
                  "absolute bottom-0 left-0 right-0 rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto",
                  theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                )}
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-2">
                  <div className={cn(
                    "w-10 h-1 rounded-full",
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'
                  )} />
                </div>

                {/* Header */}
                <div className={cn(
                  "px-4 pb-4 border-b",
                  theme === 'dark' ? 'border-gray-800' : 'border-gray-100'
                )}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          "font-bold text-lg",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
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
                      <p className="text-2xl font-bold text-emerald-500">
                        {formatCurrency(selectedOrder.receiveAmount, selectedOrder.receiveCurrency)}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedOrder(null)}
                      className={cn(
                        "p-2 rounded-xl",
                        theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                      )}
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                  {/* Recipient */}
                  <div className={cn(
                    "rounded-2xl p-4",
                    theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                  )}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                      Destinatario
                    </p>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                      )}>
                        <User className="w-6 h-6 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "font-semibold text-base truncate",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {selectedOrder.recipientName}
                        </p>
                        <a href={`tel:${selectedOrder.recipientPhone}`} className="text-blue-500 text-sm font-medium">
                          {selectedOrder.recipientPhone}
                        </a>
                      </div>
                      <a
                        href={`tel:${selectedOrder.recipientPhone}`}
                        className="p-3 rounded-xl bg-blue-500 text-white"
                      >
                        <Phone className="w-5 h-5" />
                      </a>
                    </div>

                    <div className={cn(
                      "pt-3 border-t",
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className={cn(
                            "font-medium",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {selectedOrder.recipientMunicipality}, {selectedOrder.recipientProvince}
                          </p>
                          {selectedOrder.recipientAddress && (
                            <p className="text-sm text-gray-500 mt-0.5">
                              {selectedOrder.recipientAddress}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className={cn(
                      "rounded-xl p-3",
                      theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                    )}>
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-500">Fecha</span>
                      </div>
                      <p className={cn(
                        "font-semibold text-sm",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {new Date(selectedOrder.createdAt).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                    {selectedOrder.sellingCompanyName && (
                      <div className={cn(
                        "rounded-xl p-3",
                        theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                      )}>
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="text-xs text-gray-500">Agencia</span>
                        </div>
                        <p className="font-semibold text-sm text-blue-500 truncate">
                          {selectedOrder.sellingCompanyName}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 pt-2">
                    {selectedOrder.status === 'pending' && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedOrder(null)
                            handleAction(selectedOrder.id, 'accept')
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-semibold text-white bg-blue-600 active:bg-blue-700"
                        >
                          <CheckCircle className="w-5 h-5" />
                          Aceptar Orden
                        </button>
                        <button
                          onClick={() => openRejectModal(selectedOrder)}
                          className={cn(
                            "w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-medium",
                            theme === 'dark'
                              ? 'bg-red-900/30 text-red-400'
                              : 'bg-red-50 text-red-600'
                          )}
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
                          className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-semibold text-white bg-emerald-600 active:bg-emerald-700"
                        >
                          <Navigation className="w-5 h-5" />
                          Iniciar Entrega
                        </button>
                        <button
                          onClick={() => openRejectModal(selectedOrder)}
                          className={cn(
                            "w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-medium",
                            theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                          )}
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
                        className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-semibold text-white bg-purple-600 active:bg-purple-700"
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
                        className={cn(
                          "w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-medium",
                          theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                        )}
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
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={(e) => e.target === e.currentTarget && !rejectLoading && setRejectModalOpen(false)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className={cn(
                  "absolute bottom-0 left-0 right-0 rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto",
                  theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                )}
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              >
                <div className="flex justify-center pt-3 pb-2">
                  <div className={cn(
                    "w-10 h-1 rounded-full",
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'
                  )} />
                </div>

                <div className={cn(
                  "px-4 pb-4 border-b",
                  theme === 'dark' ? 'border-gray-800' : 'border-gray-100'
                )}>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-3 rounded-xl",
                      theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
                    )}>
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <h3 className={cn(
                        "text-lg font-bold",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        Rechazar Orden
                      </h3>
                      <p className="text-sm text-gray-500">{rejectingOrder.orderNumber}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  <p className="text-sm text-gray-500">
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
                            'w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left',
                            selectedReason === reason.value
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : theme === 'dark'
                                ? 'border-gray-700 bg-gray-800'
                                : 'border-gray-200 bg-white'
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
                              : theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
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
                      className={cn(
                        "w-full px-4 py-3 rounded-xl border text-sm",
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500'
                          : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400',
                        'focus:ring-2 focus:ring-red-500 focus:border-transparent'
                      )}
                    />
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setRejectModalOpen(false)}
                      disabled={rejectLoading}
                      className={cn(
                        "flex-1 px-4 py-4 rounded-xl font-medium disabled:opacity-50",
                        theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                      )}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={!selectedReason || rejectLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-4 rounded-xl font-semibold text-white bg-red-600 disabled:opacity-50"
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
              className="fixed bottom-6 left-4 right-4 bg-emerald-600 text-white px-5 py-4 rounded-2xl shadow-xl flex items-center gap-3 z-50"
              style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
            >
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium flex-1">{successMessage}</span>
              <button onClick={() => setSuccessMessage(null)} className="p-1">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </DashboardLayout>
    </ProtectedRoute>
  )
}

// Mobile-First Order Card Component
function MobileOrderCard({
  order,
  theme,
  formatCurrency,
  onAccept,
  onReject,
  onDeliver,
  onComplete,
  onDetails,
  isCompleted = false
}: {
  order: Order
  theme: string
  formatCurrency: (amount: number, currency: string) => string
  onAccept?: () => void
  onReject?: () => void
  onDeliver?: () => void
  onComplete?: () => void
  onDetails: () => void
  isCompleted?: boolean
}) {
  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
  const StatusIcon = statusConfig.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-2xl overflow-hidden",
        theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200',
        isCompleted && 'opacity-60'
      )}
    >
      {/* Top colored bar based on status */}
      <div className={cn(
        "h-1 bg-gradient-to-r",
        statusConfig.gradient
      )} />

      <div className="p-4">
        {/* Row 1: Order # + Amount */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-bold",
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              {order.orderNumber}
            </span>
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold',
              statusConfig.bgColor, statusConfig.color
            )}>
              <StatusIcon className="w-3 h-3" />
              {statusConfig.label}
            </span>
          </div>
          <span className="text-lg font-bold text-emerald-500">
            {formatCurrency(order.receiveAmount, order.receiveCurrency)}
          </span>
        </div>

        {/* Row 2: Recipient Info */}
        <div className={cn(
          "rounded-xl p-3 mb-3",
          theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
            )}>
              <User className="w-5 h-5 text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "font-semibold truncate",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {order.recipientName}
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{order.recipientMunicipality}, {order.recipientProvince}</span>
              </div>
            </div>
            <a
              href={`tel:${order.recipientPhone}`}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "p-2.5 rounded-xl flex-shrink-0",
                theme === 'dark' ? 'bg-blue-600' : 'bg-blue-500',
                'text-white'
              )}
            >
              <Phone className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Row 3: Meta info */}
        <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {new Date(order.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
            </span>
          </div>
          {order.sellingCompanyName && (
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate text-blue-500">{order.sellingCompanyName}</span>
            </div>
          )}
        </div>

        {/* Row 4: Actions */}
        {!isCompleted && (
          <div className="flex gap-2">
            {onAccept && (
              <button
                onClick={onAccept}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-white bg-blue-600 active:bg-blue-700"
              >
                <CheckCircle className="w-4 h-4" />
                Aceptar
              </button>
            )}

            {onDeliver && (
              <button
                onClick={onDeliver}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-white bg-emerald-600 active:bg-emerald-700"
              >
                <Navigation className="w-4 h-4" />
                Entregar
              </button>
            )}

            {onComplete && (
              <button
                onClick={onComplete}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-white bg-purple-600 active:bg-purple-700"
              >
                <CheckCircle className="w-4 h-4" />
                Completar
              </button>
            )}

            {onReject && (
              <button
                onClick={onReject}
                className={cn(
                  "p-3 rounded-xl",
                  theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                )}
              >
                <XCircle className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={onDetails}
              className={cn(
                "p-3 rounded-xl",
                theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
              )}
            >
              <Eye className="w-5 h-5" />
            </button>
          </div>
        )}

        {isCompleted && (
          <button
            onClick={onDetails}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium",
              theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
            )}
          >
            <Eye className="w-4 h-4" />
            Ver Detalles
          </button>
        )}
      </div>
    </motion.div>
  )
}
