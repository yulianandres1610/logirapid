'use client'

import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js'
import { CreditCard, Loader2, AlertCircle, CheckCircle } from 'lucide-react'

// Initialize Stripe with publishable key
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

interface PaymentIntentResult {
  id: string
  status: string
}

interface StripeCardFormProps {
  clientSecret: string
  amount: number
  fee: number
  totalCharged: number
  targetName: string
  walletNumber: string
  onSuccess: (paymentIntent: PaymentIntentResult) => void
  onError: (error: string) => void
  onCancel: () => void
}

interface CheckoutFormProps {
  amount: number
  fee: number
  totalCharged: number
  targetName: string
  walletNumber: string
  onSuccess: (paymentIntent: PaymentIntentResult) => void
  onError: (error: string) => void
  onCancel: () => void
}

function CheckoutForm({
  amount,
  fee,
  totalCharged,
  targetName,
  walletNumber,
  onSuccess,
  onError,
  onCancel
}: CheckoutFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [checkingRedirect, setCheckingRedirect] = useState(true)

  // Check if returning from redirect (e.g., crypto, affirm, etc.)
  useEffect(() => {
    if (!stripe) {
      return
    }

    // Check URL params for payment_intent (Stripe adds this after redirect)
    const urlParams = new URLSearchParams(window.location.search)
    const paymentIntentId = urlParams.get('payment_intent')
    const redirectStatus = urlParams.get('redirect_status')

    if (paymentIntentId && redirectStatus) {
      // User is returning from a redirect-based payment method
      setProcessing(true)

      stripe.retrievePaymentIntent(urlParams.get('payment_intent_client_secret') || '').then(({ paymentIntent, error }) => {
        if (error) {
          setErrorMessage(error.message || 'Error al verificar el pago')
          onError(error.message || 'Error al verificar el pago')
          setProcessing(false)
        } else if (paymentIntent) {
          if (paymentIntent.status === 'succeeded') {
            // Payment succeeded, call success callback
            onSuccess({
              id: paymentIntent.id,
              status: paymentIntent.status
            })
          } else if (paymentIntent.status === 'processing') {
            setErrorMessage('El pago está siendo procesado. Por favor espere.')
            setProcessing(false)
          } else if (paymentIntent.status === 'requires_payment_method') {
            setErrorMessage('El pago no se completó. Por favor intente con otro método de pago.')
            setProcessing(false)
          } else {
            setErrorMessage(`Estado del pago: ${paymentIntent.status}`)
            setProcessing(false)
          }
        }

        // Clean URL params after checking
        const cleanUrl = window.location.pathname
        window.history.replaceState({}, '', cleanUrl)
      })
    }

    setCheckingRedirect(false)
  }, [stripe, onSuccess, onError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      setErrorMessage('Stripe no se ha cargado correctamente')
      return
    }

    setProcessing(true)
    setErrorMessage(null)

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href
        },
        redirect: 'if_required'
      })

      if (error) {
        // Handle card errors
        if (error.type === 'card_error' || error.type === 'validation_error') {
          setErrorMessage(error.message || 'Error en la tarjeta')
        } else {
          setErrorMessage('Error procesando el pago')
        }
        onError(error.message || 'Error procesando el pago')
        setProcessing(false)
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess({
          id: paymentIntent.id,
          status: paymentIntent.status
        })
      } else {
        setErrorMessage('El pago no se completó correctamente')
        setProcessing(false)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error inesperado'
      setErrorMessage(message)
      onError(message)
      setProcessing(false)
    }
  }

  // Show loading while checking redirect status
  if (checkingRedirect && !stripe) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">Cargando formulario de pago...</span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 min-h-[520px]">
      {/* Payment Summary */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <CreditCard className="w-5 h-5" />
          <span className="font-medium">Resumen del Pago</span>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Destinatario:</span>
            <span className="font-medium text-gray-900 dark:text-white">{targetName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Wallet:</span>
            <span className="font-mono text-gray-900 dark:text-white">{walletNumber}</span>
          </div>
          <div className="border-t dark:border-gray-700 pt-2 mt-2">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Monto a recargar:</span>
              <span className="text-gray-900 dark:text-white">${amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Fee (3.5%):</span>
              <span className="text-gray-900 dark:text-white">${fee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t dark:border-gray-700">
              <span className="text-gray-900 dark:text-white">Total a cobrar:</span>
              <span className="text-blue-600 dark:text-blue-400">${totalCharged.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stripe Payment Element */}
      <div className="border dark:border-gray-700 rounded-lg p-4">
        <PaymentElement
          options={{
            layout: 'tabs',
            defaultValues: {
              billingDetails: {
                address: {
                  country: 'US'
                }
              }
            }
          }}
        />
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{errorMessage}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={processing}
          className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!stripe || processing}
          className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {processing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Procesando...</span>
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              <span>Pagar ${totalCharged.toFixed(2)}</span>
            </>
          )}
        </button>
      </div>

      {/* Secure Payment Notice */}
      <p className="text-xs text-center text-gray-500 dark:text-gray-400">
        Pago seguro procesado por Stripe. Sus datos de tarjeta nunca tocan nuestros servidores.
      </p>
    </form>
  )
}

export default function StripeCardForm(props: StripeCardFormProps) {
  const { clientSecret, ...checkoutProps } = props

  // Validate clientSecret before rendering Elements
  if (!clientSecret || typeof clientSecret !== 'string' || !clientSecret.includes('_secret_')) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <span className="text-sm">Error: No se pudo inicializar el formulario de pago. Por favor, intente de nuevo.</span>
      </div>
    )
  }

  const appearance = {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#2563eb',
      colorBackground: '#ffffff',
      colorText: '#1f2937',
      colorDanger: '#dc2626',
      fontFamily: 'system-ui, sans-serif',
      spacingUnit: '4px',
      borderRadius: '8px'
    }
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance,
        locale: 'es'
      }}
    >
      <CheckoutForm {...checkoutProps} />
    </Elements>
  )
}
