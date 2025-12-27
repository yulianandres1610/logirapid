'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet,
  Clock,
  CheckCircle,
  DollarSign,
  User,
  Calendar,
  X,
  Loader2,
  AlertTriangle,
  Check,
  XCircle,
  CreditCard,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface PaymentRequest {
  id: number
  requestNumber: string
  supplier: {
    id: number
    code: string
    name: string
    balance: number
  }
  amountRequested: number
  amountPaid: number
  status: string
  paymentMethod: string | null
  paymentReference: string | null
  notes: string | null
  requestedAt: string
  approvedAt: string | null
  paidAt: string | null
}

interface Stats {
  pending: { count: number; amount: number }
  approved: { count: number; amount: number }
  paid: { count: number; amount: number }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pendiente', color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30', icon: Clock },
  approved: { label: 'Aprobada', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30', icon: CheckCircle },
  paid: { label: 'Pagada', color: 'text-green-600 bg-green-100 dark:bg-green-900/30', icon: DollarSign },
  rejected: { label: 'Rechazada', color: 'text-red-600 bg-red-100 dark:bg-red-900/30', icon: XCircle }
}

export default function ConsignmentPaymentsPage() {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [filter, setFilter] = useState('all')
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null)
  const [showActionModal, setShowActionModal] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'pay' | null>(null)
  const [paymentMethod, setPaymentMethod] = useState('transfer')
  const [paymentReference, setPaymentReference] = useState('')
  const [rejectNotes, setRejectNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchRequests()
  }, [filter])

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/consignments/payments/requests?status=${filter}`)
      const data = await response.json()

      if (data.success) {
        setRequests(data.data.requests)
        setStats(data.data.stats)
      }
    } catch {
      console.error('Error fetching requests')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async () => {
    if (!selectedRequest || !actionType) return

    setProcessing(true)
    setError('')

    try {
      const body: Record<string, string | undefined> = { action: actionType }

      if (actionType === 'pay') {
        body.paymentMethod = paymentMethod
        body.paymentReference = paymentReference || undefined
      } else if (actionType === 'reject') {
        body.notes = rejectNotes || undefined
      }

      const response = await fetch(`/api/consignments/payments/requests/${selectedRequest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(data.message)
        setShowActionModal(false)
        setSelectedRequest(null)
        setActionType(null)
        setPaymentMethod('transfer')
        setPaymentReference('')
        setRejectNotes('')
        fetchRequests()
        setTimeout(() => setSuccess(''), 5000)
      } else {
        setError(data.error)
      }
    } catch {
      setError('Error al procesar accion')
    } finally {
      setProcessing(false)
    }
  }

  const openActionModal = (request: PaymentRequest, action: 'approve' | 'reject' | 'pay') => {
    setSelectedRequest(request)
    setActionType(action)
    setShowActionModal(true)
    setError('')
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value)

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/market/consignments">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                  )}
                >
                  <ArrowLeft className="w-5 h-5" />
                </motion.button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Pagos a Proveedores
                </h1>
                <p className="text-gray-500 mt-1">
                  Gestiona las solicitudes de cobro de proveedores
                </p>
              </div>
            </div>
          </div>

      {/* Success Message */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-4 p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-xl flex items-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            {success}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className={cn(
            'p-5 rounded-2xl',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-sm text-gray-500">Pendientes</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.pending.count}
            </p>
            <p className="text-sm text-amber-600">{formatCurrency(stats.pending.amount)}</p>
          </div>

          <div className={cn(
            'p-5 rounded-2xl',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm text-gray-500">Aprobadas</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.approved.count}
            </p>
            <p className="text-sm text-blue-600">{formatCurrency(stats.approved.amount)}</p>
          </div>

          <div className={cn(
            'p-5 rounded-2xl',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm text-gray-500">Pagadas</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.paid.count}
            </p>
            <p className="text-sm text-green-600">{formatCurrency(stats.paid.amount)}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'all', label: 'Todas' },
          { key: 'pending', label: 'Pendientes' },
          { key: 'approved', label: 'Aprobadas' },
          { key: 'paid', label: 'Pagadas' }
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'px-4 py-2 rounded-xl font-medium transition-all',
              filter === f.key
                ? 'bg-teal-500 text-white'
                : theme === 'dark'
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className={cn(
          'text-center py-12 rounded-2xl',
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        )}>
          <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay solicitudes</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request, index) => {
            const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending
            const StatusIcon = statusConfig.icon

            return (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  'p-5 rounded-2xl',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    )}>
                      <User className="w-6 h-6 text-gray-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-gray-900 dark:text-white">
                          {request.requestNumber}
                        </span>
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1',
                          statusConfig.color
                        )}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig.label}
                        </span>
                      </div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {request.supplier.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        Codigo: {request.supplier.code}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(request.amountRequested)}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(request.requestedAt)}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {(request.status === 'pending' || request.status === 'approved') && (
                  <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    {request.status === 'pending' && (
                      <>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => openActionModal(request, 'approve')}
                          className="flex-1 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Aprobar
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => openActionModal(request, 'reject')}
                          className="py-2 px-4 border border-red-500 text-red-500 rounded-lg font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                        >
                          <X className="w-4 h-4" />
                          Rechazar
                        </motion.button>
                      </>
                    )}
                    {request.status === 'approved' && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => openActionModal(request, 'pay')}
                        className="flex-1 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <CreditCard className="w-4 h-4" />
                        Registrar Pago
                      </motion.button>
                    )}
                  </div>
                )}

                {/* Payment info for paid requests */}
                {request.status === 'paid' && request.paymentMethod && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 text-sm text-gray-500">
                    <span>Metodo: {request.paymentMethod}</span>
                    {request.paymentReference && (
                      <span>Ref: {request.paymentReference}</span>
                    )}
                    {request.paidAt && (
                      <span>Pagado: {formatDate(request.paidAt)}</span>
                    )}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Action Modal */}
      <AnimatePresence>
        {showActionModal && selectedRequest && actionType && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowActionModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'w-full max-w-md rounded-2xl p-6 shadow-xl',
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {actionType === 'approve' && 'Aprobar Solicitud'}
                  {actionType === 'reject' && 'Rechazar Solicitud'}
                  {actionType === 'pay' && 'Registrar Pago'}
                </h2>
                <button
                  onClick={() => setShowActionModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-xl text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div className="mb-6">
                <p className="text-sm text-gray-500 mb-1">Solicitud</p>
                <p className="font-mono font-bold text-gray-900 dark:text-white">
                  {selectedRequest.requestNumber}
                </p>
                <p className="text-gray-600 dark:text-gray-300">{selectedRequest.supplier.name}</p>
                <p className="text-2xl font-bold text-teal-600 mt-2">
                  {formatCurrency(selectedRequest.amountRequested)}
                </p>
              </div>

              {actionType === 'pay' && (
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Metodo de Pago
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border',
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      )}
                    >
                      <option value="transfer">Transferencia Bancaria</option>
                      <option value="cash">Efectivo</option>
                      <option value="check">Cheque</option>
                      <option value="zelle">Zelle</option>
                      <option value="other">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Referencia (opcional)
                    </label>
                    <input
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="Numero de transaccion, cheque, etc."
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border',
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      )}
                    />
                  </div>
                </div>
              )}

              {actionType === 'reject' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Motivo del rechazo (opcional)
                  </label>
                  <textarea
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
                    placeholder="Explique el motivo..."
                    rows={3}
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border resize-none',
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    )}
                  />
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowActionModal(false)}
                  className={cn(
                    'flex-1 py-3 rounded-xl font-medium transition-colors',
                    theme === 'dark'
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  Cancelar
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAction}
                  disabled={processing}
                  className={cn(
                    'flex-1 py-3 rounded-xl font-medium text-white transition-colors flex items-center justify-center gap-2',
                    actionType === 'approve' && 'bg-blue-500 hover:bg-blue-600',
                    actionType === 'reject' && 'bg-red-500 hover:bg-red-600',
                    actionType === 'pay' && 'bg-green-500 hover:bg-green-600',
                    processing && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      {actionType === 'approve' && <Check className="w-4 h-4" />}
                      {actionType === 'reject' && <X className="w-4 h-4" />}
                      {actionType === 'pay' && <CreditCard className="w-4 h-4" />}
                      {actionType === 'approve' && 'Confirmar Aprobacion'}
                      {actionType === 'reject' && 'Confirmar Rechazo'}
                      {actionType === 'pay' && 'Confirmar Pago'}
                    </>
                  )}
                </motion.button>
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
