import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api } from '@/src/services/api'
import { playSuccessBeep, playErrorBeep, vibrateSuccess, vibrateError } from '@/src/services/feedback'

// ── Types ──

export interface ProductVariant {
  id: number
  name: string
  sku: string
  barcode: string | null
  imageUrl: string | null
  costPrice: number
  sellingPrice: number
  stock: number
}

export interface Product {
  id: number
  name: string
  sku: string
  barcode: string | null
  imageUrl: string | null
  costPrice: number
  sellingPrice: number
  stock: number
  hasVariants: boolean
  variants?: ProductVariant[]
}

export interface FixedAsset {
  id: number
  assetCode: string
  barcode: string | null
  name: string
  description: string | null
  status: string
  condition: string
  acquisitionCost: number
  currentValue: number
  warehouseId: number
  warehouseName: string
  locationCode: string | null
  categoryId: number | null
  categoryName: string | null
  responsibleEmployeeId: number | null
  responsibleName: string | null
  lastAuditDate: string | null
  imageUrl: string | null
  brand: string | null
  model: string | null
  serialNumber: string | null
}

export interface CountLine {
  productId: number
  variantId?: number
  productName: string
  productSku: string
  productBarcode: string
  productImage: string | null
  costPrice: number
  sellingPrice: number
  systemQuantity: number
  countedQuantity: number
}

export interface AssetCountLine {
  assetId: number
  assetCode: string
  assetBarcode: string | null
  assetName: string
  categoryName: string | null
  responsibleName: string | null
  currentValue: number
  expectedWarehouseId: number
  expectedCondition: string
  scanStatus: 'found' | 'missing' | 'surplus'
  productImage?: string | null
}

export interface AuditCount {
  id: number
  countNumber: string
  warehouseId: number
  warehouseName: string
  status: string
  auditType: string
  totalProducts?: number
  productsWithDifferences?: number
  totalShortageValue?: number
  totalExcessValue?: number
  totalAssets?: number
  assetsFound?: number
  assetsMissing?: number
  totalValueAtRisk?: number
  countedByName?: string
  startedAt: string
  completedAt?: string
  lines?: any[]
}

// Key for countedItems: "productId" or "productId-variantId"
function countKey(productId: number, variantId?: number): string {
  return variantId ? `${productId}-${variantId}` : `${productId}`
}

// ── Store ──

interface AuditState {
  // Product counting
  products: Product[]
  barcodeMap: Map<string, { product: Product; variant?: ProductVariant }>
  countedItems: Map<string, number>
  isLoadingProducts: boolean
  lastScannedKey: string | null

  // Fixed asset counting
  assets: FixedAsset[]
  assetBarcodeMap: Map<string, FixedAsset>
  foundAssets: Set<number> // asset IDs that have been found
  isLoadingAssets: boolean
  lastScannedAssetId: number | null

  // Count metadata
  countId: number | null
  countNumber: string | null

  // Reports
  reports: AuditCount[]
  isLoadingReports: boolean

  // Actions - Products
  fetchProducts: (warehouseId: number) => Promise<void>
  scanBarcode: (barcode: string) => { product: Product; variant?: ProductVariant } | null
  setQuantity: (productId: number, variantId: number | undefined, qty: number) => void
  incrementQuantity: (productId: number, variantId?: number) => void

  // Actions - Assets
  fetchAssets: (warehouseId: number) => Promise<void>
  scanAssetBarcode: (barcode: string) => FixedAsset | null
  markAssetFound: (assetId: number) => void
  markAssetMissing: (assetId: number) => void

  // Actions - Save/Complete
  saveCount: (warehouseId: number) => Promise<void>
  completeCount: (warehouseId: number) => Promise<void>
  saveAssetCount: (warehouseId: number) => Promise<void>
  completeAssetCount: (warehouseId: number) => Promise<void>
  checkExistingCount: (warehouseId: number, auditType: string) => Promise<number | null>
  loadExistingCount: (countId: number) => Promise<void>

