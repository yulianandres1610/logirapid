'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FlaskConical,
  Plus,
  Search,
  Package,
  Edit2,
  Trash2,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Eye,
  Copy,
  DollarSign,
  Layers
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Formula {
  id: number
  code: string
  name: string
  targetProductId: number
  targetProductName: string
  targetProductSku: string | null
  targetProductImage: string | null
  targetProductUnit: string
  targetProductCost: number
  yieldQuantity: number
  yieldUnit: string
  laborCostPerBatch: number
  estimatedTimeMinutes: number | null
  notes: string | null
  isActive: boolean
  materialCount: number
  estimatedMaterialsCost: number
  createdAt: string
  updatedAt: string
}

interface Stats {
  total: number
  active: number
  inactive: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function FormulasPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const [formulas, setFormulas] = useState<Formula[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, inactive: 0 })
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<string>('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchFormulas()
  }, [pagination.page, filterActive])

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (pagination.page === 1) {
        fetchFormulas()
      } else {
        setPagination(p => ({ ...p, page: 1 }))
      }
    }, 300)
    return () => clearTimeout(debounce)
  }, [search])

  const fetchFormulas = async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })
      if (search) params.set('search', search)
      if (filterActive) params.set('isActive', filterActive)

      const response = await fetch(`/api/market/production/formulas?${params}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setFormulas(data.data.formulas)
          setPagination(data.data.pagination)
          setStats(data.data.stats)
          setLastUpdated(new Date())
        }
      }
    } catch (error) {
      console.error('Error fetching formulas:', error)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleDelete = async (id: number) => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/market/production/formulas/${id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.success) {
        fetchFormulas(true)
        setDeleteConfirm(null)
      } else {
        alert(data.error || 'Error al eliminar la fórmula')
      }
    } catch (error) {
      console.error('Error deleting formula:', error)
      alert('Error al eliminar la fórmula')
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleActive = async (formula: Formula) => {
    try {
      const response = await fetch(`/api/market/production/formulas/${formula.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !formula.isActive })
      })
      if (response.ok) {
        fetchFormulas(true)
      }
    } catch (error) {
      console.error('Error toggling formula:', error)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value)
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FlaskConical className="w-7 h-7 text-purple-600" />
                Fórmulas de Producción
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Gestiona las recetas para fabricar productos
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchFormulas(true)}
                disabled={isRefreshing}
                className={cn(
                  "p-2 rounded-lg border transition-colors",
                  "border-gray-200 dark:border-gray-700",
                  "hover:bg-gray-100 dark:hover:bg-gray-800",
                  isRefreshing && "animate-spin"
                )}
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <Link
                href="/dashboard/market/production/formulas/create"
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
                  "bg-purple-600 hover:bg-purple-700 text-white"
                )}
              >
                <Plus className="w-5 h-5" />
                Nueva Fórmula
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "p-4 rounded-xl border",
                "bg-white dark:bg-gray-800",
                "border-gray-200 dark:border-gray-700"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <FlaskConical className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={cn(
                "p-4 rounded-xl border",
                "bg-white dark:bg-gray-800",
                "border-gray-200 dark:border-gray-700"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Activas</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.active}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={cn(
                "p-4 rounded-xl border",
                "bg-white dark:bg-gray-800",
                "border-gray-200 dark:border-gray-700"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                  <XCircle className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Inactivas</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.inactive}</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, código o producto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(
                  "w-full pl-10 pr-4 py-2 rounded-lg border",
                  "bg-white dark:bg-gray-800",
                  "border-gray-200 dark:border-gray-700",
                  "focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                )}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className={cn(
                "px-4 py-2 rounded-lg border",
                "bg-white dark:bg-gray-800",
                "border-gray-200 dark:border-gray-700"
              )}
            >
              <option value="">Todos los estados</option>
              <option value="true">Solo activas</option>
              <option value="false">Solo inactivas</option>
            </select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : formulas.length === 0 ? (
            <div className={cn(
              "text-center py-12 rounded-xl border",
              "bg-white dark:bg-gray-800",
              "border-gray-200 dark:border-gray-700"
            )}>
              <FlaskConical className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No hay fórmulas
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {search ? 'No se encontraron fórmulas con ese criterio' : 'Crea tu primera fórmula de producción'}
              </p>
              {!search && (
                <Link
                  href="/dashboard/market/production/formulas/create"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <Plus className="w-5 h-5" />
                  Crear Fórmula
                </Link>
              )}
            </div>
          ) : (
            <div className={cn(
              "rounded-xl border overflow-hidden",
              "bg-white dark:bg-gray-800",
              "border-gray-200 dark:border-gray-700"
            )}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400">Código</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400">Nombre</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hidden md:table-cell">Producto Final</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hidden sm:table-cell">Materiales</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hidden lg:table-cell">Rendimiento</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hidden md:table-cell">Costo Est.</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400">Estado</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    <AnimatePresence>
                      {formulas.map((formula, index) => {
                        const totalCost = formula.estimatedMaterialsCost + formula.laborCostPerBatch
                        const costPerUnit = totalCost / formula.yieldQuantity

                        return (
                          <motion.tr
                            key={formula.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ delay: index * 0.02 }}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          >
                            <td className="px-4 py-3">
                              <span className="font-mono text-sm text-purple-600 dark:text-purple-400 font-medium">
                                {formula.code}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900 dark:text-white">
                                {formula.name}
                              </p>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <div className="flex items-center gap-2">
                                {formula.targetProductImage ? (
                                  <img
                                    src={formula.targetProductImage}
                                    alt={formula.targetProductName}
                                    className="w-8 h-8 rounded object-cover"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                    <Package className="w-4 h-4 text-gray-400" />
                                  </div>
                                )}
                                <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[150px]">
                                  {formula.targetProductName}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center hidden sm:table-cell">
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-sm">
                                <Layers className="w-3 h-3" />
                                {formula.materialCount}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center hidden lg:table-cell">
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {formula.yieldQuantity} {formula.yieldUnit}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right hidden md:table-cell">
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {formatCurrency(costPerUnit)}/u
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatCurrency(totalCost)}/lote
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleToggleActive(formula)}
                                className={cn(
                                  "px-2 py-1 rounded-full text-xs font-medium transition-colors",
                                  formula.isActive
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400"
                                )}
                              >
                                {formula.isActive ? 'Activa' : 'Inactiva'}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                <Link
                                  href={`/dashboard/market/production/formulas/${formula.id}`}
                                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                  title="Ver detalle"
                                >
                                  <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                </Link>
                                <Link
                                  href={`/dashboard/market/production/formulas/${formula.id}?edit=true`}
                                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                  title="Editar"
                                >
                                  <Edit2 className="w-4 h-4 text-blue-600" />
                                </Link>
                                {deleteConfirm === formula.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleDelete(formula.id)}
                                      disabled={deleting}
                                      className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600"
                                      title="Confirmar"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirm(null)}
                                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                                      title="Cancelar"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setDeleteConfirm(formula.id)}
                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        )
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                      disabled={pagination.page === 1}
                      className={cn(
                        "p-2 rounded-lg border transition-colors",
                        "border-gray-200 dark:border-gray-700",
                        pagination.page === 1
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-gray-100 dark:hover:bg-gray-700"
                      )}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {pagination.page} / {pagination.totalPages}
                    </span>
                    <button
                      onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                      disabled={pagination.page === pagination.totalPages}
                      className={cn(
                        "p-2 rounded-lg border transition-colors",
                        "border-gray-200 dark:border-gray-700",
                        pagination.page === pagination.totalPages
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-gray-100 dark:hover:bg-gray-700"
                      )}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Last Updated */}
          {lastUpdated && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
              Última actualización: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
