import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api } from '@/src/services/api'

interface User {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

interface AuthState {
  token: string | null
  user: User | null
  warehouseId: number | null
  warehouseName: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setWarehouse: (id: number, name: string) => void
  init: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  warehouseId: null,
  warehouseName: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      const res = await fetch('https://fabrica.servisumic.com/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Credenciales incorrectas')

      const token = json.token
      const rawUser = json.user
      const user: User = {
        userId: rawUser.id,
        email: rawUser.email,
        role: rawUser.role,
        companyId: rawUser.companyId,
        companyName: rawUser.companyName,
      }
      api.setToken(token)

      await AsyncStorage.setItem('auth-token', token)
      await AsyncStorage.setItem('auth-user', JSON.stringify(user))

      // Restore saved warehouse
      const savedWarehouseId = await AsyncStorage.getItem('warehouse-id')
      const savedWarehouseName = await AsyncStorage.getItem('warehouse-name')

      set({
        token,
        user,
        isAuthenticated: true,
        isLoading: false,
        warehouseId: savedWarehouseId ? Number(savedWarehouseId) : null,
        warehouseName: savedWarehouseName,
      })
    } catch (err: any) {
      set({ isLoading: false, error: err.message })
      throw err
    }
  },

  logout: () => {
    api.setToken(null)
    AsyncStorage.multiRemove(['auth-token', 'auth-user'])
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })
  },

  setWarehouse: (id: number, name: string) => {
    AsyncStorage.setItem('warehouse-id', String(id))
    AsyncStorage.setItem('warehouse-name', name)
    set({ warehouseId: id, warehouseName: name })
  },

  init: async () => {
    try {
      const token = await AsyncStorage.getItem('auth-token')
      const userStr = await AsyncStorage.getItem('auth-user')
      const warehouseId = await AsyncStorage.getItem('warehouse-id')
      const warehouseName = await AsyncStorage.getItem('warehouse-name')

      if (token && userStr) {
        const user = JSON.parse(userStr)
        api.setToken(token)
        set({
          token,
          user,
          isAuthenticated: true,
          isLoading: false,
          warehouseId: warehouseId ? Number(warehouseId) : null,
          warehouseName,
        })
      } else {
        set({ isLoading: false })
      }
    } catch {
      set({ isLoading: false })
    }
  },
}))
