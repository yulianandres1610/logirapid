'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  DollarSign,
  Plus,
  Building2,
  LogOut,
  Loader2,
  Check,
  Clock,
  X,
  AlertCircle,
  FileText,
  Wallet,
  Gift
} from 'lucide-react'

interface PaymentRequest {
  id: number
  requestType: string
  amount: number
  currency: string
  status: string
  requestedAt: string
  reviewedAt: string | null
  reviewNotes: string | null
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

const typeIcons: Record<string, any> = {
  salary_advance: Wallet,
  commission: DollarSign,
  bonus: Gift
}

const typeColors: Record<string, string> = {
  salary_advance: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30',
  commission: 'bg-green-100 text-green-600 dark:bg-green-900/30',
  bonus: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'
}

export default function EmployeeRequestPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    requestType: '',
    amount: '',
    notes: ''
  })

  useEffect(() => {
    fetchRequests()
  }, [])

  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/employee/requests')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setRequests(result.data.requests)
          setSummary(result.data.summary)
        }
      } else if (response.status === 401) {
        router.push('/employee/login')
      }
    } catch (error) {
      console.error('Error fetching requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/employee/auth/logout', { method: 'POST' })
    router.push('/employee/login')
  }

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formData.requestType || !formData.amount) {
      setError('Selecciona el tipo y monto de la solicitud')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/employee/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: formData.requestType,
          amount: parseFloat(formData.amount),
          notes: formData.notes || null
        })
      })

      const result = await response.json()

      if (result.success) {
        setSuccess('Solicitud enviada exitosamente')
        setFormData({ requestType: '', amount: '', notes: '' })
        setShowModal(false)
        fetchRequests()
      } else {
        setError(result.error || 'Error al crear solicitud')
      }
    } catch (error) {
      console.error('Error submitting request:', error)
      setError('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/employee/dashboard"
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Building2 className="w-6 h-6 text-purple-600" />
              <h1 className="font-bold text-gray-900 dark:text-white">Solicitar Pago</h1>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* New Request Button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setShowModal(true)}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl p-6 text-left hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Nueva Solicitud</h2>
              <p className="text-green-100 mt-1">Solicita un adelanto, comisión o bono</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Plus className="w-6 h-6" />
            </div>
          </div>
        </motion.button>

        {/* Summary */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
              <p className="text-xl font-bold text-amber-600">{summary.pending.count}</p>
              <p className="text-xs text-gray-500">Pendientes</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
              <p className="text-xl font-bold text-blue-600">{summary.approved.count}</p>
              <p className="text-xs text-gray-500">Aprobadas</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3">
              <p className="text-xl font-bold text-green-600">{summary.paid.count}</p>
              <p className="text-xs text-gray-500">Pagadas</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
              <p className="text-xl font-bold text-red-600">{summary.rejected.count}</p>
              <p className="text-xs text-gray-500">Rechazadas</p>
            </div>
          </div>
        )}

        {/* Requests List */}
        {requests.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Sin solicitudes
            </h3>
            <p className="text-gray-500">
              Crea tu primera solicitud de pago
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request, idx) => {
              const Icon = typeIcons[request.requestType] || DollarSign
              return (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${typeColors[request.requestType]}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">
                          {typeLabels[request.requestType]}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[request.status]}`}>
                            {statusLabels[request.status]}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(request.requestedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        ${request.amount.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-500">{request.currency}</p>
                    </div>
                  </div>

                  {request.notes && (
                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg p-2">
                      {request.notes}
                    </p>
                  )}

                  {request.reviewNotes && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg p-2">
                      <AlertCircle className="w-3 h-3 inline mr-1" />
                      <span className="font-medium">Respuesta:</span> {request.reviewNotes}
                    </p>
                  )}

                  {request.status === 'paid' && request.paidAt && (
                    <p className="mt-2 text-sm text-green-600">
                      <Check className="w-4 h-4 inline mr-1" />
                      Pagado el {new Date(request.paidAt).toLocaleDateString()}
                    </p>
                  )}

                  {request.status === 'rejected' && (
                    <p className="mt-2 text-sm text-red-600">
                      <X className="w-4 h-4 inline mr-1" />
                      Rechazado el {request.reviewedAt ? new Date(request.reviewedAt).toLocaleDateString() : ''}
                    </p>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}

        {/* New Request Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full"
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Nueva Solicitud
                </h2>
              </div>

              <form onSubmit={submitRequest} className="p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-sm text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tipo de Solicitud *
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(typeLabels).map(([value, label]) => {
                      const Icon = typeIcons[value]
                      return (
                        <button
                          type="button"
                          key={value}
                          onClick={() => setFormData(prev => ({ ...prev, requestType: value }))}
                          className={`p-3 border-2 rounded-xl flex flex-col items-center gap-2 transition-all ${
                            formData.requestType === value
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <Icon className={`w-6 h-6 ${formData.requestType === value ? 'text-purple-600' : 'text-gray-400'}`} />
                          <span className="text-xs font-medium text-center">{label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Monto *
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="0.00"
                      step="0.0001"
                      min="0"
                      required
                      className="w-full pl-12 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nota (opcional)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Describe el motivo de tu solicitud..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 resize-none"
                  />
                </div>
              </form>

              <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  onClick={submitRequest}
                  disabled={submitting || !formData.requestType || !formData.amount}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Enviar Solicitud
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  )
}
