'use client'

import { useState, useEffect } from 'react'
import { Package, DollarSign, Smartphone, Store, AlertCircle, Check, Edit3, Building2, Users, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Product {
  id: number
  code: string
  name: string
  serviceCategory: string
  productType: string
  unitType: string
  pricingModel: string
  // New simplified names
  miCosto?: number // Inherited cost - NOT EDITABLE
  precioSucursales?: number // Price for branches (only for matrices)
  precioClientes?: number // Price for end customers
  // Legacy names for compatibility
  costPrice?: number
  minPrice?: number
  minB2BPrice?: number
  platformMinB2C?: number
}

interface ProductPrice {
  productId: number
  // New simplified names
  precioSucursales?: number // Price for branches
  precioClientes?: number // Price for end customers
  // Legacy names for compatibility
  b2bPrice?: number
  b2cPrice?: number
  sellPrice?: number
  costPrice?: number
}

interface ProductPricingStepProps {
  products: Product[]
  prices: ProductPrice[]
  onChange: (prices: ProductPrice[]) => void
  enabledCategories?: string[]
  isProvider?: boolean
  providerCategories?: string[]
  isBranch?: boolean // If it's a branch (sucursal) - cannot edit precioSucursales
  hasSubBranches?: boolean // If company has branches (shows Precio Sucursales column)
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
  paqueteria: 'Paqueteria',
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
  hasSubBranches = false,
  markupType = 'percentage',
  markupValue = 0,
  onMarkupChange
}: ProductPricingStepProps) {
  const [localPrices, setLocalPrices] = useState<Record<number, { precioSucursales?: number; precioClientes?: number; costPrice?: number }>>({})
  const [errors, setErrors] = useState<Record<number, { sucursales?: string; clientes?: string }>>({})

  // Ensure products is always an array
  const safeProducts = Array.isArray(products) ? products : []

  // Filter products by enabled categories
  const filteredProducts = enabledCategories && enabledCategories.length > 0
    ? safeProducts.filter(p => {
        return enabledCategories.some(cat => {
          const mainCategory = cat.includes(':') ? cat.split(':')[0] : cat
          return p.serviceCategory === mainCategory
        })
      })
    : safeProducts

  // Initialize local prices from props
  useEffect(() => {
    const priceMap: Record<number, { precioSucursales?: number; precioClientes?: number; costPrice?: number }> = {}
    const pricesArray = Array.isArray(prices) ? prices : []
    for (const price of pricesArray) {
      priceMap[price.productId] = {
        precioSucursales: price.precioSucursales ?? price.b2bPrice,
        precioClientes: price.precioClientes ?? price.b2cPrice ?? price.sellPrice,
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

  // Check if company is provider for specific category
  const isProviderForCategory = (category: string) => {
    return isProvider && providerCategories.includes(category)
  }

  // Get the effective cost for a product (miCosto is inherited and not editable)
  const getEffectiveCost = (product: Product, localPrice?: { costPrice?: number }) => {
    return Number(product.miCosto ?? localPrice?.costPrice ?? product.costPrice ?? 0) || 0
  }

  const handlePriceChange = (
    productId: number,
    field: 'precioSucursales' | 'precioClientes' | 'costPrice',
    value: string,
    product: Product
  ) => {
    // Allow empty string for clearing the field
    const numValue = value === '' ? undefined : (parseFloat(value) || 0)
    const miCosto = getEffectiveCost(product, localPrices[productId])
    const current = localPrices[productId] || { precioClientes: miCosto }

    // Validate - only show error if value is defined, > 0, and less than minimum
    const newErrors: { sucursales?: string; clientes?: string } = {}

    if (field === 'precioSucursales') {
      // Precio Sucursales cannot be lower than Mi Costo (only validate if value is defined and > 0)
      if (numValue !== undefined && numValue > 0 && numValue < miCosto) {
        newErrors.sucursales = `Min: $${miCosto.toFixed(2)}`
      }
      // No error if value >= miCosto, undefined, or 0/empty
    }

    if (field === 'precioClientes') {
      if (numValue !== undefined && numValue > 0 && numValue < miCosto) {
        newErrors.clientes = `Min: $${miCosto.toFixed(2)}`
      }
    }

    // Replace errors completely for this product (don't merge with old errors)
    setErrors(prev => ({
      ...prev,
      [productId]: newErrors
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
      const pCost = getEffectiveCost(p, localPrices[p.id])
      if (p.id === productId) {
        return {
          productId: p.id,
          precioSucursales: field === 'precioSucursales' ? numValue : localPrices[p.id]?.precioSucursales,
          precioClientes: field === 'precioClientes' ? numValue : (localPrices[p.id]?.precioClientes ?? pCost),
          costPrice: field === 'costPrice' ? numValue : localPrices[p.id]?.costPrice
        }
      }
      return {
        productId: p.id,
        precioSucursales: localPrices[p.id]?.precioSucursales,
        precioClientes: localPrices[p.id]?.precioClientes ?? pCost,
        costPrice: localPrices[p.id]?.costPrice
      }
    })
    onChange(newPrices)
  }

  const calculateMargin = (miCosto: number, precioClientes: number) => {
    const cost = Number(miCosto) || 0
    const sell = Number(precioClientes) || 0
    const margin = sell - cost
    const percentage = cost > 0 ? ((sell - cost) / cost * 100) : 0
    return { margin: isNaN(margin) ? 0 : margin, percentage: isNaN(percentage) ? 0 : percentage }
  }

  const getUnitLabel = (unitType: string, pricingModel: string) => {
    if (pricingModel === 'by_weight') return '/lb'
    if (pricingModel === 'percentage') return '%'
    return ''
  }

  // Apply markup to all products (for branches)
  const handleApplyMarkup = () => {
    if (!isBranch) return

    const newPrices = filteredProducts.map(p => {
      const miCosto = getEffectiveCost(p, localPrices[p.id])
      let precioClientes = miCosto
      if (markupType === 'percentage') {
        precioClientes = miCosto * (1 + markupValue / 100)
      } else {
        precioClientes = miCosto + markupValue
      }
      return {
        productId: p.id,
        precioClientes
        // Branches cannot set precioSucursales
      }
    })

    const priceMap: Record<number, { precioSucursales?: number; precioClientes?: number }> = {}
    for (const price of newPrices) {
      priceMap[price.productId] = { precioClientes: price.precioClientes }
    }
    setLocalPrices(priceMap)
    onChange(newPrices)
  }

  if (filteredProducts.length === 0) {
    return (
      <div className="p-8 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
        <Package className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No hay productos disponibles para las categorias de servicios seleccionados.
        </p>
      </div>
    )
  }

  // Determine which columns to show
  const showPrecioSucursalesColumn = !isBranch || hasSubBranches

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
          {isBranch ? <Building2 className="w-4 h-4" /> : <Users className="w-4 h-4" />}
          {isBranch ? 'Configurar Mis Precios de Venta' : 'Configurar Precios de Venta'}
        </h4>
        <p className="text-xs text-blue-700 dark:text-blue-300">
          {isBranch
            ? 'Mi Costo es heredado de la matriz y no se puede modificar. Configure su Precio a Clientes.'
            : 'Mi Costo es heredado de la plataforma. Configure Precio a Sucursales y Precio a Clientes.'
          }
        </p>
        <div className="mt-2 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
          <Lock className="w-3 h-3" />
          Regla: Los precios de venta no pueden ser menores a Mi Costo.
        </div>
      </div>

      {/* Markup configuration for branches */}
      {isBranch && onMarkupChange && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">
            Configurar Markup Masivo
          </h4>

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

        // PROVIDER VIEW - Completely different UI for categories where company is provider
        if (canEditCost) {
          return (
            <div key={category} className="bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700 overflow-hidden">
              {/* Provider Category header */}
              <div className="bg-amber-100 dark:bg-amber-800/50 px-4 py-3 border-b border-amber-200 dark:border-amber-700 flex items-center gap-2">
                <Icon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="font-medium text-amber-900 dark:text-amber-100">
                  {label} - Eres PROVEEDOR
                </h3>
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-amber-200 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 flex items-center gap-1">
                  <Edit3 className="w-3 h-3" />
                  Configura tu precio base
                </span>
                <span className="ml-auto text-xs text-amber-700 dark:text-amber-400">
                  {categoryProducts.length} productos
                </span>
              </div>

              {/* Provider info banner */}
              <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
                LogiRapid te comprara estos productos a tu precio base. No configuras precios de sucursales ni clientes para esta categoria.
              </div>

              {/* Provider Products table - ONLY Tu Precio Base + Precio LogiRapid + Margen */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm table-fixed">
                  <thead className="bg-amber-100/50 dark:bg-amber-800/30">
                    <tr>
                      <th className="text-left px-4 py-2 text-amber-800 dark:text-amber-200 font-medium w-auto">
                        Producto
                      </th>
                      <th className="text-right px-4 py-2 text-amber-800 dark:text-amber-200 font-medium w-36">
                        <div className="flex items-center justify-end gap-1">
                          <Edit3 className="w-3 h-3" />
                          Tu Precio Base
                        </div>
                      </th>
                      <th className="text-right px-4 py-2 text-amber-800 dark:text-amber-200 font-medium w-36">
                        <div className="flex items-center justify-end gap-1">
                          <DollarSign className="w-3 h-3" />
                          Precio LogiRapid
                        </div>
                      </th>
                      <th className="text-right px-4 py-2 text-amber-800 dark:text-amber-200 font-medium w-28">
                        Tu Margen
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100 dark:divide-amber-800">
                    {categoryProducts.map(product => {
                      const localPrice = localPrices[product.id]
                      const tuPrecioBase = localPrice?.costPrice ?? getEffectiveCost(product, localPrice)
                      // Use precioMayorista as the LogiRapid reference price
                      const precioLogiRapid = Number(product.minB2BPrice ?? product.minPrice ?? 0) || 0
                      const tuMargen = precioLogiRapid - tuPrecioBase
                      const tuMargenPct = tuPrecioBase > 0 ? ((tuMargen / tuPrecioBase) * 100) : 0
                      const unitLabel = getUnitLabel(product.unitType || 'unit', product.pricingModel || 'fixed')

                      return (
                        <tr
                          key={product.id}
                          className="hover:bg-amber-100/50 dark:hover:bg-amber-800/20"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {product.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {product.code}
                            </div>
                          </td>

                          {/* Tu Precio Base - EDITABLE */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-gray-500">$</span>
                              <input
                                type="number"
                                value={tuPrecioBase}
                                onChange={(e) => handlePriceChange(
                                  product.id,
                                  'costPrice',
                                  e.target.value,
                                  product
                                )}
                                min={0}
                                step="0.0001"
                                className="w-24 px-2 py-1 text-right border-2 rounded dark:bg-amber-900/30 dark:border-amber-600 border-amber-400 bg-white"
                              />
                              <span className="text-gray-500 text-xs w-6 text-left">{unitLabel}</span>
                            </div>
                          </td>

                          {/* Precio LogiRapid - READ ONLY reference */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Lock className="w-3 h-3 text-gray-400" />
                              <span className="text-blue-600 dark:text-blue-400 font-medium">
                                ${precioLogiRapid.toFixed(2)}
                              </span>
                              <span className="text-gray-500 text-xs w-6 text-left">{unitLabel}</span>
                            </div>
                          </td>

                          {/* Tu Margen */}
                          <td className="px-4 py-3 text-right">
                            <div className={cn(
                              "font-medium",
                              tuMargen >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                            )}>
                              {tuMargen >= 0 ? '+' : ''}${tuMargen.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              ({tuMargenPct >= 0 ? '+' : ''}{tuMargenPct.toFixed(1)}%)
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
        }

        // CLIENT VIEW - Standard UI for categories where company is NOT provider
        return (
          <div key={category} className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden">
            {/* Category header */}
            <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 border-b dark:border-gray-600 flex items-center gap-2">
              <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-medium text-gray-900 dark:text-white">
                Productos de {label}
              </h3>
              <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                {categoryProducts.length} productos
              </span>
            </div>

            {/* Products table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <thead className="bg-gray-50/50 dark:bg-gray-700/30">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-600 dark:text-gray-300 font-medium w-auto">
                      Producto
                    </th>
                    <th className="text-right px-4 py-2 text-gray-600 dark:text-gray-300 font-medium w-36">
                      <div className="flex items-center justify-end gap-1">
                        <Lock className="w-3 h-3" />
                        Mi Costo
                      </div>
                    </th>
                    {showPrecioSucursalesColumn && (
                      <th className="text-right px-4 py-2 text-gray-600 dark:text-gray-300 font-medium w-40">
                        <div className="flex items-center justify-end gap-1">
                          <Building2 className="w-3 h-3" />
                          Precio Sucursales
                        </div>
                      </th>
                    )}
                    <th className="text-right px-4 py-2 text-gray-600 dark:text-gray-300 font-medium w-36">
                      <div className="flex items-center justify-end gap-1">
                        <Users className="w-3 h-3" />
                        Precio Clientes
                      </div>
                    </th>
                    <th className="text-right px-4 py-2 text-gray-600 dark:text-gray-300 font-medium w-28">
                      Margen
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {categoryProducts.map(product => {
                    const localPrice = localPrices[product.id]
                    const miCosto = getEffectiveCost(product, localPrice)
                    const precioSucursales = localPrice?.precioSucursales
                    const precioClientes = Number(localPrice?.precioClientes ?? miCosto) || 0
                    const { margin, percentage } = calculateMargin(miCosto, precioClientes)
                    const productErrors = errors[product.id]
                    const unitLabel = getUnitLabel(product.unitType || 'unit', product.pricingModel || 'fixed')

                    return (
                      <tr
                        key={product.id}
                        className={cn(
                          "hover:bg-gray-50 dark:hover:bg-gray-700/30",
                          (productErrors?.sucursales || productErrors?.clientes) && "bg-red-50 dark:bg-red-900/10"
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
                          {/* Non-providers see read-only cost */}
                          <div className="flex items-center justify-end gap-1">
                            <Lock className="w-3 h-3 text-gray-400" />
                            <span className="text-gray-700 dark:text-gray-300">
                              ${miCosto.toFixed(2)}
                            </span>
                            <span className="text-gray-500 text-xs w-6 text-left">{unitLabel}</span>
                          </div>
                        </td>

                        {showPrecioSucursalesColumn && (
                          <td className="px-4 py-3 text-right">
                            {isBranch ? (
                              <span className="text-gray-400 dark:text-gray-500">-</span>
                            ) : (
                              <>
                                <div className="flex items-center justify-end gap-1">
                                  <span className="text-gray-500">$</span>
                                  <input
                                    type="number"
                                    value={precioSucursales ?? ''}
                                    placeholder={miCosto.toFixed(2)}
                                    onChange={(e) => handlePriceChange(
                                      product.id,
                                      'precioSucursales',
                                      e.target.value,
                                      product
                                    )}
                                    min={miCosto}
                                    step="0.0001"
                                    className={cn(
                                      "w-24 px-2 py-1 text-right border rounded dark:bg-gray-700 dark:border-gray-600",
                                      productErrors?.sucursales && "border-red-500 dark:border-red-500"
                                    )}
                                  />
                                  <span className="text-gray-500 text-xs w-6 text-left">{unitLabel}</span>
                                </div>
                                {productErrors?.sucursales && (
                                  <div className="flex items-center justify-end gap-1 mt-1 text-xs text-red-600 dark:text-red-400">
                                    <AlertCircle className="w-3 h-3" />
                                    {productErrors.sucursales}
                                  </div>
                                )}
                              </>
                            )}
                          </td>
                        )}

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-gray-500">$</span>
                            <input
                              type="number"
                              value={precioClientes}
                              onChange={(e) => handlePriceChange(
                                product.id,
                                'precioClientes',
                                e.target.value,
                                product
                              )}
                              min={miCosto}
                              step="0.0001"
                              className={cn(
                                "w-24 px-2 py-1 text-right border rounded dark:bg-gray-700 dark:border-gray-600",
                                productErrors?.clientes && "border-red-500 dark:border-red-500"
                              )}
                            />
                            <span className="text-gray-500 text-xs w-6 text-left">{unitLabel}</span>
                          </div>
                          {productErrors?.clientes && (
                            <div className="flex items-center justify-end gap-1 mt-1 text-xs text-red-600 dark:text-red-400">
                              <AlertCircle className="w-3 h-3" />
                              {productErrors.clientes}
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
        {Object.values(errors).some(e => e?.sucursales || e?.clientes) && (
          <div className="mt-2 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4" />
            Hay errores en algunos precios. Corrigelos antes de continuar.
          </div>
        )}
      </div>
    </div>
  )
}
