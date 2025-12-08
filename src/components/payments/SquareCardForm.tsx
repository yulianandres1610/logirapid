'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { Loader2, CreditCard, AlertCircle, ShieldCheck } from 'lucide-react'

// Extend Window to include Square
declare global {
  interface Window {
    Square: {
      payments: (applicationId: string, locationId: string) => Promise<SquarePayments>
    }
  }
}

interface SquarePayments {
  card: (options?: CardOptions) => Promise<SquareCard>
}

interface CardOptions {
  style?: Record<string, Record<string, string>>
}

interface SquareCard {
  attach: (selector: string) => Promise<void>
  destroy: () => void
  tokenize: () => Promise<TokenResult>
}

interface TokenResult {
  status: 'OK' | 'ERROR'
  token?: string
  errors?: Array<{ message: string }>
}

interface SquareCardFormProps {
  amount: number
  targetWalletNumber: string
  targetType: 'company' | 'user' | 'customer'
  onSuccess: (data: PaymentResult) => void
  onError: (error: string) => void
  onProcessing?: (isProcessing: boolean) => void
}

interface PaymentResult {
  paymentId: string
  transactionId: number
  transactionNumber: string
  cardBrand: string
  cardLast4: string
  receiptUrl?: string
  newBalance: number
  amount: number
}

interface SquareConfig {
  applicationId: string
  locationId: string
  environment: 'sandbox' | 'production'
}

