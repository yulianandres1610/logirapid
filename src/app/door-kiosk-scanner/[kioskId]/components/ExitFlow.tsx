'use client'

import { motion } from 'framer-motion'
import { LogOut, CheckCircle, FileText, ScanLine, AlertTriangle } from 'lucide-react'

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

/**
 * Exit flow with invoice validation — optimized for TC21K 5" screen
 */
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

  // No pending sales — simple exit button
  if (!hasPending) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-stone-900/95 px-5"
      >
        <div className="w-14 h-14 bg-blue-500/20 rounded-full flex items-center justify-center mb-3 border-2 border-blue-500/40">
          <LogOut className="w-7 h-7 text-blue-400" />
        </div>

        <p className="text-lg font-bold text-white mb-0.5">{visitorName}</p>
        <p className="text-xs text-stone-400 mb-0.5">{idNumber}</p>
        {timeInside && <p className="text-xs text-stone-500 mb-4">Tiempo dentro: {timeInside}</p>}

        <button
          onClick={onConfirmExit}
          disabled={loading}
          className="w-full max-w-[300px] py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold rounded-xl transition-colors disabled:opacity-50"
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
      className="fixed inset-0 z-50 flex flex-col bg-stone-900/95 px-4 py-3 overflow-y-auto"
    >
      <div className="flex-1 flex flex-col items-center justify-center max-w-[300px] mx-auto w-full">
        {/* Visitor info */}
        <div className="text-center mb-3">
          <p className="text-lg font-bold text-white leading-tight">{visitorName}</p>
          <p className="text-xs text-stone-400">{idNumber}</p>
          {timeInside && <p className="text-[10px] text-stone-500">Tiempo dentro: {timeInside}</p>}
        </div>

        {/* Pending invoices */}
        <div className="w-full mb-3">
          <div className="flex items-center gap-1.5 text-orange-400 mb-1.5">
            <FileText className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">Facturas pendientes ({pendingSales.length})</span>
          </div>

          <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
            {pendingSales.map((sale) => {
              const isValidated = sale.alreadyValidated ||
                scannedInvoices.some(s => s.documentNumber === sale.documentNumber && s.validated)
              return (
                <div
                  key={`${sale.type}-${sale.id}`}
                  className={`flex items-center justify-between p-2.5 rounded-lg ${
                    isValidated ? 'bg-green-900/30 border border-green-800' : 'bg-stone-800'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{sale.documentNumber}</p>
                    <p className="text-[10px] text-stone-400">${sale.total.toFixed(2)} {sale.currency}</p>
                  </div>
                  {isValidated ? (
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-stone-600 flex-shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Scan invoice prompt */}
        {!allValidated && (
          <div className="flex items-center gap-1.5 text-stone-400 mb-3">
            <ScanLine className="w-3.5 h-3.5" />
            <span className="text-xs">
              {scanningInvoice ? 'Escaneando...' : 'Escanee el ticket para validar'}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="w-full space-y-1.5">
          <button
            onClick={onConfirmExit}
            disabled={loading}
            className={`w-full py-3.5 text-white text-base font-semibold rounded-xl transition-colors disabled:opacity-50 ${
              allValidated
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Registrando...' : 'Confirmar Salida'}
          </button>

          {!allValidated && (
            <button
              onClick={onExitWithoutValidation}
              disabled={loading}
              className="w-full py-2.5 text-stone-400 hover:text-stone-300 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Salir sin validar facturas
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
