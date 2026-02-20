'use client'

import { useEffect, useState, use } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Receipt,
  CheckCircle,
  Truck,
  DollarSign,
  FileText,
  Clock,
  Printer,
  Plus,
  X,
  Package,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building2,
  CreditCard,
  Warehouse,
  FileDown,
  History
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface InvoiceLine {
  id: number
  productId: number
  variantId: number | null
  productName: string
  productSku: string | null
  productImage: string | null
  quantity: number
  quantityDelivered: number
  unitPrice: number
  costPrice: number
  originalPrice: number
  discountPercent: number
  discountAmount: number
  subtotal: number
  warehouseQuantities: Record<string, number>
  notes: string | null
}

interface DeliveryLine {
  id: number
  productId: number
  productName: string
  productSku: string | null
  quantity: number
  quantityDelivered: number
}

interface Delivery {
  id: number
  deliveryNumber: string
  warehouseId: number | null
  warehouseName: string | null
  status: string
  deliveryDate: string | null
  deliveryAddress: string | null
  notes: string | null
  createdBy: string | null
  createdByEmail: string | null
  createdAt: string
  dispatchedAt: string | null
  dispatchedBy: string | null
  dispatchedByEmail: string | null
  deliveredAt: string | null
  deliveredBy: string | null
  deliveredByEmail: string | null
  lines: DeliveryLine[]
}

interface Payment {
  id: number
  paymentNumber: string
  amount: number
  currency: string
  paymentMethod: string
  reference: string | null
  paymentDate: string
  notes: string | null
  createdBy: string | null
  createdAt: string
}

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
  pricelistId: number | null
  pricelistName: string | null
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
  downpaymentType: string | null
  downpaymentValue: number | null
  downpaymentAmount: number | null
  wholesaleExchangeRate: number | null
  createdBy: string
  createdAt: string
  updatedAt: string
  confirmedAt: string | null
  deliveredAt: string | null
  paidAt: string | null
  lines: InvoiceLine[]
  deliveries: Delivery[]
  payments: Payment[]
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
  confirmed: {
    label: 'Confirmada',
    color: 'blue',
    bgGradient: 'from-blue-500 to-cyan-500',
    icon: CheckCircle,
    step: 1
  },
  partial_delivery: {
    label: 'Entrega Parcial',
    color: 'amber',
    bgGradient: 'from-amber-500 to-orange-500',
    icon: Truck,
    step: 2
  },
  delivered: {
    label: 'Entregada',
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

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pendiente', color: 'amber', icon: Clock },
  partial: { label: 'Parcial', color: 'orange', icon: DollarSign },
  paid: { label: 'Pagado', color: 'emerald', icon: CheckCircle },
  overdue: { label: 'Vencido', color: 'red', icon: AlertCircle }
}

const DELIVERY_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'gray' },
  dispatched: { label: 'Despachada', color: 'blue' },
  in_transit: { label: 'En Tránsito', color: 'amber' },
  delivered: { label: 'Entregada', color: 'emerald' },
  cancelled: { label: 'Cancelada', color: 'red' }
}

const LIFECYCLE_STEPS = [
  { key: 'draft', label: 'Borrador', icon: FileText },
  { key: 'confirmed', label: 'Confirmada', icon: CheckCircle },
  { key: 'partial_delivery', label: 'En Entrega', icon: Truck },
  { key: 'delivered', label: 'Entregada', icon: Package }
]

