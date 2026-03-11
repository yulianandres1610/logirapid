'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { LogOut, CheckCircle, FileText, ScanLine, AlertTriangle, X } from 'lucide-react'

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

interface Props {
  visitorName: string
  idNumber: string
  entryTime: string | null
  pendingSales: PendingSale[]
  scannedInvoices: ScannedInvoice[]
  scanningInvoice: boolean
  onConfirmExit: () => void
  onExitWithoutValidation: () => void
  loading?: boolean
}

export default function ExitFlow({
  visitorName,
  idNumber,
  entryTime,
  pendingSales,
  scannedInvoices,
  scanningInvoice,
  onConfirmExit,
  onExitWithoutValidation,
  loading,
}: Props) {
  // Calculate time inside
  const timeInside = entryTime
    ? (() => {
        const diff = Date.now() - new Date(entryTime).getTime()
        const hours = Math.floor(diff / 3600000)
        const minutes = Math.floor((diff % 3600000) / 60000)
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
      })()
    : null

  const hasPending = pendingSales.length > 0
  const allValidated = hasPending && pendingSales.every(
    sale => sale.alreadyValidated || scannedInvoices.some(s => s.documentNumber === sale.documentNumber && s.validated)
  )

  // Auto-confirm countdown for exit success
  const [exitSuccess, setExitSuccess] = useState(false)
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    if (exitSuccess) {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [exitSuccess])

  // No pending sales - simple exit
  if (!hasPending) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-stone-900/95 p-6"
      >
        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 border-2 border-blue-500/40">
          <LogOut className="w-8 h-8 text-blue-400" />
        </div>

        <p className="text-xl font-bold text-white mb-1">{visitorName}</p>
        <p className="text-sm text-stone-400 mb-1">{idNumber}</p>
        {timeInside && <p className="text-sm text-stone-400 mb-6">Tiempo dentro: {timeInside}</p>}

        <button
          onClick={onConfirmExit}
          disabled={loading}
          className="w-full max-w-sm py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-2xl transition-colors disabled:opacity-50"
        >
          {loading ? 'Registrando...' : 'Registrar Salida'}
        </button>
      </motion.div>
    )
  }

  // Has pending sales
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-stone-900/95 p-4 overflow-y-auto"
    >
      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
        {/* Visitor info */}
        <div className="text-center mb-4">
          <p className="text-xl font-bold text-white">{visitorName}</p>
          <p className="text-sm text-stone-400">{idNumber}</p>
          {timeInside && <p className="text-xs text-stone-500">Tiempo dentro: {timeInside}</p>}
        </div>

        {/* Pending invoices */}
        <div className="w-full mb-4">
          <div className="flex items-center gap-2 text-orange-400 mb-2">
            <FileText className="w-4 h-4" />
            <span className="text-sm font-semibold">Facturas pendientes ({pendingSales.length})</span>
          </div>

          <div className="space-y-2">
            {pendingSales.map((sale) => {
              const isValidated = sale.alreadyValidated ||
                scannedInvoices.some(s => s.documentNumber === sale.documentNumber && s.validated)
              return (
                <div
                  key={`${sale.type}-${sale.id}`}
                  className={`flex items-center justify-between p-3 rounded-xl ${
                    isValidated ? 'bg-green-900/30 border border-green-800' : 'bg-stone-800'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{sale.documentNumber}</p>
                    <p className="text-xs text-stone-400">${sale.total.toFixed(2)} {sale.currency}</p>
                  </div>
                  {isValidated ? (
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-stone-600 flex-shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Scan invoice prompt */}
        {!allValidated && (
          <div className="flex items-center gap-2 text-stone-400 mb-4">
            <ScanLine className="w-4 h-4" />
            <span className="text-sm">
              {scanningInvoice ? 'Escaneando...' : 'Escanee el ticket para validar'}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="w-full space-y-2">
          <button
            onClick={onConfirmExit}
            disabled={loading}
            className={`w-full py-4 text-white text-lg font-semibold rounded-2xl transition-colors disabled:opacity-50 ${
              allValidated
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Registrando...' : allValidated ? 'Confirmar Salida' : 'Confirmar Salida'}
          </button>

          {!allValidated && (
            <button
              onClick={onExitWithoutValidation}
              disabled={loading}
              className="w-full py-3 text-stone-400 hover:text-stone-300 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              Salir sin validar facturas
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
