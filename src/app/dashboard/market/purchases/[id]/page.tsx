'use client'

import { useEffect, useState, use } from 'react'
import { motion } from 'framer-motion'
import {
  Package,
  ArrowLeft,
  Clock,
  CheckCircle,
  DollarSign,
  Calendar,
  User,
  Phone,
  FileText,
  Truck,
  Loader2,
  Printer,
  FileUp,
  XCircle
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { InvoiceGrid, InvoiceData } from '@/components/orders/InvoicePreviewCard'

interface PurchaseLine {
  id: number
  productId: number
  productName: string
  productSku: string
  productBarcode: string | null
  productImageUrl: string | null
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
  supplierAddress: string | null
  warehouseId: number | null
  warehouseName: string | null
  status: string
  totalAmount: number
  currency: string
  purchaseDate: string
  expectedDate: string | null
  receivedAt: string | null
  notes: string | null
  createdBy: string
  createdAt: string
  lines: PurchaseLine[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Borrador', color: 'gray', icon: FileText },
  confirmed: { label: 'Confirmada', color: 'blue', icon: CheckCircle },
  comprada: { label: 'Comprada', color: 'blue', icon: CheckCircle },
  pendiente: { label: 'Pendiente', color: 'amber', icon: Clock },
  received: { label: 'Recibida', color: 'emerald', icon: Package },
  recibido: { label: 'Recibida', color: 'emerald', icon: Package },
  cancelled: { label: 'Cancelada', color: 'red', icon: XCircle }
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  CUP: '₱',
  EUR: '€',
  MLC: '$'
}

export default function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const { theme } = useTheme()
  const [order, setOrder] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invoices, setInvoices] = useState<InvoiceData[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)

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
      setError('Error de conexion')
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

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
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
              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            )}>
              <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {error || 'Orden no encontrada'}
              </h2>
              <Link href="/dashboard/market/purchases">
                <button className="text-blue-500 hover:text-blue-600">
                  Volver a compras
                </button>
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.draft
  const StatusIcon = statusConfig.icon
  const totalItems = order.lines.reduce((sum, line) => sum + line.quantity, 0)

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-5xl mx-auto space-y-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/dashboard/market/purchases">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                    )}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </motion.button>
                </Link>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className={cn(
                      'text-2xl font-bold font-mono',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>{order.purchaseNumber}</h1>
                    <span className={cn(
                      'inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium',
                      statusConfig.color === 'gray' && 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
                      statusConfig.color === 'blue' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                      statusConfig.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                      statusConfig.color === 'emerald' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                      statusConfig.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    )}>
                      <StatusIcon className="w-4 h-4" />
                      {statusConfig.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">Orden de compra</p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => window.print()}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl transition-colors',
                  theme === 'dark'
                    ? 'bg-gray-700 text-white hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </motion.button>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Supplier */}
              <div className={cn(
                'p-5 rounded-2xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
              )}>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Proveedor</h3>
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center',
                    theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'
                  )}>
                    <Truck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{order.supplierName}</p>
                    <p className="text-sm text-gray-500">{order.supplierCode}</p>
                    {order.supplierContact && (
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                        <Phone className="w-3.5 h-3.5" />
                        {order.supplierContact}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className={cn(
                'p-5 rounded-2xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
              )}>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Fechas</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Compra:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatDate(order.purchaseDate)}
                    </span>
                  </div>
                  {order.expectedDate && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Entrega esperada:</span>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {formatDate(order.expectedDate)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Creada:</span>
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {formatDateTime(order.createdAt)}
                    </span>
                  </div>
                  {order.receivedAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Recibida:</span>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {formatDateTime(order.receivedAt)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Totals Summary */}
              <div className={cn(
                'p-5 rounded-2xl border',
                theme === 'dark' ? 'bg-emerald-900/20 border-emerald-800' : 'bg-emerald-50 border-emerald-200'
              )}>
                <h3 className="text-sm font-medium text-emerald-600 mb-3">Resumen</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Productos:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {order.lines.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Unidades:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {totalItems}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-emerald-200 dark:border-emerald-800">
                    <span className="text-sm font-medium text-emerald-600">Total:</span>
                    <span className="text-xl font-bold text-emerald-600">
                      {formatCurrency(order.totalAmount, order.currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Lines Table */}
            <div className={cn(
              'rounded-2xl border overflow-hidden',
              theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
            )}>
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">Productos ({order.lines.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={cn(
                    theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                  )}>
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Producto</th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Recibido</th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">P. Unitario</th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Lote</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {order.lines.map(line => (
                      <tr key={line.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {line.productImageUrl ? (
                              <img
                                src={line.productImageUrl}
                                alt={line.productName}
                                className="w-10 h-10 rounded-lg object-cover"
                              />
                            ) : (
                              <div className={cn(
                                'w-10 h-10 rounded-lg flex items-center justify-center',
                                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                              )}>
                                <Package className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{line.productName}</p>
                              {line.variantName && (
                                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                                  Variante: {line.variantName}
                                </p>
                              )}
                              <p className="text-xs text-gray-500">SKU: {line.variantSku || line.productSku}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-medium text-gray-900 dark:text-white">
                          {line.quantity}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={cn(
                            'font-medium',
                            line.quantityReceived > 0 ? 'text-emerald-600' : 'text-gray-400'
                          )}>
                            {line.quantityReceived}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">
                          {formatCurrency(line.unitPrice, order.currency)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">
                          {formatCurrency(line.totalPrice, order.currency)}
                        </td>
                        <td className="py-3 px-4">
                          {line.lotNumber ? (
                            <div>
                              <p className="text-sm font-mono text-gray-900 dark:text-white">{line.lotNumber}</p>
                              {line.expirationDate && (
                                <p className="text-xs text-gray-500">
                                  Vence: {new Date(line.expirationDate).toLocaleDateString('es-ES')}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Sin lote</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className={cn(
                    theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                  )}>
                    <tr>
                      <td colSpan={4} className="py-3 px-4 text-right font-bold text-gray-900 dark:text-white">
                        Total:
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 text-lg">
                        {formatCurrency(order.totalAmount, order.currency)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className={cn(
                'p-5 rounded-2xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
              )}>
                <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Notas
                </h3>
                <p className="text-gray-700 dark:text-gray-300">{order.notes}</p>
              </div>
            )}

            {/* Invoices */}
            <div className={cn(
              'p-5 rounded-2xl border',
              theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
            )}>
              <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
                <FileUp className="w-4 h-4" />
                Facturas Originales
                {invoices.length > 0 && (
                  <span className={cn(
                    'ml-2 px-2 py-0.5 rounded-full text-xs font-medium',
                    theme === 'dark' ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-600'
                  )}>
                    {invoices.length}
                  </span>
                )}
              </h3>
              {loadingInvoices ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <InvoiceGrid
                  invoices={invoices}
                  onDelete={handleDeleteInvoice}
                  showDelete={true}
                  emptyMessage="No hay facturas adjuntas a esta compra"
                />
              )}
            </div>

            {/* Actions */}
            {(order.status === 'comprada' || order.status === 'pendiente' || order.status === 'confirmed') && (
              <div className={cn(
                'p-5 rounded-2xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
              )}>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Acciones</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Esta compra esta pendiente de recepcion. Registra la llegada de la mercancia.
                </p>
                <Link href={`/dashboard/market/purchases/${order.id}/receive`}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
                  >
                    <Truck className="w-5 h-5" />
                    Recibir Compra
                  </motion.button>
                </Link>
              </div>
            )}
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
