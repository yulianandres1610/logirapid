'use client'

import { useState, useEffect } from 'react'
import {
  X,
  DollarSign,
  Percent,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Gift,
  Smartphone,
} from 'lucide-react'

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
  isPromotion?: boolean
  providerAmount?: number | null
  univcellProductId?: number
  validFrom?: string
  validTo?: string
  pricing: {
    id: number
    marginType: 'percentage' | 'fixed'
    marginValue: number
    sellingPrice: number | null
    costPrice?: number
    isEnabled: boolean
    isManualPricing?: boolean
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

interface RechargePricingModalProps {
  product: RechargeProduct
  onClose: () => void
  onSave: () => void
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

export function RechargePricingModal({
  product,
  onClose,
  onSave,
}: RechargePricingModalProps) {
  // Determine if this is a product with manual pricing
  const isManualPricing = product.pricing?.isManualPricing || false

  // State for margin-based pricing
  const [marginType, setMarginType] = useState<'percentage' | 'fixed'>(
    product.pricing?.marginType || 'percentage'
  )
  const [marginValue, setMarginValue] = useState<string>(
    product.pricing?.marginValue?.toString() || '20'
  )
  const [isEnabled, setIsEnabled] = useState(product.pricing?.isEnabled ?? true)

  // State for manual pricing
  const [productName, setProductName] = useState(product.name || '')
  const [productDescription, setProductDescription] = useState(product.description || '')
  const [costPrice, setCostPrice] = useState<string>(
    product.pricing?.costPrice?.toString() || product.baseCost?.toString() || '0'
  )
  const [sellingPrice, setSellingPrice] = useState<string>(
    product.pricing?.sellingPrice?.toString() || '0'
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Calculate selling price for margin-based pricing
  const calculatedPrice = isManualPricing
    ? parseFloat(sellingPrice) || 0
    : (() => {
        const value = parseFloat(marginValue) || 0
        if (marginType === 'percentage') {
          return product.baseCost * (1 + value / 100)
        }
        return product.baseCost + value
      })()

  // Calculate profit
  const baseCostForProfit = isManualPricing ? (parseFloat(costPrice) || 0) : product.baseCost
  const profit = calculatedPrice - baseCostForProfit

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      if (isManualPricing) {
        // Validate manual pricing fields
        if (!productName.trim()) {
          setError('El nombre es requerido')
          setSaving(false)
          return
        }

        const cost = parseFloat(costPrice)
        const selling = parseFloat(sellingPrice)

        if (isNaN(cost) || cost <= 0) {
          setError('El precio de costo debe ser mayor a 0')
          setSaving(false)
          return
        }

        if (isNaN(selling) || selling <= 0) {
          setError('El precio de venta debe ser mayor a 0')
          setSaving(false)
          return
        }

        if (selling < cost) {
          setError('El precio de venta no puede ser menor al precio de costo')
          setSaving(false)
          return
        }

        // Update product with manual pricing
        const response = await fetch(`/api/recharges/products/${product.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: productName.trim(),
            description: productDescription.trim() || null,
            costPrice: cost,
            sellingPrice: selling,
            isActive: isEnabled,
          }),
        })

        const data = await response.json()

        if (data.success) {
          setSuccess(true)
          setTimeout(() => {
            onSave()
          }, 1000)
        } else {
          setError(data.error || 'Error guardando configuracion')
        }
      } else {
        // Margin-based pricing
        const response = await fetch(`/api/recharges/products/${product.id}/pricing`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            marginType,
            marginValue: parseFloat(marginValue) || 0,
            isEnabled,
          }),
        })

        const data = await response.json()

        if (data.success) {
          setSuccess(true)
          setTimeout(() => {
            onSave()
          }, 1000)
        } else {
          setError(data.error || 'Error guardando configuracion')
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexion')
    } finally {
      setSaving(false)
    }
  }

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{getCountryFlag(product.countryCode)}</span>
            <div>
              <h2 className="text-lg font-semibold text-white">{product.name}</h2>
              <p className="text-purple-200 text-sm">{product.countryName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {isManualPricing ? (
            <>
              {/* Manual Pricing Mode - Edit product details */}
              {/* Product Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Nombre del producto"
                />
              </div>

              {/* Product Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descripcion
                </label>
                <textarea
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="Descripcion del producto"
                />
              </div>

              {/* Provider Amount (read-only) */}
              {product.providerAmount && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400 text-sm">
                      Monto al Proveedor (fijo)
                    </span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatCurrency(product.providerAmount)}
                    </span>
                  </div>
                </div>
              )}

              {/* Cost and Selling Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Precio de Costo *
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <input
                      type="number"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      min="0.01"
                      step="0.0001"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Precio de Venta *
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <input
                      type="number"
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                      min="0.01"
                      step="0.0001"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Profit Preview */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <div className="flex justify-between items-center">
                  <span className="text-green-700 dark:text-green-300 text-sm">
                    Ganancia por recarga
                  </span>
                  <span className="text-xl font-bold text-green-600 dark:text-green-400">
                    +{formatCurrency(profit > 0 ? profit : 0)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Margin-based Pricing Mode */}
              {/* Product Info */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500 dark:text-gray-400 text-sm">
                    Costo Base (UnivCell)
                  </span>
                  <span className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(product.baseCost)}
                  </span>
                </div>
                {product.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {product.description}
                  </p>
                )}
              </div>

              {/* Promotions */}
              {product.promotions.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2 text-exa-primary dark:text-red-400 mb-2">
                    <Gift className="w-4 h-4" />
                    <span className="font-medium text-sm">Promociones Activas</span>
                  </div>
                  {product.promotions.map((promo) => (
                    <div key={promo.id} className="text-sm text-red-700 dark:text-red-300">
                      {promo.summary}
                    </div>
                  ))}
                </div>
              )}

              {/* Margin Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Tipo de Margen
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMarginType('percentage')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                      marginType === 'percentage'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    <Percent className="w-5 h-5" />
                    <span className="font-medium">Porcentaje</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarginType('fixed')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                      marginType === 'fixed'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    <DollarSign className="w-5 h-5" />
                    <span className="font-medium">Monto Fijo</span>
                  </button>
                </div>
              </div>

              {/* Margin Value */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {marginType === 'percentage' ? 'Porcentaje de Ganancia' : 'Monto de Ganancia'}
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {marginType === 'percentage' ? (
                      <Percent className="w-5 h-5" />
                    ) : (
                      <DollarSign className="w-5 h-5" />
                    )}
                  </div>
                  <input
                    type="number"
                    value={marginValue}
                    onChange={(e) => setMarginValue(e.target.value)}
                    min="0"
                    step={marginType === 'percentage' ? '1' : '0.01'}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg"
                    placeholder={marginType === 'percentage' ? '20' : '1.00'}
                  />
                </div>
              </div>

              {/* Price Preview */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-green-700 dark:text-green-300 text-sm">
                    Precio de Venta
                  </span>
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(calculatedPrice)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-green-600 dark:text-green-400">Ganancia por recarga</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    +{formatCurrency(profit)}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <span className="font-medium text-gray-900 dark:text-white">
                Habilitado para venta
              </span>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Los usuarios podran comprar este producto
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsEnabled(!isEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                isEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  isEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-red-700 dark:text-red-400 text-sm">{error}</span>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-green-700 dark:text-green-400 text-sm">
                Configuracion guardada exitosamente
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || success}
            className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
