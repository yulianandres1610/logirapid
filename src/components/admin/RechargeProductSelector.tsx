'use client'

import { useState, useEffect } from 'react'
import {
  Smartphone,
  Loader2,
  X,
  RefreshCw,
  DollarSign,
  Gift,
} from 'lucide-react'
import { useNotifications } from '@/contexts/NotificationContext'

// UnivCell Product Option interface (from /api/recharges/univcell-products)
interface UnivCellProductOption {
  id: string              // 'product-7' or 'promo-xxx'
  univcellProductId: number
  name: string
  description: string | null
  type: 'product' | 'promotion'
  providerAmount: number  // price for products, min_amount for promotions
  pattern: string
  mask: string
  countryCode: string
  countryName: string
  validFrom?: string
  validTo?: string
  promotionSummary?: string
}

interface RechargeProductSelectorProps {
  onClose: () => void
  onProductSelected: (product: any) => void
}

// Country flag mapping
const getCountryFlag = (countryCode: string): string => {
  const flags: Record<string, string> = {
    CU: '🇨🇺',
    MX: '🇲🇽',
    DO: '🇩🇴',
    HT: '🇭🇹',
    US: '🇺🇸',
    ES: '🇪🇸',
    CO: '🇨🇴',
    VE: '🇻🇪',
    PE: '🇵🇪',
    AR: '🇦🇷',
    CL: '🇨🇱',
    BR: '🇧🇷',
  }
  return flags[countryCode] || '🌍'
}

