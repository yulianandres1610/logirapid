'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lock,
  Shield,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import { useBarcodeScan } from '@/hooks/useBarcodeScan'
import { parseCubanIdQr, isCubanIdQr } from './utils/parse-cuban-id-qr'

import IdleScreen from './components/IdleScreen'
import ScanFeedback from './components/ScanFeedback'
import EntryConfirmation from './components/EntryConfirmation'
import PurposeQuickSelect from './components/PurposeQuickSelect'
import ExitFlow from './components/ExitFlow'

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

interface ScannedInvoice {
  documentNumber: string
  validated: boolean
}

interface KioskStats {
  visitorsInside: number
  totalVisitorsToday: number
}

type KioskStep =
  | 'loading'
  | 'guard_pin'
  | 'idle'
  | 'processing'
  | 'purpose_select'
  | 'entry_success'
  | 'exit_pending'
  | 'exit_success'
  | 'error'

const INACTIVITY_TIMEOUT = 300000 // 5 minutes
const GUARD_STORAGE_KEY = 'door-scanner-guard'

// Audio feedback using Web Audio API
function playBeep(success: boolean) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.frequency.value = success ? 880 : 330
    oscillator.type = success ? 'sine' : 'square'
    gain.gain.value = 0.3
    oscillator.start()
    oscillator.stop(ctx.currentTime + (success ? 0.15 : 0.3))
  } catch {
    // Audio not available
  }
}

function vibrate(pattern: number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Vibration not available
  }
}

