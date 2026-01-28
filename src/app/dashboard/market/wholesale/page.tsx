'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  FileText,
  Receipt,
  DollarSign,
  Plus,
  ArrowRight,
  Clock,
  AlertTriangle,
  Building2,
  TrendingUp
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Stats {
  customers: {
    total: number
    active: number
  }
  quotes: {
    pending: number
    pendingValue: number
  }
  invoices: {
    thisMonth: number
    thisMonthValue: number
  }
  receivable: {
    overdueCount: number
    overdueValue: number
    totalPending: number
  }
  recentInvoices: Array<{
    id: number
    invoiceNumber: string
    customerName: string
    status: string
    paymentStatus: string
    totalAmount: number
    createdAt: string
  }>
  recentQuotes: Array<{
    id: number
    quoteNumber: string
    customerName: string
    status: string
    totalAmount: number
    createdAt: string
  }>
}

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: 'Borrador', color: 'gray' },
  sent: { label: 'Enviada', color: 'blue' },
  accepted: { label: 'Aceptada', color: 'green' },
  rejected: { label: 'Rechazada', color: 'red' },
  expired: { label: 'Expirada', color: 'orange' },
  converted: { label: 'Convertida', color: 'purple' },
  confirmed: { label: 'Confirmada', color: 'green' },
  partial_delivery: { label: 'Entrega Parcial', color: 'yellow' },
  delivered: { label: 'Entregada', color: 'blue' },
  cancelled: { label: 'Cancelada', color: 'red' }
}

const paymentStatusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'yellow' },
  partial: { label: 'Parcial', color: 'orange' },
  paid: { label: 'Pagado', color: 'green' },
  overdue: { label: 'Vencido', color: 'red' }
}

