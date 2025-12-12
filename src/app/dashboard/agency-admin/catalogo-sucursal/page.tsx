'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { useAuth } from '@/hooks/useAuth'
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  DollarSign,
  RefreshCw,
  Search,
  X,
  Save,
  ChevronDown,
  Layers,
  TrendingUp,
  CheckCircle,
  Tag,
  Box,
  Banknote,
  Smartphone,
  ShoppingBag,
  Users,
  Percent,
  ChevronRight
} from 'lucide-react'

// Interfaces
interface Product {
  id: number
  code: string
  name: string
  description: string | null
  category: string
  miCosto: number // Lo que la sucursal paga a la matriz
  serviciosCount: number
  isActive: boolean
}

interface ProductService {
  id: number
  productId: number
  serviceName: string
  serviceDescription: string | null
  costPrice: number
  sellPrice: number
  margin: number
  marginPercentage: number
  isRequired: boolean
  isDefaultSelected: boolean
  isActive: boolean
}

interface Commission {
  id: number
  productId: number | null
  serviceId: number | null
  role: string
  commissionType: 'percentage' | 'fixed'
  commissionValue: number
  maxAmount: number | null
}

const CATEGORIES = [
  { id: 'paqueteria', name: 'Paqueteria', icon: Box, color: 'blue', gradient: 'from-blue-500 to-blue-600' },
  { id: 'remesa', name: 'Remesa', icon: Banknote, color: 'emerald', gradient: 'from-emerald-500 to-emerald-600' },
  { id: 'recarga', name: 'Recarga', icon: Smartphone, color: 'purple', gradient: 'from-purple-500 to-purple-600' },
  { id: 'mercado', name: 'Mercado', icon: ShoppingBag, color: 'orange', gradient: 'from-orange-500 to-orange-600' }
]

const ROLES = ['USER', 'MANAGER', 'DRIVER']

const getCategoryConfig = (categoryId: string) => {
  return CATEGORIES.find(c => c.id === categoryId) || CATEGORIES[0]
}

