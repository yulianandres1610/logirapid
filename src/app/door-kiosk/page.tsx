'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  MapPin,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  Keyboard,
  User,
  Lock
} from 'lucide-react'

interface Kiosk {
  id: number
  name: string
  location: string | null
  deviceId: string
}

interface GuardInfo {
  id: number
  name: string
  code: string
  position: string | null
}

type Step = 'pin' | 'select_kiosk'

export default function DoorKioskSelectorPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('pin')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guard, setGuard] = useState<GuardInfo | null>(null)
  const [kiosks, setKiosks] = useState<Kiosk[]>([])
  const pinInputRef = useRef<HTMLInputElement>(null)

  // Focus PIN input on mount
  useEffect(() => {
    if (step === 'pin' && pinInputRef.current) {
      pinInputRef.current.focus()
    }
  }, [step])

  // Auto-verify when PIN reaches 4 digits
  useEffect(() => {
    if (pin.length >= 4 && !loading) {
      verifyPin()
    }
  }, [pin])

  const handlePinChange = (digit: string) => {
    if (pin.length < 6) {
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
      // Get subdomain from current host
      const host = window.location.host
      const subdomain = host.split('.')[0] // e.g., "puerta" from "puerta.logirapid.com"

      const response = await fetch('/api/market/door-security/auth-guard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          companySubdomain: subdomain !== 'puerta' ? subdomain : undefined
        })
      })

      const result = await response.json()

      if (result.success) {
        setGuard(result.data.guard)

        // If there's a direct redirect (single kiosk assigned), go there
        if (result.data.redirectTo) {
          // Save guard info for the kiosk page
          sessionStorage.setItem('door-guard', JSON.stringify(result.data.guard))
          router.push(result.data.redirectTo)
        } else if (result.data.kiosks && result.data.kiosks.length > 0) {
          // Multiple kiosks - show selection
          setKiosks(result.data.kiosks)
          setStep('select_kiosk')
        } else {
          setError('No hay kiosks de puerta disponibles')
          setPin('')
        }
      } else {
        setError(result.error || 'PIN inválido')
        setPin('')
      }
    } catch (err) {
      console.error('Error verifying PIN:', err)
      setError('Error de conexión')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  const selectKiosk = (kiosk: Kiosk) => {
    // Save guard info for the kiosk page
    sessionStorage.setItem('door-guard', JSON.stringify(guard))
    router.push(`/door-kiosk/${kiosk.id}`)
  }

  const resetToPin = () => {
    setStep('pin')
    setPin('')
    setGuard(null)
    setKiosks([])
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-800 via-stone-900 to-stone-800 flex flex-col items-center justify-center p-4">
      {/* Logo/Title */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Shield className="w-10 h-10 text-orange-500" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">
          Control de Acceso
        </h1>
        <p className="text-stone-300">
          {step === 'pin' ? 'Ingresa tu PIN de guardia' : `Bienvenido, ${guard?.name}`}
        </p>
      </motion.div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <AnimatePresence mode="wait">
          {/* PIN Entry Step */}
          {step === 'pin' && (
            <motion.div
              key="pin"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-8"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-orange-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  Ingresa tu PIN
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  PIN de 4-6 dígitos
                </p>
              </div>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2"
                  >
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <span className="text-red-700 text-sm">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* PIN Display */}
              <div className="flex justify-center gap-3 mb-6">
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <div
                    key={i}
                    className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                      i < pin.length
                        ? 'border-orange-500 bg-orange-50 text-orange-600'
                        : 'border-gray-200'
                    }`}
                  >
                    {i < pin.length ? '•' : ''}
                  </div>
                ))}
              </div>

              {/* Numeric Keypad */}
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
                    className={`h-16 rounded-xl text-2xl font-bold transition-colors ${
                      digit === null
                        ? 'invisible'
                        : digit === 'del'
                          ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          : 'bg-stone-100 text-stone-900 hover:bg-orange-100'
                    }`}
                  >
                    {digit === 'del' ? '⌫' : digit}
                  </button>
                ))}
              </div>

              {loading && (
                <div className="flex items-center justify-center gap-2 text-orange-600 py-4">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Verificando...</span>
                </div>
              )}
            </motion.div>
          )}

          {/* Kiosk Selection Step */}
          {step === 'select_kiosk' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6"
            >
              {/* Guard Info */}
              <div className="flex items-center gap-4 mb-6 p-4 bg-orange-50 rounded-xl">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{guard?.name}</p>
                  <p className="text-sm text-gray-500">{guard?.code}</p>
                </div>
              </div>

              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Selecciona el Kiosk
              </h2>

              <div className="space-y-3">
                {kiosks.map((kiosk) => (
                  <button
                    key={kiosk.id}
                    onClick={() => selectKiosk(kiosk)}
                    className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-orange-50 rounded-xl transition-colors text-left group"
                  >
                    <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                      <Shield className="w-6 h-6 text-orange-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{kiosk.name}</p>
                      {kiosk.location && (
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {kiosk.location}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-orange-500" />
                  </button>
                ))}
              </div>

              <button
                onClick={resetToPin}
                className="w-full mt-6 py-3 text-gray-500 hover:text-gray-700 text-sm"
              >
                Cambiar usuario
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Footer */}
      <p className="text-stone-400 text-sm mt-8">
        puerta.servisumic.com
      </p>
    </div>
  )
}
