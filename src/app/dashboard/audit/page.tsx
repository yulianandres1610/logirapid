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
  MapPin
} from 'lucide-react'

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
}

interface CountHistory {
  id: number
  countNumber: string
  warehouseName: string
  status: string
  totalProducts: number
  productsWithDifferences: number
  completedAt: string
}

export default function AuditDashboardPage() {
  const router = useRouter()
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

      // Fetch recent counts
      const countsResponse = await fetch('/api/audit/counts?status=completed&limit=5')
      const countsData = await countsResponse.json()

      if (countsData.success) {
        setRecentCounts(countsData.data.counts || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchWarehouses()
  }, [])

  const handleStartCount = (warehouseId: number) => {
    router.push(`/dashboard/audit/count?warehouseId=${warehouseId}`)
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
    <div className="space-y-6 lg:space-y-8 max-w-5xl mx-auto px-4">
      {/* Warehouses Grid */}
      {warehouses.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-8 text-center">
          <Warehouse className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">No hay almacenes disponibles</p>
          <p className="text-gray-500 text-sm mt-2">Contacta al administrador para configurar almacenes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5 justify-items-center">
          {warehouses.map((warehouse, index) => (
            <motion.div
              key={warehouse.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-gray-800 rounded-xl p-5 lg:p-6 border border-gray-700 hover:border-amber-500/50 transition-all group w-full max-w-sm"
            >
              {/* Warehouse Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    warehouse.isCentral ? 'bg-amber-500/20' : 'bg-gray-700'
                  }`}>
                    <Warehouse className={`w-6 h-6 ${
                      warehouse.isCentral ? 'text-amber-500' : 'text-gray-400'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{warehouse.name}</h3>
                    <p className="text-xs text-gray-500">{warehouse.code}</p>
                  </div>
                </div>
                {warehouse.isCentral && (
                  <span className="px-2 py-1 text-xs font-medium bg-amber-500/20 text-amber-400 rounded-full">
                    Central
                  </span>
                )}
              </div>

              {/* Location */}
              {(warehouse.city || warehouse.state) && (
                <div className="flex items-center text-gray-400 text-sm mb-4">
                  <MapPin className="w-4 h-4 mr-1" />
                  <span>{[warehouse.city, warehouse.state].filter(Boolean).join(', ')}</span>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <div className="flex items-center text-gray-400 text-xs mb-1">
                    <Package className="w-3 h-3 mr-1" />
                    Productos
                  </div>
                  <p className="text-lg font-semibold text-white">{warehouse.productsWithStock}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <div className="flex items-center text-gray-400 text-xs mb-1">
                    <Clock className="w-3 h-3 mr-1" />
                    Último conteo
                  </div>
                  <p className="text-xs text-white truncate">
                    {warehouse.lastCountDate ? formatDate(warehouse.lastCountDate) : 'Nunca'}
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleStartCount(warehouse.id)}
                className="w-full flex items-center justify-center space-x-2 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors group-hover:shadow-lg group-hover:shadow-amber-500/20"
              >
                <span>Iniciar Conteo</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Recent Counts */}
      {recentCounts.length > 0 && (
        <div className="mt-6 lg:mt-8">
          <div className="flex items-center space-x-2 mb-4">
            <History className="w-5 h-5 lg:w-6 lg:h-6 text-gray-400" />
            <h2 className="text-lg lg:text-xl font-semibold text-white">Conteos Recientes</h2>
          </div>

          {/* Mobile View - Cards */}
          <div className="lg:hidden bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="divide-y divide-gray-700">
              {recentCounts.map((count) => (
                <div
                  key={count.id}
                  className="flex items-center justify-between p-4 hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      count.productsWithDifferences > 0 ? 'bg-red-500/20' : 'bg-green-500/20'
                    }`}>
                      {count.productsWithDifferences > 0 ? (
                        <AlertCircle className="w-5 h-5 text-red-400" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white">{count.countNumber}</p>
                      <p className="text-sm text-gray-400">{count.warehouseName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white">{count.totalProducts} productos</p>
                    <p className="text-xs text-gray-500">{formatDate(count.completedAt)}</p>
                  </div>
                </div>
              ))}
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
                  <th className="text-center px-6 py-4 text-sm font-semibold text-gray-400 uppercase tracking-wider">Productos</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-gray-400 uppercase tracking-wider">Diferencias</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-400 uppercase tracking-wider">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {recentCounts.map((count) => (
                  <tr
                    key={count.id}
                    className="hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        count.productsWithDifferences > 0 ? 'bg-red-500/20' : 'bg-green-500/20'
                      }`}>
                        {count.productsWithDifferences > 0 ? (
                          <AlertCircle className="w-5 h-5 text-red-400" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-white">{count.countNumber}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-300">{count.warehouseName}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-700 text-white font-medium">
                        {count.totalProducts}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full font-medium ${
                        count.productsWithDifferences > 0
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-green-500/20 text-green-400'
                      }`}>
                        {count.productsWithDifferences}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-gray-400">{formatDate(count.completedAt)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
