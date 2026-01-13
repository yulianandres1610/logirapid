'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion'
import {
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  X,
  User,
  Phone,
  Banknote,
  TrendingUp
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

interface WalletBalance {
  currency: string
  available: number
  reserved: number
  total: number
  lowThreshold: number
  isLow: boolean
}

interface CashDeliveryInfo {
  orderNumber: string
  deliveryUserName: string
  deliveryUserPhone: string
  totalBills: number
  completedAt: string
}

interface Transaction {
  id: number
  currency: string
  type: string
  typeLabel: string
  amount: number
  balanceAfter: number
  referenceType: string
  referenceId: number | null
  notes: string
  description: string
  createdAt: string
  direction: 'in' | 'out'
  isCashDelivery?: boolean
  cashDelivery?: CashDeliveryInfo | null
}

interface CurrencyDetailData {
  currency: string
  available: number
  reserved: number
  totalDeposits: number
  totalWithdrawals: number
  transactions: Transaction[]
}

const CURRENCIES = [
  { code: 'USD', name: 'Dolares', symbol: '$', flag: '🇺🇸' },
  { code: 'CUP', name: 'Pesos Cubanos', symbol: '', flag: '🇨🇺' },
  { code: 'MLC', name: 'MLC', symbol: '$', flag: '💳' },
  { code: 'EUR', name: 'Euros', symbol: '€', flag: '🇪🇺' }
]

// Animated counter component
function AnimatedCounter({ value, currency }: { value: number; currency: string }) {
  const [displayValue, setDisplayValue] = useState(0)
  const previousValue = useRef(0)

  useEffect(() => {
    const startValue = previousValue.current
    const endValue = value
    const duration = 1500 // 1.5 seconds
    const startTime = Date.now()

    const animate = () => {
      const now = Date.now()
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing function (ease out cubic)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = startValue + (endValue - startValue) * eased

      setDisplayValue(current)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        previousValue.current = endValue
      }
    }

    requestAnimationFrame(animate)
  }, [value])

  const formatValue = () => {
    if (currency === 'CUP') {
      return `${Math.round(displayValue).toLocaleString()} CUP`
    }
    const curr = CURRENCIES.find(c => c.code === currency)
    return `${curr?.symbol || '$'}${displayValue.toFixed(2)}`
  }

  return (
    <span className="tabular-nums">{formatValue()}</span>
  )
}

