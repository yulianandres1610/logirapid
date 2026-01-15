'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CreditCard,
  DollarSign,
  Smartphone,
  CheckCircle,
  AlertCircle,
  Package,
  Calculator,
  Send,
  MessageCircle,
  Printer
} from 'lucide-react'

interface Product {
  productName: string
  quantity: number
  unitPrice: number
  subtotal: number
}

interface OrderSummary {
  orderNumber: string
  products: Product[]
  totalProducts: number
  shippingCost: number
  totalAmount: number
  senderName: string
  senderPhone: string
}

type PaymentMethod = 'terminal' | 'cash' | 'zelle'

export default function PaymentPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string

  const [orderSummary, setOrderSummary] = useState<OrderSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [cashReceived, setCashReceived] = useState('')
  const [zelleReference, setZelleReference] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [showReceiptOptions, setShowReceiptOptions] = useState(false)

  const fetchOrderSummary = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/driver-app/orders/${orderId}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await response.json()

      if (response.status === 401) {
        window.location.href = '/driver/login'
        return
      }

      if (data.success) {
        const order = data.data
        const products = order.products || []
        const totalProducts = products.reduce((sum: number, p: Product) => sum + p.subtotal, 0)

        setOrderSummary({
          orderNumber: order.orderNumber,
          products,
          totalProducts,
          shippingCost: 0, // Could be calculated based on shipping type
          totalAmount: order.totalAmount || totalProducts,
          senderName: `${order.sender?.firstName || ''} ${order.sender?.lastName || ''}`.trim(),
          senderPhone: order.sender?.phone || ''
        })
      } else {
        setError(data.error || 'Error al cargar orden')
      }
    } catch (err) {
      console.error('Error fetching order:', err)
      setError('Error de conexion')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrderSummary()
  }, [orderId])

  const changeAmount = cashReceived && orderSummary
    ? Math.max(0, parseFloat(cashReceived) - orderSummary.totalAmount)
    : 0

  const handleProcessPayment = async () => {
    if (!paymentMethod || !orderSummary) return

    // Validate payment method specific data
    if (paymentMethod === 'cash' && !cashReceived) {
      setError('Ingresa el monto recibido')
      return
    }
    if (paymentMethod === 'cash' && parseFloat(cashReceived) < orderSummary.totalAmount) {
      setError('El monto recibido es menor al total')
      return
    }
    if (paymentMethod === 'zelle' && !zelleReference) {
      setError('Ingresa la referencia de Zelle')
      return
    }

    setIsProcessing(true)
    setError('')

    try {
      const paymentData: any = {
        method: paymentMethod,
        amount: orderSummary.totalAmount
      }

      if (paymentMethod === 'cash') {
        paymentData.amountReceived = parseFloat(cashReceived)
        paymentData.changeGiven = changeAmount
      }
      if (paymentMethod === 'zelle') {
        paymentData.reference = zelleReference
      }

      const response = await fetch(`/api/driver-app/orders/${orderId}/confirm-payment`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      })

      const data = await response.json()

      if (data.success) {
        setPaymentSuccess(true)
        setShowReceiptOptions(true)
      } else {
        setError(data.error || 'Error al procesar pago')
      }
    } catch (err) {
      console.error('Error processing payment:', err)
      setError('Error de conexion')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleTerminalPayment = async () => {
    if (!orderSummary) return

    setIsProcessing(true)
    setError('')

    try {
      // Create terminal checkout
      const response = await fetch('/api/square/create-terminal-checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amount: orderSummary.totalAmount,
          note: `Pago orden ${orderSummary.orderNumber}`
        })
      })

      const data = await response.json()

      if (data.success) {
        // Terminal checkout created - would normally poll for status
        // For now, simulate success
        setTimeout(() => {
          setPaymentSuccess(true)
          setShowReceiptOptions(true)
          setIsProcessing(false)
        }, 3000)
      } else {
        setError(data.error || 'Error al conectar con terminal')
        setIsProcessing(false)
      }
    } catch (err) {
      console.error('Error with terminal:', err)
      setError('Error de conexion con terminal')
      setIsProcessing(false)
    }
  }

  const sendReceipt = async (method: 'whatsapp' | 'sms') => {
    try {
      await fetch(`/api/driver-app/orders/${orderId}/send-receipt`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          phone: orderSummary?.senderPhone
        })
      })
      // Navigate back to order
      router.push(`/driver/orders/${orderId}`)
    } catch (err) {
      console.error('Error sending receipt:', err)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-exa-primary/30 border-t-exa-primary rounded-full animate-spin mb-4" />
        <p className="text-gray-400">Cargando orden...</p>
      </div>
    )
  }

  if (!orderSummary) {
    return (
      <div className="px-4 py-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-400">{error || 'Orden no encontrada'}</p>
        </div>
      </div>
    )
  }

  // Payment Success Screen
  if (paymentSuccess) {
    return (
      <div className="px-4 py-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center py-8"
        >
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-white font-bold text-2xl mb-2">Pago Exitoso</h2>
          <p className="text-gray-400 mb-6">
            ${orderSummary.totalAmount.toFixed(2)} cobrados
          </p>

          {showReceiptOptions && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-3"
            >
              <p className="text-gray-400 text-sm mb-3">Enviar recibo al cliente:</p>
              <button
                onClick={() => sendReceipt('whatsapp')}
                className="w-full py-3 bg-green-500/20 text-green-400 font-medium rounded-xl flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-5 h-5" />
                Enviar por WhatsApp
              </button>
              <button
                onClick={() => sendReceipt('sms')}
                className="w-full py-3 bg-blue-500/20 text-blue-400 font-medium rounded-xl flex items-center justify-center gap-2"
              >
                <Send className="w-5 h-5" />
                Enviar por SMS
              </button>
              <button
                onClick={() => router.push(`/driver/orders/${orderId}`)}
                className="w-full py-3 bg-gray-800 text-white font-medium rounded-xl"
              >
                Volver a la Orden
              </button>
            </motion.div>
          )}
        </motion.div>
      </div>
    )
  }

  return (
    <div className="pb-32">
      {/* Order Summary */}
      <div className="px-4 pt-4 mb-4">
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-3">Resumen de Orden</h3>

          {/* Products */}
          {orderSummary.products.length > 0 && (
            <div className="space-y-2 mb-4">
              {orderSummary.products.map((product, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-gray-300 text-sm">
                    {product.quantity}x {product.productName}
                  </span>
                  <span className="text-white">${product.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Totals */}
          <div className="pt-3 border-t border-gray-700/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Subtotal</span>
              <span className="text-white">${orderSummary.totalProducts.toFixed(2)}</span>
            </div>
            {orderSummary.shippingCost > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Envio</span>
                <span className="text-white">${orderSummary.shippingCost.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-gray-700/50">
              <span className="text-white font-semibold">Total a Cobrar</span>
              <span className="text-exa-primary font-bold text-xl">
                ${orderSummary.totalAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 mb-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Payment Methods */}
      <div className="px-4">
        <h3 className="text-white font-semibold mb-3">Metodo de Pago</h3>
        <div className="space-y-3">
          {/* Terminal Square */}
          <button
            onClick={() => setPaymentMethod('terminal')}
            className={`w-full p-4 rounded-xl border transition-all flex items-center gap-4 ${
              paymentMethod === 'terminal'
                ? 'bg-exa-primary/10 border-exa-primary/50'
                : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              paymentMethod === 'terminal' ? 'bg-exa-primary/20' : 'bg-gray-700/50'
            }`}>
              <CreditCard className={`w-6 h-6 ${
                paymentMethod === 'terminal' ? 'text-exa-primary' : 'text-gray-400'
              }`} />
            </div>
            <div className="flex-1 text-left">
              <p className={`font-medium ${
                paymentMethod === 'terminal' ? 'text-white' : 'text-gray-300'
              }`}>Terminal Square</p>
              <p className="text-gray-500 text-sm">Tarjeta de credito/debito</p>
            </div>
            {paymentMethod === 'terminal' && (
              <CheckCircle className="w-5 h-5 text-exa-primary" />
            )}
          </button>

          {/* Cash */}
          <button
            onClick={() => setPaymentMethod('cash')}
            className={`w-full p-4 rounded-xl border transition-all flex items-center gap-4 ${
              paymentMethod === 'cash'
                ? 'bg-green-500/10 border-green-500/50'
                : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              paymentMethod === 'cash' ? 'bg-green-500/20' : 'bg-gray-700/50'
            }`}>
              <DollarSign className={`w-6 h-6 ${
                paymentMethod === 'cash' ? 'text-green-400' : 'text-gray-400'
              }`} />
            </div>
            <div className="flex-1 text-left">
              <p className={`font-medium ${
                paymentMethod === 'cash' ? 'text-white' : 'text-gray-300'
              }`}>Efectivo</p>
              <p className="text-gray-500 text-sm">Pago en cash</p>
            </div>
            {paymentMethod === 'cash' && (
              <CheckCircle className="w-5 h-5 text-green-400" />
            )}
          </button>

          {/* Zelle */}
          <button
            onClick={() => setPaymentMethod('zelle')}
            className={`w-full p-4 rounded-xl border transition-all flex items-center gap-4 ${
              paymentMethod === 'zelle'
                ? 'bg-purple-500/10 border-purple-500/50'
                : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              paymentMethod === 'zelle' ? 'bg-purple-500/20' : 'bg-gray-700/50'
            }`}>
              <Smartphone className={`w-6 h-6 ${
                paymentMethod === 'zelle' ? 'text-purple-400' : 'text-gray-400'
              }`} />
            </div>
            <div className="flex-1 text-left">
              <p className={`font-medium ${
                paymentMethod === 'zelle' ? 'text-white' : 'text-gray-300'
              }`}>Zelle</p>
              <p className="text-gray-500 text-sm">Transferencia bancaria</p>
            </div>
            {paymentMethod === 'zelle' && (
              <CheckCircle className="w-5 h-5 text-purple-400" />
            )}
          </button>
        </div>

        {/* Cash Input */}
        <AnimatePresence>
          {paymentMethod === 'cash' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 space-y-3"
            >
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Monto Recibido</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-12 pr-4 py-3 text-white text-xl font-semibold placeholder-gray-600 focus:border-green-500 outline-none"
                  />
                </div>
              </div>

              {cashReceived && parseFloat(cashReceived) >= orderSummary.totalAmount && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-green-500/10 border border-green-500/30 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Cambio a Devolver</span>
                    <span className="text-green-400 font-bold text-xl">
                      ${changeAmount.toFixed(2)}
                    </span>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Zelle Input */}
        <AnimatePresence>
          {paymentMethod === 'zelle' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4"
            >
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-3">
                <p className="text-purple-400 text-sm mb-2">Solicitar transferencia a:</p>
                <p className="text-white font-mono">pagos@logirapid.com</p>
              </div>
              <label className="text-gray-400 text-sm mb-2 block">Numero de Referencia</label>
              <input
                type="text"
                value={zelleReference}
                onChange={(e) => setZelleReference(e.target.value)}
                placeholder="Ej: Z123456789"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 outline-none"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Process Payment Button */}
      {paymentMethod && (
        <div className="fixed bottom-20 left-0 right-0 px-4 py-3 bg-gray-900/95 backdrop-blur-lg border-t border-gray-800">
          <button
            onClick={paymentMethod === 'terminal' ? handleTerminalPayment : handleProcessPayment}
            disabled={isProcessing}
            className="w-full py-4 bg-gradient-to-r from-exa-primary to-exa-secondary text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>
                  {paymentMethod === 'terminal' ? 'Esperando Terminal...' : 'Procesando...'}
                </span>
              </>
            ) : (
              <>
                {paymentMethod === 'terminal' && <CreditCard className="w-5 h-5" />}
                {paymentMethod === 'cash' && <DollarSign className="w-5 h-5" />}
                {paymentMethod === 'zelle' && <Smartphone className="w-5 h-5" />}
                <span>Confirmar Pago - ${orderSummary.totalAmount.toFixed(2)}</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