  // Actions - Reports
  fetchReports: (warehouseId?: number, auditType?: string) => Promise<void>
  fetchReportDetail: (countId: number) => Promise<AuditCount | null>

  // Actions - Persistence
  persistLocally: (warehouseId: number) => Promise<void>
  restoreFromLocal: (warehouseId: number) => Promise<boolean>
  clearLocal: (warehouseId: number) => Promise<void>

  // Actions - Reset
  resetProductCount: () => void
  resetAssetCount: () => void
}

export const useAuditStore = create<AuditState>((set, get) => ({
  products: [],
  barcodeMap: new Map(),
  countedItems: new Map(),
  isLoadingProducts: false,
  lastScannedKey: null,

  assets: [],
  assetBarcodeMap: new Map(),
  foundAssets: new Set(),
  isLoadingAssets: false,
  lastScannedAssetId: null,

  countId: null,
  countNumber: null,

  reports: [],
  isLoadingReports: false,

  // ── Products ──

  fetchProducts: async (warehouseId: number) => {
    set({ isLoadingProducts: true })
    try {
      const data = await api.get<{ products: Product[] }>(
        `/api/audit/products?warehouseId=${warehouseId}`
      )

      const barcodeMap = new Map<string, { product: Product; variant?: ProductVariant }>()

      for (const product of data.products) {
        // Map product barcode
        if (product.barcode) {
          barcodeMap.set(product.barcode, { product })
        }
        // Map product SKU as fallback
        if (product.sku) {
          barcodeMap.set(product.sku, { product })
        }
        // Map variant barcodes
        if (product.variants) {
          for (const variant of product.variants) {
            if (variant.barcode) {
              barcodeMap.set(variant.barcode, { product, variant })
            }
            if (variant.sku) {
              barcodeMap.set(variant.sku, { product, variant })
            }
          }
        }
      }

      set({
        products: data.products,
        barcodeMap,
        isLoadingProducts: false,
      })
    } catch (err) {
      console.error('[AuditStore] fetchProducts error:', err)
      set({ isLoadingProducts: false })
    }
  },

  scanBarcode: (barcode: string) => {
    const { barcodeMap } = get()
    const match = barcodeMap.get(barcode)

    if (match) {
      playSuccessBeep()
      vibrateSuccess()

      // Auto-increment
      const key = countKey(match.product.id, match.variant?.id)
      const current = get().countedItems.get(key) || 0
      const newMap = new Map(get().countedItems)
      newMap.set(key, current + 1)
      set({ countedItems: newMap, lastScannedKey: key })

      return match
    } else {
      playErrorBeep()
      vibrateError()
      return null
    }
  },

  setQuantity: (productId: number, variantId: number | undefined, qty: number) => {
    const key = countKey(productId, variantId)
    const newMap = new Map(get().countedItems)
    newMap.set(key, Math.max(0, qty))
    set({ countedItems: newMap })
  },

  incrementQuantity: (productId: number, variantId?: number) => {
    const key = countKey(productId, variantId)
    const current = get().countedItems.get(key) || 0
    const newMap = new Map(get().countedItems)
    newMap.set(key, current + 1)
    set({ countedItems: newMap })
  },

  // ── Assets ──

  fetchAssets: async (warehouseId: number) => {
    set({ isLoadingAssets: true })
    try {
      const data = await api.get<{ assets: FixedAsset[] }>(
        `/api/audit/fixed-assets?warehouseId=${warehouseId}`
      )

      const assetBarcodeMap = new Map<string, FixedAsset>()
      for (const asset of data.assets) {
        if (asset.barcode) {
          assetBarcodeMap.set(asset.barcode, asset)
        }
        if (asset.assetCode) {
          assetBarcodeMap.set(asset.assetCode, asset)
        }
      }

      set({
        assets: data.assets,
        assetBarcodeMap,
        isLoadingAssets: false,
      })
    } catch (err) {
      console.error('[AuditStore] fetchAssets error:', err)
      set({ isLoadingAssets: false })
    }
  },

  scanAssetBarcode: (barcode: string) => {
    const { assetBarcodeMap } = get()
    const match = assetBarcodeMap.get(barcode)

    if (match) {
      playSuccessBeep()
      vibrateSuccess()

      const newFound = new Set(get().foundAssets)
      newFound.add(match.id)
      set({ foundAssets: newFound, lastScannedAssetId: match.id })

      return match
    } else {
      playErrorBeep()
      vibrateError()
      return null
    }
  },

  markAssetFound: (assetId: number) => {
    const newFound = new Set(get().foundAssets)
    newFound.add(assetId)
    set({ foundAssets: newFound })
  },

  markAssetMissing: (assetId: number) => {
    const newFound = new Set(get().foundAssets)
    newFound.delete(assetId)
    set({ foundAssets: newFound })
  },

  // ── Save / Complete ──

  saveCount: async (warehouseId: number) => {
    const { products, countedItems, countId } = get()
    const lines = buildProductLines(products, countedItems)

    const result = await api.post<{ countId: number; countNumber: string }>('/api/audit/counts', {
      warehouseId,
      auditType: 'products',
      action: 'save',
      countId: countId || undefined,
      lines,
    })

    set({ countId: result.countId, countNumber: result.countNumber })

    // Persist locally as backup
    await get().persistLocally(warehouseId)
  },

  completeCount: async (warehouseId: number) => {
    const { products, countedItems, countId } = get()
    const lines = buildProductLines(products, countedItems)

    await api.post('/api/audit/counts', {
      warehouseId,
      auditType: 'products',
      action: 'complete',
      countId: countId || undefined,
      lines,
    })

    // Clear local backup
    await get().clearLocal(warehouseId)
    get().resetProductCount()
  },

  saveAssetCount: async (warehouseId: number) => {
    const { assets, foundAssets, countId } = get()
    const assetLines = buildAssetLines(assets, foundAssets, warehouseId)

    const result = await api.post<{ countId: number; countNumber: string }>('/api/audit/counts', {
      warehouseId,
      auditType: 'fixed_assets',
      action: 'save',
      countId: countId || undefined,
      assetLines,
    })

    set({ countId: result.countId, countNumber: result.countNumber })
  },

  completeAssetCount: async (warehouseId: number) => {
    const { assets, foundAssets, countId } = get()
    const assetLines = buildAssetLines(assets, foundAssets, warehouseId)

    await api.post('/api/audit/counts', {
      warehouseId,
      auditType: 'fixed_assets',
      action: 'complete',
      countId: countId || undefined,
      assetLines,
    })

    get().resetAssetCount()
  },

  checkExistingCount: async (warehouseId: number, auditType: string) => {
    try {
      const data = await api.get<{ count: { id: number } | null }>(
        `/api/audit/counts?warehouseId=${warehouseId}&status=in_progress&auditType=${auditType}`
      )
      if (data.count) {
        set({ countId: data.count.id })
        return data.count.id
      }
      return null
    } catch {
      return null
    }
  },

  loadExistingCount: async (countId: number) => {
    try {
      const data = await api.get<AuditCount>(`/api/audit/counts?countId=${countId}`)
      if (!data || !data.lines) return

      set({ countId: data.id, countNumber: data.countNumber })

      if (data.auditType === 'products') {
        const newCounted = new Map<string, number>()
        for (const line of data.lines) {
          const key = countKey(line.productId, line.variantId)
          newCounted.set(key, line.countedQuantity || 0)
        }
        set({ countedItems: newCounted })
      } else if (data.auditType === 'fixed_assets') {
        const newFound = new Set<number>()
        for (const line of data.lines) {
          if (line.scanStatus === 'found') {
            newFound.add(line.assetId)
          }
        }
        set({ foundAssets: newFound })
      }
    } catch (err) {
      console.error('[AuditStore] loadExistingCount error:', err)
    }
  },

  // ── Reports ──

  fetchReports: async (warehouseId?: number, auditType?: string) => {
    set({ isLoadingReports: true })
    try {
      let url = '/api/audit/counts?limit=50'
      if (warehouseId) url += `&warehouseId=${warehouseId}`
      if (auditType) url += `&auditType=${auditType}`

      const data = await api.get<{ counts: AuditCount[] }>(url)
      set({ reports: data.counts, isLoadingReports: false })
    } catch {
      set({ isLoadingReports: false })
    }
  },

  fetchReportDetail: async (countId: number) => {
    try {
      const data = await api.get<AuditCount>(`/api/audit/counts?countId=${countId}`)
      return data
    } catch {
      return null
    }
  },

  // ── Local Persistence ──

  persistLocally: async (warehouseId: number) => {
    const { countedItems, countId, countNumber } = get()
    const data = {
      countId,
      countNumber,
      items: Array.from(countedItems.entries()),
      timestamp: Date.now(),
    }
    await AsyncStorage.setItem(`audit-products-${warehouseId}`, JSON.stringify(data))
  },

  restoreFromLocal: async (warehouseId: number) => {
    try {
      const raw = await AsyncStorage.getItem(`audit-products-${warehouseId}`)
      if (!raw) return false

      const data = JSON.parse(raw)
      const newMap = new Map<string, number>(data.items)

      set({
        countedItems: newMap,
        countId: data.countId || null,
        countNumber: data.countNumber || null,
      })
      return true
    } catch {
      return false
    }
  },

  clearLocal: async (warehouseId: number) => {
    await AsyncStorage.removeItem(`audit-products-${warehouseId}`)
  },

  // ── Reset ──

  resetProductCount: () => {
    set({
      countedItems: new Map(),
      countId: null,
      countNumber: null,
      lastScannedKey: null,
    })
  },

  resetAssetCount: () => {
    set({
      foundAssets: new Set(),
      countId: null,
      countNumber: null,
      lastScannedAssetId: null,
    })
  },
}))

