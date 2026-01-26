'use client'

import React, { useState, useEffect, useCallback } from 'react'
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
  Package,
  ClipboardCheck,
  AlertTriangle,
  Plus,
  Minus,
  X
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
  { value: 100, label: '$100' },
  { value: 50, label: '$50' },
  { value: 20, label: '$20' },
  { value: 10, label: '$10' },
  { value: 5, label: '$5' },
  { value: 1, label: '$1' },
  { value: 0.25, label: '25¢' },
]

const CUP_DENOMINATIONS = [
  { value: 1000, label: '1000' },
  { value: 500, label: '500' },
  { value: 200, label: '200' },
  { value: 100, label: '100' },
  { value: 50, label: '50' },
  { value: 20, label: '20' },
  { value: 10, label: '10' },
  { value: 5, label: '5' },
]

const MLC_DENOMINATIONS = [
  { value: 100, label: '$100' },
  { value: 50, label: '$50' },
  { value: 20, label: '$20' },
  { value: 10, label: '$10' },
  { value: 5, label: '$5' },
  { value: 1, label: '$1' },
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
          <div className="min-h-screen flex items-center justify-center p-4">
            <div className={cn(
              'w-full max-w-sm rounded-2xl border shadow-xl p-6 text-center',
              theme === 'dark'
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
            )}>
              <div className={cn(
                'w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center',
                theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100'
              )}>
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">Conteo Requerido</h2>
              <p className="text-gray-500 text-sm mb-6">
                Completa el conteo de inventario antes de cerrar.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => router.push(`/dashboard/market/pos/${terminalId}/count`)}
                  className="w-full py-3 rounded-xl bg-blue-500 text-white font-bold flex items-center justify-center gap-2"
                >
                  <ClipboardCheck className="w-5 h-5" />
                  Ir a Contar
                </button>
                <button
                  onClick={() => router.push(`/dashboard/market/pos/${terminalId}`)}
                  className={cn(
                    'w-full py-3 rounded-xl font-medium',
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                  )}
                >
                  Volver al POS
                </button>
                {isAdmin && (
                  <button
                    onClick={handleForceClose}
                    disabled={forceClosing}
                    className="w-full py-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-400 font-medium flex items-center justify-center gap-2"
                  >
                    {forceClosing ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                    Cerrar sin Conteo
                  </button>
                )}
              </div>
            </div>
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
          <div className="min-h-screen flex items-center justify-center p-4">
            <div className={cn(
              'w-full max-w-sm rounded-2xl border shadow-xl p-6 text-center',
              theme === 'dark'
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
            )}>
              <div className={cn(
                'w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center',
                theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100'
              )}>
                <Clock className="w-8 h-8 text-amber-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">Pendiente de Aprobación</h2>
              <p className="text-gray-500 text-sm mb-4">
                El conteo tiene diferencias y espera revisión.
              </p>
              <div className={cn(
                'rounded-xl p-3 mb-6 text-left text-sm',
                theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'
              )}>
                <p className="text-gray-400 mb-2">{inventoryCount.countNumber}</p>
                <div className="flex justify-between">
                  <span>Con diferencias:</span>
                  <span className="font-bold text-amber-500">{inventoryCount.productsWithDifferences}</span>
                </div>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => router.push(`/dashboard/market/pos/${terminalId}`)}
                  className={cn(
                    'w-full py-3 rounded-xl font-medium',
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                  )}
                >
                  Volver al POS
                </button>
                {isAdmin && (
                  <button
                    onClick={handleForceClose}
                    disabled={forceClosing}
                    className="w-full py-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-400 font-medium flex items-center justify-center gap-2"
                  >
                    {forceClosing ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                    Cerrar sin Aprobación
                  </button>
                )}
              </div>
            </div>
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

  const formatCurrency = (value: number, currency: CurrencyTab) => {
    if (currency === 'cup') return value.toFixed(0)
    return value.toFixed(2)
  }

  return (
    <ProtectedRoute>
      <DashboardLayout hideSidebar>
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <div className={cn(
            'sticky top-0 z-10 px-4 py-3 border-b',
            theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
          )}>
            <div className="max-w-5xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.back()}
                  className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="font-bold">Cierre de Caja</h1>
                  <p className="text-xs text-gray-500">{session.terminalName}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Ventas del día</p>
                <p className="font-bold text-green-500">${session.summary.totalSales.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto">
            <div className="max-w-5xl mx-auto p-4 space-y-4">
              {/* Faltante de inventario - Alerta */}
              {inventoryShortage > 0 && (
                <div className={cn(
                  'rounded-xl p-4 border-l-4 border-red-500',
                  theme === 'dark' ? 'bg-red-900/20' : 'bg-red-50'
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Package className="w-5 h-5 text-red-500" />
                      <div>
                        <p className="font-medium text-red-500">Faltante de Inventario</p>
                        <p className="text-xs text-gray-500">Se suma al efectivo esperado</p>
                      </div>
                    </div>
                    <p className="text-xl font-bold text-red-500">${inventoryShortage.toFixed(2)}</p>
                  </div>
                </div>
              )}

              {/* Currency Selector */}
              <div className="grid grid-cols-3 gap-2">
                {(['usd', 'cup', 'mlc'] as const).map(currency => {
                  const diff = differences[currency]
                  const isActive = activeTab === currency
                  return (
                    <button
                      key={currency}
                      onClick={() => setActiveTab(currency)}
                      className={cn(
                        'p-3 rounded-xl text-center transition-all',
                        isActive
                          ? 'bg-blue-500 text-white shadow-lg'
                          : theme === 'dark'
                            ? 'bg-gray-800 hover:bg-gray-700'
                            : 'bg-gray-100 hover:bg-gray-200'
                      )}
                    >
                      <p className="text-lg font-bold uppercase">{currency}</p>
                      <p className={cn(
                        'text-sm font-mono',
                        isActive ? 'text-blue-100' : 'text-gray-500'
                      )}>
                        ${formatCurrency(closingCash[currency], currency)}
                      </p>
                      <p className={cn(
                        'text-xs font-mono mt-1',
                        diff === 0 ? (isActive ? 'text-blue-200' : 'text-gray-400') :
                        diff > 0 ? 'text-green-400' : 'text-red-400'
                      )}>
                        {diff >= 0 ? '+' : ''}{formatCurrency(diff, currency)}
                      </p>
                    </button>
                  )
                })}
              </div>

              {/* Denominations */}
              <div className={cn(
                'rounded-xl border p-4',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
              )}>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {getDenominations().map(d => {
                    const count = getCounts()[d.value] || 0
                    return (
                      <div
                        key={d.value}
                        className={cn(
                          'rounded-xl p-3 text-center transition-all',
                          count > 0
                            ? 'bg-blue-500/20 border-2 border-blue-500'
                            : theme === 'dark'
                              ? 'bg-gray-700 border-2 border-transparent'
                              : 'bg-gray-50 border-2 border-transparent'
                        )}
                      >
                        <p className="font-bold text-lg mb-2">{d.label}</p>

                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => updateCount(activeTab, d.value, -1)}
                            disabled={count === 0}
                            className={cn(
                              'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                              count === 0
                                ? 'opacity-30'
                                : theme === 'dark'
                                  ? 'bg-gray-600 hover:bg-gray-500 active:bg-gray-400'
                                  : 'bg-gray-200 hover:bg-gray-300 active:bg-gray-400'
                            )}
                          >
                            <Minus className="w-5 h-5" />
                          </button>

                          <input
                            type="number"
                            inputMode="numeric"
                            value={count}
                            onChange={e => setCount(activeTab, d.value, parseInt(e.target.value) || 0)}
                            className={cn(
                              'w-14 h-10 text-center font-bold text-lg rounded-lg border-2',
                              theme === 'dark'
                                ? 'bg-gray-900 border-gray-600 focus:border-blue-500'
                                : 'bg-white border-gray-200 focus:border-blue-500',
                              'focus:outline-none'
                            )}
                          />

                          <button
                            onClick={() => updateCount(activeTab, d.value, 1)}
                            className={cn(
                              'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                              'bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white'
                            )}
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>

                        {count > 0 && (
                          <p className="text-xs text-blue-400 mt-2 font-mono">
                            = ${formatCurrency(count * d.value, activeTab)}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Summary Row */}
              <div className="grid grid-cols-3 gap-3">
                <div className={cn(
                  'rounded-xl p-4 text-center',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                )}>
                  <p className="text-xs text-gray-500 mb-1">Contado</p>
                  <p className="text-xl font-bold font-mono">
                    ${formatCurrency(closingCash[activeTab], activeTab)}
                  </p>
                </div>
                <div className={cn(
                  'rounded-xl p-4 text-center',
                  theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50'
                )}>
                  <p className="text-xs text-blue-400 mb-1">Esperado</p>
                  <p className="text-xl font-bold font-mono text-blue-500">
                    ${formatCurrency(adjustedExpectedCash[activeTab], activeTab)}
                  </p>
                </div>
                <div className={cn(
                  'rounded-xl p-4 text-center',
                  differences[activeTab] === 0
                    ? theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                    : differences[activeTab] > 0
                      ? 'bg-green-500/20'
                      : 'bg-red-500/20'
                )}>
                  <p className="text-xs text-gray-500 mb-1">Diferencia</p>
                  <p className={cn(
                    'text-xl font-bold font-mono',
                    differences[activeTab] === 0 ? '' :
                    differences[activeTab] > 0 ? 'text-green-500' : 'text-red-500'
                  )}>
                    {differences[activeTab] >= 0 ? '+' : ''}
                    ${formatCurrency(differences[activeTab], activeTab)}
                  </p>
                </div>
              </div>

              {/* Total Difference */}
              <div className={cn(
                'rounded-xl p-4',
                Math.abs(totalDifferenceUsd) < 0.01
                  ? theme === 'dark' ? 'bg-green-900/20' : 'bg-green-50'
                  : totalDifferenceUsd > 0
                    ? theme === 'dark' ? 'bg-green-900/20' : 'bg-green-50'
                    : theme === 'dark' ? 'bg-red-900/20' : 'bg-red-50'
              )}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Diferencia Total (USD equiv.)</p>
                    <div className="flex items-center gap-2 mt-1">
                      {totalDifferenceUsd > 0 ? (
                        <TrendingUp className="w-6 h-6 text-green-500" />
                      ) : totalDifferenceUsd < 0 ? (
                        <TrendingDown className="w-6 h-6 text-red-500" />
                      ) : (
                        <CheckCircle className="w-6 h-6 text-green-500" />
                      )}
                      <p className={cn(
                        'text-3xl font-bold font-mono',
                        Math.abs(totalDifferenceUsd) < 0.01 ? 'text-green-500' :
                        totalDifferenceUsd > 0 ? 'text-green-500' : 'text-red-500'
                      )}>
                        {totalDifferenceUsd >= 0 ? '+' : ''}${totalDifferenceUsd.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p>USD: {differences.usd >= 0 ? '+' : ''}${differences.usd.toFixed(2)}</p>
                    <p>CUP: {differences.cup >= 0 ? '+' : ''}${differences.cup.toFixed(0)}</p>
                    <p>MLC: {differences.mlc >= 0 ? '+' : ''}${differences.mlc.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm text-gray-500 mb-2">Notas (opcional)</label>
                <textarea
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  rows={2}
                  placeholder="Observaciones del cierre..."
                  className={cn(
                    'w-full px-4 py-3 rounded-xl border resize-none',
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-700 focus:border-blue-500'
                      : 'bg-white border-gray-200 focus:border-blue-500',
                    'focus:outline-none focus:ring-1 focus:ring-blue-500'
                  )}
                />
              </div>

              {/* Error */}
              {error && (
                <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/50 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-red-500">{error}</p>
                  <button onClick={() => setError(null)} className="ml-auto">
                    <X className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Fixed Bottom Actions */}
          <div className={cn(
            'sticky bottom-0 p-4 border-t',
            theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
          )}>
            <div className="max-w-5xl mx-auto flex gap-3">
              <button
                onClick={() => router.back()}
                disabled={closing}
                className={cn(
                  'flex-1 py-4 rounded-xl font-medium text-lg',
                  theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
                )}
              >
                Cancelar
              </button>
              <button
                onClick={handleCloseSession}
                disabled={closing}
                className={cn(
                  'flex-[2] py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2',
                  'bg-blue-500 hover:bg-blue-600 text-white',
                  closing && 'opacity-70'
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
                    Cerrar Caja
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
