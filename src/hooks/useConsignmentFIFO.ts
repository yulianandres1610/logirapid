'use client'

import { useState, useCallback } from 'react'

interface ConsignmentLot {
  lotId: number
  lotNumber: string
  expirationDate: string | null
  quantityAvailable: number
  unitCost: number
  receivedAt: string
  supplier: {
    id: number
    code: string
    name: string
  }
  orderNumber: string
}

interface FIFOData {
  lots: ConsignmentLot[]
  totalAvailable: number
  isConsignment: boolean
}

interface SaleResult {
  productId: number
  quantity: number
  lotDeductions: Array<{
    lotId: number
    lotNumber: string
    quantity: number
    unitCost: number
  }>
  supplierEarnings: Array<{
    supplierId: number
    amount: number
  }>
}

interface SaleItem {
  productId: number
  quantity: number
  salePrice: number
}

/**
 * Hook para manejar inventario FIFO de consignacion en POS
 *
 * Uso:
 * 1. checkConsignmentStock(warehouseId, productId) - Verifica si el producto tiene lotes de consignacion
 * 2. processConsignmentSale(warehouseId, items, posOrderId, posOrderNumber) - Procesa la venta FIFO
 *
 * El POS debe:
 * 1. Al agregar producto al carrito, verificar si es consignacion
 * 2. Al confirmar venta, llamar processConsignmentSale para productos de consignacion
 */
export function useConsignmentFIFO() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Verifica stock de consignacion para un producto
   * Retorna los lotes disponibles ordenados FIFO
   */
  const checkConsignmentStock = useCallback(async (
    warehouseId: number,
    productId: number
  ): Promise<FIFOData | null> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/consignments/inventory/fifo?warehouseId=${warehouseId}&productId=${productId}`
      )
      const data = await response.json()

      if (data.success) {
        return data.data
      } else {
        setError(data.error)
        return null
      }
    } catch (err) {
      setError('Error al verificar stock de consignacion')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Procesa venta de productos en consignacion
   * Descuenta de lotes FIFO y actualiza wallet de proveedores
   */
  const processConsignmentSale = useCallback(async (
    warehouseId: number,
    items: SaleItem[],
    posOrderId?: number,
    posOrderNumber?: string
  ): Promise<{ success: boolean; results?: SaleResult[] }> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/consignments/inventory/fifo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId,
          items,
          posOrderId,
          posOrderNumber
        })
      })

      const data = await response.json()

      if (data.success) {
        return { success: true, results: data.data.results }
      } else {
        setError(data.error)
        return { success: false }
      }
    } catch (err) {
      setError('Error al procesar venta de consignacion')
      return { success: false }
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Verifica multiples productos de una vez
   * Util para verificar todo el carrito
   */
  const checkMultipleProducts = useCallback(async (
    warehouseId: number,
    productIds: number[]
  ): Promise<Map<number, FIFOData>> => {
    const results = new Map<number, FIFOData>()

    // Fetch all in parallel
    const promises = productIds.map(async (productId) => {
      const data = await checkConsignmentStock(warehouseId, productId)
      if (data) {
        results.set(productId, data)
      }
    })

    await Promise.all(promises)
    return results
  }, [checkConsignmentStock])

  /**
   * Calcula cuanto puede vender de un producto basado en stock disponible
   */
  const getAvailableQuantity = useCallback(async (
    warehouseId: number,
    productId: number
  ): Promise<number> => {
    const data = await checkConsignmentStock(warehouseId, productId)
    return data?.totalAvailable || 0
  }, [checkConsignmentStock])

  /**
   * Obtiene el costo promedio ponderado de los lotes
   */
  const getWeightedAverageCost = useCallback((lots: ConsignmentLot[]): number => {
    if (lots.length === 0) return 0

    const totalValue = lots.reduce((sum, lot) => sum + (lot.quantityAvailable * lot.unitCost), 0)
    const totalQty = lots.reduce((sum, lot) => sum + lot.quantityAvailable, 0)

    return totalQty > 0 ? totalValue / totalQty : 0
  }, [])

  return {
    loading,
    error,
    checkConsignmentStock,
    processConsignmentSale,
    checkMultipleProducts,
    getAvailableQuantity,
    getWeightedAverageCost
  }
}

/**
 * Ejemplo de uso en POS:
 *
 * ```tsx
 * function POSCheckout({ warehouseId, cartItems }) {
 *   const { checkMultipleProducts, processConsignmentSale } = useConsignmentFIFO()
 *
 *   const handleCheckout = async () => {
 *     // 1. Verificar cuales productos son consignacion
 *     const productIds = cartItems.map(item => item.productId)
 *     const consignmentData = await checkMultipleProducts(warehouseId, productIds)
 *
 *     // 2. Separar items de consignacion
 *     const consignmentItems = cartItems.filter(item =>
 *       consignmentData.get(item.productId)?.isConsignment
 *     )
 *
 *     // 3. Procesar venta normal...
 *     const posOrder = await createPOSOrder(cartItems)
 *
 *     // 4. Procesar consignacion FIFO
 *     if (consignmentItems.length > 0) {
 *       await processConsignmentSale(
 *         warehouseId,
 *         consignmentItems.map(item => ({
 *           productId: item.productId,
 *           quantity: item.quantity,
 *           salePrice: item.price
 *         })),
 *         posOrder.id,
 *         posOrder.orderNumber
 *       )
 *     }
 *   }
 * }
 * ```
 */
