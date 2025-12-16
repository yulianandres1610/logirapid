'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Filter,
  Smartphone,
  Gift,
  Check,
  X,
  Settings,
  Loader2,
  AlertCircle,
  Wallet,
  TrendingUp,
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
        // Filter only products that have pricing configured
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

  const handleDisableProduct = async (product: RechargeProduct) => {
    if (!confirm(`¿Desactivar "${product.name}" del catalogo?`)) return

    try {
      const response = await fetch(`/api/recharges/products/${product.id}/pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marginType: product.pricing?.marginType || 'percentage',
          marginValue: product.pricing?.marginValue || 0,
          isEnabled: false,
        }),
      })
      const data = await response.json()
      if (data.success) {
        fetchProducts()
      }
    } catch (err) {
      console.error('Error disabling product:', err)
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

  // Calculate totals
  const totalProducts = products.length
  const totalMargin = products.reduce((acc, p) => {
    if (p.pricing?.sellingPrice && p.baseCost) {
      return acc + (p.pricing.sellingPrice - p.baseCost)
    }
    return acc
  }, 0)

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* UnivCell Balance */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80 flex items-center gap-1">
                <Wallet className="w-4 h-4" />
                Saldo UnivCell
              </p>
              <p className="text-3xl font-bold mt-1">
                {creditsLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : credits !== null ? (
                  formatCurrency(credits)
                ) : (
                  '$0.00'
                )}
              </p>
              <p className="text-xs mt-2 opacity-70">
                Disponible para recargas
              </p>
            </div>
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
              <Wallet className="w-7 h-7" />
            </div>
          </div>
        </div>

        {/* Active Products */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Smartphone className="w-4 h-4" />
                Productos Activos
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {totalProducts}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Disponibles para agencias
              </p>
            </div>
            <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <Smartphone className="w-7 h-7 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        {/* Average Margin */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                Ganancia Promedio
              </p>
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {totalProducts > 0 ? formatCurrency(totalMargin / totalProducts) : '$0.00'}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Por producto vendido
              </p>
            </div>
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      {totalProducts > 0 && (
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
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

          {/* Country Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="pl-10 pr-8 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none min-w-[200px]"
            >
              <option value="">Todos los paises</option>
              {countries.map((country) => (
                <option key={country.country_code} value={country.country_code}>
                  {getCountryFlag(country.country_code)} {country.country_name}
                </option>
              ))}
            </select>
          </div>
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
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
            Agrega productos de recarga usando el boton "Nuevo Producto" y selecciona la categoria "Recarga"
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-xl hover:border-purple-300 dark:hover:border-purple-700 transition-all"
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
                  <span className="font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded-lg">
                    {product.pricing?.marginType === 'percentage'
                      ? `+${product.pricing.marginValue}%`
                      : `+${formatCurrency(product.pricing?.marginValue || 0)}`}
                  </span>
                </div>
              </div>

              {/* Status & Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-lg">
                  <Check className="w-3.5 h-3.5" />
                  Activo
                </span>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleOpenPricing(product)}
                    className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                    title="Editar precio"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDisableProduct(product)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    title="Desactivar"
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
