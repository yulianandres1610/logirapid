'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Fingerprint,
  Clock,
  LogIn,
  LogOut,
  User,
  CheckCircle,
  XCircle,
  Keyboard,
  Camera,
  RefreshCw,
  Scan,
  Shield,
  Search,
  Users,
  ChevronLeft,
  AlertCircle,
  Sparkles,
  Zap
} from 'lucide-react'
import { useFaceRecognition } from '@/hooks/useFaceRecognition'

interface KioskInfo {
  id: number
  name: string
  location: string | null
  deviceId: string
  companyId: number
}

interface EmployeeResult {
  id: number
  employeeCode: string
  fullName: string
  hasFaceRegistered: boolean
  canCheckIn: boolean
  canCheckOut: boolean
  todayAttendance: {
    checkIn: string | null
    checkOut: string | null
    status: string
  } | null
}

interface EmployeeFace {
  employeeId: number
  employeeCode: string
  fullName: string
  faceEncoding: string
}

interface ManagerData {
  id: number
  fullName: string
  employeeCode: string
  role: string
}

interface EmployeeListItem {
  id: number
  employeeCode: string
  fullName: string
  departmentName: string | null
  hasFaceRegistered: boolean
  todayAttendance: {
    checkIn: string | null
    checkOut: string | null
    status: string
  } | null
  canCheckIn: boolean
  canCheckOut: boolean
}

interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

type KioskStep = 'idle' | 'identify' | 'face-scan' | 'confirm' | 'success' | 'error' | 'manager-pin' | 'manager-select'
type IdentifyMethod = 'pin' | 'face' | 'manager_override'

// Toast component
const Toast = ({ toast, onClose }: { toast: ToastMessage; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500'
  }

  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
    info: AlertCircle
  }

  const Icon = icons[toast.type]

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      className={`${colors[toast.type]} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[300px]`}
    >
      <Icon className="w-6 h-6 flex-shrink-0" />
      <p className="font-medium">{toast.message}</p>
    </motion.div>
  )
}

// Animated background particles
const FloatingParticles = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(20)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-2 h-2 bg-white/10 rounded-full"
        initial={{
          x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
          y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
        }}
        animate={{
          y: [null, -100],
          opacity: [0, 0.5, 0],
        }}
        transition={{
          duration: 8 + Math.random() * 4,
          repeat: Infinity,
          delay: Math.random() * 5,
          ease: 'linear',
        }}
      />
    ))}
  </div>
)

// Pulsing ring animation for scanning
const PulsingRings = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    {[1, 2, 3].map((i) => (
      <motion.div
        key={i}
        className="absolute rounded-full border-2 border-orange-400/30"
        initial={{ width: 100, height: 100, opacity: 0 }}
        animate={{
          width: [100, 300],
          height: [100, 300],
          opacity: [0.8, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          delay: i * 0.6,
          ease: 'easeOut',
        }}
      />
    ))}
  </div>
)

