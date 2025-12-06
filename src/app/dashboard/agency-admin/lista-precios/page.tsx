'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  DollarSign,
  Smartphone,
  Store,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  Building2,
  Users,
  AlertCircle,
  RefreshCw,
  Search,
  TrendingUp,
  Layers,
  Truck
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { useCompanyProductPricing } from '@/hooks/useProductCatalog'
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

interface EditingCompanyPrice {
  precioSucursales: number | null
  precioClientes: number | null
  miCosto: number
  // Para proveedores
  providerCost?: number
  precioALogiRapid?: number
}

interface Company {
  id: number
  legalName: string
  isBranch: boolean
  parentCompanyId: number | null
  status: string
  isProvider?: boolean
  providerCategories?: string[]
}

// Service categories for tabs
const SERVICE_CATEGORIES = [
  { id: 'all', name: 'Todos', icon: Layers },
  { id: 'paqueteria', name: 'Paqueteria', icon: Package },
  { id: 'remesa', name: 'Remesas', icon: DollarSign },
  { id: 'recarga', name: 'Recargas', icon: Smartphone },
  { id: 'mercado', name: 'Mercado', icon: Store }
]

export default function ListaPreciosEmpresaPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const { user } = useAuth()

  // Get company ID from authenticated user - parse as number
  const companyId = user?.companyId ? parseInt(user.companyId) : null

  // Company-specific pricing hook - automatically loads user's company
  const {
    data: companyPricingData,
    loading,
    error,
    refresh,
    updatePrices: updateCompanyPrices
  } = useCompanyProductPricing(companyId)

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    paqueteria: true,
    remesa: false,
    recarga: false,
    mercado: false
  })
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [editingCompanyPrices, setEditingCompanyPrices] = useState<Record<number, EditingCompanyPrice>>({})
  const [saving, setSaving] = useState(false)
  const [company, setCompany] = useState<Company | null>(null)

  // Fetch company info
  useEffect(() => {
    const fetchCompany = async () => {
      if (!companyId) return
      try {
        const response = await fetch(`/api/companies/${companyId}`)
        const result = await response.json()
        if (result.success) {
          setCompany(result.data)
        }
      } catch (err) {
        console.error('Error fetching company:', err)
      }
    }
    fetchCompany()
  }, [companyId])

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  // Handle company-specific price change
  const handleCompanyPriceChange = (
    productId: number,
    field: 'precioSucursales' | 'precioClientes' | 'providerCost' | 'precioALogiRapid',
    value: number,
    originalProduct: any
  ) => {
    const miCosto = originalProduct.miCosto || originalProduct.catalogMiCosto || 0

    setEditingCompanyPrices(prev => ({
      ...prev,
      [productId]: {
        precioSucursales: prev[productId]?.precioSucursales ?? originalProduct.precioSucursales,
        precioClientes: prev[productId]?.precioClientes ?? originalProduct.precioClientes,
        miCosto: miCosto,
        providerCost: prev[productId]?.providerCost ?? originalProduct.providerCost,
        precioALogiRapid: prev[productId]?.precioALogiRapid ?? originalProduct.precioALogiRapid,
        [field]: value
      }
    }))
  }

  const hasChanges = Object.keys(editingCompanyPrices).length > 0

  // Validate company prices - must be >= miCosto
  const validateCompanyPrices = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = []

    for (const [productId, prices] of Object.entries(editingCompanyPrices)) {
      const product = companyPricingData?.products.find(p => p.productId === parseInt(productId))
      if (!product) continue

      const miCosto = prices.miCosto || product.catalogMiCosto || 0

      if (prices.precioSucursales !== null && prices.precioSucursales !== undefined && prices.precioSucursales < miCosto) {
        errors.push(`${product.name}: Precio Sucursales ($${prices.precioSucursales}) no puede ser menor al costo ($${miCosto})`)
      }

      if (prices.precioClientes !== null && prices.precioClientes !== undefined && prices.precioClientes < miCosto) {
        errors.push(`${product.name}: Precio Clientes ($${prices.precioClientes}) no puede ser menor al costo ($${miCosto})`)
      }
    }

    return { valid: errors.length === 0, errors }
  }

  const handleSaveAll = async () => {
    if (!hasChanges || !companyId) return

    setSaving(true)
    try {
      // Validate prices first
      const validation = validateCompanyPrices()
      if (!validation.valid) {
        showNotification('error', 'Error de validacion', validation.errors.join('\n'))
        setSaving(false)
        return
      }

      // Save company-specific prices
      const products = Object.entries(editingCompanyPrices).map(([id, prices]) => ({
        productId: parseInt(id),
        precioSucursales: prices.precioSucursales,
        precioClientes: prices.precioClientes,
        providerCost: prices.providerCost,
        precioALogiRapid: prices.precioALogiRapid
      }))

      await updateCompanyPrices(products, 'Actualizacion de precios desde Lista de Precios')

      showNotification('success', 'Precios actualizados', `${products.length} precio(s) actualizado(s) correctamente`)
      setEditingCompanyPrices({})
    } catch (err: any) {
      showNotification('error', 'Error', err.message || 'Error al guardar precios')
    } finally {
      setSaving(false)
    }
  }

  // Get products to display
  const productsToDisplay = companyPricingData?.products || []

  const filteredProducts = productsToDisplay.filter((p: any) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const productsByCategory = filteredProducts.reduce((acc: any, product: any) => {
    const cat = product.serviceCategory
    if (!acc[cat]) {
      acc[cat] = []
    }
    acc[cat].push(product)
    return acc
  }, {} as Record<string, typeof filteredProducts>)

  // Check if company is provider for a category
  const isProviderForCategory = (category: string): boolean => {
    if (!company) return false
    return company.isProvider === true &&
      Array.isArray(company.providerCategories) &&
      company.providerCategories.includes(category)
  }

  // Separate products into provider products and client products
  const providerCategories = company?.providerCategories || []

  // Get product counts by category for tabs
  const getProductCountByCategory = (category: string) => {
    if (category === 'all') return filteredProducts.length
    return filteredProducts.filter((p: any) => p.serviceCategory === category).length
  }

  // Calculate statistics
  const stats = {
    totalProducts: companyPricingData?.products.length || 0,
    totalCategories: Object.keys(productsByCategory).length,
    configuredProducts: companyPricingData?.products.filter((p: any) => p.hasPricing).length || 0
  }

  const isBranch = companyPricingData?.isBranch || false

  // Loading state - wait for user and company data
  if (!user || !companyId) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-500">Cargando informacion de usuario...</span>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header with company info */}
        <div className={cn(
          "p-4 rounded-xl border",
          theme === 'dark'
            ? "bg-gray-800/50 border-gray-700"
            : "bg-white border-gray-200"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-3 rounded-xl",
                theme === 'dark' ? "bg-blue-900/30" : "bg-blue-50"
              )}>
                <Building2 className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h1 className={cn(
                  "text-xl font-bold",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  Lista de Precios
                </h1>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                )}>
                  {company?.legalName || 'Mi Empresa'}
                  {isBranch && ' (Sucursal)'}
                </p>
              </div>
            </div>

            {company?.isProvider && providerCategories.length > 0 && (
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium",
                theme === 'dark' ? "bg-amber-900/30 text-amber-400" : "bg-amber-100 text-amber-700"
              )}>
                <Truck className="w-4 h-4" />
                Proveedor de: {providerCategories.map(c => categoryLabels[c] || c).join(', ')}
              </div>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Products Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={cn(
                "relative overflow-hidden rounded-2xl border shadow-xl",
                theme === 'dark'
                  ? "bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700"
                  : "bg-gradient-to-br from-white to-gray-50 border-gray-200"
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600" />
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-3 rounded-xl shadow-sm border",
                      theme === 'dark'
                        ? "bg-blue-900/30 border-blue-800/50"
                        : "bg-blue-50 border-blue-200"
                    )}>
                      <Package className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <p className={cn(
                        "text-sm font-medium",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        Total Productos
                      </p>
                      <p className={cn(
                        "text-3xl font-bold mt-1",
                        theme === 'dark' ? "text-white" : "text-gray-900"
                      )}>
                        {stats.totalProducts}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Categories Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className={cn(
                "relative overflow-hidden rounded-2xl border shadow-xl",
                theme === 'dark'
                  ? "bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700"
                  : "bg-gradient-to-br from-white to-gray-50 border-gray-200"
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-purple-600" />
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-3 rounded-xl shadow-sm border",
                      theme === 'dark'
                        ? "bg-purple-900/30 border-purple-800/50"
                        : "bg-purple-50 border-purple-200"
                    )}>
                      <Layers className="w-6 h-6 text-purple-500" />
                    </div>
                    <div>
                      <p className={cn(
                        "text-sm font-medium",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        Categorias
                      </p>
                      <p className={cn(
                        "text-3xl font-bold mt-1",
                        theme === 'dark' ? "text-white" : "text-gray-900"
                      )}>
                        {stats.totalCategories}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Configured Products Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className={cn(
                "relative overflow-hidden rounded-2xl border shadow-xl",
                theme === 'dark'
                  ? "bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700"
                  : "bg-gradient-to-br from-white to-gray-50 border-gray-200"
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-green-600" />
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-3 rounded-xl shadow-sm border",
                      theme === 'dark'
                        ? "bg-green-900/30 border-green-800/50"
                        : "bg-green-50 border-green-200"
                    )}>
                      <TrendingUp className="w-6 h-6 text-green-500" />
                    </div>
                    <div>
                      <p className={cn(
                        "text-sm font-medium",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        Configurados
                      </p>
                      <p className={cn(
                        "text-3xl font-bold mt-1",
                        theme === 'dark' ? "text-white" : "text-gray-900"
                      )}>
                        {stats.configuredProducts}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Category Tabs */}
        <div className={cn(
          "p-4 rounded-xl border",
          theme === 'dark'
            ? "bg-gray-800/50 border-gray-700"
            : "bg-white border-gray-200"
        )}>
          <div className={cn(
            "flex flex-wrap gap-2 p-1.5 rounded-lg",
            theme === 'dark' ? "bg-gray-900/50" : "bg-gray-100"
          )}>
            {SERVICE_CATEGORIES.map((cat) => {
              const Icon = cat.icon
              const count = getProductCountByCategory(cat.id)
              const isActive = activeCategory === cat.id
              const isProviderCat = isProviderForCategory(cat.id)

              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                    isActive
                      ? theme === 'dark'
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-blue-600 text-white shadow-md"
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
                  {isProviderCat && (
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                      isActive
                        ? "bg-amber-400 text-amber-900"
                        : "bg-amber-500/20 text-amber-500"
                    )}>
                      Proveedor
                    </span>
                  )}
                </button>
              )
            })}
          </div>

        </div>

        {/* Search and Actions Bar */}
        <div className={cn(
          "flex flex-col lg:flex-row gap-6 items-center justify-between py-6 px-4 rounded-xl border",
          theme === 'dark'
            ? "bg-gray-800/50 border-gray-700"
            : "bg-white border-gray-200"
        )}>
          {/* Search Input */}
          <div className="flex-1 relative w-full lg:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar por nombre o codigo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(
                "w-full h-12 pl-10 pr-4 rounded-lg border transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm",
                theme === 'dark'
                  ? "bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                  : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
              )}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="flex gap-3 w-full sm:w-auto">
              {/* Refresh Button */}
              <button
                onClick={() => refresh()}
                className={cn(
                  "inline-flex whitespace-nowrap text-sm",
                  "px-6 py-3 flex-1 sm:flex-none items-center justify-center gap-2 h-12",
                  "bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg",
                  "transition-all duration-200 shadow-sm hover:shadow-md",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500/20",
                  theme === 'dark' && "bg-blue-700 hover:bg-blue-800"
                )}
              >
                <RefreshCw className="w-4 h-4" />
                Actualizar
              </button>

              {/* Save Button (conditional) */}
              {hasChanges && (
                <button
                  onClick={handleSaveAll}
                  disabled={saving}
                  className={cn(
                    "flex-1 sm:flex-none justify-center whitespace-nowrap rounded-lg",
                    "text-sm font-medium transition-all duration-200 h-12",
                    "shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-green-500/20",
                    "flex items-center gap-2 px-6",
                    saving
                      ? "bg-gray-400 cursor-not-allowed text-white"
                      : "bg-green-600 hover:bg-green-700 text-white"
                  )}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Guardar ({Object.keys(editingCompanyPrices).length})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-500">Cargando precios...</span>
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

        {/* Categories */}
        {!loading && !error && (
          <div className="space-y-4">
            {Object.entries(productsByCategory).map(([category, products]: [string, any[]]) => {
              const Icon = categoryIcons[category] || Package
              const isExpanded = expandedCategories[category]
              const isProviderCat = isProviderForCategory(category)

              // Skip if filtering by category and this doesn't match
              if (activeCategory !== 'all' && category !== activeCategory) return null

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
                        <div className="flex items-center gap-2">
                          <h3 className={cn(
                            "font-semibold",
                            theme === 'dark' ? "text-white" : "text-gray-900"
                          )}>
                            {categoryLabels[category] || category}
                          </h3>
                          {isProviderCat && (
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                              theme === 'dark' ? "bg-amber-600 text-white" : "bg-amber-500 text-white"
                            )}>
                              Eres Proveedor
                            </span>
                          )}
                        </div>
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>
                          {products.length} producto{products.length !== 1 ? 's' : ''}
                          {isProviderCat && ' - Configura tu precio base'}
                        </p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </button>

                  {/* Products Table */}
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
                          <table className="w-full table-fixed">
                            <thead>
                              <tr className={cn(
                                "text-left text-xs uppercase tracking-wider",
                                theme === 'dark' ? "bg-gray-900/50 text-gray-400" : "bg-gray-50 text-gray-500"
                              )}>
                                <th className="pl-4 pr-16 py-3 w-36">Codigo</th>
                                <th className="pl-10 pr-4 py-3 w-auto">Producto</th>
                                {isProviderCat ? (
                                  /* Provider view */
                                  <>
                                    <th className="px-4 py-3 w-36 text-center">
                                      <div className="flex flex-col items-center">
                                        <div className="flex items-center gap-1">
                                          <DollarSign className="w-3 h-3 text-amber-500" />
                                          Tu Precio Base
                                        </div>
                                        <span className="text-[10px] font-normal opacity-60">(Editable)</span>
                                      </div>
                                    </th>
                                    <th className="px-4 py-3 w-36 text-center">
                                      <div className="flex flex-col items-center">
                                        <div className="flex items-center gap-1">
                                          <Building2 className="w-3 h-3 text-blue-500" />
                                          Precio LogiRapid
                                        </div>
                                        <span className="text-[10px] font-normal opacity-60">(Referencia)</span>
                                      </div>
                                    </th>
                                    <th className="px-4 py-3 w-32 text-center">
                                      <div className="flex flex-col items-center">
                                        <span>Tu Margen</span>
                                        <span className="text-[10px] font-normal opacity-60">(LogiRapid - Tu Precio)</span>
                                      </div>
                                    </th>
                                  </>
                                ) : (
                                  /* Client view */
                                  <>
                                    <th className="px-4 py-3 w-32 text-center">
                                      <div className="flex flex-col items-center">
                                        <div className="flex items-center gap-1">
                                          <DollarSign className="w-3 h-3 text-amber-500" />
                                          Mi Costo
                                        </div>
                                        <span className="text-[10px] font-normal opacity-60">(LogiRapid)</span>
                                      </div>
                                    </th>
                                    {!isBranch && (
                                      <th className="px-4 py-3 w-36 text-center">
                                        <div className="flex flex-col items-center">
                                          <div className="flex items-center gap-1">
                                            <Building2 className="w-3 h-3 text-blue-500" />
                                            P. Sucursales
                                          </div>
                                          <span className="text-[10px] font-normal opacity-60">(Editable)</span>
                                        </div>
                                      </th>
                                    )}
                                    <th className="px-4 py-3 w-36 text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <Users className="w-3 h-3 text-green-500" />
                                        P. Clientes
                                      </div>
                                    </th>
                                    <th className="px-4 py-3 w-32 text-center">
                                      <div className="flex flex-col items-center">
                                        <span>Margen</span>
                                        <span className="text-[10px] font-normal opacity-60">(P.Cli - Costo)</span>
                                      </div>
                                    </th>
                                  </>
                                )}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                              {products.map((product: any) => {
                                const isProductProviderCat = isProviderForCategory(product.serviceCategory)

                                if (isProductProviderCat) {
                                  // PROVIDER VIEW
                                  const editing = editingCompanyPrices[product.productId]
                                  const tuPrecioBase = editing?.providerCost ?? (product.catalogMiCosto || product.miCosto || 0)
                                  const precioLogiRapid = product.precioMayorista || product.catalogPrecioMayorista || 0

                                  const tuMargen = precioLogiRapid - tuPrecioBase
                                  const tuMargenPct = tuPrecioBase > 0
                                    ? ((tuMargen / tuPrecioBase) * 100).toFixed(1)
                                    : '0'

                                  const hasEdits = editing !== undefined

                                  return (
                                    <tr
                                      key={product.productId}
                                      className={cn(
                                        "transition-colors",
                                        hasEdits
                                          ? theme === 'dark' ? "bg-blue-900/20" : "bg-blue-50"
                                          : theme === 'dark' ? "hover:bg-gray-800/50" : "hover:bg-gray-50"
                                      )}
                                    >
                                      <td className="pl-4 pr-16 py-3">
                                        <span className={cn(
                                          "font-mono text-sm",
                                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                        )}>
                                          {product.code}
                                        </span>
                                      </td>
                                      <td className="pl-10 pr-4 py-3">
                                        <div>
                                          <div className={cn(
                                            "font-medium truncate",
                                            theme === 'dark' ? "text-white" : "text-gray-900"
                                          )}>
                                            {product.name}
                                          </div>
                                          {product.description && (
                                            <div className={cn(
                                              "text-xs truncate",
                                              theme === 'dark' ? "text-gray-500" : "text-gray-400"
                                            )}>
                                              {product.description}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                      {/* Tu Precio Base - EDITABLE */}
                                      <td className="px-4 py-3 text-center">
                                        <input
                                          type="number"
                                          step="0.01"
                                          value={tuPrecioBase}
                                          onChange={(e) => handleCompanyPriceChange(
                                            product.productId,
                                            'providerCost',
                                            parseFloat(e.target.value) || 0,
                                            product
                                          )}
                                          className={cn(
                                            "w-full max-w-[100px] px-2 py-1 text-center rounded border text-sm mx-auto",
                                            theme === 'dark'
                                              ? "bg-gray-900 border-gray-700 text-blue-400"
                                              : "bg-white border-gray-200 text-blue-600"
                                          )}
                                        />
                                      </td>
                                      {/* Precio LogiRapid - READ ONLY */}
                                      <td className="px-4 py-3 text-center">
                                        <span className={cn(
                                          "text-sm font-medium",
                                          theme === 'dark' ? "text-blue-400" : "text-blue-600"
                                        )}>
                                          ${precioLogiRapid.toFixed(2)}
                                        </span>
                                      </td>
                                      {/* Tu Margen */}
                                      <td className="px-4 py-3 text-center">
                                        <span className={cn(
                                          "text-sm font-medium whitespace-nowrap",
                                          tuMargen > 0
                                            ? "text-green-500"
                                            : tuMargen < 0
                                              ? "text-red-500"
                                              : theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                        )}>
                                          ${tuMargen.toFixed(2)} ({tuMargenPct}%)
                                        </span>
                                      </td>
                                    </tr>
                                  )
                                } else {
                                  // CLIENT VIEW
                                  const editing = editingCompanyPrices[product.productId]
                                  const miCosto = product.miCosto || product.catalogMiCosto || 0
                                  const precioSucursales = editing?.precioSucursales ?? product.precioSucursales
                                  const precioClientes = editing?.precioClientes ?? product.precioClientes

                                  const margen = precioClientes !== null ? precioClientes - miCosto : 0
                                  const margenPct = miCosto > 0 && precioClientes !== null
                                    ? ((margen / miCosto) * 100).toFixed(1)
                                    : '0'

                                  const hasEdits = editing !== undefined

                                  // Validation
                                  const precioSucursalesBelowCost = precioSucursales !== null && precioSucursales < miCosto
                                  const precioClientesBelowCost = precioClientes !== null && precioClientes < miCosto

                                  return (
                                    <tr
                                      key={product.productId}
                                      className={cn(
                                        "transition-colors",
                                        hasEdits
                                          ? theme === 'dark' ? "bg-blue-900/20" : "bg-blue-50"
                                          : theme === 'dark' ? "hover:bg-gray-800/50" : "hover:bg-gray-50"
                                      )}
                                    >
                                      <td className="pl-4 pr-16 py-3">
                                        <span className={cn(
                                          "font-mono text-sm",
                                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                        )}>
                                          {product.code}
                                        </span>
                                      </td>
                                      <td className="pl-10 pr-4 py-3">
                                        <div>
                                          <div className={cn(
                                            "font-medium truncate",
                                            theme === 'dark' ? "text-white" : "text-gray-900"
                                          )}>
                                            {product.name}
                                          </div>
                                          {product.description && (
                                            <div className={cn(
                                              "text-xs truncate",
                                              theme === 'dark' ? "text-gray-500" : "text-gray-400"
                                            )}>
                                              {product.description}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        <span className={cn(
                                          "text-sm font-medium",
                                          theme === 'dark' ? "text-amber-400" : "text-amber-600"
                                        )}>
                                          ${miCosto.toFixed(2)}
                                        </span>
                                      </td>
                                      {!isBranch && (
                                        <td className="px-4 py-3 text-center">
                                          <div className="relative">
                                            <input
                                              type="number"
                                              step="0.01"
                                              value={precioSucursales ?? ''}
                                              onChange={(e) => handleCompanyPriceChange(
                                                product.productId,
                                                'precioSucursales',
                                                parseFloat(e.target.value) || 0,
                                                product
                                              )}
                                              placeholder="Sin configurar"
                                              className={cn(
                                                "w-full max-w-[100px] px-2 py-1 text-center rounded border text-sm mx-auto",
                                                precioSucursalesBelowCost
                                                  ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                                                  : theme === 'dark'
                                                    ? "bg-gray-900 border-gray-700 text-blue-400"
                                                    : "bg-white border-gray-200 text-blue-600"
                                              )}
                                            />
                                            {precioSucursalesBelowCost && (
                                              <div className="absolute -bottom-4 left-0 right-0 text-[10px] text-red-500">
                                                Menor al costo
                                              </div>
                                            )}
                                          </div>
                                        </td>
                                      )}
                                      <td className="px-4 py-3 text-center">
                                        <div className="relative">
                                          <input
                                            type="number"
                                            step="0.01"
                                            value={precioClientes ?? ''}
                                            onChange={(e) => handleCompanyPriceChange(
                                              product.productId,
                                              'precioClientes',
                                              parseFloat(e.target.value) || 0,
                                              product
                                            )}
                                            placeholder="Sin configurar"
                                            className={cn(
                                              "w-full max-w-[100px] px-2 py-1 text-center rounded border text-sm mx-auto",
                                              precioClientesBelowCost
                                                ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                                                : theme === 'dark'
                                                  ? "bg-gray-900 border-gray-700 text-green-400"
                                                  : "bg-white border-gray-200 text-green-600"
                                            )}
                                          />
                                          {precioClientesBelowCost && (
                                            <div className="absolute -bottom-4 left-0 right-0 text-[10px] text-red-500">
                                              Menor al costo
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        <span className={cn(
                                          "text-sm font-medium whitespace-nowrap",
                                          margen > 0
                                            ? "text-green-500"
                                            : margen < 0
                                              ? "text-red-500"
                                              : theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                        )}>
                                          ${margen.toFixed(2)} ({margenPct}%)
                                        </span>
                                      </td>
                                    </tr>
                                  )
                                }
                              })}
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
        {!loading && !error && filteredProducts.length === 0 && (
          <div className={cn(
            "p-12 text-center rounded-xl border-2 border-dashed",
            theme === 'dark' ? "border-gray-700" : "border-gray-200"
          )}>
            <Package className={cn(
              "w-12 h-12 mx-auto mb-4",
              theme === 'dark' ? "text-gray-600" : "text-gray-400"
            )} />
            <h3 className={cn(
              "font-medium mb-1",
              theme === 'dark' ? "text-gray-300" : "text-gray-700"
            )}>
              No hay productos
            </h3>
            <p className={cn(
              "text-sm",
              theme === 'dark' ? "text-gray-500" : "text-gray-400"
            )}>
              {searchTerm
                ? 'No se encontraron productos con ese termino de busqueda'
                : 'No hay productos configurados para tu empresa'}
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
