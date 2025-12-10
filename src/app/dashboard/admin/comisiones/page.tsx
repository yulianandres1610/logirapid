'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign,
  Package,
  Users,
  Building2,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Search,
  Plus,
  Edit2,
  Trash2,
  History,
  TrendingUp,
  Layers,
  Smartphone,
  Store,
  Percent,
  X,
  Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { useAuth } from '@/hooks/useAuth'

const categoryIcons: Record<string, typeof Package> = {
  paqueteria: Package,
  remesa: DollarSign,
  recarga: Smartphone,
  mercado: Store
}

const categoryLabels: Record<string, string> = {
  paqueteria: 'Paqueteria',
  remesa: 'Remesa',
  recarga: 'Recarga',
  mercado: 'Mercado'
}

const roleLabels: Record<string, string> = {
  DRIVER: 'Driver',
  USER: 'Usuario',
  MANAGER: 'Manager',
  ADMIN: 'Admin',
  ALL: 'Todos'
}

const roleColors: Record<string, { bg: string; text: string; border: string }> = {
  DRIVER: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-700' },
  USER: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', border: 'border-green-200 dark:border-green-700' },
  MANAGER: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-700' },
  ADMIN: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-700' },
  ALL: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-200 dark:border-gray-600' }
}

interface CommissionConfig {
  id: number
  companyId: number
  productId: number
  productCode: string
  productName: string
  serviceCategory: string
  productBasePrice: number
  role: string
  commissionType: 'fixed' | 'percentage'
  commissionValue: number
  minAmount: number | null
  maxAmount: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface ProductWithoutCommission {
  id: number
  code: string
  name: string
  serviceCategory: string
  basePrice: number
}

interface Company {
  id: number
  legalName: string
  status: string
}

export default function CommissionsConfigPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  // State
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [loadingCompanies, setLoadingCompanies] = useState(true)
  const [commissions, setCommissions] = useState<CommissionConfig[]>([])
  const [productsWithoutCommission, setProductsWithoutCommission] = useState<ProductWithoutCommission[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    paqueteria: true,
    remesa: false,
    recarga: false,
    mercado: false
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<CommissionConfig | null>(null)
  const [formData, setFormData] = useState({
    productId: 0,
    role: 'ALL',
    commissionType: 'fixed' as 'fixed' | 'percentage',
    commissionValue: 0,
    minAmount: '',
    maxAmount: '',
    isActive: true
  })
  const [saving, setSaving] = useState(false)

  // Summary stats
  const [stats, setStats] = useState({
    totalConfigs: 0,
    activeConfigs: 0,
    productsConfigured: 0,
    productsWithoutConfig: 0
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

  // Fetch commissions when company changes
  useEffect(() => {
    if (selectedCompanyId) {
      fetchCommissions()
    } else {
      setCommissions([])
      setProductsWithoutCommission([])
    }
  }, [selectedCompanyId])

  const fetchCommissions = async () => {
    if (!selectedCompanyId) return

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/companies/${selectedCompanyId}/commissions`)
      const result = await response.json()

      if (result.success) {
        setCommissions(result.data.commissions)
        setProductsWithoutCommission(result.data.productsWithoutCommission)
        setStats({
          totalConfigs: result.data.summary.totalConfigurations,
          activeConfigs: result.data.summary.activeConfigurations,
          productsConfigured: result.data.summary.productsConfigured,
          productsWithoutConfig: result.data.summary.productsWithoutConfig
        })
      } else {
        setError(result.error || 'Error al cargar comisiones')
      }
    } catch (err) {
      setError('Error de conexion al cargar comisiones')
      console.error('Error fetching commissions:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  // Group commissions by category
  const commissionsByCategory = commissions.reduce((acc, config) => {
    const cat = config.serviceCategory
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(config)
    return acc
  }, {} as Record<string, CommissionConfig[]>)

  // Filter by search and category
  const filterCommissions = (configs: CommissionConfig[]) => {
    return configs.filter(c =>
      (c.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
       c.productCode.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (activeCategory === 'all' || c.serviceCategory === activeCategory)
    )
  }

  // Open modal for new config
  const openNewConfigModal = (productId?: number) => {
    setEditingConfig(null)
    setFormData({
      productId: productId || 0,
      role: 'ALL',
      commissionType: 'fixed',
      commissionValue: 0,
      minAmount: '',
      maxAmount: '',
      isActive: true
    })
    setModalOpen(true)
  }

  // Open modal for edit
  const openEditModal = (config: CommissionConfig) => {
    setEditingConfig(config)
    setFormData({
      productId: config.productId,
      role: config.role,
      commissionType: config.commissionType,
      commissionValue: config.commissionValue,
      minAmount: config.minAmount?.toString() || '',
      maxAmount: config.maxAmount?.toString() || '',
      isActive: config.isActive
    })
    setModalOpen(true)
  }

  // Save commission config
  const handleSave = async () => {
    if (!selectedCompanyId || !formData.productId) {
      showNotification('error', 'Error', 'Selecciona un producto')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/companies/${selectedCompanyId}/commissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: formData.productId,
          role: formData.role,
          commissionType: formData.commissionType,
          commissionValue: formData.commissionValue,
          minAmount: formData.minAmount ? parseFloat(formData.minAmount) : null,
          maxAmount: formData.maxAmount ? parseFloat(formData.maxAmount) : null,
          isActive: formData.isActive
        })
      })

      const result = await response.json()
      if (result.success) {
        showNotification('success', 'Guardado', result.message || 'Configuracion guardada')
        setModalOpen(false)
        fetchCommissions()
      } else {
        showNotification('error', 'Error', result.error || 'Error al guardar')
      }
    } catch (err) {
      showNotification('error', 'Error', 'Error de conexion')
      console.error('Error saving commission:', err)
    } finally {
      setSaving(false)
    }
  }

  // Delete commission config
  const handleDelete = async (configId: number) => {
    if (!selectedCompanyId) return
    if (!confirm('¿Estas seguro de eliminar esta configuracion?')) return

    try {
      const response = await fetch(
        `/api/companies/${selectedCompanyId}/commissions?configId=${configId}`,
        { method: 'DELETE' }
      )
      const result = await response.json()
      if (result.success) {
        showNotification('success', 'Eliminado', 'Configuracion eliminada')
        fetchCommissions()
      } else {
        showNotification('error', 'Error', result.error || 'Error al eliminar')
      }
    } catch (err) {
      showNotification('error', 'Error', 'Error de conexion')
    }
  }

  // Get available products for the modal dropdown
  const availableProducts = productsWithoutCommission.filter(p =>
    !commissions.some(c => c.productId === p.id && c.role === formData.role)
  )

  // If editing, include the current product
  const productOptions = editingConfig
    ? [{ id: editingConfig.productId, name: editingConfig.productName, code: editingConfig.productCode }]
    : availableProducts.map(p => ({ id: p.id, name: p.name, code: p.code }))

  // All products for dropdown (including those already configured but for different roles)
  const allProductsForDropdown = [
    ...productsWithoutCommission.map(p => ({ id: p.id, name: p.name, code: p.code })),
    ...commissions.filter((c, index, self) =>
      index === self.findIndex(t => t.productId === c.productId)
    ).map(c => ({ id: c.productId, name: c.productName, code: c.productCode }))
  ].sort((a, b) => a.name.localeCompare(b.name))

  const SERVICE_CATEGORIES = [
    { id: 'all', name: 'Todos', icon: Layers },
    { id: 'paqueteria', name: 'Paqueteria', icon: Package },
    { id: 'remesa', name: 'Cupones Familiares', icon: DollarSign },
    { id: 'recarga', name: 'Recargas', icon: Smartphone },
    { id: 'mercado', name: 'Mercado', icon: Store }
  ]

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">

        {/* Stats Cards */}
        {selectedCompanyId && !loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={cn(
                "relative overflow-hidden rounded-2xl border shadow-xl",
                theme === 'dark'
                  ? "bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700"
                  : "bg-gradient-to-br from-slate-50 to-white border-slate-200"
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600" />
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-3 rounded-xl shadow-sm",
                      theme === 'dark'
                        ? "bg-blue-900/30 border border-blue-800/50"
                        : "bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200"
                    )}>
                      <Layers className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className={cn("text-sm font-medium", theme === 'dark' ? "text-gray-400" : "text-black")}>
                        Total Configuraciones
                      </p>
                      <p className={cn("text-3xl font-bold mt-1", theme === 'dark' ? "text-white" : "text-slate-900")}>
                        {stats.totalConfigs}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                  <span className={cn("text-xs font-medium", theme === 'dark' ? "text-gray-500" : "text-black")}>
                    En sistema
                  </span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={cn(
                "relative overflow-hidden rounded-2xl border shadow-xl",
                theme === 'dark'
                  ? "bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700"
                  : "bg-gradient-to-br from-slate-50 to-white border-slate-200"
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-green-600" />
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-3 rounded-xl shadow-sm",
                      theme === 'dark'
                        ? "bg-green-900/30 border border-green-800/50"
                        : "bg-gradient-to-br from-green-50 to-green-100 border border-green-200"
                    )}>
                      <Check className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className={cn("text-sm font-medium", theme === 'dark' ? "text-gray-400" : "text-black")}>
                        Activas
                      </p>
                      <p className={cn("text-3xl font-bold mt-1", theme === 'dark' ? "text-white" : "text-slate-900")}>
                        {stats.activeConfigs}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full" />
                  <span className={cn("text-xs font-medium", theme === 'dark' ? "text-gray-500" : "text-black")}>
                    Habilitadas
                  </span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={cn(
                "relative overflow-hidden rounded-2xl border shadow-xl",
                theme === 'dark'
                  ? "bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700"
                  : "bg-gradient-to-br from-slate-50 to-white border-slate-200"
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-purple-600" />
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-3 rounded-xl shadow-sm",
                      theme === 'dark'
                        ? "bg-purple-900/30 border border-purple-800/50"
                        : "bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200"
                    )}>
                      <Package className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className={cn("text-sm font-medium", theme === 'dark' ? "text-gray-400" : "text-black")}>
                        Productos Configurados
                      </p>
                      <p className={cn("text-3xl font-bold mt-1", theme === 'dark' ? "text-white" : "text-slate-900")}>
                        {stats.productsConfigured}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-purple-400 rounded-full" />
                  <span className={cn("text-xs font-medium", theme === 'dark' ? "text-gray-500" : "text-black")}>
                    Con comision
                  </span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className={cn(
                "relative overflow-hidden rounded-2xl border shadow-xl",
                theme === 'dark'
                  ? "bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700"
                  : "bg-gradient-to-br from-slate-50 to-white border-slate-200"
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-amber-600" />
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-3 rounded-xl shadow-sm",
                      theme === 'dark'
                        ? "bg-amber-900/30 border border-amber-800/50"
                        : "bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200"
                    )}>
                      <AlertCircle className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className={cn("text-sm font-medium", theme === 'dark' ? "text-gray-400" : "text-black")}>
                        Sin Configurar
                      </p>
                      <p className={cn("text-3xl font-bold mt-1", theme === 'dark' ? "text-white" : "text-slate-900")}>
                        {stats.productsWithoutConfig}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-amber-400 rounded-full" />
                  <span className={cn("text-xs font-medium", theme === 'dark' ? "text-gray-500" : "text-black")}>
                    Pendientes
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Company Selector + Search + Actions */}
        <div className={cn(
          "p-4 rounded-xl border",
          theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            {/* Company Selector */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <Building2 className={cn("w-5 h-5", theme === 'dark' ? "text-gray-400" : "text-gray-500")} />
              <label className={cn(
                "text-sm font-medium whitespace-nowrap",
                theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>
                Empresa:
              </label>
              <select
                value={selectedCompanyId || ''}
                onChange={(e) => setSelectedCompanyId(e.target.value ? parseInt(e.target.value) : null)}
                disabled={loadingCompanies || (!isSuperAdmin && user?.companyId !== undefined)}
                className={cn(
                  "min-w-[200px] max-w-[280px] px-3 py-2 rounded-lg border transition-colors text-sm",
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

            {/* Divider */}
            <div className={cn(
              "hidden lg:block w-px h-8",
              theme === 'dark' ? "bg-gray-700" : "bg-gray-200"
            )} />

            {/* Category Tabs */}
            <div className={cn(
              "flex flex-wrap gap-2 p-1.5 rounded-lg flex-1",
              theme === 'dark' ? "bg-gray-900/50" : "bg-gray-100"
            )}>
              {SERVICE_CATEGORIES.map((cat) => {
                const Icon = cat.icon
                const count = cat.id === 'all'
                  ? commissions.length
                  : commissions.filter(c => c.serviceCategory === cat.id).length
                const isActive = activeCategory === cat.id

                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                      isActive
                        ? "bg-blue-600 text-white shadow-md"
                        : theme === 'dark'
                          ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {cat.name}
                    {count > 0 && (
                      <span className={cn(
                        "px-1.5 py-0.5 rounded-full text-xs",
                        isActive
                          ? "bg-white/20 text-white"
                          : theme === 'dark' ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"
                      )}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Divider */}
            <div className={cn(
              "hidden lg:block w-px h-8",
              theme === 'dark' ? "bg-gray-700" : "bg-gray-200"
            )} />

            {/* Action Buttons */}
            <div className="flex gap-2 flex-shrink-0">
              <a
                href={selectedCompanyId ? `/dashboard/admin/comisiones/historial?companyId=${selectedCompanyId}` : '#'}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  selectedCompanyId
                    ? theme === 'dark'
                      ? "bg-gray-700 hover:bg-gray-600 text-gray-200"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    : "opacity-50 cursor-not-allowed bg-gray-200 text-gray-400"
                )}
              >
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">Historial</span>
              </a>
              <button
                onClick={() => openNewConfigModal()}
                disabled={!selectedCompanyId}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  selectedCompanyId
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "opacity-50 cursor-not-allowed bg-gray-400 text-gray-200"
                )}
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Nueva Comision</span>
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por nombre o codigo de producto..."
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
            <span className="ml-2 text-gray-500">Cargando comisiones...</span>
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
              Para ver y configurar comisiones, primero selecciona una empresa del selector
            </p>
          </div>
        )}

        {/* Commissions List by Category */}
        {selectedCompanyId && !loading && !error && (
          <div className="space-y-4">
            {Object.entries(commissionsByCategory).map(([category, configs]) => {
              const Icon = categoryIcons[category] || Package
              const isExpanded = expandedCategories[category]
              const filteredConfigs = filterCommissions(configs)

              // Skip if filtering by category and this doesn't match
              if (activeCategory !== 'all' && category !== activeCategory) return null
              if (filteredConfigs.length === 0 && searchTerm) return null

              return (
                <div
                  key={category}
                  className={cn(
                    "rounded-xl border overflow-hidden",
                    theme === 'dark'
                      ? "bg-gray-800/50 border-gray-700"
                      : "bg-white border-gray-200"
                  )}
                >
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className={cn(
                      "w-full flex items-center justify-between p-4 transition-colors",
                      theme === 'dark' ? "hover:bg-gray-800" : "hover:bg-gray-50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        theme === 'dark' ? "bg-gray-700" : "bg-gray-100"
                      )}>
                        <Icon className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="text-left">
                        <h3 className={cn(
                          "font-semibold",
                          theme === 'dark' ? "text-white" : "text-gray-900"
                        )}>
                          {categoryLabels[category] || category}
                        </h3>
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>
                          {filteredConfigs.length} configuracion{filteredConfigs.length !== 1 ? 'es' : ''}
                        </p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </button>

                  {/* Commissions Table */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className={cn(
                                "text-left text-xs uppercase tracking-wider",
                                theme === 'dark' ? "bg-gray-900/50 text-gray-400" : "bg-gray-50 text-gray-500"
                              )}>
                                <th className="px-4 py-3">Producto</th>
                                <th className="px-4 py-3 text-center">Rol</th>
                                <th className="px-4 py-3 text-center">Tipo</th>
                                <th className="px-4 py-3 text-center">Valor</th>
                                <th className="px-4 py-3 text-center">Min/Max</th>
                                <th className="px-4 py-3 text-center">Estado</th>
                                <th className="px-4 py-3 text-center">Acciones</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                              {filteredConfigs.map((config) => (
                                <tr
                                  key={config.id}
                                  className={cn(
                                    "transition-colors",
                                    theme === 'dark' ? "hover:bg-gray-800/50" : "hover:bg-gray-50"
                                  )}
                                >
                                  <td className="px-4 py-3">
                                    <div>
                                      <div className={cn(
                                        "font-medium",
                                        theme === 'dark' ? "text-white" : "text-gray-900"
                                      )}>
                                        {config.productName}
                                      </div>
                                      <div className={cn(
                                        "text-xs font-mono",
                                        theme === 'dark' ? "text-gray-500" : "text-gray-400"
                                      )}>
                                        {config.productCode}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={cn(
                                      "inline-flex items-center px-2 py-1 rounded text-xs font-medium border",
                                      roleColors[config.role]?.bg,
                                      roleColors[config.role]?.text,
                                      roleColors[config.role]?.border
                                    )}>
                                      {roleLabels[config.role] || config.role}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={cn(
                                      "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium",
                                      config.commissionType === 'fixed'
                                        ? theme === 'dark' ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-600"
                                        : theme === 'dark' ? "bg-purple-900/30 text-purple-400" : "bg-purple-50 text-purple-600"
                                    )}>
                                      {config.commissionType === 'fixed' ? (
                                        <><DollarSign className="w-3 h-3" /> Fijo</>
                                      ) : (
                                        <><Percent className="w-3 h-3" /> Porcentaje</>
                                      )}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={cn(
                                      "text-sm font-semibold",
                                      theme === 'dark' ? "text-green-400" : "text-green-600"
                                    )}>
                                      {config.commissionType === 'fixed'
                                        ? `$${config.commissionValue.toFixed(2)}`
                                        : `${config.commissionValue}%`}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <div className={cn(
                                      "text-xs",
                                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                    )}>
                                      {config.minAmount || config.maxAmount ? (
                                        <>
                                          {config.minAmount && <div>Min: ${config.minAmount}</div>}
                                          {config.maxAmount && <div>Max: ${config.maxAmount}</div>}
                                        </>
                                      ) : (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={cn(
                                      "inline-flex items-center px-2 py-1 rounded text-xs font-medium",
                                      config.isActive
                                        ? theme === 'dark' ? "bg-green-900/30 text-green-400" : "bg-green-50 text-green-600"
                                        : theme === 'dark' ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-500"
                                    )}>
                                      {config.isActive ? 'Activa' : 'Inactiva'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      <button
                                        onClick={() => openEditModal(config)}
                                        className={cn(
                                          "p-1.5 rounded-lg transition-colors",
                                          theme === 'dark'
                                            ? "hover:bg-gray-700 text-gray-400 hover:text-blue-400"
                                            : "hover:bg-gray-100 text-gray-500 hover:text-blue-600"
                                        )}
                                        title="Editar"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDelete(config.id)}
                                        className={cn(
                                          "p-1.5 rounded-lg transition-colors",
                                          theme === 'dark'
                                            ? "hover:bg-gray-700 text-gray-400 hover:text-red-400"
                                            : "hover:bg-gray-100 text-gray-500 hover:text-red-600"
                                        )}
                                        title="Eliminar"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}

          </div>
        )}

        {/* Empty State */}
        {selectedCompanyId && !loading && !error && commissions.length === 0 && productsWithoutCommission.length === 0 && (
          <div className={cn(
            "p-12 text-center rounded-xl border-2 border-dashed",
            theme === 'dark' ? "border-gray-700" : "border-gray-200"
          )}>
            <DollarSign className={cn(
              "w-12 h-12 mx-auto mb-4",
              theme === 'dark' ? "text-gray-600" : "text-gray-400"
            )} />
            <h3 className={cn(
              "font-medium mb-1",
              theme === 'dark' ? "text-gray-300" : "text-gray-700"
            )}>
              No hay productos en el catalogo
            </h3>
            <p className={cn(
              "text-sm",
              theme === 'dark' ? "text-gray-500" : "text-gray-400"
            )}>
              Primero agrega productos al catalogo para poder configurar comisiones
            </p>
          </div>
        )}
      </div>

      {/* Modal for Add/Edit Commission */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "w-full max-w-md rounded-xl shadow-xl",
                theme === 'dark' ? "bg-gray-800" : "bg-white"
              )}
            >
              {/* Modal Header */}
              <div className={cn(
                "flex items-center justify-between p-4 border-b",
                theme === 'dark' ? "border-gray-700" : "border-gray-200"
              )}>
                <h2 className={cn(
                  "text-lg font-semibold",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  {editingConfig ? 'Editar Comision' : 'Nueva Comision'}
                </h2>
                <button
                  onClick={() => setModalOpen(false)}
                  className={cn(
                    "p-1 rounded-lg transition-colors",
                    theme === 'dark' ? "hover:bg-gray-700" : "hover:bg-gray-100"
                  )}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 space-y-4">
                {/* Product Select */}
                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-1",
                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                  )}>
                    Producto *
                  </label>
                  <select
                    value={formData.productId}
                    onChange={(e) => setFormData({ ...formData, productId: parseInt(e.target.value) })}
                    disabled={!!editingConfig}
                    className={cn(
                      "w-full px-3 py-2 rounded-lg border text-sm",
                      "focus:outline-none focus:ring-2 focus:ring-blue-500",
                      theme === 'dark'
                        ? "bg-gray-900 border-gray-700 text-white"
                        : "bg-white border-gray-200 text-gray-900",
                      editingConfig && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    <option value={0}>Seleccionar producto...</option>
                    {allProductsForDropdown.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Role Select */}
                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-1",
                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                  )}>
                    Rol *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    disabled={!!editingConfig}
                    className={cn(
                      "w-full px-3 py-2 rounded-lg border text-sm",
                      "focus:outline-none focus:ring-2 focus:ring-blue-500",
                      theme === 'dark'
                        ? "bg-gray-900 border-gray-700 text-white"
                        : "bg-white border-gray-200 text-gray-900",
                      editingConfig && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    <option value="ALL">Todos los roles</option>
                    <option value="DRIVER">Driver</option>
                    <option value="USER">Usuario</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>

                {/* Commission Type */}
                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                  )}>
                    Tipo de Comision *
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, commissionType: 'fixed' })}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
                        formData.commissionType === 'fixed'
                          ? "bg-blue-600 border-blue-600 text-white"
                          : theme === 'dark'
                            ? "bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800"
                            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      <DollarSign className="w-4 h-4" />
                      Monto Fijo
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, commissionType: 'percentage' })}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
                        formData.commissionType === 'percentage'
                          ? "bg-purple-600 border-purple-600 text-white"
                          : theme === 'dark'
                            ? "bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800"
                            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      <Percent className="w-4 h-4" />
                      Porcentaje
                    </button>
                  </div>
                </div>

                {/* Commission Value */}
                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-1",
                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                  )}>
                    {formData.commissionType === 'fixed' ? 'Monto ($)' : 'Porcentaje (%)'} *
                  </label>
                  <div className="relative">
                    <span className={cn(
                      "absolute left-3 top-1/2 -translate-y-1/2 text-sm",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      {formData.commissionType === 'fixed' ? '$' : '%'}
                    </span>
                    <input
                      type="number"
                      step={formData.commissionType === 'fixed' ? '0.01' : '0.1'}
                      min="0"
                      max={formData.commissionType === 'percentage' ? '100' : undefined}
                      value={formData.commissionValue}
                      onChange={(e) => setFormData({ ...formData, commissionValue: parseFloat(e.target.value) || 0 })}
                      className={cn(
                        "w-full pl-8 pr-3 py-2 rounded-lg border text-sm",
                        "focus:outline-none focus:ring-2 focus:ring-blue-500",
                        theme === 'dark'
                          ? "bg-gray-900 border-gray-700 text-white"
                          : "bg-white border-gray-200 text-gray-900"
                      )}
                    />
                  </div>
                </div>

                {/* Min/Max for percentage */}
                {formData.commissionType === 'percentage' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-1",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Minimo ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Sin minimo"
                        value={formData.minAmount}
                        onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border text-sm",
                          "focus:outline-none focus:ring-2 focus:ring-blue-500",
                          theme === 'dark'
                            ? "bg-gray-900 border-gray-700 text-white placeholder-gray-500"
                            : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
                        )}
                      />
                    </div>
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-1",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Maximo ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Sin maximo"
                        value={formData.maxAmount}
                        onChange={(e) => setFormData({ ...formData, maxAmount: e.target.value })}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border text-sm",
                          "focus:outline-none focus:ring-2 focus:ring-blue-500",
                          theme === 'dark'
                            ? "bg-gray-900 border-gray-700 text-white placeholder-gray-500"
                            : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* Active Toggle */}
                <div className="flex items-center justify-between">
                  <label className={cn(
                    "text-sm font-medium",
                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                  )}>
                    Comision activa
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      formData.isActive ? "bg-green-500" : "bg-gray-400"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        formData.isActive ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>
              </div>

              {/* Modal Footer */}
              <div className={cn(
                "flex items-center justify-end gap-3 p-4 border-t",
                theme === 'dark' ? "border-gray-700" : "border-gray-200"
              )}>
                <button
                  onClick={() => setModalOpen(false)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    theme === 'dark'
                      ? "bg-gray-700 hover:bg-gray-600 text-gray-200"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  )}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formData.productId}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    saving || !formData.productId
                      ? "bg-gray-400 cursor-not-allowed text-white"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  )}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Guardar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  )
}
