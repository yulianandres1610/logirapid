'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Warehouse,
  Package,
  Clock,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  History,
  MapPin,
  PlayCircle,
  Box,
  Briefcase
} from 'lucide-react'

type AuditType = 'products' | 'fixed_assets'

interface WarehouseData {
  id: number
  code: string
  name: string
  address: string
  city: string
  state: string
  isCentral: boolean
  productsWithStock: number
  totalStock: number
  lastCountDate: string | null
  lastCountNumber: string | null
  fixedAssetsCount: number
  fixedAssetsValue: number
  lastFixedAssetCountDate: string | null
  lastFixedAssetCountNumber: string | null
}

interface CountHistory {
  id: number
  countNumber: string
  warehouseId: number
  warehouseName: string
  status: 'in_progress' | 'completed' | 'applied'
  auditType: AuditType
  // Product fields
  totalProducts: number
  productsWithDifferences: number
  // Fixed asset fields
  totalAssets: number
  assetsFound: number
  assetsMissing: number
  assetsSurplus: number
  totalValueAtRisk: number
  // Common
  startedAt: string
  completedAt: string | null
}

export default function AuditDashboardPage() {
  const router = useRouter()
  const [auditType, setAuditType] = useState<AuditType>('products')
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([])
  const [recentCounts, setRecentCounts] = useState<CountHistory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWarehouses = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/audit/warehouses')
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al cargar almacenes')
      }

      setWarehouses(data.data.warehouses)

      // Fetch recent counts for current audit type
      const countsResponse = await fetch(`/api/audit/counts?limit=10&auditType=${auditType}`)
      const countsData = await countsResponse.json()

      if (countsData.success) {
        // Sort: in_progress first, then by date
        const counts = countsData.data.counts || []
        counts.sort((a: CountHistory, b: CountHistory) => {
          if (a.status === 'in_progress' && b.status !== 'in_progress') return -1
          if (a.status !== 'in_progress' && b.status === 'in_progress') return 1
          return new Date(b.startedAt || b.completedAt || 0).getTime() - new Date(a.startedAt || a.completedAt || 0).getTime()
        })
        setRecentCounts(counts.slice(0, 8))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchWarehouses()
  }, [auditType])

  const handleStartCount = (warehouseId: number) => {
    // Always start a new count (clear old data)
    const countPage = auditType === 'fixed_assets' ? 'count-assets' : 'count'
    router.push(`/dashboard/audit/${countPage}?warehouseId=${warehouseId}&new=true`)
  }

  const handleContinueCount = (warehouseId: number) => {
    // Continue existing in-progress count
    const countPage = auditType === 'fixed_assets' ? 'count-assets' : 'count'
    router.push(`/dashboard/audit/${countPage}?warehouseId=${warehouseId}`)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca'
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Cargando almacenes...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <AlertCircle className="w-16 h-16 text-red-500" />
        <p className="text-red-400 text-lg">{error}</p>
        <button
          onClick={fetchWarehouses}
          className="flex items-center space-x-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Reintentar</span>
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      {/* Audit Type Toggle */}
      <div className="px-4 pt-4 sm:pt-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center sm:justify-start gap-2 sm:gap-3 p-1 bg-gray-800 rounded-xl w-full sm:w-auto sm:inline-flex">
            <button
              onClick={() => setAuditType('products')}
              className={`flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 rounded-lg font-medium transition-all flex-1 sm:flex-none ${
                auditType === 'products'
                  ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Package className="w-5 h-5" />
              <span>Productos</span>
            </button>
            <button
              onClick={() => setAuditType('fixed_assets')}
              className={`flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 rounded-lg font-medium transition-all flex-1 sm:flex-none ${
                auditType === 'fixed_assets'
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Briefcase className="w-5 h-5" />
              <span>Activos Fijos</span>
            </button>
          </div>
        </div>
      </div>

      {/* Warehouses Grid */}
      <div className="flex-1 flex flex-col justify-center px-4 py-4 sm:py-6 lg:py-4 lg:justify-start lg:pt-6">
        {warehouses.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-8 text-center max-w-md mx-auto w-full">
            <Warehouse className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No hay almacenes disponibles</p>
            <p className="text-gray-500 text-sm mt-2">Contacta al administrador para configurar almacenes</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 max-w-5xl mx-auto w-full">
            {warehouses.map((warehouse, index) => (
              <motion.div
                key={warehouse.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`bg-gray-800 rounded-2xl p-4 sm:p-5 lg:p-6 border border-gray-700 transition-all group w-full ${
                  auditType === 'products'
                    ? 'hover:border-amber-500/50'
                    : 'hover:border-blue-500/50'
                }`}
              >
                {/* Warehouse Header */}
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      warehouse.isCentral ? 'bg-amber-500/20' : 'bg-gray-700'
                    }`}>
                      <Warehouse className={`w-5 h-5 sm:w-6 sm:h-6 ${
                        warehouse.isCentral ? 'text-amber-500' : 'text-gray-400'
                      }`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white text-base sm:text-lg truncate">{warehouse.name}</h3>
                      <p className="text-xs text-gray-500">{warehouse.code}</p>
                    </div>
                  </div>
                  {warehouse.isCentral && (
                    <span className="px-2 py-1 text-xs font-medium bg-amber-500/20 text-amber-400 rounded-full flex-shrink-0 ml-2">
                      Central
                    </span>
                  )}
                </div>

                {/* Location */}
                {(warehouse.city || warehouse.state) && (
                  <div className="flex items-center text-gray-400 text-sm mb-3 sm:mb-4">
                    <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0" />
                    <span className="truncate">{[warehouse.city, warehouse.state].filter(Boolean).join(', ')}</span>
                  </div>
                )}

                {/* Stats based on audit type */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
                  {auditType === 'products' ? (
                    <>
                      <div className="bg-gray-700/50 rounded-xl p-3">
                        <div className="flex items-center text-gray-400 text-xs mb-1">
                          <Package className="w-3 h-3 mr-1" />
                          Productos
                        </div>
                        <p className="text-xl sm:text-lg font-bold text-white">{warehouse.productsWithStock}</p>
                      </div>
                      <div className="bg-gray-700/50 rounded-xl p-3">
                        <div className="flex items-center text-gray-400 text-xs mb-1">
                          <Clock className="w-3 h-3 mr-1" />
                          Último conteo
                        </div>
                        <p className="text-xs text-white truncate">
                          {warehouse.lastCountDate ? formatDate(warehouse.lastCountDate) : 'Nunca'}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-gray-700/50 rounded-xl p-3">
                        <div className="flex items-center text-gray-400 text-xs mb-1">
                          <Briefcase className="w-3 h-3 mr-1" />
                          Activos
                        </div>
                        <p className="text-xl sm:text-lg font-bold text-white">{warehouse.fixedAssetsCount}</p>
                      </div>
                      <div className="bg-gray-700/50 rounded-xl p-3">
                        <div className="flex items-center text-gray-400 text-xs mb-1">
                          <Clock className="w-3 h-3 mr-1" />
                          Último conteo
                        </div>
                        <p className="text-xs text-white truncate">
                          {warehouse.lastFixedAssetCountDate ? formatDate(warehouse.lastFixedAssetCountDate) : 'Nunca'}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Action Button */}
                <button
                  onClick={() => handleStartCount(warehouse.id)}
                  className={`w-full flex items-center justify-center space-x-2 py-3.5 sm:py-3 text-white rounded-xl font-semibold transition-colors shadow-lg touch-manipulation active:scale-[0.98] ${
                    auditType === 'products'
                      ? 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 shadow-amber-500/20'
                      : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700 shadow-blue-500/20'
                  }`}
                >
                  <span>Iniciar Conteo</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </motion.div>
            ))}
          </div>
        )}

      </div>

      {/* Recent Counts */}
      {recentCounts.length > 0 && (
        <div className="px-4 pb-6 sm:pb-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center space-x-2 mb-4">
              <History className="w-5 h-5 lg:w-6 lg:h-6 text-gray-400" />
              <h2 className="text-lg lg:text-xl font-semibold text-white">
                Conteos Recientes {auditType === 'fixed_assets' ? 'de Activos' : 'de Productos'}
              </h2>
            </div>

            {/* Mobile View - Cards */}
            <div className="lg:hidden bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
              <div className="divide-y divide-gray-700">
                {recentCounts.map((count) => {
                  const isFixedAssets = count.auditType === 'fixed_assets'
                  const hasIssues = isFixedAssets ? count.assetsMissing > 0 : count.productsWithDifferences > 0

                  return (
                    <div
                      key={count.id}
                      className={`p-4 hover:bg-gray-700/50 transition-colors ${
                        count.status === 'in_progress'
                          ? isFixedAssets
                            ? 'bg-blue-900/10 border-l-4 border-blue-500'
                            : 'bg-amber-900/10 border-l-4 border-amber-500'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            count.status === 'in_progress'
                              ? isFixedAssets ? 'bg-blue-500/20' : 'bg-amber-500/20'
                              : hasIssues
                                ? 'bg-red-500/20'
                                : 'bg-green-500/20'
                          }`}>
                            {count.status === 'in_progress' ? (
                              <Clock className={`w-5 h-5 ${isFixedAssets ? 'text-blue-400' : 'text-amber-400'}`} />
                            ) : hasIssues ? (
                              <AlertCircle className="w-5 h-5 text-red-400" />
                            ) : (
                              <CheckCircle2 className="w-5 h-5 text-green-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-white truncate">{count.countNumber}</p>
                              {count.status === 'in_progress' && (
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                  isFixedAssets
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'bg-amber-500/20 text-amber-400'
                                }`}>
                                  En progreso
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-400 truncate">{count.warehouseName}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          {isFixedAssets ? (
                            <>
                              <p className="text-sm text-white">{count.totalAssets} activos</p>
                              {count.assetsMissing > 0 && (
                                <p className="text-xs text-red-400">{count.assetsMissing} faltantes</p>
                              )}
                            </>
                          ) : (
                            <>
                              <p className="text-sm text-white">{count.totalProducts} prod.</p>
                              <p className="text-xs text-gray-500">{formatDate(count.completedAt || count.startedAt)}</p>
                            </>
                          )}
                        </div>
                      </div>
                      {count.status === 'in_progress' && (
                        <button
                          onClick={() => handleContinueCount(count.warehouseId)}
                          className={`mt-3 w-full flex items-center justify-center space-x-2 py-2.5 text-white rounded-xl font-semibold transition-colors shadow-lg touch-manipulation active:scale-[0.98] ${
                            isFixedAssets
                              ? 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700 shadow-blue-500/20'
                              : 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 shadow-amber-500/20'
                          }`}
                        >
                          <PlayCircle className="w-5 h-5" />
                          <span>Continuar Conteo</span>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Desktop View - Table */}
            <div className="hidden lg:block bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400 uppercase tracking-wider">Estado</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400 uppercase tracking-wider">Conteo</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400 uppercase tracking-wider">Almacén</th>
                    <th className="text-center px-6 py-4 text-sm font-semibold text-gray-400 uppercase tracking-wider">
                      {auditType === 'fixed_assets' ? 'Activos' : 'Productos'}
                    </th>
                    <th className="text-center px-6 py-4 text-sm font-semibold text-gray-400 uppercase tracking-wider">
                      {auditType === 'fixed_assets' ? 'Faltantes' : 'Diferencias'}
                    </th>
                    <th className="text-right px-6 py-4 text-sm font-semibold text-gray-400 uppercase tracking-wider">Fecha</th>
                    <th className="text-center px-6 py-4 text-sm font-semibold text-gray-400 uppercase tracking-wider">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {recentCounts.map((count) => {
                    const isFixedAssets = count.auditType === 'fixed_assets'
                    const hasIssues = isFixedAssets ? count.assetsMissing > 0 : count.productsWithDifferences > 0

                    return (
                      <tr
                        key={count.id}
                        className={`hover:bg-gray-700/30 transition-colors ${
                          count.status === 'in_progress'
                            ? isFixedAssets ? 'bg-blue-900/10' : 'bg-amber-900/10'
                            : ''
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            count.status === 'in_progress'
                              ? isFixedAssets ? 'bg-blue-500/20' : 'bg-amber-500/20'
                              : hasIssues
                                ? 'bg-red-500/20'
                                : 'bg-green-500/20'
                          }`}>
                            {count.status === 'in_progress' ? (
                              <Clock className={`w-5 h-5 ${isFixedAssets ? 'text-blue-400' : 'text-amber-400'}`} />
                            ) : hasIssues ? (
                              <AlertCircle className="w-5 h-5 text-red-400" />
                            ) : (
                              <CheckCircle2 className="w-5 h-5 text-green-400" />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white">{count.countNumber}</p>
                            {count.status === 'in_progress' && (
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                isFixedAssets
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : 'bg-amber-500/20 text-amber-400'
                              }`}>
                                En progreso
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-gray-300">{count.warehouseName}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-700 text-white font-medium">
                            {isFixedAssets ? count.totalAssets : count.totalProducts}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full font-medium ${
                            hasIssues
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-green-500/20 text-green-400'
                          }`}>
                            {isFixedAssets ? count.assetsMissing : count.productsWithDifferences}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-gray-400">{formatDate(count.completedAt || count.startedAt)}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {count.status === 'in_progress' && (
                            <button
                              onClick={() => handleContinueCount(count.warehouseId)}
                              className={`inline-flex items-center space-x-2 px-4 py-2 text-white rounded-lg font-medium transition-colors ${
                                isFixedAssets
                                  ? 'bg-blue-500 hover:bg-blue-600'
                                  : 'bg-amber-500 hover:bg-amber-600'
                              }`}
                            >
                              <PlayCircle className="w-4 h-4" />
                              <span>Continuar</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
