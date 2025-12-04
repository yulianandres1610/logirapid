'use client'

import { useState, useEffect, useCallback } from 'react'

// Types for product catalog - NEW SIMPLIFIED NAMES
export interface Product {
  id: number
  code: string
  name: string
  description: string | null
  serviceCategory: string
  productType: string
  dimensions: string | null
  weightCapacity: number | null
  unitType: string
  // New simplified price names (provider level)
  miCosto: number          // Provider's cost of production
  precioMayorista: number  // Price provider charges to LogiRapid
  precioPublico: number    // Suggested price to end customer
  pricingModel: string
  providerCompanyId: number | null
  providerCompanyName: string | null
  isActive: boolean
  displayOrder: number
  // Legacy names (for backwards compatibility)
  providerCost?: number
  providerB2BPrice?: number
  platformPrice?: number
  platformMinB2C?: number
  minPrice?: number
}

export interface ProductCatalogData {
  products: Product[]
  byCategory: Record<string, Product[]>
  total: number
}

// Types for company product pricing - NEW SIMPLIFIED NAMES
export interface CompanyProductPricing {
  productId: number
  code: string
  name: string
  description: string | null
  serviceCategory: string
  productType: string
  dimensions: string | null
  weightCapacity: number | null
  unitType: string
  pricingModel: string
  displayOrder: number
  // Catalog level prices (provider level - for reference)
  catalogMiCosto: number
  catalogPrecioMayorista: number
  catalogPrecioPublico: number
  // Company level pricing - NEW SIMPLIFIED NAMES
  miCosto: number              // Inherited cost - NOT EDITABLE
  precioSucursales: number | null  // Price for branches (only matrices)
  precioClientes: number | null    // Price for end customers
  // Legacy names (for backwards compatibility)
  costPrice?: number
  b2bPrice?: number | null
  b2cPrice?: number | null
  sellPrice?: number | null
  minB2BPrice?: number | null
  // Markup
  markupType: string | null
  markupValue: number | null
  // Margins
  margenClientes: number | null
  margenClientesPct: number | null
  // Legacy margin names
  margin?: number | null
  marginPercentage?: number | null
  marginB2B?: number | null
  marginB2BPercentage?: number | null
  // Metadata
  priceSource: string | null
  hasPricing: boolean
  pricingId: number | null
  // Company type flags
  isBranch?: boolean
  canEditPrecioSucursales?: boolean
}

export interface CompanyPricingData {
  companyId: number
  companyName: string
  isBranch: boolean
  parentCompanyId: number | null
  parentCompanyName?: string | null
  isProvider?: boolean
  providerCategories?: string[]
  products: CompanyProductPricing[]
  byCategory: Record<string, CompanyProductPricing[]>
  total: number
}

