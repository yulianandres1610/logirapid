'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardCheck,
  Loader2,
  Package,
  TrendingDown,
  TrendingUp,
  Calendar,
  User,
  Warehouse,
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronDown
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface AuditCountLine {
  productId: number
  variantId: number | null
  productName: string
  productSku: string
  productBarcode: string
  productImage: string | null
  costPrice: number
  sellingPrice: number
  systemQuantity: number
  countedQuantity: number
  difference: number
  differenceValueCost: number
  differenceValueSale: number
}

interface AuditCount {
  id: number
  countNumber: string
  warehouseId: number
  warehouseName: string
  status: 'in_progress' | 'completed'
  totalProducts: number
  productsWithDifferences: number
  totalShortageValue: number
  totalExcessValue: number
  totalStockAtCost: number
  totalStockAtSale: number
  countedByEmail: string
  startedAt: string
  completedAt: string | null
  lines?: AuditCountLine[]
}

export default function AuditsPage() {
  const { theme } = useTheme()

  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState<AuditCount[]>([])
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all')
  const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>([])

  // Detail
  const [selectedCount, setSelectedCount] = useState<AuditCount | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const fetchCounts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      let url = '/api/audit/counts?limit=50'
      if (statusFilter !== 'all') {
        url += `&status=${statusFilter}`
      }
      if (warehouseFilter !== 'all') {
        url += `&warehouseId=${warehouseFilter}`
      }

      const res = await fetch(url)
      const data = await res.json()

      if (data.success) {
        setCounts(data.data.counts || [])
        // Extract unique warehouses for filter
        const uniqueWarehouses = new Map<number, string>()
        for (const c of (data.data.counts || [])) {
          if (!uniqueWarehouses.has(c.warehouseId)) {
            uniqueWarehouses.set(c.warehouseId, c.warehouseName)
          }
        }
        setWarehouses(Array.from(uniqueWarehouses, ([id, name]) => ({ id, name })))
      } else {
        setError(data.error || 'Error al cargar conteos')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, warehouseFilter])

  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  const fetchDetail = useCallback(async (countId: number) => {
    try {
      setLoadingDetail(true)
      const res = await fetch(`/api/audit/counts?countId=${countId}`)
      const data = await res.json()

      if (data.success) {
        setSelectedCount(data.data)
      }
    } catch {
      // silent
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  const handleRowClick = (count: AuditCount) => {
    setSelectedCount(count)
    fetchDetail(count.id)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
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

  const getStatusBadge = (status: string) => {
    if (status === 'completed') {
      return (
        <span className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
          theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
        )}>
          <CheckCircle2 className="w-3 h-3" />
          Completado
        </span>
      )
    }
    return (
      <span className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        theme === 'dark' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
      )}>
        <Clock className="w-3 h-3" />
        En progreso
      </span>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
              )}>
                <ClipboardCheck className={cn(
                  'w-5 h-5',
                  theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                )} />
              </div>
              <div>
                <h1 className={cn(
                  'text-xl font-bold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Auditoría
                </h1>
                <p className={cn(
                  'text-sm',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                )}>
                  Historial de conteos de inventario
                </p>
              </div>
            </div>
            <button
              onClick={fetchCounts}
              disabled={loading}
              className={cn(
                'p-2 rounded-lg transition-colors',
                theme === 'dark'
                  ? 'hover:bg-gray-700 text-gray-400'
                  : 'hover:bg-gray-100 text-gray-600'
              )}
            >
              <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={cn(
                'px-3 py-2 rounded-lg border text-sm',
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              )}
            >
              <option value="all">Todos los estados</option>
              <option value="completed">Completados</option>
              <option value="in_progress">En progreso</option>
            </select>

            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className={cn(
                'px-3 py-2 rounded-lg border text-sm',
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              )}
            >
              <option value="all">Todos los almacenes</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className={cn(
                'w-8 h-8 animate-spin',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )} />
            </div>
          ) : error ? (
            <div className={cn(
              'p-6 rounded-xl text-center',
              theme === 'dark' ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'
            )}>
              <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
              <p>{error}</p>
            </div>
          ) : counts.length === 0 ? (
            <div className={cn(
              'p-12 rounded-xl text-center',
              theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
            )}>
              <ClipboardCheck className={cn(
                'w-12 h-12 mx-auto mb-3',
                theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
              )} />
              <p className={cn(
                'text-lg font-medium',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )}>
                No hay conteos de auditoría
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {counts.map((count) => (
                <motion.div
                  key={count.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'rounded-xl border p-4 cursor-pointer transition-all',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700 hover:border-purple-600'
                      : 'bg-white border-gray-200 hover:border-purple-400 hover:shadow-sm',
                    selectedCount?.id === count.id && (
                      theme === 'dark' ? 'border-purple-600 bg-gray-800' : 'border-purple-400 shadow-sm'
                    )
                  )}
                  onClick={() => handleRowClick(count)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                      )}>
                        <ClipboardCheck className={cn(
                          'w-4 h-4',
                          theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                        )} />
                      </div>
                      <div>
                        <p className={cn(
                          'font-semibold text-sm',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {count.countNumber}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={cn(
                            'text-xs flex items-center gap-1',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            <Warehouse className="w-3 h-3" />
                            {count.warehouseName}
                          </span>
                          <span className={cn(
                            'text-xs flex items-center gap-1',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            <Calendar className="w-3 h-3" />
                            {formatDate(count.completedAt || count.startedAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="hidden sm:flex items-center gap-4 text-sm">
                        <div className="text-center">
                          <p className={cn(
                            'text-xs',
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          )}>Productos</p>
                          <p className={cn(
                            'font-medium',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>{count.totalProducts}</p>
                        </div>
                        {count.productsWithDifferences > 0 && (
                          <div className="text-center">
                            <p className={cn(
                              'text-xs',
                              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                            )}>Diferencias</p>
                            <p className="font-medium text-amber-500">{count.productsWithDifferences}</p>
                          </div>
                        )}
                        {count.totalShortageValue > 0 && (
                          <div className="text-center">
                            <p className={cn(
                              'text-xs',
                              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                            )}>Faltantes</p>
                            <p className="font-medium text-red-500">{formatCurrency(count.totalShortageValue)}</p>
                          </div>
                        )}
                        {count.totalExcessValue > 0 && (
                          <div className="text-center">
                            <p className={cn(
                              'text-xs',
                              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                            )}>Sobrantes</p>
                            <p className="font-medium text-green-500">{formatCurrency(count.totalExcessValue)}</p>
                          </div>
                        )}
                      </div>
                      {getStatusBadge(count.status)}
                      <ChevronDown className={cn(
                        'w-4 h-4 transition-transform',
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-400',
                        selectedCount?.id === count.id && 'rotate-180'
                      )} />
                    </div>
                  </div>

                  {/* Expandable Detail */}
                  <AnimatePresence>
                    {selectedCount?.id === count.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className={cn(
                          'mt-4 pt-4 border-t',
                          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                        )}>
                          {loadingDetail ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                            </div>
                          ) : selectedCount?.lines ? (
                            <>
                              {/* Summary Cards */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                <div className={cn(
                                  'p-3 rounded-lg',
                                  theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                                )}>
                                  <p className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                                    Stock a Costo
                                  </p>
                                  <p className={cn('font-bold text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                    {formatCurrency(selectedCount.totalStockAtCost)}
                                  </p>
                                </div>
                                <div className={cn(
                                  'p-3 rounded-lg',
                                  theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                                )}>
                                  <p className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                                    Stock a Venta
                                  </p>
                                  <p className={cn('font-bold text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                    {formatCurrency(selectedCount.totalStockAtSale)}
                                  </p>
                                </div>
                                <div className={cn(
                                  'p-3 rounded-lg',
                                  theme === 'dark' ? 'bg-red-900/20' : 'bg-red-50'
                                )}>
                                  <p className={cn('text-xs flex items-center gap-1', theme === 'dark' ? 'text-red-400' : 'text-red-500')}>
                                    <TrendingDown className="w-3 h-3" /> Faltantes
                                  </p>
                                  <p className="font-bold text-sm text-red-500">
                                    {formatCurrency(selectedCount.totalShortageValue)}
                                  </p>
                                </div>
                                <div className={cn(
                                  'p-3 rounded-lg',
                                  theme === 'dark' ? 'bg-green-900/20' : 'bg-green-50'
                                )}>
                                  <p className={cn('text-xs flex items-center gap-1', theme === 'dark' ? 'text-green-400' : 'text-green-500')}>
                                    <TrendingUp className="w-3 h-3" /> Sobrantes
                                  </p>
                                  <p className="font-bold text-sm text-green-500">
                                    {formatCurrency(selectedCount.totalExcessValue)}
                                  </p>
                                </div>
                              </div>

                              {/* Info */}
                              <div className={cn(
                                'flex flex-wrap gap-4 mb-4 text-xs',
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                              )}>
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {selectedCount.countedByEmail}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Inicio: {formatDate(selectedCount.startedAt)}
                                </span>
                                {selectedCount.completedAt && (
                                  <span className="flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Fin: {formatDate(selectedCount.completedAt)}
                                  </span>
                                )}
                              </div>

                              {/* Products Table */}
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className={cn(
                                      'border-b',
                                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                                    )}>
                                      <th className={cn(
                                        'text-left py-2 px-2 font-medium text-xs',
                                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                      )}>Producto</th>
                                      <th className={cn(
                                        'text-right py-2 px-2 font-medium text-xs',
                                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                      )}>P. Costo</th>
                                      <th className={cn(
                                        'text-right py-2 px-2 font-medium text-xs',
                                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                      )}>P. Venta</th>
                                      <th className={cn(
                                        'text-right py-2 px-2 font-medium text-xs',
                                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                      )}>Sistema</th>
                                      <th className={cn(
                                        'text-right py-2 px-2 font-medium text-xs',
                                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                      )}>Contado</th>
                                      <th className={cn(
                                        'text-right py-2 px-2 font-medium text-xs',
                                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                      )}>Dif.</th>
                                      <th className={cn(
                                        'text-right py-2 px-2 font-medium text-xs',
                                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                      )}>Valor Dif.</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {selectedCount.lines.map((line, idx) => (
                                      <tr
                                        key={idx}
                                        className={cn(
                                          'border-b',
                                          theme === 'dark' ? 'border-gray-800' : 'border-gray-100',
                                          line.difference !== 0 && (
                                            theme === 'dark' ? 'bg-amber-900/10' : 'bg-amber-50/50'
                                          )
                                        )}
                                      >
                                        <td className={cn(
                                          'py-2 px-2',
                                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                                        )}>
                                          <div>
                                            <p className="font-medium text-xs">{line.productName}</p>
                                            {line.productSku && (
                                              <p className={cn(
                                                'text-xs',
                                                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                                              )}>
                                                {line.productSku}
                                              </p>
                                            )}
                                          </div>
                                        </td>
                                        <td className={cn(
                                          'py-2 px-2 text-right text-xs',
                                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                        )}>
                                          {formatCurrency(line.costPrice)}
                                        </td>
                                        <td className={cn(
                                          'py-2 px-2 text-right text-xs',
                                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                        )}>
                                          {formatCurrency(line.sellingPrice)}
                                        </td>
                                        <td className={cn(
                                          'py-2 px-2 text-right text-xs font-medium',
                                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                        )}>
                                          {line.systemQuantity}
                                        </td>
                                        <td className={cn(
                                          'py-2 px-2 text-right text-xs font-medium',
                                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                                        )}>
                                          {line.countedQuantity}
                                        </td>
                                        <td className={cn(
                                          'py-2 px-2 text-right text-xs font-bold',
                                          line.difference > 0 ? 'text-red-500' :
                                          line.difference < 0 ? 'text-green-500' :
                                          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                                        )}>
                                          {line.difference > 0 ? `-${line.difference}` :
                                           line.difference < 0 ? `+${Math.abs(line.difference)}` :
                                           '0'}
                                        </td>
                                        <td className={cn(
                                          'py-2 px-2 text-right text-xs font-medium',
                                          line.differenceValueCost > 0 ? 'text-red-500' :
                                          line.differenceValueCost < 0 ? 'text-green-500' :
                                          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                                        )}>
                                          {line.differenceValueCost !== 0
                                            ? formatCurrency(Math.abs(line.differenceValueCost))
                                            : '-'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              {/* Totals */}
                              <div className={cn(
                                'mt-3 pt-3 border-t flex justify-between text-xs',
                                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                              )}>
                                <span className={cn(
                                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                )}>
                                  {selectedCount.lines.length} productos contados
                                </span>
                                <div className="flex gap-4">
                                  {selectedCount.totalShortageValue > 0 && (
                                    <span className="text-red-500 font-medium">
                                      Faltantes: {formatCurrency(selectedCount.totalShortageValue)}
                                    </span>
                                  )}
                                  {selectedCount.totalExcessValue > 0 && (
                                    <span className="text-green-500 font-medium">
                                      Sobrantes: {formatCurrency(selectedCount.totalExcessValue)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </>
                          ) : (
                            <p className={cn(
                              'text-sm text-center py-4',
                              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                            )}>
                              Sin datos detallados
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
