'use client'

import { useState } from 'react'
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
  Check,
  RefreshCw,
  Search,
  Plus,
  Edit2,
  Trash2,
  History
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { useProductCatalog } from '@/hooks/useProductCatalog'

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

interface EditingPrice {
  providerCost: number
  providerB2BPrice: number
  platformPrice: number
  platformMinB2C: number
}

export default function ProductCatalogPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const { data: catalogData, loading, error, refresh, updatePlatformPrices } = useProductCatalog()

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    paqueteria: true,
    remesa: false,
    recarga: false,
    mercado: false
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [editingPrices, setEditingPrices] = useState<Record<number, EditingPrice>>({})
  const [saving, setSaving] = useState(false)

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  const handlePriceChange = (
    productId: number,
    field: keyof EditingPrice,
    value: number,
    originalProduct: any
  ) => {
    setEditingPrices(prev => ({
      ...prev,
      [productId]: {
        providerCost: prev[productId]?.providerCost ?? originalProduct.providerCost,
        providerB2BPrice: prev[productId]?.providerB2BPrice ?? originalProduct.providerB2BPrice,
        platformPrice: prev[productId]?.platformPrice ?? originalProduct.platformPrice,
        platformMinB2C: prev[productId]?.platformMinB2C ?? originalProduct.platformMinB2C,
        [field]: value
      }
    }))
  }

  const hasChanges = Object.keys(editingPrices).length > 0

  const handleSaveAll = async () => {
    if (!hasChanges) return

    setSaving(true)
    try {
      const products = Object.entries(editingPrices).map(([id, prices]) => ({
        id: parseInt(id),
        provider_cost: prices.providerCost,
        provider_b2b_price: prices.providerB2BPrice,
        platform_price: prices.platformPrice,
        platform_min_b2c: prices.platformMinB2C
      }))

      await updatePlatformPrices(products, 'Actualizacion de precios B2B/B2C desde catalogo')

      showNotification('success', 'Precios actualizados', `${products.length} producto(s) actualizado(s) correctamente`)

      setEditingPrices({})
    } catch (err: any) {
      showNotification('error', 'Error', err.message || 'Error al guardar precios')
    } finally {
      setSaving(false)
    }
  }

  const filteredProducts = catalogData?.products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  const productsByCategory = filteredProducts.reduce((acc, product) => {
    const cat = product.serviceCategory
    if (!acc[cat]) {
      acc[cat] = []
    }
    acc[cat].push(product)
    return acc
  }, {} as Record<string, typeof filteredProducts>)

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className={cn(
              "text-2xl font-bold",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              Catalogo de Productos
            </h1>
            <p className={cn(
              "text-sm mt-1",
              theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>
              Gestiona precios B2B y B2C del catalogo de plataforma
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={refresh}
              className={cn(
                "p-2 rounded-lg border transition-colors",
                theme === 'dark'
                  ? "border-gray-700 hover:bg-gray-800"
                  : "border-gray-200 hover:bg-gray-100"
              )}
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {hasChanges && (
              <button
                onClick={handleSaveAll}
                disabled={saving}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
                  saving
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700 text-white"
                )}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Guardar Cambios ({Object.keys(editingPrices).length})
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className={cn(
            "absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4",
            theme === 'dark' ? "text-gray-500" : "text-gray-400"
          )} />
          <input
            type="text"
            placeholder="Buscar productos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              "w-full pl-10 pr-4 py-2 rounded-lg border transition-colors",
              theme === 'dark'
                ? "bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                : "bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
            )}
          />
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-500">Cargando catalogo...</span>
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

        {/* Legend */}
        {!loading && !error && (
          <div className={cn(
            "flex flex-wrap gap-4 text-sm p-3 rounded-lg",
            theme === 'dark' ? "bg-gray-800/50" : "bg-gray-50"
          )}>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-500" />
              <span className={theme === 'dark' ? "text-gray-300" : "text-gray-700"}>
                Costo Proveedor: Lo que paga el proveedor
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              <span className={theme === 'dark' ? "text-gray-300" : "text-gray-700"}>
                Precio B2B: Lo que LogiRapid cobra a empresas
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-green-500" />
              <span className={theme === 'dark' ? "text-gray-300" : "text-gray-700"}>
                Min B2C: Precio minimo al publico
              </span>
            </div>
          </div>
        )}

        {/* Categories */}
        {!loading && !error && (
          <div className="space-y-4">
            {Object.entries(productsByCategory).map(([category, products]) => {
              const Icon = categoryIcons[category] || Package
              const isExpanded = expandedCategories[category]

              return (
                <div
                  key={category}
                  className={cn(
                    "rounded-xl border overflow-hidden",
                    theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
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
                          {products.length} producto{products.length !== 1 ? 's' : ''}
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
                          <table className="w-full">
                            <thead>
                              <tr className={cn(
                                "text-left text-xs uppercase tracking-wider",
                                theme === 'dark'
                                  ? "bg-gray-900/50 text-gray-400"
                                  : "bg-gray-50 text-gray-500"
                              )}>
                                <th className="px-4 py-3">Codigo</th>
                                <th className="px-4 py-3">Producto</th>
                                <th className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <DollarSign className="w-3 h-3 text-amber-500" />
                                    Costo Prov.
                                  </div>
                                </th>
                                <th className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Building2 className="w-3 h-3 text-blue-500" />
                                    B2B Prov.
                                  </div>
                                </th>
                                <th className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Building2 className="w-3 h-3 text-indigo-500" />
                                    Precio B2B
                                  </div>
                                </th>
                                <th className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Users className="w-3 h-3 text-green-500" />
                                    Min B2C
                                  </div>
                                </th>
                                <th className="px-4 py-3 text-center">Margen</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                              {products.map((product) => {
                                const editing = editingPrices[product.id]
                                const providerCost = editing?.providerCost ?? product.providerCost
                                const providerB2BPrice = editing?.providerB2BPrice ?? product.providerB2BPrice
                                const platformPrice = editing?.platformPrice ?? product.platformPrice
                                const platformMinB2C = editing?.platformMinB2C ?? product.platformMinB2C

                                // Calculate margin
                                const margin = platformPrice - providerB2BPrice
                                const marginPercent = providerB2BPrice > 0
                                  ? ((margin / providerB2BPrice) * 100).toFixed(1)
                                  : '0'

                                const hasEdits = editing !== undefined

                                return (
                                  <tr
                                    key={product.id}
                                    className={cn(
                                      "transition-colors",
                                      hasEdits
                                        ? theme === 'dark' ? "bg-blue-900/20" : "bg-blue-50"
                                        : theme === 'dark' ? "hover:bg-gray-800/50" : "hover:bg-gray-50"
                                    )}
                                  >
                                    <td className="px-4 py-3">
                                      <span className={cn(
                                        "font-mono text-sm",
                                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                      )}>
                                        {product.code}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div>
                                        <div className={cn(
                                          "font-medium",
                                          theme === 'dark' ? "text-white" : "text-gray-900"
                                        )}>
                                          {product.name}
                                        </div>
                                        {product.description && (
                                          <div className={cn(
                                            "text-xs",
                                            theme === 'dark' ? "text-gray-500" : "text-gray-400"
                                          )}>
                                            {product.description}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={providerCost}
                                        onChange={(e) => handlePriceChange(
                                          product.id,
                                          'providerCost',
                                          parseFloat(e.target.value) || 0,
                                          product
                                        )}
                                        className={cn(
                                          "w-24 px-2 py-1 text-right rounded border text-sm",
                                          theme === 'dark'
                                            ? "bg-gray-900 border-gray-700 text-amber-400"
                                            : "bg-white border-gray-200 text-amber-600"
                                        )}
                                      />
                                    </td>
                                    <td className="px-4 py-3">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={providerB2BPrice}
                                        onChange={(e) => handlePriceChange(
                                          product.id,
                                          'providerB2BPrice',
                                          parseFloat(e.target.value) || 0,
                                          product
                                        )}
                                        className={cn(
                                          "w-24 px-2 py-1 text-right rounded border text-sm",
                                          theme === 'dark'
                                            ? "bg-gray-900 border-gray-700 text-blue-400"
                                            : "bg-white border-gray-200 text-blue-600"
                                        )}
                                      />
                                    </td>
                                    <td className="px-4 py-3">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={platformPrice}
                                        onChange={(e) => handlePriceChange(
                                          product.id,
                                          'platformPrice',
                                          parseFloat(e.target.value) || 0,
                                          product
                                        )}
                                        className={cn(
                                          "w-24 px-2 py-1 text-right rounded border text-sm",
                                          theme === 'dark'
                                            ? "bg-gray-900 border-gray-700 text-indigo-400"
                                            : "bg-white border-gray-200 text-indigo-600"
                                        )}
                                      />
                                    </td>
                                    <td className="px-4 py-3">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={platformMinB2C}
                                        onChange={(e) => handlePriceChange(
                                          product.id,
                                          'platformMinB2C',
                                          parseFloat(e.target.value) || 0,
                                          product
                                        )}
                                        className={cn(
                                          "w-24 px-2 py-1 text-right rounded border text-sm",
                                          theme === 'dark'
                                            ? "bg-gray-900 border-gray-700 text-green-400"
                                            : "bg-white border-gray-200 text-green-600"
                                        )}
                                      />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={cn(
                                        "text-sm font-medium",
                                        margin > 0
                                          ? "text-green-500"
                                          : margin < 0
                                            ? "text-red-500"
                                            : theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                      )}>
                                        ${margin.toFixed(2)} ({marginPercent}%)
                                      </span>
                                    </td>
                                  </tr>
                                )
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
                : 'El catalogo de productos esta vacio'}
            </p>
          </div>
        )}

        {/* Info Box */}
        {!loading && !error && catalogData && catalogData.products.length > 0 && (
          <div className={cn(
            "p-4 rounded-lg border",
            theme === 'dark'
              ? "bg-blue-900/20 border-blue-800"
              : "bg-blue-50 border-blue-200"
          )}>
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className={cn(
                  "font-medium mb-1",
                  theme === 'dark' ? "text-blue-300" : "text-blue-800"
                )}>
                  Piramide de Precios B2B/B2C
                </h4>
                <ul className={cn(
                  "text-sm space-y-1",
                  theme === 'dark' ? "text-blue-200/80" : "text-blue-700"
                )}>
                  <li><strong>Costo Proveedor:</strong> Lo que le cuesta al proveedor producir/adquirir el producto</li>
                  <li><strong>B2B Proveedor:</strong> Precio que el proveedor cobra a LogiRapid (su margen)</li>
                  <li><strong>Precio B2B:</strong> Precio que LogiRapid cobra a las empresas cliente (default)</li>
                  <li><strong>Min B2C:</strong> Precio minimo que las empresas deben cobrar al publico</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
