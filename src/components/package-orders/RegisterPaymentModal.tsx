'use client'

import { useState } from 'react'
import { X, DollarSign, CreditCard, Banknote, Check } from 'lucide-react'

interface RegisterPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  orderId: number
  orderNumber: string
  totalAmount: number
  paidAmount: number
  onPaymentRegistered: () => void
  userId: number
  userName: string
}

const paymentMethods = [
  { value: 'cash', label: 'Efectivo', icon: Banknote },
  { value: 'zelle', label: 'Zelle', icon: DollarSign },
  { value: 'card', label: 'Tarjeta', icon: CreditCard }
]

export default function RegisterPaymentModal({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  totalAmount,
  paidAmount,
  onPaymentRegistered,
  userId,
  userName
}: RegisterPaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [amount, setAmount] = useState((totalAmount - paidAmount).toFixed(2))
  const [reference, setReference] = useState('')
  const [cashReceived, setCashReceived] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const remainingAmount = totalAmount - paidAmount
  const changeAmount = paymentMethod === 'cash' && cashReceived
    ? Math.max(0, parseFloat(cashReceived) - parseFloat(amount || '0'))
    : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/package-orders/${orderId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod,
          amount: parseFloat(amount),
          reference: paymentMethod === 'zelle' ? reference : undefined,
          cashReceived: paymentMethod === 'cash' ? parseFloat(cashReceived) : undefined,
          notes,
          registeredBy: userId,
          registeredByName: userName,
          source: 'dashboard'
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al registrar el pago')
      }

      onPaymentRegistered()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Registrar Pago</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Order Info */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-600">Orden: <span className="font-medium text-gray-900">{orderNumber}</span></p>
            <p className="text-sm text-gray-600">Total: <span className="font-medium text-gray-900">${totalAmount.toFixed(2)}</span></p>
            <p className="text-sm text-gray-600">Pagado: <span className="font-medium text-green-600">${paidAmount.toFixed(2)}</span></p>
            <p className="text-sm text-gray-600">Pendiente: <span className="font-medium text-amber-600">${remainingAmount.toFixed(2)}</span></p>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Metodo de Pago
            </label>
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.map((method) => {
                const Icon = method.icon
                return (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => setPaymentMethod(method.value)}
                    className={`
                      flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors
                      ${paymentMethod === method.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }
                    `}
                  >
                    <Icon size={20} />
                    <span className="text-sm font-medium">{method.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                step="0.0001"
                min="0.01"
                max={remainingAmount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Cash Received (for cash payments) */}
          {paymentMethod === 'cash' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Efectivo Recibido
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.0001"
                  min={amount}
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>
              {changeAmount > 0 && (
                <p className="mt-1 text-sm text-green-600">
                  Cambio: ${changeAmount.toFixed(2)}
                </p>
              )}
            </div>
          )}

          {/* Reference (for Zelle) */}
          {paymentMethod === 'zelle' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Numero de Confirmacion
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ej: ZELLE-12345"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Notas adicionales..."
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>Registrando...</>
              ) : (
                <>
                  <Check size={18} />
                  Registrar Pago
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