export default function BrokerWalletPage() {
  const [balances, setBalances] = useState<WalletBalance[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalDeposits: 0, totalWithdrawals: 0, totalTransactions: 0 })

  // Transaction detail modal
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)

  // Currency detail modal
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null)
  const [currencyDetail, setCurrencyDetail] = useState<CurrencyDetailData | null>(null)
  const [loadingCurrencyDetail, setLoadingCurrencyDetail] = useState(false)

  useEffect(() => {
    fetchWalletData()
  }, [])

  const fetchWalletData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/broker/wallet?history=true&historyLimit=50')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          const walletData = data.data

          // Use multi-currency balances if available
          if (walletData.currencyBalances && walletData.currencyBalances.length > 0) {
            const currencyBalances: WalletBalance[] = walletData.currencyBalances.map((cb: any) => ({
              currency: cb.currency,
              available: cb.available || 0,
              reserved: cb.reserved || 0,
              total: (cb.available || 0) + (cb.reserved || 0),
              lowThreshold: 100,
              isLow: (cb.available || 0) < 100
            }))
            setBalances(currencyBalances)
          } else {
            // Fallback to legacy single balance
            const walletBalance: WalletBalance = {
              currency: walletData.currency || 'USD',
              available: walletData.walletBalance || 0,
              reserved: 0,
              total: walletData.walletBalance || 0,
              lowThreshold: 100,
              isLow: (walletData.walletBalance || 0) < 100
            }
            setBalances([walletBalance])
          }

          // Set stats
          if (walletData.stats) {
            setStats({
              totalDeposits: walletData.stats.totalDeposits || 0,
              totalWithdrawals: walletData.stats.totalWithdrawals || 0,
              totalTransactions: walletData.stats.totalTransactions || 0
            })
          }

          // Map history transactions
          const txHistory = (walletData.history || []).map((tx: any) => ({
            id: tx.id,
            currency: tx.currency || 'USD',
            type: tx.direction === 'in' ? 'deposit' : 'withdrawal',
            typeLabel: tx.typeLabel || tx.type,
            amount: tx.amount || 0,
            balanceAfter: 0,
            referenceType: tx.typeLabel || tx.type,
            referenceId: null,
            notes: tx.notes || '',
            description: tx.description || '',
            createdAt: tx.createdAt,
            isCashDelivery: tx.isCashDelivery || false,
            cashDelivery: tx.cashDelivery || null
          }))
          setTransactions(txHistory)
        }
      }
    } catch (error) {
      console.error('Error fetching wallet:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCurrencyDetail = async (currencyCode: string) => {
    setSelectedCurrency(currencyCode)
    setLoadingCurrencyDetail(true)

    try {
      const response = await fetch(`/api/broker/wallet?history=true&historyLimit=50&currency=${currencyCode}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          const walletData = data.data
          const balance = walletData.currencyBalances?.find((b: any) => b.currency === currencyCode)

          const txHistory = (walletData.history || []).map((tx: any) => ({
            id: tx.id,
            currency: tx.currency || currencyCode,
            type: tx.direction === 'in' ? 'deposit' : 'withdrawal',
            typeLabel: tx.typeLabel || tx.type,
            amount: tx.amount || 0,
            balanceAfter: 0,
            referenceType: tx.typeLabel || tx.type,
            referenceId: null,
            notes: tx.notes || '',
            description: tx.description || '',
            createdAt: tx.createdAt,
            direction: tx.direction || 'out',
            isCashDelivery: tx.isCashDelivery || false,
            cashDelivery: tx.cashDelivery || null
          }))

          setCurrencyDetail({
            currency: currencyCode,
            available: balance?.available || 0,
            reserved: balance?.reserved || 0,
            totalDeposits: balance?.totalDeposits || 0,
            totalWithdrawals: balance?.totalWithdrawals || 0,
            transactions: txHistory
          })
        }
      }
    } catch (error) {
      console.error('Error fetching currency detail:', error)
    } finally {
      setLoadingCurrencyDetail(false)
    }
  }

  const closeCurrencyDetail = () => {
    setSelectedCurrency(null)
    setCurrencyDetail(null)
  }

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === 'CUP') {
      return `${amount.toLocaleString()} CUP`
    }
    const curr = CURRENCIES.find(c => c.code === currency)
    return `${curr?.symbol || '$'}${amount.toFixed(2)} ${currency}`
  }

  const getTransactionIcon = (tx: Transaction) => {
    if (tx.isCashDelivery) {
      return <Banknote className="w-4 h-4 text-green-500" />
    }
    switch (tx.type) {
      case 'deposit':
        return <ArrowDownLeft className="w-4 h-4 text-green-500" />
      case 'withdrawal':
        return <ArrowUpRight className="w-4 h-4 text-red-500" />
      case 'reservation':
        return <Clock className="w-4 h-4 text-orange-500" />
      case 'release':
        return <CheckCircle className="w-4 h-4 text-blue-500" />
      default:
        return <History className="w-4 h-4 text-gray-500" />
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                ))}
              </div>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const mainBalance = balances[0]?.available || 0
  const mainCurrency = balances[0]?.currency || 'USD'

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          {/* Header */}
          {/* Main Balance Card with Counting Effect */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-[#cc0a46] to-[#a50837] dark:from-[#2a5caa] dark:to-[#1e4387] rounded-2xl p-5 md:p-8 text-white shadow-lg"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/80 text-xs md:text-sm mb-1 md:mb-2">Balance Disponible</p>
                <div className="text-3xl md:text-5xl font-bold mb-2 md:mb-4">
                  <AnimatedCounter value={mainBalance} currency={mainCurrency} />
                </div>
                <div className="flex items-center gap-4 text-xs md:text-sm text-white/70">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    <span>{stats.totalTransactions} transacciones</span>
                  </div>
                </div>
              </div>
              <div className="p-2.5 md:p-4 bg-white/20 rounded-xl backdrop-blur-sm">
                <DollarSign className="w-6 h-6 md:w-8 md:h-8" />
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-3 md:gap-4 mt-4 md:mt-6 pt-4 md:pt-6 border-t border-white/20">
              <div>
                <p className="text-white/60 text-[10px] md:text-xs uppercase">Total Depósitos</p>
                <p className="text-lg md:text-xl font-semibold">
                  <AnimatedCounter value={stats.totalDeposits} currency={mainCurrency} />
                </p>
              </div>
              <div>
                <p className="text-white/60 text-[10px] md:text-xs uppercase">Total Retiros</p>
                <p className="text-lg md:text-xl font-semibold">
                  <AnimatedCounter value={stats.totalWithdrawals} currency={mainCurrency} />
                </p>
              </div>
            </div>
          </motion.div>

          {/* Currency Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {CURRENCIES.map((currency, index) => {
              const balance = balances.find(b => b.currency === currency.code)
              const available = balance?.available || 0
              const reserved = balance?.reserved || 0

              return (
                <motion.div
                  key={currency.code}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => fetchCurrencyDetail(currency.code)}
                  whileTap={{ scale: 0.98 }}
                  className={`bg-white dark:bg-gray-800 rounded-xl p-3 md:p-4 shadow-sm border transition-all cursor-pointer active:bg-gray-50 dark:active:bg-gray-700 touch-manipulation ${
                    available > 0
                      ? 'border-[#cc0a46]/30 dark:border-[#2a5caa]/30'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2 md:mb-3">
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <span className="text-lg md:text-xl">{currency.flag}</span>
                      <span className="font-medium text-sm md:text-base text-gray-700 dark:text-gray-300">{currency.code}</span>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-400" />
                  </div>
                  <p className="text-base md:text-lg font-bold text-gray-900 dark:text-white">
                    {available > 0 ? (
                      <AnimatedCounter value={available} currency={currency.code} />
                    ) : (
                      formatCurrency(0, currency.code)
                    )}
                  </p>
                  {reserved > 0 && (
                    <p className="text-[10px] md:text-xs text-orange-500 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Reservado: {formatCurrency(reserved, currency.code)}
                    </p>
                  )}
                  <p className="text-[10px] md:text-xs text-gray-400 mt-1.5 md:mt-2">Toca para ver detalles</p>
                </motion.div>
              )
            })}
          </div>

          {/* Recent Transactions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="p-4 md:p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <History className="w-4 h-4 md:w-5 md:h-5" />
                Historial de Movimientos
              </h2>
            </div>

            {transactions.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {transactions.map((tx, index) => (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.03 }}
                    onClick={() => setSelectedTransaction(tx)}
                    className="p-3 md:p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 active:bg-gray-100 dark:active:bg-gray-700 transition-colors cursor-pointer touch-manipulation"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
                        <div className={`p-2 md:p-2.5 rounded-full flex-shrink-0 ${
                          tx.isCashDelivery
                            ? 'bg-green-100 dark:bg-green-900/30'
                            : 'bg-gray-100 dark:bg-gray-700'
                        }`}>
                          {getTransactionIcon(tx)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm md:text-base text-gray-900 dark:text-white truncate">
                            {tx.typeLabel}
                          </p>
                          {tx.isCashDelivery && tx.cashDelivery ? (
                            <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-gray-500 dark:text-gray-400">
                              <User className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{tx.cashDelivery.deliveryUserName}</span>
                              {tx.cashDelivery.orderNumber && (
                                <span className="hidden sm:inline text-[10px] md:text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700">
                                  {tx.cashDelivery.orderNumber}
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 truncate">
                              {tx.description || tx.notes || tx.referenceType}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-semibold text-sm md:text-base ${
                          tx.type === 'deposit' || tx.type === 'release'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {tx.type === 'deposit' || tx.type === 'release' ? '+' : '-'}
                          {formatCurrency(Math.abs(tx.amount), tx.currency)}
                        </p>
                        <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400">
                          {new Date(tx.createdAt).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="p-8 md:p-12 text-center">
                <History className="w-10 h-10 md:w-12 md:h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">
                  No hay movimientos registrados
                </p>
              </div>
            )}
          </motion.div>

          {/* Transaction Detail Modal - Bottom sheet on mobile */}
          <AnimatePresence>
            {selectedTransaction && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-50 md:flex md:items-center md:justify-center md:p-4"
                onClick={() => setSelectedTransaction(null)}
              >
                <motion.div
                  initial={{ y: '100%', opacity: 1 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: '100%', opacity: 1 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  onClick={e => e.stopPropagation()}
                  className="absolute bottom-0 left-0 right-0 md:relative md:bottom-auto bg-white dark:bg-gray-800 rounded-t-3xl md:rounded-2xl shadow-xl w-full md:max-w-md max-h-[90vh] overflow-y-auto"
                  style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
                >
                  {/* Handle bar - mobile only */}
                  <div className="md:hidden flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
                  </div>

                  <div className="p-4 md:p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
                      Detalle de Transacción
                    </h3>
                    <button
                      onClick={() => setSelectedTransaction(null)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-4 md:p-5 space-y-4">
                    {/* Amount */}
                    <div className="text-center py-3 md:py-4">
                      <p className={`text-2xl md:text-3xl font-bold ${
                        selectedTransaction.type === 'deposit'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {selectedTransaction.type === 'deposit' ? '+' : '-'}
                        {formatCurrency(selectedTransaction.amount, selectedTransaction.currency)}
                      </p>
                      <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mt-1">
                        {selectedTransaction.typeLabel}
                      </p>
                    </div>

                    {/* Details */}
                    <div className="space-y-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 md:p-4">
                      <div className="flex justify-between text-sm md:text-base">
                        <span className="text-gray-500 dark:text-gray-400">Fecha</span>
                        <span className="font-medium text-gray-900 dark:text-white text-right">
                          {new Date(selectedTransaction.createdAt).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm md:text-base">
                        <span className="text-gray-500 dark:text-gray-400">Moneda</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {selectedTransaction.currency}
                        </span>
                      </div>
                    </div>

                    {/* Cash Delivery Info */}
                    {selectedTransaction.isCashDelivery && selectedTransaction.cashDelivery && (
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 md:p-4 space-y-2 md:space-y-3">
                        <p className="font-semibold text-sm md:text-base text-green-800 dark:text-green-300 flex items-center gap-2">
                          <Banknote className="w-4 h-4" />
                          Entrega de Efectivo
                        </p>
                        <div className="space-y-2 text-xs md:text-sm">
                          <div className="flex justify-between">
                            <span className="text-green-700 dark:text-green-400">Orden</span>
                            <span className="font-medium text-green-900 dark:text-green-200">
                              {selectedTransaction.cashDelivery.orderNumber || 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-green-700 dark:text-green-400 flex items-center gap-1">
                              <User className="w-3 h-3" />
                              Repartidor
                            </span>
                            <span className="font-medium text-green-900 dark:text-green-200">
                              {selectedTransaction.cashDelivery.deliveryUserName}
                            </span>
                          </div>
                          {selectedTransaction.cashDelivery.deliveryUserPhone && (
                            <div className="flex justify-between items-center">
                              <span className="text-green-700 dark:text-green-400 flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                Teléfono
                              </span>
                              <span className="font-medium text-green-900 dark:text-green-200">
                                {selectedTransaction.cashDelivery.deliveryUserPhone}
                              </span>
                            </div>
                          )}
                          {selectedTransaction.cashDelivery.totalBills > 0 && (
                            <div className="flex justify-between">
                              <span className="text-green-700 dark:text-green-400">Total Billetes</span>
                              <span className="font-medium text-green-900 dark:text-green-200">
                                {selectedTransaction.cashDelivery.totalBills}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {(selectedTransaction.description || selectedTransaction.notes) && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-1">Descripción</p>
                        <p className="text-sm md:text-base text-gray-900 dark:text-white">
                          {selectedTransaction.description || selectedTransaction.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="p-4 md:p-5 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => setSelectedTransaction(null)}
                      className="w-full py-3 md:py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium min-h-[48px] touch-manipulation"
                    >
                      Cerrar
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Currency Detail Modal - Bottom sheet on mobile */}
          <AnimatePresence>
            {selectedCurrency && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-50 md:flex md:items-center md:justify-center md:p-4"
                onClick={closeCurrencyDetail}
              >
                <motion.div
                  initial={{ y: '100%', opacity: 1 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: '100%', opacity: 1 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  onClick={e => e.stopPropagation()}
                  className="absolute bottom-0 left-0 right-0 md:relative md:bottom-auto bg-white dark:bg-gray-800 rounded-t-3xl md:rounded-2xl shadow-xl w-full md:max-w-2xl max-h-[90vh] md:max-h-[85vh] flex flex-col"
                  style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
                >
                  {/* Handle bar - mobile only */}
                  <div className="md:hidden flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
                  </div>

                  {/* Header */}
                  <div className="p-4 md:p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2.5 md:gap-3">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-[#cc0a46] to-[#a50837] dark:from-[#2a5caa] dark:to-[#1e4387] flex items-center justify-center text-xl md:text-2xl">
                        {CURRENCIES.find(c => c.code === selectedCurrency)?.flag}
                      </div>
                      <div>
                        <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                          {CURRENCIES.find(c => c.code === selectedCurrency)?.name}
                        </h3>
                        <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                          Detalles de {selectedCurrency}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={closeCurrencyDetail}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Content */}
                  {loadingCurrencyDetail ? (
                    <div className="p-8 md:p-12 flex items-center justify-center">
                      <RefreshCw className="w-8 h-8 animate-spin text-[#cc0a46] dark:text-[#2a5caa]" />
                    </div>
                  ) : currencyDetail ? (
                    <div className="flex-1 overflow-y-auto">
                      {/* Balance Summary */}
                      <div className="p-4 md:p-5 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                        <div className="grid grid-cols-2 gap-3 md:gap-4">
                          <div className="bg-white dark:bg-gray-700 rounded-xl p-3 md:p-4 shadow-sm">
                            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-1">Disponible</p>
                            <p className="text-xl md:text-2xl font-bold text-green-600 dark:text-green-400">
                              {formatCurrency(currencyDetail.available, selectedCurrency)}
                            </p>
                          </div>
                          <div className="bg-white dark:bg-gray-700 rounded-xl p-3 md:p-4 shadow-sm">
                            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-1">Reservado</p>
                            <p className="text-xl md:text-2xl font-bold text-orange-500">
                              {formatCurrency(currencyDetail.reserved, selectedCurrency)}
                            </p>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-3 md:gap-4 mt-3 md:mt-4">
                          <div className="flex items-center gap-2 md:gap-3 bg-white dark:bg-gray-700 rounded-xl p-3 md:p-4 shadow-sm">
                            <div className="p-1.5 md:p-2 bg-green-100 dark:bg-green-900/30 rounded-lg flex-shrink-0">
                              <ArrowDownLeft className="w-4 h-4 md:w-5 md:h-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400">Total Depósitos</p>
                              <p className="font-bold text-sm md:text-base text-gray-900 dark:text-white truncate">
                                {formatCurrency(currencyDetail.totalDeposits, selectedCurrency)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 md:gap-3 bg-white dark:bg-gray-700 rounded-xl p-3 md:p-4 shadow-sm">
                            <div className="p-1.5 md:p-2 bg-red-100 dark:bg-red-900/30 rounded-lg flex-shrink-0">
                              <ArrowUpRight className="w-4 h-4 md:w-5 md:h-5 text-red-600 dark:text-red-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400">Total Retiros</p>
                              <p className="font-bold text-sm md:text-base text-gray-900 dark:text-white truncate">
                                {formatCurrency(currencyDetail.totalWithdrawals, selectedCurrency)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Transactions List */}
                      <div className="p-4 md:p-5">
                        <h4 className="font-semibold text-sm md:text-base text-gray-900 dark:text-white mb-3 md:mb-4 flex items-center gap-2">
                          <History className="w-4 h-4 md:w-5 md:h-5" />
                          Movimientos en {selectedCurrency}
                        </h4>

                        {currencyDetail.transactions.length > 0 ? (
                          <div className="space-y-2">
                            {currencyDetail.transactions.map((tx, index) => (
                              <motion.div
                                key={tx.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.03 }}
                                className="flex items-center justify-between p-2.5 md:p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 active:bg-gray-100 dark:active:bg-gray-700 transition-colors touch-manipulation"
                              >
                                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                                  <div className={`p-1.5 md:p-2 rounded-full flex-shrink-0 ${
                                    tx.direction === 'in' || tx.type === 'deposit'
                                      ? 'bg-green-100 dark:bg-green-900/30'
                                      : 'bg-red-100 dark:bg-red-900/30'
                                  }`}>
                                    {tx.direction === 'in' || tx.type === 'deposit' ? (
                                      <ArrowDownLeft className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-600 dark:text-green-400" />
                                    ) : (
                                      <ArrowUpRight className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-600 dark:text-red-400" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-medium text-xs md:text-sm text-gray-900 dark:text-white truncate">
                                      {tx.typeLabel}
                                    </p>
                                    <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400">
                                      {new Date(tx.createdAt).toLocaleDateString('es-ES', {
                                        day: 'numeric',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </p>
                                  </div>
                                </div>
                                <p className={`font-bold text-sm md:text-base flex-shrink-0 ${
                                  tx.direction === 'in' || tx.type === 'deposit'
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-red-600 dark:text-red-400'
                                }`}>
                                  {tx.direction === 'in' || tx.type === 'deposit' ? '+' : '-'}
                                  {formatCurrency(Math.abs(tx.amount), selectedCurrency)}
                                </p>
                              </motion.div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-8 md:py-12 text-center">
                            <History className="w-10 h-10 md:w-12 md:h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                            <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">
                              No hay movimientos en {selectedCurrency}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {/* Footer */}
                  <div className="p-4 md:p-5 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <button
                      onClick={closeCurrencyDetail}
                      className="w-full py-3 md:py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium min-h-[48px] touch-manipulation"
                    >
                      Cerrar
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
