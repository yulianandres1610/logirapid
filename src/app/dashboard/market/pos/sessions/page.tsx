'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  DollarSign,
  ShoppingCart,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Monitor,
  Loader2,
  Receipt,
  TrendingUp,
  TrendingDown,
  X
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

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

interface Order {
  id: number
  orderNumber: string
  customerName: string | null
  subtotal: number
  discountAmount: number
  totalAmount: number
  currency: string
  status: string
  createdAt: string
  createdByName: string
  payments: {
    method: string
    amount: number
    currency: string
  }[]
}

interface Terminal {
  id: number
  code: string
  name: string
}

export default function POSSessionsHistoryPage() {
  const { theme } = useTheme()
  const [sessions, setSessions] = useState<Session[]>([])
  const [terminals, setTerminals] = useState<Terminal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [terminalFilter, setTerminalFilter] = useState<string>('all')
  const [expandedSession, setExpandedSession] = useState<number | null>(null)
  const [sessionOrders, setSessionOrders] = useState<Record<number, Order[]>>({})
  const [loadingOrders, setLoadingOrders] = useState<number | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const limit = 20

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
    if (sessionOrders[sessionId]) return

    setLoadingOrders(sessionId)
    try {
      const response = await fetch(`/api/market/pos/orders?sessionId=${sessionId}`)
      const data = await response.json()

      if (data.success) {
        setSessionOrders(prev => ({
          ...prev,
          [sessionId]: data.data.orders
        }))
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoadingOrders(null)
    }
  }

  useEffect(() => {
    fetchTerminals()
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [statusFilter, terminalFilter, page])

  const handleExpandSession = (sessionId: number) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null)
    } else {
      setExpandedSession(sessionId)
      fetchSessionOrders(sessionId)
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

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    if (currency === 'CUP') {
      return `${amount.toLocaleString('es-ES')} CUP`
    }
    return `$${amount.toFixed(2)} ${currency}`
  }

  const getDuration = (openedAt: string, closedAt: string | null) => {
    const start = new Date(openedAt)
    const end = closedAt ? new Date(closedAt) : new Date()
    const diff = end.getTime() - start.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
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
                    <div className={cn(
                      'p-3 rounded-xl',
                      theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50'
                    )}>
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
                    <div className={cn(
                      'p-3 rounded-xl',
                      theme === 'dark' ? 'bg-green-900/30' : 'bg-green-50'
                    )}>
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Ventas Totales</p>
                      <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        ${stats.totalSales.toFixed(2)}
                      </p>
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
                    <div className={cn(
                      'p-3 rounded-xl',
                      theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-50'
                    )}>
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
                    <div className={cn(
                      'p-3 rounded-xl',
                      theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-50'
                    )}>
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
                {/* Search */}
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

                {/* Status Filter */}
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

                {/* Terminal Filter */}
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
            <div className="space-y-4">
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
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    No hay sesiones
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    {search || statusFilter !== 'all' || terminalFilter !== 'all'
                      ? 'No se encontraron sesiones con los filtros aplicados'
                      : 'Aún no se han registrado sesiones de caja'
                    }
                  </p>
                </motion.div>
              ) : (
                filteredSessions.map((session, index) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={cn(
                      'rounded-2xl border shadow-xl overflow-hidden',
                      theme === 'dark'
                        ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                        : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                    )}
                  >
                    {/* Session Header */}
                    <div
                      onClick={() => handleExpandSession(session.id)}
                      className={cn(
                        'p-5 cursor-pointer transition-colors',
                        theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Status Icon */}
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
                              <h3 className={cn(
                                'font-bold text-lg',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
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
                          {/* Stats */}
                          <div className="hidden md:flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Ventas</p>
                              <p className={cn(
                                'font-bold',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                ${session.totalSales.toFixed(2)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Órdenes</p>
                              <p className={cn(
                                'font-bold',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {session.totalOrders}
                              </p>
                            </div>
                            {session.cashDifference !== null && (
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Diferencia</p>
                                <p className={cn(
                                  'font-bold flex items-center gap-1',
                                  session.cashDifference === 0
                                    ? 'text-green-600'
                                    : session.cashDifference > 0
                                    ? 'text-blue-600'
                                    : 'text-red-600'
                                )}>
                                  {session.cashDifference > 0 ? (
                                    <TrendingUp className="w-4 h-4" />
                                  ) : session.cashDifference < 0 ? (
                                    <TrendingDown className="w-4 h-4" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4" />
                                  )}
                                  ${Math.abs(session.cashDifference).toFixed(2)}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Expand Icon */}
                          <motion.div
                            animate={{ rotate: expandedSession === session.id ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          </motion.div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    <AnimatePresence>
                      {expandedSession === session.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className={cn(
                            'border-t overflow-hidden',
                            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                          )}
                        >
                          <div className="p-5 space-y-6">
                            {/* Session Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                              {/* Opened By */}
                              <div className={cn(
                                'p-4 rounded-xl',
                                theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
                              )}>
                                <p className="text-xs text-gray-500 mb-1">Abierta por</p>
                                <p className={cn(
                                  'font-medium flex items-center gap-2',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  <User className="w-4 h-4 text-blue-500" />
                                  {session.openedByName || 'Usuario'}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {formatDate(session.openedAt)}
                                </p>
                              </div>

                              {/* Closed By */}
                              <div className={cn(
                                'p-4 rounded-xl',
                                theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
                              )}>
                                <p className="text-xs text-gray-500 mb-1">Cerrada por</p>
                                {session.closedByName ? (
                                  <>
                                    <p className={cn(
                                      'font-medium flex items-center gap-2',
                                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    )}>
                                      <User className="w-4 h-4 text-green-500" />
                                      {session.closedByName}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {session.closedAt ? formatDate(session.closedAt) : ''}
                                    </p>
                                  </>
                                ) : (
                                  <p className="text-gray-500 italic">Aún abierta</p>
                                )}
                              </div>

                              {/* Opening Cash */}
                              <div className={cn(
                                'p-4 rounded-xl',
                                theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
                              )}>
                                <p className="text-xs text-gray-500 mb-1">Efectivo Inicial</p>
                                <div className="space-y-1">
                                  <p className={cn('text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                    USD: ${session.openingCash.usd.toFixed(2)}
                                  </p>
                                  <p className={cn('text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                    CUP: {session.openingCash.cup.toLocaleString()}
                                  </p>
                                  <p className={cn('text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                    MLC: ${session.openingCash.mlc.toFixed(2)}
                                  </p>
                                </div>
                              </div>

                              {/* Closing Cash */}
                              <div className={cn(
                                'p-4 rounded-xl',
                                theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
                              )}>
                                <p className="text-xs text-gray-500 mb-1">Efectivo Final</p>
                                {session.closingCash ? (
                                  <div className="space-y-1">
                                    <p className={cn('text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                      USD: ${session.closingCash.usd.toFixed(2)}
                                    </p>
                                    <p className={cn('text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                      CUP: {session.closingCash.cup.toLocaleString()}
                                    </p>
                                    <p className={cn('text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                      MLC: ${session.closingCash.mlc.toFixed(2)}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-gray-500 italic">Pendiente de cierre</p>
                                )}
                              </div>
                            </div>

                            {/* Notes */}
                            {(session.openingNotes || session.closingNotes) && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {session.openingNotes && (
                                  <div className={cn(
                                    'p-4 rounded-xl',
                                    theme === 'dark' ? 'bg-blue-900/20 border border-blue-800/50' : 'bg-blue-50 border border-blue-200'
                                  )}>
                                    <p className="text-xs text-blue-600 mb-1">Notas de apertura</p>
                                    <p className={cn('text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                      {session.openingNotes}
                                    </p>
                                  </div>
                                )}
                                {session.closingNotes && (
                                  <div className={cn(
                                    'p-4 rounded-xl',
                                    theme === 'dark' ? 'bg-green-900/20 border border-green-800/50' : 'bg-green-50 border border-green-200'
                                  )}>
                                    <p className="text-xs text-green-600 mb-1">Notas de cierre</p>
                                    <p className={cn('text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                      {session.closingNotes}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Orders */}
                            <div>
                              <h4 className={cn(
                                'font-semibold mb-3 flex items-center gap-2',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                <ShoppingCart className="w-5 h-5" />
                                Órdenes ({session.totalOrders})
                              </h4>

                              {loadingOrders === session.id ? (
                                <div className="flex items-center justify-center py-8">
                                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                </div>
                              ) : sessionOrders[session.id]?.length > 0 ? (
                                <div className={cn(
                                  'rounded-xl border overflow-hidden',
                                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                                )}>
                                  <table className="w-full">
                                    <thead className={cn(
                                      theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                                    )}>
                                      <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orden</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pagos</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                      {sessionOrders[session.id].map(order => (
                                        <tr key={order.id} className={cn(
                                          theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                                        )}>
                                          <td className="px-4 py-3">
                                            <span className={cn(
                                              'font-mono text-sm',
                                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                                            )}>
                                              {order.orderNumber}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 text-sm text-gray-500">
                                            {order.customerName || '-'}
                                          </td>
                                          <td className="px-4 py-3">
                                            <span className={cn(
                                              'font-medium',
                                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                                            )}>
                                              {formatCurrency(order.totalAmount, order.currency)}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1">
                                              {order.payments?.map((p, i) => (
                                                <span
                                                  key={i}
                                                  className={cn(
                                                    'px-2 py-0.5 rounded text-xs',
                                                    theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                                                  )}
                                                >
                                                  {p.method}: ${p.amount.toFixed(2)}
                                                </span>
                                              ))}
                                            </div>
                                          </td>
                                          <td className="px-4 py-3">
                                            <span className={cn(
                                              'px-2 py-1 rounded-full text-xs font-medium',
                                              order.status === 'paid'
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                : order.status === 'voided'
                                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                            )}>
                                              {order.status === 'paid' ? 'Pagada' :
                                               order.status === 'voided' ? 'Anulada' :
                                               order.status === 'refunded' ? 'Reembolsada' : order.status}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 text-sm text-gray-500">
                                            {new Date(order.createdAt).toLocaleTimeString('es-ES', {
                                              hour: '2-digit',
                                              minute: '2-digit'
                                            })}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className={cn(
                                  'text-center py-8 rounded-xl border-2 border-dashed',
                                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                                )}>
                                  <ShoppingCart className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                                  <p className="text-gray-500">No hay órdenes en esta sesión</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
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
                    page === 1
                      ? 'opacity-50 cursor-not-allowed'
                      : theme === 'dark'
                      ? 'bg-gray-800 hover:bg-gray-700 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  )}
                >
                  Anterior
                </motion.button>
                <span className="text-gray-500">
                  Página {page} de {Math.ceil(total / limit)}
                </span>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(total / limit)}
                  className={cn(
                    'px-4 py-2 rounded-xl transition-colors',
                    page >= Math.ceil(total / limit)
                      ? 'opacity-50 cursor-not-allowed'
                      : theme === 'dark'
                      ? 'bg-gray-800 hover:bg-gray-700 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  )}
                >
                  Siguiente
                </motion.button>
              </div>
            )}
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
