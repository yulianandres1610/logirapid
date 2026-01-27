'use client'

import { useEffect, useState, use } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  ArrowLeft,
  Clock,
  CheckCircle,
  CheckCircle2,
  Warehouse,
  Calendar,
  User,
  FileText,
  Loader2,
  Printer,
  ClipboardList,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  History,
  Zap,
  Check,
  X
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { cn } from '@/lib/utils'

interface CountLine {
  id: number
  productId: number
  variantId: number | null
  productName: string
  productSku: string
  productBarcode: string
  productImage: string | null
  unitPrice: number
  expectedQuantity: number
  countedQuantity: number
  difference: number
  differenceValue: number
  soldToday: number
  scannedAt: string
  notes: string | null
}

interface InventoryCount {
  id: number
  companyId: number
  sessionId: number
  sessionCode: string
  warehouseId: number
  warehouseName: string
  countNumber: string
  status: 'in_progress' | 'completed' | 'approved' | 'rejected'
  countedBy: number
  countedByName: string
  startedAt: string
  completedAt: string | null
  adjustmentOperationId: number | null
  totalProducts: number
  productsWithDifferences: number
  totalDifferenceValue: number
  notes: string | null
  autoApproved: boolean
  approvedBy: number | null
  approvedByName: string | null
  approvedAt: string | null
  lines: CountLine[]
}

const STATUS_CONFIG: Record<string, {
  label: string
  color: string
  bgGradient: string
  icon: React.ElementType
  step: number
}> = {
  in_progress: {
    label: 'En Progreso',
    color: 'amber',
    bgGradient: 'from-amber-500 to-orange-500',
    icon: Clock,
    step: 1
  },
  completed: {
    label: 'Pendiente Aprobación',
    color: 'amber',
    bgGradient: 'from-amber-500 to-orange-500',
    icon: AlertTriangle,
    step: 2
  },
  approved: {
    label: 'Aprobado',
    color: 'emerald',
    bgGradient: 'from-emerald-500 to-teal-500',
    icon: CheckCircle,
    step: 3
  },
  rejected: {
    label: 'Rechazado',
    color: 'red',
    bgGradient: 'from-red-500 to-rose-500',
    icon: XCircle,
    step: 0
  }
}

const LIFECYCLE_STEPS = [
  { key: 'in_progress', label: 'Conteo', icon: ClipboardList },
  { key: 'completed', label: 'Revisión', icon: AlertTriangle },
  { key: 'approved', label: 'Aprobado', icon: CheckCircle }
]

