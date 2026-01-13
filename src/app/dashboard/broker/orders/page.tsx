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
  ChevronDown,
  Navigation,
  Calendar
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { Button } from '@/components/ui/button'

// Rejection reasons
const REJECTION_REASONS = [
  { value: 'insufficient_funds', label: 'Sin fondos suficientes', icon: Banknote, description: 'No tiene saldo disponible para completar esta entrega' },
  { value: 'out_of_coverage', label: 'Fuera de cobertura', icon: MapPinOff, description: 'La direccion esta fuera de su zona de cobertura' },
  { value: 'recipient_unreachable', label: 'Destinatario no localizable', icon: UserX, description: 'No se puede contactar al destinatario' },
  { value: 'invalid_information', label: 'Informacion incorrecta', icon: FileWarning, description: 'Los datos de la orden son incorrectos o incompletos' },
  { value: 'schedule_conflict', label: 'Conflicto de horario', icon: CalendarX, description: 'No puede completar la entrega en el tiempo estimado' },
  { value: 'other', label: 'Otro motivo', icon: HelpCircle, description: 'Especifique el motivo en las notas' }
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
  recipientAddressReferences?: string
  hasAlternateContact?: boolean
  alternateContactName?: string
  alternateContactPhone?: string
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

const STATUSES: Record<string, { label: string; color: string; bgColor: string; icon: typeof Clock }> = {
  pending: { label: 'Pendiente', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500', icon: Clock },
  confirmed: { label: 'Confirmada', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-500', icon: CheckCircle },
  in_delivery: { label: 'En Entrega', color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-500', icon: Truck },
  delivered: { label: 'Entregada', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500', icon: CheckCircle },
  cancelled: { label: 'Cancelada', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500', icon: XCircle },
  rejected: { label: 'Rechazada', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500', icon: XCircle }
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
  const [showSearch, setShowSearch] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalOrders, setTotalOrders] = useState(0)
  const ORDERS_PER_PAGE = 20

  // Reject modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectingOrder, setRejectingOrder] = useState<Order | null>(null)
  const [selectedReason, setSelectedReason] = useState<string>('')
  const [rejectNotes, setRejectNotes] = useState('')
  const [rejectLoading, setRejectLoading] = useState(false)

  // Order detail modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  // Success message
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Check for success param from delivery wizard
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

  const statusTabs = [
    { value: '', label: 'Todas', count: (stats?.pendingCount || 0) + (stats?.confirmedCount || 0) + (stats?.inDeliveryCount || 0) + (stats?.deliveredCount || 0), color: 'bg-gray-500' },
    { value: 'pending', label: 'Nuevas', count: stats?.pendingCount || 0, color: 'bg-amber-500' },
    { value: 'confirmed', label: 'Listas', count: stats?.confirmedCount || 0, color: 'bg-blue-500' },
    { value: 'in_delivery', label: 'En ruta', count: stats?.inDeliveryCount || 0, color: 'bg-purple-500' },
    { value: 'delivered', label: 'Completadas', count: stats?.deliveredCount || 0, color: 'bg-emerald-500' }
  ]

  return (
    <ProtectedRoute>
      <DashboardLayout>
        {/* Mobile Layout - App-like design */}
        <div className="md:hidden min-h-screen -m-3 flex flex-col">
          {/* Fixed Header */}
          <div className={cn(
            'sticky top-0 z-30 px-4 pt-2 pb-3 space-y-3',
            theme === 'dark' ? 'bg-gray-900' : 'bg-white'
          )}>
            {/* Stats Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <div className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full',
                  theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-50'
                )}>
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    ${(stats?.pendingAmount || 0).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSearch(!showSearch)}
                  className={cn(
                    'p-2 rounded-full transition-colors',
                    showSearch
                      ? 'bg-blue-600 text-white'
                      : theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
                  )}
                >
                  <Search className="w-5 h-5" />
                </button>
                <button
                  onClick={fetchOrders}
                  disabled={loading}
                  className={cn(
                    'p-2 rounded-full transition-colors',
                    theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
                  )}
                >
                  <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
                </button>
              </div>
            </div>

            {/* Search Input - Expandable */}
            <AnimatePresence>
              {showSearch && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre, telefono u orden..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      autoFocus
                      className={cn(
                        'w-full h-10 pl-10 pr-10 rounded-xl text-sm',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500',
                        theme === 'dark'
                          ? 'bg-gray-800 text-white placeholder-gray-500'
                          : 'bg-gray-100 text-gray-900 placeholder-gray-500'
                      )}
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Status Tabs - Scrollable */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
              {statusTabs.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setSelectedStatus(tab.value)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                    selectedStatus === tab.value
                      ? cn(tab.color, 'text-white shadow-lg')
                      : theme === 'dark'
                        ? 'bg-gray-800 text-gray-400'
                        : 'bg-gray-100 text-gray-600'
                  )}
                >
                  <span>{tab.label}</span>
                  <span className={cn(
                    'px-1.5 py-0.5 rounded-full text-xs font-bold min-w-[20px] text-center',
                    selectedStatus === tab.value
                      ? 'bg-white/20'
                      : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                  )}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Orders List */}
          <div className="flex-1 px-4 py-3 space-y-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
                <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  Cargando ordenes...
                </p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className={cn(
                  'w-16 h-16 rounded-full flex items-center justify-center mb-4',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                )}>
                  <Package className="w-8 h-8 text-gray-400" />
                </div>
                <p className={cn('font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  No hay ordenes
                </p>
                <p className={cn('text-sm mt-1', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                  {selectedStatus ? 'Prueba otro filtro' : 'Las ordenes apareceran aqui'}
                </p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const statusConfig = STATUSES[order.status] || STATUSES.pending

                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'rounded-2xl overflow-hidden',
                      theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm'
                    )}
                  >
                    {/* Main Card Content - Tappable */}
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="w-full text-left p-4 active:bg-black/5 dark:active:bg-white/5"
                    >
                      {/* Top Row: Amount + Status */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className={cn(
                            'text-2xl font-bold',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {formatCurrency(order.receiveAmount, order.receiveCurrency)}
                          </p>
                          <p className={cn(
                            'text-xs mt-0.5',
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          )}>
                            {order.orderNumber}
                          </p>
                        </div>
                        <div className={cn(
                          'px-3 py-1.5 rounded-full flex items-center gap-1.5',
                          statusConfig.bgColor
                        )}>
                          <statusConfig.icon className="w-3.5 h-3.5 text-white" />
                          <span className="text-xs font-semibold text-white">
                            {statusConfig.label}
                          </span>
                        </div>
                      </div>

                      {/* Recipient Info */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className={cn(
                            'font-medium truncate',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {order.recipientName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className={cn(
                            'text-sm truncate',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>
                            {order.recipientMunicipality}, {order.recipientProvince}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Row: Date + Company */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(order.createdAt).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short'
                          })}
                        </div>
                        {order.sellingCompanyName && (
                          <span className="text-xs text-blue-500 font-medium truncate max-w-[150px]">
                            {order.sellingCompanyName}
                          </span>
                        )}
                        <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90" />
                      </div>
                    </button>

                    {/* Quick Actions Bar */}
                    {(order.status === 'pending' || order.status === 'confirmed' || order.status === 'in_delivery') && (
                      <div className={cn(
                        'px-4 py-3 flex gap-2 border-t',
                        theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-100 bg-gray-50/50'
                      )}>
                        {order.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleAction(order.id, 'accept')}
                              className="flex-1 py-3 bg-blue-600 active:bg-blue-700 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Aceptar
                            </button>
                            <button
                              onClick={() => openRejectModal(order)}
                              className={cn(
                                'py-3 px-5 rounded-xl text-sm font-medium',
                                theme === 'dark'
                                  ? 'bg-gray-700 text-gray-300 active:bg-gray-600'
                                  : 'bg-gray-200 text-gray-700 active:bg-gray-300'
                              )}
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {order.status === 'confirmed' && (
                          <>
                            <button
                              onClick={() => goToDeliveryWizard(order.id)}
                              className="flex-1 py-3 bg-emerald-600 active:bg-emerald-700 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2"
                            >
                              <Navigation className="w-4 h-4" />
                              Iniciar Entrega
                            </button>
                            <button
                              onClick={() => openRejectModal(order)}
                              className={cn(
                                'py-3 px-5 rounded-xl',
                                theme === 'dark'
                                  ? 'bg-gray-700 text-gray-400 active:bg-gray-600'
                                  : 'bg-gray-200 text-gray-500 active:bg-gray-300'
                              )}
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {order.status === 'in_delivery' && (
                          <button
                            onClick={() => goToDeliveryWizard(order.id)}
                            className="flex-1 py-3 bg-purple-600 active:bg-purple-700 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Completar Entrega
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                )
              })
            )}

            {/* Pagination - Mobile */}
            {totalOrders > ORDERS_PER_PAGE && !loading && (
              <div className="flex items-center justify-center gap-3 py-4">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={cn(
                    'p-3 rounded-full disabled:opacity-30',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                  )}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className={cn(
                  'text-sm font-medium',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  {currentPage} / {Math.ceil(totalOrders / ORDERS_PER_PAGE)}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalOrders / ORDERS_PER_PAGE), p + 1))}
                  disabled={currentPage >= Math.ceil(totalOrders / ORDERS_PER_PAGE)}
                  className={cn(
                    'p-3 rounded-full disabled:opacity-30',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                  )}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Bottom Spacer */}
            <div className="h-6" />
          </div>
        </div>

        {/* Desktop Layout - Original design */}
        <div className="hidden md:block min-h-screen p-6 space-y-6">
          {/* Desktop Stats Cards */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Pendientes', count: stats?.pendingCount || 0, icon: Clock, color: 'amber' },
              { label: 'Confirmadas', count: stats?.confirmedCount || 0, icon: CheckCircle, color: 'blue' },
              { label: 'En Entrega', count: stats?.inDeliveryCount || 0, icon: Truck, color: 'purple' },
              { label: 'Por Entregar', count: `$${(stats?.pendingAmount || 0).toLocaleString()}`, icon: DollarSign, color: 'emerald' }
            ].map((stat, i) => (
              <div key={i} className={cn(
                'relative overflow-hidden rounded-xl border p-4',
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              )}>
                <div className={`absolute top-0 left-0 w-full h-1 bg-${stat.color}-500`}></div>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2.5 rounded-lg',
                    theme === 'dark' ? `bg-${stat.color}-900/30` : `bg-${stat.color}-100`
                  )}>
                    <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
                  </div>
                  <div>
                    <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {stat.count}
                    </p>
                    <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      {stat.label}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Search + Filters */}
          <div className={cn(
            'p-4 rounded-xl border space-y-3',
            theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
          )}>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar orden..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(
                    'w-full h-10 pl-10 pr-4 rounded-lg border text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500',
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                  )}
                />
              </div>
              <button
                onClick={fetchOrders}
                className="h-10 px-4 flex items-center gap-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                Actualizar
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto">
              {statusTabs.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setSelectedStatus(tab.value)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                    selectedStatus === tab.value
                      ? 'bg-blue-600 text-white'
                      : theme === 'dark'
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>

          {/* Desktop Table */}
          <div className={cn(
            'rounded-xl border overflow-hidden',
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          )}>
            {loading ? (
              <div className="p-8 text-center">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-4" />
                <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Cargando ordenes...
                </p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className={cn('text-lg font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  No hay ordenes
                </p>
                <p className={cn('text-sm mt-1', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                  {selectedStatus ? 'No hay ordenes con este estado' : 'No tienes ordenes asignadas'}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className={cn(
                      'border-b',
                      theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                    )}>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orden</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destinatario</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ubicacion</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Accion</th>
                      </tr>
                    </thead>
                    <tbody className={cn('divide-y', theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200')}>
                      {filteredOrders.map((order) => {
                        const statusConfig = STATUSES[order.status] || STATUSES.pending

                        return (
                          <tr
                            key={order.id}
                            className={cn(
                              'transition-colors',
                              theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                            )}
                          >
                            <td className="px-4 py-4">
                              <div className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                {order.orderNumber}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {new Date(order.createdAt).toLocaleDateString('es-ES', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                {order.recipientName}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">{order.recipientPhone}</div>
                            </td>
                            <td className="px-4 py-4">
                              <div className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                                {order.recipientMunicipality}, {order.recipientProvince}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className={cn('font-bold text-lg', theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600')}>
                                {formatCurrency(order.receiveAmount, order.receiveCurrency)}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                                statusConfig.bgColor, 'text-white'
                              )}>
                                <statusConfig.icon className="w-3 h-3" />
                                {statusConfig.label}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center justify-end gap-2">
                                {order.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => handleAction(order.id, 'accept')}
                                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
                                    >
                                      Aceptar
                                    </button>
                                    <button
                                      onClick={() => openRejectModal(order)}
                                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg"
                                    >
                                      Rechazar
                                    </button>
                                  </>
                                )}
                                {order.status === 'confirmed' && (
                                  <button
                                    onClick={() => goToDeliveryWizard(order.id)}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg"
                                  >
                                    Entregar
                                  </button>
                                )}
                                {order.status === 'in_delivery' && (
                                  <button
                                    onClick={() => goToDeliveryWizard(order.id)}
                                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg"
                                  >
                                    Completar
                                  </button>
                                )}
                                {(order.status === 'delivered' || order.status === 'cancelled' || order.status === 'rejected') && (
                                  <button
                                    onClick={() => router.push(`/dashboard/broker/orders/${order.id}`)}
                                    className={cn(
                                      'p-2 rounded-lg',
                                      theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                                    )}
                                  >
                                    <Eye className="w-4 h-4 text-gray-400" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Desktop Pagination */}
                {totalOrders > ORDERS_PER_PAGE && (
                  <div className={cn(
                    'p-4 border-t flex items-center justify-between',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <div className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      {((currentPage - 1) * ORDERS_PER_PAGE) + 1}-{Math.min(currentPage * ORDERS_PER_PAGE, totalOrders)} de {totalOrders}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage >= Math.ceil(totalOrders / ORDERS_PER_PAGE)}
                      >
                        Siguiente
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Order Detail Bottom Sheet - Mobile */}
        <AnimatePresence>
          {selectedOrder && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50 md:hidden"
              onClick={() => setSelectedOrder(null)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'absolute bottom-0 left-0 right-0 rounded-t-3xl max-h-[85vh] overflow-y-auto',
                  theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                )}
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              >
                {/* Handle */}
                <div className="sticky top-0 flex justify-center pt-3 pb-2 bg-inherit">
                  <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                </div>

                <div className="px-5 pb-6 space-y-5">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold mb-2',
                        STATUSES[selectedOrder.status]?.bgColor || 'bg-gray-500',
                        'text-white'
                      )}>
                        {(() => {
                          const Icon = STATUSES[selectedOrder.status]?.icon || Clock
                          return <Icon className="w-3.5 h-3.5" />
                        })()}
                        {STATUSES[selectedOrder.status]?.label || 'Pendiente'}
                      </div>
                      <p className={cn(
                        'text-3xl font-bold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {formatCurrency(selectedOrder.receiveAmount, selectedOrder.receiveCurrency)}
                      </p>
                      <p className={cn(
                        'text-sm mt-1',
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                      )}>
                        {selectedOrder.orderNumber}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedOrder(null)}
                      className={cn(
                        'p-2 rounded-full',
                        theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                      )}
                    >
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>

                  {/* Recipient Card */}
                  <div className={cn(
                    'rounded-2xl p-4 space-y-4',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                  )}>
                    <h3 className={cn(
                      'text-xs font-semibold uppercase tracking-wider',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    )}>
                      Destinatario
                    </h3>

                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-white'
                      )}>
                        <User className="w-6 h-6 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'font-semibold truncate',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {selectedOrder.recipientName}
                        </p>
                        <a
                          href={`tel:${selectedOrder.recipientPhone}`}
                          className="text-blue-500 font-medium text-sm"
                        >
                          {selectedOrder.recipientPhone}
                        </a>
                      </div>
                      <a
                        href={`tel:${selectedOrder.recipientPhone}`}
                        className={cn(
                          'p-3 rounded-full',
                          theme === 'dark' ? 'bg-blue-600' : 'bg-blue-500'
                        )}
                      >
                        <Phone className="w-5 h-5 text-white" />
                      </a>
                    </div>

                    <div className={cn(
                      'pt-4 border-t space-y-2',
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className={cn(
                            'font-medium',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {selectedOrder.recipientMunicipality}, {selectedOrder.recipientProvince}
                          </p>
                          {selectedOrder.recipientAddress && (
                            <p className={cn(
                              'text-sm mt-1',
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            )}>
                              {selectedOrder.recipientAddress}
                            </p>
                          )}
                          {selectedOrder.recipientNeighborhood && (
                            <p className={cn(
                              'text-sm',
                              theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                            )}>
                              {selectedOrder.recipientNeighborhood}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Info Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className={cn(
                      'rounded-xl p-3',
                      theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                    )}>
                      <p className={cn(
                        'text-xs',
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                      )}>
                        Fecha
                      </p>
                      <p className={cn(
                        'font-medium mt-0.5',
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
                        'rounded-xl p-3',
                        theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                      )}>
                        <p className={cn(
                          'text-xs',
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        )}>
                          Agencia
                        </p>
                        <p className={cn(
                          'font-medium mt-0.5 truncate',
                          theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                        )}>
                          {selectedOrder.sellingCompanyName}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3 pt-2">
                    {selectedOrder.status === 'pending' && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedOrder(null)
                            handleAction(selectedOrder.id, 'accept')
                          }}
                          className="w-full py-4 bg-blue-600 active:bg-blue-700 text-white font-semibold rounded-2xl flex items-center justify-center gap-2"
                        >
                          <CheckCircle className="w-5 h-5" />
                          Aceptar Orden
                        </button>
                        <button
                          onClick={() => openRejectModal(selectedOrder)}
                          className={cn(
                            'w-full py-4 font-medium rounded-2xl flex items-center justify-center gap-2',
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
                          className="w-full py-4 bg-emerald-600 active:bg-emerald-700 text-white font-semibold rounded-2xl flex items-center justify-center gap-2"
                        >
                          <Navigation className="w-5 h-5" />
                          Iniciar Entrega
                        </button>
                        <button
                          onClick={() => openRejectModal(selectedOrder)}
                          className={cn(
                            'w-full py-4 font-medium rounded-2xl',
                            theme === 'dark'
                              ? 'bg-gray-800 text-gray-400'
                              : 'bg-gray-100 text-gray-600'
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
                        className="w-full py-4 bg-purple-600 active:bg-purple-700 text-white font-semibold rounded-2xl flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-5 h-5" />
                        Completar Entrega
                      </button>
                    )}

                    {(selectedOrder.status === 'delivered' || selectedOrder.status === 'cancelled' || selectedOrder.status === 'rejected') && (
                      <button
                        onClick={() => {
                          setSelectedOrder(null)
                          router.push(`/dashboard/broker/orders/${selectedOrder.id}`)
                        }}
                        className={cn(
                          'w-full py-4 font-medium rounded-2xl flex items-center justify-center gap-2',
                          theme === 'dark'
                            ? 'bg-gray-800 text-white'
                            : 'bg-gray-100 text-gray-900'
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

        {/* Success Toast */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-auto bg-emerald-600 text-white px-5 py-4 rounded-2xl shadow-xl flex items-center gap-3 z-50"
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

        {/* Reject Modal */}
        <AnimatePresence>
          {rejectModalOpen && rejectingOrder && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center md:justify-center"
              onClick={() => setRejectModalOpen(false)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'w-full md:max-w-lg md:rounded-2xl rounded-t-3xl max-h-[90vh] overflow-y-auto',
                  theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                )}
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              >
                {/* Handle - Mobile */}
                <div className="md:hidden flex justify-center pt-3 pb-2">
                  <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                </div>

                <div className="p-5 space-y-5">
                  {/* Header */}
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl',
                      theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
                    )}>
                      <AlertTriangle className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                      <h3 className={cn(
                        'text-lg font-semibold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        Rechazar Orden
                      </h3>
                      <p className={cn(
                        'text-sm',
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}>
                        {rejectingOrder.orderNumber}
                      </p>
                    </div>
                  </div>

                  {/* Reasons */}
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
                                ? 'border-gray-700 active:border-gray-600'
                                : 'border-gray-200 active:border-gray-300'
                          )}
                        >
                          <Icon className={cn(
                            'w-5 h-5 flex-shrink-0',
                            selectedReason === reason.value ? 'text-red-500' : 'text-gray-400'
                          )} />
                          <div className="min-w-0">
                            <p className={cn(
                              'font-medium',
                              selectedReason === reason.value
                                ? 'text-red-600 dark:text-red-400'
                                : theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {reason.label}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Notes */}
                  {selectedReason === 'other' && (
                    <div>
                      <textarea
                        value={rejectNotes}
                        onChange={(e) => setRejectNotes(e.target.value)}
                        rows={3}
                        placeholder="Especifique el motivo..."
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border text-base',
                          'focus:outline-none focus:ring-2 focus:ring-red-500',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                        )}
                      />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setRejectModalOpen(false)}
                      className={cn(
                        'flex-1 py-4 rounded-xl font-medium',
                        theme === 'dark'
                          ? 'bg-gray-800 text-gray-300'
                          : 'bg-gray-100 text-gray-700'
                      )}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={!selectedReason || rejectLoading}
                      className="flex-1 py-4 bg-red-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {rejectLoading ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
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
      </DashboardLayout>
    </ProtectedRoute>
  )
}
