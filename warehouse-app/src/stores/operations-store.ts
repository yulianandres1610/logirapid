import { create } from 'zustand'
import { api } from '@/src/services/api'
import { useAuthStore } from './auth-store'
import type { ScannedProduct } from './scanner-store'

export interface OperationLine {
  productId: number
  variantId?: number
  name: string
  sku: string
  barcode: string
  quantity: number
  expectedQuantity?: number
  validatedQuantity?: number
  lotNumber?: string
  expirationDate?: string
  unit?: string
  lineId?: number
  imageUrl?: string
}

export interface Transfer {
  id: number
  operationNumber: string
  sourceWarehouseName: string
  destinationWarehouseName: string
  status: string
  createdAt: string
  lines: OperationLine[]
  totalItems: number
}

export interface PendingOrder {
  id: number
  orderNumber: string
  type: string // 'purchase' | 'consignment' | 'production'
  supplierName: string
  status: string
  createdAt: string
  lines: OperationLine[]
  totalItems: number
}

export interface WholesaleDelivery {
  id: number
  invoiceNumber: string
  customerName: string
  status: string
  createdAt: string
  lines: OperationLine[]
  totalItems: number
}

interface OperationsState {
  // Lists
  pendingTransfers: Transfer[]
  pendingOrders: PendingOrder[]
  pendingWholesale: WholesaleDelivery[]

  // Current operation
  currentLines: OperationLine[]
  destinationWarehouseId: number | null
  isLoading: boolean
  error: string | null

  // Fetch lists
  fetchPendingTransfers: () => Promise<void>
  fetchPendingOrders: () => Promise<void>
  fetchPendingWholesale: () => Promise<void>

  // Line management
  addLine: (product: ScannedProduct, qty: number) => void
  updateLineQty: (index: number, qty: number) => void
  removeLine: (index: number) => void
  updateLineLot: (index: number, lotNumber: string, expirationDate: string) => void
  setDestinationWarehouse: (id: number | null) => void

  // Operations
  confirmTransfer: () => Promise<void>
  confirmScrap: (reason: string, notes: string) => Promise<void>
  confirmAdjustment: (reason: string) => Promise<void>
  validateTransfer: (opId: number, lines: Array<{ lineId: number; quantityValidated: number }>) => Promise<void>
  validateWholesale: (opId: number, lines: Array<{ lineId: number; quantityValidated: number }>) => Promise<void>
  completeWholesale: (opId: number) => Promise<void>
  receiveOrder: (orderType: string, orderId: number, lines: Array<{
    productId: number; variantId?: number; quantity: number; lotNumber?: string; expirationDate?: string
  }>) => Promise<void>

  reset: () => void
}

const getWarehouseId = () => useAuthStore.getState().warehouseId

