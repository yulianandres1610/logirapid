'use client'

import { useState, useEffect } from 'react'
import {
  Package,
  DollarSign,
  Smartphone,
  Store,
  Save,
  Loader2,
  Building2,
  RefreshCw,
  Search,
  Plus,
  Edit2,
  Layers,
  AlertCircle,
  Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { useProductCatalog, useCompanyProductPricing } from '@/hooks/useProductCatalog'
import { useAuth } from '@/hooks/useAuth'
import ProductModal, { ProductData } from '@/components/products/ProductModal'

// Category configuration
const CATEGORIES = [
  { id: 'all', name: 'Todos', icon: Layers },
  { id: 'paqueteria', name: 'Paqueteria', icon: Package },
  { id: 'remesa', name: 'Remesa', icon: DollarSign },
  { id: 'recarga', name: 'Recarga', icon: Smartphone },
  { id: 'mercado', name: 'Mercado', icon: Store }
]

interface Company {
  id: number
  legalName: string
  status: string
}

export default function ProductCatalogPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  // Catalog data hook
  const { data: catalogData, loading, error, refresh, updatePlatformPrices } = useProductCatalog()

  // Company selector state
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [loadingCompanies, setLoadingCompanies] = useState(true)

  // Company pricing hook
  const {
    data: companyPricingData,
    loading: loadingCompanyPricing,
    refresh: refreshCompanyPricing,
    updatePrices: updateCompanyPrices
  } = useCompanyProductPricing(selectedCompanyId)

  // UI State
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [saving, setSaving] = useState(false)

  // Modal state
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductData | null>(null)

  // Price editing states
  const [editingCatalogPrices, setEditingCatalogPrices] = useState<Record<number, {
    miCosto: number
    precioMayorista: number
    precioPublico: number
  }>>({})

  const [editingCompanyPrices, setEditingCompanyPrices] = useState<Record<number, {
    precioEmpresa: number | null
    usarCatalogo: boolean
  }>>({})

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
        }
      } catch (err) {
        console.error('Error fetching companies:', err)
      } finally {
        setLoadingCompanies(false)
      }
    }
    fetchCompanies()
  }, [])

  // Derived state
  const isViewingCompanyPrices = selectedCompanyId !== null
  const currentLoading = isViewingCompanyPrices ? loadingCompanyPricing : loading
  const hasChanges = isViewingCompanyPrices
    ? Object.keys(editingCompanyPrices).length > 0
    : Object.keys(editingCatalogPrices).length > 0

  // Filter products
  const getFilteredProducts = () => {
    const products = isViewingCompanyPrices
      ? companyPricingData?.products || []
      : catalogData?.products || []

    return products.filter(product => {
      const matchesCategory = activeCategory === 'all' || product.serviceCategory === activeCategory
      const matchesSearch = !searchTerm ||
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.code.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }

  const filteredProducts = getFilteredProducts()

  // Get product count by category
  const getProductCount = (categoryId: string) => {
    const products = isViewingCompanyPrices
      ? companyPricingData?.products || []
      : catalogData?.products || []
    if (categoryId === 'all') return products.length
    return products.filter(p => p.serviceCategory === categoryId).length
  }

  // Handle catalog price change
  const handleCatalogPriceChange = (productId: number, field: string, value: number) => {
    setEditingCatalogPrices(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {
          miCosto: catalogData?.products.find(p => p.id === productId)?.miCosto || 0,
          precioMayorista: catalogData?.products.find(p => p.id === productId)?.precioMayorista || 0,
          precioPublico: catalogData?.products.find(p => p.id === productId)?.precioPublico || 0
        }),
        [field]: value
      }
    }))
  }

  // Handle company price change
  const handleCompanyPriceChange = (productId: number, precioEmpresa: number | null, usarCatalogo: boolean) => {
    setEditingCompanyPrices(prev => ({
      ...prev,
      [productId]: { precioEmpresa, usarCatalogo }
    }))
  }

  // Save catalog prices
  const handleSaveCatalogPrices = async () => {
    if (Object.keys(editingCatalogPrices).length === 0) return

    try {
      setSaving(true)
      const productsToUpdate = Object.entries(editingCatalogPrices).map(([id, prices]) => ({
        id: parseInt(id),
        miCosto: prices.miCosto,
        precioMayorista: prices.precioMayorista,
        precioPublico: prices.precioPublico
      }))

      await updatePlatformPrices(productsToUpdate)
      setEditingCatalogPrices({})
      showNotification('success', 'Exito', 'Precios del catalogo actualizados')
    } catch (err: any) {
      showNotification('error', 'Error', err.message || 'Error al actualizar precios')
    } finally {
      setSaving(false)
    }
  }

  // Save company prices
  const handleSaveCompanyPrices = async () => {
    if (Object.keys(editingCompanyPrices).length === 0 || !selectedCompanyId) return

    try {
      setSaving(true)
      const productsToUpdate = Object.entries(editingCompanyPrices).map(([id, data]) => ({
        productId: parseInt(id),
        precioClientes: data.usarCatalogo ? null : data.precioEmpresa
      }))

      await updateCompanyPrices(productsToUpdate)
      setEditingCompanyPrices({})
      showNotification('success', 'Exito', 'Precios de empresa actualizados')
    } catch (err: any) {
      showNotification('error', 'Error', err.message || 'Error al actualizar precios')
    } finally {
      setSaving(false)
    }
  }

  // Create/Edit product
  const handleSaveProduct = async (productData: ProductData) => {
    const method = productData.id ? 'PUT' : 'POST'
    const response = await fetch('/api/products', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    })

    const result = await response.json()
    if (!result.success) {
      throw new Error(result.error || 'Error al guardar producto')
    }

    await refresh()
    showNotification('success', 'Exito', productData.id ? 'Producto actualizado' : 'Producto creado')
  }

  // Format currency
  const formatCurrency = (value: number) => `$${value.toFixed(2)}`

  // Calculate margin
  const calculateMargin = (cost: number, price: number) => {
    if (cost === 0) return price > 0 ? 100 : 0
    return ((price - cost) / cost * 100)
  }

  // Get selected company name
  const selectedCompanyName = companies.find(c => c.id === selectedCompanyId)?.legalName

  return (
    <DashboardLayout>
      <div className={cn(
        "min-h-screen p-6",
        theme === 'dark' ? "bg-gray-900" : "bg-gray-50"
      )}>
        {/* Header */}
        <div className="mb-6">
          <h1 className={cn(
            "text-2xl font-bold mb-2",
            theme === 'dark' ? "text-white" : "text-gray-900"
          )}>
            {isViewingCompanyPrices ? 'Precios por Empresa' : 'Catalogo de Productos'}
          </h1>
          <p className={cn(
            "text-sm",
            theme === 'dark' ? "text-gray-400" : "text-gray-600"
          )}>
            {isViewingCompanyPrices
              ? `Configura precios especificos para ${selectedCompanyName}`
              : 'Gestiona los productos y precios del catalogo de LogiRapid'
            }
          </p>
        </div>

        {/* Company Selector + Actions Bar */}
        <div className={cn(
          "flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between p-4 rounded-xl border mb-6",
          theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          {/* Company Selector */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Building2 className={cn(
              "w-5 h-5 flex-shrink-0",
              theme === 'dark' ? "text-gray-400" : "text-gray-500"
            )} />
            <select
              value={selectedCompanyId || ''}
              onChange={(e) => {
                const value = e.target.value
                setSelectedCompanyId(value ? parseInt(value) : null)
                setEditingCatalogPrices({})
                setEditingCompanyPrices({})
              }}
              disabled={loadingCompanies}
              className={cn(
                "flex-1 min-w-0 px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                theme === 'dark'
                  ? "bg-gray-700 border-gray-600 text-white"
                  : "bg-white border-gray-300 text-gray-900"
              )}
            >
              <option value="">Catalogo General (LogiRapid)</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>
                  {company.legalName} - Precios Especificos
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar por nombre o codigo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(
                "w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                theme === 'dark'
                  ? "bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                  : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
              )}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 flex-shrink-0">
            {!isViewingCompanyPrices && isSuperAdmin && (
              <button
                onClick={() => {
                  setEditingProduct(null)
                  setProductModalOpen(true)
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nuevo Producto
              </button>
            )}

            <button
              onClick={() => isViewingCompanyPrices ? refreshCompanyPricing() : refresh()}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                theme === 'dark'
                  ? "bg-gray-700 text-white hover:bg-gray-600"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              <RefreshCw className="w-4 h-4" />
              Actualizar
            </button>

            {hasChanges && (
              <button
                onClick={isViewingCompanyPrices ? handleSaveCompanyPrices : handleSaveCatalogPrices}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar Cambios
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div className={cn(
          "flex flex-wrap gap-2 p-3 rounded-xl border mb-6",
          theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          {CATEGORIES.map(cat => {
            const Icon = cat.icon
            const count = getProductCount(cat.id)
            const isActive = activeCategory === cat.id

            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-blue-600 text-white shadow-md"
                    : theme === 'dark'
                      ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                <Icon className="w-4 h-4" />
                {cat.name}
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-xs",
                  isActive ? "bg-white/20" : "bg-gray-500/20"
                )}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Products Table */}
        <div className={cn(
          "rounded-xl border overflow-hidden",
          theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          {currentLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className={cn(
                "w-8 h-8 animate-spin",
                theme === 'dark' ? "text-gray-400" : "text-gray-500"
              )} />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12 text-red-500">
              <AlertCircle className="w-5 h-5 mr-2" />
              {error}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className={cn(
              "text-center py-12",
              theme === 'dark' ? "text-gray-400" : "text-gray-500"
            )}>
              No se encontraron productos
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={cn(
                    "border-b",
                    theme === 'dark' ? "bg-gray-900/50 border-gray-700" : "bg-gray-50 border-gray-200"
                  )}>
                    <th className={cn(
                      "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>Codigo</th>
                    <th className={cn(
                      "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>Producto</th>

                    {!isViewingCompanyPrices ? (
                      // Catalog view columns
                      <>
                        <th className={cn(
                          "px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>Mi Costo</th>
                        <th className={cn(
                          "px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>Precio Venta</th>
                        <th className={cn(
                          "px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>Margen</th>
                        <th className={cn(
                          "px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>Estado</th>
                      </>
                    ) : (
                      // Company pricing columns
                      <>
                        <th className={cn(
                          "px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>Precio Catalogo</th>
                        <th className={cn(
                          "px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>Precio Empresa</th>
                        <th className={cn(
                          "px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>Usar Catalogo</th>
                      </>
                    )}

                    <th className={cn(
                      "px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>Acciones</th>
                  </tr>
                </thead>
                <tbody className={cn(
                  "divide-y",
                  theme === 'dark' ? "divide-gray-700" : "divide-gray-200"
                )}>
                  {filteredProducts.map((product: any) => {
                    const productId = product.productId || product.id

                    if (!isViewingCompanyPrices) {
                      // Catalog view
                      const editedPrices = editingCatalogPrices[product.id]
                      const miCosto = editedPrices?.miCosto ?? product.miCosto
                      const precioMayorista = editedPrices?.precioMayorista ?? product.precioMayorista
                      const margin = calculateMargin(miCosto, precioMayorista)
                      const marginAmount = precioMayorista - miCosto

                      return (
                        <tr
                          key={product.id}
                          className={cn(
                            "transition-colors",
                            theme === 'dark' ? "hover:bg-gray-700/50" : "hover:bg-gray-50"
                          )}
                        >
                          <td className={cn("px-4 py-4", theme === 'dark' ? "text-gray-400" : "text-gray-500")}>
                            <span className={cn(
                              "px-2.5 py-1 rounded text-xs font-mono font-medium",
                              theme === 'dark' ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"
                            )}>
                              {product.code}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className={cn("font-medium", theme === 'dark' ? "text-white" : "text-gray-900")}>
                              {product.name}
                            </div>
                            {product.description && (
                              <div className={cn("text-xs mt-0.5 max-w-xs truncate", theme === 'dark' ? "text-gray-500" : "text-gray-400")}>
                                {product.description}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={miCosto}
                              onChange={(e) => handleCatalogPriceChange(product.id, 'miCosto', parseFloat(e.target.value) || 0)}
                              className={cn(
                                "w-24 px-2 py-1.5 rounded text-right text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500",
                                theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900",
                                editedPrices && "ring-2 ring-blue-500/50"
                              )}
                            />
                          </td>
                          <td className="px-4 py-4 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={precioMayorista}
                              onChange={(e) => handleCatalogPriceChange(product.id, 'precioMayorista', parseFloat(e.target.value) || 0)}
                              className={cn(
                                "w-24 px-2 py-1.5 rounded text-right text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500",
                                theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900",
                                editedPrices && "ring-2 ring-blue-500/50"
                              )}
                            />
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className={cn(
                                "font-semibold",
                                marginAmount >= 0 ? (theme === 'dark' ? "text-green-400" : "text-green-600") : (theme === 'dark' ? "text-red-400" : "text-red-600")
                              )}>
                                {formatCurrency(marginAmount)}
                              </span>
                              <span className={cn(
                                "text-xs px-1.5 py-0.5 rounded font-medium",
                                margin >= 0 ? (theme === 'dark' ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-600") : (theme === 'dark' ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-600")
                              )}>
                                {margin.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                              product.isActive ? (theme === 'dark' ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-700") : (theme === 'dark' ? "bg-gray-600 text-gray-400" : "bg-gray-100 text-gray-500")
                            )}>
                              {product.isActive ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end">
                              <button
                                onClick={() => {
                                  setEditingProduct({
                                    id: product.id,
                                    code: product.code,
                                    name: product.name,
                                    description: product.description || '',
                                    service_category: product.serviceCategory as any,
                                    product_type: product.productType,
                                    mi_costo: product.miCosto,
                                    precio_mayorista: product.precioMayorista,
                                    precio_publico: product.precioPublico,
                                    dimensions: product.dimensions || '',
                                    weight_capacity: product.weightCapacity?.toString() || '',
                                    unit_type: product.unitType || 'unit',
                                    is_active: product.isActive,
                                    display_order: product.displayOrder || 0
                                  })
                                  setProductModalOpen(true)
                                }}
                                className={cn(
                                  "p-2 rounded-lg transition-colors",
                                  theme === 'dark' ? "hover:bg-gray-700 text-gray-400 hover:text-blue-400" : "hover:bg-gray-100 text-gray-500 hover:text-blue-600"
                                )}
                                title="Editar producto"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    } else {
                      // Company pricing view
                      const editedCompanyPrice = editingCompanyPrices[productId]
                      const catalogPrice = product.catalogPrecioMayorista || product.precioMayorista || 0
                      const currentCompanyPrice = editedCompanyPrice?.precioEmpresa ?? product.precioClientes ?? catalogPrice
                      const usarCatalogo = editedCompanyPrice?.usarCatalogo ?? (!product.hasPricing || product.precioClientes === null)

                      return (
                        <tr
                          key={productId}
                          className={cn(
                            "transition-colors",
                            theme === 'dark' ? "hover:bg-gray-700/50" : "hover:bg-gray-50"
                          )}
                        >
                          <td className={cn("px-4 py-4", theme === 'dark' ? "text-gray-400" : "text-gray-500")}>
                            <span className={cn(
                              "px-2.5 py-1 rounded text-xs font-mono font-medium",
                              theme === 'dark' ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"
                            )}>
                              {product.code}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className={cn("font-medium", theme === 'dark' ? "text-white" : "text-gray-900")}>
                              {product.name}
                            </div>
                            {product.description && (
                              <div className={cn("text-xs mt-0.5 max-w-xs truncate", theme === 'dark' ? "text-gray-500" : "text-gray-400")}>
                                {product.description}
                              </div>
                            )}
                          </td>
                          <td className={cn("px-4 py-4 text-right font-medium", theme === 'dark' ? "text-gray-400" : "text-gray-500")}>
                            {formatCurrency(catalogPrice)}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={usarCatalogo ? '' : currentCompanyPrice}
                              placeholder={usarCatalogo ? formatCurrency(catalogPrice) : ''}
                              disabled={usarCatalogo}
                              onChange={(e) => handleCompanyPriceChange(productId, parseFloat(e.target.value) || null, false)}
                              className={cn(
                                "w-28 px-2 py-1.5 rounded text-right text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500",
                                theme === 'dark' ? "bg-gray-700 border-gray-600 text-white disabled:bg-gray-800 disabled:text-gray-500" : "bg-white border-gray-300 text-gray-900 disabled:bg-gray-100 disabled:text-gray-400",
                                editedCompanyPrice && !usarCatalogo && "ring-2 ring-blue-500/50"
                              )}
                            />
                          </td>
                          <td className="px-4 py-4 text-center">
                            <button
                              onClick={() => handleCompanyPriceChange(productId, usarCatalogo ? catalogPrice : null, !usarCatalogo)}
                              className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center transition-colors mx-auto",
                                usarCatalogo
                                  ? "bg-green-500 text-white"
                                  : theme === 'dark' ? "bg-gray-700 text-gray-400 hover:bg-gray-600" : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                              )}
                            >
                              {usarCatalogo && <Check className="w-4 h-4" />}
                            </button>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end">
                              {!usarCatalogo && currentCompanyPrice !== catalogPrice && (
                                <span className={cn(
                                  "text-xs px-2 py-1 rounded font-medium",
                                  currentCompanyPrice < catalogPrice
                                    ? (theme === 'dark' ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700")
                                    : (theme === 'dark' ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700")
                                )}>
                                  {currentCompanyPrice < catalogPrice ? 'Descuento' : 'Premium'}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    }
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className={cn(
          "mt-4 flex items-center justify-between px-4 py-3 rounded-lg",
          theme === 'dark' ? "bg-gray-800" : "bg-white border border-gray-200"
        )}>
          <span className={cn("text-sm", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
            {filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''}
            {searchTerm && ` (filtrados de ${isViewingCompanyPrices ? companyPricingData?.total : catalogData?.total || 0})`}
          </span>

          {hasChanges && (
            <span className={cn("text-sm flex items-center gap-2 font-medium", theme === 'dark' ? "text-amber-400" : "text-amber-600")}>
              {Object.keys(isViewingCompanyPrices ? editingCompanyPrices : editingCatalogPrices).length} cambio{Object.keys(isViewingCompanyPrices ? editingCompanyPrices : editingCatalogPrices).length !== 1 ? 's' : ''} pendiente{Object.keys(isViewingCompanyPrices ? editingCompanyPrices : editingCatalogPrices).length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Product Modal */}
      <ProductModal
        isOpen={productModalOpen}
        product={editingProduct}
        onClose={() => {
          setProductModalOpen(false)
          setEditingProduct(null)
        }}
        onSave={handleSaveProduct}
      />
    </DashboardLayout>
  )
}
