'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import {
  Package,
  Settings,
  ChevronDown,
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Info,
  RefreshCw,
  Search,
  Filter,
  Box,
  Layers,
  TrendingUp,
  AlertCircle,
  Percent
} from 'lucide-react'

interface ProductService {
  id: number
  productId: number
  serviceCode: string
  serviceName: string
  description: string | null
  sequenceOrder: number
  inclusionType: 'included' | 'optional' | 'addon'
  basePrice: number
  generatesBoxTracking: boolean
  requiresPriorBox: boolean
  isMandatory: boolean
  isActive: boolean
  companyPricing?: {
    id: number
    miCosto: number
    precioVenta: number
    margen: number
    isActive: boolean
  } | null
  effectivePrice: number
}

interface Product {
  id: number
  code: string
  name: string
  description: string | null
  category: string
  miCosto: number
  precioMayorista: number
  precioPublico: number
  isComposite: boolean
  hasBoxTracking: boolean
  isActive: boolean
  services: ProductService[]
  companyPricing?: {
    miCosto: number
    precioVenta: number
    margen: number
  } | null
}

interface MarginHealth {
  productId: number
  productName: string
  miCosto: number
  precioVenta: number
  margenBruto: number
  totalComisiones: number
  margenNeto: number
  margenPorcentaje: number
  status: 'healthy' | 'warning' | 'critical'
  configuredCommissions: {
    activityType: string
    role: string
    value: number
    type: string
  }[]
}

