'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Plus,
  Search,
  Edit,
  Eye,
  Building2,
  DollarSign,
  CreditCard,
  RefreshCw,
  X,
  Phone,
  Mail,
  MapPin,
  Tag
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Customer {
  id: number
  code: string
  businessName: string
  legalName: string | null
  taxId: string | null
  contactName: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string
  pricelistId: number | null
  pricelistName: string | null
  creditLimit: number
  creditDays: number
  currentBalance: number
  status: string
  notes: string | null
  totalInvoices: number
  totalSales: number
  createdAt: string
}

interface Pricelist {
  id: number
  name: string
}

export default function WholesaleCustomersPage() {
  const { theme } = useTheme()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [pricelists, setPricelists] = useState<Pricelist[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [pricelistFilter, setPricelistFilter] = useState<string>('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    withCredit: 0,
    totalBalance: 0
  })

  // Form state
  const [formData, setFormData] = useState({
    businessName: '',
    legalName: '',
    taxId: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: 'Cuba',
    pricelistId: '',
    creditLimit: '',
    creditDays: '',
    notes: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchCustomers()
    fetchPricelists()
  }, [statusFilter, pricelistFilter])

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchCustomers()
    }, 300)
    return () => clearTimeout(debounce)
  }, [search])

  const fetchPricelists = async () => {
    try {
      const response = await fetch('/api/market/pricelists')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setPricelists(result.data.pricelists)
        }
      }
    } catch (error) {
      console.error('Error fetching pricelists:', error)
    }
  }

  const fetchCustomers = async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const params = new URLSearchParams({
        status: statusFilter,
        search: search
      })
      if (pricelistFilter) {
        params.set('pricelistId', pricelistFilter)
      }

      const response = await fetch(`/api/market/wholesale/customers?${params}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setCustomers(result.data.customers)
          setTotal(result.data.pagination.total)
          setStats(result.data.stats)
        }
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      if (!silent) setLoading(false)
      else setIsRefreshing(false)
    }
  }

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const response = await fetch('/api/market/wholesale/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          pricelistId: formData.pricelistId ? parseInt(formData.pricelistId) : null,
          creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : 0,
          creditDays: formData.creditDays ? parseInt(formData.creditDays) : 0
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setShowCreateModal(false)
          setFormData({
            businessName: '',
            legalName: '',
            taxId: '',
            contactName: '',
            email: '',
            phone: '',
            address: '',
            city: '',
            state: '',
            country: 'Cuba',
            pricelistId: '',
            creditLimit: '',
            creditDays: '',
            notes: ''
          })
          fetchCustomers()
        }
      }
    } catch (error) {
      console.error('Error creating customer:', error)
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value)
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
              {/* Total Clientes */}
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
                      )}>Total Clientes</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{stats.total}</p>
                    </div>
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
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-green-900/30 border border-green-800/50'
                        : 'bg-gradient-to-br from-green-50 to-green-100 border border-green-200'
                    )}>
                      <Building2 className="w-6 h-6 text-green-600" />
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
              </motion.div>

              {/* Con Crédito */}
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
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-purple-900/30 border border-purple-800/50'
                        : 'bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200'
                    )}>
                      <CreditCard className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>Con Crédito</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{stats.withCredit}</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Saldo Total */}
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
                      )}>Saldo Total</p>
                      <p className={cn(
                        'text-2xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{formatCurrency(stats.totalBalance)}</p>
                    </div>
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
                    placeholder="Buscar por nombre, código o email..."
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
                    'px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all min-w-[150px]',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                  )}
                >
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                  <option value="blocked">Bloqueados</option>
                  <option value="all">Todos</option>
                </select>

                {/* Pricelist Filter */}
                <select
                  value={pricelistFilter}
                  onChange={(e) => setPricelistFilter(e.target.value)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all min-w-[180px]',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                  )}
                >
                  <option value="">Todas las listas</option>
                  {pricelists.map(pl => (
                    <option key={pl.id} value={pl.id}>{pl.name}</option>
                  ))}
                </select>

                {/* Refresh */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => fetchCustomers(true)}
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

                {/* Nuevo Cliente */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25"
                >
                  <Plus className="w-5 h-5" />
                  Nuevo Cliente
                </motion.button>
              </div>
            </motion.div>

            {/* Customers Table */}
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
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Lista de Precios</th>
                      <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo</th>
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
                    ) : customers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center">
                          <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className={cn(
                            'font-medium mb-1',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>No hay clientes mayoristas</p>
                          <p className="text-gray-500">
                            Comienza agregando tu primer cliente
                          </p>
                          <button
                            onClick={() => setShowCreateModal(true)}
                            className="mt-3 inline-flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600"
                          >
                            <Plus className="w-4 h-4" />
                            Crear Cliente
                          </button>
                        </td>
                      </tr>
                    ) : (
                      customers.map((customer, index) => (
                        <motion.tr
                          key={customer.id}
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
                                {customer.businessName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className={cn(
                                  'font-medium',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {customer.businessName}
                                </p>
                                <p className="text-xs text-gray-500">{customer.code}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div>
                              {customer.contactName && (
                                <p className={cn(
                                  'text-sm',
                                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                )}>{customer.contactName}</p>
                              )}
                              {customer.email && (
                                <p className="text-xs text-gray-500">{customer.email}</p>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            {customer.pricelistName ? (
                              <span className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
                                theme === 'dark' ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700'
                              )}>
                                <Tag className="w-3 h-3" />
                                {customer.pricelistName}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">Sin asignar</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <p className={cn(
                              'font-medium',
                              customer.currentBalance > 0
                                ? 'text-amber-600 dark:text-amber-400'
                                : theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {formatCurrency(customer.currentBalance)}
                            </p>
                            {customer.creditLimit > 0 && (
                              <p className="text-xs text-gray-500">
                                Límite: {formatCurrency(customer.creditLimit)}
                              </p>
                            )}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={cn(
                              'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium',
                              customer.status === 'active'
                                ? theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                                : customer.status === 'inactive'
                                  ? theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-700'
                                  : theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
                            )}>
                              {customer.status === 'active' ? 'Activo' : customer.status === 'inactive' ? 'Inactivo' : 'Bloqueado'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => {
                                  setSelectedCustomer(customer)
                                  setShowDetails(true)
                                }}
                                className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                title="Ver detalles"
                              >
                                <Eye className="w-4 h-4 text-blue-500" />
                              </motion.button>
                              <Link href={`/dashboard/market/wholesale/customers/${customer.id}`}>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4 text-gray-500" />
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

            {/* Customer Details Modal */}
            <AnimatePresence>
              {showDetails && selectedCustomer && (
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
                            {selectedCustomer.businessName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h2 className={cn(
                              'text-xl font-bold',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {selectedCustomer.businessName}
                            </h2>
                            <p className="text-gray-500">{selectedCustomer.code}</p>
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
                        {selectedCustomer.contactName && (
                          <div>
                            <p className="text-sm text-gray-500">Contacto</p>
                            <p className={cn(
                              'font-medium',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{selectedCustomer.contactName}</p>
                          </div>
                        )}
                        {selectedCustomer.email && (
                          <div>
                            <p className="text-sm text-gray-500">Email</p>
                            <p className={cn(
                              'font-medium flex items-center gap-1',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              <Mail className="w-4 h-4 text-gray-400" />
                              {selectedCustomer.email}
                            </p>
                          </div>
                        )}
                        {selectedCustomer.phone && (
                          <div>
                            <p className="text-sm text-gray-500">Teléfono</p>
                            <p className={cn(
                              'font-medium flex items-center gap-1',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              <Phone className="w-4 h-4 text-gray-400" />
                              {selectedCustomer.phone}
                            </p>
                          </div>
                        )}
                        {selectedCustomer.address && (
                          <div className="col-span-2">
                            <p className="text-sm text-gray-500">Dirección</p>
                            <p className={cn(
                              'font-medium flex items-center gap-1',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              <MapPin className="w-4 h-4 text-gray-400" />
                              {selectedCustomer.address}
                              {selectedCustomer.city && `, ${selectedCustomer.city}`}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className={cn(
                        'pt-4 border-t',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <h3 className={cn(
                          'font-medium mb-3',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>Información Comercial</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Lista de Precios</p>
                            <p className={cn(
                              'font-medium',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{selectedCustomer.pricelistName || 'Sin asignar'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Saldo Actual</p>
                            <p className={cn(
                              'font-medium',
                              selectedCustomer.currentBalance > 0 ? 'text-amber-600' : theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{formatCurrency(selectedCustomer.currentBalance)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Límite de Crédito</p>
                            <p className={cn(
                              'font-medium',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{formatCurrency(selectedCustomer.creditLimit)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Días de Crédito</p>
                            <p className={cn(
                              'font-medium',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{selectedCustomer.creditDays} días</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Total Facturas</p>
                            <p className={cn(
                              'font-medium',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{selectedCustomer.totalInvoices}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Total Ventas</p>
                            <p className={cn(
                              'font-medium',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{formatCurrency(selectedCustomer.totalSales)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-4">
                        <Link href={`/dashboard/market/wholesale/quotes/create?customerId=${selectedCustomer.id}`} className="flex-1">
                          <button className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                            Nueva Cotización
                          </button>
                        </Link>
                        <Link href={`/dashboard/market/wholesale/invoices/create?customerId=${selectedCustomer.id}`} className="flex-1">
                          <button className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">
                            Nueva Factura
                          </button>
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Create Customer Modal */}
            <AnimatePresence>
              {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={cn(
                      'rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto',
                      theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                    )}
                  >
                    <div className={cn(
                      'p-6 border-b flex items-center justify-between',
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <h2 className={cn(
                        'text-xl font-bold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>Nuevo Cliente Mayorista</h2>
                      <button
                        onClick={() => setShowCreateModal(false)}
                        className={cn(
                          'p-2 rounded-lg transition-colors',
                          theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                        )}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <form onSubmit={handleCreateCustomer} className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-500 mb-1">Nombre Comercial *</label>
                          <input
                            type="text"
                            value={formData.businessName}
                            onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                            required
                            className={cn(
                              'w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2',
                              theme === 'dark'
                                ? 'bg-gray-700 border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                            )}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Razón Social</label>
                          <input
                            type="text"
                            value={formData.legalName}
                            onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                            className={cn(
                              'w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2',
                              theme === 'dark'
                                ? 'bg-gray-700 border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                            )}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">RUC/NIT</label>
                          <input
                            type="text"
                            value={formData.taxId}
                            onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                            className={cn(
                              'w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2',
                              theme === 'dark'
                                ? 'bg-gray-700 border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                            )}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Nombre de Contacto</label>
                          <input
                            type="text"
                            value={formData.contactName}
                            onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                            className={cn(
                              'w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2',
                              theme === 'dark'
                                ? 'bg-gray-700 border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                            )}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className={cn(
                              'w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2',
                              theme === 'dark'
                                ? 'bg-gray-700 border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                            )}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Teléfono</label>
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className={cn(
                              'w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2',
                              theme === 'dark'
                                ? 'bg-gray-700 border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                            )}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Ciudad</label>
                          <input
                            type="text"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            className={cn(
                              'w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2',
                              theme === 'dark'
                                ? 'bg-gray-700 border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                            )}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-500 mb-1">Dirección</label>
                          <input
                            type="text"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className={cn(
                              'w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2',
                              theme === 'dark'
                                ? 'bg-gray-700 border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                            )}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Lista de Precios</label>
                          <select
                            value={formData.pricelistId}
                            onChange={(e) => setFormData({ ...formData, pricelistId: e.target.value })}
                            className={cn(
                              'w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2',
                              theme === 'dark'
                                ? 'bg-gray-700 border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                            )}
                          >
                            <option value="">Sin asignar</option>
                            {pricelists.map(pl => (
                              <option key={pl.id} value={pl.id}>{pl.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Límite de Crédito ($)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.creditLimit}
                            onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                            className={cn(
                              'w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2',
                              theme === 'dark'
                                ? 'bg-gray-700 border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                            )}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Días de Crédito</label>
                          <input
                            type="number"
                            min="0"
                            value={formData.creditDays}
                            onChange={(e) => setFormData({ ...formData, creditDays: e.target.value })}
                            className={cn(
                              'w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2',
                              theme === 'dark'
                                ? 'bg-gray-700 border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                            )}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-500 mb-1">Notas</label>
                          <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                            className={cn(
                              'w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2',
                              theme === 'dark'
                                ? 'bg-gray-700 border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                            )}
                          />
                        </div>
                      </div>
                      <div className="flex gap-3 pt-4">
                        <button
                          type="button"
                          onClick={() => setShowCreateModal(false)}
                          className={cn(
                            'flex-1 py-2.5 px-4 rounded-lg font-medium border',
                            theme === 'dark'
                              ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          )}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={saving || !formData.businessName}
                          className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
                        >
                          {saving ? 'Guardando...' : 'Crear Cliente'}
                        </button>
                      </div>
                    </form>
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
