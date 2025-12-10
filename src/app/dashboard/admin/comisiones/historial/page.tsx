'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign,
  Users,
  Building2,
  Loader2,
  AlertCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
  TrendingUp,
  ArrowLeft,
  Filter,
  Download
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { useAuth } from '@/hooks/useAuth'
import { useSearchParams, useRouter } from 'next/navigation'

const roleLabels: Record<string, string> = {
  DRIVER: 'Driver',
  USER: 'Usuario',
  MANAGER: 'Manager',
  ADMIN: 'Admin',
  ALL: 'Todos'
}

const roleColors: Record<string, { bg: string; text: string }> = {
  DRIVER: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  USER: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  MANAGER: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
  ADMIN: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  ALL: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300' }
}

interface Commission {
  id: number
  userId: number
  userName: string
  userEmail: string
  userRole: string
  serviceType: string
  serviceId: number
  serviceReference: string
  productId: number
  productName: string
  productPrice: number | null
  commissionType: string
  commissionRate: number | null
  commissionAmount: number
  transactionId: number
  transactionNumber: string
  status: string
  createdAt: string
  paidAt: string
  notes: string | null
}

interface Employee {
  id: number
  name: string
}

interface Company {
  id: number
  legalName: string
  status: string
}

export default function CommissionsHistoryPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  // State
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(
    searchParams.get('companyId') ? parseInt(searchParams.get('companyId')!) : null
  )
  const [loadingCompanies, setLoadingCompanies] = useState(true)
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')

  // Pagination
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Totals
  const [totals, setTotals] = useState({
    grandTotal: { count: 0, amount: 0 },
    thisMonth: { count: 0, amount: 0 },
    byRole: {} as Record<string, { count: number; amount: number }>
  })

  // Fetch companies on mount
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setLoadingCompanies(true)
        const response = await fetch('/api/companies')
        const result = await response.json()
        if (result.success) {
          const activeCompanies = result.data.filter((c: Company) => c.status === 'active')
          setCompanies(activeCompanies)
          // If not SUPER_ADMIN, select user's company by default
          if (!isSuperAdmin && user?.companyId) {
            setSelectedCompanyId(parseInt(user.companyId))
          }
        }
      } catch (err) {
        console.error('Error fetching companies:', err)
      } finally {
        setLoadingCompanies(false)
      }
    }
    fetchCompanies()
  }, [isSuperAdmin, user?.companyId])

  // Fetch commissions when filters change
  useEffect(() => {
    if (selectedCompanyId) {
      fetchCommissions()
    }
  }, [selectedCompanyId, page, selectedEmployee, startDate, endDate])

  const fetchCommissions = async () => {
    if (!selectedCompanyId) return

    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })

      if (selectedEmployee) params.append('userId', selectedEmployee)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`/api/companies/${selectedCompanyId}/commissions/history?${params}`)
      const result = await response.json()

      if (result.success) {
        setCommissions(result.data.commissions)
        setEmployees(result.data.employees)
        setTotalPages(result.data.pagination.totalPages)
        setTotal(result.data.pagination.total)
        setTotals(result.data.totals)
      } else {
        setError(result.error || 'Error al cargar historial')
      }
    } catch (err) {
      setError('Error de conexion al cargar historial')
      console.error('Error fetching commissions:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filter commissions by search term (client-side)
  const filteredCommissions = commissions.filter(c =>
    c.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.transactionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.serviceReference?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard/admin/comisiones')}
              className={cn(
                "p-2 rounded-lg transition-colors",
                theme === 'dark'
                  ? "hover:bg-gray-800 text-gray-400 hover:text-white"
                  : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
              )}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className={cn(
                "text-2xl font-bold",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                Historial de Comisiones
              </h1>
              <p className={cn(
                "text-sm mt-1",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                Historial de comisiones pagadas a empleados
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {selectedCompanyId && !loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Grand Total */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "relative overflow-hidden rounded-xl border p-4",
                theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600" />
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  theme === 'dark' ? "bg-blue-900/30" : "bg-blue-50"
                )}>
                  <DollarSign className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className={cn("text-sm", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
                    Total Pagado
                  </p>
                  <p className={cn("text-2xl font-bold", theme === 'dark' ? "text-white" : "text-gray-900")}>
                    ${totals.grandTotal.amount.toFixed(2)}
                  </p>
                  <p className={cn("text-xs", theme === 'dark' ? "text-gray-500" : "text-gray-400")}>
                    {totals.grandTotal.count} pagos
                  </p>
                </div>
              </div>
            </motion.div>

            {/* This Month */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={cn(
                "relative overflow-hidden rounded-xl border p-4",
                theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-green-600" />
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  theme === 'dark' ? "bg-green-900/30" : "bg-green-50"
                )}>
                  <Calendar className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className={cn("text-sm", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
                    Este Mes
                  </p>
                  <p className={cn("text-2xl font-bold", theme === 'dark' ? "text-white" : "text-gray-900")}>
                    ${totals.thisMonth.amount.toFixed(2)}
                  </p>
                  <p className={cn("text-xs", theme === 'dark' ? "text-gray-500" : "text-gray-400")}>
                    {totals.thisMonth.count} pagos
                  </p>
                </div>
              </div>
            </motion.div>

            {/* By Role - Drivers */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={cn(
                "relative overflow-hidden rounded-xl border p-4",
                theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-purple-600" />
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  theme === 'dark' ? "bg-purple-900/30" : "bg-purple-50"
                )}>
                  <Users className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className={cn("text-sm", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
                    Drivers
                  </p>
                  <p className={cn("text-2xl font-bold", theme === 'dark' ? "text-white" : "text-gray-900")}>
                    ${(totals.byRole?.DRIVER?.amount || 0).toFixed(2)}
                  </p>
                  <p className={cn("text-xs", theme === 'dark' ? "text-gray-500" : "text-gray-400")}>
                    {totals.byRole?.DRIVER?.count || 0} pagos
                  </p>
                </div>
              </div>
            </motion.div>

            {/* By Role - Users */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={cn(
                "relative overflow-hidden rounded-xl border p-4",
                theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-amber-600" />
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  theme === 'dark' ? "bg-amber-900/30" : "bg-amber-50"
                )}>
                  <TrendingUp className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className={cn("text-sm", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
                    Usuarios
                  </p>
                  <p className={cn("text-2xl font-bold", theme === 'dark' ? "text-white" : "text-gray-900")}>
                    ${(totals.byRole?.USER?.amount || 0).toFixed(2)}
                  </p>
                  <p className={cn("text-xs", theme === 'dark' ? "text-gray-500" : "text-gray-400")}>
                    {totals.byRole?.USER?.count || 0} pagos
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Filters */}
        <div className={cn(
          "p-4 rounded-xl border",
          theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            {/* Company Selector */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <Building2 className={cn("w-5 h-5", theme === 'dark' ? "text-gray-400" : "text-gray-500")} />
              <select
                value={selectedCompanyId || ''}
                onChange={(e) => {
                  setSelectedCompanyId(e.target.value ? parseInt(e.target.value) : null)
                  setPage(1)
                }}
                disabled={loadingCompanies || (!isSuperAdmin && user?.companyId !== undefined)}
                className={cn(
                  "min-w-[180px] px-3 py-2 rounded-lg border transition-colors text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500",
                  theme === 'dark'
                    ? "bg-gray-900 border-gray-700 text-white"
                    : "bg-white border-gray-200 text-gray-900"
                )}
              >
                <option value="">Seleccionar empresa...</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>
                    {company.legalName}
                  </option>
                ))}
              </select>
            </div>

            {/* Employee Filter */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <Users className={cn("w-5 h-5", theme === 'dark' ? "text-gray-400" : "text-gray-500")} />
              <select
                value={selectedEmployee}
                onChange={(e) => {
                  setSelectedEmployee(e.target.value)
                  setPage(1)
                }}
                className={cn(
                  "min-w-[160px] px-3 py-2 rounded-lg border transition-colors text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500",
                  theme === 'dark'
                    ? "bg-gray-900 border-gray-700 text-white"
                    : "bg-white border-gray-200 text-gray-900"
                )}
              >
                <option value="">Todos los empleados</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Filters */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Calendar className={cn("w-5 h-5", theme === 'dark' ? "text-gray-400" : "text-gray-500")} />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setPage(1)
                }}
                className={cn(
                  "px-3 py-2 rounded-lg border transition-colors text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500",
                  theme === 'dark'
                    ? "bg-gray-900 border-gray-700 text-white"
                    : "bg-white border-gray-200 text-gray-900"
                )}
              />
              <span className={cn("text-sm", theme === 'dark' ? "text-gray-400" : "text-gray-500")}>a</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setPage(1)
                }}
                className={cn(
                  "px-3 py-2 rounded-lg border transition-colors text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500",
                  theme === 'dark'
                    ? "bg-gray-900 border-gray-700 text-white"
                    : "bg-white border-gray-200 text-gray-900"
                )}
              />
            </div>

            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por nombre, producto, referencia..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  "w-full h-10 pl-10 pr-4 rounded-lg border transition-colors text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500",
                  theme === 'dark'
                    ? "bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                    : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
                )}
              />
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-500">Cargando historial...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className={cn(
            "p-4 rounded-lg border",
            theme === 'dark'
              ? "bg-red-900/20 border-red-800 text-red-400"
              : "bg-red-50 border-red-200 text-red-600"
          )}>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* No Company Selected */}
        {!selectedCompanyId && !loading && (
          <div className={cn(
            "p-12 text-center rounded-xl border-2 border-dashed",
            theme === 'dark' ? "border-gray-700" : "border-gray-200"
          )}>
            <Building2 className={cn(
              "w-12 h-12 mx-auto mb-4",
              theme === 'dark' ? "text-gray-600" : "text-gray-400"
            )} />
            <h3 className={cn(
              "font-medium mb-1",
              theme === 'dark' ? "text-gray-300" : "text-gray-700"
            )}>
              Selecciona una empresa
            </h3>
            <p className={cn(
              "text-sm",
              theme === 'dark' ? "text-gray-500" : "text-gray-400"
            )}>
              Para ver el historial de comisiones, primero selecciona una empresa
            </p>
          </div>
        )}

        {/* Commissions Table */}
        {selectedCompanyId && !loading && !error && (
          <div className={cn(
            "rounded-xl border overflow-hidden",
            theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
          )}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={cn(
                    "text-left text-xs uppercase tracking-wider",
                    theme === 'dark' ? "bg-gray-900/50 text-gray-400" : "bg-gray-50 text-gray-500"
                  )}>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Empleado</th>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3">Servicio</th>
                    <th className="px-4 py-3 text-center">Tipo</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredCommissions.length > 0 ? (
                    filteredCommissions.map((commission) => (
                      <tr
                        key={commission.id}
                        className={cn(
                          "transition-colors",
                          theme === 'dark' ? "hover:bg-gray-800/50" : "hover:bg-gray-50"
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className={cn(
                            "text-sm",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            {formatDate(commission.paidAt || commission.createdAt)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <div className={cn(
                              "font-medium text-sm",
                              theme === 'dark' ? "text-white" : "text-gray-900"
                            )}>
                              {commission.userName}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "text-xs",
                                theme === 'dark' ? "text-gray-500" : "text-gray-400"
                              )}>
                                {commission.userEmail}
                              </span>
                              <span className={cn(
                                "inline-flex px-1.5 py-0.5 rounded text-xs font-medium",
                                roleColors[commission.userRole]?.bg,
                                roleColors[commission.userRole]?.text
                              )}>
                                {roleLabels[commission.userRole] || commission.userRole}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className={cn(
                            "text-sm",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            {commission.productName}
                          </div>
                          {commission.productPrice && (
                            <div className={cn(
                              "text-xs",
                              theme === 'dark' ? "text-gray-500" : "text-gray-400"
                            )}>
                              Precio: ${commission.productPrice.toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className={cn(
                            "text-sm",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            {commission.serviceType}
                          </div>
                          {commission.serviceReference && (
                            <div className={cn(
                              "text-xs font-mono",
                              theme === 'dark' ? "text-gray-500" : "text-gray-400"
                            )}>
                              {commission.serviceReference}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            "inline-flex px-2 py-1 rounded text-xs font-medium",
                            commission.commissionType === 'fixed'
                              ? theme === 'dark' ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-600"
                              : theme === 'dark' ? "bg-purple-900/30 text-purple-400" : "bg-purple-50 text-purple-600"
                          )}>
                            {commission.commissionType === 'fixed' ? 'Fijo' : `${commission.commissionRate}%`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn(
                            "text-sm font-semibold",
                            theme === 'dark' ? "text-green-400" : "text-green-600"
                          )}>
                            ${commission.commissionAmount.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            "inline-flex px-2 py-1 rounded text-xs font-medium",
                            commission.status === 'paid'
                              ? theme === 'dark' ? "bg-green-900/30 text-green-400" : "bg-green-50 text-green-600"
                              : theme === 'dark' ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-500"
                          )}>
                            {commission.status === 'paid' ? 'Pagado' : commission.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <DollarSign className={cn(
                          "w-12 h-12 mx-auto mb-4",
                          theme === 'dark' ? "text-gray-600" : "text-gray-400"
                        )} />
                        <p className={cn(
                          "font-medium",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          No hay comisiones registradas
                        </p>
                        <p className={cn(
                          "text-sm mt-1",
                          theme === 'dark' ? "text-gray-500" : "text-gray-400"
                        )}>
                          {searchTerm
                            ? 'No se encontraron resultados con ese termino de busqueda'
                            : 'Las comisiones apareceran aqui cuando se procesen servicios'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={cn(
                "flex items-center justify-between px-4 py-3 border-t",
                theme === 'dark' ? "border-gray-700" : "border-gray-200"
              )}>
                <div className={cn(
                  "text-sm",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} de {total}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      page === 1
                        ? "opacity-50 cursor-not-allowed"
                        : theme === 'dark'
                          ? "hover:bg-gray-700"
                          : "hover:bg-gray-100"
                    )}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className={cn(
                    "text-sm",
                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                  )}>
                    Pagina {page} de {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      page === totalPages
                        ? "opacity-50 cursor-not-allowed"
                        : theme === 'dark'
                          ? "hover:bg-gray-700"
                          : "hover:bg-gray-100"
                    )}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
