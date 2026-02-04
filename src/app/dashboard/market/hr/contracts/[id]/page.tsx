'use client'

import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  FileText,
  User,
  Building2,
  Clock,
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Edit,
  Scan,
  Camera,
  Briefcase,
  Hash,
  CreditCard,
  Percent,
  Trash2,
  UserCheck,
  ScanFace
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { useFaceRecognition } from '@/hooks/useFaceRecognition'

interface Contract {
  id: number
  companyId: number
  employeeId: number
  employeeName: string
  employeeCode: string
  employeeEmail: string
  contractNumber: string
  contractType: string
  startDate: string
  endDate: string | null
  payType: string
  payRate: number
  currency: string
  commissionRate: number
  departmentId: number | null
  departmentName: string | null
  departmentCode: string | null
  scheduleId: number | null
  scheduleName: string | null
  weeklyHours: number | null
  scheduleDays: Array<{
    dayOfWeek: number
    dayName: string
    startTime: string | null
    endTime: string | null
    breakMinutes: number
    isWorkDay: boolean
  }>
  position: string | null
  status: string
  terminationDate: string | null
  terminationReason: string | null
  notes: string | null
  photoUrl: string | null
  photoOriginalUrl: string | null
  photoProcessedAt: string | null
  createdAt: string
  updatedAt: string
}

interface FaceData {
  hasFaceRegistered: boolean
  faces: Array<{
    id: number
    faceEncoding: string
    photoUrl: string | null
    isPrimary: boolean
    createdAt: string
  }>
}

const STATUS_CONFIG: Record<string, {
  label: string
  color: string
  bgGradient: string
  icon: React.ElementType
}> = {
  active: {
    label: 'Activo',
    color: 'emerald',
    bgGradient: 'from-emerald-500 to-teal-500',
    icon: CheckCircle
  },
  terminated: {
    label: 'Terminado',
    color: 'red',
    bgGradient: 'from-red-500 to-rose-500',
    icon: XCircle
  },
  suspended: {
    label: 'Suspendido',
    color: 'amber',
    bgGradient: 'from-amber-500 to-orange-500',
    icon: AlertCircle
  }
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  indefinido: 'Indefinido',
  temporal: 'Temporal',
  por_obra: 'Por Obra'
}

const PAY_TYPE_LABELS: Record<string, string> = {
  hourly: 'Por Hora',
  daily: 'Por Día',
  monthly: 'Mensual'
}