export default function WholesaleDashboardPage() {
  const { theme } = useTheme()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/market/wholesale/stats')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setStats(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
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
      month: 'short'
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
                  Ventas al Por Mayor
                </h1>
                <p className={cn(
                  'text-sm mt-1',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  Gestión de clientes B2B, cotizaciones y facturas
                </p>
              </div>
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

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Clientes Activos */}
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
                        <Users className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Clientes</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{loading ? '-' : stats?.customers.active || 0}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>activos de {stats?.customers.total || 0} total</span>
                  </div>
                </div>
              </motion.div>

              {/* Cotizaciones Pendientes */}
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
                        <FileText className="w-6 h-6 text-amber-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Cotizaciones Pendientes</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{loading ? '-' : stats?.quotes.pending || 0}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>{formatCurrency(stats?.quotes.pendingValue || 0)} en valor</span>
                  </div>
                </div>
              </motion.div>

              {/* Facturas Este Mes */}
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
                        <TrendingUp className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Facturas Este Mes</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{loading ? '-' : stats?.invoices.thisMonth || 0}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>{formatCurrency(stats?.invoices.thisMonthValue || 0)}</span>
                  </div>
                </div>
              </motion.div>

              {/* Por Cobrar */}
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
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-red-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-red-900/30 border border-red-800/50'
                          : 'bg-gradient-to-br from-red-50 to-red-100 border border-red-200'
                      )}>
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Por Cobrar Vencido</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{formatCurrency(stats?.receivable.overdueValue || 0)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>{stats?.receivable.overdueCount || 0} facturas vencidas</span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Quick Access */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={cn(
                'p-6 rounded-2xl border shadow-xl',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              <h2 className={cn(
                'text-lg font-semibold mb-4',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>Acceso Rápido</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <Link href="/dashboard/market/wholesale/customers">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'p-4 rounded-xl border cursor-pointer transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    <Building2 className="w-8 h-8 text-blue-500 mb-2" />
                    <p className={cn(
                      'font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Clientes</p>
                  </motion.div>
                </Link>

                <Link href="/dashboard/market/wholesale/quotes">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'p-4 rounded-xl border cursor-pointer transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    <FileText className="w-8 h-8 text-amber-500 mb-2" />
                    <p className={cn(
                      'font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Cotizaciones</p>
                  </motion.div>
                </Link>

                <Link href="/dashboard/market/wholesale/invoices">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'p-4 rounded-xl border cursor-pointer transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    <Receipt className="w-8 h-8 text-green-500 mb-2" />
                    <p className={cn(
                      'font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Facturas</p>
                  </motion.div>
                </Link>

                <Link href="/dashboard/market/wholesale/invoices?paymentStatus=pending">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'p-4 rounded-xl border cursor-pointer transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    <DollarSign className="w-8 h-8 text-purple-500 mb-2" />
                    <p className={cn(
                      'font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Por Cobrar</p>
                  </motion.div>
                </Link>

                <Link href="/dashboard/market/wholesale/reports">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'p-4 rounded-xl border cursor-pointer transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    <TrendingUp className="w-8 h-8 text-indigo-500 mb-2" />
                    <p className={cn(
                      'font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Reportes</p>
                  </motion.div>
                </Link>
              </div>
            </motion.div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Invoices */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className={cn(
                  'p-6 rounded-2xl border shadow-xl',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className={cn(
                    'text-lg font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Últimas Facturas</h2>
                  <Link href="/dashboard/market/wholesale/invoices" className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1">
                    Ver todas <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="space-y-3">
                  {loading ? (
                    [...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse flex items-center justify-between py-3">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                      </div>
                    ))
                  ) : stats?.recentInvoices.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No hay facturas recientes</p>
                  ) : (
                    stats?.recentInvoices.map(invoice => (
                      <Link key={invoice.id} href={`/dashboard/market/wholesale/invoices/${invoice.id}`}>
                        <div className={cn(
                          'flex items-center justify-between py-3 px-3 rounded-lg transition-colors cursor-pointer',
                          theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                        )}>
                          <div>
                            <p className={cn(
                              'font-medium',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{invoice.invoiceNumber}</p>
                            <p className="text-sm text-gray-500">{invoice.customerName}</p>
                          </div>
                          <div className="text-right">
                            <p className={cn(
                              'font-medium',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{formatCurrency(invoice.totalAmount)}</p>
                            <span className={cn(
                              'text-xs px-2 py-0.5 rounded-full',
                              paymentStatusLabels[invoice.paymentStatus]?.color === 'green'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : paymentStatusLabels[invoice.paymentStatus]?.color === 'yellow'
                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : paymentStatusLabels[invoice.paymentStatus]?.color === 'red'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                            )}>
                              {paymentStatusLabels[invoice.paymentStatus]?.label || invoice.paymentStatus}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </motion.div>

              {/* Recent Quotes */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className={cn(
                  'p-6 rounded-2xl border shadow-xl',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className={cn(
                    'text-lg font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Últimas Cotizaciones</h2>
                  <Link href="/dashboard/market/wholesale/quotes" className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1">
                    Ver todas <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="space-y-3">
                  {loading ? (
                    [...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse flex items-center justify-between py-3">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                      </div>
                    ))
                  ) : stats?.recentQuotes.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No hay cotizaciones recientes</p>
                  ) : (
                    stats?.recentQuotes.map(quote => (
                      <Link key={quote.id} href={`/dashboard/market/wholesale/quotes/${quote.id}`}>
                        <div className={cn(
                          'flex items-center justify-between py-3 px-3 rounded-lg transition-colors cursor-pointer',
                          theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                        )}>
                          <div>
                            <p className={cn(
                              'font-medium',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{quote.quoteNumber}</p>
                            <p className="text-sm text-gray-500">{quote.customerName}</p>
                          </div>
                          <div className="text-right">
                            <p className={cn(
                              'font-medium',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{formatCurrency(quote.totalAmount)}</p>
                            <span className={cn(
                              'text-xs px-2 py-0.5 rounded-full',
                              statusLabels[quote.status]?.color === 'green'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : statusLabels[quote.status]?.color === 'blue'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                  : statusLabels[quote.status]?.color === 'purple'
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                            )}>
                              {statusLabels[quote.status]?.label || quote.status}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
