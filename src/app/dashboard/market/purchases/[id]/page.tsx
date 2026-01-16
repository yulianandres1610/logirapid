'use client'

import { useEffect, useState, use } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  ArrowLeft,
  Clock,
  CheckCircle,
  DollarSign,
  Warehouse,
  Calendar,
  User,
  Phone,
  Mail,
  FileText,
  Truck,
  Loader2,
  Printer,
  FileUp,
  ShoppingCart,
  Box,
  Receipt,
  Building2,
  MapPin,
  Hash,
  XCircle,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { cn } from '@/lib/utils'
import { InvoiceGrid, InvoiceData } from '@/components/orders/InvoicePreviewCard'
import { InvoiceUploader, InvoiceFile } from '@/components/orders/InvoiceUploader'

interface PurchaseLine {
  id: number
  productId: number
  productName: string
  productSku: string
  productBarcode: string | null
  productImage: string | null
  variantId: number | null
  variantName: string | null
  variantSku: string | null
  quantity: number
  quantityReceived: number
  unitPrice: number
  totalPrice: number
  lotNumber: string | null
  expirationDate: string | null
  manufacturingDate: string | null
}

interface PurchaseOrder {
  id: number
  purchaseNumber: string
  supplierId: number
  supplierName: string
  supplierCode: string
  supplierContact: string | null
  supplierPhone: string | null
  supplierEmail: string | null
  supplierAddress: string | null
  warehouseId: number | null
  warehouseName: string | null
  warehouseAddress: string | null
  status: string
  subtotal: number
  taxAmount: number
  totalAmount: number
  currency: string
  purchaseDate: string
  expectedDate: string | null
  receivedDate: string | null
  notes: string | null
  createdByName: string
  createdByRole: string | null
  confirmedByName: string | null
  receivedByName: string | null
  acceptedByName: string | null
  acceptedAt: string | null
  needsAcceptance: boolean
  createdAt: string
  lines: PurchaseLine[]
}

const STATUS_CONFIG: Record<string, {
  label: string
  color: string
  bgGradient: string
  icon: React.ElementType
  step: number
}> = {
  draft: {
    label: 'Borrador',
    color: 'gray',
    bgGradient: 'from-gray-500 to-slate-500',
    icon: FileText,
    step: 0
  },
  comprada: {
    label: 'Comprada',
    color: 'blue',
    bgGradient: 'from-blue-500 to-cyan-500',
    icon: ShoppingCart,
    step: 1
  },
  confirmed: {
    label: 'Confirmada',
    color: 'blue',
    bgGradient: 'from-blue-500 to-cyan-500',
    icon: CheckCircle,
    step: 1
  },
  pendiente: {
    label: 'Pendiente',
    color: 'amber',
    bgGradient: 'from-amber-500 to-orange-500',
    icon: Clock,
    step: 2
  },
  recibido: {
    label: 'Recibida',
    color: 'emerald',
    bgGradient: 'from-emerald-500 to-teal-500',
    icon: Package,
    step: 3
  },
  received: {
    label: 'Recibida',
    color: 'emerald',
    bgGradient: 'from-emerald-500 to-teal-500',
    icon: Package,
    step: 3
  },
  cancelled: {
    label: 'Cancelada',
    color: 'red',
    bgGradient: 'from-red-500 to-rose-500',
    icon: XCircle,
    step: 0
  }
}

const LIFECYCLE_STEPS = [
  { key: 'draft', label: 'Borrador', icon: FileText },
  { key: 'comprada', label: 'Comprada', icon: ShoppingCart },
  { key: 'pendiente', label: 'Pendiente', icon: Clock },
  { key: 'recibido', label: 'Recibida', icon: Package }
]

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  CUP: '₱',
  EUR: '€',
  MLC: '$'
}