// Hook for fetching product catalog (platform level)
export function useProductCatalog(category?: string) {
  const [data, setData] = useState<ProductCatalogData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (category) params.append('category', category)

      const url = `/api/products${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Error al obtener productos')
      }

      // Transform to camelCase with new field names
      const products = result.data.products.map((p: any) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description,
        serviceCategory: p.service_category,
        productType: p.product_type,
        dimensions: p.dimensions,
        weightCapacity: p.weight_capacity ? parseFloat(p.weight_capacity) : null,
        unitType: p.unit_type,
        // New field names
        miCosto: parseFloat(p.mi_costo || p.provider_cost || 0),
        precioMayorista: parseFloat(p.precio_mayorista || p.provider_b2b_price || 0),
        precioPublico: parseFloat(p.precio_publico || p.platform_min_b2c || 0),
        // Legacy names for compatibility
        providerCost: parseFloat(p.mi_costo || p.provider_cost || 0),
        providerB2BPrice: parseFloat(p.precio_mayorista || p.provider_b2b_price || 0),
        platformPrice: parseFloat(p.precio_mayorista || p.platform_price || 0),
        platformMinB2C: parseFloat(p.precio_publico || p.platform_min_b2c || 0),
        pricingModel: p.pricing_model,
        minPrice: parseFloat(p.min_price || 0),
        providerCompanyId: p.provider_company_id,
        providerCompanyName: p.provider_company_name || null,
        isActive: p.is_active,
        displayOrder: p.display_order
      }))

      // Group by category
      const byCategory: Record<string, Product[]> = {}
      for (const product of products) {
        const cat = product.serviceCategory
        if (!byCategory[cat]) {
          byCategory[cat] = []
        }
        byCategory[cat].push(product)
      }

      setData({
        products,
        byCategory,
        total: products.length
      })

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [category])

  const updatePlatformPrices = useCallback(async (products: Array<{
    id: number
    miCosto?: number
    precioMayorista?: number
    precioPublico?: number
    // Legacy support
    providerCost?: number
    platformPrice?: number
  }>, notes?: string) => {
    try {
      // Transform to API format
      const apiProducts = products.map(p => ({
        id: p.id,
        mi_costo: p.miCosto ?? p.providerCost,
        precio_mayorista: p.precioMayorista ?? p.platformPrice,
        precio_publico: p.precioPublico
      }))

      const response = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: apiProducts, notes })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Error al actualizar precios')
      }

      // Refresh data
      await fetchProducts()

      return result.data
    } catch (err) {
      throw err
    }
  }, [fetchProducts])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  return {
    data,
    loading,
    error,
    refresh: fetchProducts,
    updatePlatformPrices
  }
}

// Hook for fetching company-specific product pricing
export function useCompanyProductPricing(companyId: number | null) {
  const [data, setData] = useState<CompanyPricingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPricing = useCallback(async () => {
    if (!companyId) {
      setData(null)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/companies/${companyId}/products/pricing`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Error al obtener precios')
      }

      setData(result.data)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  const updatePrices = useCallback(async (products: Array<{
    productId: number
    // New field names
    precioSucursales?: number
    precioClientes?: number
    // Legacy support
    sellPrice?: number
    b2bPrice?: number
    b2cPrice?: number
    markupType?: string
    markupValue?: number
  }>, notes?: string) => {
    if (!companyId) {
      throw new Error('No company ID provided')
    }

    try {
      // Transform to API format with new names
      const apiProducts = products.map(p => ({
        productId: p.productId,
        precioSucursales: p.precioSucursales ?? p.b2bPrice,
        precioClientes: p.precioClientes ?? p.b2cPrice ?? p.sellPrice,
        markupType: p.markupType,
        markupValue: p.markupValue
      }))

      const response = await fetch(`/api/companies/${companyId}/products/pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: apiProducts, notes })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Error al actualizar precios')
      }

      if (result.data?.errorCount > 0) {
        const errors = result.data.results
          .filter((r: any) => !r.success)
          .map((r: any) => r.error)
          .join('; ')
        console.warn('Some prices failed to update:', errors)
      }

      // Refresh data
      await fetchPricing()

      return result.data

    } catch (err) {
      throw err
    }
  }, [companyId, fetchPricing])

  useEffect(() => {
    fetchPricing()
  }, [fetchPricing])

  return {
    data,
    loading,
    error,
    refresh: fetchPricing,
    updatePrices
  }
}

// Hook for fetching providers
export function useProviders(options?: { category?: string; type?: string }) {
  const [providers, setProviders] = useState<Array<{
    id: number
    legalName: string
    phone: string
    email: string
    status: string
    isProvider: boolean
    providerType: string
    providerCategories: string[]
    providerServices: string[]
    createdAt: string
  }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (options?.category) params.append('category', options.category)
      if (options?.type) params.append('type', options.type)

      const url = `/api/providers${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Error al obtener proveedores')
      }

      setProviders(result.data.providers || [])

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [options?.category, options?.type])

  const setProviderStatus = useCallback(async (
    companyId: number,
    isProvider: boolean,
    providerType?: string,
    providerCategories?: string[]
  ) => {
    try {
      const response = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          isProvider,
          providerType,
          providerCategories
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Error al configurar proveedor')
      }

      // Refresh list
      await fetchProviders()

      return result.data

    } catch (err) {
      throw err
    }
  }, [fetchProviders])

  useEffect(() => {
    fetchProviders()
  }, [fetchProviders])

  return {
    providers,
    loading,
    error,
    refresh: fetchProviders,
    setProviderStatus
  }
}

// Service categories
export const SERVICE_CATEGORIES = [
  { id: 'paqueteria', name: 'Paqueteria', icon: 'Package' },
  { id: 'remesa', name: 'Remesa', icon: 'DollarSign' },
  { id: 'recarga', name: 'Recarga', icon: 'Smartphone' },
  { id: 'mercado', name: 'Mercado', icon: 'Store' }
]

// Provider types
export const PROVIDER_TYPES = [
  { id: 'products', name: 'Productos Fisicos', description: 'Cajas, empaques, materiales' },
  { id: 'services', name: 'Servicios de Envio', description: 'Transporte, courier, entregas' },
  { id: 'both', name: 'Ambos', description: 'Productos y servicios' }
]

// Pricing models
export const PRICING_MODELS = [
  { id: 'fixed', name: 'Precio Fijo', description: 'Precio por unidad' },
  { id: 'by_weight', name: 'Por Peso', description: 'Precio por libra/kg' },
  { id: 'by_volume', name: 'Por Volumen', description: 'Precio por medida cubica' },
  { id: 'percentage', name: 'Porcentaje', description: 'Porcentaje del monto' }
]
