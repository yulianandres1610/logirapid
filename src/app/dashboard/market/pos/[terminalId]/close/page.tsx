'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
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
  X,
  CreditCard,
  Banknote,
  ShoppingCart,
  Percent,
  ArrowRightLeft,
  DollarSign,
  Wallet
} from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface PaymentByMethod {
  method: string
  currency: string
  amount: number
  amountTendered?: number
  changeGiven?: number
  count: number
}

interface SessionDetails {
  id: number
  sessionCode: string
  terminalName: string
  openedAt: string
  openingCash: { usd: number; cup: number; mlc: number }
  expectedCash: { usd: number; cup: number; mlc: number }
  cashChange?: { usd: number; cup: number; mlc: number }
  inventoryShortageValue: number
  summary: {
    paidOrders: number
    voidedOrders: number
    refundedOrders: number
    totalSales: number
    totalRefunds: number
    totalDiscounts: number
  }
  paymentsByMethod: PaymentByMethod[]
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
  { value: 1, label: '1' },
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

  const [usdCounts, setUsdCounts] = useState<Record<number, number>>({})
  const [cupCounts, setCupCounts] = useState<Record<number, number>>({})
  const [mlcCounts, setMlcCounts] = useState<Record<number, number>>({})
  const [activeTab, setActiveTab] = useState<CurrencyTab>('usd')
  const [closingNotes, setClosingNotes] = useState('')

  const calculateTotal = useCallback((counts: Record<number, number>, denominations: typeof USD_DENOMINATIONS) => {
    return denominations.reduce((sum, d) => sum + (counts[d.value] || 0) * d.value, 0)
  }, [])

  const closingCash = {
    usd: calculateTotal(usdCounts, USD_DENOMINATIONS),
    cup: calculateTotal(cupCounts, CUP_DENOMINATIONS),
    mlc: calculateTotal(mlcCounts, MLC_DENOMINATIONS)
  }

