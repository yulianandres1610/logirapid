'use client'

import { useState, useEffect, useCallback } from 'react'
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
  Search,
  RefreshCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  FileText,
  Building2
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

interface Supplier {
  id: number
  code: string
  name: string
  email: string | null
  phone: string | null
  balanceAvailable: number
  balancePending: number
  totalEarned: number
  totalPaid: number
  pendingRequests: number
  pendingAmount: number
}

interface Stats {
  pending: { count: number; amount: number }
  approved: { count: number; amount: number }
  paid: { count: number; amount: number }
}

interface SuppliersSummary {
  totalSuppliers: number
  suppliersWithBalance: number
  totalAvailable: number
  totalPending: number
  totalPaid: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pendiente', color: 'amber', icon: Clock },
  approved: { label: 'Aprobada', color: 'blue', icon: CheckCircle },
  paid: { label: 'Pagada', color: 'emerald', icon: DollarSign },
  rejected: { label: 'Rechazada', color: 'red', icon: XCircle }
}

const PAYMENT_METHODS = [
  { value: 'transfer', label: 'Transferencia Bancaria' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'check', label: 'Cheque' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'other', label: 'Otro' }
]

type TabType = 'pending' | 'history' | 'suppliers'

export default function ConsignmentPaymentsPage() {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [suppliersSummary, setSuppliersSummary] = useState<SuppliersSummary | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('pending')
  const [search, setSearch] = useState('')
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Action modal state
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null)
  const [showActionModal, setShowActionModal] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'pay' | null>(null)
  const [paymentMethod, setPaymentMethod] = useState('transfer')
  const [paymentReference, setPaymentReference] = useState('')
  const [rejectNotes, setRejectNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Direct payment modal state
  const [showDirectPaymentModal, setShowDirectPaymentModal] = useState(false)
  const [directPaymentSupplier, setDirectPaymentSupplier] = useState<Supplier | null>(null)
  const [directPaymentAmount, setDirectPaymentAmount] = useState('')
  const [directPaymentMethod, setDirectPaymentMethod] = useState('transfer')
  const [directPaymentReference, setDirectPaymentReference] = useState('')
  const [directPaymentNotes, setDirectPaymentNotes] = useState('')

  const fetchRequests = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const statusFilter = activeTab === 'pending' ? 'pending,approved' : activeTab === 'history' ? 'paid,rejected' : ''
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })
      if (statusFilter) params.set('status', statusFilter)
      if (search) params.set('search', search)

      const response = await fetch(`/api/consignments/payments/requests?${params}`)
      const data = await response.json()

      if (data.success) {
        setRequests(data.data.requests)
        setStats(data.data.stats)
        if (data.data.pagination) {
          setPagination(data.data.pagination)
        }
        setLastUpdated(new Date())
      }
    } catch {
      console.error('Error fetching requests')
    } finally {
      if (!silent) setLoading(false)
      else setIsRefreshing(false)
    }
  }, [activeTab, pagination.page, pagination.limit, search])

  const fetchSuppliers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)

      const response = await fetch(`/api/consignments/payments/suppliers?${params}`)
      const data = await response.json()

      if (data.success) {
        setSuppliers(data.data.suppliers)
        setSuppliersSummary(data.data.summary)
        setLastUpdated(new Date())
      }
    } catch {
      console.error('Error fetching suppliers')
    } finally {
      if (!silent) setLoading(false)
      else setIsRefreshing(false)
    }
  }, [search])

  useEffect(() => {
    if (activeTab === 'suppliers') {
      fetchSuppliers()
    } else {
      fetchRequests()
    }
  }, [activeTab, fetchRequests, fetchSuppliers])

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (activeTab === 'suppliers') {
        fetchSuppliers()
      } else {
        if (pagination.page === 1) {
          fetchRequests()
        } else {
          setPagination(p => ({ ...p, page: 1 }))
        }
      }
    }, 300)
    return () => clearTimeout(debounce)
  }, [search])

  const handleManualRefresh = () => {
    if (activeTab === 'suppliers') {
      fetchSuppliers(true)
    } else {
      fetchRequests(true)
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

  const handleDirectPayment = async () => {
    if (!directPaymentSupplier) return

    const amount = parseFloat(directPaymentAmount)
    if (isNaN(amount) || amount <= 0) {
      setError('El monto debe ser mayor a cero')
      return
    }

    if (amount > directPaymentSupplier.balanceAvailable) {
      setError('El monto excede el saldo disponible')
      return
    }

    setProcessing(true)
    setError('')

    try {
      const response = await fetch('/api/consignments/payments/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: directPaymentSupplier.id,
          amount,
          paymentMethod: directPaymentMethod,
          paymentReference: directPaymentReference || undefined,
          notes: directPaymentNotes || undefined
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(data.message)
        setShowDirectPaymentModal(false)
        setDirectPaymentSupplier(null)
        setDirectPaymentAmount('')
        setDirectPaymentMethod('transfer')
        setDirectPaymentReference('')
        setDirectPaymentNotes('')
        if (activeTab === 'suppliers') {
          fetchSuppliers()
        } else {
          fetchRequests()
        }
        setTimeout(() => setSuccess(''), 5000)
      } else {
        setError(data.error)
      }
    } catch {
      setError('Error al procesar el pago')
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

  const openDirectPaymentModal = (supplier?: Supplier) => {
    if (supplier) {
      setDirectPaymentSupplier(supplier)
    } else {
      setDirectPaymentSupplier(null)
    }
    setDirectPaymentAmount('')
    setDirectPaymentMethod('transfer')
    setDirectPaymentReference('')
    setDirectPaymentNotes('')
    setShowDirectPaymentModal(true)
    setError('')
  }

  const setQuickAmount = (percentage: number) => {
    if (directPaymentSupplier) {
      const amount = (directPaymentSupplier.balanceAvailable * percentage) / 100
      setDirectPaymentAmount(amount.toFixed(2))
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

  const getTotalPendingAmount = () => {
    return (stats?.pending.amount || 0) + (stats?.approved.amount || 0)
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Success Message */}
            <AnimatePresence>
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-xl flex items-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  {success}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Pendientes */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onClick={() => setActiveTab('pending')}
                className={cn(
                  'relative overflow-hidden cursor-pointer',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl',
                  activeTab === 'pending' && 'ring-2 ring-amber-500'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
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
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-black'
                        )}>Pendientes</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats?.pending.count || 0}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>Monto: {formatCurrency(stats?.pending.amount || 0)}</span>
                  </div>
                </div>
              </motion.div>

              {/* Aprobadas */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                onClick={() => setActiveTab('pending')}
                className={cn(
                  'relative overflow-hidden cursor-pointer',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
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
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-black'
                        )}>Aprobadas</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats?.approved.count || 0}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>Monto: {formatCurrency(stats?.approved.amount || 0)}</span>
                  </div>
                </div>
              </motion.div>

              {/* Pagadas */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                onClick={() => setActiveTab('history')}
                className={cn(
                  'relative overflow-hidden cursor-pointer',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl',
                  activeTab === 'history' && 'ring-2 ring-emerald-500'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
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
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-black'
                        )}>Pagadas</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats?.paid.count || 0}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>Total: {formatCurrency(stats?.paid.amount || 0)}</span>
                  </div>
                </div>
              </motion.div>

              {/* Por Pagar Total */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                onClick={() => setActiveTab('suppliers')}
                className={cn(
                  'relative overflow-hidden cursor-pointer',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl',
                  activeTab === 'suppliers' && 'ring-2 ring-purple-500'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-purple-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-purple-900/30 border border-purple-800/50'
                          : 'bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200'
                      )}>
                        <Wallet className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-black'
                        )}>Por Pagar</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{suppliersSummary?.suppliersWithBalance || 0}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>Total: {formatCurrency(suppliersSummary?.totalAvailable || getTotalPendingAmount())}</span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Tabs */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={cn(
                'p-4 rounded-2xl border shadow-xl',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Tab buttons */}
                <div className="flex gap-2">
                  {[
                    { key: 'pending' as TabType, label: 'Solicitudes', icon: Clock },
                    { key: 'history' as TabType, label: 'Historial', icon: FileText },
                    { key: 'suppliers' as TabType, label: 'Por Proveedor', icon: Building2 }
                  ].map((tab) => {
                    const TabIcon = tab.icon
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all',
                          activeTab === tab.key
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                            : theme === 'dark'
                              ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        )}
                      >
                        <TabIcon className="w-4 h-4" />
                        {tab.label}
                      </button>
                    )
                  })}
                </div>

                <div className="flex-1" />

                {/* Search */}
                <div className="flex-1 relative min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder={activeTab === 'suppliers' ? 'Buscar proveedor...' : 'Buscar solicitud...'}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={cn(
                      'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                        : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                    )}
                  />
                </div>

                {/* Refresh */}
                <div className="flex items-center gap-2">
                  {lastUpdated && (
                    <span className="text-xs text-gray-400 hidden sm:inline">
                      {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleManualRefresh}
                    disabled={loading || isRefreshing}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                      isRefreshing && 'opacity-75'
                    )}
                  >
                    <RefreshCw className={cn('w-4 h-4', (loading || isRefreshing) && 'animate-spin')} />
                  </motion.button>
                </div>

                {/* Nuevo Pago */}
                <Link href="/dashboard/market/consignments/payments/direct">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/25"
                  >
                    <Plus className="w-5 h-5" />
                    Nuevo Pago
                  </motion.button>
                </Link>
              </div>
            </motion.div>

            {/* Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className={cn(
                'rounded-2xl border shadow-xl overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              {/* Table for Requests */}
              {activeTab !== 'suppliers' && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={cn(
                        'border-b',
                        theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                      )}>
                        <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider"># Solicitud</th>
                        <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedor</th>
                        <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                        <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                        <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                        <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {loading ? (
                        [...Array(5)].map((_, i) => (
                          <tr key={i}>
                            <td colSpan={6} className="py-4 px-4">
                              <div className="animate-pulse flex items-center gap-3">
                                <div className="w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                                <div className="flex-1">
                                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : requests.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center">
                            <Wallet className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                            <p className="text-gray-500 dark:text-gray-400">
                              {activeTab === 'pending' ? 'No hay solicitudes pendientes' : 'No hay pagos en el historial'}
                            </p>
                          </td>
                        </tr>
                      ) : (
                        requests.map((request, index) => {
                          const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending
                          const StatusIcon = statusConfig.icon

                          return (
                            <motion.tr
                              key={request.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.02 }}
                              className={cn(
                                'group transition-colors',
                                theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                              )}
                            >
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-gray-400" />
                                  <span className="font-mono font-medium text-gray-900 dark:text-white">
                                    {request.requestNumber}
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                <div>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{request.supplier.name}</p>
                                  <p className="text-xs text-gray-500 font-mono">{request.supplier.code}</p>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-right">
                                <span className="text-sm font-bold text-gray-900 dark:text-white">
                                  {formatCurrency(request.amountRequested)}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                  <span className="text-sm text-gray-600 dark:text-gray-300">
                                    {formatDate(request.requestedAt)}
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <span className={cn(
                                  'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium',
                                  statusConfig.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                                  statusConfig.color === 'blue' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                                  statusConfig.color === 'emerald' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                                  statusConfig.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                )}>
                                  <StatusIcon className="w-3.5 h-3.5" />
                                  {statusConfig.label}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {request.status === 'pending' && (
                                    <>
                                      <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => openActionModal(request, 'approve')}
                                        className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                        title="Aprobar"
                                      >
                                        <Check className="w-4 h-4 text-blue-600" />
                                      </motion.button>
                                      <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => openActionModal(request, 'reject')}
                                        className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                        title="Rechazar"
                                      >
                                        <X className="w-4 h-4 text-red-500" />
                                      </motion.button>
                                    </>
                                  )}
                                  {request.status === 'approved' && (
                                    <motion.button
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => openActionModal(request, 'pay')}
                                      className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                                      title="Registrar Pago"
                                    >
                                      <CreditCard className="w-4 h-4 text-emerald-600" />
                                    </motion.button>
                                  )}
                                  {request.status === 'paid' && request.paymentMethod && (
                                    <span className="text-xs text-gray-500">
                                      {request.paymentMethod}
                                      {request.paymentReference && ` - ${request.paymentReference}`}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </motion.tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Table for Suppliers */}
              {activeTab === 'suppliers' && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={cn(
                        'border-b',
                        theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                      )}>
                        <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedor</th>
                        <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Disponible</th>
                        <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Pendiente</th>
                        <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Total Ganado</th>
                        <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Total Pagado</th>
                        <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Solicitudes</th>
                        <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {loading ? (
                        [...Array(5)].map((_, i) => (
                          <tr key={i}>
                            <td colSpan={7} className="py-4 px-4">
                              <div className="animate-pulse flex items-center gap-3">
                                <div className="w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                                <div className="flex-1">
                                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : suppliers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center">
                            <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                            <p className="text-gray-500 dark:text-gray-400">No hay proveedores con saldo</p>
                          </td>
                        </tr>
                      ) : (
                        suppliers.map((supplier, index) => (
                          <motion.tr
                            key={supplier.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                            className={cn(
                              'group transition-colors',
                              theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                            )}
                          >
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  'w-10 h-10 rounded-xl flex items-center justify-center',
                                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                )}>
                                  <User className="w-5 h-5 text-gray-500" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{supplier.name}</p>
                                  <p className="text-xs text-gray-500 font-mono">{supplier.code}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span className={cn(
                                'text-sm font-bold',
                                supplier.balanceAvailable > 0 ? 'text-emerald-600' : 'text-gray-400'
                              )}>
                                {formatCurrency(supplier.balanceAvailable)}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span className={cn(
                                'text-sm',
                                supplier.balancePending > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'
                              )}>
                                {formatCurrency(supplier.balancePending)}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span className="text-sm text-gray-600 dark:text-gray-300">
                                {formatCurrency(supplier.totalEarned)}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span className="text-sm text-gray-600 dark:text-gray-300">
                                {formatCurrency(supplier.totalPaid)}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              {supplier.pendingRequests > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                  <Clock className="w-3 h-3" />
                                  {supplier.pendingRequests}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-center">
                              {supplier.balanceAvailable > 0 && (
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => openDirectPaymentModal(supplier)}
                                  className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                                  title="Emitir Pago"
                                >
                                  <CreditCard className="w-4 h-4 text-emerald-600" />
                                </motion.button>
                              )}
                            </td>
                          </motion.tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {activeTab !== 'suppliers' && pagination.totalPages > 1 && (
                <div className={cn(
                  'flex items-center justify-between px-4 py-3 border-t',
                  theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                )}>
                  <p className="text-sm text-gray-500">
                    Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
                  </p>
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                      disabled={pagination.page === 1}
                      className={cn(
                        'p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                        theme === 'dark'
                          ? 'hover:bg-gray-700 text-gray-300'
                          : 'hover:bg-gray-200 text-gray-600'
                      )}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </motion.button>
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {pagination.page} / {pagination.totalPages}
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                      disabled={pagination.page === pagination.totalPages}
                      className={cn(
                        'p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                        theme === 'dark'
                          ? 'hover:bg-gray-700 text-gray-300'
                          : 'hover:bg-gray-200 text-gray-600'
                      )}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </motion.button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>

          {/* Action Modal */}
          <AnimatePresence>
            {showActionModal && selectedRequest && actionType && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowActionModal(false)}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                />

                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: "spring", duration: 0.3 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                >
                  <div
                    className={cn(
                      "w-full max-w-md rounded-2xl shadow-2xl border",
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-700'
                        : 'bg-white border-gray-200'
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className={cn(
                      "px-6 py-4 border-b flex items-center justify-between",
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'p-2 rounded-lg',
                          actionType === 'approve' && 'bg-blue-100 dark:bg-blue-900/30',
                          actionType === 'reject' && 'bg-red-100 dark:bg-red-900/30',
                          actionType === 'pay' && 'bg-emerald-100 dark:bg-emerald-900/30'
                        )}>
                          {actionType === 'approve' && <Check className="w-5 h-5 text-blue-600" />}
                          {actionType === 'reject' && <X className="w-5 h-5 text-red-600" />}
                          {actionType === 'pay' && <CreditCard className="w-5 h-5 text-emerald-600" />}
                        </div>
                        <div>
                          <h3 className={cn(
                            "font-semibold",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {actionType === 'approve' && 'Aprobar Solicitud'}
                            {actionType === 'reject' && 'Rechazar Solicitud'}
                            {actionType === 'pay' && 'Registrar Pago'}
                          </h3>
                          <p className="text-xs text-gray-500">#{selectedRequest.requestNumber}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowActionModal(false)}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                        )}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-6 space-y-4">
                      {error && (
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-xl text-sm flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          {error}
                        </div>
                      )}

                      {/* Request Summary */}
                      <div className={cn(
                        "p-4 rounded-xl",
                        theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                      )}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-gray-500">Proveedor</span>
                          <span className="font-medium text-gray-900 dark:text-white">{selectedRequest.supplier.name}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">Monto</span>
                          <span className="font-bold text-lg text-emerald-600">{formatCurrency(selectedRequest.amountRequested)}</span>
                        </div>
                      </div>

                      {actionType === 'pay' && (
                        <div className="space-y-4">
                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              Metodo de Pago
                            </label>
                            <select
                              value={paymentMethod}
                              onChange={(e) => setPaymentMethod(e.target.value)}
                              className={cn(
                                'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                                theme === 'dark'
                                  ? 'bg-gray-800/50 border-gray-700 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                                  : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                              )}
                            >
                              {PAYMENT_METHODS.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              Referencia (opcional)
                            </label>
                            <input
                              type="text"
                              value={paymentReference}
                              onChange={(e) => setPaymentReference(e.target.value)}
                              placeholder="Numero de transaccion, cheque, etc."
                              className={cn(
                                'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                                theme === 'dark'
                                  ? 'bg-gray-800/50 border-gray-700 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                                  : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                              )}
                            />
                          </div>
                        </div>
                      )}

                      {actionType === 'reject' && (
                        <div>
                          <label className={cn(
                            "block text-sm font-medium mb-2",
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          )}>
                            Motivo del rechazo (opcional)
                          </label>
                          <textarea
                            value={rejectNotes}
                            onChange={(e) => setRejectNotes(e.target.value)}
                            placeholder="Explique el motivo..."
                            rows={3}
                            className={cn(
                              'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all resize-none',
                              theme === 'dark'
                                ? 'bg-gray-800/50 border-gray-700 text-white focus:border-red-500 focus:ring-red-500/20'
                                : 'bg-white border-gray-200 text-gray-900 focus:border-red-500 focus:ring-red-500/20'
                            )}
                          />
                        </div>
                      )}
                    </div>

                    <div className={cn(
                      "flex gap-3 p-6 pt-4 border-t",
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowActionModal(false)}
                        className={cn(
                          "flex-1 py-3 rounded-xl font-medium transition-all",
                          theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        )}
                      >
                        Cancelar
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleAction}
                        disabled={processing}
                        className={cn(
                          "flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-white disabled:opacity-50",
                          actionType === 'approve' && 'bg-blue-500 hover:bg-blue-600',
                          actionType === 'reject' && 'bg-red-500 hover:bg-red-600',
                          actionType === 'pay' && 'bg-emerald-500 hover:bg-emerald-600'
                        )}
                      >
                        {processing ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Procesando...
                          </>
                        ) : (
                          <>
                            {actionType === 'approve' && <Check className="w-5 h-5" />}
                            {actionType === 'reject' && <X className="w-5 h-5" />}
                            {actionType === 'pay' && <CreditCard className="w-5 h-5" />}
                            {actionType === 'approve' && 'Aprobar'}
                            {actionType === 'reject' && 'Rechazar'}
                            {actionType === 'pay' && 'Confirmar Pago'}
                          </>
                        )}
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Direct Payment Modal */}
          <AnimatePresence>
            {showDirectPaymentModal && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowDirectPaymentModal(false)}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                />

                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: "spring", duration: 0.3 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                >
                  <div
                    className={cn(
                      "w-full max-w-md rounded-2xl shadow-2xl border",
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-700'
                        : 'bg-white border-gray-200'
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className={cn(
                      "px-6 py-4 border-b flex items-center justify-between",
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                          <DollarSign className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className={cn(
                            "font-semibold",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            Nuevo Pago a Proveedor
                          </h3>
                          <p className="text-xs text-gray-500">Emitir pago directo</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowDirectPaymentModal(false)}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                        )}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-6 space-y-4">
                      {error && (
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-xl text-sm flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          {error}
                        </div>
                      )}

                      {/* Supplier Selection */}
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Proveedor
                        </label>
                        {directPaymentSupplier ? (
                          <div className={cn(
                            "p-4 rounded-xl",
                            theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                          )}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  'w-10 h-10 rounded-xl flex items-center justify-center',
                                  theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200'
                                )}>
                                  <User className="w-5 h-5 text-gray-500" />
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white">{directPaymentSupplier.name}</p>
                                  <p className="text-xs text-gray-500 font-mono">{directPaymentSupplier.code}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => setDirectPaymentSupplier(null)}
                                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                              >
                                Cambiar
                              </button>
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-500">Saldo disponible</span>
                                <span className="font-bold text-lg text-emerald-600">{formatCurrency(directPaymentSupplier.balanceAvailable)}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <select
                            value=""
                            onChange={(e) => {
                              const s = suppliers.find(s => s.id === parseInt(e.target.value))
                              if (s) setDirectPaymentSupplier(s)
                            }}
                            className={cn(
                              'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                              theme === 'dark'
                                ? 'bg-gray-800/50 border-gray-700 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                                : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                            )}
                          >
                            <option value="">Seleccionar proveedor...</option>
                            {suppliers.filter(s => s.balanceAvailable > 0).map(s => (
                              <option key={s.id} value={s.id}>
                                {s.name} - {formatCurrency(s.balanceAvailable)}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {directPaymentSupplier && (
                        <>
                          {/* Amount */}
                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              Monto a pagar
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max={directPaymentSupplier.balanceAvailable}
                              value={directPaymentAmount}
                              onChange={(e) => setDirectPaymentAmount(e.target.value)}
                              placeholder="0.00"
                              className={cn(
                                'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all text-xl font-bold',
                                theme === 'dark'
                                  ? 'bg-gray-800/50 border-gray-700 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                                  : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                              )}
                            />
                            {/* Quick amount buttons */}
                            <div className="flex gap-2 mt-2">
                              {[25, 50, 75, 100].map(pct => (
                                <button
                                  key={pct}
                                  onClick={() => setQuickAmount(pct)}
                                  className={cn(
                                    'flex-1 py-1.5 text-sm font-medium rounded-lg transition-all',
                                    theme === 'dark'
                                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                                  )}
                                >
                                  {pct}%
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Payment Method */}
                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              Metodo de Pago
                            </label>
                            <select
                              value={directPaymentMethod}
                              onChange={(e) => setDirectPaymentMethod(e.target.value)}
                              className={cn(
                                'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                                theme === 'dark'
                                  ? 'bg-gray-800/50 border-gray-700 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                                  : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                              )}
                            >
                              {PAYMENT_METHODS.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* Reference */}
                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              Referencia (opcional)
                            </label>
                            <input
                              type="text"
                              value={directPaymentReference}
                              onChange={(e) => setDirectPaymentReference(e.target.value)}
                              placeholder="Numero de transaccion, cheque, etc."
                              className={cn(
                                'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                                theme === 'dark'
                                  ? 'bg-gray-800/50 border-gray-700 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                                  : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                              )}
                            />
                          </div>

                          {/* Notes */}
                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              Notas (opcional)
                            </label>
                            <textarea
                              value={directPaymentNotes}
                              onChange={(e) => setDirectPaymentNotes(e.target.value)}
                              placeholder="Notas adicionales..."
                              rows={2}
                              className={cn(
                                'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all resize-none',
                                theme === 'dark'
                                  ? 'bg-gray-800/50 border-gray-700 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                                  : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                              )}
                            />
                          </div>
                        </>
                      )}
                    </div>

                    <div className={cn(
                      "flex gap-3 p-6 pt-4 border-t",
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowDirectPaymentModal(false)}
                        className={cn(
                          "flex-1 py-3 rounded-xl font-medium transition-all",
                          theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        )}
                      >
                        Cancelar
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleDirectPayment}
                        disabled={processing || !directPaymentSupplier || !directPaymentAmount || parseFloat(directPaymentAmount) <= 0}
                        className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {processing ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Procesando...
                          </>
                        ) : (
                          <>
                            <DollarSign className="w-5 h-5" />
                            Emitir Pago
                          </>
                        )}
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