export default function ContractDetailPage() {
  const params = useParams()
  const router = useRouter()
  const contractId = params.id as string
  const { theme } = useTheme()
  const [contract, setContract] = useState<Contract | null>(null)
  const [faceData, setFaceData] = useState<FaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Face registration
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [showFaceCapture, setShowFaceCapture] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [capturingFace, setCapturingFace] = useState(false)
  const [faceError, setFaceError] = useState<string | null>(null)

  const {
    isModelLoaded,
    isLoading: modelsLoading,
    error: modelError,
    detectFace,
    descriptorToString
  } = useFaceRecognition()

  useEffect(() => {
    fetchContract()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId])

  useEffect(() => {
    if (contract?.employeeId) {
      fetchFaceData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract?.employeeId])

  // Camera management
  useEffect(() => {
    if (showFaceCapture && isModelLoaded) {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [showFaceCapture, isModelLoaded])

  const fetchContract = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/market/hr/contracts/${contractId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setContract(data.data)
        }
      }
    } catch (error) {
      console.error('Error fetching contract:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchFaceData = async () => {
    if (!contract?.employeeId) return
    try {
      const response = await fetch(`/api/market/hr/employees/${contract.employeeId}/register-face`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setFaceData(data.data)
        }
      }
    } catch (error) {
      console.error('Error fetching face data:', error)
    }
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setCameraActive(true)
        setFaceError(null)
      }
    } catch (err: any) {
      console.error('Error accessing camera:', err)
      setFaceError('No se pudo acceder a la cámara. Verifique los permisos.')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }

  const captureFace = async () => {
    if (!videoRef.current || !isModelLoaded || !contract) return

    try {
      setCapturingFace(true)
      setFaceError(null)

      let bestDescriptor: Float32Array | null = null
      let attempts = 0
      const MAX_ATTEMPTS = 3

      while (!bestDescriptor && attempts < MAX_ATTEMPTS) {
        attempts++
        const descriptor = await detectFace(videoRef.current, {
          skipCooldown: true,
          minFaceSize: 80
        })

        if (descriptor) {
          bestDescriptor = descriptor
        } else if (attempts < MAX_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      if (!bestDescriptor) {
        setFaceError('No se detectó ningún rostro. Asegúrese de estar bien iluminado y mirando a la cámara.')
        return
      }

      const encodingString = descriptorToString(bestDescriptor)

      // Register face
      const response = await fetch(`/api/market/hr/employees/${contract.employeeId}/register-face`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faceEncoding: encodingString,
          photoUrl: contract.photoUrl
        })
      })

      const result = await response.json()

      if (result.success) {
        setShowFaceCapture(false)
        fetchFaceData()
      } else {
        setFaceError(result.error || 'Error al registrar el rostro')
      }

    } catch (err: any) {
      console.error('Error capturing face:', err)
      setFaceError('Error al capturar el rostro: ' + err.message)
    } finally {
      setCapturingFace(false)
    }
  }

  const deleteFace = async () => {
    if (!contract || !confirm('¿Está seguro de eliminar el registro facial? El empleado no podrá usar el kiosco.')) return

    setActionLoading(true)
    try {
      const response = await fetch(`/api/market/hr/employees/${contract.employeeId}/register-face`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchFaceData()
      } else {
        const data = await response.json()
        alert(data.error || 'Error al eliminar registro facial')
      }
    } catch (error) {
      console.error('Error deleting face:', error)
      alert('Error al eliminar registro facial')
    } finally {
      setActionLoading(false)
    }
  }

  const handleTerminate = async () => {
    if (!confirm('¿Está seguro de terminar este contrato?')) return

    setActionLoading(true)
    try {
      const response = await fetch(`/api/market/hr/contracts/${contractId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchContract()
      } else {
        const data = await response.json()
        alert(data.error || 'Error al terminar el contrato')
      }
    } catch (error) {
      console.error('Error terminating contract:', error)
      alert('Error al terminar el contrato')
    } finally {
      setActionLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    const symbol = currency === 'EUR' ? '€' : '$'
    return `${symbol}${amount.toFixed(2)} ${currency}`
  }

  const getContractDuration = () => {
    if (!contract) return '-'
    const start = new Date(contract.startDate)
    const end = contract.endDate ? new Date(contract.endDate) : new Date()
    const months = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30))
    if (months < 1) return 'Menos de 1 mes'
    if (months === 1) return '1 mes'
    if (months < 12) return `${months} meses`
    const years = Math.floor(months / 12)
    const remainingMonths = months % 12
    if (remainingMonths === 0) return `${years} año${years > 1 ? 's' : ''}`
    return `${years} año${years > 1 ? 's' : ''} y ${remainingMonths} mes${remainingMonths > 1 ? 'es' : ''}`
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
                <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
              </div>
              <p className="text-gray-500">Cargando detalles del contrato...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (!contract) {
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
                <FileText className="w-8 h-8 text-red-500" />
              </div>
              <h2 className={cn(
                'text-xl font-bold mb-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Contrato no encontrado
              </h2>
              <p className="text-gray-500 mb-6">No pudimos cargar los detalles de este contrato.</p>
              <Link href="/dashboard/market/hr/contracts">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver a contratos
                </motion.button>
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const statusConfig = STATUS_CONFIG[contract.status] || STATUS_CONFIG.active
  const StatusIcon = statusConfig.icon

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          {/* Header Section */}
          <div className="max-w-6xl mx-auto mb-8">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-6">
              <Link href="/dashboard/market/hr/contracts">
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
                <Link href={`/dashboard/market/hr/contracts/create?edit=${contractId}`}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl transition-colors',
                      theme === 'dark'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    <Edit className="w-4 h-4" />
                    <span className="font-medium hidden sm:inline">Editar</span>
                  </motion.button>
                </Link>

                {contract.status === 'active' && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleTerminate}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">Terminar</span>
                  </motion.button>
                )}
              </div>
            </div>

            {/* Contract Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'rounded-2xl border overflow-hidden',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <div className="grid grid-cols-1 lg:grid-cols-3">
                {/* Employee Photo */}
                <div className={cn(
                  'p-8 lg:p-12 flex items-center justify-center',
                  `bg-gradient-to-br ${statusConfig.bgGradient}`
                )}>
                  <div className="text-center">
                    {contract.photoUrl ? (
                      <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white/30 mx-auto mb-4 shadow-lg">
                        <Image
                          src={contract.photoUrl}
                          alt={contract.employeeName}
                          width={128}
                          height={128}
                          className="w-full h-full object-cover"
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

                {/* Contract Info */}
                <div className="lg:col-span-2 p-6 flex flex-col">
                  {/* Employee Name & Contract Number */}
                  <div className="mb-4">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h1 className={cn(
                        'text-2xl md:text-3xl font-bold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {contract.employeeName}
                      </h1>
                    </div>
                    <p className="text-gray-500">
                      Contrato {contract.contractNumber} - {CONTRACT_TYPE_LABELS[contract.contractType] || contract.contractType}
                    </p>
                  </div>

                  {/* Info Tags */}
                  <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap mb-6">
                    <span className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    )}>
                      <Hash className="w-4 h-4" />
                      {contract.employeeCode}
                    </span>
                    {contract.position && (
                      <span className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                      )}>
                        <Briefcase className="w-4 h-4" />
                        {contract.position}
                      </span>
                    )}
                    {contract.departmentName && (
                      <span className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                      )}>
                        <Building2 className="w-4 h-4" />
                        {contract.departmentName}
                      </span>
                    )}
                    {contract.scheduleName && (
                      <span className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                      )}>
                        <Clock className="w-4 h-4" />
                        {contract.scheduleName}
                      </span>
                    )}
                  </div>

                  {/* Totals Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-auto">
                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                    )}>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tipo de Pago</p>
                      <p className={cn(
                        'text-lg font-bold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{PAY_TYPE_LABELS[contract.payType] || contract.payType}</p>
                    </div>

                    <div className={cn(
                      'p-4 rounded-xl',
                      'bg-gradient-to-br from-amber-500/10 to-amber-600/10 border-2 border-amber-500/30'
                    )}>
                      <p className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">Salario</p>
                      <p className="text-xl font-bold text-amber-600">
                        {formatCurrency(contract.payRate, contract.currency)}
                      </p>
                    </div>

                    {contract.commissionRate > 0 && (
                      <div className={cn(
                        'p-4 rounded-xl',
                        theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                      )}>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Comisión</p>
                        <p className={cn(
                          'text-lg font-bold',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>{contract.commissionRate}%</p>
                      </div>
                    )}

                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                    )}>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Duración</p>
                      <p className={cn(
                        'text-lg font-bold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{getContractDuration()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Content */}
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: 'Fecha Inicio',
                  value: formatDate(contract.startDate),
                  icon: Calendar,
                  color: 'blue'
                },
                {
                  label: 'Fecha Fin',
                  value: contract.endDate ? formatDate(contract.endDate) : 'Indefinido',
                  icon: Calendar,
                  color: 'purple'
                },
                {
                  label: 'Horas/Semana',
                  value: contract.weeklyHours ? `${contract.weeklyHours}h` : 'N/A',
                  icon: Clock,
                  color: 'emerald'
                },
                {
                  label: 'Registro Facial',
                  value: faceData?.hasFaceRegistered ? 'Registrado' : 'Pendiente',
                  icon: faceData?.hasFaceRegistered ? UserCheck : ScanFace,
                  color: faceData?.hasFaceRegistered ? 'emerald' : 'amber'
                }
              ].map((stat, idx) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={cn(
                    'p-5 rounded-2xl border relative overflow-hidden',
                    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center mb-3',
                    stat.color === 'blue' && (theme === 'dark' ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-600'),
                    stat.color === 'purple' && (theme === 'dark' ? 'bg-purple-900/50 text-purple-400' : 'bg-purple-100 text-purple-600'),
                    stat.color === 'emerald' && (theme === 'dark' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-100 text-emerald-600'),
                    stat.color === 'amber' && (theme === 'dark' ? 'bg-amber-900/50 text-amber-400' : 'bg-amber-100 text-amber-600')
                  )}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                  <p className={cn(
                    'text-xl font-bold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {stat.value}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Info Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Face Registration Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2 rounded-xl',
                      faceData?.hasFaceRegistered
                        ? (theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-100')
                        : (theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100')
                    )}>
                      <ScanFace className={cn(
                        'w-5 h-5',
                        faceData?.hasFaceRegistered ? 'text-emerald-500' : 'text-amber-500'
                      )} />
                    </div>
                    <h3 className={cn(
                      'font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Registro Facial (Kiosco)</h3>
                  </div>
                </div>

                {faceData?.hasFaceRegistered ? (
                  <div className="space-y-4">
                    <div className={cn(
                      'p-4 rounded-xl flex items-center gap-4',
                      theme === 'dark' ? 'bg-emerald-900/20' : 'bg-emerald-50'
                    )}>
                      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                        <CheckCircle className="w-8 h-8 text-emerald-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'font-semibold',
                          theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'
                        )}>Rostro Registrado</p>
                        <p className="text-sm text-gray-500">
                          El empleado puede usar el kiosco de asistencia
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowFaceCapture(true)}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium transition-colors',
                          theme === 'dark'
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        )}
                      >
                        <RefreshCw className="w-4 h-4" />
                        Actualizar
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={deleteFace}
                        disabled={actionLoading}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className={cn(
                      'p-4 rounded-xl flex items-center gap-4',
                      theme === 'dark' ? 'bg-amber-900/20' : 'bg-amber-50'
                    )}>
                      <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                        <AlertCircle className="w-8 h-8 text-amber-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'font-semibold',
                          theme === 'dark' ? 'text-amber-400' : 'text-amber-700'
                        )}>Sin Registro Facial</p>
                        <p className="text-sm text-gray-500">
                          El empleado no puede usar el kiosco de asistencia
                        </p>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowFaceCapture(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 transition-colors"
                    >
                      <Scan className="w-5 h-5" />
                      Registrar Rostro
                    </motion.button>
                  </div>
                )}
              </motion.div>

              {/* Department & Schedule Card */}
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
                    theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                  )}>
                    <Building2 className="w-5 h-5 text-purple-500" />
                  </div>
                  <h3 className={cn(
                    'font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Departamento y Horario</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Departamento</p>
                    <p className={cn(
                      'font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {contract.departmentName || 'Sin asignar'}
                      {contract.departmentCode && <span className="text-gray-500 font-normal ml-2">({contract.departmentCode})</span>}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500 mb-1">Horario</p>
                    <p className={cn(
                      'font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {contract.scheduleName || 'Sin asignar'}
                      {contract.weeklyHours && <span className="text-gray-500 font-normal ml-2">({contract.weeklyHours}h/semana)</span>}
                    </p>
                  </div>

                  {contract.scheduleDays && contract.scheduleDays.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-500 mb-2">Días laborales</p>
                      <div className="flex flex-wrap gap-2">
                        {contract.scheduleDays.filter(d => d.isWorkDay).map(day => (
                          <span
                            key={day.dayOfWeek}
                            className={cn(
                              'px-3 py-1 rounded-lg text-sm font-medium',
                              theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                            )}
                          >
                            {day.dayName.substring(0, 3)}
                            {day.startTime && day.endTime && (
                              <span className="text-gray-500 ml-1">
                                {day.startTime.substring(0, 5)}-{day.endTime.substring(0, 5)}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Notes Section */}
            {contract.notes && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
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
                    <FileText className="w-5 h-5 text-blue-500" />
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
                  {contract.notes}
                </p>
              </motion.div>
            )}

            {/* Termination Info */}
            {contract.status === 'terminated' && contract.terminationDate && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    'p-2 rounded-xl',
                    theme === 'dark' ? 'bg-red-900/50' : 'bg-red-100'
                  )}>
                    <XCircle className="w-5 h-5 text-red-500" />
                  </div>
                  <h3 className={cn(
                    'font-semibold',
                    theme === 'dark' ? 'text-red-400' : 'text-red-700'
                  )}>Contrato Terminado</h3>
                </div>
                <div className="space-y-2">
                  <p className={cn(
                    theme === 'dark' ? 'text-red-300' : 'text-red-600'
                  )}>
                    <strong>Fecha de terminación:</strong> {formatDate(contract.terminationDate)}
                  </p>
                  {contract.terminationReason && (
                    <p className={cn(
                      theme === 'dark' ? 'text-red-300' : 'text-red-600'
                    )}>
                      <strong>Razón:</strong> {contract.terminationReason}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

          </div>
        </div>

        {/* Face Capture Modal */}
        {showFaceCapture && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => setShowFaceCapture(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                'rounded-2xl p-6 max-w-md w-full shadow-xl',
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className={cn(
                'text-xl font-bold mb-4 text-center',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Registro Facial
              </h3>

              {modelsLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-10 h-10 animate-spin mx-auto mb-4 text-amber-600" />
                  <p className="text-gray-500">Cargando modelo de reconocimiento...</p>
                </div>
              ) : modelError ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-10 h-10 mx-auto mb-4 text-red-500" />
                  <p className="text-red-500">{modelError}</p>
                </div>
              ) : (
                <>
                  {/* Camera View - iPhone Style */}
                  <div className={cn(
                    'relative rounded-2xl overflow-hidden aspect-[3/4] mb-4',
                    theme === 'dark' ? 'bg-gray-900' : 'bg-black'
                  )}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover transform -scale-x-100"
                    />

                    {/* iPhone-style face frame overlay */}
                    {cameraActive && !capturingFace && (
                      <div className="absolute inset-0 pointer-events-none">
                        <svg className="absolute inset-0 w-full h-full">
                          <defs>
                            <mask id="faceMaskModal">
                              <rect width="100%" height="100%" fill="white" />
                              <ellipse cx="50%" cy="42%" rx="35%" ry="32%" fill="black" />
                            </mask>
                          </defs>
                          <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#faceMaskModal)" />
                          <ellipse
                            cx="50%"
                            cy="42%"
                            rx="35%"
                            ry="32%"
                            fill="none"
                            stroke="rgba(255,255,255,0.8)"
                            strokeWidth="3"
                            strokeDasharray="8 4"
                            className="animate-pulse"
                          />
                        </svg>
                        <div className="absolute bottom-6 left-0 right-0 text-center">
                          <p className="text-white text-sm font-medium px-4 py-2 bg-black/50 rounded-full mx-auto inline-block">
                            Coloque el rostro dentro del marco
                          </p>
                        </div>
                      </div>
                    )}

                    {!cameraActive && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
                        <div className="text-center">
                          <Camera className="w-12 h-12 text-gray-500 mx-auto mb-2" />
                          <p className="text-gray-400">Iniciando cámara...</p>
                        </div>
                      </div>
                    )}

                    {capturingFace && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                        <div className="text-center">
                          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                          <p className="text-white font-medium">Analizando rostro...</p>
                          <p className="text-white/70 text-sm mt-1">No se mueva</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {faceError && (
                    <div className={cn(
                      'rounded-xl p-3 mb-4 border',
                      theme === 'dark' ? 'bg-red-900/30 border-red-700' : 'bg-red-50 border-red-200'
                    )}>
                      <p className="text-sm text-red-500">{faceError}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowFaceCapture(false)}
                      className={cn(
                        'flex-1 py-3 rounded-xl font-medium transition-colors',
                        theme === 'dark'
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={captureFace}
                      disabled={!cameraActive || capturingFace}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
                    >
                      <Scan className="w-5 h-5" />
                      Capturar
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  )
}
