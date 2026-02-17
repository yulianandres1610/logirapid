'use client'

import { useState, useEffect } from 'react'
import { X, DollarSign, ArrowDownToLine, AlertCircle, CheckCircle2, Loader2, Building2 } from 'lucide-react'

interface ExternalAccount {
  id: string
  type: string
  last4: string
  bankName: string
  currency: string
  default: boolean
}

interface CashoutModalProps {
  isOpen: boolean
  onClose: () => void
  entityType: 'company' | 'user'
  entityId: number
  entityName: string
  walletBalance: number
  walletNumber: string
  connectStatus: 'not_connected' | 'pending' | 'active' | 'restricted'
  externalAccounts?: ExternalAccount[]
  onSuccess?: (result: any) => void
  onConnectRequired?: () => void
}

export default function CashoutModal({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName,
  walletBalance,
  walletNumber,
  connectStatus,
  externalAccounts,
  onSuccess,
  onConnectRequired
}: CashoutModalProps) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<any>(null)

  const MIN_CASHOUT = 10

  useEffect(() => {
    if (isOpen) {
      setAmount('')
      setError(null)
      setSuccess(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const amountNum = parseFloat(amount) || 0
  const isValidAmount = amountNum >= MIN_CASHOUT && amountNum <= walletBalance
  const canCashout = connectStatus === 'active' && walletBalance >= MIN_CASHOUT

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isValidAmount) {
      setError(`El monto debe ser entre $${MIN_CASHOUT} y $${walletBalance.toFixed(2)}`)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/wallet/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType,
          entityId,
          amount: amountNum
        })
      })

      const data = await res.json()

      if (data.success) {
        setSuccess(data.data)
        onSuccess?.(data.data)
      } else {
        setError(data.error || 'Error al procesar el retiro')
      }
    } catch (err) {
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  const handleSetMax = () => {
    setAmount(walletBalance.toFixed(2))
  }

  const handleQuickAmount = (value: number) => {
    if (value <= walletBalance) {
      setAmount(value.toFixed(2))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <ArrowDownToLine className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Retirar Fondos</h2>
                <p className="text-sm text-green-100">A tu cuenta bancaria</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {connectStatus !== 'active' ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-yellow-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Conecta tu cuenta bancaria
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Para poder retirar fondos, primero necesitas conectar tu cuenta bancaria via Stripe.
              </p>
              <button
                onClick={() => {
                  onClose()
                  onConnectRequired?.()
                }}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-indigo-700 transition-all"
              >
                Conectar Cuenta Bancaria
              </button>
            </div>
          ) : success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Retiro exitoso
              </h3>
              <div className="bg-green-50 rounded-lg p-4 mb-4 text-left">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Monto retirado:</span>
                    <span className="font-medium text-gray-900">${success.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Nuevo balance:</span>
                    <span className="font-medium text-gray-900">${success.newBalance.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Referencia:</span>
                    <span className="font-mono text-xs text-gray-700">{success.transactionNumber}</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Los fondos seran depositados en tu cuenta bancaria en 1-2 dias habiles.
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-all"
              >
                Cerrar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Balance disponible</span>
                  <span className="text-xl font-bold text-gray-900">${walletBalance.toFixed(2)}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Wallet: {walletNumber}
                </div>
              </div>

              {/* Bank Account Info */}
              {externalAccounts && externalAccounts.length > 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">Cuenta bancaria vinculada</span>
                  </div>
                  {externalAccounts.map((account) => (
                    <div key={account.id} className="flex items-center gap-2 ml-6">
                      <Building2 className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-700">
                        {account.bankName || 'Banco'} ****{account.last4}
                      </span>
                      {account.default && (
                        <span className="text-xs bg-green-200 text-green-700 px-2 py-0.5 rounded">Principal</span>
                      )}
                    </div>
                  ))}
                  <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                    <AlertCircle className="w-3 h-3 inline-block mr-1" />
                    Comunicate con atencion al cliente para cualquier cashout.
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm text-yellow-800">No hay cuenta bancaria vinculada</span>
                  </div>
                  <p className="text-xs text-yellow-700 mt-1 ml-6">
                    Para poder retirar fondos, primero necesitas vincular tu cuenta bancaria.
                  </p>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monto a retirar
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <DollarSign className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    step="0.0001"
                    min={MIN_CASHOUT}
                    max={walletBalance}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-10 pr-20 py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg font-medium text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={handleSetMax}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-sm font-medium text-green-600 hover:text-green-700"
                    disabled={loading}
                  >
                    MAX
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Minimo: ${MIN_CASHOUT} | Sin comision
                </p>
              </div>

              <div className="flex gap-2 mb-4">
                {[25, 50, 100, 200].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleQuickAmount(val)}
                    disabled={val > walletBalance || loading}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-all ${
                      val > walletBalance
                        ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                        : 'border-gray-200 text-gray-700 hover:border-green-500 hover:text-green-600'
                    }`}
                  >
                    ${val}
                  </button>
                ))}
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {amountNum > 0 && isValidAmount && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-medium text-green-800 mb-2">Resumen del retiro</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-green-700">Monto a retirar:</span>
                      <span className="font-medium text-green-800">${amountNum.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Comision:</span>
                      <span className="font-medium text-green-800">$0.00</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-green-200">
                      <span className="text-green-700">Recibiras:</span>
                      <span className="font-bold text-green-800">${amountNum.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !isValidAmount}
                  className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <ArrowDownToLine className="w-4 h-4" />
                      Retirar
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {!success && connectStatus === 'active' && (
          <div className="px-6 pb-6">
            <p className="text-xs text-center text-gray-500">
              Los fondos seran transferidos a tu cuenta bancaria vinculada en 1-2 dias habiles.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
