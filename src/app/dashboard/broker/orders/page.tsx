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
  TrendingUp,
  X
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

const STATUSES: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Pendiente', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  confirmed: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: CheckCircle },
  in_delivery: { label: 'En Entrega', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: Truck },
  delivered: { label: 'Entregada', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
  rejected: { label: 'Rechazada', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle }
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
          // After accepting, go to delivery wizard
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
    return `$${amount.toFixed(2)} ${currency}`
  }

  // Open reject modal
  const openRejectModal = (order: Order) => {
    setRejectingOrder(order)
    setSelectedReason('')
    setRejectNotes('')
    setRejectModalOpen(true)
  }

  // Handle reject submission
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
        setSuccessMessage('Orden rechazada. Los fondos han sido liberados.')
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

  // Navigate to delivery wizard
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
    { value: '', label: 'Todas', count: (stats?.pendingCount || 0) + (stats?.confirmedCount || 0) + (stats?.inDeliveryCount || 0) + (stats?.deliveredCount || 0) },
    { value: 'pending', label: 'Pendientes', count: stats?.pendingCount || 0 },
    { value: 'confirmed', label: 'Confirmadas', count: stats?.confirmedCount || 0 },
    { value: 'in_delivery', label: 'En Entrega', count: stats?.inDeliveryCount || 0 },
    { value: 'delivered', label: 'Entregadas', count: stats?.deliveredCount || 0 }
  ]

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              {/* Pendientes */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  'relative overflow-hidden rounded-2xl border shadow-xl',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-600"></div>
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-amber-900/30 border border-amber-800/50'
                        : 'bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200'
                    )}>
                      <Clock className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        Pendientes
                      </p>
                      <p className={cn('text-3xl font-bold mt-1', theme === 'dark' ? 'text-white' : 'text-slate-900')}>
                        {stats?.pendingCount || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Confirmadas */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'relative overflow-hidden rounded-2xl border shadow-xl',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-blue-900/30 border border-blue-800/50'
                        : 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200'
                    )}>
                      <CheckCircle className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        Confirmadas
                      </p>
                      <p className={cn('text-3xl font-bold mt-1', theme === 'dark' ? 'text-white' : 'text-slate-900')}>
                        {stats?.confirmedCount || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* En Entrega */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  'relative overflow-hidden rounded-2xl border shadow-xl',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-purple-600"></div>
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-purple-900/30 border border-purple-800/50'
                        : 'bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200'
                    )}>
                      <Truck className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        En Entrega
                      </p>
                      <p className={cn('text-3xl font-bold mt-1', theme === 'dark' ? 'text-white' : 'text-slate-900')}>
                        {stats?.inDeliveryCount || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Monto Pendiente */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className={cn(
                  'relative overflow-hidden rounded-2xl border shadow-xl',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-600"></div>
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-emerald-900/30 border border-emerald-800/50'
                        : 'bg-gradient-to-br from-emerald-50 to-green-100 border border-emerald-200'
                    )}>
                      <DollarSign className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        Por Entregar
                      </p>
                      <p className={cn('text-2xl font-bold mt-1', theme === 'dark' ? 'text-white' : 'text-slate-900')}>
                        {(stats?.pendingAmount || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Filters Bar */}
            <div className={cn(
              'flex flex-col lg:flex-row gap-4 items-center justify-between py-4 px-4 rounded-xl border',
              theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
            )}>
              {/* Search */}
              <div className="flex-1 relative w-full lg:max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar por orden, nombre o telefono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(
                    'w-full h-11 pl-10 pr-4 rounded-lg border transition-colors text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500',
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  )}
                />
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                {/* Status Tabs */}
                {statusTabs.map(tab => (
                  <button
                    key={tab.value}
                    onClick={() => setSelectedStatus(tab.value)}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                      selectedStatus === tab.value
                        ? 'bg-blue-600 text-white'
                        : theme === 'dark'
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    )}
                  >
                    {tab.label}
                    <span className={cn(
                      'ml-2 px-1.5 py-0.5 rounded-full text-xs',
                      selectedStatus === tab.value
                        ? 'bg-blue-500 text-white'
                        : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200'
                    )}>
                      {tab.count}
                    </span>
                  </button>
                ))}

                <Button
                  onClick={fetchOrders}
                  className={cn(
                    'h-11 px-4 gap-2',
                    theme === 'dark'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  )}
                >
                  <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                  Actualizar
                </Button>
              </div>
            </div>

            {/* Orders Table */}
            <div className={cn(
              'rounded-xl border overflow-hidden',
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            )}>
              {loading ? (
                <div className="p-12 text-center">
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
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className={cn(
                      'border-b',
                      theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                    )}>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Orden
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Destinatario
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Ubicacion
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Monto
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Accion
                        </th>
                      </tr>
                    </thead>
                    <tbody className={cn('divide-y', theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200')}>
                      {filteredOrders.map((order) => {
                        const statusConfig = STATUSES[order.status] || STATUSES.pending
                        const StatusIcon = statusConfig.icon

                        return (
                          <motion.tr
                            key={order.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={cn(
                              'transition-colors',
                              theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                            )}
                          >
                            {/* Orden */}
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
                              {order.sellingCompanyName && (
                                <div className="text-xs text-blue-500 mt-1">
                                  {order.sellingCompanyName}
                                </div>
                              )}
                            </td>

                            {/* Destinatario */}
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <div>
                                  <div className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                    {order.recipientName}
                                  </div>
                                  <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                    <Phone className="w-3 h-3" />
                                    {order.recipientPhone}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Ubicacion */}
                            <td className="px-4 py-4">
                              <div className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                                <div className="max-w-xs">
                                  <div className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                                    {order.recipientMunicipality}, {order.recipientProvince}
                                  </div>
                                  {order.recipientAddress && (
                                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                                      {order.recipientAddress}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Monto */}
                            <td className="px-4 py-4">
                              <div className={cn('font-bold text-lg', theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600')}>
                                {formatCurrency(order.receiveAmount, order.receiveCurrency)}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {order.estimatedDelivery}
                              </div>
                            </td>

                            {/* Estado */}
                            <td className="px-4 py-4">
                              <span className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                                statusConfig.color
                              )}>
                                <StatusIcon className="w-3 h-3" />
                                {statusConfig.label}
                              </span>
                            </td>

                            {/* Accion */}
                            <td className="px-4 py-4">
                              <div className="flex items-center justify-end gap-2">
                                {order.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => handleAction(order.id, 'accept')}
                                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                      Aceptar
                                    </button>
                                    <button
                                      onClick={() => openRejectModal(order)}
                                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                      Rechazar
                                    </button>
                                  </>
                                )}

                                {order.status === 'confirmed' && (
                                  <>
                                    <button
                                      onClick={() => goToDeliveryWizard(order.id)}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                      Entregar
                                    </button>
                                    <button
                                      onClick={() => openRejectModal(order)}
                                      className={cn(
                                        'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                                        theme === 'dark'
                                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                      )}
                                    >
                                      Rechazar
                                    </button>
                                  </>
                                )}

                                {order.status === 'in_delivery' && (
                                  <button
                                    onClick={() => goToDeliveryWizard(order.id)}
                                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                                  >
                                    Completar Entrega
                                  </button>
                                )}

                                {order.status === 'delivered' && (
                                  <button
                                    onClick={() => router.push(`/dashboard/broker/orders/${order.id}`)}
                                    className={cn(
                                      'p-2 rounded-lg transition-colors',
                                      theme === 'dark'
                                        ? 'text-gray-400 hover:bg-gray-700'
                                        : 'text-gray-600 hover:bg-gray-100'
                                    )}
                                    title="Ver detalles"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {totalOrders > ORDERS_PER_PAGE && (
                <div className={cn(
                  'p-4 border-t flex items-center justify-between',
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                )}>
                  <div className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    Mostrando {((currentPage - 1) * ORDERS_PER_PAGE) + 1} a{' '}
                    {Math.min(currentPage * ORDERS_PER_PAGE, totalOrders)} de {totalOrders}
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
            </div>
          </motion.div>

          {/* Success Message */}
          <AnimatePresence>
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="fixed bottom-6 right-6 bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50"
              >
                <CheckCircle className="w-5 h-5" />
                <span>{successMessage}</span>
                <button onClick={() => setSuccessMessage(null)}>
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
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                onClick={() => setRejectModalOpen(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                  )}
                >
                  {/* Modal Header */}
                  <div className={cn(
                    'p-6 border-b',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
                      )}>
                        <AlertTriangle className={cn(
                          'w-6 h-6',
                          theme === 'dark' ? 'text-red-400' : 'text-red-600'
                        )} />
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
                          {rejectingOrder.orderNumber} - {rejectingOrder.recipientName}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 space-y-4">
                    <p className={cn(
                      'text-sm',
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                    )}>
                      Seleccione el motivo del rechazo. Los fondos reservados seran liberados automaticamente.
                    </p>

                    {/* Rejection Reasons */}
                    <div className="space-y-2">
                      {REJECTION_REASONS.map((reason) => {
                        const Icon = reason.icon
                        return (
                          <button
                            key={reason.value}
                            onClick={() => setSelectedReason(reason.value)}
                            className={cn(
                              'w-full flex items-start gap-3 p-3 rounded-lg border-2 transition-colors text-left',
                              selectedReason === reason.value
                                ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                : theme === 'dark'
                                  ? 'border-gray-700 hover:border-gray-600'
                                  : 'border-gray-200 hover:border-gray-300'
                            )}
                          >
                            <Icon className={cn(
                              'w-5 h-5 mt-0.5 flex-shrink-0',
                              selectedReason === reason.value
                                ? 'text-red-500'
                                : 'text-gray-400'
                            )} />
                            <div>
                              <p className={cn(
                                'font-medium',
                                selectedReason === reason.value
                                  ? theme === 'dark' ? 'text-red-300' : 'text-red-700'
                                  : theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {reason.label}
                              </p>
                              <p className={cn(
                                'text-sm',
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                              )}>
                                {reason.description}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {/* Notes */}
                    <div>
                      <label className={cn(
                        'block text-sm font-medium mb-1',
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Notas adicionales {selectedReason === 'other' && <span className="text-red-500">*</span>}
                      </label>
                      <textarea
                        value={rejectNotes}
                        onChange={(e) => setRejectNotes(e.target.value)}
                        rows={3}
                        placeholder={selectedReason === 'other' ? 'Especifique el motivo...' : 'Opcional...'}
                        className={cn(
                          'w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-red-500',
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                        )}
                      />
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className={cn(
                    'p-6 border-t flex gap-3 justify-end',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <button
                      onClick={() => setRejectModalOpen(false)}
                      className={cn(
                        'px-4 py-2 rounded-lg transition-colors',
                        theme === 'dark'
                          ? 'text-gray-300 hover:bg-gray-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={!selectedReason || rejectLoading}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {rejectLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <X className="w-4 h-4" />
                          Confirmar Rechazo
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
