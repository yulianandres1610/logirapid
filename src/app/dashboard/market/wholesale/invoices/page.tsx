'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Receipt,
  Plus,
  Search,
  Eye,
  CheckCircle,
  Truck,
  DollarSign,
  RefreshCw,
  Clock,
  FileText,
  AlertTriangle
} from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Invoice {
  id: number
  invoiceNumber: string
  customerId: number
  customerName: string
  customerCode: string
  quoteNumber: string | null
  warehouseName: string | null
  status: string
  paymentStatus: string
  subtotal: number
  discountPercent: number
  discountAmount: number
  totalAmount: number
  amountPaid: number
  amountDue: number
  currency: string
  dueDate: string | null
  linesCount: number
  deliveriesCount: number
  createdBy: string
  createdAt: string
  confirmedAt: string | null
  deliveredAt: string | null
  paidAt: string | null
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  draft: { label: 'Borrador', color: 'gray', icon: FileText },
  confirmed: { label: 'Confirmada', color: 'blue', icon: CheckCircle },
  partial_delivery: { label: 'Entrega Parcial', color: 'yellow', icon: Truck },
  delivered: { label: 'Entregada', color: 'green', icon: Truck },
  cancelled: { label: 'Cancelada', color: 'red', icon: AlertTriangle }
}

const paymentStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'yellow' },
  partial: { label: 'Parcial', color: 'orange' },
  paid: { label: 'Pagado', color: 'green' },
  overdue: { label: 'Vencido', color: 'red' }
}

