'use client'

import { useEffect, useState, use } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  User,
  Calendar,
  MapPin,
  CreditCard,
  Clock,
  LogIn,
  LogOut,
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  Image as ImageIcon,
  History,
  Shield,
  Eye
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface VisitorDetail {
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
  kioskName: string
}

interface VisitHistory {
  id: number
  entryTime: string
  exitTime: string | null
  visitPurpose: string | null
  notes: string | null
  status: string
  kioskName: string
}

interface VisitorData {
  visitor: VisitorDetail
  isCurrentlyInside: boolean
  activeLog: ActiveLog | null
  recentHistory: VisitHistory[]
}

const VISIT_PURPOSES: Record<string, string> = {
  compra: 'Compra',
  reunion: 'Reunión',
  entrega: 'Entrega',
  servicio: 'Servicio',
  otro: 'Otro'
}

const GENDER_LABELS: Record<string, string> = {
  M: 'Masculino',
  F: 'Femenino'
}

export default function VisitorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { theme } = useTheme()
  const router = useRouter()
  const resolvedParams = use(params)
  const visitorId = resolvedParams.id

  const [data, setData] = useState<VisitorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('details')
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<'front' | 'reverse'>('front')

  useEffect(() => {
    fetchVisitor()
  }, [visitorId])

  const fetchVisitor = async () => {
    try {
      const response = await fetch(`/api/market/door-security/visitors/${visitorId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setData(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching visitor:', error)
    } finally {
      setLoading(false)
    }
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

  const calculateAge = (dateOfBirth: string | null) => {
    if (!dateOfBirth) return null
    const today = new Date()
    const birth = new Date(dateOfBirth)
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  const openPhotoModal = (type: 'front' | 'reverse') => {
    setSelectedPhoto(type)
    setShowPhotoModal(true)
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
                <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
              </div>
              <p className="text-gray-500">Cargando detalles...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (!data) {
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
                <User className="w-8 h-8 text-red-500" />
              </div>
              <h2 className={cn(
                'text-xl font-bold mb-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Visitante no encontrado
              </h2>
              <p className="text-gray-500 mb-6">No pudimos cargar los detalles de este visitante.</p>
              <Link href="/dashboard/market/door-security/visitors">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver a visitantes
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
          {/* Header Section */}
          <div className="max-w-6xl mx-auto mb-8">
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
            </div>

            {/* Visitor Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'p-6 rounded-2xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                {/* Left: Visitor Info */}
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'w-16 h-16 rounded-2xl flex items-center justify-center shrink-0',
                    isCurrentlyInside
                      ? 'bg-gradient-to-br from-green-500 to-emerald-500'
                      : 'bg-gradient-to-br from-teal-500 to-cyan-500'
                  )}>
                    <User className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h1 className={cn(
                        'text-2xl md:text-3xl font-bold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {visitor.fullName}
                      </h1>
                      {isCurrentlyInside ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          Adentro
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                          Afuera
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <CreditCard className="w-4 h-4" />
                      <span>{visitor.idType || 'ID'}: <span className="font-mono">{visitor.idNumber}</span></span>
                    </div>
                    {visitor.nationality && (
                      <p className="text-sm text-gray-500 mt-1">
                        {visitor.nationality} {visitor.gender && `• ${GENDER_LABELS[visitor.gender] || visitor.gender}`}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Stats */}
                <div className="text-right">
                  <p className="text-sm text-gray-500 mb-1">Total de Visitas</p>
                  <p className={cn(
                    'text-4xl font-bold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {visitor.totalVisits}
                  </p>
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
                { key: 'documents', label: 'Documentos', icon: ImageIcon },
                { key: 'history', label: 'Historial', icon: History, count: recentHistory.length }
              ].map(tab => {
                const TabIcon = tab.icon
                return (
                  <motion.button
                    key={tab.key}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap',
                      activeTab === tab.key
                        ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg shadow-teal-500/25'
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
                  {/* Active Visit Alert */}
                  {isCurrentlyInside && activeLog && (
                    <div className={cn(
                      'p-4 rounded-xl border-2',
                      theme === 'dark'
                        ? 'bg-green-900/20 border-green-700'
                        : 'bg-green-50 border-green-200'
                    )}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                          <LogIn className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-green-700 dark:text-green-400">
                            Visita Activa
                          </h3>
                          <p className="text-sm text-green-600 dark:text-green-500 mt-1">
                            Entrada: {formatDateTime(activeLog.entryTime)}
                            {activeLog.visitPurpose && ` • ${VISIT_PURPOSES[activeLog.visitPurpose] || activeLog.visitPurpose}`}
                            {activeLog.kioskName && ` • ${activeLog.kioskName}`}
                          </p>
                          {activeLog.notes && (
                            <p className="text-sm text-green-600 dark:text-green-500 mt-1 italic">
                              Notas: {activeLog.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Info Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                    )}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          theme === 'dark' ? 'bg-teal-900/30' : 'bg-teal-100'
                        )}>
                          <History className="w-5 h-5 text-teal-500" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Total Visitas</p>
                          <p className={cn(
                            'text-xl font-bold',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>{visitor.totalVisits}</p>
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
                          theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                        )}>
                          <Calendar className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Primera Visita</p>
                          <p className={cn(
                            'text-sm font-medium',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>{formatDate(visitor.firstVisit)}</p>
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
                          <Clock className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Última Visita</p>
                          <p className={cn(
                            'text-sm font-medium',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>{formatDate(visitor.lastVisit)}</p>
                        </div>
                      </div>
                    </div>

                    {visitor.dateOfBirth && age !== null && (
                      <div className={cn(
                        'p-4 rounded-xl border',
                        theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                      )}>
                        <div className="flex items-center gap-3 mb-2">
                          <div className={cn(
                            'w-10 h-10 rounded-lg flex items-center justify-center',
                            theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100'
                          )}>
                            <User className="w-5 h-5 text-amber-500" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Edad</p>
                            <p className={cn(
                              'text-xl font-bold',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{age} años</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Personal Info */}
                  <div className={cn(
                    'p-6 rounded-xl border',
                    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                  )}>
                    <h3 className={cn(
                      'font-semibold mb-4 flex items-center gap-2',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <User className="w-5 h-5 text-teal-500" />
                      Información Personal
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-500">Nombre Completo</p>
                          <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {visitor.fullName}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Documento de Identidad</p>
                          <p className={cn('font-medium font-mono', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {visitor.idType || 'ID'}: {visitor.idNumber}
                          </p>
                        </div>
                        {visitor.dateOfBirth && (
                          <div>
                            <p className="text-sm text-gray-500">Fecha de Nacimiento</p>
                            <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {formatDate(visitor.dateOfBirth)}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="space-y-3">
                        {visitor.gender && (
                          <div>
                            <p className="text-sm text-gray-500">Género</p>
                            <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {GENDER_LABELS[visitor.gender] || visitor.gender}
                            </p>
                          </div>
                        )}
                        {visitor.nationality && (
                          <div>
                            <p className="text-sm text-gray-500">Nacionalidad</p>
                            <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {visitor.nationality}
                            </p>
                          </div>
                        )}
                        {visitor.address && (
                          <div>
                            <p className="text-sm text-gray-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> Dirección
                            </p>
                            <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {visitor.address}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'documents' && (
                <motion.div
                  key="documents"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <div className={cn(
                    'p-6 rounded-xl border',
                    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                  )}>
                    <h3 className={cn(
                      'font-semibold mb-4 flex items-center gap-2',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <CreditCard className="w-5 h-5 text-teal-500" />
                      Documento de Identidad
                    </h3>

                    {(visitor.idPhotoUrl || visitor.idPhotoReverseUrl) ? (
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Front Photo */}
                        <div>
                          <p className="text-sm text-gray-500 mb-2">Frente</p>
                          {visitor.idPhotoUrl ? (
                            <div
                              className="relative group cursor-pointer"
                              onClick={() => openPhotoModal('front')}
                            >
                              <img
                                src={visitor.idPhotoUrl}
                                alt="Documento - Frente"
                                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 object-cover aspect-[3/2]"
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                                <Eye className="w-8 h-8 text-white" />
                              </div>
                            </div>
                          ) : (
                            <div className={cn(
                              'aspect-[3/2] rounded-xl border-2 border-dashed flex items-center justify-center',
                              theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-300 bg-gray-50'
                            )}>
                              <div className="text-center text-gray-400">
                                <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                                <p className="text-sm">Sin imagen</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Reverse Photo */}
                        <div>
                          <p className="text-sm text-gray-500 mb-2">Reverso</p>
                          {visitor.idPhotoReverseUrl ? (
                            <div
                              className="relative group cursor-pointer"
                              onClick={() => openPhotoModal('reverse')}
                            >
                              <img
                                src={visitor.idPhotoReverseUrl}
                                alt="Documento - Reverso"
                                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 object-cover aspect-[3/2]"
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                                <Eye className="w-8 h-8 text-white" />
                              </div>
                            </div>
                          ) : (
                            <div className={cn(
                              'aspect-[3/2] rounded-xl border-2 border-dashed flex items-center justify-center',
                              theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-300 bg-gray-50'
                            )}>
                              <div className="text-center text-gray-400">
                                <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                                <p className="text-sm">Sin imagen</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className={cn(
                        'p-12 rounded-xl border-2 border-dashed text-center',
                        theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-300 bg-gray-50'
                      )}>
                        <ImageIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <p className={cn(
                          'font-medium mb-2',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>No hay documentos</p>
                        <p className="text-sm text-gray-500">
                          Las fotos del documento se capturan en el kiosco
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'history' && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  {recentHistory.length === 0 ? (
                    <div className={cn(
                      'p-12 rounded-xl border text-center',
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                    )}>
                      <History className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className={cn(
                        'font-medium mb-2',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>Sin historial</p>
                      <p className="text-sm text-gray-500">
                        No hay visitas registradas
                      </p>
                    </div>
                  ) : (
                    recentHistory.map((visit) => {
                      const isActive = visit.status === 'active'

                      return (
                        <motion.div
                          key={visit.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            'p-4 rounded-xl border',
                            theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                'w-10 h-10 rounded-lg flex items-center justify-center',
                                isActive
                                  ? 'bg-green-100 dark:bg-green-900/30'
                                  : 'bg-gray-100 dark:bg-gray-700'
                              )}>
                                {isActive ? (
                                  <LogIn className="w-5 h-5 text-green-600" />
                                ) : (
                                  <LogOut className="w-5 h-5 text-gray-500" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className={cn(
                                    'font-medium',
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>
                                    {formatDateTime(visit.entryTime)}
                                  </p>
                                  {isActive && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                      Activa
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500 mt-1">
                                  {VISIT_PURPOSES[visit.visitPurpose || ''] || visit.visitPurpose || 'Sin motivo'}
                                  {visit.kioskName && ` • ${visit.kioskName}`}
                                </p>
                                {visit.notes && (
                                  <p className="text-sm text-gray-400 mt-1 italic">
                                    {visit.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              {visit.exitTime ? (
                                <div>
                                  <p className="text-sm text-gray-500">Salida</p>
                                  <p className={cn(
                                    'font-medium',
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>
                                    {formatDateTime(visit.exitTime)}
                                  </p>
                                </div>
                              ) : isActive ? (
                                <span className="text-sm text-green-500">En curso</span>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )
                    })
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Photo Modal */}
          <AnimatePresence>
            {showPhotoModal && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowPhotoModal(false)}
                  className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="fixed inset-4 z-50 flex items-center justify-center"
                  onClick={() => setShowPhotoModal(false)}
                >
                  <div className="relative max-w-4xl max-h-full" onClick={e => e.stopPropagation()}>
                    <img
                      src={selectedPhoto === 'front' ? visitor.idPhotoUrl! : visitor.idPhotoReverseUrl!}
                      alt={`Documento - ${selectedPhoto === 'front' ? 'Frente' : 'Reverso'}`}
                      className="max-w-full max-h-[80vh] rounded-xl object-contain"
                    />
                    <button
                      onClick={() => setShowPhotoModal(false)}
                      className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                    >
                      <XCircle className="w-6 h-6" />
                    </button>

                    {/* Photo tabs */}
                    {visitor.idPhotoUrl && visitor.idPhotoReverseUrl && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 p-1 rounded-full">
                        <button
                          onClick={() => setSelectedPhoto('front')}
                          className={cn(
                            'px-4 py-2 rounded-full text-sm font-medium transition-colors',
                            selectedPhoto === 'front'
                              ? 'bg-white text-black'
                              : 'text-white hover:bg-white/20'
                          )}
                        >
                          Frente
                        </button>
                        <button
                          onClick={() => setSelectedPhoto('reverse')}
                          className={cn(
                            'px-4 py-2 rounded-full text-sm font-medium transition-colors',
                            selectedPhoto === 'reverse'
                              ? 'bg-white text-black'
                              : 'text-white hover:bg-white/20'
                          )}
                        >
                          Reverso
                        </button>
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
