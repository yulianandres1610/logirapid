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
  Moon,
  Upload,
  Image as ImageIcon,
  Edit3,
  BookUser,
  Car,
  ClipboardList
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
  | 'scan_id_reverse'
  | 'processing_id'
  | 'verify_data'      // NEW: Verify OCR data before registering
  | 'manual_register'
  | 'visitor_info'
  | 'select_purpose'
  | 'entry_success'
  | 'check_sales'
  | 'validate_sales'
  | 'exit_success'
  | 'daily_log'
  | 'error'

const VISIT_PURPOSES = [
  { id: 'compra', label: 'Compra', icon: Package },
  { id: 'reunion', label: 'Reunión', icon: User },
  { id: 'entrega', label: 'Entrega', icon: FileText },
  { id: 'servicio', label: 'Servicio', icon: Settings },
  { id: 'otro', label: 'Otro', icon: CheckCircle },
]

const DOCUMENT_TYPES = [
  { id: 'cedula', label: 'Carnet de Identidad', icon: CreditCard },
  { id: 'passport', label: 'Pasaporte', icon: BookUser },
  { id: 'license', label: 'Licencia', icon: Car },
]

const INACTIVITY_TIMEOUT = 300000 // 5 minutes

const ID_TYPE_LABELS: Record<string, string> = {
  cedula: 'Carnet de Identidad',
  passport: 'Pasaporte',
  license: 'Licencia',
}

interface Employee {
  id: number
  fullName: string
  department: string | null
}