const PAYMENT_METHODS: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  check: 'Cheque',
  credit: 'Crédito',
  zelle: 'Zelle',
  other: 'Otro'
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

  // Update URL when tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tab)
    router.push(url.pathname + url.search, { scroll: false })
  }

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentData, setPaymentData] = useState({
    amount: '',
    paymentMethod: 'cash',
    reference: '',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: ''
  })
  const [savingPayment, setSavingPayment] = useState(false)
  const [confirming, setConfirming] = useState(false)

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
    if (!confirm('¿Confirmar esta factura y crear entrega?')) return

    setConfirming(true)
    try {
      const response = await fetch(`/api/market/wholesale/invoices/${invoiceId}/confirm`, {
        method: 'POST'
      })
      const result = await response.json()
      if (!response.ok) {
        alert(result.error || 'Error al confirmar factura')
      }
      fetchInvoice()
    } catch (error) {
      console.error('Error confirming invoice:', error)
    } finally {
      setConfirming(false)
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

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatDateTime = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Calculate delivery progress
  const calculateDeliveryProgress = () => {
    if (!invoice) return { progress: 0, delivered: 0, total: 0 }

    const total = invoice.lines.reduce((sum, line) => sum + line.quantity, 0)
    const delivered = invoice.lines.reduce((sum, line) => sum + (line.quantityDelivered || 0), 0)
    const progress = total > 0 ? (delivered / total) * 100 : 0

    return { progress, delivered, total }
  }

  // Get current lifecycle step based on status
  const getCurrentStep = () => {
    if (!invoice) return 0
    const step = STATUS_CONFIG[invoice.status]?.step || 0
    return step
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

  if (!invoice) {
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
                <Receipt className="w-8 h-8 text-red-500" />
              </div>
              <h2 className={cn(
                'text-xl font-bold mb-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Factura no encontrada
              </h2>
              <p className="text-gray-500 mb-6">No pudimos cargar los detalles de esta factura.</p>
              <Link href="/dashboard/market/wholesale/invoices">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver a facturas
                </motion.button>
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const statusConfig = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft
  const paymentConfig = PAYMENT_STATUS_CONFIG[invoice.paymentStatus] || PAYMENT_STATUS_CONFIG.pending
  const StatusIcon = statusConfig.icon
  const PaymentIcon = paymentConfig.icon
  const deliveryMetrics = calculateDeliveryProgress()
  const currentStep = getCurrentStep()
  const totalItems = invoice.lines.length
  const totalUnits = invoice.lines.reduce((sum, line) => sum + line.quantity, 0)

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          {/* Header Section */}
          <div className="max-w-6xl mx-auto mb-8">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-6">
              <Link href="/dashboard/market/wholesale/invoices">
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
                {/* Print Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => window.open(`/dashboard/market/wholesale/invoices/${invoice.id}/print?format=letter`, '_blank')}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl transition-colors',
                    theme === 'dark'
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                  title="Imprimir factura"
                >
                  <Printer className="w-4 h-4" />
                  <span className="font-medium text-sm hidden sm:inline">Imprimir</span>
                </motion.button>

                {/* Confirm Button - show when no deliveries exist and invoice not delivered/cancelled */}
                {invoice.deliveries.length === 0 && invoice.status !== 'delivered' && invoice.status !== 'cancelled' && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleConfirm}
                    disabled={confirming}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50"
                  >
                    {confirming ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Confirmar
                  </motion.button>
                )}

                {/* Register Payment Button */}
                {invoice.paymentStatus !== 'paid' && invoice.status !== 'cancelled' && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowPaymentModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium"
                  >
                    <DollarSign className="w-4 h-4" />
                    Registrar Pago
                  </motion.button>
                )}
              </div>
            </div>

            {/* Invoice Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'p-6 rounded-2xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                {/* Left: Invoice Info */}
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
                        {invoice.invoiceNumber}
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
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium',
                        paymentConfig.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                        paymentConfig.color === 'orange' && 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                        paymentConfig.color === 'emerald' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                        paymentConfig.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}>
                        <PaymentIcon className="w-3.5 h-3.5" />
                        {paymentConfig.label}
                      </span>
                    </div>
                    <p className={cn(
                      'text-lg font-medium',
                      theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
                    )}>
                      {invoice.customer.businessName}
                    </p>
                    <p className="text-sm text-gray-500">
                      Cliente: {invoice.customer.code} | Creada: {formatDate(invoice.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Right: Total Amount */}
                <div className="text-right">
                  <p className="text-sm text-gray-500 mb-1">Total Factura</p>
                  <p className={cn(
                    'text-3xl font-bold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {formatCurrency(invoice.totalAmount)}
                  </p>
                  {invoice.amountDue > 0 && invoice.amountDue < invoice.totalAmount && (
                    <p className="text-sm text-amber-500 mt-1">
                      Pendiente: {formatCurrency(invoice.amountDue)}
                    </p>
                  )}
                </div>
              </div>

              {/* Lifecycle Progress */}
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  {LIFECYCLE_STEPS.map((step, index) => {
                    const StepIcon = step.icon
                    const isCompleted = currentStep > index
                    const isCurrent = currentStep === index

                    return (
                      <div key={step.key} className="flex-1 flex items-center">
                        <div className="flex flex-col items-center flex-1">
                          <motion.div
                            initial={false}
                            animate={{
                              scale: isCurrent ? 1.1 : 1,
                              backgroundColor: isCompleted || isCurrent
                                ? theme === 'dark' ? '#10B981' : '#059669'
                                : theme === 'dark' ? '#374151' : '#E5E7EB'
                            }}
                            className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center mb-2",
                              (isCompleted || isCurrent) && 'shadow-lg shadow-emerald-500/25'
                            )}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="w-5 h-5 text-white" />
                            ) : (
                              <StepIcon className={cn(
                                "w-5 h-5",
                                isCurrent ? 'text-white' : 'text-gray-500'
                              )} />
                            )}
                          </motion.div>
                          <span className={cn(
                            "text-xs font-medium text-center",
                            (isCompleted || isCurrent)
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-gray-500'
                          )}>
                            {step.label}
                          </span>
                        </div>
                        {index < LIFECYCLE_STEPS.length - 1 && (
                          <div className="flex-1 h-0.5 mx-2 mb-6">
                            <div className={cn(
                              "h-full rounded-full",
                              isCompleted
                                ? 'bg-emerald-500'
                                : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                            )} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Main Content */}
          <div className="max-w-6xl mx-auto">
            {/* Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {[
                { key: 'details', label: 'Detalles', icon: FileText },
                { key: 'deliveries', label: 'Entregas', icon: Truck, count: invoice.deliveries.length },
                { key: 'payments', label: 'Pagos', icon: CreditCard, count: invoice.payments.length }
              ].map(tab => {
                const TabIcon = tab.icon
                return (
                  <motion.button
                    key={tab.key}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleTabChange(tab.key)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap',
                      activeTab === tab.key
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                        : theme === 'dark'
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    <TabIcon className="w-4 h-4" />
                    {tab.label}
                    {tab.count !== undefined && tab.count > 0 && (
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-xs',
                        activeTab === tab.key
                          ? 'bg-white/20'
                          : 'bg-gray-200 dark:bg-gray-700'
                      )}>
                        {tab.count}
                      </span>
                    )}
                  </motion.button>
                )
              })}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              {activeTab === 'details' && (
                <motion.div
                  key="details"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                    )}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                        )}>
                          <Package className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Productos</p>
                          <p className={cn(
                            'text-xl font-bold',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>{totalItems}</p>
                        </div>
                      </div>
                    </div>

                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                    )}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                        )}>
                          <History className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Unidades</p>
                          <p className={cn(
                            'text-xl font-bold',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>{totalUnits}</p>
                        </div>
                      </div>
                    </div>

                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                    )}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-100'
                        )}>
                          <Truck className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Entregado</p>
                          <p className={cn(
                            'text-xl font-bold',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>{deliveryMetrics.progress.toFixed(0)}%</p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${deliveryMetrics.progress}%` }}
                          className="h-full bg-emerald-500 rounded-full"
                        />
                      </div>
                    </div>

                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                    )}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100'
                        )}>
                          <DollarSign className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Por Cobrar</p>
                          <p className={cn(
                            'text-xl font-bold',
                            invoice.amountDue > 0 ? 'text-amber-500' : 'text-emerald-500'
                          )}>{formatCurrency(invoice.amountDue)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Customer & Warehouse Info */}
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Customer Card */}
                    <div className={cn(
                      'p-6 rounded-xl border',
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                    )}>
                      <h3 className={cn(
                        'font-semibold mb-4 flex items-center gap-2',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <Building2 className="w-5 h-5 text-blue-500" />
                        Cliente
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <p className={cn(
                            'font-medium text-lg',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {invoice.customer.businessName}
                          </p>
                          <p className="text-sm text-gray-500 font-mono">{invoice.customer.code}</p>
                        </div>
                        {invoice.customer.taxId && (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <FileText className="w-4 h-4" />
                            RNC/Cédula: {invoice.customer.taxId}
                          </div>
                        )}
                        {invoice.customer.phone && (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Phone className="w-4 h-4" />
                            {invoice.customer.phone}
                          </div>
                        )}
                        {invoice.customer.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Mail className="w-4 h-4" />
                            {invoice.customer.email}
                          </div>
                        )}
                        {invoice.customer.address && (
                          <div className="flex items-start gap-2 text-sm text-gray-500">
                            <MapPin className="w-4 h-4 mt-0.5" />
                            <span>{invoice.customer.address}{invoice.customer.city ? `, ${invoice.customer.city}` : ''}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Invoice Info Card */}
                    <div className={cn(
                      'p-6 rounded-xl border',
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                    )}>
                      <h3 className={cn(
                        'font-semibold mb-4 flex items-center gap-2',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <Receipt className="w-5 h-5 text-emerald-500" />
                        Información
                      </h3>
                      <div className="space-y-3">
                        {invoice.warehouseName && (
                          <div className="flex items-center gap-2">
                            <Warehouse className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-500">Almacén:</span>
                            <span className={cn(
                              'text-sm font-medium',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{invoice.warehouseName}</span>
                          </div>
                        )}
                        {invoice.pricelistName && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-500">Lista de precios:</span>
                            <span className={cn(
                              'text-sm font-medium',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{invoice.pricelistName}</span>
                          </div>
                        )}
                        {invoice.quoteNumber && (
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-500">Cotización:</span>
                            <span className={cn(
                              'text-sm font-medium',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{invoice.quoteNumber}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-500">Creada:</span>
                          <span className={cn(
                            'text-sm font-medium',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>{formatDateTime(invoice.createdAt)}</span>
                        </div>
                        {invoice.dueDate && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-500">Vencimiento:</span>
                            <span className={cn(
                              'text-sm font-medium',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{formatDate(invoice.dueDate)}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-500">Creada por:</span>
                          <span className={cn(
                            'text-sm font-medium',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>{invoice.createdBy}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Products Table */}
                  <div className={cn(
                    'rounded-xl border overflow-hidden',
                    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                  )}>
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                      <h3 className={cn(
                        'font-semibold flex items-center gap-2',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <Package className="w-5 h-5 text-blue-500" />
                        Productos ({invoice.lines.length})
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className={cn(
                            'border-b',
                            theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                          )}>
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Producto</th>
                            <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Cant.</th>
                            <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Entregado</th>
                            <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Precio</th>
                            <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {invoice.lines.map((line) => (
                            <tr key={line.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  {line.productImage ? (
                                    <Image
                                      src={line.productImage}
                                      alt={line.productName}
                                      width={40}
                                      height={40}
                                      className="w-10 h-10 rounded-lg object-cover"
                                    />
                                  ) : (
                                    <div className={cn(
                                      'w-10 h-10 rounded-lg flex items-center justify-center',
                                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                    )}>
                                      <Package className="w-5 h-5 text-gray-400" />
                                    </div>
                                  )}
                                  <div>
                                    <p className={cn(
                                      'font-medium text-sm',
                                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    )}>
                                      {line.productName}
                                    </p>
                                    {line.productSku && (
                                      <p className="text-xs text-gray-500 font-mono">{line.productSku}</p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={cn(
                                  'font-medium',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {line.quantity}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={cn(
                                  'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium',
                                  line.quantityDelivered >= line.quantity
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : line.quantityDelivered > 0
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                                )}>
                                  {line.quantityDelivered || 0} / {line.quantity}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className={cn(
                                  'font-medium',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {formatCurrency(line.unitPrice)}
                                </span>
                                {line.discountPercent > 0 && (
                                  <span className="text-xs text-emerald-500 block">
                                    -{line.discountPercent}%
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className={cn(
                                  'font-bold',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {formatCurrency(line.subtotal)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className={cn(
                          'border-t-2',
                          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                        )}>
                          <tr>
                            <td colSpan={4} className="py-3 px-4 text-right text-gray-500">Subtotal:</td>
                            <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">
                              {formatCurrency(invoice.subtotal)}
                            </td>
                          </tr>
                          {invoice.discountAmount > 0 && (
                            <tr>
                              <td colSpan={4} className="py-2 px-4 text-right text-gray-500">
                                Descuento ({invoice.discountPercent}%):
                              </td>
                              <td className="py-2 px-4 text-right font-medium text-emerald-500">
                                -{formatCurrency(invoice.discountAmount)}
                              </td>
                            </tr>
                          )}
                          <tr className={cn(
                            'text-lg',
                            theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                          )}>
                            <td colSpan={4} className="py-4 px-4 text-right font-bold text-gray-900 dark:text-white">
                              TOTAL:
                            </td>
                            <td className="py-4 px-4 text-right font-bold text-2xl text-gray-900 dark:text-white">
                              {formatCurrency(invoice.totalAmount)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Notes */}
                  {(invoice.notes || invoice.internalNotes) && (
                    <div className={cn(
                      'p-6 rounded-xl border',
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                    )}>
                      <h3 className={cn(
                        'font-semibold mb-4 flex items-center gap-2',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <FileText className="w-5 h-5 text-gray-500" />
                        Notas
                      </h3>
                      {invoice.notes && (
                        <div className="mb-4">
                          <p className="text-sm text-gray-500 mb-1">Notas para el cliente:</p>
                          <p className={cn(
                            'text-sm',
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          )}>{invoice.notes}</p>
                        </div>
                      )}
                      {invoice.internalNotes && (
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Notas internas:</p>
                          <p className={cn(
                            'text-sm',
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          )}>{invoice.internalNotes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'deliveries' && (
                <motion.div
                  key="deliveries"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  {invoice.deliveries.length === 0 ? (
                    <div className={cn(
                      'p-12 rounded-xl border text-center',
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                    )}>
                      <Truck className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className={cn(
                        'font-medium mb-2',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>No hay entregas registradas</p>
                      <p className="text-sm text-gray-500">
                        Las entregas se crean desde las operaciones de almacén
                      </p>
                    </div>
                  ) : (
                    invoice.deliveries.map((delivery) => {
                      const deliveryStatus = DELIVERY_STATUS_CONFIG[delivery.status] || DELIVERY_STATUS_CONFIG.pending

                      return (
                        <motion.div
                          key={delivery.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            'p-6 rounded-xl border',
                            theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                          )}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'w-12 h-12 rounded-xl flex items-center justify-center',
                                deliveryStatus.color === 'emerald' && 'bg-emerald-100 dark:bg-emerald-900/30',
                                deliveryStatus.color === 'blue' && 'bg-blue-100 dark:bg-blue-900/30',
                                deliveryStatus.color === 'amber' && 'bg-amber-100 dark:bg-amber-900/30',
                                deliveryStatus.color === 'gray' && 'bg-gray-100 dark:bg-gray-700',
                                deliveryStatus.color === 'red' && 'bg-red-100 dark:bg-red-900/30'
                              )}>
                                <Truck className={cn(
                                  'w-6 h-6',
                                  deliveryStatus.color === 'emerald' && 'text-emerald-600',
                                  deliveryStatus.color === 'blue' && 'text-blue-600',
                                  deliveryStatus.color === 'amber' && 'text-amber-600',
                                  deliveryStatus.color === 'gray' && 'text-gray-500',
                                  deliveryStatus.color === 'red' && 'text-red-600'
                                )} />
                              </div>
                              <div>
                                <p className={cn(
                                  'font-bold font-mono',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {delivery.deliveryNumber}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {delivery.warehouseName || 'Sin almacén asignado'}
                                </p>
                              </div>
                            </div>
                            <span className={cn(
                              'px-3 py-1 rounded-lg text-sm font-medium',
                              deliveryStatus.color === 'emerald' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                              deliveryStatus.color === 'blue' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                              deliveryStatus.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                              deliveryStatus.color === 'gray' && 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400',
                              deliveryStatus.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            )}>
                              {deliveryStatus.label}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                            <div>
                              <p className="text-gray-500">Creada</p>
                              <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                {formatDateTime(delivery.createdAt)}
                              </p>
                            </div>
                            {delivery.createdBy && (
                              <div>
                                <p className="text-gray-500">Creada por</p>
                                <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                  {delivery.createdBy}
                                </p>
                              </div>
                            )}
                            {delivery.dispatchedAt && (
                              <div>
                                <p className="text-gray-500">Despachada</p>
                                <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                  {formatDateTime(delivery.dispatchedAt)}
                                </p>
                                {delivery.dispatchedBy && (
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    por {delivery.dispatchedBy}
                                  </p>
                                )}
                              </div>
                            )}
                            {delivery.deliveredAt && (
                              <div>
                                <p className="text-gray-500">Entregada</p>
                                <p className={cn('font-medium text-emerald-600')}>
                                  {formatDateTime(delivery.deliveredAt)}
                                </p>
                                {delivery.deliveredBy && (
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    por {delivery.deliveredBy}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {delivery.lines && delivery.lines.length > 0 && (
                            <div className={cn(
                              'p-4 rounded-lg',
                              theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                            )}>
                              <p className="text-sm font-medium text-gray-500 mb-2">Productos:</p>
                              <div className="space-y-2">
                                {delivery.lines.map((line, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-sm">
                                    <span className={cn(
                                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                    )}>
                                      {line.productName}
                                    </span>
                                    <span className={cn(
                                      'font-medium',
                                      line.quantityDelivered >= line.quantity
                                        ? 'text-emerald-600'
                                        : 'text-amber-600'
                                    )}>
                                      {line.quantityDelivered} / {line.quantity}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )
                    })
                  )}
                </motion.div>
              )}

              {activeTab === 'payments' && (
                <motion.div
                  key="payments"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  {/* Payment Summary */}
                  <div className={cn(
                    'p-6 rounded-xl border',
                    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                  )}>
                    <div className="grid grid-cols-3 gap-6 text-center">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Total Factura</p>
                        <p className={cn(
                          'text-2xl font-bold',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {formatCurrency(invoice.totalAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Pagado</p>
                        <p className="text-2xl font-bold text-emerald-600">
                          {formatCurrency(invoice.amountPaid)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Pendiente</p>
                        <p className={cn(
                          'text-2xl font-bold',
                          invoice.amountDue > 0 ? 'text-amber-500' : 'text-emerald-500'
                        )}>
                          {formatCurrency(invoice.amountDue)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Payments List */}
                  {invoice.payments.length === 0 ? (
                    <div className={cn(
                      'p-12 rounded-xl border text-center',
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                    )}>
                      <CreditCard className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className={cn(
                        'font-medium mb-2',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>No hay pagos registrados</p>
                      <p className="text-sm text-gray-500 mb-4">
                        Registra un pago para actualizar el saldo
                      </p>
                      {invoice.paymentStatus !== 'paid' && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setShowPaymentModal(true)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium"
                        >
                          <Plus className="w-4 h-4" />
                          Registrar Pago
                        </motion.button>
                      )}
                    </div>
                  ) : (
                    invoice.payments.map((payment) => (
                      <motion.div
                        key={payment.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          'p-6 rounded-xl border',
                          theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                              <DollarSign className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                              <p className={cn(
                                'font-bold font-mono',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {payment.paymentNumber}
                              </p>
                              <p className="text-sm text-gray-500">
                                {PAYMENT_METHODS[payment.paymentMethod] || payment.paymentMethod}
                                {payment.reference && ` - Ref: ${payment.reference}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-emerald-600">
                              {formatCurrency(payment.amount)}
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatDate(payment.paymentDate)}
                            </p>
                          </div>
                        </div>
                        {payment.createdBy && (
                          <p className="text-sm text-gray-500 mt-3">
                            Registrado por: {payment.createdBy}
                          </p>
                        )}
                      </motion.div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Payment Modal */}
          <AnimatePresence>
            {showPaymentModal && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowPaymentModal(false)}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                >
                  <div className={cn(
                    "w-full max-w-md rounded-2xl shadow-2xl border",
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )} onClick={(e) => e.stopPropagation()}>
                    <div className={cn(
                      "px-6 py-4 border-b flex items-center justify-between",
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                          <DollarSign className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className={cn(
                            "font-semibold",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>Registrar Pago</h3>
                          <p className="text-xs text-gray-500">Pendiente: {formatCurrency(invoice.amountDue)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowPaymentModal(false)}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                        )}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                          Monto
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={paymentData.amount}
                          onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all text-lg font-bold',
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                              : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                          )}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                          Método de Pago
                        </label>
                        <select
                          value={paymentData.paymentMethod}
                          onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                              : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                          )}
                        >
                          <option value="cash">Efectivo</option>
                          <option value="transfer">Transferencia</option>
                          <option value="card">Tarjeta</option>
                          <option value="check">Cheque</option>
                          <option value="zelle">Zelle</option>
                          <option value="credit">Crédito</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                          Fecha de Pago
                        </label>
                        <input
                          type="date"
                          value={paymentData.paymentDate}
                          onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                              : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                          )}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                          Referencia (opcional)
                        </label>
                        <input
                          type="text"
                          value={paymentData.reference}
                          onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                          placeholder="Número de transacción, cheque, etc."
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                              : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                          )}
                        />
                      </div>
                    </div>

                    <div className={cn(
                      "flex gap-3 p-6 pt-4 border-t",
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowPaymentModal(false)}
                        className={cn(
                          "flex-1 py-3 rounded-xl font-medium transition-all",
                          theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        )}
                      >
                        Cancelar
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleRegisterPayment}
                        disabled={savingPayment || !paymentData.amount || parseFloat(paymentData.amount) <= 0}
                        className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {savingPayment ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-5 h-5" />
                            Registrar Pago
                          </>
                        )}
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
