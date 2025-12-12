'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  Building2,
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
  Copy,
  Grid3X3,
  List,
  Users,
  Percent,
  Store
} from 'lucide-react'

// Interfaces
interface Product {
  id: number
  code: string
  name: string
  description: string | null
  category: string
  miCosto: number // Lo que la empresa paga a LogiRapid
  serviciosCount: number
  isActive: boolean
}

interface ProductService {
  id: number
  productId: number
  serviceName: string
  description: string | null
  costPrice: number
  sellPrice: number
  margin: number
  marginPercentage: number
  isRequired: boolean
  isDefaultSelected: boolean
  isActive: boolean
}

interface Branch {
  id: number
  legalName: string
  status: string
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

export default function CatalogoEmpresaPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const { user } = useAuth()
  const isDark = theme === 'dark'
  const companyId = user?.companyId

  // States
  const [products, setProducts] = useState<Product[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'productos' | 'sucursales' | 'precios' | 'comisiones'>('productos')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')

  // Modals
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [selectedProductForService, setSelectedProductForService] = useState<Product | null>(null)
  const [productServices, setProductServices] = useState<ProductService[]>([])
  const [editingService, setEditingService] = useState<ProductService | null>(null)

  // Expanded products (to show services dropdown)
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set())
  const [loadingServices, setLoadingServices] = useState<Record<number, boolean>>({})
  const [productServicesMap, setProductServicesMap] = useState<Record<number, ProductService[]>>({})