interface DailyLogEntry {
  id: number
  visitorName: string
  visitorIdNumber: string
  entryTime: string
  exitTime: string | null
  visitPurpose: string | null
  visitNotes: string | null
  status: string
}

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
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [loading, setLoading] = useState(false)
  const [kioskNotFound, setKioskNotFound] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [kioskTheme, setKioskTheme] = useState<KioskTheme>('dark')

  // Manual/verification form states (used for both manual entry and OCR verification)
  const [formName, setFormName] = useState('')
  const [formIdNumber, setFormIdNumber] = useState('')
  const [formIdType, setFormIdType] = useState<string>('cedula')
  const [formAddress, setFormAddress] = useState('')
  const [formDateOfBirth, setFormDateOfBirth] = useState('')
  const [formGender, setFormGender] = useState<string>('')
  const [isOcrError, setIsOcrError] = useState(false)
  const [isExistingVisitor, setIsExistingVisitor] = useState(false)

  // Aliases for backward compatibility
  const manualName = formName
  const setManualName = setFormName
  const manualIdNumber = formIdNumber
  const setManualIdNumber = setFormIdNumber
  const manualIdType = formIdType
  const setManualIdType = setFormIdType

  // Two-photo capture for Cuban cedula (front + reverse)
  const [capturedImageReverse, setCapturedImageReverse] = useState<string | null>(null)
  const [capturingSide, setCapturingSide] = useState<'front' | 'reverse'>('front')
  const [needsReversePhoto, setNeedsReversePhoto] = useState(false)

  // Notes for visit purpose (mandatory for all)
  const [purposeNotes, setPurposeNotes] = useState('')

  // Employee selection for "reunion" purpose
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [loadingEmployees, setLoadingEmployees] = useState(false)

  // Daily log
  const [dailyLogs, setDailyLogs] = useState<DailyLogEntry[]>([])
  const [loadingDailyLog, setLoadingDailyLog] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pinInputRef = useRef<HTMLInputElement>(null)
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const compressionCanvasRef = useRef<HTMLCanvasElement>(null)

  /**
   * Compress image on client side before sending to API
   * This prevents 413 errors from large mobile photos
   */
  const compressImage = useCallback(async (dataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        try {
          // Max dimensions for OCR - 1280px is sufficient for reading ID text
          const MAX_SIZE = 1280
          const QUALITY = 0.70

          let { width, height } = img

          // Calculate new dimensions maintaining aspect ratio
          if (width > MAX_SIZE || height > MAX_SIZE) {
            if (width > height) {
              height = Math.round((height / width) * MAX_SIZE)
              width = MAX_SIZE
            } else {
              width = Math.round((width / height) * MAX_SIZE)
              height = MAX_SIZE
            }
          }

          // Use the ref canvas or create one
          const canvas = compressionCanvasRef.current || document.createElement('canvas')
          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Could not get canvas context'))
            return
          }

          // Draw image with white background (in case of transparency)
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, width, height)
          ctx.drawImage(img, 0, 0, width, height)

          // Convert to JPEG with compression
          const compressedDataUrl = canvas.toDataURL('image/jpeg', QUALITY)

          console.log('[Image Compress] Original size:', Math.round(dataUrl.length / 1024), 'KB')
          console.log('[Image Compress] Compressed size:', Math.round(compressedDataUrl.length / 1024), 'KB')
          console.log('[Image Compress] Dimensions:', width, 'x', height)

          resolve(compressedDataUrl)
        } catch (err) {
          reject(err)
        }
      }
      img.onerror = () => reject(new Error('Failed to load image for compression'))
      img.src = dataUrl
    })
  }, [])

  // Reset inactivity timer
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }

    // Only set timer if guard is logged in and not already locked
    if (guard && step !== 'guard_pin' && step !== 'locked') {
      inactivityTimerRef.current = setTimeout(() => {
        setPin('')
        setMessage('')
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

  // Update time every second (client-side only to avoid hydration mismatch)
  useEffect(() => {
    setCurrentTime(new Date()) // Set initial time on client
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

  // Handle physical keyboard input for PIN
  useEffect(() => {
    if (step !== 'guard_pin' && step !== 'locked') return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handlePinChange(e.key)
      } else if (e.key === 'Backspace') {
        handlePinDelete()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [step, pin])

  // Stop camera when leaving scan_id step
  useEffect(() => {
    if (step !== 'scan_id') {
      stopCamera()
    }
    return () => stopCamera()
  }, [step])

  // Reset camera state when entering scan_id
  useEffect(() => {
    if (step === 'scan_id') {
      setCameraError(null)
      setCapturedImage(null)
    }
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
    // Don't start if already active or loading
    if (cameraActive || cameraLoading) {
      console.log('[Camera] Already active or loading, skipping')
      return
    }

    setCameraLoading(true)
    setCameraError(null)

    try {
      // Check if camera is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Cámara no soportada en este dispositivo')
      }

      console.log('[Camera] Requesting camera access...')

      // Try to get camera - prefer back camera on mobile
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          facingMode: { ideal: 'environment' }
        },
        audio: false
      })

      console.log('[Camera] Got stream, setting up video element...')

      // Store stream reference
      streamRef.current = stream

      // Wait for video element to be available
      if (!videoRef.current) {
        console.log('[Camera] Video element not ready, waiting...')
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream

        // Wait for video to be ready to play
        await new Promise<void>((resolve, reject) => {
          const video = videoRef.current!
          const timeout = setTimeout(() => {
            reject(new Error('Timeout esperando video'))
          }, 5000)

          video.onloadedmetadata = () => {
            clearTimeout(timeout)
            video.play()
              .then(() => {
                console.log('[Camera] Video playing successfully')
                resolve()
              })
              .catch(reject)
          }

          video.onerror = () => {
            clearTimeout(timeout)
            reject(new Error('Error cargando video'))
          }
        })

        setCameraActive(true)
        console.log('[Camera] Camera active and ready')
      } else {
        throw new Error('Elemento de video no disponible')
      }
    } catch (err) {
      console.error('[Camera] Error:', err)

      // Clean up any partial stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }

      // Set user-friendly error message
      let errorMsg = 'No se pudo acceder a la cámara'
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMsg = 'Permiso de cámara denegado. Por favor permita el acceso a la cámara.'
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          errorMsg = 'No se encontró cámara en el dispositivo'
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          errorMsg = 'La cámara está siendo usada por otra aplicación'
        } else if (err.message) {
          errorMsg = err.message
        }
      }

      setCameraError(errorMsg)
      setCameraActive(false)
    } finally {
      setCameraLoading(false)
    }
  }

  const stopCamera = () => {
    if (!streamRef.current && !cameraActive) return
    console.log('[Camera] Stopping camera...')
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
    setCameraLoading(false)
  }

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    const imageData = canvas.toDataURL('image/jpeg', 0.9)
    stopCamera()

    // Compress image before processing
    try {
      const compressedImage = await compressImage(imageData)
      setCapturedImage(compressedImage)
      processIdDocument(compressedImage)
    } catch (err) {
      console.error('[Capture] Compression failed, using original:', err)
      setCapturedImage(imageData)
      processIdDocument(imageData)
    }
  }

  // Handle file input (for mobile devices - native camera or gallery)
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Stop camera if active
    stopCamera()

    // Show processing state immediately
    setStep('processing_id')
    setLoading(true)

    const reader = new FileReader()
    reader.onload = async (e) => {
      const imageData = e.target?.result as string
      if (imageData) {
        try {
          // Compress image before processing (prevents 413 errors)
          const compressedImage = await compressImage(imageData)
          setCapturedImage(compressedImage)
          // Note: processIdDocument will set loading to false
          await processIdDocument(compressedImage)
        } catch (err) {
          console.error('[FileSelect] Compression failed, trying original:', err)
          setCapturedImage(imageData)
          await processIdDocument(imageData)
        }
      }
    }
    reader.onerror = () => {
      setMessage('Error al leer la imagen')
      setStep('error')
      setLoading(false)
    }
    reader.readAsDataURL(file)

    // Reset input so same file can be selected again
    event.target.value = ''
  }

  // Open native camera on mobile
  const openNativeCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const processIdDocument = async (imageBase64: string, isReverse: boolean = false) => {
    setStep('processing_id')
    setLoading(true)
    setIsOcrError(false)

    try {
      const response = await fetch('/api/ai/scan-id-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: imageBase64.split(',')[1],
          mimeType: 'image/jpeg',
          // Pass kiosk credentials for authentication
          kioskId: parseInt(kioskId),
          guardId: guard?.id
        })
      })

      const result = await response.json()

      if (result.success && result.data.fullName) {
        let finalData = result.data

        // If reverse photo was already captured, process it for address
        if (capturedImageReverse && !isReverse) {
          try {
            const reverseResponse = await fetch('/api/ai/scan-id-document', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileBase64: capturedImageReverse.split(',')[1],
                mimeType: 'image/jpeg',
                kioskId: parseInt(kioskId),
                guardId: guard?.id
              })
            })
            const reverseResult = await reverseResponse.json()
            if (reverseResult.success && reverseResult.data.address) {
              finalData.address = reverseResult.data.address
            }
          } catch (e) {
            console.log('[ID Scanner] Error processing reverse, continuing without:', e)
          }
        }

        // Merge data if this is the reverse side scan
        if (isReverse && scannedData) {
          finalData = {
            ...scannedData,
            address: result.data.address || scannedData.address
          }
        }

        setScannedData(finalData)

        // Populate form fields with OCR data for verification
        setFormName(finalData.fullName || '')
        setFormIdNumber(finalData.documentNumber || '')
        setFormIdType(finalData.documentType || 'cedula')
        setFormAddress(finalData.address || '')
        setFormDateOfBirth(finalData.dateOfBirth || '')
        setFormGender(finalData.gender || '')

        // Check if visitor already exists
        try {
          const checkResponse = await fetch(
            `/api/market/door-security/visitors?idNumber=${encodeURIComponent(finalData.documentNumber)}&kioskId=${kioskId}&guardId=${guard?.id}`
          )
          const checkResult = await checkResponse.json()

          if (checkResult.success && checkResult.data.visitors.length > 0) {
            // Visitor exists - mark as existing and show their info
            const existingVisitor = checkResult.data.visitors[0]
            setVisitor(existingVisitor)
            setIsExistingVisitor(true)
          } else {
            // New visitor
            setIsExistingVisitor(false)
          }
        } catch (e) {
          console.log('[Visitor Check] Error checking existing:', e)
          setIsExistingVisitor(false)
        }

        // Go to verification step
        setStep('verify_data')
      } else {
        // OCR failed - show options to retry or register manually
        setMessage(result.error || 'No se pudo leer el documento. Intente con una foto más clara.')
        setIsOcrError(true)
        setStep('error')
      }
    } catch (error) {
      console.error('Error processing ID:', error)
      setMessage('Error al procesar el documento')
      // Connection error - not OCR error
      setIsOcrError(false)
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  const checkOrRegisterVisitor = async (data: ScannedIdData, photoBase64: string, photoReverseBase64: string | null = null) => {
    try {
      const requestBody: any = {
        fullName: data.fullName,
        idType: data.documentType,
        idNumber: data.documentNumber,
        dateOfBirth: data.dateOfBirth,
        address: data.address,
        gender: data.gender,
        // Pass kiosk credentials for authentication (when no JWT)
        kioskId: parseInt(kioskId),
        guardId: guard?.id
      }

      // Add front photo if available
      if (photoBase64) {
        requestBody.idPhotoBase64 = photoBase64.includes(',') ? photoBase64.split(',')[1] : photoBase64
      }

      // Add reverse photo if available (Cuban cedula)
      if (photoReverseBase64) {
        requestBody.idPhotoReverseBase64 = photoReverseBase64.includes(',') ? photoReverseBase64.split(',')[1] : photoReverseBase64
      }

      const response = await fetch('/api/market/door-security/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
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

  const submitManualRegistration = async () => {
    if (!manualName.trim() || !manualIdNumber.trim()) {
      setMessage('Nombre y número de ID son requeridos')
      return
    }

    setLoading(true)

    try {
      // Create data simulating OCR structure
      const manualData: ScannedIdData = {
        fullName: manualName.trim(),
        documentType: manualIdType,
        documentNumber: manualIdNumber.trim(),
        dateOfBirth: null,
        address: null,
        gender: null,
        confidence: 0 // Indicates manual registration
      }

      // Use same flow as successful OCR, include reverse photo if captured
      await checkOrRegisterVisitor(manualData, capturedImage || '', capturedImageReverse)
    } catch (error) {
      console.error('Error in manual registration:', error)
      setMessage('Error al registrar visitante')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  const goToManualRegister = () => {
    // Reset manual registration fields
    setManualName('')
    setManualIdNumber('')
    setManualIdType('cedula')
    setStep('manual_register')
  }

  const checkPendingSales = async (logId: number) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/market/door-security/logs/${logId}/pending-sales?kioskId=${kioskId}&guardId=${guard?.id}`)
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

  const registerEntry = async (purpose: string, notes?: string) => {
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
          visitPurpose: purpose,
          visitNotes: notes || null
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
    stopCamera()
    setStep('idle')
    setVisitor(null)
    setScannedData(null)
    setCapturedImage(null)
    setCapturedImageReverse(null)
    setCameraError(null)
    setActiveLogId(null)
    setPendingSales([])
    // Reset manual registration states
    setManualName('')
    setManualIdNumber('')
    setManualIdType('cedula')
    setIsOcrError(false)
    // Reset two-photo capture states
    setCapturingSide('front')
    setNeedsReversePhoto(false)
    // Reset notes and employee selection
    setPurposeNotes('')
    setValidatedSales(new Set())
    setSelectedPurpose('')
    setSelectedEmployee(null)
    setEmployees([])
    setEmployeeSearch('')
    setMessage('')
  }

  const fetchEmployees = async (search?: string) => {
    setLoadingEmployees(true)
    try {
      const params = new URLSearchParams({
        kioskId,
        guardId: guard?.id?.toString() || '',
        ...(search && { search })
      })
      const res = await fetch(`/api/market/door-security/employees?${params}`)
      const data = await res.json()
      if (data.success) {
        setEmployees(data.data)
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
    } finally {
      setLoadingEmployees(false)
    }
  }

  const fetchDailyLog = async () => {
    setLoadingDailyLog(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const params = new URLSearchParams({
        kioskId,
        guardId: guard?.id?.toString() || '',
        date: today
      })
      const res = await fetch(`/api/market/door-security/logs?${params}`)
      const data = await res.json()
      if (data.success) {
        setDailyLogs(data.data.logs || [])
      }
    } catch (error) {
      console.error('Error fetching daily log:', error)
    } finally {
      setLoadingDailyLog(false)
    }
  }

  const openDailyLog = () => {
    fetchDailyLog()
    setStep('daily_log')
  }

  const changeKiosk = () => {
    localStorage.removeItem('door-kiosk-id')
    router.push('/door-kiosk')
  }

  const logoutGuard = () => {
    // Clear guard session
    setGuard(null)
    setPin('')
    // Cleanup without resetting to idle (which would override the step)
    stopCamera()
    setVisitor(null)
    setScannedData(null)
    setCapturedImage(null)
    setCameraError(null)
    setActiveLogId(null)
    setPendingSales([])
    setValidatedSales(new Set())
    setSelectedPurpose('')
    setMessage('')
    // Set step to guard_pin LAST to ensure it takes effect
    setStep('guard_pin')
  }

  const formatTime = (date: Date | null) => {
    if (!date) return '--:--:--'
    return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const formatDate = (date: Date | null) => {
    if (!date) return '...'
    return date.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  // Get guard initials for avatar
  const getGuardInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  // Kiosk not found
  if (kioskNotFound) {
    return (
      <div className={`min-h-screen min-h-[100dvh] ${theme.bg} flex flex-col items-center justify-center p-3 sm:p-4`}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`${theme.card} rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-8 text-center border`}
        >
          <XCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-400 mx-auto mb-3 sm:mb-4" />
          <h2 className={`text-lg sm:text-xl font-bold ${theme.text} mb-2`}>
            Kiosco no encontrado
          </h2>
          <p className={`${theme.textSecondary} text-sm sm:text-base mb-4 sm:mb-6`}>
            El kiosco con ID {kioskId} no existe o no está activo.
          </p>
          <button
            onClick={changeKiosk}
            className="flex items-center justify-center gap-2 w-full py-2.5 sm:py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg sm:rounded-xl font-medium text-sm sm:text-base transition-all"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            Seleccionar otro kiosco
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen min-h-[100dvh] ${theme.bg} flex flex-col items-center justify-center p-2 sm:p-4 relative overflow-hidden`}>
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
        className={`absolute top-2 right-2 sm:top-4 sm:right-4 p-2 sm:p-3 rounded-xl ${kioskTheme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-stone-200 hover:bg-stone-300 text-stone-700'} transition-all z-10`}
        title={kioskTheme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      >
        {kioskTheme === 'dark' ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
      </motion.button>

      {/* Company Logo - Prominent */}
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', bounce: 0.3 }}
        className="mb-3 sm:mb-6 flex flex-col items-center"
      >
        {kiosk?.companyLogo ? (
          <img
            src={kiosk.companyLogo}
            alt={kiosk.companyName || 'Logo'}
            className="h-16 sm:h-24 w-auto object-contain drop-shadow-lg"
          />
        ) : kiosk?.companyName ? (
          <div className={`text-xl sm:text-3xl font-bold ${theme.text} tracking-tight`}>
            {kiosk.companyName}
          </div>
        ) : null}
      </motion.div>

      {/* Time Display - Prominent */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-4 sm:mb-8"
      >
        <p className={`text-4xl sm:text-6xl font-extralight ${theme.text} tracking-wider font-mono`}>
          {formatTime(currentTime)}
        </p>
        <p className={`${theme.textMuted} mt-1 sm:mt-2 capitalize text-sm sm:text-lg`}>
          {formatDate(currentTime)}
        </p>
      </motion.div>

      {/* Guard Info Bar - When logged in */}
      {guard && step !== 'guard_pin' && step !== 'locked' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg mb-2 sm:mb-4 px-1"
        >
          <div className={`${theme.cardSolid} rounded-xl sm:rounded-2xl px-3 sm:px-5 py-2 sm:py-3 flex items-center justify-between border`}>
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-lg flex-shrink-0">
                {getGuardInitials(guard.name)}
              </div>
              <div className="min-w-0">
                <p className={`${theme.text} font-medium text-sm sm:text-base truncate`}>{guard.name}</p>
                <p className={`${theme.textMuted} text-xs hidden sm:block`}>{guard.code}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <button
                onClick={logoutGuard}
                className="text-red-400 hover:text-red-300 text-xs sm:text-sm font-medium transition-colors"
              >
                Cerrar Sesión
              </button>
              <button
                onClick={changeKiosk}
                className={`${theme.textMuted} hover:text-orange-500 p-1 sm:p-1.5 transition-colors`}
                title="Cambiar kiosco"
              >
                <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Kiosk Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-4 ${theme.textMuted}`}
      >
        <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
        <span className="text-xs sm:text-sm truncate max-w-[250px] sm:max-w-none">{kiosk?.name} • {kiosk?.location}</span>
      </motion.div>

      {/* Main Card */}
      <motion.div
        layout
        className={`${theme.card} rounded-2xl sm:rounded-3xl shadow-2xl w-full ${step === 'verify_data' ? 'max-w-2xl' : 'max-w-lg'} overflow-hidden border relative mx-1 transition-all duration-300`}
      >
        <AnimatePresence mode="wait">
          {/* Guard PIN Entry */}
          {step === 'guard_pin' && (
            <motion.div
              key="guard_pin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 sm:p-8"
            >
              <div className="text-center mb-4 sm:mb-8">
                <div className="w-14 h-14 sm:w-20 sm:h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg shadow-orange-500/30">
                  <Shield className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
                </div>
                <h2 className={`text-xl sm:text-2xl font-bold ${theme.text}`}>
                  Acceso de Guardia
                </h2>
                <p className={`${theme.textMuted} text-xs sm:text-sm mt-1`}>
                  Ingrese su PIN de 4 dígitos
                </p>
              </div>

              <div className="flex justify-center gap-2 sm:gap-4 mb-4 sm:mb-8">
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    className={`w-11 h-11 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl border-2 flex items-center justify-center text-xl sm:text-2xl font-bold transition-all ${
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
                <p className="text-center text-red-400 text-xs sm:text-sm mb-3 sm:mb-4">{message}</p>
              )}

              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((digit, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (digit === null) return
                      if (digit === 'del') handlePinDelete()
                      else handlePinChange(digit.toString())
                    }}
                    disabled={loading || digit === null}
                    className={`h-12 sm:h-16 rounded-lg sm:rounded-xl text-lg sm:text-xl font-semibold transition-all ${
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
                <div className="flex items-center justify-center gap-2 text-orange-400 mt-4 sm:mt-6">
                  <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  <span className="text-sm sm:text-base">Verificando...</span>
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
              className="p-4 sm:p-8"
            >
              <div className="text-center mb-4 sm:mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', bounce: 0.5 }}
                  className={`w-14 h-14 sm:w-20 sm:h-20 ${kioskTheme === 'dark' ? 'bg-stone-700' : 'bg-stone-200'} rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4`}
                >
                  <Lock className={`w-7 h-7 sm:w-10 sm:h-10 ${theme.textMuted}`} />
                </motion.div>
                <h2 className={`text-xl sm:text-2xl font-bold ${theme.text}`}>
                  Kiosco Bloqueado
                </h2>
                <p className={`${theme.textMuted} text-xs sm:text-sm mt-1`}>
                  Ingrese su PIN para desbloquear
                </p>
                {guard && (
                  <div className="flex items-center justify-center gap-2 mt-2 sm:mt-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-[10px] sm:text-xs font-bold">
                      {getGuardInitials(guard.name)}
                    </div>
                    <span className={`${theme.textSecondary} text-xs sm:text-sm`}>{guard.name}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-center gap-2 sm:gap-4 mb-4 sm:mb-8">
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    className={`w-11 h-11 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl border-2 flex items-center justify-center text-xl sm:text-2xl font-bold transition-all ${
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
                <p className="text-center text-red-400 text-xs sm:text-sm mb-3 sm:mb-4">{message}</p>
              )}

              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((digit, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (digit === null) return
                      if (digit === 'del') handlePinDelete()
                      else handlePinChange(digit.toString())
                    }}
                    disabled={loading || digit === null}
                    className={`h-12 sm:h-16 rounded-lg sm:rounded-xl text-lg sm:text-xl font-semibold transition-all ${
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
                <div className="flex items-center justify-center gap-2 text-orange-400 mt-4 sm:mt-6">
                  <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  <span className="text-sm sm:text-base">Verificando...</span>
                </div>
              )}
            </motion.div>
          )}

          {/* Idle State - Single scan button (auto-detects entry/exit) */}
          {step === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 sm:p-8"
            >
              <div className="text-center mb-4 sm:mb-8">
                <h2 className={`text-xl sm:text-2xl font-bold ${theme.text} mb-1 sm:mb-2`}>
                  Control de Acceso
                </h2>
                <p className={`${theme.textMuted} text-sm sm:text-base`}>
                  Escanee el documento del visitante
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setStep('scan_id')}
                className="w-full flex items-center justify-center gap-3 py-4 sm:py-5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl sm:rounded-2xl font-bold transition-all shadow-lg shadow-orange-500/30"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="text-left">
                  <span className="text-base sm:text-lg block">Escanear Documento</span>
                  <span className="text-xs sm:text-sm font-normal opacity-80">
                    Detecta automáticamente entrada o salida
                  </span>
                </div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={openDailyLog}
                className="w-full flex items-center justify-center gap-3 py-4 sm:py-5 mt-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl sm:rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/30"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="text-left">
                  <span className="text-base sm:text-lg block">Registro del Día</span>
                  <span className="text-xs sm:text-sm font-normal opacity-80">
                    Ver quién está adentro ahora
                  </span>
                </div>
              </motion.button>
            </motion.div>
          )}

          {/* Scan ID State - Two Photo Capture */}
          {step === 'scan_id' && (
            <motion.div
              key="scan_id"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-3 sm:p-6"
            >
              <div className="text-center mb-3 sm:mb-4">
                <CreditCard className="w-8 h-8 sm:w-10 sm:h-10 text-orange-400 mx-auto mb-2" />
                <h2 className={`text-lg sm:text-xl font-bold ${theme.text}`}>
                  Escanear Identificación
                </h2>
                <p className={`${theme.textMuted} text-xs sm:text-sm`}>
                  Capture el frente y opcionalmente el reverso
                </p>
              </div>

              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
              <canvas ref={canvasRef} className="hidden" />
              <canvas ref={compressionCanvasRef} className="hidden" />

              {/* Camera Error Message */}
              {cameraError && (
                <div className={`mb-3 sm:mb-4 p-2 sm:p-3 rounded-lg sm:rounded-xl ${kioskTheme === 'dark' ? 'bg-red-500/20 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}>
                  <p className="text-red-400 text-xs sm:text-sm text-center">{cameraError}</p>
                </div>
              )}

              {/* Two Photo Slots */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Front Photo Slot */}
                <div className="text-center">
                  <p className={`text-xs font-medium ${theme.textSecondary} mb-2`}>
                    Frente *
                  </p>
                  {capturedImage ? (
                    <div className="relative">
                      <img
                        src={capturedImage}
                        alt="Frente del documento"
                        className="w-full aspect-[4/3] object-cover rounded-xl border-2 border-green-500"
                      />
                      <button
                        onClick={() => setCapturedImage(null)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className={`flex flex-col items-center justify-center aspect-[4/3] rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                      kioskTheme === 'dark'
                        ? 'border-stone-600 hover:border-orange-500 bg-stone-800/30'
                        : 'border-stone-300 hover:border-orange-400 bg-stone-50'
                    }`}>
                      <Camera className={`w-8 h-8 mb-1 ${theme.textMuted}`} />
                      <span className={`text-xs ${theme.textMuted}`}>Tomar foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = async (ev) => {
                            const imageData = ev.target?.result as string
                            if (imageData) {
                              try {
                                const compressed = await compressImage(imageData)
                                setCapturedImage(compressed)
                              } catch {
                                setCapturedImage(imageData)
                              }
                            }
                          }
                          reader.readAsDataURL(file)
                          e.target.value = ''
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Reverse Photo Slot */}
                <div className="text-center">
                  <p className={`text-xs font-medium ${theme.textSecondary} mb-2`}>
                    Reverso <span className={theme.textMuted}>(opcional)</span>
                  </p>
                  {capturedImageReverse ? (
                    <div className="relative">
                      <img
                        src={capturedImageReverse}
                        alt="Reverso del documento"
                        className="w-full aspect-[4/3] object-cover rounded-xl border-2 border-green-500"
                      />
                      <button
                        onClick={() => setCapturedImageReverse(null)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className={`flex flex-col items-center justify-center aspect-[4/3] rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                      kioskTheme === 'dark'
                        ? 'border-stone-600 hover:border-orange-500 bg-stone-800/30'
                        : 'border-stone-300 hover:border-orange-400 bg-stone-50'
                    }`}>
                      <Camera className={`w-8 h-8 mb-1 ${theme.textMuted}`} />
                      <span className={`text-xs ${theme.textMuted}`}>Tomar foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = async (ev) => {
                            const imageData = ev.target?.result as string
                            if (imageData) {
                              try {
                                const compressed = await compressImage(imageData)
                                setCapturedImageReverse(compressed)
                              } catch {
                                setCapturedImageReverse(imageData)
                              }
                            }
                          }
                          reader.readAsDataURL(file)
                          e.target.value = ''
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Process Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={async () => {
                  if (!capturedImage) return
                  // Process front image with OCR
                  await processIdDocument(capturedImage, false)
                }}
                disabled={!capturedImage || loading}
                className="w-full flex items-center justify-center gap-2 sm:gap-3 py-3 sm:py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mb-3"
              >
                {loading ? (
                  <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                ) : (
                  <Check className="w-5 h-5 sm:w-6 sm:h-6" />
                )}
                Procesar Documento
              </motion.button>

              <button
                onClick={resetToIdle}
                className={`w-full py-2.5 sm:py-3 ${theme.textMuted} hover:text-orange-400 transition-colors text-sm sm:text-base`}
              >
                Cancelar
              </button>
            </motion.div>
          )}

          {/* Scan ID Reverse (for Cuban cedula) */}
          {step === 'scan_id_reverse' && (
            <motion.div
              key="scan_id_reverse"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-3 sm:p-6"
            >
              <div className="text-center mb-3 sm:mb-4">
                <CreditCard className="w-8 h-8 sm:w-10 sm:h-10 text-orange-400 mx-auto mb-2" />
                <h2 className={`text-lg sm:text-xl font-bold ${theme.text}`}>
                  Reverso del Carnet
                </h2>
                <p className={`${theme.textMuted} text-xs sm:text-sm`}>
                  Tome una foto del reverso para capturar la dirección
                </p>
              </div>

              {/* Show captured front image */}
              {capturedImage && (
                <div className="mb-3 sm:mb-4">
                  <p className={`text-xs ${theme.textMuted} mb-1`}>Frente capturado:</p>
                  <img
                    src={capturedImage}
                    alt="Frente del documento"
                    className="w-24 h-auto rounded-lg border-2 border-green-500/30 mx-auto"
                  />
                </div>
              )}

              {/* Hidden file input for reverse photo */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  stopCamera()
                  setLoading(true)
                  const reader = new FileReader()
                  reader.onload = async (ev) => {
                    const imageData = ev.target?.result as string
                    if (imageData) {
                      try {
                        const compressedImage = await compressImage(imageData)
                        setCapturedImageReverse(compressedImage)
                        await processIdDocument(compressedImage, true)
                      } catch (err) {
                        setCapturedImageReverse(imageData)
                        await processIdDocument(imageData, true)
                      }
                    }
                  }
                  reader.readAsDataURL(file)
                  e.target.value = ''
                }}
                className="hidden"
              />

              {/* Action buttons */}
              <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={openNativeCamera}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 sm:gap-3 py-3 sm:py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg transition-all shadow-lg disabled:opacity-50"
                >
                  <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
                  Tomar Foto del Reverso
                </motion.button>

                {/* Skip reverse photo */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={async () => {
                    // Continue without reverse photo
                    if (scannedData && capturedImage) {
                      setLoading(true)
                      await checkOrRegisterVisitor(scannedData, capturedImage, null)
                      setLoading(false)
                    }
                  }}
                  disabled={loading}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 ${theme.cancelBtn} rounded-lg sm:rounded-xl font-medium text-sm sm:text-base transition-colors`}
                >
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                  Continuar sin reverso
                </motion.button>
              </div>

              <button
                onClick={resetToIdle}
                className={`w-full py-2.5 sm:py-3 ${theme.textMuted} hover:text-orange-400 transition-colors text-sm sm:text-base`}
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
              className="p-6 sm:p-8 text-center"
            >
              <RefreshCw className="w-12 h-12 sm:w-16 sm:h-16 text-orange-400 mx-auto mb-4 sm:mb-6 animate-spin" />
              <h2 className={`text-lg sm:text-xl font-bold ${theme.text} mb-2`}>
                Analizando Documento
              </h2>
              <p className={`${theme.textMuted} text-sm sm:text-base`}>
                Por favor espere...
              </p>
            </motion.div>
          )}

          {/* Verify Data - Compact horizontal layout, no scroll */}
          {step === 'verify_data' && (
            <motion.div
              key="verify_data"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-3 sm:p-5"
            >
              {/* Compact Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow ${
                    isExistingVisitor
                      ? 'bg-gradient-to-br from-green-400 to-green-600'
                      : 'bg-gradient-to-br from-orange-400 to-orange-600'
                  }`}>
                    {isExistingVisitor
                      ? <CheckCircle className="w-4 h-4 text-white" />
                      : <User className="w-4 h-4 text-white" />
                    }
                  </div>
                  <div>
                    <h2 className={`text-base sm:text-lg font-bold ${theme.text} leading-tight`}>
                      {isExistingVisitor ? 'Visitante Registrado' : 'Verificar Datos'}
                    </h2>
                    <p className={`${theme.textMuted} text-[10px] sm:text-xs`}>
                      {isExistingVisitor ? 'Ya está en el sistema' : 'Revise y confirme la información'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={resetToIdle}
                  className={`p-1.5 rounded-lg ${theme.textMuted} hover:text-orange-400 transition-colors`}
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              {/* Photos side by side - compact thumbnails */}
              <div className={`flex gap-2 mb-3 p-2 rounded-xl ${
                kioskTheme === 'dark' ? 'bg-stone-800/40' : 'bg-stone-100'
              }`}>
                {capturedImage && (
                  <div className="flex-1 min-w-0">
                    <p className={`text-[10px] font-medium ${theme.textMuted} mb-1 uppercase tracking-wider`}>Frente</p>
                    <img
                      src={capturedImage}
                      alt="Frente"
                      className={`w-full h-24 sm:h-32 lg:h-40 object-cover rounded-lg border ${kioskTheme === 'dark' ? 'border-stone-600' : 'border-stone-300'}`}
                    />
                  </div>
                )}
                {capturedImageReverse && (
                  <div className="flex-1 min-w-0">
                    <p className={`text-[10px] font-medium ${theme.textMuted} mb-1 uppercase tracking-wider`}>Reverso</p>
                    <img
                      src={capturedImageReverse}
                      alt="Reverso"
                      className={`w-full h-24 sm:h-32 lg:h-40 object-cover rounded-lg border ${kioskTheme === 'dark' ? 'border-stone-600' : 'border-stone-300'}`}
                    />
                  </div>
                )}
              </div>

              {/* Form fields - all inline/compact */}
              <div className="space-y-2 mb-3">
                {/* Row 1: Name + ID Number */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block text-[10px] sm:text-xs font-medium ${theme.textSecondary} mb-0.5`}>Nombre completo</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      disabled={isExistingVisitor}
                      className={`w-full px-2.5 py-2 rounded-lg border text-sm transition-all focus:outline-none focus:border-orange-500 ${
                        kioskTheme === 'dark'
                          ? 'bg-stone-800 border-stone-600 text-white'
                          : 'bg-white border-stone-300 text-stone-900'
                      } ${isExistingVisitor ? 'opacity-70' : ''}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] sm:text-xs font-medium ${theme.textSecondary} mb-0.5`}>Numero de ID</label>
                    <input
                      type="text"
                      value={formIdNumber}
                      onChange={(e) => setFormIdNumber(e.target.value)}
                      disabled={isExistingVisitor}
                      className={`w-full px-2.5 py-2 rounded-lg border text-sm font-mono transition-all focus:outline-none focus:border-orange-500 ${
                        kioskTheme === 'dark'
                          ? 'bg-stone-800 border-stone-600 text-white'
                          : 'bg-white border-stone-300 text-stone-900'
                      } ${isExistingVisitor ? 'opacity-70' : ''}`}
                    />
                  </div>
                </div>

                {/* Row 2: Document Type + Address */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block text-[10px] sm:text-xs font-medium ${theme.textSecondary} mb-0.5`}>Tipo de documento</label>
                    <select
                      value={formIdType}
                      onChange={(e) => setFormIdType(e.target.value)}
                      disabled={isExistingVisitor}
                      className={`w-full px-2.5 py-2 rounded-lg border text-sm transition-all focus:outline-none focus:border-orange-500 ${
                        kioskTheme === 'dark'
                          ? 'bg-stone-800 border-stone-600 text-white'
                          : 'bg-white border-stone-300 text-stone-900'
                      } ${isExistingVisitor ? 'opacity-70' : ''}`}
                    >
                      <option value="cedula" className={kioskTheme === 'dark' ? 'bg-stone-800 text-white' : ''}>Carnet de Identidad</option>
                      <option value="passport" className={kioskTheme === 'dark' ? 'bg-stone-800 text-white' : ''}>Pasaporte</option>
                      <option value="license" className={kioskTheme === 'dark' ? 'bg-stone-800 text-white' : ''}>Licencia</option>
                    </select>
                  </div>
                  {(formAddress || !isExistingVisitor) && (
                    <div>
                      <label className={`block text-[10px] sm:text-xs font-medium ${theme.textSecondary} mb-0.5`}>Direccion</label>
                      <input
                        type="text"
                        value={formAddress}
                        onChange={(e) => setFormAddress(e.target.value)}
                        disabled={isExistingVisitor}
                        placeholder="Opcional"
                        className={`w-full px-2.5 py-2 rounded-lg border text-sm transition-all focus:outline-none focus:border-orange-500 ${
                          kioskTheme === 'dark'
                            ? 'bg-stone-800 border-stone-600 text-white placeholder-stone-500'
                            : 'bg-white border-stone-300 text-stone-900 placeholder-stone-400'
                        } ${isExistingVisitor ? 'opacity-70' : ''}`}
                      />
                    </div>
                  )}
                </div>

                {/* Existing visitor stats - inline */}
                {isExistingVisitor && visitor && (
                  <div className={`px-3 py-2 rounded-lg flex items-center gap-2 ${
                    kioskTheme === 'dark' ? 'bg-green-900/20 border border-green-700' : 'bg-green-50 border border-green-200'
                  }`}>
                    <User className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <p className="text-xs text-green-500 font-medium">
                      Ha visitado <span className="font-bold">{visitor.totalVisits}</span> {visitor.totalVisits === 1 ? 'vez' : 'veces'}
                    </p>
                    {visitor.isCurrentlyInside && (
                      <p className="text-xs text-amber-500 ml-2">
                        Actualmente adentro
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons - horizontal */}
              <div className="flex gap-2">
                <button
                  onClick={resetToIdle}
                  className={`px-4 py-2.5 ${theme.cancelBtn} rounded-xl font-medium text-sm transition-colors`}
                >
                  Cancelar
                </button>

                {isExistingVisitor ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      if (visitor?.isCurrentlyInside) {
                        setActiveLogId(visitor.activeLogId)
                        checkPendingSales(visitor.activeLogId!)
                      } else {
                        setStep('visitor_info')
                      }
                    }}
                    disabled={loading}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 ${
                      visitor?.isCurrentlyInside
                        ? 'bg-gradient-to-r from-orange-500 to-orange-600'
                        : 'bg-gradient-to-r from-green-500 to-green-600'
                    } text-white rounded-xl font-bold text-sm sm:text-base transition-all shadow-lg`}
                  >
                    {visitor?.isCurrentlyInside ? (
                      <>
                        <LogOut className="w-5 h-5" />
                        Registrar Salida
                      </>
                    ) : (
                      <>
                        <LogIn className="w-5 h-5" />
                        Registrar Entrada
                      </>
                    )}
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={async () => {
                      if (!formName.trim() || !formIdNumber.trim()) {
                        setMessage('Nombre y número de ID son requeridos')
                        return
                      }
                      setLoading(true)
                      try {
                        const visitorData: ScannedIdData = {
                          fullName: formName.trim(),
                          documentType: formIdType,
                          documentNumber: formIdNumber.trim(),
                          dateOfBirth: formDateOfBirth || null,
                          address: formAddress || null,
                          gender: formGender || null,
                          confidence: scannedData?.confidence || 0.5
                        }
                        await checkOrRegisterVisitor(visitorData, capturedImage || '', capturedImageReverse)
                      } catch (error) {
                        console.error('Error registering:', error)
                        setMessage('Error al registrar')
                        setStep('error')
                      } finally {
                        setLoading(false)
                      }
                    }}
                    disabled={!formName.trim() || !formIdNumber.trim() || loading}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-bold text-sm sm:text-base transition-all shadow-lg disabled:opacity-50"
                  >
                    {loading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Check className="w-5 h-5" />
                    )}
                    Confirmar y Registrar
                  </motion.button>
                )}
              </div>

              {/* Error message */}
              {message && (
                <p className="text-center text-red-400 text-xs mt-2">{message}</p>
              )}
            </motion.div>
          )}

          {/* Manual Registration Form */}
          {step === 'manual_register' && (
            <motion.div
              key="manual_register"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 sm:p-6"
            >
              <div className="text-center mb-4 sm:mb-6">
                <Edit3 className="w-8 h-8 sm:w-10 sm:h-10 text-orange-400 mx-auto mb-2" />
                <h2 className={`text-lg sm:text-xl font-bold ${theme.text}`}>
                  Registro Manual
                </h2>
                <p className={`${theme.textMuted} text-xs sm:text-sm`}>
                  No pudimos leer el documento. Complete los datos.
                </p>
              </div>

              {/* Show captured images as reference */}
              <div className="flex justify-center gap-3 mb-4">
                {capturedImage && (
                  <div className="text-center">
                    <p className={`text-xs ${theme.textMuted} mb-1`}>Frente</p>
                    <img
                      src={capturedImage}
                      alt="Frente del documento"
                      className="w-20 h-auto rounded-lg border-2 border-green-500/30"
                    />
                  </div>
                )}
                {capturedImageReverse ? (
                  <div className="text-center">
                    <p className={`text-xs ${theme.textMuted} mb-1`}>Reverso</p>
                    <img
                      src={capturedImageReverse}
                      alt="Reverso del documento"
                      className="w-20 h-auto rounded-lg border-2 border-green-500/30"
                    />
                  </div>
                ) : (
                  <div className="text-center">
                    <p className={`text-xs ${theme.textMuted} mb-1`}>Reverso</p>
                    <label className={`w-20 h-14 flex flex-col items-center justify-center rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                      kioskTheme === 'dark'
                        ? 'border-stone-600 hover:border-orange-500'
                        : 'border-stone-300 hover:border-orange-400'
                    }`}>
                      <Camera className={`w-4 h-4 ${theme.textMuted}`} />
                      <span className={`text-[10px] ${theme.textMuted}`}>Agregar</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = async (ev) => {
                            const imageData = ev.target?.result as string
                            if (imageData) {
                              try {
                                const compressedImage = await compressImage(imageData)
                                setCapturedImageReverse(compressedImage)
                              } catch {
                                setCapturedImageReverse(imageData)
                              }
                            }
                          }
                          reader.readAsDataURL(file)
                          e.target.value = ''
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Name field - Required */}
              <div className="mb-3 sm:mb-4">
                <label className={`block text-xs sm:text-sm font-medium ${theme.textSecondary} mb-1 sm:mb-2`}>
                  Nombre completo *
                </label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Ej: Juan Pérez García"
                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border-2 text-sm sm:text-base transition-all focus:outline-none focus:border-orange-500 ${
                    kioskTheme === 'dark'
                      ? 'bg-stone-800 border-stone-600 text-white placeholder-stone-500'
                      : 'bg-stone-50 border-stone-300 text-stone-900 placeholder-stone-400'
                  }`}
                  autoFocus
                />
              </div>

              {/* ID Number field - Required */}
              <div className="mb-3 sm:mb-4">
                <label className={`block text-xs sm:text-sm font-medium ${theme.textSecondary} mb-1 sm:mb-2`}>
                  Número de identificación *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={manualIdNumber}
                  onChange={(e) => setManualIdNumber(e.target.value)}
                  placeholder="Ej: 12345678"
                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border-2 text-sm sm:text-base transition-all focus:outline-none focus:border-orange-500 ${
                    kioskTheme === 'dark'
                      ? 'bg-stone-800 border-stone-600 text-white placeholder-stone-500'
                      : 'bg-stone-50 border-stone-300 text-stone-900 placeholder-stone-400'
                  }`}
                />
              </div>

              {/* Document type selector */}
              <div className="mb-4 sm:mb-6">
                <label className={`block text-xs sm:text-sm font-medium ${theme.textSecondary} mb-1 sm:mb-2`}>
                  Tipo de documento
                </label>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {DOCUMENT_TYPES.map(docType => (
                    <button
                      key={docType.id}
                      onClick={() => setManualIdType(docType.id)}
                      className={`flex flex-col items-center gap-1 p-2 sm:p-3 rounded-lg sm:rounded-xl border-2 transition-all ${
                        manualIdType === docType.id
                          ? theme.purposeBtnActive
                          : theme.purposeBtn
                      }`}
                    >
                      <docType.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="text-[10px] sm:text-xs font-medium">{docType.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Error message */}
              {message && (
                <p className="text-center text-red-400 text-xs sm:text-sm mb-3">{message}</p>
              )}

              {/* Submit button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={submitManualRegistration}
                disabled={!manualName.trim() || !manualIdNumber.trim() || loading}
                className="w-full flex items-center justify-center gap-2 sm:gap-3 py-3 sm:py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                ) : (
                  <Check className="w-5 h-5 sm:w-6 sm:h-6" />
                )}
                Registrar Visitante
              </motion.button>

              <button
                onClick={resetToIdle}
                className={`w-full py-2.5 sm:py-3 mt-2 sm:mt-3 ${theme.textMuted} hover:text-orange-400 transition-colors text-sm sm:text-base`}
              >
                Cancelar
              </button>
            </motion.div>
          )}

          {/* Visitor Info - Entry Flow */}
          {step === 'visitor_info' && visitor && (
            <motion.div
              key="visitor_info"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 sm:p-6"
            >
              <div className="text-center mb-4 sm:mb-6">
                <div className="w-14 h-14 sm:w-20 sm:h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg">
                  <User className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
                </div>
                <h2 className={`text-lg sm:text-2xl font-bold ${theme.text}`}>
                  {visitor.fullName}
                </h2>
                <p className={`${theme.textMuted} text-xs sm:text-base`}>
                  {ID_TYPE_LABELS[visitor.idType || ''] || visitor.idType || 'Documento'}: {visitor.idNumber}
                </p>
                {visitor.totalVisits > 1 && (
                  <span className="inline-block mt-2 px-2 sm:px-3 py-0.5 sm:py-1 bg-orange-500/20 text-orange-400 rounded-full text-xs sm:text-sm">
                    Visita #{visitor.totalVisits}
                  </span>
                )}
              </div>

              <div className="mb-4 sm:mb-6 space-y-3">
                <p className={`text-xs sm:text-sm font-medium ${theme.textSecondary}`}>
                  Motivo de la visita:
                </p>
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  {VISIT_PURPOSES.map(purpose => (
                    <button
                      key={purpose.id}
                      onClick={() => {
                        setSelectedPurpose(purpose.id)
                        setSelectedEmployee(null)
                        // Load employees when "reunion" is selected
                        if (purpose.id === 'reunion') {
                          fetchEmployees()
                        }
                      }}
                      className={`flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3 rounded-lg sm:rounded-xl border-2 transition-all ${
                        selectedPurpose === purpose.id
                          ? theme.purposeBtnActive
                          : theme.purposeBtn
                      }`}
                    >
                      <purpose.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="font-medium text-sm sm:text-base">{purpose.label}</span>
                    </button>
                  ))}
                </div>

                {/* Employee selector for "reunion" */}
                {selectedPurpose === 'reunion' && (
                  <div>
                    <label className={`block text-xs font-medium ${theme.textSecondary} mb-1`}>
                      Reunión con:
                    </label>
                    <input
                      type="text"
                      value={employeeSearch}
                      onChange={(e) => {
                        setEmployeeSearch(e.target.value)
                        fetchEmployees(e.target.value)
                      }}
                      placeholder="Buscar empleado..."
                      className={`w-full px-3 py-2 rounded-lg border text-sm transition-all focus:outline-none focus:border-orange-500 ${
                        kioskTheme === 'dark'
                          ? 'bg-stone-800 border-stone-600 text-white placeholder-stone-500'
                          : 'bg-white border-stone-300 text-stone-900 placeholder-stone-400'
                      }`}
                    />
                    {selectedEmployee && (
                      <div className={`mt-1.5 px-3 py-2 rounded-lg flex items-center justify-between ${
                        kioskTheme === 'dark' ? 'bg-orange-500/20 border border-orange-500/50' : 'bg-orange-50 border border-orange-200'
                      }`}>
                        <div>
                          <p className="text-sm font-medium text-orange-500">{selectedEmployee.fullName}</p>
                          {selectedEmployee.department && (
                            <p className={`text-xs ${theme.textMuted}`}>{selectedEmployee.department}</p>
                          )}
                        </div>
                        <button onClick={() => setSelectedEmployee(null)} className="text-orange-400 hover:text-orange-300">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {!selectedEmployee && employees.length > 0 && (
                      <div className={`mt-1.5 max-h-32 overflow-y-auto rounded-lg border ${
                        kioskTheme === 'dark' ? 'bg-stone-800 border-stone-600' : 'bg-white border-stone-300'
                      }`}>
                        {loadingEmployees ? (
                          <div className="p-3 text-center">
                            <RefreshCw className={`w-4 h-4 animate-spin mx-auto ${theme.textMuted}`} />
                          </div>
                        ) : (
                          employees.map(emp => (
                            <button
                              key={emp.id}
                              onClick={() => {
                                setSelectedEmployee(emp)
                                setEmployeeSearch('')
                              }}
                              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                kioskTheme === 'dark'
                                  ? 'hover:bg-stone-700 text-white'
                                  : 'hover:bg-stone-100 text-stone-900'
                              }`}
                            >
                              <span className="font-medium">{emp.fullName}</span>
                              {emp.department && (
                                <span className={`ml-2 text-xs ${theme.textMuted}`}>{emp.department}</span>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Notes field - mandatory for all purposes */}
                {selectedPurpose && (
                  <div>
                    <label className={`block text-xs font-medium ${theme.textSecondary} mb-1`}>
                      Nota / Motivo *
                    </label>
                    <textarea
                      value={purposeNotes}
                      onChange={(e) => setPurposeNotes(e.target.value)}
                      placeholder="Describa el motivo de la visita..."
                      rows={2}
                      className={`w-full px-3 py-2 rounded-lg border-2 text-sm transition-all focus:outline-none focus:border-orange-500 resize-none ${
                        kioskTheme === 'dark'
                          ? 'bg-stone-800 border-stone-600 text-white placeholder-stone-500'
                          : 'bg-stone-50 border-stone-300 text-stone-900 placeholder-stone-400'
                      }`}
                    />
                  </div>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  const notes = selectedPurpose === 'reunion' && selectedEmployee
                    ? `Reunión con: ${selectedEmployee.fullName}${selectedEmployee.department ? ` (${selectedEmployee.department})` : ''}. ${purposeNotes}`
                    : purposeNotes
                  registerEntry(selectedPurpose, notes)
                }}
                disabled={!selectedPurpose || loading || !purposeNotes.trim() || (selectedPurpose === 'reunion' && !selectedEmployee)}
                className="w-full flex items-center justify-center gap-2 sm:gap-3 py-3 sm:py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                ) : (
                  <LogIn className="w-5 h-5 sm:w-6 sm:h-6" />
                )}
                Confirmar Entrada
              </motion.button>

              <button
                onClick={resetToIdle}
                className={`w-full py-2.5 sm:py-3 mt-2 sm:mt-3 ${theme.textMuted} hover:text-orange-400 transition-colors text-sm sm:text-base`}
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
              className="p-4 sm:p-6"
            >
              <div className="text-center mb-3 sm:mb-4">
                <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-400 mx-auto mb-2" />
                <h2 className={`text-lg sm:text-xl font-bold ${theme.text}`}>
                  Validar Compras
                </h2>
                <p className={`${theme.textMuted} text-xs sm:text-sm`}>
                  Compras pendientes de validación
                </p>
              </div>

              <div className="space-y-2 sm:space-y-3 max-h-48 sm:max-h-64 overflow-y-auto mb-3 sm:mb-4">
                {pendingSales.map(sale => {
                  const saleKey = `${sale.type}-${sale.id}`
                  const isValidated = validatedSales.has(saleKey)

                  return (
                    <div
                      key={saleKey}
                      className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all ${
                        isValidated
                          ? theme.saleCardValidated
                          : theme.saleCard
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`font-medium text-sm sm:text-base ${theme.text}`}>
                            {sale.type === 'pos_receipt' ? 'Ticket POS' : 'Factura'}
                          </p>
                          <p className={`text-xs sm:text-sm ${theme.textMuted} truncate`}>
                            #{sale.documentNumber}
                          </p>
                          <p className="text-base sm:text-lg font-bold text-orange-400 mt-0.5 sm:mt-1">
                            {sale.currency} {sale.total.toFixed(2)}
                          </p>
                        </div>
                        {isValidated ? (
                          <div className="flex items-center gap-1 text-green-400 flex-shrink-0">
                            <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="text-xs sm:text-sm">OK</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => validateSale(sale)}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-xs sm:text-sm font-medium transition-colors flex-shrink-0"
                          >
                            Validar
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={resetToIdle}
                  className={`flex-1 py-2.5 sm:py-3 ${theme.cancelBtn} rounded-lg sm:rounded-xl font-medium text-sm sm:text-base transition-colors`}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => activeLogId && registerExit(activeLogId)}
                  disabled={pendingSales.some(s => !validatedSales.has(`${s.type}-${s.id}`))}
                  className="flex-1 py-2.5 sm:py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg sm:rounded-xl font-medium text-sm sm:text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="p-6 sm:p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', bounce: 0.5 }}
                className="w-16 h-16 sm:w-24 sm:h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg shadow-green-500/30"
              >
                <CheckCircle className="w-10 h-10 sm:w-14 sm:h-14 text-white" />
              </motion.div>
              <h2 className={`text-xl sm:text-2xl font-bold ${theme.text} mb-2`}>
                Entrada Registrada
              </h2>
              <p className={`${theme.textSecondary} text-sm sm:text-base`}>{message}</p>
              <p className="text-xs sm:text-sm text-green-400 mt-3 sm:mt-4 font-medium">
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
              className="p-6 sm:p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', bounce: 0.5 }}
                className="w-16 h-16 sm:w-24 sm:h-24 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg shadow-orange-500/30"
              >
                <LogOut className="w-10 h-10 sm:w-14 sm:h-14 text-white" />
              </motion.div>
              <h2 className={`text-xl sm:text-2xl font-bold ${theme.text} mb-2`}>
                Salida Registrada
              </h2>
              <p className={`${theme.textSecondary} text-sm sm:text-base`}>{message}</p>
              <p className="text-xs sm:text-sm text-orange-400 mt-3 sm:mt-4 font-medium">
                Que tenga buen día
              </p>
            </motion.div>
          )}

          {/* Daily Log - Registro del Día */}
          {step === 'daily_log' && (
            <motion.div
              key="daily_log"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-3 sm:p-5"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <button
                  onClick={() => setStep('idle')}
                  className={`flex items-center gap-1.5 text-sm font-medium ${theme.textSecondary} hover:${theme.text} transition-colors`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver
                </button>
                <button
                  onClick={fetchDailyLog}
                  disabled={loadingDailyLog}
                  className={`flex items-center gap-1.5 text-sm font-medium text-orange-400 hover:text-orange-300 transition-colors ${loadingDailyLog ? 'animate-spin' : ''}`}
                >
                  <RefreshCw className={`w-4 h-4 ${loadingDailyLog ? 'animate-spin' : ''}`} />
                  Actualizar
                </button>
              </div>

              <h2 className={`text-lg sm:text-xl font-bold ${theme.text} mb-1`}>
                <ClipboardList className="w-5 h-5 inline-block mr-2 text-orange-400" />
                Registro del Día
              </h2>
              <p className={`text-xs sm:text-sm ${theme.textSecondary} mb-3`}>
                {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>

              {/* Summary cards */}
              {(() => {
                const inside = dailyLogs.filter(l => l.status === 'active')
                const exited = dailyLogs.filter(l => l.status === 'completed')
                return (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className={`${kioskTheme === 'dark' ? 'bg-stone-800/80' : 'bg-stone-100'} rounded-xl p-2 sm:p-3 text-center`}>
                      <p className="text-lg sm:text-2xl font-bold text-orange-400">{dailyLogs.length}</p>
                      <p className={`text-[10px] sm:text-xs ${theme.textSecondary}`}>Total</p>
                    </div>
                    <div className={`${kioskTheme === 'dark' ? 'bg-green-900/30' : 'bg-green-50'} rounded-xl p-2 sm:p-3 text-center`}>
                      <p className="text-lg sm:text-2xl font-bold text-green-400">{inside.length}</p>
                      <p className={`text-[10px] sm:text-xs ${theme.textSecondary}`}>Adentro</p>
                    </div>
                    <div className={`${kioskTheme === 'dark' ? 'bg-stone-800/80' : 'bg-stone-100'} rounded-xl p-2 sm:p-3 text-center`}>
                      <p className={`text-lg sm:text-2xl font-bold ${theme.textSecondary}`}>{exited.length}</p>
                      <p className={`text-[10px] sm:text-xs ${theme.textSecondary}`}>Salieron</p>
                    </div>
                  </div>
                )
              })()}

              {/* Log list */}
              {loadingDailyLog ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 text-orange-400 animate-spin" />
                </div>
              ) : dailyLogs.length === 0 ? (
                <div className="text-center py-8">
                  <ClipboardList className={`w-10 h-10 ${theme.textMuted} mx-auto mb-2`} />
                  <p className={`${theme.textSecondary} text-sm`}>No hay registros hoy</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {/* People currently inside first */}
                  {dailyLogs
                    .sort((a, b) => {
                      // Active (inside) first, then by entry time desc
                      if (a.status === 'active' && b.status !== 'active') return -1
                      if (a.status !== 'active' && b.status === 'active') return 1
                      return new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime()
                    })
                    .map(log => {
                      const isInside = log.status === 'active'
                      const entryDate = new Date(log.entryTime)
                      const exitDate = log.exitTime ? new Date(log.exitTime) : null

                      // Calculate time inside (for active: elapsed, for completed: duration)
                      let timeInside = ''
                      const endTime = isInside ? new Date() : exitDate
                      if (endTime) {
                        const diffMs = endTime.getTime() - entryDate.getTime()
                        const diffMins = Math.floor(diffMs / 60000)
                        const hours = Math.floor(diffMins / 60)
                        const mins = diffMins % 60
                        timeInside = hours > 0 ? `${hours} h ${mins} min` : `${mins} min`
                      }

                      return (
                        <div
                          key={log.id}
                          className={`rounded-xl p-2.5 sm:p-3 border transition-all ${
                            isInside
                              ? kioskTheme === 'dark'
                                ? 'bg-green-900/20 border-green-500/40'
                                : 'bg-green-50 border-green-300'
                              : kioskTheme === 'dark'
                                ? 'bg-stone-800/50 border-stone-700'
                                : 'bg-stone-50 border-stone-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {isInside && (
                                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                                )}
                                <p className={`text-sm font-semibold ${theme.text} truncate`}>
                                  {log.visitorName}
                                </p>
                              </div>
                              <p className={`text-[10px] sm:text-xs ${theme.textMuted} mt-0.5`}>
                                {log.visitorIdNumber}
                                {log.visitPurpose && ` · ${log.visitPurpose}`}
                              </p>
                              {log.visitNotes && (
                                <p className={`text-[10px] ${theme.textMuted} mt-0.5 truncate italic`}>
                                  {log.visitNotes}
                                </p>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              {isInside ? (
                                <div>
                                  <span className="text-xs font-bold text-green-400">
                                    Adentro
                                  </span>
                                  <p className="text-[10px] text-green-400/80 font-medium">
                                    <Clock className="w-3 h-3 inline mr-0.5" />
                                    {timeInside}
                                  </p>
                                </div>
                              ) : (
                                <div>
                                  <span className={`text-[10px] sm:text-xs ${theme.textMuted}`}>
                                    Salió
                                  </span>
                                  {timeInside && (
                                    <p className={`text-[10px] ${theme.textMuted} font-medium`}>
                                      <Clock className="w-3 h-3 inline mr-0.5" />
                                      {timeInside}
                                    </p>
                                  )}
                                </div>
                              )}
                              <p className={`text-[10px] ${theme.textMuted} mt-0.5`}>
                                {entryDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                {exitDate && (
                                  <> → {exitDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </motion.div>
          )}

          {/* Error State */}
          {step === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="p-6 sm:p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', bounce: 0.5 }}
                className={`w-16 h-16 sm:w-24 sm:h-24 ${kioskTheme === 'dark' ? 'bg-red-500/20' : 'bg-red-100'} rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6`}
              >
                <XCircle className="w-10 h-10 sm:w-14 sm:h-14 text-red-400" />
              </motion.div>
              <h2 className={`text-xl sm:text-2xl font-bold ${theme.text} mb-2`}>
                {isOcrError ? 'No se pudo leer el documento' : 'Error'}
              </h2>
              <p className={`${theme.textSecondary} text-sm sm:text-base mb-4 sm:mb-6`}>{message}</p>

              {/* OCR Error - Show retry and manual registration options */}
              {isOcrError && capturedImage ? (
                <div className="space-y-2 sm:space-y-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setStep('scan_id')}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 ${theme.cancelBtn} rounded-lg sm:rounded-xl font-medium text-sm sm:text-base transition-colors`}
                  >
                    <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
                    Tomar otra foto
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={goToManualRegister}
                    className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg sm:rounded-xl font-medium text-sm sm:text-base transition-all shadow-lg"
                  >
                    <Edit3 className="w-4 h-4 sm:w-5 sm:h-5" />
                    Registrar manualmente
                  </motion.button>
                  <button
                    onClick={resetToIdle}
                    className={`w-full py-2 ${theme.textMuted} hover:text-orange-400 transition-colors text-sm`}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={resetToIdle}
                  className={`px-5 sm:px-6 py-2 ${theme.cancelBtn} rounded-lg sm:rounded-xl font-medium text-sm sm:text-base transition-colors`}
                >
                  Intentar de nuevo
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-4 sm:mt-6 text-center"
      >
        <p className={`${theme.textMuted} text-xs sm:text-sm`}>
          {kiosk?.companyName}
        </p>
      </motion.div>
    </div>
  )
}
