import { create } from 'zustand'
import { api } from '@/src/services/api'
import { useAuthStore } from './auth-store'

interface Warehouse {
  id: number
  name: string
  location?: string
}

interface DashboardStats {
  pendingTransfers: number
  pendingOrders: number
  pendingWholesale: number
  pendingProduction: number
  totalProducts: number
}

interface WarehouseState {
  warehouses: Warehouse[]
  stats: DashboardStats
  isLoading: boolean

  fetchWarehouses: () => Promise<void>
  fetchStats: () => Promise<void>
}

export const useWarehouseStore = create<WarehouseState>((set) => ({
  warehouses: [],
  stats: {
    pendingTransfers: 0,
    pendingOrders: 0,
    pendingWholesale: 0,
    pendingProduction: 0,
    totalProducts: 0,
  },
  isLoading: false,

  fetchWarehouses: async () => {
    set({ isLoading: true })
    try {
      const data = await api.get<Warehouse[]>('/api/market/warehouses/available')
      set({ warehouses: data, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  fetchStats: async () => {
    const warehouseId = useAuthStore.getState().warehouseId
    if (!warehouseId) return

    try {
      const [transfers, orders, wholesale, production] = await Promise.allSettled([
        api.get<any[]>(`/api/market/warehouses/${warehouseId}/pending-transfers`),
        api.get<any[]>(`/api/market/warehouses/${warehouseId}/pending-orders`),
        api.get<any[]>(`/api/market/warehouses/${warehouseId}/pending-wholesale-deliveries`),
        api.get<any[]>(`/api/market/warehouses/${warehouseId}/pending-production`),
      ])

      // Each API returns an object like { transfers: [...] }, { purchaseOrders: [...], consignments: [...] }, etc.
      const transferCount = transfers.status === 'fulfilled'
        ? (transfers.value?.transfers?.length ?? transfers.value?.pendingCount ?? 0) : 0
      const orderCount = orders.status === 'fulfilled'
        ? (orders.value?.totalPendingOrders ?? ((orders.value?.purchaseOrders?.length ?? 0) + (orders.value?.consignments?.length ?? 0))) : 0
      const wholesaleCount = wholesale.status === 'fulfilled'
        ? (wholesale.value?.deliveries?.length ?? wholesale.value?.pendingCount ?? 0) : 0
      const productionCount = production.status === 'fulfilled'
        ? (Array.isArray(production.value) ? production.value.length : (production.value?.length ?? 0)) : 0

      set({
        stats: {
          pendingTransfers: transferCount,
          pendingOrders: orderCount,
          pendingWholesale: wholesaleCount,
          pendingProduction: productionCount,
          totalProducts: 0,
        },
      })
    } catch {}
  },
}))
