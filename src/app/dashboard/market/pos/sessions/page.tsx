'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  Search,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  User,
  Calendar,
  DollarSign,
  ShoppingCart,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Monitor,
  Loader2,
  Receipt,
  TrendingUp,
  TrendingDown,
  X,
  Printer,
  Package,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  Eye,
  FileText,
  Hash,
  Percent,
  Tag
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { useMarketExchangeRates } from '@/hooks/useMarketExchangeRates'

interface Session {
  id: number
  sessionCode: string
  terminalId: number
  terminalCode: string
  terminalName: string
  openedBy: number
  openedByName: string
  closedBy: number | null
  closedByName: string | null
  openedAt: string
  closedAt: string | null
  openingCash: {
    usd: number
    cup: number
    mlc: number
  }
  closingCash: {
    usd: number
    cup: number
    mlc: number
  } | null
  totalSales: number
  totalRefunds: number
  totalOrders: number
  cashDifference: number | null
  status: string
  openingNotes: string | null
  closingNotes: string | null
}

interface OrderLine {
  id: number
  productId: number
  productName: string
  productSku: string | null
  barcode?: string
  imageUrl?: string
  quantity: number
  unitPrice: number
  originalPrice?: number
  discountPercent: number
  discountAmount: number
  subtotal: number
  total: number
  promotionName?: string
}

interface OrderPayment {
  id: number
  method: string
  amount: number
  amountTendered: number | null
  changeAmount: number | null
  currency: string
  reference?: string
  createdAt: string
}

interface OrderCustomer {
  id: number
  name: string
  phone?: string
  email?: string
}

interface Order {
  id: number
  orderNumber: string
  customerName: string | null
  customer?: OrderCustomer | null
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  currency: string
  status: string
  createdAt: string
  createdByName: string
  payments: OrderPayment[]
  lines?: OrderLine[]
}

interface Terminal {
  id: number
  code: string
  name: string
}

