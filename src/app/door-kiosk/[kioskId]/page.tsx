'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  Clock,
  LogIn,
  LogOut,
  User,
  CheckCircle,
  XCircle,
  Keyboard,
  Camera,
  RefreshCw,
  Settings,
  ArrowLeft,
  CreditCard,
  FileText,
  Check,
  AlertTriangle,
  Package
} from 'lucide-react'

interface KioskInfo {
  id: number
  name: string
  location: string | null
  deviceId: string
  companyId: number
  companyName: string
  companyLogo: string | null
}

interface GuardInfo {
  id: number
  name: string
  code: string
}

interface VisitorInfo {
  id: number
  fullName: string
  idType: string | null
  idNumber: string
  dateOfBirth: string | null
  address: string | null
  totalVisits: number
  isCurrentlyInside: boolean
  activeLogId: number | null
}

interface ScannedIdData {
  fullName: string
  documentType: string
  documentNumber: string
  dateOfBirth: string | null
  address: string | null
  gender: string | null
  confidence: number
}

interface PendingSale {
  type: 'pos_receipt' | 'wholesale_invoice'
  id: number
  documentNumber: string
  customerName: string
  total: number
  currency: string
  items: any
  createdAt: string
  alreadyValidated: boolean
}

type KioskStep =
  | 'guard_pin'
  | 'idle'
  | 'select_action'
  | 'scan_id'
  | 'processing_id'
  | 'visitor_info'
  | 'select_purpose'
  | 'entry_success'
  | 'check_sales'
  | 'validate_sales'
  | 'exit_success'
  | 'error'

const VISIT_PURPOSES = [
  { id: 'compra', label: 'Compra', icon: Package },
  { id: 'reunion', label: 'Reunión', icon: User },
  { id: 'entrega', label: 'Entrega', icon: FileText },
  { id: 'servicio', label: 'Servicio', icon: Settings },
  { id: 'otro', label: 'Otro', icon: CheckCircle },
]

