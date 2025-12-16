'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Filter,
  Smartphone,
  Gift,
  Check,
  Loader2,
  AlertCircle,
  Wallet,
  Edit2,
  Trash2,
} from 'lucide-react'
import { RechargePricingModal } from './RechargePricingModal'

interface RechargeProduct {
  id: number
  externalId: number
  name: string
  slug: string
  description: string
  baseCost: number
  countryCode: string
  countryName: string
  phonePattern: string
  minAmount: number | null
  maxAmount: number | null
  acceptsRange: boolean
  isActive: boolean
  lastSyncedAt: string
  pricing: {
    id: number
    marginType: 'percentage' | 'fixed'
    marginValue: number
    sellingPrice: number | null
    isEnabled: boolean
  } | null
  promotions: Array<{
    id: number
    summary: string
    description: string
    minAmount: number
    validFrom: string
    validTo: string
  }>
}

interface Country {
  country_code: string
  country_name: string
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

export function RechargeProductManager() {
  const [products, setProducts] = useState<RechargeProduct[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [credits, setCredits] = useState<number | null>(null)
  const [creditsLoading, setCreditsLoading] = useState(true)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCountry, setSelectedCountry] = useState<string>('')

  // Modal
  const [selectedProduct, setSelectedProduct] = useState<RechargeProduct | null>(null)
  const [showPricingModal, setShowPricingModal] = useState(false)

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (selectedCountry) params.append('country', selectedCountry)
      if (searchTerm) params.append('search', searchTerm)

      const response = await fetch(`/api/recharges/products?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        // Filter only products that have pricing configured and enabled
        const configuredProducts = data.data.products.filter(
          (p: RechargeProduct) => p.pricing !== null && p.pricing.isEnabled
        )
        setProducts(configuredProducts)
        setCountries(data.data.countries)
      } else {
        setError(data.error || 'Error cargando productos')
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexion')
    } finally {
      setLoading(false)
    }
  }, [selectedCountry, searchTerm])

  const fetchCredits = async () => {
    try {
      setCreditsLoading(true)
      const response = await fetch('/api/recharges/credits')
      const data = await response.json()

      if (data.success && data.data.credits !== null) {
        setCredits(data.data.credits)
      }
    } catch (err) {
      console.error('Error fetching credits:', err)
    } finally {
      setCreditsLoading(false)
    }
  }

  const handleOpenPricing = (product: RechargeProduct) => {
    setSelectedProduct(product)
    setShowPricingModal(true)
  }

  const handleDeleteProduct = async (product: RechargeProduct) => {
    if (!confirm(`¿Eliminar "${product.name}" del catálogo?`)) return

    try {
      // Delete the pricing configuration completely
      const response = await fetch(`/api/recharges/products/${product.id}/pricing?companyId=`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (data.success) {
        fetchProducts()
      } else {
        alert(data.error || 'Error eliminando producto')
      }
    } catch (err) {
      console.error('Error deleting product:', err)
      alert('Error de conexión')
    }
  }

  const handlePricingSaved = () => {
    setShowPricingModal(false)
    setSelectedProduct(null)
    fetchProducts()
  }

  useEffect(() => {
    fetchProducts()
    fetchCredits()
  }, [fetchProducts])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm, selectedCountry, fetchProducts])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      {/* Header with Balance */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-purple-500" />
            Recargas Telefónicas
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Productos configurados para agencias
          </p>
        </div>

        {/* UnivCell Balance */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-xl shadow-md flex items-center gap-3">
          <Wallet className="w-5 h-5" />
          <div>
            <div className="text-xs opacity-80">Saldo UnivCell</div>
            <div className="text-lg font-bold">
              {creditsLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : credits !== null ? (
                formatCurrency(credits)
              ) : (
                '$0.00'
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters - only show if there are products */}
      {products.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {countries.length > 1 && (
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="pl-10 pr-8 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none min-w-[180px]"
              >
                <option value="">Todos los países</option>
                {countries.map((country) => (
                  <option key={country.country_code} value={country.country_code}>
                    {getCountryFlag(country.country_code)} {country.country_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Products Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <Smartphone className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Sin productos configurados
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Usa el botón <span className="font-medium">"Nuevo Producto"</span> y selecciona la categoría <span className="font-medium">"Recarga"</span> para agregar productos de UnivCell
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-lg hover:border-purple-300 dark:hover:border-purple-700 transition-all"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">
                    {getCountryFlag(product.countryCode)}
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {product.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {product.countryName}
                    </p>
                  </div>
                </div>
                {product.promotions.length > 0 && (
                  <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <Gift className="w-3 h-3" />
                    Promo
                  </span>
                )}
              </div>

              {/* Pricing Info */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Costo:</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {formatCurrency(product.baseCost)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Venta:</span>
                  <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {product.pricing?.sellingPrice
                      ? formatCurrency(product.pricing.sellingPrice)
                      : '-'}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Margen:</span>
                  <span className="font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded-lg text-sm">
                    {product.pricing?.marginType === 'percentage'
                      ? `+${product.pricing.marginValue}%`
                      : `+${formatCurrency(product.pricing?.marginValue || 0)}`}
                  </span>
                </div>
              </div>

              {/* Status & Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                  <Check className="w-3.5 h-3.5" />
                  Activo
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenPricing(product)}
                    className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                    title="Editar precio"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pricing Modal */}
      {showPricingModal && selectedProduct && (
        <RechargePricingModal
          product={selectedProduct}
          onClose={() => {
            setShowPricingModal(false)
            setSelectedProduct(null)
          }}
          onSave={handlePricingSaved}
        />
      )}
    </div>
  )
}