export default function POSSessionsHistoryPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const exchangeRates = useMarketExchangeRates()
  const USD_CUP = exchangeRates?.USD_CUP || 505
  const [sessions, setSessions] = useState<Session[]>([])
  const [terminals, setTerminals] = useState<Terminal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [terminalFilter, setTerminalFilter] = useState<string>('all')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const limit = 20

  // Detail panel state
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [sessionOrders, setSessionOrders] = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)


  const fetchSessions = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', String(limit))
      params.set('offset', String((page - 1) * limit))

      if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      }
      if (terminalFilter !== 'all') {
        params.set('terminalId', terminalFilter)
      }

      const response = await fetch(`/api/market/pos/sessions?${params}`)
      const data = await response.json()

      if (data.success) {
        setSessions(data.data.sessions)
        setTotal(data.data.total)
      }
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTerminals = async () => {
    try {
      const response = await fetch('/api/market/pos/terminals')
      const data = await response.json()
      if (data.success) {
        setTerminals(data.data.terminals)
      }
    } catch (error) {
      console.error('Error fetching terminals:', error)
    }
  }

  const fetchSessionOrders = async (sessionId: number) => {
    setLoadingOrders(true)
    try {
      const response = await fetch(`/api/market/pos/orders?sessionId=${sessionId}`)
      const data = await response.json()
      if (data.success) {
        setSessionOrders(data.data.orders)
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoadingOrders(false)
    }
  }

  useEffect(() => {
    fetchTerminals()
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [statusFilter, terminalFilter, page])

  const handleSelectSession = (session: Session) => {
    setSelectedSession(session)
    fetchSessionOrders(session.id)
  }

  const handleSelectOrder = (order: Order) => {
    // Navigate to order detail page
    router.push(`/dashboard/market/pos/orders/${order.id}`)
  }

  const handleReprintReceipt = (order: Order) => {
    if (selectedSession) {
      window.open(`/dashboard/market/pos/${selectedSession.terminalId}/receipt?orderId=${order.id}&orderNumber=${order.orderNumber}`, '_blank')
    }
  }

  const closePanel = () => {
    setSelectedSession(null)
    setSessionOrders([])
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

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    if (currency === 'CUP') {
      return `${amount.toLocaleString('es-ES', { maximumFractionDigits: 0 })} CUP`
    }
    if (currency === 'MLC') {
      return `$${amount.toFixed(2)} MLC`
    }
    return `$${amount.toFixed(2)} USD`
  }

  const getDuration = (openedAt: string, closedAt: string | null) => {
    const start = new Date(openedAt)
    const end = closedAt ? new Date(closedAt) : new Date()
    const diff = end.getTime() - start.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Banknote className="w-4 h-4" />
      case 'card': return <CreditCard className="w-4 h-4" />
      case 'transfer': return <ArrowRightLeft className="w-4 h-4" />
      default: return <DollarSign className="w-4 h-4" />
    }
  }

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Efectivo'
      case 'card': return 'Tarjeta'
      case 'transfer': return 'Transferencia'
      case 'credit': return 'Crédito'
      default: return method
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      voided: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      refunded: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
    }
    const labels: Record<string, string> = {
      paid: 'Pagada',
      voided: 'Anulada',
      refunded: 'Reembolsada',
      draft: 'Borrador'
    }
    return (
      <span className={cn('px-2 py-1 rounded-full text-xs font-medium', styles[status as keyof typeof styles] || styles.draft)}>
        {labels[status] || status}
      </span>
    )
  }

  const filteredSessions = sessions.filter(session => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      session.sessionCode.toLowerCase().includes(searchLower) ||
      session.terminalName.toLowerCase().includes(searchLower) ||
      session.openedByName?.toLowerCase().includes(searchLower) ||
      session.closedByName?.toLowerCase().includes(searchLower)
    )
  })

  const stats = {
    total: total,
    open: sessions.filter(s => s.status === 'open').length,
    closed: sessions.filter(s => s.status === 'closed').length,
    totalSales: sessions.reduce((acc, s) => acc + s.totalSales, 0),
    totalOrders: sessions.reduce((acc, s) => acc + s.totalOrders, 0)
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
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <Link href="/dashboard/market/pos">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      'p-2 rounded-xl transition-colors',
                      theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                    )}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </motion.button>
                </Link>
                <div>
                  <h1 className={cn(
                    "text-2xl font-bold",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Historial de Sesiones
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Todas las sesiones de caja con sus órdenes y cierres
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={fetchSessions}
                disabled={loading}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                  theme === 'dark'
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                Actualizar
              </motion.button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
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
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-3 rounded-xl', theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50')}>
                      <Clock className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Sesiones</p>
                      <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {stats.total}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

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
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-600"></div>
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-3 rounded-xl', theme === 'dark' ? 'bg-green-900/30' : 'bg-green-50')}>
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Ventas Totales</p>
                      <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        ${stats.totalSales.toFixed(2)} USD
                      </p>
                      <p className="text-xs text-green-600">{Math.round(stats.totalSales * USD_CUP).toLocaleString('es-ES')} CUP</p>
                    </div>
                  </div>
                </div>
              </motion.div>

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
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-3 rounded-xl', theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-50')}>
                      <ShoppingCart className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Órdenes</p>
                      <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {stats.totalOrders}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

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
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-600"></div>
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-3 rounded-xl', theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-50')}>
                      <Receipt className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Sesiones Abiertas</p>
                      <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {stats.open}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Filters */}
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
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por código, terminal o usuario..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={cn(
                      'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                        : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                    )}
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                      : 'bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20'
                  )}
                >
                  <option value="all">Todos los estados</option>
                  <option value="open">Abiertas</option>
                  <option value="closed">Cerradas</option>
                </select>
                <select
                  value={terminalFilter}
                  onChange={(e) => { setTerminalFilter(e.target.value); setPage(1) }}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                      : 'bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20'
                  )}
                >
                  <option value="all">Todos los terminales</option>
                  {terminals.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </motion.div>

            {/* Sessions List */}
            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : filteredSessions.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'rounded-2xl border shadow-xl p-12 text-center',
                    theme === 'dark'
                      ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                      : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                  )}
                >
                  <Clock className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-xl font-bold mb-2">No hay sesiones</h3>
                  <p className="text-gray-500">
                    {search || statusFilter !== 'all' || terminalFilter !== 'all'
                      ? 'No se encontraron sesiones con los filtros aplicados'
                      : 'Aún no se han registrado sesiones de caja'}
                  </p>
                </motion.div>
              ) : (
                filteredSessions.map((session, index) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => handleSelectSession(session)}
                    className={cn(
                      'rounded-2xl border shadow-xl overflow-hidden cursor-pointer transition-all',
                      theme === 'dark'
                        ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-blue-500/50'
                        : 'bg-gradient-to-br from-slate-50 to-white border-slate-200 hover:border-blue-400',
                      selectedSession?.id === session.id && 'ring-2 ring-blue-500'
                    )}
                  >
                    <div className="p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            'w-12 h-12 rounded-xl flex items-center justify-center',
                            session.status === 'open'
                              ? theme === 'dark' ? 'bg-green-900/30' : 'bg-green-50'
                              : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                          )}>
                            {session.status === 'open' ? (
                              <Clock className="w-6 h-6 text-green-600" />
                            ) : (
                              <CheckCircle className="w-6 h-6 text-gray-500" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className={cn('font-bold text-lg', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                {session.sessionCode}
                              </h3>
                              <span className={cn(
                                'px-2 py-0.5 rounded-full text-xs font-medium',
                                session.status === 'open'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                              )}>
                                {session.status === 'open' ? 'Abierta' : 'Cerrada'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <Monitor className="w-4 h-4" />
                                {session.terminalName}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {formatDate(session.openedAt)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {getDuration(session.openedAt, session.closedAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="hidden md:flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Ventas</p>
                              <p className="font-bold text-green-500">${session.totalSales.toFixed(2)} USD</p>
                              <p className="text-[10px] text-green-600">{Math.round(session.totalSales * USD_CUP).toLocaleString('es-ES')} CUP</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Órdenes</p>
                              <p className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                {session.totalOrders}
                              </p>
                            </div>
                            {session.cashDifference !== null && (
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Diferencia</p>
                                <p className={cn(
                                  'font-bold flex items-center gap-1 justify-end',
                                  session.cashDifference === 0 ? 'text-green-600' :
                                  session.cashDifference > 0 ? 'text-blue-600' : 'text-red-600'
                                )}>
                                  {session.cashDifference > 0 ? <TrendingUp className="w-4 h-4" /> :
                                   session.cashDifference < 0 ? <TrendingDown className="w-4 h-4" /> :
                                   <CheckCircle className="w-4 h-4" />}
                                  ${Math.abs(session.cashDifference).toFixed(2)}
                                </p>
                              </div>
                            )}
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Pagination */}
            {total > limit && (
              <div className="flex items-center justify-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className={cn(
                    'px-4 py-2 rounded-xl transition-colors',
                    page === 1 ? 'opacity-50 cursor-not-allowed' :
                    theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  )}
                >
                  Anterior
                </motion.button>
                <span className="text-gray-500">Página {page} de {Math.ceil(total / limit)}</span>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(total / limit)}
                  className={cn(
                    'px-4 py-2 rounded-xl transition-colors',
                    page >= Math.ceil(total / limit) ? 'opacity-50 cursor-not-allowed' :
                    theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  )}
                >
                  Siguiente
                </motion.button>
              </div>
            )}
          </motion.div>
        </div>

        {/* Session Detail Panel */}
        <AnimatePresence>
          {selectedSession && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closePanel}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className={cn(
                  'fixed right-0 top-0 h-full w-full max-w-2xl z-50 shadow-2xl overflow-hidden flex flex-col',
                  theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                )}
              >
                {/* Panel Header */}
                <div className={cn(
                  'flex items-center justify-between px-6 py-4 border-b flex-shrink-0',
                  theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
                )}>
                  <div>
                    <h2 className="text-xl font-bold">{selectedSession.sessionCode}</h2>
                    <p className="text-sm text-gray-500">{selectedSession.terminalName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedSession.status === 'closed' && (
                      <button
                        onClick={() => {
                          window.open(`/dashboard/market/pos/${selectedSession.terminalId}/session-receipt?sessionId=${selectedSession.id}`, '_blank')
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-blue-600 hover:to-blue-700 transition-all"
                      >
                        <Printer className="w-4 h-4" />
                        Imprimir Cierre
                      </button>
                    )}
                    <button
                      onClick={closePanel}
                      className={cn('p-2 rounded-lg transition-colors', theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100')}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Panel Content */}
                <div className="flex-1 overflow-auto p-6 space-y-6">
                  {/* Session Info */}
                  <div className={cn('rounded-xl p-4', theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50')}>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Duración</p>
                        <p className="font-medium">{getDuration(selectedSession.openedAt, selectedSession.closedAt)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Estado</p>
                        <span className={cn(
                          'inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-1',
                          selectedSession.status === 'open'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        )}>
                          {selectedSession.status === 'open' ? 'Abierta' : 'Cerrada'}
                        </span>
                      </div>
                      <div>
                        <p className="text-gray-500">Abierta por</p>
                        <p className="font-medium">{selectedSession.openedByName}</p>
                        <p className="text-xs text-gray-400">{formatDate(selectedSession.openedAt)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Cerrada por</p>
                        {selectedSession.closedByName ? (
                          <>
                            <p className="font-medium">{selectedSession.closedByName}</p>
                            <p className="text-xs text-gray-400">{selectedSession.closedAt && formatDate(selectedSession.closedAt)}</p>
                          </>
                        ) : (
                          <p className="text-gray-400 italic">Aún abierta</p>
                        )}
                      </div>
                    </div>

                    {/* Cash Summary */}
                    <div className={cn('mt-4 pt-4 border-t', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <p className="text-xs text-gray-500 mb-1">Total Ventas</p>
                          <p className="text-2xl font-bold text-green-500">${selectedSession.totalSales.toFixed(2)} USD</p>
                          <p className="text-xs text-green-600">{Math.round(selectedSession.totalSales * USD_CUP).toLocaleString('es-ES')} CUP</p>
                          <p className="text-xs text-gray-400">{selectedSession.totalOrders} órdenes</p>
                        </div>
                        {selectedSession.cashDifference !== null && (
                          <div className="text-center">
                            <p className="text-xs text-gray-500 mb-1">Diferencia</p>
                            <p className={cn(
                              'text-2xl font-bold',
                              selectedSession.cashDifference === 0 ? 'text-green-500' :
                              selectedSession.cashDifference > 0 ? 'text-blue-500' : 'text-red-500'
                            )}>
                              {selectedSession.cashDifference >= 0 ? '+' : ''}${selectedSession.cashDifference.toFixed(2)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Orders List */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5" />
                      Órdenes de la Sesión ({sessionOrders.length})
                    </h3>

                    {loadingOrders ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                      </div>
                    ) : sessionOrders.length === 0 ? (
                      <div className={cn(
                        'text-center py-8 rounded-xl border-2 border-dashed',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <ShoppingCart className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                        <p className="text-gray-500">No hay órdenes en esta sesión</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {sessionOrders.map(order => (
                          <motion.div
                            key={order.id}
                            whileHover={{ scale: 1.01 }}
                            onClick={() => handleSelectOrder(order)}
                            className={cn(
                              'rounded-xl border p-4 cursor-pointer transition-all',
                              theme === 'dark'
                                ? 'bg-gray-800 border-gray-700 hover:border-blue-500'
                                : 'bg-gray-50 border-gray-200 hover:border-blue-400'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  'w-10 h-10 rounded-lg flex items-center justify-center',
                                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                                )}>
                                  <Receipt className="w-5 h-5 text-gray-500" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold">{order.orderNumber}</span>
                                    {getStatusBadge(order.status)}
                                  </div>
                                  <p className="text-sm text-gray-500">
                                    {formatTime(order.createdAt)} • {order.customerName || 'Cliente general'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="font-bold text-lg">{formatCurrency(order.totalAmount, order.currency)}</p>
                                  {order.currency !== 'CUP' && (
                                    <p className="text-xs text-green-600">{Math.round(order.totalAmount * USD_CUP).toLocaleString('es-ES')} CUP</p>
                                  )}
                                  <div className="flex flex-wrap gap-1 justify-end">
                                    {order.payments?.slice(0, 2).map((p, i) => (
                                      <span
                                        key={i}
                                        className={cn(
                                          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs',
                                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                                        )}
                                      >
                                        {getPaymentMethodIcon(p.method)}
                                        <span>{p.currency}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <Eye className="w-5 h-5 text-blue-500" />
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

      </DashboardLayout>
    </ProtectedRoute>
  )
}