export const useOperationsStore = create<OperationsState>((set, get) => ({
  pendingTransfers: [],
  pendingOrders: [],
  pendingWholesale: [],
  currentLines: [],
  destinationWarehouseId: null,
  isLoading: false,
  error: null,

  fetchPendingTransfers: async () => {
    const wId = getWarehouseId()
    if (!wId) return
    set({ isLoading: true })
    try {
      const data = await api.get<any>(`/api/market/warehouses/${wId}/pending-transfers`)
      // API returns { transfers: [...] } — map to Transfer[]
      const rawTransfers = data?.transfers || data || []
      const transfers: Transfer[] = (Array.isArray(rawTransfers) ? rawTransfers : []).map((t: any) => ({
        id: t.id,
        operationNumber: t.operationNumber || t.operation_number || '',
        sourceWarehouseName: t.sourceWarehouse?.name || t.sourceWarehouseName || '',
        destinationWarehouseName: t.destinationWarehouse?.name || t.destinationWarehouseName || '',
        status: t.status || '',
        createdAt: t.createdAt || t.created_at || '',
        totalItems: t.totalProducts || t.totalItems || 0,
        lines: (t.lines || []).map((l: any) => ({
          lineId: l.lineId || l.line_id,
          productId: l.productId || l.product_id,
          name: l.productName || l.name || '',
          sku: l.sku || '',
          barcode: l.barcode || l.sku || '',
          quantity: l.quantityExpected || l.quantity || 0,
          expectedQuantity: l.quantityExpected || l.expectedQuantity || l.quantity || 0,
          validatedQuantity: l.quantityValidated || l.validatedQuantity || 0,
        })),
      }))
      set({ pendingTransfers: transfers, isLoading: false })
    } catch (err: any) {
      set({ isLoading: false, error: err.message })
    }
  },

  fetchPendingOrders: async () => {
    const wId = getWarehouseId()
    if (!wId) return
    set({ isLoading: true })
    try {
      const data = await api.get<any>(`/api/market/warehouses/${wId}/pending-orders`)
      // API returns { purchaseOrders: [...], consignments: [...] } — merge into PendingOrder[]
      const purchaseOrders = (data?.purchaseOrders || []).map((po: any) => ({
        id: po.id,
        orderNumber: po.orderNumber || po.order_number || '',
        type: 'purchase' as const,
        supplierName: po.supplierName || po.supplier_name || '',
        status: 'pending',
        createdAt: po.createdAt || po.created_at || '',
        totalItems: po.itemCount || po.totalItems || 0,
        lines: (po.lines || []).map((l: any) => ({
          productId: l.productId || l.product_id,
          name: l.productName || l.name || '',
          sku: l.sku || '',
          barcode: l.barcode || l.sku || '',
          quantity: l.quantity || 0,
          expectedQuantity: l.quantity || l.expectedQuantity || 0,
        })),
      }))
      const consignments = (data?.consignments || []).map((co: any) => ({
        id: co.id,
        orderNumber: co.orderNumber || co.order_number || '',
        type: 'consignment' as const,
        supplierName: co.providerName || co.provider_name || '',
        status: co.status || 'in_transit',
        createdAt: co.sentAt || co.sent_at || '',
        totalItems: co.itemCount || co.totalItems || 0,
        lines: (co.lines || []).map((l: any) => ({
          productId: l.productId || l.product_id,
          name: l.productName || l.name || '',
          sku: l.sku || '',
          barcode: l.barcode || l.sku || '',
          quantity: l.quantity || 0,
          expectedQuantity: l.quantity || l.expectedQuantity || 0,
        })),
      }))
      set({ pendingOrders: [...purchaseOrders, ...consignments], isLoading: false })
    } catch (err: any) {
      set({ isLoading: false, error: err.message })
    }
  },

  fetchPendingWholesale: async () => {
    const wId = getWarehouseId()
    if (!wId) return
    set({ isLoading: true })
    try {
      const data = await api.get<any>(`/api/market/warehouses/${wId}/pending-wholesale-deliveries`)
      // API returns { deliveries: [...] } — map to WholesaleDelivery[]
      const rawDeliveries = data?.deliveries || data || []
      const deliveries: WholesaleDelivery[] = (Array.isArray(rawDeliveries) ? rawDeliveries : []).map((d: any) => ({
        id: d.id,
        invoiceNumber: d.invoiceNumber || d.operationNumber || '',
        customerName: d.customer?.name || d.customerName || '',
        status: d.status || '',
        createdAt: d.createdAt || d.created_at || '',
        totalItems: d.totalProducts || d.totalItems || 0,
        lines: (d.lines || []).map((l: any) => ({
          lineId: l.lineId || l.line_id,
          productId: l.productId || l.product_id,
          variantId: l.variantId || l.variant_id,
          name: l.productName || l.name || '',
          sku: l.sku || '',
          barcode: l.barcode || l.sku || '',
          quantity: l.quantityExpected || l.quantity || 0,
          expectedQuantity: l.quantityExpected || l.expectedQuantity || l.quantity || 0,
          validatedQuantity: l.quantityValidated || l.validatedQuantity || 0,
        })),
      }))
      set({ pendingWholesale: deliveries, isLoading: false })
    } catch (err: any) {
      set({ isLoading: false, error: err.message })
    }
  },

  addLine: (product: ScannedProduct, qty: number) => {
    const { currentLines } = get()
    const existingIdx = currentLines.findIndex(
      (l) => l.productId === product.productId && l.variantId === product.variantId,
    )
    if (existingIdx >= 0) {
      const updated = [...currentLines]
      updated[existingIdx] = {
        ...updated[existingIdx],
        quantity: updated[existingIdx].quantity + qty,
      }
      set({ currentLines: updated })
    } else {
      set({
        currentLines: [
          ...currentLines,
          {
            productId: product.productId,
            variantId: product.variantId,
            name: product.name,
            sku: product.sku,
            barcode: product.barcode,
            quantity: qty,
            unit: product.unit,
            imageUrl: product.image,
          },
        ],
      })
    }
  },

  updateLineQty: (index: number, qty: number) => {
    const updated = [...get().currentLines]
    if (updated[index]) {
      updated[index] = { ...updated[index], quantity: Math.max(0, qty) }
      set({ currentLines: updated })
    }
  },

  removeLine: (index: number) => {
    const updated = [...get().currentLines]
    updated.splice(index, 1)
    set({ currentLines: updated })
  },

  updateLineLot: (index: number, lotNumber: string, expirationDate: string) => {
    const updated = [...get().currentLines]
    if (updated[index]) {
      updated[index] = { ...updated[index], lotNumber, expirationDate }
      set({ currentLines: updated })
    }
  },

  setDestinationWarehouse: (id: number | null) => {
    set({ destinationWarehouseId: id })
  },

  confirmTransfer: async () => {
    const wId = getWarehouseId()
    if (!wId) return
    const { currentLines, destinationWarehouseId } = get()
    if (!destinationWarehouseId || currentLines.length === 0) return

    set({ isLoading: true, error: null })
    try {
      await api.post(`/api/market/warehouses/${wId}/operations/confirm`, {
        operationType: 'transfer',
        destinationWarehouseId,
        lines: currentLines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          quantity: l.quantity,
        })),
      })
      set({ currentLines: [], destinationWarehouseId: null, isLoading: false })
    } catch (err: any) {
      set({ isLoading: false, error: err.message })
      throw err
    }
  },

  confirmScrap: async (reason: string, notes: string) => {
    const wId = getWarehouseId()
    if (!wId) return
    const { currentLines } = get()
    if (currentLines.length === 0) return

    set({ isLoading: true, error: null })
    try {
      await api.post(`/api/market/warehouses/${wId}/operations/confirm`, {
        operationType: 'scrap',
        reason,
        notes,
        lines: currentLines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          quantity: l.quantity,
        })),
      })
      set({ currentLines: [], isLoading: false })
    } catch (err: any) {
      set({ isLoading: false, error: err.message })
      throw err
    }
  },

  confirmAdjustment: async (reason: string) => {
    const wId = getWarehouseId()
    if (!wId) return
    const { currentLines } = get()
    if (currentLines.length === 0) return

    set({ isLoading: true, error: null })
    try {
      await api.post(`/api/market/warehouses/${wId}/operations/confirm`, {
        operationType: 'adjustment',
        reason,
        lines: currentLines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          quantity: l.quantity,
        })),
      })
      set({ currentLines: [], isLoading: false })
    } catch (err: any) {
      set({ isLoading: false, error: err.message })
      throw err
    }
  },

  validateTransfer: async (opId: number, lines) => {
    const wId = getWarehouseId()
    if (!wId) return
    set({ isLoading: true, error: null })
    try {
      await api.post(`/api/market/warehouses/${wId}/operations/${opId}/validate`, { lines })
      set({ isLoading: false })
    } catch (err: any) {
      set({ isLoading: false, error: err.message })
      throw err
    }
  },

  validateWholesale: async (opId: number, lines) => {
    const wId = getWarehouseId()
    if (!wId) return
    set({ isLoading: true, error: null })
    try {
      await api.post(`/api/market/warehouses/${wId}/wholesale-deliveries/${opId}/validate`, { lines })
      set({ isLoading: false })
    } catch (err: any) {
      set({ isLoading: false, error: err.message })
      throw err
    }
  },

  completeWholesale: async (opId: number) => {
    const wId = getWarehouseId()
    if (!wId) return
    set({ isLoading: true, error: null })
    try {
      await api.post(`/api/market/warehouses/${wId}/wholesale-deliveries/${opId}/complete`)
      set({ isLoading: false })
    } catch (err: any) {
      set({ isLoading: false, error: err.message })
      throw err
    }
  },

  receiveOrder: async (orderType, orderId, lines) => {
    const wId = getWarehouseId()
    if (!wId) return
    set({ isLoading: true, error: null })
    try {
      await api.post(`/api/market/warehouses/${wId}/unified-receive`, {
        orderType,
        orderId,
        lines,
      })
      set({ currentLines: [], isLoading: false })
    } catch (err: any) {
      set({ isLoading: false, error: err.message })
      throw err
    }
  },

  reset: () => {
    set({
      currentLines: [],
      destinationWarehouseId: null,
      error: null,
    })
  },
}))
