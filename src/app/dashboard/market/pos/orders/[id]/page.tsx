'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ShoppingCart,
  Printer,
  Receipt,
  User,
  Warehouse,
  CreditCard,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Package,
  Percent,
  Tag,
  Banknote,
  Smartphone,
  Building,
  Calendar,
  Hash,
  RotateCcw
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface OrderLine {
  id: number
  productId: number
  productName: string
  productSku: string
  barcode: string | null
  imageUrl: string | null
  quantity: number
  unitPrice: number
  originalPrice?: number
  discountPercent: number
  discountAmount: number
  subtotal: number
  taxAmount: number
  total: number
  promotionId?: number
  promotionName?: string
}

interface Payment {
  id: number
  method: string
  amount: number
  currency: string
  amountTendered: number | null
  changeAmount: number | null
  reference: string | null
  createdAt: string
}

interface Customer {
  id: number
  name: string
  phone: string | null
  email: string | null
}

interface POSOrder {
  id: number
  orderNumber: string
  sessionId: number
  sessionCode: string
  terminalId: number
  terminalName: string
  terminalCode: string
  warehouseId: number
  warehouseName: string
  customer: Customer | null
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  currency: string
  status: 'draft' | 'paid' | 'voided' | 'refunded'
  offlineId: string | null
  syncedAt: string | null
  createdBy: number
  createdByName: string
  createdAt: string
  updatedAt: string
  lines: OrderLine[]
  payments: Payment[]
}

const STATUS_CONFIG: Record<string, {
  label: string
  color: string
  bgGradient: string
  icon: React.ElementType
}> = {
  draft: {
    label: 'Borrador',
    color: 'gray',
    bgGradient: 'from-gray-500 to-gray-600',
    icon: Clock
  },
  paid: {
    label: 'Pagada',
    color: 'emerald',
    bgGradient: 'from-emerald-500 to-teal-500',
    icon: CheckCircle
  },
  voided: {
    label: 'Anulada',
    color: 'red',
    bgGradient: 'from-red-500 to-rose-500',
    icon: XCircle
  },
  refunded: {
    label: 'Reembolsada',
    color: 'amber',
    bgGradient: 'from-amber-500 to-orange-500',
    icon: RotateCcw
  }
}

const PAYMENT_METHOD_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  cash: { label: 'Efectivo', icon: Banknote },
  card: { label: 'Tarjeta', icon: CreditCard },
  transfer: { label: 'Transferencia', icon: Building },
  mobile: { label: 'Pago Móvil', icon: Smartphone }
}