// ── Helpers ──

function buildProductLines(products: Product[], countedItems: Map<string, number>): CountLine[] {
  const lines: CountLine[] = []

  for (const product of products) {
    if (product.hasVariants && product.variants) {
      for (const variant of product.variants) {
        const key = countKey(product.id, variant.id)
        lines.push({
          productId: product.id,
          variantId: variant.id,
          productName: `${product.name} - ${variant.name}`,
          productSku: variant.sku || product.sku,
          productBarcode: variant.barcode || product.barcode || '',
          productImage: variant.imageUrl || product.imageUrl,
          costPrice: variant.costPrice || product.costPrice,
          sellingPrice: variant.sellingPrice || product.sellingPrice,
          systemQuantity: variant.stock,
          countedQuantity: countedItems.get(key) || 0,
        })
      }
    } else {
      const key = countKey(product.id)
      lines.push({
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        productBarcode: product.barcode || '',
        productImage: product.imageUrl,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        systemQuantity: product.stock,
        countedQuantity: countedItems.get(key) || 0,
      })
    }
  }

  return lines
}

function buildAssetLines(assets: FixedAsset[], foundAssets: Set<number>, warehouseId: number): AssetCountLine[] {
  return assets.map((asset) => ({
    assetId: asset.id,
    assetCode: asset.assetCode,
    assetBarcode: asset.barcode,
    assetName: asset.name,
    categoryName: asset.categoryName,
    responsibleName: asset.responsibleName,
    currentValue: asset.currentValue,
    expectedWarehouseId: warehouseId,
    expectedCondition: asset.condition || 'good',
    scanStatus: foundAssets.has(asset.id) ? 'found' as const : 'missing' as const,
    productImage: asset.imageUrl,
  }))
}
