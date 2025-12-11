'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  DollarSign,
  RefreshCw,
  Search,
  Building2,
  X,
  Save
} from 'lucide-react'

// Interfaces simplificadas
interface Product {
  id: number
  code: string
  name: string
  description: string | null
  category: string
  miCosto: number
  providerName: string | null
  isActive: boolean
}

interface Company {
  id: number
  legalName: string
  status: string
}

const CATEGORIES = [
  { id: 'paqueteria', name: 'Paqueteria' },
  { id: 'remesa', name: 'Remesa' },
  { id: 'recarga', name: 'Recarga' },
  { id: 'mercado', name: 'Mercado' }
]

export default function ProductConfigPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const isDark = theme === 'dark'

  // States
  const [products, setProducts] = useState<Product[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'productos' | 'precios'>('productos')

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  // Precios por empresa
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null)
  const [companyPrices, setCompanyPrices] = useState<Record<number, number | null>>({})
  const [savingPrices, setSavingPrices] = useState(false)

  // Fetch products
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/products?active=false')
      const data = await response.json()

      if (data.success) {
        const mappedProducts = data.data.products.map((p: any) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          description: p.description,
          category: p.service_category,
          miCosto: parseFloat(p.mi_costo) || 0,
          providerName: p.provider_company_name || null,
          isActive: p.is_active !== false
        }))
        setProducts(mappedProducts)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      showNotification('error', 'Error', 'Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }, [showNotification])

  // Fetch companies
  const fetchCompanies = useCallback(async () => {
    try {
      const response = await fetch('/api/companies')
      const data = await response.json()
      if (data.success) {
        // Filter only active companies (not LogiRapid itself)
        const filtered = data.data.filter((c: any) => c.status === 'active' && c.id !== 1)
        setCompanies(filtered.map((c: any) => ({
          id: c.id,
          legalName: c.legalname || c.legalName,
          status: c.status
        })))
      }
    } catch (error) {
      console.error('Error fetching companies:', error)
    }
  }, [])

  // Fetch company prices for a product
  const fetchCompanyPrices = useCallback(async () => {
    if (!selectedCompany) return

    try {
      const response = await fetch(`/api/companies/${selectedCompany}/products/pricing`)
      const data = await response.json()

      if (data.success && data.data.products) {
        const prices: Record<number, number | null> = {}
        data.data.products.forEach((p: any) => {
          if (p.hasPricing && p.precioClientes) {
            prices[p.productId] = parseFloat(p.precioClientes)
          }
        })
        setCompanyPrices(prices)
      }
    } catch (error) {
      console.error('Error fetching company prices:', error)
    }
  }, [selectedCompany])

  useEffect(() => {
    fetchProducts()
    fetchCompanies()
  }, [fetchProducts, fetchCompanies])

  useEffect(() => {
    if (selectedCompany) {
      fetchCompanyPrices()
    }
  }, [selectedCompany, fetchCompanyPrices])

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.code.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  // Delete product
  const handleDeleteProduct = async (productId: number) => {
    if (!confirm('¿Seguro que deseas eliminar este producto?')) return

    try {
      const response = await fetch(`/api/products/${productId}`, { method: 'DELETE' })
      const data = await response.json()

      if (data.success) {
        showNotification('success', 'Exito', 'Producto eliminado')
        fetchProducts()
      } else {
        showNotification('error', 'Error', data.error || 'Error al eliminar')
      }
    } catch (error) {
      showNotification('error', 'Error', 'Error de conexion')
    }
  }

  // Save company prices
  const handleSaveCompanyPrices = async () => {
    if (!selectedCompany) return

    setSavingPrices(true)
    try {
      const productsToUpdate = Object.entries(companyPrices)
        .filter(([_, price]) => price !== null)
        .map(([productId, price]) => ({
          productId: parseInt(productId),
          precioClientes: price
        }))

      if (productsToUpdate.length === 0) {
        showNotification('warning', 'Aviso', 'No hay precios para guardar')
        setSavingPrices(false)
        return
      }

      const response = await fetch(`/api/companies/${selectedCompany}/products/pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: productsToUpdate })
      })

      const data = await response.json()

      if (data.success) {
        showNotification('success', 'Exito', 'Precios guardados correctamente')
      } else {
        showNotification('error', 'Error', data.error || 'Error al guardar precios')
      }
    } catch (error) {
      showNotification('error', 'Error', 'Error de conexion')
    } finally {
      setSavingPrices(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Catalogo de Productos
            </h1>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Gestiona los productos de LogiRapid y sus precios por empresa
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className={`flex gap-2 p-1 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
          <button
            onClick={() => setActiveTab('productos')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'productos'
                ? isDark ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 shadow'
                : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Package className="w-4 h-4" />
            Productos
          </button>
          <button
            onClick={() => setActiveTab('precios')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'precios'
                ? isDark ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 shadow'
                : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Precios por Empresa
          </button>
        </div>

        {/* Tab: Productos */}
        {activeTab === 'productos' && (
          <div className="space-y-4">
            {/* Search and filters */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                <input
                  type="text"
                  placeholder="Buscar productos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                    isDark
                      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:ring-2 focus:ring-blue-500`}
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={`px-4 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="all">Todas las categorias</option>
                {CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Nuevo Producto
              </button>
            </div>

            {/* Products table */}
            <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
              {loading ? (
                <div className="p-8 text-center">
                  <RefreshCw className={`w-8 h-8 mx-auto animate-spin ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                  <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Cargando...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-12 text-center">
                  <div className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center ${
                    isDark ? 'bg-blue-900/30' : 'bg-blue-100'
                  }`}>
                    <Package className={`w-10 h-10 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                  </div>
                  <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {products.length === 0 ? 'Catalogo Vacio' : 'Sin resultados'}
                  </h3>
                  <p className={`mb-6 max-w-md mx-auto ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {products.length === 0
                      ? 'No hay productos en el catalogo. Crea tu primer producto.'
                      : 'No se encontraron productos con los filtros seleccionados.'
                    }
                  </p>
                  {products.length === 0 && (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                    >
                      <Plus className="w-5 h-5 inline-block mr-2" />
                      Crear Primer Producto
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full">
                  <thead className={isDark ? 'bg-gray-900/50' : 'bg-gray-50'}>
                    <tr>
                      <th className={`px-4 py-3 text-left text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Codigo
                      </th>
                      <th className={`px-4 py-3 text-left text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Nombre
                      </th>
                      <th className={`px-4 py-3 text-left text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Categoria
                      </th>
                      <th className={`px-4 py-3 text-right text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Mi Costo
                      </th>
                      <th className={`px-4 py-3 text-left text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Proveedor
                      </th>
                      <th className={`px-4 py-3 text-center text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                    {filteredProducts.map((product) => (
                      <tr key={product.id} className={isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}>
                        <td className={`px-4 py-3 font-mono text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {product.code}
                        </td>
                        <td className={`px-4 py-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {product.name}
                        </td>
                        <td className={`px-4 py-3`}>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            product.category === 'paqueteria' ? 'bg-blue-100 text-blue-700' :
                            product.category === 'remesa' ? 'bg-green-100 text-green-700' :
                            product.category === 'recarga' ? 'bg-purple-100 text-purple-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {CATEGORIES.find(c => c.id === product.category)?.name || product.category}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          ${product.miCosto.toFixed(2)}
                        </td>
                        <td className={`px-4 py-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          {product.providerName || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setEditingProduct(product)}
                              className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
                              title="Editar"
                            >
                              <Edit2 className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product.id)}
                              className={`p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30`}
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tab: Precios por Empresa */}
        {activeTab === 'precios' && (
          <div className="space-y-4">
            {/* Company selector */}
            <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                <div className="flex-1">
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <Building2 className="w-4 h-4 inline-block mr-2" />
                    Seleccionar Empresa
                  </label>
                  <select
                    value={selectedCompany || ''}
                    onChange={(e) => {
                      setSelectedCompany(e.target.value ? parseInt(e.target.value) : null)
                      setCompanyPrices({})
                    }}
                    className={`w-full md:w-80 px-4 py-2 rounded-lg border ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="">-- Selecciona una empresa --</option>
                    {companies.map(company => (
                      <option key={company.id} value={company.id}>
                        {company.legalName}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedCompany && (
                  <button
                    onClick={handleSaveCompanyPrices}
                    disabled={savingPrices}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                  >
                    {savingPrices ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {savingPrices ? 'Guardando...' : 'Guardar Precios'}
                  </button>
                )}
              </div>
            </div>

            {/* Prices table */}
            {selectedCompany ? (
              <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
                {products.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                      No hay productos en el catalogo. Crea productos primero.
                    </p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className={isDark ? 'bg-gray-900/50' : 'bg-gray-50'}>
                      <tr>
                        <th className={`px-4 py-3 text-left text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Producto
                        </th>
                        <th className={`px-4 py-3 text-left text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Categoria
                        </th>
                        <th className={`px-4 py-3 text-right text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Mi Costo
                        </th>
                        <th className={`px-4 py-3 text-right text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Precio Venta para Empresa
                        </th>
                        <th className={`px-4 py-3 text-right text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Margen
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                      {products.map((product) => {
                        const customPrice = companyPrices[product.id]
                        const margin = customPrice ? customPrice - product.miCosto : null

                        return (
                          <tr key={product.id} className={isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}>
                            <td className={`px-4 py-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              <div className="font-medium">{product.name}</div>
                              <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{product.code}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                product.category === 'paqueteria' ? 'bg-blue-100 text-blue-700' :
                                product.category === 'remesa' ? 'bg-green-100 text-green-700' :
                                product.category === 'recarga' ? 'bg-purple-100 text-purple-700' :
                                'bg-orange-100 text-orange-700'
                              }`}>
                                {CATEGORIES.find(c => c.id === product.category)?.name || product.category}
                              </span>
                            </td>
                            <td className={`px-4 py-3 text-right ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              ${product.miCosto.toFixed(2)}
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={customPrice ?? ''}
                                placeholder="Sin precio"
                                onChange={(e) => {
                                  const value = e.target.value ? parseFloat(e.target.value) : null
                                  setCompanyPrices(prev => ({
                                    ...prev,
                                    [product.id]: value
                                  }))
                                }}
                                className={`w-32 px-3 py-1 rounded-lg border text-right ${
                                  isDark
                                    ? 'bg-gray-700 border-gray-600 text-white'
                                    : 'bg-white border-gray-300 text-gray-900'
                                } focus:ring-2 focus:ring-blue-500`}
                              />
                            </td>
                            <td className={`px-4 py-3 text-right font-medium ${
                              margin === null ? (isDark ? 'text-gray-500' : 'text-gray-400') :
                              margin >= 0 ? 'text-green-500' : 'text-red-500'
                            }`}>
                              {margin !== null ? (
                                `$${margin.toFixed(2)}`
                              ) : (
                                <span className={isDark ? 'text-gray-600' : 'text-gray-400'}>-</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            ) : (
              <div className={`p-12 rounded-xl text-center ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
                <Building2 className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                <h3 className={`text-lg font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Selecciona una empresa
                </h3>
                <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  Elige una empresa para configurar sus precios personalizados
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Product Modal */}
      <AnimatePresence>
        {(showCreateModal || editingProduct) && (
          <ProductModal
            isDark={isDark}
            product={editingProduct}
            onClose={() => {
              setShowCreateModal(false)
              setEditingProduct(null)
            }}
            onSave={async (productData) => {
              try {
                const isEdit = !!editingProduct
                const url = isEdit ? `/api/products/${editingProduct.id}` : '/api/products'
                const method = isEdit ? 'PUT' : 'POST'

                const response = await fetch(url, {
                  method,
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    code: productData.code,
                    name: productData.name,
                    description: productData.description,
                    service_category: productData.category,
                    product_type: 'producto',
                    mi_costo: productData.miCosto,
                    provider_company_name: productData.providerName
                  })
                })

                const data = await response.json()

                if (data.success) {
                  showNotification('success', 'Exito', isEdit ? 'Producto actualizado' : 'Producto creado')
                  setShowCreateModal(false)
                  setEditingProduct(null)
                  fetchProducts()
                } else {
                  throw new Error(data.error || 'Error al guardar')
                }
              } catch (error) {
                showNotification('error', 'Error', error instanceof Error ? error.message : 'Error de conexion')
              }
            }}
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  )
}

// Product Modal Component
interface ProductModalProps {
  isDark: boolean
  product: Product | null
  onClose: () => void
  onSave: (data: {
    code: string
    name: string
    description: string
    category: string
    miCosto: number
    providerName: string
  }) => Promise<void>
}

function ProductModal({ isDark, product, onClose, onSave }: ProductModalProps) {
  const [formData, setFormData] = useState({
    code: product?.code || '',
    name: product?.name || '',
    description: product?.description || '',
    category: product?.category || 'paqueteria',
    miCosto: product?.miCosto || 0,
    providerName: product?.providerName || ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.code || !formData.name) {
      setError('Codigo y nombre son requeridos')
      return
    }

    if (formData.miCosto < 0) {
      setError('El costo no puede ser negativo')
      return
    }

    try {
      setSaving(true)
      await onSave(formData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className={`w-full max-w-lg rounded-xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
      >
        <div className={`p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {product ? 'Editar Producto' : 'Nuevo Producto'}
            </h2>
            <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-100 text-red-700 text-sm">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Codigo *
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className={`w-full px-3 py-2 rounded-lg border ${
                  isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-blue-500`}
                placeholder="CAJA-12X12"
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Categoria *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg border ${
                  isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-blue-500`}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Nombre *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full px-3 py-2 rounded-lg border ${
                isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-blue-500`}
              placeholder="Caja 12x12x12"
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Proveedor
            </label>
            <input
              type="text"
              value={formData.providerName}
              onChange={(e) => setFormData({ ...formData, providerName: e.target.value })}
              className={`w-full px-3 py-2 rounded-lg border ${
                isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-blue-500`}
              placeholder="Nombre del proveedor"
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Descripcion
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className={`w-full px-3 py-2 rounded-lg border ${
                isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-blue-500`}
              placeholder="Descripcion del producto..."
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Mi Costo ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.miCosto}
              onChange={(e) => setFormData({ ...formData, miCosto: parseFloat(e.target.value) || 0 })}
              className={`w-full px-3 py-2 rounded-lg border ${
                isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-blue-500`}
              placeholder="0.00"
            />
            <p className={`mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              El precio de venta se configura por empresa en la pestaña "Precios por Empresa"
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={`px-4 py-2 rounded-lg ${
                isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              } disabled:opacity-50`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
              {saving ? 'Guardando...' : product ? 'Guardar Cambios' : 'Crear Producto'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
