'use client'

import { useState, useEffect } from 'react'
import { Package, DollarSign, Smartphone, Store, AlertCircle, Check, Edit3 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Product {
  id: number
  code: string
  name: string
  serviceCategory: string
  productType: string
  unitType: string
  pricingModel: string
  costPrice: number
  minPrice: number
}

interface ProductPrice {
  productId: number
  sellPrice: number
  costPrice?: number // Solo si es proveedor
}

interface ProductPricingStepProps {
  products: Product[]
  prices: ProductPrice[]
  onChange: (prices: ProductPrice[]) => void
  enabledCategories?: string[] // Categorías habilitadas para filtrar productos
  isProvider?: boolean // Si la empresa es proveedora
  providerCategories?: string[] // Categorías donde la empresa es proveedora
  isBranch?: boolean
  markupType?: 'percentage' | 'fixed'
  markupValue?: number
  onMarkupChange?: (type: 'percentage' | 'fixed', value: number) => void
}

const categoryIcons: Record<string, typeof Package> = {
  paqueteria: Package,
  remesa: DollarSign,
  recarga: Smartphone,
  mercado: Store
}

const categoryLabels: Record<string, string> = {
  paqueteria: 'Paquetería',
  remesa: 'Remesa',
  recarga: 'Recarga',
  mercado: 'Mercado'
}

export default function ProductPricingStep({
  products,
  prices,
  onChange,
  enabledCategories,
  isProvider = false,
  providerCategories = [],
  isBranch = false,
  markupType = 'percentage',
  markupValue = 0,
  onMarkupChange
}: ProductPricingStepProps) {
  const [localPrices, setLocalPrices] = useState<Record<number, { sellPrice: number; costPrice?: number }>>({})
  const [errors, setErrors] = useState<Record<number, string>>({})

  // Filtrar productos por categorías habilitadas
  const filteredProducts = enabledCategories && enabledCategories.length > 0
    ? products.filter(p => {
        // Extraer la categoría principal de los servicios habilitados
        // Por ejemplo: "paqueteria:routes" -> "paqueteria"
        return enabledCategories.some(cat => {
          const mainCategory = cat.includes(':') ? cat.split(':')[0] : cat
          return p.serviceCategory === mainCategory
        })
      })
    : products

  // Initialize local prices from props
  useEffect(() => {
    const priceMap: Record<number, { sellPrice: number; costPrice?: number }> = {}
    for (const price of prices) {
      priceMap[price.productId] = {
        sellPrice: price.sellPrice,
        costPrice: price.costPrice
      }
    }
    setLocalPrices(priceMap)
  }, [prices])

  // Group products by category
  const productsByCategory = filteredProducts.reduce((acc, product) => {
    const cat = product.serviceCategory
    if (!acc[cat]) {
      acc[cat] = []
    }
    acc[cat].push(product)
    return acc
  }, {} as Record<string, Product[]>)

  // Verificar si la empresa es proveedora de una categoría específica
  const isProviderForCategory = (category: string) => {
    return isProvider && providerCategories.includes(category)
  }

  const handlePriceChange = (productId: number, field: 'sellPrice' | 'costPrice', value: string, product: Product) => {
    const numValue = parseFloat(value) || 0
    const productCost = product.costPrice ?? 0
    const productMinPrice = product.minPrice ?? 0
    const current = localPrices[productId] || { sellPrice: productCost }

    // Validate
    let error = ''
    if (field === 'sellPrice') {
      const effectiveCost = current.costPrice ?? productCost
      if (numValue < effectiveCost) {
        error = `Min: $${effectiveCost.toFixed(2)}`
      } else if (numValue < productMinPrice && productMinPrice > 0) {
        error = `Min permitido: $${productMinPrice.toFixed(2)}`
      }
    }

    setErrors(prev => ({
      ...prev,
      [productId]: error
    }))

    const newLocal = {
      ...current,
      [field]: numValue
    }

    setLocalPrices(prev => ({
      ...prev,
      [productId]: newLocal
    }))

    // Update parent with all prices
    const newPrices = filteredProducts.map(p => {
      const pCost = p.costPrice ?? 0
      if (p.id === productId) {
        return {
          productId: p.id,
          sellPrice: field === 'sellPrice' ? numValue : (localPrices[p.id]?.sellPrice ?? pCost),
          costPrice: field === 'costPrice' ? numValue : localPrices[p.id]?.costPrice
        }
      }
      return {
        productId: p.id,
        sellPrice: localPrices[p.id]?.sellPrice ?? pCost,
        costPrice: localPrices[p.id]?.costPrice
      }
    })
    onChange(newPrices)
  }

  const calculateMargin = (costPrice: number, sellPrice: number) => {
    const margin = sellPrice - costPrice
    const percentage = costPrice > 0 ? ((sellPrice - costPrice) / costPrice * 100) : 0
    return { margin, percentage }
  }

  const getUnitLabel = (unitType: string, pricingModel: string) => {
    if (pricingModel === 'by_weight') return '/lb'
    if (pricingModel === 'percentage') return '%'
    return ''
  }

  // For branches - apply markup to all products
  const handleApplyMarkup = () => {
    if (!isBranch) return

    const newPrices = filteredProducts.map(p => {
      const baseCost = p.costPrice ?? 0
      let sellPrice = baseCost
      if (markupType === 'percentage') {
        sellPrice = baseCost * (1 + markupValue / 100)
      } else {
        sellPrice = baseCost + markupValue
      }
      return { productId: p.id, sellPrice }
    })

    const priceMap: Record<number, { sellPrice: number }> = {}
    for (const price of newPrices) {
      priceMap[price.productId] = { sellPrice: price.sellPrice }
    }
    setLocalPrices(priceMap)
    onChange(newPrices)
  }

  if (filteredProducts.length === 0) {
    return (
      <div className="p-8 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
        <Package className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No hay productos disponibles para las categorías de servicios seleccionados.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* For branches - Markup configuration */}
      {isBranch && onMarkupChange && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">
            Configurar Markup de Sucursal
          </h4>
          <p className="text-xs text-blue-700 dark:text-blue-300 mb-4">
            Los precios base se heredan de la empresa matriz. Configure el markup adicional.
          </p>

          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                Tipo de Markup
              </label>
              <select
                value={markupType}
                onChange={(e) => onMarkupChange(e.target.value as 'percentage' | 'fixed', markupValue)}
                className="w-40 px-3 py-2 text-sm border rounded-md dark:bg-gray-800 dark:border-gray-600"
              >
                <option value="percentage">Porcentaje (%)</option>
                <option value="fixed">Monto Fijo ($)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                Valor
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-gray-500">
                  {markupType === 'percentage' ? '%' : '$'}
                </span>
                <input
                  type="number"
                  value={markupValue}
                  onChange={(e) => onMarkupChange(markupType, parseFloat(e.target.value) || 0)}
                  min="0"
                  step={markupType === 'percentage' ? '0.5' : '0.01'}
                  className="w-28 pl-8 pr-3 py-2 text-sm border rounded-md dark:bg-gray-800 dark:border-gray-600"
                />
              </div>
            </div>

            <button
              onClick={handleApplyMarkup}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Aplicar a Todos
            </button>
          </div>
        </div>
      )}

      {/* Products by category */}
      {Object.entries(productsByCategory).map(([category, categoryProducts]) => {
        const Icon = categoryIcons[category] || Package
        const label = categoryLabels[category] || category
        const canEditCost = isProviderForCategory(category)

        return (
          <div key={category} className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden">
            {/* Category header */}
            <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 border-b dark:border-gray-600 flex items-center gap-2">
              <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-medium text-gray-900 dark:text-white">
                Productos de {label}
              </h3>
              {canEditCost && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <Edit3 className="w-3 h-3" />
                  Proveedor
                </span>
              )}
              <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                {categoryProducts.length} productos
              </span>
            </div>

            {/* Products table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50 dark:bg-gray-700/30">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-600 dark:text-gray-300 font-medium">
                      Producto
                    </th>
                    <th className="text-right px-4 py-2 text-gray-600 dark:text-gray-300 font-medium">
                      {canEditCost ? 'Costo (Editable)' : 'Costo'}
                    </th>
                    <th className="text-right px-4 py-2 text-gray-600 dark:text-gray-300 font-medium">
                      Precio Venta
                    </th>
                    <th className="text-right px-4 py-2 text-gray-600 dark:text-gray-300 font-medium">
                      Margen
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {categoryProducts.map(product => {
                    const localPrice = localPrices[product.id]
                    const effectiveCost = localPrice?.costPrice ?? product.costPrice ?? 0
                    const sellPrice = localPrice?.sellPrice ?? product.costPrice ?? 0
                    const { margin, percentage } = calculateMargin(effectiveCost, sellPrice)
                    const error = errors[product.id]
                    const unitLabel = getUnitLabel(product.unitType, product.pricingModel)

                    return (
                      <tr
                        key={product.id}
                        className={cn(
                          "hover:bg-gray-50 dark:hover:bg-gray-700/30",
                          error && "bg-red-50 dark:bg-red-900/10"
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {product.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {product.code}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-right">
                          {canEditCost ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-gray-500">$</span>
                              <input
                                type="number"
                                value={effectiveCost}
                                onChange={(e) => handlePriceChange(
                                  product.id,
                                  'costPrice',
                                  e.target.value,
                                  product
                                )}
                                min="0"
                                step="0.01"
                                className="w-24 px-2 py-1 text-right border rounded dark:bg-gray-700 dark:border-gray-600 border-amber-300 dark:border-amber-600"
                              />
                              <span className="text-gray-500 text-xs">{unitLabel}</span>
                            </div>
                          ) : (
                            <span className="text-gray-700 dark:text-gray-300">
                              ${effectiveCost.toFixed(2)}{unitLabel}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-gray-500">$</span>
                            <input
                              type="number"
                              value={sellPrice}
                              onChange={(e) => handlePriceChange(
                                product.id,
                                'sellPrice',
                                e.target.value,
                                product
                              )}
                              min={effectiveCost}
                              step="0.01"
                              className={cn(
                                "w-24 px-2 py-1 text-right border rounded dark:bg-gray-700 dark:border-gray-600",
                                error && "border-red-500 dark:border-red-500"
                              )}
                            />
                            <span className="text-gray-500 text-xs">{unitLabel}</span>
                          </div>
                          {error && (
                            <div className="flex items-center justify-end gap-1 mt-1 text-xs text-red-600 dark:text-red-400">
                              <AlertCircle className="w-3 h-3" />
                              {error}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className={cn(
                            "font-medium",
                            margin >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                          )}>
                            {margin >= 0 ? '+' : ''}{margin.toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            ({percentage >= 0 ? '+' : ''}{percentage.toFixed(1)}%)
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* Summary */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            Total de productos configurados:
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {Object.keys(localPrices).length} / {filteredProducts.length}
          </span>
        </div>
        {Object.values(errors).some(e => e) && (
          <div className="mt-2 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4" />
            Hay errores en algunos precios. Corrígelos antes de continuar.
          </div>
        )}
      </div>
    </div>
  )
}
