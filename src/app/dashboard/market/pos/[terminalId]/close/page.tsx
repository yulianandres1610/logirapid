'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  Package,
  ClipboardCheck,
  AlertTriangle,
  Plus,
  Minus,
  Calculator
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

// Denominations for each currency
const USD_DENOMINATIONS = [
  { value: 100, label: '$100', type: 'bill' },
  { value: 50, label: '$50', type: 'bill' },
  { value: 20, label: '$20', type: 'bill' },
  { value: 10, label: '$10', type: 'bill' },
  { value: 5, label: '$5', type: 'bill' },
  { value: 2, label: '$2', type: 'bill' },
  { value: 1, label: '$1', type: 'bill' },
  { value: 0.50, label: '50¢', type: 'coin' },
  { value: 0.25, label: '25¢', type: 'coin' },
  { value: 0.10, label: '10¢', type: 'coin' },
  { value: 0.05, label: '5¢', type: 'coin' },
  { value: 0.01, label: '1¢', type: 'coin' }
]

const CUP_DENOMINATIONS = [
  { value: 1000, label: '$1000', type: 'bill' },
  { value: 500, label: '$500', type: 'bill' },
  { value: 200, label: '$200', type: 'bill' },
  { value: 100, label: '$100', type: 'bill' },
  { value: 50, label: '$50', type: 'bill' },
  { value: 20, label: '$20', type: 'bill' },
  { value: 10, label: '$10', type: 'bill' },
  { value: 5, label: '$5', type: 'bill' },
  { value: 3, label: '$3', type: 'bill' },
  { value: 1, label: '$1', type: 'bill' },
  { value: 0.20, label: '20¢', type: 'coin' },
  { value: 0.05, label: '5¢', type: 'coin' },
  { value: 0.02, label: '2¢', type: 'coin' },
  { value: 0.01, label: '1¢', type: 'coin' }
]

const MLC_DENOMINATIONS = [
  { value: 100, label: '$100', type: 'bill' },
  { value: 50, label: '$50', type: 'bill' },
  { value: 20, label: '$20', type: 'bill' },
  { value: 10, label: '$10', type: 'bill' },
  { value: 5, label: '$5', type: 'bill' },
  { value: 1, label: '$1', type: 'bill' }
]

