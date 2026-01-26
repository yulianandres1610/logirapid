'use client'

import { useEffect, useState, use } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  ArrowLeft,
  Clock,
  CheckCircle,
  DollarSign,
  TrendingUp,
  Warehouse,
  Calendar,
  User,
  Phone,
  Mail,
  FileText,
  Truck,
  RotateCcw,
  Loader2,
  Printer,
  FileUp,
  ShoppingCart,
  CreditCard,
  ArrowUpRight,
  Box,
  BarChart3,
  Receipt,
  Building2,
  MapPin,
  Hash,
  Edit3,
  Eye,
  Percent,
  AlertCircle,
  CheckCircle2,
  Ban,
  Send,
  History
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

interface Supplier {
  id: number
  code: string
  name: string
  contactName: string | null
  email: string | null
  phone: string | null
}

interface WarehouseInfo {
  id: number
  code: string
  name: string
}

interface ProductInfo {
  id: number
  name: string
  sku: string
  barcode: string | null
  imageUrl: string | null
}

interface OrderLine {
  id: number
  product: ProductInfo
  variantId: number | null
  variantName: string | null
  variantSku: string | null
  quantityOrdered: number
  quantityReceived: number
  quantitySold: number
  quantityReturned: number
  unitCost: number
  unitPrice: number
  lotNumber: string | null
  expirationDate: string | null
}

interface ConsignmentOrder {
  id: number
  orderNumber: string
  supplier: Supplier
  warehouse: WarehouseInfo
  status: string
  totalItems: number
  totalUnits: number
  totalCost: number
  totalSold: number
  totalPaid: number
  totalReturned: number
  consignmentDate: string
  receivedAt: string | null
  completedAt: string | null
  notes: string | null
  createdBy: string
  createdByRole: string | null
  acceptedByName: string | null
  acceptedAt: string | null
  needsAcceptance: boolean
  // Validation fields
  validationStatus: 'pending_validation' | 'confirmed' | 'rejected'
  rejectionReason: string | null
  validatedByName: string | null
  validatedAt: string | null
  createdAt: string
  lines: OrderLine[]
}

const STATUS_CONFIG: Record<string, {
  label: string
  color: string
  bgGradient: string
  icon: React.ElementType
  step: number
}> = {
  pending: {
    label: 'Pendiente',
    color: 'amber',
    bgGradient: 'from-amber-500 to-orange-500',
    icon: Clock,
    step: 1
  },
  received: {
    label: 'Recibida',
    color: 'blue',
    bgGradient: 'from-blue-500 to-cyan-500',
    icon: Truck,
    step: 2
  },
  selling: {
    label: 'En Venta',
    color: 'emerald',
    bgGradient: 'from-emerald-500 to-teal-500',
    icon: TrendingUp,
    step: 3
  },
  paid: {
    label: 'Pagada',
    color: 'purple',
    bgGradient: 'from-purple-500 to-pink-500',
    icon: DollarSign,
    step: 4
  },
  returned: {
    label: 'Devuelta',
    color: 'red',
    bgGradient: 'from-red-500 to-rose-500',
    icon: RotateCcw,
    step: 0
  },
  liquidated: {
    label: 'Liquidada',
    color: 'gray',
    bgGradient: 'from-gray-500 to-slate-500',
    icon: CheckCircle,
    step: 5
  }
}

const LIFECYCLE_STEPS = [
  { key: 'pending', label: 'Pendiente', icon: Clock },
  { key: 'received', label: 'Recibida', icon: Truck },
  { key: 'selling', label: 'En Venta', icon: ShoppingCart },
  { key: 'paid', label: 'Pagada', icon: CreditCard },
  { key: 'liquidated', label: 'Liquidada', icon: CheckCircle }
]