  // Tab 2: Precios Sucursales
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null)
  const [branchPrices, setBranchPrices] = useState<Record<number, number | null>>({})
  const [savingBranchPrices, setSavingBranchPrices] = useState(false)

  // Tab 3: Precio Venta Publico
  const [publicPrices, setPublicPrices] = useState<Record<number, number | null>>({})
  const [servicePrices, setServicePrices] = useState<Record<number, number | null>>({})
  const [allServices, setAllServices] = useState<ProductService[]>([])
  const [savingPublicPrices, setSavingPublicPrices] = useState(false)

  // Tab 4: Comisiones
  const [selectedRole, setSelectedRole] = useState<string>('USER')
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [savingCommissions, setSavingCommissions] = useState(false)
  // Comisiones editables: { [productId]: { type, value, maxAmount } }
  const [productCommissions, setProductCommissions] = useState<Record<number, { type: 'percentage' | 'fixed', value: number, maxAmount: number | null }>>({})
  const [serviceCommissions, setServiceCommissions] = useState<Record<number, { type: 'percentage' | 'fixed', value: number, maxAmount: number | null }>>({})

  // Fetch products for this company
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
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      showNotification('error', 'Error', 'Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }, [companyId, showNotification])

  // Fetch branches for this company
  const fetchBranches = useCallback(async () => {
    if (!companyId) return
    try {
      const response = await fetch(`/api/companies?parentId=${companyId}`)
      const data = await response.json()
      if (data.success && data.data) {
        const branchList = data.data.map((c: any) => ({
          id: c.id,
          legalName: c.legalName || c.legalname,
          status: c.status
        }))
        setBranches(branchList)
      }
    } catch (error) {
      console.error('Error fetching branches:', error)
    }
  }, [companyId])

  // Fetch services for a product
  const fetchProductServices = useCallback(async (productId: number) => {
    if (!companyId) return
    try {
      const response = await fetch(`/api/companies/${companyId}/products/${productId}/services`)
      const data = await response.json()
      if (data.success) {
        setProductServices(data.data.services || [])
      }
    } catch (error) {
      console.error('Error fetching services:', error)
    }
  }, [companyId])

  // Fetch all services for the company
  const fetchAllServices = useCallback(async () => {
    if (!companyId) return
    try {
      const response = await fetch(`/api/companies/${companyId}/products/services`)
      const data = await response.json()
      if (data.success) {
        setAllServices(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching all services:', error)
    }
  }, [companyId])

  // Fetch commissions
  const fetchCommissions = useCallback(async () => {
    if (!companyId) return
    try {
      const response = await fetch(`/api/companies/${companyId}/commissions?role=${selectedRole}`)
      const data = await response.json()
      if (data.success && data.data) {
        // API returns { commissions: [...], commissionsByProduct: [...], ... }
        setCommissions(data.data.commissions || [])
      }
    } catch (error) {
      console.error('Error fetching commissions:', error)
    }
  }, [companyId, selectedRole])

  useEffect(() => {
    fetchProducts()
    fetchBranches()
  }, [fetchProducts, fetchBranches])

  useEffect(() => {
    if (activeTab === 'precios') {
      fetchAllServices()
    }
  }, [activeTab, fetchAllServices])

  useEffect(() => {
    if (activeTab === 'comisiones') {
      fetchCommissions()
    }
  }, [activeTab, fetchCommissions])

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.code.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  // Copy code to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showNotification('success', 'Copiado', 'Codigo copiado al portapapeles')
  }

  // Toggle product expansion to show services
  const toggleProductExpanded = async (productId: number) => {
    const newExpanded = new Set(expandedProducts)

    if (newExpanded.has(productId)) {
      newExpanded.delete(productId)
    } else {
      newExpanded.add(productId)
      // Load services if not already loaded
      if (!productServicesMap[productId]) {
        setLoadingServices(prev => ({ ...prev, [productId]: true }))
        try {
          const response = await fetch(`/api/companies/${companyId}/products/${productId}/services`)
          const data = await response.json()
          if (data.success && data.data?.services) {
            setProductServicesMap(prev => ({ ...prev, [productId]: data.data.services }))
          }
        } catch (error) {
          console.error('Error fetching services:', error)
        } finally {
          setLoadingServices(prev => ({ ...prev, [productId]: false }))
        }
      }
    }
    setExpandedProducts(newExpanded)
  }

  // Open service modal for a product
  const handleOpenServiceModal = async (product: Product) => {
    setSelectedProductForService(product)
    await fetchProductServices(product.id)
    setShowServiceModal(true)
  }

  // Save service
  const handleSaveService = async (serviceData: any) => {
    if (!companyId || !selectedProductForService) return

    try {
      const isEdit = !!editingService
      const url = `/api/companies/${companyId}/products/${selectedProductForService.id}/services`
      const method = isEdit ? 'PUT' : 'POST'

      // Map form fields to API fields
      const apiData = {
        serviceName: serviceData.serviceName,
        serviceDescription: serviceData.description || null,
        costPrice: serviceData.costPrice,
        sellPrice: serviceData.sellPrice,
        isRequired: serviceData.isRequired,
        isDefaultSelected: serviceData.isDefaultSelected,
        ...(isEdit && { serviceId: editingService.id })
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData)
      })

      const data = await response.json()

      if (data.success) {
        showNotification('success', 'Exito', isEdit ? 'Servicio actualizado' : 'Servicio creado')
        await fetchProductServices(selectedProductForService.id)
        setEditingService(null)
        fetchProducts() // Refresh to update service count
      } else {
        showNotification('error', 'Error', data.error || 'Error al guardar servicio')
      }
    } catch (error) {
      showNotification('error', 'Error', 'Error de conexion')
    }
  }

  // Delete service
  const handleDeleteService = async (serviceId: number) => {
    if (!companyId || !selectedProductForService) return
    if (!confirm('¿Seguro que deseas eliminar este servicio?')) return

    try {
      const response = await fetch(
        `/api/companies/${companyId}/products/${selectedProductForService.id}/services`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serviceId })
        }
      )
      const data = await response.json()

      if (data.success) {
        showNotification('success', 'Exito', 'Servicio eliminado')
        await fetchProductServices(selectedProductForService.id)
        fetchProducts()
      } else {
        showNotification('error', 'Error', data.error || 'Error al eliminar')
      }
    } catch (error) {
      showNotification('error', 'Error', 'Error de conexion')
    }
  }

  // Save branch prices
  const handleSaveBranchPrices = async () => {
    if (!companyId || !selectedBranch) return

    setSavingBranchPrices(true)
    try {
      // Validar que ningún precio sea menor al costo
      const invalidPrices: string[] = []
      Object.entries(branchPrices).forEach(([productId, price]) => {
        if (price !== null) {
          const product = products.find(p => p.id === parseInt(productId))
          if (product && price < product.miCosto) {
            invalidPrices.push(product.name)
          }
        }
      })

      if (invalidPrices.length > 0) {
        showNotification('error', 'Error', `Precio menor al costo en: ${invalidPrices.slice(0, 3).join(', ')}${invalidPrices.length > 3 ? '...' : ''}`)
        setSavingBranchPrices(false)
        return
      }

      const productsToUpdate = Object.entries(branchPrices)
        .filter(([_, price]) => price !== null)
        .map(([productId, price]) => ({
          branchId: selectedBranch,
          productId: parseInt(productId),
          precioSucursal: price
        }))

      if (productsToUpdate.length === 0) {
        showNotification('warning', 'Aviso', 'No hay precios para guardar')
        setSavingBranchPrices(false)
        return
      }

      const response = await fetch(`/api/companies/${companyId}/branches/pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchPricing: productsToUpdate })
      })

      const data = await response.json()

      if (data.success) {
        showNotification('success', 'Exito', 'Precios de sucursal guardados')
      } else {
        showNotification('error', 'Error', data.error || 'Error al guardar precios')
      }
    } catch (error) {
      showNotification('error', 'Error', 'Error de conexion')
    } finally {
      setSavingBranchPrices(false)
    }
  }

  // Save public prices
  const handleSavePublicPrices = async () => {
    if (!companyId) return

    setSavingPublicPrices(true)
    try {
      // Save product prices
      const productsToUpdate = Object.entries(publicPrices)
        .filter(([_, price]) => price !== null)
        .map(([productId, price]) => ({
          productId: parseInt(productId),
          precioClientes: price
        }))

      if (productsToUpdate.length > 0) {
        await fetch(`/api/companies/${companyId}/products/pricing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products: productsToUpdate })
        })
      }

      // Save service prices
      for (const [serviceId, price] of Object.entries(servicePrices)) {
        if (price !== null) {
          await fetch(`/api/companies/${companyId}/products/services/${serviceId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sellPrice: price })
          })
        }
      }

      showNotification('success', 'Exito', 'Precios de venta guardados')
    } catch (error) {
      showNotification('error', 'Error', 'Error al guardar precios')
    } finally {
      setSavingPublicPrices(false)
    }
  }

  // Save commissions
  const handleSaveCommissions = async () => {
    if (!companyId) return

    setSavingCommissions(true)
    try {
      let savedCount = 0
      let errorCount = 0

      // Save product commissions one by one (API expects individual requests)
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
              console.error('Error saving commission:', data.error)
              errorCount++
            }
          } catch (e) {
            errorCount++
          }
        }
      }

      if (savedCount > 0 && errorCount === 0) {
        showNotification('success', 'Exito', `${savedCount} comisiones para ${selectedRole} guardadas`)
      } else if (savedCount > 0 && errorCount > 0) {
        showNotification('warning', 'Parcial', `${savedCount} guardadas, ${errorCount} con error`)
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
      // Initialize product commissions with default values
      const initialProductCommissions: Record<number, { type: 'percentage' | 'fixed', value: number, maxAmount: number | null }> = {}
      products.forEach(p => {
        const existing = commissions.find(c => c.productId === p.id && c.role === selectedRole)
        initialProductCommissions[p.id] = existing
          ? { type: existing.commissionType, value: existing.commissionValue, maxAmount: existing.maxAmount }
          : { type: 'percentage', value: 0, maxAmount: null }
      })
      setProductCommissions(initialProductCommissions)

      // Initialize service commissions
      const initialServiceCommissions: Record<number, { type: 'percentage' | 'fixed', value: number, maxAmount: number | null }> = {}
      allServices.forEach(s => {
        const existing = commissions.find(c => c.serviceId === s.id && c.role === selectedRole)
        initialServiceCommissions[s.id] = existing
          ? { type: existing.commissionType, value: existing.commissionValue, maxAmount: existing.maxAmount }
          : { type: 'percentage', value: 0, maxAmount: null }
      })
      setServiceCommissions(initialServiceCommissions)
    }
  }, [activeTab, selectedRole, products, allServices, commissions])

  // Stats calculation
  const totalProducts = products.length
  const productsWithServices = products.filter(p => p.serviciosCount > 0).length
  const categoryCounts = CATEGORIES.map(cat => ({
    ...cat,
    count: products.filter(p => p.category === cat.id).length
  }))

  return (
    <DashboardLayout>
      <div className="min-h-full">
        {/* Stats Cards */}
        <div className="pt-2 pb-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Products */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`relative overflow-hidden rounded-2xl p-5 ${
                isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Total Productos
                  </p>
                  <p className={`text-3xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {totalProducts}
                  </p>
                  <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    En tu catalogo
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${isDark ? 'bg-blue-500/20' : 'bg-blue-50'}`}>
                  <Layers className="w-6 h-6 text-blue-500" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-400" />
            </motion.div>

            {/* Products with Services */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`relative overflow-hidden rounded-2xl p-5 ${
                isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Con Servicios
                  </p>
                  <p className={`text-3xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {productsWithServices}
                  </p>
                  <p className={`text-xs mt-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    <CheckCircle className="w-3 h-3 inline mr-1" />
                    {totalProducts > 0 ? Math.round((productsWithServices / totalProducts) * 100) : 0}% del total
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-50'}`}>
                  <CheckCircle className="w-6 h-6 text-emerald-500" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" />
            </motion.div>

            {/* Branches */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`relative overflow-hidden rounded-2xl p-5 ${
                isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Sucursales
                  </p>
                  <p className={`text-3xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {branches.length}
                  </p>
                  <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Configuradas
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${isDark ? 'bg-purple-500/20' : 'bg-purple-50'}`}>
                  <Store className="w-6 h-6 text-purple-500" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-purple-400" />
            </motion.div>

            {/* Categories */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`relative overflow-hidden rounded-2xl p-5 ${
                isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Categorias
                  </p>
                  <p className={`text-3xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {categoryCounts.filter(c => c.count > 0).length}
                  </p>
                  <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    de {CATEGORIES.length} disponibles
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${isDark ? 'bg-amber-500/20' : 'bg-amber-50'}`}>
                  <Tag className="w-6 h-6 text-amber-500" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-amber-400" />
            </motion.div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className={`py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`flex p-1 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <button
                  onClick={() => setActiveTab('productos')}
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
                  onClick={() => setActiveTab('sucursales')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    activeTab === 'sucursales'
                      ? isDark ? 'bg-gray-700 text-white shadow-lg' : 'bg-white text-gray-900 shadow-md'
                      : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Store className="w-4 h-4" />
                  Precios Sucursales
                </button>
                <button
                  onClick={() => setActiveTab('precios')}
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
                  onClick={() => setActiveTab('comisiones')}
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

            {/* Right side controls */}
            {activeTab === 'productos' && (
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                  <input
                    type="text"
                    placeholder="Buscar productos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-64 pl-10 pr-4 py-2 rounded-xl text-sm transition-all ${
                      isDark
                        ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500'
                        : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400'
                    } border focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                  />
                </div>
                <div className="relative">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className={`appearance-none pl-4 pr-10 py-2 rounded-xl text-sm cursor-pointer ${
                      isDark
                        ? 'bg-gray-800 border-gray-700 text-white'
                        : 'bg-gray-50 border-gray-200 text-gray-900'
                    } border focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                  >
                    <option value="all">Todas las categorias</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                </div>
                <div className={`flex p-1 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-md transition-colors ${
                      viewMode === 'list'
                        ? isDark ? 'bg-gray-700 text-white' : 'bg-white text-gray-900 shadow-sm'
                        : isDark ? 'text-gray-500' : 'text-gray-400'
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-md transition-colors ${
                      viewMode === 'grid'
                        ? isDark ? 'bg-gray-700 text-white' : 'bg-white text-gray-900 shadow-sm'
                        : isDark ? 'text-gray-500' : 'text-gray-400'
                    }`}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="pt-6">
          {/* Tab 1: Productos */}
          {activeTab === 'productos' && (
            <>
              <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-4">
                <button
                  onClick={() => setCategoryFilter('all')}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    categoryFilter === 'all'
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                      : isDark
                        ? 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                        : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  Todos ({totalProducts})
                </button>
                {CATEGORIES.map(cat => {
                  const count = categoryCounts.find(c => c.id === cat.id)?.count || 0
                  const Icon = cat.icon
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setCategoryFilter(cat.id)}
                      className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                        categoryFilter === cat.id
                          ? `bg-gradient-to-r ${cat.gradient} text-white shadow-lg`
                          : isDark
                            ? 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                            : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {cat.name} ({count})
                    </button>
                  )
                })}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                      <RefreshCw className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                    </div>
                    <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>Cargando productos...</p>
                  </div>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center max-w-md">
                    <div className={`w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center ${
                      isDark ? 'bg-gradient-to-br from-gray-800 to-gray-700' : 'bg-gradient-to-br from-gray-100 to-gray-50'
                    }`}>
                      <Package className={`w-10 h-10 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                    </div>
                    <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Sin productos
                    </h3>
                    <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      LogiRapid aun no te ha asignado productos. Contacta al administrador.
                    </p>
                  </div>
                </div>
              ) : (
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
                        <th className={`px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Mi Costo
                        </th>
                        <th className={`px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Servicios
                        </th>
                        <th className={`px-6 py-4 w-32`}></th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                      {filteredProducts.map((product, idx) => {
                        const catConfig = getCategoryConfig(product.category)
                        const Icon = catConfig.icon
                        const isExpanded = expandedProducts.has(product.id)
                        const services = productServicesMap[product.id] || []
                        const isLoadingServices = loadingServices[product.id]

                        return (
                          <React.Fragment key={product.id}>
                            <motion.tr
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.02 }}
                              className={`group transition-colors ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}
                            >
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-4">
                                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${catConfig.gradient}`}>
                                    <Icon className="w-6 h-6 text-white" />
                                  </div>
                                  <div>
                                    <div className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                      {product.name}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className={`text-sm font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {product.code}
                                      </span>
                                      <button
                                        onClick={() => copyToClipboard(product.code)}
                                        className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all ${
                                          isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                                        }`}
                                      >
                                        <Copy className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gradient-to-r ${catConfig.gradient} text-white`}>
                                  <Icon className="w-3.5 h-3.5" />
                                  {catConfig.name}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <span className={`text-lg font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                  ${product.miCosto.toFixed(2)}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                {product.serviciosCount > 0 ? (
                                  <button
                                    onClick={() => toggleProductExpanded(product.id)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                                      isDark ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                    }`}
                                  >
                                    <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    {product.serviciosCount} servicios
                                  </button>
                                ) : (
                                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                                    isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                                  }`}>
                                    0 servicios
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <button
                                  onClick={() => handleOpenServiceModal(product)}
                                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                                    isDark
                                      ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                  }`}
                                >
                                  <Plus className="w-4 h-4" />
                                  Servicios
                                </button>
                              </td>
                            </motion.tr>
                            {/* Expanded services row */}
                            {isExpanded && (
                              <tr className={isDark ? 'bg-gray-800/30' : 'bg-gray-50/50'}>
                                <td colSpan={5} className="px-6 py-4">
                                  {isLoadingServices ? (
                                    <div className="flex items-center justify-center py-4">
                                      <RefreshCw className={`w-5 h-5 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                                      <span className={`ml-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Cargando servicios...</span>
                                    </div>
                                  ) : services.length > 0 ? (
                                    <div className="ml-16 space-y-2">
                                      <div className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        Servicios asociados
                                      </div>
                                      <div className="grid gap-2">
                                        {services.map((service: ProductService) => (
                                          <div
                                            key={service.id}
                                            className={`flex items-center justify-between p-3 rounded-xl ${
                                              isDark ? 'bg-gray-700/50 border border-gray-700' : 'bg-white border border-gray-200'
                                            }`}
                                          >
                                            <div className="flex items-center gap-3">
                                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                isDark ? 'bg-blue-500/20' : 'bg-blue-100'
                                              }`}>
                                                <Tag className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                                              </div>
                                              <div>
                                                <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                  {service.serviceName}
                                                </div>
                                                {service.description && (
                                                  <div className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                    {service.description}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                              <div className="text-right">
                                                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                  Costo: <span className="font-medium">${service.costPrice.toFixed(2)}</span>
                                                </div>
                                                <div className={`text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                                  Venta: <span className="font-semibold">${service.sellPrice.toFixed(2)}</span>
                                                </div>
                                              </div>
                                              {service.isRequired && (
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                  isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600'
                                                }`}>
                                                  Requerido
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className={`ml-16 py-4 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                      No hay servicios cargados
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Tab 2: Precios Sucursales */}
          {activeTab === 'sucursales' && (
            <div className="space-y-6">
              <div className={`rounded-2xl p-6 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200 shadow-sm'}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                      <Store className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Seleccionar Sucursal
                      </label>
                      <div className="relative">
                        <select
                          value={selectedBranch || ''}
                          onChange={(e) => {
                            setSelectedBranch(e.target.value ? parseInt(e.target.value) : null)
                            setBranchPrices({})
                          }}
                          className={`w-full md:w-96 appearance-none px-4 py-3 pr-10 rounded-xl text-sm font-medium cursor-pointer ${
                            isDark
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-gray-50 border-gray-200 text-gray-900'
                          } border focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                        >
                          <option value="">Selecciona una sucursal...</option>
                          {branches.map(branch => (
                            <option key={branch.id} value={branch.id}>
                              {branch.legalName}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                      </div>
                    </div>
                  </div>
                  {selectedBranch && (
                    <button
                      onClick={handleSaveBranchPrices}
                      disabled={savingBranchPrices}
                      className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/25 disabled:opacity-50 transition-all"
                    >
                      {savingBranchPrices ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Guardar Precios
                    </button>
                  )}
                </div>
              </div>

              {selectedBranch ? (
                <div className={`rounded-2xl overflow-hidden border ${isDark ? 'bg-gray-800/50 border-gray-800' : 'bg-white border-gray-200'}`}>
                  <div className={`px-6 py-3 border-b ${isDark ? 'bg-blue-500/10 border-gray-800' : 'bg-blue-50 border-gray-200'}`}>
                    <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                      <strong>Precio Global:</strong> Precio base para todas las sucursales. <strong>Precio Especial:</strong> Sobrescribe el precio global solo para esta sucursal.
                    </p>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
                        <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Producto
                        </th>
                        <th className={`px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Mi Costo
                        </th>
                        <th className={`px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                          Precio Sucursal
                        </th>
                        <th className={`px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Margen
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                      {products.map(product => {
                        const catConfig = getCategoryConfig(product.category)
                        const Icon = catConfig.icon
                        const branchPrice = branchPrices[product.id]
                        const margin = branchPrice !== null && branchPrice !== undefined
                          ? branchPrice - product.miCosto
                          : null
                        const marginPct = margin !== null && product.miCosto > 0
                          ? (margin / product.miCosto * 100)
                          : null

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
                            <td className="px-6 py-4 text-right">
                              <span className={`text-lg font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                ${product.miCosto.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col items-center gap-1">
                                <div className="relative">
                                  <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${
                                    branchPrice !== null && branchPrice < product.miCosto
                                      ? 'text-red-500'
                                      : isDark ? 'text-blue-400' : 'text-blue-500'
                                  }`}>$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min={product.miCosto}
                                    value={branchPrice ?? ''}
                                    placeholder="—"
                                    onChange={(e) => {
                                      const value = e.target.value ? parseFloat(e.target.value) : null
                                      setBranchPrices(prev => ({
                                        ...prev,
                                        [product.id]: value
                                      }))
                                    }}
                                    className={`w-36 pl-8 pr-4 py-2.5 text-center text-lg font-semibold rounded-xl border-2 transition-all ${
                                      branchPrice !== null && branchPrice < product.miCosto
                                        ? isDark
                                          ? 'bg-red-900/30 border-red-500 text-red-300 focus:border-red-400'
                                          : 'bg-red-50 border-red-400 text-red-700 focus:border-red-500'
                                        : branchPrice !== null
                                          ? isDark
                                            ? 'bg-blue-900/30 border-blue-600 text-blue-300 focus:border-blue-500'
                                            : 'bg-blue-50 border-blue-300 text-blue-700 focus:border-blue-400'
                                          : isDark
                                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-600 focus:border-blue-500'
                                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400'
                                    } focus:outline-none focus:ring-4 ${branchPrice !== null && branchPrice < product.miCosto ? 'focus:ring-red-500/10' : 'focus:ring-blue-500/10'}`}
                                  />
                                </div>
                                {branchPrice !== null && branchPrice < product.miCosto && (
                                  <span className="text-xs text-red-500 font-medium">
                                    Min: ${product.miCosto.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {margin !== null ? (
                                <div className="flex flex-col items-end">
                                  <span className={`text-lg font-bold ${margin >= 0 ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
                                    ${margin.toFixed(2)}
                                  </span>
                                  {marginPct !== null && (
                                    <span className={`text-sm font-medium ${margin >= 0 ? (isDark ? 'text-emerald-400/70' : 'text-emerald-600/70') : (isDark ? 'text-red-400/70' : 'text-red-600/70')}`}>
                                      {marginPct.toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className={isDark ? 'text-gray-600' : 'text-gray-300'}>—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center max-w-sm">
                    <div className={`w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center ${
                      isDark ? 'bg-gradient-to-br from-gray-800 to-gray-700' : 'bg-gradient-to-br from-blue-100 to-blue-50'
                    }`}>
                      <Store className={`w-10 h-10 ${isDark ? 'text-gray-600' : 'text-blue-400'}`} />
                    </div>
                    <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Selecciona una sucursal
                    </h3>
                    <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                      Elige una sucursal del selector para configurar los precios de venta
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Precio Venta Publico */}
          {activeTab === 'precios' && (
            <div className="space-y-6">
              <div className={`rounded-2xl p-6 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200 shadow-sm'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
                      <DollarSign className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Precios de Venta al Publico
                      </h3>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Configura los precios que cobraras a tus clientes
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

              {/* Products Prices */}
              <div className={`rounded-2xl overflow-hidden border ${isDark ? 'bg-gray-800/50 border-gray-800' : 'bg-white border-gray-200'}`}>
                <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
                  <h4 className={`font-semibold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    <Package className="w-5 h-5" />
                    Productos
                  </h4>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
                      <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Producto
                      </th>
                      <th className={`px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Mi Costo
                      </th>
                      <th className={`px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        Precio Publico
                      </th>
                      <th className={`px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Margen
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                    {products.map(product => {
                      const catConfig = getCategoryConfig(product.category)
                      const Icon = catConfig.icon
                      const publicPrice = publicPrices[product.id]
                      const margin = publicPrice !== null && publicPrice !== undefined
                        ? publicPrice - product.miCosto
                        : null
                      const marginPct = margin !== null && product.miCosto > 0
                        ? (margin / product.miCosto * 100)
                        : null

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
                          <td className="px-6 py-4 text-right">
                            <span className={`text-lg font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              ${product.miCosto.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center">
                              <div className="relative">
                                <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`}>$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min={product.miCosto}
                                  value={publicPrice ?? ''}
                                  placeholder="—"
                                  onChange={(e) => {
                                    const value = e.target.value ? parseFloat(e.target.value) : null
                                    setPublicPrices(prev => ({
                                      ...prev,
                                      [product.id]: value
                                    }))
                                  }}
                                  className={`w-36 pl-8 pr-4 py-2.5 text-center text-lg font-semibold rounded-xl border-2 transition-all ${
                                    publicPrice !== null
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
                            {margin !== null ? (
                              <div className="flex flex-col items-end">
                                <span className={`text-lg font-bold ${margin >= 0 ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
                                  ${margin.toFixed(2)}
                                </span>
                                {marginPct !== null && (
                                  <span className={`text-sm font-medium ${margin >= 0 ? (isDark ? 'text-emerald-400/70' : 'text-emerald-600/70') : (isDark ? 'text-red-400/70' : 'text-red-600/70')}`}>
                                    {marginPct.toFixed(1)}%
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className={isDark ? 'text-gray-600' : 'text-gray-300'}>—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Services Prices */}
              {allServices.length > 0 && (
                <div className={`rounded-2xl overflow-hidden border ${isDark ? 'bg-gray-800/50 border-gray-800' : 'bg-white border-gray-200'}`}>
                  <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
                    <h4 className={`font-semibold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      <Tag className="w-5 h-5" />
                      Servicios
                    </h4>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
                        <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Servicio
                        </th>
                        <th className={`px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Mi Costo
                        </th>
                        <th className={`px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                          Precio Venta
                        </th>
                        <th className={`px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Margen
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                      {allServices.map(service => {
                        const sellPrice = servicePrices[service.id] ?? service.sellPrice
                        const margin = sellPrice - service.costPrice
                        const marginPct = service.costPrice > 0 ? (margin / service.costPrice * 100) : 0

                        return (
                          <tr key={service.id} className={`transition-colors ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}>
                            <td className="px-6 py-4">
                              <div>
                                <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {service.serviceName}
                                </div>
                                {service.description && (
                                  <div className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {service.description}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className={`text-lg font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                ${service.costPrice.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-center">
                                <div className="relative">
                                  <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`}>$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min={service.costPrice}
                                    value={servicePrices[service.id] ?? service.sellPrice}
                                    onChange={(e) => {
                                      const value = e.target.value ? parseFloat(e.target.value) : null
                                      setServicePrices(prev => ({
                                        ...prev,
                                        [service.id]: value
                                      }))
                                    }}
                                    className={`w-36 pl-8 pr-4 py-2.5 text-center text-lg font-semibold rounded-xl border-2 transition-all ${
                                      isDark
                                        ? 'bg-emerald-900/30 border-emerald-600 text-emerald-300 focus:border-emerald-500'
                                        : 'bg-emerald-50 border-emerald-300 text-emerald-700 focus:border-emerald-400'
                                    } focus:outline-none focus:ring-4 focus:ring-emerald-500/10`}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex flex-col items-end">
                                <span className={`text-lg font-bold ${margin >= 0 ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
                                  ${margin.toFixed(2)}
                                </span>
                                <span className={`text-sm font-medium ${margin >= 0 ? (isDark ? 'text-emerald-400/70' : 'text-emerald-600/70') : (isDark ? 'text-red-400/70' : 'text-red-600/70')}`}>
                                  {marginPct.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Comisiones */}
          {activeTab === 'comisiones' && (
            <div className="space-y-6">
              <div className={`rounded-2xl p-6 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200 shadow-sm'}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                      <Percent className="w-6 h-6 text-purple-500" />
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
                          } border focus:outline-none focus:ring-2 focus:ring-purple-500/20`}
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
                    className="px-5 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium rounded-xl flex items-center gap-2 shadow-lg shadow-purple-500/25 disabled:opacity-50 transition-all"
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
                  <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Configura la comision que recibe el rol <strong>{selectedRole}</strong> por cada venta
                  </p>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
                      <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Producto
                      </th>
                      <th className={`px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Tipo
                      </th>
                      <th className={`px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
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
                                } border focus:outline-none focus:ring-2 focus:ring-purple-500/20`}
                              >
                                <option value="percentage">Porcentaje %</option>
                                <option value="fixed">Monto Fijo $</option>
                              </select>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center">
                              <div className="relative">
                                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${isDark ? 'text-purple-400' : 'text-purple-500'}`}>
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
                                    commission.value > 0
                                      ? isDark
                                        ? 'bg-purple-900/30 border-purple-600 text-purple-300 focus:border-purple-500'
                                        : 'bg-purple-50 border-purple-300 text-purple-700 focus:border-purple-400'
                                      : isDark
                                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-600 focus:border-purple-500'
                                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-purple-400'
                                  } focus:outline-none focus:ring-4 focus:ring-purple-500/10`}
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
                                  value={commission.maxAmount ?? ''}
                                  placeholder="—"
                                  onChange={(e) => setProductCommissions(prev => ({
                                    ...prev,
                                    [product.id]: { ...commission, maxAmount: e.target.value ? parseFloat(e.target.value) : null }
                                  }))}
                                  className={`w-28 pl-8 pr-3 py-2 text-center rounded-xl border transition-all ${
                                    isDark
                                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-600 focus:border-purple-500'
                                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-purple-400'
                                  } focus:outline-none focus:ring-2 focus:ring-purple-500/10`}
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

              {/* Service Commissions Table */}
              {allServices.length > 0 && (
                <div className={`rounded-2xl overflow-hidden border ${isDark ? 'bg-gray-800/50 border-gray-800' : 'bg-white border-gray-200'}`}>
                  <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
                    <h4 className={`font-semibold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      <Tag className="w-5 h-5" />
                      Comisiones por Servicio
                    </h4>
                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Comisiones adicionales por servicios personalizados
                    </p>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
                        <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Servicio
                        </th>
                        <th className={`px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Tipo
                        </th>
                        <th className={`px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                          Valor
                        </th>
                        <th className={`px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Max. Monto
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-gray-800' : 'divide-gray-100'}`}>
                      {allServices.map(service => {
                        const commission = serviceCommissions[service.id] || { type: 'percentage' as const, value: 0, maxAmount: null }

                        return (
                          <tr key={service.id} className={`transition-colors ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}>
                            <td className="px-6 py-4">
                              <div>
                                <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {service.serviceName}
                                </div>
                                {service.description && (
                                  <div className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {service.description}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-center">
                                <select
                                  value={commission.type}
                                  onChange={(e) => setServiceCommissions(prev => ({
                                    ...prev,
                                    [service.id]: { ...commission, type: e.target.value as 'percentage' | 'fixed' }
                                  }))}
                                  className={`appearance-none px-3 py-2 rounded-lg text-sm cursor-pointer ${
                                    isDark
                                      ? 'bg-gray-700 border-gray-600 text-white'
                                      : 'bg-gray-50 border-gray-200 text-gray-900'
                                  } border focus:outline-none focus:ring-2 focus:ring-purple-500/20`}
                                >
                                  <option value="percentage">Porcentaje %</option>
                                  <option value="fixed">Monto Fijo $</option>
                                </select>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-center">
                                <div className="relative">
                                  <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${isDark ? 'text-purple-400' : 'text-purple-500'}`}>
                                    {commission.type === 'percentage' ? '%' : '$'}
                                  </span>
                                  <input
                                    type="number"
                                    step={commission.type === 'percentage' ? '1' : '0.01'}
                                    min="0"
                                    max={commission.type === 'percentage' ? '100' : undefined}
                                    value={commission.value || ''}
                                    placeholder="0"
                                    onChange={(e) => setServiceCommissions(prev => ({
                                      ...prev,
                                      [service.id]: { ...commission, value: parseFloat(e.target.value) || 0 }
                                    }))}
                                    className={`w-28 pl-8 pr-3 py-2.5 text-center text-lg font-semibold rounded-xl border-2 transition-all ${
                                      commission.value > 0
                                        ? isDark
                                          ? 'bg-purple-900/30 border-purple-600 text-purple-300 focus:border-purple-500'
                                          : 'bg-purple-50 border-purple-300 text-purple-700 focus:border-purple-400'
                                        : isDark
                                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-600 focus:border-purple-500'
                                          : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-purple-400'
                                    } focus:outline-none focus:ring-4 focus:ring-purple-500/10`}
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
                                    value={commission.maxAmount ?? ''}
                                    placeholder="—"
                                    onChange={(e) => setServiceCommissions(prev => ({
                                      ...prev,
                                      [service.id]: { ...commission, maxAmount: e.target.value ? parseFloat(e.target.value) : null }
                                    }))}
                                    className={`w-28 pl-8 pr-3 py-2 text-center rounded-xl border transition-all ${
                                      isDark
                                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-600 focus:border-purple-500'
                                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-purple-400'
                                    } focus:outline-none focus:ring-2 focus:ring-purple-500/10`}
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
              )}

              {/* Empty state if no products */}
              {products.length === 0 && (
                <div className={`rounded-2xl p-8 ${isDark ? 'bg-gray-800/50 border border-gray-800' : 'bg-white border border-gray-200'}`}>
                  <div className="text-center py-12">
                    <div className={`w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center ${
                      isDark ? 'bg-gradient-to-br from-purple-900/50 to-purple-800/30' : 'bg-gradient-to-br from-purple-100 to-purple-50'
                    }`}>
                      <Percent className={`w-10 h-10 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
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
      </div>

      {/* Service Modal */}
      <AnimatePresence>
        {showServiceModal && selectedProductForService && (
          <ServiceModal
            isDark={isDark}
            product={selectedProductForService}
            services={productServices}
            editingService={editingService}
            onClose={() => {
              setShowServiceModal(false)
              setSelectedProductForService(null)
              setProductServices([])
              setEditingService(null)
            }}
            onSave={handleSaveService}
            onEdit={setEditingService}
            onDelete={handleDeleteService}
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  )
}

// Service Modal Component
interface ServiceModalProps {
  isDark: boolean
  product: Product
  services: ProductService[]
  editingService: ProductService | null
  onClose: () => void
  onSave: (data: any) => Promise<void>
  onEdit: (service: ProductService | null) => void
  onDelete: (serviceId: number) => void
}

function ServiceModal({ isDark, product, services, editingService, onClose, onSave, onEdit, onDelete }: ServiceModalProps) {
  const [formData, setFormData] = useState({
    serviceName: editingService?.serviceName || '',
    description: editingService?.description || '',
    costPrice: editingService?.costPrice || 0,
    sellPrice: editingService?.sellPrice || 0,
    isRequired: editingService?.isRequired || false,
    isDefaultSelected: editingService?.isDefaultSelected || false
  })
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    if (editingService) {
      setFormData({
        serviceName: editingService.serviceName,
        description: editingService.description || '',
        costPrice: editingService.costPrice,
        sellPrice: editingService.sellPrice,
        isRequired: editingService.isRequired,
        isDefaultSelected: editingService.isDefaultSelected
      })
      setShowForm(true)
    }
  }, [editingService])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.serviceName) return

    setSaving(true)
    await onSave(formData)
    setSaving(false)
    setFormData({
      serviceName: '',
      description: '',
      costPrice: 0,
      sellPrice: 0,
      isRequired: false,
      isDefaultSelected: false
    })
    setShowForm(false)
  }

  const catConfig = getCategoryConfig(product.category)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', duration: 0.4 }}
        className={`w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}
      >
        {/* Header */}
        <div className={`relative px-6 py-6 bg-gradient-to-r ${catConfig.gradient}`}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <catConfig.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Servicios de {product.name}
                </h2>
                <p className="text-white/70 text-sm">
                  {product.code}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Services List */}
          {services.length > 0 && !showForm && (
            <div className="space-y-3 mb-6">
              {services.map(service => (
                <div
                  key={service.id}
                  className={`p-4 rounded-xl border ${isDark ? 'bg-gray-700/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {service.serviceName}
                        </span>
                        {service.isRequired && (
                          <span className={`px-2 py-0.5 rounded-full text-xs ${isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600'}`}>
                            Requerido
                          </span>
                        )}
                      </div>
                      <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Costo: ${service.costPrice.toFixed(2)} | Venta: ${service.sellPrice.toFixed(2)} | Margen: ${service.margin.toFixed(2)} ({service.marginPercentage.toFixed(1)}%)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onEdit(service)}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-600 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(service.id)}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-50 text-red-500'}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add/Edit Form */}
          {showForm ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Nombre del Servicio
                </label>
                <input
                  type="text"
                  value={formData.serviceName}
                  onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl border text-sm transition-all ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500'
                      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                  placeholder="Ej: Recogida a Domicilio"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Descripcion (opcional)
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl border text-sm transition-all ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500'
                      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                  placeholder="Descripcion del servicio..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Costo ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
                    className={`w-full px-4 py-3 rounded-xl border text-sm transition-all ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500'
                        : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-400'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    Precio Venta ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.sellPrice}
                    onChange={(e) => setFormData({ ...formData, sellPrice: parseFloat(e.target.value) || 0 })}
                    className={`w-full px-4 py-3 rounded-xl border text-sm transition-all ${
                      isDark
                        ? 'bg-emerald-900/30 border-emerald-700 text-emerald-300 focus:border-emerald-500'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700 focus:border-emerald-400'
                    } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isRequired}
                    onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                  />
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Requerido</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isDefaultSelected}
                    onChange={(e) => setFormData({ ...formData, isDefaultSelected: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                  />
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Seleccionado por defecto</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    onEdit(null)
                    setFormData({
                      serviceName: '',
                      description: '',
                      costPrice: 0,
                      sellPrice: 0,
                      isRequired: false,
                      isDefaultSelected: false
                    })
                  }}
                  className={`px-5 py-2.5 rounded-xl font-medium transition-colors ${
                    isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-600'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !formData.serviceName}
                  className={`px-6 py-2.5 bg-gradient-to-r ${catConfig.gradient} text-white font-medium rounded-xl disabled:opacity-50 flex items-center gap-2 shadow-lg transition-all hover:shadow-xl`}
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingService ? 'Actualizar' : 'Crear'} Servicio
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className={`w-full py-4 rounded-xl border-2 border-dashed transition-all flex items-center justify-center gap-2 ${
                isDark
                  ? 'border-gray-700 hover:border-blue-500 text-gray-400 hover:text-blue-400'
                  : 'border-gray-300 hover:border-blue-400 text-gray-500 hover:text-blue-500'
              }`}
            >
              <Plus className="w-5 h-5" />
              Agregar Servicio
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
