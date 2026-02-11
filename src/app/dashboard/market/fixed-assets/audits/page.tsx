'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ClipboardCheck,
  Loader2,
  Plus,
  Eye,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Filter
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'

interface Audit {
  id: number
  companyId: number
  auditNumber: string
  auditDate: string
  warehouseId: number
  warehouseName: string
  categoryId: number
  categoryName: string
  totalAssets: number
  assetsFound: number
  assetsMissing: number
  assetsSurplus: number
  status: string
  createdBy: number
  createdByName: string
  completedByName: string
  approvedByName: string
  createdAt: string
  completedAt: string
  approvedAt: string
  notes: string
}

interface Warehouse {
  id: number
  name: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  in_progress: { label: 'En Progreso', color: 'text-blue-500 bg-blue-500/10', icon: Clock },
  completed: { label: 'Completada', color: 'text-yellow-500 bg-yellow-500/10', icon: AlertTriangle },
  approved: { label: 'Aprobada', color: 'text-green-500 bg-green-500/10', icon: CheckCircle2 }
}

export default function FixedAssetAuditsPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [loading, setLoading] = useState(true)
  const [audits, setAudits] = useState<Audit[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  // Filters
  const [statusFilter, setStatusFilter] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])

  // New audit modal
  const [showNewModal, setShowNewModal] = useState(false)
  const [newAuditLoading, setNewAuditLoading] = useState(false)
  const [newAuditForm, setNewAuditForm] = useState({
    auditDate: new Date().toISOString().split('T')[0],
    warehouseId: '',
    categoryId: '',
    notes: ''
  })

  // Fetch warehouses
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const res = await fetch('/api/market/warehouses')
        const data = await res.json()
        if (data.success) {
          setWarehouses(data.data.warehouses || data.data || [])
        }
      } catch {
        console.error('Error fetching warehouses')
      }
    }
    fetchWarehouses()
  }, [])

  const fetchAudits = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)
    setError(null)

    try {
      let url = `/api/market/fixed-assets/audits?page=${page}&limit=${limit}`
      if (statusFilter) url += `&status=${statusFilter}`
      if (warehouseFilter) url += `&warehouseId=${warehouseFilter}`

      const res = await fetch(url)
      const data = await res.json()

      if (data.success) {
        setAudits(data.data.audits)
        setTotalPages(data.data.pagination.totalPages)
        setTotal(data.data.pagination.total)
      } else {
        setError(data.error || 'Error al cargar auditorías')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      if (!silent) setLoading(false)
      else setIsRefreshing(false)
    }
  }, [page, statusFilter, warehouseFilter])

  useEffect(() => {
    fetchAudits()
  }, [fetchAudits])

  const createAudit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newAuditForm.auditDate) {
      showNotification('error', 'Error', 'La fecha es requerida')
      return
    }

    setNewAuditLoading(true)

    try {
      const res = await fetch('/api/market/fixed-assets/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditDate: newAuditForm.auditDate,
          warehouseId: newAuditForm.warehouseId ? parseInt(newAuditForm.warehouseId) : null,
          categoryId: newAuditForm.categoryId ? parseInt(newAuditForm.categoryId) : null,
          notes: newAuditForm.notes || null
        })
      })

      const data = await res.json()

      if (data.success) {
        showNotification('success', 'Auditoría creada', `Se ha creado la auditoría ${data.data.auditNumber}`)
        setShowNewModal(false)
        setNewAuditForm({
          auditDate: new Date().toISOString().split('T')[0],
          warehouseId: '',
          categoryId: '',
          notes: ''
        })
        fetchAudits(true)
      } else {
        showNotification('error', 'Error', data.error || 'Error al crear auditoría')
      }
    } catch {
      showNotification('error', 'Error de conexión', '')
    } finally {
      setNewAuditLoading(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es-ES')
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <Link
                  href="/dashboard/market/fixed-assets"
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  )}
                >
                  <ArrowLeft className={cn(
                    "w-5 h-5",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )} />
                </Link>
                <div>
                  <h1 className={cn(
                    "text-2xl font-bold",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Auditorías de Activos
                  </h1>
                  <p className={cn(
                    "text-sm mt-1",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Conteo y verificación de activos fijos
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchAudits(true)}
                  disabled={isRefreshing}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                    theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  )}
                >
                  <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                </button>
                <button
                  onClick={() => setShowNewModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                  Nueva Auditoría
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className={cn(
              "flex flex-wrap gap-4 p-4 rounded-xl",
              theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
            )}>
              <div className="flex items-center gap-2">
                <Filter className={cn("w-4 h-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Filtros:</span>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                className={cn(
                  "px-3 py-1.5 rounded-lg border text-sm",
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                )}
              >
                <option value="">Todos los estados</option>
                {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                  <option key={value} value={value}>{config.label}</option>
                ))}
              </select>
              <select
                value={warehouseFilter}
                onChange={(e) => { setWarehouseFilter(e.target.value); setPage(1) }}
                className={cn(
                  "px-3 py-1.5 rounded-lg border text-sm",
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                )}
              >
                <option value="">Todas las ubicaciones</option>
                {warehouses.map(wh => (
                  <option key={wh.id} value={wh.id}>{wh.name}</option>
                ))}
              </select>
            </div>

            {/* Audits List */}
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : error ? (
              <div className={cn(
                "p-8 rounded-xl text-center",
                theme === 'dark' ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'
              )}>
                <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
                <p>{error}</p>
              </div>
            ) : audits.length === 0 ? (
              <div className={cn(
                "p-12 rounded-xl text-center",
                theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
              )}>
                <ClipboardCheck className={cn(
                  "w-16 h-16 mx-auto mb-4",
                  theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                )} />
                <h3 className={cn(
                  "text-lg font-semibold mb-2",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  No hay auditorías
                </h3>
                <p className={cn("mb-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Crea tu primera auditoría de activos
                </p>
                <button
                  onClick={() => setShowNewModal(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  <Plus className="w-5 h-5" />
                  Crear Auditoría
                </button>
              </div>
            ) : (
              <>
                <div className={cn(
                  "rounded-xl overflow-hidden border",
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                )}>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className={cn(
                        theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                      )}>
                        <tr>
                          <th className={cn(
                            "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            Auditoría
                          </th>
                          <th className={cn(
                            "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            Fecha
                          </th>
                          <th className={cn(
                            "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            Ubicación
                          </th>
                          <th className={cn(
                            "px-4 py-3 text-center text-xs font-medium uppercase tracking-wider",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            Total
                          </th>
                          <th className={cn(
                            "px-4 py-3 text-center text-xs font-medium uppercase tracking-wider",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            Encontrados
                          </th>
                          <th className={cn(
                            "px-4 py-3 text-center text-xs font-medium uppercase tracking-wider",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            Faltantes
                          </th>
                          <th className={cn(
                            "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            Estado
                          </th>
                          <th className={cn(
                            "px-4 py-3 text-right text-xs font-medium uppercase tracking-wider",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className={cn(
                        "divide-y",
                        theme === 'dark' ? 'divide-gray-700 bg-gray-800/30' : 'divide-gray-200 bg-white'
                      )}>
                        {audits.map(audit => {
                          const statusConfig = STATUS_CONFIG[audit.status] || STATUS_CONFIG.in_progress
                          const StatusIcon = statusConfig.icon

                          return (
                            <tr key={audit.id} className={cn(
                              "transition-colors",
                              theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                            )}>
                              <td className="px-4 py-3">
                                <p className={cn(
                                  "font-medium",
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {audit.auditNumber}
                                </p>
                                <p className={cn(
                                  "text-xs",
                                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                )}>
                                  {audit.createdByName}
                                </p>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  <Calendar className={cn(
                                    "w-3 h-3",
                                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                                  )} />
                                  <span className={cn(
                                    "text-sm",
                                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                  )}>
                                    {formatDate(audit.auditDate)}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={cn(
                                  "text-sm",
                                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                )}>
                                  {audit.warehouseName || 'Todos'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={cn(
                                  "text-sm font-medium",
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {audit.totalAssets}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-sm font-medium text-green-500">
                                  {audit.assetsFound}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={cn(
                                  "text-sm font-medium",
                                  audit.assetsMissing > 0 ? 'text-red-500' : 'text-gray-500'
                                )}>
                                  {audit.assetsMissing}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={cn(
                                  "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                                  statusConfig.color
                                )}>
                                  <StatusIcon className="w-3 h-3" />
                                  {statusConfig.label}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex justify-end">
                                  <Link
                                    href={`/dashboard/market/fixed-assets/audits/${audit.id}`}
                                    className={cn(
                                      "flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors",
                                      audit.status === 'in_progress'
                                        ? 'bg-blue-500 hover:bg-blue-600 text-white'
                                        : theme === 'dark'
                                          ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                    )}
                                  >
                                    <Eye className="w-4 h-4" />
                                    {audit.status === 'in_progress' ? 'Continuar' : 'Ver'}
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-between items-center">
                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} de {total}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className={cn(
                          "px-4 py-2 rounded-lg transition-colors disabled:opacity-50",
                          theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        )}
                      >
                        Anterior
                      </button>
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className={cn(
                          "px-4 py-2 rounded-lg transition-colors disabled:opacity-50",
                          theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        )}
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </div>

        {/* New Audit Modal */}
        {showNewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "w-full max-w-md p-6 rounded-xl",
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
            >
              <h3 className={cn("text-lg font-semibold mb-4", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Nueva Auditoría
              </h3>

              <form onSubmit={createAudit} className="space-y-4">
                <div>
                  <label className={cn("block text-sm font-medium mb-1", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    Fecha de Auditoría *
                  </label>
                  <input
                    type="date"
                    value={newAuditForm.auditDate}
                    onChange={(e) => setNewAuditForm({ ...newAuditForm, auditDate: e.target.value })}
                    className={cn(
                      "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    )}
                    required
                  />
                </div>

                <div>
                  <label className={cn("block text-sm font-medium mb-1", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    Ubicación (opcional)
                  </label>
                  <select
                    value={newAuditForm.warehouseId}
                    onChange={(e) => setNewAuditForm({ ...newAuditForm, warehouseId: e.target.value })}
                    className={cn(
                      "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    )}
                  >
                    <option value="">Todos los almacenes</option>
                    {warehouses.map(wh => (
                      <option key={wh.id} value={wh.id}>{wh.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={cn("block text-sm font-medium mb-1", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    Notas
                  </label>
                  <textarea
                    value={newAuditForm.notes}
                    onChange={(e) => setNewAuditForm({ ...newAuditForm, notes: e.target.value })}
                    rows={3}
                    className={cn(
                      "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    )}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowNewModal(false)}
                    className={cn(
                      "px-4 py-2 rounded-lg",
                      theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    )}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={newAuditLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50"
                  >
                    {newAuditLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Crear Auditoría
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  )
}
