'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Package,
  Plane,
  Ship,
  Loader2,
  AlertCircle,
  Edit2,
  Trash2,
  Plus,
  DollarSign,
  Search,
  Filter,
  RefreshCw,
} from 'lucide-react'
import { ApaCargoProductSelector } from './ApaCargoProductSelector'
import { ApaCargoProductEditModal } from './ApaCargoProductEditModal'

interface ApaCargoProduct {
  id: number
  apacargoProductId: number
  originalName: string
  originalDescription: string | null
  customName: string
  customDescription: string | null
  slug: string | null
  supportsAir: boolean
  supportsSea: boolean
  miCosto: number
  precioMayorista: number
  precioPublico: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface ApaCargoProductManagerProps {
  onProductsChange?: () => void
  hideHeader?: boolean
}

export function ApaCargoProductManager({ onProductsChange, hideHeader = false }: ApaCargoProductManagerProps) {
  const [products, setProducts] = useState<ApaCargoProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'air' | 'sea' | 'both'>('all')

  // Modals
  const [showProductSelector, setShowProductSelector] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ApaCargoProduct | null>(null)

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      let url = '/api/apacargo/shipping-products?active=true'

      if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`
      }

      if (filterType === 'air') {
        url += '&supportsAir=true&supportsSea=false'
      } else if (filterType === 'sea') {
        url += '&supportsAir=false&supportsSea=true'
      } else if (filterType === 'both') {
        url += '&supportsAir=true&supportsSea=true'
      }

      const response = await fetch(url)
      const data = await response.json()

      if (data.success) {
        setProducts(data.data.products)
      } else {
        setError(data.error || 'Error cargando productos')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error de conexion'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [searchTerm, filterType])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const handleEditProduct = (product: ApaCargoProduct) => {
    setSelectedProduct(product)
    setShowEditModal(true)
  }

  const handleDeleteProduct = async (product: ApaCargoProduct) => {
    if (!confirm(`¿Eliminar "${product.customName}" del catalogo?`)) return

    try {
      const response = await fetch(`/api/apacargo/shipping-products/${product.id}`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (data.success) {
        fetchProducts()
        onProductsChange?.()
      } else {
        alert(data.error || 'Error eliminando producto')
      }
    } catch (err) {
      console.error('Error deleting product:', err)
      alert('Error de conexion')
    }
  }

  const handleProductCreated = () => {
    setShowProductSelector(false)
    fetchProducts()
    onProductsChange?.()
  }

  const handleProductUpdated = () => {
    setShowEditModal(false)
    setSelectedProduct(null)
    fetchProducts()
    onProductsChange?.()
  }

  const getShippingTypeLabel = (supportsAir: boolean, supportsSea: boolean) => {
    if (supportsAir && supportsSea) return 'Aereo y Maritimo'
    if (supportsAir) return 'Solo Aereo'
    if (supportsSea) return 'Solo Maritimo'
    return 'Sin tipo'
  }

  const getShippingTypeColor = (supportsAir: boolean, supportsSea: boolean) => {
    if (supportsAir && supportsSea) return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    if (supportsAir) return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    if (supportsSea) return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Package className="w-6 h-6 text-exa-primary" />
              Productos de Paqueteria ApaCargo
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Gestiona los productos de envio disponibles para tus clientes
            </p>
          </div>
          <button
            onClick={() => setShowProductSelector(true)}
            className="flex items-center gap-2 px-4 py-2 bg-exa-primary hover:bg-exa-primary/90 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Agregar Producto
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar producto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-exa-primary"
          />
        </div>

        {/* Filter by type */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as typeof filterType)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-exa-primary"
          >
            <option value="all">Todos</option>
            <option value="air">Solo Aereo</option>
            <option value="sea">Solo Maritimo</option>
            <option value="both">Aereo y Maritimo</option>
          </select>
        </div>

        {/* Refresh */}
        <button
          onClick={fetchProducts}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-gray-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-exa-primary animate-spin" />
        </div>
      )}

      {/* Products Grid */}
      {!loading && products.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            No hay productos configurados
          </h3>
          <p className="text-gray-400 mb-4">
            Agrega productos de ApaCargo para comenzar a ofrecerlos
          </p>
          <button
            onClick={() => setShowProductSelector(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-exa-primary hover:bg-exa-primary/90 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Agregar Primer Producto
          </button>
        </div>
      )}

      {!loading && products.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition-colors"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate">{product.customName}</h3>
                  {product.customDescription && (
                    <p className="text-gray-400 text-sm mt-1 line-clamp-2">
                      {product.customDescription}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => handleEditProduct(product)}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product)}
                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Shipping Type Badge */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${getShippingTypeColor(product.supportsAir, product.supportsSea)}`}>
                  {product.supportsAir && <Plane className="w-3.5 h-3.5" />}
                  {product.supportsSea && <Ship className="w-3.5 h-3.5" />}
                  {getShippingTypeLabel(product.supportsAir, product.supportsSea)}
                </span>
              </div>

              {/* Prices */}
              <div className="space-y-2 pt-3 border-t border-gray-700/50">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Mi Costo:</span>
                  <span className="text-white font-medium flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-gray-500" />
                    {product.miCosto.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Precio Mayorista:</span>
                  <span className="text-green-400 font-medium flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-green-600" />
                    {product.precioMayorista.toFixed(2)}
                  </span>
                </div>
                {product.precioPublico && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Precio Publico:</span>
                    <span className="text-blue-400 font-medium flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                      {product.precioPublico.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-700/30">
                  <span className="text-gray-400">Ganancia:</span>
                  <span className="text-exa-primary font-semibold">
                    ${(product.precioMayorista - product.miCosto).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* ApaCargo ID */}
              <div className="mt-3 pt-3 border-t border-gray-700/50">
                <span className="text-xs text-gray-500">
                  ID ApaCargo: {product.apacargoProductId}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Product Selector Modal */}
      {showProductSelector && (
        <ApaCargoProductSelector
          onClose={() => setShowProductSelector(false)}
          onProductCreated={handleProductCreated}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && selectedProduct && (
        <ApaCargoProductEditModal
          product={selectedProduct}
          onClose={() => {
            setShowEditModal(false)
            setSelectedProduct(null)
          }}
          onSaved={handleProductUpdated}
        />
      )}
    </div>
  )
}
