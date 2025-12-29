'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Store,
  Search,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Package,
  DollarSign,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
  Building,
  MapPin,
  Eye,
  Check,
  Ban
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
  description?: string
  costPrice: number
  sellingPrice: number
}

interface Warehouse {
  id: number
  name: string
  code: string
}

interface Company {
  id: number
  name: string
  province: string
  municipality?: string
}

interface PriceAlert {
  id: number
  alertType: string
  severity: string
  message: string
  priceDifference: number
}

interface MarketComparison {
  averagePrice: number | null
  competitorCount: number
}

interface PendingListing {
  id: number
  listingCode: string
  priceMarketplace: number
  originalProductPrice: number
  currency: string
  quantityListed: number
  submittedAt: string
  createdAt: string
  product: Product
  warehouse: Warehouse
  company: Company
  createdByName?: string
  alerts: PriceAlert[]
  marketComparison: MarketComparison
}

interface AllListing {
  id: number
  listingCode: string
  priceMarketplace: number
  originalProductPrice: number
  currency: string
  quantityListed: number
  quantitySold: number
  quantityAvailable: number
  status: string
  isFeatured: boolean
  submittedAt: string
  approvedAt?: string
  rejectedAt?: string
  rejectionReason?: string
  rejectionCategory?: string
  createdAt: string
  updatedAt: string
  product: Product
  warehouse: Warehouse
  company: Company
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
  totalMarkets: number
  totalListedValue: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface ProvinceStats {
  province: string
  count: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pendiente', color: 'amber', icon: Clock },
  approved: { label: 'Aprobado', color: 'emerald', icon: CheckCircle },
  rejected: { label: 'Rechazado', color: 'red', icon: XCircle },
  inactive: { label: 'Inactivo', color: 'gray', icon: Ban },
  suspended: { label: 'Suspendido', color: 'red', icon: XCircle }
}

const REJECTION_CATEGORIES = [
  { id: 'price_issue', label: 'Problema de precio' },
  { id: 'image_quality', label: 'Calidad de imagen' },
  { id: 'incomplete_info', label: 'Informacion incompleta' },
  { id: 'policy_violation', label: 'Violacion de politicas' },
  { id: 'duplicate', label: 'Producto duplicado' },
  { id: 'other', label: 'Otro' }
]

export default function MarketplaceApprovalsPage() {
  const { theme } = useTheme()
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending')
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Pending listings state
  const [pendingListings, setPendingListings] = useState<PendingListing[]>([])
  const [pendingStats, setPendingStats] = useState<{ total: number; byProvince: ProvinceStats[] }>({ total: 0, byProvince: [] })
  const [pendingPagination, setPendingPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [pendingProvinceFilter, setPendingProvinceFilter] = useState('')

  // All listings state
  const [allListings, setAllListings] = useState<AllListing[]>([])
  const [allStats, setAllStats] = useState<Stats>({
    total: 0, pending: 0, approved: 0, rejected: 0,
    inactive: 0, suspended: 0, totalMarkets: 0, totalListedValue: 0
  })
  const [allPagination, setAllPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [allStatusFilter, setAllStatusFilter] = useState('')
  const [allProvinceFilter, setAllProvinceFilter] = useState('')
  const [allSearch, setAllSearch] = useState('')
  const [filterMarkets, setFilterMarkets] = useState<Array<{ id: number; name: string; province: string }>>([])
  const [filterProvinces, setFilterProvinces] = useState<string[]>([])

  // Detail/Action modals
  const [selectedListing, setSelectedListing] = useState<PendingListing | AllListing | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectCategory, setRejectCategory] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Fetch pending listings
  useEffect(() => {
    if (activeTab === 'pending') {
      fetchPendingListings()
    }
  }, [activeTab, pendingPagination.page, pendingProvinceFilter])

  // Fetch all listings
  useEffect(() => {
    if (activeTab === 'all') {
      fetchAllListings()
    }
  }, [activeTab, allPagination.page, allStatusFilter, allProvinceFilter])

  // Search debounce for all listings
  useEffect(() => {
    if (activeTab === 'all') {
      const debounce = setTimeout(() => {
        if (allPagination.page === 1) {
          fetchAllListings()
        } else {
          setAllPagination(p => ({ ...p, page: 1 }))
        }
      }, 300)
      return () => clearTimeout(debounce)
    }
  }, [allSearch])

  const fetchPendingListings = async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const params = new URLSearchParams({
        page: pendingPagination.page.toString(),
        limit: pendingPagination.limit.toString()
      })
      if (pendingProvinceFilter) params.set('province', pendingProvinceFilter)

      const response = await fetch(`/api/admin/marketplace/pending?${params}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setPendingListings(data.data.listings)
          setPendingStats(data.data.stats)
          setPendingPagination(data.data.pagination)
        }
      }
    } catch (error) {
      console.error('Error fetching pending listings:', error)
    } finally {
      if (!silent) setLoading(false)
      else setIsRefreshing(false)
    }
  }

  const fetchAllListings = async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const params = new URLSearchParams({
        page: allPagination.page.toString(),
        limit: allPagination.limit.toString()
      })
      if (allStatusFilter) params.set('status', allStatusFilter)
      if (allProvinceFilter) params.set('province', allProvinceFilter)
      if (allSearch) params.set('search', allSearch)

      const response = await fetch(`/api/admin/marketplace/products?${params}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setAllListings(data.data.listings)
          setAllStats(data.data.stats)
          setAllPagination(data.data.pagination)
          setFilterMarkets(data.data.filters.markets)
          setFilterProvinces(data.data.filters.provinces)
        }
      }
    } catch (error) {
      console.error('Error fetching all listings:', error)
    } finally {
      if (!silent) setLoading(false)
      else setIsRefreshing(false)
    }
  }

  const handleManualRefresh = () => {
    if (activeTab === 'pending') {
      fetchPendingListings(true)
    } else {
      fetchAllListings(true)
    }
  }

  const handleApprove = async (listingId: number) => {
    setActionLoading(true)
    try {
      const response = await fetch(`/api/admin/marketplace/${listingId}/approve`, {
        method: 'PUT'
      })

      const data = await response.json()
      if (data.success) {
        fetchPendingListings()
        setSelectedListing(null)
      } else {
        alert(data.error || 'Error al aprobar')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al aprobar publicacion')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!selectedListing || !rejectReason) return

    setActionLoading(true)
    try {
      const response = await fetch(`/api/admin/marketplace/${selectedListing.id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rejectReason,
          category: rejectCategory || null
        })
      })

      const data = await response.json()
      if (data.success) {
        fetchPendingListings()
        setShowRejectModal(false)
        setSelectedListing(null)
        setRejectReason('')
        setRejectCategory('')
      } else {
        alert(data.error || 'Error al rechazar')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al rechazar publicacion')
    } finally {
      setActionLoading(false)
    }
  }

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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100 dark:bg-red-900/30'
      case 'high': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30'
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30'
      default: return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30'
    }
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
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className={cn(
                  'text-2xl font-bold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Gestion de Marketplace
                </h1>
                <p className="text-gray-500 mt-1">Aprueba o rechaza las publicaciones de los mercados</p>
              </div>

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
                Actualizar
              </motion.button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  'relative overflow-hidden rounded-2xl border shadow-xl p-6',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-600"></div>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-3 rounded-xl',
                    theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100'
                  )}>
                    <Clock className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Pendientes</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{pendingStats.total}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'relative overflow-hidden rounded-2xl border shadow-xl p-6',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-600"></div>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-3 rounded-xl',
                    theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-100'
                  )}>
                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Aprobados</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{allStats.approved}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  'relative overflow-hidden rounded-2xl border shadow-xl p-6',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-3 rounded-xl',
                    theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                  )}>
                    <Building className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Mercados</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{allStats.totalMarkets}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className={cn(
                  'relative overflow-hidden rounded-2xl border shadow-xl p-6',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-purple-600"></div>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-3 rounded-xl',
                    theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                  )}>
                    <DollarSign className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Valor Total</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(allStats.totalListedValue)}</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Tabs */}
            <div className={cn(
              'p-1 rounded-xl inline-flex',
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
            )}>
              <button
                onClick={() => setActiveTab('pending')}
                className={cn(
                  'px-6 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2',
                  activeTab === 'pending'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                )}
              >
                <Clock className="w-4 h-4" />
                Solicitudes Pendientes
                {pendingStats.total > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white">
                    {pendingStats.total}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={cn(
                  'px-6 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2',
                  activeTab === 'all'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                )}
              >
                <Store className="w-4 h-4" />
                Todos los Productos
              </button>
            </div>

            {/* Pending Tab Content */}
            {activeTab === 'pending' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                {/* Province Filter */}
                {pendingStats.byProvince.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setPendingProvinceFilter('')}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                        !pendingProvinceFilter
                          ? 'bg-blue-500 text-white'
                          : theme === 'dark'
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      Todas ({pendingStats.total})
                    </button>
                    {pendingStats.byProvince.map(({ province, count }) => (
                      <button
                        key={province}
                        onClick={() => setPendingProvinceFilter(province)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                          pendingProvinceFilter === province
                            ? 'bg-blue-500 text-white'
                            : theme === 'dark'
                              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        )}
                      >
                        {province} ({count})
                      </button>
                    ))}
                  </div>
                )}

                {/* Pending Listings */}
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  </div>
                ) : pendingListings.length === 0 ? (
                  <div className={cn(
                    'rounded-2xl border p-12 text-center',
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}>
                    <CheckCircle className="w-16 h-16 mx-auto mb-4 text-emerald-500" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      No hay solicitudes pendientes
                    </h3>
                    <p className="text-gray-500">Todas las publicaciones han sido revisadas</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {pendingListings.map((listing, index) => (
                      <motion.div
                        key={listing.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={cn(
                          'rounded-2xl border overflow-hidden',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700'
                            : 'bg-white border-gray-200'
                        )}
                      >
                        {/* Alert Banner */}
                        {listing.alerts && listing.alerts.length > 0 && (
                          <div className={cn(
                            'px-4 py-2 flex items-center gap-2',
                            getAlertSeverityColor(listing.alerts[0].severity)
                          )}>
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-sm font-medium">{listing.alerts[0].message}</span>
                          </div>
                        )}

                        <div className="p-6">
                          <div className="flex items-start gap-4">
                            {/* Product Image */}
                            {listing.product.imageUrl ? (
                              <img
                                src={listing.product.imageUrl}
                                alt={listing.product.name}
                                className="w-20 h-20 rounded-xl object-cover"
                              />
                            ) : (
                              <div className={cn(
                                'w-20 h-20 rounded-xl flex items-center justify-center',
                                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                              )}>
                                <Package className="w-8 h-8 text-gray-400" />
                              </div>
                            )}

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                                    {listing.product.name}
                                  </h3>
                                  <p className="text-sm text-gray-500">
                                    SKU: {listing.product.sku} | Codigo: {listing.listingCode}
                                  </p>
                                </div>
                                <span className="text-2xl font-bold text-emerald-600">
                                  {formatCurrency(listing.priceMarketplace)}
                                </span>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                                <div className="flex items-center gap-1 text-gray-500">
                                  <Building className="w-4 h-4" />
                                  <span>{listing.company.name}</span>
                                </div>
                                <div className="flex items-center gap-1 text-gray-500">
                                  <MapPin className="w-4 h-4" />
                                  <span>{listing.company.province}</span>
                                </div>
                                <div className="flex items-center gap-1 text-gray-500">
                                  <Package className="w-4 h-4" />
                                  <span>{listing.quantityListed} unidades</span>
                                </div>
                                <div className="flex items-center gap-1 text-gray-500">
                                  <Clock className="w-4 h-4" />
                                  <span>{formatDate(listing.submittedAt)}</span>
                                </div>
                              </div>

                              {/* Price Comparison */}
                              <div className="mt-3 flex items-center gap-4">
                                <span className="text-sm text-gray-500">
                                  Costo: <span className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(listing.product.costPrice)}</span>
                                </span>
                                <span className="text-sm text-gray-500">
                                  Precio base: <span className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(listing.product.sellingPrice)}</span>
                                </span>
                                {listing.marketComparison.averagePrice && (
                                  <span className="text-sm text-gray-500">
                                    Promedio mercado: <span className="font-medium text-blue-600">{formatCurrency(listing.marketComparison.averagePrice)}</span>
                                    <span className="text-xs ml-1">({listing.marketComparison.competitorCount} competidores)</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                setSelectedListing(listing)
                                setShowRejectModal(true)
                              }}
                              className="px-4 py-2 rounded-xl font-medium text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all flex items-center gap-2"
                            >
                              <XCircle className="w-4 h-4" />
                              Rechazar
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleApprove(listing.id)}
                              disabled={actionLoading}
                              className="px-4 py-2 rounded-xl font-medium text-white bg-emerald-500 hover:bg-emerald-600 transition-all flex items-center gap-2"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Aprobar
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Pagination for Pending */}
                {pendingPagination.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-4">
                    <button
                      onClick={() => setPendingPagination(p => ({ ...p, page: p.page - 1 }))}
                      disabled={pendingPagination.page === 1}
                      className={cn(
                        'p-2 rounded-lg disabled:opacity-50',
                        theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                      )}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-sm text-gray-500">
                      {pendingPagination.page} / {pendingPagination.totalPages}
                    </span>
                    <button
                      onClick={() => setPendingPagination(p => ({ ...p, page: p.page + 1 }))}
                      disabled={pendingPagination.page === pendingPagination.totalPages}
                      className={cn(
                        'p-2 rounded-lg disabled:opacity-50',
                        theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                      )}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* All Products Tab Content */}
            {activeTab === 'all' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                {/* Filters */}
                <div className={cn(
                  'p-4 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar por codigo, producto o SKU..."
                        value={allSearch}
                        onChange={(e) => setAllSearch(e.target.value)}
                        className={cn(
                          'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2',
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white focus:ring-blue-500/20'
                            : 'bg-gray-50 border-gray-200 text-gray-900 focus:ring-blue-500/20'
                        )}
                      />
                    </div>

                    <select
                      value={allStatusFilter}
                      onChange={(e) => setAllStatusFilter(e.target.value)}
                      className={cn(
                        'px-4 py-2.5 rounded-xl border focus:outline-none',
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-gray-50 border-gray-200 text-gray-900'
                      )}
                    >
                      <option value="">Todos los estados</option>
                      <option value="pending">Pendiente</option>
                      <option value="approved">Aprobado</option>
                      <option value="rejected">Rechazado</option>
                      <option value="inactive">Inactivo</option>
                    </select>

                    <select
                      value={allProvinceFilter}
                      onChange={(e) => setAllProvinceFilter(e.target.value)}
                      className={cn(
                        'px-4 py-2.5 rounded-xl border focus:outline-none',
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-gray-50 border-gray-200 text-gray-900'
                      )}
                    >
                      <option value="">Todas las provincias</option>
                      {filterProvinces.map(province => (
                        <option key={province} value={province}>{province}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Table */}
                <div className={cn(
                  'rounded-2xl border overflow-hidden',
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={cn(
                          'border-b',
                          theme === 'dark' ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
                        )}>
                          <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Codigo</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Producto</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Mercado</th>
                          <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                          <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Precio</th>
                          <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {loading ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center">
                              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
                            </td>
                          </tr>
                        ) : allListings.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center">
                              <Store className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                              <p className="text-gray-500">No hay publicaciones</p>
                            </td>
                          </tr>
                        ) : (
                          allListings.map((listing) => {
                            const statusConfig = STATUS_CONFIG[listing.status] || STATUS_CONFIG.pending
                            const StatusIcon = statusConfig.icon

                            return (
                              <tr
                                key={listing.id}
                                className={cn(
                                  'transition-colors',
                                  theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                                )}
                              >
                                <td className="py-3 px-4">
                                  <span className="font-mono text-sm">{listing.listingCode}</span>
                                </td>
                                <td className="py-3 px-4">
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
                                      <p className="font-medium text-gray-900 dark:text-white">{listing.product.name}</p>
                                      <p className="text-xs text-gray-500">{listing.product.sku}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div>
                                    <p className="font-medium text-gray-900 dark:text-white">{listing.company.name}</p>
                                    <p className="text-xs text-gray-500">{listing.company.province}</p>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className="font-medium">{listing.quantityAvailable}</span>
                                  <span className="text-gray-500"> / {listing.quantityListed}</span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <span className="font-bold text-emerald-600">
                                    {formatCurrency(listing.priceMarketplace)}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className={cn(
                                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
                                    statusConfig.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                                    statusConfig.color === 'emerald' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                                    statusConfig.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                                    statusConfig.color === 'gray' && 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                                  )}>
                                    <StatusIcon className="w-3.5 h-3.5" />
                                    {statusConfig.label}
                                  </span>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {allPagination.totalPages > 1 && (
                    <div className={cn(
                      'flex items-center justify-between px-4 py-3 border-t',
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <p className="text-sm text-gray-500">
                        {((allPagination.page - 1) * allPagination.limit) + 1} - {Math.min(allPagination.page * allPagination.limit, allPagination.total)} de {allPagination.total}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setAllPagination(p => ({ ...p, page: p.page - 1 }))}
                          disabled={allPagination.page === 1}
                          className={cn(
                            'p-2 rounded-lg disabled:opacity-50',
                            theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                          )}
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-sm">{allPagination.page} / {allPagination.totalPages}</span>
                        <button
                          onClick={() => setAllPagination(p => ({ ...p, page: p.page + 1 }))}
                          disabled={allPagination.page === allPagination.totalPages}
                          className={cn(
                            'p-2 rounded-lg disabled:opacity-50',
                            theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                          )}
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Reject Modal */}
          <AnimatePresence>
            {showRejectModal && selectedListing && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => {
                    setShowRejectModal(false)
                    setSelectedListing(null)
                    setRejectReason('')
                    setRejectCategory('')
                  }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                />

                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                >
                  <div
                    className={cn(
                      'w-full max-w-md rounded-2xl shadow-2xl border',
                      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className={cn(
                      'px-6 py-4 border-b flex items-center justify-between',
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                          <XCircle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">Rechazar Publicacion</h3>
                          <p className="text-xs text-gray-500">{selectedListing.listingCode}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setShowRejectModal(false)
                          setSelectedListing(null)
                          setRejectReason('')
                          setRejectCategory('')
                        }}
                        className={cn(
                          'p-2 rounded-lg',
                          theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                        )}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Categoria del rechazo
                        </label>
                        <select
                          value={rejectCategory}
                          onChange={(e) => setRejectCategory(e.target.value)}
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2',
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600 text-white focus:ring-red-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:ring-red-500/20'
                          )}
                        >
                          <option value="">Seleccionar categoria...</option>
                          {REJECTION_CATEGORIES.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Motivo del rechazo *
                        </label>
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Explica el motivo del rechazo..."
                          rows={4}
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 resize-none',
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600 text-white focus:ring-red-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:ring-red-500/20'
                          )}
                        />
                      </div>
                    </div>

                    <div className={cn(
                      'flex gap-3 p-6 pt-4 border-t',
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setShowRejectModal(false)
                          setSelectedListing(null)
                          setRejectReason('')
                          setRejectCategory('')
                        }}
                        className={cn(
                          'flex-1 py-3 rounded-xl font-medium',
                          theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        )}
                      >
                        Cancelar
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleReject}
                        disabled={actionLoading || !rejectReason}
                        className="flex-1 py-3 rounded-xl font-medium bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {actionLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <XCircle className="w-5 h-5" />
                            Rechazar
                          </>
                        )}
                      </motion.button>
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
