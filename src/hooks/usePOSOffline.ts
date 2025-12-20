'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  saveProducts,
  saveCategories,
  savePromotions,
  getProducts,
  getCategories,
  getPromotions,
  savePendingOrder,
  getUnsyncedOrders,
  markOrderSynced,
  deleteSyncedOrders,
  updateSyncStatus,
  getSyncStatus,
  generateOfflineId,
  isIndexedDBAvailable
} from '@/lib/pos-db'

interface Product {
  id: number
  name: string
  sku: string
  barcode: string
  price: number
  imageUrl: string | null
  categoryId: number
  stock: number
  trackInventory: boolean
}

interface Category {
  id: number
  name: string
  parentId: number | null
}

interface OrderLine {
  productId: number
  productName: string
  productSku: string | null
  quantity: number
  unitPrice: number
  discountPercent: number
  discountAmount: number
}

interface Payment {
  method: string
  amount: number
  currency: string
  amountTendered: number | null
  changeAmount: number | null
}

interface PendingOrder {
  offlineId: string
  terminalId: number
  sessionId: number
  warehouseId: number | null
  customerId: number | null
  customerName: string | null
  currency: string
  lines: OrderLine[]
  payments: Payment[]
  total: number
  createdAt: string
  synced: boolean
}

interface UsePOSOfflineOptions {
  terminalId: number
  sessionId: number
  warehouseId?: number
}

interface UsePOSOfflineReturn {
  // State
  isOnline: boolean
  isLoading: boolean
  lastSync: string | null
  pendingOrdersCount: number
  products: Product[]
  categories: Category[]

  // Actions
  syncFromServer: () => Promise<void>
  syncToServer: () => Promise<{ synced: number; failed: number }>
  saveOrderOffline: (order: Omit<PendingOrder, 'offlineId' | 'synced' | 'createdAt'>) => Promise<string>
  clearSyncedOrders: () => Promise<void>
}

export function usePOSOffline(options: UsePOSOfflineOptions): UsePOSOfflineReturn {
  const { terminalId, sessionId, warehouseId } = options

  const [isOnline, setIsOnline] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  // Check online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Load from IndexedDB on mount
  useEffect(() => {
    const loadFromDB = async () => {
      if (!isIndexedDBAvailable()) {
        setIsLoading(false)
        return
      }

      try {
        // Load sync status
        const status = await getSyncStatus(terminalId)
        if (status) {
          setLastSync(status.lastSync)
        }

        // Load cached data
        const [cachedProducts, cachedCategories] = await Promise.all([
          getProducts(),
          getCategories()
        ])

        if (cachedProducts.length > 0) {
          setProducts(cachedProducts)
        }
        if (cachedCategories.length > 0) {
          setCategories(cachedCategories)
        }

        // Count pending orders
        const pending = await getUnsyncedOrders()
        setPendingOrdersCount(pending.filter(o => o.sessionId === sessionId).length)
      } catch (error) {
        console.error('[POS Offline] Error loading from IndexedDB:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadFromDB()
  }, [terminalId, sessionId])

  // Sync from server
  const syncFromServer = useCallback(async () => {
    if (!isOnline) {
      console.log('[POS Offline] Cannot sync - offline')
      return
    }

    try {
      setIsLoading(true)

      const response = await fetch(`/api/market/pos/products?terminalId=${terminalId}`)
      const data = await response.json()

      if (data.success) {
        const { products: serverProducts, categories: serverCategories, promotions: serverPromotions } = data.data

        // Save to IndexedDB
        await Promise.all([
          saveProducts(serverProducts),
          saveCategories(serverCategories),
          savePromotions(serverPromotions || [])
        ])

        // Update sync status
        await updateSyncStatus(terminalId)

        // Update state
        setProducts(serverProducts)
        setCategories(serverCategories)
        setLastSync(new Date().toISOString())

        console.log('[POS Offline] Synced from server:', serverProducts.length, 'products')
      }
    } catch (error) {
      console.error('[POS Offline] Error syncing from server:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [terminalId, isOnline])

  // Sync orders to server
  const syncToServer = useCallback(async (): Promise<{ synced: number; failed: number }> => {
    if (!isOnline) {
      console.log('[POS Offline] Cannot sync orders - offline')
      return { synced: 0, failed: 0 }
    }

    try {
      const unsyncedOrders = await getUnsyncedOrders()
      const sessionOrders = unsyncedOrders.filter(o => o.sessionId === sessionId)

      if (sessionOrders.length === 0) {
        return { synced: 0, failed: 0 }
      }

      const response = await fetch('/api/market/pos/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          orders: sessionOrders
        })
      })

      const data = await response.json()

      if (data.success) {
        // Mark orders as synced
        for (const order of sessionOrders) {
          await markOrderSynced(order.offlineId)
        }

        // Update count
        const remaining = await getUnsyncedOrders()
        setPendingOrdersCount(remaining.filter(o => o.sessionId === sessionId).length)

        console.log('[POS Offline] Synced orders to server:', data.data)
        return { synced: data.data.synced, failed: data.data.failed }
      }

      return { synced: 0, failed: sessionOrders.length }
    } catch (error) {
      console.error('[POS Offline] Error syncing orders to server:', error)
      return { synced: 0, failed: 0 }
    }
  }, [sessionId, isOnline])

  // Save order offline
  const saveOrderOffline = useCallback(async (
    orderData: Omit<PendingOrder, 'offlineId' | 'synced' | 'createdAt'>
  ): Promise<string> => {
    const offlineId = generateOfflineId()

    const order: PendingOrder = {
      ...orderData,
      offlineId,
      synced: false,
      createdAt: new Date().toISOString()
    }

    await savePendingOrder(order)

    // Update count
    const pending = await getUnsyncedOrders()
    setPendingOrdersCount(pending.filter(o => o.sessionId === sessionId).length)

    console.log('[POS Offline] Saved order offline:', offlineId)

    return offlineId
  }, [sessionId])

  // Clear synced orders
  const clearSyncedOrders = useCallback(async () => {
    await deleteSyncedOrders()
    console.log('[POS Offline] Cleared synced orders')
  }, [])

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && pendingOrdersCount > 0) {
      syncToServer()
    }
  }, [isOnline, pendingOrdersCount, syncToServer])

  return {
    isOnline,
    isLoading,
    lastSync,
    pendingOrdersCount,
    products,
    categories,
    syncFromServer,
    syncToServer,
    saveOrderOffline,
    clearSyncedOrders
  }
}
