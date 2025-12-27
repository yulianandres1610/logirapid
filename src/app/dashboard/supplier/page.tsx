'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  Wallet,
  TrendingUp,
  Clock,
  CheckCircle,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  X,
  AlertTriangle,
  FileText,
  RefreshCcw
} from 'lucide-react'

interface DashboardData {
  supplier: {
    id: number
    code: string
    name: string
    email: string
    phone: string
  }
  wallet: {
    available: number
    pending: number
    totalEarned: number
    totalPaid: number
    totalReturned: number
  }
  orders: {
    pending: number
    received: number
    active: number
    completed: number
    total: number
    totalConsigned: number
    totalSold: number
  }
  payments: {
    pendingRequests: number
    approvedRequests: number
    amountInProcess: number
  }
  sales30Days: number
  recentTransactions: Array<{
    id: number
    type: string
    amount: number
    posOrderNumber: string | null
    orderNumber: string | null
    notes: string | null
    createdAt: string
  }>
}

export default function SupplierDashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [submittingPayment, setSubmittingPayment] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState('')

  useEffect(() => {
    fetchDashboard()
  }, [])

  const fetchDashboard = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/supplier/dashboard')
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else if (response.status === 401) {
        router.push('/supplier/login')
      } else {
        setError(result.error)
      }
    } catch {
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }


  const handleRequestPayment = async () => {
    const amount = parseFloat(paymentAmount)
    if (!amount || amount <= 0) return

    setSubmittingPayment(true)
    try {
      const response = await fetch('/api/supplier/payments/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, notes: paymentNotes || undefined })
      })

      const result = await response.json()

      if (result.success) {
        setPaymentSuccess(`Solicitud ${result.data.requestNumber} creada exitosamente`)
        setShowPaymentModal(false)
        setPaymentAmount('')
        setPaymentNotes('')
        fetchDashboard()
        setTimeout(() => setPaymentSuccess(''), 5000)
      } else {
        setError(result.error)
      }
    } catch {
      setError('Error al crear solicitud')
    } finally {
      setSubmittingPayment(false)
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value)

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-600 via-cyan-600 to-blue-700 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-white animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-600 via-cyan-600 to-blue-700 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-white mx-auto mb-4" />
          <p className="text-white text-lg">{error || 'Error al cargar dashboard'}</p>
          <button
            onClick={() => router.push('/supplier/login')}
            className="mt-4 px-6 py-2 bg-white text-teal-600 rounded-lg font-medium"
          >
            Volver al login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header - Responsive */}
      <header className="bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 text-white">
        <div className="px-4 py-4 md:px-8 md:py-6 lg:px-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-11 h-11 md:w-14 md:h-14 bg-white/20 rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 md:w-7 md:h-7" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg md:text-2xl font-bold truncate">{data.supplier.name}</h1>
                <p className="text-white/70 text-xs md:text-sm">Codigo: {data.supplier.code}</p>
              </div>
            </div>
            <button
              onClick={fetchDashboard}
              className="p-2.5 md:p-3 hover:bg-white/10 active:bg-white/20 rounded-xl transition-colors touch-manipulation"
              title="Actualizar"
            >
              <RefreshCcw className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Success Message */}
      <AnimatePresence>
        {paymentSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            {paymentSuccess}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content - Responsive */}
      <main className="px-4 py-5 md:px-8 md:py-8 lg:px-12 space-y-5 md:space-y-8">
        {/* Desktop Layout: Wallet + Stats Side by Side */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-8">
          {/* Wallet Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl md:rounded-3xl p-5 md:p-8 text-white shadow-xl lg:h-fit"
          >
          <div className="flex items-start justify-between mb-5 md:mb-6">
            <div>
              <p className="text-white/70 text-xs md:text-sm mb-1">Saldo Disponible</p>
              <p className="text-3xl md:text-4xl font-bold">{formatCurrency(data.wallet.available)}</p>
            </div>
            <div className="w-12 h-12 md:w-14 md:h-14 bg-white/20 rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0">
              <Wallet className="w-6 h-6 md:w-7 md:h-7" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 md:gap-4 mb-5 md:mb-6">
            <div className="bg-white/10 rounded-xl p-2.5 md:p-3">
              <p className="text-white/60 text-[10px] md:text-xs">En Proceso</p>
              <p className="text-sm md:text-lg font-bold truncate">{formatCurrency(data.wallet.pending)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-2.5 md:p-3">
              <p className="text-white/60 text-[10px] md:text-xs">Total Ganado</p>
              <p className="text-sm md:text-lg font-bold truncate">{formatCurrency(data.wallet.totalEarned)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-2.5 md:p-3">
              <p className="text-white/60 text-[10px] md:text-xs">Total Pagado</p>
              <p className="text-sm md:text-lg font-bold truncate">{formatCurrency(data.wallet.totalPaid)}</p>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowPaymentModal(true)}
            disabled={data.wallet.available <= 0 || data.payments.pendingRequests > 0}
            className="w-full py-4 bg-white text-teal-600 rounded-xl md:rounded-2xl font-bold text-base md:text-lg shadow-lg active:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 touch-manipulation min-h-[52px]"
          >
            <DollarSign className="w-5 h-5" />
            {data.payments.pendingRequests > 0
              ? 'Solicitud en proceso'
              : 'Solicitar Cobro'}
          </motion.button>
        </motion.div>

          {/* Stats Grid - Desktop: 2x2 on right side */}
          <div className="grid grid-cols-2 gap-3 md:gap-4 mt-5 lg:mt-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl p-4 md:p-5 shadow-sm"
          >
            <div className="flex items-center gap-2 md:gap-3 mb-2">
              <div className="w-9 h-9 md:w-10 md:h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg md:rounded-xl flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 md:w-5 md:h-5 text-amber-600" />
              </div>
            </div>
            <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{data.orders.pending + data.orders.received}</p>
            <p className="text-xs md:text-sm text-gray-500">Pendientes</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl p-4 md:p-5 shadow-sm"
          >
            <div className="flex items-center gap-2 md:gap-3 mb-2">
              <div className="w-9 h-9 md:w-10 md:h-10 bg-green-100 dark:bg-green-900/30 rounded-lg md:rounded-xl flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
              </div>
            </div>
            <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{data.orders.active}</p>
            <p className="text-xs md:text-sm text-gray-500">En Venta</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl p-4 md:p-5 shadow-sm"
          >
            <div className="flex items-center gap-2 md:gap-3 mb-2">
              <div className="w-9 h-9 md:w-10 md:h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg md:rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{data.orders.total}</p>
            <p className="text-xs md:text-sm text-gray-500">Total Ordenes</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl p-4 md:p-5 shadow-sm"
          >
            <div className="flex items-center gap-2 md:gap-3 mb-2">
              <div className="w-9 h-9 md:w-10 md:h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg md:rounded-xl flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-purple-600" />
              </div>
            </div>
            <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white truncate">{formatCurrency(data.sales30Days)}</p>
            <p className="text-xs md:text-sm text-gray-500">Ventas (30d)</p>
          </motion.div>
          </div>
        </div>

        {/* Recent Transactions - Responsive */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl p-4 md:p-6 lg:p-8 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-base md:text-xl font-bold text-gray-900 dark:text-white">
              Transacciones Recientes
            </h2>
            <button
              onClick={() => router.push('/dashboard/supplier/payments')}
              className="text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              Ver todas
            </button>
          </div>

          {data.recentTransactions.length === 0 ? (
            <div className="text-center py-6 md:py-8 text-gray-500 text-sm">
              No hay transacciones recientes
            </div>
          ) : (
            <div className="space-y-2 md:space-y-3">
              {data.recentTransactions.slice(0, 8).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 md:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-2.5 md:gap-4 min-w-0 flex-1">
                    <div className={`w-9 h-9 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center flex-shrink-0 ${
                      tx.type === 'sale' ? 'bg-green-100 dark:bg-green-900/30' :
                      tx.type === 'payment' ? 'bg-blue-100 dark:bg-blue-900/30' :
                      tx.type === 'return' ? 'bg-red-100 dark:bg-red-900/30' :
                      'bg-gray-100 dark:bg-gray-600'
                    }`}>
                      {tx.type === 'sale' ? (
                        <ArrowUpRight className="w-4 h-4 md:w-6 md:h-6 text-green-600" />
                      ) : tx.type === 'payment' ? (
                        <ArrowDownRight className="w-4 h-4 md:w-6 md:h-6 text-blue-600" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 md:w-6 md:h-6 text-red-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between md:justify-start md:gap-4">
                        <p className="font-medium text-sm md:text-base text-gray-900 dark:text-white">
                          {tx.type === 'sale' ? 'Venta' :
                           tx.type === 'payment' ? 'Pago Recibido' :
                           tx.type === 'return' ? 'Devolucion' :
                           tx.type === 'received' ? 'Recepcion' : tx.type}
                        </p>
                        <span className="hidden md:inline text-sm text-gray-500">
                          {formatDate(tx.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] md:text-sm text-gray-500 truncate">
                        {tx.posOrderNumber || tx.orderNumber || tx.notes || formatDate(tx.createdAt)}
                      </p>
                    </div>
                  </div>
                  <p className={`font-bold text-sm md:text-lg ml-2 flex-shrink-0 ${
                    tx.type === 'sale' ? 'text-green-600' :
                    tx.type === 'return' ? 'text-red-600' :
                    'text-gray-900 dark:text-white'
                  }`}>
                    {tx.type === 'sale' ? '+' : tx.type === 'return' ? '-' : ''}
                    {formatCurrency(Math.abs(tx.amount))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </main>

      {/* Payment Request Modal - Mobile Bottom Sheet */}
      <AnimatePresence>
        {showPaymentModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50"
            onClick={() => setShowPaymentModal(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 1 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 1 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-t-3xl md:rounded-2xl p-5 md:p-6 w-full md:max-w-md md:m-4 shadow-xl max-h-[90vh] overflow-y-auto"
            >
              {/* Handle Bar - Mobile Only */}
              <div className="flex justify-center mb-3 md:hidden">
                <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
              </div>

              <div className="flex items-center justify-between mb-5 md:mb-6">
                <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                  Solicitar Cobro
                </h2>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="p-2.5 hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors touch-manipulation"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="mb-5 md:mb-6">
                <p className="text-xs md:text-sm text-gray-500 mb-1.5">Saldo disponible</p>
                <p className="text-2xl md:text-3xl font-bold text-teal-600">
                  {formatCurrency(data.wallet.available)}
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-xl text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Monto a solicitar
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      max={data.wallet.available}
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
                        onClick={() => setPaymentAmount((data.wallet.available * pct / 100).toFixed(2))}
                        className="flex-1 py-2.5 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl active:bg-gray-200 dark:active:bg-gray-600 transition-colors touch-manipulation"
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
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Agregar notas..."
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                  />
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleRequestPayment}
                  disabled={submittingPayment || !paymentAmount || parseFloat(paymentAmount) <= 0 || parseFloat(paymentAmount) > data.wallet.available}
                  className="w-full py-4 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl font-bold text-base md:text-lg shadow-lg active:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 touch-manipulation min-h-[52px]"
                >
                  {submittingPayment ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <DollarSign className="w-5 h-5" />
                      Solicitar {paymentAmount ? formatCurrency(parseFloat(paymentAmount)) : 'Cobro'}
                    </>
                  )}
                </motion.button>
              </div>

              {/* Safe area padding for iOS */}
              <div className="h-safe-area-bottom md:hidden" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