export default function POSOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string
  const { theme } = useTheme()
  const [order, setOrder] = useState<POSOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    fetchOrder()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  const fetchOrder = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/market/pos/orders/${orderId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setOrder(data.data)
        }
      }
    } catch (error) {
      console.error('Error fetching order:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleVoid = async () => {
    if (!confirm('¿Está seguro de anular esta orden? Se restaurará el inventario.')) return

    setActionLoading(true)
    try {
      const response = await fetch(`/api/market/pos/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'void', reason: 'Anulación manual' })
      })

      if (response.ok) {
        fetchOrder()
      } else {
        const data = await response.json()
        alert(data.error || 'Error al anular la orden')
      }
    } catch (error) {
      console.error('Error voiding order:', error)
      alert('Error al anular la orden')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRefund = async () => {
    if (!confirm('¿Está seguro de reembolsar esta orden? Se restaurará el inventario.')) return

    setActionLoading(true)
    try {
      const response = await fetch(`/api/market/pos/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refund', reason: 'Reembolso manual' })
      })

      if (response.ok) {
        fetchOrder()
      } else {
        const data = await response.json()
        alert(data.error || 'Error al reembolsar la orden')
      }
    } catch (error) {
      console.error('Error refunding order:', error)
      alert('Error al reembolsar la orden')
    } finally {
      setActionLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    const symbol = currency === 'EUR' ? '€' : '$'
    return `${symbol}${amount.toFixed(2)} ${currency}`
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
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
              </div>
              <p className="text-gray-500">Cargando detalles de la orden...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (!order) {
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
                <ShoppingCart className="w-8 h-8 text-red-500" />
              </div>
              <h2 className={cn(
                'text-xl font-bold mb-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Orden no encontrada
              </h2>
              <p className="text-gray-500 mb-6">No pudimos cargar los detalles de esta orden.</p>
              <Link href="/dashboard/market/pos/sessions">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver a sesiones
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
  const totalPaid = order.payments.reduce((sum, p) => sum + p.amount, 0)
  const pendingAmount = order.totalAmount - totalPaid

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          {/* Header Section */}
          <div className="max-w-6xl mx-auto mb-8">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-6">
              <Link href="/dashboard/market/pos/sessions">
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

              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    window.open(
                      `/dashboard/market/pos/${order.terminalId}/receipt?orderId=${order.id}&orderNumber=${order.orderNumber}`,
                      '_blank'
                    )
                  }}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl transition-colors',
                    theme === 'dark'
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  <Printer className="w-4 h-4" />
                  <span className="font-medium hidden sm:inline">Imprimir</span>
                </motion.button>

                {order.status === 'draft' && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleVoid}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">Anular</span>
                  </motion.button>
                )}

                {order.status === 'paid' && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleRefund}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors font-medium disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span className="hidden sm:inline">Reembolsar</span>
                  </motion.button>
                )}
              </div>
            </div>

            {/* Order Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'rounded-2xl border overflow-hidden',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <div className="grid grid-cols-1 lg:grid-cols-3">
                {/* Order Icon */}
                <div className={cn(
                  'p-8 lg:p-12 flex items-center justify-center',
                  `bg-gradient-to-br ${statusConfig.bgGradient}`
                )}>
                  <div className="text-center">
                    <Receipt className="w-20 h-20 text-white/90 mx-auto mb-4" />
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 text-white font-medium">
                      <StatusIcon className="w-5 h-5" />
                      {statusConfig.label}
                    </span>
                  </div>
                </div>

                {/* Order Info */}
                <div className="lg:col-span-2 p-6 flex flex-col">
                  {/* Order Number */}
                  <div className="mb-4">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h1 className={cn(
                        'text-2xl md:text-3xl font-bold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {order.orderNumber}
                      </h1>
                    </div>
                    <p className="text-gray-500">
                      Creada el {formatDateTime(order.createdAt)}
                    </p>
                  </div>

                  {/* Info Tags */}
                  <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap mb-6">
                    <span className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    )}>
                      <Receipt className="w-4 h-4" />
                      Terminal: {order.terminalName}
                    </span>
                    <span className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    )}>
                      <Hash className="w-4 h-4" />
                      Sesión: {order.sessionCode}
                    </span>
                    <span className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    )}>
                      <Warehouse className="w-4 h-4" />
                      {order.warehouseName}
                    </span>
                    <span className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    )}>
                      <User className="w-4 h-4" />
                      {order.createdByName}
                    </span>
                  </div>

                  {/* Totals Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-auto">
                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                    )}>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Subtotal</p>
                      <p className={cn(
                        'text-xl font-bold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{formatCurrency(order.subtotal, order.currency)}</p>
                    </div>

                    {order.discountAmount > 0 && (
                      <div className={cn(
                        'p-4 rounded-xl',
                        theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                      )}>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Descuento</p>
                        <p className="text-xl font-bold text-red-500">
                          -{formatCurrency(order.discountAmount, order.currency)}
                        </p>
                      </div>
                    )}

                    <div className={cn(
                      'p-4 rounded-xl col-span-2 md:col-span-1',
                      'bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border-2 border-emerald-500/30'
                    )}>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">Total</p>
                      <p className="text-2xl font-bold text-emerald-600">
                        {formatCurrency(order.totalAmount, order.currency)}
                      </p>
                    </div>

                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                    )}>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Pagado</p>
                      <p className={cn(
                        'text-xl font-bold',
                        totalPaid >= order.totalAmount ? 'text-emerald-600' : 'text-amber-600'
                      )}>
                        {formatCurrency(totalPaid, order.currency)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Content */}
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: 'Productos',
                  value: order.lines.length,
                  icon: Package,
                  color: 'blue'
                },
                {
                  label: 'Unidades',
                  value: order.lines.reduce((sum, l) => sum + l.quantity, 0),
                  icon: ShoppingCart,
                  color: 'purple'
                },
                {
                  label: 'Pagos',
                  value: order.payments.length,
                  icon: CreditCard,
                  color: 'emerald'
                },
                {
                  label: pendingAmount > 0.01 ? 'Pendiente' : 'Estado',
                  value: pendingAmount > 0.01 ? formatCurrency(pendingAmount, order.currency) : 'Completo',
                  icon: pendingAmount > 0.01 ? AlertCircle : CheckCircle,
                  color: pendingAmount > 0.01 ? 'amber' : 'emerald'
                }
              ].map((stat, idx) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={cn(
                    'p-5 rounded-2xl border relative overflow-hidden',
                    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                  )}
                >
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
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Info Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Customer Card */}
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
                    theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                  )}>
                    <User className="w-5 h-5 text-blue-500" />
                  </div>
                  <h3 className={cn(
                    'font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Cliente</h3>
                </div>

                {order.customer ? (
                  <div className="space-y-2">
                    <p className={cn(
                      'font-semibold text-lg',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>{order.customer.name}</p>
                    {order.customer.phone && (
                      <p className="text-sm text-gray-500">{order.customer.phone}</p>
                    )}
                    {order.customer.email && (
                      <p className="text-sm text-gray-500">{order.customer.email}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Venta sin cliente registrado</p>
                )}
              </motion.div>

              {/* Terminal Card */}
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
                    theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                  )}>
                    <Receipt className="w-5 h-5 text-purple-500" />
                  </div>
                  <h3 className={cn(
                    'font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Terminal</h3>
                </div>

                <div className="space-y-2">
                  <p className={cn(
                    'font-semibold text-lg',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>{order.terminalName}</p>
                  <p className="text-sm text-gray-500">Código: {order.terminalCode}</p>
                  <p className="text-sm text-gray-500">Sesión: {order.sessionCode}</p>
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
                    theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-100'
                  )}>
                    <Warehouse className="w-5 h-5 text-emerald-500" />
                  </div>
                  <h3 className={cn(
                    'font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Almacén</h3>
                </div>

                <p className={cn(
                  'font-semibold text-lg',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>{order.warehouseName}</p>
                <p className="text-sm text-gray-500 mt-2">
                  El inventario se descuenta de este almacén
                </p>
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
                'px-6 py-4 border-b flex items-center gap-3',
                theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
              )}>
                <Package className="w-5 h-5 text-emerald-500" />
                <h3 className={cn(
                  'font-semibold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>Productos ({order.lines.length})</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={cn(
                    theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                  )}>
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Producto</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Precio</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Descuento</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className={cn(
                    'divide-y',
                    theme === 'dark' ? 'divide-gray-700' : 'divide-gray-100'
                  )}>
                    {order.lines.map((line) => (
                      <tr key={line.id} className={cn(
                        'transition-colors',
                        theme === 'dark' ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'
                      )}>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center',
                              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                            )}>
                              {line.imageUrl ? (
                                <Image
                                  src={line.imageUrl}
                                  alt={line.productName}
                                  width={48}
                                  height={48}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                            <div>
                              <p className={cn(
                                'font-medium',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>{line.productName}</p>
                              <p className="text-xs text-gray-500 font-mono">{line.productSku}</p>
                              {line.promotionName && (
                                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                  <Tag className="w-3 h-3" />
                                  {line.promotionName}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <p className={cn(
                            'font-medium',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>{formatCurrency(line.unitPrice, order.currency)}</p>
                          {line.originalPrice && line.originalPrice !== line.unitPrice && (
                            <p className="text-xs text-gray-500 line-through">
                              {formatCurrency(line.originalPrice, order.currency)}
                            </p>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <p className={cn(
                            'font-medium',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>{line.quantity}</p>
                        </td>
                        <td className="py-4 px-4 text-right">
                          {line.discountAmount > 0 ? (
                            <div>
                              <p className="text-red-500 font-medium">
                                -{formatCurrency(line.discountAmount, order.currency)}
                              </p>
                              {line.discountPercent > 0 && (
                                <p className="text-xs text-gray-500">{line.discountPercent}%</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <p className="font-bold text-emerald-600">
                            {formatCurrency(line.total, order.currency)}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className={cn(
                    'border-t-2',
                    theme === 'dark' ? 'border-gray-600 bg-gray-900/30' : 'border-gray-200 bg-gray-50'
                  )}>
                    <tr>
                      <td colSpan={4} className="py-3 px-4 text-right font-medium text-gray-500">Subtotal:</td>
                      <td className="py-3 px-4 text-right font-bold text-gray-900 dark:text-white">
                        {formatCurrency(order.subtotal, order.currency)}
                      </td>
                    </tr>
                    {order.discountAmount > 0 && (
                      <tr>
                        <td colSpan={4} className="py-2 px-4 text-right font-medium text-gray-500">Descuento:</td>
                        <td className="py-2 px-4 text-right font-bold text-red-500">
                          -{formatCurrency(order.discountAmount, order.currency)}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={4} className="py-3 px-4 text-right font-bold text-lg text-gray-900 dark:text-white">Total:</td>
                      <td className="py-3 px-4 text-right font-bold text-xl text-emerald-600">
                        {formatCurrency(order.totalAmount, order.currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </motion.div>

            {/* Payments Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className={cn(
                'rounded-2xl border overflow-hidden',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <div className={cn(
                'px-6 py-4 border-b flex items-center justify-between',
                theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
              )}>
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-emerald-500" />
                  <h3 className={cn(
                    'font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Pagos ({order.payments.length})</h3>
                </div>
                <span className={cn(
                  'px-3 py-1 rounded-lg text-sm font-medium',
                  totalPaid >= order.totalAmount
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                )}>
                  {totalPaid >= order.totalAmount ? 'Pagado completo' : `Pendiente: ${formatCurrency(pendingAmount, order.currency)}`}
                </span>
              </div>

              {order.payments.length === 0 ? (
                <div className="p-8 text-center">
                  <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-500">No hay pagos registrados</p>
                </div>
              ) : (
                <div className="p-4 grid gap-3 md:grid-cols-2">
                  {order.payments.map((payment) => {
                    const methodConfig = PAYMENT_METHOD_LABELS[payment.method] || { label: payment.method, icon: DollarSign }
                    const PaymentIcon = methodConfig.icon

                    return (
                      <div
                        key={payment.id}
                        className={cn(
                          'p-4 rounded-xl border',
                          theme === 'dark' ? 'bg-gray-700/30 border-gray-600' : 'bg-gray-50 border-gray-200'
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              'p-2 rounded-lg',
                              theme === 'dark' ? 'bg-gray-600' : 'bg-white'
                            )}>
                              <PaymentIcon className="w-4 h-4 text-emerald-500" />
                            </div>
                            <span className={cn(
                              'font-medium',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{methodConfig.label}</span>
                          </div>
                          <span className="text-xl font-bold text-emerald-600">
                            {formatCurrency(payment.amount, payment.currency)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <span>{formatDateTime(payment.createdAt)}</span>
                          {payment.reference && (
                            <span className="font-mono">Ref: {payment.reference}</span>
                          )}
                        </div>

                        {payment.amountTendered && payment.changeAmount && payment.changeAmount > 0 && (
                          <div className={cn(
                            'mt-2 pt-2 border-t text-sm',
                            theme === 'dark' ? 'border-gray-600' : 'border-gray-200'
                          )}>
                            <div className="flex justify-between text-gray-500">
                              <span>Entregado:</span>
                              <span>{formatCurrency(payment.amountTendered, payment.currency)}</span>
                            </div>
                            <div className="flex justify-between text-amber-600 font-medium">
                              <span>Cambio:</span>
                              <span>{formatCurrency(payment.changeAmount, payment.currency)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </motion.div>

          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
