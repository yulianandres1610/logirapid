'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ChevronLeft,
  Package,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  FileCheck,
  DollarSign
} from 'lucide-react'

interface CountLine {
  id: number
  productId: number
  productName: string
  productSku: string
  productBarcode: string
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

  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [terminal, setTerminal] = useState<Terminal | null>(null)
  const [countData, setCountData] = useState<CountData | null>(null)
  const [sessionId, setSessionId] = useState<number | null>(null)

  // Load data
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

        // Load open session
        const sessionRes = await fetch(`/api/market/pos/sessions?terminalId=${terminalId}&status=open`)
        const sessionData = await sessionRes.json()
        if (!sessionData.success) throw new Error(sessionData.error)

        if (!sessionData.data || sessionData.data.length === 0) {
          throw new Error('No hay sesión abierta para este terminal')
        }

        const openSession = sessionData.data[0]
        setSessionId(openSession.id)

        // Load count data
        const countRes = await fetch(`/api/market/pos/inventory-count?sessionId=${openSession.id}`)
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

  // Go back to count page
  const goBackToCount = useCallback(() => {
    router.push(`/dashboard/market/pos/${terminalId}/count`)
  }, [router, terminalId])

  // Complete count and go to close
  const completeAndContinue = useCallback(async () => {
    if (!countData || !sessionId) return

    try {
      setCompleting(true)

      // Complete the count
      const response = await fetch('/api/market/pos/inventory-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          warehouseId: countData.warehouseId,
          lines: countData.lines.map(l => ({
            productId: l.productId,
            productName: l.productName,
            productSku: l.productSku,
            productBarcode: l.productBarcode,
            unitPrice: l.unitPrice,
            countedQuantity: l.countedQuantity
          })),
          action: 'complete'
        })
      })

      const data = await response.json()
      if (!data.success) throw new Error(data.error)

