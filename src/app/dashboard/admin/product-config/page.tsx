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
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Layers,
  TrendingUp,
  CheckCircle,
  Tag,
  BarChart3,
  Box,
  Banknote,
  Smartphone,
  ShoppingBag,
  Eye,
  Copy,
  ArrowUpRight,
  Sparkles,
  Grid3X3,
  List,
  SlidersHorizontal
} from 'lucide-react'
import { RechargeProductManager } from '@/components/admin/RechargeProductManager'

// Interfaces
interface Product {
  id: number
  code: string
  name: string
  description: string | null
  category: string
  miCosto: number
  miCostoFijo: number
  precioMayorista: number
  precioMayoristaFijo: number
  providerCompanyId: number | null
  providerName: string | null
  isActive: boolean
  pricingModel?: string
  currency?: string | null
}

// Available currencies for remesa products
const CURRENCIES = [
  { code: 'USD', name: 'Dolar Estadounidense', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'MLC', name: 'Moneda Libremente Convertible', symbol: 'MLC' },
  { code: 'CUP', name: 'Peso Cubano', symbol: 'CUP' },
  { code: 'CAD', name: 'Dolar Canadiense', symbol: 'C$' },
  { code: 'GBP', name: 'Libra Esterlina', symbol: '£' },
  { code: 'MXN', name: 'Peso Mexicano', symbol: 'MX$' },
  { code: 'ZELLE', name: 'Zelle', symbol: 'Z$' }
]

interface ProviderCompany {
  id: number
  legalName: string
}

interface Company {
  id: number
  legalName: string
  status: string
}

interface RechargeProductForPricing {
  id: number
  name: string
  countryCode: string
  countryName: string
  baseCost: number
  pricing: {
    marginType: 'percentage' | 'fixed'
    marginValue: number
    sellingPrice: number
  } | null
}

// Country flag mapping for recharge products
const getCountryFlag = (countryCode: string): string => {
  const flags: Record<string, string> = {
    CU: '🇨🇺', MX: '🇲🇽', DO: '🇩🇴', HT: '🇭🇹', US: '🇺🇸',
    ES: '🇪🇸', CO: '🇨🇴', VE: '🇻🇪', PE: '🇵🇪', AR: '🇦🇷',
    CL: '🇨🇱', BR: '🇧🇷',
  }
  return flags[countryCode] || '🌍'
}

const CATEGORIES = [
  { id: 'paqueteria', name: 'Paqueteria', icon: Box, color: 'blue', gradient: 'from-blue-500 to-blue-600' },
  { id: 'remesa', name: 'Remesa', icon: Banknote, color: 'emerald', gradient: 'from-emerald-500 to-emerald-600' },
  { id: 'recarga', name: 'Recarga', icon: Smartphone, color: 'purple', gradient: 'from-purple-500 to-purple-600' },
  { id: 'mercado', name: 'Mercado', icon: ShoppingBag, color: 'orange', gradient: 'from-orange-500 to-orange-600' }
]

const getCategoryConfig = (categoryId: string) => {
  return CATEGORIES.find(c => c.id === categoryId) || CATEGORIES[0]
}