export default function WholesaleInvoicesPage() {
  const { theme } = useTheme()
  const searchParams = useSearchParams()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>(searchParams.get('paymentStatus') || '')
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    confirmed: 0,
    delivered: 0,
    pendingPayment: 0,
    overdue: 0,
    totalSales: 0,
    totalPending: 0
  })

  useEffect(() => {
    fetchInvoices()
  }, [statusFilter, paymentStatusFilter])

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchInvoices()
    }, 300)
    return () => clearTimeout(debounce)
  }, [search])

  const fetchInvoices = async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (paymentStatusFilter) params.set('paymentStatus', paymentStatusFilter)
      if (search) params.set('search', search)

      const response = await fetch(`/api/market/wholesale/invoices?${params}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setInvoices(result.data.invoices)
          setStats(result.data.stats)
        }
      }
    } catch (error) {
      console.error('Error fetching invoices:', error)
    } finally {
      if (!silent) setLoading(false)
      else setIsRefreshing(false)
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
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className={cn(
                  'text-2xl font-bold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Facturas
                </h1>
                <p className={cn(
                  'text-sm mt-1',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  Gestión de facturas y cuentas por cobrar
                </p>
              </div>
              <Link href="/dashboard/market/wholesale/invoices/create">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all shadow-lg shadow-green-500/25"
                >
                  <Plus className="w-5 h-5" />
                  Nueva Factura
                </motion.button>
              </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'p-4 rounded-xl border',
                  theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700'
                    : 'bg-white border-gray-200'
                )}
              >
                <p className="text-sm text-gray-500">Este Mes</p>
                <p className={cn(
                  'text-2xl font-bold mt-1',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>{stats.total}</p>
                <p className="text-xs text-gray-400 mt-1">{formatCurrency(stats.totalSales)}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  'p-4 rounded-xl border',
                  theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700'
                    : 'bg-white border-gray-200'
                )}
              >
                <p className="text-sm text-gray-500">Pendientes de Pago</p>
                <p className={cn(
                  'text-2xl font-bold mt-1 text-yellow-600',
                  theme === 'dark' && 'text-yellow-400'
                )}>{stats.pendingPayment}</p>
                <p className="text-xs text-gray-400 mt-1">{formatCurrency(stats.totalPending)}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'p-4 rounded-xl border',
                  theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700'
                    : 'bg-white border-gray-200'
                )}
              >
                <p className="text-sm text-gray-500">Vencidas</p>
                <p className={cn(
                  'text-2xl font-bold mt-1 text-red-600',
                  theme === 'dark' && 'text-red-400'
                )}>{stats.overdue}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  'p-4 rounded-xl border',
                  theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700'
                    : 'bg-white border-gray-200'
                )}
              >
                <p className="text-sm text-gray-500">Entregadas</p>
                <p className={cn(
                  'text-2xl font-bold mt-1 text-green-600',
                  theme === 'dark' && 'text-green-400'
                )}>{stats.delivered}</p>
              </motion.div>
            </div>

            {/* Filters */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
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

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all min-w-[160px]',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                  )}
                >
                  <option value="">Estado de Factura</option>
                  <option value="draft">Borrador</option>
                  <option value="confirmed">Confirmada</option>
                  <option value="partial_delivery">Entrega Parcial</option>
                  <option value="delivered">Entregada</option>
                  <option value="cancelled">Cancelada</option>
                </select>

                <select
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all min-w-[160px]',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                  )}
                >
                  <option value="">Estado de Pago</option>
                  <option value="pending">Pendiente</option>
                  <option value="partial">Pago Parcial</option>
                  <option value="paid">Pagado</option>
                  <option value="overdue">Vencido</option>
                </select>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => fetchInvoices(true)}
                  disabled={loading || isRefreshing}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                    theme === 'dark'
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  <RefreshCw className={cn('w-4 h-4', (loading || isRefreshing) && 'animate-spin')} />
                </motion.button>
              </div>
            </motion.div>

            {/* Invoices Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
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
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Factura</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                      <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Pendiente</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Pago</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan={7} className="py-4 px-4">
                            <div className="animate-pulse flex items-center gap-3">
                              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : invoices.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center">
                          <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className={cn(
                            'font-medium mb-1',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>No hay facturas</p>
                          <p className="text-gray-500">
                            Crea tu primera factura
                          </p>
                          <Link href="/dashboard/market/wholesale/invoices/create">
                            <button className="mt-3 inline-flex items-center gap-2 text-sm text-green-500 hover:text-green-600">
                              <Plus className="w-4 h-4" />
                              Crear Factura
                            </button>
                          </Link>
                        </td>
                      </tr>
                    ) : (
                      invoices.map((invoice, index) => {
                        const sConfig = statusConfig[invoice.status] || statusConfig.draft
                        const pConfig = paymentStatusConfig[invoice.paymentStatus] || paymentStatusConfig.pending
                        const StatusIcon = sConfig.icon

                        return (
                          <motion.tr
                            key={invoice.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                            className={cn(
                              'group transition-colors',
                              theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                            )}
                          >
                            <td className="py-4 px-4">
                              <div>
                                <p className={cn(
                                  'font-medium',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {invoice.invoiceNumber}
                                </p>
                                {invoice.quoteNumber && (
                                  <p className="text-xs text-gray-500">De: {invoice.quoteNumber}</p>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div>
                                <p className={cn(
                                  'text-sm',
                                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                )}>{invoice.customerName}</p>
                                <p className="text-xs text-gray-500">{invoice.customerCode}</p>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <p className={cn(
                                'font-medium',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {formatCurrency(invoice.totalAmount)}
                              </p>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <p className={cn(
                                'font-medium',
                                invoice.amountDue > 0
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-green-600 dark:text-green-400'
                              )}>
                                {formatCurrency(invoice.amountDue)}
                              </p>
                              {invoice.dueDate && (
                                <p className="text-xs text-gray-500">
                                  Vence: {formatDate(invoice.dueDate)}
                                </p>
                              )}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
                                sConfig.color === 'green'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : sConfig.color === 'blue'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    : sConfig.color === 'yellow'
                                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                      : sConfig.color === 'red'
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                              )}>
                                <StatusIcon className="w-3 h-3" />
                                {sConfig.label}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={cn(
                                'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium',
                                pConfig.color === 'green'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : pConfig.color === 'yellow'
                                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                    : pConfig.color === 'orange'
                                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              )}>
                                {pConfig.label}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Link href={`/dashboard/market/wholesale/invoices/${invoice.id}`}>
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                    title="Ver detalles"
                                  >
                                    <Eye className="w-4 h-4 text-blue-500" />
                                  </motion.button>
                                </Link>
                                {invoice.status === 'confirmed' && (
                                  <Link href={`/dashboard/market/wholesale/invoices/${invoice.id}/delivery`}>
                                    <motion.button
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      className="p-2 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                                      title="Crear entrega"
                                    >
                                      <Truck className="w-4 h-4 text-green-500" />
                                    </motion.button>
                                  </Link>
                                )}
                                {invoice.paymentStatus !== 'paid' && invoice.status !== 'cancelled' && (
                                  <Link href={`/dashboard/market/wholesale/invoices/${invoice.id}?tab=payments`}>
                                    <motion.button
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      className="p-2 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                                      title="Registrar pago"
                                    >
                                      <DollarSign className="w-4 h-4 text-purple-500" />
                                    </motion.button>
                                  </Link>
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
