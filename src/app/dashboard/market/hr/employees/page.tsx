'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Monitor,
  DollarSign,
  BadgeCheck,
  KeyRound,
  Building2,
  FileText,
  Fingerprint
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

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

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  terminated: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
}

export default function HREmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [employeeContracts, setEmployeeContracts] = useState<Contract[]>([])
  const [showDetails, setShowDetails] = useState(false)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetchEmployees()
  }, [statusFilter])

  const fetchEmployees = async () => {
    try {
      setLoading(true)
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
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchEmployees()
  }

  const viewEmployee = async (employee: Employee) => {
    setSelectedEmployee(employee)
    setShowDetails(true)

    // Fetch contracts for this employee
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

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Users className="w-8 h-8 text-blue-600" />
                Empleados
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                {total} empleados registrados
              </p>
            </div>
            <Link
              href="/dashboard/market/accounting/employees/create"
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Nuevo Empleado
            </Link>
          </motion.div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
              <p className="text-2xl font-bold text-green-600">{employees.filter(e => e.status === 'active').length}</p>
              <p className="text-sm text-gray-500">Activos</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
              <p className="text-2xl font-bold text-purple-600">{employees.filter(e => e.hasPIN).length}</p>
              <p className="text-sm text-gray-500">Con PIN</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
              <p className="text-2xl font-bold text-indigo-600">{employees.filter(e => e.hasFaceRegistered).length}</p>
              <p className="text-sm text-gray-500">Reconocimiento Facial</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
              <p className="text-2xl font-bold text-blue-600">{employees.filter(e => e.terminals && e.terminals.length > 0).length}</p>
              <p className="text-sm text-gray-500">Con Terminal</p>
            </div>
          </div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, email o código..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </form>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
                <option value="terminated">Dados de Baja</option>
                <option value="all">Todos</option>
              </select>
            </div>
          </motion.div>

          {/* Employees List */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : employees.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-lg"
            >
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No hay empleados
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Comienza agregando tu primer empleado
              </p>
              <Link
                href="/dashboard/market/accounting/employees/create"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Crear Empleado
              </Link>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {employees.map((employee, idx) => (
                <motion.div
                  key={employee.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 hover:shadow-xl transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
                      {employee.fullName.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900 dark:text-white truncate">
                          {employee.fullName}
                        </h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[employee.status]}`}>
                          {employee.status === 'active' ? 'Activo' : employee.status === 'inactive' ? 'Inactivo' : 'Baja'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {employee.employeeCode} • {employee.email}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          {roleLabels[employee.role] || employee.role}
                        </span>
                        {employee.departmentName && (
                          <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                            <Building2 className="w-4 h-4" />
                            {employee.departmentName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Access Indicators */}
                    <div className="hidden md:flex items-center gap-2">
                      {employee.hasPIN && (
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg" title="Tiene PIN">
                          <KeyRound className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                      )}
                      {employee.badgeCode && (
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg" title="Tiene Badge">
                          <BadgeCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                      )}
                      {employee.hasFaceRegistered && (
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg" title="Reconocimiento Facial">
                          <Fingerprint className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                      )}
                      {employee.terminals && employee.terminals.length > 0 && (
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg" title={`${employee.terminals.length} terminal(es)`}>
                          <Monitor className="w-4 h-4 text-green-600 dark:text-green-400" />
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => viewEmployee(employee)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Ver detalles"
                      >
                        <Eye className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      </button>
                      <Link
                        href={`/dashboard/market/accounting/employees/create?edit=${employee.id}`}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      </Link>
                      <Link
                        href={`/dashboard/market/hr/contracts/create?employeeId=${employee.id}`}
                        className="p-2 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                        title="Crear Contrato"
                      >
                        <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      </Link>
                      {employee.status === 'active' && (
                        <button
                          onClick={() => terminateEmployee(employee.id)}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Dar de baja"
                        >
                          <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Employee Details Modal */}
          {showDetails && selectedEmployee && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-2xl">
                        {selectedEmployee.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                          {selectedEmployee.fullName}
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400">
                          {selectedEmployee.employeeCode}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowDetails(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedEmployee.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Teléfono</p>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedEmployee.phone || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Rol</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {roleLabels[selectedEmployee.role] || selectedEmployee.role}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Fecha de Ingreso</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {new Date(selectedEmployee.hireDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Departamento</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {selectedEmployee.departmentName || 'Sin asignar'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Estado</p>
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[selectedEmployee.status]}`}>
                        {selectedEmployee.status === 'active' ? 'Activo' : selectedEmployee.status === 'inactive' ? 'Inactivo' : 'Baja'}
                      </span>
                    </div>
                  </div>

                  {/* Contracts */}
                  {employeeContracts.length > 0 && (
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Contratos
                      </h3>
                      <div className="space-y-2">
                        {employeeContracts.map(contract => (
                          <div
                            key={contract.id}
                            className={`p-3 rounded-lg ${
                              contract.status === 'active'
                                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                : 'bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {contract.contractNumber}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {contract.position || 'Sin cargo'}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-gray-900 dark:text-white">
                                  ${contract.payRate} {contract.currency}
                                </p>
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
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
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

                  {selectedEmployee.terminals && selectedEmployee.terminals.length > 0 && (
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Terminales Asignados</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedEmployee.terminals.map((t, idx) => (
                          <span key={idx} className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded-lg text-sm">
                            {t.terminalName}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
