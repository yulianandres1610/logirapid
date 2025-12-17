'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
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
  Plus,
  X,
  Calendar,
  DollarSign,
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

interface RechargeProductManagerProps {
  onOpenModal?: () => void
  onProductsChange?: () => void
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

export function RechargeProductManager({ onOpenModal, onProductsChange }: RechargeProductManagerProps) {
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
  const [showPromoModal, setShowPromoModal] = useState(false)
  const [promoProduct, setPromoProduct] = useState<RechargeProduct | null>(null)

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
        onProductsChange?.()
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
    onProductsChange?.()
  }

  const handleShowPromo = (product: RechargeProduct) => {
    setPromoProduct(product)
    setShowPromoModal(true)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
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
      {/* Header with Button and Balance */}
      <div className="flex items-center justify-between">
        {/* Nuevo Producto Button */}
        <button
          onClick={onOpenModal}
          className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium rounded-xl flex items-center gap-2 shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 whitespace-nowrap"
        >
          <Plus className="w-5 h-5" />
          Nuevo Producto
        </button>

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

      {/* Products Table */}
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
            Usa el boton <span className="font-medium">"Nuevo Producto"</span> para agregar productos de UnivCell
          </p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden border bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-800">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Producto
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Costo
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Venta
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Margen
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Promo
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Estado
                </th>
                <th className="px-6 py-4 w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {products.map((product, idx) => (
                <motion.tr
                  key={product.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03, duration: 0.3 }}
                  className="group transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-purple-500 to-purple-600 text-2xl">
                        {getCountryFlag(product.countryCode)}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {product.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {product.countryName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-base font-semibold text-gray-500 dark:text-gray-400">
                      {formatCurrency(product.baseCost)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {product.pricing?.sellingPrice
                        ? formatCurrency(product.pricing.sellingPrice)
                        : '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30">
                      {product.pricing?.marginType === 'percentage'
                        ? `+${product.pricing.marginValue}%`
                        : `+${formatCurrency(product.pricing?.marginValue || 0)}`}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {product.promotions.length > 0 ? (
                      <button
                        onClick={() => handleShowPromo(product)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
                        title="Ver promociones"
                      >
                        <Gift className="w-3.5 h-3.5" />
                        Promo
                      </button>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Activo
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenPricing(product)}
                        className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400"
                        title="Editar precio"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product)}
                        className="p-2 rounded-lg transition-colors hover:bg-red-50 dark:hover:bg-red-500/20 text-red-500 dark:text-red-400"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
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

      {/* Promotion Info Modal */}
      {showPromoModal && promoProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Gift className="w-6 h-6 text-white" />
                <div>
                  <h3 className="text-lg font-bold text-white">Promociones</h3>
                  <p className="text-sm text-white/80">{promoProduct.name}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPromoModal(false)
                  setPromoProduct(null)
                }}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
              {promoProduct.promotions.map((promo) => (
                <div
                  key={promo.id}
                  className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4"
                >
                  {/* Promo Summary */}
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                    {promo.summary}
                  </h4>

                  {/* Promo Description */}
                  {promo.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                      {promo.description}
                    </p>
                  )}

                  {/* Promo Details */}
                  <div className="flex flex-wrap gap-3 text-sm">
                    {promo.minAmount > 0 && (
                      <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg">
                        <DollarSign className="w-4 h-4 text-green-500" />
                        <span className="text-gray-600 dark:text-gray-300">
                          Min: <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(promo.minAmount)}</span>
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg">
                      <Calendar className="w-4 h-4 text-blue-500" />
                      <span className="text-gray-600 dark:text-gray-300">
                        {formatDate(promo.validFrom)} - {formatDate(promo.validTo)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
              <button
                onClick={() => {
                  setShowPromoModal(false)
                  setPromoProduct(null)
                }}
                className="w-full py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
