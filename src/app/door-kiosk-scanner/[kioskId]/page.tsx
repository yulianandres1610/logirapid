'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
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
  | 'idle'
  | 'processing'
  | 'purpose_select'
  | 'entry_success'
  | 'exit_pending'
  | 'exit_success'
  | 'error'

const INACTIVITY_TIMEOUT = 300000 // 5 minutes

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

export default function DoorKioskScannerPage() {
  const params = useParams()
  const router = useRouter()
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

  // Load kiosk info and guard from session
  useEffect(() => {
    const loadKiosk = async () => {
      try {
        const guardData = sessionStorage.getItem('door-guard')
        if (!guardData) {
          router.push('/door-kiosk-scanner')
          return
        }
        setGuard(JSON.parse(guardData))

        const res = await fetch(`/api/market/door-security/kiosks/${kioskId}/public`)
        const result = await res.json()
        if (result.success) {
          setKiosk(result.data)
          setStep('idle')
          fetchStats()
        } else {
          setStep('error')
          setErrorMessage('Kiosk no encontrado')
        }
      } catch {
        setStep('error')
        setErrorMessage('Error al cargar el kiosk')
      }
    }
    loadKiosk()
  }, [kioskId, router])

  // Inactivity lock
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    inactivityTimerRef.current = setTimeout(() => {
      sessionStorage.removeItem('door-guard')
      router.push('/door-kiosk-scanner')
    }, INACTIVITY_TIMEOUT)
  }, [router])

  useEffect(() => {
    resetInactivityTimer()
    const events = ['touchstart', 'click', 'keydown']
    events.forEach(e => window.addEventListener(e, resetInactivityTimer))
    return () => {
      events.forEach(e => window.removeEventListener(e, resetInactivityTimer))
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    }
  }, [resetInactivityTimer])

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
      // Register/find visitor
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
        // Exit flow
        setActiveLogId(visitorData.activeLogId)
        // Fetch pending sales
        if (visitorData.activeLogId) {
          try {
            const salesRes = await fetch(`/api/market/door-security/logs/${visitorData.activeLogId}/pending-sales`)
            const salesResult = await salesRes.json()
            if (salesResult.success) {
              setPendingSales(salesResult.data || [])
              // Try to get entry time from log
              setEntryTime(salesResult.data?.entryTime || null)
            }
          } catch {
            setPendingSales([])
          }
        }
        setScannedInvoices([])
        setStep('exit_pending')
      } else {
        // Entry flow → purpose select
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

    // Check if already scanned
    if (scannedInvoices.some(s => s.documentNumber === barcode)) return

    playBeep(true)
    vibrate([50])

    try {
      const res = await fetch('/api/market/door-security/scan-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode,
          logId: activeLogId,
        })
      })

      const result = await res.json()
      if (result.success) {
        setScannedInvoices(prev => [...prev, { documentNumber: barcode, validated: true }])

        // Validate the document
        await fetch('/api/market/door-security/validate-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            barcode,
            logId: activeLogId,
          })
        })
      } else {
        setScannedInvoices(prev => [...prev, { documentNumber: barcode, validated: false }])
      }
    } catch {
      playBeep(false)
    }
  }, [step, activeLogId, scannedInvoices])

  // Handle barcode scan - distinguish ID QR from invoice barcode
  const handleScan = useCallback((scannedText: string) => {
    resetInactivityTimer()

    // The Zebra TC21K may send Enter between QR lines.
    // If the text starts with a QR field prefix, buffer it.
    const isQrLine = /^(N:|A:|CI:|FV:)/i.test(scannedText.trim())

    if (isQrLine || qrBufferRef.current.length > 0) {
      // Accumulate QR lines
      qrBufferRef.current.push(scannedText.trim())

      // Clear any existing timeout
      if (qrBufferTimeoutRef.current) clearTimeout(qrBufferTimeoutRef.current)

      // Check if we have all fields
      const combined = qrBufferRef.current.join('\n')
      if (isCubanIdQr(combined) && combined.includes('CI:')) {
        // We have enough data, check if FV is there too or wait briefly
        const hasFV = qrBufferRef.current.some(l => l.startsWith('FV:'))
        if (hasFV || qrBufferRef.current.length >= 4) {
          qrBufferRef.current = []
          processIdScan(combined)
          return
        }
      }

      // Wait for more lines (150ms)
      qrBufferTimeoutRef.current = setTimeout(() => {
        const combined = qrBufferRef.current.join('\n')
        qrBufferRef.current = []
        if (isCubanIdQr(combined)) {
          processIdScan(combined)
        }
      }, 200)
      return
    }

    // Full QR in one scan (no Enter between lines)
    if (isCubanIdQr(scannedText)) {
      processIdScan(scannedText)
      return
    }

    // Not a Cuban ID QR - treat as invoice barcode during exit
    if (step === 'exit_pending') {
      processInvoiceScan(scannedText)
    }
  }, [processIdScan, processInvoiceScan, step, resetInactivityTimer])

  // Barcode scanner hook - always active
  useBarcodeScan({
    onScan: handleScan,
    minLength: 2,
    maxTimeBetweenKeys: 150,
    enabled: step !== 'loading',
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
        // Return to idle after 3s
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

  return (
    <div className="min-h-[100dvh] bg-stone-900">
      <AnimatePresence mode="wait">
        {/* Idle / Dashboard */}
        {(step === 'idle' || step === 'error') && (
          <div key="idle">
            <IdleScreen
              kioskName={kiosk?.name || 'Kiosk'}
              guardName={guard?.name || ''}
              currentTime={currentTime}
              stats={stats}
            />
            {/* Error overlay */}
            {step === 'error' && errorMessage && (
              <ScanFeedback
                visitorName={null}
                isError
                errorMessage={errorMessage}
              />
            )}
          </div>
        )}

        {/* Processing scan */}
        {step === 'processing' && (
          <ScanFeedback
            key="processing"
            visitorName={parsedName}
          />
        )}

        {/* Purpose selection */}
        {step === 'purpose_select' && visitor && (
          <PurposeQuickSelect
            key="purpose"
            visitorName={visitor.fullName}
            onSelect={handlePurposeSelect}
            loading={loading}
          />
        )}

        {/* Entry confirmed */}
        {step === 'entry_success' && visitor && (
          <EntryConfirmation
            key="entry"
            visitorName={visitor.fullName}
            idNumber={visitor.idNumber}
            purpose={selectedPurpose}
            onComplete={resetToIdle}
          />
        )}

        {/* Exit flow */}
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

        {/* Exit success */}
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
