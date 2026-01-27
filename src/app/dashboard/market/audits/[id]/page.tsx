'use client'

import { useEffect, useState, use } from 'react'
import { motion } from 'framer-motion'
import {
  ClipboardCheck,
  Loader2,
  TrendingDown,
  TrendingUp,
  Calendar,
  User,
  Warehouse,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Package,
  ArrowLeft,
  Minus,
  Search,
  X
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
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
  countedByName: string
  startedAt: string
  completedAt: string | null
  lines?: AuditCountLine[]
}

export default function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const { theme } = useTheme()
  const [auditCount, setAuditCount] = useState<AuditCount | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  // Filter lines based on search term
  const filteredLines = auditCount?.lines?.filter(line => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (
      line.productName.toLowerCase().includes(term) ||
      line.productSku.toLowerCase().includes(term) ||
      (line.productBarcode && line.productBarcode.toLowerCase().includes(term))
    )
  }) || []

  useEffect(() => {
    fetchAuditDetail()
  }, [resolvedParams.id])

  const fetchAuditDetail = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/audit/counts?countId=${resolvedParams.id}`)
      const data = await res.json()
      if (data.success) {
        setAuditCount(data.data)
      } else {
        setError(data.error || 'Error al cargar detalles')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
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

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6 flex items-center justify-center">
            <div className="text-center">
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
                theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
              )}>
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              </div>
              <p className="text-gray-500">Cargando detalles del conteo...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (error || !auditCount) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6">
            <div className={cn(
              'max-w-xl mx-auto text-center p-8 rounded-2xl',
              theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-lg'
            )}>
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
                theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
              )}>
                <ClipboardCheck className="w-8 h-8 text-red-500" />
              </div>
              <h2 className={cn(
                'text-xl font-bold mb-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {error || 'Conteo no encontrado'}
              </h2>
              <p className="text-gray-500 mb-6">No pudimos cargar los detalles de este conteo.</p>
              <Link href="/dashboard/market/audits">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver a auditorías
                </motion.button>
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <div className="max-w-6xl mx-auto">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-6">
              <Link href="/dashboard/market/audits">
                <motion.button
                  whileHover={{ scale: 1.02, x: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl transition-colors',
                    theme === 'dark'
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="font-medium">Volver</span>
                </motion.button>
              </Link>
            </div>

            {/* Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'p-6 rounded-2xl border mb-6',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                {/* Left: Audit Info */}
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'w-14 h-14 rounded-2xl flex items-center justify-center shrink-0',
                    auditCount.status === 'completed'
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-500'
                      : 'bg-gradient-to-br from-amber-500 to-orange-500'
                  )}>
                    <ClipboardCheck className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h1 className={cn(
                        'text-2xl md:text-3xl font-bold font-mono',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {auditCount.countNumber}
                      </h1>
                      {auditCount.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Completado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          <Clock className="w-3.5 h-3.5" />
                          En progreso
                        </span>
                      )}
                      {auditCount.productsWithDifferences > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {auditCount.productsWithDifferences} diferencias
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mb-2">Conteo de Inventario</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Warehouse className="w-4 h-4" />
                        {auditCount.warehouseName}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <User className="w-4 h-4" />
                        {auditCount.countedByName}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {formatDate(auditCount.startedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Totals */}
                <div className="flex items-center gap-3">
                  {auditCount.totalShortageValue > 0 && (
                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-red-900/20' : 'bg-red-50'
                    )}>
                      <p className="text-xs text-red-500 mb-1">Faltantes</p>
                      <p className="text-xl font-bold text-red-500">
                        {formatCurrency(auditCount.totalShortageValue)}
                      </p>
                    </div>
                  )}
                  {auditCount.totalExcessValue > 0 && (
                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-emerald-900/20' : 'bg-emerald-50'
                    )}>
                      <p className="text-xs text-emerald-500 mb-1">Sobrantes</p>
                      <p className="text-xl font-bold text-emerald-500">
                        {formatCurrency(auditCount.totalExcessValue)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                {
                  label: 'Productos',
                  value: auditCount.totalProducts,
                  icon: Package,
                  color: 'blue',
                  suffix: 'items'
                },
                {
                  label: 'Stock Costo',
                  value: formatCurrency(auditCount.totalStockAtCost),
                  icon: TrendingDown,
                  color: 'purple'
                },
                {
                  label: 'Stock Venta',
                  value: formatCurrency(auditCount.totalStockAtSale),
                  icon: TrendingUp,
                  color: 'emerald'
                },
                {
                  label: 'Con Diferencias',
                  value: auditCount.productsWithDifferences,
                  icon: AlertTriangle,
                  color: 'amber',
                  highlight: auditCount.productsWithDifferences > 0
                }
              ].map((stat, idx) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={cn(
                    'p-5 rounded-2xl border relative overflow-hidden group',
                    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm',
                    stat.highlight && 'ring-2 ring-amber-500/30'
                  )}
                >
                  <div className={cn(
                    'absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10 group-hover:opacity-20 transition-opacity',
                    stat.color === 'blue' && 'bg-blue-500',
                    stat.color === 'purple' && 'bg-purple-500',
                    stat.color === 'emerald' && 'bg-emerald-500',
                    stat.color === 'amber' && 'bg-amber-500'
                  )} />

                  <div className="relative">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center mb-3',
                      stat.color === 'blue' && (theme === 'dark' ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-600'),
                      stat.color === 'purple' && (theme === 'dark' ? 'bg-purple-900/50 text-purple-400' : 'bg-purple-100 text-purple-600'),
                      stat.color === 'emerald' && (theme === 'dark' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-100 text-emerald-600'),
                      stat.color === 'amber' && (theme === 'dark' ? 'bg-amber-900/50 text-amber-400' : 'bg-amber-100 text-amber-600')
                    )}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                    <p className={cn(
                      'text-2xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {stat.value}
                      {stat.suffix && <span className="text-sm font-normal text-gray-500 ml-1">{stat.suffix}</span>}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Info Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Audit Info Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    'p-2 rounded-xl',
                    theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                  )}>
                    <ClipboardCheck className="w-5 h-5 text-purple-500" />
                  </div>
                  <h3 className={cn(
                    'font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Informacion del Conteo</h3>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Almacen:</span>
                    <span className={cn(
                      'font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>{auditCount.warehouseName}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Contado por:</span>
                    <span className={cn(
                      'font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>{auditCount.countedByName}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Inicio:</span>
                    <span className={cn(
                      'font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>{formatDate(auditCount.startedAt)}</span>
                  </div>
                  {auditCount.completedAt && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Completado:</span>
                      <span className="text-emerald-500 font-medium">{formatDate(auditCount.completedAt)}</span>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Summary Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className={cn(
                    'font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Resumen de Diferencias</h3>
                  <span className={cn(
                    'px-3 py-1 rounded-lg text-sm font-medium',
                    auditCount.productsWithDifferences === 0
                      ? theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
                      : theme === 'dark' ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-600'
                  )}>
                    {auditCount.productsWithDifferences === 0 ? 'Sin diferencias' : `${auditCount.productsWithDifferences} productos`}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className={cn(
                  'h-4 rounded-full overflow-hidden mb-6',
                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                )}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${auditCount.totalProducts > 0 ? ((auditCount.totalProducts - auditCount.productsWithDifferences) / auditCount.totalProducts) * 100 : 100}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Productos correctos</span>
                    <span className="text-sm font-medium text-emerald-500">
                      {auditCount.totalProducts - auditCount.productsWithDifferences}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Faltantes (valor)</span>
                    <span className={cn(
                      'text-sm font-medium',
                      auditCount.totalShortageValue > 0 ? 'text-red-500' : 'text-gray-400'
                    )}>
                      {auditCount.totalShortageValue > 0 ? formatCurrency(auditCount.totalShortageValue) : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Sobrantes (valor)</span>
                    <span className={cn(
                      'text-sm font-medium',
                      auditCount.totalExcessValue > 0 ? 'text-emerald-500' : 'text-gray-400'
                    )}>
                      {auditCount.totalExcessValue > 0 ? formatCurrency(auditCount.totalExcessValue) : '-'}
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Products Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className={cn(
                'rounded-2xl border overflow-hidden',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <div className={cn(
                'px-6 py-4 border-b',
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              )}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2 rounded-xl',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    )}>
                      <Package className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <h3 className={cn(
                        'font-semibold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>Productos Contados</h3>
                      <p className="text-sm text-gray-500">
                        {searchTerm ? `${filteredLines.length} de ${auditCount.lines?.length || 0}` : `${auditCount.lines?.length || 0}`} productos en este conteo
                      </p>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre, SKU o codigo..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={cn(
                        'w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm transition-colors',
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-purple-500'
                          : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-purple-500'
                      )}
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={cn(
                    theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                  )}>
                    <tr>
                      <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Producto</th>
                      <th className="text-right py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">P.Costo</th>
                      <th className="text-right py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">P.Venta</th>
                      <th className="text-center py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sistema</th>
                      <th className="text-center py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contado</th>
                      <th className="text-center py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Diferencia</th>
                      <th className="text-right py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Valor Dif.</th>
                    </tr>
                  </thead>
                  <tbody className={cn(
                    'divide-y',
                    theme === 'dark' ? 'divide-gray-700' : 'divide-gray-100'
                  )}>
                    {filteredLines.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center">
                          <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                          <p className="text-gray-500 dark:text-gray-400">
                            {searchTerm ? 'No se encontraron productos con ese criterio' : 'No hay productos en este conteo'}
                          </p>
                          {searchTerm && (
                            <button
                              onClick={() => setSearchTerm('')}
                              className="mt-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
                            >
                              Limpiar busqueda
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredLines.map((line, idx) => (
                        <motion.tr
                          key={`${line.productId}-${line.variantId || 'base'}-${idx}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: Math.min(0.02 * idx, 0.5) }}
                          className={cn(
                            'group transition-colors',
                            theme === 'dark' ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50',
                            line.difference !== 0 && (
                              line.difference > 0
                                ? theme === 'dark' ? 'bg-red-950/10' : 'bg-red-50/50'
                                : theme === 'dark' ? 'bg-emerald-950/10' : 'bg-emerald-50/50'
                            )
                          )}
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                'w-12 h-12 rounded-xl overflow-hidden shrink-0',
                                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                              )}>
                                {line.productImage ? (
                                  <Image
                                    src={line.productImage}
                                    alt={line.productName}
                                    width={48}
                                    height={48}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Package className="w-5 h-5 text-gray-400" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={cn(
                                  'font-medium',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )} title={line.productName}>
                                  {line.productName}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                                  <span>SKU: {line.productSku}</span>
                                  {line.productBarcode && (
                                    <>
                                      <span className="text-gray-300 dark:text-gray-600">|</span>
                                      <span>{line.productBarcode}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className="text-gray-500">{formatCurrency(line.costPrice)}</span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className="text-gray-500">{formatCurrency(line.sellingPrice)}</span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={cn(
                              'text-lg font-semibold',
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                            )}>{line.systemQuantity}</span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={cn(
                              'inline-flex items-center justify-center w-10 h-10 rounded-xl font-semibold',
                              theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                            )}>
                              {line.countedQuantity}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={cn(
                              'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold',
                              line.difference > 0
                                ? theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
                                : line.difference < 0
                                  ? theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                                  : theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                            )}>
                              {line.difference > 0 && <TrendingDown className="w-3.5 h-3.5" />}
                              {line.difference < 0 && <TrendingUp className="w-3.5 h-3.5" />}
                              {line.difference === 0 && <Minus className="w-3.5 h-3.5" />}
                              {line.difference > 0 ? `-${line.difference}` :
                               line.difference < 0 ? `+${Math.abs(line.difference)}` :
                               '0'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className={cn(
                              'font-semibold',
                              line.differenceValueCost > 0 ? 'text-red-500' :
                              line.differenceValueCost < 0 ? 'text-emerald-500' :
                              'text-gray-400'
                            )}>
                              {line.differenceValueCost !== 0
                                ? formatCurrency(Math.abs(line.differenceValueCost))
                                : '-'}
                            </span>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                  {/* Table Footer */}
                  <tfoot className={cn(
                    'border-t-2',
                    theme === 'dark' ? 'border-gray-600 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
                  )}>
                    <tr>
                      <td colSpan={5} className="py-4 px-6 text-right font-semibold text-gray-500">
                        Diferencia Total:
                      </td>
                      <td colSpan={2} className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-4">
                          {auditCount.totalShortageValue > 0 && (
                            <span className="text-lg font-bold text-red-500">
                              -{formatCurrency(auditCount.totalShortageValue)}
                            </span>
                          )}
                          {auditCount.totalExcessValue > 0 && (
                            <span className="text-lg font-bold text-emerald-500">
                              +{formatCurrency(auditCount.totalExcessValue)}
                            </span>
                          )}
                          {auditCount.totalShortageValue === 0 && auditCount.totalExcessValue === 0 && (
                            <span className="text-lg font-bold text-gray-400">$0.00</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </motion.div>

          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