export default function ProductConfigPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const isDark = theme === 'dark'

  const [products, setProducts] = useState<Product[]>([])
  const [marginHealth, setMarginHealth] = useState<MarginHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [showPricingModal, setShowPricingModal] = useState(false)
  const [editingService, setEditingService] = useState<ProductService | null>(null)

  // Fetch products and their services
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/products?active=false')
      const data = await response.json()

      if (data.success) {
        // Fetch services for each product
        const productsWithServices = await Promise.all(
          data.data.products.map(async (product: any) => {
            try {
              const servicesRes = await fetch(`/api/products/${product.id}/services`)
              const servicesData = await servicesRes.json()

              // Map API fields to our interface
              return {
                id: product.id,
                code: product.code,
                name: product.name,
                description: product.description,
                category: product.service_category,
                miCosto: parseFloat(product.mi_costo) || 0,
                precioMayorista: parseFloat(product.precio_mayorista) || 0,
                precioPublico: parseFloat(product.precio_publico) || 0,
                isComposite: product.is_composite || false,
                hasBoxTracking: product.has_box_tracking || false,
                isActive: product.is_active !== false,
                services: servicesData.success ? servicesData.data.services : [],
                companyPricing: null
              }
            } catch {
              return {
                id: product.id,
                code: product.code,
                name: product.name,
                description: product.description,
                category: product.service_category,
                miCosto: parseFloat(product.mi_costo) || 0,
                precioMayorista: parseFloat(product.precio_mayorista) || 0,
                precioPublico: parseFloat(product.precio_publico) || 0,
                isComposite: product.is_composite || false,
                hasBoxTracking: product.has_box_tracking || false,
                isActive: product.is_active !== false,
                services: [],
                companyPricing: null
              }
            }
          })
        )
        setProducts(productsWithServices)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      showNotification('error', 'Error', 'Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }, [showNotification])

  // Fetch margin health data
  const fetchMarginHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/commissions/margin-health')
      const data = await response.json()

      if (data.success) {
        setMarginHealth(data.data)
      }
    } catch (error) {
      console.error('Error fetching margin health:', error)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
    fetchMarginHealth()
  }, [fetchProducts, fetchMarginHealth])

  const toggleProductExpanded = (productId: number) => {
    setExpandedProducts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(productId)) {
        newSet.delete(productId)
      } else {
        newSet.add(productId)
      }
      return newSet
    })
  }

  const getMarginHealthForProduct = (productId: number): MarginHealth | undefined => {
    return marginHealth.find(m => m.productId === productId)
  }

  const getStatusColor = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy':
        return 'text-green-500'
      case 'warning':
        return 'text-yellow-500'
      case 'critical':
        return 'text-red-500'
      default:
        return 'text-gray-500'
    }
  }

  const getStatusBgColor = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy':
        return isDark ? 'bg-green-500/20' : 'bg-green-100'
      case 'warning':
        return isDark ? 'bg-yellow-500/20' : 'bg-yellow-100'
      case 'critical':
        return isDark ? 'bg-red-500/20' : 'bg-red-100'
      default:
        return isDark ? 'bg-gray-500/20' : 'bg-gray-100'
    }
  }

  const getStatusIcon = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4" />
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />
      case 'critical':
        return <AlertCircle className="w-4 h-4" />
      default:
        return <Info className="w-4 h-4" />
    }
  }

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.code.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && product.isActive) ||
      (statusFilter === 'inactive' && !product.isActive) ||
      (statusFilter === 'composite' && product.isComposite) ||
      (statusFilter === 'tracking' && product.hasBoxTracking)
    return matchesSearch && matchesCategory && matchesStatus
  })

  const categories = [...new Set(products.map(p => p.category))].filter(Boolean)

  // Summary stats
  const stats = {
    totalProducts: products.length,
    activeProducts: products.filter(p => p.isActive).length,
    compositeProducts: products.filter(p => p.isComposite).length,
    withTracking: products.filter(p => p.hasBoxTracking).length,
    totalServices: products.reduce((sum, p) => sum + (p.services?.length || 0), 0),
    healthyMargins: marginHealth.filter(m => m.status === 'healthy').length,
    warningMargins: marginHealth.filter(m => m.status === 'warning').length,
    criticalMargins: marginHealth.filter(m => m.status === 'critical').length
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Configuración de Productos y Servicios
            </h1>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Gestiona productos, servicios internos, precios y comisiones
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                fetchProducts()
                fetchMarginHealth()
              }}
              className={`p-2 rounded-lg transition-colors ${
                isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={() => window.location.href = '/api/migrations/product-services'}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isDark
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              Ejecutar Migración
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Package className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Total
              </span>
            </div>
            <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {stats.totalProducts}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}
          >
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Activos
              </span>
            </div>
            <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {stats.activeProducts}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Layers className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Compuestos
              </span>
            </div>
            <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {stats.compositeProducts}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Box className={`w-4 h-4 ${isDark ? 'text-orange-400' : 'text-orange-500'}`} />
              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Con Tracking
              </span>
            </div>
            <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {stats.withTracking}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Settings className={`w-4 h-4 ${isDark ? 'text-cyan-400' : 'text-cyan-500'}`} />
              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Servicios
              </span>
            </div>
            <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {stats.totalServices}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className={`p-4 rounded-xl ${isDark ? 'bg-green-900/30' : 'bg-green-50'} shadow-sm`}
          >
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className={`text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                Saludable
              </span>
            </div>
            <p className={`text-xl font-bold text-green-500`}>
              {stats.healthyMargins}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`p-4 rounded-xl ${isDark ? 'bg-yellow-900/30' : 'bg-yellow-50'} shadow-sm`}
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <span className={`text-xs ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                Advertencia
              </span>
            </div>
            <p className={`text-xl font-bold text-yellow-500`}>
              {stats.warningMargins}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className={`p-4 rounded-xl ${isDark ? 'bg-red-900/30' : 'bg-red-50'} shadow-sm`}
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className={`text-xs ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                Crítico
              </span>
            </div>
            <p className={`text-xl font-bold text-red-500`}>
              {stats.criticalMargins}
            </p>
          </motion.div>
        </div>

        {/* Filters */}
        <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                isDark ? 'text-gray-500' : 'text-gray-400'
              }`} />
              <input
                type="text"
                placeholder="Buscar por nombre o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>

            <div className="flex gap-3">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={`px-4 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              >
                <option value="all">Todas las categorías</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`px-4 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              >
                <option value="all">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
                <option value="composite">Compuestos</option>
                <option value="tracking">Con Tracking</option>
              </select>
            </div>
          </div>
        </div>

        {/* Products List */}
        <div className="space-y-4">
          {loading ? (
            <div className={`p-8 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm text-center`}>
              <RefreshCw className={`w-8 h-8 mx-auto mb-4 animate-spin ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Cargando productos...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className={`p-8 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm text-center`}>
              <Package className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
              <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>No se encontraron productos</p>
            </div>
          ) : (
            <AnimatePresence>
              {filteredProducts.map((product, index) => {
                const health = getMarginHealthForProduct(product.id)
                const isExpanded = expandedProducts.has(product.id)

                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                    className={`rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm overflow-hidden`}
                  >
                    {/* Product Header */}
                    <div
                      onClick={() => toggleProductExpanded(product.id)}
                      className={`p-4 cursor-pointer hover:${isDark ? 'bg-gray-750' : 'bg-gray-50'} transition-colors`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <button className={`p-1 rounded ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
                            {isExpanded ? (
                              <ChevronDown className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                            ) : (
                              <ChevronRight className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                            )}
                          </button>

                          <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                            <Package className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {product.name}
                              </h3>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {product.code}
                              </span>
                              {product.isComposite && (
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  isDark ? 'bg-purple-900/50 text-purple-400' : 'bg-purple-100 text-purple-600'
                                }`}>
                                  Compuesto
                                </span>
                              )}
                              {product.hasBoxTracking && (
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  isDark ? 'bg-orange-900/50 text-orange-400' : 'bg-orange-100 text-orange-600'
                                }`}>
                                  Tracking
                                </span>
                              )}
                            </div>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {product.category} • {product.services?.length || 0} servicios
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {/* Margin Health Indicator */}
                          {health && (
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${getStatusBgColor(health.status)}`}>
                              <span className={getStatusColor(health.status)}>
                                {getStatusIcon(health.status)}
                              </span>
                              <div className="text-right">
                                <p className={`text-xs ${getStatusColor(health.status)} font-medium`}>
                                  Margen: ${health.margenNeto.toFixed(2)}
                                </p>
                                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {health.margenPorcentaje.toFixed(1)}%
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Price */}
                          <div className="text-right">
                            <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              ${product.precioPublico?.toFixed(2) || '0.00'}
                            </p>
                            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                              Precio venta
                            </p>
                          </div>

                          {/* Status */}
                          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                            product.isActive
                              ? isDark ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-600'
                              : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {product.isActive ? 'Activo' : 'Inactivo'}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedProduct(product)
                                setShowPricingModal(true)
                              }}
                              className={`p-2 rounded-lg transition-colors ${
                                isDark
                                  ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                              }`}
                              title="Configurar precios"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedProduct(product)
                                setEditingService(null)
                                setShowServiceModal(true)
                              }}
                              className={`p-2 rounded-lg transition-colors ${
                                isDark
                                  ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                              }`}
                              title="Agregar servicio"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Services */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                            {/* Services Table */}
                            {product.services && product.services.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead>
                                    <tr className={isDark ? 'bg-gray-750' : 'bg-gray-50'}>
                                      <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                                        isDark ? 'text-gray-400' : 'text-gray-500'
                                      }`}>
                                        Servicio
                                      </th>
                                      <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                                        isDark ? 'text-gray-400' : 'text-gray-500'
                                      }`}>
                                        Código
                                      </th>
                                      <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                                        isDark ? 'text-gray-400' : 'text-gray-500'
                                      }`}>
                                        Tipo
                                      </th>
                                      <th className={`px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ${
                                        isDark ? 'text-gray-400' : 'text-gray-500'
                                      }`}>
                                        Precio Base
                                      </th>
                                      <th className={`px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ${
                                        isDark ? 'text-gray-400' : 'text-gray-500'
                                      }`}>
                                        Precio Empresa
                                      </th>
                                      <th className={`px-4 py-3 text-center text-xs font-medium uppercase tracking-wider ${
                                        isDark ? 'text-gray-400' : 'text-gray-500'
                                      }`}>
                                        Opciones
                                      </th>
                                      <th className={`px-4 py-3 text-center text-xs font-medium uppercase tracking-wider ${
                                        isDark ? 'text-gray-400' : 'text-gray-500'
                                      }`}>
                                        Acciones
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-100'}`}>
                                    {product.services.map((service) => (
                                      <tr
                                        key={service.id}
                                        className={`${isDark ? 'hover:bg-gray-750' : 'hover:bg-gray-50'} transition-colors`}
                                      >
                                        <td className="px-4 py-3">
                                          <div className="flex items-center gap-2">
                                            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium ${
                                              isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'
                                            }`}>
                                              {service.sequenceOrder}
                                            </span>
                                            <div>
                                              <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {service.serviceName}
                                              </p>
                                              {service.description && (
                                                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                  {service.description}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                        <td className={`px-4 py-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                          <code className={`text-xs px-2 py-1 rounded ${
                                            isDark ? 'bg-gray-700' : 'bg-gray-100'
                                          }`}>
                                            {service.serviceCode}
                                          </code>
                                        </td>
                                        <td className="px-4 py-3">
                                          <span className={`text-xs px-2 py-1 rounded ${
                                            service.inclusionType === 'included'
                                              ? isDark ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-600'
                                              : service.inclusionType === 'optional'
                                                ? isDark ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-600'
                                                : isDark ? 'bg-purple-900/50 text-purple-400' : 'bg-purple-100 text-purple-600'
                                          }`}>
                                            {service.inclusionType === 'included' ? 'Incluido' :
                                              service.inclusionType === 'optional' ? 'Opcional' : 'Adicional'}
                                          </span>
                                        </td>
                                        <td className={`px-4 py-3 text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                          ${service.basePrice.toFixed(2)}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-medium ${
                                          service.companyPricing
                                            ? isDark ? 'text-green-400' : 'text-green-600'
                                            : isDark ? 'text-gray-500' : 'text-gray-400'
                                        }`}>
                                          {service.companyPricing
                                            ? `$${service.companyPricing.precioVenta.toFixed(2)}`
                                            : '-'
                                          }
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="flex items-center justify-center gap-2">
                                            {service.isMandatory && (
                                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                                isDark ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-600'
                                              }`} title="Obligatorio">
                                                Req
                                              </span>
                                            )}
                                            {service.generatesBoxTracking && (
                                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                                isDark ? 'bg-orange-900/50 text-orange-400' : 'bg-orange-100 text-orange-600'
                                              }`} title="Genera tracking de caja">
                                                Box
                                              </span>
                                            )}
                                            {!service.isActive && (
                                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                                isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                                              }`}>
                                                Off
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="flex items-center justify-center gap-1">
                                            <button
                                              onClick={() => {
                                                setSelectedProduct(product)
                                                setEditingService(service)
                                                setShowServiceModal(true)
                                              }}
                                              className={`p-1.5 rounded transition-colors ${
                                                isDark
                                                  ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                                                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                                              }`}
                                              title="Editar"
                                            >
                                              <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                              className={`p-1.5 rounded transition-colors ${
                                                isDark
                                                  ? 'hover:bg-red-900/50 text-gray-400 hover:text-red-400'
                                                  : 'hover:bg-red-100 text-gray-500 hover:text-red-600'
                                              }`}
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
                            ) : (
                              <div className={`p-8 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>No hay servicios configurados</p>
                                <button
                                  onClick={() => {
                                    setSelectedProduct(product)
                                    setEditingService(null)
                                    setShowServiceModal(true)
                                  }}
                                  className={`mt-3 px-4 py-2 text-sm rounded-lg transition-colors ${
                                    isDark
                                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                                  }`}
                                >
                                  Agregar primer servicio
                                </button>
                              </div>
                            )}

                            {/* Margin Health Details */}
                            {health && (
                              <div className={`p-4 border-t ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-100 bg-gray-50'}`}>
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h4 className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                      Análisis de Margen
                                    </h4>
                                    <div className="grid grid-cols-4 gap-4 text-sm">
                                      <div>
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Mi Costo</p>
                                        <p className={isDark ? 'text-gray-300' : 'text-gray-700'}>${health.miCosto.toFixed(2)}</p>
                                      </div>
                                      <div>
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Precio Venta</p>
                                        <p className={isDark ? 'text-gray-300' : 'text-gray-700'}>${health.precioVenta.toFixed(2)}</p>
                                      </div>
                                      <div>
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Margen Bruto</p>
                                        <p className={isDark ? 'text-gray-300' : 'text-gray-700'}>${health.margenBruto.toFixed(2)}</p>
                                      </div>
                                      <div>
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Total Comisiones</p>
                                        <p className={`${health.totalComisiones > health.margenBruto ? 'text-red-500' : isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                          ${health.totalComisiones.toFixed(2)}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${getStatusBgColor(health.status)}`}>
                                      <span className={getStatusColor(health.status)}>
                                        {getStatusIcon(health.status)}
                                      </span>
                                      <div>
                                        <p className={`text-sm font-bold ${getStatusColor(health.status)}`}>
                                          ${health.margenNeto.toFixed(2)}
                                        </p>
                                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                          Margen Neto
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Commission breakdown */}
                                {health.configuredCommissions && health.configuredCommissions.length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-dashed ${isDark ? 'border-gray-600' : 'border-gray-200'}">
                                    <p className={`text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                      Comisiones configuradas:
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {health.configuredCommissions.map((comm, idx) => (
                                        <span
                                          key={idx}
                                          className={`text-xs px-2 py-1 rounded ${
                                            isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'
                                          }`}
                                        >
                                          {comm.activityType} ({comm.role}): {
                                            comm.type === 'percentage'
                                              ? `${comm.value}%`
                                              : `$${comm.value}`
                                          }
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Service Modal - Complete Form */}
      <AnimatePresence>
        {showServiceModal && selectedProduct && (
          <ServiceModal
            isDark={isDark}
            product={selectedProduct}
            service={editingService}
            onClose={() => {
              setShowServiceModal(false)
              setEditingService(null)
            }}
            onSave={async (serviceData) => {
              try {
                const method = editingService ? 'PUT' : 'POST'
                const url = editingService
                  ? `/api/products/${selectedProduct.id}/services/${editingService.id}`
                  : `/api/products/${selectedProduct.id}/services`

                const response = await fetch(url, {
                  method,
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(serviceData)
                })

                const data = await response.json()

                if (data.success) {
                  showNotification('success', 'Éxito', editingService ? 'Servicio actualizado' : 'Servicio creado')
                  setShowServiceModal(false)
                  setEditingService(null)
                  fetchProducts()
                } else {
                  showNotification('error', 'Error', data.error || 'Error al guardar servicio')
                }
              } catch (error) {
                showNotification('error', 'Error', 'Error de conexión')
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Pricing Modal - Complete Form */}
      <AnimatePresence>
        {showPricingModal && selectedProduct && (
          <PricingModal
            isDark={isDark}
            product={selectedProduct}
            marginHealth={getMarginHealthForProduct(selectedProduct.id)}
            onClose={() => setShowPricingModal(false)}
            onSave={async (pricingData) => {
              try {
                const response = await fetch(`/api/companies/current/products/${selectedProduct.id}/pricing`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(pricingData)
                })

                const data = await response.json()

                if (data.success) {
                  showNotification('success', 'Éxito', 'Precios actualizados')
                  setShowPricingModal(false)
                  fetchProducts()
                  fetchMarginHealth()
                } else {
                  showNotification('error', 'Error', data.error || 'Error al guardar precios')
                }
              } catch (error) {
                showNotification('error', 'Error', 'Error de conexión')
              }
            }}
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  )
}

// ============== ServiceModal Component ==============
interface ServiceModalProps {
  isDark: boolean
  product: Product
  service: ProductService | null
  onClose: () => void
  onSave: (data: any) => Promise<void>
}

function ServiceModal({ isDark, product, service, onClose, onSave }: ServiceModalProps) {
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    serviceCode: service?.serviceCode || '',
    serviceName: service?.serviceName || '',
    description: service?.description || '',
    sequenceOrder: service?.sequenceOrder || 1,
    inclusionType: service?.inclusionType || 'included',
    basePrice: service?.basePrice || 0,
    generatesBoxTracking: service?.generatesBoxTracking || false,
    requiresPriorBox: service?.requiresPriorBox || false,
    isMandatory: service?.isMandatory ?? true,
    isActive: service?.isActive !== false
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.serviceCode || !formData.serviceName) {
      return
    }
    setSaving(true)
    try {
      await onSave(formData)
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className={`w-full max-w-2xl rounded-2xl ${isDark ? 'bg-gray-800' : 'bg-white'} p-6 shadow-xl max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {service ? 'Editar Servicio' : 'Nuevo Servicio'}
            </h2>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Producto: {product.name}
            </p>
          </div>
          <span className={`px-2 py-1 text-xs rounded ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
            {product.code}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Código del Servicio *
              </label>
              <input
                type="text"
                required
                value={formData.serviceCode}
                onChange={(e) => setFormData({ ...formData, serviceCode: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                placeholder="ENTREGA_CAJA"
                className={`w-full px-3 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Nombre del Servicio *
              </label>
              <input
                type="text"
                required
                value={formData.serviceName}
                onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
                placeholder="Entrega de Caja"
                className={`w-full px-3 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Descripción
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              placeholder="Descripción opcional del servicio"
              className={`w-full px-3 py-2 rounded-lg border ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Orden de Secuencia
              </label>
              <input
                type="number"
                min="1"
                value={formData.sequenceOrder}
                onChange={(e) => setFormData({ ...formData, sequenceOrder: parseInt(e.target.value) || 1 })}
                className={`w-full px-3 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Tipo de Inclusión
              </label>
              <select
                value={formData.inclusionType}
                onChange={(e) => setFormData({ ...formData, inclusionType: e.target.value as any })}
                className={`w-full px-3 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              >
                <option value="included">Incluido</option>
                <option value="optional">Opcional</option>
                <option value="addon">Adicional</option>
              </select>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Precio Base ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.basePrice}
                onChange={(e) => setFormData({ ...formData, basePrice: parseFloat(e.target.value) || 0 })}
                className={`w-full px-3 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>
          </div>

          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <p className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Opciones del Servicio
            </p>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isMandatory}
                  onChange={(e) => setFormData({ ...formData, isMandatory: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Obligatorio
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.generatesBoxTracking}
                  onChange={(e) => setFormData({ ...formData, generatesBoxTracking: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Genera Tracking de Caja
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.requiresPriorBox}
                  onChange={(e) => setFormData({ ...formData, requiresPriorBox: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Requiere Caja Previa
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Activo
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={`px-4 py-2 rounded-lg ${
                isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              } disabled:opacity-50`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !formData.serviceCode || !formData.serviceName}
              className={`px-4 py-2 rounded-lg ${
                isDark
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              } disabled:opacity-50 flex items-center gap-2`}
            >
              {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ============== PricingModal Component ==============
interface PricingModalProps {
  isDark: boolean
  product: Product
  marginHealth?: MarginHealth
  onClose: () => void
  onSave: (data: any) => Promise<void>
}

function PricingModal({ isDark, product, marginHealth, onClose, onSave }: PricingModalProps) {
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    miCosto: product.companyPricing?.miCosto ?? product.miCosto,
    precioVenta: product.companyPricing?.precioVenta ?? product.precioPublico,
  })

  const calculatedMargin = formData.precioVenta - formData.miCosto
  const marginPercent = formData.precioVenta > 0 ? (calculatedMargin / formData.precioVenta) * 100 : 0
  const netMargin = marginHealth ? calculatedMargin - marginHealth.totalComisiones : calculatedMargin

  const getMarginStatus = () => {
    if (netMargin <= 0) return 'critical'
    if (marginPercent < 10) return 'warning'
    return 'healthy'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(formData)
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className={`w-full max-w-xl rounded-2xl ${isDark ? 'bg-gray-800' : 'bg-white'} p-6 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Configurar Precios
            </h2>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {product.name}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Catalog Prices */}
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
            <p className={`text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Precios del Catálogo (Referencia)
            </p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className={isDark ? 'text-gray-500' : 'text-gray-400'}>Mi Costo</p>
                <p className={isDark ? 'text-gray-300' : 'text-gray-700'}>${product.miCosto.toFixed(2)}</p>
              </div>
              <div>
                <p className={isDark ? 'text-gray-500' : 'text-gray-400'}>Precio Mayorista</p>
                <p className={isDark ? 'text-gray-300' : 'text-gray-700'}>${product.precioMayorista.toFixed(2)}</p>
              </div>
              <div>
                <p className={isDark ? 'text-gray-500' : 'text-gray-400'}>Precio Público</p>
                <p className={isDark ? 'text-gray-300' : 'text-gray-700'}>${product.precioPublico.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Company-specific prices */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Mi Costo (Empresa) $
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.miCosto}
                onChange={(e) => setFormData({ ...formData, miCosto: parseFloat(e.target.value) || 0 })}
                className={`w-full px-3 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Precio de Venta $
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.precioVenta}
                onChange={(e) => setFormData({ ...formData, precioVenta: parseFloat(e.target.value) || 0 })}
                className={`w-full px-3 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>
          </div>

          {/* Margin Calculator */}
          <div className={`p-4 rounded-lg border-2 ${
            getMarginStatus() === 'critical'
              ? isDark ? 'border-red-500/50 bg-red-900/20' : 'border-red-300 bg-red-50'
              : getMarginStatus() === 'warning'
                ? isDark ? 'border-yellow-500/50 bg-yellow-900/20' : 'border-yellow-300 bg-yellow-50'
                : isDark ? 'border-green-500/50 bg-green-900/20' : 'border-green-300 bg-green-50'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              {getMarginStatus() === 'critical' ? (
                <AlertCircle className="w-5 h-5 text-red-500" />
              ) : getMarginStatus() === 'warning' ? (
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              <span className={`font-medium ${
                getMarginStatus() === 'critical'
                  ? 'text-red-500'
                  : getMarginStatus() === 'warning'
                    ? 'text-yellow-500'
                    : 'text-green-500'
              }`}>
                {getMarginStatus() === 'critical' ? 'Margen Crítico' :
                  getMarginStatus() === 'warning' ? 'Margen Bajo' : 'Margen Saludable'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>Margen Bruto</p>
                <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  ${calculatedMargin.toFixed(2)} <span className="text-sm font-normal">({marginPercent.toFixed(1)}%)</span>
                </p>
              </div>
              {marginHealth && (
                <>
                  <div>
                    <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>Total Comisiones</p>
                    <p className={`text-lg font-bold ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                      -${marginHealth.totalComisiones.toFixed(2)}
                    </p>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-dashed ${isDark ? 'border-gray-600' : 'border-gray-300'}">
                    <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>Margen Neto</p>
                    <p className={`text-2xl font-bold ${
                      netMargin <= 0 ? 'text-red-500' : netMargin < 5 ? 'text-yellow-500' : 'text-green-500'
                    }`}>
                      ${netMargin.toFixed(2)}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={`px-4 py-2 rounded-lg ${
                isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              } disabled:opacity-50`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`px-4 py-2 rounded-lg ${
                isDark
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              } disabled:opacity-50 flex items-center gap-2`}
            >
              {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
              {saving ? 'Guardando...' : 'Guardar Precios'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
