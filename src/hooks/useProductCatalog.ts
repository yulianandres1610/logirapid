'use client'

import { useState, useEffect, useCallback } from 'react'

// Types for product catalog
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
  providerCost: number
  providerB2BPrice: number // B2B price provider charges to LogiRapid
  platformPrice: number // Default B2B price LogiRapid charges companies
  platformMinB2C: number // Minimum B2C price companies must charge
  pricingModel: string
  minPrice: number
  providerCompanyId: number | null
  isActive: boolean
  displayOrder: number
}

export interface ProductCatalogData {
  products: Product[]
  byCategory: Record<string, Product[]>
  total: number
}

// Types for company product pricing
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
  minPrice: number
  displayOrder: number
  costPrice: number
  sellPrice: number | null
  b2bPrice: number | null // Price for branches/children
  b2cPrice: number | null // Price for end customers
  minB2BPrice: number | null // Minimum B2B price floor
  markupType: string | null
  markupValue: number | null
  margin: number | null
  marginPercentage: number | null
  marginB2B: number | null
  marginB2BPercentage: number | null
  priceSource: string | null
  hasPricing: boolean
  pricingId: number | null
}

export interface CompanyPricingData {
  companyId: number
  companyName: string
  isBranch: boolean
  parentCompanyId: number | null
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

      // Transform to camelCase
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
        providerCost: parseFloat(p.provider_cost || 0),
        providerB2BPrice: parseFloat(p.provider_b2b_price || 0),
        platformPrice: parseFloat(p.platform_price || 0),
        platformMinB2C: parseFloat(p.platform_min_b2c || 0),
        pricingModel: p.pricing_model,
        minPrice: parseFloat(p.min_price || 0),
        providerCompanyId: p.provider_company_id,
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
    providerCost?: number
    platformPrice?: number
  }>, notes?: string) => {
    try {
      const response = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products, notes })
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
      const response = await fetch(`/api/companies/${companyId}/products/pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products, notes })
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
