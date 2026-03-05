'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2,
  Plus,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  User,
  Box,
  RotateCcw,
  X
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'

interface Checkout {
  id: number
  assetId: number
  assetName: string
  assetCode: string
  assetImage: string | null
  employeeId: number
  employeeName: string
  checkoutDate: string
  checkoutByName: string
  checkoutNotes: string | null
  expectedReturn: string | null
  returnDate: string | null
  returnByName: string | null
  returnNotes: string | null
  returnCondition: string | null
  status: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface Stats {
  activeCheckouts: number
  returnedThisMonth: number
}

export default function AssetCheckoutsPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [loading, setLoading] = useState(true)
  const [checkouts, setCheckouts] = useState<Checkout[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 1 })
  const [stats, setStats] = useState<Stats>({ activeCheckouts: 0, returnedThisMonth: 0 })
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Tab / filter
  const [activeTab, setActiveTab] = useState<'checked_out' | 'returned'>('checked_out')
  const [page, setPage] = useState(1)
  const limit = 20

  // Return modal
  const [returnModal, setReturnModal] = useState<Checkout | null>(null)
  const [returnCondition, setReturnCondition] = useState('good')
  const [returnNotes, setReturnNotes] = useState('')
  const [returnLoading, setReturnLoading] = useState(false)

  const fetchCheckouts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)
    setError(null)

    try {
      const url = `/api/market/fixed-assets/checkouts?page=${page}&limit=${limit}&status=${activeTab}`
      const res = await fetch(url)
      const data = await res.json()

      if (data.success && data.data) {
        setCheckouts(data.data.checkouts || [])
        setPagination(data.data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
        if (data.data.stats) {
          setStats(data.data.stats)
        }
      } else {
        setError(data.error || 'Error al cargar los préstamos')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      if (!silent) setLoading(false)
      else setIsRefreshing(false)
    }
  }, [page, activeTab])

  useEffect(() => {
    fetchCheckouts()
  }, [fetchCheckouts])

  const handleTabChange = (tab: 'checked_out' | 'returned') => {
    setActiveTab(tab)
    setPage(1)
  }

  const handleManualRefresh = () => fetchCheckouts(true)

  const calculateDays = (checkout: Checkout): number => {
    const start = new Date(checkout.checkoutDate)
    const end = checkout.returnDate ? new Date(checkout.returnDate) : new Date()
    const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(diff, 0)
  }

  const isPastDue = (checkout: Checkout): boolean => {
    if (checkout.status !== 'checked_out' || !checkout.expectedReturn) return false
    return new Date(checkout.expectedReturn) < new Date()
  }

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const openReturnModal = (checkout: Checkout) => {
    setReturnModal(checkout)
    setReturnCondition('good')
    setReturnNotes('')
  }

  const handleReturn = async () => {
    if (!returnModal) return
    setReturnLoading(true)

    try {
      const res = await fetch(`/api/market/fixed-assets/checkouts/${returnModal.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: returnNotes || null,
          condition: returnCondition
        })
      })

      const data = await res.json()

      if (data.success) {
        showNotification('success', 'Devolución registrada', `${returnModal.assetName} ha sido devuelto exitosamente`)
        setReturnModal(null)
        fetchCheckouts(true)
      } else {
        showNotification('error', 'Error', data.error || 'Error al registrar la devolución')
      }
    } catch {
      showNotification('error', 'Error de conexión', 'No se pudo completar la operación')
    } finally {
      setReturnLoading(false)
    }
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
            <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
              {/* Préstamos Activos */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  'relative overflow-hidden rounded-xl border aspect-square flex flex-col items-center justify-center',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-600"></div>
                <div className={cn(
                  'p-3 rounded-xl shadow-sm mb-3',
                  theme === 'dark'
                    ? 'bg-amber-900/30 border border-amber-800/50'
                    : 'bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200'
                )}>
                  <ArrowLeftRight className="w-6 h-6 text-amber-600" />
                </div>
                <p className={cn(
                  'text-4xl font-bold',
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                )}>{stats.activeCheckouts}</p>
                <p className={cn(
                  'text-sm font-medium mt-1',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>Préstamos Activos</p>
              </motion.div>

              {/* Devueltos este Mes */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'relative overflow-hidden rounded-xl border aspect-square flex flex-col items-center justify-center',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-600"></div>
                <div className={cn(
                  'p-3 rounded-xl shadow-sm mb-3',
                  theme === 'dark'
                    ? 'bg-emerald-900/30 border border-emerald-800/50'
                    : 'bg-gradient-to-br from-emerald-50 to-green-100 border border-emerald-200'
                )}>
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <p className={cn(
                  'text-4xl font-bold',
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                )}>{stats.returnedThisMonth}</p>
                <p className={cn(
                  'text-sm font-medium mt-1',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>Devueltos este Mes</p>
              </motion.div>
            </div>

            {/* Tabs + Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {/* Tabs */}
              <div className={cn(
                'flex rounded-xl p-1',
                theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
              )}>
                <button
                  onClick={() => handleTabChange('checked_out')}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    activeTab === 'checked_out'
                      ? 'bg-blue-500 text-white shadow-md'
                      : theme === 'dark'
                        ? 'text-gray-400 hover:text-gray-200'
                        : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  Activos
                </button>
                <button
                  onClick={() => handleTabChange('returned')}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    activeTab === 'returned'
                      ? 'bg-blue-500 text-white shadow-md'
                      : theme === 'dark'
                        ? 'text-gray-400 hover:text-gray-200'
                        : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  Histórico
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
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

                <Link href="/dashboard/market/fixed-assets/checkouts/new">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="hidden sm:inline">Nuevo Préstamo</span>
                  </motion.button>
                </Link>
              </div>
            </div>

            {/* Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={cn(
                'rounded-2xl border shadow-xl overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : error ? (
                <div className={cn(
                  'p-8 text-center',
                  theme === 'dark' ? 'text-red-400' : 'text-red-600'
                )}>
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
                  <p>{error}</p>
                  <button
                    onClick={() => fetchCheckouts()}
                    className="mt-4 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600"
                  >
                    Reintentar
                  </button>
                </div>
              ) : checkouts.length === 0 ? (
                <div className="py-12 text-center">
                  <ArrowLeftRight className={cn(
                    'w-16 h-16 mx-auto mb-4',
                    theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                  )} />
                  <h3 className={cn(
                    'text-lg font-semibold mb-2',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {activeTab === 'checked_out'
                      ? 'No hay préstamos activos'
                      : 'No hay devoluciones registradas'}
                  </h3>
                  <p className={cn('mb-4', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    {activeTab === 'checked_out'
                      ? 'Registra un nuevo préstamo de activo'
                      : 'Aún no se han registrado devoluciones este período'}
                  </p>
                  {activeTab === 'checked_out' && (
                    <Link href="/dashboard/market/fixed-assets/checkouts/new">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25"
                      >
                        <Plus className="w-5 h-5" />
                        Nuevo Préstamo
                      </motion.button>
                    </Link>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={cn(
                          'border-b',
                          theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                        )}>
                          <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Activo</th>
                          <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Empleado</th>
                          <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha Préstamo</th>
                          <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Retorno Esperado</th>
                          <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Días Prestado</th>
                          <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                          {activeTab === 'returned' && (
                            <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Condición</th>
                          )}
                          <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {checkouts.map((checkout, index) => {
                          const pastDue = isPastDue(checkout)
                          const days = calculateDays(checkout)

                          return (
                            <motion.tr
                              key={checkout.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.02 }}
                              className={cn(
                                'group transition-colors',
                                theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50',
                                pastDue && (theme === 'dark' ? 'bg-red-900/10' : 'bg-red-50/50')
                              )}
                            >
                              {/* Activo */}
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-3">
                                  {checkout.assetImage ? (
                                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700">
                                      <img src={checkout.assetImage} alt={checkout.assetName} className="w-full h-full object-cover" />
                                    </div>
                                  ) : (
                                    <div className={cn(
                                      'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                    )}>
                                      <Box className={cn('w-5 h-5', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                                    </div>
                                  )}
                                  <div>
                                    <p className={cn(
                                      'font-medium',
                                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    )}>
                                      {checkout.assetName}
                                    </p>
                                    <p className={cn(
                                      'text-xs font-mono',
                                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                    )}>
                                      {checkout.assetCode}
                                    </p>
                                  </div>
                                  {pastDue && (
                                    <span title="Retorno vencido"><AlertTriangle className="w-4 h-4 text-red-500 shrink-0" /></span>
                                  )}
                                </div>
                              </td>

                              {/* Empleado */}
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-1.5">
                                  <User className={cn(
                                    'w-3.5 h-3.5',
                                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                                  )} />
                                  <span className={cn(
                                    'text-sm',
                                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                  )}>
                                    {checkout.employeeName}
                                  </span>
                                </div>
                              </td>

                              {/* Fecha Préstamo */}
                              <td className="py-4 px-4">
                                <span className={cn(
                                  'text-sm',
                                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                )}>
                                  {formatDate(checkout.checkoutDate)}
                                </span>
                              </td>

                              {/* Retorno Esperado */}
                              <td className="py-4 px-4">
                                <span className={cn(
                                  'text-sm',
                                  pastDue ? 'text-red-500 font-medium' : theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                )}>
                                  {formatDate(checkout.expectedReturn)}
                                </span>
                              </td>

                              {/* Días Prestado */}
                              <td className="py-4 px-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Clock className={cn(
                                    'w-3.5 h-3.5',
                                    pastDue ? 'text-red-500' : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                                  )} />
                                  <span className={cn(
                                    'text-sm font-medium',
                                    pastDue ? 'text-red-500' : theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>
                                    {days}
                                  </span>
                                </div>
                              </td>

                              {/* Estado */}
                              <td className="py-4 px-4 text-center">
                                {checkout.status === 'checked_out' ? (
                                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                    <ArrowLeftRight className="w-3.5 h-3.5" />
                                    Prestado
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Devuelto
                                  </span>
                                )}
                              </td>

                              {/* Condición (only for returned) */}
                              {activeTab === 'returned' && (
                                <td className="py-4 px-4 text-center">
                                  {checkout.returnCondition === 'good' && (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                      Bueno
                                    </span>
                                  )}
                                  {checkout.returnCondition === 'damaged' && (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                      Dañado
                                    </span>
                                  )}
                                  {checkout.returnCondition === 'needs_repair' && (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                      Necesita Reparación
                                    </span>
                                  )}
                                  {!checkout.returnCondition && (
                                    <span className={cn(
                                      'text-sm',
                                      theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                                    )}>-</span>
                                  )}
                                </td>
                              )}

                              {/* Acciones */}
                              <td className="py-4 px-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {checkout.status === 'checked_out' && (
                                    <motion.button
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => openReturnModal(checkout)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors shadow-sm"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      Devolver
                                    </motion.button>
                                  )}
                                  {checkout.status === 'returned' && (
                                    <span className={cn(
                                      'text-xs',
                                      theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                                    )}>
                                      {formatDate(checkout.returnDate)}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </motion.tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {pagination.totalPages > 1 && (
                    <div className={cn(
                      'flex items-center justify-between px-4 py-3 border-t',
                      theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                    )}>
                      <p className="text-sm text-gray-500">
                        Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, pagination.total)} de {pagination.total}
                      </p>
                      <div className="flex items-center gap-2">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
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
                          {page} / {pagination.totalPages}
                        </span>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                          disabled={page === pagination.totalPages}
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
                </>
              )}
            </motion.div>
          </motion.div>
        </div>

        {/* Return Modal */}
        <AnimatePresence>
          {returnModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
              onClick={() => !returnLoading && setReturnModal(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'w-full max-w-md rounded-2xl border shadow-2xl p-6',
                  theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className={cn(
                    'text-lg font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Registrar Devolución
                  </h3>
                  <button
                    onClick={() => !returnLoading && setReturnModal(null)}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors',
                      theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                    )}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Asset info */}
                <div className={cn(
                  'flex items-center gap-3 p-3 rounded-xl mb-6',
                  theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
                )}>
                  {returnModal.assetImage ? (
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700">
                      <img src={returnModal.assetImage} alt={returnModal.assetName} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                    )}>
                      <Box className={cn('w-5 h-5', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                    </div>
                  )}
                  <div>
                    <p className={cn(
                      'font-medium text-sm',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {returnModal.assetName}
                    </p>
                    <p className={cn(
                      'text-xs font-mono',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    )}>
                      {returnModal.assetCode} - Prestado a {returnModal.employeeName}
                    </p>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  {/* Condición */}
                  <div>
                    <label className={cn(
                      'block text-sm font-medium mb-1.5',
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Condición de devolución
                    </label>
                    <select
                      value={returnCondition}
                      onChange={(e) => setReturnCondition(e.target.value)}
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    >
                      <option value="good">Bueno</option>
                      <option value="damaged">Dañado</option>
                      <option value="needs_repair">Necesita Reparación</option>
                    </select>
                  </div>

                  {/* Notas */}
                  <div>
                    <label className={cn(
                      'block text-sm font-medium mb-1.5',
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Notas <span className={cn('font-normal', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>(opcional)</span>
                    </label>
                    <textarea
                      value={returnNotes}
                      onChange={(e) => setReturnNotes(e.target.value)}
                      rows={3}
                      placeholder="Observaciones sobre el estado del activo..."
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all resize-none',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex justify-end gap-3 mt-6">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => !returnLoading && setReturnModal(null)}
                    disabled={returnLoading}
                    className={cn(
                      'px-4 py-2.5 rounded-xl font-medium transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    )}
                  >
                    Cancelar
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleReturn}
                    disabled={returnLoading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50 font-medium"
                  >
                    {returnLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                    Confirmar Devolución
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