export default function DoorKioskPage() {
  const params = useParams()
  const router = useRouter()
  const kioskId = params.kioskId as string

  const [kiosk, setKiosk] = useState<KioskInfo | null>(null)
  const [guard, setGuard] = useState<GuardInfo | null>(null)
  const [step, setStep] = useState<KioskStep>('guard_pin')
  const [pin, setPin] = useState('')
  const [visitor, setVisitor] = useState<VisitorInfo | null>(null)
  const [scannedData, setScannedData] = useState<ScannedIdData | null>(null)
  const [activeLogId, setActiveLogId] = useState<number | null>(null)
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([])
  const [validatedSales, setValidatedSales] = useState<Set<string>>(new Set())
  const [selectedPurpose, setSelectedPurpose] = useState<string>('')
  const [message, setMessage] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [loading, setLoading] = useState(false)
  const [kioskNotFound, setKioskNotFound] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pinInputRef = useRef<HTMLInputElement>(null)

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch kiosk info and check for pre-authenticated guard
  useEffect(() => {
    fetchKiosk()

    // Check if guard was already authenticated from selector page
    const savedGuard = sessionStorage.getItem('door-guard')
    if (savedGuard) {
      try {
        const guardInfo = JSON.parse(savedGuard)
        setGuard(guardInfo)
        setStep('idle')
        // Clear the session storage after use
        sessionStorage.removeItem('door-guard')
      } catch (e) {
        console.error('Error parsing saved guard info:', e)
      }
    }
  }, [kioskId])

  // Focus PIN input
  useEffect(() => {
    if (step === 'guard_pin' && pinInputRef.current) {
      pinInputRef.current.focus()
    }
  }, [step])

  // Start/stop camera
  useEffect(() => {
    if (step === 'scan_id') {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [step])

  // Auto-reset after success
  useEffect(() => {
    if (step === 'entry_success' || step === 'exit_success') {
      const timer = setTimeout(() => {
        resetToIdle()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [step])

  const fetchKiosk = async () => {
    try {
      const response = await fetch(`/api/market/door-security/kiosks/${kioskId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setKiosk(result.data)
        } else {
          setKioskNotFound(true)
        }
      } else {
        setKioskNotFound(true)
      }
    } catch (error) {
      console.error('Error fetching kiosk:', error)
      setKioskNotFound(true)
    }
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment' // Use back camera for document scanning
        }
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setCameraActive(true)
      }
    } catch (err) {
      console.error('Error accessing camera:', err)
      setMessage('No se pudo acceder a la cámara')
      setStep('error')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    const imageData = canvas.toDataURL('image/jpeg', 0.8)
    setCapturedImage(imageData)
    processIdDocument(imageData)
  }

  const processIdDocument = async (imageBase64: string) => {
    setStep('processing_id')
    setLoading(true)

    try {
      const response = await fetch('/api/ai/scan-id-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: imageBase64.split(',')[1],
          mimeType: 'image/jpeg'
        })
      })

      const result = await response.json()

      if (result.success && result.data.fullName) {
        setScannedData(result.data)
        // Check if visitor exists
        await checkOrRegisterVisitor(result.data, imageBase64)
      } else {
        setMessage('No se pudo leer el documento. Intente con una foto más clara.')
        setStep('error')
      }
    } catch (error) {
      console.error('Error processing ID:', error)
      setMessage('Error al procesar el documento')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  const checkOrRegisterVisitor = async (data: ScannedIdData, photoBase64: string) => {
    try {
      const response = await fetch('/api/market/door-security/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: data.fullName,
          idType: data.documentType,
          idNumber: data.documentNumber,
          dateOfBirth: data.dateOfBirth,
          address: data.address,
          gender: data.gender,
          idPhotoBase64: photoBase64.split(',')[1]
        })
      })

      const result = await response.json()

      if (result.success) {
        setVisitor(result.data.visitor)

        // Check if visitor already has active entry
        if (result.data.visitor.isCurrentlyInside) {
          setActiveLogId(result.data.visitor.activeLogId)
          // Go directly to check sales for exit
          await checkPendingSales(result.data.visitor.activeLogId)
        } else {
          setStep('visitor_info')
        }
      } else {
        setMessage(result.error || 'Error al registrar visitante')
        setStep('error')
      }
    } catch (error) {
      console.error('Error checking visitor:', error)
      setMessage('Error de conexión')
      setStep('error')
    }
  }

  const checkPendingSales = async (logId: number) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/market/door-security/logs/${logId}/pending-sales`)
      const result = await response.json()

      if (result.success) {
        const allPending = [
          ...result.data.pendingSales.posReceipts,
          ...result.data.pendingSales.wholesaleInvoices
        ]

        if (allPending.length > 0) {
          setPendingSales(allPending)
          setStep('validate_sales')
        } else {
          // No pending sales, proceed with exit
          await registerExit(logId)
        }
      } else {
        // If error checking sales, still allow exit
        await registerExit(logId)
      }
    } catch (error) {
      console.error('Error checking sales:', error)
      // On error, still allow exit
      await registerExit(logId)
    } finally {
      setLoading(false)
    }
  }

  const validateSale = async (sale: PendingSale) => {
    if (!activeLogId) return

    try {
      const response = await fetch('/api/market/door-security/validate-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorLogId: activeLogId,
          documentType: sale.type,
          documentId: sale.id,
          documentNumber: sale.documentNumber,
          totalAmount: sale.total,
          currency: sale.currency,
          guardEmployeeId: guard?.id
        })
      })

      const result = await response.json()

      if (result.success) {
        const saleKey = `${sale.type}-${sale.id}`
        setValidatedSales(prev => new Set([...prev, saleKey]))

        // If all validated, proceed with exit
        if (result.data.allValidated) {
          await registerExit(activeLogId)
        }
      }
    } catch (error) {
      console.error('Error validating sale:', error)
    }
  }

  const registerEntry = async (purpose: string) => {
    if (!visitor) return

    setLoading(true)
    try {
      const response = await fetch('/api/market/door-security/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'entry',
          visitorId: visitor.id,
          kioskId: parseInt(kioskId),
          visitPurpose: purpose
        })
      })

      const result = await response.json()

      if (result.success) {
        setMessage(`Entrada registrada - ${visitor.fullName}`)
        setStep('entry_success')
      } else {
        setMessage(result.error || 'Error al registrar entrada')
        setStep('error')
      }
    } catch (error) {
      console.error('Error registering entry:', error)
      setMessage('Error de conexión')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  const registerExit = async (logId: number) => {
    setLoading(true)
    try {
      const response = await fetch('/api/market/door-security/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'exit',
          logId: logId
        })
      })

      const result = await response.json()

      if (result.success) {
        setMessage(`Salida registrada - ${visitor?.fullName || 'Visitante'}`)
        setStep('exit_success')
      } else {
        setMessage(result.error || 'Error al registrar salida')
        setStep('error')
      }
    } catch (error) {
      console.error('Error registering exit:', error)
      setMessage('Error de conexión')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  const verifyGuardPin = async (pinCode: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/market/door-security/kiosks/${kioskId}/verify-guard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinCode })
      })

      const result = await response.json()

      if (result.success) {
        setGuard(result.data.guard)
        setStep('idle')
      } else {
        setMessage(result.error || 'PIN inválido')
        setPin('')
      }
    } catch (error) {
      console.error('Error verifying PIN:', error)
      setMessage('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const handlePinChange = (digit: string) => {
    if (pin.length < 6) {
      const newPin = pin + digit
      setPin(newPin)

      if (newPin.length >= 4) {
        verifyGuardPin(newPin)
      }
    }
  }

  const handlePinDelete = () => {
    setPin(pin.slice(0, -1))
    setMessage('')
  }

  const resetToIdle = () => {
    setStep('idle')
    setVisitor(null)
    setScannedData(null)
    setCapturedImage(null)
    setActiveLogId(null)
    setPendingSales([])
    setValidatedSales(new Set())
    setSelectedPurpose('')
    setMessage('')
  }

  const changeKiosk = () => {
    localStorage.removeItem('door-kiosk-id')
    router.push('/door-kiosk')
  }

  const logoutGuard = () => {
    setGuard(null)
    setPin('')
    setStep('guard_pin')
    resetToIdle()
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  // Kiosk not found
  if (kioskNotFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-900 via-emerald-900 to-teal-900 flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center"
        >
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Kiosco no encontrado
          </h2>
          <p className="text-gray-500 mb-6">
            El kiosco con ID {kioskId} no existe o no está activo.
          </p>
          <button
            onClick={changeKiosk}
            className="flex items-center justify-center gap-2 w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Seleccionar otro kiosco
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-900 via-emerald-900 to-teal-900 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-white mb-1">
          {kiosk?.name || 'Control de Puerta'}
        </h1>
        {kiosk?.location && (
          <p className="text-emerald-200">{kiosk.location}</p>
        )}
        {guard && (
          <p className="text-emerald-300 text-sm mt-2">
            Guardia: {guard.name}
          </p>
        )}
      </div>

      {/* Time Display */}
      <div className="text-center mb-6">
        <p className="text-5xl font-bold text-white tracking-wider">
          {formatTime(currentTime)}
        </p>
        <p className="text-emerald-200 mt-1 capitalize">
          {formatDate(currentTime)}
        </p>
      </div>

      {/* Main Card */}
      <motion.div
        layout
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        <AnimatePresence mode="wait">
          {/* Guard PIN Entry */}
          {step === 'guard_pin' && (
            <motion.div
              key="guard_pin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8"
            >
              <div className="text-center mb-6">
                <Shield className="w-12 h-12 text-teal-600 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-gray-900">
                  Acceso de Guardia
                </h2>
                <p className="text-gray-500 text-sm">
                  Ingrese su PIN para comenzar
                </p>
              </div>

              <div className="flex justify-center gap-3 mb-6">
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <div
                    key={i}
                    className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-colors ${
                      i < pin.length
                        ? 'border-teal-500 bg-teal-50 text-teal-600'
                        : 'border-gray-200'
                    }`}
                  >
                    {i < pin.length ? '•' : ''}
                  </div>
                ))}
              </div>

              {message && (
                <p className="text-center text-red-500 text-sm mb-4">{message}</p>
              )}

              <div className="grid grid-cols-3 gap-3 mb-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((digit, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (digit === null) return
                      if (digit === 'del') handlePinDelete()
                      else handlePinChange(digit.toString())
                    }}
                    disabled={loading || digit === null}
                    className={`h-14 rounded-xl text-xl font-bold transition-colors ${
                      digit === null
                        ? 'invisible'
                        : digit === 'del'
                          ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          : 'bg-gray-100 text-gray-900 hover:bg-teal-100'
                    }`}
                  >
                    {digit === 'del' ? '⌫' : digit}
                  </button>
                ))}
              </div>

              {loading && (
                <div className="flex items-center justify-center gap-2 text-teal-600">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Verificando...</span>
                </div>
              )}
            </motion.div>
          )}

          {/* Idle State */}
          {step === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 text-center"
            >
              <div className="w-24 h-24 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="w-12 h-12 text-teal-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Control de Acceso
              </h2>
              <p className="text-gray-500 mb-8">
                Seleccione una acción
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => setStep('scan_id')}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-bold text-lg transition-colors"
                >
                  <LogIn className="w-6 h-6" />
                  Registrar Entrada
                </button>
                <button
                  onClick={() => setStep('scan_id')}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold text-lg transition-colors"
                >
                  <LogOut className="w-6 h-6" />
                  Registrar Salida
                </button>
              </div>
            </motion.div>
          )}

          {/* Scan ID State */}
          {step === 'scan_id' && (
            <motion.div
              key="scan_id"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6"
            >
              <div className="text-center mb-4">
                <CreditCard className="w-10 h-10 text-teal-600 mx-auto mb-2" />
                <h2 className="text-xl font-bold text-gray-900">
                  Escanear Identificación
                </h2>
                <p className="text-gray-500 text-sm">
                  Tome una foto del documento de identidad
                </p>
              </div>

              <div className="relative rounded-2xl overflow-hidden mb-4 bg-black aspect-[4/3]">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />

                <div className="absolute inset-4 border-2 border-dashed border-white/50 rounded-xl pointer-events-none" />

                <button
                  onClick={capturePhoto}
                  disabled={!cameraActive}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                >
                  <Camera className="w-8 h-8 text-teal-600" />
                </button>
              </div>

              <button
                onClick={resetToIdle}
                className="w-full py-3 text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
            </motion.div>
          )}

          {/* Processing ID */}
          {step === 'processing_id' && (
            <motion.div
              key="processing_id"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 text-center"
            >
              <RefreshCw className="w-16 h-16 text-teal-600 mx-auto mb-6 animate-spin" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Analizando Documento
              </h2>
              <p className="text-gray-500">
                Por favor espere...
              </p>
            </motion.div>
          )}

          {/* Visitor Info - Entry Flow */}
          {step === 'visitor_info' && visitor && (
            <motion.div
              key="visitor_info"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6"
            >
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-10 h-10 text-teal-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {visitor.fullName}
                </h2>
                <p className="text-gray-500">
                  {visitor.idType}: {visitor.idNumber}
                </p>
                {visitor.totalVisits > 1 && (
                  <span className="inline-block mt-2 px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm">
                    Visita #{visitor.totalVisits}
                  </span>
                )}
              </div>

              <div className="mb-6">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  Motivo de la visita:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {VISIT_PURPOSES.map(purpose => (
                    <button
                      key={purpose.id}
                      onClick={() => setSelectedPurpose(purpose.id)}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-colors ${
                        selectedPurpose === purpose.id
                          ? 'border-teal-500 bg-teal-50 text-teal-700'
                          : 'border-gray-200 hover:border-teal-300'
                      }`}
                    >
                      <purpose.icon className="w-5 h-5" />
                      <span className="font-medium">{purpose.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => registerEntry(selectedPurpose)}
                disabled={!selectedPurpose || loading}
                className="w-full flex items-center justify-center gap-3 py-4 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-bold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <RefreshCw className="w-6 h-6 animate-spin" />
                ) : (
                  <LogIn className="w-6 h-6" />
                )}
                Confirmar Entrada
              </button>

              <button
                onClick={resetToIdle}
                className="w-full py-3 mt-3 text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
            </motion.div>
          )}

          {/* Validate Sales - Exit Flow */}
          {step === 'validate_sales' && (
            <motion.div
              key="validate_sales"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6"
            >
              <div className="text-center mb-4">
                <AlertTriangle className="w-10 h-10 text-orange-500 mx-auto mb-2" />
                <h2 className="text-xl font-bold text-gray-900">
                  Validar Compras
                </h2>
                <p className="text-gray-500 text-sm">
                  El visitante tiene compras pendientes de validación
                </p>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
                {pendingSales.map(sale => {
                  const saleKey = `${sale.type}-${sale.id}`
                  const isValidated = validatedSales.has(saleKey)

                  return (
                    <div
                      key={saleKey}
                      className={`p-4 rounded-xl border-2 ${
                        isValidated
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {sale.type === 'pos_receipt' ? 'Ticket POS' : 'Factura'}
                          </p>
                          <p className="text-sm text-gray-500">
                            #{sale.documentNumber}
                          </p>
                          <p className="text-lg font-bold text-teal-600 mt-1">
                            {sale.currency} {sale.total.toFixed(2)}
                          </p>
                        </div>
                        {isValidated ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <Check className="w-5 h-5" />
                            <span className="text-sm">Validado</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => validateSale(sale)}
                            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
                          >
                            Validar
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={resetToIdle}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => activeLogId && registerExit(activeLogId)}
                  disabled={pendingSales.some(s => !validatedSales.has(`${s.type}-${s.id}`))}
                  className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Permitir Salida
                </button>
              </div>
            </motion.div>
          )}

          {/* Entry Success */}
          {step === 'entry_success' && (
            <motion.div
              key="entry_success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', bounce: 0.5 }}
                className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <CheckCircle className="w-14 h-14 text-green-500" />
              </motion.div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Entrada Registrada
              </h2>
              <p className="text-gray-600">{message}</p>
              <p className="text-sm text-gray-400 mt-4">
                Puede pasar
              </p>
            </motion.div>
          )}

          {/* Exit Success */}
          {step === 'exit_success' && (
            <motion.div
              key="exit_success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', bounce: 0.5 }}
                className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <LogOut className="w-14 h-14 text-orange-500" />
              </motion.div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Salida Registrada
              </h2>
              <p className="text-gray-600">{message}</p>
              <p className="text-sm text-gray-400 mt-4">
                Que tenga buen día
              </p>
            </motion.div>
          )}

          {/* Error State */}
          {step === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', bounce: 0.5 }}
                className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <XCircle className="w-14 h-14 text-red-500" />
              </motion.div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Error
              </h2>
              <p className="text-gray-600 mb-6">{message}</p>
              <button
                onClick={resetToIdle}
                className="px-6 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium"
              >
                Intentar de nuevo
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Footer */}
      <div className="mt-6 flex items-center gap-4">
        <p className="text-emerald-200 text-sm">
          puerta.logirapid.com
        </p>
        {guard && (
          <>
            <button
              onClick={logoutGuard}
              className="text-emerald-300 hover:text-white text-sm"
            >
              Cerrar sesión
            </button>
            <button
              onClick={changeKiosk}
              className="text-emerald-300 hover:text-white p-2"
              title="Cambiar kiosco"
            >
              <Settings className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
