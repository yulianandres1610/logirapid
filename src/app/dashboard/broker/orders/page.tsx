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
  Calendar,
  Truck,
  Search,
  Check,
  X,
  RefreshCw,
  AlertTriangle,
  Banknote,
  MapPinOff,
  UserX,
  FileWarning,
  CalendarX,
  HelpCircle
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

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
  recipientIdNumber: string
  senderName: string
  senderPhone: string
  receiveAmount: number
  receiveCurrency: string
  estimatedDelivery: string
  createdAt: string
  confirmedAt: string | null
  deliveredAt: string | null
}

interface Stats {
  pending: number
  confirmed: number
  inDelivery: number
  delivered: number
  cancelled: number
  total: number
}

export default function BrokerOrdersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')

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
      // Clear the param from URL
      router.replace('/dashboard/broker/orders')
      setTimeout(() => setSuccessMessage(null), 5000)
    }
  }, [searchParams, router])

  useEffect(() => {
    fetchOrders()
  }, [selectedStatus])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedStatus) params.append('status', selectedStatus)
      if (searchTerm) params.append('search', searchTerm)

      const response = await fetch(`/api/broker/orders?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setOrders(data.data.orders || [])
          setStats(data.data.stats)
        }
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (orderId: number, action: string) => {
    setActionLoading(orderId)
    try {
      const response = await fetch('/api/broker/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, action })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          fetchOrders()
        } else {
          alert(data.error || 'Error al procesar la accion')
        }
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al procesar la accion')
    } finally {
      setActionLoading(null)
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === 'CUP') {
      return `${amount.toLocaleString()} CUP`
    }
    return `$${amount.toFixed(2)} ${currency}`
  }

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { bg: string, text: string, icon: any, label: string }> = {
      pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300', icon: Clock, label: 'Pendiente' },
      confirmed: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300', icon: CheckCircle, label: 'Confirmada' },
      in_delivery: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-300', icon: Truck, label: 'En Entrega' },
      delivered: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300', icon: CheckCircle, label: 'Entregada' },
      cancelled: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', icon: XCircle, label: 'Cancelada' }
    }
    return configs[status] || configs.pending
  }

  const getAvailableActions = (status: string) => {
    const actions: Record<string, { action: string, label: string, icon: any, color: string, isSpecial?: string }[]> = {
      pending: [
        { action: 'accept', label: 'Aceptar', icon: Check, color: 'bg-blue-600 hover:bg-blue-700' },
        { action: 'reject', label: 'Rechazar', icon: X, color: 'bg-red-600 hover:bg-red-700', isSpecial: 'reject' }
      ],
      confirmed: [
        { action: 'start_delivery', label: 'Iniciar Entrega', icon: Truck, color: 'bg-purple-600 hover:bg-purple-700' },
        { action: 'reject', label: 'Rechazar', icon: X, color: 'bg-red-600 hover:bg-red-700', isSpecial: 'reject' }
      ],
      in_delivery: [
        { action: 'deliver', label: 'Completar Entrega', icon: CheckCircle, color: 'bg-green-600 hover:bg-green-700', isSpecial: 'deliver' }
      ]
    }
    return actions[status] || []
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

  // Handle action click
  const handleActionClick = (order: Order, action: string, isSpecial?: string) => {
    if (isSpecial === 'reject') {
      openRejectModal(order)
    } else if (isSpecial === 'deliver') {
      goToDeliveryWizard(order.id)
    } else {
      handleAction(order.id, action)
    }
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
    { value: '', label: 'Todas', count: stats?.total || 0 },
    { value: 'pending', label: 'Pendientes', count: stats?.pending || 0 },
    { value: 'confirmed', label: 'Confirmadas', count: stats?.confirmed || 0 },
    { value: 'in_delivery', label: 'En Entrega', count: stats?.inDelivery || 0 },
    { value: 'delivered', label: 'Entregadas', count: stats?.delivered || 0 }
  ]

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Ordenes de Remesas
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Gestiona las entregas asignadas a tu zona
              </p>
            </div>
            <button
              onClick={fetchOrders}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>

          {/* Status Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {statusTabs.map(tab => (
              <button
                key={tab.value}
                onClick={() => setSelectedStatus(tab.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedStatus === tab.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {tab.label}
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  selectedStatus === tab.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por numero de orden, nombre o telefono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Orders List */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-700 h-32 rounded-xl"></div>
              ))}
            </div>
          ) : filteredOrders.length > 0 ? (
            <div className="space-y-4">
              {filteredOrders.map((order, index) => {
                const statusConfig = getStatusConfig(order.status)
                const StatusIcon = statusConfig.icon
                const actions = getAvailableActions(order.status)

                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                  >
                    {/* Order Header */}
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {order.orderNumber}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusConfig.bg} ${statusConfig.text}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-gray-900 dark:text-white">
                            {formatCurrency(order.receiveAmount, order.receiveCurrency)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Entrega: {order.estimatedDelivery}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Order Body */}
                    <div className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Recipient Info */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            Destinatario
                          </h4>
                          <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                            <User className="w-4 h-4 text-gray-400" />
                            <span>{order.recipientName}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span>{order.recipientPhone}</span>
                          </div>
                          <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
                            <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                            <div>
                              <p>{order.recipientAddress}</p>
                              <p className="text-sm">{order.recipientMunicipality}, {order.recipientProvince}</p>
                            </div>
                          </div>
                          {order.recipientIdNumber && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              CI: {order.recipientIdNumber}
                            </p>
                          )}
                        </div>

                        {/* Sender Info & Dates */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            Remitente
                          </h4>
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                            <User className="w-4 h-4 text-gray-400" />
                            <span>{order.senderName}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span>{order.senderPhone}</span>
                          </div>
                          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                              <Calendar className="w-4 h-4" />
                              <span>Creada: {new Date(order.createdAt).toLocaleDateString('es-ES', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      {actions.length > 0 && (
                        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                          {actions.map(({ action, label, icon: Icon, color, isSpecial }) => (
                            <button
                              key={action}
                              onClick={() => handleActionClick(order, action, isSpecial)}
                              disabled={actionLoading === order.id}
                              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-colors ${color} disabled:opacity-50`}
                            >
                              {actionLoading === order.id && !isSpecial ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <Icon className="w-4 h-4" />
                              )}
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-12 text-center"
            >
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No hay ordenes
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {selectedStatus
                  ? `No hay ordenes ${statusTabs.find(t => t.value === selectedStatus)?.label.toLowerCase()}`
                  : 'No tienes ordenes asignadas en este momento'}
              </p>
            </motion.div>
          )}

          {/* Success Message */}
          <AnimatePresence>
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="fixed bottom-6 right-6 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50"
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
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
                >
                  {/* Modal Header */}
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                        <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Rechazar Orden
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {rejectingOrder.orderNumber} - {rejectingOrder.recipientName}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
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
                            className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 transition-colors text-left
                              ${selectedReason === reason.value
                                ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
                            `}
                          >
                            <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                              selectedReason === reason.value
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-gray-400'
                            }`} />
                            <div>
                              <p className={`font-medium ${
                                selectedReason === reason.value
                                  ? 'text-red-700 dark:text-red-300'
                                  : 'text-gray-900 dark:text-white'
                              }`}>
                                {reason.label}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {reason.description}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Notas adicionales {selectedReason === 'other' && <span className="text-red-500">*</span>}
                      </label>
                      <textarea
                        value={rejectNotes}
                        onChange={(e) => setRejectNotes(e.target.value)}
                        rows={3}
                        placeholder={selectedReason === 'other' ? 'Especifique el motivo...' : 'Opcional...'}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
                    <button
                      onClick={() => setRejectModalOpen(false)}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
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