export default function CatalogoSucursalPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const isDark = theme === 'dark'
  const companyId = user?.companyId

  // Get initial tab from URL or default to 'productos'
  const validTabs = ['productos', 'precios', 'comisiones'] as const
  const tabFromUrl = searchParams.get('tab')
  const initialTab = validTabs.includes(tabFromUrl as typeof validTabs[number])
    ? tabFromUrl as typeof validTabs[number]
    : 'productos'

  // States
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'productos' | 'precios' | 'comisiones'>(initialTab)

  // Update URL when tab changes
  const handleTabChange = useCallback((tab: typeof validTabs[number]) => {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.push(`?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  // Tab 2: Precio Venta Publico
  const [publicPrices, setPublicPrices] = useState<Record<number, number | null>>({})
  const [servicePrices, setServicePrices] = useState<Record<number, number | null>>({})
  const [allServices, setAllServices] = useState<ProductService[]>([])
  const [savingPublicPrices, setSavingPublicPrices] = useState(false)
  const [expandedPriceProducts, setExpandedPriceProducts] = useState<Set<number>>(new Set())

  // Tab 3: Comisiones
  const [selectedRole, setSelectedRole] = useState<string>('USER')
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [allRolesCommissions, setAllRolesCommissions] = useState<Commission[]>([])
  const [savingCommissions, setSavingCommissions] = useState(false)
  const [productCommissions, setProductCommissions] = useState<Record<number, { type: 'percentage' | 'fixed', value: number, maxAmount: number | null }>>({})

  // Fetch products for this branch
  const fetchProducts = useCallback(async () => {
    if (!companyId) return
    try {
      setLoading(true)
      const response = await fetch(`/api/companies/${companyId}/products/pricing`)
      const data = await response.json()

      if (data.success && data.data.products) {
        const mappedProducts = data.data.products.map((p: any) => ({
          id: p.productId,
          code: p.code,
          name: p.name,
          description: p.description,
          category: p.serviceCategory,
          miCosto: parseFloat(p.miCosto) || 0,
          serviciosCount: p.servicesCount || 0,
          isActive: p.isActive !== false
        }))
        setProducts(mappedProducts)

        // Also load public prices
        const prices: Record<number, number | null> = {}
        data.data.products.forEach((p: any) => {
          if (p.precioClientes !== null && p.precioClientes !== undefined) {
            prices[p.productId] = parseFloat(p.precioClientes)
          }
        })
        setPublicPrices(prev => ({ ...prev, ...prices }))
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      showNotification('error', 'Error', 'Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }, [companyId, showNotification])

  // Fetch all services for price tab
  const fetchAllServices = useCallback(async () => {
    if (!companyId) return
    try {
      const response = await fetch(`/api/companies/${companyId}/products/services`)
      const data = await response.json()
      if (data.success && data.data) {
        setAllServices(data.data)
        // Initialize service prices
        const prices: Record<number, number | null> = {}
        data.data.forEach((s: ProductService) => {
          prices[s.id] = s.sellPrice || null
        })
        setServicePrices(prev => ({ ...prev, ...prices }))
      }
    } catch (error) {
      console.error('Error fetching all services:', error)
    }
  }, [companyId])

  // Fetch commissions for selected role
  const fetchCommissions = useCallback(async () => {
    if (!companyId) return
    try {
      const response = await fetch(`/api/companies/${companyId}/commissions?role=${selectedRole}`)
      const data = await response.json()
      if (data.success && data.data) {
        setCommissions(data.data.commissions || [])
      }
    } catch (error) {
      console.error('Error fetching commissions:', error)
    }
  }, [companyId, selectedRole])

  // Fetch ALL commissions (all roles) to calculate used margin
  const fetchAllRolesCommissions = useCallback(async () => {
    if (!companyId) return
    try {
      const response = await fetch(`/api/companies/${companyId}/commissions`)
      const data = await response.json()
      if (data.success && data.data) {
        setAllRolesCommissions(data.data.commissions || [])
      }
    } catch (error) {
      console.error('Error fetching all commissions:', error)
    }
  }, [companyId])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  useEffect(() => {
    if (activeTab === 'precios') {
      fetchAllServices()
    }
  }, [activeTab, fetchAllServices])

  useEffect(() => {
    if (activeTab === 'comisiones') {
      fetchCommissions()
      fetchAllRolesCommissions()
      fetchAllServices()
    }
  }, [activeTab, fetchCommissions, fetchAllRolesCommissions, fetchAllServices])

  // Calculate services cost for a product
  const getServicesCost = useCallback((productId: number) => {
    return allServices
      .filter(s => s.productId === productId)
      .reduce((sum, s) => sum + (s.costPrice || 0), 0)
  }, [allServices])

  // Get other roles commission for a product
  const getOtherRolesCommissionForProduct = useCallback((productId: number, productPublicPrice: number) => {
    const otherRolesCommissions = allRolesCommissions.filter(
      c => c.productId === productId && c.role !== selectedRole
    )
    return otherRolesCommissions.reduce((sum, c) => {
      if (c.commissionType === 'fixed') {
        return sum + c.commissionValue
      } else {
        return sum + (productPublicPrice * c.commissionValue / 100)
      }
    }, 0)
  }, [allRolesCommissions, selectedRole])

  // Save public prices
  const handleSavePublicPrices = async () => {
    if (!companyId) return

    setSavingPublicPrices(true)
    try {
      let savedCount = 0
      let errorCount = 0

      // Save product prices
      for (const [productId, price] of Object.entries(publicPrices)) {
        if (price !== null && price !== undefined) {
          try {
            const response = await fetch(`/api/companies/${companyId}/products/pricing`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                productId: parseInt(productId),
                precioClientes: price
              })
            })
            const data = await response.json()
            if (data.success) {
              savedCount++
            } else {
              errorCount++
            }
          } catch {
            errorCount++
          }
        }
      }

      // Save service prices
      for (const [serviceId, price] of Object.entries(servicePrices)) {
        if (price !== null && price !== undefined) {
          const service = allServices.find(s => s.id === parseInt(serviceId))
          if (service) {
            try {
              const response = await fetch(`/api/companies/${companyId}/products/${service.productId}/services`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  serviceId: parseInt(serviceId),
                  sellPrice: price
                })
              })
              const data = await response.json()
              if (data.success) {
                savedCount++
              } else {
                errorCount++
              }
            } catch {
              errorCount++
            }
          }
        }
      }

      if (savedCount > 0 && errorCount === 0) {
        showNotification('success', 'Exito', `${savedCount} precios guardados`)
      } else if (savedCount > 0 && errorCount > 0) {
        showNotification('warning', 'Parcial', `${savedCount} guardados, ${errorCount} con error`)
      } else if (errorCount > 0) {
        showNotification('error', 'Error', 'Error al guardar precios')
      }

      await fetchProducts()
      await fetchAllServices()
    } catch (error) {
      showNotification('error', 'Error', 'Error al guardar precios')
    } finally {
      setSavingPublicPrices(false)
    }
  }

  // Save commissions
  const handleSaveCommissions = async () => {
    if (!companyId) return

    // Validate commissions don't exceed margin
    const invalidProducts: string[] = []

    for (const product of products) {
      const commission = productCommissions[product.id]
      if (!commission || commission.value === 0) continue

      const servicesCost = getServicesCost(product.id)
      const totalCost = product.miCosto + servicesCost
      const productPublicPrice = publicPrices[product.id] ?? 0
      const totalMargin = productPublicPrice > 0 ? productPublicPrice - totalCost : 0

      const otherRolesUsed = getOtherRolesCommissionForProduct(product.id, productPublicPrice)
      const availableMargin = Math.max(0, totalMargin - otherRolesUsed)

      let effectiveCommission = 0
      if (commission.type === 'percentage') {
        effectiveCommission = productPublicPrice > 0 ? (productPublicPrice * commission.value / 100) : 0
      } else {
        effectiveCommission = commission.value
      }
      if (commission.maxAmount !== null && effectiveCommission > commission.maxAmount) {
        effectiveCommission = commission.maxAmount
      }

      if (effectiveCommission > availableMargin && availableMargin >= 0) {
        invalidProducts.push(product.name)
      }
    }

    if (invalidProducts.length > 0) {
      showNotification('error', 'Comisiones invalidas', `Comisiones exceden el margen en: ${invalidProducts.slice(0, 3).join(', ')}${invalidProducts.length > 3 ? ` y ${invalidProducts.length - 3} mas...` : ''}`)
      return
    }

    setSavingCommissions(true)
    try {
      let savedCount = 0
      let errorCount = 0

      for (const [productId, config] of Object.entries(productCommissions)) {
        if (config.value > 0) {
          try {
            const response = await fetch(`/api/companies/${companyId}/commissions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                productId: parseInt(productId),
                role: selectedRole,
                commissionType: config.type,
                commissionValue: config.value,
                maxAmount: config.maxAmount,
                activityType: 'delivery'
              })
            })
            const data = await response.json()
            if (data.success) {
              savedCount++
            } else {
              errorCount++
            }
          } catch {
            errorCount++
          }
        }
      }

      if (savedCount > 0 && errorCount === 0) {
        showNotification('success', 'Exito', `${savedCount} comisiones para ${selectedRole} guardadas`)
        await fetchCommissions()
        await fetchAllRolesCommissions()
      } else if (savedCount > 0 && errorCount > 0) {
        showNotification('warning', 'Parcial', `${savedCount} guardadas, ${errorCount} con error`)
        await fetchCommissions()
        await fetchAllRolesCommissions()
      } else if (savedCount === 0 && errorCount === 0) {
        showNotification('info', 'Info', 'No hay comisiones con valor para guardar')
      } else {
        showNotification('error', 'Error', 'Error al guardar comisiones')
      }
    } catch (error) {
      showNotification('error', 'Error', 'Error al guardar comisiones')
    } finally {
      setSavingCommissions(false)
    }
  }

  // Initialize commissions when role changes
  useEffect(() => {
    if (activeTab === 'comisiones' && products.length > 0) {
      const initialProductCommissions: Record<number, { type: 'percentage' | 'fixed', value: number, maxAmount: number | null }> = {}
      products.forEach(p => {
        const existing = commissions.find(c => c.productId === p.id && c.role === selectedRole)
        initialProductCommissions[p.id] = existing
          ? { type: existing.commissionType, value: existing.commissionValue, maxAmount: existing.maxAmount }
          : { type: 'percentage', value: 0, maxAmount: null }
      })
      setProductCommissions(initialProductCommissions)
    }
  }, [activeTab, selectedRole, products, commissions])

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.code.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  // Stats
  const totalProducts = products.length
  const productsWithPrices = products.filter(p => publicPrices[p.id] && publicPrices[p.id]! > 0).length
  const categoryCounts = CATEGORIES.map(cat => ({
    ...cat,
    count: products.filter(p => p.category === cat.id).length
  }))

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
        {/* Stats Cards */}
        <div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Total Products */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={cn(
                'relative overflow-hidden',
                isDark
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                'rounded-2xl border shadow-xl'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      isDark
                        ? 'bg-blue-900/30 border border-blue-800/50'
                        : 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200'
                    )}>
                      <Layers className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        isDark ? 'text-gray-400' : 'text-black'
                      )}>Total Productos</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        isDark ? 'text-white' : 'text-slate-900'
                      )}>{totalProducts}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <span className={cn(
                      'text-xs font-medium',
                      isDark ? 'text-gray-500' : 'text-black'
                    )}>En tu catálogo</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Products with Prices */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={cn(
                'relative overflow-hidden',
                isDark
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                'rounded-2xl border shadow-xl'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-600"></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      isDark
                        ? 'bg-emerald-900/30 border border-emerald-800/50'
                        : 'bg-gradient-to-br from-emerald-50 to-green-100 border border-emerald-200'
                    )}>
                      <DollarSign className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        isDark ? 'text-gray-400' : 'text-black'
                      )}>Con Precio Venta</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        isDark ? 'text-white' : 'text-slate-900'
                      )}>{productsWithPrices}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                      <span className={cn(
                        'text-xs font-medium',
                        isDark ? 'text-gray-500' : 'text-black'
                      )}>Del total</span>
                    </div>
                    <span className={cn(
                      'text-xs font-bold',
                      isDark ? 'text-emerald-400' : 'text-emerald-600'
                    )}>
                      {totalProducts > 0 ? Math.round((productsWithPrices / totalProducts) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-emerald-100 dark:bg-emerald-900/30 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-emerald-400 to-green-500 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${totalProducts > 0 ? (productsWithPrices / totalProducts) * 100 : 0}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Categories */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={cn(
                'relative overflow-hidden',
                isDark
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                'rounded-2xl border shadow-xl'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-600"></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      isDark
                        ? 'bg-amber-900/30 border border-amber-800/50'
                        : 'bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200'
                    )}>
                      <Tag className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        isDark ? 'text-gray-400' : 'text-black'
                      )}>Categorías</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        isDark ? 'text-white' : 'text-slate-900'
                      )}>{categoryCounts.filter(c => c.count > 0).length}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                    <span className={cn(
                      'text-xs font-medium',
                      isDark ? 'text-gray-500' : 'text-black'
                    )}>de {CATEGORIES.length} disponibles</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className={`py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`flex p-1 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <button
                  onClick={() => handleTabChange('productos')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    activeTab === 'productos'
                      ? isDark ? 'bg-gray-700 text-white shadow-lg' : 'bg-white text-gray-900 shadow-md'
                      : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  Productos
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    activeTab === 'productos'
                      ? isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                      : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {totalProducts}
                  </span>
                </button>
                <button
                  onClick={() => handleTabChange('precios')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    activeTab === 'precios'
                      ? isDark ? 'bg-gray-700 text-white shadow-lg' : 'bg-white text-gray-900 shadow-md'
                      : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  Precio Venta
                </button>
                <button
                  onClick={() => handleTabChange('comisiones')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    activeTab === 'comisiones'
                      ? isDark ? 'bg-gray-700 text-white shadow-lg' : 'bg-white text-gray-900 shadow-md'
                      : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Percent className="w-4 h-4" />
                  Comisiones
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {/* Tab 1: Productos (Solo Lectura) */}
          {activeTab === 'productos' && (
            <div className="space-y-4">
              {/* Search and Filter */}
              <div className={`flex flex-wrap items-center gap-4 p-4 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
                <div className="relative flex-1 min-w-[200px]">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                  <input
                    type="text"
                    placeholder="Buscar productos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-lg border ${
                      isDark
                        ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className={`px-4 py-2.5 rounded-lg border ${
                    isDark
                      ? 'bg-gray-800 border-gray-700 text-white'
                      : 'bg-white border-gray-200 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                >
                  <option value="all">Todas las categorias</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Products Table */}
              <div className={`rounded-2xl overflow-hidden border ${isDark ? 'bg-gray-800/50 border-gray-800' : 'bg-white border-gray-200'}`}>
                <table className="w-full">
                  <thead>
                    <tr className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
                      <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Producto
                      </th>
                      <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Categoria
                      </th>
                      <th className={`px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                        Mi Costo
                      </th>
                      <th className={`px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        Precio Venta
                      </th>
                      <th className={`px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                        Margen
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                    {filteredProducts.map(product => {
                      const catConfig = getCategoryConfig(product.category)
                      const Icon = catConfig.icon
                      const publicPrice = publicPrices[product.id] ?? 0
                      const margin = publicPrice > 0 ? publicPrice - product.miCosto : 0
                      const marginPct = publicPrice > 0 ? (margin / publicPrice) * 100 : 0

                      return (
                        <tr key={product.id} className={`transition-colors ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${catConfig.gradient}`}>
                                <Icon className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {product.name}
                                </div>
                                <div className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {product.code}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${catConfig.gradient} text-white`}>
                              {catConfig.name}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={`text-lg font-semibold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                              ${product.miCosto.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {publicPrice > 0 ? (
                              <span className={`text-lg font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                ${publicPrice.toFixed(2)}
                              </span>
                            ) : (
                              <span className={`text-sm ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                Sin configurar
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {publicPrice > 0 ? (
                              <div>
                                <span className={`text-lg font-semibold ${margin > 0 ? (isDark ? 'text-amber-400' : 'text-amber-600') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
                                  ${margin.toFixed(2)}
                                </span>
                                <span className={`text-xs ml-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                  ({marginPct.toFixed(0)}%)
                                </span>
                              </div>
                            ) : (
                              <span className={`text-sm ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {filteredProducts.length === 0 && (
                  <div className="text-center py-12">
                    <Package className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                    <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                      No se encontraron productos
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Precio Venta */}
          {activeTab === 'precios' && (
            <div className="space-y-6">
              <div className={`rounded-2xl p-6 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200 shadow-sm'}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
                      <DollarSign className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Configurar Precios de Venta
                      </h3>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Define el precio al que vendes a tus clientes finales
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleSavePublicPrices}
                    disabled={savingPublicPrices}
                    className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/25 disabled:opacity-50 transition-all"
                  >
                    {savingPublicPrices ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar Precios
                  </button>
                </div>
              </div>

              {/* Products Pricing Table */}
              <div className={`rounded-2xl overflow-hidden border ${isDark ? 'bg-gray-800/50 border-gray-800' : 'bg-white border-gray-200'}`}>
                <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
                  <h4 className={`font-semibold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    <Package className="w-5 h-5" />
                    Precios por Producto
                  </h4>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
                      <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Producto
                      </th>
                      <th className={`px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                        Mi Costo
                      </th>
                      <th className={`px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        Precio Venta
                      </th>
                      <th className={`px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                        Margen
                      </th>
                      <th className={`px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Servicios
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                    {products.map(product => {
                      const catConfig = getCategoryConfig(product.category)
                      const Icon = catConfig.icon
                      const publicPrice = publicPrices[product.id] ?? 0
                      const margin = publicPrice > 0 ? publicPrice - product.miCosto : 0
                      const marginPct = publicPrice > 0 ? (margin / publicPrice) * 100 : 0
                      const productServicesList = allServices.filter(s => s.productId === product.id)
                      const isExpanded = expandedPriceProducts.has(product.id)

                      return (
                        <React.Fragment key={product.id}>
                          <tr className={`transition-colors ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${catConfig.gradient}`}>
                                  <Icon className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                  <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {product.name}
                                  </div>
                                  <div className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {product.code}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className={`text-lg font-semibold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                ${product.miCosto.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-center">
                                <div className="relative">
                                  <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`}>$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min={product.miCosto}
                                    value={publicPrices[product.id] ?? ''}
                                    placeholder="0.00"
                                    onChange={(e) => setPublicPrices(prev => ({
                                      ...prev,
                                      [product.id]: e.target.value ? parseFloat(e.target.value) : null
                                    }))}
                                    className={`w-32 pl-8 pr-3 py-2.5 text-center text-lg font-semibold rounded-xl border-2 transition-all ${
                                      (publicPrices[product.id] ?? 0) > 0
                                        ? isDark
                                          ? 'bg-emerald-900/30 border-emerald-600 text-emerald-300 focus:border-emerald-500'
                                          : 'bg-emerald-50 border-emerald-300 text-emerald-700 focus:border-emerald-400'
                                        : isDark
                                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-600 focus:border-emerald-500'
                                          : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-emerald-400'
                                    } focus:outline-none focus:ring-4 focus:ring-emerald-500/10`}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {publicPrice > 0 ? (
                                <div>
                                  <span className={`text-lg font-semibold ${margin > 0 ? (isDark ? 'text-amber-400' : 'text-amber-600') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
                                    ${margin.toFixed(2)}
                                  </span>
                                  <span className={`text-xs ml-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    ({marginPct.toFixed(0)}%)
                                  </span>
                                </div>
                              ) : (
                                <span className={`text-sm ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-center">
                                {productServicesList.length > 0 ? (
                                  <button
                                    onClick={() => setExpandedPriceProducts(prev => {
                                      const next = new Set(prev)
                                      if (next.has(product.id)) {
                                        next.delete(product.id)
                                      } else {
                                        next.add(product.id)
                                      }
                                      return next
                                    })}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                                      isDark
                                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                                    }`}
                                  >
                                    <span className="text-sm font-medium">{productServicesList.length}</span>
                                    <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                  </button>
                                ) : (
                                  <span className={`text-sm ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>—</span>
                                )}
                              </div>
                            </td>
                          </tr>
                          {/* Services rows */}
                          {isExpanded && productServicesList.map(service => {
                            const servicePrice = servicePrices[service.id] ?? service.sellPrice ?? 0
                            const serviceMargin = servicePrice > 0 ? servicePrice - service.costPrice : 0

                            return (
                              <tr key={`service-${service.id}`} className={isDark ? 'bg-gray-800/30' : 'bg-gray-50/50'}>
                                <td className="px-6 py-3 pl-16">
                                  <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    ↳ {service.serviceName}
                                  </div>
                                </td>
                                <td className="px-6 py-3 text-right">
                                  <span className={`text-sm ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                    ${service.costPrice.toFixed(2)}
                                  </span>
                                </td>
                                <td className="px-6 py-3">
                                  <div className="flex justify-center">
                                    <div className="relative">
                                      <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-xs ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`}>$</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min={service.costPrice}
                                        value={servicePrices[service.id] ?? ''}
                                        placeholder="0.00"
                                        onChange={(e) => setServicePrices(prev => ({
                                          ...prev,
                                          [service.id]: e.target.value ? parseFloat(e.target.value) : null
                                        }))}
                                        className={`w-24 pl-6 pr-2 py-1.5 text-center text-sm font-medium rounded-lg border transition-all ${
                                          isDark
                                            ? 'bg-gray-700 border-gray-600 text-white focus:border-emerald-500'
                                            : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-400'
                                        } focus:outline-none`}
                                      />
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-3 text-right">
                                  {servicePrice > 0 ? (
                                    <span className={`text-sm ${serviceMargin > 0 ? (isDark ? 'text-amber-400' : 'text-amber-600') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
                                      ${serviceMargin.toFixed(2)}
                                    </span>
                                  ) : (
                                    <span className={`text-sm ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>—</span>
                                  )}
                                </td>
                                <td></td>
                              </tr>
                            )
                          })}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Comisiones */}
          {activeTab === 'comisiones' && (
            <div className="space-y-6">
              <div className={`rounded-2xl p-6 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200 shadow-sm'}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                      <Percent className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Seleccionar Rol
                      </label>
                      <div className="relative">
                        <select
                          value={selectedRole}
                          onChange={(e) => setSelectedRole(e.target.value)}
                          className={`w-full md:w-64 appearance-none px-4 py-3 pr-10 rounded-xl text-sm font-medium cursor-pointer ${
                            isDark
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-gray-50 border-gray-200 text-gray-900'
                          } border focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                        >
                          {ROLES.map(role => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                        <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleSaveCommissions}
                    disabled={savingCommissions}
                    className="px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-50 transition-all"
                  >
                    {savingCommissions ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar Comisiones
                  </button>
                </div>
              </div>

              {/* Product Commissions Table */}
              <div className={`rounded-2xl overflow-hidden border ${isDark ? 'bg-gray-800/50 border-gray-800' : 'bg-white border-gray-200'}`}>
                <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
                  <h4 className={`font-semibold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    <Package className="w-5 h-5" />
                    Comisiones por Producto
                  </h4>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
                      <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Producto
                      </th>
                      <th className={`px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        Margen Disp.
                      </th>
                      <th className={`px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Tipo
                      </th>
                      <th className={`px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                        Valor
                      </th>
                      <th className={`px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Max. Monto
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                    {products.map(product => {
                      const catConfig = getCategoryConfig(product.category)
                      const Icon = catConfig.icon
                      const commission = productCommissions[product.id] || { type: 'percentage' as const, value: 0, maxAmount: null }

                      const servicesCost = getServicesCost(product.id)
                      const totalCost = product.miCosto + servicesCost
                      const publicPrice = publicPrices[product.id] ?? 0
                      const totalMargin = publicPrice > 0 ? publicPrice - totalCost : 0
                      const otherRolesUsed = getOtherRolesCommissionForProduct(product.id, publicPrice)
                      const availableMargin = Math.max(0, totalMargin - otherRolesUsed)

                      let effectiveCommission = 0
                      if (commission.type === 'percentage') {
                        effectiveCommission = publicPrice > 0 ? (publicPrice * commission.value / 100) : 0
                      } else {
                        effectiveCommission = commission.value
                      }
                      if (commission.maxAmount !== null && effectiveCommission > commission.maxAmount) {
                        effectiveCommission = commission.maxAmount
                      }

                      const exceedsMargin = effectiveCommission > availableMargin && availableMargin >= 0

                      return (
                        <tr key={product.id} className={`transition-colors ${exceedsMargin ? (isDark ? 'bg-red-900/20' : 'bg-red-50') : ''} ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${catConfig.gradient}`}>
                                <Icon className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {product.name}
                                </div>
                                <div className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {product.code}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {publicPrice > 0 ? (
                              <div>
                                <span className={`text-lg font-semibold ${availableMargin > 0 ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-amber-400' : 'text-amber-600')}`}>
                                  ${availableMargin.toFixed(2)}
                                </span>
                                {otherRolesUsed > 0 && (
                                  <div className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    Otros roles: ${otherRolesUsed.toFixed(2)}
                                  </div>
                                )}
                                {exceedsMargin && (
                                  <div className={`text-xs mt-1 ${isDark ? 'text-red-400' : 'text-red-500'}`}>
                                    Comision: ${effectiveCommission.toFixed(2)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className={`text-sm ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                Sin precio
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center">
                              <select
                                value={commission.type}
                                onChange={(e) => setProductCommissions(prev => ({
                                  ...prev,
                                  [product.id]: { ...commission, type: e.target.value as 'percentage' | 'fixed' }
                                }))}
                                className={`appearance-none px-3 py-2 rounded-lg text-sm cursor-pointer ${
                                  isDark
                                    ? 'bg-gray-700 border-gray-600 text-white'
                                    : 'bg-gray-50 border-gray-200 text-gray-900'
                                } border focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                              >
                                <option value="percentage">Porcentaje %</option>
                                <option value="fixed">Monto Fijo $</option>
                              </select>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center">
                              <div className="relative">
                                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${exceedsMargin ? (isDark ? 'text-red-400' : 'text-red-500') : (isDark ? 'text-blue-400' : 'text-blue-500')}`}>
                                  {commission.type === 'percentage' ? '%' : '$'}
                                </span>
                                <input
                                  type="number"
                                  step={commission.type === 'percentage' ? '1' : '0.01'}
                                  min="0"
                                  max={commission.type === 'percentage' ? '100' : undefined}
                                  value={commission.value || ''}
                                  placeholder="0"
                                  onChange={(e) => setProductCommissions(prev => ({
                                    ...prev,
                                    [product.id]: { ...commission, value: parseFloat(e.target.value) || 0 }
                                  }))}
                                  className={`w-28 pl-8 pr-3 py-2.5 text-center text-lg font-semibold rounded-xl border-2 transition-all ${
                                    exceedsMargin
                                      ? isDark
                                        ? 'bg-red-900/30 border-red-600 text-red-300 focus:border-red-500'
                                        : 'bg-red-50 border-red-300 text-red-700 focus:border-red-400'
                                      : commission.value > 0
                                        ? isDark
                                          ? 'bg-blue-900/30 border-blue-600 text-blue-300 focus:border-blue-500'
                                          : 'bg-blue-50 border-blue-300 text-blue-700 focus:border-blue-400'
                                        : isDark
                                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-600 focus:border-blue-500'
                                          : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400'
                                  } focus:outline-none focus:ring-4 focus:ring-blue-500/10`}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center">
                              <div className="relative">
                                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={availableMargin > 0 ? availableMargin : undefined}
                                  value={commission.maxAmount ?? ''}
                                  placeholder="—"
                                  onChange={(e) => setProductCommissions(prev => ({
                                    ...prev,
                                    [product.id]: { ...commission, maxAmount: e.target.value ? parseFloat(e.target.value) : null }
                                  }))}
                                  className={`w-28 pl-8 pr-3 py-2 text-center rounded-xl border transition-all ${
                                    isDark
                                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-600 focus:border-blue-500'
                                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400'
                                  } focus:outline-none focus:ring-2 focus:ring-blue-500/10`}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Empty state if no products */}
              {products.length === 0 && (
                <div className={`rounded-2xl p-8 ${isDark ? 'bg-gray-800/50 border border-gray-800' : 'bg-white border border-gray-200'}`}>
                  <div className="text-center py-12">
                    <div className={`w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center ${
                      isDark ? 'bg-gradient-to-br from-blue-900/50 to-blue-800/30' : 'bg-gradient-to-br from-blue-100 to-blue-50'
                    }`}>
                      <Percent className={`w-10 h-10 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                    </div>
                    <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Sin productos disponibles
                    </h3>
                    <p className={`max-w-md mx-auto ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      No hay productos en tu catalogo para configurar comisiones.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        </motion.div>
      </div>
    </DashboardLayout>
  )
}