export default function InventoryCountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const [count, setCount] = useState<InventoryCount | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  // Get user role from cookies
  useEffect(() => {
    try {
      const cookies = document.cookie.split(';')
      const roleCookie = cookies.find(c => c.trim().startsWith('user-role='))
      if (roleCookie) {
        const role = decodeURIComponent(roleCookie.split('=')[1])
        setUserRole(role)
      }
    } catch (e) {
      console.error('Error reading role cookie:', e)
    }
  }, [])

  useEffect(() => {
    fetchCount()
  }, [resolvedParams.id])

  const fetchCount = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/market/pos/inventory-count?countId=${resolvedParams.id}&status=any`)
      const data = await response.json()
      if (data.success && data.data) {
        // Need to also get approval info from the other endpoint
        const countInfoRes = await fetch(`/api/market/pos/inventory-counts?status=all&page=1&limit=1000`)
        const countInfoData = await countInfoRes.json()
        let approvalInfo = null
        if (countInfoData.success) {
          approvalInfo = countInfoData.data.counts.find((c: { id: number }) => c.id === parseInt(resolvedParams.id))
        }

        setCount({
          ...data.data,
          autoApproved: approvalInfo?.autoApproved || false,
          approvedByName: approvalInfo?.approvedByName || null,
          approvedAt: approvalInfo?.approvedAt || null
        })
      } else {
        setError(data.error || 'Error al cargar conteo')
      }
    } catch (err) {
      console.error('Error:', err)
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!count) return

    setProcessing(true)
    try {
      const response = await fetch('/api/market/pos/inventory-counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countId: count.id, action })
      })

      const data = await response.json()

      if (data.success) {
        showNotification('success', action === 'approve' ? 'Conteo aprobado' : 'Conteo rechazado', data.message)
        fetchCount()
      } else {
        showNotification('error', 'Error', data.error || 'Error al procesar conteo')
      }
    } catch (err) {
      console.error('Error processing count:', err)
      showNotification('error', 'Error de conexión', 'No se pudo procesar el conteo')
    } finally {
      setProcessing(false)
    }
  }

  const formatDate = (date: string | null | undefined) => {
    if (!date) return ''
    const d = new Date(date)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatDateTime = (date: string | null | undefined) => {
    if (!date) return ''
    const d = new Date(date)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (value: number) => {
    return `$${value.toFixed(2)}`
  }

  // Calculate metrics
  const calculateMetrics = () => {
    if (!count) return { totalExpected: 0, totalCounted: 0, totalDifference: 0, accuracy: 100 }

    const totalExpected = count.lines.reduce((sum, line) => sum + line.expectedQuantity, 0)
    const totalCounted = count.lines.reduce((sum, line) => sum + line.countedQuantity, 0)
    const totalDifference = count.lines.reduce((sum, line) => sum + line.difference, 0)
    const accuracy = totalExpected > 0 ? Math.max(0, 100 - Math.abs(totalDifference / totalExpected * 100)) : 100

    return { totalExpected, totalCounted, totalDifference, accuracy }
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
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
              <p className="text-gray-500">Cargando detalles...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (error || !count) {
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
                <ClipboardList className="w-8 h-8 text-red-500" />
              </div>
              <h2 className={cn(
                'text-xl font-bold mb-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {error || 'Conteo no encontrado'}
              </h2>
              <p className="text-gray-500 mb-6">No pudimos cargar los detalles de este conteo.</p>
              <Link href="/dashboard/market/pos/inventory-counts">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver a conteos
                </motion.button>
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const statusConfig = STATUS_CONFIG[count.status] || STATUS_CONFIG.in_progress
  const StatusIcon = statusConfig.icon
  const metrics = calculateMetrics()
  const canApprove = count.status === 'completed' && userRole && ['MARKET_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(userRole)

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          {/* Header Section */}
          <div className="max-w-6xl mx-auto mb-8">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-6">
              <Link href="/dashboard/market/pos/inventory-counts">
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

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => window.print()}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl transition-colors',
                  theme === 'dark'
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                <Printer className="w-4 h-4" />
                <span className="font-medium">Imprimir</span>
              </motion.button>
            </div>

            {/* Count Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'p-6 rounded-2xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                {/* Left: Count Info */}
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'w-14 h-14 rounded-2xl flex items-center justify-center shrink-0',
                    `bg-gradient-to-br ${statusConfig.bgGradient}`
                  )}>
                    <ClipboardList className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h1 className={cn(
                        'text-2xl md:text-3xl font-bold font-mono',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {count.countNumber}
                      </h1>
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium',
                        statusConfig.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                        statusConfig.color === 'emerald' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                        statusConfig.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusConfig.label}
                      </span>
                      {count.autoApproved && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <Zap className="w-3.5 h-3.5" />
                          Auto-aprobado
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mb-2">Conteo de Inventario</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {formatDateTime(count.startedAt)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <User className="w-4 h-4" />
                        {count.countedByName}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Value Summary + Actions */}
                <div className="flex items-center gap-4">
                  {/* Approval Buttons */}
                  {canApprove && (
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleAction('reject')}
                        disabled={processing}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors',
                          processing
                            ? 'bg-red-400 cursor-not-allowed'
                            : 'bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/30'
                        )}
                      >
                        {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                        Rechazar
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleAction('approve')}
                        disabled={processing}
                        className={cn(
                          'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-colors text-white',
                          processing
                            ? 'bg-green-400 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700'
                        )}
                      >
                        {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Aprobar
                      </motion.button>
                    </div>
                  )}

                  <div className={cn(
                    'p-4 rounded-xl',
                    theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                  )}>
                    <p className="text-sm text-gray-500 mb-1">Diferencia Total</p>
                    <p className={cn(
                      'text-3xl font-bold',
                      count.totalDifferenceValue > 0 ? 'text-red-500' :
                      count.totalDifferenceValue < 0 ? 'text-green-500' :
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {count.totalDifferenceValue > 0 ? '-' : count.totalDifferenceValue < 0 ? '+' : ''}
                      {formatCurrency(Math.abs(count.totalDifferenceValue))}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Activity Log */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(
              'max-w-6xl mx-auto mb-6 p-6 rounded-2xl border',
              theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
            )}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className={cn(
                'p-2 rounded-xl',
                theme === 'dark' ? 'bg-indigo-900/30' : 'bg-indigo-100'
              )}>
                <History className="w-5 h-5 text-indigo-500" />
              </div>
              <h3 className={cn(
                'font-semibold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>Historial de Actividad</h3>
            </div>

            <div className="relative">
              {/* Timeline line */}
              <div className={cn(
                'absolute left-[17px] top-2 bottom-2 w-0.5',
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
              )} />

              <div className="space-y-4">
                {/* Started */}
                <div className="flex items-start gap-4 relative">
                  <div className={cn(
                    'w-[35px] h-[35px] rounded-full flex items-center justify-center shrink-0 z-10',
                    theme === 'dark' ? 'bg-blue-900/50 ring-4 ring-gray-800' : 'bg-blue-100 ring-4 ring-white'
                  )}>
                    <ClipboardList className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="pt-1">
                    <p className={cn(
                      'text-sm font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Conteo iniciado</p>
                    <p className="text-xs text-gray-500">por {count.countedByName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(count.startedAt)}</p>
                  </div>
                </div>

                {/* Completed */}
                {count.completedAt && (
                  <div className="flex items-start gap-4 relative">
                    <div className={cn(
                      'w-[35px] h-[35px] rounded-full flex items-center justify-center shrink-0 z-10',
                      theme === 'dark' ? 'bg-amber-900/50 ring-4 ring-gray-800' : 'bg-amber-100 ring-4 ring-white'
                    )}>
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="pt-1">
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>Conteo completado</p>
                      <p className="text-xs text-gray-500">
                        {count.productsWithDifferences > 0
                          ? `${count.productsWithDifferences} productos con diferencias`
                          : 'Sin diferencias'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(count.completedAt)}</p>
                    </div>
                  </div>
                )}

                {/* Approved/Rejected */}
                {(count.status === 'approved' || count.status === 'rejected') && (
                  <div className="flex items-start gap-4 relative">
                    <div className={cn(
                      'w-[35px] h-[35px] rounded-full flex items-center justify-center shrink-0 z-10',
                      count.status === 'approved'
                        ? theme === 'dark' ? 'bg-emerald-900/50 ring-4 ring-gray-800' : 'bg-emerald-100 ring-4 ring-white'
                        : theme === 'dark' ? 'bg-red-900/50 ring-4 ring-gray-800' : 'bg-red-100 ring-4 ring-white'
                    )}>
                      {count.status === 'approved'
                        ? count.autoApproved
                          ? <Zap className="w-4 h-4 text-emerald-500" />
                          : <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        : <XCircle className="w-4 h-4 text-red-500" />
                      }
                    </div>
                    <div className="pt-1">
                      <p className={cn(
                        'text-sm font-medium',
                        count.status === 'approved'
                          ? theme === 'dark' ? 'text-emerald-300' : 'text-emerald-700'
                          : theme === 'dark' ? 'text-red-300' : 'text-red-700'
                      )}>
                        {count.status === 'approved'
                          ? count.autoApproved ? 'Auto-aprobado (sin diferencias)' : 'Conteo aprobado'
                          : 'Conteo rechazado'}
                      </p>
                      {count.approvedByName && !count.autoApproved && (
                        <p className="text-xs text-gray-500">por {count.approvedByName}</p>
                      )}
                      {count.approvedAt && (
                        <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(count.approvedAt)}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Pending */}
                {count.status === 'completed' && (
                  <div className="flex items-start gap-4 relative">
                    <div className={cn(
                      'w-[35px] h-[35px] rounded-full flex items-center justify-center shrink-0 z-10',
                      theme === 'dark' ? 'bg-orange-900/50 ring-4 ring-gray-800' : 'bg-orange-100 ring-4 ring-white'
                    )}>
                      <Clock className="w-4 h-4 text-orange-500 animate-pulse" />
                    </div>
                    <div className="pt-1">
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-orange-300' : 'text-orange-700'
                      )}>Pendiente de aprobación</p>
                      <p className="text-xs text-gray-500">Esperando revisión de un administrador</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Content */}
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Lifecycle Progress */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'p-6 rounded-2xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <h3 className={cn(
                'text-sm font-medium mb-6',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )}>
                Ciclo de Vida
              </h3>

              <div className="relative">
                {/* Progress line */}
                <div className={cn(
                  'absolute top-6 left-0 right-0 h-1 rounded-full',
                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                )} />
                <div
                  className={cn('absolute top-6 left-0 h-1 rounded-full transition-all duration-500', `bg-gradient-to-r ${statusConfig.bgGradient}`)}
                  style={{ width: `${Math.max(0, ((statusConfig.step) / (LIFECYCLE_STEPS.length - 1)) * 100)}%` }}
                />

                {/* Steps */}
                <div className="relative flex justify-between">
                  {LIFECYCLE_STEPS.map((step, index) => {
                    const isActive = statusConfig.step >= index + 1
                    const isCurrent = statusConfig.step === index + 1
                    const StepIcon = step.icon

                    return (
                      <div key={step.key} className="flex flex-col items-center">
                        <motion.div
                          initial={false}
                          animate={{ scale: isCurrent ? 1.1 : 1 }}
                          className={cn(
                            'w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 z-10',
                            isActive
                              ? `bg-gradient-to-br ${statusConfig.bgGradient} text-white shadow-lg`
                              : theme === 'dark'
                                ? 'bg-gray-700 text-gray-500'
                                : 'bg-gray-100 text-gray-400'
                          )}
                        >
                          <StepIcon className="w-5 h-5" />
                        </motion.div>
                        <span className={cn(
                          'mt-3 text-xs font-medium',
                          isActive
                            ? theme === 'dark' ? 'text-white' : 'text-gray-900'
                            : 'text-gray-500'
                        )}>
                          {step.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: 'Productos',
                  value: count.totalProducts,
                  icon: Package,
                  color: 'blue',
                  suffix: 'items'
                },
                {
                  label: 'Con Diferencias',
                  value: count.productsWithDifferences,
                  icon: AlertTriangle,
                  color: count.productsWithDifferences > 0 ? 'amber' : 'emerald',
                  suffix: 'items'
                },
                {
                  label: 'Precisión',
                  value: `${metrics.accuracy.toFixed(0)}%`,
                  icon: CheckCircle2,
                  color: metrics.accuracy >= 95 ? 'emerald' : metrics.accuracy >= 80 ? 'amber' : 'red',
                  highlight: metrics.accuracy >= 95
                },
                {
                  label: 'Diferencia',
                  value: metrics.totalDifference > 0 ? `+${metrics.totalDifference}` : metrics.totalDifference.toString(),
                  icon: metrics.totalDifference > 0 ? TrendingDown : metrics.totalDifference < 0 ? TrendingUp : Minus,
                  color: metrics.totalDifference > 0 ? 'red' : metrics.totalDifference < 0 ? 'green' : 'gray',
                  suffix: 'uds'
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
                    stat.highlight && 'ring-2 ring-emerald-500/30'
                  )}
                >
                  <div className={cn(
                    'absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10 group-hover:opacity-20 transition-opacity',
                    stat.color === 'blue' && 'bg-blue-500',
                    stat.color === 'amber' && 'bg-amber-500',
                    stat.color === 'emerald' && 'bg-emerald-500',
                    stat.color === 'red' && 'bg-red-500',
                    stat.color === 'green' && 'bg-green-500',
                    stat.color === 'gray' && 'bg-gray-500'
                  )} />

                  <div className="relative">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center mb-3',
                      stat.color === 'blue' && (theme === 'dark' ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-600'),
                      stat.color === 'amber' && (theme === 'dark' ? 'bg-amber-900/50 text-amber-400' : 'bg-amber-100 text-amber-600'),
                      stat.color === 'emerald' && (theme === 'dark' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-100 text-emerald-600'),
                      stat.color === 'red' && (theme === 'dark' ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-600'),
                      stat.color === 'green' && (theme === 'dark' ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-600'),
                      stat.color === 'gray' && (theme === 'dark' ? 'bg-gray-700/50 text-gray-400' : 'bg-gray-100 text-gray-600')
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Warehouse Card */}
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
                    <Warehouse className="w-5 h-5 text-purple-500" />
                  </div>
                  <h3 className={cn(
                    'font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Almacén</h3>
                </div>

                <p className={cn(
                  'font-semibold text-lg mb-2',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>{count.warehouseName}</p>

                <div className={cn(
                  'pt-3 border-t space-y-2',
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                )}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Sesión:</span>
                    <span className={cn(
                      'font-mono',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>{count.sessionCode}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Contado por:</span>
                    <span className={cn(
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>{count.countedByName}</span>
                  </div>
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
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    'p-2 rounded-xl',
                    theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                  )}>
                    <FileText className="w-5 h-5 text-blue-500" />
                  </div>
                  <h3 className={cn(
                    'font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Resumen de Cantidades</h3>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Stock esperado</span>
                    <span className={cn(
                      'text-lg font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>{metrics.totalExpected}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Stock contado</span>
                    <span className="text-lg font-semibold text-blue-500">{metrics.totalCounted}</span>
                  </div>
                  <div className={cn(
                    'flex items-center justify-between pt-3 border-t',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <span className="text-sm text-gray-500">Diferencia total</span>
                    <span className={cn(
                      'text-lg font-bold',
                      metrics.totalDifference > 0 ? 'text-red-500' :
                      metrics.totalDifference < 0 ? 'text-green-500' : 'text-gray-500'
                    )}>
                      {metrics.totalDifference > 0 ? '+' : ''}{metrics.totalDifference}
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
                'px-6 py-4 border-b flex items-center justify-between',
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              )}>
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
                    <p className="text-sm text-gray-500">{count.lines.length} productos en este conteo</p>
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
                      <th className="text-center py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Esperado</th>
                      <th className="text-center py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contado</th>
                      <th className="text-center py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Diferencia</th>
                      <th className="text-right py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Valor Dif.</th>
                      <th className="text-center py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Vendido Hoy</th>
                    </tr>
                  </thead>
                  <tbody className={cn(
                    'divide-y',
                    theme === 'dark' ? 'divide-gray-700' : 'divide-gray-100'
                  )}>
                    {count.lines.map((line, idx) => (
                      <motion.tr
                        key={line.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.02 * idx }}
                        className={cn(
                          'group transition-colors',
                          theme === 'dark' ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50',
                          line.difference !== 0 && (
                            line.difference > 0
                              ? 'bg-red-500/5'
                              : 'bg-green-500/5'
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
                            <div className="min-w-0">
                              <p className={cn(
                                'font-medium truncate max-w-[200px]',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>{line.productName}</p>
                              <p className="text-xs text-gray-500 font-mono">
                                SKU: {line.productSku}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={cn(
                            'text-lg font-semibold',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>{line.expectedQuantity}</span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={cn(
                            'inline-flex items-center justify-center w-12 h-12 rounded-xl font-bold text-lg',
                            theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'
                          )}>
                            {line.countedQuantity}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold',
                            line.difference > 0
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : line.difference < 0
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                          )}>
                            {line.difference > 0 && <TrendingDown className="w-4 h-4" />}
                            {line.difference < 0 && <TrendingUp className="w-4 h-4" />}
                            {line.difference === 0 && <Minus className="w-4 h-4" />}
                            {line.difference > 0 ? '+' : ''}{line.difference}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className={cn(
                            'font-semibold',
                            line.differenceValue > 0 ? 'text-red-500' :
                            line.differenceValue < 0 ? 'text-green-500' : 'text-gray-500'
                          )}>
                            {line.differenceValue > 0 ? '-' : line.differenceValue < 0 ? '+' : ''}
                            {formatCurrency(Math.abs(line.differenceValue))}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center hidden md:table-cell">
                          <span className={cn(
                            'text-sm',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            {line.soldToday > 0 ? line.soldToday : '-'}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                  {/* Table Footer */}
                  <tfoot className={cn(
                    'border-t-2',
                    theme === 'dark' ? 'border-gray-600 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
                  )}>
                    <tr>
                      <td className="py-4 px-6 font-semibold text-gray-500">Total:</td>
                      <td className="py-4 px-4 text-center">
                        <span className={cn(
                          'text-lg font-bold',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>{metrics.totalExpected}</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-lg font-bold text-blue-500">{metrics.totalCounted}</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={cn(
                          'text-lg font-bold',
                          metrics.totalDifference > 0 ? 'text-red-500' :
                          metrics.totalDifference < 0 ? 'text-green-500' : 'text-gray-500'
                        )}>
                          {metrics.totalDifference > 0 ? '+' : ''}{metrics.totalDifference}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className={cn(
                          'text-xl font-bold',
                          count.totalDifferenceValue > 0 ? 'text-red-500' :
                          count.totalDifferenceValue < 0 ? 'text-green-500' :
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {count.totalDifferenceValue > 0 ? '-' : count.totalDifferenceValue < 0 ? '+' : ''}
                          {formatCurrency(Math.abs(count.totalDifferenceValue))}
                        </span>
                      </td>
                      <td className="hidden md:table-cell"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </motion.div>

            {/* Notes */}
            {count.notes && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    'p-2 rounded-xl',
                    theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100'
                  )}>
                    <FileText className="w-5 h-5 text-amber-500" />
                  </div>
                  <h3 className={cn(
                    'font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Notas</h3>
                </div>
                <p className={cn(
                  'text-sm leading-relaxed',
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                )}>{count.notes}</p>
              </motion.div>
            )}

          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
