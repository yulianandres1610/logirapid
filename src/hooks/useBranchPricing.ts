'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Hook for managing branch-specific product pricing
 *
 * Allows matrix companies to set DIFFERENT prices for EACH branch
 * instead of a single precio_sucursales for all branches.
 */

export interface Branch {
  id: number
  name: string
  status: string
}

export interface BranchPrice {
  precio: number
  isCustom: boolean
  notes?: string
}

export interface BranchProduct {
  productId: number
  code: string
  name: string
  serviceCategory: string
  productType: string
  defaultPrice: number
  precioClientes: number | null
  branchPrices: Record<number, BranchPrice>
}

export interface BranchPricingData {
  matrixCompanyId: number
  matrixCompanyName: string
  branches: Branch[]
  products: BranchProduct[]
  totalProducts: number
  totalBranches: number
}

export interface BranchPriceUpdate {
  branchId: number
  productId: number
  precioSucursal: number
  notes?: string
}

export function useBranchPricing(matrixCompanyId: number | null) {
  const [data, setData] = useState<BranchPricingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Fetch branch pricing data
  const fetchPricing = useCallback(async () => {
    if (!matrixCompanyId) {
      setData(null)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/companies/${matrixCompanyId}/branches/pricing`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Error al obtener precios por sucursal')
      }

      setData(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [matrixCompanyId])

  // Update multiple branch prices
  const updateBranchPrices = useCallback(async (
    updates: BranchPriceUpdate[],
    notes?: string
  ) => {
    if (!matrixCompanyId) {
      throw new Error('No hay empresa matriz seleccionada')
    }

    try {
      setSaving(true)
      setError(null)

      const response = await fetch(`/api/companies/${matrixCompanyId}/branches/pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchPricing: updates,
          notes
        })
      })

      const result = await response.json()

      if (!result.success && result.data?.errorCount === updates.length) {
        throw new Error(result.error || 'Error al guardar precios')
      }

      // Refresh data
      await fetchPricing()

      return result.data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      setError(errorMessage)
      throw err
    } finally {
      setSaving(false)
    }
  }, [matrixCompanyId, fetchPricing])

  // Update a single branch price
  const updateSingleBranchPrice = useCallback(async (
    branchId: number,
    productId: number,
    precioSucursal: number,
    notes?: string
  ) => {
    return updateBranchPrices([{
      branchId,
      productId,
      precioSucursal,
      notes
    }])
  }, [updateBranchPrices])

  // Remove a custom branch price (revert to default)
  const removeBranchPrice = useCallback(async (
    branchId: number,
    productId: number
  ) => {
    if (!matrixCompanyId) {
      throw new Error('No hay empresa matriz seleccionada')
    }

    try {
      setSaving(true)
      setError(null)

      const response = await fetch(`/api/companies/${matrixCompanyId}/branches/pricing`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId, productId })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Error al eliminar precio específico')
      }

      // Refresh data
      await fetchPricing()

      return result.data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      setError(errorMessage)
      throw err
    } finally {
      setSaving(false)
    }
  }, [matrixCompanyId, fetchPricing])

  // Bulk update prices for multiple products and branches
  const bulkUpdatePrices = useCallback(async (
    priceMatrix: Record<number, Record<number, number>>, // productId -> branchId -> price
    notes?: string
  ) => {
    const updates: BranchPriceUpdate[] = []

    for (const [productId, branches] of Object.entries(priceMatrix)) {
      for (const [branchId, precio] of Object.entries(branches)) {
        updates.push({
          productId: parseInt(productId),
          branchId: parseInt(branchId),
          precioSucursal: precio
        })
      }
    }

    if (updates.length === 0) {
      return { successCount: 0, errorCount: 0 }
    }

    return updateBranchPrices(updates, notes)
  }, [updateBranchPrices])

  // Check if a branch has a custom price for a product
  const hasCustomPrice = useCallback((productId: number, branchId: number): boolean => {
    if (!data) return false

    const product = data.products.find(p => p.productId === productId)
    if (!product) return false

    return product.branchPrices[branchId]?.isCustom || false
  }, [data])

  // Get the price for a specific branch and product
  const getPrice = useCallback((productId: number, branchId: number): number | null => {
    if (!data) return null

    const product = data.products.find(p => p.productId === productId)
    if (!product) return null

    return product.branchPrices[branchId]?.precio || product.defaultPrice
  }, [data])

  // Get all custom prices as a flat list
  const getCustomPrices = useCallback((): Array<{
    productId: number
    productName: string
    branchId: number
    branchName: string
    precio: number
    notes?: string
  }> => {
    if (!data) return []

    const customPrices: Array<{
      productId: number
      productName: string
      branchId: number
      branchName: string
      precio: number
      notes?: string
    }> = []

    for (const product of data.products) {
      for (const [branchIdStr, branchPrice] of Object.entries(product.branchPrices)) {
        if (branchPrice.isCustom) {
          const branchId = parseInt(branchIdStr)
          const branch = data.branches.find(b => b.id === branchId)

          customPrices.push({
            productId: product.productId,
            productName: product.name,
            branchId,
            branchName: branch?.name || `Sucursal ${branchId}`,
            precio: branchPrice.precio,
            notes: branchPrice.notes
          })
        }
      }
    }

    return customPrices
  }, [data])

  // Calculate summary statistics
  const getSummary = useCallback(() => {
    if (!data) return null

    let totalCustomPrices = 0
    let totalProducts = data.products.length
    let totalBranches = data.branches.length

    for (const product of data.products) {
      for (const branchPrice of Object.values(product.branchPrices)) {
        if (branchPrice.isCustom) {
          totalCustomPrices++
        }
      }
    }

    const maxPossibleCustom = totalProducts * totalBranches
    const customPercentage = maxPossibleCustom > 0
      ? Math.round((totalCustomPrices / maxPossibleCustom) * 100)
      : 0

    return {
      totalProducts,
      totalBranches,
      totalCustomPrices,
      maxPossibleCustom,
      customPercentage
    }
  }, [data])

  // Initial fetch
  useEffect(() => {
    fetchPricing()
  }, [fetchPricing])

  return {
    // Data
    data,
    branches: data?.branches || [],
    products: data?.products || [],

    // State
    loading,
    saving,
    error,

    // Actions
    refresh: fetchPricing,
    updateBranchPrices,
    updateSingleBranchPrice,
    removeBranchPrice,
    bulkUpdatePrices,

    // Helpers
    hasCustomPrice,
    getPrice,
    getCustomPrices,
    getSummary
  }
}
