'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Smartphone,
  Wifi,
  Phone,
  User,
  Mail,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader2,
  Copy,
  Printer,
  RefreshCw,
  Hash,
  Globe,
  CreditCard,
  Gift,
  FileText,
  BadgeCheck
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import LoadingBox from '@/components/ui/LoadingBox'

interface PaymentInfo {
  paymentLinkId: number
  linkCode: string
  paymentAmount: number
  currency: string
  paymentStatus: string
  stripePaymentIntentId: string | null
  paidAt: string | null
  expiresAt: string | null
  paymentLinkCreatedAt: string
}

interface RechargeDetails {
  id: number
  localReference: string
  orderNumber: string | null
  univcellOrderId: string | null
  productId: number
  productName: string
  countryCode: string
  countryName: string
  isPromotion: boolean
  serviceType: string
  amount: number
  amountCents: number
  providerAmount: number | null
  baseCost: number | null
  costPrice: number | null
  destination: string
  phoneNumber: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  paymentStatus: string | null
  resultCode: number | null
  resultMessage: string | null
  confirmationCode: string | null
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  companyId: number
  companyName: string
  userId: number
  userName: string
  userEmail: string
  source: string
  payment: PaymentInfo | null
  createdAt: string
  completedAt: string | null
  updatedAt: string
}

// Status configuration
const STATUS_CONFIG = {
  pending: {
    label: 'Pendiente',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    icon: AlertCircle,
    bgGradient: 'from-amber-500 to-orange-500'
  },
  processing: {
    label: 'Procesando',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    icon: Loader2,
    bgGradient: 'from-blue-500 to-indigo-500'
  },
  completed: {
    label: 'Completada',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    icon: CheckCircle,
    bgGradient: 'from-emerald-500 to-green-500'
  },
  failed: {
    label: 'Fallida',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    icon: XCircle,
    bgGradient: 'from-red-500 to-rose-500'
  }
}

// Country flag mapping
const getCountryFlag = (countryCode: string): string => {
  const flags: Record<string, string> = {
    CU: '\u{1F1E8}\u{1F1FA}',
    MX: '\u{1F1F2}\u{1F1FD}',
    DO: '\u{1F1E9}\u{1F1F4}',
    US: '\u{1F1FA}\u{1F1F8}',
    CO: '\u{1F1E8}\u{1F1F4}',
    VE: '\u{1F1FB}\u{1F1EA}',
    PE: '\u{1F1F5}\u{1F1EA}',
    EC: '\u{1F1EA}\u{1F1E8}',
    GT: '\u{1F1EC}\u{1F1F9}',
    HN: '\u{1F1ED}\u{1F1F3}',
    SV: '\u{1F1F8}\u{1F1FB}',
    NI: '\u{1F1F3}\u{1F1EE}',
    PA: '\u{1F1F5}\u{1F1E6}'
  }
  return flags[countryCode] || '\u{1F310}'
}

