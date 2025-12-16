'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  Smartphone,
  Gift,
  Check,
  X,
  Settings,
  Globe,
  Loader2,
  AlertCircle,
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
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [credits, setCredits] = useState<number | null>(null)
  const [creditsLoading, setCreditsLoading] = useState(true)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCountry, setSelectedCountry] = useState<string>('')

  // Modal
  const [selectedProduct, setSelectedProduct] = useState<RechargeProduct | null>(null)
  const [showPricingModal, setShowPricingModal] = useState(false)

  // Sync status
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [apiAccessLimited, setApiAccessLimited] = useState(false)
  const [availableCountries, setAvailableCountries] = useState<Array<{code: string, name: string}>>([])
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

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
        setProducts(data.data.products)
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

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch('/api/recharges/sync')
      const data = await response.json()

      if (data.success && data.data.lastSync) {
        setLastSync(data.data.lastSync.completed_at)
      }
    } catch (err) {
      console.error('Error fetching sync status:', err)
    }
  }

  const handleSync = async () => {
    try {
      setSyncing(true)
      setError(null)
      setSyncMessage(null)

      const response = await fetch('/api/recharges/sync', {
        method: 'POST',
      })
      const data = await response.json()

      if (data.success) {
        await fetchProducts()
        await fetchSyncStatus()
        await fetchCredits()
        setSyncMessage(`Sincronizacion exitosa: ${data.data?.productsCreated || 0} nuevos, ${data.data?.productsUpdated || 0} actualizados`)
      } else if (data.apiAccessLimited) {
        setApiAccessLimited(true)
        setAvailableCountries(data.data?.availableCountries || [])
        setSyncMessage(data.message)
      } else {
        setError(data.error || 'Error sincronizando productos')
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexion')
    } finally {
      setSyncing(false)
    }
  }

  const handleOpenPricing = (product: RechargeProduct) => {
    setSelectedProduct(product)
    setShowPricingModal(true)
  }

  const handlePricingSaved = () => {
    setShowPricingModal(false)
    setSelectedProduct(null)
    fetchProducts()
  }

  useEffect(() => {
    fetchProducts()
    fetchCredits()
    fetchSyncStatus()
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-purple-500" />
            Recargas Telefonicas
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Productos sincronizados desde UnivCell
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Credits Display */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg shadow-md">
            <div className="text-xs opacity-80">Saldo UnivCell</div>
            <div className="text-lg font-bold">
              {creditsLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : credits !== null ? (
                formatCurrency(credits)
              ) : (
                'N/A'
              )}
            </div>
          </div>

          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        </div>
      </div>

      {/* Last Sync Info */}
      {lastSync && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Ultima sincronizacion: {formatDate(lastSync)}
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
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Country Filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none min-w-[200px]"
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

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* API Access Limited Warning */}
      {apiAccessLimited && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-amber-800 dark:text-amber-300">
                Acceso API Limitado
              </h4>
              <p className="text-amber-700 dark:text-amber-400 text-sm mt-1">
                {syncMessage || 'Tu cuenta UnivCell necesita activacion de reseller. Contacta a soporte de UnivCell.'}
              </p>
              {availableCountries.length > 0 && (
                <div className="mt-3">
                  <p className="text-amber-700 dark:text-amber-400 text-sm font-medium">
                    Paises disponibles en tu cuenta:
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {availableCountries.map((country) => (
                      <span
                        key={country.code}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 rounded text-sm"
                      >
                        {getCountryFlag(country.code)} {country.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3 text-sm">
                <a
                  href="mailto:soporte@univcell.com"
                  className="text-amber-600 dark:text-amber-400 hover:underline font-medium"
                >
                  Contactar soporte UnivCell
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {syncMessage && !apiAccessLimited && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-500" />
          <span className="text-green-700 dark:text-green-400">{syncMessage}</span>
        </div>
      )}

      {/* Products Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <Smartphone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No hay productos
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Sincroniza los productos desde UnivCell para comenzar
          </p>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizar Ahora
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">
                    {getCountryFlag(product.countryCode)}
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                      {product.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
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
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Costo:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(product.baseCost)}
                  </span>
                </div>

                {product.pricing ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Venta:</span>
                      <span className="font-bold text-green-600 dark:text-green-400">
                        {product.pricing.sellingPrice
                          ? formatCurrency(product.pricing.sellingPrice)
                          : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Margen:</span>
                      <span className="text-purple-600 dark:text-purple-400">
                        {product.pricing.marginType === 'percentage'
                          ? `${product.pricing.marginValue}%`
                          : formatCurrency(product.pricing.marginValue)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1 text-center">
                    Sin precio configurado
                  </div>
                )}
              </div>

              {/* Status & Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-1">
                  {product.pricing?.isEnabled ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                      <Check className="w-3 h-3" />
                      Activo
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <X className="w-3 h-3" />
                      Inactivo
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleOpenPricing(product)}
                  className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium"
                >
                  <Settings className="w-4 h-4" />
                  {product.pricing ? 'Editar' : 'Configurar'}
                </button>
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
