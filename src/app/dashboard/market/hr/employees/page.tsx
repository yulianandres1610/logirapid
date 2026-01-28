'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Monitor,
  BadgeCheck,
  KeyRound,
  Building2,
  FileText,
  Fingerprint,
  Camera,
  RefreshCw,
  X
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Employee {
  id: number
  userId: number
  employeeCode: string
  email: string
  firstName: string | null
  lastName: string | null
  fullName: string
  phone: string | null
  role: string
  hireDate: string
  terminationDate: string | null
  status: string
  payType: string
  payRate: number
  currency: string
  hasPIN: boolean
  badgeCode: string | null
  commissionRate: number
  departmentId: number | null
  departmentName: string | null
  hasFaceRegistered: boolean
  terminals: Array<{
    terminalId: number
    terminalName: string
  }>
  createdAt: string
}

interface Contract {
  id: number
  contractNumber: string
  position: string | null
  payType: string
  payRate: number
  currency: string
  commissionRate: number
  status: string
}

const roleLabels: Record<string, string> = {
  MARKET_MANAGER: 'Manager',
  MARKET_COMERCIAL: 'Comercial',
  MARKET_ALMACENERO: 'Almacenero',
  MARKET_VENDEDOR: 'Vendedor',
  MARKET_MANAGER_TIENDA: 'Manager Tienda'
}

