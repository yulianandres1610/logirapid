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
  inventoryShortageValue: number
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
  const [isAdmin, setIsAdmin] = useState(false)
  const [forceClosing, setForceClosing] = useState(false)

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

  // Check if user is admin
  useEffect(() => {
    const checkAdminRole = async () => {
      try {
        const response = await fetch('/api/auth/me')
        const data = await response.json()
        if (data.success && data.user) {
          const role = data.user.role
          const isAdminRole = role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MARKET_MANAGER'
          setIsAdmin(isAdminRole)
        }
      } catch (err) {
        console.error('Error checking role:', err)
      }
    }
    checkAdminRole()
  }, [])

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

  // Admin force close without count
  const handleForceClose = async () => {
    if (!isAdmin) return

    setForceClosing(true)
    try {
      // Get session ID first
      const sessionsRes = await fetch(`/api/market/pos/sessions?terminalId=${terminalId}&status=open`)
      const sessionsData = await sessionsRes.json()

      if (!sessionsData.success || sessionsData.data.sessions.length === 0) {
        setError('No hay sesión abierta')
        return
      }

      const sessionId = sessionsData.data.sessions[0].id

      const response = await fetch(`/api/market/pos/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'force-close',
          closingNotes: 'Cerrado por administrador sin conteo de inventario'
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
      setForceClosing(false)
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

  // Calculate differences - including inventory shortage
  const inventoryShortage = session?.inventoryShortageValue || 0

  // El faltante de inventario se SUMA al efectivo esperado (el cajero debe reponer)
  const adjustedExpectedCash = session ? {
    usd: session.expectedCash.usd + inventoryShortage,
    cup: session.expectedCash.cup,
    mlc: session.expectedCash.mlc
  } : { usd: 0, cup: 0, mlc: 0 }

  const differences = session ? {
    usd: closingCash.usd - adjustedExpectedCash.usd,
    cup: closingCash.cup - adjustedExpectedCash.cup,
    mlc: closingCash.mlc - adjustedExpectedCash.mlc
  } : { usd: 0, cup: 0, mlc: 0 }

  const totalDifferenceUsd = differences.usd + (differences.cup / 250) + (differences.mlc * 1.1)

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout hideSidebar>
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
        <DashboardLayout hideSidebar>
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
              <div className="flex flex-col gap-3">
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

                {/* Admin force close option */}
                {isAdmin && (
                  <button
                    onClick={handleForceClose}
                    disabled={forceClosing}
                    className="w-full py-2.5 rounded-xl bg-red-600/20 border border-red-600/50 text-red-400 font-medium hover:bg-red-600/30 flex items-center justify-center gap-2"
                  >
                    {forceClosing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                    Cerrar sin Conteo (Solo Admin)
                  </button>
                )}
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
        <DashboardLayout hideSidebar>
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
              <div className="flex flex-col gap-3">
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

                {/* Admin force close option */}
                {isAdmin && (
                  <button
                    onClick={handleForceClose}
                    disabled={forceClosing}
                    className="w-full py-2.5 rounded-xl bg-red-600/20 border border-red-600/50 text-red-400 font-medium hover:bg-red-600/30 flex items-center justify-center gap-2"
                  >
                    {forceClosing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                    Cerrar sin Conteo (Solo Admin)
                  </button>
                )}
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
        <DashboardLayout hideSidebar>
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
      <DashboardLayout hideSidebar>
        <div className="h-screen flex flex-col overflow-hidden">
          {/* Compact Header */}
          <div className={cn(
            'flex-shrink-0 px-4 py-2 border-b flex items-center justify-between',
            theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
          )}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className={cn(
                  'p-2 rounded-lg transition-colors touch-manipulation',
                  theme === 'dark' ? 'hover:bg-gray-800 active:bg-gray-700' : 'hover:bg-gray-100 active:bg-gray-200'
                )}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-bold">Arqueo de Caja</h1>
                <p className="text-xs text-gray-500">{session.sessionCode} • {session.terminalName}</p>
              </div>
            </div>

            {/* Total Difference Badge in Header */}
            <div className={cn(
              'px-4 py-2 rounded-lg',
              Math.abs(totalDifferenceUsd) < 0.01
                ? 'bg-green-500/20 text-green-400'
                : totalDifferenceUsd > 0
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            )}>
              <span className="text-xs text-gray-400 mr-2">Diferencia:</span>
              <span className="font-bold font-mono">
                {totalDifferenceUsd >= 0 ? '+' : ''}${totalDifferenceUsd.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Main Content - Full Height */}
          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">
            {/* Left Panel - Cash Count (takes more space) */}
            <div className={cn(
              'lg:col-span-7 xl:col-span-8 flex flex-col border-r overflow-hidden',
              theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-200'
            )}>
              {/* Currency Tabs */}
              <div className={cn(
                'flex-shrink-0 grid grid-cols-3 border-b',
                theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
              )}>
                {(['usd', 'cup', 'mlc'] as const).map(currency => (
                  <button
                    key={currency}
                    onClick={() => setActiveTab(currency)}
                    className={cn(
                      'py-3 px-2 font-medium transition-colors relative touch-manipulation',
                      activeTab === currency
                        ? theme === 'dark' ? 'bg-gray-800 text-blue-400' : 'bg-white text-blue-600'
                        : theme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    <span className="text-lg font-bold uppercase">{currency}</span>
                    <span className="block text-sm font-mono mt-0.5">
                      {currency === 'cup' ? `$${closingCash[currency].toFixed(0)}` : `$${closingCash[currency].toFixed(2)}`}
                    </span>
                    {activeTab === currency && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500"
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Denominations Grid - Scrollable */}
              <div className="flex-1 overflow-y-auto p-3">
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                  {getDenominations().map(d => {
                    const count = getCounts()[d.value] || 0
                    const subtotal = count * d.value
                    return (
                      <div
                        key={d.value}
                        className={cn(
                          'rounded-lg p-2 transition-all touch-manipulation select-none',
                          count > 0
                            ? theme === 'dark' ? 'bg-blue-900/40 border-2 border-blue-600' : 'bg-blue-100 border-2 border-blue-400'
                            : theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
                        )}
                      >
                        {/* Denomination Label */}
                        <div className="text-center mb-2">
                          <span className="font-bold text-base">{d.label}</span>
                          {count > 0 && (
                            <span className={cn(
                              'block text-xs font-mono',
                              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                            )}>
                              = {activeTab === 'cup' ? `$${subtotal.toFixed(0)}` : `$${subtotal.toFixed(2)}`}
                            </span>
                          )}
                        </div>

                        {/* Counter Controls */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateCount(activeTab, d.value, -1)}
                            disabled={count === 0}
                            className={cn(
                              'flex-1 h-10 rounded-md flex items-center justify-center transition-colors touch-manipulation',
                              count === 0
                                ? 'opacity-30 cursor-not-allowed'
                                : theme === 'dark'
                                  ? 'bg-gray-700 hover:bg-gray-600 active:bg-gray-500'
                                  : 'bg-gray-200 hover:bg-gray-300 active:bg-gray-400'
                            )}
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            value={count}
                            onChange={e => setCount(activeTab, d.value, parseInt(e.target.value) || 0)}
                            className={cn(
                              'w-12 h-10 text-center font-mono font-bold text-lg rounded-md',
                              theme === 'dark' ? 'bg-gray-900 border-gray-600' : 'bg-gray-50 border-gray-300',
                              'border focus:outline-none focus:ring-2 focus:ring-blue-500'
                            )}
                          />
                          <button
                            onClick={() => updateCount(activeTab, d.value, 1)}
                            className={cn(
                              'flex-1 h-10 rounded-md flex items-center justify-center transition-colors touch-manipulation',
                              theme === 'dark'
                                ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-400 text-white'
                                : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white'
                            )}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Currency Total Bar - Fixed at bottom */}
              <div className={cn(
                'flex-shrink-0 p-3 border-t',
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              )}>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Total {activeTab.toUpperCase()}</p>
                    <p className="text-xl font-bold font-mono">
                      {activeTab === 'cup' ? `$${closingCash[activeTab].toFixed(0)}` : `$${closingCash[activeTab].toFixed(2)}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Esperado</p>
                    <p className="text-xl font-mono text-blue-400">
                      {activeTab === 'cup' ? `$${adjustedExpectedCash[activeTab].toFixed(0)}` : `$${adjustedExpectedCash[activeTab].toFixed(2)}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Diferencia</p>
                    <p className={cn(
                      'text-xl font-mono font-bold',
                      differences[activeTab] === 0 ? 'text-gray-400' :
                      differences[activeTab] > 0 ? 'text-green-400' : 'text-red-400'
                    )}>
                      {differences[activeTab] >= 0 ? '+' : ''}
                      {activeTab === 'cup' ? differences[activeTab].toFixed(0) : differences[activeTab].toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel - Summary (compact) */}
            <div className={cn(
              'lg:col-span-5 xl:col-span-4 flex flex-col overflow-hidden',
              theme === 'dark' ? 'bg-gray-900' : 'bg-white'
            )}>
              {/* Scrollable Summary Area */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {/* Session Summary - Compact */}
                <div className={cn(
                  'rounded-lg border p-3',
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <Receipt className="w-4 h-4 text-gray-400" />
                    <h2 className="text-sm font-bold">Resumen de Sesión</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className={cn(
                      'p-2 rounded-md text-center',
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-white'
                    )}>
                      <p className="text-xs text-gray-500">Ventas</p>
                      <p className="text-lg font-bold text-green-500 font-mono">${session.summary.totalSales.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">{session.summary.paidOrders} órdenes</p>
                    </div>
                    <div className={cn(
                      'p-2 rounded-md text-center',
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-white'
                    )}>
                      <p className="text-xs text-gray-500">Descuentos</p>
                      <p className="text-lg font-bold text-amber-500 font-mono">${session.summary.totalDiscounts.toFixed(2)}</p>
                    </div>
                  </div>

                  {session.paymentsByMethod.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-700/50 space-y-1">
                      {session.paymentsByMethod.map((payment, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-gray-400 capitalize">{payment.method} ({payment.currency})</span>
                          <span className="font-mono font-medium">${payment.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Inventory Shortage - Compact */}
                {inventoryShortage > 0 && (
                  <div className="rounded-lg border p-3 bg-red-900/20 border-red-700/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="w-4 h-4 text-red-400" />
                      <h2 className="text-sm font-bold text-red-300">Faltante de Inventario</h2>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-400 font-mono">
                        ${inventoryShortage.toFixed(2)}
                      </p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-red-700/30 text-xs text-gray-400 space-y-0.5">
                      <div className="flex justify-between">
                        <span>Efectivo ventas:</span>
                        <span className="font-mono">${session?.expectedCash.usd.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-red-400">
                        <span>+ Faltante:</span>
                        <span className="font-mono">${inventoryShortage.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-medium pt-1 border-t border-red-700/30">
                        <span>= Total:</span>
                        <span className="font-mono">${adjustedExpectedCash.usd.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* All Currency Differences */}
                <div className={cn(
                  'rounded-lg border p-3',
                  Math.abs(totalDifferenceUsd) < 0.01 || totalDifferenceUsd > 0
                    ? 'bg-green-900/20 border-green-700/50'
                    : 'bg-red-900/20 border-red-700/50'
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <Calculator className="w-4 h-4" />
                    <h2 className="text-sm font-bold">Diferencias por Moneda</h2>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    {(['usd', 'cup', 'mlc'] as const).map(currency => (
                      <div key={currency} className={cn(
                        'p-2 rounded-md',
                        theme === 'dark' ? 'bg-gray-800/50' : 'bg-white/50'
                      )}>
                        <p className="text-xs text-gray-400 uppercase font-bold">{currency}</p>
                        <p className={cn(
                          'font-mono font-bold text-lg',
                          differences[currency] === 0 ? 'text-gray-400' :
                          differences[currency] > 0 ? 'text-green-400' : 'text-red-400'
                        )}>
                          {differences[currency] >= 0 ? '+' : ''}
                          {currency === 'cup' ? differences[currency].toFixed(0) : differences[currency].toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 pt-2 border-t border-gray-600/30 text-center">
                    <p className="text-xs text-gray-400">Equivalente USD Total</p>
                    <div className="flex items-center justify-center gap-1">
                      {totalDifferenceUsd > 0 ? (
                        <TrendingUp className="w-5 h-5 text-green-400" />
                      ) : totalDifferenceUsd < 0 ? (
                        <TrendingDown className="w-5 h-5 text-red-400" />
                      ) : null}
                      <p className={cn(
                        'text-2xl font-bold font-mono',
                        Math.abs(totalDifferenceUsd) < 0.01 || totalDifferenceUsd > 0 ? 'text-green-400' : 'text-red-400'
                      )}>
                        {totalDifferenceUsd >= 0 ? '+' : ''}${totalDifferenceUsd.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Notes - Compact */}
                <div className={cn(
                  'rounded-lg border p-3',
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
                )}>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Notas de Cierre</label>
                  <textarea
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    rows={2}
                    placeholder="Observaciones..."
                    className={cn(
                      'w-full px-2 py-1.5 text-sm rounded-md border resize-none focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-600 focus:ring-blue-500/50'
                        : 'bg-white border-gray-200 focus:ring-blue-500/50'
                    )}
                  />
                </div>

                {/* Error */}
                {error && (
                  <div className="p-3 rounded-lg flex items-center gap-2 bg-red-900/30 text-red-300 border border-red-800">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons - Fixed at bottom */}
              <div className={cn(
                'flex-shrink-0 p-3 border-t grid grid-cols-2 gap-2',
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'
              )}>
                <button
                  onClick={() => router.back()}
                  disabled={closing}
                  className={cn(
                    'h-14 rounded-lg font-medium text-base touch-manipulation',
                    theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 active:bg-gray-500' : 'bg-white hover:bg-gray-50 active:bg-gray-100 border border-gray-300'
                  )}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCloseSession}
                  disabled={closing}
                  className={cn(
                    'h-14 rounded-lg font-bold text-base flex items-center justify-center gap-2 touch-manipulation',
                    'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 active:from-blue-700 active:to-blue-800',
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
                      Confirmar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
