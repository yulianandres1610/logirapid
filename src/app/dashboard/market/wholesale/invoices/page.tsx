'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Receipt,
  Plus,
  Search,
  Eye,
  CheckCircle,
  Truck,
  DollarSign,
  RefreshCw,
  Clock,
  FileText,
  AlertTriangle,
  CreditCard,
  PackageCheck,
  AlertCircle,
  Printer,
  Loader2,
  X
} from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { detectBrandFromHost, brands } from '@/lib/brand-config'

interface PrintService {
  id: number
  name: string
  printerName: string
  online: boolean
}

interface InvoiceLine {
  productName: string
  productSku: string | null
  quantity: number
  unitPrice: number
  discountPercent: number
  discountAmount: number
  subtotal: number
}

interface Invoice {
  id: number
  invoiceNumber: string
  customerId: number
  customerName: string
  customerCode: string
  quoteNumber: string | null
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
  linesCount: number
  deliveriesCount: number
  createdBy: string
  createdAt: string
  confirmedAt: string | null
  deliveredAt: string | null
  paidAt: string | null
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  draft: { label: 'Borrador', color: 'gray', icon: FileText },
  confirmed: { label: 'Confirmada', color: 'blue', icon: CheckCircle },
  partial_delivery: { label: 'Entrega Parcial', color: 'yellow', icon: Truck },
  delivered: { label: 'Entregada', color: 'green', icon: Truck },
  cancelled: { label: 'Cancelada', color: 'red', icon: AlertTriangle }
}

const paymentStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'yellow' },
  partial: { label: 'Parcial', color: 'orange' },
  paid: { label: 'Pagado', color: 'green' },
  overdue: { label: 'Vencido', color: 'red' }
}