// ---------------------------------------------------------------------------
// Inline PIN Pad component (no navigation, no kiosk selector)
// ---------------------------------------------------------------------------
function GuardPinPad({
  kioskId,
  kioskName,
  onAuthenticated,
}: {
  kioskId: string
  kioskName: string
  onAuthenticated: (guard: GuardInfo) => void
}) {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (pin.length >= 4 && !loading) {
      verifyPin()
    }
  }, [pin])

  const handlePinChange = (digit: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + digit)
      setError(null)
    }
  }

  const handlePinDelete = () => {
    setPin(prev => prev.slice(0, -1))
    setError(null)
  }

  const verifyPin = async () => {
    if (pin.length < 4) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/market/door-security/kiosks/${kioskId}/verify-guard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      })

      const result = await res.json()

      if (result.success) {
        const guardData: GuardInfo = result.data.guard || result.data
        // Persist in localStorage so PWA always remembers
        localStorage.setItem(GUARD_STORAGE_KEY, JSON.stringify({
          ...guardData,
          kioskId,
          savedAt: new Date().toISOString()
        }))
        onAuthenticated(guardData)
      } else {
        setError(result.error || 'PIN inválido')
        setPin('')
      }
    } catch {
      setError('Error de conexión')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-stone-800 via-stone-900 to-stone-800 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-3">
          <Shield className="w-7 h-7 text-orange-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">{kioskName}</h1>
        <p className="text-stone-400 text-sm">Ingresa el PIN de guardia</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6"
      >
        <div className="text-center mb-4">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Lock className="w-6 h-6 text-orange-500" />
          </div>
          <p className="text-xs text-gray-500">PIN de 4 dígitos</p>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-red-700 text-xs">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PIN Display */}
        <div className="flex justify-center gap-2 mb-4">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-11 h-11 rounded-lg border-2 flex items-center justify-center text-xl font-bold transition-all ${
                i < pin.length
                  ? 'border-orange-500 bg-orange-50 text-orange-600'
                  : 'border-gray-200'
              }`}
            >
              {i < pin.length ? '\u2022' : ''}
            </div>
          ))}
        </div>

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((digit, i) => (
            <button
              key={i}
              onClick={() => {
                if (digit === null) return
                if (digit === 'del') handlePinDelete()
                else handlePinChange(digit.toString())
              }}
              disabled={loading || digit === null}
              className={`h-12 rounded-lg text-lg font-bold transition-colors ${
                digit === null
                  ? 'invisible'
                  : digit === 'del'
                    ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    : 'bg-stone-100 text-stone-900 hover:bg-orange-100 active:scale-95'
              }`}
            >
              {digit === 'del' ? '\u232B' : digit}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-orange-600 py-3">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">Verificando...</span>
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main kiosk scanner page
// ---------------------------------------------------------------------------
export default function DoorKioskScannerPage() {
  const params = useParams()
  const kioskId = params.kioskId as string

  const [kiosk, setKiosk] = useState<KioskInfo | null>(null)
  const [guard, setGuard] = useState<GuardInfo | null>(null)
  const [step, setStep] = useState<KioskStep>('loading')
  const [visitor, setVisitor] = useState<VisitorInfo | null>(null)
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [stats, setStats] = useState<KioskStats | null>(null)
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([])
  const [scannedInvoices, setScannedInvoices] = useState<ScannedInvoice[]>([])
  const [selectedPurpose, setSelectedPurpose] = useState('')
  const [parsedName, setParsedName] = useState<string | null>(null)
  const [activeLogId, setActiveLogId] = useState<number | null>(null)
  const [entryTime, setEntryTime] = useState<string | null>(null)

  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)
  const qrBufferRef = useRef<string[]>([])
  const qrBufferTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Clock
  useEffect(() => {
    setCurrentTime(new Date())
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Load kiosk info + try to restore guard from localStorage/sessionStorage
  useEffect(() => {
    const loadKiosk = async () => {
      try {
        // Try localStorage first (PWA persistent), then sessionStorage (selector flow)
        let guardData = localStorage.getItem(GUARD_STORAGE_KEY)
        let guardObj: GuardInfo | null = null

        if (guardData) {
          try {
            const parsed = JSON.parse(guardData)
            // Verify guard is for this kiosk
            if (parsed.kioskId === kioskId || !parsed.kioskId) {
              guardObj = { id: parsed.id, name: parsed.name, code: parsed.code }
            }
          } catch { /* invalid JSON, ignore */ }
        }

        if (!guardObj) {
          const sessionData = sessionStorage.getItem('door-guard')
          if (sessionData) {
            try {
              guardObj = JSON.parse(sessionData)
            } catch { /* invalid JSON */ }
          }
        }

        // Fetch kiosk info
        const res = await fetch(`/api/market/door-security/kiosks/${kioskId}/public`)
        const result = await res.json()

        if (!result.success) {
          setStep('error')
          setErrorMessage(result.error || 'Kiosk no encontrado')
          return
        }

        setKiosk(result.data)

        if (guardObj) {
          setGuard(guardObj)
          setStep('idle')
          fetchStats()
        } else {
          // No guard found — show inline PIN pad
          setStep('guard_pin')
        }
      } catch {
        setStep('error')
        setErrorMessage('Error al cargar el kiosk')
      }
    }
    loadKiosk()
  }, [kioskId])

  // When guard is authenticated via PIN pad
  const handleGuardAuthenticated = useCallback((guardObj: GuardInfo) => {
    setGuard(guardObj)
    setStep('idle')
    fetchStats()
  }, [])

  // Inactivity → back to PIN (not redirect)
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    inactivityTimerRef.current = setTimeout(() => {
      // Clear session guard but keep localStorage (PWA stays persistent)
      sessionStorage.removeItem('door-guard')
      setGuard(null)
      setStep('guard_pin')
    }, INACTIVITY_TIMEOUT)
  }, [])

  useEffect(() => {
    if (step !== 'loading' && step !== 'guard_pin') {
      resetInactivityTimer()
      const events = ['touchstart', 'click', 'keydown']
      events.forEach(e => window.addEventListener(e, resetInactivityTimer))
      return () => {
        events.forEach(e => window.removeEventListener(e, resetInactivityTimer))
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
      }
    }
  }, [resetInactivityTimer, step])

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/market/door-security/kiosk-stats?kioskId=${kioskId}`)
      const result = await res.json()
      if (result.success) {
        setStats({
          visitorsInside: result.data.visitorsInside ?? 0,
          totalVisitorsToday: result.data.totalVisitorsToday ?? 0,
        })
      }
    } catch {
      // Stats not critical
    }
  }

  // Process a Cuban ID QR scan
  const processIdScan = useCallback(async (qrText: string) => {
    if (step !== 'idle' && step !== 'error') return

    const parsed = parseCubanIdQr(qrText)
    if (!parsed || !parsed.isValid) {
      playBeep(false)
      vibrate([100, 50, 100])
      setStep('error')
      setErrorMessage('QR no válido')
      setTimeout(() => setStep('idle'), 2000)
      return
    }

    playBeep(true)
    vibrate([50, 30, 50])
    setParsedName(parsed.fullName)
    setStep('processing')

    try {
      const res = await fetch('/api/market/door-security/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kioskId: parseInt(kioskId),
          guardId: guard?.id,
          fullName: parsed.fullName,
          idType: 'cedula',
          idNumber: parsed.idNumber,
          dateOfBirth: parsed.dateOfBirth || null,
        })
      })

      const result = await res.json()
      if (!result.success) {
        throw new Error(result.error || 'Error al registrar visitante')
      }

      const visitorData: VisitorInfo = result.data
      setVisitor(visitorData)

      if (visitorData.isCurrentlyInside) {
        setActiveLogId(visitorData.activeLogId)
        if (visitorData.activeLogId) {
          try {
            const salesRes = await fetch(`/api/market/door-security/logs/${visitorData.activeLogId}/pending-sales`)
            const salesResult = await salesRes.json()
            if (salesResult.success) {
              setPendingSales(salesResult.data || [])
              setEntryTime(salesResult.data?.entryTime || null)
            }
          } catch {
            setPendingSales([])
          }
        }
        setScannedInvoices([])
        setStep('exit_pending')
      } else {
        setStep('purpose_select')
      }
    } catch (err: any) {
      setStep('error')
      setErrorMessage(err.message || 'Error al procesar')
      setTimeout(() => setStep('idle'), 3000)
    }
  }, [step, kioskId, guard])

  // Process an invoice barcode scan (during exit)
  const processInvoiceScan = useCallback(async (barcode: string) => {
    if (step !== 'exit_pending') return
    if (!activeLogId) return
    if (scannedInvoices.some(s => s.documentNumber === barcode)) return

    playBeep(true)
    vibrate([50])

    try {
      const res = await fetch('/api/market/door-security/scan-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode, logId: activeLogId })
      })

      const result = await res.json()
      if (result.success) {
        setScannedInvoices(prev => [...prev, { documentNumber: barcode, validated: true }])
        await fetch('/api/market/door-security/validate-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ barcode, logId: activeLogId })
        })
      } else {
        setScannedInvoices(prev => [...prev, { documentNumber: barcode, validated: false }])
      }
    } catch {
      playBeep(false)
    }
  }, [step, activeLogId, scannedInvoices])

  // Handle barcode scan
  const handleScan = useCallback((scannedText: string) => {
    resetInactivityTimer()

    const isQrLine = /^(N:|A:|CI:|FV:)/i.test(scannedText.trim())

    if (isQrLine || qrBufferRef.current.length > 0) {
      qrBufferRef.current.push(scannedText.trim())
      if (qrBufferTimeoutRef.current) clearTimeout(qrBufferTimeoutRef.current)

      const combined = qrBufferRef.current.join('\n')
      if (isCubanIdQr(combined) && combined.includes('CI:')) {
        const hasFV = qrBufferRef.current.some(l => l.startsWith('FV:'))
        if (hasFV || qrBufferRef.current.length >= 4) {
          qrBufferRef.current = []
          processIdScan(combined)
          return
        }
      }

      qrBufferTimeoutRef.current = setTimeout(() => {
        const combined = qrBufferRef.current.join('\n')
        qrBufferRef.current = []
        if (isCubanIdQr(combined)) {
          processIdScan(combined)
        }
      }, 200)
      return
    }

    if (isCubanIdQr(scannedText)) {
      processIdScan(scannedText)
      return
    }

    if (step === 'exit_pending') {
      processInvoiceScan(scannedText)
    }
  }, [processIdScan, processInvoiceScan, step, resetInactivityTimer])

  // Barcode scanner - active when not loading/pin
  useBarcodeScan({
    onScan: handleScan,
    minLength: 2,
    maxTimeBetweenKeys: 150,
    enabled: step !== 'loading' && step !== 'guard_pin',
  })

  // Handle purpose selection → register entry
  const handlePurposeSelect = useCallback(async (purpose: string) => {
    if (!visitor || !guard) return

    setSelectedPurpose(purpose)
    setLoading(true)

    try {
      const res = await fetch('/api/market/door-security/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kioskId: parseInt(kioskId),
          guardId: guard.id,
          visitorId: visitor.id,
          action: 'entry',
          visitPurpose: purpose,
        })
      })

      const result = await res.json()
      if (result.success) {
        playBeep(true)
        vibrate([50, 30, 50])
        setStep('entry_success')
        fetchStats()
      } else {
        throw new Error(result.error)
      }
    } catch (err: any) {
      setStep('error')
      setErrorMessage(err.message || 'Error al registrar entrada')
      setTimeout(() => setStep('idle'), 3000)
    } finally {
      setLoading(false)
    }
  }, [visitor, guard, kioskId])

  // Handle exit confirmation
  const handleConfirmExit = useCallback(async () => {
    if (!visitor || !guard || !activeLogId) return

    setLoading(true)

    try {
      const res = await fetch('/api/market/door-security/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kioskId: parseInt(kioskId),
          guardId: guard.id,
          visitorId: visitor.id,
          action: 'exit',
          logId: activeLogId,
        })
      })

      const result = await res.json()
      if (result.success) {
        playBeep(true)
        vibrate([50, 30, 50])
        setStep('exit_success')
        fetchStats()
        setTimeout(() => resetToIdle(), 3000)
      } else {
        throw new Error(result.error)
      }
    } catch (err: any) {
      setStep('error')
      setErrorMessage(err.message || 'Error al registrar salida')
      setTimeout(() => setStep('idle'), 3000)
    } finally {
      setLoading(false)
    }
  }, [visitor, guard, kioskId, activeLogId])

  const resetToIdle = useCallback(() => {
    setVisitor(null)
    setParsedName(null)
    setActiveLogId(null)
    setPendingSales([])
    setScannedInvoices([])
    setSelectedPurpose('')
    setEntryTime(null)
    setErrorMessage('')
    setStep('idle')
  }, [])

  // Loading state
  if (step === 'loading') {
    return (
      <div className="min-h-[100dvh] bg-stone-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-stone-400">Cargando kiosk...</p>
        </div>
      </div>
    )
  }

  // Guard PIN step — inline, no navigation
  if (step === 'guard_pin') {
    return (
      <GuardPinPad
        kioskId={kioskId}
        kioskName={kiosk?.name || 'Control de Acceso'}
        onAuthenticated={handleGuardAuthenticated}
      />
    )
  }

  return (
    <div className="min-h-[100dvh] bg-stone-900">
      <AnimatePresence mode="wait">
        {(step === 'idle' || step === 'error') && (
          <div key="idle">
            <IdleScreen
              kioskName={kiosk?.name || 'Kiosk'}
              guardName={guard?.name || ''}
              currentTime={currentTime}
              stats={stats}
            />
            {step === 'error' && errorMessage && (
              <ScanFeedback
                visitorName={null}
                isError
                errorMessage={errorMessage}
              />
            )}
          </div>
        )}

        {step === 'processing' && (
          <ScanFeedback key="processing" visitorName={parsedName} />
        )}

        {step === 'purpose_select' && visitor && (
          <PurposeQuickSelect
            key="purpose"
            visitorName={visitor.fullName}
            onSelect={handlePurposeSelect}
            loading={loading}
          />
        )}

        {step === 'entry_success' && visitor && (
          <EntryConfirmation
            key="entry"
            visitorName={visitor.fullName}
            idNumber={visitor.idNumber}
            purpose={selectedPurpose}
            onComplete={resetToIdle}
          />
        )}

        {step === 'exit_pending' && visitor && (
          <ExitFlow
            key="exit"
            visitorName={visitor.fullName}
            idNumber={visitor.idNumber}
            entryTime={entryTime}
            pendingSales={pendingSales}
            scannedInvoices={scannedInvoices}
            scanningInvoice={false}
            onConfirmExit={handleConfirmExit}
            onExitWithoutValidation={handleConfirmExit}
            loading={loading}
          />
        )}

        {step === 'exit_success' && visitor && (
          <EntryConfirmation
            key="exit-success"
            visitorName={visitor.fullName}
            idNumber={visitor.idNumber}
            purpose="Salida registrada"
            onComplete={resetToIdle}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
