'use client'

import { useEffect, useState, use } from 'react'
import { motion } from 'framer-motion'
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
  FileUp
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { InvoiceGrid, InvoiceData } from '@/components/orders/InvoicePreviewCard'

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
  createdAt: string
  lines: OrderLine[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pendiente', color: 'amber', icon: Clock },
  received: { label: 'Recibida', color: 'blue', icon: Truck },
  selling: { label: 'En Venta', color: 'emerald', icon: TrendingUp },
  paid: { label: 'Pagada', color: 'purple', icon: DollarSign },
  returned: { label: 'Devuelta', color: 'red', icon: RotateCcw },
  liquidated: { label: 'Liquidada', color: 'gray', icon: CheckCircle }
}

export default function ConsignmentOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const { theme } = useTheme()
  const [order, setOrder] = useState<ConsignmentOrder | null>(null)
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
      const data = await response.json()
      if (data.success) {
        setInvoices(data.data.invoices || [])
      }
    } catch (err) {
      console.error('Error fetching invoices:', err)
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
              <Link href="/dashboard/market/consignments">
                <button className="text-blue-500 hover:text-blue-600">
                  Volver a ordenes
                </button>
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
  const StatusIcon = statusConfig.icon

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
                <Link href="/dashboard/market/consignments">
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
                    )}>{order.orderNumber}</h1>
                    <span className={cn(
                      'inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium',
                      statusConfig.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                      statusConfig.color === 'blue' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                      statusConfig.color === 'emerald' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                      statusConfig.color === 'purple' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                      statusConfig.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                      statusConfig.color === 'gray' && 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    )}>
                      <StatusIcon className="w-4 h-4" />
                      {statusConfig.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">Orden de consignacion</p>
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
                    'w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold',
                    theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'
                  )}>
                    {order.supplier.code}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{order.supplier.name}</p>
                    {order.supplier.contactName && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {order.supplier.contactName}
                      </p>
                    )}
                    {order.supplier.phone && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        {order.supplier.phone}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Warehouse */}
              <div className={cn(
                'p-5 rounded-2xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
              )}>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Almacen Destino</h3>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-3 rounded-xl',
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                  )}>
                    <Warehouse className="w-6 h-6 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{order.warehouse.name}</p>
                    <p className="text-sm text-gray-500">{order.warehouse.code}</p>
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
                    <span className="text-sm text-gray-500">Consignacion:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatDate(order.consignmentDate)}
                    </span>
                  </div>
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
            </div>

            {/* Totals */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className={cn(
                'p-4 rounded-xl',
                theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
              )}>
                <p className="text-sm text-gray-500 mb-1">Productos</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{order.totalItems}</p>
              </div>
              <div className={cn(
                'p-4 rounded-xl',
                theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
              )}>
                <p className="text-sm text-gray-500 mb-1">Unidades</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{order.totalUnits}</p>
              </div>
              <div className={cn(
                'p-4 rounded-xl',
                theme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-50'
              )}>
                <p className="text-sm text-blue-600 mb-1">Total Costo</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(order.totalCost)}</p>
              </div>
              <div className={cn(
                'p-4 rounded-xl',
                theme === 'dark' ? 'bg-emerald-900/20' : 'bg-emerald-50'
              )}>
                <p className="text-sm text-emerald-600 mb-1">Vendido</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(order.totalSold)}</p>
              </div>
              <div className={cn(
                'p-4 rounded-xl',
                theme === 'dark' ? 'bg-purple-900/20' : 'bg-purple-50'
              )}>
                <p className="text-sm text-purple-600 mb-1">Pagado</p>
                <p className="text-2xl font-bold text-purple-600">{formatCurrency(order.totalPaid)}</p>
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
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Ordenado</th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Recibido</th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Vendido</th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Costo</th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">P.Venta</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Lote</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {order.lines.map(line => (
                      <tr key={line.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{line.product.name}</p>
                            {line.variantName && (
                              <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                                Variante: {line.variantName}
                              </p>
                            )}
                            <p className="text-xs text-gray-500">SKU: {line.variantSku || line.product.sku}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-medium text-gray-900 dark:text-white">
                          {line.quantityOrdered}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={cn(
                            'font-medium',
                            line.quantityReceived > 0 ? 'text-blue-600' : 'text-gray-400'
                          )}>
                            {line.quantityReceived}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={cn(
                            'font-medium',
                            line.quantitySold > 0 ? 'text-emerald-600' : 'text-gray-400'
                          )}>
                            {line.quantitySold}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">
                          {formatCurrency(line.unitCost)}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">
                          {formatCurrency(line.unitPrice)}
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
                  emptyMessage="No hay facturas adjuntas a esta orden"
                />
              )}
            </div>

            {/* Actions */}
            {order.status === 'pending' && (
              <div className={cn(
                'p-5 rounded-2xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
              )}>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Acciones</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Esta orden esta pendiente de recepcion en almacen. Valida la mercancia desde las operaciones del almacen.
                </p>
                <Link href={`/dashboard/market/warehouses/${order.warehouse.id}/operations`}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
                  >
                    <Truck className="w-5 h-5" />
                    Ir a Recepciones
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