export default function KioskPage() {
  const params = useParams()
  const kioskId = params.kioskId as string

  const [kiosk, setKiosk] = useState<KioskInfo | null>(null)
  const [step, setStep] = useState<KioskStep>('idle')
  const [identifyMethod, setIdentifyMethod] = useState<IdentifyMethod>('pin')
  const [pin, setPin] = useState('')
  const [employee, setEmployee] = useState<EmployeeResult | null>(null)
  const [message, setMessage] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [loading, setLoading] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  // Face recognition states
  const [employeeFaces, setEmployeeFaces] = useState<EmployeeFace[]>([])
  const [cameraActive, setCameraActive] = useState(false)
  const [faceDetected, setFaceDetected] = useState(false)
  const [scanStatus, setScanStatus] = useState<string>('idle')

  // Manager override states
  const [managerPin, setManagerPin] = useState('')
  const [managerData, setManagerData] = useState<ManagerData | null>(null)
  const [employeeList, setEmployeeList] = useState<EmployeeListItem[]>([])
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [loadingEmployees, setLoadingEmployees] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pinInputRef = useRef<HTMLInputElement>(null)

  const {
    isModelLoaded,
    isLoading: modelsLoading,
    error: modelError,
    detectFace,
    findMatch
  } = useFaceRecognition()

  // Toast helper
  const showToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, type, message }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch kiosk info
  useEffect(() => {
    fetchKiosk()
    fetchEmployeeFaces()
  }, [kioskId])

  // Focus PIN input when in identify step
  useEffect(() => {
    if (step === 'identify' && identifyMethod === 'pin' && pinInputRef.current) {
      pinInputRef.current.focus()
    }
  }, [step, identifyMethod])

  // Auto-reset after success/error
  useEffect(() => {
    if (step === 'success' || step === 'error') {
      const timer = setTimeout(() => {
        resetKiosk()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [step])

  // Start/stop camera when entering/leaving face-scan step
  useEffect(() => {
    if (step === 'face-scan') {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [step])

  // Face detection loop with optimized performance and security
  useEffect(() => {
    if (!cameraActive || !isModelLoaded || step !== 'face-scan') return

    let timeoutId: ReturnType<typeof setTimeout>
    let isProcessing = false
    let consecutiveMatches = 0
    const REQUIRED_CONSECUTIVE_MATCHES = 2
    let lastMatchId: number | null = null
    let scanStartTime = Date.now()
    const SCAN_TIMEOUT = 30000

    const detectFaceLoop = async () => {
      if (Date.now() - scanStartTime > SCAN_TIMEOUT) {
        showToast('error', 'Tiempo de escaneo agotado. Intente de nuevo.')
        setStep('error')
        setMessage('Tiempo de escaneo agotado')
        return
      }

      if (!videoRef.current || isProcessing || scanStatus === 'processing') {
        timeoutId = setTimeout(detectFaceLoop, 300)
        return
      }

      isProcessing = true
      setScanStatus('scanning')

      try {
        const descriptor = await detectFace(videoRef.current, { skipCooldown: true })

        if (descriptor) {
          setFaceDetected(true)

          const match = findMatch(descriptor, employeeFaces, 0.5)

          if (match) {
            if (lastMatchId === match.employeeId) {
              consecutiveMatches++
            } else {
              consecutiveMatches = 1
              lastMatchId = match.employeeId
            }

            if (consecutiveMatches >= REQUIRED_CONSECUTIVE_MATCHES) {
              setScanStatus('processing')
              console.log(`Face match confirmed: ${match.fullName} (confidence: ${match.confidence}%)`)
              await verifyEmployeeByFace(match.employeeId)
              return
            }
          } else {
            consecutiveMatches = 0
            lastMatchId = null
            setFaceDetected(false)
          }
        } else {
          setFaceDetected(false)
          consecutiveMatches = 0
          lastMatchId = null
        }
      } catch (err) {
        console.error('Face detection error:', err)
      }

      isProcessing = false
      if (step === 'face-scan' && scanStatus !== 'processing') {
        timeoutId = setTimeout(detectFaceLoop, 300)
      }
    }

    const startTimeoutId = setTimeout(() => {
      detectFaceLoop()
    }, 500)

    return () => {
      clearTimeout(timeoutId)
      clearTimeout(startTimeoutId)
    }
  }, [cameraActive, isModelLoaded, step, employeeFaces, detectFace, findMatch, scanStatus, showToast])

  const fetchKiosk = async () => {
    try {
      const response = await fetch(`/api/market/hr/kiosks/${kioskId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setKiosk(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching kiosk:', error)
      showToast('error', 'Error al cargar información del kiosco')
    }
  }

  const fetchEmployeeFaces = async () => {
    try {
      const response = await fetch(`/api/market/hr/kiosks/${kioskId}/faces`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setEmployeeFaces(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching employee faces:', error)
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
      }
    } catch (err) {
      console.error('Error accessing camera:', err)
      showToast('error', 'No se pudo acceder a la cámara')
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
    setFaceDetected(false)
    setScanStatus('idle')
  }

  const resetKiosk = () => {
    setStep('idle')
    setPin('')
    setManagerPin('')
    setEmployee(null)
    setManagerData(null)
    setEmployeeList([])
    setEmployeeSearch('')
    setMessage('')
    setFaceDetected(false)
    setScanStatus('idle')
  }

  const handlePinChange = (digit: string) => {
    if (pin.length < 6) {
      const newPin = pin + digit
      setPin(newPin)

      if (newPin.length >= 4) {
        verifyEmployee(newPin)
      }
    }
  }

  const handlePinDelete = () => {
    setPin(pin.slice(0, -1))
  }

  const handleManagerPinChange = (digit: string) => {
    if (managerPin.length < 6) {
      const newPin = managerPin + digit
      setManagerPin(newPin)

      if (newPin.length >= 4) {
        verifyManagerAndLoadEmployees(newPin)
      }
    }
  }

  const handleManagerPinDelete = () => {
    setManagerPin(managerPin.slice(0, -1))
  }

  const verifyManagerAndLoadEmployees = async (pinCode: string) => {
    try {
      setLoading(true)
      setLoadingEmployees(true)

      const verifyResponse = await fetch(`/api/market/hr/kiosks/${kioskId}/verify-employee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'pin', pin: pinCode })
      })

      const verifyResult = await verifyResponse.json()

      if (!verifyResult.success) {
        if (verifyResult.error?.includes('Solo managers')) {
          showToast('warning', 'Este PIN no pertenece a un manager')
        } else {
          showToast('error', verifyResult.error || 'PIN de manager inválido')
        }
        setManagerPin('')
        return
      }

      setManagerData({
        id: verifyResult.data.id,
        fullName: verifyResult.data.fullName,
        employeeCode: verifyResult.data.employeeCode,
        role: 'MANAGER'
      })

      const listResponse = await fetch(`/api/market/hr/kiosks/${kioskId}/verify-employee`)
      const listResult = await listResponse.json()

      if (listResult.success) {
        setEmployeeList(listResult.data)
        setStep('manager-select')
        showToast('success', `Bienvenido, ${verifyResult.data.fullName}`)
      } else {
        showToast('error', 'Error al cargar lista de empleados')
      }

    } catch (error) {
      showToast('error', 'Error de conexión')
    } finally {
      setLoading(false)
      setLoadingEmployees(false)
    }
  }

  const selectEmployeeForOverride = async (selectedEmployee: EmployeeListItem) => {
    setEmployee({
      id: selectedEmployee.id,
      employeeCode: selectedEmployee.employeeCode,
      fullName: selectedEmployee.fullName,
      hasFaceRegistered: selectedEmployee.hasFaceRegistered,
      canCheckIn: selectedEmployee.canCheckIn,
      canCheckOut: selectedEmployee.canCheckOut,
      todayAttendance: selectedEmployee.todayAttendance
    })
    setIdentifyMethod('manager_override')
    setStep('confirm')
  }

  const filteredEmployees = employeeList.filter(emp =>
    emp.fullName.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    emp.employeeCode.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    (emp.departmentName && emp.departmentName.toLowerCase().includes(employeeSearch.toLowerCase()))
  )

  const verifyEmployee = async (pinCode: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/market/hr/kiosks/${kioskId}/verify-employee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'pin', pin: pinCode })
      })

      const result = await response.json()

      if (result.success) {
        setEmployee(result.data)
        setStep('confirm')
      } else {
        showToast('error', result.error || 'PIN inválido')
        setMessage(result.error || 'PIN inválido')
        setStep('error')
      }
    } catch (error) {
      showToast('error', 'Error de conexión')
      setMessage('Error de conexión')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  const verifyEmployeeByFace = async (employeeId: number) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/market/hr/kiosks/${kioskId}/verify-employee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'face', employeeId })
      })

      const result = await response.json()

      if (result.success) {
        setEmployee(result.data)
        showToast('success', `Bienvenido, ${result.data.fullName}`)
        setStep('confirm')
      } else {
        showToast('error', result.error || 'No se pudo verificar el empleado')
        setScanStatus('idle')
      }
    } catch (error) {
      showToast('error', 'Error de conexión')
      setScanStatus('idle')
    } finally {
      setLoading(false)
    }
  }

  const handleCheckIn = async () => {
    if (!employee) return

    try {
      setLoading(true)

      const requestBody: any = {
        employeeId: employee.id,
        method: identifyMethod === 'face' ? 'face' : identifyMethod === 'manager_override' ? 'manager_override' : 'kiosk',
        kioskId: parseInt(kioskId)
      }

      if (identifyMethod === 'manager_override' && managerData) {
        requestBody.approvedById = managerData.id
        requestBody.approvedByName = managerData.fullName
      }

      const response = await fetch('/api/market/hr/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()

      if (result.success) {
        let successMessage = result.message
        if (identifyMethod === 'manager_override' && managerData) {
          successMessage += ` (Autorizado por ${managerData.fullName})`
        }
        setMessage(successMessage)
        setStep('success')
      } else {
        showToast('error', result.error || 'Error al registrar entrada')
        setMessage(result.error || 'Error al registrar entrada')
        setStep('error')
      }
    } catch (error) {
      showToast('error', 'Error de conexión')
      setMessage('Error de conexión')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  const handleCheckOut = async () => {
    if (!employee) return

    try {
      setLoading(true)

      const requestBody: any = {
        employeeId: employee.id,
        method: identifyMethod === 'face' ? 'face' : identifyMethod === 'manager_override' ? 'manager_override' : 'kiosk',
        kioskId: parseInt(kioskId)
      }

      if (identifyMethod === 'manager_override' && managerData) {
        requestBody.approvedById = managerData.id
        requestBody.approvedByName = managerData.fullName
      }

      const response = await fetch('/api/market/hr/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()

      if (result.success) {
        let successMessage = result.message
        if (identifyMethod === 'manager_override' && managerData) {
          successMessage += ` (Autorizado por ${managerData.fullName})`
        }
        setMessage(successMessage)
        setStep('success')
      } else {
        showToast('error', result.error || 'Error al registrar salida')
        setMessage(result.error || 'Error al registrar salida')
        setStep('error')
      }
    } catch (error) {
      showToast('error', 'Error de conexión')
      setMessage('Error de conexión')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const hasFaceRecognition = employeeFaces.length > 0 && isModelLoaded

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background */}
      <FloatingParticles />

      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, white 2px, transparent 0)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        <AnimatePresence>
          {toasts.map(toast => (
            <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
          ))}
        </AnimatePresence>
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6 relative z-10"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          >
            <Zap className="w-8 h-8 text-yellow-300" />
          </motion.div>
          <h1 className="text-3xl font-bold text-white">
            {kiosk?.name || 'Kiosco de Asistencia'}
          </h1>
        </div>
        {kiosk?.location && (
          <p className="text-orange-100 flex items-center justify-center gap-1">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            {kiosk.location}
          </p>
        )}
      </motion.div>

      {/* Time Display */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center mb-6 relative z-10"
      >
        <motion.p
          className="text-7xl font-bold text-white tracking-wider drop-shadow-lg"
          key={formatTime(currentTime)}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
        >
          {formatTime(currentTime)}
        </motion.p>
        <p className="text-orange-100 mt-2 capitalize text-lg">
          {formatDate(currentTime)}
        </p>
      </motion.div>

      {/* Main Card */}
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative z-10 border border-white/20"
      >
        <AnimatePresence mode="wait">
          {/* Idle State */}
          {step === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-8 text-center relative"
            >
              <motion.div
                className="w-28 h-28 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg"
                animate={{
                  boxShadow: ['0 0 20px rgba(251,146,60,0.3)', '0 0 40px rgba(251,146,60,0.5)', '0 0 20px rgba(251,146,60,0.3)']
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Camera className="w-14 h-14 text-white" />
              </motion.div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Marcar Asistencia
              </h2>
              <p className="text-gray-500 mb-8">
                {hasFaceRecognition
                  ? 'Acércate para el reconocimiento facial'
                  : 'El reconocimiento facial no está disponible'
                }
              </p>

              {hasFaceRecognition ? (
                <div className="space-y-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setIdentifyMethod('face')
                      setStep('face-scan')
                    }}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl font-bold text-lg transition-all shadow-lg shadow-orange-500/30"
                  >
                    <Camera className="w-6 h-6" />
                    Iniciar Reconocimiento Facial
                  </motion.button>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-amber-700 text-sm text-left">
                      No hay empleados con rostro registrado. Contacte al administrador para habilitar el reconocimiento facial.
                    </p>
                  </div>
                </motion.div>
              )}

              {modelsLoading && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-gray-400 mt-4 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Cargando reconocimiento facial...
                </motion.p>
              )}

              {/* Manager Override Button */}
              <div className="mt-8 pt-4 border-t border-gray-100">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setStep('manager-pin')}
                  className="flex items-center justify-center gap-2 mx-auto text-gray-400 hover:text-orange-600 transition-colors text-sm"
                >
                  <Shield className="w-4 h-4" />
                  Asistencia Manual (Manager)
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Face Scan State */}
          {step === 'face-scan' && (
            <motion.div
              key="face-scan"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6"
            >
              <div className="text-center mb-4">
                <motion.div
                  animate={{ rotate: faceDetected ? 0 : [0, 5, -5, 0] }}
                  transition={{ duration: 0.5, repeat: faceDetected ? 0 : Infinity }}
                >
                  <Camera className="w-10 h-10 text-orange-500 mx-auto mb-2" />
                </motion.div>
                <h2 className="text-xl font-bold text-gray-900">
                  Reconocimiento Facial
                </h2>
                <p className="text-gray-500 text-sm">
                  Mira directamente a la cámara
                </p>
              </div>

              {/* Camera View */}
              <div className="relative rounded-2xl overflow-hidden mb-6 bg-gray-900 aspect-[4/3] shadow-inner">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                  onLoadedData={() => console.log('Video loaded')}
                  onError={(e) => console.error('Video error:', e)}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full"
                />

                {/* Face frame overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <motion.div
                    className={`w-48 h-56 rounded-[50%] border-4 transition-colors duration-300 ${
                      faceDetected ? 'border-green-500' : 'border-white/50'
                    }`}
                    animate={faceDetected ? {
                      borderColor: ['#22c55e', '#4ade80', '#22c55e'],
                      boxShadow: ['0 0 0 0 rgba(34,197,94,0)', '0 0 0 10px rgba(34,197,94,0.2)', '0 0 0 0 rgba(34,197,94,0)']
                    } : {}}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                </div>

                {/* Corner indicators */}
                <div className="absolute top-4 left-4 w-8 h-8 border-l-4 border-t-4 border-white/70 rounded-tl-lg" />
                <div className="absolute top-4 right-4 w-8 h-8 border-r-4 border-t-4 border-white/70 rounded-tr-lg" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-l-4 border-b-4 border-white/70 rounded-bl-lg" />
                <div className="absolute bottom-4 right-4 w-8 h-8 border-r-4 border-b-4 border-white/70 rounded-br-lg" />

                {/* Scanning indicator */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`px-4 py-2 rounded-full flex items-center gap-2 backdrop-blur-sm ${
                      scanStatus === 'processing'
                        ? 'bg-green-500 text-white'
                        : faceDetected
                          ? 'bg-green-500/90 text-white'
                          : 'bg-white/90 text-gray-700'
                    }`}
                  >
                    {scanStatus === 'processing' ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span className="text-sm font-medium">Verificando...</span>
                      </>
                    ) : (
                      <>
                        <motion.div
                          animate={!faceDetected ? { scale: [1, 1.2, 1] } : {}}
                          transition={{ duration: 1, repeat: Infinity }}
                        >
                          <Scan className="w-4 h-4" />
                        </motion.div>
                        <span className="text-sm font-medium">
                          {faceDetected ? 'Rostro detectado' : 'Buscando rostro...'}
                        </span>
                      </>
                    )}
                  </motion.div>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={resetKiosk}
                className="w-full py-3 text-gray-500 hover:text-orange-600 font-medium transition-colors"
              >
                Cancelar
              </motion.button>
            </motion.div>
          )}

          {/* Manager PIN State */}
          {step === 'manager-pin' && (
            <motion.div
              key="manager-pin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-8"
            >
              <div className="text-center mb-6">
                <motion.div
                  className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg"
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <Shield className="w-10 h-10 text-white" />
                </motion.div>
                <h2 className="text-xl font-bold text-gray-900">
                  Asistencia Manual
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  Ingresa tu PIN de manager
                </p>
              </div>

              {/* PIN Display */}
              <div className="flex justify-center gap-3 mb-6">
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                      i < managerPin.length
                        ? 'border-orange-500 bg-orange-50 text-orange-600 shadow-md'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    {i < managerPin.length ? '•' : ''}
                  </motion.div>
                ))}
              </div>

              {/* Number Pad */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((digit, i) => (
                  <motion.button
                    key={i}
                    whileHover={digit !== null ? { scale: 1.05 } : {}}
                    whileTap={digit !== null ? { scale: 0.95 } : {}}
                    onClick={() => {
                      if (digit === null) return
                      if (digit === 'del') handleManagerPinDelete()
                      else handleManagerPinChange(digit.toString())
                    }}
                    disabled={loading || digit === null}
                    className={`h-16 rounded-xl text-2xl font-bold transition-all ${
                      digit === null
                        ? 'invisible'
                        : digit === 'del'
                          ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          : 'bg-gray-100 text-gray-900 hover:bg-orange-100 hover:text-orange-600 active:bg-orange-200'
                    }`}
                  >
                    {digit === 'del' ? '⌫' : digit}
                  </motion.button>
                ))}
              </div>

              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center gap-2 text-orange-600 mb-4"
                >
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Verificando manager...</span>
                </motion.div>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={resetKiosk}
                className="w-full py-3 text-gray-500 hover:text-orange-600 font-medium transition-colors"
              >
                Cancelar
              </motion.button>
            </motion.div>
          )}

          {/* Manager Employee Selection State */}
          {step === 'manager-select' && (
            <motion.div
              key="manager-select"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    setStep('manager-pin')
                    setManagerPin('')
                    setManagerData(null)
                  }}
                  className="p-2 hover:bg-orange-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-500" />
                </motion.button>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Seleccionar Empleado
                  </h2>
                  {managerData && (
                    <p className="text-xs text-orange-600 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Manager: {managerData.fullName}
                    </p>
                  )}
                </div>
              </div>

              {/* Search Input */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar empleado..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Employee List */}
              <div className="max-h-80 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-orange-200">
                {loadingEmployees ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-orange-600" />
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    No se encontraron empleados
                  </div>
                ) : (
                  filteredEmployees.map((emp, index) => (
                    <motion.button
                      key={emp.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      whileHover={{ scale: 1.01, x: 4 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => selectEmployeeForOverride(emp)}
                      className="w-full p-3 flex items-center gap-3 bg-gray-50 hover:bg-orange-50 rounded-xl transition-all text-left border border-transparent hover:border-orange-200"
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center shadow-sm">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {emp.fullName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {emp.employeeCode} {emp.departmentName && `• ${emp.departmentName}`}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {emp.todayAttendance?.checkIn ? (
                          <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                            {new Date(emp.todayAttendance.checkIn).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            Sin entrada
                          </span>
                        )}
                        {emp.todayAttendance?.checkOut && (
                          <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                            {new Date(emp.todayAttendance.checkOut).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </motion.button>
                  ))
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={resetKiosk}
                className="w-full py-3 mt-4 text-gray-500 hover:text-orange-600 font-medium transition-colors"
              >
                Cancelar
              </motion.button>
            </motion.div>
          )}

          {/* Confirm State */}
          {step === 'confirm' && employee && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-8"
            >
              <div className="text-center mb-6">
                <motion.div
                  className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg ${
                    identifyMethod === 'manager_override'
                      ? 'bg-gradient-to-br from-amber-400 to-orange-500'
                      : 'bg-gradient-to-br from-orange-400 to-amber-500'
                  }`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', bounce: 0.5 }}
                >
                  <User className="w-12 h-12 text-white" />
                </motion.div>
                <motion.h2
                  className="text-2xl font-bold text-gray-900"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  {employee.fullName}
                </motion.h2>
                <motion.p
                  className="text-gray-500"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  {employee.employeeCode}
                </motion.p>
                {identifyMethod === 'face' && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="inline-flex items-center gap-1 mt-3 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm"
                  >
                    <Camera className="w-4 h-4" />
                    Verificado por rostro
                  </motion.span>
                )}
                {identifyMethod === 'manager_override' && managerData && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="inline-flex items-center gap-1 mt-3 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm"
                  >
                    <Shield className="w-4 h-4" />
                    Autorizado por {managerData.fullName}
                  </motion.span>
                )}
              </div>

              {employee.todayAttendance && (
                <motion.div
                  className="bg-gray-50 rounded-xl p-4 mb-6"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <p className="text-sm text-gray-500 mb-2">Registro de hoy:</p>
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <LogIn className="w-4 h-4 text-green-500" />
                      <span>Entrada: {employee.todayAttendance.checkIn
                        ? new Date(employee.todayAttendance.checkIn).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
                        : '-'
                      }</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <LogOut className="w-4 h-4 text-red-500" />
                      <span>Salida: {employee.todayAttendance.checkOut
                        ? new Date(employee.todayAttendance.checkOut).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
                        : '-'
                      }</span>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="space-y-3">
                {employee.canCheckIn && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCheckIn}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-2xl font-bold text-lg transition-all disabled:opacity-50 shadow-lg shadow-green-500/30"
                  >
                    {loading ? (
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    ) : (
                      <LogIn className="w-6 h-6" />
                    )}
                    Registrar Entrada
                  </motion.button>
                )}

                {employee.canCheckOut && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCheckOut}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white rounded-2xl font-bold text-lg transition-all disabled:opacity-50 shadow-lg shadow-red-500/30"
                  >
                    {loading ? (
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    ) : (
                      <LogOut className="w-6 h-6" />
                    )}
                    Registrar Salida
                  </motion.button>
                )}

                {!employee.canCheckIn && !employee.canCheckOut && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-4"
                  >
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                    <p className="text-gray-600 font-medium">
                      Ya has registrado entrada y salida hoy
                    </p>
                  </motion.div>
                )}
              </div>

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={resetKiosk}
                className="w-full py-3 mt-4 text-gray-500 hover:text-orange-600 font-medium transition-colors"
              >
                Cancelar
              </motion.button>
            </motion.div>
          )}

          {/* Success State */}
          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', bounce: 0.5, duration: 0.8 }}
                className="w-28 h-28 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30"
              >
                <CheckCircle className="w-16 h-16 text-white" />
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-3xl font-bold text-gray-900 mb-3"
              >
                ¡Registrado!
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-gray-600 text-lg"
              >
                {message}
              </motion.p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-400"
              >
                <RefreshCw className="w-4 h-4" />
                Volviendo en 5 segundos...
              </motion.div>
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
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ duration: 0.5 }}
                className="w-28 h-28 bg-gradient-to-br from-red-400 to-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/30"
              >
                <XCircle className="w-16 h-16 text-white" />
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-3xl font-bold text-gray-900 mb-3"
              >
                Error
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-gray-600 mb-6 text-lg"
              >
                {message}
              </motion.p>
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={resetKiosk}
                className="px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-bold shadow-lg shadow-orange-500/30 transition-all"
              >
                Intentar de nuevo
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center mt-8 relative z-10"
      >
        <p className="text-white/80 text-sm flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4" />
          Sistema de Control de Asistencia
          {isModelLoaded && (
            <span className="flex items-center gap-1 ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              IA Facial Activa
            </span>
          )}
        </p>
      </motion.div>
    </div>
  )
}
