'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  Package,
  CheckCircle2,
  Clock,
  Calendar,
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertCircle,
  FileText,
  ArrowRight,
  X,
  Eye,
  Printer
} from 'lucide-react'
import { PrintDocumentModal } from '@/components/print/PrintDocumentModal'

interface CountHistory {
  id: number
  countNumber: string
  status: string
  warehouseName: string
  totalProducts: number
  productsWithDifferences: number
  totalDifferenceValue: number
  startedAt: string
  completedAt: string | null
}

interface Terminal {
  id: number
  name: string
}

export default function CountHistoryPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const terminalId = params.terminalId as string
  const completedCount = searchParams.get('completed')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [terminal, setTerminal] = useState<Terminal | null>(null)
  const [counts, setCounts] = useState<CountHistory[]>([])
  const [showSuccessMessage, setShowSuccessMessage] = useState(!!completedCount)
  const [printCount, setPrintCount] = useState<CountHistory | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Load terminal info
        const terminalRes = await fetch(`/api/market/pos/terminals/${terminalId}`)
        const terminalData = await terminalRes.json()
        if (!terminalData.success) throw new Error(terminalData.error)
        setTerminal(terminalData.data)

        // Load count history
        const historyRes = await fetch(`/api/market/pos/inventory-count/history?terminalId=${terminalId}`)
        const historyData = await historyRes.json()
        if (historyData.success && historyData.data) {
          setCounts(historyData.data)
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar historial')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [terminalId])

  // Auto-hide success message
  useEffect(() => {
    if (showSuccessMessage) {
      const timer = setTimeout(() => setShowSuccessMessage(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [showSuccessMessage])

  const goBack = useCallback(() => {
    router.push(`/dashboard/market/pos/${terminalId}`)
  }, [router, terminalId])

  const goToNewCount = useCallback(() => {
    router.push(`/dashboard/market/pos/${terminalId}/count`)
  }, [router, terminalId])

  const goToClose = useCallback(() => {
    router.push(`/dashboard/market/pos/${terminalId}/close`)
  }, [router, terminalId])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-400">Cargando historial...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <motion.button
              onClick={goBack}
              className="p-2 hover:bg-gray-700 rounded-xl transition-colors"
              whileTap={{ scale: 0.95 }}
            >
              <ChevronLeft className="w-5 h-5" />
            </motion.button>
            <div>
              <h1 className="font-semibold">Historial de Conteos</h1>
              <p className="text-xs text-gray-400">{terminal?.name}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Success Message */}
      <AnimatePresence>
        {showSuccessMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mx-4 mt-4 bg-green-500/20 border border-green-500/50 rounded-xl p-4 flex items-start gap-3"
          >
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-green-300">Conteo completado exitosamente</p>
              <p className="text-sm text-green-200/70 mt-1">
                El conteo {completedCount} ha sido guardado. Puede proceder a cerrar la caja.
              </p>
            </div>
            <button
              onClick={() => setShowSuccessMessage(false)}
              className="p-1 hover:bg-green-500/20 rounded-lg"
            >
              <X className="w-4 h-4 text-green-400" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      <div className="p-4 grid grid-cols-2 gap-3">
        <motion.button
          onClick={goToNewCount}
          className="bg-blue-600 hover:bg-blue-500 rounded-xl p-4 text-left"
          whileTap={{ scale: 0.98 }}
        >
          <Package className="w-6 h-6 mb-2" />
          <p className="font-semibold">Nuevo Conteo</p>
          <p className="text-xs text-blue-200/70">Iniciar conteo de inventario</p>
        </motion.button>

        <motion.button
          onClick={goToClose}
          className="bg-gray-700 hover:bg-gray-600 rounded-xl p-4 text-left"
          whileTap={{ scale: 0.98 }}
        >
          <FileText className="w-6 h-6 mb-2" />
          <p className="font-semibold">Cerrar Caja</p>
          <p className="text-xs text-gray-400">Continuar al cierre</p>
        </motion.button>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        <h2 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Conteos Anteriores
        </h2>

        {error ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-500" />
            <p className="text-red-400">{error}</p>
          </div>
        ) : counts.length === 0 ? (
          <div className="text-center py-12 bg-gray-800 rounded-xl">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p className="text-gray-400">No hay conteos registrados</p>
            <p className="text-xs text-gray-500 mt-1">Los conteos completados aparecerán aquí</p>
          </div>
        ) : (
          <div className="space-y-3">
            {counts.map((count, index) => (
              <motion.div
                key={count.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`bg-gray-800 rounded-xl p-4 ${
                  count.countNumber === completedCount ? 'ring-2 ring-green-500/50' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{count.countNumber}</span>
                      {count.status === 'completed' ? (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                          Completado
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                          En progreso
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(count.completedAt || count.startedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPrintCount(count)}
                      className="p-2 hover:bg-gray-700 rounded-lg"
                      title="Imprimir reporte"
                    >
                      <Printer className="w-4 h-4 text-gray-400" />
                    </button>
                    <button className="p-2 hover:bg-gray-700 rounded-lg" title="Ver detalles">
                      <Eye className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-700/50 rounded-lg py-2">
                    <p className="text-[10px] text-gray-500 uppercase">Productos</p>
                    <p className="font-bold">{count.totalProducts}</p>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg py-2">
                    <p className="text-[10px] text-gray-500 uppercase">Diferencias</p>
                    <p className={`font-bold ${count.productsWithDifferences > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                      {count.productsWithDifferences}
                    </p>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg py-2">
                    <p className="text-[10px] text-gray-500 uppercase">Valor</p>
                    <p className={`font-bold text-sm ${
                      count.totalDifferenceValue > 0 ? 'text-green-400' :
                      count.totalDifferenceValue < 0 ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      ${Math.abs(count.totalDifferenceValue).toFixed(0)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Print Modal */}
      {printCount && (
        <PrintDocumentModal
          isOpen={!!printCount}
          onClose={() => setPrintCount(null)}
          documentType="inventory_count_report"
          documentTitle={`Conteo ${printCount.countNumber}`}
          documentData={{
            countNumber: printCount.countNumber,
            countId: printCount.id,
            warehouseName: printCount.warehouseName,
            terminalName: terminal?.name,
            totalProducts: printCount.totalProducts,
            productsWithDifferences: printCount.productsWithDifferences,
            totalDifferenceValue: printCount.totalDifferenceValue,
            startedAt: printCount.startedAt,
            completedAt: printCount.completedAt,
            status: printCount.status
          }}
          sourceType="inventory_count"
          sourceId={printCount.id}
          onPrintSuccess={() => setPrintCount(null)}
        />
      )}
    </div>
  )
}