export default function RechargeDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const resolvedParams = use(params)

  const [recharge, setRecharge] = useState<RechargeDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchRechargeDetails = async () => {
    try {
      const response = await fetch(`/api/admin/recargas/${resolvedParams.id}`)
      const data = await response.json()

      if (data.success) {
        setRecharge(data.data)
      } else {
        showNotification('error', 'Error', data.error || 'Error al cargar los detalles')
        router.push('/dashboard/agency-admin/recargas')
      }
    } catch (error) {
      console.error('Error fetching recharge:', error)
      showNotification('error', 'Error', 'Error de conexión')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchRechargeDetails()
  }, [resolvedParams.id])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchRechargeDetails()
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    showNotification('success', 'Copiado', `${label} copiado al portapapeles`)
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <ProtectedRoute requiredRole="ADMIN">
        <DashboardLayout>
          <div className="min-h-screen flex items-center justify-center">
            <LoadingBox size="lg" text="Cargando detalles..." />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (!recharge) {
    return (
      <ProtectedRoute requiredRole="ADMIN">
        <DashboardLayout>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Recarga no encontrada</h2>
              <Button onClick={() => router.push('/dashboard/agency-admin/recargas')}>
                Volver al historial
              </Button>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const statusConfig = STATUS_CONFIG[recharge.status] || STATUS_CONFIG.pending
  const StatusIcon = statusConfig.icon
  const isNauta = recharge.serviceType === 'nauta'
  const margin = recharge.amount - (recharge.costPrice || recharge.baseCost || 0)

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <DashboardLayout>
        <div className="min-h-screen p-4 md:p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto space-y-6"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/dashboard/agency-admin/recargas')}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver
                </Button>
                <div>
                  <h1 className="text-2xl font-bold">Detalles de Recarga</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    ID: #{recharge.id}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} />
                  Actualizar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir
                </Button>
              </div>
            </div>

            {/* Status Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className={cn(
                "relative overflow-hidden rounded-2xl p-6",
                `bg-gradient-to-br ${statusConfig.bgGradient}`
              )}
            >
              <div className="absolute inset-0 bg-black/10" />
              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    <StatusIcon className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-white">
                    <p className="text-sm opacity-80">Estado de la recarga</p>
                    <p className="text-2xl font-bold">{statusConfig.label}</p>
                    {recharge.resultMessage && (
                      <p className="text-sm opacity-80 mt-1">{recharge.resultMessage}</p>
                    )}
                  </div>
                </div>
                <div className="text-white text-right">
                  <p className="text-sm opacity-80">Monto cobrado</p>
                  <p className="text-3xl font-bold">${recharge.amount.toFixed(2)}</p>
                </div>
              </div>
            </motion.div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Product Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  "rounded-2xl border p-6",
                  theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700'
                    : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    isNauta
                      ? "bg-gradient-to-br from-cyan-500 to-cyan-600"
                      : "bg-gradient-to-br from-purple-500 to-purple-600"
                  )}>
                    {isNauta ? (
                      <Wifi className="w-5 h-5 text-white" />
                    ) : (
                      <Smartphone className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <h3 className="text-lg font-semibold">Información del Producto</h3>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Producto</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{recharge.productName}</span>
                      {recharge.isPromotion && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-white">
                          <Gift className="w-3 h-3" />
                          PROMO
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-sm text-gray-500 dark:text-gray-400">País</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getCountryFlag(recharge.countryCode)}</span>
                      <span className="font-medium">{recharge.countryName || recharge.countryCode}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Servicio</span>
                    <span className={cn(
                      "px-2 py-1 rounded-lg text-xs font-medium",
                      isNauta
                        ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400"
                        : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                    )}>
                      {isNauta ? 'Nauta' : 'Teléfono'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Destino</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{recharge.destination}</span>
                      <button
                        onClick={() => copyToClipboard(recharge.destination, 'Número')}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        <Copy className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Financial Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  "rounded-2xl border p-6",
                  theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700'
                    : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold">Información Financiera</h3>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Precio al Cliente</span>
                    <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      ${recharge.amount.toFixed(2)}
                    </span>
                  </div>

                  {(recharge.costPrice || recharge.baseCost) && (
                    <>
                      <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Mi Costo</span>
                        <span className="font-medium">
                          ${(recharge.costPrice || recharge.baseCost || 0).toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Mi Ganancia</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          +${margin.toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}

                  {recharge.providerAmount && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Monto del Proveedor</span>
                      <span className="font-medium">${recharge.providerAmount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Estado de Pago</span>
                    <span className={cn(
                      "px-2 py-1 rounded-lg text-xs font-medium",
                      recharge.paymentStatus === 'paid'
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    )}>
                      {recharge.paymentStatus === 'paid' ? 'Pagado' : recharge.paymentStatus || 'N/A'}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Payment/Stripe Info */}
              {recharge.payment && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className={cn(
                    "rounded-2xl border p-6",
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700'
                      : 'bg-white border-gray-200 shadow-sm'
                  )}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold">Información de Pago (Stripe)</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Estado del Pago</span>
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-xs font-medium",
                        recharge.payment.paymentStatus === 'paid'
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : recharge.payment.paymentStatus === 'expired'
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      )}>
                        {recharge.payment.paymentStatus === 'paid' ? 'Pagado' :
                         recharge.payment.paymentStatus === 'expired' ? 'Expirado' :
                         recharge.payment.paymentStatus === 'cancelled' ? 'Cancelado' : 'Pendiente'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Monto Cobrado</span>
                      <span className="font-medium">
                        ${recharge.payment.paymentAmount.toFixed(2)} {recharge.payment.currency}
                      </span>
                    </div>

                    {recharge.payment.stripePaymentIntentId && (
                      <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Payment Intent ID</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs truncate max-w-[180px]">
                            {recharge.payment.stripePaymentIntentId}
                          </span>
                          <button
                            onClick={() => copyToClipboard(recharge.payment!.stripePaymentIntentId!, 'Payment Intent ID')}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex-shrink-0"
                          >
                            <Copy className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Código de Link</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{recharge.payment.linkCode}</span>
                        <button
                          onClick={() => copyToClipboard(recharge.payment!.linkCode, 'Código de Link')}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                          <Copy className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>

                    {recharge.payment.paidAt && (
                      <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Fecha de Pago</span>
                        <span className="text-sm font-medium">
                          {new Date(recharge.payment.paidAt).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Link Creado</span>
                      <span className="text-sm font-medium">
                        {new Date(recharge.payment.paymentLinkCreatedAt).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Customer Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className={cn(
                  "rounded-2xl border p-6",
                  theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700'
                    : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold">Información del Cliente</h3>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-500 dark:text-gray-400">Nombre</span>
                    </div>
                    <span className="font-medium">{recharge.customerName || 'No especificado'}</span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-500 dark:text-gray-400">Email</span>
                    </div>
                    <span className="font-medium">{recharge.customerEmail || 'No especificado'}</span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-500 dark:text-gray-400">Teléfono</span>
                    </div>
                    <span className="font-medium">{recharge.customerPhone || 'No especificado'}</span>
                  </div>
                </div>
              </motion.div>

              {/* Technical Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className={cn(
                  "rounded-2xl border p-6",
                  theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700'
                    : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-gray-600 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold">Información Técnica</h3>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-500 dark:text-gray-400">Referencia Local</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{recharge.localReference?.slice(0, 12)}...</span>
                      <button
                        onClick={() => copyToClipboard(recharge.localReference, 'Referencia')}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        <Copy className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>

                  {recharge.univcellOrderId && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">ID UnivCell</span>
                      </div>
                      <span className="font-mono text-xs">{recharge.univcellOrderId}</span>
                    </div>
                  )}

                  {recharge.confirmationCode && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <BadgeCheck className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">Código de Confirmación</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {recharge.confirmationCode}
                        </span>
                        <button
                          onClick={() => copyToClipboard(recharge.confirmationCode!, 'Código')}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                          <Copy className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-500 dark:text-gray-400">Origen</span>
                    </div>
                    <span className={cn(
                      "px-2 py-1 rounded-lg text-xs font-medium",
                      recharge.source === 'whatsapp'
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    )}>
                      {recharge.source === 'whatsapp' ? 'WhatsApp' : 'Web'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-500 dark:text-gray-400">Empresa</span>
                    </div>
                    <span className="font-medium">{recharge.companyName}</span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Timeline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className={cn(
                "rounded-2xl border p-6",
                theme === 'dark'
                  ? 'bg-gray-800/50 border-gray-700'
                  : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold">Línea de Tiempo</h3>
              </div>

              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

                <div className="space-y-6">
                  {/* Created */}
                  <div className="relative flex items-start gap-4 pl-10">
                    <div className="absolute left-2 w-4 h-4 rounded-full bg-purple-500 border-2 border-white dark:border-gray-800" />
                    <div>
                      <p className="font-medium">Orden Creada</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(recharge.createdAt).toLocaleDateString('es-ES', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Processing */}
                  {recharge.status !== 'pending' && (
                    <div className="relative flex items-start gap-4 pl-10">
                      <div className="absolute left-2 w-4 h-4 rounded-full bg-blue-500 border-2 border-white dark:border-gray-800" />
                      <div>
                        <p className="font-medium">Procesando</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          La recarga fue enviada al proveedor
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Completed or Failed */}
                  {recharge.completedAt && (
                    <div className="relative flex items-start gap-4 pl-10">
                      <div className={cn(
                        "absolute left-2 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800",
                        recharge.status === 'completed' ? 'bg-emerald-500' : 'bg-red-500'
                      )} />
                      <div>
                        <p className="font-medium">
                          {recharge.status === 'completed' ? 'Completada' : 'Fallida'}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(recharge.completedAt).toLocaleDateString('es-ES', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        {recharge.confirmationCode && (
                          <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                            Código: {recharge.confirmationCode}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Result Message */}
            {recharge.resultMessage && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className={cn(
                  "rounded-2xl border p-4",
                  recharge.status === 'completed'
                    ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800'
                    : recharge.status === 'failed'
                      ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                      : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
                )}
              >
                <div className="flex items-start gap-3">
                  <StatusIcon className={cn(
                    "w-5 h-5 flex-shrink-0 mt-0.5",
                    recharge.status === 'completed'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : recharge.status === 'failed'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-amber-600 dark:text-amber-400'
                  )} />
                  <div>
                    <p className="font-medium text-sm">
                      {recharge.status === 'completed' ? 'Mensaje de confirmación' : 'Mensaje del sistema'}
                    </p>
                    <p className={cn(
                      "text-sm mt-1",
                      recharge.status === 'completed'
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : recharge.status === 'failed'
                          ? 'text-red-700 dark:text-red-300'
                          : 'text-amber-700 dark:text-amber-300'
                    )}>
                      {recharge.resultMessage}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
