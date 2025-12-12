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
  Save,
  Filter,
  MoreVertical,
  ChevronDown,
  Layers,
  TrendingUp,
  CheckCircle,
  Tag,
  BarChart3
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

  // Stats calculation
  const totalProducts = products.length
  const activeProducts = products.filter(p => p.isActive).length
  const avgCost = products.length > 0
    ? products.reduce((acc, p) => acc + p.miCosto, 0) / products.length
    : 0
  const totalCost = products.reduce((acc, p) => acc + p.miCosto, 0)
  const categoryCounts = CATEGORIES.map(cat => ({
    ...cat,
    count: products.filter(p => p.category === cat.id).length
  }))

  // Stats cards data
  const statsCards = [
    {
      label: 'Total Productos',
      value: totalProducts.toString(),
      icon: Package,
      color: 'blue'
    },
    {
      label: 'Activos',
      value: activeProducts.toString(),
      icon: CheckCircle,
      color: 'emerald'
    },
    {
      label: 'Categorias',
      value: categoryCounts.filter(c => c.count > 0).length.toString(),
      icon: Tag,
      color: 'purple'
    },
    {
      label: 'Costo Promedio',
      value: `$${avgCost.toFixed(2)}`,
      icon: BarChart3,
      color: 'amber'
    }
  ]

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; icon: string }> = {
      blue: {
        bg: isDark ? 'bg-blue-500/20' : 'bg-blue-100',
        icon: 'text-blue-500'
      },
      emerald: {
        bg: isDark ? 'bg-emerald-500/20' : 'bg-emerald-100',
        icon: 'text-emerald-500'
      },
      purple: {
        bg: isDark ? 'bg-purple-500/20' : 'bg-purple-100',
        icon: 'text-purple-500'
      },
      amber: {
        bg: isDark ? 'bg-amber-500/20' : 'bg-amber-100',
        icon: 'text-amber-500'
      }
    }
    return colors[color] || colors.blue
  }

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        {/* Stats Cards */}
        <div className="px-6 pt-4 pb-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statsCards.map((stat, idx) => {
              const colorClasses = getColorClasses(stat.color)
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`rounded-2xl border p-4 ${
                    isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {stat.label}
                      </p>
                      <p className={`text-xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {stat.value}
                      </p>
                    </div>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses.bg}`}>
                      <stat.icon className={`w-5 h-5 ${colorClasses.icon}`} />
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Sticky Header with Tabs and Actions */}
        <div className={`sticky top-0 z-10 ${isDark ? 'bg-gray-900/95 backdrop-blur-sm' : 'bg-gray-50/95 backdrop-blur-sm'}`}>
          <div className="px-6 py-3">
            <div className="flex items-center justify-between gap-4">
              {/* Left: Tabs */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('productos')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                    activeTab === 'productos'
                      ? isDark
                        ? 'bg-white/10 text-white'
                        : 'bg-white text-gray-900 shadow-sm'
                      : isDark
                        ? 'text-gray-400 hover:text-white hover:bg-white/5'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  Productos
                  {totalProducts > 0 && (
                    <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
                      activeTab === 'productos'
                        ? isDark ? 'bg-white/20' : 'bg-gray-100'
                        : isDark ? 'bg-white/10' : 'bg-gray-200'
                    }`}>
                      {totalProducts}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('precios')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                    activeTab === 'precios'
                      ? isDark
                        ? 'bg-white/10 text-white'
                        : 'bg-white text-gray-900 shadow-sm'
                      : isDark
                        ? 'text-gray-400 hover:text-white hover:bg-white/5'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  Precios
                </button>
              </div>

              {/* Right: Search and Actions */}
              <div className="flex items-center gap-3">
                {activeTab === 'productos' && (
                  <>
                    <div className="relative">
                      <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                      <input
                        type="text"
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`w-48 pl-9 pr-3 py-2 text-sm rounded-lg border transition-all focus:w-64 ${
                          isDark
                            ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-gray-600'
                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-300'
                        } focus:outline-none focus:ring-1 focus:ring-blue-500/30`}
                      />
                    </div>

                    <div className="relative">
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className={`appearance-none pl-3 pr-8 py-2 text-sm rounded-lg border cursor-pointer ${
                          isDark
                            ? 'bg-gray-800 border-gray-700 text-white'
                            : 'bg-white border-gray-200 text-gray-900'
                        } focus:outline-none focus:ring-1 focus:ring-blue-500/30`}
                      >
                        <option value="all">Todas</option>
                        {CATEGORIES.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                      <ChevronDown className={`absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    </div>

                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Nuevo
                    </button>
                  </>
                )}

                {activeTab === 'precios' && selectedCompany && (
                  <button
                    onClick={handleSaveCompanyPrices}
                    disabled={savingPrices}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {savingPrices ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          {/* Tab: Productos */}
          {activeTab === 'productos' && (
            <div className="px-6 pb-6">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <RefreshCw className={`w-8 h-8 mx-auto animate-spin ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                    <p className={`mt-3 text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Cargando productos...</p>
                  </div>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center max-w-sm">
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                      isDark ? 'bg-gray-800' : 'bg-gray-100'
                    }`}>
                      <Package className={`w-8 h-8 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                    </div>
                    <h3 className={`text-lg font-medium mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {products.length === 0 ? 'Sin productos' : 'Sin resultados'}
                    </h3>
                    <p className={`text-sm mb-4 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      {products.length === 0
                        ? 'Comienza agregando tu primer producto al catalogo'
                        : 'Intenta con otros terminos de busqueda'
                      }
                    </p>
                    {products.length === 0 && (
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Crear producto
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className={`rounded-xl overflow-hidden border ${isDark ? 'bg-gray-800/50 border-gray-800' : 'bg-white border-gray-200'}`}>
                  <table className="w-full">
                    <thead>
                      <tr className={isDark ? 'border-b border-gray-700' : 'border-b border-gray-100'}>
                        <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          Producto
                        </th>
                        <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          Categoria
                        </th>
                        <th className={`px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          Costo
                        </th>
                        <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          Proveedor
                        </th>
                        <th className={`px-4 py-3 w-20`}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product, idx) => (
                        <motion.tr
                          key={product.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.02 }}
                          className={`group ${isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'} ${
                            idx !== filteredProducts.length - 1 ? (isDark ? 'border-b border-gray-800' : 'border-b border-gray-50') : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                                product.category === 'paqueteria' ? (isDark ? 'bg-blue-500/20' : 'bg-blue-50') :
                                product.category === 'remesa' ? (isDark ? 'bg-emerald-500/20' : 'bg-emerald-50') :
                                product.category === 'recarga' ? (isDark ? 'bg-purple-500/20' : 'bg-purple-50') :
                                (isDark ? 'bg-orange-500/20' : 'bg-orange-50')
                              }`}>
                                <Package className={`w-4 h-4 ${
                                  product.category === 'paqueteria' ? 'text-blue-500' :
                                  product.category === 'remesa' ? 'text-emerald-500' :
                                  product.category === 'recarga' ? 'text-purple-500' :
                                  'text-orange-500'
                                }`} />
                              </div>
                              <div>
                                <div className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {product.name}
                                </div>
                                <div className={`text-xs font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {product.code}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              product.category === 'paqueteria'
                                ? isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'
                              : product.category === 'remesa'
                                ? isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                              : product.category === 'recarga'
                                ? isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-50 text-purple-600'
                              : isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-50 text-orange-600'
                            }`}>
                              {CATEGORIES.find(c => c.id === product.category)?.name || product.category}
                            </span>
                          </td>
                          <td className={`px-4 py-3 text-right tabular-nums text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                            ${product.miCosto.toFixed(2)}
                          </td>
                          <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {product.providerName || <span className={isDark ? 'text-gray-600' : 'text-gray-300'}>-</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setEditingProduct(product)}
                                className={`p-1.5 rounded-md ${isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-100'}`}
                                title="Editar"
                              >
                                <Edit2 className={`w-3.5 h-3.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(product.id)}
                                className={`p-1.5 rounded-md ${isDark ? 'hover:bg-red-500/20' : 'hover:bg-red-50'}`}
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab: Precios por Empresa */}
          {activeTab === 'precios' && (
            <div className="px-6 pb-6">
              {/* Company selector - Inline style */}
              <div className={`mb-4 flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-white'} border ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
                <Building2 className={`w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                <select
                  value={selectedCompany || ''}
                  onChange={(e) => {
                    setSelectedCompany(e.target.value ? parseInt(e.target.value) : null)
                    setCompanyPrices({})
                  }}
                  className={`flex-1 bg-transparent text-sm font-medium focus:outline-none cursor-pointer ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  <option value="" className={isDark ? 'bg-gray-800' : 'bg-white'}>Selecciona una empresa...</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id} className={isDark ? 'bg-gray-800' : 'bg-white'}>
                      {company.legalName}
                    </option>
                  ))}
                </select>
                <ChevronDown className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              </div>

              {/* Prices table */}
              {selectedCompany ? (
                products.length === 0 ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="text-center">
                      <Package className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                      <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                        No hay productos. Crea productos primero.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className={`rounded-xl overflow-hidden border ${isDark ? 'bg-gray-800/50 border-gray-800' : 'bg-white border-gray-200'}`}>
                    <table className="w-full">
                      <thead>
                        <tr className={isDark ? 'border-b border-gray-700' : 'border-b border-gray-100'}>
                          <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Producto
                          </th>
                          <th className={`px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Costo
                          </th>
                          <th className={`px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Precio Venta
                          </th>
                          <th className={`px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Margen
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((product, idx) => {
                          const customPrice = companyPrices[product.id]
                          const margin = customPrice ? customPrice - product.miCosto : null
                          const marginPercent = customPrice && product.miCosto > 0
                            ? ((customPrice - product.miCosto) / product.miCosto * 100)
                            : null

                          return (
                            <tr
                              key={product.id}
                              className={`${isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'} ${
                                idx !== products.length - 1 ? (isDark ? 'border-b border-gray-800' : 'border-b border-gray-50') : ''
                              }`}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                    product.category === 'paqueteria' ? (isDark ? 'bg-blue-500/20' : 'bg-blue-50') :
                                    product.category === 'remesa' ? (isDark ? 'bg-emerald-500/20' : 'bg-emerald-50') :
                                    product.category === 'recarga' ? (isDark ? 'bg-purple-500/20' : 'bg-purple-50') :
                                    (isDark ? 'bg-orange-500/20' : 'bg-orange-50')
                                  }`}>
                                    <Package className={`w-4 h-4 ${
                                      product.category === 'paqueteria' ? 'text-blue-500' :
                                      product.category === 'remesa' ? 'text-emerald-500' :
                                      product.category === 'recarga' ? 'text-purple-500' :
                                      'text-orange-500'
                                    }`} />
                                  </div>
                                  <div>
                                    <div className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                      {product.name}
                                    </div>
                                    <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                      {product.code}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className={`px-4 py-3 text-right tabular-nums text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                ${product.miCosto.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex items-center">
                                  <span className={`mr-1 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={customPrice ?? ''}
                                    placeholder="0.00"
                                    onChange={(e) => {
                                      const value = e.target.value ? parseFloat(e.target.value) : null
                                      setCompanyPrices(prev => ({
                                        ...prev,
                                        [product.id]: value
                                      }))
                                    }}
                                    className={`w-24 px-2 py-1.5 text-sm text-right rounded-lg border transition-colors ${
                                      isDark
                                        ? 'bg-gray-700/50 border-gray-600 text-white placeholder-gray-600 focus:border-blue-500'
                                        : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-300 focus:border-blue-400'
                                    } focus:outline-none focus:ring-1 focus:ring-blue-500/30`}
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {margin !== null ? (
                                  <div className="flex flex-col items-end">
                                    <span className={`text-sm font-medium tabular-nums ${
                                      margin >= 0 ? 'text-emerald-500' : 'text-red-500'
                                    }`}>
                                      {margin >= 0 ? '+' : ''}${margin.toFixed(2)}
                                    </span>
                                    {marginPercent !== null && (
                                      <span className={`text-xs ${
                                        marginPercent >= 0 ? (isDark ? 'text-emerald-400/60' : 'text-emerald-600/60') : (isDark ? 'text-red-400/60' : 'text-red-600/60')
                                      }`}>
                                        {marginPercent >= 0 ? '+' : ''}{marginPercent.toFixed(0)}%
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className={`text-sm ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>-</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center max-w-xs">
                    <div className={`w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                      isDark ? 'bg-gray-800' : 'bg-gray-100'
                    }`}>
                      <Building2 className={`w-7 h-7 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                    </div>
                    <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      Selecciona una empresa para configurar precios
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
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

  const inputClasses = `w-full px-3 py-2 text-sm rounded-lg border transition-colors ${
    isDark
      ? 'bg-gray-700/50 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500'
      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400'
  } focus:outline-none focus:ring-1 focus:ring-blue-500/30`

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: 'spring', duration: 0.3 }}
        className={`w-full max-w-md rounded-2xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {product ? 'Editar producto' : 'Nuevo producto'}
          </h2>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={`px-5 pb-5 space-y-4 border-t ${isDark ? 'border-gray-700/50' : 'border-gray-100'} pt-4`}>
            {error && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
                {error}
              </div>
            )}

            {/* Codigo y Categoria en fila */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Codigo
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className={inputClasses}
                  placeholder="CAJA-12X12"
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Categoria
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className={inputClasses}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Nombre */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Nombre
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={inputClasses}
                placeholder="Caja 12x12x12"
              />
            </div>

            {/* Proveedor y Costo en fila */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Proveedor
                </label>
                <input
                  type="text"
                  value={formData.providerName}
                  onChange={(e) => setFormData({ ...formData, providerName: e.target.value })}
                  className={inputClasses}
                  placeholder="Opcional"
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Costo ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.miCosto}
                  onChange={(e) => setFormData({ ...formData, miCosto: parseFloat(e.target.value) || 0 })}
                  className={inputClasses}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Descripcion */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Descripcion
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className={inputClasses}
                placeholder="Opcional..."
              />
            </div>
          </div>

          {/* Footer */}
          <div className={`flex items-center justify-end gap-2 px-5 py-3 border-t ${isDark ? 'border-gray-700/50 bg-gray-800/50' : 'border-gray-100 bg-gray-50/50'} rounded-b-2xl`}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-600'
              } disabled:opacity-50`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {saving ? 'Guardando...' : product ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
