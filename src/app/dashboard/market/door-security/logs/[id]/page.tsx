'use client'

import { useEffect, useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Loader2,
  User,
  Calendar,
  Clock,
  LogIn,
  LogOut,
  FileText,
  CheckCircle,
  AlertTriangle,
  MapPin,
  Shield,
  Camera
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface LogDetail {
  id: number
  visitorId: number
  visitorName: string
  visitorIdNumber: string
  visitorIdType: string | null
  visitorAddress: string | null
  kioskId: number
  kioskName: string
  kioskLocation: string | null
  entryTime: string
  exitTime: string | null
  visitPurpose: string | null
  visitNotes: string | null
  hostEmployeeId: number | null
  hostName: string | null
  hasPendingInvoices: boolean
  invoicesValidated: boolean
  validatedAt: string | null
  validatedByName: string | null
  status: string
  createdAt: string
}

interface InvoiceValidation {
  id: number
  documentType: string
  documentId: number | null
  documentNumber: string | null
  totalAmount: number
  currency: string
  validated: boolean
  validatedAt: string | null
  validatedByName: string | null
  notes: string | null
  photoUrl: string | null
}

interface LogData {
  log: LogDetail
  invoiceValidations: InvoiceValidation[]
}

const DOC_TYPE_LABELS: Record<string, string> = {
  pos_receipt: 'Ticket POS',
  pos_order: 'Orden POS',
  wholesale_invoice: 'Factura Mayorista',
}

export default function VisitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { theme } = useTheme()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<LogData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const fetchLog = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/market/door-security/logs/${resolvedParams.id}`)
      const json = await res.json()

      if (json.success) {
        setData(json.data)
      } else {
        setError(json.error || 'Error al cargar el registro')
      }
    } catch {
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }, [resolvedParams.id])

  useEffect(() => {
    fetchLog()
  }, [fetchLog])

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const calculateDuration = (entry: string, exit: string | null) => {
    if (!exit) return 'En curso'
    const start = new Date(entry).getTime()
    const end = new Date(exit).getTime()
    const diffMs = end - start
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 60) {
      return `${diffMins} min`
    }
    const hours = Math.floor(diffMins / 60)
    const mins = diffMins % 60
    return `${hours}h ${mins}m`
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
                theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
              )}>
                <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
              </div>
              <p className="text-gray-500">Cargando detalles...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (error || !data) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6">
            <div className={cn(
              "max-w-xl mx-auto p-8 rounded-2xl text-center",
              theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-lg'
            )}>
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
                theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
              )}>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className={cn(
                'text-xl font-bold mb-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {error || 'Registro no encontrado'}
              </h2>
              <p className="text-gray-500 mb-6">No pudimos cargar los detalles de esta visita.</p>
              <Link href="/dashboard/market/door-security/logs">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver al historial
                </motion.button>
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const { log, invoiceValidations } = data
  const photosWithUrl = invoiceValidations.filter(v => v.photoUrl)

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <div className="max-w-6xl mx-auto">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-6">
              <Link href="/dashboard/market/door-security/logs">
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
            </div>

            {/* Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'p-6 rounded-2xl border mb-6',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                {/* Avatar */}
                <div className={cn(
                  'w-20 h-20 rounded-2xl flex items-center justify-center shrink-0',
                  log.status === 'active'
                    ? 'bg-gradient-to-br from-green-500 to-emerald-500'
                    : 'bg-gradient-to-br from-teal-500 to-cyan-500'
                )}>
                  <User className="w-10 h-10 text-white" />
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h1 className={cn(
                      'text-2xl md:text-3xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {log.visitorName}
                    </h1>
                    {log.status === 'active' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Adentro
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-sm font-medium">
                        Completada
                      </span>
                    )}
                    {log.invoicesValidated && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-sm font-medium">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Facturas Validadas
                      </span>
                    )}
                    {log.hasPendingInvoices && !log.invoicesValidated && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-sm font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Facturas Pendientes
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-4 h-4" />
                      {log.visitorIdNumber}
                    </span>
                    {log.visitPurpose && (
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-4 h-4" />
                        {log.visitPurpose}
                      </span>
                    )}
                  </div>
                </div>

                {/* Duration Badge */}
                <div className={cn(
                  'p-4 rounded-xl text-center',
                  theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                )}>
                  <p className="text-sm text-gray-500 mb-1">Duracion</p>
                  <p className={cn(
                    'text-2xl font-bold',
                    log.status === 'active' ? 'text-green-500' : (theme === 'dark' ? 'text-white' : 'text-gray-900')
                  )}>
                    {calculateDuration(log.entryTime, log.exitTime)}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Info + Validations */}
              <div className="lg:col-span-2 space-y-6">
                {/* Visit Info */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={cn(
                    'p-6 rounded-2xl border',
                    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                  )}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className={cn(
                      'p-2 rounded-xl',
                      theme === 'dark' ? 'bg-teal-900/30' : 'bg-teal-100'
                    )}>
                      <Clock className="w-5 h-5 text-teal-500" />
                    </div>
                    <h3 className={cn(
                      'font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Informacion de la Visita</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                        <LogIn className="w-3.5 h-3.5" /> Entrada
                      </p>
                      <p className={cn(
                        'font-medium',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{formatDateTime(log.entryTime)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                        <LogOut className="w-3.5 h-3.5" /> Salida
                      </p>
                      <p className={cn(
                        'font-medium',
                        log.exitTime
                          ? (theme === 'dark' ? 'text-white' : 'text-gray-900')
                          : 'text-green-500'
                      )}>{log.exitTime ? formatDateTime(log.exitTime) : 'Aun adentro'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Motivo</p>
                      <p className={cn(
                        'font-medium',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{log.visitPurpose || 'No especificado'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Kiosko</p>
                      <p className={cn(
                        'font-medium',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {log.kioskName || '-'}
                        {log.kioskLocation && (
                          <span className="text-gray-500 text-sm ml-2">({log.kioskLocation})</span>
                        )}
                      </p>
                    </div>
                    {log.hostName && (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Anfitrion</p>
                        <p className={cn(
                          'font-medium',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>{log.hostName}</p>
                      </div>
                    )}
                    {log.visitNotes && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-gray-500 mb-1">Notas</p>
                        <p className={cn(
                          'font-medium',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>{log.visitNotes}</p>
                      </div>
                    )}
                    {log.visitorAddress && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> Direccion del Visitante
                        </p>
                        <p className={cn(
                          'font-medium',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>{log.visitorAddress}</p>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Invoice Validations */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className={cn(
                    'p-6 rounded-2xl border',
                    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                  )}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className={cn(
                      'p-2 rounded-xl',
                      theme === 'dark' ? 'bg-orange-900/30' : 'bg-orange-100'
                    )}>
                      <FileText className="w-5 h-5 text-orange-500" />
                    </div>
                    <h3 className={cn(
                      'font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Comprobantes Validados</h3>
                    <span className={cn(
                      'ml-auto px-2.5 py-0.5 rounded-full text-xs font-medium',
                      theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                    )}>
                      {invoiceValidations.length}
                    </span>
                  </div>

                  {invoiceValidations.length > 0 ? (
                    <div className="space-y-3">
                      {invoiceValidations.map((v) => (
                        <div
                          key={v.id}
                          className={cn(
                            'p-4 rounded-xl border',
                            v.validated
                              ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/50'
                              : theme === 'dark'
                                ? 'bg-gray-700/50 border-gray-600'
                                : 'bg-gray-50 border-gray-200'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              {v.photoUrl ? (
                                <div
                                  className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 cursor-pointer hover:ring-2 hover:ring-teal-500 transition-all shrink-0"
                                  onClick={() => setLightboxUrl(v.photoUrl)}
                                >
                                  <Image
                                    src={v.photoUrl}
                                    alt="Foto del comprobante"
                                    fill
                                    className="object-cover"
                                    unoptimized
                                  />
                                </div>
                              ) : (
                                <div className={cn(
                                  'w-14 h-14 rounded-lg flex items-center justify-center shrink-0',
                                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                )}>
                                  <FileText className="w-6 h-6 text-gray-400" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className={cn(
                                  'font-medium',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {DOC_TYPE_LABELS[v.documentType] || v.documentType}
                                </p>
                                {v.documentNumber && (
                                  <p className="text-sm text-gray-500 font-mono">#{v.documentNumber}</p>
                                )}
                                <p className="text-lg font-bold text-orange-500 mt-1">
                                  {v.currency} {v.totalAmount.toFixed(2)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              {v.validated && (
                                <div className="flex items-center gap-1 text-green-600 dark:text-green-400 mb-1">
                                  <CheckCircle className="w-4 h-4" />
                                  <span className="text-sm font-medium">Validado</span>
                                </div>
                              )}
                              {v.validatedAt && (
                                <p className="text-xs text-gray-500">{formatDateTime(v.validatedAt)}</p>
                              )}
                              {v.validatedByName && (
                                <p className="text-xs text-gray-400">por {v.validatedByName}</p>
                              )}
                            </div>
                          </div>
                          {v.notes && (
                            <p className="mt-2 text-sm text-gray-500 italic">{v.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                      <p className="text-gray-500">No se validaron comprobantes en esta visita</p>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Right Column - Status + Links + Photos */}
              <div className="space-y-6">
                {/* Status Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className={cn(
                    'p-6 rounded-2xl border',
                    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                  )}
                >
                  <h3 className={cn(
                    'font-semibold mb-4',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Estado</h3>

                  <div className="space-y-4">
                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                    )}>
                      <div className="flex items-center gap-3 mb-2">
                        {log.status === 'active' ? (
                          <LogIn className="w-4 h-4 text-green-500" />
                        ) : (
                          <LogOut className="w-4 h-4 text-gray-400" />
                        )}
                        <p className="text-sm text-gray-500">Visita</p>
                      </div>
                      <p className={cn(
                        'font-semibold',
                        log.status === 'active' ? 'text-green-500' : (theme === 'dark' ? 'text-white' : 'text-gray-900')
                      )}>
                        {log.status === 'active' ? 'En curso' : 'Completada'}
                      </p>
                    </div>

                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                    )}>
                      <div className="flex items-center gap-3 mb-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <p className="text-sm text-gray-500">Comprobantes</p>
                      </div>
                      <p className={cn(
                        'font-semibold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {invoiceValidations.length} validado{invoiceValidations.length !== 1 ? 's' : ''}
                      </p>
                    </div>

                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                    )}>
                      <div className="flex items-center gap-3 mb-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <p className="text-sm text-gray-500">Fecha</p>
                      </div>
                      <p className={cn(
                        'font-semibold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{formatDate(log.entryTime)}</p>
                    </div>
                  </div>
                </motion.div>

                {/* Link to Visitor */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Link href={`/dashboard/market/door-security/visitors/${log.visitorId}`}>
                    <div className={cn(
                      'p-4 rounded-2xl border transition-colors cursor-pointer',
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-700/50'
                        : 'bg-white border-gray-200 shadow-sm hover:bg-gray-50'
                    )}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shrink-0">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={cn(
                            'font-medium truncate',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>{log.visitorName}</p>
                          <p className="text-sm text-gray-500">Ver perfil del visitante</p>
                        </div>
                        <ArrowLeft className="w-4 h-4 text-gray-400 rotate-180" />
                      </div>
                    </div>
                  </Link>
                </motion.div>

                {/* Photo Gallery */}
                {photosWithUrl.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
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
                        <Camera className="w-5 h-5 text-amber-500" />
                      </div>
                      <h3 className={cn(
                        'font-semibold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>Fotos de Comprobantes</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {photosWithUrl.map((v) => (
                        <div
                          key={v.id}
                          className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 cursor-pointer hover:ring-2 hover:ring-teal-500 transition-all"
                          onClick={() => setLightboxUrl(v.photoUrl)}
                        >
                          <Image
                            src={v.photoUrl!}
                            alt={`Comprobante ${v.documentNumber || v.id}`}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                            <p className="text-white text-xs font-medium truncate">
                              {DOC_TYPE_LABELS[v.documentType] || v.documentType}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Registration Info */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className={cn(
                    'p-4 rounded-xl border text-sm',
                    theme === 'dark' ? 'bg-gray-800/30 border-gray-700' : 'bg-gray-50 border-gray-200'
                  )}
                >
                  <p className="text-gray-500">
                    Registro creado el {formatDateTime(log.createdAt)}
                  </p>
                  {log.validatedByName && log.validatedAt && (
                    <p className="text-gray-500 mt-1">
                      Validado por {log.validatedByName} el {formatDateTime(log.validatedAt)}
                    </p>
                  )}
                </motion.div>
              </div>
            </div>
          </div>
        </div>

        {/* Image Lightbox */}
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
            onClick={() => setLightboxUrl(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative max-w-4xl max-h-[90vh] w-full"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setLightboxUrl(null)}
                className="absolute -top-10 right-0 text-white/80 hover:text-white text-sm font-medium z-10"
              >
                Cerrar &times;
              </button>
              <div className="relative w-full h-[80vh] rounded-xl overflow-hidden bg-black">
                <Image
                  src={lightboxUrl}
                  alt="Comprobante"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  )
}
