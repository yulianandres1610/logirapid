import { create } from 'zustand'
import { api } from '@/src/services/api'
import { useAuthStore } from './auth-store'
import { playSuccessBeep, playErrorBeep, vibrateSuccess, vibrateError } from '@/src/services/feedback'

export interface ScannedVariant {
  id: number
  name: string
  sku: string
  barcode: string
  stock: number
  price: number
  costPrice: number
  imageUrl?: string
}

export interface LotInfo {
  lotNumber: string
  expirationDate: string | null
  quantityAvailable: number
  unitCost: number
  source: string
  receivedAt: string
}

export interface ScannedProduct {
  productId: number
  variantId?: number
  name: string
  sku: string
  barcode: string
  description?: string
  category?: string
  currentStock: number
  quantityAvailable: number
  quantityReserved: number
  costPrice: number
  sellingPrice: number
  warehouseName?: string
  variants?: ScannedVariant[]
  lots?: LotInfo[]
  unit?: string
  image?: string
  detectedWeight?: number | null
}

interface ScannerState {
  lastProduct: ScannedProduct | null
  isProcessing: boolean
  error: string | null

  processBarcode: (barcode: string) => Promise<ScannedProduct | null>
  clear: () => void
}

export const useScannerStore = create<ScannerState>((set) => ({
  lastProduct: null,
  isProcessing: false,
  error: null,

  processBarcode: async (barcode: string) => {
    const warehouseId = useAuthStore.getState().warehouseId
    if (!warehouseId) {
      set({ error: 'No hay almacén seleccionado' })
      playErrorBeep()
      vibrateError()
      return null
    }

    set({ isProcessing: true, error: null })
    try {
      const raw = await api.post<any>(
        `/api/market/warehouses/${warehouseId}/scan-product`,
        { barcode },
      )
      // Map API response { product, variant?, variants?, stock } → ScannedProduct
      const p = raw.product || raw
      const stock = raw.stock || {}
      const variants: ScannedVariant[] = (raw.variants || []).map((v: any) => ({
        id: v.id,
        name: v.name,
        sku: v.sku || '',
        barcode: v.barcode || '',
        stock: v.quantityOnHand ?? v.stock ?? 0,
        price: v.price ?? 0,
        costPrice: v.costPrice ?? 0,
        imageUrl: v.imageUrl || undefined,
      }))
      const product: ScannedProduct = {
        productId: p.id ?? p.productId,
        variantId: raw.variant?.id || (variants.length === 1 ? variants[0].id : undefined),
        name: raw.variant ? `${p.name} — ${raw.variant.name}` : p.name,
        sku: raw.variant?.sku || p.sku,
        barcode: raw.variant?.barcode || p.barcode || barcode,
        description: p.description || undefined,
        category: p.category || undefined,
        currentStock: stock.quantityOnHand ?? p.currentStock ?? 0,
        quantityAvailable: stock.quantityAvailable ?? stock.quantityOnHand ?? 0,
        quantityReserved: stock.quantityReserved ?? 0,
        costPrice: raw.variant?.costPrice ?? p.costPrice ?? 0,
        sellingPrice: raw.variant?.price ?? p.sellingPrice ?? 0,
        warehouseName: stock.warehouseName || undefined,
        unit: p.unit || 'unidad',
        image: raw.variant?.imageUrl || p.imageUrl || p.image || undefined,
        variants: variants.length > 1 ? variants : undefined,
        lots: raw.lots || undefined,
        detectedWeight: raw.detectedWeight || null,
      }
      set({ lastProduct: product, isProcessing: false })
      playSuccessBeep()
      vibrateSuccess()
      return product
    } catch (err: any) {
      set({ isProcessing: false, error: err.message })
      playErrorBeep()
      vibrateError()
      return null
    }
  },

  clear: () => set({ lastProduct: null, error: null }),
}))
