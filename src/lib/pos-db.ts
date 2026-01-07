/**
 * POS IndexedDB - Offline storage for Point of Sale
 * Uses IndexedDB for storing products, categories, promotions and pending orders offline
 */

const DB_NAME = 'market_pos_db'
const DB_VERSION = 1

// Store names
const STORES = {
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  PROMOTIONS: 'promotions',
  PENDING_ORDERS: 'pending_orders',
  SYNC_STATUS: 'sync_status'
}

interface POSProduct {
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

interface POSCategory {
  id: number
  name: string
  parentId: number | null
}

interface POSPromotion {
  id: number
  name: string
  code: string | null
  type: string
  discountPercent: number | null
  discountAmount: number | null
  appliesTo: string
  productIds: number[]
  categoryIds: number[]
}

interface PendingOrder {
  offlineId: string
  terminalId: number
  sessionId: number
  warehouseId: number | null
  customerId: number | null
  customerName: string | null
  currency: string
  lines: Array<{
    productId: number
    productName: string
    productSku: string | null
    quantity: number
    unitPrice: number
    discountPercent: number
    discountAmount: number
  }>
  payments: Array<{
    method: string
    amount: number
    currency: string
    amountTendered: number | null
    changeAmount: number | null
  }>
  total: number
  createdAt: string
  synced: boolean
}

interface SyncStatus {
  id: string
  lastSync: string
  productsVersion: number
  terminalId: number
}

// Open database connection
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not available'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Products store
      if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
        const productsStore = db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id' })
        productsStore.createIndex('barcode', 'barcode', { unique: false })
        productsStore.createIndex('categoryId', 'categoryId', { unique: false })
        productsStore.createIndex('sku', 'sku', { unique: false })
      }

      // Categories store
      if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
        db.createObjectStore(STORES.CATEGORIES, { keyPath: 'id' })
      }

      // Promotions store
      if (!db.objectStoreNames.contains(STORES.PROMOTIONS)) {
        db.createObjectStore(STORES.PROMOTIONS, { keyPath: 'id' })
      }

      // Pending orders store
      if (!db.objectStoreNames.contains(STORES.PENDING_ORDERS)) {
        const ordersStore = db.createObjectStore(STORES.PENDING_ORDERS, { keyPath: 'offlineId' })
        ordersStore.createIndex('sessionId', 'sessionId', { unique: false })
        ordersStore.createIndex('synced', 'synced', { unique: false })
      }

      // Sync status store
      if (!db.objectStoreNames.contains(STORES.SYNC_STATUS)) {
        db.createObjectStore(STORES.SYNC_STATUS, { keyPath: 'id' })
      }
    }
  })
}

// Generate UUID for offline orders
export function generateOfflineId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// Products operations
export async function saveProducts(products: POSProduct[]): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORES.PRODUCTS, 'readwrite')
  const store = tx.objectStore(STORES.PRODUCTS)

  // Clear existing products
  await new Promise<void>((resolve, reject) => {
    const clearRequest = store.clear()
    clearRequest.onsuccess = () => resolve()
    clearRequest.onerror = () => reject(clearRequest.error)
  })

  // Add new products
  for (const product of products) {
    store.put(product)
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  db.close()
}

export async function getProducts(): Promise<POSProduct[]> {
  const db = await openDB()
  const tx = db.transaction(STORES.PRODUCTS, 'readonly')
  const store = tx.objectStore(STORES.PRODUCTS)

  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => {
      db.close()
      resolve(request.result)
    }
    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}

export async function getProductByBarcode(barcode: string): Promise<POSProduct | null> {
  const db = await openDB()
  const tx = db.transaction(STORES.PRODUCTS, 'readonly')
  const store = tx.objectStore(STORES.PRODUCTS)
  const index = store.index('barcode')

  return new Promise((resolve, reject) => {
    const request = index.get(barcode)
    request.onsuccess = () => {
      db.close()
      resolve(request.result || null)
    }
    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}

// Categories operations
export async function saveCategories(categories: POSCategory[]): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORES.CATEGORIES, 'readwrite')
  const store = tx.objectStore(STORES.CATEGORIES)

  await new Promise<void>((resolve, reject) => {
    const clearRequest = store.clear()
    clearRequest.onsuccess = () => resolve()
    clearRequest.onerror = () => reject(clearRequest.error)
  })

  for (const category of categories) {
    store.put(category)
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  db.close()
}

export async function getCategories(): Promise<POSCategory[]> {
  const db = await openDB()
  const tx = db.transaction(STORES.CATEGORIES, 'readonly')
  const store = tx.objectStore(STORES.CATEGORIES)

  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => {
      db.close()
      resolve(request.result)
    }
    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}

// Promotions operations
export async function savePromotions(promotions: POSPromotion[]): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORES.PROMOTIONS, 'readwrite')
  const store = tx.objectStore(STORES.PROMOTIONS)

  await new Promise<void>((resolve, reject) => {
    const clearRequest = store.clear()
    clearRequest.onsuccess = () => resolve()
    clearRequest.onerror = () => reject(clearRequest.error)
  })

  for (const promo of promotions) {
    store.put(promo)
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  db.close()
}

