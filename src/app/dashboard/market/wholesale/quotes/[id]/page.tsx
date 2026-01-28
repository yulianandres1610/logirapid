'use client'

import { useEffect, useState, use } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  FileText,
  CheckCircle,
  Send,
  Receipt,
  Clock,
  Printer,
  Download,
  X
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Quote {
  id: number
  quoteNumber: string
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
  warehouseId: number | null
  warehouseName: string | null
  status: string
  subtotal: number
  discountPercent: number
  discountAmount: number
  totalAmount: number
  currency: string
  validUntil: string | null
  notes: string | null
  internalNotes: string | null
  convertedToInvoiceId: number | null
  createdBy: string
  createdAt: string
  sentAt: string | null
  acceptedAt: string | null
  lines: Array<{
    id: number
    productId: number
    productName: string
    productSku: string | null
    quantity: number
    unitPrice: number
    originalPrice: number | null
    discountPercent: number
    discountAmount: number
    subtotal: number
  }>
}

export default function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { theme } = useTheme()
  const router = useRouter()
  const searchParams = useSearchParams()
  const resolvedParams = use(params)
  const quoteId = resolvedParams.id

  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'details')
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [converting, setConverting] = useState(false)

  useEffect(() => {
    fetchQuote()
  }, [quoteId])

  const fetchQuote = async () => {
    try {
      const response = await fetch(`/api/market/wholesale/quotes/${quoteId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setQuote(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching quote:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    if (!confirm('¿Enviar esta cotización al cliente?')) return

    try {
      const response = await fetch(`/api/market/wholesale/quotes/${quoteId}/send`, {
        method: 'POST'
      })
      if (response.ok) {
        fetchQuote()
      }
    } catch (error) {
      console.error('Error sending quote:', error)
    }
  }

  const handleConvert = async () => {
    setConverting(true)
    try {
      const response = await fetch(`/api/market/wholesale/quotes/${quoteId}/convert`, {
        method: 'POST'
      })
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          router.push(`/dashboard/market/wholesale/invoices/${result.data.invoiceId}`)
        }
      }
    } catch (error) {
      console.error('Error converting quote:', error)
    } finally {
      setConverting(false)
      setShowConvertModal(false)
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
    sent: { label: 'Enviada', color: 'blue' },
    accepted: { label: 'Aceptada', color: 'green' },
    rejected: { label: 'Rechazada', color: 'red' },
    expired: { label: 'Vencida', color: 'orange' },
    converted: { label: 'Convertida', color: 'purple' }
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

  if (!quote) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6 flex flex-col items-center justify-center">
            <FileText className="w-16 h-16 text-gray-400 mb-4" />
            <p className="text-xl font-medium">Cotización no encontrada</p>
            <Link href="/dashboard/market/wholesale/quotes" className="mt-4 text-blue-500">
              Volver a cotizaciones
            </Link>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const sConfig = statusConfig[quote.status] || statusConfig.draft

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
                <Link href="/dashboard/market/wholesale/quotes">
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
                      Cotización {quote.quoteNumber}
                    </h1>
                    <span className={cn(
                      'px-3 py-1 rounded-full text-sm font-medium',
                      sConfig.color === 'green'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : sConfig.color === 'blue'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : sConfig.color === 'purple'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                            : sConfig.color === 'orange'
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
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
                    {quote.customer.businessName}
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
                {quote.status === 'draft' && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSend}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                  >
                    <Send className="w-4 h-4" />
                    Enviar
                  </motion.button>
                )}
                {(quote.status === 'sent' || quote.status === 'accepted') && !quote.convertedToInvoiceId && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowConvertModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg"
                  >
                    <Receipt className="w-4 h-4" />
                    Convertir a Factura
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
                )}>{formatCurrency(quote.totalAmount)}</p>
              </div>
              <div className={cn(
                'p-4 rounded-xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
              )}>
                <p className="text-sm text-gray-500">Productos</p>
                <p className={cn(
                  'text-2xl font-bold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>{quote.lines.length}</p>
              </div>
              <div className={cn(
                'p-4 rounded-xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
              )}>
                <p className="text-sm text-gray-500">Descuento</p>
                <p className="text-2xl font-bold text-green-600">
                  {quote.discountPercent > 0 ? `${quote.discountPercent}%` : '-'}
                </p>
              </div>
              <div className={cn(
                'p-4 rounded-xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
              )}>
                <p className="text-sm text-gray-500">Válida Hasta</p>
                <p className={cn(
                  'text-lg font-bold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  {quote.validUntil ? formatDate(quote.validUntil) : 'Sin fecha'}
                </p>
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
                          <p className="font-semibold">{quote.customer.businessName}</p>
                          <p className="text-sm text-gray-500">{quote.customer.code}</p>
                          {quote.customer.taxId && (
                            <p className="text-sm mt-2">RUC: {quote.customer.taxId}</p>
                          )}
                          {quote.customer.address && (
                            <p className="text-sm text-gray-500 mt-1">{quote.customer.address}</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <h3 className="font-medium mb-3">Información de la Cotización</h3>
                        <div className={cn(
                          'p-4 rounded-lg',
                          theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
                        )}>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <p className="text-gray-500">Fecha:</p>
                            <p>{formatDate(quote.createdAt)}</p>
                            {quote.validUntil && (
                              <>
                                <p className="text-gray-500">Válida hasta:</p>
                                <p>{formatDate(quote.validUntil)}</p>
                              </>
                            )}
                            {quote.warehouseName && (
                              <>
                                <p className="text-gray-500">Almacén:</p>
                                <p>{quote.warehouseName}</p>
                              </>
                            )}
                            {quote.convertedToInvoiceId && (
                              <>
                                <p className="text-gray-500">Factura:</p>
                                <Link
                                  href={`/dashboard/market/wholesale/invoices/${quote.convertedToInvoiceId}`}
                                  className="text-blue-500 hover:underline"
                                >
                                  Ver factura
                                </Link>
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
                            </tr>
                          </thead>
                          <tbody>
                            {quote.lines.map(line => (
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
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className={cn(
                              'border-t-2',
                              theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
                            )}>
                              <td colSpan={4} className="py-3 px-4 text-right font-medium">Subtotal:</td>
                              <td className="py-3 px-4 text-right font-medium">{formatCurrency(quote.subtotal)}</td>
                            </tr>
                            {quote.discountPercent > 0 && (
                              <tr>
                                <td colSpan={4} className="py-2 px-4 text-right text-green-600">
                                  Descuento ({quote.discountPercent}%):
                                </td>
                                <td className="py-2 px-4 text-right text-green-600">
                                  -{formatCurrency(quote.discountAmount)}
                                </td>
                              </tr>
                            )}
                            <tr className="text-lg font-bold">
                              <td colSpan={4} className="py-3 px-4 text-right">Total:</td>
                              <td className="py-3 px-4 text-right text-green-600">{formatCurrency(quote.totalAmount)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    {/* Notes */}
                    {(quote.notes || quote.internalNotes) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {quote.notes && (
                          <div>
                            <h3 className="font-medium mb-2">Notas</h3>
                            <p className="text-sm text-gray-500">{quote.notes}</p>
                          </div>
                        )}
                        {quote.internalNotes && (
                          <div>
                            <h3 className="font-medium mb-2">Notas Internas</h3>
                            <p className="text-sm text-gray-500">{quote.internalNotes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="space-y-4">
                    <h3 className="font-medium">Historial de la Cotización</h3>
                    <div className="space-y-3">
                      <div className={cn(
                        'p-3 rounded-lg',
                        theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
                      )}>
                        <p className="text-sm">Cotización creada</p>
                        <p className="text-xs text-gray-500">{formatDate(quote.createdAt)} por {quote.createdBy}</p>
                      </div>
                      {quote.sentAt && (
                        <div className={cn(
                          'p-3 rounded-lg',
                          theme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-50'
                        )}>
                          <p className="text-sm text-blue-600">Cotización enviada al cliente</p>
                          <p className="text-xs text-gray-500">{formatDate(quote.sentAt)}</p>
                        </div>
                      )}
                      {quote.acceptedAt && (
                        <div className={cn(
                          'p-3 rounded-lg',
                          theme === 'dark' ? 'bg-green-900/20' : 'bg-green-50'
                        )}>
                          <p className="text-sm text-green-600">Cotización aceptada</p>
                          <p className="text-xs text-gray-500">{formatDate(quote.acceptedAt)}</p>
                        </div>
                      )}
                      {quote.convertedToInvoiceId && (
                        <div className={cn(
                          'p-3 rounded-lg',
                          theme === 'dark' ? 'bg-purple-900/20' : 'bg-purple-50'
                        )}>
                          <p className="text-sm text-purple-600">Convertida a factura</p>
                          <Link
                            href={`/dashboard/market/wholesale/invoices/${quote.convertedToInvoiceId}`}
                            className="text-xs text-purple-500 hover:underline"
                          >
                            Ver factura
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Convert Modal */}
          {showConvertModal && (
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
                  )}>Convertir a Factura</h2>
                  <button
                    onClick={() => setShowConvertModal(false)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <p className={cn(
                    'text-sm',
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  )}>
                    ¿Estás seguro de que deseas convertir esta cotización en factura?
                  </p>
                  <div className={cn(
                    'p-4 rounded-lg',
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                  )}>
                    <p className="text-sm"><strong>Cliente:</strong> {quote.customer.businessName}</p>
                    <p className="text-sm"><strong>Total:</strong> {formatCurrency(quote.totalAmount)}</p>
                    <p className="text-sm"><strong>Productos:</strong> {quote.lines.length} items</p>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setShowConvertModal(false)}
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
                      onClick={handleConvert}
                      disabled={converting}
                      className="flex-1 py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50"
                    >
                      {converting ? 'Convirtiendo...' : 'Convertir'}
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
