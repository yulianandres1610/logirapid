'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  FileCheck,
  Filter,
  Check,
  X,
  DollarSign,
  Clock,
  User,
  MessageSquare,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

interface PaymentRequest {
  id: number
  employeeId: number
  employeeCode: string
  employeeName: string
  employeeEmail: string
  requestType: string
  amount: number
  currency: string
  status: string
  requestedAt: string
  reviewedAt: string | null
  reviewNotes: string | null
  reviewedByEmail: string | null
  paidAt: string | null
  notes: string | null
}

interface Summary {
  pending: { count: number; total: number }
  approved: { count: number; total: number }
  rejected: { count: number; total: number }
  paid: { count: number; total: number }
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
}

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  paid: 'Pagada'
}

const typeLabels: Record<string, string> = {
  salary_advance: 'Adelanto de Salario',
  commission: 'Cobro de Comisión',
  bonus: 'Bono'
}

const typeColors: Record<string, string> = {
  salary_advance: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400',
  commission: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400',
  bonus: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400'
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [summary, setSummary] = useState<Summary>({
    pending: { count: 0, total: 0 },
    approved: { count: 0, total: 0 },
    rejected: { count: 0, total: 0 },
    paid: { count: 0, total: 0 }
  })

  // Review modal state
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null)
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchData()
  }, [statusFilter])

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)

      const response = await fetch(`/api/market/accounting/requests?${params}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setRequests(result.data.requests)
          setSummary(result.data.summary)
        }
      }
    } catch (error) {
      console.error('Error fetching requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const openReviewModal = (request: PaymentRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request)
    setReviewAction(action)
    setReviewNotes('')
    setShowReviewModal(true)
  }

  const processRequest = async () => {
    if (!selectedRequest || !reviewAction) return

    setProcessing(true)
    try {
      const response = await fetch('/api/market/accounting/requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedRequest.id,
          action: reviewAction,
          reviewNotes: reviewNotes || null
        })
      })

      if (response.ok) {
        setShowReviewModal(false)
        setSelectedRequest(null)
        setReviewAction(null)
        setReviewNotes('')
        fetchData()
      }
    } catch (error) {
      console.error('Error processing request:', error)
    } finally {
      setProcessing(false)
    }
  }

  const markAsPaid = async (id: number) => {
    try {
      const response = await fetch('/api/market/accounting/requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'pay' })
      })

      if (response.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('Error marking as paid:', error)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <FileCheck className="w-8 h-8 text-purple-600" />
                Solicitudes de Pago
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                {summary.pending.count} pendientes • ${summary.pending.total.toLocaleString()} por revisar
              </p>
            </div>
          </motion.div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div
              className={`rounded-xl p-4 cursor-pointer transition-all ${statusFilter === 'pending' ? 'ring-2 ring-amber-500' : ''} bg-amber-50 dark:bg-amber-900/20`}
              onClick={() => setStatusFilter(statusFilter === 'pending' ? '' : 'pending')}
            >
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Pendientes</span>
              </div>
              <p className="text-2xl font-bold text-amber-600">{summary.pending.count}</p>
              <p className="text-sm text-gray-500">${summary.pending.total.toLocaleString()}</p>
            </div>
            <div
              className={`rounded-xl p-4 cursor-pointer transition-all ${statusFilter === 'approved' ? 'ring-2 ring-blue-500' : ''} bg-blue-50 dark:bg-blue-900/20`}
              onClick={() => setStatusFilter(statusFilter === 'approved' ? '' : 'approved')}
            >
              <div className="flex items-center gap-2 mb-1">
                <Check className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Aprobadas</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{summary.approved.count}</p>
              <p className="text-sm text-gray-500">${summary.approved.total.toLocaleString()}</p>
            </div>
            <div
              className={`rounded-xl p-4 cursor-pointer transition-all ${statusFilter === 'rejected' ? 'ring-2 ring-red-500' : ''} bg-red-50 dark:bg-red-900/20`}
              onClick={() => setStatusFilter(statusFilter === 'rejected' ? '' : 'rejected')}
            >
              <div className="flex items-center gap-2 mb-1">
                <X className="w-4 h-4 text-red-600" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Rechazadas</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{summary.rejected.count}</p>
              <p className="text-sm text-gray-500">${summary.rejected.total.toLocaleString()}</p>
            </div>
            <div
              className={`rounded-xl p-4 cursor-pointer transition-all ${statusFilter === 'paid' ? 'ring-2 ring-green-500' : ''} bg-green-50 dark:bg-green-900/20`}
              onClick={() => setStatusFilter(statusFilter === 'paid' ? '' : 'paid')}
            >
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Pagadas</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{summary.paid.count}</p>
              <p className="text-sm text-gray-500">${summary.paid.total.toLocaleString()}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl"
            >
              <option value="">Todos los estados</option>
              <option value="pending">Pendientes</option>
              <option value="approved">Aprobadas</option>
              <option value="rejected">Rechazadas</option>
              <option value="paid">Pagadas</option>
            </select>
            {statusFilter && (
              <button
                onClick={() => setStatusFilter('')}
                className="text-sm text-purple-600 hover:text-purple-700"
              >
                Limpiar filtro
              </button>
            )}
          </div>

          {/* Requests List */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
              <FileCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No hay solicitudes
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Las solicitudes de los empleados aparecerán aquí
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                        <User className="w-6 h-6 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-gray-900 dark:text-white">
                            {request.employeeName}
                          </h3>
                          <span className="text-sm text-gray-500">({request.employeeCode})</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${typeColors[request.requestType]}`}>
                            {typeLabels[request.requestType]}
                          </span>
                          <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[request.status]}`}>
                            {statusLabels[request.status]}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          <Clock className="w-3 h-3 inline mr-1" />
                          Solicitado: {formatDate(request.requestedAt)}
                        </p>
                        {request.notes && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 bg-gray-50 dark:bg-gray-900 rounded-lg p-2">
                            <MessageSquare className="w-3 h-3 inline mr-1" />
                            {request.notes}
                          </p>
                        )}
                        {request.reviewNotes && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 bg-gray-50 dark:bg-gray-900 rounded-lg p-2">
                            <AlertCircle className="w-3 h-3 inline mr-1" />
                            <span className="font-medium">Nota de revisión:</span> {request.reviewNotes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        ${request.amount.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-500">{request.currency}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  {request.status === 'pending' && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                      <button
                        onClick={() => openReviewModal(request, 'reject')}
                        className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-sm font-medium flex items-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Rechazar
                      </button>
                      <button
                        onClick={() => openReviewModal(request, 'approve')}
                        className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-xl text-sm font-medium flex items-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        Aprobar
                      </button>
                    </div>
                  )}
                  {request.status === 'approved' && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                      <button
                        onClick={() => markAsPaid(request.id)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium flex items-center gap-2"
                      >
                        <DollarSign className="w-4 h-4" />
                        Marcar como Pagada
                      </button>
                    </div>
                  )}
                  {request.status === 'paid' && request.paidAt && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-green-600">
                        <CheckCircle className="w-4 h-4 inline mr-1" />
                        Pagado el {formatDate(request.paidAt)}
                      </p>
                    </div>
                  )}
                  {request.status === 'rejected' && request.reviewedAt && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-red-600">
                        <X className="w-4 h-4 inline mr-1" />
                        Rechazado el {formatDate(request.reviewedAt)}
                        {request.reviewedByEmail && ` por ${request.reviewedByEmail}`}
                      </p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {/* Review Modal */}
          {showReviewModal && selectedRequest && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full"
              >
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {reviewAction === 'approve' ? 'Aprobar Solicitud' : 'Rechazar Solicitud'}
                  </h2>
                </div>
                <div className="p-6 space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {selectedRequest.employeeName}
                      </span>
                      <span className="text-xl font-bold text-gray-900 dark:text-white">
                        ${selectedRequest.amount.toLocaleString()}
                      </span>
                    </div>
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${typeColors[selectedRequest.requestType]}`}>
                      {typeLabels[selectedRequest.requestType]}
                    </span>
                    {selectedRequest.notes && (
                      <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                        "{selectedRequest.notes}"
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Notas de revisión {reviewAction === 'reject' && '(recomendado)'}
                    </label>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder={reviewAction === 'approve'
                        ? 'Agregar nota opcional...'
                        : 'Explica el motivo del rechazo...'}
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 resize-none"
                    />
                  </div>
                </div>
                <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                  <button
                    onClick={() => setShowReviewModal(false)}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={processRequest}
                    disabled={processing}
                    className={`px-4 py-2 rounded-xl font-medium disabled:opacity-50 ${
                      reviewAction === 'approve'
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {processing
                      ? 'Procesando...'
                      : reviewAction === 'approve'
                        ? 'Confirmar Aprobación'
                        : 'Confirmar Rechazo'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
