'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lock,
  Shield,
  RefreshCw,
  AlertCircle,
  Download
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
// PWA Install prompt hook
// ---------------------------------------------------------------------------
function useInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Detect when app gets installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setInstallPrompt(null)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const promptInstall = async () => {
    if (!installPrompt) return false
    installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') {
      setIsInstalled(true)
      setInstallPrompt(null)
    }
    return result.outcome === 'accepted'
  }

  return { canInstall: !!installPrompt && !isInstalled, isInstalled, promptInstall }
}

// ---------------------------------------------------------------------------
// Inline PIN Pad — optimized for Zebra TC21K (360×640 CSS viewport)
// Each guard must authenticate every session.
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
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt()

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
    <div className="h-[100dvh] bg-orange-50 flex flex-col items-center justify-center px-4 py-3 overflow-hidden">
      {/* Install banner — shown at top when available */}
      {canInstall && (
        <motion.button
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={promptInstall}
          className="mb-3 flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-xl shadow-lg shadow-orange-600/30 transition-colors w-full max-w-[320px]"
        >
          <Download className="w-5 h-5 flex-shrink-0" />
          <div className="text-left flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">Instalar App</p>
            <p className="text-[10px] text-orange-100 leading-tight">Acceso directo a esta puerta</p>
          </div>
        </motion.button>
      )}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-3"
      >
        <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center mx-auto mb-2">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 leading-tight">{kioskName}</h1>
        <p className="text-gray-500 text-xs mt-0.5">Ingresa tu PIN de guardia</p>
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl border border-orange-100 w-full max-w-[320px] overflow-hidden px-5 py-4"
      >
        <div className="text-center mb-3">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-1.5">
            <Lock className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-[11px] text-gray-500">PIN de 4 dígitos</p>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-2 p-1.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-1.5"
            >
              <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
              <span className="text-red-700 text-[11px]">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-center gap-2.5 mb-3">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-lg font-bold transition-all ${
                i < pin.length
                  ? 'border-orange-500 bg-orange-50 text-orange-600'
                  : 'border-gray-300'
              }`}
            >
              {i < pin.length ? '\u2022' : ''}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((digit, i) => (
            <button
              key={i}
              onClick={() => {
                if (digit === null) return
                if (digit === 'del') handlePinDelete()
                else handlePinChange(digit.toString())
              }}
              disabled={loading || digit === null}
              className={`h-11 rounded-lg text-base font-bold transition-colors ${
                digit === null
                  ? 'invisible'
                  : digit === 'del'
                    ? 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:bg-gray-300'
                    : 'bg-orange-50 text-gray-900 border border-orange-200 hover:bg-orange-100 active:bg-orange-200 active:scale-95'
              }`}
            >
              {digit === 'del' ? '\u232B' : digit}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-1.5 text-orange-600 pt-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span className="text-xs">Verificando...</span>
          </div>
        )}
      </motion.div>

      {isInstalled && (
        <p className="text-[10px] text-green-600 mt-2 font-medium">App instalada</p>
      )}
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
  const hiddenInputRef = useRef<HTMLInputElement | null>(null)

  // Clock
  useEffect(() => {
    setCurrentTime(new Date())
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Load kiosk info — always start at guard_pin (no persistent guard)
  useEffect(() => {
    const loadKiosk = async () => {
      try {
        const res = await fetch(`/api/market/door-security/kiosks/${kioskId}/public`)
        const result = await res.json()

        if (!result.success) {
          setStep('error')
          setErrorMessage(result.error || 'Kiosk no encontrado')
          return
        }

        setKiosk(result.data)
        setStep('guard_pin')
      } catch {
        setStep('error')
        setErrorMessage('Error al cargar el kiosk')
      }
    }
    loadKiosk()
  }, [kioskId])

  const handleGuardAuthenticated = useCallback((guardObj: GuardInfo) => {
    setGuard(guardObj)
    setStep('idle')
    fetchStats()
  }, [])

  // Inactivity → back to PIN
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    inactivityTimerRef.current = setTimeout(() => {
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

      const visitorData: VisitorInfo = result.data.visitor || result.data
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

  const handleScan = useCallback((scannedText: string) => {
    resetInactivityTimer()
    console.log('[DoorKioskScanner] Raw scan received:', JSON.stringify(scannedText), 'step:', step)

    // First check if the full text already contains a complete Cuban ID QR
    // (scanner may send everything at once with newlines embedded)
    if (isCubanIdQr(scannedText)) {
      console.log('[DoorKioskScanner] Complete QR detected in single scan')
      qrBufferRef.current = []
      if (qrBufferTimeoutRef.current) clearTimeout(qrBufferTimeoutRef.current)
      processIdScan(scannedText)
      return
    }

    const isQrLine = /^(N:|A:|CI:|FV:)/i.test(scannedText.trim())

    if (isQrLine || qrBufferRef.current.length > 0) {
      qrBufferRef.current.push(scannedText.trim())
      if (qrBufferTimeoutRef.current) clearTimeout(qrBufferTimeoutRef.current)
      console.log('[DoorKioskScanner] QR buffer:', qrBufferRef.current)

      const combined = qrBufferRef.current.join('\n')
      if (isCubanIdQr(combined) && combined.includes('CI:')) {
        const hasFV = qrBufferRef.current.some(l => l.startsWith('FV:'))
        if (hasFV || qrBufferRef.current.length >= 4) {
          console.log('[DoorKioskScanner] Complete QR from buffer')
          qrBufferRef.current = []
          processIdScan(combined)
          return
        }
      }

      // Increased timeout to 500ms — scanner may have delays between QR lines
      qrBufferTimeoutRef.current = setTimeout(() => {
        const combined = qrBufferRef.current.join('\n')
        console.log('[DoorKioskScanner] QR buffer timeout, combined:', JSON.stringify(combined))
        qrBufferRef.current = []
        if (isCubanIdQr(combined)) {
          processIdScan(combined)
        } else {
          console.log('[DoorKioskScanner] Buffer timeout - not a valid QR, discarding')
        }
      }, 500)
      return
    }

    if (step === 'exit_pending') {
      processInvoiceScan(scannedText)
    } else {
      console.log('[DoorKioskScanner] Unrecognized scan:', scannedText)
    }
  }, [processIdScan, processInvoiceScan, step, resetInactivityTimer])

  const scanEnabled = step !== 'loading' && step !== 'guard_pin'

  useBarcodeScan({
    onScan: handleScan,
    minLength: 2,
    maxTimeBetweenKeys: 150,
    enabled: scanEnabled,
  })

  // Keep hidden input focused so Zebra DataWedge keyboard emulation works
  // On Android WebView/Chrome, keydown events may not fire without a focused input
  useEffect(() => {
    if (!scanEnabled) return

    const keepFocus = () => {
      const active = document.activeElement
      const tag = active?.tagName.toLowerCase()
      // Don't steal focus from real inputs/buttons
      if (tag !== 'input' && tag !== 'textarea' && tag !== 'button') {
        hiddenInputRef.current?.focus()
      }
    }

    // Focus immediately and on touch/click on the background
    keepFocus()
    const interval = setInterval(keepFocus, 1000)
    window.addEventListener('touchend', keepFocus)
    window.addEventListener('click', keepFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener('touchend', keepFocus)
      window.removeEventListener('click', keepFocus)
    }
  }, [scanEnabled])

  // Handle paste events — some DataWedge configs paste instead of keystroke
  useEffect(() => {
    if (!scanEnabled) return

    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text')
      if (text && text.length >= 2) {
        console.log('[DoorKioskScanner] Paste detected:', JSON.stringify(text))
        e.preventDefault()
        handleScan(text)
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [scanEnabled, handleScan])

  // Handle input event on hidden field — fallback for Android IME
  const handleHiddenInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (!val) return

    // Check if this looks like a complete QR or barcode
    if (val.length >= 10 && (isCubanIdQr(val) || val.includes('N:') || val.includes('CI:'))) {
      console.log('[DoorKioskScanner] Hidden input captured QR:', JSON.stringify(val))
      e.target.value = ''
      handleScan(val)
    }
  }, [handleScan])

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

  if (step === 'loading') {
    return (
      <div className="h-[100dvh] bg-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Cargando...</p>
        </div>
      </div>
    )
  }

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
    <div className="h-[100dvh] bg-orange-50 overflow-hidden">
      {/* Hidden input to capture Zebra DataWedge scanner input on Android */}
      <input
        ref={hiddenInputRef}
        onChange={handleHiddenInput}
        className="fixed -top-10 -left-10 w-1 h-1 opacity-0 pointer-events-none"
        aria-hidden="true"
        autoComplete="off"
        tabIndex={-1}
        inputMode="none"
      />
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
