'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Store,
  Plus,
  Search,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Pause,
  Eye,
  Edit,
  Package,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  Warehouse,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  Play
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Product {
  id: number
  name: string
  sku: string
  barcode?: string
  imageUrl?: string
  category: string
  costPrice: number
  sellingPrice: number
}

interface WarehouseInfo {
  id: number
  name: string
  code: string
  stockAvailable: number
  stockOnHand: number
  stockReserved: number
}

interface Listing {
  id: number
  listingCode: string
  product: Product
  warehouse: WarehouseInfo
  priceMarketplace: number
  originalProductPrice: number
  currency: string
  quantityListed: number
  quantitySold: number
  quantityAvailable: number
  status: 'pending' | 'approved' | 'rejected' | 'inactive' | 'suspended' | 'sold_out'
  isFeatured: boolean
  marketplaceTitle?: string
  submittedAt: string
  approvedAt?: string
  rejectedAt?: string
  rejectionReason?: string
  rejectionCategory?: string
  createdAt: string
  updatedAt: string
  createdByName?: string
  approvedByName?: string
}

interface Stats {
  total: number
  pending: number
  approved: number
  rejected: number
  inactive: number
  suspended: number
  soldOut: number
  totalListedValue: number
  totalSoldValue: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface PriceCheck {
  product: {
    id: number
    name: string
    costPrice: number
    sellingPrice: number
  }
  proposedPrice: number
  priceAnalysis: {
    priceDifferencePercent: number
    pricePosition: 'below' | 'average' | 'above'
    alertTriggered: boolean
    alertReason: string | null
    alertSeverity: 'low' | 'medium' | 'high' | 'critical'
    recommendation: 'ok' | 'warning' | 'requires_justification'
  }
  marketComparison: {
    averagePrice: number | null
    minPrice: number | null
    maxPrice: number | null
    competitorCount: number
    similarProducts: Array<{
      marketName: string
      price: number
      province: string
    }>
  }
  suggestedRange: {
    min: number
    max: number
  }
  margins: {
    proposedMargin: number
    baseMargin: number
  }
}

interface AvailableProduct {
  id: number
  name: string
  sku: string
  barcode?: string
  imageUrl?: string
  category: string
  costPrice: number
  sellingPrice: number
}

interface AvailableWarehouse {
  id: number
  name: string
  code: string
  stockOnHand: number
  stockReserved: number
  stockAvailable: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; gradient: string }> = {
  pending: { label: 'Pendiente', color: 'amber', icon: Clock, gradient: 'from-amber-400 to-orange-600' },
  approved: { label: 'Aprobado', color: 'emerald', icon: CheckCircle, gradient: 'from-emerald-400 to-green-600' },
  rejected: { label: 'Rechazado', color: 'red', icon: XCircle, gradient: 'from-red-400 to-rose-600' },
  inactive: { label: 'Inactivo', color: 'gray', icon: Pause, gradient: 'from-gray-400 to-gray-600' },
  suspended: { label: 'Suspendido', color: 'red', icon: XCircle, gradient: 'from-red-400 to-rose-600' },
  sold_out: { label: 'Agotado', color: 'gray', icon: Package, gradient: 'from-gray-400 to-gray-600' }
}

export default function MarketMarketplacePage() {
  const { theme } = useTheme()
  const router = useRouter()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({
    total: 0, pending: 0, approved: 0, rejected: 0,
    inactive: 0, suspended: 0, soldOut: 0,
    totalListedValue: 0, totalSoldValue: 0
  })
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createStep, setCreateStep] = useState(1)
  const [creating, setCreating] = useState(false)

  // Product selection
  const [availableProducts, setAvailableProducts] = useState<AvailableProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<AvailableProduct | null>(null)

  // Warehouse selection
  const [availableWarehouses, setAvailableWarehouses] = useState<AvailableWarehouse[]>([])
  const [loadingWarehouses, setLoadingWarehouses] = useState(false)
  const [selectedWarehouse, setSelectedWarehouse] = useState<AvailableWarehouse | null>(null)

  // Pricing
  const [priceMarketplace, setPriceMarketplace] = useState<string>('')
  const [quantityListed, setQuantityListed] = useState<string>('')
  const [marketplaceTitle, setMarketplaceTitle] = useState('')
  const [marketplaceDescription, setMarketplaceDescription] = useState('')