type CurrencyTab = 'usd' | 'cup' | 'mlc'

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
  const [countPendingApproval, setCountPendingApproval] = useState(false)

  // Denomination counts
  const [usdCounts, setUsdCounts] = useState<Record<number, number>>({})
  const [cupCounts, setCupCounts] = useState<Record<number, number>>({})
  const [mlcCounts, setMlcCounts] = useState<Record<number, number>>({})
  const [activeTab, setActiveTab] = useState<CurrencyTab>('usd')
  const [closingNotes, setClosingNotes] = useState('')

  // Calculate totals from denominations
  const calculateTotal = useCallback((counts: Record<number, number>, denominations: typeof USD_DENOMINATIONS) => {
    return denominations.reduce((sum, d) => sum + (counts[d.value] || 0) * d.value, 0)
  }, [])

  const closingCash = {
    usd: calculateTotal(usdCounts, USD_DENOMINATIONS),
    cup: calculateTotal(cupCounts, CUP_DENOMINATIONS),
    mlc: calculateTotal(mlcCounts, MLC_DENOMINATIONS)
  }

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const sessionsRes = await fetch(`/api/market/pos/sessions?terminalId=${terminalId}&status=open`)
        const sessionsData = await sessionsRes.json()

        if (!sessionsData.success || sessionsData.data.sessions.length === 0) {
          router.push('/dashboard/market/pos')
          return
        }

        const openSession = sessionsData.data.sessions[0]

        // Check if inventory count exists
        const countRes = await fetch(`/api/market/pos/inventory-count?sessionId=${openSession.id}&status=any`)
        const countData = await countRes.json()

        if (!countData.success || !countData.data) {
          setCountMissing(true)
          setLoading(false)
          return
        }

        if (countData.data.status === 'in_progress') {
          setCountMissing(true)
          setLoading(false)
          return
        }

        if (countData.data.status === 'completed' && countData.data.productsWithDifferences > 0) {
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

        const detailsRes = await fetch(`/api/market/pos/sessions/${openSession.id}`)
        const detailsData = await detailsRes.json()

        if (detailsData.success) {
          setSession(detailsData.data)
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

  // Increment/Decrement denomination count
  const updateCount = (currency: CurrencyTab, value: number, delta: number) => {
    if (currency === 'usd') {
      setUsdCounts(prev => ({ ...prev, [value]: Math.max(0, (prev[value] || 0) + delta) }))
    } else if (currency === 'cup') {
      setCupCounts(prev => ({ ...prev, [value]: Math.max(0, (prev[value] || 0) + delta) }))
    } else {
      setMlcCounts(prev => ({ ...prev, [value]: Math.max(0, (prev[value] || 0) + delta) }))
    }
  }

  const setCount = (currency: CurrencyTab, value: number, count: number) => {
    if (currency === 'usd') {
      setUsdCounts(prev => ({ ...prev, [value]: Math.max(0, count) }))
    } else if (currency === 'cup') {
      setCupCounts(prev => ({ ...prev, [value]: Math.max(0, count) }))
    } else {
      setMlcCounts(prev => ({ ...prev, [value]: Math.max(0, count) }))
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

  // Inventory count required
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
                    theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
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

  // Waiting for admin approval
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
                El conteo de inventario tiene diferencias y está pendiente de revisión.
              </p>
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
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => router.push(`/dashboard/market/pos/${terminalId}`)}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl font-medium',
                    theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
                  )}
                >
                  Volver al POS
                </button>
                <button
                  onClick={() => router.push('/dashboard/market/pos/inventory-counts')}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium"
                >
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

  const getDenominations = () => {
    if (activeTab === 'usd') return USD_DENOMINATIONS
    if (activeTab === 'cup') return CUP_DENOMINATIONS
    return MLC_DENOMINATIONS
  }

  const getCounts = () => {
    if (activeTab === 'usd') return usdCounts
    if (activeTab === 'cup') return cupCounts
    return mlcCounts
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-4 md:p-6">
          <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                )}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl md:text-2xl font-bold">Arqueo de Caja</h1>
                <p className="text-sm text-gray-500">{session.sessionCode} • {session.terminalName}</p>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
              {/* Left Column - Cash Count */}
              <div className={cn(
                'rounded-2xl border shadow-lg overflow-hidden',
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              )}>
                {/* Currency Tabs */}
                <div className="flex border-b border-gray-700">
                  {(['usd', 'cup', 'mlc'] as const).map(currency => (
                    <button
                      key={currency}
                      onClick={() => setActiveTab(currency)}
                      className={cn(
                        'flex-1 py-3 px-4 text-sm font-medium transition-colors relative',
                        activeTab === currency
                          ? 'text-blue-500'
                          : theme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
                      )}
                    >
                      <span className="uppercase">{currency}</span>
                      <span className="block text-xs mt-0.5 font-mono">
                        {currency === 'usd' && `$${closingCash.usd.toFixed(2)}`}
                        {currency === 'cup' && `$${closingCash.cup.toFixed(0)}`}
                        {currency === 'mlc' && `$${closingCash.mlc.toFixed(2)}`}
                      </span>
                      {activeTab === currency && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                        />
                      )}
                    </button>
                  ))}
                </div>

                {/* Denominations Grid */}
                <div className="p-3 md:p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {getDenominations().map(d => {
                      const count = getCounts()[d.value] || 0
                      const subtotal = count * d.value
                      return (
                        <div
                          key={d.value}
                          className={cn(
                            'rounded-xl p-2 md:p-3 transition-colors',
                            count > 0
                              ? theme === 'dark' ? 'bg-blue-900/30 border border-blue-700/50' : 'bg-blue-50 border border-blue-200'
                              : theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-sm">{d.label}</span>
                            <span className="text-xs text-gray-500">
                              {activeTab === 'cup' ? `$${subtotal.toFixed(0)}` : `$${subtotal.toFixed(2)}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => updateCount(activeTab, d.value, -1)}
                              disabled={count === 0}
                              className={cn(
                                'p-1.5 rounded-lg transition-colors',
                                count === 0
                                  ? 'opacity-30 cursor-not-allowed'
                                  : theme === 'dark' ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300'
                              )}
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={count}
                              onChange={e => setCount(activeTab, d.value, parseInt(e.target.value) || 0)}
                              className={cn(
                                'flex-1 text-center font-mono font-bold py-1 rounded-lg w-12',
                                theme === 'dark' ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300',
                                'border focus:outline-none focus:ring-1 focus:ring-blue-500'
                              )}
                            />
                            <button
                              onClick={() => updateCount(activeTab, d.value, 1)}
                              className={cn(
                                'p-1.5 rounded-lg transition-colors',
                                theme === 'dark' ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300'
                              )}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Currency Total */}
                  <div className={cn(
                    'mt-4 p-4 rounded-xl',
                    theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'
                  )}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Total {activeTab.toUpperCase()}</span>
                      <span className="text-2xl font-bold font-mono">
                        {activeTab === 'cup' ? `$${closingCash[activeTab].toFixed(0)}` : `$${closingCash[activeTab].toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-600/50">
                      <span className="text-xs text-gray-500">Esperado</span>
                      <span className="text-sm font-mono text-blue-400">
                        {activeTab === 'cup' ? `$${session.expectedCash[activeTab].toFixed(0)}` : `$${session.expectedCash[activeTab].toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">Diferencia</span>
                      <span className={cn(
                        'text-sm font-mono font-bold',
                        differences[activeTab] === 0 ? 'text-gray-400' :
                        differences[activeTab] > 0 ? 'text-green-400' : 'text-red-400'
                      )}>
                        {differences[activeTab] >= 0 ? '+' : ''}
                        {activeTab === 'cup' ? differences[activeTab].toFixed(0) : differences[activeTab].toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Summary */}
              <div className="space-y-4">
                {/* Session Summary */}
                <div className={cn(
                  'rounded-2xl border shadow-lg p-4 md:p-6',
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}>
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Receipt className="w-5 h-5" />
                    Resumen de Sesión
                  </h2>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className={cn(
                      'p-3 rounded-xl',
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                    )}>
                      <p className="text-xs text-gray-500 mb-1">Ventas</p>
                      <p className="text-xl font-bold text-green-500">${session.summary.totalSales.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">{session.summary.paidOrders} órdenes</p>
                    </div>
                    <div className={cn(
                      'p-3 rounded-xl',
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                    )}>
                      <p className="text-xs text-gray-500 mb-1">Descuentos</p>
                      <p className="text-xl font-bold text-amber-500">${session.summary.totalDiscounts.toFixed(2)}</p>
                    </div>
                  </div>

                  {session.paymentsByMethod.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-gray-500">Pagos por Método</h3>
                      {session.paymentsByMethod.map((payment, i) => (
                        <div key={i} className={cn(
                          'flex items-center justify-between p-2 rounded-lg text-sm',
                          theme === 'dark' ? 'bg-gray-700/30' : 'bg-gray-50'
                        )}>
                          <span className="capitalize">{payment.method} ({payment.currency})</span>
                          <span className="font-bold">${payment.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Total Difference */}
                <div className={cn(
                  'rounded-2xl border shadow-lg p-4 md:p-6',
                  Math.abs(totalDifferenceUsd) < 0.01
                    ? 'bg-green-900/20 border-green-700/50'
                    : totalDifferenceUsd > 0
                    ? 'bg-green-900/20 border-green-700/50'
                    : 'bg-red-900/20 border-red-700/50'
                )}>
                  <div className="flex items-center gap-2 mb-3">
                    <Calculator className="w-5 h-5" />
                    <h2 className="text-lg font-bold">Diferencia Total</h2>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {(['usd', 'cup', 'mlc'] as const).map(currency => (
                      <div key={currency} className="text-center">
                        <p className="text-xs text-gray-400 uppercase">{currency}</p>
                        <p className={cn(
                          'font-mono font-bold',
                          differences[currency] === 0 ? 'text-gray-400' :
                          differences[currency] > 0 ? 'text-green-400' : 'text-red-400'
                        )}>
                          {differences[currency] >= 0 ? '+' : ''}
                          {currency === 'cup' ? differences[currency].toFixed(0) : differences[currency].toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="text-center py-3 border-t border-gray-600/50">
                    <p className="text-sm text-gray-400 mb-1">Equivalente USD</p>
                    <div className="flex items-center justify-center gap-2">
                      {totalDifferenceUsd > 0 ? (
                        <TrendingUp className="w-6 h-6 text-green-400" />
                      ) : totalDifferenceUsd < 0 ? (
                        <TrendingDown className="w-6 h-6 text-red-400" />
                      ) : null}
                      <p className={cn(
                        'text-3xl font-bold font-mono',
                        Math.abs(totalDifferenceUsd) < 0.01 ? 'text-green-400' :
                        totalDifferenceUsd > 0 ? 'text-green-400' : 'text-red-400'
                      )}>
                        {totalDifferenceUsd >= 0 ? '+' : ''}${totalDifferenceUsd.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className={cn(
                  'rounded-2xl border shadow-lg p-4 md:p-6',
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}>
                  <label className="block text-sm font-medium mb-2">Notas de Cierre</label>
                  <textarea
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    rows={2}
                    placeholder="Observaciones..."
                    className={cn(
                      'w-full px-3 py-2 rounded-xl border resize-none focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 focus:ring-blue-500/50'
                        : 'bg-gray-50 border-gray-200 focus:ring-blue-500/50'
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className={cn(
                'p-4 rounded-xl flex items-center gap-2',
                'bg-red-900/30 text-red-300 border border-red-800'
              )}>
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 sticky bottom-4">
              <button
                onClick={() => router.back()}
                disabled={closing}
                className={cn(
                  'flex-1 py-3 rounded-xl font-medium',
                  theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
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
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
