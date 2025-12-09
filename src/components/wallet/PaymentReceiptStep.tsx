'use client'

import { useState } from 'react'
import { CheckCircle, Printer, MessageCircle, Smartphone, X, Loader2 } from 'lucide-react'
import { generateWalletReceiptHTML } from './templates/wallet-receipt-template'

export interface PaymentReceiptData {
  transactionNumber: string
  amount: number
  fee: number
  totalCharged: number
  newBalance: number
  cardBrand: string
  cardLast4: string
  recipientName: string
  recipientPhone: string | null
  walletNumber: string
  paymentDate?: Date
}

interface PaymentReceiptStepProps {
  data: PaymentReceiptData
  onClose: () => void
  onSent?: () => void
}

export function PaymentReceiptStep({ data, onClose, onSent }: PaymentReceiptStepProps) {
  const [sendingMethod, setSendingMethod] = useState<'sms' | 'whatsapp' | null>(null)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (date: Date = new Date()) => {
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handlePrint = () => {
    const receiptHTML = generateWalletReceiptHTML({
      transactionNumber: data.transactionNumber,
      date: data.paymentDate || new Date(),
      recipientName: data.recipientName,
      walletNumber: data.walletNumber,
      amount: data.amount,
      fee: data.fee,
      totalCharged: data.totalCharged,
      cardBrand: data.cardBrand,
      cardLast4: data.cardLast4,
      newBalance: data.newBalance
    })

    const printWindow = window.open('', '_blank', 'width=400,height=600')
    if (printWindow) {
      printWindow.document.write(receiptHTML)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        printWindow.print()
      }, 250)
    }
  }

  const handleSendReceipt = async (method: 'sms' | 'whatsapp') => {
    if (!data.recipientPhone) {
      setError('No hay numero de telefono disponible')
      return
    }

    setSendingMethod(method)
    setError(null)

    try {
      const response = await fetch('/api/wallet/send-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionNumber: data.transactionNumber,
          recipientPhone: data.recipientPhone,
          method,
          receiptData: {
            amount: data.amount,
            fee: data.fee,
            totalCharged: data.totalCharged,
            newBalance: data.newBalance,
            cardBrand: data.cardBrand,
            cardLast4: data.cardLast4,
            recipientName: data.recipientName,
            walletNumber: data.walletNumber
          }
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al enviar recibo')
      }

      setSent(true)
      onSent?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar recibo')
    } finally {
      setSendingMethod(null)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg max-w-md mx-auto overflow-hidden min-h-[680px] flex flex-col">
      {/* Header - Success */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6 text-center">
        <CheckCircle className="w-16 h-16 mx-auto mb-3" />
        <h2 className="text-2xl font-bold">Pago Procesado</h2>
        <p className="text-green-100 mt-1">La transaccion fue exitosa</p>
      </div>

      {/* Receipt Content */}
      <div className="p-6 flex-grow flex flex-col">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            Recibo de Recarga
          </h3>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Transaccion:</span>
              <span className="font-mono font-medium text-gray-900 dark:text-white">#{data.transactionNumber}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Fecha:</span>
              <span className="text-gray-900 dark:text-white">{formatDate(data.paymentDate)}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Destinatario:</span>
              <span className="text-gray-900 dark:text-white">{data.recipientName}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Wallet:</span>
              <span className="font-mono text-gray-900 dark:text-white">{data.walletNumber}</span>
            </div>

            <hr className="border-gray-200 dark:border-gray-600 my-3" />

            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Monto Recargado:</span>
              <span className="text-gray-900 dark:text-white">{formatCurrency(data.amount)}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Fee de Procesamiento:</span>
              <span className="text-gray-900 dark:text-white">{formatCurrency(data.fee)}</span>
            </div>

            <hr className="border-gray-200 dark:border-gray-600 my-3" />

            <div className="flex justify-between items-center">
              <span className="text-gray-700 dark:text-gray-300 font-semibold">TOTAL COBRADO:</span>
              <span className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(data.totalCharged)}</span>
            </div>

            <hr className="border-gray-200 dark:border-gray-600 my-3" />

            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Metodo:</span>
              <span className="text-gray-900 dark:text-white">{data.cardBrand} ****{data.cardLast4}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400">Nuevo Balance:</span>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatCurrency(data.newBalance)}</span>
            </div>
          </div>
        </div>

        {/* Send Receipt Section */}
        {data.recipientPhone && !sent && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Enviar recibo a: <span className="font-medium text-gray-900 dark:text-white">{data.recipientPhone}</span>
            </p>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handlePrint}
                className="flex flex-col items-center justify-center p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <Printer className="w-5 h-5 text-gray-600 dark:text-gray-300 mb-1" />
                <span className="text-xs text-gray-600 dark:text-gray-300">Imprimir</span>
              </button>

              <button
                onClick={() => handleSendReceipt('whatsapp')}
                disabled={sendingMethod !== null}
                className="flex flex-col items-center justify-center p-3 bg-green-500 hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {sendingMethod === 'whatsapp' ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin mb-1" />
                ) : (
                  <MessageCircle className="w-5 h-5 text-white mb-1" />
                )}
                <span className="text-xs text-white">WhatsApp</span>
              </button>

              <button
                onClick={() => handleSendReceipt('sms')}
                disabled={sendingMethod !== null}
                className="flex flex-col items-center justify-center p-3 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {sendingMethod === 'sms' ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin mb-1" />
                ) : (
                  <Smartphone className="w-5 h-5 text-white mb-1" />
                )}
                <span className="text-xs text-white">SMS</span>
              </button>
            </div>
          </div>
        )}

        {/* Sent confirmation */}
        {sent && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-4 text-center">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-green-700 dark:text-green-400 font-medium">Recibo enviado exitosamente</p>
          </div>
        )}

        {/* No phone available */}
        {!data.recipientPhone && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              No hay numero de telefono registrado para enviar el recibo.
            </p>
            <button
              onClick={handlePrint}
              className="mt-3 flex items-center justify-center gap-2 w-full p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <Printer className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              <span className="text-sm text-gray-600 dark:text-gray-300">Imprimir Recibo</span>
            </button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full flex items-center justify-center gap-2 py-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mt-auto"
        >
          <X className="w-4 h-4" />
          <span>Cerrar sin enviar</span>
        </button>
      </div>
    </div>
  )
}
