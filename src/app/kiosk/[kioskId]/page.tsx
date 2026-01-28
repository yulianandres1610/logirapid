'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  Settings,
  ArrowLeft
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

type KioskStep = 'idle' | 'identify' | 'face-scan' | 'confirm' | 'success' | 'error'
type IdentifyMethod = 'pin' | 'face'

export default function AttendanceKioskPage() {
  const params = useParams()
  const router = useRouter()
  const kioskId = params.kioskId as string

  const [kiosk, setKiosk] = useState<KioskInfo | null>(null)
  const [step, setStep] = useState<KioskStep>('idle')
  const [identifyMethod, setIdentifyMethod] = useState<IdentifyMethod>('pin')
  const [pin, setPin] = useState('')
  const [employee, setEmployee] = useState<EmployeeResult | null>(null)
  const [message, setMessage] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [loading, setLoading] = useState(false)
  const [kioskNotFound, setKioskNotFound] = useState(false)

  // Face recognition states
  const [employeeFaces, setEmployeeFaces] = useState<EmployeeFace[]>([])
  const [cameraActive, setCameraActive] = useState(false)
  const [faceDetected, setFaceDetected] = useState(false)
  const [scanStatus, setScanStatus] = useState<string>('idle')

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

  // Face detection loop
  useEffect(() => {
    if (!cameraActive || !isModelLoaded || step !== 'face-scan') return

    let animationFrameId: number
    let isProcessing = false

    const detectFaceLoop = async () => {
      if (!videoRef.current || isProcessing || scanStatus === 'processing') {
        animationFrameId = requestAnimationFrame(detectFaceLoop)
        return
      }

      isProcessing = true
      setScanStatus('scanning')

      try {
        const descriptor = await detectFace(videoRef.current)

        if (descriptor) {
          setFaceDetected(true)
          setScanStatus('processing')

          const match = findMatch(descriptor, employeeFaces, 0.6)

          if (match) {
            await verifyEmployeeByFace(match.employeeId)
          } else {
            setFaceDetected(false)
          }
        } else {
          setFaceDetected(false)
        }
      } catch (err) {
        console.error('Face detection error:', err)
      }

      isProcessing = false
      if (step === 'face-scan' && scanStatus !== 'processing') {
        animationFrameId = requestAnimationFrame(detectFaceLoop)
      }
    }

    const timeoutId = setTimeout(() => {
      animationFrameId = requestAnimationFrame(detectFaceLoop)
    }, 500)

    return () => {
      cancelAnimationFrame(animationFrameId)
      clearTimeout(timeoutId)
    }
  }, [cameraActive, isModelLoaded, step, employeeFaces, detectFace, findMatch, scanStatus])

  const fetchKiosk = async () => {
    try {
      const response = await fetch(`/api/market/hr/kiosks/${kioskId}`)
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
    setEmployee(null)
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
        setMessage(result.error || 'PIN inválido')
        setStep('error')
      }
    } catch (error) {
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
        setStep('confirm')
      } else {
        setMessage(result.error || 'No se pudo verificar el empleado')
        setScanStatus('idle')
      }
    } catch (error) {
      setMessage('Error de conexión')
      setScanStatus('idle')
    } finally {
      setLoading(false)
    }
  }

  const handleCheckIn = async () => {
    if (!employee) return

    try {
      setLoading(true)
      const response = await fetch('/api/market/hr/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.id,
          method: identifyMethod === 'face' ? 'face' : 'kiosk',
          kioskId: parseInt(kioskId)
        })
      })

      const result = await response.json()

      if (result.success) {
        setMessage(result.message)
        setStep('success')
      } else {
        setMessage(result.error || 'Error al registrar entrada')
        setStep('error')
      }
    } catch (error) {
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
      const response = await fetch('/api/market/hr/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.id,
          method: identifyMethod === 'face' ? 'face' : 'kiosk',
          kioskId: parseInt(kioskId)
        })
      })

      const result = await response.json()

      if (result.success) {
        setMessage(result.message)
        setStep('success')
      } else {
        setMessage(result.error || 'Error al registrar salida')
        setStep('error')
      }
    } catch (error) {
      setMessage('Error de conexión')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  const changeKiosk = () => {
    localStorage.removeItem('attendance-kiosk-id')
    router.push('/kiosk')
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const hasFaceRecognition = employeeFaces.length > 0 && isModelLoaded

  // Kiosk not found
  if (kioskNotFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-900 flex flex-col items-center justify-center p-4">
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
            className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Seleccionar otro kiosco
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-900 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          {kiosk?.name || 'Kiosco de Asistencia'}
        </h1>
        {kiosk?.location && (
          <p className="text-indigo-200">{kiosk.location}</p>
        )}
      </div>

      {/* Time Display */}
      <div className="text-center mb-8">
        <p className="text-6xl font-bold text-white tracking-wider">
          {formatTime(currentTime)}
        </p>
        <p className="text-indigo-200 mt-2 capitalize">
          {formatDate(currentTime)}
        </p>
      </div>

      {/* Main Card */}
      <motion.div
        layout
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <AnimatePresence mode="wait">
          {/* Idle State */}
          {step === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 text-center"
            >
              <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Fingerprint className="w-12 h-12 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Marcar Asistencia
              </h2>
              <p className="text-gray-500 mb-8">
                {hasFaceRecognition
                  ? 'Selecciona el método de identificación'
                  : 'Toca el botón para comenzar'
                }
              </p>

              {hasFaceRecognition ? (
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setIdentifyMethod('face')
                      setStep('face-scan')
                    }}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg transition-colors"
                  >
                    <Camera className="w-6 h-6" />
                    Reconocimiento Facial
                  </button>
                  <button
                    onClick={() => {
                      setIdentifyMethod('pin')
                      setStep('identify')
                    }}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold text-lg transition-colors"
                  >
                    <Keyboard className="w-6 h-6" />
                    Usar PIN
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setStep('identify')}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg transition-colors"
                >
                  Comenzar
                </button>
              )}

              {modelsLoading && (
                <p className="text-sm text-gray-400 mt-4 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Cargando reconocimiento facial...
                </p>
              )}
            </motion.div>
          )}

          {/* Face Scan State */}
          {step === 'face-scan' && (
            <motion.div
              key="face-scan"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8"
            >
              <div className="text-center mb-4">
                <Camera className="w-10 h-10 text-indigo-600 mx-auto mb-2" />
                <h2 className="text-xl font-bold text-gray-900">
                  Reconocimiento Facial
                </h2>
                <p className="text-gray-500 text-sm">
                  Mira directamente a la cámara
                </p>
              </div>

              <div className="relative rounded-2xl overflow-hidden mb-6 bg-black aspect-[4/3]">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full"
                />

                <div className={`absolute inset-0 border-4 rounded-2xl transition-colors ${
                  faceDetected ? 'border-green-500' : 'border-transparent'
                }`} />

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                  <div className={`px-4 py-2 rounded-full flex items-center gap-2 ${
                    scanStatus === 'processing'
                      ? 'bg-green-500 text-white'
                      : faceDetected
                        ? 'bg-green-100 text-green-700'
                        : 'bg-white/80 text-gray-700'
                  }`}>
                    {scanStatus === 'processing' ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span className="text-sm font-medium">Verificando...</span>
                      </>
                    ) : (
                      <>
                        <Scan className="w-4 h-4" />
                        <span className="text-sm font-medium">
                          {faceDetected ? 'Rostro detectado' : 'Buscando rostro...'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={resetKiosk}
                className="w-full py-3 text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>

              <button
                onClick={() => {
                  setIdentifyMethod('pin')
                  setStep('identify')
                }}
                className="w-full py-3 text-indigo-600 hover:text-indigo-700 text-sm"
              >
                Usar PIN en su lugar
              </button>
            </motion.div>
          )}

          {/* Identify State (PIN) */}
          {step === 'identify' && (
            <motion.div
              key="identify"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8"
            >
              <div className="text-center mb-6">
                <Keyboard className="w-10 h-10 text-indigo-600 mx-auto mb-2" />
                <h2 className="text-xl font-bold text-gray-900">
                  Ingresa tu PIN
                </h2>
              </div>

              <div className="flex justify-center gap-3 mb-6">
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <div
                    key={i}
                    className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-colors ${
                      i < pin.length
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                        : 'border-gray-200'
                    }`}
                  >
                    {i < pin.length ? '•' : ''}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((digit, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (digit === null) return
                      if (digit === 'del') handlePinDelete()
                      else handlePinChange(digit.toString())
                    }}
                    disabled={loading || digit === null}
                    className={`h-16 rounded-xl text-2xl font-bold transition-colors ${
                      digit === null
                        ? 'invisible'
                        : digit === 'del'
                          ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          : 'bg-gray-100 text-gray-900 hover:bg-indigo-100'
                    }`}
                  >
                    {digit === 'del' ? '⌫' : digit}
                  </button>
                ))}
              </div>

              {loading && (
                <div className="flex items-center justify-center gap-2 text-indigo-600">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Verificando...</span>
                </div>
              )}

              <button
                onClick={resetKiosk}
                className="w-full py-3 text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>

              {hasFaceRecognition && (
                <button
                  onClick={() => {
                    setIdentifyMethod('face')
                    setPin('')
                    setStep('face-scan')
                  }}
                  className="w-full py-3 text-indigo-600 hover:text-indigo-700 text-sm"
                >
                  Usar reconocimiento facial
                </button>
              )}
            </motion.div>
          )}

          {/* Confirm State */}
          {step === 'confirm' && employee && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8"
            >
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-10 h-10 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {employee.fullName}
                </h2>
                <p className="text-gray-500">{employee.employeeCode}</p>
                {identifyMethod === 'face' && (
                  <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                    <Camera className="w-4 h-4" />
                    Verificado por rostro
                  </span>
                )}
              </div>

              {employee.todayAttendance && (
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <p className="text-sm text-gray-500 mb-2">Hoy:</p>
                  <div className="flex justify-between text-sm">
                    <span>Entrada: {employee.todayAttendance.checkIn
                      ? new Date(employee.todayAttendance.checkIn).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
                      : '-'
                    }</span>
                    <span>Salida: {employee.todayAttendance.checkOut
                      ? new Date(employee.todayAttendance.checkOut).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
                      : '-'
                    }</span>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {employee.canCheckIn && (
                  <button
                    onClick={handleCheckIn}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-bold text-lg transition-colors disabled:opacity-50"
                  >
                    <LogIn className="w-6 h-6" />
                    Registrar Entrada
                  </button>
                )}

                {employee.canCheckOut && (
                  <button
                    onClick={handleCheckOut}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold text-lg transition-colors disabled:opacity-50"
                  >
                    <LogOut className="w-6 h-6" />
                    Registrar Salida
                  </button>
                )}

                {!employee.canCheckIn && !employee.canCheckOut && (
                  <div className="text-center py-4 text-gray-500">
                    Ya has registrado entrada y salida hoy
                  </div>
                )}
              </div>

              <button
                onClick={resetKiosk}
                className="w-full py-3 mt-4 text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
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
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', bounce: 0.5 }}
                className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <CheckCircle className="w-14 h-14 text-green-500" />
              </motion.div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                ¡Registrado!
              </h2>
              <p className="text-gray-600">{message}</p>
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
                onClick={resetKiosk}
                className="px-6 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium"
              >
                Intentar de nuevo
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Footer */}
      <div className="mt-8 flex items-center gap-4">
        <p className="text-indigo-200 text-sm">
          asistencia.logirapid.com
          {isModelLoaded && <span className="ml-2">• IA Facial Activa</span>}
        </p>
        <button
          onClick={changeKiosk}
          className="text-indigo-300 hover:text-white p-2"
          title="Cambiar kiosco"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