export default function WholesaleInvoicesPage() {
  const { theme } = useTheme()
  const searchParams = useSearchParams()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>(searchParams.get('paymentStatus') || '')
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    confirmed: 0,
    delivered: 0,
    pendingPayment: 0,
    overdue: 0,
    totalSales: 0,
    totalPending: 0
  })

  // Print state
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null)
  const [printServices, setPrintServices] = useState<PrintService[]>([])
  const [selectedPrintServiceId, setSelectedPrintServiceId] = useState<number | null>(null)
  const [selectedPrinter, setSelectedPrinter] = useState<{ serviceId: number; printerId: number } | null>(null)
  const [printingWithService, setPrintingWithService] = useState(false)
  const [copies, setCopies] = useState(1)
  const [loadingInvoiceLines, setLoadingInvoiceLines] = useState(false)
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>([])
  const [invoiceDetail, setInvoiceDetail] = useState<Record<string, unknown> | null>(null)
  const [brandLogoBase64, setBrandLogoBase64] = useState<string | null>(null)

  // Preload brand logo as base64 for print service
  useEffect(() => {
    if (typeof window === 'undefined') return
    const brandName = detectBrandFromHost(window.location.hostname)
    const brand = brands[brandName]
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0)
        setBrandLogoBase64(canvas.toDataURL('image/png'))
      }
    }
    img.src = brand.logos.light
  }, [])

  useEffect(() => {
    fetchInvoices()
  }, [statusFilter, paymentStatusFilter])

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchInvoices()
    }, 300)
    return () => clearTimeout(debounce)
  }, [search])

  const fetchInvoices = async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (paymentStatusFilter) params.set('paymentStatus', paymentStatusFilter)
      if (search) params.set('search', search)

      const response = await fetch(`/api/market/wholesale/invoices?${params}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setInvoices(result.data.invoices)
          setStats(result.data.stats)
        }
      }
    } catch (error) {
      console.error('Error fetching invoices:', error)
    } finally {
      if (!silent) setLoading(false)
      else setIsRefreshing(false)
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

  const fetchPrintServices = async () => {
    try {
      const res = await fetch('/api/print-services/available?documentType=wholesale_invoice', { credentials: 'include' })
      const data = await res.json()
      if (data.success && data.data) {
        setPrintServices(data.data)
        if (data.data.length === 1) setSelectedPrintServiceId(data.data[0].id)
      }
    } catch {
      setPrintServices([])
    }
  }

  const fetchInvoiceLines = async (invoiceId: number) => {
    setLoadingInvoiceLines(true)
    try {
      const response = await fetch(`/api/market/wholesale/invoices/${invoiceId}`)
      const data = await response.json()
      if (data.success && data.data) {
        const detail = data.data
        setInvoiceDetail(detail)
        setInvoiceLines((detail.lines || []).map((l: { productName: string; productSku: string | null; quantity: number; unitPrice: number; discountPercent: number; discountAmount: number; subtotal: number }) => ({
          productName: l.productName,
          productSku: l.productSku,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountPercent: l.discountPercent || 0,
          discountAmount: l.discountAmount || 0,
          subtotal: l.subtotal
        })))
      }
    } catch (err) {
      console.error('[Print] Error fetching invoice lines:', err)
    } finally {
      setLoadingInvoiceLines(false)
    }
  }

  const handlePrintInvoice = (invoice: Invoice) => {
    setPrintInvoice(invoice)
    setShowPrintModal(true)
    setCopies(1)
    setInvoiceDetail(null)
    fetchPrintServices()
    fetchInvoiceLines(invoice.id)
  }

  const printWithSilentService = async () => {
    if (!printInvoice || invoiceLines.length === 0) return

    setPrintingWithService(true)
    try {
      // Fetch current system wholesale exchange rate
      let currentExchangeRate: number | null = null
      try {
        const ratesRes = await fetch('/api/market/pos/exchange-rates')
        const ratesData = await ratesRes.json()
        if (ratesData.success && ratesData.rates?.CUP) {
          currentExchangeRate = ratesData.rates.CUP
        }
      } catch (e) {
        console.error('[Print] Error fetching exchange rates:', e)
      }

      const customer = invoiceDetail
        ? { code: (invoiceDetail as Record<string, unknown>).customer ? ((invoiceDetail as Record<string, unknown>).customer as Record<string, string>).code : printInvoice.customerCode, name: (invoiceDetail as Record<string, unknown>).customer ? ((invoiceDetail as Record<string, unknown>).customer as Record<string, string>).businessName : printInvoice.customerName, taxId: (invoiceDetail as Record<string, unknown>).customer ? ((invoiceDetail as Record<string, unknown>).customer as Record<string, string>).taxId : undefined, address: (invoiceDetail as Record<string, unknown>).customer ? ((invoiceDetail as Record<string, unknown>).customer as Record<string, string>).address : undefined, phone: (invoiceDetail as Record<string, unknown>).customer ? ((invoiceDetail as Record<string, unknown>).customer as Record<string, string>).phone : undefined }
        : { code: printInvoice.customerCode, name: printInvoice.customerName }

      const response = await fetch('/api/print-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedPrintServiceId,
          documentType: 'wholesale_invoice',
          documentData: {
            invoiceNumber: printInvoice.invoiceNumber,
            customer,
            warehouseName: printInvoice.warehouseName,
            lines: invoiceLines,
            subtotal: printInvoice.subtotal,
            discountPercent: printInvoice.discountPercent,
            discountAmount: printInvoice.discountAmount,
            totalAmount: printInvoice.totalAmount,
            amountPaid: printInvoice.amountPaid,
            amountDue: printInvoice.amountDue,
            currency: printInvoice.currency,
            status: printInvoice.status,
            paymentStatus: printInvoice.paymentStatus,
            dueDate: printInvoice.dueDate,
            createdAt: printInvoice.createdAt,
            notes: (invoiceDetail as Record<string, unknown>)?.notes || undefined,
            exchangeRate: currentExchangeRate || (invoiceDetail as Record<string, unknown>)?.wholesaleExchangeRate || null,
            brandLogo: brandLogoBase64 || null,
            brandPrimaryColor: brands[detectBrandFromHost(typeof window !== 'undefined' ? window.location.hostname : '')].colors.primary,
            brandDisplayName: brands[detectBrandFromHost(typeof window !== 'undefined' ? window.location.hostname : '')].displayName
          },
          copies,
          sourceType: 'wholesale_invoice',
          sourceId: printInvoice.id
        })
      })

      const data = await response.json()
      if (data.success) {
        setShowPrintModal(false)
        setPrintInvoice(null)
        setInvoiceLines([])
        setInvoiceDetail(null)
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      console.error('[Print] Error printing:', err)
    } finally {
      setPrintingWithService(false)
    }
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Total Este Mes */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-green-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-green-900/30 border border-green-800/50'
                          : 'bg-gradient-to-br from-green-50 to-green-100 border border-green-200'
                      )}>
                        <Receipt className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Este Mes</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.total}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>{formatCurrency(stats.totalSales)} en ventas</span>
                  </div>
                </div>
              </motion.div>

              {/* Pendientes de Pago */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-amber-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-amber-900/30 border border-amber-800/50'
                          : 'bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200'
                      )}>
                        <CreditCard className="w-6 h-6 text-amber-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Pendientes de Pago</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.pendingPayment}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>{formatCurrency(stats.totalPending)} por cobrar</span>
                  </div>
                </div>
              </motion.div>

              {/* Vencidas */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-red-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-red-900/30 border border-red-800/50'
                          : 'bg-gradient-to-br from-red-50 to-red-100 border border-red-200'
                      )}>
                        <AlertCircle className="w-6 h-6 text-red-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Vencidas</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.overdue}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>Requieren atención</span>
                  </div>
                </div>
              </motion.div>

              {/* Entregadas */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-blue-900/30 border border-blue-800/50'
                          : 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200'
                      )}>
                        <PackageCheck className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Entregadas</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.delivered}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>Completadas este mes</span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Filters */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={cn(
                'p-4 rounded-2xl border shadow-xl',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por número o cliente..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={cn(
                      'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                        : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                    )}
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all min-w-[160px]',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                  )}
                >
                  <option value="">Estado de Factura</option>
                  <option value="draft">Borrador</option>
                  <option value="confirmed">Confirmada</option>
                  <option value="partial_delivery">Entrega Parcial</option>
                  <option value="delivered">Entregada</option>
                  <option value="cancelled">Cancelada</option>
                </select>

                {/* Payment Status Filter */}
                <select
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all min-w-[160px]',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                  )}
                >
                  <option value="">Estado de Pago</option>
                  <option value="pending">Pendiente</option>
                  <option value="partial">Pago Parcial</option>
                  <option value="paid">Pagado</option>
                  <option value="overdue">Vencido</option>
                </select>

                {/* Refresh */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => fetchInvoices(true)}
                  disabled={loading || isRefreshing}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                    theme === 'dark'
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                    isRefreshing && 'opacity-75'
                  )}
                >
                  <RefreshCw className={cn('w-4 h-4', (loading || isRefreshing) && 'animate-spin')} />
                </motion.button>

                {/* Nueva Factura */}
                <Link href="/dashboard/market/wholesale/invoices/create">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all shadow-lg shadow-green-500/25"
                  >
                    <Plus className="w-5 h-5" />
                    Nueva Factura
                  </motion.button>
                </Link>
              </div>
            </motion.div>

            {/* Invoices Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className={cn(
                'rounded-2xl border shadow-xl overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={cn(
                      'border-b',
                      theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                    )}>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Factura</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                      <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Pendiente</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Pago</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan={7} className="py-4 px-4">
                            <div className="animate-pulse flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
                              <div className="flex-1">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : invoices.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center">
                          <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className={cn(
                            'font-medium mb-1',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>No hay facturas</p>
                          <p className="text-gray-500 dark:text-gray-400">
                            Crea tu primera factura
                          </p>
                          <Link href="/dashboard/market/wholesale/invoices/create">
                            <button className="mt-3 inline-flex items-center gap-2 text-sm text-green-500 hover:text-green-600">
                              <Plus className="w-4 h-4" />
                              Crear Factura
                            </button>
                          </Link>
                        </td>
                      </tr>
                    ) : (
                      invoices.map((invoice, index) => {
                        const sConfig = statusConfig[invoice.status] || statusConfig.draft
                        const pConfig = paymentStatusConfig[invoice.paymentStatus] || paymentStatusConfig.pending
                        const StatusIcon = sConfig.icon

                        return (
                          <motion.tr
                            key={invoice.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                            className={cn(
                              'group transition-colors',
                              theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                            )}
                          >
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold">
                                  <Receipt className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className={cn(
                                    'font-medium',
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>
                                    {invoice.invoiceNumber}
                                  </p>
                                  {invoice.quoteNumber && (
                                    <p className="text-xs text-gray-500">De: {invoice.quoteNumber}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div>
                                <p className={cn(
                                  'text-sm',
                                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                )}>{invoice.customerName}</p>
                                <p className="text-xs text-gray-500">{invoice.customerCode}</p>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <p className={cn(
                                'font-medium',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {formatCurrency(invoice.totalAmount)}
                              </p>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <p className={cn(
                                'font-medium',
                                invoice.amountDue > 0
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-green-600 dark:text-green-400'
                              )}>
                                {formatCurrency(invoice.amountDue)}
                              </p>
                              {invoice.dueDate && (
                                <p className="text-xs text-gray-500">
                                  Vence: {formatDate(invoice.dueDate)}
                                </p>
                              )}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
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
                                <StatusIcon className="w-3 h-3" />
                                {sConfig.label}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={cn(
                                'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium',
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
                            </td>
                            <td className="py-4 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handlePrintInvoice(invoice)}
                                  className="p-2 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                                  title="Imprimir factura"
                                >
                                  <Printer className="w-4 h-4 text-emerald-500" />
                                </motion.button>
                                <Link href={`/dashboard/market/wholesale/invoices/${invoice.id}`}>
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                    title="Ver detalles"
                                  >
                                    <Eye className="w-4 h-4 text-blue-500" />
                                  </motion.button>
                                </Link>
                                {invoice.paymentStatus !== 'paid' && invoice.status !== 'cancelled' && (
                                  <Link href={`/dashboard/market/wholesale/invoices/${invoice.id}?tab=payments`}>
                                    <motion.button
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      className="p-2 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                                      title="Registrar pago"
                                    >
                                      <DollarSign className="w-4 h-4 text-purple-500" />
                                    </motion.button>
                                  </Link>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>

          {/* Print Modal */}
          <AnimatePresence>
            {showPrintModal && printInvoice && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => {
                    setShowPrintModal(false)
                    setPrintInvoice(null)
                    setInvoiceLines([])
                    setInvoiceDetail(null)
                  }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                />

                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: "spring", duration: 0.3 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                >
                  <div
                    className={cn(
                      "w-full max-w-md rounded-2xl shadow-2xl border",
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-700'
                        : 'bg-white border-gray-200'
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className={cn(
                      "px-6 py-4 border-b flex items-center justify-between",
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                          <Printer className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className={cn(
                            "font-semibold",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            Imprimir Factura
                          </h3>
                          <p className="text-xs text-gray-500">#{printInvoice.invoiceNumber}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setShowPrintModal(false)
                          setPrintInvoice(null)
                          setInvoiceLines([])
                          setInvoiceDetail(null)
                        }}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                        )}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-6 space-y-6">
                      {loadingInvoiceLines ? (
                        <div className="text-center py-4">
                          <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-4" />
                          <p className="text-gray-500">Cargando datos...</p>
                        </div>
                      ) : (
                        <>
                          {/* Invoice Summary */}
                          <div className={cn(
                            "p-4 rounded-xl",
                            theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                          )}>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-gray-500">Cliente</span>
                              <span className="font-medium text-gray-900 dark:text-white">{printInvoice.customerName}</span>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-gray-500">Total</span>
                              <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(printInvoice.totalAmount)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-500">Productos</span>
                              <span className="font-medium text-gray-900 dark:text-white">{invoiceLines.length} items</span>
                            </div>
                          </div>

                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              Copias
                            </label>
                            <div className="flex items-center justify-center gap-4">
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setCopies(Math.max(1, copies - 1))}
                                className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center font-bold",
                                  theme === 'dark'
                                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                                )}
                              >
                                -
                              </motion.button>
                              <span className={cn(
                                "w-12 text-center text-xl font-bold",
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {copies}
                              </span>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setCopies(Math.min(5, copies + 1))}
                                className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center font-bold",
                                  theme === 'dark'
                                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                                )}
                              >
                                +
                              </motion.button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {!loadingInvoiceLines && (
                      <div className={cn(
                        "flex gap-3 p-6 pt-4 border-t",
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setShowPrintModal(false)
                            setPrintInvoice(null)
                            setInvoiceLines([])
                            setInvoiceDetail(null)
                          }}
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
                          onClick={printWithSilentService}
                          disabled={printingWithService || invoiceLines.length === 0}
                          className={cn(
                            "flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
                            "bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
                          )}
                        >
                          {printingWithService ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Printer className="w-5 h-5" />
                              Imprimir
                            </>
                          )}
                        </motion.button>
                      </div>
                    )}
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
