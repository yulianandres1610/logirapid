'use client'

import { useEffect, useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Loader2,
  User,
  Calendar,
  MapPin,
  Clock,
  CreditCard,
  AlertTriangle,
  Shield,
  History,
  LogIn,
  LogOut,
  Trash2
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useCompany } from '@/contexts/company-context'

interface Visitor {
  id: number
  fullName: string
  idType: string | null
  idNumber: string
  dateOfBirth: string | null
  address: string | null
  nationality: string | null
  gender: string | null
  idPhotoUrl: string | null
  idPhotoReverseUrl: string | null
  firstVisit: string
  lastVisit: string | null
  totalVisits: number
  createdAt: string
}

interface ActiveLog {
  id: number
  entryTime: string
  visitPurpose: string | null
  notes: string | null
  hasPendingInvoices: boolean
  kioskName: string | null
}

interface HistoryItem {
  id: number
  entryTime: string
  exitTime: string | null
  visitPurpose: string | null
  notes: string | null
  status: string
  kioskName: string | null
}

interface VisitorData {
  visitor: Visitor
  isCurrentlyInside: boolean
  activeLog: ActiveLog | null
  recentHistory: HistoryItem[]
}

export default function VisitorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { theme } = useTheme()
  const { companyInfo } = useCompany()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<VisitorData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Check if user is admin
  const isAdmin = companyInfo.userRole === 'SUPER_ADMIN' || companyInfo.userRole === 'ADMIN'

  const fetchVisitor = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/market/door-security/visitors/${resolvedParams.id}`)
      const json = await res.json()

      if (json.success) {
        setData(json.data)
      } else {
        setError(json.error || 'Error al cargar el visitante')
      }
    } catch {
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }, [resolvedParams.id])

  useEffect(() => {
    fetchVisitor()
  }, [fetchVisitor])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/market/door-security/visitors/${resolvedParams.id}`, {
        method: 'DELETE'
      })
      const json = await res.json()

      if (json.success) {
        router.push('/dashboard/market/door-security/visitors')
      } else {
        setError(json.error || 'Error al eliminar visitante')
        setShowDeleteConfirm(false)
      }
    } catch {
      setError('Error de conexion al eliminar')
      setShowDeleteConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

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

  const calculateAge = (dateOfBirth: string | null) => {
    if (!dateOfBirth) return null
    const birth = new Date(dateOfBirth)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
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
                {error || 'Visitante no encontrado'}
              </h2>
              <p className="text-gray-500 mb-6">No pudimos cargar los detalles de este visitante.</p>
              <Link href="/dashboard/market/door-security/visitors">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver al listado
                </motion.button>
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const { visitor, isCurrentlyInside, activeLog, recentHistory } = data
  const age = calculateAge(visitor.dateOfBirth)

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <div className="max-w-6xl mx-auto">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-6">
              <Link href="/dashboard/market/door-security/visitors">
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

              {/* Delete Button - Admin Only */}
              {isAdmin && !isCurrentlyInside && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowDeleteConfirm(true)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl transition-colors',
                    'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'
                  )}
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="font-medium">Eliminar</span>
                </motion.button>
              )}
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={cn(
                    'w-full max-w-md p-6 rounded-2xl',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                  )}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <h3 className={cn(
                        'text-lg font-bold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>Eliminar Visitante</h3>
                      <p className="text-sm text-gray-500">Esta accion no se puede deshacer</p>
                    </div>
                  </div>

                  <p className={cn(
                    'mb-6',
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  )}>
                    ¿Estas seguro que deseas eliminar a <strong>{visitor.fullName}</strong>?
                    Se eliminara todo su historial de visitas.
                  </p>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleting}
                      className={cn(
                        'flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors',
                        theme === 'dark'
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {deleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      {deleting ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}

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
                  isCurrentlyInside
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
                      {visitor.fullName}
                    </h1>
                    {isCurrentlyInside && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Adentro
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4" />
                      {visitor.idType || 'ID'}: {visitor.idNumber}
                    </span>
                    {visitor.nationality && (
                      <span className="flex items-center gap-1.5">
                        <Shield className="w-4 h-4" />
                        {visitor.nationality}
                      </span>
                    )}
                    {visitor.gender && (
                      <span>
                        {visitor.gender === 'M' ? 'Masculino' : visitor.gender === 'F' ? 'Femenino' : visitor.gender}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className={cn(
                  'p-4 rounded-xl',
                  theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                )}>
                  <p className="text-sm text-gray-500 mb-1">Total de visitas</p>
                  <p className={cn(
                    'text-3xl font-bold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {visitor.totalVisits}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Active Visit Alert */}
            {activeLog && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800"
              >
                <div className="flex items-center gap-3 mb-2">
                  <LogIn className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <h3 className="font-semibold text-green-800 dark:text-green-400">Visita Activa</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-green-600 dark:text-green-500">Entrada</p>
                    <p className="font-medium text-green-800 dark:text-green-300">{formatDateTime(activeLog.entryTime)}</p>
                  </div>
                  <div>
                    <p className="text-green-600 dark:text-green-500">Motivo</p>
                    <p className="font-medium text-green-800 dark:text-green-300">{activeLog.visitPurpose || 'No especificado'}</p>
                  </div>
                  <div>
                    <p className="text-green-600 dark:text-green-500">Kiosko</p>
                    <p className="font-medium text-green-800 dark:text-green-300">{activeLog.kioskName || '-'}</p>
                  </div>
                  {activeLog.hasPendingInvoices && (
                    <div>
                      <p className="text-amber-600 dark:text-amber-500">Estado</p>
                      <p className="font-medium text-amber-700 dark:text-amber-300">Facturas pendientes</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Info */}
              <div className="lg:col-span-2 space-y-6">
                {/* Personal Info */}
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
                      theme === 'dark' ? 'bg-teal-900/30' : 'bg-teal-100'
                    )}>
                      <User className="w-5 h-5 text-teal-500" />
                    </div>
                    <h3 className={cn(
                      'font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Informacion Personal</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Nombre Completo</p>
                      <p className={cn(
                        'font-medium',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{visitor.fullName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Numero de Identificacion</p>
                      <p className={cn(
                        'font-medium font-mono',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{visitor.idNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Tipo de Documento</p>
                      <p className={cn(
                        'font-medium',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{visitor.idType || 'No especificado'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Fecha de Nacimiento</p>
                      <p className={cn(
                        'font-medium',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {formatDate(visitor.dateOfBirth)}
                        {age !== null && <span className="text-gray-500 ml-2">({age} anos)</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Nacionalidad</p>
                      <p className={cn(
                        'font-medium',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{visitor.nationality || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Genero</p>
                      <p className={cn(
                        'font-medium',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {visitor.gender === 'M' ? 'Masculino' : visitor.gender === 'F' ? 'Femenino' : visitor.gender || '-'}
                      </p>
                    </div>
                    {visitor.address && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          Direccion
                        </p>
                        <p className={cn(
                          'font-medium',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>{visitor.address}</p>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Visit History */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className={cn(
                    'p-6 rounded-2xl border',
                    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                  )}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className={cn(
                      'p-2 rounded-xl',
                      theme === 'dark' ? 'bg-indigo-900/30' : 'bg-indigo-100'
                    )}>
                      <History className="w-5 h-5 text-indigo-500" />
                    </div>
                    <h3 className={cn(
                      'font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Historial de Visitas</h3>
                  </div>

                  {recentHistory.length > 0 ? (
                    <div className="space-y-3">
                      {recentHistory.map((log) => (
                        <div
                          key={log.id}
                          className={cn(
                            'p-4 rounded-xl border',
                            log.status === 'active'
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                              : theme === 'dark'
                                ? 'bg-gray-700/50 border-gray-600'
                                : 'bg-gray-50 border-gray-200'
                          )}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center',
                                log.status === 'active'
                                  ? 'bg-green-100 dark:bg-green-900/50'
                                  : log.status === 'completed'
                                    ? 'bg-gray-100 dark:bg-gray-600'
                                    : 'bg-red-100 dark:bg-red-900/50'
                              )}>
                                {log.status === 'active' ? (
                                  <LogIn className="w-4 h-4 text-green-600 dark:text-green-400" />
                                ) : (
                                  <LogOut className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                )}
                              </div>
                              <div>
                                <p className={cn(
                                  'font-medium',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {formatDateTime(log.entryTime)}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {log.visitPurpose || 'Sin motivo'} {log.kioskName && `- ${log.kioskName}`}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              {log.exitTime ? (
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  Salida: {formatDateTime(log.exitTime)}
                                </p>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs font-medium">
                                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                  Activa
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <History className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                      <p className="text-gray-500">Sin historial de visitas</p>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Right Column - Stats & Photos */}
              <div className="space-y-6">
                {/* Stats */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className={cn(
                    'p-6 rounded-2xl border',
                    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                  )}
                >
                  <h3 className={cn(
                    'font-semibold mb-4',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Estadisticas</h3>

                  <div className="space-y-4">
                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                    )}>
                      <div className="flex items-center gap-3 mb-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <p className="text-sm text-gray-500">Primera visita</p>
                      </div>
                      <p className={cn(
                        'font-semibold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{formatDate(visitor.firstVisit)}</p>
                    </div>

                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                    )}>
                      <div className="flex items-center gap-3 mb-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <p className="text-sm text-gray-500">Ultima visita</p>
                      </div>
                      <p className={cn(
                        'font-semibold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{formatDate(visitor.lastVisit)}</p>
                    </div>

                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                    )}>
                      <div className="flex items-center gap-3 mb-2">
                        <History className="w-4 h-4 text-gray-400" />
                        <p className="text-sm text-gray-500">Total de visitas</p>
                      </div>
                      <p className={cn(
                        'text-2xl font-bold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{visitor.totalVisits}</p>
                    </div>
                  </div>
                </motion.div>

                {/* ID Photos */}
                {(visitor.idPhotoUrl || visitor.idPhotoReverseUrl) && (
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
                        theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100'
                      )}>
                        <CreditCard className="w-5 h-5 text-amber-500" />
                      </div>
                      <h3 className={cn(
                        'font-semibold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>Documento de Identidad</h3>
                    </div>

                    <div className="space-y-4">
                      {visitor.idPhotoUrl && (
                        <div>
                          <p className="text-sm text-gray-500 mb-2">Frente</p>
                          <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700">
                            <Image
                              src={visitor.idPhotoUrl}
                              alt="Documento frente"
                              fill
                              className="object-contain"
                              unoptimized
                            />
                          </div>
                        </div>
                      )}
                      {visitor.idPhotoReverseUrl && (
                        <div>
                          <p className="text-sm text-gray-500 mb-2">Reverso</p>
                          <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700">
                            <Image
                              src={visitor.idPhotoReverseUrl}
                              alt="Documento reverso"
                              fill
                              className="object-contain"
                              unoptimized
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Registration Info */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className={cn(
                    'p-4 rounded-xl border text-sm',
                    theme === 'dark' ? 'bg-gray-800/30 border-gray-700' : 'bg-gray-50 border-gray-200'
                  )}
                >
                  <p className="text-gray-500">
                    Registrado el {formatDateTime(visitor.createdAt)}
                  </p>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
