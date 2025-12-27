'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Phone,
  Mail,
  User,
  CheckCircle,
  XCircle,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface SupplierStats {
  totalOrders: number
  totalConsigned: number
  balanceAvailable: number
  totalEarned: number
  totalPaid: number
}

interface LinkedUser {
  id: number
  name: string
  email: string
}

interface SystemUser {
  id: number
  name: string
  email: string
}

interface Supplier {
  id: number
  code: string
  name: string
  legalName: string | null
  taxId: string | null
  contactName: string | null
  email: string | null
  phone: string | null
  address: string | null
  username: string | null
  userId: number | null
  linkedUser: LinkedUser | null
  isActive: boolean
  createdAt: string
  stats: SupplierStats
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface SupplierFormData {
  code: string
  name: string
  legalName: string
  taxId: string
  contactName: string
  email: string
  phone: string
  address: string
  username: string
  password: string
  userId: number | null
}

const initialFormData: SupplierFormData = {
  code: '',
  name: '',
  legalName: '',
  taxId: '',
  contactName: '',
  email: '',
  phone: '',
  address: '',
  username: '',
  password: '',
  userId: null
}

export default function SuppliersPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [formData, setFormData] = useState<SupplierFormData>(initialFormData)
  const [formErrors, setFormErrors] = useState<Partial<SupplierFormData>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Users for linking
  const [availableUsers, setAvailableUsers] = useState<SystemUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  useEffect(() => {
    fetchSuppliers()
  }, [pagination.page])

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (pagination.page === 1) {
        fetchSuppliers()
      } else {
        setPagination(p => ({ ...p, page: 1 }))
      }
    }, 300)
    return () => clearTimeout(debounce)
  }, [search])

  const fetchSuppliers = async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })
      if (search) params.set('search', search)

      const response = await fetch(`/api/consignments/suppliers?${params}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setSuppliers(data.data.suppliers)
          setPagination(data.data.pagination)
        }
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    } finally {
      if (!silent) setLoading(false)
      else setIsRefreshing(false)
    }
  }

  const handleManualRefresh = () => fetchSuppliers(true)

  const fetchAvailableUsers = async () => {
    setLoadingUsers(true)
    try {
      const response = await fetch('/api/users?limit=100')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Get users and filter out those already linked to suppliers
          const linkedUserIds = suppliers.map(s => s.userId).filter(Boolean)
          const users = (data.users || data.data?.users || []).map((u: { id: number; firstname: string; lastname: string; email: string }) => ({
            id: u.id,
            name: `${u.firstname || ''} ${u.lastname || ''}`.trim() || u.email,
            email: u.email
          })).filter((u: SystemUser) => !linkedUserIds.includes(u.id) || u.id === formData.userId)
          setAvailableUsers(users)
        }
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoadingUsers(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  const validateForm = (): boolean => {
    const errors: Partial<SupplierFormData> = {}

    if (!formData.code.trim()) {
      errors.code = 'El codigo es requerido'
    } else if (formData.code.length > 10) {
      errors.code = 'Maximo 10 caracteres'
    }

    if (!formData.name.trim()) {
      errors.name = 'El nombre es requerido'
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Email invalido'
    }

    if (formData.username && !formData.password && !selectedSupplier) {
      errors.password = 'La contrasena es requerida para el portal'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleUpdateSupplier = async () => {
    if (!selectedSupplier || !validateForm()) return

    setSaving(true)
    setActionError(null)

    try {
      const response = await fetch(`/api/consignments/suppliers/${selectedSupplier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setShowEditModal(false)
        setSelectedSupplier(null)
        setFormData(initialFormData)
        fetchSuppliers()
      } else {
        setActionError(data.error || 'Error al actualizar proveedor')
      }
    } catch (error) {
      console.error('Error:', error)
      setActionError('Error de conexion')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSupplier = async () => {
    if (!selectedSupplier) return

    setDeleting(true)
    setActionError(null)

    try {
      const response = await fetch(`/api/consignments/suppliers/${selectedSupplier.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setShowDeleteModal(false)
        setSelectedSupplier(null)
        fetchSuppliers()
      } else {
        setActionError(data.error || 'Error al eliminar proveedor')
      }
    } catch (error) {
      console.error('Error:', error)
      setActionError('Error de conexion')
    } finally {
      setDeleting(false)
    }
  }

  const openEditModal = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    setFormData({
      code: supplier.code,
      name: supplier.name,
      legalName: supplier.legalName || '',
      taxId: supplier.taxId || '',
      contactName: supplier.contactName || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      username: supplier.username || '',
      password: '',
      userId: supplier.userId
    })
    setFormErrors({})
    setActionError(null)
    setShowEditModal(true)
    fetchAvailableUsers()
  }

  const openDeleteModal = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    setActionError(null)
    setShowDeleteModal(true)
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
              <div className="flex items-center gap-4">
                <Link href="/dashboard/market/consignments">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                    )}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </motion.button>
                </Link>
                <div>
                  <h1 className={cn(
                    'text-2xl font-bold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Proveedores de Consignacion</h1>
                  <p className="text-sm text-gray-500">Gestiona los proveedores externos de mercancia</p>
                </div>
              </div>
            </div>

            {/* Filters */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
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
                    placeholder="Buscar por nombre, codigo, email..."
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

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleManualRefresh}
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

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => router.push('/dashboard/market/consignments/suppliers/create')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/25"
                >
                  <Plus className="w-5 h-5" />
                  Nuevo Proveedor
                </motion.button>
              </div>
            </motion.div>

            {/* Suppliers Table */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={cn(
                'rounded-2xl border shadow-xl overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-white to-slate-50 border-slate-200'
              )}
            >
              {loading ? (
                <div className="p-8 text-center">
                  <RefreshCw className="w-8 h-8 mx-auto mb-3 text-gray-400 animate-spin" />
                  <p className="text-gray-500">Cargando proveedores...</p>
                </div>
              ) : suppliers.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-500">No hay proveedores registrados</p>
                  <button
                    onClick={() => router.push('/dashboard/market/consignments/suppliers/create')}
                    className="mt-3 text-sm text-emerald-500 hover:text-emerald-600"
                  >
                    Crear primer proveedor
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={cn(
                        'text-left text-xs font-semibold uppercase tracking-wider',
                        theme === 'dark' ? 'bg-gray-800/50 text-gray-400' : 'bg-gray-50 text-gray-500'
                      )}>
                        <th className="px-6 py-4">Proveedor</th>
                        <th className="px-6 py-4">Contacto</th>
                        <th className="px-6 py-4 text-center">Ordenes</th>
                        <th className="px-6 py-4 text-right">Saldo Disp.</th>
                        <th className="px-6 py-4 text-center">Estado</th>
                        <th className="px-6 py-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {suppliers.map((supplier, index) => (
                        <motion.tr
                          key={supplier.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className={cn(
                            'transition-colors',
                            theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                          )}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0',
                                supplier.isActive
                                  ? theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
                                  : theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                              )}>
                                {supplier.code}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900 dark:text-white truncate">{supplier.name}</p>
                                {supplier.legalName && (
                                  <p className="text-xs text-gray-500 truncate">{supplier.legalName}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              {supplier.email && (
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                                  <span className="truncate max-w-[180px]">{supplier.email}</span>
                                </div>
                              )}
                              {supplier.phone && (
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                                  {supplier.phone}
                                </div>
                              )}
                              {!supplier.email && !supplier.phone && (
                                <span className="text-xs text-gray-400">Sin contacto</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={cn(
                              'inline-flex items-center justify-center w-10 h-10 rounded-xl text-lg font-bold',
                              supplier.stats.totalOrders > 0
                                ? theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'
                                : theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                            )}>
                              {supplier.stats.totalOrders}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={cn(
                              'font-bold text-lg',
                              supplier.stats.balanceAvailable > 0 ? 'text-emerald-600' : 'text-gray-500'
                            )}>
                              {formatCurrency(supplier.stats.balanceAvailable)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={cn(
                              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                              supplier.isActive
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                            )}>
                              {supplier.isActive ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                              {supplier.isActive ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => openEditModal(supplier)}
                                className={cn(
                                  'p-2 rounded-lg transition-colors',
                                  theme === 'dark'
                                    ? 'hover:bg-gray-700 text-gray-400 hover:text-blue-400'
                                    : 'hover:bg-gray-100 text-gray-500 hover:text-blue-600'
                                )}
                              >
                                <Edit className="w-4 h-4" />
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => openDeleteModal(supplier)}
                                className={cn(
                                  'p-2 rounded-lg transition-colors',
                                  theme === 'dark'
                                    ? 'hover:bg-red-900/30 text-gray-400 hover:text-red-400'
                                    : 'hover:bg-red-50 text-gray-500 hover:text-red-500'
                                )}
                              >
                                <Trash2 className="w-4 h-4" />
                              </motion.button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  disabled={pagination.page === 1}
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
                  {pagination.page} / {pagination.totalPages}
                </span>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page === pagination.totalPages}
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
            )}
          </motion.div>
        </div>

        {/* Edit Modal */}
        <AnimatePresence>
          {showEditModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => {
                if (!saving) {
                  setShowEditModal(false)
                }
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl',
                  theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                )}
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Editar Proveedor
                  </h2>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                {actionError && (
                  <div className={cn(
                    'p-3 rounded-lg mb-4 text-sm flex items-center gap-2',
                    theme === 'dark'
                      ? 'bg-red-900/30 text-red-300 border border-red-800'
                      : 'bg-red-50 text-red-600 border border-red-200'
                  )}>
                    <X className="w-4 h-4" />
                    {actionError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Codigo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Codigo *
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                      disabled={showEditModal}
                      maxLength={10}
                      placeholder="ABC"
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20',
                        formErrors.code && 'border-red-500',
                        showEditModal && 'opacity-50 cursor-not-allowed'
                      )}
                    />
                    {formErrors.code && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.code}</p>
                    )}
                  </div>

                  {/* Nombre */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                      placeholder="Nombre del proveedor"
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20',
                        formErrors.name && 'border-red-500'
                      )}
                    />
                    {formErrors.name && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>
                    )}
                  </div>

                  {/* Razon Social */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Razon Social
                    </label>
                    <input
                      type="text"
                      value={formData.legalName}
                      onChange={(e) => setFormData(p => ({ ...p, legalName: e.target.value }))}
                      placeholder="Razon social"
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

                  {/* RIF/NIT */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      RIF / NIT
                    </label>
                    <input
                      type="text"
                      value={formData.taxId}
                      onChange={(e) => setFormData(p => ({ ...p, taxId: e.target.value }))}
                      placeholder="J-12345678-9"
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

                  {/* Contacto */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Persona de Contacto
                    </label>
                    <input
                      type="text"
                      value={formData.contactName}
                      onChange={(e) => setFormData(p => ({ ...p, contactName: e.target.value }))}
                      placeholder="Nombre del contacto"
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                      placeholder="email@ejemplo.com"
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20',
                        formErrors.email && 'border-red-500'
                      )}
                    />
                    {formErrors.email && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>
                    )}
                  </div>

                  {/* Telefono */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Telefono
                    </label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+1 234 567 8900"
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

                  {/* Direccion */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Direccion
                    </label>
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData(p => ({ ...p, address: e.target.value }))}
                      rows={2}
                      placeholder="Direccion completa"
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all resize-none',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

                  {/* Portal de Proveedor Section */}
                  <div className="md:col-span-2 border-t pt-4 mt-2">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Acceso al Portal de Proveedor
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">
                      Crea credenciales para que el proveedor acceda a su portal independiente (proveedores.logirapid.com)
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Username */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Usuario del Portal
                        </label>
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) => setFormData(p => ({ ...p, username: e.target.value.toLowerCase().replace(/\s/g, '') }))}
                          placeholder="usuario123"
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                              : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                          )}
                        />
                      </div>

                      {/* Password */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Contrasena (dejar vacia para no cambiar)
                        </label>
                        <input
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))}
                          placeholder="********"
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                              : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20',
                            formErrors.password && 'border-red-500'
                          )}
                        />
                        {formErrors.password && (
                          <p className="text-xs text-red-500 mt-1">{formErrors.password}</p>
                        )}
                      </div>
                    </div>
                    {formData.username && (
                      <p className="text-xs text-emerald-500 mt-2">
                        El proveedor podra acceder en proveedores.logirapid.com con usuario: {formData.username}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowEditModal(false)}
                    disabled={saving}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl transition-colors font-medium',
                      theme === 'dark'
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                      saving && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    Cancelar
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleUpdateSupplier}
                    disabled={saving}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium shadow-lg shadow-emerald-500/25 transition-all',
                      saving ? 'opacity-70 cursor-not-allowed' : 'hover:from-emerald-600 hover:to-emerald-700'
                    )}
                  >
                    {saving ? (
                      <span className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Guardando...
                      </span>
                    ) : (
                      'Guardar Cambios'
                    )}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Modal */}
        <AnimatePresence>
          {showDeleteModal && selectedSupplier && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => !deleting && setShowDeleteModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'w-full max-w-md rounded-2xl p-6 shadow-2xl',
                  theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                )}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/30">
                    <Trash2 className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Eliminar Proveedor</h3>
                    <p className="text-sm text-gray-500">Esta accion no se puede deshacer</p>
                  </div>
                </div>

                <div className={cn(
                  'p-4 rounded-xl mb-4',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                )}>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold',
                      theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'
                    )}>
                      {selectedSupplier.code}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedSupplier.name}</p>
                      {selectedSupplier.email && (
                        <p className="text-sm text-gray-500">{selectedSupplier.email}</p>
                      )}
                    </div>
                  </div>
                </div>

                {actionError && (
                  <div className={cn(
                    'p-3 rounded-lg mb-4 text-sm flex items-center gap-2',
                    theme === 'dark'
                      ? 'bg-red-900/30 text-red-300 border border-red-800'
                      : 'bg-red-50 text-red-600 border border-red-200'
                  )}>
                    <X className="w-4 h-4 flex-shrink-0" />
                    {actionError}
                  </div>
                )}

                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deleting}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl transition-colors font-medium',
                      theme === 'dark'
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                      deleting && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    Cancelar
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleDeleteSupplier}
                    disabled={deleting}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-medium shadow-lg shadow-red-500/25 transition-all',
                      deleting ? 'opacity-70 cursor-not-allowed' : 'hover:from-red-600 hover:to-red-700'
                    )}
                  >
                    {deleting ? (
                      <span className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Eliminando...
                      </span>
                    ) : (
                      'Eliminar'
                    )}
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
