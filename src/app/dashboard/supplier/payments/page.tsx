'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  Wallet,
  Plus,
  X,
  AlertTriangle
} from 'lucide-react'

interface PaymentRequest {
  id: number
  requestNumber: string
  amountRequested: number
  amountApproved: number | null
  status: string
  notes: string | null
  adminNotes: string | null
  createdAt: string
  processedAt: string | null
}

interface WalletInfo {
  available: number
  pending: number
  totalPaid: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: typeof Clock }> = {
  pending: { label: 'Pendiente', color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30', icon: Clock },
  approved: { label: 'Aprobada', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', icon: CheckCircle },
  paid: { label: 'Pagada', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircle },
  rejected: { label: 'Rechazada', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', icon: XCircle }
}

export default function SupplierPaymentsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [wallet, setWallet] = useState<WalletInfo | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [dashRes, paymentsRes] = await Promise.all([
        fetch('/api/supplier/dashboard'),
        fetch('/api/supplier/payments')
      ])

      const dashData = await dashRes.json()
      const paymentsData = await paymentsRes.json()

      if (dashData.success) {
        setWallet({
          available: dashData.data.wallet.available,
          pending: dashData.data.wallet.pending,
          totalPaid: dashData.data.wallet.totalPaid
        })
      }

      if (paymentsData.success) {
        setRequests(paymentsData.data.requests)
      }
    } catch {
      console.error('Error fetching data')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    const amountValue = parseFloat(amount)
    if (!amountValue || amountValue <= 0) return

    setSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/supplier/payments/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountValue, notes: notes || undefined })
      })

      const result = await response.json()

      if (result.success) {
        setSuccess(`Solicitud ${result.data.requestNumber} creada`)
        setShowModal(false)
        setAmount('')
        setNotes('')
        fetchData()
        setTimeout(() => setSuccess(''), 5000)
      } else {
        setError(result.error)
      }
    } catch {
      setError('Error al crear solicitud')
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value)

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })

  const hasPendingRequest = requests.some(r => r.status === 'pending')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header - Responsive */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-4 md:px-8 md:py-6 lg:px-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-teal-100 dark:bg-teal-900/30 rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-teal-600" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Mis Pagos</h1>
              <p className="text-sm text-gray-500">{requests.length} solicitudes</p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            disabled={!wallet || wallet.available <= 0 || hasPendingRequest}
            className="flex items-center gap-2 px-4 py-2.5 md:px-6 md:py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation font-medium"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden md:inline">Nueva Solicitud</span>
          </button>
        </div>
      </header>

      {/* Success Message */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-sm"
          >
            <CheckCircle className="w-4 h-4" />
            {success}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="px-4 py-5 md:px-8 md:py-8 lg:px-12 pb-24 md:pb-8 space-y-5 md:space-y-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* Wallet Summary - Desktop layout */}
            {wallet && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl md:rounded-3xl p-5 md:p-8 text-white shadow-lg"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-8">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-11 h-11 md:w-14 md:h-14 bg-white/20 rounded-xl md:rounded-2xl flex items-center justify-center">
                      <Wallet className="w-5 h-5 md:w-7 md:h-7" />
                    </div>
                    <div>
                      <p className="text-white/70 text-xs md:text-sm">Disponible para cobrar</p>
                      <p className="text-2xl md:text-4xl font-bold">{formatCurrency(wallet.available)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:gap-4 md:min-w-[320px]">
                    <div className="bg-white/10 rounded-xl p-3 md:p-4">
                      <p className="text-white/60 text-xs md:text-sm">En Proceso</p>
                      <p className="font-bold text-lg md:text-xl">{formatCurrency(wallet.pending)}</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3 md:p-4">
                      <p className="text-white/60 text-xs md:text-sm">Total Pagado</p>
                      <p className="font-bold text-lg md:text-xl">{formatCurrency(wallet.totalPaid)}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Requests List */}
            <div>
              <h2 className="text-base md:text-xl font-bold text-gray-900 dark:text-white mb-4">
                Solicitudes de Pago
              </h2>

              {requests.length === 0 ? (
                <div className="text-center py-10 md:py-16 bg-white dark:bg-gray-800 rounded-2xl">
                  <DollarSign className="w-12 h-12 md:w-16 md:h-16 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No hay solicitudes</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                  {requests.map((request, index) => {
                    const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending
                    const StatusIcon = statusConfig.icon

                    return (
                      <motion.div
                        key={request.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center ${statusConfig.bgColor}`}>
                              <StatusIcon className={`w-5 h-5 md:w-6 md:h-6 ${statusConfig.color}`} />
                            </div>
                            <div>
                              <p className="font-mono font-bold text-sm md:text-base text-gray-900 dark:text-white">
                                {request.requestNumber}
                              </p>
                              <div className="flex items-center gap-1 text-xs md:text-sm text-gray-500">
                                <Calendar className="w-3 h-3" />
                                {formatDate(request.createdAt)}
                              </div>
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </div>

                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-xs md:text-sm text-gray-500">Solicitado</p>
                            <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                              {formatCurrency(request.amountRequested)}
                            </p>
                          </div>
                          {request.amountApproved !== null && request.status !== 'pending' && (
                            <div className="text-right">
                              <p className="text-xs md:text-sm text-gray-500">
                                {request.status === 'paid' ? 'Pagado' : 'Aprobado'}
                              </p>
                              <p className={`text-xl md:text-2xl font-bold ${
                                request.status === 'paid' ? 'text-green-600' : 'text-blue-600'
                              }`}>
                                {formatCurrency(request.amountApproved)}
                              </p>
                            </div>
                          )}
                        </div>

                        {request.adminNotes && (
                          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300">
                              {request.adminNotes}
                            </p>
                          </div>
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* New Request Modal - Bottom Sheet on Mobile */}
      <AnimatePresence>
        {showModal && wallet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-t-3xl md:rounded-2xl p-5 w-full md:max-w-md md:m-4 shadow-xl"
            >
              {/* Handle Bar */}
              <div className="flex justify-center mb-3 md:hidden">
                <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
              </div>

              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Nueva Solicitud
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="mb-5">
                <p className="text-xs text-gray-500 mb-1">Disponible</p>
                <p className="text-2xl font-bold text-teal-600">
                  {formatCurrency(wallet.available)}
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-xl text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Monto
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      max={wallet.available}
                      step="0.01"
                      placeholder="0.00"
                      className="w-full pl-9 pr-4 py-3.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xl font-medium focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex gap-2 mt-3">
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setAmount((wallet.available * pct / 100).toFixed(2))}
                        className="flex-1 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl active:bg-gray-200 transition-colors touch-manipulation"
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notas (opcional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Agregar notas..."
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                  />
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={submitting || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > wallet.available}
                  className="w-full py-4 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 touch-manipulation min-h-[52px]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <DollarSign className="w-5 h-5" />
                      Solicitar {amount ? formatCurrency(parseFloat(amount)) : 'Pago'}
                    </>
                  )}
                </motion.button>
              </div>

              <div className="h-6 md:hidden" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
