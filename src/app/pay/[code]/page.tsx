'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CreditCard,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  ArrowLeft,
  User,
  Phone,
  MapPin,
  Package,
  DollarSign
} from 'lucide-react'
import { loadStripe, Stripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js'

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

interface PaymentLinkData {
  id: number
  link_code: string
  order_type: string
  order_number: string
  amount: string
  currency: string
  status: string
  customer_name: string
  customer_phone: string
  description: string
  expires_at: string
  isExpired: boolean
  isPaid: boolean
  orderDetails?: {
    recipient_name?: string
    recipient_phone?: string
    recipient_province?: string
    recipient_municipality?: string
    recipient_address?: string
    send_amount?: number
    customername?: string
    customeraddress?: string
    city?: string
    state?: string
  }
}

// Payment Form Component
function PaymentForm({
  paymentLink,
  clientSecret,
  onSuccess
}: {
  paymentLink: PaymentLinkData
  clientSecret: string
  onSuccess: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const { error: submitError, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: `${window.location.origin}/pay/${paymentLink.link_code}/success`
        }
      })

      if (submitError) {
        setError(submitError.message || 'Error procesando el pago')
        setProcessing(false)
        return
      }

      if (paymentIntent?.status === 'succeeded') {
        // Confirmar pago en backend
        await fetch(`/api/payment-links/${paymentLink.link_code}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentIntentId: paymentIntent.id
          })
        })

        onSuccess()
      }
    } catch (err) {
      setError('Error procesando el pago. Por favor intenta de nuevo.')
      setProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement
        options={{
          layout: 'tabs'
        }}
      />

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/25"
      >
        {processing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Procesando...
          </>
        ) : (
          <>
            <CreditCard className="w-5 h-5" />
            Pagar ${parseFloat(paymentLink.amount).toFixed(2)} {paymentLink.currency}
          </>
        )}
      </button>

      <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
        <Shield className="w-4 h-4" />
        <span>Pago seguro con Stripe</span>
      </div>
    </form>
  )
}

// Main Page Component
export default function PaymentPage({
  params
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = use(params)
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [paymentLink, setPaymentLink] = useState<PaymentLinkData | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [paymentComplete, setPaymentComplete] = useState(false)

  useEffect(() => {
    loadPaymentLink()
  }, [code])

  const loadPaymentLink = async () => {
    try {
      setLoading(true)

      // Obtener datos del payment link
      const response = await fetch(`/api/payment-links/${code}`)
      const data = await response.json()

      if (!data.success) {
        setError(data.error || 'Link de pago no encontrado')
        return
      }

      setPaymentLink(data.data)

      // Si ya esta pagado o expirado, no crear intent
      if (data.data.isPaid || data.data.isExpired) {
        return
      }

      // Crear PaymentIntent
      const intentResponse = await fetch(`/api/payment-links/${code}/create-intent`, {
        method: 'POST'
      })
      const intentData = await intentResponse.json()

      if (intentData.success) {
        setClientSecret(intentData.data.clientSecret)
      } else {
        setError(intentData.error || 'Error creando intento de pago')
      }

    } catch (err) {
      setError('Error cargando link de pago')
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentSuccess = () => {
    setPaymentComplete(true)
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Cargando...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !paymentLink) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">
            Link no disponible
          </h1>
          <p className="text-gray-400 mb-8">
            {error || 'El link de pago no fue encontrado o ya no esta disponible.'}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  // Already paid
  if (paymentLink.isPaid || paymentComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">
            Pago completado
          </h1>
          <p className="text-gray-400 mb-2">
            Tu pago de <span className="text-white font-semibold">${parseFloat(paymentLink.amount).toFixed(2)} {paymentLink.currency}</span> ha sido procesado exitosamente.
          </p>
          <p className="text-gray-500 text-sm mb-8">
            Orden: {paymentLink.order_number}
          </p>
          <div className="bg-gray-800/50 rounded-xl p-6 text-left">
            <p className="text-gray-400 text-sm mb-2">Recibiras una confirmacion por WhatsApp.</p>
            <p className="text-gray-400 text-sm">Gracias por tu confianza en LogiRapid.</p>
          </div>
        </div>
      </div>
    )
  }

  // Expired
  if (paymentLink.isExpired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">
            Link expirado
          </h1>
          <p className="text-gray-400 mb-8">
            Este link de pago ha expirado. Por favor contacta a LogiRapid para generar un nuevo link.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  // Payment form
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="bg-gray-900/80 backdrop-blur-md border-b border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/20">
                <span className="text-white font-bold text-lg">LR</span>
              </div>
              <span className="text-xl font-bold text-white">LogiRapid</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Shield className="w-4 h-4 text-green-500" />
              <span>Pago Seguro</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Summary */}
          <div className="order-2 lg:order-1">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-400" />
                Resumen de la orden
              </h2>

              <div className="space-y-4">
                {/* Order Number */}
                <div className="flex justify-between items-center pb-4 border-b border-gray-700">
                  <span className="text-gray-400">Numero de orden</span>
                  <span className="text-white font-mono">{paymentLink.order_number}</span>
                </div>

                {/* Order Type */}
                <div className="flex justify-between items-center pb-4 border-b border-gray-700">
                  <span className="text-gray-400">Tipo</span>
                  <span className="text-white capitalize">
                    {paymentLink.order_type === 'remittance' ? 'Cupon Familiar' : 'Recogida de Paquete'}
                  </span>
                </div>

                {/* Recipient Info (for remittance) */}
                {paymentLink.orderDetails && paymentLink.order_type === 'remittance' && (
                  <>
                    <div className="space-y-3 pb-4 border-b border-gray-700">
                      <div className="flex items-start gap-3">
                        <User className="w-4 h-4 text-gray-500 mt-1" />
                        <div>
                          <p className="text-gray-400 text-sm">Beneficiario</p>
                          <p className="text-white">{paymentLink.orderDetails.recipient_name}</p>
                        </div>
                      </div>

                      {paymentLink.orderDetails.recipient_phone && (
                        <div className="flex items-start gap-3">
                          <Phone className="w-4 h-4 text-gray-500 mt-1" />
                          <div>
                            <p className="text-gray-400 text-sm">Telefono</p>
                            <p className="text-white">{paymentLink.orderDetails.recipient_phone}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-gray-500 mt-1" />
                        <div>
                          <p className="text-gray-400 text-sm">Destino</p>
                          <p className="text-white">
                            {paymentLink.orderDetails.recipient_municipality}, {paymentLink.orderDetails.recipient_province}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Sender Info (for pickup) */}
                {paymentLink.orderDetails && paymentLink.order_type === 'pickup' && (
                  <div className="space-y-3 pb-4 border-b border-gray-700">
                    <div className="flex items-start gap-3">
                      <User className="w-4 h-4 text-gray-500 mt-1" />
                      <div>
                        <p className="text-gray-400 text-sm">Cliente</p>
                        <p className="text-white">{paymentLink.orderDetails.customername}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-gray-500 mt-1" />
                      <div>
                        <p className="text-gray-400 text-sm">Direccion de recogida</p>
                        <p className="text-white">
                          {paymentLink.orderDetails.customeraddress}, {paymentLink.orderDetails.city}, {paymentLink.orderDetails.state}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Total */}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-lg font-semibold text-white">Total a pagar</span>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-500" />
                    <span className="text-2xl font-bold text-white">
                      {parseFloat(paymentLink.amount).toFixed(2)}
                    </span>
                    <span className="text-gray-400">{paymentLink.currency}</span>
                  </div>
                </div>
              </div>

              {/* Expiry Warning */}
              {paymentLink.expires_at && (
                <div className="mt-6 flex items-center gap-2 text-amber-400 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>
                    Este link expira el {new Date(paymentLink.expires_at).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Form */}
          <div className="order-1 lg:order-2">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-400" />
                Informacion de pago
              </h2>

              {clientSecret ? (
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    appearance: {
                      theme: 'night',
                      variables: {
                        colorPrimary: '#3b82f6',
                        colorBackground: '#1f2937',
                        colorText: '#ffffff',
                        colorTextSecondary: '#9ca3af',
                        colorDanger: '#ef4444',
                        borderRadius: '12px',
                        fontFamily: 'system-ui, sans-serif'
                      }
                    }
                  }}
                >
                  <PaymentForm
                    paymentLink={paymentLink}
                    clientSecret={clientSecret}
                    onSuccess={handlePaymentSuccess}
                  />
                </Elements>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900/80 backdrop-blur-md border-t border-gray-700 mt-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-gray-400 text-sm">
              &copy; {new Date().getFullYear()} LogiRapid LLC. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <Link href="/privacy" className="hover:text-white transition-colors">
                Privacidad
              </Link>
              <Link href="/terms" className="hover:text-white transition-colors">
                Terminos
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
