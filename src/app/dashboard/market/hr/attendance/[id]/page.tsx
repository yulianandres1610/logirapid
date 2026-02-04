'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  User,
  Building2,
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  LogIn,
  LogOut,
  Timer,
  Camera,
  Shield,
  Fingerprint,
  Hash,
  AlertTriangle,
  ImageOff
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface AttendanceDetail {
  id: number
  companyId: number
  employeeId: number
  employeeName: string
  employeeCode: string
  employeePhoto: string | null
  departmentName: string | null
  departmentCode: string | null
  date: string
  checkIn: string | null
  checkOut: string | null
  checkInMethod: string | null
  checkOutMethod: string | null
  checkInPhoto: string | null
  checkOutPhoto: string | null
  workedHours: number | null
  overtimeHours: number
  status: string
  lateMinutes: number
  earlyDepartureMinutes: number
  notes: string | null
  approvedBy: number | null
  approvedByName: string | null
  createdAt: string
  updatedAt: string | null
}

const STATUS_CONFIG: Record<string, {
  label: string
  color: string
  bgGradient: string
  icon: React.ElementType
}> = {
  present: {
    label: 'Presente',
    color: 'emerald',
    bgGradient: 'from-emerald-500 to-teal-500',
    icon: CheckCircle
  },
  late: {
    label: 'Tardanza',
    color: 'amber',
    bgGradient: 'from-amber-500 to-orange-500',
    icon: AlertTriangle
  },
  absent: {
    label: 'Ausente',
    color: 'red',
    bgGradient: 'from-red-500 to-rose-500',
    icon: XCircle
  },
  half_day: {
    label: 'Medio Día',
    color: 'blue',
    bgGradient: 'from-blue-500 to-indigo-500',
    icon: Clock
  }
}

const METHOD_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  face: { label: 'Reconocimiento Facial', icon: Camera },
  kiosk: { label: 'Kiosco', icon: Fingerprint },
  manual: { label: 'Manual', icon: User },
  manager_override: { label: 'Autorizado por Manager', icon: Shield }
}