  // Price check
  const [priceCheck, setPriceCheck] = useState<PriceCheck | null>(null)
  const [checkingPrice, setCheckingPrice] = useState(false)

  // Detail modal
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    fetchListings()
  }, [pagination.page, selectedStatus])

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (pagination.page === 1) {
        fetchListings()
      } else {
        setPagination(p => ({ ...p, page: 1 }))
      }
    }, 300)
    return () => clearTimeout(debounce)
  }, [search])

  const fetchListings = async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })
      if (search) params.set('search', search)
      if (selectedStatus) params.set('status', selectedStatus)

      const response = await fetch(`/api/market/marketplace?${params}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setListings(data.data.listings)
          setStats(data.data.stats)
          if (data.data.pagination) {
            setPagination(data.data.pagination)
          }
          setLastUpdated(new Date())
        }
      }
    } catch (error) {
      console.error('Error fetching listings:', error)
    } finally {
      if (!silent) setLoading(false)
      else setIsRefreshing(false)
    }
  }

  const handleManualRefresh = () => fetchListings(true)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  // Open create page
  const openCreateModal = () => {
    router.push('/dashboard/market/marketplace/create')
  }

  // Fetch products for selection
  const fetchAvailableProducts = async () => {
    setLoadingProducts(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (productSearch) params.set('search', productSearch)

      const response = await fetch(`/api/market/products?${params}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setAvailableProducts(data.data.products || [])
        }
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  // Search products with debounce
  useEffect(() => {
    if (showCreateModal && createStep === 1) {
      const debounce = setTimeout(() => {
        fetchAvailableProducts()
      }, 300)
      return () => clearTimeout(debounce)
    }
  }, [productSearch, showCreateModal, createStep])

  // Fetch warehouses with stock for selected product
  const fetchWarehousesWithStock = async (productId: number) => {
    setLoadingWarehouses(true)
    try {
      const response = await fetch(`/api/market/warehouses?productId=${productId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setAvailableWarehouses(data.data.warehouses || [])
        }
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error)
    } finally {
      setLoadingWarehouses(false)
    }
  }

  // When product is selected, fetch warehouses
  useEffect(() => {
    if (selectedProduct) {
      fetchWarehousesWithStock(selectedProduct.id)
      setPriceMarketplace(selectedProduct.sellingPrice.toString())
    }
  }, [selectedProduct])

  // Check price when typing
  const checkPrice = useCallback(async () => {
    if (!selectedProduct || !priceMarketplace) return

    const price = parseFloat(priceMarketplace)
    if (isNaN(price) || price <= 0) return

    setCheckingPrice(true)
    try {
      const response = await fetch(
        `/api/market/marketplace/price-check?productId=${selectedProduct.id}&proposedPrice=${price}`
      )
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setPriceCheck(data.data)
        }
      }
    } catch (error) {
      console.error('Error checking price:', error)
    } finally {
      setCheckingPrice(false)
    }
  }, [selectedProduct, priceMarketplace])

  // Debounced price check
  useEffect(() => {
    if (createStep === 3 && selectedProduct && priceMarketplace) {
      const debounce = setTimeout(() => {
        checkPrice()
      }, 500)
      return () => clearTimeout(debounce)
    }
  }, [priceMarketplace, createStep, selectedProduct, checkPrice])

  // Handle create listing
  const handleCreateListing = async () => {
    if (!selectedProduct || !selectedWarehouse || !priceMarketplace || !quantityListed) return

    setCreating(true)
    try {
      const response = await fetch('/api/market/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          warehouseId: selectedWarehouse.id,
          priceMarketplace: parseFloat(priceMarketplace),
          quantityListed: parseInt(quantityListed),
          marketplaceTitle: marketplaceTitle || null,
          marketplaceDescription: marketplaceDescription || null
        })
      })

      const data = await response.json()
      if (data.success) {
        setShowCreateModal(false)
        fetchListings()
      } else {
        alert(data.error || 'Error al crear publicacion')
      }
    } catch (error) {
      console.error('Error creating listing:', error)
      alert('Error al crear publicacion')
    } finally {
      setCreating(false)
    }
  }

  // Handle actions (pause, resume, cancel)
  const handleAction = async (listingId: number, action: 'pause' | 'resume' | 'cancel') => {
    setActionLoading(true)
    try {
      const response = await fetch(`/api/market/marketplace/${listingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      const data = await response.json()
      if (data.success) {
        fetchListings()
        setSelectedListing(null)
      } else {
        alert(data.error || 'Error al procesar accion')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al procesar accion')
    } finally {
      setActionLoading(false)
    }
  }

  // Price alert badge component
  const PriceAlertBadge = ({ check }: { check: PriceCheck }) => {
    const { priceAnalysis, marketComparison, margins } = check

    const getPositionIcon = () => {
      if (priceAnalysis.pricePosition === 'below') return <TrendingDown className="w-4 h-4" />
      if (priceAnalysis.pricePosition === 'above') return <TrendingUp className="w-4 h-4" />
      return <Minus className="w-4 h-4" />
    }

    const getPositionColor = () => {
      if (priceAnalysis.pricePosition === 'below') return 'text-emerald-500'
      if (priceAnalysis.pricePosition === 'above') return 'text-amber-500'
      return 'text-blue-500'
    }

    const getSeverityColor = () => {
      switch (priceAnalysis.alertSeverity) {
        case 'critical': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
        case 'high': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
        case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
        default: return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
      }
    }

    return (
      <div className="space-y-4">
        {/* Alert Banner */}
        {priceAnalysis.alertTriggered && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'p-4 rounded-xl border flex items-start gap-3',
              getSeverityColor()
            )}
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{priceAnalysis.alertReason}</p>
              {priceAnalysis.recommendation === 'requires_justification' && (
                <p className="text-sm mt-1 opacity-80">Este precio requiere justificacion especial</p>
              )}
            </div>
          </motion.div>
        )}

        {/* Market Comparison */}
        {marketComparison.competitorCount > 0 && (
          <div className={cn(
            'p-4 rounded-xl',
            theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
          )}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">Comparacion de Mercado</span>
              <span className="text-xs text-gray-400">{marketComparison.competitorCount} competidores</span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center">
                <p className="text-xs text-gray-500">Min</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(marketComparison.minPrice || 0)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Promedio</p>
                <p className="font-bold text-blue-600">
                  {formatCurrency(marketComparison.averagePrice || 0)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Max</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(marketComparison.maxPrice || 0)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2">
              <span className={cn('flex items-center gap-1', getPositionColor())}>
                {getPositionIcon()}
                <span className="text-sm font-medium">
                  {priceAnalysis.pricePosition === 'below' && 'Por debajo del promedio'}
                  {priceAnalysis.pricePosition === 'average' && 'Cerca del promedio'}
                  {priceAnalysis.pricePosition === 'above' && 'Por encima del promedio'}
                </span>
              </span>
            </div>
          </div>
        )}

        {/* Margins */}
        <div className={cn(
          'p-4 rounded-xl',
          theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
        )}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Margen propuesto</span>
            <span className={cn(
              'font-bold',
              margins.proposedMargin >= 0 ? 'text-emerald-600' : 'text-red-600'
            )}>
              {margins.proposedMargin.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Margen base</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {margins.baseMargin.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Total Publicaciones */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onClick={() => setSelectedStatus(null)}
                className={cn(
                  'relative overflow-hidden cursor-pointer',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl',
                  selectedStatus === null && 'ring-2 ring-blue-500'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-blue-900/30 border border-blue-800/50'
                          : 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200'
                      )}>
                        <Store className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-black'
                        )}>Total Publicaciones</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.total}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>Valor: {formatCurrency(stats.totalListedValue)}</span>
                  </div>
                </div>
              </motion.div>

              {/* Pendientes */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                onClick={() => setSelectedStatus(selectedStatus === 'pending' ? null : 'pending')}
                className={cn(
                  'relative overflow-hidden cursor-pointer',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl',
                  selectedStatus === 'pending' && 'ring-2 ring-amber-500'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-amber-900/30 border border-amber-800/50'
                          : 'bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200'
                      )}>
                        <Clock className="w-6 h-6 text-amber-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-black'
                        )}>Pendientes</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.pending}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>Esperando aprobacion</span>
                  </div>
                </div>
              </motion.div>

              {/* Aprobados */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                onClick={() => setSelectedStatus(selectedStatus === 'approved' ? null : 'approved')}
                className={cn(
                  'relative overflow-hidden cursor-pointer',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl',
                  selectedStatus === 'approved' && 'ring-2 ring-emerald-500'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-emerald-900/30 border border-emerald-800/50'
                          : 'bg-gradient-to-br from-emerald-50 to-green-100 border border-emerald-200'
                      )}>
                        <CheckCircle className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-black'
                        )}>Aprobados</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.approved}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>Visibles en marketplace</span>
                  </div>
                </div>
              </motion.div>

              {/* Rechazados */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                onClick={() => setSelectedStatus(selectedStatus === 'rejected' ? null : 'rejected')}
                className={cn(
                  'relative overflow-hidden cursor-pointer',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl',
                  selectedStatus === 'rejected' && 'ring-2 ring-red-500'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-rose-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-red-900/30 border border-red-800/50'
                          : 'bg-gradient-to-br from-red-50 to-rose-100 border border-red-200'
                      )}>
                        <XCircle className="w-6 h-6 text-red-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-black'
                        )}>Rechazados</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.rejected}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Filters */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={cn(
                'p-4 rounded-2xl border shadow-xl',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por codigo, producto o SKU..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={cn(
                      'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                        : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                    )}
                  />
                </div>

                {/* Clear Filters */}
                {(search || selectedStatus) && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSearch('')
                      setSelectedStatus(null)
                    }}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    <X className="w-4 h-4" />
                    Limpiar
                  </motion.button>
                )}

                {/* Refresh */}
                <div className="flex items-center gap-2">
                  {lastUpdated && (
                    <span className="text-xs text-gray-400 hidden sm:inline">
                      {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleManualRefresh}
                    disabled={loading || isRefreshing}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                      isRefreshing && 'opacity-75'
                    )}
                  >
                    <RefreshCw className={cn('w-4 h-4', (loading || isRefreshing) && 'animate-spin')} />
                  </motion.button>
                </div>

                {/* Nueva Publicacion */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={openCreateModal}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/25"
                >
                  <Plus className="w-5 h-5" />
                  Nueva Publicacion
                </motion.button>
              </div>
            </motion.div>

            {/* Listings Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className={cn(
                'rounded-2xl border shadow-xl overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={cn(
                      'border-b',
                      theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                    )}>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Codigo</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Almacen</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                      <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan={7} className="py-4 px-4">
                            <div className="animate-pulse flex items-center gap-3">
                              <div className="w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                              <div className="flex-1">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : listings.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center">
                          <Store className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className="text-gray-500 dark:text-gray-400">No hay publicaciones registradas</p>
                          <button
                            onClick={openCreateModal}
                            className="mt-3 text-sm text-emerald-500 hover:text-emerald-600"
                          >
                            Crear primera publicacion
                          </button>
                        </td>
                      </tr>
                    ) : (
                      listings.map((listing, index) => {
                        const statusConfig = STATUS_CONFIG[listing.status] || STATUS_CONFIG.pending
                        const StatusIcon = statusConfig.icon

                        return (
                          <motion.tr
                            key={listing.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                            className={cn(
                              'group transition-colors',
                              theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                            )}
                          >
                            <td className="py-4 px-4">
                              <span className="font-mono font-medium text-gray-900 dark:text-white">
                                {listing.listingCode}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                {listing.product.imageUrl ? (
                                  <img
                                    src={listing.product.imageUrl}
                                    alt={listing.product.name}
                                    className="w-10 h-10 rounded-lg object-cover"
                                  />
                                ) : (
                                  <div className={cn(
                                    'w-10 h-10 rounded-lg flex items-center justify-center',
                                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                  )}>
                                    <Package className="w-5 h-5 text-gray-400" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white">
                                    {listing.marketplaceTitle || listing.product.name}
                                  </p>
                                  <p className="text-xs text-gray-500">{listing.product.sku}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                <Warehouse className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-600 dark:text-gray-300">
                                  {listing.warehouse.name}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {listing.quantityAvailable} / {listing.quantityListed}
                              </span>
                              <p className="text-xs text-gray-500">disponible / total</p>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span className="text-sm font-bold text-gray-900 dark:text-white">
                                {formatCurrency(listing.priceMarketplace)}
                              </span>
                              {listing.priceMarketplace !== listing.originalProductPrice && (
                                <p className="text-xs text-gray-500 line-through">
                                  {formatCurrency(listing.originalProductPrice)}
                                </p>
                              )}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={cn(
                                'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium',
                                statusConfig.color === 'gray' && 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
                                statusConfig.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                                statusConfig.color === 'emerald' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                                statusConfig.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              )}>
                                <StatusIcon className="w-3.5 h-3.5" />
                                {statusConfig.label}
                              </span>
                              {listing.rejectionReason && (
                                <p className="text-xs text-red-500 mt-1 max-w-[120px] truncate" title={listing.rejectionReason}>
                                  {listing.rejectionReason}
                                </p>
                              )}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => setSelectedListing(listing)}
                                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                  title="Ver detalle"
                                >
                                  <Eye className="w-4 h-4 text-blue-500" />
                                </motion.button>
                                {listing.status === 'approved' && (
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleAction(listing.id, 'pause')}
                                    className="p-2 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                                    title="Pausar"
                                  >
                                    <Pause className="w-4 h-4 text-amber-500" />
                                  </motion.button>
                                )}
                                {listing.status === 'inactive' && (
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleAction(listing.id, 'resume')}
                                    className="p-2 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                                    title="Reactivar"
                                  >
                                    <Play className="w-4 h-4 text-emerald-500" />
                                  </motion.button>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className={cn(
                  'flex items-center justify-between px-4 py-3 border-t',
                  theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                )}>
                  <p className="text-sm text-gray-500">
                    Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
                  </p>
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                      disabled={pagination.page === 1}
                      className={cn(
                        'p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                        theme === 'dark'
                          ? 'hover:bg-gray-700 text-gray-300'
                          : 'hover:bg-gray-200 text-gray-600'
                      )}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </motion.button>
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {pagination.page} / {pagination.totalPages}
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                      disabled={pagination.page === pagination.totalPages}
                      className={cn(
                        'p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                        theme === 'dark'
                          ? 'hover:bg-gray-700 text-gray-300'
                          : 'hover:bg-gray-200 text-gray-600'
                      )}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </motion.button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>

          {/* Create Modal - Wizard */}
          <AnimatePresence>
            {showCreateModal && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowCreateModal(false)}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                />

                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: "spring", duration: 0.3 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                >
                  <div
                    className={cn(
                      "w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border",
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-700'
                        : 'bg-white border-gray-200'
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className={cn(
                      "px-6 py-4 border-b flex items-center justify-between sticky top-0 z-10",
                      theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
                    )}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                          <Store className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className={cn(
                            "font-semibold",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            Nueva Publicacion
                          </h3>
                          <p className="text-xs text-gray-500">Paso {createStep} de 4</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowCreateModal(false)}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                        )}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Progress Steps */}
                    <div className={cn(
                      "px-6 py-4 border-b",
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <div className="flex items-center justify-between">
                        {[
                          { step: 1, label: 'Producto' },
                          { step: 2, label: 'Almacen' },
                          { step: 3, label: 'Precio' },
                          { step: 4, label: 'Confirmar' }
                        ].map((item, index) => (
                          <div key={item.step} className="flex items-center">
                            <div className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                              createStep >= item.step
                                ? 'bg-emerald-500 text-white'
                                : theme === 'dark'
                                  ? 'bg-gray-700 text-gray-400'
                                  : 'bg-gray-200 text-gray-500'
                            )}>
                              {item.step}
                            </div>
                            <span className={cn(
                              'ml-2 text-sm hidden sm:inline',
                              createStep >= item.step
                                ? theme === 'dark' ? 'text-white' : 'text-gray-900'
                                : 'text-gray-500'
                            )}>
                              {item.label}
                            </span>
                            {index < 3 && (
                              <div className={cn(
                                'w-12 h-0.5 mx-2',
                                createStep > item.step
                                  ? 'bg-emerald-500'
                                  : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                              )} />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      {/* Step 1: Select Product */}
                      {createStep === 1 && (
                        <div className="space-y-4">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Buscar producto por nombre o SKU..."
                              value={productSearch}
                              onChange={(e) => setProductSearch(e.target.value)}
                              className={cn(
                                'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                                theme === 'dark'
                                  ? 'bg-gray-700/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                                  : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                              )}
                            />
                          </div>

                          <div className="max-h-80 overflow-y-auto space-y-2">
                            {loadingProducts ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                              </div>
                            ) : availableProducts.length === 0 ? (
                              <div className="text-center py-8">
                                <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                                <p className="text-gray-500">No se encontraron productos</p>
                              </div>
                            ) : (
                              availableProducts.map((product) => (
                                <button
                                  key={product.id}
                                  onClick={() => setSelectedProduct(product)}
                                  className={cn(
                                    'w-full p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4',
                                    selectedProduct?.id === product.id
                                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                      : theme === 'dark'
                                        ? 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                                  )}
                                >
                                  {product.imageUrl ? (
                                    <img
                                      src={product.imageUrl}
                                      alt={product.name}
                                      className="w-14 h-14 rounded-lg object-cover"
                                    />
                                  ) : (
                                    <div className={cn(
                                      'w-14 h-14 rounded-lg flex items-center justify-center',
                                      theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200'
                                    )}>
                                      <Package className="w-6 h-6 text-gray-400" />
                                    </div>
                                  )}
                                  <div className="flex-1">
                                    <p className={cn(
                                      "font-medium",
                                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    )}>
                                      {product.name}
                                    </p>
                                    <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                                    <div className="flex items-center gap-4 mt-1">
                                      <span className="text-xs text-gray-400">Costo: {formatCurrency(product.costPrice)}</span>
                                      <span className="text-xs text-emerald-500 font-medium">Venta: {formatCurrency(product.sellingPrice)}</span>
                                    </div>
                                  </div>
                                  {selectedProduct?.id === product.id && (
                                    <CheckCircle className="w-6 h-6 text-emerald-500" />
                                  )}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      {/* Step 2: Select Warehouse */}
                      {createStep === 2 && (
                        <div className="space-y-4">
                          {/* Selected Product Summary */}
                          {selectedProduct && (
                            <div className={cn(
                              'p-4 rounded-xl flex items-center gap-4',
                              theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                            )}>
                              {selectedProduct.imageUrl ? (
                                <img
                                  src={selectedProduct.imageUrl}
                                  alt={selectedProduct.name}
                                  className="w-12 h-12 rounded-lg object-cover"
                                />
                              ) : (
                                <div className={cn(
                                  'w-12 h-12 rounded-lg flex items-center justify-center',
                                  theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200'
                                )}>
                                  <Package className="w-5 h-5 text-gray-400" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">{selectedProduct.name}</p>
                                <p className="text-sm text-gray-500">SKU: {selectedProduct.sku}</p>
                              </div>
                            </div>
                          )}

                          <p className={cn(
                            "text-sm font-medium mb-2",
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          )}>
                            Selecciona el almacen de donde se tomara el stock:
                          </p>

                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {loadingWarehouses ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                              </div>
                            ) : availableWarehouses.length === 0 ? (
                              <div className="text-center py-8">
                                <Warehouse className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                                <p className="text-gray-500">No hay almacenes con stock disponible</p>
                              </div>
                            ) : (
                              availableWarehouses.map((warehouse) => (
                                <button
                                  key={warehouse.id}
                                  onClick={() => setSelectedWarehouse(warehouse)}
                                  disabled={warehouse.stockAvailable <= 0}
                                  className={cn(
                                    'w-full p-4 rounded-xl border-2 transition-all text-left flex items-center justify-between',
                                    selectedWarehouse?.id === warehouse.id
                                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                      : warehouse.stockAvailable <= 0
                                        ? 'border-gray-300 dark:border-gray-700 opacity-50 cursor-not-allowed'
                                        : theme === 'dark'
                                          ? 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                                          : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    <Warehouse className={cn(
                                      "w-5 h-5",
                                      selectedWarehouse?.id === warehouse.id ? 'text-emerald-500' : 'text-gray-400'
                                    )} />
                                    <div>
                                      <p className={cn(
                                        "font-medium",
                                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                                      )}>
                                        {warehouse.name}
                                      </p>
                                      <p className="text-xs text-gray-500">Codigo: {warehouse.code}</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className={cn(
                                      'font-bold',
                                      warehouse.stockAvailable > 0 ? 'text-emerald-600' : 'text-red-500'
                                    )}>
                                      {warehouse.stockAvailable} disponibles
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {warehouse.stockOnHand} en mano / {warehouse.stockReserved} reservados
                                    </p>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      {/* Step 3: Set Price and Quantity */}
                      {createStep === 3 && (
                        <div className="space-y-6">
                          {/* Product and Warehouse Summary */}
                          <div className={cn(
                            'p-4 rounded-xl',
                            theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                          )}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Package className="w-5 h-5 text-gray-400" />
                                <span className="font-medium text-gray-900 dark:text-white">{selectedProduct?.name}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <Warehouse className="w-5 h-5 text-gray-400" />
                                <span className="text-gray-600 dark:text-gray-300">{selectedWarehouse?.name}</span>
                              </div>
                            </div>
                          </div>

                          {/* Quantity Input */}
                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              Cantidad a publicar
                              <span className="text-xs text-gray-500 ml-2">
                                (Disponibles: {selectedWarehouse?.stockAvailable || 0})
                              </span>
                            </label>
                            <input
                              type="number"
                              min="1"
                              max={selectedWarehouse?.stockAvailable || 0}
                              value={quantityListed}
                              onChange={(e) => setQuantityListed(e.target.value)}
                              placeholder="Ej: 100"
                              className={cn(
                                'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                                theme === 'dark'
                                  ? 'bg-gray-700/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                                  : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                              )}
                            />
                          </div>

                          {/* Price Input */}
                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              Precio en Marketplace
                              <span className="text-xs text-gray-500 ml-2">
                                (Precio base: {formatCurrency(selectedProduct?.sellingPrice || 0)})
                              </span>
                            </label>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                              <input
                                type="number"
                                step="0.0001"
                                min="0"
                                value={priceMarketplace}
                                onChange={(e) => setPriceMarketplace(e.target.value)}
                                placeholder="0.00"
                                className={cn(
                                  'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                                  theme === 'dark'
                                    ? 'bg-gray-700/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                                    : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                                )}
                              />
                              {checkingPrice && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-emerald-500" />
                              )}
                            </div>
                          </div>

                          {/* Price Alert Badge */}
                          {priceCheck && <PriceAlertBadge check={priceCheck} />}

                          {/* Optional Title */}
                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              Titulo personalizado (opcional)
                            </label>
                            <input
                              type="text"
                              value={marketplaceTitle}
                              onChange={(e) => setMarketplaceTitle(e.target.value)}
                              placeholder="Ej: Oferta especial - Producto Premium"
                              className={cn(
                                'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                                theme === 'dark'
                                  ? 'bg-gray-700/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                                  : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                              )}
                            />
                          </div>
                        </div>
                      )}

                      {/* Step 4: Confirm */}
                      {createStep === 4 && (
                        <div className="space-y-6">
                          <div className={cn(
                            'p-6 rounded-xl',
                            theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                          )}>
                            <h4 className={cn(
                              "font-semibold mb-4",
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              Resumen de la Publicacion
                            </h4>

                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">Producto</span>
                                <span className="font-medium text-gray-900 dark:text-white">{selectedProduct?.name}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">SKU</span>
                                <span className="font-mono text-gray-900 dark:text-white">{selectedProduct?.sku}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">Almacen</span>
                                <span className="text-gray-900 dark:text-white">{selectedWarehouse?.name}</span>
                              </div>
                              <div className={cn(
                                'border-t pt-3',
                                theme === 'dark' ? 'border-gray-600' : 'border-gray-200'
                              )}>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-500">Cantidad</span>
                                  <span className="font-bold text-gray-900 dark:text-white">{quantityListed} unidades</span>
                                </div>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">Precio Marketplace</span>
                                <span className="font-bold text-emerald-600">{formatCurrency(parseFloat(priceMarketplace) || 0)}</span>
                              </div>
                              {marketplaceTitle && (
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-500">Titulo</span>
                                  <span className="text-gray-900 dark:text-white">{marketplaceTitle}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Price Alert Warning */}
                          {priceCheck?.priceAnalysis.alertTriggered && (
                            <div className={cn(
                              'p-4 rounded-xl border flex items-start gap-3',
                              priceCheck.priceAnalysis.alertSeverity === 'critical'
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                            )}>
                              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="font-medium">{priceCheck.priceAnalysis.alertReason}</p>
                                <p className="text-sm mt-1 opacity-80">
                                  El superadmin revisara esta publicacion antes de aprobarla.
                                </p>
                              </div>
                            </div>
                          )}

                          <div className={cn(
                            'p-4 rounded-xl flex items-start gap-3',
                            theme === 'dark' ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'
                          )}>
                            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              La publicacion se enviara a revision. Un superadmin la revisara y podra aprobarla o rechazarla.
                              El stock se reservara automaticamente.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className={cn(
                      "flex gap-3 p-6 pt-4 border-t sticky bottom-0",
                      theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
                    )}>
                      {createStep > 1 && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setCreateStep(createStep - 1)}
                          className={cn(
                            "flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
                            theme === 'dark'
                              ? 'bg-gray-700 hover:bg-gray-600 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          )}
                        >
                          <ChevronLeft className="w-5 h-5" />
                          Atras
                        </motion.button>
                      )}

                      {createStep < 4 ? (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setCreateStep(createStep + 1)}
                          disabled={
                            (createStep === 1 && !selectedProduct) ||
                            (createStep === 2 && !selectedWarehouse) ||
                            (createStep === 3 && (!priceMarketplace || !quantityListed))
                          }
                          className="flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Siguiente
                          <ArrowRight className="w-5 h-5" />
                        </motion.button>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleCreateListing}
                          disabled={creating}
                          className="flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
                        >
                          {creating ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Creando...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-5 h-5" />
                              Crear Publicacion
                            </>
                          )}
                        </motion.button>
                      )}
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Detail Modal */}
          <AnimatePresence>
            {selectedListing && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSelectedListing(null)}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                />

                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: "spring", duration: 0.3 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                >
                  <div
                    className={cn(
                      "w-full max-w-md rounded-2xl shadow-2xl border",
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-700'
                        : 'bg-white border-gray-200'
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className={cn(
                      "px-6 py-4 border-b flex items-center justify-between",
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <div>
                        <h3 className={cn(
                          "font-semibold",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {selectedListing.listingCode}
                        </h3>
                        <p className="text-xs text-gray-500">{selectedListing.product.name}</p>
                      </div>
                      <button
                        onClick={() => setSelectedListing(null)}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                        )}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-6 space-y-4">
                      <div className={cn(
                        'p-4 rounded-xl',
                        theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                      )}>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Precio</span>
                            <span className="font-bold text-emerald-600">{formatCurrency(selectedListing.priceMarketplace)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Cantidad</span>
                            <span className="font-medium text-gray-900 dark:text-white">{selectedListing.quantityAvailable} / {selectedListing.quantityListed}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Almacen</span>
                            <span className="text-gray-900 dark:text-white">{selectedListing.warehouse.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Creado</span>
                            <span className="text-gray-900 dark:text-white">{formatDate(selectedListing.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      {selectedListing.rejectionReason && (
                        <div className="p-4 rounded-xl bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                          <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">Motivo de rechazo:</p>
                          <p className="text-sm text-red-600 dark:text-red-300">{selectedListing.rejectionReason}</p>
                        </div>
                      )}

                      {/* Actions */}
                      {selectedListing.status === 'approved' && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleAction(selectedListing.id, 'pause')}
                          disabled={actionLoading}
                          className="w-full py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-medium flex items-center justify-center gap-2"
                        >
                          <Pause className="w-5 h-5" />
                          Pausar Publicacion
                        </motion.button>
                      )}

                      {selectedListing.status === 'inactive' && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleAction(selectedListing.id, 'resume')}
                          disabled={actionLoading}
                          className="w-full py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-medium flex items-center justify-center gap-2"
                        >
                          <Play className="w-5 h-5" />
                          Reactivar Publicacion
                        </motion.button>
                      )}

                      {['pending', 'approved', 'inactive'].includes(selectedListing.status) && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleAction(selectedListing.id, 'cancel')}
                          disabled={actionLoading}
                          className="w-full py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors font-medium"
                        >
                          Cancelar Publicacion
                        </motion.button>
                      )}
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
