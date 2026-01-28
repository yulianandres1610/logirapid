'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  Plus,
  Search,
  Users,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  UserCheck,
  FolderOpen
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Department {
  id: number
  name: string
  code: string | null
  description: string | null
  managerId: number | null
  managerName: string | null
  employeeCount: number
  isActive: boolean
  createdAt: string
}

interface Employee {
  id: number
  employeeCode: string
  fullName: string
  status: string
}

interface Stats {
  total: number
  active: number
  inactive: number
  withManager: number
  totalEmployees: number
}

export default function DepartmentsPage() {
  const { theme } = useTheme()
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const [stats, setStats] = useState<Stats>({
    total: 0,
    active: 0,
    inactive: 0,
    withManager: 0,
    totalEmployees: 0
  })

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    managerId: ''
  })

  useEffect(() => {
    fetchDepartments()
    fetchEmployees()
  }, [])

  const fetchDepartments = async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const response = await fetch('/api/market/hr/departments?status=all')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setDepartments(result.data)

          // Calculate stats
          const active = result.data.filter((d: Department) => d.isActive).length
          const withManager = result.data.filter((d: Department) => d.managerId).length
          const totalEmployees = result.data.reduce((sum: number, d: Department) => sum + d.employeeCount, 0)

          setStats({
            total: result.data.length,
            active,
            inactive: result.data.length - active,
            withManager,
            totalEmployees
          })
          setLastUpdated(new Date())
        }
      }
    } catch (error) {
      console.error('Error fetching departments:', error)
    } finally {
      if (!silent) setLoading(false)
      else setIsRefreshing(false)
    }
  }

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/market/accounting/employees?status=active')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setEmployees(result.data.employees.map((e: any) => ({
            id: e.id,
            employeeCode: e.employeeCode,
            fullName: e.fullName,
            status: e.status
          })))
        }
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const url = editingDepartment
        ? `/api/market/hr/departments/${editingDepartment.id}`
        : '/api/market/hr/departments'

      const response = await fetch(url, {
        method: editingDepartment ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          code: formData.code || null,
          description: formData.description || null,
          managerId: formData.managerId ? parseInt(formData.managerId) : null
        })
      })

      const result = await response.json()

      if (result.success) {
        setShowModal(false)
        setEditingDepartment(null)
        setFormData({ name: '', code: '', description: '', managerId: '' })
        fetchDepartments()
      } else {
        setError(result.error || 'Error al guardar departamento')
      }
    } catch (error) {
      console.error('Error saving department:', error)
      setError('Error de conexion')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (dept: Department) => {
    setEditingDepartment(dept)
    setFormData({
      name: dept.name,
      code: dept.code || '',
      description: dept.description || '',
      managerId: dept.managerId?.toString() || ''
    })
    setError('')
    setShowModal(true)
  }

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('¿Estas seguro de desactivar este departamento?')) return

    try {
      const response = await fetch(`/api/market/hr/departments/${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        fetchDepartments()
      }
    } catch (error) {
      console.error('Error deleting department:', error)
    }
  }

  const handleManualRefresh = () => fetchDepartments(true)

  const filteredDepartments = departments.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.code && d.code.toLowerCase().includes(search.toLowerCase()))

    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && d.isActive) ||
      (statusFilter === 'inactive' && !d.isActive)

    return matchesSearch && matchesStatus
  })

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
              {/* Total Departamentos */}
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
                        <Building2 className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Total</p>
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
                    )}>departamentos</span>
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
                        <FolderOpen className="w-6 h-6 text-green-600" />
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

              {/* Con Manager */}
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
                        <UserCheck className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Con Manager</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.withManager}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>tienen manager asignado</span>
                  </div>
                </div>
              </motion.div>

              {/* Total Empleados */}
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
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-amber-900/30 border border-amber-800/50'
                          : 'bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200'
                      )}>
                        <Users className="w-6 h-6 text-amber-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Empleados</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.totalEmployees}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>en todos los departamentos</span>
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
                    placeholder="Buscar por nombre o codigo..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={cn(
                      'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 text-white focus:border-purple-500 focus:ring-purple-500/20'
                        : 'bg-white border-gray-200 text-gray-900 focus:border-purple-500 focus:ring-purple-500/20'
                    )}
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all min-w-[150px]',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-purple-500 focus:ring-purple-500/20'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-purple-500 focus:ring-purple-500/20'
                  )}
                >
                  <option value="all">Todos</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
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

                {/* New Department */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setEditingDepartment(null)
                    setFormData({ name: '', code: '', description: '', managerId: '' })
                    setError('')
                    setShowModal(true)
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg shadow-purple-500/25"
                >
                  <Plus className="w-5 h-5" />
                  Nuevo Departamento
                </motion.button>
              </div>
            </motion.div>

            {/* Departments Table */}
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
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Departamento</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Codigo</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Manager</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Empleados</th>
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
                              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                              <div className="flex-1">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2" />
                                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : filteredDepartments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center">
                          <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className="text-gray-500 dark:text-gray-400">No hay departamentos</p>
                          <button
                            onClick={() => {
                              setEditingDepartment(null)
                              setFormData({ name: '', code: '', description: '', managerId: '' })
                              setShowModal(true)
                            }}
                            className="mt-3 text-sm text-purple-500 hover:text-purple-600"
                          >
                            Crear primer departamento
                          </button>
                        </td>
                      </tr>
                    ) : (
                      filteredDepartments.map((dept, index) => (
                        <motion.tr
                          key={dept.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className={cn(
                            'group transition-colors',
                            theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50',
                            !dept.isActive && 'opacity-60'
                          )}
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'w-10 h-10 rounded-xl flex items-center justify-center',
                                theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                              )}>
                                <Building2 className="w-5 h-5 text-purple-600" />
                              </div>
                              <div>
                                <p className={cn(
                                  'font-medium',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {dept.name}
                                </p>
                                {dept.description && (
                                  <p className="text-xs text-gray-500 truncate max-w-[200px]">
                                    {dept.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            {dept.code ? (
                              <span className={cn(
                                'px-2 py-1 rounded-lg text-xs font-mono',
                                theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                              )}>
                                {dept.code}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            {dept.managerName ? (
                              <div className="flex items-center gap-2">
                                <UserCheck className="w-4 h-4 text-blue-500" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">{dept.managerName}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">Sin asignar</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={cn(
                              'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-medium',
                              dept.employeeCount > 0
                                ? theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'
                                : theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                            )}>
                              <Users className="w-3.5 h-3.5" />
                              {dept.employeeCount}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={cn(
                              'inline-flex px-2.5 py-1 rounded-lg text-xs font-medium',
                              dept.isActive
                                ? theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                                : theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                            )}>
                              {dept.isActive ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleEdit(dept)}
                                className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4 text-blue-500" />
                              </motion.button>
                              {dept.isActive && (
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={(e) => handleDelete(dept.id, e)}
                                  className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                  title="Desactivar"
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
          </motion.div>
        </div>

        {/* Modal */}
        <AnimatePresence>
          {showModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'rounded-2xl shadow-2xl max-w-md w-full',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                )}
              >
                <div className={cn(
                  'p-6 border-b',
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                )}>
                  <div className="flex items-center justify-between">
                    <h2 className={cn(
                      'text-xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {editingDepartment ? 'Editar Departamento' : 'Nuevo Departamento'}
                    </h2>
                    <button
                      onClick={() => setShowModal(false)}
                      className={cn(
                        'p-2 rounded-lg transition-colors',
                        theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                      )}
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                      {error}
                    </div>
                  )}

                  <div>
                    <label className={cn(
                      'block text-sm font-medium mb-1',
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Nombre *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={cn(
                        'w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-purple-500',
                        theme === 'dark'
                          ? 'border-gray-700 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-900'
                      )}
                      placeholder="Ej: Ventas, Administracion"
                    />
                  </div>

                  <div>
                    <label className={cn(
                      'block text-sm font-medium mb-1',
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Codigo
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className={cn(
                        'w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-purple-500 font-mono',
                        theme === 'dark'
                          ? 'border-gray-700 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-900'
                      )}
                      placeholder="Ej: SALES, ADMIN"
                    />
                  </div>

                  <div>
                    <label className={cn(
                      'block text-sm font-medium mb-1',
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Descripcion
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className={cn(
                        'w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-purple-500 resize-none',
                        theme === 'dark'
                          ? 'border-gray-700 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-900'
                      )}
                      placeholder="Descripcion del departamento..."
                    />
                  </div>

                  <div>
                    <label className={cn(
                      'block text-sm font-medium mb-1',
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Manager
                    </label>
                    <select
                      value={formData.managerId}
                      onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                      className={cn(
                        'w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-purple-500',
                        theme === 'dark'
                          ? 'border-gray-700 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-900'
                      )}
                    >
                      <option value="">Sin asignar</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.fullName} ({emp.employeeCode})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className={cn(
                        'flex-1 px-4 py-2.5 border rounded-xl font-medium transition-colors',
                        theme === 'dark'
                          ? 'border-gray-700 hover:bg-gray-700 text-gray-300'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      )}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                      {editingDepartment ? 'Guardar' : 'Crear'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