export function RechargeProductSelector({ onClose, onProductSelected }: RechargeProductSelectorProps) {
  const { showNotification } = useNotifications()
  const [products, setProducts] = useState<UnivCellProductOption[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Selected product and form fields
  const [selectedProduct, setSelectedProduct] = useState<UnivCellProductOption | null>(null)
  const [productName, setProductName] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')

  const fetchProducts = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/recharges/univcell-products')
      const data = await response.json()

      if (data.success) {
        setProducts(data.data.products)
      } else {
        setError(data.error || 'Error cargando productos')
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    try {
      setSyncing(true)
      const response = await fetch('/api/recharges/sync', { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        await fetchProducts()
        showNotification('success', 'Exito', 'Productos sincronizados')
      }
    } catch (err) {
      console.error('Error syncing:', err)
    } finally {
      setSyncing(false)
    }
  }

  const handleSelectProduct = (product: UnivCellProductOption) => {
    setSelectedProduct(product)
    setProductName('')
    setProductDescription(product.description || '')
    setCostPrice('')
    setSellingPrice('')
    setError(null)
  }

  const handleCreateProduct = async () => {
    if (!selectedProduct) return

    if (!productName.trim()) {
      setError('El nombre del servicio es requerido')
      return
    }
    if (!costPrice || parseFloat(costPrice) <= 0) {
      setError('El precio de costo debe ser mayor a 0')
      return
    }
    if (!sellingPrice || parseFloat(sellingPrice) <= 0) {
      setError('El precio de venta debe ser mayor a 0')
      return
    }
    if (parseFloat(sellingPrice) < parseFloat(costPrice)) {
      setError('El precio de venta no puede ser menor al precio de costo')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/recharges/products/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: productName.trim(),
          description: productDescription.trim() || selectedProduct.description || null,
          univcellProductId: selectedProduct.univcellProductId,
          isPromotion: selectedProduct.type === 'promotion',
          promotionId: selectedProduct.type === 'promotion' ? selectedProduct.id : null,
          providerAmount: selectedProduct.providerAmount,
          costPrice: parseFloat(costPrice),
          sellingPrice: parseFloat(sellingPrice),
          pattern: selectedProduct.pattern || '',
          mask: selectedProduct.mask || '',
          countryCode: selectedProduct.countryCode,
          countryName: selectedProduct.countryName,
          validFrom: selectedProduct.validFrom || null,
          validTo: selectedProduct.validTo || null,
        })
      })
      const data = await response.json()
      if (data.success) {
        showNotification('success', 'Exito', 'Producto de recarga creado exitosamente')
        onProductSelected(data.data)
        onClose()
      } else {
        setError(data.error || 'Error creando producto')
      }
    } catch (err) {
      setError('Error de conexion')
    } finally {
      setSaving(false)
    }
  }

  const calculateProfit = () => {
    const cost = parseFloat(costPrice) || 0
    const selling = parseFloat(sellingPrice) || 0
    return selling - cost
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Smartphone className="w-6 h-6 text-white" />
            <div>
              <h3 className="text-lg font-bold text-white">Nuevo Producto de Recarga</h3>
              <p className="text-sm text-white/80">
                {selectedProduct ? 'Configura el producto' : 'Selecciona un producto de UnivCell'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!selectedProduct && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
                title="Sincronizar productos"
              >
                <RefreshCw className={`w-5 h-5 text-white ${syncing ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
          ) : !selectedProduct ? (
            // Product Selection View
            <div className="space-y-4">
              {products.length === 0 ? (
                <div className="text-center py-12">
                  <Smartphone className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    No hay productos disponibles
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Sincroniza los productos desde UnivCell
                  </p>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    Sincronizar
                  </button>
                </div>
              ) : (
                <>
                  {/* Products Section */}
                  {products.filter(p => p.type === 'product').length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-2 px-1 text-gray-500 dark:text-gray-400">
                        PRODUCTOS
                      </p>
                      <div className="space-y-2">
                        {products.filter(p => p.type === 'product').map(prod => (
                          <button
                            key={prod.id}
                            type="button"
                            onClick={() => handleSelectProduct(prod)}
                            className="w-full p-3 rounded-xl flex items-center gap-3 transition-all text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-2 border-transparent hover:border-purple-300 dark:hover:border-purple-600"
                          >
                            <span className="text-2xl">{getCountryFlag(prod.countryCode)}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate text-gray-900 dark:text-white">
                                {prod.name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {prod.countryName} - Monto: ${prod.providerAmount.toFixed(2)}
                              </p>
                            </div>
                            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                              Producto
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Promotions Section */}
                  {products.filter(p => p.type === 'promotion').length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-2 px-1 text-exa-primary dark:text-red-400">
                        PROMOCIONES
                      </p>
                      <div className="space-y-2">
                        {products.filter(p => p.type === 'promotion').map(prod => (
                          <button
                            key={prod.id}
                            type="button"
                            onClick={() => handleSelectProduct(prod)}
                            className="w-full p-3 rounded-xl flex items-center gap-3 transition-all text-left bg-gray-50 dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-2 border-transparent hover:border-red-300 dark:hover:border-red-600"
                          >
                            <span className="text-2xl">{getCountryFlag(prod.countryCode)}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate text-gray-900 dark:text-white">
                                {prod.name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Monto minimo: ${prod.providerAmount.toFixed(2)}
                                {prod.validTo && ` - Hasta: ${new Date(prod.validTo).toLocaleDateString('es-ES')}`}
                              </p>
                            </div>
                            <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 dark:bg-red-500/20 text-exa-primary dark:text-red-400">
                              Promo
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            // Product Configuration Form
            <div className="space-y-4">
              {/* Back Button */}
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="text-sm text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
              >
                ← Seleccionar otro producto
              </button>

              {/* Selected Product Info */}
              <div className={`p-4 rounded-xl ${
                selectedProduct.type === 'promotion'
                  ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  : 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{getCountryFlag(selectedProduct.countryCode)}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {selectedProduct.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {selectedProduct.type === 'promotion' ? 'Monto minimo' : 'Monto'}: ${selectedProduct.providerAmount.toFixed(2)} USD (fijo)
                    </p>
                    {selectedProduct.type === 'promotion' && selectedProduct.validTo && (
                      <p className="text-xs mt-1 text-exa-primary dark:text-red-400">
                        Valido hasta: {new Date(selectedProduct.validTo).toLocaleDateString('es-ES')}
                      </p>
                    )}
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    selectedProduct.type === 'promotion'
                      ? 'bg-red-100 dark:bg-red-500/20 text-exa-primary dark:text-red-400'
                      : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                  }`}>
                    {selectedProduct.type === 'promotion' ? 'Promo' : 'Producto'}
                  </span>
                </div>

                {/* Promotion Description */}
                {selectedProduct.type === 'promotion' && selectedProduct.description && (
                  <div className="p-3 rounded-lg text-sm bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
                    {selectedProduct.description}
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Form Fields */}
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Nombre del Servicio *
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Ej: Recarga Cubacel Ilimitada"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Descripcion
                </label>
                <textarea
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="Descripcion del servicio..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Precio de Costo * <span className="text-xs font-normal text-gray-500">(Tu costo real)</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Precio de Venta * <span className="text-xs font-normal text-gray-500">(Lo que cobras)</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Profit Display */}
              {costPrice && sellingPrice && (
                <div className={`p-3 rounded-lg flex items-center justify-between ${
                  calculateProfit() >= 0
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                }`}>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Ganancia estimada:
                  </span>
                  <span className={`text-lg font-bold ${
                    calculateProfit() >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    ${calculateProfit().toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-xl transition-colors"
            >
              Cancelar
            </button>
            {selectedProduct && (
              <button
                onClick={handleCreateProduct}
                disabled={saving || !productName.trim() || !costPrice || !sellingPrice}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Crear Producto'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
