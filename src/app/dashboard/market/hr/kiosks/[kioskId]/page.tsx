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
  ChevronLeft
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

type KioskStep = 'idle' | 'identify' | 'face-scan' | 'confirm' | 'success' | 'error' | 'manager-pin' | 'manager-select'
type IdentifyMethod = 'pin' | 'face' | 'manager_override'

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
    const REQUIRED_CONSECUTIVE_MATCHES = 2 // Require 2 consecutive matches for security
    let lastMatchId: number | null = null
    let scanStartTime = Date.now()
    const SCAN_TIMEOUT = 30000 // 30 second timeout

    const detectFaceLoop = async () => {
      // Timeout check
      if (Date.now() - scanStartTime > SCAN_TIMEOUT) {
        setMessage('Tiempo de escaneo agotado. Intente de nuevo.')
        setStep('error')
        return
      }

      if (!videoRef.current || isProcessing || scanStatus === 'processing') {
        timeoutId = setTimeout(detectFaceLoop, 300) // 300ms interval for better performance
        return
      }

      isProcessing = true
      setScanStatus('scanning')

      try {
        // Use skipCooldown since we control timing here
        const descriptor = await detectFace(videoRef.current, { skipCooldown: true })

        if (descriptor) {
          setFaceDetected(true)

          // Try to match face with stricter threshold (0.5)
          const match = findMatch(descriptor, employeeFaces, 0.5)

          if (match) {
            // Security: Require consecutive matches of the same person
            if (lastMatchId === match.employeeId) {
              consecutiveMatches++
            } else {
              consecutiveMatches = 1
              lastMatchId = match.employeeId
            }

            // Only verify after required consecutive matches
            if (consecutiveMatches >= REQUIRED_CONSECUTIVE_MATCHES) {
              setScanStatus('processing')
              console.log(`Face match confirmed: ${match.fullName} (confidence: ${match.confidence}%)`)
              await verifyEmployeeByFace(match.employeeId)
              return // Exit loop after successful match
            }
          } else {
            // Reset consecutive matches if no match
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
        timeoutId = setTimeout(detectFaceLoop, 300) // 300ms interval
      }
    }

    // Start detection loop after a short delay to let camera initialize
    const startTimeoutId = setTimeout(() => {
      detectFaceLoop()
    }, 500)

    return () => {
      clearTimeout(timeoutId)
      clearTimeout(startTimeoutId)
    }
  }, [cameraActive, isModelLoaded, step, employeeFaces, detectFace, findMatch, scanStatus])

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

      // Auto-verify when PIN is 4-6 digits
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

      // Auto-verify when PIN is 4-6 digits
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

      // First verify manager PIN by trying to authenticate
      const verifyResponse = await fetch(`/api/market/hr/kiosks/${kioskId}/verify-employee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'pin', pin: pinCode })
      })

      const verifyResult = await verifyResponse.json()

      if (!verifyResult.success) {
        // Check if it's because they're not a manager
        if (verifyResult.error?.includes('Solo managers')) {
          setMessage('Este PIN no pertenece a un manager')
        } else {
          setMessage(verifyResult.error || 'PIN de manager inválido')
        }
        setManagerPin('')
        return
      }

      // Manager verified, store their data
      setManagerData({
        id: verifyResult.data.id,
        fullName: verifyResult.data.fullName,
        employeeCode: verifyResult.data.employeeCode,
        role: 'MANAGER'
      })

      // Now fetch employee list
      const listResponse = await fetch(`/api/market/hr/kiosks/${kioskId}/verify-employee`)
      const listResult = await listResponse.json()

      if (listResult.success) {
        setEmployeeList(listResult.data)
        setStep('manager-select')
      } else {
        setMessage('Error al cargar lista de empleados')
      }

    } catch (error) {
      setMessage('Error de conexión')
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

      const requestBody: any = {
        employeeId: employee.id,
        method: identifyMethod === 'face' ? 'face' : identifyMethod === 'manager_override' ? 'manager_override' : 'kiosk',
        kioskId: parseInt(kioskId)
      }

      // Add manager data if this is a manager override
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

      const requestBody: any = {
        employeeId: employee.id,
        method: identifyMethod === 'face' ? 'face' : identifyMethod === 'manager_override' ? 'manager_override' : 'kiosk',
        kioskId: parseInt(kioskId)
      }

      // Add manager data if this is a manager override
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

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const hasFaceRecognition = employeeFaces.length > 0 && isModelLoaded

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
              className="p-8 text-center relative"
            >
              <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Camera className="w-12 h-12 text-indigo-600" />
              </div>
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
                  <button
                    onClick={() => {
                      setIdentifyMethod('face')
                      setStep('face-scan')
                    }}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg transition-colors"
                  >
                    <Camera className="w-6 h-6" />
                    Iniciar Reconocimiento Facial
                  </button>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                  <p className="text-amber-700 text-sm">
                    No hay empleados con rostro registrado. Contacte al administrador.
                  </p>
                </div>
              )}

              {modelsLoading && (
                <p className="text-sm text-gray-400 mt-4 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Cargando reconocimiento facial...
                </p>
              )}

              {/* Manager Override Button - positioned at bottom */}
              <div className="mt-8 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setStep('manager-pin')}
                  className="flex items-center justify-center gap-2 mx-auto text-gray-400 hover:text-indigo-600 transition-colors text-sm"
                >
                  <Shield className="w-4 h-4" />
                  Asistencia Manual (Manager)
                </button>
              </div>
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

              {/* Camera View */}
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

                {/* Face detection overlay */}
                <div className={`absolute inset-0 border-4 rounded-2xl transition-colors ${
                  faceDetected ? 'border-green-500' : 'border-transparent'
                }`} />

                {/* Scanning indicator */}
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
            </motion.div>
          )}

          {/* Manager PIN State */}
          {step === 'manager-pin' && (
            <motion.div
              key="manager-pin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-amber-600" />
                </div>
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
                  <div
                    key={i}
                    className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-colors ${
                      i < managerPin.length
                        ? 'border-amber-500 bg-amber-50 text-amber-600'
                        : 'border-gray-200'
                    }`}
                  >
                    {i < managerPin.length ? '•' : ''}
                  </div>
                ))}
              </div>

              {/* Number Pad */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((digit, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (digit === null) return
                      if (digit === 'del') handleManagerPinDelete()
                      else handleManagerPinChange(digit.toString())
                    }}
                    disabled={loading || digit === null}
                    className={`h-16 rounded-xl text-2xl font-bold transition-colors ${
                      digit === null
                        ? 'invisible'
                        : digit === 'del'
                          ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          : 'bg-gray-100 text-gray-900 hover:bg-amber-100'
                    }`}
                  >
                    {digit === 'del' ? '⌫' : digit}
                  </button>
                ))}
              </div>

              {loading && (
                <div className="flex items-center justify-center gap-2 text-amber-600">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Verificando manager...</span>
                </div>
              )}

              {message && !loading && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
                  {message}
                </div>
              )}

              <button
                onClick={resetKiosk}
                className="w-full py-3 text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
            </motion.div>
          )}

          {/* Manager Employee Selection State */}
          {step === 'manager-select' && (
            <motion.div
              key="manager-select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => {
                    setStep('manager-pin')
                    setManagerPin('')
                    setManagerData(null)
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-500" />
                </button>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Seleccionar Empleado
                  </h2>
                  {managerData && (
                    <p className="text-xs text-amber-600">
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
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Employee List */}
              <div className="max-h-80 overflow-y-auto space-y-2">
                {loadingEmployees ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No se encontraron empleados
                  </div>
                ) : (
                  filteredEmployees.map(emp => (
                    <button
                      key={emp.id}
                      onClick={() => selectEmployeeForOverride(emp)}
                      className="w-full p-3 flex items-center gap-3 bg-gray-50 hover:bg-amber-50 rounded-xl transition-colors text-left"
                    >
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-500" />
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
                          <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
                            Entrada: {new Date(emp.todayAttendance.checkIn).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                            Sin entrada
                          </span>
                        )}
                        {emp.todayAttendance?.checkOut && (
                          <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                            Salida: {new Date(emp.todayAttendance.checkOut).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </button>
                  ))
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
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  identifyMethod === 'manager_override' ? 'bg-amber-100' : 'bg-indigo-100'
                }`}>
                  <User className={`w-10 h-10 ${
                    identifyMethod === 'manager_override' ? 'text-amber-600' : 'text-indigo-600'
                  }`} />
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
                {identifyMethod === 'manager_override' && managerData && (
                  <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">
                    <Shield className="w-4 h-4" />
                    Autorizado por {managerData.fullName}
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
      <p className="text-indigo-200 text-sm mt-8">
        Sistema de Control de Asistencia
        {isModelLoaded && <span className="ml-2">• IA Facial Activa</span>}
      </p>
    </div>
  )
}
