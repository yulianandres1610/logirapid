'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  Plus,
  Search,
  Eye,
  Edit,
  DollarSign,
  Calendar,
  Building2,
  Clock,
  User,
  RefreshCw,
  X,
  Loader2,
  Users,
  TrendingUp
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Contract {
  id: number
  employeeId: number
  employeeName: string
  employeeCode: string
  contractNumber: string
  contractType: string
  startDate: string
  endDate: string | null
  payType: string
  payRate: number
  currency: string
  commissionRate: number
  departmentId: number | null
  departmentName: string | null
  scheduleId: number | null
  scheduleName: string | null
  position: string | null
  status: string
  createdAt: string
}

interface Stats {
  total: number
  active: number
  terminated: number
  indefinidos: number
  totalSalaries: number
}

const contractTypeLabels: Record<string, string> = {
  indefinido: 'Indefinido',
  temporal: 'Temporal',
  por_obra: 'Por Obra'
}

const payTypeLabels: Record<string, string> = {
  hourly: 'Por Hora',
  daily: 'Por Dia',
  monthly: 'Mensual'
}

const statusColors: Record<string, { bg: string; text: string }> = {
  active: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  terminated: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  on_leave: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' }
}

export default function ContractsPage() {
  const { theme } = useTheme()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const [stats, setStats] = useState<Stats>({
    total: 0,
    active: 0,
    terminated: 0,
    indefinidos: 0,
    totalSalaries: 0
  })

  useEffect(() => {
    fetchContracts()
  }, [statusFilter])

  const fetchContracts = async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const params = new URLSearchParams({ status: statusFilter })
      const response = await fetch(`/api/market/hr/contracts?${params}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setContracts(result.data)

          // Calculate stats
          const active = result.data.filter((c: Contract) => c.status === 'active').length
          const terminated = result.data.filter((c: Contract) => c.status === 'terminated').length
          const indefinidos = result.data.filter((c: Contract) => c.contractType === 'indefinido').length
          const totalSalaries = result.data
            .filter((c: Contract) => c.status === 'active' && c.payType === 'monthly')
            .reduce((sum: number, c: Contract) => sum + c.payRate, 0)

          setStats({
            total: result.data.length,
            active,
            terminated,
            indefinidos,
            totalSalaries
          })
          setLastUpdated(new Date())
        }
      }
    } catch (error) {
      console.error('Error fetching contracts:', error)
    } finally {
      if (!silent) setLoading(false)
      else setIsRefreshing(false)
    }
  }

  const handleManualRefresh = () => fetchContracts(true)

  const viewContract = async (id: number) => {
    try {
      const response = await fetch(`/api/market/hr/contracts/${id}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setSelectedContract(result.data)
          setShowDetails(true)
        }
      }
    } catch (error) {
      console.error('Error fetching contract:', error)
    }
  }

  const filteredContracts = contracts.filter(c =>
    c.employeeName.toLowerCase().includes(search.toLowerCase()) ||
    c.contractNumber.toLowerCase().includes(search.toLowerCase()) ||
    (c.position && c.position.toLowerCase().includes(search.toLowerCase()))
  )

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value)
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
              {/* Total Contratos */}
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
                        )}>Total Contratos</p>
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
                    )}>registrados</span>
                  </div>
                </div>
              </motion.div>

              {/* Activos */}
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
                        <Users className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Activos</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.active}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>{stats.total > 0 ? `${Math.round((stats.active / stats.total) * 100)}%` : '0%'} del total</span>
                  </div>
                </div>
              </motion.div>

              {/* Indefinidos */}
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
                        <Clock className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Indefinidos</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.indefinidos}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>sin fecha de fin</span>
                  </div>
                </div>
              </motion.div>

              {/* Nomina Mensual */}
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
                        <DollarSign className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Nomina Mensual</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{formatCurrency(stats.totalSalaries)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>contratos activos</span>
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
                    placeholder="Buscar por empleado, contrato o cargo..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={cn(
                      'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 text-white focus:border-amber-500 focus:ring-amber-500/20'
                        : 'bg-white border-gray-200 text-gray-900 focus:border-amber-500 focus:ring-amber-500/20'
                    )}
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all min-w-[150px]',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-amber-500 focus:ring-amber-500/20'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-amber-500 focus:ring-amber-500/20'
                  )}
                >
                  <option value="active">Activos</option>
                  <option value="terminated">Terminados</option>
                  <option value="on_leave">En Licencia</option>
                  <option value="all">Todos</option>
                </select>

                {/* Clear Filters */}
                {(search || statusFilter !== 'active') && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSearch('')
                      setStatusFilter('active')
                    }}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    <X className="w-4 h-4" />
                    Limpiar
                  </motion.button>
                )}

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

                {/* New Contract */}
                <Link href="/dashboard/market/hr/contracts/create">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all shadow-lg shadow-amber-500/25"
                  >
                    <Plus className="w-5 h-5" />
                    Nuevo Contrato
                  </motion.button>
                </Link>
              </div>
            </motion.div>

            {/* Contracts Table */}
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
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Empleado</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Contrato</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Salario</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Inicio</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan={7} className="py-4 px-4">
                            <div className="animate-pulse flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                              <div className="flex-1">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2" />
                                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : filteredContracts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center">
                          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className="text-gray-500 dark:text-gray-400">No hay contratos</p>
                          <Link href="/dashboard/market/hr/contracts/create">
                            <button className="mt-3 text-sm text-amber-500 hover:text-amber-600">
                              Crear primer contrato
                            </button>
                          </Link>
                        </td>
                      </tr>
                    ) : (
                      filteredContracts.map((contract, index) => (
                        <motion.tr
                          key={contract.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className={cn(
                            'group transition-colors cursor-pointer',
                            theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                          )}
                          onClick={() => viewContract(contract.id)}
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'w-10 h-10 rounded-xl flex items-center justify-center',
                                theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100'
                              )}>
                                <User className="w-5 h-5 text-amber-600" />
                              </div>
                              <div>
                                <p className={cn(
                                  'font-medium',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {contract.employeeName}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {contract.position || 'Sin cargo'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={cn(
                              'px-2 py-1 rounded-lg text-xs font-mono',
                              theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                            )}>
                              {contract.contractNumber}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {contractTypeLabels[contract.contractType] || contract.contractType}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div>
                              <p className="text-sm font-bold text-amber-600">
                                {formatCurrency(contract.payRate)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {payTypeLabels[contract.payType]?.toLowerCase() || contract.payType}
                              </p>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {formatDate(contract.startDate)}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={cn(
                              'inline-flex px-2.5 py-1 rounded-lg text-xs font-medium',
                              statusColors[contract.status]?.bg || 'bg-gray-100',
                              statusColors[contract.status]?.text || 'text-gray-700'
                            )}>
                              {contract.status === 'active' ? 'Activo' : contract.status === 'terminated' ? 'Terminado' : 'Licencia'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  viewContract(contract.id)
                                }}
                                className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                title="Ver detalle"
                              >
                                <Eye className="w-4 h-4 text-blue-500" />
                              </motion.button>
                              <Link
                                href={`/dashboard/market/hr/contracts/create?edit=${contract.id}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  className="p-2 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4 text-amber-500" />
                                </motion.button>
                              </Link>
                            </div>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Details Modal */}
        <AnimatePresence>
          {showDetails && selectedContract && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowDetails(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                )}
              >
                <div className={cn(
                  'p-6 border-b',
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                )}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className={cn(
                        'text-xl font-bold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {selectedContract.contractNumber}
                      </h2>
                      <p className="text-sm text-gray-500">{selectedContract.employeeName}</p>
                    </div>
                    <button
                      onClick={() => setShowDetails(false)}
                      className={cn(
                        'p-2 rounded-lg transition-colors',
                        theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                      )}
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Tipo de Contrato</p>
                      <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {contractTypeLabels[selectedContract.contractType]}
                      </p>
                    </div>
                    <div>
                      <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Cargo</p>
                      <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {selectedContract.position || '-'}
                      </p>
                    </div>
                    <div>
                      <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Fecha de Inicio</p>
                      <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {formatDate(selectedContract.startDate)}
                      </p>
                    </div>
                    <div>
                      <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Fecha de Fin</p>
                      <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {selectedContract.endDate ? formatDate(selectedContract.endDate) : 'Indefinido'}
                      </p>
                    </div>
                    <div>
                      <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Tipo de Pago</p>
                      <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {payTypeLabels[selectedContract.payType]}
                      </p>
                    </div>
                    <div>
                      <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Salario</p>
                      <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {formatCurrency(selectedContract.payRate)} {selectedContract.currency}
                      </p>
                    </div>
                    <div>
                      <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Comision</p>
                      <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {selectedContract.commissionRate}%
                      </p>
                    </div>
                    <div>
                      <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Estado</p>
                      <span className={cn(
                        'inline-flex px-2.5 py-1 rounded-lg text-xs font-medium',
                        statusColors[selectedContract.status]?.bg || 'bg-gray-100',
                        statusColors[selectedContract.status]?.text || 'text-gray-700'
                      )}>
                        {selectedContract.status === 'active' ? 'Activo' : selectedContract.status === 'terminated' ? 'Terminado' : 'Licencia'}
                      </span>
                    </div>
                  </div>

                  {(selectedContract.departmentName || selectedContract.scheduleName) && (
                    <div className={cn(
                      'pt-4 border-t',
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <div className="grid grid-cols-2 gap-4">
                        {selectedContract.departmentName && (
                          <div>
                            <p className={cn('text-sm flex items-center gap-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                              <Building2 className="w-4 h-4" /> Departamento
                            </p>
                            <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {selectedContract.departmentName}
                            </p>
                          </div>
                        )}
                        {selectedContract.scheduleName && (
                          <div>
                            <p className={cn('text-sm flex items-center gap-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                              <Clock className="w-4 h-4" /> Horario
                            </p>
                            <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {selectedContract.scheduleName}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