  useEffect(() => {
    const checkAdminRole = async () => {
      try {
        const response = await fetch('/api/auth/me')
        const data = await response.json()
        if (data.success && data.user) {
          const role = data.user.role
          setIsAdmin(role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MARKET_MANAGER')
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
          setInventoryCount(countData.data)
          setLoading(false)
          return
        }

        setInventoryCount(countData.data)
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

  const handleForceClose = async () => {
    if (!isAdmin) return
    setForceClosing(true)
    try {
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

  const updateCount = (currency: CurrencyTab, value: number, delta: number) => {
    const setFn = currency === 'usd' ? setUsdCounts : currency === 'cup' ? setCupCounts : setMlcCounts
    setFn(prev => ({ ...prev, [value]: Math.max(0, (prev[value] || 0) + delta) }))
  }

  const setCount = (currency: CurrencyTab, value: number, count: number) => {
    const setFn = currency === 'usd' ? setUsdCounts : currency === 'cup' ? setCupCounts : setMlcCounts
    setFn(prev => ({ ...prev, [value]: Math.max(0, count) }))
  }

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Banknote className="w-4 h-4" />
      case 'card': return <CreditCard className="w-4 h-4" />
      case 'transfer': return <ArrowRightLeft className="w-4 h-4" />
      default: return <DollarSign className="w-4 h-4" />
    }
  }

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Efectivo'
      case 'card': return 'Tarjeta'
      case 'transfer': return 'Transferencia'
      case 'credit': return 'Crédito'
      default: return method
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === 'CUP') {
      return `${amount.toLocaleString('es', { maximumFractionDigits: 0 })} CUP`
    } else if (currency === 'MLC') {
      return `$${amount.toFixed(2)} MLC`
    }
    return `$${amount.toFixed(2)}`
  }

  const inventoryShortage = session?.inventoryShortageValue || 0
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

  // Group payments by method for summary
  const cashPayments = session?.paymentsByMethod.filter(p => p.method === 'cash') || []
  const otherPayments = session?.paymentsByMethod.filter(p => p.method !== 'cash') || []

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout hideSidebar>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
              <p className="mt-4 text-gray-500">Cargando datos de cierre...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (countMissing) {
    return (
      <ProtectedRoute>
        <DashboardLayout hideSidebar>
          <div className="min-h-screen flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                'w-full max-w-md rounded-2xl border p-8 text-center shadow-xl',
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              )}
            >
              <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">Conteo de Inventario Requerido</h2>
              <p className="text-gray-500 mb-6">
                Debes completar el conteo de inventario antes de cerrar la caja.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => router.push(`/dashboard/market/pos/${terminalId}/count`)}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all"
                >
                  Ir a Contar Inventario
                </button>
                <button
                  onClick={() => router.push(`/dashboard/market/pos/${terminalId}`)}
                  className={cn(
                    'w-full py-3 rounded-xl font-medium transition-colors',
                    theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
                  )}
                >
                  Volver al POS
                </button>
                {isAdmin && (
                  <button
                    onClick={handleForceClose}
                    disabled={forceClosing}
                    className="w-full py-3 rounded-xl bg-red-500/10 text-red-500 border border-red-500/30 font-medium hover:bg-red-500/20 transition-colors"
                  >
                    {forceClosing ? 'Cerrando...' : 'Cerrar sin Conteo (Admin)'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (countPendingApproval && inventoryCount) {
    return (
      <ProtectedRoute>
        <DashboardLayout hideSidebar>
          <div className="min-h-screen flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                'w-full max-w-md rounded-2xl border p-8 text-center shadow-xl',
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              )}
            >
              <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-amber-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">Pendiente de Aprobación</h2>
              <p className="text-gray-500 mb-4">
                El conteo de inventario tiene <span className="font-bold text-amber-500">{inventoryCount.productsWithDifferences}</span> productos con diferencias.
              </p>
              <p className="text-sm text-gray-400 mb-6">
                Un administrador debe aprobar o ajustar las diferencias antes de cerrar.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => router.push(`/dashboard/market/pos/${terminalId}`)}
                  className={cn(
                    'w-full py-3 rounded-xl font-medium transition-colors',
                    theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
                  )}
                >
                  Volver al POS
                </button>
                {isAdmin && (
                  <button
                    onClick={handleForceClose}
                    disabled={forceClosing}
                    className="w-full py-3 rounded-xl bg-red-500/10 text-red-500 border border-red-500/30 font-medium hover:bg-red-500/20 transition-colors"
                  >
                    {forceClosing ? 'Cerrando...' : 'Cerrar sin Aprobación (Admin)'}
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
              <button onClick={() => router.push('/dashboard/market/pos')} className="px-4 py-2 bg-blue-500 text-white rounded-lg">Volver</button>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const getDenominations = () => activeTab === 'usd' ? USD_DENOMINATIONS : activeTab === 'cup' ? CUP_DENOMINATIONS : MLC_DENOMINATIONS
  const getCounts = () => activeTab === 'usd' ? usdCounts : activeTab === 'cup' ? cupCounts : mlcCounts
  const fmt = (v: number, c: CurrencyTab) => c === 'cup' ? v.toFixed(0) : v.toFixed(2)

  return (
    <ProtectedRoute>
      <DashboardLayout hideSidebar>
        <div className="h-screen flex flex-col overflow-hidden">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'flex-shrink-0 px-4 py-3 border-b flex items-center justify-between',
              theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
            )}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className={cn(
                  'p-2 rounded-xl transition-colors',
                  theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                )}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="font-bold text-lg">Cierre de Caja</h1>
                <p className="text-sm text-gray-500">{session.sessionCode} • {session.terminalName}</p>
              </div>
            </div>
            <div className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium',
              theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'
            )}>
              <Clock className="w-4 h-4 inline mr-1" />
              {new Date(session.openedAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </motion.div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto p-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left Column - Session Summary */}
                <div className="lg:col-span-4 space-y-4">
                  {/* Sales Summary Card */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      'rounded-2xl border overflow-hidden shadow-lg',
                      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    )}
                  >
                    <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-3">
                      <h3 className="font-bold text-white flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5" />
                        Resumen de Ventas
                      </h3>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Órdenes pagadas</span>
                        <span className="font-bold text-lg">{session.summary.paidOrders}</span>
                      </div>
                      {session.summary.voidedOrders > 0 && (
                        <div className="flex justify-between items-center text-amber-500">
                          <span>Órdenes anuladas</span>
                          <span className="font-medium">{session.summary.voidedOrders}</span>
                        </div>
                      )}
                      <div className={cn(
                        'pt-3 border-t',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <div className="flex justify-between items-center">
                          <span className="text-green-500 font-medium">Total Ventas</span>
                          <span className="font-bold text-xl text-green-500">${session.summary.totalSales.toFixed(2)}</span>
                        </div>
                        {session.summary.totalDiscounts > 0 && (
                          <div className="flex justify-between items-center text-sm text-amber-500 mt-1">
                            <span>Descuentos aplicados</span>
                            <span>-${session.summary.totalDiscounts.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>

                  {/* Payments Received Card */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className={cn(
                      'rounded-2xl border overflow-hidden shadow-lg',
                      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    )}
                  >
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-3">
                      <h3 className="font-bold text-white flex items-center gap-2">
                        <Wallet className="w-5 h-5" />
                        Cobros Realizados
                      </h3>
                    </div>
                    <div className="p-4">
                      {/* Cash Payments */}
                      {cashPayments.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                            <Banknote className="w-3 h-3" />
                            Efectivo Recibido
                          </p>
                          <div className="space-y-2">
                            {cashPayments.map((p, i) => (
                              <div key={i} className={cn(
                                'p-3 rounded-xl',
                                theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                              )}>
                                <div className="flex justify-between items-center">
                                  <span className="font-medium">{p.currency}</span>
                                  <span className="font-mono font-bold">
                                    {formatCurrency(p.amount, p.currency)}
                                  </span>
                                </div>
                                {p.changeGiven && p.changeGiven > 0 && (
                                  <div className="flex justify-between text-xs mt-1 text-amber-500">
                                    <span>Recibido: {formatCurrency(p.amountTendered || p.amount + p.changeGiven, p.currency)}</span>
                                    <span>Cambio: -{formatCurrency(p.changeGiven, p.currency)}</span>
                                  </div>
                                )}
                                <p className="text-xs text-gray-400 mt-1">
                                  {p.count} {p.count === 1 ? 'transacción' : 'transacciones'}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Other Payments */}
                      {otherPayments.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                            <CreditCard className="w-3 h-3" />
                            Otros Métodos
                          </p>
                          <div className="space-y-2">
                            {otherPayments.map((p, i) => (
                              <div key={i} className={cn(
                                'p-3 rounded-xl flex items-center justify-between',
                                theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                              )}>
                                <div className="flex items-center gap-2">
                                  {getPaymentMethodIcon(p.method)}
                                  <div>
                                    <span className="font-medium">{getPaymentMethodLabel(p.method)}</span>
                                    <span className="text-xs text-gray-400 ml-2">({p.currency})</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="font-mono font-bold">{formatCurrency(p.amount, p.currency)}</span>
                                  <p className="text-xs text-gray-400">{p.count}x</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {session.paymentsByMethod.length === 0 && (
                        <p className="text-center text-gray-500 py-4">No hay cobros registrados</p>
                      )}
                    </div>
                  </motion.div>

                  {/* Opening Cash */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className={cn(
                      'rounded-2xl border p-4 shadow-lg',
                      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    )}
                  >
                    <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                      <Receipt className="w-4 h-4" />
                      Fondo de Apertura
                    </h3>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div className={cn('p-3 rounded-xl', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
                        <p className="text-xs text-gray-500 mb-1">USD</p>
                        <p className="font-mono font-bold">${session.openingCash.usd.toFixed(2)}</p>
                      </div>
                      <div className={cn('p-3 rounded-xl', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
                        <p className="text-xs text-gray-500 mb-1">CUP</p>
                        <p className="font-mono font-bold">{session.openingCash.cup.toLocaleString()}</p>
                      </div>
                      <div className={cn('p-3 rounded-xl', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
                        <p className="text-xs text-gray-500 mb-1">MLC</p>
                        <p className="font-mono font-bold">${session.openingCash.mlc.toFixed(2)}</p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Inventory Shortage */}
                  {inventoryShortage > 0 && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                      className="rounded-2xl border-2 border-red-500 bg-red-500/10 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                            <Package className="w-5 h-5 text-red-500" />
                          </div>
                          <div>
                            <p className="font-bold text-red-500">Faltante de Inventario</p>
                            <p className="text-xs text-gray-400">Se suma al esperado en USD</p>
                          </div>
                        </div>
                        <p className="text-2xl font-bold text-red-500">${inventoryShortage.toFixed(2)}</p>
                      </div>
                    </motion.div>
                  )}

                  {/* Notes */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className={cn(
                      'rounded-2xl border p-4 shadow-lg',
                      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    )}
                  >
                    <label className="text-sm text-gray-500 mb-2 block">Notas del cierre (opcional)</label>
                    <textarea
                      value={closingNotes}
                      onChange={(e) => setClosingNotes(e.target.value)}
                      rows={3}
                      placeholder="Observaciones sobre el cierre de caja..."
                      className={cn(
                        'w-full px-3 py-2 rounded-xl border text-sm resize-none',
                        theme === 'dark' ? 'bg-gray-900 border-gray-600' : 'bg-gray-50 border-gray-200',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500/50'
                      )}
                    />
                  </motion.div>
                </div>

                {/* Right Column - Cash Count */}
                <div className="lg:col-span-8 space-y-4">
                  {/* Currency Tabs */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-3 gap-3"
                  >
                    {(['usd', 'cup', 'mlc'] as const).map(c => {
                      const isActive = activeTab === c
                      const diff = differences[c]
                      const currencyLabel = c.toUpperCase()
                      return (
                        <button
                          key={c}
                          onClick={() => setActiveTab(c)}
                          className={cn(
                            'p-4 rounded-2xl text-center transition-all border-2 shadow-lg',
                            isActive
                              ? 'bg-gradient-to-br from-blue-500 to-blue-600 border-blue-500 text-white shadow-blue-500/25'
                              : theme === 'dark'
                                ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
                                : 'bg-white border-gray-200 hover:border-gray-300'
                          )}
                        >
                          <p className="text-2xl font-bold">{currencyLabel}</p>
                          <p className={cn('text-lg font-mono mt-1', isActive ? 'text-blue-100' : 'text-gray-500')}>
                            {c === 'cup' ? closingCash[c].toLocaleString() : `$${closingCash[c].toFixed(2)}`}
                          </p>
                          <div className={cn(
                            'mt-3 pt-3 border-t text-sm space-y-1',
                            isActive ? 'border-blue-400/50' : theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                          )}>
                            <div className="flex justify-between">
                              <span className={isActive ? 'text-blue-200' : 'text-gray-500'}>Esperado</span>
                              <span className="font-mono">
                                {c === 'cup' ? adjustedExpectedCash[c].toLocaleString() : `$${adjustedExpectedCash[c].toFixed(2)}`}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className={isActive ? 'text-blue-200' : 'text-gray-500'}>Diferencia</span>
                              <span className={cn(
                                'font-mono font-bold',
                                diff === 0 ? '' : diff > 0 ? 'text-green-400' : 'text-red-400'
                              )}>
                                {diff >= 0 ? '+' : ''}{c === 'cup' ? diff.toFixed(0) : diff.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </motion.div>

                  {/* Denominations */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className={cn(
                      'rounded-2xl border p-4 shadow-lg',
                      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    )}
                  >
                    <h3 className="font-bold text-sm mb-4">Contar {activeTab.toUpperCase()}</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3">
                      {getDenominations().map(d => {
                        const count = getCounts()[d.value] || 0
                        return (
                          <div
                            key={d.value}
                            className={cn(
                              'rounded-xl p-3 text-center border-2 transition-all',
                              count > 0
                                ? 'bg-blue-500/10 border-blue-500'
                                : theme === 'dark'
                                  ? 'bg-gray-700 border-gray-600'
                                  : 'bg-gray-50 border-gray-200'
                            )}
                          >
                            <p className="font-bold text-sm mb-2">{d.label}</p>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => updateCount(activeTab, d.value, -1)}
                                disabled={count === 0}
                                className={cn(
                                  'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                                  count === 0
                                    ? 'opacity-30 cursor-not-allowed'
                                    : theme === 'dark'
                                    ? 'bg-gray-600 hover:bg-gray-500'
                                    : 'bg-gray-200 hover:bg-gray-300'
                                )}
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <input
                                type="number"
                                inputMode="numeric"
                                value={count}
                                onChange={e => setCount(activeTab, d.value, parseInt(e.target.value) || 0)}
                                className={cn(
                                  'w-12 h-8 text-center font-bold rounded-lg border',
                                  theme === 'dark' ? 'bg-gray-900 border-gray-600' : 'bg-white border-gray-200',
                                  'focus:outline-none focus:ring-2 focus:ring-blue-500/50'
                                )}
                              />
                              <button
                                onClick={() => updateCount(activeTab, d.value, 1)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                            {count > 0 && (
                              <p className="text-xs text-blue-400 mt-2 font-mono">
                                = {activeTab === 'cup' ? (count * d.value).toLocaleString() : `$${(count * d.value).toFixed(2)}`}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>

                  {/* Total Difference */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className={cn(
                      'rounded-2xl border-2 p-6 shadow-lg',
                      Math.abs(totalDifferenceUsd) < 0.01
                        ? 'border-green-500 bg-green-500/10'
                        : totalDifferenceUsd > 0
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-red-500 bg-red-500/10'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-400 mb-2">Diferencia Total (equivalente USD)</p>
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-12 h-12 rounded-xl flex items-center justify-center',
                            Math.abs(totalDifferenceUsd) < 0.01 || totalDifferenceUsd > 0
                              ? 'bg-green-500/20'
                              : 'bg-red-500/20'
                          )}>
                            {totalDifferenceUsd > 0 ? (
                              <TrendingUp className="w-6 h-6 text-green-500" />
                            ) : totalDifferenceUsd < 0 ? (
                              <TrendingDown className="w-6 h-6 text-red-500" />
                            ) : (
                              <CheckCircle className="w-6 h-6 text-green-500" />
                            )}
                          </div>
                          <p className={cn(
                            'text-4xl font-bold font-mono',
                            Math.abs(totalDifferenceUsd) < 0.01 ? 'text-green-500' :
                            totalDifferenceUsd > 0 ? 'text-green-500' : 'text-red-500'
                          )}>
                            {totalDifferenceUsd >= 0 ? '+' : ''}${totalDifferenceUsd.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        <div className={cn(
                          'px-4 py-2 rounded-xl text-sm font-mono',
                          differences.usd === 0
                            ? theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                            : differences.usd > 0
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        )}>
                          USD: {differences.usd >= 0 ? '+' : ''}${differences.usd.toFixed(2)}
                        </div>
                        <div className={cn(
                          'px-4 py-2 rounded-xl text-sm font-mono',
                          differences.cup === 0
                            ? theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                            : differences.cup > 0
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        )}>
                          CUP: {differences.cup >= 0 ? '+' : ''}{differences.cup.toFixed(0)}
                        </div>
                        <div className={cn(
                          'px-4 py-2 rounded-xl text-sm font-mono',
                          differences.mlc === 0
                            ? theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                            : differences.mlc > 0
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        )}>
                          MLC: {differences.mlc >= 0 ? '+' : ''}${differences.mlc.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="px-4 pb-2"
              >
                <div className="max-w-7xl mx-auto p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <span className="text-red-500 text-sm flex-1">{error}</span>
                  <button onClick={() => setError(null)} className="p-1 hover:bg-red-500/20 rounded-lg">
                    <X className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'flex-shrink-0 px-4 py-3 border-t',
              theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
            )}
          >
            <div className="max-w-7xl mx-auto flex gap-3">
              <button
                onClick={() => router.back()}
                disabled={closing}
                className={cn(
                  'flex-1 py-3.5 rounded-xl font-medium transition-colors',
                  theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
                )}
              >
                Cancelar
              </button>
              <button
                onClick={handleCloseSession}
                disabled={closing}
                className={cn(
                  'flex-[2] py-3.5 rounded-xl font-bold flex items-center justify-center gap-2',
                  'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all',
                  closing && 'opacity-70'
                )}
              >
                {closing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                {closing ? 'Cerrando Caja...' : 'Cerrar Caja'}
              </button>
            </div>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