export default function ConsignmentOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const [order, setOrder] = useState<ConsignmentOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invoices, setInvoices] = useState<InvoiceData[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<OrderLine | null>(null)
  const [showUploader, setShowUploader] = useState(false)
  const [pendingInvoices, setPendingInvoices] = useState<InvoiceFile[]>([])
  const [uploadingInvoices, setUploadingInvoices] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [resubmitting, setResubmitting] = useState(false)

  useEffect(() => {
    fetchOrder()
    fetchInvoices()
  }, [resolvedParams.id])

  const fetchOrder = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/consignments/orders/${resolvedParams.id}`)
      const data = await response.json()
      if (data.success) {
        setOrder(data.data)
      } else {
        setError(data.error || 'Error al cargar orden')
      }
    } catch (err) {
      console.error('Error:', err)
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  const fetchInvoices = async () => {
    setLoadingInvoices(true)
    try {
      const response = await fetch(`/api/order-invoices/${resolvedParams.id}?type=consignment`)
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
      formData.append('orderType', 'consignment')
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
        // Refresh invoices list
        await fetchInvoices()
        // Clear pending and hide uploader
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
      const response = await fetch(`/api/consignments/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' })
      })

      const data = await response.json()

      if (data.success) {
        showNotification('success', 'Orden aceptada', 'La orden de consignación ha sido aceptada exitosamente')
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

  const handleResubmit = async () => {
    if (!order) return

    setResubmitting(true)
    try {
      const response = await fetch(`/api/consignments/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resubmit' })
      })

      const data = await response.json()

      if (data.success) {
        showNotification('success', 'Orden reenviada', 'La orden ha sido reenviada a revisión')
        fetchOrder() // Refresh order data
      } else {
        showNotification('error', 'Error', data.error || 'Error al reenviar la orden')
      }
    } catch (err) {
      console.error('Error resubmitting order:', err)
      showNotification('error', 'Error de conexión', 'No se pudo reenviar la orden. Intenta de nuevo.')
    } finally {
      setResubmitting(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value)
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
    if (!order) return { salesProgress: 0, marginPercent: 0, pendingAmount: 0 }

    const totalSalesValue = order.lines.reduce((sum, line) =>
      sum + (line.quantitySold * line.unitPrice), 0)
    const totalCostOfSold = order.lines.reduce((sum, line) =>
      sum + (line.quantitySold * line.unitCost), 0)
    const totalUnitsOrdered = order.lines.reduce((sum, line) => sum + line.quantityOrdered, 0)
    const totalUnitsSold = order.lines.reduce((sum, line) => sum + line.quantitySold, 0)

    const salesProgress = totalUnitsOrdered > 0 ? (totalUnitsSold / totalUnitsOrdered) * 100 : 0
    const marginPercent = totalCostOfSold > 0 ? ((totalSalesValue - totalCostOfSold) / totalCostOfSold) * 100 : 0
    const pendingAmount = order.totalSold - order.totalPaid

    return { salesProgress, marginPercent, pendingAmount, totalSalesValue }
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
              <p className="text-gray-500 mb-6">No pudimos cargar los detalles de esta consignación.</p>
              <Link href="/dashboard/market/consignments">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver a órdenes
                </motion.button>
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
  const StatusIcon = statusConfig.icon
  const metrics = calculateMetrics()

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          {/* Header Section */}
          <div className="max-w-6xl mx-auto mb-8">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-6">
              <Link href="/dashboard/market/consignments">
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
                        {order.orderNumber}
                      </h1>
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium',
                        statusConfig.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                        statusConfig.color === 'blue' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                        statusConfig.color === 'emerald' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                        statusConfig.color === 'purple' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                        statusConfig.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                        statusConfig.color === 'gray' && 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      )}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusConfig.label}
                      </span>
                      {order.validationStatus === 'rejected' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          <Ban className="w-3.5 h-3.5" />
                          Rechazada
                        </span>
                      )}
                      {order.needsAcceptance && order.validationStatus !== 'rejected' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Pendiente Aceptación
                        </span>
                      )}
                      {order.acceptedByName && order.validationStatus !== 'rejected' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Aceptada
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mb-2">Orden de Consignación</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {formatDate(order.consignmentDate)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <User className="w-4 h-4" />
                        {order.createdBy}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Total + Accept Button */}
                <div className="flex items-center gap-4">
                  {order.needsAcceptance && (
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
                    <p className="text-sm text-gray-500 mb-1">Total Costo</p>
                    <p className={cn(
                      'text-3xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {formatCurrency(order.totalCost)}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Rejection Banner */}
          {order.validationStatus === 'rejected' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-6xl mx-auto mb-6"
            >
              <div className={cn(
                'p-5 rounded-2xl border',
                theme === 'dark' ? 'bg-red-900/20 border-red-800/50' : 'bg-red-50 border-red-200'
              )}>
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                    theme === 'dark' ? 'bg-red-900/50' : 'bg-red-100'
                  )}>
                    <Ban className="w-5 h-5 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={cn(
                      'font-semibold mb-1',
                      theme === 'dark' ? 'text-red-300' : 'text-red-800'
                    )}>
                      Orden Rechazada
                    </h3>
                    {order.rejectionReason && (
                      <p className={cn(
                        'text-sm mb-2',
                        theme === 'dark' ? 'text-red-400' : 'text-red-600'
                      )}>
                        <span className="font-medium">Motivo:</span> {order.rejectionReason}
                      </p>
                    )}
                    <p className={cn(
                      'text-xs',
                      theme === 'dark' ? 'text-red-500' : 'text-red-500'
                    )}>
                      {order.validatedByName && `Rechazada por ${order.validatedByName}`}
                      {order.validatedAt && ` el ${formatDateTime(order.validatedAt)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/dashboard/market/consignments/create?editId=${order.id}`}>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors',
                          theme === 'dark'
                            ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        )}
                      >
                        <Edit3 className="w-4 h-4" />
                        Editar Orden
                      </motion.button>
                    </Link>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleResubmit}
                      disabled={resubmitting}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors',
                        resubmitting
                          ? 'bg-blue-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700',
                        'text-white'
                      )}
                    >
                      {resubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Reenviando...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Reenviar a Revisión
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

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
                {/* Created */}
                <div className="flex items-start gap-4 relative">
                  <div className={cn(
                    'w-[35px] h-[35px] rounded-full flex items-center justify-center shrink-0 z-10',
                    theme === 'dark' ? 'bg-blue-900/50 ring-4 ring-gray-800' : 'bg-blue-100 ring-4 ring-white'
                  )}>
                    <FileText className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="pt-1">
                    <p className={cn(
                      'text-sm font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Orden creada</p>
                    <p className="text-xs text-gray-500">
                      por {order.createdBy}
                      {order.createdByRole && <span className="ml-1 opacity-60">({order.createdByRole})</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(order.createdAt)}</p>
                  </div>
                </div>

                {/* Validated/Rejected */}
                {order.validatedAt && (
                  <div className="flex items-start gap-4 relative">
                    <div className={cn(
                      'w-[35px] h-[35px] rounded-full flex items-center justify-center shrink-0 z-10',
                      order.validationStatus === 'rejected'
                        ? theme === 'dark' ? 'bg-red-900/50 ring-4 ring-gray-800' : 'bg-red-100 ring-4 ring-white'
                        : theme === 'dark' ? 'bg-green-900/50 ring-4 ring-gray-800' : 'bg-green-100 ring-4 ring-white'
                    )}>
                      {order.validationStatus === 'rejected'
                        ? <Ban className="w-4 h-4 text-red-500" />
                        : <CheckCircle2 className="w-4 h-4 text-green-500" />
                      }
                    </div>
                    <div className="pt-1">
                      <p className={cn(
                        'text-sm font-medium',
                        order.validationStatus === 'rejected'
                          ? theme === 'dark' ? 'text-red-300' : 'text-red-700'
                          : theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {order.validationStatus === 'rejected' ? 'Orden rechazada' : 'Orden aprobada'}
                      </p>
                      <p className="text-xs text-gray-500">
                        por {order.validatedByName}
                      </p>
                      {order.rejectionReason && (
                        <p className={cn(
                          'text-xs mt-1 italic',
                          theme === 'dark' ? 'text-red-400' : 'text-red-600'
                        )}>
                          &quot;{order.rejectionReason}&quot;
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(order.validatedAt)}</p>
                    </div>
                  </div>
                )}

                {/* Accepted */}
                {order.acceptedByName && order.acceptedAt && (
                  <div className="flex items-start gap-4 relative">
                    <div className={cn(
                      'w-[35px] h-[35px] rounded-full flex items-center justify-center shrink-0 z-10',
                      theme === 'dark' ? 'bg-green-900/50 ring-4 ring-gray-800' : 'bg-green-100 ring-4 ring-white'
                    )}>
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    </div>
                    <div className="pt-1">
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>Orden aceptada</p>
                      <p className="text-xs text-gray-500">por {order.acceptedByName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(order.acceptedAt)}</p>
                    </div>
                  </div>
                )}

                {/* Received */}
                {order.receivedAt && (
                  <div className="flex items-start gap-4 relative">
                    <div className={cn(
                      'w-[35px] h-[35px] rounded-full flex items-center justify-center shrink-0 z-10',
                      theme === 'dark' ? 'bg-emerald-900/50 ring-4 ring-gray-800' : 'bg-emerald-100 ring-4 ring-white'
                    )}>
                      <Package className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="pt-1">
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>Mercancía recibida</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(order.receivedAt)}</p>
                    </div>
                  </div>
                )}

                {/* Completed */}
                {order.completedAt && (
                  <div className="flex items-start gap-4 relative">
                    <div className={cn(
                      'w-[35px] h-[35px] rounded-full flex items-center justify-center shrink-0 z-10',
                      theme === 'dark' ? 'bg-purple-900/50 ring-4 ring-gray-800' : 'bg-purple-100 ring-4 ring-white'
                    )}>
                      <CheckCircle className="w-4 h-4 text-purple-500" />
                    </div>
                    <div className="pt-1">
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>Orden completada</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(order.completedAt)}</p>
                    </div>
                  </div>
                )}

                {/* Pending validation status */}
                {order.validationStatus === 'pending_validation' && !order.validatedAt && (
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
                  style={{ width: `${Math.max(0, ((statusConfig.step - 1) / (LIFECYCLE_STEPS.length - 1)) * 100)}%` }}
                />

                {/* Steps */}
                <div className="relative flex justify-between">
                  {LIFECYCLE_STEPS.map((step, index) => {
                    const isActive = statusConfig.step >= (index + 1)
                    const isCurrent = statusConfig.step === (index + 1)
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
                  value: order.totalItems,
                  icon: Box,
                  color: 'blue',
                  suffix: 'items'
                },
                {
                  label: 'Unidades',
                  value: order.totalUnits,
                  icon: Package,
                  color: 'purple',
                  suffix: 'uds'
                },
                {
                  label: 'Vendido',
                  value: formatCurrency(order.totalSold),
                  icon: TrendingUp,
                  color: 'emerald',
                  highlight: true
                },
                {
                  label: 'Pagado',
                  value: formatCurrency(order.totalPaid),
                  icon: CreditCard,
                  color: 'amber'
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

            {/* Sales Progress & Info Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Sales Progress */}
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
                  )}>Progreso de Ventas</h3>
                  <span className={cn(
                    'px-3 py-1 rounded-lg text-sm font-medium',
                    theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
                  )}>
                    {metrics.salesProgress.toFixed(0)}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className={cn(
                  'h-4 rounded-full overflow-hidden mb-6',
                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                )}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${metrics.salesProgress}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Margen estimado</span>
                    <span className={cn(
                      'flex items-center gap-1 text-sm font-medium',
                      metrics.marginPercent >= 0 ? 'text-emerald-500' : 'text-red-500'
                    )}>
                      <Percent className="w-3 h-3" />
                      {metrics.marginPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Pendiente cobrar</span>
                    <span className={cn(
                      'text-sm font-medium',
                      metrics.pendingAmount > 0 ? 'text-amber-500' : 'text-emerald-500'
                    )}>
                      {formatCurrency(metrics.pendingAmount)}
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
                  <span className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-mono font-medium',
                    theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                  )}>
                    {order.supplier.code}
                  </span>
                </div>

                <div className="space-y-3">
                  <p className={cn(
                    'font-semibold text-lg',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>{order.supplier.name}</p>

                  <div className={cn(
                    'pt-3 border-t space-y-2',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    {order.supplier.contactName && (
                      <div className="flex items-center gap-3">
                        <User className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className={cn(
                          'text-sm',
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                        )}>{order.supplier.contactName}</span>
                      </div>
                    )}
                    {order.supplier.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className={cn(
                          'text-sm',
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                        )}>{order.supplier.phone}</span>
                      </div>
                    )}
                    {order.supplier.email && (
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className={cn(
                          'text-sm truncate',
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                        )}>{order.supplier.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Warehouse Card */}
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

                <div className="flex items-center gap-4">
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
                    )}>{order.warehouse.name}</p>
                    <p className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                      <Hash className="w-3.5 h-3.5" />
                      {order.warehouse.code}
                    </p>
                  </div>
                </div>

                {/* Dates */}
                <div className={cn(
                  'mt-4 pt-4 border-t space-y-2',
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                )}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Fecha consignación:</span>
                    <span className={cn(
                      'font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>{formatDate(order.consignmentDate)}</span>
                  </div>
                  {order.receivedAt && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Recibida:</span>
                      <span className="text-gray-600">{formatDateTime(order.receivedAt)}</span>
                    </div>
                  )}
                  {order.completedAt && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Completada:</span>
                      <span className="text-gray-600">{formatDateTime(order.completedAt)}</span>
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
                      <th className="text-center py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendido</th>
                      <th className="text-right py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Costo</th>
                      <th className="text-right py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">P.Venta</th>
                      <th className="text-right py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subtotal</th>
                      <th className="text-center py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lote</th>
                    </tr>
                  </thead>
                  <tbody className={cn(
                    'divide-y',
                    theme === 'dark' ? 'divide-gray-700' : 'divide-gray-100'
                  )}>
                    {order.lines.map((line, idx) => {
                      const subtotal = line.quantityOrdered * line.unitCost
                      const soldValue = line.quantitySold * line.unitPrice
                      const sellProgress = line.quantityReceived > 0
                        ? (line.quantitySold / line.quantityReceived) * 100
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
                                {line.product.imageUrl ? (
                                  <Image
                                    src={line.product.imageUrl}
                                    alt={line.product.name}
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
                                )}>{line.product.name}</p>
                                {line.variantName && (
                                  <p className="text-xs text-purple-500 font-medium mt-0.5">
                                    {line.variantName}
                                  </p>
                                )}
                                <p className="text-xs text-gray-500 font-mono">
                                  SKU: {line.variantSku || line.product.sku}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={cn(
                              'text-lg font-semibold',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{line.quantityOrdered}</span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={cn(
                              'inline-flex items-center justify-center w-10 h-10 rounded-xl font-semibold',
                              line.quantityReceived > 0
                                ? theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'
                                : theme === 'dark' ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400'
                            )}>
                              {line.quantityReceived}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={cn(
                                'inline-flex items-center justify-center w-10 h-10 rounded-xl font-semibold',
                                line.quantitySold > 0
                                  ? theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
                                  : theme === 'dark' ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400'
                              )}>
                                {line.quantitySold}
                              </span>
                              {line.quantityReceived > 0 && (
                                <div className={cn(
                                  'w-full h-1 rounded-full max-w-[40px]',
                                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                                )}>
                                  <div
                                    className="h-full bg-emerald-500 rounded-full transition-all"
                                    style={{ width: `${Math.min(100, sellProgress)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className="text-gray-500">{formatCurrency(line.unitCost)}</span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className={cn(
                              'font-medium',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{formatCurrency(line.unitPrice)}</span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className={cn(
                              'font-semibold',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{formatCurrency(subtotal)}</span>
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
                      <td colSpan={6} className="py-4 px-6 text-right font-semibold text-gray-500">
                        Total:
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className={cn(
                          'text-xl font-bold',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>{formatCurrency(order.totalCost)}</span>
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
                          orderType="consignment"
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
                    emptyMessage="No hay facturas adjuntas a esta orden"
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
