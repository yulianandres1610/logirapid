'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign,
  ChevronLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  TrendingUp,
  TrendingDown,
  Receipt,
  Clock,
  ShoppingCart,
  Package,
  ClipboardCheck,
  AlertTriangle
} from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface SessionDetails {
  id: number
  sessionCode: string
  terminalName: string
  openedAt: string
  openingCash: { usd: number; cup: number; mlc: number }
  expectedCash: { usd: number; cup: number; mlc: number }
  summary: {
    paidOrders: number
    voidedOrders: number
    refundedOrders: number
    totalSales: number
    totalRefunds: number
    totalDiscounts: number
  }
  paymentsByMethod: Array<{
    method: string
    currency: string
    amount: number
    count: number
  }>
}

interface InventoryCountSummary {
  id: number
  countNumber: string
  status: string
  warehouseName: string
  totalProducts: number
  productsWithDifferences: number
  totalDifferenceValue: number
  adjustmentOperationId: number | null
  completedAt: string | null
}

export default function CloseSessionPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const params = useParams()
  const terminalId = params.terminalId as string

  const [session, setSession] = useState<SessionDetails | null>(null)
  const [inventoryCount, setInventoryCount] = useState<InventoryCountSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countMissing, setCountMissing] = useState(false)

  const [closingCash, setClosingCash] = useState({ usd: 0, cup: 0, mlc: 0 })
  const [closingNotes, setClosingNotes] = useState('')
  const [countPendingApproval, setCountPendingApproval] = useState(false)

  useEffect(() => {
    const fetchSession = async () => {
      try {
        // Get open session for this terminal
        const sessionsRes = await fetch(`/api/market/pos/sessions?terminalId=${terminalId}&status=open`)
        const sessionsData = await sessionsRes.json()

        if (!sessionsData.success || sessionsData.data.sessions.length === 0) {
          router.push('/dashboard/market/pos')
          return
        }

        const openSession = sessionsData.data.sessions[0]

        // Check if inventory count exists - use 'any' status to find both in_progress and completed
        const countRes = await fetch(`/api/market/pos/inventory-count?sessionId=${openSession.id}&status=any`)
        const countData = await countRes.json()

        // Si no hay ningún conteo registrado, mostrar mensaje de que se requiere conteo
        if (!countData.success || !countData.data) {
          // No hay ningún conteo - mostrar mensaje de conteo requerido
          setCountMissing(true)
          setLoading(false)
          return
        }

        // Si el conteo está en progreso pero no completado, también mostrar mensaje
        if (countData.data.status === 'in_progress') {
          setCountMissing(true)
          setLoading(false)
          return
        }

        // Si el conteo está completado pero tiene diferencias y no está aprobado,
        // mostrar mensaje de que requiere aprobación del admin
        if (countData.data.status === 'completed' &&
            countData.data.productsWithDifferences > 0) {
          setCountPendingApproval(true)
          setInventoryCount({
            id: countData.data.id,
            countNumber: countData.data.countNumber,
            status: countData.data.status,
            warehouseName: countData.data.warehouseName,
            totalProducts: countData.data.totalProducts || 0,
            productsWithDifferences: countData.data.productsWithDifferences || 0,
            totalDifferenceValue: countData.data.totalDifferenceValue || 0,
            adjustmentOperationId: countData.data.adjustmentOperationId,
            completedAt: countData.data.completedAt
          })
          setLoading(false)
          return
        }

        setInventoryCount({
          id: countData.data.id,
          countNumber: countData.data.countNumber,
          status: countData.data.status,
          warehouseName: countData.data.warehouseName,
          totalProducts: countData.data.totalProducts || 0,
          productsWithDifferences: countData.data.productsWithDifferences || 0,
          totalDifferenceValue: countData.data.totalDifferenceValue || 0,
          adjustmentOperationId: countData.data.adjustmentOperationId,
          completedAt: countData.data.completedAt
        })

        // Get full session details
        const detailsRes = await fetch(`/api/market/pos/sessions/${openSession.id}`)
        const detailsData = await detailsRes.json()

        if (detailsData.success) {
          setSession(detailsData.data)
          // Pre-fill with expected values
          setClosingCash(detailsData.data.expectedCash)
        } else {
          setError(detailsData.error)
        }
      } catch (err) {
        setError('Error al cargar sesión')
      } finally {
        setLoading(false)
      }
    }

    fetchSession()
  }, [terminalId, router])

  const handleCloseSession = async () => {
    if (!session) return

    setClosing(true)
    try {
      const response = await fetch(`/api/market/pos/sessions/${session.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close',
          closingCashUsd: closingCash.usd,
          closingCashCup: closingCash.cup,
          closingCashMlc: closingCash.mlc,
          closingNotes
        })
      })

      const data = await response.json()

      if (data.success) {
        router.push('/dashboard/market/pos')
      } else {
        setError(data.error || 'Error al cerrar sesión')
      }
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setClosing(false)
    }
  }

  // Calculate differences
  const differences = session ? {
    usd: closingCash.usd - session.expectedCash.usd,
    cup: closingCash.cup - session.expectedCash.cup,
    mlc: closingCash.mlc - session.expectedCash.mlc
  } : { usd: 0, cup: 0, mlc: 0 }

  const totalDifferenceUsd = differences.usd + (differences.cup / 250) + (differences.mlc * 1.1)

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-500" />
              <p className="text-gray-500">Cargando sesión...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  // Inventory count required but not completed
  if (countMissing) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'max-w-md w-full rounded-2xl border shadow-xl p-8 text-center',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-amber-50 to-white border-amber-200'
              )}
            >
              <div className={cn(
                'w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center',
                theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100'
              )}>
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">Conteo de Inventario Requerido</h2>
              <p className="text-gray-500 mb-6">
                Antes de cerrar la caja, debes completar el conteo de inventario del almacén.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => router.push(`/dashboard/market/pos/${terminalId}`)}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl font-medium',
                    theme === 'dark'
                      ? 'bg-gray-800 hover:bg-gray-700'
                      : 'bg-gray-100 hover:bg-gray-200'
                  )}
                >
                  Volver al POS
                </button>
                <button
                  onClick={() => router.push(`/dashboard/market/pos/${terminalId}/count`)}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium shadow-lg shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700 flex items-center justify-center gap-2"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  Ir a Contar
                </button>
              </div>
            </motion.div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  // Count completed but has differences - waiting for admin approval
  if (countPendingApproval && inventoryCount) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'max-w-lg w-full rounded-2xl border shadow-xl p-8 text-center',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-amber-50 to-white border-amber-200'
              )}
            >
              <div className={cn(
                'w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center',
                theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100'
              )}>
                <Clock className="w-8 h-8 text-amber-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">Esperando Aprobación del Admin</h2>
              <p className="text-gray-500 mb-4">
                El conteo de inventario tiene diferencias y está pendiente de revisión por un administrador.
              </p>

              {/* Count Summary */}
              <div className={cn(
                'rounded-xl p-4 mb-6 text-left',
                theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'
              )}>
                <p className="text-sm text-gray-500 mb-2">Conteo: {inventoryCount.countNumber}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Productos contados</p>
                    <p className="font-bold">{inventoryCount.totalProducts}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Con diferencias</p>
                    <p className="font-bold text-amber-500">{inventoryCount.productsWithDifferences}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500">Valor diferencia</p>
                    <p className={cn(
                      'font-bold text-lg',
                      inventoryCount.totalDifferenceValue >= 0 ? 'text-green-500' : 'text-red-500'
                    )}>
                      ${inventoryCount.totalDifferenceValue.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-400 mb-6">
                Una vez que el administrador apruebe el conteo, podrás proceder con el cierre de caja.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => router.push(`/dashboard/market/pos/${terminalId}`)}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl font-medium',
                    theme === 'dark'
                      ? 'bg-gray-800 hover:bg-gray-700'
                      : 'bg-gray-100 hover:bg-gray-200'
                  )}
                >
                  Volver al POS
                </button>
                <button
                  onClick={() => router.push('/dashboard/market/pos/inventory-counts')}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium shadow-lg shadow-amber-500/25 hover:from-amber-600 hover:to-amber-700 flex items-center justify-center gap-2"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  Ver Estado
                </button>
              </div>
            </motion.div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (!session) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
              <p className="text-red-500 mb-4">{error || 'Sesión no encontrada'}</p>
              <button
                onClick={() => router.push('/dashboard/market/pos')}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg"
              >
                Volver
              </button>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto space-y-6"
          >
            {/* Header */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className={cn(
                  'p-2 rounded-lg',
                  theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                )}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Cerrar Sesión de Caja
                </h1>
                <p className="text-gray-500">
                  {session.sessionCode} • {session.terminalName}
                </p>
              </div>
            </div>

            {/* Session Summary */}
            <div className={cn(
              'rounded-2xl border shadow-xl p-6',
              theme === 'dark'
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
            )}>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Resumen de Sesión
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className={cn(
                  'p-4 rounded-xl',
                  theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                )}>
                  <p className="text-sm text-gray-500 mb-1">Ventas</p>
                  <p className="text-2xl font-bold text-green-500">
                    ${session.summary.totalSales.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {session.summary.paidOrders} órdenes
                  </p>
                </div>

                <div className={cn(
                  'p-4 rounded-xl',
                  theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                )}>
                  <p className="text-sm text-gray-500 mb-1">Reembolsos</p>
                  <p className="text-2xl font-bold text-red-500">
                    ${session.summary.totalRefunds.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {session.summary.refundedOrders} órdenes
                  </p>
                </div>

                <div className={cn(
                  'p-4 rounded-xl',
                  theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                )}>
                  <p className="text-sm text-gray-500 mb-1">Descuentos</p>
                  <p className="text-2xl font-bold text-amber-500">
                    ${session.summary.totalDiscounts.toFixed(2)}
                  </p>
                </div>

                <div className={cn(
                  'p-4 rounded-xl',
                  theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                )}>
                  <p className="text-sm text-gray-500 mb-1">Anuladas</p>
                  <p className="text-2xl font-bold text-gray-500">
                    {session.summary.voidedOrders}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">órdenes</p>
                </div>
              </div>

              {/* Payments by method */}
              {session.paymentsByMethod.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-3">Pagos por Método</h3>
                  <div className="space-y-2">
                    {session.paymentsByMethod.map((payment, i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg',
                          theme === 'dark' ? 'bg-gray-700/30' : 'bg-gray-50'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="capitalize">{payment.method}</span>
                          <span className="text-xs text-gray-500">({payment.currency})</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold">${payment.amount.toFixed(2)}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            ({payment.count} pagos)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Inventory Count Summary */}
            {inventoryCount && (
              <div className={cn(
                'rounded-2xl border shadow-xl p-6',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5 text-green-500" />
                    Conteo de Inventario Completado
                  </h2>
                  <span className="text-sm text-gray-500">{inventoryCount.countNumber}</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className={cn(
                    'p-4 rounded-xl',
                    theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                  )}>
                    <p className="text-sm text-gray-500 mb-1">Almacén</p>
                    <p className="font-bold">{inventoryCount.warehouseName || 'N/A'}</p>
                  </div>

                  <div className={cn(
                    'p-4 rounded-xl',
                    theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                  )}>
                    <p className="text-sm text-gray-500 mb-1">Productos Contados</p>
                    <p className="text-2xl font-bold">{inventoryCount.totalProducts}</p>
                  </div>

                  <div className={cn(
                    'p-4 rounded-xl',
                    inventoryCount.productsWithDifferences > 0
                      ? theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-50'
                      : theme === 'dark' ? 'bg-green-900/30' : 'bg-green-50'
                  )}>
                    <p className="text-sm text-gray-500 mb-1">Con Diferencias</p>
                    <p className={cn(
                      'text-2xl font-bold',
                      inventoryCount.productsWithDifferences > 0 ? 'text-amber-500' : 'text-green-500'
                    )}>
                      {inventoryCount.productsWithDifferences}
                    </p>
                  </div>

                  <div className={cn(
                    'p-4 rounded-xl',
                    inventoryCount.totalDifferenceValue === 0
                      ? theme === 'dark' ? 'bg-green-900/30' : 'bg-green-50'
                      : inventoryCount.totalDifferenceValue > 0
                      ? theme === 'dark' ? 'bg-green-900/30' : 'bg-green-50'
                      : theme === 'dark' ? 'bg-red-900/30' : 'bg-red-50'
                  )}>
                    <p className="text-sm text-gray-500 mb-1">Valor Diferencia</p>
                    <p className={cn(
                      'text-2xl font-bold',
                      inventoryCount.totalDifferenceValue === 0
                        ? 'text-green-500'
                        : inventoryCount.totalDifferenceValue > 0
                        ? 'text-green-500'
                        : 'text-red-500'
                    )}>
                      ${inventoryCount.totalDifferenceValue.toFixed(2)}
                    </p>
                  </div>
                </div>

                {inventoryCount.adjustmentOperationId && (
                  <div className={cn(
                    'mt-4 p-3 rounded-lg flex items-center gap-2 text-sm',
                    theme === 'dark' ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'
                  )}>
                    <Package className="w-4 h-4" />
                    Se creó una operación de ajuste pendiente de aprobación
                  </div>
                )}

                <button
                  onClick={() => router.push(`/dashboard/market/pos/${terminalId}/count/report`)}
                  className={cn(
                    'mt-4 w-full py-2 rounded-lg text-sm font-medium transition-colors',
                    theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600'
                      : 'bg-gray-100 hover:bg-gray-200'
                  )}
                >
                  Ver Reporte Completo
                </button>
              </div>
            )}

            {/* Cash Count */}
            <div className={cn(
              'rounded-2xl border shadow-xl p-6',
              theme === 'dark'
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
            )}>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Arqueo de Caja
              </h2>

              <div className="grid gap-6">
                {/* Opening Cash */}
                <div>
                  <h3 className="text-sm font-medium mb-3 text-gray-500">Efectivo de Apertura</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className={cn(
                      'p-3 rounded-lg text-center',
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                    )}>
                      <p className="text-xs text-gray-500">USD</p>
                      <p className="text-lg font-bold">${session.openingCash.usd.toFixed(2)}</p>
                    </div>
                    <div className={cn(
                      'p-3 rounded-lg text-center',
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                    )}>
                      <p className="text-xs text-gray-500">CUP</p>
                      <p className="text-lg font-bold">${session.openingCash.cup.toFixed(0)}</p>
                    </div>
                    <div className={cn(
                      'p-3 rounded-lg text-center',
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                    )}>
                      <p className="text-xs text-gray-500">MLC</p>
                      <p className="text-lg font-bold">${session.openingCash.mlc.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {/* Expected Cash */}
                <div>
                  <h3 className="text-sm font-medium mb-3 text-gray-500">Efectivo Esperado</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className={cn(
                      'p-3 rounded-lg text-center',
                      theme === 'dark' ? 'bg-blue-900/30 border border-blue-800/50' : 'bg-blue-50 border border-blue-200'
                    )}>
                      <p className="text-xs text-blue-600 dark:text-blue-400">USD</p>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        ${session.expectedCash.usd.toFixed(2)}
                      </p>
                    </div>
                    <div className={cn(
                      'p-3 rounded-lg text-center',
                      theme === 'dark' ? 'bg-blue-900/30 border border-blue-800/50' : 'bg-blue-50 border border-blue-200'
                    )}>
                      <p className="text-xs text-blue-600 dark:text-blue-400">CUP</p>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        ${session.expectedCash.cup.toFixed(0)}
                      </p>
                    </div>
                    <div className={cn(
                      'p-3 rounded-lg text-center',
                      theme === 'dark' ? 'bg-blue-900/30 border border-blue-800/50' : 'bg-blue-50 border border-blue-200'
                    )}>
                      <p className="text-xs text-blue-600 dark:text-blue-400">MLC</p>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        ${session.expectedCash.mlc.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actual Count */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Conteo Real</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">USD</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={closingCash.usd}
                        onChange={(e) => setClosingCash(prev => ({ ...prev, usd: parseFloat(e.target.value) || 0 }))}
                        className={cn(
                          'w-full px-3 py-2 rounded-xl border text-lg font-mono focus:outline-none focus:ring-2',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 focus:border-blue-500 focus:ring-blue-500/20'
                            : 'bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20'
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">CUP</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={closingCash.cup}
                        onChange={(e) => setClosingCash(prev => ({ ...prev, cup: parseFloat(e.target.value) || 0 }))}
                        className={cn(
                          'w-full px-3 py-2 rounded-xl border text-lg font-mono focus:outline-none focus:ring-2',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 focus:border-blue-500 focus:ring-blue-500/20'
                            : 'bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20'
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">MLC</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={closingCash.mlc}
                        onChange={(e) => setClosingCash(prev => ({ ...prev, mlc: parseFloat(e.target.value) || 0 }))}
                        className={cn(
                          'w-full px-3 py-2 rounded-xl border text-lg font-mono focus:outline-none focus:ring-2',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 focus:border-blue-500 focus:ring-blue-500/20'
                            : 'bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20'
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* Differences */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Diferencia</h3>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    {(['usd', 'cup', 'mlc'] as const).map(currency => {
                      const diff = differences[currency]
                      return (
                        <div
                          key={currency}
                          className={cn(
                            'p-3 rounded-lg text-center',
                            diff === 0
                              ? theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                              : diff > 0
                              ? theme === 'dark' ? 'bg-green-900/30' : 'bg-green-50'
                              : theme === 'dark' ? 'bg-red-900/30' : 'bg-red-50'
                          )}
                        >
                          <p className="text-xs text-gray-500 uppercase">{currency}</p>
                          <div className="flex items-center justify-center gap-1">
                            {diff > 0 ? (
                              <TrendingUp className="w-4 h-4 text-green-500" />
                            ) : diff < 0 ? (
                              <TrendingDown className="w-4 h-4 text-red-500" />
                            ) : null}
                            <p className={cn(
                              'text-lg font-bold',
                              diff === 0 ? '' : diff > 0 ? 'text-green-500' : 'text-red-500'
                            )}>
                              {diff >= 0 ? '+' : ''}{diff.toFixed(currency === 'cup' ? 0 : 2)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Total difference in USD */}
                  <div className={cn(
                    'p-4 rounded-xl',
                    Math.abs(totalDifferenceUsd) < 0.01
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : totalDifferenceUsd > 0
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : 'bg-red-100 dark:bg-red-900/30'
                  )}>
                    <p className="text-sm text-center mb-1">Diferencia Total (USD equiv.)</p>
                    <p className={cn(
                      'text-3xl font-bold text-center',
                      Math.abs(totalDifferenceUsd) < 0.01
                        ? 'text-green-600'
                        : totalDifferenceUsd > 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    )}>
                      {totalDifferenceUsd >= 0 ? '+' : ''}${totalDifferenceUsd.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium mb-2">Notas de Cierre</label>
                  <textarea
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    rows={3}
                    placeholder="Observaciones al cerrar la caja..."
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 resize-none',
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-700 focus:border-blue-500 focus:ring-blue-500/20'
                        : 'bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20'
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className={cn(
                'p-4 rounded-xl flex items-center gap-2',
                theme === 'dark'
                  ? 'bg-red-900/30 text-red-300 border border-red-800'
                  : 'bg-red-50 text-red-600 border border-red-200'
              )}>
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={() => router.back()}
                disabled={closing}
                className={cn(
                  'flex-1 py-3 rounded-xl font-medium',
                  theme === 'dark'
                    ? 'bg-gray-800 hover:bg-gray-700'
                    : 'bg-gray-100 hover:bg-gray-200'
                )}
              >
                Cancelar
              </button>
              <button
                onClick={handleCloseSession}
                disabled={closing}
                className={cn(
                  'flex-[2] py-3 rounded-xl font-bold flex items-center justify-center gap-2',
                  'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25',
                  closing && 'opacity-70 cursor-not-allowed'
                )}
              >
                {closing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Cerrando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Confirmar Cierre
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