export default function ProductConfigPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const isDark = theme === 'dark'

  // States
  const [products, setProducts] = useState<Product[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [providerCompanies, setProviderCompanies] = useState<ProviderCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'productos' | 'precios'>('productos')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null)

  // Precios por empresa
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null)
  const [companyPrices, setCompanyPrices] = useState<Record<number, number | null>>({})
  const [rechargeCompanyMargins, setRechargeCompanyMargins] = useState<Record<number, { marginType: 'percentage' | 'fixed', marginValue: number } | null>>({})
  const [savingPrices, setSavingPrices] = useState(false)

  // Recharge products count and refresh key
  const [rechargeProductsCount, setRechargeProductsCount] = useState(0)
  const [rechargeRefreshKey, setRechargeRefreshKey] = useState(0)

  // Recharge products for pricing tab
  const [rechargeProductsForPricing, setRechargeProductsForPricing] = useState<RechargeProductForPricing[]>([])

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
          miCostoFijo: parseFloat(p.mi_costo_fijo) || 0,
          precioMayorista: parseFloat(p.precio_mayorista) || 0,
          precioMayoristaFijo: parseFloat(p.precio_mayorista_fijo) || 0,
          providerCompanyId: p.provider_company_id || null,
          providerName: p.provider_company_name || null,
          isActive: p.is_active !== false,
          pricingModel: p.pricing_model || 'fixed',
          currency: p.currency || null
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

  // Fetch companies (for pricing tab)
  const fetchCompanies = useCallback(async () => {
    try {
      const response = await fetch('/api/companies')
      const data = await response.json()
      if (data.success) {
        const filtered = data.data.filter((c: any) => c.status === 'active' && c.id !== 1)
        setCompanies(filtered.map((c: any) => ({
          id: c.id,
          legalName: c.legalname || c.legalName,
          status: c.status
        })))
        // Also set provider companies (all active companies can be providers)
        setProviderCompanies(data.data
          .filter((c: any) => c.status === 'active')
          .map((c: any) => ({
            id: c.id,
            legalName: c.legalname || c.legalName
          })))
      }
    } catch (error) {
      console.error('Error fetching companies:', error)
    }
  }, [])

  // Fetch company prices
  const fetchCompanyPrices = useCallback(async () => {
    if (!selectedCompany) return

    try {
      const response = await fetch(`/api/companies/${selectedCompany}/products/pricing`)
      const data = await response.json()

      if (data.success && data.data.products) {
        const prices: Record<number, number | null> = {}
        data.data.products.forEach((p: any) => {
          // Leer el mi_costo específico de la empresa (precio especial asignado por LogiRapid)
          // Solo si difiere del precio global del catálogo
          if (p.hasPricing && p.miCosto && p.miCosto !== p.catalogPrecioMayorista) {
            prices[p.productId] = parseFloat(p.miCosto)
          }
        })
        setCompanyPrices(prices)
      }
    } catch (error) {
      console.error('Error fetching company prices:', error)
    }
  }, [selectedCompany])

  // Fetch recharge products count
  const fetchRechargeCount = useCallback(async () => {
    try {
      const response = await fetch('/api/recharges/products')
      const data = await response.json()
      if (data.success) {
        // Count only products with pricing configured and enabled
        const configuredCount = data.data.products.filter(
          (p: any) => p.pricing !== null && p.pricing.isEnabled
        ).length
        setRechargeProductsCount(configuredCount)
      }
    } catch (error) {
      console.error('Error fetching recharge count:', error)
    }
  }, [])

  // Fetch recharge products for pricing tab
  const fetchRechargeProductsForPricing = useCallback(async () => {
    try {
      const response = await fetch('/api/recharges/products')
      const data = await response.json()
      if (data.success) {
        // Get only products with pricing configured and enabled
        const configuredProducts = data.data.products
          .filter((p: any) => p.pricing !== null && p.pricing.isEnabled)
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            countryCode: p.countryCode,
            countryName: p.countryName,
            baseCost: p.baseCost,
            pricing: p.pricing ? {
              marginType: p.pricing.marginType,
              marginValue: p.pricing.marginValue,
              sellingPrice: p.pricing.sellingPrice
            } : null
          }))
        setRechargeProductsForPricing(configuredProducts)
      }
    } catch (error) {
      console.error('Error fetching recharge products for pricing:', error)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
    fetchCompanies()
    fetchRechargeCount()
  }, [fetchProducts, fetchCompanies, fetchRechargeCount])

  useEffect(() => {
    if (selectedCompany) {
      fetchCompanyPrices()
      fetchRechargeProductsForPricing()
    }
  }, [selectedCompany, fetchCompanyPrices, fetchRechargeProductsForPricing])

  // Refresh recharge count when category changes to recarga
  useEffect(() => {
    if (categoryFilter === 'recarga') {
      fetchRechargeCount()
    }
  }, [categoryFilter, fetchRechargeCount])

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

  // Copy code to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showNotification('success', 'Copiado', 'Codigo copiado al portapapeles')
  }

  // Save company prices
  const handleSaveCompanyPrices = async () => {
    if (!selectedCompany) return

    setSavingPrices(true)
    try {
      // Validar que ningún precio sea menor al costo de LogiRapid
      const invalidPrices: string[] = []
      const productsToUpdate = Object.entries(companyPrices)
        .filter(([_, price]) => price !== null)
        .map(([productId, price]) => {
          const product = products.find(p => p.id === parseInt(productId))
          if (product && price !== null && price < product.miCosto) {
            invalidPrices.push(`${product.name}: $${price} < Costo $${product.miCosto}`)
          }
          return {
            productId: parseInt(productId),
            miCostoEspecial: price  // Precio especial que LogiRapid asigna a esta empresa
          }
        })

      if (invalidPrices.length > 0) {
        showNotification('error', 'Precios invalidos', `El precio no puede ser menor al costo: ${invalidPrices.join(', ')}`)
        setSavingPrices(false)
        return
      }

      // Check if there are products or recharge margins to save
      const rechargeToUpdate = Object.entries(rechargeCompanyMargins)
        .filter(([_, margin]) => margin !== null)
        .map(([productId, margin]) => ({
          productId: parseInt(productId),
          marginType: margin!.marginType,
          marginValue: margin!.marginValue
        }))

      if (productsToUpdate.length === 0 && rechargeToUpdate.length === 0) {
        showNotification('warning', 'Aviso', 'No hay precios para guardar')
        setSavingPrices(false)
        return
      }

      // Save regular product prices
      if (productsToUpdate.length > 0) {
        const response = await fetch(`/api/companies/${selectedCompany}/products/pricing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products: productsToUpdate })
        })
        const data = await response.json()
        if (!data.success) {
          showNotification('error', 'Error', data.error || 'Error al guardar precios')
          setSavingPrices(false)
          return
        }
      }

      // Save recharge product prices
      for (const recharge of rechargeToUpdate) {
        const response = await fetch(`/api/recharges/products/${recharge.productId}/pricing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: selectedCompany,
            marginType: recharge.marginType,
            marginValue: recharge.marginValue,
            isEnabled: true
          })
        })
        const data = await response.json()
        if (!data.success) {
          console.error('Error saving recharge pricing:', data.error)
        }
      }

      showNotification('success', 'Exito', 'Precios guardados correctamente')
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
    count: cat.id === 'recarga'
      ? rechargeProductsCount
      : products.filter(p => p.category === cat.id).length
  }))

  return (
    <DashboardLayout>
      <div className="min-h-full">
        {/* Stats Cards */}
        <div className="pt-2 pb-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Products */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative overflow-hidden rounded-2xl p-5 ${
                  isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Total Productos
                    </p>
                    <p className={`text-3xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {totalProducts}
                    </p>
                    <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      En catalogo
                    </p>
                  </div>
                  <div className={`p-3 rounded-xl ${isDark ? 'bg-blue-500/20' : 'bg-blue-50'}`}>
                    <Layers className="w-6 h-6 text-blue-500" />
                  </div>
                </div>
                <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-400`} />
              </motion.div>

              {/* Active Products */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={`relative overflow-hidden rounded-2xl p-5 ${
                  isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Activos
                    </p>
                    <p className={`text-3xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {activeProducts}
                    </p>
                    <p className={`text-xs mt-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      <CheckCircle className="w-3 h-3 inline mr-1" />
                      {totalProducts > 0 ? Math.round((activeProducts / totalProducts) * 100) : 0}% del total
                    </p>
                  </div>
                  <div className={`p-3 rounded-xl ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-50'}`}>
                    <CheckCircle className="w-6 h-6 text-emerald-500" />
                  </div>
                </div>
                <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-400`} />
              </motion.div>

              {/* Categories */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={`relative overflow-hidden rounded-2xl p-5 ${
                  isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Categorias
                    </p>
                    <p className={`text-3xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {categoryCounts.filter(c => c.count > 0).length}
                    </p>
                    <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      de {CATEGORIES.length} disponibles
                    </p>
                  </div>
                  <div className={`p-3 rounded-xl ${isDark ? 'bg-purple-500/20' : 'bg-purple-50'}`}>
                    <Tag className="w-6 h-6 text-purple-500" />
                  </div>
                </div>
                <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-purple-400`} />
              </motion.div>

              {/* Average Cost */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={`relative overflow-hidden rounded-2xl p-5 ${
                  isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Costo Promedio
                    </p>
                    <p className={`text-3xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      ${avgCost.toFixed(2)}
                    </p>
                    <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Total: ${totalCost.toFixed(2)}
                    </p>
                  </div>
                  <div className={`p-3 rounded-xl ${isDark ? 'bg-amber-500/20' : 'bg-amber-50'}`}>
                    <DollarSign className="w-6 h-6 text-amber-500" />
                  </div>
                </div>
                <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-amber-400`} />
              </motion.div>
            </div>
        </div>

        {/* Tabs Navigation */}
        <div className={`py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Tabs */}
              <div className={`flex p-1 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <button
                  onClick={() => setActiveTab('productos')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    activeTab === 'productos'
                      ? isDark
                        ? 'bg-gray-700 text-white shadow-lg'
                        : 'bg-white text-gray-900 shadow-md'
                      : isDark
                        ? 'text-gray-400 hover:text-white'
                        : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  Productos
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    activeTab === 'productos'
                      ? isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                      : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {totalProducts}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('precios')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    activeTab === 'precios'
                      ? isDark
                        ? 'bg-gray-700 text-white shadow-lg'
                        : 'bg-white text-gray-900 shadow-md'
                      : isDark
                        ? 'text-gray-400 hover:text-white'
                        : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  Precios por Empresa
                </button>
              </div>
            </div>

            {/* Right side controls */}
            {activeTab === 'productos' && (
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                  <input
                    type="text"
                    placeholder="Buscar productos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-64 pl-10 pr-4 py-2 rounded-xl text-sm transition-all ${
                      isDark
                        ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500'
                        : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400'
                    } border focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                  />
                </div>

                {/* Category Filter */}
                <div className="relative">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className={`appearance-none pl-4 pr-10 py-2 rounded-xl text-sm cursor-pointer ${
                      isDark
                        ? 'bg-gray-800 border-gray-700 text-white'
                        : 'bg-gray-50 border-gray-200 text-gray-900'
                    } border focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                  >
                    <option value="all">Todas las categorias</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                </div>

                {/* View Toggle */}
                <div className={`flex p-1 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-md transition-colors ${
                      viewMode === 'list'
                        ? isDark ? 'bg-gray-700 text-white' : 'bg-white text-gray-900 shadow-sm'
                        : isDark ? 'text-gray-500' : 'text-gray-400'
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-md transition-colors ${
                      viewMode === 'grid'
                        ? isDark ? 'bg-gray-700 text-white' : 'bg-white text-gray-900 shadow-sm'
                        : isDark ? 'text-gray-500' : 'text-gray-400'
                    }`}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Content */}
        <div className="pt-6">
          {/* Products Tab */}
          {activeTab === 'productos' && (
            <>
              {/* Category Pills + New Product Button */}
              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  <button
                    onClick={() => setCategoryFilter('all')}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                      categoryFilter === 'all'
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                        : isDark
                          ? 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                          : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200'
                    }`}
                  >
                    Todos ({totalProducts})
                  </button>
                  {CATEGORIES.map(cat => {
                    const count = categoryCounts.find(c => c.id === cat.id)?.count || 0
                    const Icon = cat.icon
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setCategoryFilter(cat.id)}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                          categoryFilter === cat.id
                            ? `bg-gradient-to-r ${cat.gradient} text-white shadow-lg`
                            : isDark
                              ? 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                              : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {cat.name} ({count})
                      </button>
                    )
                  })}
                </div>
                {categoryFilter !== 'recarga' && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 whitespace-nowrap"
                  >
                    <Plus className="w-5 h-5" />
                    Nuevo Producto
                  </button>
                )}
              </div>

              {/* Show RechargeProductManager when 'recarga' category is selected */}
              {categoryFilter === 'recarga' ? (
                <RechargeProductManager
                  key={rechargeRefreshKey}
                  onOpenModal={() => setShowCreateModal(true)}
                  onProductsChange={() => {
                    fetchRechargeCount()
                    setRechargeRefreshKey(prev => prev + 1)
                  }}
                />
              ) : loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                      <RefreshCw className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                    </div>
                    <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>Cargando productos...</p>
                  </div>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center max-w-md">
                    <div className={`w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center ${
                      isDark ? 'bg-gradient-to-br from-gray-800 to-gray-700' : 'bg-gradient-to-br from-gray-100 to-gray-50'
                    }`}>
                      <Package className={`w-10 h-10 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                    </div>
                    <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {products.length === 0 ? 'Sin productos' : 'Sin resultados'}
                    </h3>
                    <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {products.length === 0
                        ? 'Comienza agregando tu primer producto al catalogo para empezar a gestionar tu inventario'
                        : 'No se encontraron productos que coincidan con tu busqueda'
                      }
                    </p>
                    {products.length === 0 && (
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium rounded-xl inline-flex items-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
                      >
                        <Plus className="w-5 h-5" />
                        Crear primer producto
                      </button>
                    )}
                  </div>
                </div>
              ) : viewMode === 'grid' ? (
                /* Grid View */
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredProducts.map((product, idx) => {
                      const catConfig = getCategoryConfig(product.category)
                      const Icon = catConfig.icon
                      return (
                        <motion.div
                          key={product.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.03 }}
                          className={`group relative rounded-2xl p-5 transition-all hover:shadow-xl ${
                            isDark
                              ? 'bg-gray-800 border border-gray-700 hover:border-gray-600'
                              : 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-gray-200/50'
                          }`}
                        >
                          {/* Category Badge */}
                          <div className={`absolute top-4 right-4 px-2.5 py-1 rounded-lg text-xs font-medium bg-gradient-to-r ${catConfig.gradient} text-white`}>
                            {catConfig.name}
                          </div>

                          {/* Icon */}
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-br ${catConfig.gradient}`}>
                            <Icon className="w-7 h-7 text-white" />
                          </div>

                          {/* Product Info */}
                          <h3 className={`font-semibold text-lg mb-1 pr-16 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {product.name}
                          </h3>
                          <p className={`text-sm font-mono mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {product.code}
                          </p>

                          {product.description && (
                            <p className={`text-sm mb-4 line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {product.description}
                            </p>
                          )}

                          {/* Prices */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Mi Costo:</span>
                              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {product.pricingModel === 'percentage'
                                  ? `${product.miCosto}%${product.miCostoFijo > 0 ? ` + $${product.miCostoFijo}` : ''}`
                                  : `$${product.miCosto.toFixed(2)}`}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className={`text-xs ${isDark ? 'text-emerald-500' : 'text-emerald-600'}`}>Venta:</span>
                              <span className={`text-lg font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                {product.pricingModel === 'percentage'
                                  ? `${product.precioMayorista}%${product.precioMayoristaFijo > 0 ? ` + $${product.precioMayoristaFijo}` : ''}`
                                  : `$${product.precioMayorista.toFixed(2)}`}
                              </span>
                            </div>
                            {product.currency && (
                              <div className="flex items-center justify-between">
                                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Moneda:</span>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                                  {product.currency}
                                </span>
                              </div>
                            )}
                          </div>
                          <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {product.providerName || 'Sin proveedor'}
                          </p>

                          {/* Actions */}
                          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-dashed opacity-0 group-hover:opacity-100 transition-opacity" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
                            <button
                              onClick={() => setEditingProduct(product)}
                              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                                isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                              }`}
                            >
                              <Edit2 className="w-4 h-4 inline mr-1" />
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product.id)}
                              className={`p-2 rounded-lg transition-colors ${
                                isDark ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-50 text-red-500'
                              }`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>

                  {/* Show Recharge Products in "All" view - Grid */}
                  {categoryFilter === 'all' && rechargeProductsCount > 0 && (
                    <div className="mt-6">
                      <RechargeProductManager
                        key={rechargeRefreshKey}
                        onOpenModal={() => setShowCreateModal(true)}
                        onProductsChange={() => {
                          fetchRechargeCount()
                          setRechargeRefreshKey(prev => prev + 1)
                        }}
                      />
                    </div>
                  )}
                </>
              ) : (
                /* List View */
                <>
                  <div className={`rounded-2xl overflow-hidden border ${isDark ? 'bg-gray-800/50 border-gray-800' : 'bg-white border-gray-200'}`}>
                    <table className="w-full">
                      <thead>
                        <tr className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
                          <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Producto
                          </th>
                          <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Categoria
                          </th>
                          <th className={`px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Mi Costo
                          </th>
                          <th className={`px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Venta Empresas
                          </th>
                          <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Proveedor
                          </th>
                          <th className={`px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Estado
                          </th>
                          <th className={`px-6 py-4 w-28`}></th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                        {filteredProducts.map((product, idx) => {
                          const catConfig = getCategoryConfig(product.category)
                          const Icon = catConfig.icon
                          return (
                            <motion.tr
                              key={product.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.02 }}
                              className={`group transition-colors ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}
                            >
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-4">
                                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${catConfig.gradient}`}>
                                    <Icon className="w-6 h-6 text-white" />
                                  </div>
                                  <div>
                                    <div className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                      {product.name}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className={`text-sm font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {product.code}
                                      </span>
                                      <button
                                        onClick={() => copyToClipboard(product.code)}
                                        className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all ${
                                          isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                                        }`}
                                      >
                                        <Copy className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gradient-to-r ${catConfig.gradient} text-white`}>
                                  <Icon className="w-3.5 h-3.5" />
                                  {catConfig.name}
                                </span>
                              </td>
                              <td className={`px-6 py-4 text-right`}>
                                <span className={`text-base font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {product.pricingModel === 'percentage'
                                    ? `${product.miCosto}%${product.miCostoFijo > 0 ? ` + $${product.miCostoFijo}` : ''}`
                                    : `$${product.miCosto.toFixed(2)}`}
                                </span>
                              </td>
                              <td className={`px-6 py-4 text-right`}>
                                <div className="flex flex-col items-end">
                                  <span className={`text-lg font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                    {product.pricingModel === 'percentage'
                                      ? `${product.precioMayorista}%${product.precioMayoristaFijo > 0 ? ` + $${product.precioMayoristaFijo}` : ''}`
                                      : `$${product.precioMayorista.toFixed(2)}`}
                                  </span>
                                  {product.currency && (
                                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                      {product.currency}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className={`px-6 py-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {product.providerName || (
                                  <span className={isDark ? 'text-gray-600' : 'text-gray-300'}>Sin asignar</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                  product.isActive
                                    ? isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                                    : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${product.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                  {product.isActive ? 'Activo' : 'Inactivo'}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => setEditingProduct(product)}
                                    className={`p-2 rounded-lg transition-colors ${
                                      isDark ? 'hover:bg-gray-600 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                                    }`}
                                    title="Editar"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProduct(product.id)}
                                    className={`p-2 rounded-lg transition-colors ${
                                      isDark ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-50 text-red-500'
                                    }`}
                                    title="Eliminar"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </motion.tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Show Recharge Products in "All" view */}
                  {categoryFilter === 'all' && rechargeProductsCount > 0 && (
                    <div className="mt-6">
                      <RechargeProductManager
                        key={rechargeRefreshKey}
                        onOpenModal={() => setShowCreateModal(true)}
                        onProductsChange={() => {
                          fetchRechargeCount()
                          setRechargeRefreshKey(prev => prev + 1)
                        }}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Prices Tab */}
          {activeTab === 'precios' && (
            <div className="space-y-6">
              {/* Company Selector Card */}
              <div className={`rounded-2xl p-6 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200 shadow-sm'}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                      <Building2 className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Seleccionar Empresa
                      </label>
                      <div className="relative">
                        <select
                          value={selectedCompany || ''}
                          onChange={(e) => {
                            setSelectedCompany(e.target.value ? parseInt(e.target.value) : null)
                            setCompanyPrices({})
                            setRechargeCompanyMargins({})
                          }}
                          className={`w-full md:w-96 appearance-none px-4 py-3 pr-10 rounded-xl text-sm font-medium cursor-pointer ${
                            isDark
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-gray-50 border-gray-200 text-gray-900'
                          } border focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                        >
                          <option value="">Selecciona una empresa...</option>
                          {companies.map(company => (
                            <option key={company.id} value={company.id}>
                              {company.legalName}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                      </div>
                    </div>
                  </div>
                  {selectedCompany && (
                    <button
                      onClick={handleSaveCompanyPrices}
                      disabled={savingPrices}
                      className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/25 disabled:opacity-50 transition-all"
                    >
                      {savingPrices ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Guardar Precios
                    </button>
                  )}
                </div>
              </div>

              {/* Prices Table */}
              {selectedCompany ? (
                products.length === 0 ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                      <Package className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                      <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                        No hay productos en el catalogo
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                  <div className={`rounded-2xl overflow-hidden border ${isDark ? 'bg-gray-800/50 border-gray-800' : 'bg-white border-gray-200'}`}>
                    {/* Info banner */}
                    <div className={`px-6 py-3 border-b ${isDark ? 'bg-blue-500/10 border-gray-800' : 'bg-blue-50 border-gray-200'}`}>
                      <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                        <strong>Precio Global:</strong> Precio base para todas las empresas. <strong>Precio Especial:</strong> Sobrescribe el precio global solo para esta empresa.
                        <span className={`ml-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                          Los productos de <strong>Remesa</strong> usan porcentajes (%).
                        </span>
                      </p>
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
                          <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Producto
                          </th>
                          <th className={`px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Precio Global
                          </th>
                          <th className={`px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                            Precio Especial
                          </th>
                          <th className={`px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Descuento
                          </th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                        {products.map((product, idx) => {
                          const catConfig = getCategoryConfig(product.category)
                          const Icon = catConfig.icon
                          const customPrice = companyPrices[product.id]
                          const isPercentage = product.pricingModel === 'percentage'
                          const symbol = isPercentage ? '%' : '$'
                          // El descuento es la diferencia entre el precio global y el precio especial
                          const discount = customPrice !== null && customPrice < product.precioMayorista
                            ? product.precioMayorista - customPrice
                            : null
                          const discountPercent = discount && product.precioMayorista > 0
                            ? (discount / product.precioMayorista * 100)
                            : null
                          // Validar que el precio no sea menor al costo de LogiRapid
                          const isPriceInvalid = customPrice !== null && customPrice < product.miCosto

                          return (
                            <tr
                              key={product.id}
                              className={`transition-colors ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}
                            >
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-4">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${catConfig.gradient}`}>
                                    <Icon className="w-5 h-5 text-white" />
                                  </div>
                                  <div>
                                    <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                      {product.name}
                                    </div>
                                    <div className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                      {product.code}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className={`px-6 py-4 text-right`}>
                                <div className="flex flex-col items-end">
                                  <span className={`text-lg font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                    {isPercentage ? `${product.precioMayorista}%` : `$${product.precioMayorista.toFixed(2)}`}
                                  </span>
                                  {isPercentage && product.currency && (
                                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                      {product.currency}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col items-center gap-1">
                                  <div className="relative">
                                    <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${
                                      isPriceInvalid
                                        ? 'text-red-500'
                                        : isDark ? 'text-blue-400' : 'text-blue-500'
                                    }`}>{symbol}</span>
                                    <input
                                      type="number"
                                      step={isPercentage ? '0.1' : '0.01'}
                                      min={product.miCosto}
                                      max={isPercentage ? 100 : undefined}
                                      value={customPrice ?? ''}
                                      placeholder={isPercentage ? String(product.precioMayorista) : product.precioMayorista.toFixed(2)}
                                      onChange={(e) => {
                                        const value = e.target.value ? parseFloat(e.target.value) : null
                                        setCompanyPrices(prev => ({
                                          ...prev,
                                          [product.id]: value
                                        }))
                                      }}
                                      className={`w-36 pl-8 pr-4 py-2.5 text-center text-lg font-semibold rounded-xl border-2 transition-all ${
                                        isPriceInvalid
                                          ? isDark
                                            ? 'bg-red-900/30 border-red-500 text-red-400 focus:border-red-500'
                                            : 'bg-red-50 border-red-400 text-red-600 focus:border-red-500'
                                          : customPrice !== null
                                            ? isDark
                                              ? 'bg-blue-900/30 border-blue-600 text-blue-300 focus:border-blue-500'
                                              : 'bg-blue-50 border-blue-300 text-blue-700 focus:border-blue-400'
                                            : isDark
                                              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-600 focus:border-blue-500'
                                              : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400'
                                      } focus:outline-none focus:ring-4 ${isPriceInvalid ? 'focus:ring-red-500/20' : 'focus:ring-blue-500/10'}`}
                                    />
                                  </div>
                                  {isPriceInvalid && (
                                    <span className={`text-xs ${isDark ? 'text-red-400' : 'text-red-500'}`}>
                                      Min: {isPercentage ? `${product.miCosto}%` : `$${product.miCosto.toFixed(2)}`}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                {discount !== null ? (
                                  <div className="flex flex-col items-end">
                                    <span className={`text-lg font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                                      {isPercentage ? `-${discount.toFixed(1)}%` : `-$${discount.toFixed(2)}`}
                                    </span>
                                    {!isPercentage && discountPercent !== null && (
                                      <span className={`text-sm font-medium ${isDark ? 'text-green-400/70' : 'text-green-600/70'}`}>
                                        -{discountPercent.toFixed(1)}%
                                      </span>
                                    )}
                                  </div>
                                ) : customPrice !== null && customPrice >= product.precioMayorista ? (
                                  <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Sin descuento</span>
                                ) : (
                                  <span className={isDark ? 'text-gray-600' : 'text-gray-300'}>—</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Recharge Products Section */}
                  {rechargeProductsForPricing.length > 0 && (
                    <div className={`mt-6 rounded-2xl overflow-hidden border ${isDark ? 'bg-gray-800/50 border-gray-800' : 'bg-white border-gray-200'}`}>
                      {/* Section Header */}
                      <div className={`px-6 py-3 border-b ${isDark ? 'bg-purple-500/10 border-gray-800' : 'bg-purple-50 border-gray-200'}`}>
                        <div className="flex items-center gap-2">
                          <Smartphone className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                          <span className={`font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                            Recargas Telefonicas
                          </span>
                        </div>
                      </div>
                      <table className="w-full">
                        <thead>
                          <tr className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
                            <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              Producto
                            </th>
                            <th className={`px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              Costo
                            </th>
                            <th className={`px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              Precio Global
                            </th>
                            <th className={`px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                              Precio Especial
                            </th>
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                          {rechargeProductsForPricing.map((product) => {
                            const customMargin = rechargeCompanyMargins[product.id]
                            const hasCustomPrice = customMargin !== undefined && customMargin !== null
                            // Calculate selling price with custom margin
                            let customSellingPrice: number | null = null
                            if (hasCustomPrice && customMargin) {
                              if (customMargin.marginType === 'percentage') {
                                customSellingPrice = product.baseCost * (1 + customMargin.marginValue / 100)
                              } else {
                                customSellingPrice = product.baseCost + customMargin.marginValue
                              }
                            }
                            return (
                              <tr
                                key={`recharge-${product.id}`}
                                className={`transition-colors ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}
                              >
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-purple-500 to-purple-600 text-xl">
                                      {getCountryFlag(product.countryCode)}
                                    </div>
                                    <div>
                                      <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {product.name}
                                      </div>
                                      <div className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {product.countryName}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className={`px-6 py-4 text-right`}>
                                  <span className={`text-base font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    ${product.baseCost.toFixed(2)}
                                  </span>
                                </td>
                                <td className={`px-6 py-4 text-right`}>
                                  <span className={`text-lg font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                    ${product.pricing?.sellingPrice?.toFixed(2) || '-'}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col items-center gap-1">
                                    <div className="relative">
                                      <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${
                                        isDark ? 'text-purple-400' : 'text-purple-500'
                                      }`}>$</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min={product.baseCost}
                                        value={customSellingPrice?.toFixed(2) ?? ''}
                                        placeholder={product.pricing?.sellingPrice?.toFixed(2) || '0.00'}
                                        onChange={(e) => {
                                          const value = e.target.value ? parseFloat(e.target.value) : null
                                          if (value !== null && value >= product.baseCost) {
                                            // Calculate margin as fixed amount
                                            const marginValue = value - product.baseCost
                                            setRechargeCompanyMargins(prev => ({
                                              ...prev,
                                              [product.id]: { marginType: 'fixed', marginValue }
                                            }))
                                          } else if (value === null || e.target.value === '') {
                                            setRechargeCompanyMargins(prev => ({
                                              ...prev,
                                              [product.id]: null
                                            }))
                                          }
                                        }}
                                        className={`w-36 pl-8 pr-4 py-2.5 text-center text-lg font-semibold rounded-xl border-2 transition-all ${
                                          hasCustomPrice
                                            ? isDark
                                              ? 'bg-purple-900/30 border-purple-600 text-purple-300 focus:border-purple-500'
                                              : 'bg-purple-50 border-purple-300 text-purple-700 focus:border-purple-400'
                                            : isDark
                                              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-600 focus:border-purple-500'
                                              : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-purple-400'
                                        } focus:outline-none focus:ring-4 focus:ring-purple-500/10`}
                                      />
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )
            ) : (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center max-w-sm">
                    <div className={`w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center ${
                      isDark ? 'bg-gradient-to-br from-gray-800 to-gray-700' : 'bg-gradient-to-br from-blue-100 to-blue-50'
                    }`}>
                      <Building2 className={`w-10 h-10 ${isDark ? 'text-gray-600' : 'text-blue-400'}`} />
                    </div>
                    <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Selecciona una empresa
                    </h3>
                    <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                      Elige una empresa del selector para configurar los precios de venta personalizados
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
            providerCompanies={providerCompanies}
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
                    product_type: productData.category === 'remesa' ? 'transferencia' : 'producto',
                    mi_costo: productData.miCosto,
                    mi_costo_fijo: productData.miCostoFijo,
                    precio_mayorista: productData.precioMayorista,
                    precio_mayorista_fijo: productData.precioMayoristaFijo,
                    provider_company_id: productData.providerCompanyId,
                    pricing_model: productData.pricingModel,
                    currency: productData.currency
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
  providerCompanies: ProviderCompany[]
  onClose: () => void
  onSave: (data: {
    code: string
    name: string
    description: string
    category: string
    miCosto: number
    miCostoFijo: number
    precioMayorista: number
    precioMayoristaFijo: number
    providerCompanyId: number | null
    pricingModel: string
    currency: string | null
  }) => Promise<void>
}

// Generate automatic SKU based on category
const generateSKU = (category: string): string => {
  const prefixes: Record<string, string> = {
    'paqueteria': 'PAQ',
    'remesa': 'REM',
    'recarga': 'REC',
    'mercado': 'MER'
  }
  const prefix = prefixes[category] || 'PRD'
  // Generate unique ID: timestamp (base36) + random chars
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4)
  const random = Math.random().toString(36).substring(2, 5).toUpperCase()
  return `${prefix}-${timestamp}${random}`
}

// UnivCell Product interface for import
interface UnivCellProduct {
  id: number
  externalId: number
  name: string
  slug: string
  baseCost: number
  countryCode: string
  countryName: string
  phonePattern: string
  isActive: boolean
  pricing: {
    marginType: string
    marginValue: number
    sellingPrice: number
    isEnabled: boolean
  } | null
  promotions: Array<{ summary: string }>
}

function ProductModal({ isDark, product, providerCompanies, onClose, onSave }: ProductModalProps) {
  const isNewProduct = !product

  const [formData, setFormData] = useState(() => {
    const initialCategory = product?.category || 'paqueteria'
    const isRemesa = initialCategory === 'remesa'
    return {
      code: product?.code || generateSKU(initialCategory),
      name: product?.name || '',
      description: product?.description || '',
      category: initialCategory,
      miCosto: product?.miCosto || 0,
      miCostoFijo: product?.miCostoFijo || 0,
      precioMayorista: product?.precioMayorista || 0,
      precioMayoristaFijo: product?.precioMayoristaFijo || 0,
      providerCompanyId: product?.providerCompanyId || null as number | null,
      pricingModel: product?.pricingModel || (isRemesa ? 'percentage' : 'fixed'),
      currency: product?.currency || (isRemesa ? 'USD' : null) as string | null
    }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // UnivCell products state
  const [univcellProducts, setUnivcellProducts] = useState<UnivCellProduct[]>([])
  const [loadingUnivcell, setLoadingUnivcell] = useState(false)
  const [syncingUnivcell, setSyncingUnivcell] = useState(false)
  const [selectedUnivcellProduct, setSelectedUnivcellProduct] = useState<UnivCellProduct | null>(null)
  const [univcellMarginType, setUnivcellMarginType] = useState<'percentage' | 'fixed'>('percentage')
  const [univcellMarginValue, setUnivcellMarginValue] = useState('20')

  const isRemesa = formData.category === 'remesa'
  const isRecarga = formData.category === 'recarga'

  // Fetch UnivCell products when recarga is selected
  useEffect(() => {
    if (isRecarga && isNewProduct) {
      fetchUnivcellProducts()
    }
  }, [isRecarga, isNewProduct])

  const fetchUnivcellProducts = async () => {
    setLoadingUnivcell(true)
    try {
      const response = await fetch('/api/recharges/products')
      const data = await response.json()
      if (data.success) {
        setUnivcellProducts(data.data.products)
      }
    } catch (err) {
      console.error('Error fetching UnivCell products:', err)
    } finally {
      setLoadingUnivcell(false)
    }
  }

  const handleSyncUnivcell = async () => {
    setSyncingUnivcell(true)
    try {
      const response = await fetch('/api/recharges/sync', { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        await fetchUnivcellProducts()
      }
    } catch (err) {
      console.error('Error syncing UnivCell:', err)
    } finally {
      setSyncingUnivcell(false)
    }
  }

  const handleConfigureUnivcellProduct = async () => {
    if (!selectedUnivcellProduct) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/recharges/products/${selectedUnivcellProduct.id}/pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marginType: univcellMarginType,
          marginValue: parseFloat(univcellMarginValue) || 0,
          isEnabled: true
        })
      })
      const data = await response.json()
      if (data.success) {
        onClose()
      } else {
        setError(data.error || 'Error configurando producto')
      }
    } catch (err) {
      setError('Error de conexion')
    } finally {
      setSaving(false)
    }
  }

  const getCountryFlag = (code: string) => {
    const flags: Record<string, string> = { CU: '🇨🇺', MX: '🇲🇽', DO: '🇩🇴', US: '🇺🇸' }
    return flags[code] || '🌍'
  }

  const calculateSellingPrice = () => {
    if (!selectedUnivcellProduct) return 0
    const margin = parseFloat(univcellMarginValue) || 0
    if (univcellMarginType === 'percentage') {
      return selectedUnivcellProduct.baseCost * (1 + margin / 100)
    }
    return selectedUnivcellProduct.baseCost + margin
  }

  // Regenerate SKU when category changes (only for new products)
  const handleCategoryChange = (newCategory: string) => {
    const newIsRemesa = newCategory === 'remesa'
    if (isNewProduct) {
      setFormData({
        ...formData,
        category: newCategory,
        code: generateSKU(newCategory),
        pricingModel: newIsRemesa ? 'percentage' : 'fixed',
        currency: newIsRemesa ? 'USD' : null,
        // Reset prices when switching to/from remesa
        miCosto: newIsRemesa ? 2 : 0,
        miCostoFijo: newIsRemesa ? 3 : 0,
        precioMayorista: newIsRemesa ? 3 : 0,
        precioMayoristaFijo: newIsRemesa ? 5 : 0
      })
      // Reset UnivCell selection when changing category
      setSelectedUnivcellProduct(null)
    } else {
      setFormData({
        ...formData,
        category: newCategory,
        pricingModel: newIsRemesa ? 'percentage' : 'fixed',
        currency: newIsRemesa ? (formData.currency || 'USD') : null
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.code || !formData.name) {
      setError('Codigo y nombre son requeridos')
      return
    }

    if (formData.miCosto < 0 || formData.precioMayorista < 0) {
      setError('Los precios no pueden ser negativos')
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

  const selectedCategory = getCategoryConfig(formData.category)
  const CategoryIcon = selectedCategory.icon

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', duration: 0.4 }}
        className={`w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}
      >
        {/* Header with gradient */}
        <div className={`relative px-6 py-8 bg-gradient-to-r ${selectedCategory.gradient}`}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <CategoryIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {product ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              <p className="text-white/70 text-sm">
                {product ? 'Modifica los datos del producto' : 'Completa los datos del nuevo producto'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-center gap-3"
              >
                <div className="p-1 rounded-full bg-red-500/20">
                  <X className="w-4 h-4" />
                </div>
                {error}
              </motion.div>
            )}

            {/* Category Selector */}
            <div>
              <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Categoria
              </label>
              <div className="grid grid-cols-4 gap-2">
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon
                  const isSelected = formData.category === cat.id
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleCategoryChange(cat.id)}
                      className={`p-3 rounded-xl flex flex-col items-center gap-2 transition-all ${
                        isSelected
                          ? `bg-gradient-to-br ${cat.gradient} text-white shadow-lg`
                          : isDark
                            ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-medium">{cat.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* UnivCell Products for Recarga category */}
            {isRecarga && isNewProduct ? (
              <div className="space-y-4">
                {/* Sync Button */}
                <div className="flex items-center justify-between">
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Selecciona un producto de UnivCell para agregar al catalogo
                  </p>
                  <button
                    type="button"
                    onClick={handleSyncUnivcell}
                    disabled={syncingUnivcell}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
                      isDark ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-purple-500 hover:bg-purple-600 text-white'
                    } disabled:opacity-50`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingUnivcell ? 'animate-spin' : ''}`} />
                    Sincronizar
                  </button>
                </div>

                {/* Products List */}
                {loadingUnivcell ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className={`w-6 h-6 animate-spin ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
                  </div>
                ) : univcellProducts.length === 0 ? (
                  <div className={`text-center py-8 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                    <Smartphone className={`w-10 h-10 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      No hay productos sincronizados
                    </p>
                    <button
                      type="button"
                      onClick={handleSyncUnivcell}
                      disabled={syncingUnivcell}
                      className="mt-3 px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                    >
                      Sincronizar desde UnivCell
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {univcellProducts.map(prod => (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => setSelectedUnivcellProduct(prod)}
                        className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all text-left ${
                          selectedUnivcellProduct?.id === prod.id
                            ? isDark
                              ? 'bg-purple-600/30 border-2 border-purple-500'
                              : 'bg-purple-50 border-2 border-purple-400'
                            : isDark
                              ? 'bg-gray-700 hover:bg-gray-600 border-2 border-transparent'
                              : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                        }`}
                      >
                        <span className="text-2xl">{getCountryFlag(prod.countryCode)}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {prod.name}
                          </p>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {prod.countryName} • Costo: ${prod.baseCost.toFixed(2)}
                          </p>
                        </div>
                        {prod.pricing?.isEnabled && (
                          <span className={`px-2 py-0.5 text-xs rounded-full ${isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'}`}>
                            Activo
                          </span>
                        )}
                        {prod.promotions.length > 0 && (
                          <span className={`px-2 py-0.5 text-xs rounded-full ${isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'}`}>
                            Promo
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected Product Config */}
                {selectedUnivcellProduct && (
                  <div className={`p-4 rounded-xl ${isDark ? 'bg-purple-900/20 border border-purple-800' : 'bg-purple-50 border border-purple-200'}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">{getCountryFlag(selectedUnivcellProduct.countryCode)}</span>
                      <div>
                        <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {selectedUnivcellProduct.name}
                        </p>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Costo base: ${selectedUnivcellProduct.baseCost.toFixed(2)} USD
                        </p>
                      </div>
                    </div>

                    {/* Margin Type */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setUnivcellMarginType('percentage')}
                        className={`p-2 rounded-lg text-sm font-medium transition-all ${
                          univcellMarginType === 'percentage'
                            ? 'bg-purple-600 text-white'
                            : isDark ? 'bg-gray-700 text-gray-400' : 'bg-white text-gray-600 border border-gray-200'
                        }`}
                      >
                        % Porcentaje
                      </button>
                      <button
                        type="button"
                        onClick={() => setUnivcellMarginType('fixed')}
                        className={`p-2 rounded-lg text-sm font-medium transition-all ${
                          univcellMarginType === 'fixed'
                            ? 'bg-purple-600 text-white'
                            : isDark ? 'bg-gray-700 text-gray-400' : 'bg-white text-gray-600 border border-gray-200'
                        }`}
                      >
                        $ Monto Fijo
                      </button>
                    </div>

                    {/* Margin Value */}
                    <div className="mb-3">
                      <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {univcellMarginType === 'percentage' ? 'Porcentaje de ganancia' : 'Ganancia fija'}
                      </label>
                      <div className="relative">
                        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${isDark ? 'text-purple-400' : 'text-purple-500'}`}>
                          {univcellMarginType === 'percentage' ? '%' : '$'}
                        </span>
                        <input
                          type="number"
                          value={univcellMarginValue}
                          onChange={(e) => setUnivcellMarginValue(e.target.value)}
                          step={univcellMarginType === 'percentage' ? '1' : '0.01'}
                          min="0"
                          className={`w-full pl-8 pr-3 py-2 rounded-lg text-right font-semibold ${
                            isDark
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-white border-gray-200 text-gray-900'
                          } border focus:outline-none focus:ring-2 focus:ring-purple-500/20`}
                        />
                      </div>
                    </div>

                    {/* Price Preview */}
                    <div className={`flex items-center justify-between p-3 rounded-lg ${isDark ? 'bg-green-900/30' : 'bg-green-50'}`}>
                      <span className={`text-sm ${isDark ? 'text-green-400' : 'text-green-700'}`}>Precio de venta:</span>
                      <span className={`text-xl font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                        ${calculateSellingPrice().toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
            <>
            {/* Code and Name */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  SKU {isNewProduct && <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>(Auto)</span>}
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  readOnly={isNewProduct}
                  className={`w-full px-4 py-3 rounded-xl border text-sm font-mono transition-all ${
                    isNewProduct
                      ? isDark
                        ? 'bg-gray-800 border-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
                      : isDark
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500'
                        : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                  placeholder="SKU-001"
                />
              </div>
              <div className="col-span-2">
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Nombre del producto
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl border text-sm transition-all ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500'
                      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                  placeholder="Nombre del producto"
                />
              </div>
            </div>

            {/* Provider */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Proveedor
              </label>
              <div className="relative">
                <select
                  value={formData.providerCompanyId ?? ''}
                  onChange={(e) => setFormData({ ...formData, providerCompanyId: e.target.value ? parseInt(e.target.value) : null })}
                  className={`w-full appearance-none px-4 py-3 pr-10 rounded-xl border text-sm transition-all cursor-pointer ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500'
                      : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-400'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                >
                  <option value="">Sin proveedor asignado</option>
                  {providerCompanies.map(company => (
                    <option key={company.id} value={company.id}>
                      {company.legalName}
                    </option>
                  ))}
                </select>
                <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              </div>
            </div>

            {/* Currency selector for Remesa */}
            {isRemesa && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Moneda de la Remesa
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {CURRENCIES.map(curr => (
                    <button
                      key={curr.code}
                      type="button"
                      onClick={() => setFormData({ ...formData, currency: curr.code })}
                      className={`p-3 rounded-xl flex flex-col items-center gap-1 transition-all ${
                        formData.currency === curr.code
                          ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg'
                          : isDark
                            ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      <span className="text-lg font-bold">{curr.symbol}</span>
                      <span className="text-xs">{curr.code}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Prices - Different UI for Remesa (%) vs Other ($) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {isRemesa ? 'Costo (%)' : 'Mi Costo ($)'}
                </label>
                <div className="relative">
                  <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {isRemesa ? '%' : '$'}
                  </span>
                  <input
                    type="number"
                    step={isRemesa ? '0.1' : '0.01'}
                    min="0"
                    max={isRemesa ? '100' : undefined}
                    value={formData.miCosto}
                    onChange={(e) => {
                      const miCosto = parseFloat(e.target.value) || 0
                      if (isRemesa) {
                        // For remesa, just update the percentage
                        setFormData({ ...formData, miCosto })
                      } else {
                        // Auto-calculate precio mayorista if it's 0
                        const precioMayorista = formData.precioMayorista || miCosto * 1.2
                        setFormData({
                          ...formData,
                          miCosto,
                          precioMayorista: formData.precioMayorista === 0 ? parseFloat(precioMayorista.toFixed(2)) : formData.precioMayorista
                        })
                      }
                    }}
                    className={`w-full pl-8 pr-3 py-3 rounded-xl border text-sm text-right font-semibold transition-all ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500'
                        : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                    placeholder={isRemesa ? '2.0' : '0.00'}
                  />
                </div>
                <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {isRemesa ? 'Porcentaje de comision que pagas' : 'Lo que pagas por el producto'}
                </p>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  {isRemesa ? 'Precio Venta (%)' : 'Precio Venta Empresas ($)'}
                </label>
                <div className="relative">
                  <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${isDark ? 'text-emerald-500' : 'text-emerald-400'}`}>
                    {isRemesa ? '%' : '$'}
                  </span>
                  <input
                    type="number"
                    step={isRemesa ? '0.1' : '0.01'}
                    min="0"
                    max={isRemesa ? '100' : undefined}
                    value={formData.precioMayorista}
                    onChange={(e) => setFormData({ ...formData, precioMayorista: parseFloat(e.target.value) || 0 })}
                    className={`w-full pl-8 pr-3 py-3 rounded-xl border text-sm text-right font-bold transition-all ${
                      isDark
                        ? 'bg-emerald-900/30 border-emerald-700 text-emerald-400 placeholder-emerald-700 focus:border-emerald-500'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700 placeholder-emerald-300 focus:border-emerald-400'
                    } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
                    placeholder={isRemesa ? '3.0' : '0.00'}
                  />
                </div>
                <p className={`text-xs mt-1 ${isDark ? 'text-emerald-500/70' : 'text-emerald-500'}`}>
                  {isRemesa ? 'Porcentaje que cobran las empresas' : 'Precio global para todas las empresas'}
                </p>
              </div>
            </div>

            {/* Fixed Fee for Remesa (Transaction Fee / Delivery Fee) */}
            {isRemesa && (
              <div className={`p-4 rounded-xl ${isDark ? 'bg-amber-900/20 border border-amber-800' : 'bg-amber-50 border border-amber-200'}`}>
                <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                  Fee de Transaccion (Monto Fijo)
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Costo Fee ($)
                    </label>
                    <div className="relative">
                      <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${isDark ? 'text-amber-500' : 'text-amber-600'}`}>$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.miCostoFijo}
                        onChange={(e) => setFormData({ ...formData, miCostoFijo: parseFloat(e.target.value) || 0 })}
                        className={`w-full pl-8 pr-3 py-2 rounded-lg border text-sm text-right font-semibold transition-all ${
                          isDark
                            ? 'bg-gray-700 border-gray-600 text-white focus:border-amber-500'
                            : 'bg-white border-gray-200 text-gray-900 focus:border-amber-400'
                        } focus:outline-none focus:ring-2 focus:ring-amber-500/20`}
                        placeholder="3.00"
                      />
                    </div>
                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Fee que cobra el proveedor
                    </p>
                  </div>
                  <div>
                    <label className={`block text-xs mb-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                      Venta Fee ($)
                    </label>
                    <div className="relative">
                      <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${isDark ? 'text-amber-400' : 'text-amber-500'}`}>$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.precioMayoristaFijo}
                        onChange={(e) => setFormData({ ...formData, precioMayoristaFijo: parseFloat(e.target.value) || 0 })}
                        className={`w-full pl-8 pr-3 py-2 rounded-lg border text-sm text-right font-bold transition-all ${
                          isDark
                            ? 'bg-amber-900/30 border-amber-700 text-amber-400 focus:border-amber-500'
                            : 'bg-amber-50 border-amber-300 text-amber-700 focus:border-amber-400'
                        } focus:outline-none focus:ring-2 focus:ring-amber-500/20`}
                        placeholder="5.00"
                      />
                    </div>
                    <p className={`text-xs mt-1 ${isDark ? 'text-amber-500/70' : 'text-amber-600'}`}>
                      Fee que cobran las empresas
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Margin info for Remesa */}
            {isRemesa && (formData.precioMayorista > formData.miCosto || formData.precioMayoristaFijo > formData.miCostoFijo) && (
              <div className={`p-4 rounded-xl ${isDark ? 'bg-emerald-900/20 border border-emerald-800' : 'bg-emerald-50 border border-emerald-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    Margen porcentual:
                  </span>
                  <span className={`text-lg font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    {(formData.precioMayorista - formData.miCosto).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    Margen fee fijo:
                  </span>
                  <span className={`text-lg font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    ${(formData.precioMayoristaFijo - formData.miCostoFijo).toFixed(2)}
                  </span>
                </div>
                <p className={`text-xs mt-2 ${isDark ? 'text-emerald-500/70' : 'text-emerald-600/70'}`}>
                  Ejemplo: $100 enviados = ${formData.precioMayorista - formData.miCosto} (%) + ${(formData.precioMayoristaFijo - formData.miCostoFijo).toFixed(2)} (fee) = ${((formData.precioMayorista - formData.miCosto) + (formData.precioMayoristaFijo - formData.miCostoFijo)).toFixed(2)} ganancia
                </p>
              </div>
            )}

            {/* Description */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Descripcion
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className={`w-full px-4 py-3 rounded-xl border text-sm transition-all resize-none ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500'
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400'
                } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                placeholder="Descripcion opcional del producto..."
              />
            </div>
            </>
            )}
          </div>

          {/* Footer */}
          <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-100 bg-gray-50'}`}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={`px-5 py-2.5 rounded-xl font-medium transition-colors ${
                isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-600'
              } disabled:opacity-50`}
            >
              Cancelar
            </button>
            {isRecarga && isNewProduct ? (
              <button
                type="button"
                onClick={handleConfigureUnivcellProduct}
                disabled={saving || !selectedUnivcellProduct}
                className={`px-6 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium rounded-xl disabled:opacity-50 flex items-center gap-2 shadow-lg transition-all hover:shadow-xl`}
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Configurando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Agregar Producto
                  </>
                )}
              </button>
            ) : (
            <button
              type="submit"
              disabled={saving}
              className={`px-6 py-2.5 bg-gradient-to-r ${selectedCategory.gradient} text-white font-medium rounded-xl disabled:opacity-50 flex items-center gap-2 shadow-lg transition-all hover:shadow-xl`}
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  {product ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {product ? 'Guardar Cambios' : 'Crear Producto'}
                </>
              )}
            </button>
            )}
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
