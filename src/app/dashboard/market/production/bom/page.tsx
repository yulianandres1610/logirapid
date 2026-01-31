'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  BookOpen,
  Plus,
  Search,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  Package,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle,
  XCircle,
  DollarSign,
  Boxes,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface BOMLine {
  id: number
  productId: number
  productName: string
  productSku: string
  quantityRequired: number
  unit: string
  isPrimary: boolean
  lineCost: number
}

interface BOM {
  id: number
  bomCode: string
  bomName: string
  productId: number
  productName: string
  productSku: string
  productImage: string | null
  outputQuantity: number
  outputUnit: string
  expectedWastePercent: number
  isActive: boolean
  linesCount: number
  totalMaterialCost: number
  unitCost: number
  createdBy: string
  createdAt: string
  lines: BOMLine[]
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function BOMListPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const [boms, setBoms] = useState<BOM[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [search, setSearch] = useState('')
  const [showActiveOnly, setShowActiveOnly] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [expandedBom, setExpandedBom] = useState<number | null>(null)
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null)

  const fetchBOMs = useCallback(async (page = 1, searchTerm = '', isActive?: boolean) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      })
      if (searchTerm) params.append('search', searchTerm)
      if (isActive !== undefined) params.append('isActive', isActive.toString())

      const response = await fetch(`/api/market/bom?${params}`)
      const data = await response.json()

      if (data.success) {
        setBoms(data.data.boms || [])
        setPagination(data.data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error('Error fetching BOMs:', error)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchBOMs(1, search, showActiveOnly ? true : undefined)
  }, [showActiveOnly, fetchBOMs])

  const handleSearch = () => {
    fetchBOMs(1, search, showActiveOnly ? true : undefined)
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchBOMs(pagination.page, search, showActiveOnly ? true : undefined)
  }

  const handleDelete = async (bomId: number) => {
    if (!confirm('¿Está seguro de desactivar esta receta?')) return

    try {
      setDeleteLoading(bomId)
      const response = await fetch(`/api/market/bom/${bomId}`, {
        method: 'DELETE'
      })
      const data = await response.json()

      if (data.success) {
        fetchBOMs(pagination.page, search, showActiveOnly ? true : undefined)
      } else {
        alert(data.error || 'Error al desactivar receta')
      }
    } catch (error) {
      console.error('Error deleting BOM:', error)
      alert('Error al desactivar receta')
    } finally {
      setDeleteLoading(null)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  return (
    <ProtectedRoute requiredRole={['SUPER_ADMIN', 'ADMIN', 'MARKET_ADMIN', 'MARKET_MANAGER', 'MARKET_COMERCIAL']}>
      <DashboardLayout>
        <div className={cn(
          "min-h-screen p-6",
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
        )}>
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Link
                  href="/dashboard/market/production"
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                  )}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <h1 className={cn(
                  "text-2xl font-bold flex items-center gap-2",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  <BookOpen className="w-7 h-7 text-purple-500" />
                  Recetas de Producción (BOM)
                </h1>
              </div>
              <p className={cn(
                "text-sm",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Define las fórmulas y materiales para fabricar tus productos
              </p>
            </div>

            <Link
              href="/dashboard/market/production/bom/create"
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
                "bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
              )}
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Receta</span>
            </Link>
          </div>

          {/* Search and Filters */}
          <div className={cn(
            "p-4 rounded-xl mb-6",
            theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm'
          )}>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className={cn(
                  "absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                )} />
                <input
                  type="text"
                  placeholder="Buscar por nombre, código o producto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className={cn(
                    "w-full pl-10 pr-4 py-2 rounded-lg border transition-all",
                    theme === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-purple-500'
                      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-purple-500'
                  )}
                />
              </div>

              <label className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer",
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
              )}>
                <input
                  type="checkbox"
                  checked={showActiveOnly}
                  onChange={(e) => setShowActiveOnly(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className={cn(
                  "text-sm",
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                )}>
                  Solo activas
                </span>
              </label>

              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Buscar
              </button>

              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={cn(
                  "px-4 py-2 rounded-lg transition-all flex items-center gap-2",
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                )}
              >
                <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
              </button>
            </div>

            {lastUpdated && (
              <p className={cn(
                "text-xs mt-2",
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              )}>
                Última actualización: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>

          {/* BOM List */}
          <div className={cn(
            "rounded-xl overflow-hidden",
            theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm'
          )}>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              </div>
            ) : boms.length === 0 ? (
              <div className="text-center py-20">
                <Boxes className={cn(
                  "w-16 h-16 mx-auto mb-4",
                  theme === 'dark' ? 'text-gray-600' : 'text-gray-300'
                )} />
                <h3 className={cn(
                  "text-lg font-medium mb-2",
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                )}>
                  No hay recetas
                </h3>
                <p className={cn(
                  "text-sm mb-4",
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                )}>
                  Crea tu primera receta de producción
                </p>
                <Link
                  href="/dashboard/market/production/bom/create"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Nueva Receta
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {boms.map((bom) => (
                  <motion.div
                    key={bom.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={cn(
                      "transition-colors",
                      theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                    )}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          {bom.productImage ? (
                            <img
                              src={bom.productImage}
                              alt={bom.productName}
                              className="w-16 h-16 rounded-lg object-cover"
                            />
                          ) : (
                            <div className={cn(
                              "w-16 h-16 rounded-lg flex items-center justify-center",
                              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                            )}>
                              <Package className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className={cn(
                                "font-semibold text-lg",
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {bom.bomName}
                              </h3>
                              {bom.isActive ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500" />
                              )}
                            </div>
                            <p className={cn(
                              "text-sm",
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            )}>
                              {bom.bomCode} • Produce: {bom.productName}
                            </p>
                            <div className="flex items-center gap-4 mt-2">
                              <span className={cn(
                                "text-sm",
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                              )}>
                                <strong>{bom.outputQuantity}</strong> {bom.outputUnit}
                              </span>
                              <span className={cn(
                                "text-sm",
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                              )}>
                                <strong>{bom.linesCount}</strong> materiales
                              </span>
                              {bom.expectedWastePercent > 0 && (
                                <span className={cn(
                                  "text-sm",
                                  theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                                )}>
                                  {bom.expectedWastePercent}% merma
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-4">
                          <div className="text-right">
                            <p className={cn(
                              "text-sm",
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            )}>
                              Costo total
                            </p>
                            <p className={cn(
                              "font-semibold",
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {formatCurrency(bom.totalMaterialCost)}
                            </p>
                            <p className={cn(
                              "text-sm",
                              theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                            )}>
                              {formatCurrency(bom.unitCost)}/ud
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setExpandedBom(expandedBom === bom.id ? null : bom.id)}
                              className={cn(
                                "p-2 rounded-lg transition-all",
                                theme === 'dark' ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                              )}
                              title="Ver materiales"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <Link
                              href={`/dashboard/market/production/bom/${bom.id}`}
                              className={cn(
                                "p-2 rounded-lg transition-all",
                                theme === 'dark' ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                              )}
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => handleDelete(bom.id)}
                              disabled={deleteLoading === bom.id}
                              className={cn(
                                "p-2 rounded-lg transition-all text-red-500",
                                theme === 'dark' ? 'hover:bg-red-500/20' : 'hover:bg-red-50'
                              )}
                              title="Desactivar"
                            >
                              {deleteLoading === bom.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Materials */}
                      {expandedBom === bom.id && bom.lines.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className={cn(
                            "mt-4 p-4 rounded-lg",
                            theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                          )}
                        >
                          <h4 className={cn(
                            "font-medium mb-3",
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          )}>
                            Materiales requeridos
                          </h4>
                          <div className="space-y-2">
                            {bom.lines.map((line) => (
                              <div
                                key={line.id}
                                className={cn(
                                  "flex items-center justify-between p-2 rounded-lg",
                                  theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  {line.isPrimary && (
                                    <span className="px-2 py-0.5 text-xs bg-purple-500 text-white rounded">
                                      Principal
                                    </span>
                                  )}
                                  <span className={cn(
                                    "font-medium",
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>
                                    {line.productName}
                                  </span>
                                  <span className={cn(
                                    "text-sm",
                                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                  )}>
                                    {line.productSku}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className={cn(
                                    "text-sm",
                                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                  )}>
                                    {line.quantityRequired} {line.unit}
                                  </span>
                                  <span className={cn(
                                    "font-medium",
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>
                                    {formatCurrency(line.lineCost)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className={cn(
                "flex items-center justify-between px-4 py-3 border-t",
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              )}>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchBOMs(pagination.page - 1, search, showActiveOnly ? true : undefined)}
                    disabled={pagination.page === 1}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      pagination.page === 1
                        ? 'opacity-50 cursor-not-allowed'
                        : theme === 'dark'
                          ? 'hover:bg-gray-700'
                          : 'hover:bg-gray-100'
                    )}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className={cn(
                    "px-3 py-1 rounded-lg text-sm",
                    theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                  )}>
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => fetchBOMs(pagination.page + 1, search, showActiveOnly ? true : undefined)}
                    disabled={pagination.page === pagination.totalPages}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      pagination.page === pagination.totalPages
                        ? 'opacity-50 cursor-not-allowed'
                        : theme === 'dark'
                          ? 'hover:bg-gray-700'
                          : 'hover:bg-gray-100'
                    )}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
