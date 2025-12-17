'use client'

import { useState, useEffect } from 'react'
import {
  Smartphone,
  Search,
  Loader2,
  X,
  Check,
  Globe,
  ChevronDown,
} from 'lucide-react'

interface AvailableProduct {
  id: number
  externalId: number
  name: string
  slug: string
  description: string
  baseCost: number
  countryCode: string
  countryName: string
  phonePattern: string
  isActive: boolean
  pricing: {
    marginType: 'percentage' | 'fixed'
    marginValue: number
    sellingPrice: number | null
    isEnabled: boolean
  } | null
}

interface Country {
  country_code: string
  country_name: string
}

interface RechargeProductSelectorProps {
  onClose: () => void
  onProductSelected: (product: AvailableProduct) => void
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
  const [products, setProducts] = useState<AvailableProduct[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCountry, setSelectedCountry] = useState<string>('')
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/recharges/products?limit=500')
        const data = await response.json()

        if (data.success) {
          // Show only products that are NOT yet configured (no pricing)
          const availableProducts = data.data.products.filter(
            (p: AvailableProduct) => p.pricing === null || !p.pricing.isEnabled
          )
          setProducts(availableProducts)
          setCountries(data.data.countries || [])
        } else {
          setError(data.error || 'Error cargando productos')
        }
      } catch (err: any) {
        setError(err.message || 'Error de conexion')
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [])

  const filteredProducts = products.filter((product) => {
    const matchesSearch = searchTerm === '' ||
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.countryName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCountry = selectedCountry === '' || product.countryCode === selectedCountry
    return matchesSearch && matchesCountry
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Smartphone className="w-6 h-6 text-white" />
            <div>
              <h3 className="text-lg font-bold text-white">Agregar Producto de Recarga</h3>
              <p className="text-sm text-white/80">Selecciona un producto de UnivCell</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Search and Filter */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex gap-3 flex-shrink-0">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Country Filter */}
          <div className="relative">
            <button
              onClick={() => setShowCountryDropdown(!showCountryDropdown)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Globe className="w-5 h-5 text-gray-400" />
              <span>{selectedCountry ? countries.find(c => c.country_code === selectedCountry)?.country_name || selectedCountry : 'Todos los paises'}</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {showCountryDropdown && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-10 max-h-64 overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedCountry('')
                    setShowCountryDropdown(false)
                  }}
                  className={`w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${
                    selectedCountry === '' ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' : 'text-gray-700 dark:text-gray-200'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  Todos los paises
                  {selectedCountry === '' && <Check className="w-4 h-4 ml-auto" />}
                </button>
                {countries.map((country) => (
                  <button
                    key={country.country_code}
                    onClick={() => {
                      setSelectedCountry(country.country_code)
                      setShowCountryDropdown(false)
                    }}
                    className={`w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${
                      selectedCountry === country.country_code ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    <span className="text-lg">{getCountryFlag(country.country_code)}</span>
                    {country.country_name}
                    {selectedCountry === country.country_code && <Check className="w-4 h-4 ml-auto" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500">{error}</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <Smartphone className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {products.length === 0 ? 'No hay productos disponibles' : 'Sin resultados'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {products.length === 0
                  ? 'Todos los productos ya estan configurados o necesitas sincronizar desde UnivCell'
                  : 'Intenta con otro termino de busqueda o pais'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => onProductSelected(product)}
                  className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-md transition-all text-left group"
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-purple-500 to-purple-600 text-2xl flex-shrink-0">
                    {getCountryFlag(product.countryCode)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-white truncate">
                      {product.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {product.countryName}
                    </div>
                    <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mt-1">
                      Costo: {formatCurrency(product.baseCost)}
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <Check className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {filteredProducts.length} productos disponibles
            </span>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-xl transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
