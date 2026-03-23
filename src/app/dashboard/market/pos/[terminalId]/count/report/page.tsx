'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  Package,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  FileCheck,
  Printer,
  X,
  Calendar,
  MapPin,
  Hash
} from 'lucide-react'

interface CountLine {
  id: number
  productId: number
  variantId?: number | null
  variantName?: string | null
  productName: string
  productSku: string
  productBarcode: string
  productImage?: string
  unitPrice: number
  expectedQuantity: number
  countedQuantity: number
  difference: number
  differenceValue: number
  soldToday: number
}

interface CountData {
  id: number
  countNumber: string
  status: string
  sessionId: number
  sessionCode: string
  warehouseId: number
  warehouseName: string
  totalProducts: number
  productsWithDifferences: number
  totalDifferenceValue: number
  adjustmentOperationId: number | null
  lines: CountLine[]
  startedAt?: string
}

interface Terminal {
  id: number
  name: string
  warehouseId: number
  warehouseName: string
}

export default function InventoryCountReportPage() {
  const router = useRouter()
  const params = useParams()
  const terminalId = params.terminalId as string
  const printRef = useRef<HTMLDivElement>(null)

  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPrintPreview, setShowPrintPreview] = useState(false)

  const [terminal, setTerminal] = useState<Terminal | null>(null)
  const [countData, setCountData] = useState<CountData | null>(null)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printingWithService, setPrintingWithService] = useState(false)
  const [copies, setCopies] = useState(1)

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        const terminalRes = await fetch(`/api/market/pos/terminals/${terminalId}`)
        const terminalData = await terminalRes.json()
        if (!terminalData.success) throw new Error(terminalData.error)
        setTerminal(terminalData.data)

        const sessionRes = await fetch(`/api/market/pos/sessions?terminalId=${terminalId}&status=open`)
        const sessionData = await sessionRes.json()
        if (!sessionData.success) throw new Error(sessionData.error)

        const sessions = sessionData.data?.sessions || sessionData.data || []
        const sessionsArray = Array.isArray(sessions) ? sessions : []

        if (sessionsArray.length === 0) {
          throw new Error('No hay sesión abierta para este terminal')
        }

        const openSession = sessionsArray[0]
        setSessionId(openSession.id)

        // Use cache: 'no-store' and timestamp to ensure fresh data (critical for recount flow)
        const countRes = await fetch(
          `/api/market/pos/inventory-count?sessionId=${openSession.id}&_t=${Date.now()}`,
          { cache: 'no-store' }
        )
        const countResult = await countRes.json()

        if (!countResult.success) {
          throw new Error(countResult.error || 'Error al cargar conteo')
        }

        if (!countResult.data) {
          throw new Error('No se ha realizado ningún conteo para esta sesión')
        }

        setCountData(countResult.data)

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar datos')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [terminalId])

  const goBackToCount = useCallback(() => {
    router.push(`/dashboard/market/pos/${terminalId}/count`)
  }, [router, terminalId])

  // Complete count and go to cash close (arqueo)
  const completeAndGoToClose = useCallback(async () => {
    if (!countData || !sessionId) return

    try {
      setCompleting(true)

      const response = await fetch('/api/market/pos/inventory-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          warehouseId: countData.warehouseId,
          lines: countData.lines.map(l => ({
            productId: l.productId,
            variantId: l.variantId || null,
            variantName: l.variantName || null,
            productName: l.productName,
            productSku: l.productSku,
            productBarcode: l.productBarcode,
            productImage: l.productImage,
            unitPrice: l.unitPrice,
            countedQuantity: l.countedQuantity
          })),
          action: 'complete'
        })
      })

      const data = await response.json()
      if (!data.success) throw new Error(data.error)

      // Go directly to cash close (arqueo)
      router.push(`/dashboard/market/pos/${terminalId}/close`)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al completar conteo')
      setCompleting(false)
    }
  }, [countData, sessionId, terminalId, router])

  // Complete count and send to review (for counts with differences)
  const completeAndSendToReview = useCallback(async () => {
    if (!countData || !sessionId) return

    try {
      setCompleting(true)

      const response = await fetch('/api/market/pos/inventory-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          warehouseId: countData.warehouseId,
          lines: countData.lines.map(l => ({
            productId: l.productId,
            variantId: l.variantId || null,
            variantName: l.variantName || null,
            productName: l.productName,
            productSku: l.productSku,
            productBarcode: l.productBarcode,
            productImage: l.productImage,
            unitPrice: l.unitPrice,
            countedQuantity: l.countedQuantity
          })),
          action: 'complete'
        })
      })

      const data = await response.json()
      if (!data.success) throw new Error(data.error)

      // Go to count history for admin review
      router.push(`/dashboard/market/pos/${terminalId}/count/history?completed=${countData.countNumber}`)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al completar conteo')
      setCompleting(false)
    }
  }, [countData, sessionId, terminalId, router])

  // Just go to close without completing (for cases where count is already done)
  const goToClose = useCallback(() => {
    router.push(`/dashboard/market/pos/${terminalId}/close`)
  }, [router, terminalId])

  // Print services are now resolved automatically by the server via /api/print-jobs
  // Print with service
  const printWithService = async () => {
    if (!countData) return

    setPrintingWithService(true)
    try {
      const response = await fetch('/api/print-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: 'inventory_count_report',
          documentData: {
            countNumber: countData.countNumber,
            countId: countData.id,
            warehouseName: countData.warehouseName,
            terminalName: terminal?.name,
            totalProducts: countData.totalProducts,
            productsWithDifferences: countData.productsWithDifferences,
            totalDifferenceValue: countData.totalDifferenceValue,
            startedAt: countData.startedAt,
            status: countData.status,
            lines: countData.lines.map(l => ({
              productName: l.productName,
              productSku: l.productSku,
              expectedQuantity: l.expectedQuantity,
              countedQuantity: l.countedQuantity,
              difference: l.difference,
              differenceValue: l.differenceValue
            }))
          },
          copies,
          sourceType: 'inventory_count',
          sourceId: countData.id
        })
      })

      const data = await response.json()
      if (data.success) {
        setShowPrintModal(false)
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      console.error('Error printing with service:', err)
      // Fallback to browser print
      printBrowser()
      setShowPrintModal(false)
    } finally {
      setPrintingWithService(false)
    }
  }

  // Browser print fallback
  const printBrowser = useCallback(() => {
    setShowPrintPreview(true)
    setTimeout(() => {
      window.print()
    }, 300)
  }, [])

  // Handle print click
  const handlePrint = useCallback(() => {
    setShowPrintModal(true)
  }, [])

  // Calculate totals
  // difference = expected - counted: positivo = FALTANTE, negativo = SOBRANTE
  // Use strict tolerance (> not >=) to exclude differences of exactly 0.01 which are rounding errors
  const DIFF_TOLERANCE = 0.01
  const totals = countData ? {
    totalProducts: countData.lines.length,
    productsWithDifferences: countData.lines.filter(l => Math.abs(l.difference) > DIFF_TOLERANCE).length,
    productsWithExcess: countData.lines.filter(l => l.difference < -DIFF_TOLERANCE).length,    // negativo = sobrante (contó de más)
    productsWithShortage: countData.lines.filter(l => l.difference > DIFF_TOLERANCE).length,  // positivo = faltante (contó de menos)
    totalDifferenceValue: countData.lines.reduce((sum, l) => sum + l.differenceValue, 0),
    totalExpected: countData.lines.reduce((sum, l) => sum + l.expectedQuantity, 0),
    totalCounted: countData.lines.reduce((sum, l) => sum + l.countedQuantity, 0),
    totalSold: countData.lines.reduce((sum, l) => sum + l.soldToday, 0)
  } : null

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-400">Cargando reporte...</p>
        </div>
      </div>
    )
  }

  if (error || !countData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <p className="text-red-400 mb-4">{error || 'No hay datos de conteo'}</p>
          <button
            onClick={goBackToCount}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 font-medium"
          >
            Ir a Contar
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-content, #print-content * {
            visibility: visible;
          }
          #print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
          .print-table {
            width: 100%;
            border-collapse: collapse;
          }
          .print-table th, .print-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          .print-table th {
            background: #f5f5f5;
          }
        }
      `}</style>

      <div className="min-h-screen flex flex-col bg-gray-900 text-white">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 no-print">
          <div className="flex items-center justify-between px-3 sm:px-4 py-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <motion.button
                onClick={goBackToCount}
                className="p-2 hover:bg-gray-700 rounded-xl transition-colors"
                whileTap={{ scale: 0.95 }}
              >
                <ChevronLeft className="w-5 h-5" />
              </motion.button>
              <div className="min-w-0">
                <h1 className="font-semibold text-sm sm:text-base truncate">Reporte de Conteo</h1>
                <p className="text-xs text-gray-400 truncate">{countData.countNumber}</p>
              </div>
            </div>
            <motion.button
              onClick={handlePrint}
              className="p-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl transition-colors flex items-center gap-2"
              whileTap={{ scale: 0.95 }}
            >
              <Printer className="w-5 h-5" />
              <span className="hidden sm:inline text-sm font-medium">Imprimir</span>
            </motion.button>
          </div>
        </header>

        {/* Info Bar */}
        <div className="px-3 sm:px-4 py-2 bg-gray-800/50 border-b border-gray-700/50 no-print">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-400">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {countData.warehouseName}
            </span>
            <span className="flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5" />
              {terminal?.name}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {new Date().toLocaleDateString('es-ES')}
            </span>
          </div>
        </div>

        {/* Summary Cards - Scrollable on mobile */}
        <div className="p-3 sm:p-4 no-print">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gray-800 rounded-xl p-3 sm:p-4"
            >
              <div className="flex items-center gap-2 text-gray-400 mb-1">
                <Package className="w-4 h-4" />
                <span className="text-xs">Contados</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold">{totals?.totalProducts}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 }}
              className="bg-gray-800 rounded-xl p-3 sm:p-4"
            >
              <div className="flex items-center gap-2 text-gray-400 mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs">Diferencias</span>
              </div>
              <p className={`text-xl sm:text-2xl font-bold ${totals?.productsWithDifferences ? 'text-amber-400' : 'text-green-400'}`}>
                {totals?.productsWithDifferences}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-gray-800 rounded-xl p-3 sm:p-4"
            >
              <div className="flex items-center gap-2 text-green-400 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs">Sobrantes</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-green-400">{totals?.productsWithExcess || 0}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
              className="bg-gray-800 rounded-xl p-3 sm:p-4"
            >
              <div className="flex items-center gap-2 text-red-400 mb-1">
                <TrendingDown className="w-4 h-4" />
                <span className="text-xs">Faltantes</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-red-400">{totals?.productsWithShortage || 0}</p>
            </motion.div>
          </div>
        </div>

        {/* Products List - Mobile Cards / Desktop Table */}
        <div className="flex-1 overflow-auto px-3 sm:px-4 pb-3">
          {/* Mobile View - Cards */}
          <div className="sm:hidden space-y-2">
            {countData.lines.map((line, index) => {
              const hasDifference = Math.abs(line.difference) > DIFF_TOLERANCE
              const isExcess = line.difference < -DIFF_TOLERANCE   // negativo = sobrante (contó de más)
              const isShortage = line.difference > DIFF_TOLERANCE  // positivo = faltante (contó de menos)

              return (
                <motion.div
                  key={line.id || index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className={`bg-gray-800 rounded-xl p-3 ${
                    hasDifference ? (isExcess ? 'ring-1 ring-green-500/30' : 'ring-1 ring-red-500/30') : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{line.productName}</p>
                      <p className="text-xs text-gray-500">{line.productSku || line.productBarcode}</p>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-bold ${
                      isExcess ? 'bg-green-500/20 text-green-400' :
                      isShortage ? 'bg-red-500/20 text-red-400' :
                      'bg-gray-700 text-gray-400'
                    }`}>
                      {isExcess && <TrendingUp className="w-3.5 h-3.5" />}
                      {isShortage && <TrendingDown className="w-3.5 h-3.5" />}
                      {!hasDifference && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {line.difference > 0 ? '+' : ''}{line.difference}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-700/50 rounded-lg py-1.5 px-2">
                      <p className="text-[10px] text-gray-500 uppercase">Sistema</p>
                      <p className="font-mono font-medium">{line.expectedQuantity}</p>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg py-1.5 px-2">
                      <p className="text-[10px] text-gray-500 uppercase">Contado</p>
                      <p className="font-mono font-bold text-blue-400">{line.countedQuantity}</p>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg py-1.5 px-2">
                      <p className="text-[10px] text-gray-500 uppercase">Valor</p>
                      <p className={`font-mono font-medium text-sm ${
                        isExcess ? 'text-green-400' : isShortage ? 'text-red-400' : 'text-gray-400'
                      }`}>
                        ${Math.abs(line.differenceValue).toFixed(0)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Desktop View - Table */}
          <div className="hidden sm:block bg-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Producto</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Sistema</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Vendido</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Contado</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Dif.</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {countData.lines.map((line, index) => {
                    const hasDifference = Math.abs(line.difference) > DIFF_TOLERANCE
                    const isExcess = line.difference < -DIFF_TOLERANCE   // negativo = sobrante
                    const isShortage = line.difference > DIFF_TOLERANCE  // positivo = faltante

                    return (
                      <tr
                        key={line.id || index}
                        className={`transition-colors ${
                          hasDifference ? (isExcess ? 'bg-green-900/10 hover:bg-green-900/20' : 'bg-red-900/10 hover:bg-red-900/20') : 'hover:bg-gray-700/30'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium">{line.productName}</p>
                          <p className="text-xs text-gray-500">{line.productSku || line.productBarcode}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-300">{line.expectedQuantity}</td>
                        <td className="px-4 py-3 text-right font-mono text-blue-400">{line.soldToday || 0}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold">{line.countedQuantity}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex items-center gap-1 font-mono font-bold ${
                            isExcess ? 'text-green-400' : isShortage ? 'text-red-400' : 'text-gray-500'
                          }`}>
                            {isExcess && <TrendingUp className="w-3.5 h-3.5" />}
                            {isShortage && <TrendingDown className="w-3.5 h-3.5" />}
                            {line.difference > 0 ? '+' : ''}{line.difference}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-mono ${
                          isExcess ? 'text-green-400' : isShortage ? 'text-red-400' : 'text-gray-500'
                        }`}>
                          ${line.differenceValue.toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-700/50">
                  <tr className="font-bold">
                    <td className="px-4 py-3">TOTALES</td>
                    <td className="px-4 py-3 text-right font-mono">{totals?.totalExpected}</td>
                    <td className="px-4 py-3 text-right font-mono text-blue-400">{totals?.totalSold || 0}</td>
                    <td className="px-4 py-3 text-right font-mono">{totals?.totalCounted}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {(totals?.totalCounted || 0) - (totals?.totalExpected || 0)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${
                      (totals?.totalDifferenceValue || 0) > 0 ? 'text-red-400' :
                      (totals?.totalDifferenceValue || 0) < 0 ? 'text-green-400' : 'text-gray-400'
                    }`}>
                      ${(totals?.totalDifferenceValue || 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Mobile Totals Summary */}
          <div className="sm:hidden mt-3 bg-gray-800 rounded-xl p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <p className="text-xs text-gray-500">Total Sistema</p>
                <p className="text-lg font-bold font-mono">{totals?.totalExpected}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Total Contado</p>
                <p className="text-lg font-bold font-mono text-blue-400">{totals?.totalCounted}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-700 text-center">
              <p className="text-xs text-gray-500">Valor Diferencia</p>
              <p className={`text-xl font-bold font-mono ${
                (totals?.totalDifferenceValue || 0) > 0 ? 'text-green-400' :
                (totals?.totalDifferenceValue || 0) < 0 ? 'text-red-400' : 'text-gray-400'
              }`}>
                ${(totals?.totalDifferenceValue || 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Alert Box */}
        <div className="px-3 sm:px-4 pb-2 no-print">
          {totals && totals.productsWithDifferences > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 sm:p-4"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-medium text-amber-300 text-sm sm:text-base">
                    {totals.productsWithDifferences} producto{totals.productsWithDifferences !== 1 ? 's' : ''} con diferencias
                  </p>
                  <p className="text-xs sm:text-sm text-amber-200/70 mt-1">
                    Se creará un ajuste por{' '}
                    <span className={`font-bold ${totals.totalDifferenceValue > 0 ? 'text-red-400' : totals.totalDifferenceValue < 0 ? 'text-green-400' : 'text-gray-400'}`}>
                      ${totals.totalDifferenceValue.toFixed(2)}
                    </span>
                  </p>
                </div>
              </div>
            </motion.div>
          ) : totals ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 sm:p-4"
            >
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-300 text-sm sm:text-base">¡Conteo sin diferencias!</p>
                  <p className="text-xs sm:text-sm text-green-200/70 mt-1">Todo coincide con el sistema.</p>
                </div>
              </div>
            </motion.div>
          ) : null}
        </div>

        {/* Footer - Different buttons based on differences */}
        <footer className="px-3 sm:px-4 py-3 sm:py-4 bg-gray-800 border-t border-gray-700 no-print">
          {totals && totals.productsWithDifferences > 0 ? (
            // WITH DIFFERENCES: Must send to review - admin approval required before arqueo
            <div className="flex flex-col gap-3">
              <p className="text-xs sm:text-sm text-amber-300 text-center">
                Este conteo tiene diferencias y requiere aprobación de un administrador antes de poder cerrar la caja.
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                <button
                  onClick={goBackToCount}
                  disabled={completing}
                  className="flex-1 sm:flex-initial px-4 py-2.5 sm:py-3 bg-gray-700 rounded-xl font-medium hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                  Recontar
                </button>

                <button
                  onClick={completeAndSendToReview}
                  disabled={completing}
                  className="flex-[2] sm:flex-initial px-4 sm:px-6 py-2.5 sm:py-3 bg-amber-600 rounded-xl font-semibold hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  {completing ? (
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                  <span>Enviar a Revisión del Admin</span>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
          ) : (
            // NO DIFFERENCES: Go to arqueo directly (print button is in header)
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <button
                onClick={goBackToCount}
                disabled={completing}
                className="flex-1 sm:flex-initial px-4 py-2.5 sm:py-3 bg-gray-700 rounded-xl font-medium hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                Recontar
              </button>

              <button
                onClick={completeAndGoToClose}
                disabled={completing}
                className="flex-[2] sm:flex-initial px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-green-500 to-green-600 rounded-xl font-semibold hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base shadow-lg shadow-green-500/25"
              >
                {completing ? (
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
                <span>Completar e Ir al Arqueo</span>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          )}
        </footer>
      </div>

      {/* Print Content - Hidden on screen, visible on print */}
      <div id="print-content" className="hidden print:block" ref={printRef}>
        <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #333', paddingBottom: '15px' }}>
            <h1 style={{ margin: '0 0 5px 0', fontSize: '24px' }}>Reporte de Conteo de Inventario</h1>
            <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>{countData.countNumber}</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '12px' }}>
            <div>
              <p><strong>Terminal:</strong> {terminal?.name}</p>
              <p><strong>Almacén:</strong> {countData.warehouseName}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p><strong>Fecha:</strong> {new Date().toLocaleDateString('es-ES')}</p>
              <p><strong>Hora:</strong> {new Date().toLocaleTimeString('es-ES')}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <div style={{ flex: 1, padding: '10px', background: '#f5f5f5', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Productos</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{totals?.totalProducts}</div>
            </div>
            <div style={{ flex: 1, padding: '10px', background: '#fff3cd', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Diferencias</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#856404' }}>{totals?.productsWithDifferences}</div>
            </div>
            <div style={{ flex: 1, padding: '10px', background: '#d4edda', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Sobrantes</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#155724' }}>{totals?.productsWithExcess}</div>
            </div>
            <div style={{ flex: 1, padding: '10px', background: '#f8d7da', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Faltantes</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#721c24' }}>{totals?.productsWithShortage}</div>
            </div>
          </div>

          <table className="print-table" style={{ fontSize: '11px' }}>
            <thead>
              <tr>
                <th>Producto</th>
                <th style={{ textAlign: 'right' }}>Sistema</th>
                <th style={{ textAlign: 'right' }}>Vendido</th>
                <th style={{ textAlign: 'right' }}>Contado</th>
                <th style={{ textAlign: 'right' }}>Diferencia</th>
                <th style={{ textAlign: 'right' }}>Valor Dif.</th>
              </tr>
            </thead>
            <tbody>
              {countData.lines.map((line, index) => (
                <tr key={index} style={{ background: Math.abs(line.difference) > 0.01 ? (line.difference > 0 ? '#f8d7da' : '#d4edda') : 'white' }}>
                  <td>
                    <div>{line.productName}</div>
                    <div style={{ fontSize: '10px', color: '#666' }}>{line.productSku || line.productBarcode}</div>
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{line.expectedQuantity}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{line.soldToday || 0}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{line.countedQuantity}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: line.difference > 0 ? '#721c24' : line.difference < 0 ? '#155724' : '#666' }}>
                    {line.difference > 0 ? '+' : ''}{line.difference}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: line.difference > 0 ? '#721c24' : line.difference < 0 ? '#155724' : '#666' }}>
                    ${line.differenceValue.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 'bold', background: '#e9ecef' }}>
                <td>TOTALES</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{totals?.totalExpected}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{totals?.totalSold || 0}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{totals?.totalCounted}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{(totals?.totalCounted || 0) - (totals?.totalExpected || 0)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', color: (totals?.totalDifferenceValue || 0) > 0 ? '#721c24' : (totals?.totalDifferenceValue || 0) < 0 ? '#155724' : '#666' }}>
                  ${(totals?.totalDifferenceValue || 0).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>

          <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ width: '45%' }}>
              <p style={{ borderTop: '1px solid #333', marginTop: '50px', paddingTop: '5px', fontSize: '12px' }}>Firma del Cajero</p>
            </div>
            <div style={{ width: '45%' }}>
              <p style={{ borderTop: '1px solid #333', marginTop: '50px', paddingTop: '5px', fontSize: '12px' }}>Firma del Supervisor</p>
            </div>
          </div>
        </div>
      </div>

      {/* Print Modal */}
      <AnimatePresence>
        {showPrintModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowPrintModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden bg-gray-800"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-700 bg-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-900/30">
                    <Package className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Imprimir Reporte de Conteo</h3>
                    <p className="text-xs text-gray-400">{countData.countNumber}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Copies Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Cantidad de copias
                  </label>
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={() => setCopies(Math.max(1, copies - 1))}
                      className="w-12 h-12 rounded-xl flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white"
                    >
                      <span className="text-xl font-bold">-</span>
                    </button>
                    <div className="w-20 h-12 rounded-xl flex items-center justify-center text-2xl font-bold bg-gray-700 text-white">
                      {copies}
                    </div>
                    <button
                      onClick={() => setCopies(Math.min(10, copies + 1))}
                      className="w-12 h-12 rounded-xl flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white"
                    >
                      <span className="text-xl font-bold">+</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/50 flex gap-3">
                <button
                  onClick={() => {
                    setShowPrintModal(false)
                    printBrowser()
                  }}
                  className="flex-1 py-3 rounded-xl font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                >
                  Imprimir (Navegador)
                </button>
                <button
                  onClick={printWithService}
                  disabled={printingWithService}
                  className="flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 disabled:opacity-50"
                >
                  {printingWithService ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Printer className="w-5 h-5" />
                  )}
                  {printingWithService ? 'Enviando...' : `Imprimir ${copies > 1 ? `(${copies})` : ''}`}
                  </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