export function SquareCardForm({
  amount,
  targetWalletNumber,
  targetType,
  onSuccess,
  onError,
  onProcessing
}: SquareCardFormProps) {
  const { theme } = useTheme()
  const cardContainerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardReady, setCardReady] = useState(false)
  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [squareConfig, setSquareConfig] = useState<SquareConfig | null>(null)

  const paymentsRef = useRef<SquarePayments | null>(null)
  const cardRef = useRef<SquareCard | null>(null)
  const initializingRef = useRef(false)

  // Fetch Square configuration from API
  useEffect(() => {
    async function fetchConfig() {
      try {
        const response = await fetch('/api/square/config')
        const data = await response.json()

        if (!data.success) {
          throw new Error(data.error || 'Error al obtener configuracion de Square')
        }

        setSquareConfig(data.data)
        console.log('[SquareCardForm] Config loaded:', {
          applicationId: data.data.applicationId.substring(0, 10) + '...',
          locationId: data.data.locationId,
          environment: data.data.environment
        })
      } catch (err) {
        console.error('[SquareCardForm] Config fetch error:', err)
        setError(err instanceof Error ? err.message : 'Error al cargar configuracion')
        setLoading(false)
      }
    }

    fetchConfig()
  }, [])

  // Load Square SDK after config is fetched
  useEffect(() => {
    if (!squareConfig) return

    if (window.Square) {
      setSdkLoaded(true)
      return
    }

    const script = document.createElement('script')
    script.src = squareConfig.environment === 'production'
      ? 'https://web.squarecdn.com/v1/square.js'
      : 'https://sandbox.web.squarecdn.com/v1/square.js'
    script.async = true

    script.onload = () => {
      console.log('[SquareCardForm] SDK loaded')
      setSdkLoaded(true)
    }

    script.onerror = () => {
      console.error('[SquareCardForm] Failed to load SDK')
      setError('Error al cargar el procesador de pagos')
      setLoading(false)
    }

    document.body.appendChild(script)

    return () => {
      // Don't remove script on cleanup to allow reuse
    }
  }, [squareConfig])

  // Initialize Square Card
  const initializeSquare = useCallback(async () => {
    if (initializingRef.current || !sdkLoaded || !window.Square || !squareConfig) {
      return
    }

    initializingRef.current = true

    try {
      setLoading(true)
      setError(null)

      const { applicationId, locationId } = squareConfig

      console.log('[SquareCardForm] Initializing with:', { applicationId: applicationId.substring(0, 10) + '...', locationId })

      // Initialize Square Payments
      const payments = await window.Square.payments(applicationId, locationId)
      paymentsRef.current = payments

      // Create Card element with custom styling
      const card = await payments.card({
        style: {
          '.input-container': {
            borderColor: theme === 'dark' ? '#374151' : '#D1D5DB',
            borderRadius: '8px',
          },
          '.input-container.is-focus': {
            borderColor: '#3B82F6',
          },
          '.input-container.is-error': {
            borderColor: '#EF4444',
          },
          'input': {
            backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
            color: theme === 'dark' ? '#F9FAFB' : '#111827',
            fontFamily: 'Inter, system-ui, sans-serif',
          },
          'input::placeholder': {
            color: theme === 'dark' ? '#6B7280' : '#9CA3AF',
          },
          '.message-text': {
            color: theme === 'dark' ? '#F87171' : '#DC2626',
          },
        }
      })

      // Attach to container
      await card.attach('#square-card-container')
      cardRef.current = card
      setCardReady(true)
      setLoading(false)
      console.log('[SquareCardForm] Card element attached successfully')

    } catch (err) {
      console.error('[SquareCardForm] Error initializing:', err)
      setError(err instanceof Error ? err.message : 'Error al inicializar formulario de pago')
      setLoading(false)
    } finally {
      initializingRef.current = false
    }
  }, [sdkLoaded, theme, squareConfig])

  // Initialize when SDK is loaded and config is available
  useEffect(() => {
    if (sdkLoaded && squareConfig && !cardRef.current) {
      initializeSquare()
    }
  }, [sdkLoaded, squareConfig, initializeSquare])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cardRef.current) {
        try {
          cardRef.current.destroy()
        } catch (e) {
          console.log('[SquareCardForm] Card already destroyed')
        }
        cardRef.current = null
      }
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!cardRef.current || !cardReady) {
      setError('El formulario de pago no esta listo')
      return
    }

    setProcessing(true)
    setError(null)
    onProcessing?.(true)

    try {
      console.log('[SquareCardForm] Tokenizing card...')

      // Step 1: Tokenize the card
      const tokenResult = await cardRef.current.tokenize()
      console.log('[SquareCardForm] Token result:', { status: tokenResult.status })

      if (tokenResult.status !== 'OK' || !tokenResult.token) {
        throw new Error(tokenResult.errors?.[0]?.message || 'Error al procesar tarjeta')
      }

      console.log('[SquareCardForm] Token obtained, sending to backend...')

      // Step 2: Send token to backend
      const response = await fetch('/api/wallet/recharge/card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: tokenResult.token,
          amount,
          targetWalletNumber,
          targetType
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al procesar pago')
      }

      console.log('[SquareCardForm] Payment successful:', data.data)
      onSuccess(data.data)

    } catch (err) {
      console.error('[SquareCardForm] Payment error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Error al procesar pago'
      setError(errorMessage)
      onError(errorMessage)
    } finally {
      setProcessing(false)
      onProcessing?.(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500 mr-2" />
          <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
            Cargando formulario de pago...
          </span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className={cn(
          "flex items-center gap-2 p-3 rounded-lg",
          theme === 'dark' ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700'
        )}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Card Form */}
      <form onSubmit={handleSubmit} className={loading ? 'hidden' : ''}>
        <div
          id="square-card-container"
          ref={cardContainerRef}
          className={cn(
            "min-h-[200px] p-4 rounded-xl border transition-all",
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          )}
        />

        {/* Amount Summary */}
        <div className={cn(
          "mt-4 p-4 rounded-lg",
          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
        )}>
          <div className="flex justify-between items-center">
            <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
              Total a cobrar:
            </span>
            <span className={cn(
              "text-xl font-bold",
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              ${amount.toFixed(2)} USD
            </span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!cardReady || processing}
          className={cn(
            "w-full mt-4 py-3 px-4 rounded-xl font-medium transition-all",
            "flex items-center justify-center gap-2",
            processing || !cardReady
              ? 'bg-gray-400 cursor-not-allowed text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          )}
        >
          {processing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Procesando pago...
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              Pagar ${amount.toFixed(2)}
            </>
          )}
        </button>

        {/* Security Note */}
        <div className={cn(
          "mt-4 flex items-center justify-center gap-2 text-xs",
          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
        )}>
          <ShieldCheck className="w-4 h-4" />
          <span>Pago seguro procesado por Square. Tus datos de tarjeta nunca pasan por nuestros servidores.</span>
        </div>
      </form>
    </div>
  )
}

export default SquareCardForm
