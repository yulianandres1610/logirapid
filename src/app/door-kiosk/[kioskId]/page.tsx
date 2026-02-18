'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  LogIn,
  LogOut,
  User,
  CheckCircle,
  XCircle,
  Camera,
  RefreshCw,
  Settings,
  ArrowLeft,
  CreditCard,
  FileText,
  Check,
  AlertTriangle,
  Package,
  Lock,
  UserCircle,
  MapPin,
  Clock,
  Sun,
  Moon
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
  | 'locked'
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

const INACTIVITY_TIMEOUT = 20000 // 20 seconds

type KioskTheme = 'light' | 'dark'

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
  const [kioskTheme, setKioskTheme] = useState<KioskTheme>('dark')

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pinInputRef = useRef<HTMLInputElement>(null)
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Reset inactivity timer
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }

    // Only set timer if guard is logged in and not already locked
    if (guard && step !== 'guard_pin' && step !== 'locked') {
      inactivityTimerRef.current = setTimeout(() => {
        setStep('locked')
      }, INACTIVITY_TIMEOUT)
    }
  }, [guard, step])

  // Handle user activity
  const handleActivity = useCallback(() => {
    resetInactivityTimer()
  }, [resetInactivityTimer])

  // Set up activity listeners
  useEffect(() => {
    if (guard && step !== 'guard_pin' && step !== 'locked') {
      window.addEventListener('click', handleActivity)
      window.addEventListener('touchstart', handleActivity)
      window.addEventListener('keydown', handleActivity)

      resetInactivityTimer()

      return () => {
        window.removeEventListener('click', handleActivity)
        window.removeEventListener('touchstart', handleActivity)
        window.removeEventListener('keydown', handleActivity)
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current)
        }
      }
    }
  }, [guard, step, handleActivity, resetInactivityTimer])

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Load saved theme
  useEffect(() => {
    const saved = localStorage.getItem(`door-kiosk-theme-${kioskId}`)
    if (saved === 'light' || saved === 'dark') {
      setKioskTheme(saved)
    }
  }, [kioskId])

  // Toggle theme function
  const toggleTheme = () => {
    const newTheme: KioskTheme = kioskTheme === 'dark' ? 'light' : 'dark'
    setKioskTheme(newTheme)
    localStorage.setItem(`door-kiosk-theme-${kioskId}`, newTheme)
  }

  // Theme-aware classes
  const theme = {
    bg: kioskTheme === 'dark'
      ? 'bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900'
      : 'bg-gradient-to-br from-stone-100 via-white to-stone-100',
    card: kioskTheme === 'dark'
      ? 'bg-white/10 backdrop-blur-xl border-white/20'
      : 'bg-white shadow-2xl border-stone-200',
    cardSolid: kioskTheme === 'dark'
      ? 'bg-stone-800/90 backdrop-blur-xl border-white/10'
      : 'bg-white shadow-xl border-stone-200',
    text: kioskTheme === 'dark' ? 'text-white' : 'text-stone-900',
    textMuted: kioskTheme === 'dark' ? 'text-stone-400' : 'text-stone-500',
    textSecondary: kioskTheme === 'dark' ? 'text-stone-300' : 'text-stone-600',
    pinBox: kioskTheme === 'dark'
      ? 'border-stone-600 bg-stone-800/50'
      : 'border-stone-300 bg-stone-50',
    pinBoxActive: 'border-orange-500 bg-orange-500/20 text-orange-400',
    numpadBtn: kioskTheme === 'dark'
      ? 'bg-stone-700/50 text-white hover:bg-orange-500/30 hover:text-orange-400'
      : 'bg-stone-100 text-stone-900 hover:bg-orange-100 hover:text-orange-600',
    numpadDel: kioskTheme === 'dark'
      ? 'bg-stone-700/50 text-stone-400 hover:bg-stone-600/50'
      : 'bg-stone-200 text-stone-600 hover:bg-stone-300',
    purposeBtn: kioskTheme === 'dark'
      ? 'border-stone-600 text-stone-300 hover:border-orange-400/50'
      : 'border-stone-300 text-stone-600 hover:border-orange-400',
    purposeBtnActive: 'border-orange-500 bg-orange-500/20 text-orange-400',
    saleCard: kioskTheme === 'dark'
      ? 'border-stone-600 bg-stone-800/50'
      : 'border-stone-200 bg-stone-50',
    saleCardValidated: kioskTheme === 'dark'
      ? 'border-green-500 bg-green-500/10'
      : 'border-green-400 bg-green-50',
    cancelBtn: kioskTheme === 'dark'
      ? 'bg-stone-700 text-white hover:bg-stone-600'
      : 'bg-stone-200 text-stone-800 hover:bg-stone-300',
  }

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
    if ((step === 'guard_pin' || step === 'locked') && pinInputRef.current) {
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
      // Use public endpoint (no auth required for kiosk display)
      const response = await fetch(`/api/market/door-security/kiosks/${kioskId}/public`)
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
          facingMode: 'environment'
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

        if (result.data.visitor.isCurrentlyInside) {
          setActiveLogId(result.data.visitor.activeLogId)
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
          await registerExit(logId)
        }
      } else {
        await registerExit(logId)
      }
    } catch (error) {
      console.error('Error checking sales:', error)
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

  const unlockKiosk = async (pinCode: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/market/door-security/kiosks/${kioskId}/verify-guard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinCode })
      })

      const result = await response.json()

      if (result.success) {
        // Verify it's the same guard
        if (result.data.guard.id === guard?.id) {
          setStep('idle')
          setPin('')
          setMessage('')
        } else {
          // Different guard - update guard info
          setGuard(result.data.guard)
          setStep('idle')
          setPin('')
          setMessage('')
        }
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
    if (pin.length < 4) {
      const newPin = pin + digit
      setPin(newPin)

      if (newPin.length === 4) {
        if (step === 'locked') {
          unlockKiosk(newPin)
        } else {
          verifyGuardPin(newPin)
        }
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

  // Get guard initials for avatar
  const getGuardInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  // Kiosk not found
  if (kioskNotFound) {
    return (
      <div className={`min-h-screen ${theme.bg} flex flex-col items-center justify-center p-4`}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`${theme.card} rounded-3xl shadow-2xl w-full max-w-md p-8 text-center border`}
        >
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className={`text-xl font-bold ${theme.text} mb-2`}>
            Kiosco no encontrado
          </h2>
          <p className={`${theme.textSecondary} mb-6`}>
            El kiosco con ID {kioskId} no existe o no está activo.
          </p>
          <button
            onClick={changeKiosk}
            className="flex items-center justify-center gap-2 w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            Seleccionar otro kiosco
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${theme.bg} flex flex-col items-center justify-center p-4 relative overflow-hidden`}>
      {/* Background Pattern */}
      <div className={`absolute inset-0 ${kioskTheme === 'dark' ? 'opacity-5' : 'opacity-[0.02]'}`}>
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, ${kioskTheme === 'dark' ? 'white' : 'black'} 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      {/* Theme Toggle - Top Right */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={toggleTheme}
        className={`absolute top-4 right-4 p-3 rounded-xl ${kioskTheme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-stone-200 hover:bg-stone-300 text-stone-700'} transition-all z-10`}
        title={kioskTheme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      >
        {kioskTheme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </motion.button>

      {/* Company Logo - Prominent */}
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', bounce: 0.3 }}
        className="mb-6 flex flex-col items-center"
      >
        {kiosk?.companyLogo ? (
          <img
            src={kiosk.companyLogo}
            alt={kiosk.companyName || 'Logo'}
            className="h-24 w-auto object-contain drop-shadow-lg"
          />
        ) : kiosk?.companyName ? (
          <div className={`text-3xl font-bold ${theme.text} tracking-tight`}>
            {kiosk.companyName}
          </div>
        ) : null}
      </motion.div>

      {/* Time Display - Prominent */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <p className={`text-6xl font-extralight ${theme.text} tracking-wider font-mono`}>
          {formatTime(currentTime)}
        </p>
        <p className={`${theme.textMuted} mt-2 capitalize text-lg`}>
          {formatDate(currentTime)}
        </p>
      </motion.div>

      {/* Guard Info Bar - When logged in */}
      {guard && step !== 'guard_pin' && step !== 'locked' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg mb-4"
        >
          <div className={`${theme.cardSolid} rounded-2xl px-5 py-3 flex items-center justify-between border`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                {getGuardInitials(guard.name)}
              </div>
              <div>
                <p className={`${theme.text} font-medium`}>{guard.name}</p>
                <p className={`${theme.textMuted} text-xs`}>{guard.code}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={logoutGuard}
                className={`${theme.textMuted} hover:text-orange-400 text-sm transition-colors`}
              >
                Salir
              </button>
              <button
                onClick={changeKiosk}
                className={`${theme.textMuted} hover:text-orange-500 p-1.5 transition-colors`}
                title="Cambiar kiosco"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Kiosk Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`flex items-center gap-2 mb-4 ${theme.textMuted}`}
      >
        <MapPin className="w-4 h-4" />
        <span className="text-sm">{kiosk?.name} • {kiosk?.location}</span>
      </motion.div>

      {/* Main Card */}
      <motion.div
        layout
        className={`${theme.card} rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border relative`}
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
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30">
                  <Shield className="w-10 h-10 text-white" />
                </div>
                <h2 className={`text-2xl font-bold ${theme.text}`}>
                  Acceso de Guardia
                </h2>
                <p className={`${theme.textMuted} text-sm mt-1`}>
                  Ingrese su PIN de 4 dígitos
                </p>
              </div>

              <div className="flex justify-center gap-4 mb-8">
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                      i < pin.length
                        ? theme.pinBoxActive
                        : theme.pinBox
                    }`}
                  >
                    {i < pin.length ? '•' : ''}
                  </div>
                ))}
              </div>

              {message && (
                <p className="text-center text-red-400 text-sm mb-4">{message}</p>
              )}

              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((digit, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (digit === null) return
                      if (digit === 'del') handlePinDelete()
                      else handlePinChange(digit.toString())
                    }}
                    disabled={loading || digit === null}
                    className={`h-16 rounded-xl text-xl font-semibold transition-all ${
                      digit === null
                        ? 'invisible'
                        : digit === 'del'
                          ? theme.numpadDel
                          : `${theme.numpadBtn} active:scale-95`
                    }`}
                  >
                    {digit === 'del' ? '⌫' : digit}
                  </button>
                ))}
              </div>

              {loading && (
                <div className="flex items-center justify-center gap-2 text-orange-400 mt-6">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Verificando...</span>
                </div>
              )}
            </motion.div>
          )}

          {/* Locked State */}
          {step === 'locked' && (
            <motion.div
              key="locked"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8"
            >
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', bounce: 0.5 }}
                  className={`w-20 h-20 ${kioskTheme === 'dark' ? 'bg-stone-700' : 'bg-stone-200'} rounded-2xl flex items-center justify-center mx-auto mb-4`}
                >
                  <Lock className={`w-10 h-10 ${theme.textMuted}`} />
                </motion.div>
                <h2 className={`text-2xl font-bold ${theme.text}`}>
                  Kiosco Bloqueado
                </h2>
                <p className={`${theme.textMuted} text-sm mt-1`}>
                  Ingrese su PIN para desbloquear
                </p>
                {guard && (
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-bold">
                      {getGuardInitials(guard.name)}
                    </div>
                    <span className={`${theme.textSecondary} text-sm`}>{guard.name}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-center gap-4 mb-8">
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                      i < pin.length
                        ? theme.pinBoxActive
                        : theme.pinBox
                    }`}
                  >
                    {i < pin.length ? '•' : ''}
                  </div>
                ))}
              </div>

              {message && (
                <p className="text-center text-red-400 text-sm mb-4">{message}</p>
              )}

              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((digit, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (digit === null) return
                      if (digit === 'del') handlePinDelete()
                      else handlePinChange(digit.toString())
                    }}
                    disabled={loading || digit === null}
                    className={`h-16 rounded-xl text-xl font-semibold transition-all ${
                      digit === null
                        ? 'invisible'
                        : digit === 'del'
                          ? theme.numpadDel
                          : `${theme.numpadBtn} active:scale-95`
                    }`}
                  >
                    {digit === 'del' ? '⌫' : digit}
                  </button>
                ))}
              </div>

              {loading && (
                <div className="flex items-center justify-center gap-2 text-orange-400 mt-6">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Verificando...</span>
                </div>
              )}
            </motion.div>
          )}

          {/* Idle State - Modern */}
          {step === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8"
            >
              <div className="text-center mb-8">
                <h2 className={`text-2xl font-bold ${theme.text} mb-2`}>
                  Control de Acceso
                </h2>
                <p className={theme.textMuted}>
                  Seleccione una acción para continuar
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep('scan_id')}
                  className="flex flex-col items-center justify-center gap-3 py-8 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-green-500/30"
                >
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                    <LogIn className="w-8 h-8" />
                  </div>
                  <span className="text-lg">Entrada</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep('scan_id')}
                  className="flex flex-col items-center justify-center gap-3 py-8 bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-orange-500/30"
                >
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                    <LogOut className="w-8 h-8" />
                  </div>
                  <span className="text-lg">Salida</span>
                </motion.button>
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
                <CreditCard className="w-10 h-10 text-orange-400 mx-auto mb-2" />
                <h2 className={`text-xl font-bold ${theme.text}`}>
                  Escanear Identificación
                </h2>
                <p className={`${theme.textMuted} text-sm`}>
                  Tome una foto del documento
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

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={capturePhoto}
                  disabled={!cameraActive}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center shadow-lg"
                >
                  <Camera className="w-8 h-8 text-white" />
                </motion.button>
              </div>

              <button
                onClick={resetToIdle}
                className={`w-full py-3 ${theme.textMuted} hover:text-orange-400 transition-colors`}
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
              <RefreshCw className="w-16 h-16 text-orange-400 mx-auto mb-6 animate-spin" />
              <h2 className={`text-xl font-bold ${theme.text} mb-2`}>
                Analizando Documento
              </h2>
              <p className={theme.textMuted}>
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
                <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <User className="w-10 h-10 text-white" />
                </div>
                <h2 className={`text-2xl font-bold ${theme.text}`}>
                  {visitor.fullName}
                </h2>
                <p className={theme.textMuted}>
                  {visitor.idType}: {visitor.idNumber}
                </p>
                {visitor.totalVisits > 1 && (
                  <span className="inline-block mt-2 px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-sm">
                    Visita #{visitor.totalVisits}
                  </span>
                )}
              </div>

              <div className="mb-6">
                <p className={`text-sm font-medium ${theme.textSecondary} mb-3`}>
                  Motivo de la visita:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {VISIT_PURPOSES.map(purpose => (
                    <button
                      key={purpose.id}
                      onClick={() => setSelectedPurpose(purpose.id)}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        selectedPurpose === purpose.id
                          ? theme.purposeBtnActive
                          : theme.purposeBtn
                      }`}
                    >
                      <purpose.icon className="w-5 h-5" />
                      <span className="font-medium">{purpose.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => registerEntry(selectedPurpose)}
                disabled={!selectedPurpose || loading}
                className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl font-bold text-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <RefreshCw className="w-6 h-6 animate-spin" />
                ) : (
                  <LogIn className="w-6 h-6" />
                )}
                Confirmar Entrada
              </motion.button>

              <button
                onClick={resetToIdle}
                className={`w-full py-3 mt-3 ${theme.textMuted} hover:text-orange-400 transition-colors`}
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
                <AlertTriangle className="w-10 h-10 text-yellow-400 mx-auto mb-2" />
                <h2 className={`text-xl font-bold ${theme.text}`}>
                  Validar Compras
                </h2>
                <p className={`${theme.textMuted} text-sm`}>
                  Compras pendientes de validación
                </p>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
                {pendingSales.map(sale => {
                  const saleKey = `${sale.type}-${sale.id}`
                  const isValidated = validatedSales.has(saleKey)

                  return (
                    <div
                      key={saleKey}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        isValidated
                          ? theme.saleCardValidated
                          : theme.saleCard
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className={`font-medium ${theme.text}`}>
                            {sale.type === 'pos_receipt' ? 'Ticket POS' : 'Factura'}
                          </p>
                          <p className={`text-sm ${theme.textMuted}`}>
                            #{sale.documentNumber}
                          </p>
                          <p className="text-lg font-bold text-orange-400 mt-1">
                            {sale.currency} {sale.total.toFixed(2)}
                          </p>
                        </div>
                        {isValidated ? (
                          <div className="flex items-center gap-1 text-green-400">
                            <Check className="w-5 h-5" />
                            <span className="text-sm">Validado</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => validateSale(sale)}
                            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium transition-colors"
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
                  className={`flex-1 py-3 ${theme.cancelBtn} rounded-xl font-medium transition-colors`}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => activeLogId && registerExit(activeLogId)}
                  disabled={pendingSales.some(s => !validatedSales.has(`${s.type}-${s.id}`))}
                  className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30"
              >
                <CheckCircle className="w-14 h-14 text-white" />
              </motion.div>
              <h2 className={`text-2xl font-bold ${theme.text} mb-2`}>
                Entrada Registrada
              </h2>
              <p className={theme.textSecondary}>{message}</p>
              <p className="text-sm text-green-400 mt-4 font-medium">
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
                className="w-24 h-24 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/30"
              >
                <LogOut className="w-14 h-14 text-white" />
              </motion.div>
              <h2 className={`text-2xl font-bold ${theme.text} mb-2`}>
                Salida Registrada
              </h2>
              <p className={theme.textSecondary}>{message}</p>
              <p className="text-sm text-orange-400 mt-4 font-medium">
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
                className={`w-24 h-24 ${kioskTheme === 'dark' ? 'bg-red-500/20' : 'bg-red-100'} rounded-full flex items-center justify-center mx-auto mb-6`}
              >
                <XCircle className="w-14 h-14 text-red-400" />
              </motion.div>
              <h2 className={`text-2xl font-bold ${theme.text} mb-2`}>
                Error
              </h2>
              <p className={`${theme.textSecondary} mb-6`}>{message}</p>
              <button
                onClick={resetToIdle}
                className={`px-6 py-2 ${theme.cancelBtn} rounded-xl font-medium transition-colors`}
              >
                Intentar de nuevo
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-6 text-center"
      >
        <p className={`${theme.textMuted} text-sm`}>
          {kiosk?.companyName}
        </p>
      </motion.div>
    </div>
  )
}