export async function getPromotions(): Promise<POSPromotion[]> {
  const db = await openDB()
  const tx = db.transaction(STORES.PROMOTIONS, 'readonly')
  const store = tx.objectStore(STORES.PROMOTIONS)

  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => {
      db.close()
      resolve(request.result)
    }
    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}

// Pending orders operations
export async function savePendingOrder(order: PendingOrder): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORES.PENDING_ORDERS, 'readwrite')
  const store = tx.objectStore(STORES.PENDING_ORDERS)

  store.put(order)

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  db.close()
}

export async function getPendingOrders(sessionId?: number): Promise<PendingOrder[]> {
  const db = await openDB()
  const tx = db.transaction(STORES.PENDING_ORDERS, 'readonly')
  const store = tx.objectStore(STORES.PENDING_ORDERS)

  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => {
      db.close()
      let orders = request.result as PendingOrder[]
      if (sessionId) {
        orders = orders.filter(o => o.sessionId === sessionId)
      }
      resolve(orders)
    }
    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}

export async function getUnsyncedOrders(): Promise<PendingOrder[]> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORES.PENDING_ORDERS, 'readonly')
    const store = tx.objectStore(STORES.PENDING_ORDERS)

    // Check if synced index exists
    if (!store.indexNames.contains('synced')) {
      // Fallback: get all orders and filter
      return new Promise((resolve, reject) => {
        const request = store.getAll()
        request.onsuccess = () => {
          db.close()
          const orders = (request.result || []).filter((o: PendingOrder) => o.synced === false)
          resolve(orders)
        }
        request.onerror = () => {
          db.close()
          reject(request.error)
        }
      })
    }

    const index = store.index('synced')
    return new Promise((resolve, reject) => {
      const request = index.getAll(IDBKeyRange.only(false))
      request.onsuccess = () => {
        db.close()
        resolve(request.result || [])
      }
      request.onerror = () => {
        db.close()
        // Fallback on error
        console.warn('[POS DB] Index error, falling back to getAll')
        resolve([])
      }
    })
  } catch (error) {
    console.error('[POS DB] Error getting unsynced orders:', error)
    return []
  }
}

export async function markOrderSynced(offlineId: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORES.PENDING_ORDERS, 'readwrite')
  const store = tx.objectStore(STORES.PENDING_ORDERS)

  return new Promise((resolve, reject) => {
    const getRequest = store.get(offlineId)
    getRequest.onsuccess = () => {
      const order = getRequest.result
      if (order) {
        order.synced = true
        store.put(order)
      }
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
    }
    getRequest.onerror = () => {
      db.close()
      reject(getRequest.error)
    }
  })
}

export async function deleteSyncedOrders(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORES.PENDING_ORDERS, 'readwrite')
    const store = tx.objectStore(STORES.PENDING_ORDERS)

    // Check if synced index exists
    if (!store.indexNames.contains('synced')) {
      // Fallback: get all and delete synced ones
      return new Promise((resolve, reject) => {
        const request = store.openCursor()
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result
          if (cursor) {
            if (cursor.value.synced === true) {
              cursor.delete()
            }
            cursor.continue()
          }
        }
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => {
          db.close()
          reject(tx.error)
        }
      })
    }

    const index = store.index('synced')
    return new Promise((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.only(true))
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        db.close()
        reject(tx.error)
      }
    })
  } catch (error) {
    console.error('[POS DB] Error deleting synced orders:', error)
  }
}

// Sync status operations
export async function getSyncStatus(terminalId: number): Promise<SyncStatus | null> {
  const db = await openDB()
  const tx = db.transaction(STORES.SYNC_STATUS, 'readonly')
  const store = tx.objectStore(STORES.SYNC_STATUS)

  return new Promise((resolve, reject) => {
    const request = store.get(`terminal_${terminalId}`)
    request.onsuccess = () => {
      db.close()
      resolve(request.result || null)
    }
    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}

export async function updateSyncStatus(terminalId: number): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORES.SYNC_STATUS, 'readwrite')
  const store = tx.objectStore(STORES.SYNC_STATUS)

  const status: SyncStatus = {
    id: `terminal_${terminalId}`,
    lastSync: new Date().toISOString(),
    productsVersion: Date.now(),
    terminalId
  }

  store.put(status)

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  db.close()
}

// Clear all POS data
export async function clearAllPOSData(): Promise<void> {
  const db = await openDB()
  const storeNames = [STORES.PRODUCTS, STORES.CATEGORIES, STORES.PROMOTIONS, STORES.PENDING_ORDERS, STORES.SYNC_STATUS]

  for (const storeName of storeNames) {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    await new Promise<void>((resolve, reject) => {
      const request = store.clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  db.close()
}

// Check if IndexedDB is available
export function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.indexedDB
}
