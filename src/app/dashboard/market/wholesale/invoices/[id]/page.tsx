'use client'

import { useEffect, useState, use } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Receipt,
  CheckCircle,
  Truck,
  DollarSign,
  FileText,
  Clock,
  Printer,
  Download,
  Plus,
  X
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Invoice {
  id: number
  invoiceNumber: string
  customer: {
    id: number
    code: string
    businessName: string
    email: string | null
    phone: string | null
    address: string | null
    city: string | null
    taxId: string | null
  }
  quoteId: number | null
  quoteNumber: string | null
  warehouseId: number | null
  warehouseName: string | null
  status: string
  paymentStatus: string
  subtotal: number
  discountPercent: number
  discountAmount: number
  totalAmount: number
  amountPaid: number
  amountDue: number
  currency: string
  dueDate: string | null
  notes: string | null
  internalNotes: string | null
  createdBy: string
  createdAt: string
  confirmedAt: string | null
  deliveredAt: string | null
  paidAt: string | null
  lines: Array<{
    id: number
    productId: number
    productName: string
    productSku: string | null
    quantity: number
    quantityDelivered: number
    unitPrice: number
    discountPercent: number
    discountAmount: number
    subtotal: number
  }>
  deliveries: Array<{
    id: number
    deliveryNumber: string
    status: string
    deliveryDate: string | null
    createdAt: string
  }>
  payments: Array<{
    id: number
    paymentNumber: string
    amount: number
    paymentMethod: string
    paymentDate: string
    reference: string | null
  }>
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { theme } = useTheme()
  const router = useRouter()
  const searchParams = useSearchParams()
  const resolvedParams = use(params)
  const invoiceId = resolvedParams.id

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'details')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentData, setPaymentData] = useState({
    amount: '',
    paymentMethod: 'cash',
    reference: '',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: ''
  })
  const [savingPayment, setSavingPayment] = useState(false)

  useEffect(() => {
    fetchInvoice()
  }, [invoiceId])

  const fetchInvoice = async () => {
    try {
      const response = await fetch(`/api/market/wholesale/invoices/${invoiceId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setInvoice(result.data)
          setPaymentData(prev => ({
            ...prev,
            amount: result.data.amountDue.toFixed(2)
          }))
        }
      }
    } catch (error) {
      console.error('Error fetching invoice:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!confirm('¿Confirmar esta factura?')) return

    try {
      const response = await fetch(`/api/market/wholesale/invoices/${invoiceId}/confirm`, {
        method: 'POST'
      })
      if (response.ok) {
        fetchInvoice()
      }
    } catch (error) {
      console.error('Error confirming invoice:', error)
    }
  }

  const handleRegisterPayment = async () => {
    setSavingPayment(true)
    try {
      const response = await fetch(`/api/market/wholesale/invoices/${invoiceId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(paymentData.amount),
          paymentMethod: paymentData.paymentMethod,
          reference: paymentData.reference || null,
          paymentDate: paymentData.paymentDate,
          notes: paymentData.notes || null
        })
      })

      if (response.ok) {
        setShowPaymentModal(false)
        setPaymentData({
          amount: '',
          paymentMethod: 'cash',
          reference: '',
          paymentDate: new Date().toISOString().split('T')[0],
          notes: ''
        })
        fetchInvoice()
      }
    } catch (error) {
      console.error('Error registering payment:', error)
    } finally {
      setSavingPayment(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const statusConfig: Record<string, { label: string; color: string }> = {
    draft: { label: 'Borrador', color: 'gray' },
    confirmed: { label: 'Confirmada', color: 'blue' },
    partial_delivery: { label: 'Entrega Parcial', color: 'yellow' },
    delivered: { label: 'Entregada', color: 'green' },
    cancelled: { label: 'Cancelada', color: 'red' }
  }

  const paymentStatusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pendiente', color: 'yellow' },
    partial: { label: 'Parcial', color: 'orange' },
    paid: { label: 'Pagado', color: 'green' },
    overdue: { label: 'Vencido', color: 'red' }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (!invoice) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6 flex flex-col items-center justify-center">
            <Receipt className="w-16 h-16 text-gray-400 mb-4" />
            <p className="text-xl font-medium">Factura no encontrada</p>
            <Link href="/dashboard/market/wholesale/invoices" className="mt-4 text-blue-500">
              Volver a facturas
            </Link>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const sConfig = statusConfig[invoice.status] || statusConfig.draft
  const pConfig = paymentStatusConfig[invoice.paymentStatus] || paymentStatusConfig.pending

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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/dashboard/market/wholesale/invoices">
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
                      'text-2xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Factura {invoice.invoiceNumber}
                    </h1>
                    <span className={cn(
                      'px-3 py-1 rounded-full text-sm font-medium',
                      sConfig.color === 'green'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : sConfig.color === 'blue'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : sConfig.color === 'yellow'
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : sConfig.color === 'red'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                    )}>
                      {sConfig.label}
                    </span>
                  </div>
                  <p className={cn(
                    'text-sm mt-1',
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    {invoice.customer.businessName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg border',
                    theme === 'dark'
                      ? 'border-gray-700 text-gray-300 hover:bg-gray-800'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <Printer className="w-4 h-4" />
                  Imprimir
                </motion.button>
                {invoice.status === 'draft' && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleConfirm}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Confirmar
                  </motion.button>
                )}
                {invoice.paymentStatus !== 'paid' && invoice.status !== 'cancelled' && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowPaymentModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg"
                  >
                    <DollarSign className="w-4 h-4" />
                    Registrar Pago
                  </motion.button>
                )}
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className={cn(
                'p-4 rounded-xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
              )}>
                <p className="text-sm text-gray-500">Total</p>
                <p className={cn(
                  'text-2xl font-bold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>{formatCurrency(invoice.totalAmount)}</p>
              </div>
              <div className={cn(
                'p-4 rounded-xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
              )}>
                <p className="text-sm text-gray-500">Pagado</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(invoice.amountPaid)}</p>
              </div>
              <div className={cn(
                'p-4 rounded-xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
              )}>
                <p className="text-sm text-gray-500">Pendiente</p>
                <p className={cn(
                  'text-2xl font-bold',
                  invoice.amountDue > 0 ? 'text-amber-600' : 'text-green-600'
                )}>{formatCurrency(invoice.amountDue)}</p>
              </div>
              <div className={cn(
                'p-4 rounded-xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
              )}>
                <p className="text-sm text-gray-500">Estado de Pago</p>
                <span className={cn(
                  'inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium',
                  pConfig.color === 'green'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : pConfig.color === 'yellow'
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : pConfig.color === 'orange'
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                )}>
                  {pConfig.label}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className={cn(
              'rounded-2xl border shadow-xl overflow-hidden',
              theme === 'dark'
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
            )}>
              <div className={cn(
                'flex border-b',
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              )}>
                {[
                  { id: 'details', label: 'Detalles', icon: FileText },
                  { id: 'deliveries', label: 'Entregas', icon: Truck },
                  { id: 'payments', label: 'Pagos', icon: DollarSign },
                  { id: 'history', label: 'Historial', icon: Clock }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-2 px-6 py-4 font-medium transition-colors',
                      activeTab === tab.id
                        ? 'text-blue-500 border-b-2 border-blue-500'
                        : theme === 'dark'
                          ? 'text-gray-400 hover:text-white'
                          : 'text-gray-500 hover:text-gray-900'
                    )}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {activeTab === 'details' && (
                  <div className="space-y-6">
                    {/* Customer Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="font-medium mb-3">Información del Cliente</h3>
                        <div className={cn(
                          'p-4 rounded-lg',
                          theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
                        )}>
                          <p className="font-semibold">{invoice.customer.businessName}</p>
                          <p className="text-sm text-gray-500">{invoice.customer.code}</p>
                          {invoice.customer.taxId && (
                            <p className="text-sm mt-2">RUC: {invoice.customer.taxId}</p>
                          )}
                          {invoice.customer.address && (
                            <p className="text-sm text-gray-500 mt-1">{invoice.customer.address}</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <h3 className="font-medium mb-3">Información de la Factura</h3>
                        <div className={cn(
                          'p-4 rounded-lg',
                          theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
                        )}>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <p className="text-gray-500">Fecha:</p>
                            <p>{formatDate(invoice.createdAt)}</p>
                            {invoice.dueDate && (
                              <>
                                <p className="text-gray-500">Vencimiento:</p>
                                <p>{formatDate(invoice.dueDate)}</p>
                              </>
                            )}
                            {invoice.quoteNumber && (
                              <>
                                <p className="text-gray-500">Cotización:</p>
                                <p>{invoice.quoteNumber}</p>
                              </>
                            )}
                            {invoice.warehouseName && (
                              <>
                                <p className="text-gray-500">Almacén:</p>
                                <p>{invoice.warehouseName}</p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Products */}
                    <div>
                      <h3 className="font-medium mb-3">Productos</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className={cn(
                              'border-b text-left',
                              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                            )}>
                              <th className="py-3 px-4 text-sm font-medium text-gray-500">Producto</th>
                              <th className="py-3 px-4 text-sm font-medium text-gray-500 text-center">Cantidad</th>
                              <th className="py-3 px-4 text-sm font-medium text-gray-500 text-right">P. Unit</th>
                              <th className="py-3 px-4 text-sm font-medium text-gray-500 text-center">Desc.</th>
                              <th className="py-3 px-4 text-sm font-medium text-gray-500 text-right">Subtotal</th>
                              <th className="py-3 px-4 text-sm font-medium text-gray-500 text-center">Entregado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoice.lines.map(line => (
                              <tr key={line.id} className={cn(
                                'border-b',
                                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                              )}>
                                <td className="py-3 px-4">
                                  <p className="font-medium">{line.productName}</p>
                                  {line.productSku && (
                                    <p className="text-xs text-gray-500">{line.productSku}</p>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center">{line.quantity}</td>
                                <td className="py-3 px-4 text-right">{formatCurrency(line.unitPrice)}</td>
                                <td className="py-3 px-4 text-center">
                                  {line.discountPercent > 0 && (
                                    <span className="text-green-600">-{line.discountPercent}%</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right font-medium">{formatCurrency(line.subtotal)}</td>
                                <td className="py-3 px-4 text-center">
                                  <span className={cn(
                                    'text-sm',
                                    line.quantityDelivered >= line.quantity
                                      ? 'text-green-600'
                                      : line.quantityDelivered > 0
                                        ? 'text-yellow-600'
                                        : 'text-gray-500'
                                  )}>
                                    {line.quantityDelivered}/{line.quantity}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className={cn(
                              'border-t-2',
                              theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
                            )}>
                              <td colSpan={4} className="py-3 px-4 text-right font-medium">Subtotal:</td>
                              <td className="py-3 px-4 text-right font-medium">{formatCurrency(invoice.subtotal)}</td>
                              <td></td>
                            </tr>
                            {invoice.discountPercent > 0 && (
                              <tr>
                                <td colSpan={4} className="py-2 px-4 text-right text-green-600">
                                  Descuento ({invoice.discountPercent}%):
                                </td>
                                <td className="py-2 px-4 text-right text-green-600">
                                  -{formatCurrency(invoice.discountAmount)}
                                </td>
                                <td></td>
                              </tr>
                            )}
                            <tr className="text-lg font-bold">
                              <td colSpan={4} className="py-3 px-4 text-right">Total:</td>
                              <td className="py-3 px-4 text-right text-green-600">{formatCurrency(invoice.totalAmount)}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    {/* Notes */}
                    {(invoice.notes || invoice.internalNotes) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {invoice.notes && (
                          <div>
                            <h3 className="font-medium mb-2">Notas</h3>
                            <p className="text-sm text-gray-500">{invoice.notes}</p>
                          </div>
                        )}
                        {invoice.internalNotes && (
                          <div>
                            <h3 className="font-medium mb-2">Notas Internas</h3>
                            <p className="text-sm text-gray-500">{invoice.internalNotes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'deliveries' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Entregas</h3>
                      {invoice.status === 'confirmed' && (
                        <Link href={`/dashboard/market/wholesale/invoices/${invoice.id}/delivery`}>
                          <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm">
                            <Plus className="w-4 h-4" />
                            Nueva Entrega
                          </button>
                        </Link>
                      )}
                    </div>
                    {invoice.deliveries.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">No hay entregas registradas</p>
                    ) : (
                      <div className="space-y-3">
                        {invoice.deliveries.map(delivery => (
                          <div key={delivery.id} className={cn(
                            'p-4 rounded-lg border',
                            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                          )}>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{delivery.deliveryNumber}</p>
                                <p className="text-sm text-gray-500">{formatDate(delivery.createdAt)}</p>
                              </div>
                              <span className={cn(
                                'px-3 py-1 rounded-full text-sm',
                                delivery.status === 'delivered'
                                  ? 'bg-green-100 text-green-700'
                                  : delivery.status === 'dispatched'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-yellow-100 text-yellow-700'
                              )}>
                                {delivery.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'payments' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Pagos</h3>
                      {invoice.paymentStatus !== 'paid' && (
                        <button
                          onClick={() => setShowPaymentModal(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          Registrar Pago
                        </button>
                      )}
                    </div>
                    {invoice.payments.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">No hay pagos registrados</p>
                    ) : (
                      <div className="space-y-3">
                        {invoice.payments.map(payment => (
                          <div key={payment.id} className={cn(
                            'p-4 rounded-lg border',
                            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                          )}>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{payment.paymentNumber}</p>
                                <p className="text-sm text-gray-500">
                                  {payment.paymentMethod} - {formatDate(payment.paymentDate)}
                                </p>
                                {payment.reference && (
                                  <p className="text-xs text-gray-400">Ref: {payment.reference}</p>
                                )}
                              </div>
                              <p className="text-lg font-bold text-green-600">{formatCurrency(payment.amount)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="space-y-4">
                    <h3 className="font-medium">Historial de la Factura</h3>
                    <div className="space-y-3">
                      <div className={cn(
                        'p-3 rounded-lg',
                        theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
                      )}>
                        <p className="text-sm">Factura creada</p>
                        <p className="text-xs text-gray-500">{formatDate(invoice.createdAt)} por {invoice.createdBy}</p>
                      </div>
                      {invoice.confirmedAt && (
                        <div className={cn(
                          'p-3 rounded-lg',
                          theme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-50'
                        )}>
                          <p className="text-sm text-blue-600">Factura confirmada</p>
                          <p className="text-xs text-gray-500">{formatDate(invoice.confirmedAt)}</p>
                        </div>
                      )}
                      {invoice.deliveredAt && (
                        <div className={cn(
                          'p-3 rounded-lg',
                          theme === 'dark' ? 'bg-green-900/20' : 'bg-green-50'
                        )}>
                          <p className="text-sm text-green-600">Entrega completada</p>
                          <p className="text-xs text-gray-500">{formatDate(invoice.deliveredAt)}</p>
                        </div>
                      )}
                      {invoice.paidAt && (
                        <div className={cn(
                          'p-3 rounded-lg',
                          theme === 'dark' ? 'bg-green-900/20' : 'bg-green-50'
                        )}>
                          <p className="text-sm text-green-600">Pago completado</p>
                          <p className="text-xs text-gray-500">{formatDate(invoice.paidAt)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Payment Modal */}
          {showPaymentModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  'rounded-2xl shadow-2xl max-w-md w-full',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                )}
              >
                <div className={cn(
                  'p-6 border-b flex items-center justify-between',
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                )}>
                  <h2 className={cn(
                    'text-xl font-bold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Registrar Pago</h2>
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Monto ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={paymentData.amount}
                      onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                      className={cn(
                        'w-full px-4 py-2 rounded-lg border',
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      )}
                    />
                    <p className="text-xs text-gray-500 mt-1">Pendiente: {formatCurrency(invoice.amountDue)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Método de Pago</label>
                    <select
                      value={paymentData.paymentMethod}
                      onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
                      className={cn(
                        'w-full px-4 py-2 rounded-lg border',
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      )}
                    >
                      <option value="cash">Efectivo</option>
                      <option value="transfer">Transferencia</option>
                      <option value="check">Cheque</option>
                      <option value="credit">Crédito</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Referencia</label>
                    <input
                      type="text"
                      value={paymentData.reference}
                      onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                      placeholder="Número de transferencia, cheque, etc."
                      className={cn(
                        'w-full px-4 py-2 rounded-lg border',
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Fecha de Pago</label>
                    <input
                      type="date"
                      value={paymentData.paymentDate}
                      onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                      className={cn(
                        'w-full px-4 py-2 rounded-lg border',
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      )}
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setShowPaymentModal(false)}
                      className={cn(
                        'flex-1 py-2.5 px-4 rounded-lg font-medium border',
                        theme === 'dark'
                          ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleRegisterPayment}
                      disabled={savingPayment || !paymentData.amount}
                      className="flex-1 py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50"
                    >
                      {savingPayment ? 'Guardando...' : 'Registrar Pago'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