export default function HREmployeesPage() {
  const { theme } = useTheme()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [employeeContracts, setEmployeeContracts] = useState<Contract[]>([])
  const [showDetails, setShowDetails] = useState(false)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetchEmployees()
  }, [statusFilter])

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchEmployees()
    }, 300)
    return () => clearTimeout(debounce)
  }, [search])

  const fetchEmployees = async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const params = new URLSearchParams({
        status: statusFilter,
        search: search
      })
      const response = await fetch(`/api/market/accounting/employees?${params}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setEmployees(result.data.employees)
          setTotal(result.data.total)
        }
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
    } finally {
      if (!silent) setLoading(false)
      else setIsRefreshing(false)
    }
  }

  const viewEmployee = async (employee: Employee) => {
    setSelectedEmployee(employee)
    setShowDetails(true)

    try {
      const response = await fetch(`/api/market/hr/contracts?employeeId=${employee.id}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setEmployeeContracts(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching contracts:', error)
    }
  }

  const terminateEmployee = async (id: number) => {
    if (!confirm('¿Estás seguro de dar de baja a este empleado?')) return

    try {
      const response = await fetch(`/api/market/accounting/employees/${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        fetchEmployees()
      }
    } catch (error) {
      console.error('Error terminating employee:', error)
    }
  }

  // Stats
  const stats = {
    total: total,
    active: employees.filter(e => e.status === 'active').length,
    withPIN: employees.filter(e => e.hasPIN).length,
    withFace: employees.filter(e => e.hasFaceRegistered).length
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
              {/* Total Empleados */}
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
                        )}>Total Empleados</p>
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
                    )}>Registrados en el sistema</span>
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
                        <BadgeCheck className="w-6 h-6 text-green-600" />
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
                    )}>Empleados trabajando</span>
                  </div>
                </div>
              </motion.div>

              {/* Con PIN */}
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
                        <KeyRound className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Con PIN</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.withPIN}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>PIN configurado</span>
                  </div>
                </div>
              </motion.div>

              {/* Reconocimiento Facial */}
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
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-indigo-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-indigo-900/30 border border-indigo-800/50'
                          : 'bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200'
                      )}>
                        <Fingerprint className="w-6 h-6 text-indigo-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Reconocimiento Facial</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.withFace}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>Rostro registrado</span>
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
                    placeholder="Buscar por nombre, email o código..."
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
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                  <option value="terminated">Dados de Baja</option>
                  <option value="all">Todos</option>
                </select>

                {/* Refresh */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => fetchEmployees(true)}
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

                {/* Nuevo Empleado */}
                <Link href="/dashboard/market/accounting/employees/create">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25"
                  >
                    <Plus className="w-5 h-5" />
                    Nuevo Empleado
                  </motion.button>
                </Link>
              </div>
            </motion.div>

            {/* Employees Table */}
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
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Departamento</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Accesos</th>
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
                              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
                              <div className="flex-1">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : employees.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center">
                          <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className={cn(
                            'font-medium mb-1',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>No hay empleados</p>
                          <p className="text-gray-500 dark:text-gray-400">
                            Comienza agregando tu primer empleado
                          </p>
                          <Link
                            href="/dashboard/market/accounting/employees/create"
                            className="mt-3 inline-flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600"
                          >
                            <Plus className="w-4 h-4" />
                            Crear Empleado
                          </Link>
                        </td>
                      </tr>
                    ) : (
                      employees.map((employee, index) => (
                        <motion.tr
                          key={employee.id}
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
                                {employee.fullName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className={cn(
                                  'font-medium',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {employee.fullName}
                                </p>
                                <p className="text-xs text-gray-500">{employee.employeeCode} • {employee.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={cn(
                              'text-sm',
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              {roleLabels[employee.role] || employee.role}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            {employee.departmentName ? (
                              <span className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
                                theme === 'dark' ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700'
                              )}>
                                <Building2 className="w-3 h-3" />
                                {employee.departmentName}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">Sin asignar</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center justify-center gap-1">
                              {employee.hasPIN && (
                                <div className={cn(
                                  'p-1.5 rounded-lg',
                                  theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                                )} title="PIN">
                                  <KeyRound className="w-3.5 h-3.5 text-purple-600" />
                                </div>
                              )}
                              {employee.badgeCode && (
                                <div className={cn(
                                  'p-1.5 rounded-lg',
                                  theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                                )} title="Badge">
                                  <BadgeCheck className="w-3.5 h-3.5 text-blue-600" />
                                </div>
                              )}
                              {employee.hasFaceRegistered && (
                                <div className={cn(
                                  'p-1.5 rounded-lg',
                                  theme === 'dark' ? 'bg-indigo-900/30' : 'bg-indigo-100'
                                )} title="Reconocimiento Facial">
                                  <Fingerprint className="w-3.5 h-3.5 text-indigo-600" />
                                </div>
                              )}
                              {employee.terminals && employee.terminals.length > 0 && (
                                <div className={cn(
                                  'p-1.5 rounded-lg',
                                  theme === 'dark' ? 'bg-green-900/30' : 'bg-green-100'
                                )} title={`${employee.terminals.length} terminal(es)`}>
                                  <Monitor className="w-3.5 h-3.5 text-green-600" />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={cn(
                              'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium',
                              employee.status === 'active'
                                ? theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                                : employee.status === 'inactive'
                                  ? theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-700'
                                  : theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
                            )}>
                              {employee.status === 'active' ? 'Activo' : employee.status === 'inactive' ? 'Inactivo' : 'Baja'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => viewEmployee(employee)}
                                className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                title="Ver detalles"
                              >
                                <Eye className="w-4 h-4 text-blue-500" />
                              </motion.button>
                              <Link href={`/dashboard/market/accounting/employees/create?edit=${employee.id}`}>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4 text-gray-500" />
                                </motion.button>
                              </Link>
                              <Link href={`/dashboard/market/hr/contracts/create?employeeId=${employee.id}`}>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  className="p-2 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                                  title="Crear Contrato"
                                >
                                  <FileText className="w-4 h-4 text-amber-500" />
                                </motion.button>
                              </Link>
                              <Link href={`/dashboard/market/hr/employees/${employee.id}/register-face`}>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  className={cn(
                                    'p-2 rounded-lg transition-colors',
                                    employee.hasFaceRegistered
                                      ? 'bg-indigo-100 dark:bg-indigo-900/30'
                                      : 'hover:bg-indigo-100 dark:hover:bg-indigo-900/30'
                                  )}
                                  title={employee.hasFaceRegistered ? 'Actualizar Reconocimiento Facial' : 'Registrar Rostro'}
                                >
                                  <Camera className={cn(
                                    'w-4 h-4',
                                    employee.hasFaceRegistered ? 'text-indigo-600' : 'text-gray-400'
                                  )} />
                                </motion.button>
                              </Link>
                              {employee.status === 'active' && (
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => terminateEmployee(employee.id)}
                                  className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                  title="Dar de baja"
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </motion.button>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Employee Details Modal */}
            <AnimatePresence>
              {showDetails && selectedEmployee && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
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
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-2xl">
                            {selectedEmployee.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h2 className={cn(
                              'text-xl font-bold',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {selectedEmployee.fullName}
                            </h2>
                            <p className="text-gray-500">{selectedEmployee.employeeCode}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowDetails(false)}
                          className={cn(
                            'p-2 rounded-lg transition-colors',
                            theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                          )}
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Email</p>
                          <p className={cn(
                            'font-medium',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>{selectedEmployee.email}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Teléfono</p>
                          <p className={cn(
                            'font-medium',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>{selectedEmployee.phone || '-'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Rol</p>
                          <p className={cn(
                            'font-medium',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>{roleLabels[selectedEmployee.role] || selectedEmployee.role}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Fecha de Ingreso</p>
                          <p className={cn(
                            'font-medium',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>{new Date(selectedEmployee.hireDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Departamento</p>
                          <p className={cn(
                            'font-medium',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>{selectedEmployee.departmentName || 'Sin asignar'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Estado</p>
                          <span className={cn(
                            'inline-block px-2 py-0.5 text-xs font-medium rounded-full',
                            selectedEmployee.status === 'active'
                              ? theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                              : selectedEmployee.status === 'inactive'
                                ? theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-700'
                                : theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
                          )}>
                            {selectedEmployee.status === 'active' ? 'Activo' : selectedEmployee.status === 'inactive' ? 'Inactivo' : 'Baja'}
                          </span>
                        </div>
                      </div>

                      {/* Contracts */}
                      {employeeContracts.length > 0 && (
                        <div className={cn(
                          'pt-4 border-t',
                          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                        )}>
                          <h3 className={cn(
                            'font-medium mb-3 flex items-center gap-2',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            <FileText className="w-4 h-4" />
                            Contratos
                          </h3>
                          <div className="space-y-2">
                            {employeeContracts.map(contract => (
                              <div
                                key={contract.id}
                                className={cn(
                                  'p-3 rounded-lg border',
                                  contract.status === 'active'
                                    ? theme === 'dark'
                                      ? 'bg-green-900/20 border-green-800'
                                      : 'bg-green-50 border-green-200'
                                    : theme === 'dark'
                                      ? 'bg-gray-900 border-gray-700'
                                      : 'bg-gray-50 border-gray-200'
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className={cn(
                                      'font-medium',
                                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    )}>{contract.contractNumber}</p>
                                    <p className="text-sm text-gray-500">{contract.position || 'Sin cargo'}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className={cn(
                                      'font-medium',
                                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    )}>${contract.payRate} {contract.currency}</p>
                                    {contract.commissionRate > 0 && (
                                      <p className="text-sm text-green-600">{contract.commissionRate}% comisión</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <Link
                            href={`/dashboard/market/hr/contracts/create?employeeId=${selectedEmployee.id}`}
                            className="mt-3 inline-flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700"
                          >
                            <Plus className="w-4 h-4" />
                            Crear nuevo contrato
                          </Link>
                        </div>
                      )}

                      {employeeContracts.length === 0 && (
                        <div className={cn(
                          'pt-4 border-t text-center',
                          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                        )}>
                          <p className="text-gray-500 mb-3">Este empleado no tiene contratos</p>
                          <Link
                            href={`/dashboard/market/hr/contracts/create?employeeId=${selectedEmployee.id}`}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                          >
                            <Plus className="w-4 h-4" />
                            Crear Contrato
                          </Link>
                        </div>
                      )}

                      {/* Face Registration */}
                      <div className={cn(
                        'pt-4 border-t',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <h3 className={cn(
                          'font-medium mb-3 flex items-center gap-2',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          <Fingerprint className="w-4 h-4" />
                          Reconocimiento Facial
                        </h3>
                        <div className={cn(
                          'p-4 rounded-lg border',
                          selectedEmployee.hasFaceRegistered
                            ? theme === 'dark'
                              ? 'bg-indigo-900/20 border-indigo-800'
                              : 'bg-indigo-50 border-indigo-200'
                            : theme === 'dark'
                              ? 'bg-gray-900 border-gray-700'
                              : 'bg-gray-50 border-gray-200'
                        )}>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            {selectedEmployee.hasFaceRegistered
                              ? 'Este empleado tiene reconocimiento facial configurado.'
                              : 'El reconocimiento facial no está configurado.'}
                          </p>
                          <Link
                            href={`/dashboard/market/hr/employees/${selectedEmployee.id}/register-face`}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium"
                          >
                            <Camera className="w-4 h-4" />
                            {selectedEmployee.hasFaceRegistered ? 'Actualizar Registro' : 'Registrar Rostro'}
                          </Link>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