      // Navigate to close page
      router.push(`/dashboard/market/pos/${terminalId}/close`)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al completar conteo')
      setCompleting(false)
    }
  }, [countData, sessionId, terminalId, router])

  // Calculate totals
  const totals = countData ? {
    totalProducts: countData.lines.length,
    productsWithDifferences: countData.lines.filter(l => l.difference !== 0).length,
    productsWithExcess: countData.lines.filter(l => l.difference > 0).length,
    productsWithShortage: countData.lines.filter(l => l.difference < 0).length,
    totalDifferenceValue: countData.lines.reduce((sum, l) => sum + l.differenceValue, 0),
    totalExpected: countData.lines.reduce((sum, l) => sum + l.expectedQuantity, 0),
    totalCounted: countData.lines.reduce((sum, l) => sum + l.countedQuantity, 0),
    totalSold: countData.lines.reduce((sum, l) => sum + l.soldToday, 0)
  } : null

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
      </div>
    )
  }

  // Error state (no count data)
  if (error || !countData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <p className="text-red-400 mb-4">{error || 'No hay datos de conteo'}</p>
          <button
            onClick={goBackToCount}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Ir a Contar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <button
            onClick={goBackToCount}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold">Reporte de Conteo - {countData.countNumber}</h1>
            <p className="text-sm text-gray-400">
              {terminal?.name} | Almacén: {countData.warehouseName}
            </p>
          </div>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-800 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <Package className="w-4 h-4" />
            <span className="text-sm">Productos Contados</span>
          </div>
          <p className="text-2xl font-bold">{totals?.totalProducts}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-800 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">Con Diferencias</span>
          </div>
          <p className={`text-2xl font-bold ${totals?.productsWithDifferences ? 'text-amber-400' : 'text-green-400'}`}>
            {totals?.productsWithDifferences}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-800 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-sm">Sobrantes</span>
          </div>
          <p className="text-2xl font-bold text-green-400">{totals?.productsWithExcess || 0}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-800 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <span className="text-sm">Faltantes</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{totals?.productsWithShortage || 0}</p>
        </motion.div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-4">
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-300">Producto</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-300">Stock Sistema</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-300">Vendido Hoy</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-300">Contado</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-300">Diferencia</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-300">Valor Dif.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {countData.lines.map((line, index) => {
                const hasDifference = line.difference !== 0
                const isExcess = line.difference > 0
                const isShortage = line.difference < 0

                return (
                  <motion.tr
                    key={line.id || index}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.02 }}
                    className={`${hasDifference ? (isExcess ? 'bg-green-900/20' : 'bg-red-900/20') : ''}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{line.productName}</p>
                      <p className="text-xs text-gray-400">{line.productSku || line.productBarcode}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {line.expectedQuantity}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-blue-400">
                      {line.soldToday || 0}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold">
                      {line.countedQuantity}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isExcess && <TrendingUp className="w-4 h-4 text-green-400" />}
                        {isShortage && <TrendingDown className="w-4 h-4 text-red-400" />}
                        {!hasDifference && <CheckCircle2 className="w-4 h-4 text-gray-500" />}
                        <span className={`font-mono font-bold ${
                          isExcess ? 'text-green-400' :
                          isShortage ? 'text-red-400' :
                          'text-gray-500'
                        }`}>
                          {line.difference > 0 ? '+' : ''}{line.difference}
                        </span>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${
                      isExcess ? 'text-green-400' :
                      isShortage ? 'text-red-400' :
                      'text-gray-500'
                    }`}>
                      {line.differenceValue > 0 ? '+' : ''}{line.differenceValue.toFixed(2)}
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
            <tfoot className="bg-gray-700">
              <tr>
                <td className="px-4 py-3 font-bold">TOTALES</td>
                <td className="px-4 py-3 text-right font-mono font-bold">{totals?.totalExpected}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-blue-400">{totals?.totalSold || 0}</td>
                <td className="px-4 py-3 text-right font-mono font-bold">{totals?.totalCounted}</td>
                <td className="px-4 py-3 text-right font-mono font-bold">
                  {(totals?.totalCounted || 0) - (totals?.totalExpected || 0)}
                </td>
                <td className={`px-4 py-3 text-right font-mono font-bold ${
                  (totals?.totalDifferenceValue || 0) > 0 ? 'text-green-400' :
                  (totals?.totalDifferenceValue || 0) < 0 ? 'text-red-400' :
                  'text-gray-500'
                }`}>
                  ${(totals?.totalDifferenceValue || 0).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Summary Box */}
      {totals && totals.productsWithDifferences > 0 && (
        <div className="px-4 pb-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-900/30 border border-amber-700/50 rounded-xl p-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
              <div>
                <p className="font-medium text-amber-300">
                  Se detectaron diferencias en {totals.productsWithDifferences} producto{totals.productsWithDifferences !== 1 ? 's' : ''}
                </p>
                <p className="text-sm text-amber-200/70 mt-1">
                  Al aprobar, se creará una operación de ajuste pendiente de aprobación por un valor neto de{' '}
                  <span className={`font-bold ${totals.totalDifferenceValue >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${totals.totalDifferenceValue.toFixed(2)}
                  </span>
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {totals && totals.productsWithDifferences === 0 && (
        <div className="px-4 pb-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-900/30 border border-green-700/50 rounded-xl p-4"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5" />
              <div>
                <p className="font-medium text-green-300">
                  ¡Conteo sin diferencias!
                </p>
                <p className="text-sm text-green-200/70 mt-1">
                  Todos los productos contados coinciden con el stock del sistema.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Footer */}
      <footer className="px-4 py-4 bg-gray-800 border-t border-gray-700 flex items-center justify-between">
        <button
          onClick={goBackToCount}
          disabled={completing}
          className="px-6 py-3 bg-gray-700 rounded-xl font-medium hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <RotateCcw className="w-5 h-5" />
          Volver a Contar
        </button>

        <button
          onClick={completeAndContinue}
          disabled={completing}
          className="px-8 py-3 bg-blue-600 rounded-xl font-semibold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {completing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <FileCheck className="w-5 h-5" />
          )}
          Aprobar y Cerrar Caja
          <ArrowRight className="w-5 h-5" />
        </button>
      </footer>
    </div>
  )
}
