'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  FileText,
  Plus,
  Search,
  Eye,
  Send,
  ArrowRightLeft,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  FileClock,
  FileCheck,
  Trash2
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Quote {
  id: number
  quoteNumber: string
  customerId: number
  customerName: string
  customerCode: string
  warehouseName: string | null
  pricelistName: string | null
  status: string
  subtotal: number
  discountPercent: number
  discountAmount: number
  totalAmount: number
  currency: string
  validUntil: string | null
  linesCount: number
  convertedToInvoiceId: number | null
  createdBy: string
  createdAt: string
  sentAt: string | null
  acceptedAt: string | null
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  draft: { label: 'Borrador', color: 'gray', icon: FileText },
  sent: { label: 'Enviada', color: 'blue', icon: Send },
  accepted: { label: 'Aceptada', color: 'green', icon: CheckCircle },
  rejected: { label: 'Rechazada', color: 'red', icon: XCircle },
  expired: { label: 'Expirada', color: 'orange', icon: Clock },
  converted: { label: 'Convertida', color: 'purple', icon: ArrowRightLeft },
  cancelled: { label: 'Cancelada', color: 'red', icon: XCircle }
}

export default function WholesaleQuotesPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    sent: 0,
    accepted: 0,
    converted: 0,
    pendingValue: 0
  })

  useEffect(() => {
    fetchQuotes()
  }, [statusFilter])

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchQuotes()
    }, 300)
    return () => clearTimeout(debounce)
  }, [search])

  const fetchQuotes = async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (search) params.set('search', search)

      const response = await fetch(`/api/market/wholesale/quotes?${params}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setQuotes(result.data.quotes)
          setStats(result.data.stats)
        }
      }
    } catch (error) {
      console.error('Error fetching quotes:', error)
    } finally {
      if (!silent) setLoading(false)
      else setIsRefreshing(false)
    }
  }

  const handleSendQuote = async (quoteId: number) => {
    if (!confirm('¿Enviar esta cotización al cliente?')) return

    try {
      const response = await fetch(`/api/market/wholesale/quotes/${quoteId}/send`, {
        method: 'POST'
      })
      if (response.ok) {
        fetchQuotes(true)
      }
    } catch (error) {
      console.error('Error sending quote:', error)
    }
  }

  const handleDeleteQuote = async (quoteId: number) => {
    if (!confirm('¿Estás seguro de eliminar esta cotización? Esta acción no se puede deshacer.')) return

    try {
      const response = await fetch(`/api/market/wholesale/quotes/${quoteId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        fetchQuotes(true)
      } else {
        const result = await response.json()
        alert(result.error || 'Error al eliminar cotización')
      }
    } catch (error) {
      console.error('Error deleting quote:', error)
    }
  }

  const handleConvertQuote = async (quoteId: number) => {
    if (!confirm('¿Convertir esta cotización a factura?')) return

    try {
      const response = await fetch(`/api/market/wholesale/quotes/${quoteId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          router.push(`/dashboard/market/wholesale/invoices/${result.data.invoiceId}`)
        }
      }
    } catch (error) {
      console.error('Error converting quote:', error)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
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
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Total Cotizaciones */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  'relative overflow-hidden',
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
                        <FileText className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Total Cotizaciones</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.total}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>Presupuestos en el sistema</span>
                  </div>
                </div>
              </motion.div>

              {/* Enviadas */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-cyan-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-cyan-900/30 border border-cyan-800/50'
                          : 'bg-gradient-to-br from-cyan-50 to-cyan-100 border border-cyan-200'
                      )}>
                        <FileClock className="w-6 h-6 text-cyan-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Enviadas</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.sent}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>Pendientes de respuesta</span>
                  </div>
                </div>
              </motion.div>

              {/* Aceptadas */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-green-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-green-900/30 border border-green-800/50'
                          : 'bg-gradient-to-br from-green-50 to-green-100 border border-green-200'
                      )}>
                        <FileCheck className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Aceptadas</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.accepted}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>Listas para facturar</span>
                  </div>
                </div>
              </motion.div>

              {/* Valor Pendiente */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-amber-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-amber-900/30 border border-amber-800/50'
                          : 'bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200'
                      )}>
                        <DollarSign className="w-6 h-6 text-amber-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Valor Pendiente</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{formatCurrency(stats.pendingValue)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>Total cotizaciones activas</span>
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
                    placeholder="Buscar por número o cliente..."
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
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all min-w-[180px]',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                  )}
                >
                  <option value="">Todos los estados</option>
                  <option value="draft">Borrador</option>
                  <option value="sent">Enviadas</option>
                  <option value="accepted">Aceptadas</option>
                  <option value="converted">Convertidas</option>
                  <option value="rejected">Rechazadas</option>
                  <option value="cancelled">Canceladas</option>
                  <option value="expired">Expiradas</option>
                </select>

                {/* Refresh */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => fetchQuotes(true)}
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

                {/* Nueva Cotización */}
                <Link href="/dashboard/market/wholesale/quotes/create">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25"
                  >
                    <Plus className="w-5 h-5" />
                    Nueva Cotización
                  </motion.button>
                </Link>
              </div>
            </motion.div>

            {/* Quotes Table */}
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
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={cn(
                      'border-b',
                      theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                    )}>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Cotización</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                      <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan={6} className="py-4 px-4">
                            <div className="animate-pulse flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
                              <div className="flex-1">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : quotes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center">
                          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className={cn(
                            'font-medium mb-1',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>No hay cotizaciones</p>
                          <p className="text-gray-500 dark:text-gray-400">
                            Crea tu primera cotización
                          </p>
                          <Link href="/dashboard/market/wholesale/quotes/create">
                            <button className="mt-3 inline-flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600">
                              <Plus className="w-4 h-4" />
                              Crear Cotización
                            </button>
                          </Link>
                        </td>
                      </tr>
                    ) : (
                      quotes.map((quote, index) => {
                        const config = statusConfig[quote.status] || statusConfig.draft
                        const StatusIcon = config.icon

                        return (
                          <motion.tr
                            key={quote.id}
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
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold">
                                  <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className={cn(
                                    'font-medium',
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>
                                    {quote.quoteNumber}
                                  </p>
                                  <p className="text-xs text-gray-500">{quote.linesCount} productos</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div>
                                <p className={cn(
                                  'text-sm',
                                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                )}>{quote.customerName}</p>
                                <p className="text-xs text-gray-500">{quote.customerCode}</p>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <p className={cn(
                                'font-medium',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {formatCurrency(quote.totalAmount)}
                              </p>
                              {quote.discountPercent > 0 && (
                                <p className="text-xs text-green-600">-{quote.discountPercent}%</p>
                              )}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
                                config.color === 'green'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : config.color === 'blue'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    : config.color === 'purple'
                                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                      : config.color === 'red'
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        : config.color === 'orange'
                                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                              )}>
                                <StatusIcon className="w-3 h-3" />
                                {config.label}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <p className="text-sm text-gray-500">{formatDate(quote.createdAt)}</p>
                              {quote.validUntil && (
                                <p className="text-xs text-gray-400">
                                  Válida hasta: {formatDate(quote.validUntil)}
                                </p>
                              )}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Link href={`/dashboard/market/wholesale/quotes/${quote.id}`}>
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                    title="Ver detalles"
                                  >
                                    <Eye className="w-4 h-4 text-blue-500" />
                                  </motion.button>
                                </Link>
                                {quote.status === 'draft' && (
                                  <>
                                    <motion.button
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => handleSendQuote(quote.id)}
                                      className="p-2 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                                      title="Enviar al cliente"
                                    >
                                      <Send className="w-4 h-4 text-green-500" />
                                    </motion.button>
                                    <motion.button
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => handleDeleteQuote(quote.id)}
                                      className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                      title="Eliminar cotización"
                                    >
                                      <Trash2 className="w-4 h-4 text-red-500" />
                                    </motion.button>
                                  </>
                                )}
                                {['draft', 'sent', 'accepted'].includes(quote.status) && !quote.convertedToInvoiceId && (
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleConvertQuote(quote.id)}
                                    className="p-2 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                                    title="Convertir a factura"
                                  >
                                    <ArrowRightLeft className="w-4 h-4 text-purple-500" />
                                  </motion.button>
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
            </motion.div>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