export default function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const [order, setOrder] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invoices, setInvoices] = useState<InvoiceData[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [showUploader, setShowUploader] = useState(false)
  const [pendingInvoices, setPendingInvoices] = useState<InvoiceFile[]>([])
  const [uploadingInvoices, setUploadingInvoices] = useState(false)
  const [accepting, setAccepting] = useState(false)
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
    fetchOrder()
    fetchInvoices()
  }, [resolvedParams.id])

  const fetchOrder = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/market/purchases/${resolvedParams.id}`)
      const data = await response.json()
      if (data.success) {
        setOrder(data.data)
      } else {
        setError(data.error || 'Error al cargar orden')
      }
    } catch (err) {
      console.error('Error:', err)
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const fetchInvoices = async () => {
    setLoadingInvoices(true)
    try {
      const response = await fetch(`/api/order-invoices/${resolvedParams.id}?type=purchase`)
      if (!response.ok) return
      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('application/json')) return
      const data = await response.json()
      if (data.success) {
        setInvoices(data.data.invoices || [])
      }
    } catch {
      // Silently ignore - invoices are optional
    } finally {
      setLoadingInvoices(false)
    }
  }

  const handleDeleteInvoice = async (invoiceId: number) => {
    try {
      const response = await fetch(`/api/order-invoices/${resolvedParams.id}?invoiceId=${invoiceId}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.success) {
        setInvoices(prev => prev.filter(inv => inv.id !== invoiceId))
      }
    } catch (err) {
      console.error('Error deleting invoice:', err)
    }
  }

  const handleUploadInvoices = async () => {
    if (pendingInvoices.length === 0) return

    setUploadingInvoices(true)
    try {
      const formData = new FormData()
      formData.append('orderType', 'purchase')
      formData.append('orderId', resolvedParams.id)

      for (const invoice of pendingInvoices) {
        if (invoice.file) {
          formData.append('files', invoice.file)
        }
      }

      const response = await fetch('/api/upload/order-invoices', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        await fetchInvoices()
        setPendingInvoices([])
        setShowUploader(false)
        showNotification('success', 'Facturas subidas', `Se subieron ${pendingInvoices.length} ${pendingInvoices.length === 1 ? 'factura' : 'facturas'} correctamente`)
      } else {
        showNotification('error', 'Error', data.error || 'Error al subir facturas')
      }
    } catch (err) {
      console.error('Error uploading invoices:', err)
      showNotification('error', 'Error de conexión', 'No se pudieron subir las facturas. Intenta de nuevo.')
    } finally {
      setUploadingInvoices(false)
    }
  }

  const handleAcceptOrder = async () => {
    if (!order) return

    setAccepting(true)
    try {
      const response = await fetch(`/api/market/purchases/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' })
      })

      const data = await response.json()

      if (data.success) {
        showNotification('success', 'Orden aceptada', 'La orden de compra ha sido aceptada exitosamente')
        fetchOrder() // Refresh order data
      } else {
        showNotification('error', 'Error', data.error || 'Error al aceptar la orden')
      }
    } catch (err) {
      console.error('Error accepting order:', err)
      showNotification('error', 'Error de conexión', 'No se pudo aceptar la orden. Intenta de nuevo.')
    } finally {
      setAccepting(false)
    }
  }

  const formatCurrency = (value: number, currency: string = 'USD') => {
    const symbol = CURRENCY_SYMBOLS[currency] || '$'
    return `${symbol}${value.toFixed(2)}`
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Calculate metrics
  const calculateMetrics = () => {
    if (!order) return { receivedProgress: 0, pendingUnits: 0 }

    const totalUnitsOrdered = order.lines.reduce((sum, line) => sum + line.quantity, 0)
    const totalUnitsReceived = order.lines.reduce((sum, line) => sum + line.quantityReceived, 0)

    const receivedProgress = totalUnitsOrdered > 0 ? (totalUnitsReceived / totalUnitsOrdered) * 100 : 0
    const pendingUnits = totalUnitsOrdered - totalUnitsReceived

    return { receivedProgress, pendingUnits, totalUnitsOrdered, totalUnitsReceived }
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

  if (error || !order) {
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
                <Package className="w-8 h-8 text-red-500" />
              </div>
              <h2 className={cn(
                'text-xl font-bold mb-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {error || 'Orden no encontrada'}
              </h2>
              <p className="text-gray-500 mb-6">No pudimos cargar los detalles de esta compra.</p>
              <Link href="/dashboard/market/purchases">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver a compras
                </motion.button>
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.draft
  const StatusIcon = statusConfig.icon
  const metrics = calculateMetrics()
  const totalItems = order.lines.length
  const totalUnits = order.lines.reduce((sum, line) => sum + line.quantity, 0)

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          {/* Header Section */}
          <div className="max-w-6xl mx-auto mb-8">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-6">
              <Link href="/dashboard/market/purchases">
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

            {/* Order Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'p-6 rounded-2xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                {/* Left: Order Info */}
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'w-14 h-14 rounded-2xl flex items-center justify-center shrink-0',
                    `bg-gradient-to-br ${statusConfig.bgGradient}`
                  )}>
                    <Receipt className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h1 className={cn(
                        'text-2xl md:text-3xl font-bold font-mono',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {order.purchaseNumber}
                      </h1>
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium',
                        statusConfig.color === 'gray' && 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
                        statusConfig.color === 'blue' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                        statusConfig.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                        statusConfig.color === 'emerald' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                        statusConfig.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusConfig.label}
                      </span>
                      {order.needsAcceptance && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Pendiente Aceptación
                        </span>
                      )}
                      {order.acceptedByName && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Aceptada
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mb-2">Orden de Compra</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {formatDate(order.purchaseDate)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <User className="w-4 h-4" />
                        {order.createdByName}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Total + Accept Button */}
                <div className="flex items-center gap-4">
                  {/* Botón Aceptar - Solo visible para MARKET_MANAGER, ADMIN, SUPER_ADMIN (NO comerciales) */}
                  {order.needsAcceptance && userRole && ['MARKET_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(userRole) && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleAcceptOrder}
                      disabled={accepting}
                      className={cn(
                        'flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-colors',
                        accepting
                          ? 'bg-green-400 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700',
                        'text-white'
                      )}
                    >
                      {accepting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Aceptando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          Aceptar Orden
                        </>
                      )}
                    </motion.button>
                  )}
                  <div className={cn(
                    'p-4 rounded-xl',
                    theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                  )}>
                    <p className="text-sm text-gray-500 mb-1">Total</p>
                    <p className={cn(
                      'text-3xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {formatCurrency(order.totalAmount, order.currency)}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

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
                    const isActive = statusConfig.step >= index
                    const isCurrent = statusConfig.step === index
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
                  value: totalItems,
                  icon: Box,
                  color: 'blue',
                  suffix: 'items'
                },
                {
                  label: 'Unidades',
                  value: Number.isInteger(totalUnits) ? totalUnits : totalUnits.toFixed(2),
                  icon: Package,
                  color: 'purple',
                  suffix: 'uds'
                },
                {
                  label: 'Recibido',
                  value: `${metrics.receivedProgress.toFixed(0)}%`,
                  icon: Truck,
                  color: 'emerald',
                  highlight: metrics.receivedProgress === 100
                },
                {
                  label: 'Pendiente',
                  value: Number.isInteger(metrics.pendingUnits) ? metrics.pendingUnits : metrics.pendingUnits.toFixed(2),
                  icon: Clock,
                  color: 'amber',
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Reception Progress */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'lg:col-span-1 p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className={cn(
                    'font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Progreso de Recepción</h3>
                  <span className={cn(
                    'px-3 py-1 rounded-lg text-sm font-medium',
                    metrics.receivedProgress === 100
                      ? theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
                      : theme === 'dark' ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-600'
                  )}>
                    {metrics.receivedProgress.toFixed(0)}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className={cn(
                  'h-4 rounded-full overflow-hidden mb-6',
                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                )}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${metrics.receivedProgress}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Unidades ordenadas</span>
                    <span className={cn(
                      'text-sm font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {Number.isInteger(metrics.totalUnitsOrdered) ? metrics.totalUnitsOrdered : metrics.totalUnitsOrdered?.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Recibidas</span>
                    <span className="text-sm font-medium text-emerald-500">
                      {Number.isInteger(metrics.totalUnitsReceived) ? metrics.totalUnitsReceived : metrics.totalUnitsReceived?.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Pendientes</span>
                    <span className={cn(
                      'text-sm font-medium',
                      metrics.pendingUnits > 0 ? 'text-amber-500' : 'text-emerald-500'
                    )}>
                      {Number.isInteger(metrics.pendingUnits) ? metrics.pendingUnits : metrics.pendingUnits?.toFixed(2)}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Supplier Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2 rounded-xl',
                      theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                    )}>
                      <Building2 className="w-5 h-5 text-blue-500" />
                    </div>
                    <h3 className={cn(
                      'font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Proveedor</h3>
                  </div>
                  {order.supplierCode && (
                    <span className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-mono font-medium',
                      theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                    )}>
                      {order.supplierCode}
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <p className={cn(
                    'font-semibold text-lg',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>{order.supplierName}</p>

                  <div className={cn(
                    'pt-3 border-t space-y-2',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    {order.supplierContact && (
                      <div className="flex items-center gap-3">
                        <User className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className={cn(
                          'text-sm',
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                        )}>{order.supplierContact}</span>
                      </div>
                    )}
                    {order.supplierPhone && (
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className={cn(
                          'text-sm',
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                        )}>{order.supplierPhone}</span>
                      </div>
                    )}
                    {order.supplierEmail && (
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className={cn(
                          'text-sm truncate',
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                        )}>{order.supplierEmail}</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Warehouse & Dates Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
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
                  )}>Almacén Destino</h3>
                </div>

                {order.warehouseName ? (
                  <div className="flex items-center gap-4 mb-4">
                    <div className={cn(
                      'w-14 h-14 rounded-2xl flex items-center justify-center shrink-0',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    )}>
                      <MapPin className="w-6 h-6 text-gray-500" />
                    </div>
                    <div>
                      <p className={cn(
                        'font-semibold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{order.warehouseName}</p>
                      {order.warehouseAddress && (
                        <p className="text-sm text-gray-500 mt-1">{order.warehouseAddress}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 mb-4">Sin almacén asignado</p>
                )}

                {/* Dates */}
                <div className={cn(
                  'pt-4 border-t space-y-2',
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                )}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Fecha compra:</span>
                    <span className={cn(
                      'font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>{formatDate(order.purchaseDate)}</span>
                  </div>
                  {order.expectedDate && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Entrega esperada:</span>
                      <span className="text-gray-600">{formatDate(order.expectedDate)}</span>
                    </div>
                  )}
                  {order.receivedDate && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Recibida:</span>
                      <span className="text-emerald-500">{formatDate(order.receivedDate)}</span>
                    </div>
                  )}
                  {order.acceptedAt && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Aceptada:</span>
                      <span className="text-green-500">{formatDateTime(order.acceptedAt)}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Products Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
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
                    )}>Productos</h3>
                    <p className="text-sm text-gray-500">{order.lines.length} productos en esta orden</p>
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
                      <th className="text-center py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ordenado</th>
                      <th className="text-center py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Recibido</th>
                      <th className="text-right py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">P.Unitario</th>
                      <th className="text-right py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subtotal</th>
                      <th className="text-center py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lote</th>
                    </tr>
                  </thead>
                  <tbody className={cn(
                    'divide-y',
                    theme === 'dark' ? 'divide-gray-700' : 'divide-gray-100'
                  )}>
                    {order.lines.map((line, idx) => {
                      const receiveProgress = line.quantity > 0
                        ? (line.quantityReceived / line.quantity) * 100
                        : 0

                      return (
                        <motion.tr
                          key={line.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 * idx }}
                          className={cn(
                            'group transition-colors',
                            theme === 'dark' ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'
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
                                {line.variantName && (
                                  <p className="text-xs text-purple-500 font-medium mt-0.5">
                                    {line.variantName}
                                  </p>
                                )}
                                <p className="text-xs text-gray-500 font-mono">
                                  SKU: {line.variantSku || line.productSku}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={cn(
                              'text-lg font-semibold',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{line.quantity}</span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={cn(
                                'inline-flex items-center justify-center w-10 h-10 rounded-xl font-semibold',
                                line.quantityReceived > 0
                                  ? theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
                                  : theme === 'dark' ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400'
                              )}>
                                {line.quantityReceived}
                              </span>
                              {line.quantity > 0 && (
                                <div className={cn(
                                  'w-full h-1 rounded-full max-w-[40px]',
                                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                                )}>
                                  <div
                                    className="h-full bg-emerald-500 rounded-full transition-all"
                                    style={{ width: `${Math.min(100, receiveProgress)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className="text-gray-500">{formatCurrency(line.unitPrice, order.currency)}</span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className={cn(
                              'font-semibold',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{formatCurrency(line.totalPrice, order.currency)}</span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            {line.lotNumber ? (
                              <div className="text-center">
                                <p className={cn(
                                  'text-sm font-mono',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>{line.lotNumber}</p>
                                {line.expirationDate && (
                                  <p className="text-xs text-amber-500">
                                    Vence: {new Date(line.expirationDate).toLocaleDateString('es-ES')}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className={cn(
                                'text-xs px-2 py-1 rounded-lg',
                                theme === 'dark' ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400'
                              )}>Sin lote</span>
                            )}
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                  {/* Table Footer */}
                  <tfoot className={cn(
                    'border-t-2',
                    theme === 'dark' ? 'border-gray-600 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
                  )}>
                    <tr>
                      <td colSpan={4} className="py-4 px-6 text-right font-semibold text-gray-500">
                        Total:
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className={cn(
                          'text-xl font-bold',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>{formatCurrency(order.totalAmount, order.currency)}</span>
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </motion.div>

            {/* Notes & Invoices Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Notes */}
              {order.notes && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
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
                  )}>{order.notes}</p>
                </motion.div>
              )}

              {/* Invoices */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm',
                  !order.notes && 'lg:col-span-2'
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2 rounded-xl',
                      theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                    )}>
                      <FileUp className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <h3 className={cn(
                        'font-semibold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>Facturas Originales</h3>
                      {invoices.length > 0 && (
                        <p className="text-sm text-gray-500">{invoices.length} {invoices.length === 1 ? 'archivo' : 'archivos'}</p>
                      )}
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowUploader(!showUploader)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                      showUploader
                        ? theme === 'dark'
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-gray-200 text-gray-700'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    )}
                  >
                    <FileUp className="w-4 h-4" />
                    {showUploader ? 'Cancelar' : 'Subir Facturas'}
                  </motion.button>
                </div>

                {/* Uploader Section */}
                <AnimatePresence>
                  {showUploader && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className={cn(
                        'mb-6 p-4 rounded-xl border',
                        theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                      )}>
                        <InvoiceUploader
                          invoices={pendingInvoices}
                          onInvoicesChange={setPendingInvoices}
                          orderType="purchase"
                          disabled={uploadingInvoices}
                        />

                        {pendingInvoices.length > 0 && (
                          <div className="flex justify-end mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={handleUploadInvoices}
                              disabled={uploadingInvoices}
                              className={cn(
                                'flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-colors',
                                uploadingInvoices
                                  ? 'bg-purple-400 cursor-not-allowed'
                                  : 'bg-purple-600 hover:bg-purple-700',
                                'text-white'
                              )}
                            >
                              {uploadingInvoices ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Subiendo...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4" />
                                  Guardar {pendingInvoices.length} {pendingInvoices.length === 1 ? 'factura' : 'facturas'}
                                </>
                              )}
                            </motion.button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {loadingInvoices ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                  </div>
                ) : (
                  <InvoiceGrid
                    invoices={invoices}
                    onDelete={handleDeleteInvoice}
                    showDelete={true}
                    emptyMessage="No hay facturas adjuntas a esta compra"
                  />
                )}
              </motion.div>
            </div>

          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