export default function AttendanceDetailPage() {
  const params = useParams()
  const attendanceId = params.id as string
  const { theme } = useTheme()
  const [attendance, setAttendance] = useState<AttendanceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [imageErrors, setImageErrors] = useState<{ checkIn: boolean; checkOut: boolean }>({
    checkIn: false,
    checkOut: false
  })

  useEffect(() => {
    fetchAttendance()
  }, [attendanceId])

  const fetchAttendance = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/market/hr/attendance/${attendanceId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setAttendance(data.data)
        }
      }
    } catch (error) {
      console.error('Error fetching attendance:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '-'
    return new Date(timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const formatHours = (hours: number | null) => {
    if (hours === null || hours === undefined) return '-'
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return `${h}h ${m}m`
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
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
              </div>
              <p className="text-gray-500">Cargando detalles de asistencia...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (!attendance) {
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
                <Calendar className="w-8 h-8 text-red-500" />
              </div>
              <h2 className={cn(
                'text-xl font-bold mb-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Registro no encontrado
              </h2>
              <p className="text-gray-500 mb-6">No pudimos cargar los detalles de esta asistencia.</p>
              <Link href="/dashboard/market/hr/attendance">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver a asistencia
                </motion.button>
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const statusConfig = STATUS_CONFIG[attendance.status] || STATUS_CONFIG.present
  const StatusIcon = statusConfig.icon
  const checkInMethod = METHOD_LABELS[attendance.checkInMethod || 'manual'] || METHOD_LABELS.manual
  const checkOutMethod = METHOD_LABELS[attendance.checkOutMethod || 'manual'] || METHOD_LABELS.manual

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          {/* Header Section */}
          <div className="max-w-6xl mx-auto mb-8">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-6">
              <Link href="/dashboard/market/hr/attendance">
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

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={fetchAttendance}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl transition-colors',
                  theme === 'dark'
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                <RefreshCw className="w-4 h-4" />
                <span className="font-medium hidden sm:inline">Actualizar</span>
              </motion.button>
            </div>

            {/* Attendance Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'rounded-2xl border overflow-hidden',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <div className="grid grid-cols-1 lg:grid-cols-3">
                {/* Employee Photo / Status */}
                <div className={cn(
                  'p-8 lg:p-12 flex items-center justify-center',
                  `bg-gradient-to-br ${statusConfig.bgGradient}`
                )}>
                  <div className="text-center">
                    {attendance.employeePhoto ? (
                      <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white/30 mx-auto mb-4 shadow-lg">
                        <Image
                          src={attendance.employeePhoto}
                          alt={attendance.employeeName}
                          width={128}
                          height={128}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                        <User className="w-16 h-16 text-white/80" />
                      </div>
                    )}
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 text-white font-medium">
                      <StatusIcon className="w-5 h-5" />
                      {statusConfig.label}
                    </span>
                  </div>
                </div>

                {/* Attendance Info */}
                <div className="lg:col-span-2 p-6 flex flex-col">
                  {/* Employee Name */}
                  <div className="mb-4">
                    <h1 className={cn(
                      'text-2xl md:text-3xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {attendance.employeeName}
                    </h1>
                    <p className="text-gray-500 capitalize">
                      {formatDate(attendance.date)}
                    </p>
                  </div>

                  {/* Info Tags */}
                  <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap mb-6">
                    <span className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    )}>
                      <Hash className="w-4 h-4" />
                      {attendance.employeeCode}
                    </span>
                    {attendance.departmentName && (
                      <span className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                      )}>
                        <Building2 className="w-4 h-4" />
                        {attendance.departmentName}
                      </span>
                    )}
                    {attendance.approvedByName && (
                      <span className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                        theme === 'dark' ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-700'
                      )}>
                        <Shield className="w-4 h-4" />
                        Autorizado: {attendance.approvedByName}
                      </span>
                    )}
                  </div>

                  {/* Totals Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-auto">
                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                    )}>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Entrada</p>
                      <p className={cn(
                        'text-lg font-bold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{formatTime(attendance.checkIn)}</p>
                    </div>

                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                    )}>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Salida</p>
                      <p className={cn(
                        'text-lg font-bold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{formatTime(attendance.checkOut)}</p>
                    </div>

                    <div className={cn(
                      'p-4 rounded-xl',
                      'bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border-2 border-emerald-500/30'
                    )}>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">Horas Trabajadas</p>
                      <p className="text-xl font-bold text-emerald-600">
                        {formatHours(attendance.workedHours)}
                      </p>
                    </div>

                    {attendance.lateMinutes > 0 && (
                      <div className={cn(
                        'p-4 rounded-xl',
                        'bg-gradient-to-br from-amber-500/10 to-amber-600/10 border-2 border-amber-500/30'
                      )}>
                        <p className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">Tardanza</p>
                        <p className="text-xl font-bold text-amber-600">
                          {attendance.lateMinutes} min
                        </p>
                      </div>
                    )}

                    {attendance.overtimeHours > 0 && (
                      <div className={cn(
                        'p-4 rounded-xl',
                        'bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-2 border-blue-500/30'
                      )}>
                        <p className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">Horas Extra</p>
                        <p className="text-xl font-bold text-blue-600">
                          {formatHours(attendance.overtimeHours)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Content */}
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Photos Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Check-In Photo */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    'p-2 rounded-xl',
                    theme === 'dark' ? 'bg-green-900/30' : 'bg-green-100'
                  )}>
                    <LogIn className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <h3 className={cn(
                      'font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Foto de Entrada</h3>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <checkInMethod.icon className="w-3 h-3" />
                      {checkInMethod.label} • {formatTime(attendance.checkIn)}
                    </p>
                  </div>
                </div>

                <div className={cn(
                  'relative rounded-xl overflow-hidden aspect-video',
                  theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
                )}>
                  {attendance.checkInPhoto && !imageErrors.checkIn ? (
                    <Image
                      src={attendance.checkInPhoto}
                      alt="Foto de entrada"
                      fill
                      className="object-cover"
                      unoptimized
                      onError={() => setImageErrors(prev => ({ ...prev, checkIn: true }))}
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <ImageOff className={cn(
                        'w-16 h-16 mb-3',
                        theme === 'dark' ? 'text-gray-700' : 'text-gray-300'
                      )} />
                      <p className="text-gray-500 text-sm">Sin foto de entrada</p>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Check-Out Photo */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    'p-2 rounded-xl',
                    theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
                  )}>
                    <LogOut className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h3 className={cn(
                      'font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Foto de Salida</h3>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <checkOutMethod.icon className="w-3 h-3" />
                      {checkOutMethod.label} • {formatTime(attendance.checkOut)}
                    </p>
                  </div>
                </div>

                <div className={cn(
                  'relative rounded-xl overflow-hidden aspect-video',
                  theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
                )}>
                  {attendance.checkOutPhoto && !imageErrors.checkOut ? (
                    <Image
                      src={attendance.checkOutPhoto}
                      alt="Foto de salida"
                      fill
                      className="object-cover"
                      unoptimized
                      onError={() => setImageErrors(prev => ({ ...prev, checkOut: true }))}
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <ImageOff className={cn(
                        'w-16 h-16 mb-3',
                        theme === 'dark' ? 'text-gray-700' : 'text-gray-300'
                      )} />
                      <p className="text-gray-500 text-sm">
                        {attendance.checkOut ? 'Sin foto de salida' : 'Pendiente de marcar salida'}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: 'Estado',
                  value: statusConfig.label,
                  icon: StatusIcon,
                  color: statusConfig.color
                },
                {
                  label: 'Método Entrada',
                  value: checkInMethod.label,
                  icon: checkInMethod.icon,
                  color: 'green'
                },
                {
                  label: 'Método Salida',
                  value: attendance.checkOut ? checkOutMethod.label : 'Pendiente',
                  icon: checkOutMethod.icon,
                  color: attendance.checkOut ? 'red' : 'gray'
                },
                {
                  label: 'Salida Anticipada',
                  value: attendance.earlyDepartureMinutes > 0 ? `${attendance.earlyDepartureMinutes} min` : 'No',
                  icon: Timer,
                  color: attendance.earlyDepartureMinutes > 0 ? 'amber' : 'emerald'
                }
              ].map((stat, idx) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + idx * 0.1 }}
                  className={cn(
                    'p-5 rounded-2xl border relative overflow-hidden',
                    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center mb-3',
                    stat.color === 'emerald' && (theme === 'dark' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-100 text-emerald-600'),
                    stat.color === 'amber' && (theme === 'dark' ? 'bg-amber-900/50 text-amber-400' : 'bg-amber-100 text-amber-600'),
                    stat.color === 'red' && (theme === 'dark' ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-600'),
                    stat.color === 'green' && (theme === 'dark' ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-600'),
                    stat.color === 'gray' && (theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600')
                  )}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                  <p className={cn(
                    'text-lg font-bold truncate',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {stat.value}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Notes Section */}
            {attendance.notes && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    'p-2 rounded-xl',
                    theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                  )}>
                    <AlertCircle className="w-5 h-5 text-blue-500" />
                  </div>
                  <h3 className={cn(
                    'font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Notas</h3>
                </div>
                <p className={cn(
                  'whitespace-pre-wrap',
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                )}>
                  {attendance.notes}
                </p>
              </motion.div>
            )}

          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
