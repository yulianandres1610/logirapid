'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign,
  Plus,
  Clock,
  CheckCircle,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  X,
  TrendingUp,
  ShoppingBag
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
  isOrderPayment?: boolean
  counterparty?: string
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
  { code: 'USD', name: 'Dolares', symbol: '$', flag: '\ud83c\uddfa\ud83c\uddf8' },
  { code: 'CUP', name: 'Pesos Cubanos', symbol: '', flag: '\ud83c\udde8\ud83c\uddfa' },
  { code: 'MLC', name: 'MLC', symbol: '$', flag: '\ud83d\udcb3' },
  { code: 'EUR', name: 'Euros', symbol: '\u20ac', flag: '\ud83c\uddea\ud83c\uddfa' }
]

// Animated counter component
function AnimatedCounter({ value, currency }: { value: number; currency: string }) {
  const [displayValue, setDisplayValue] = useState(0)
  const previousValue = useRef(0)

  useEffect(() => {
    const startValue = previousValue.current
    const endValue = value
    const duration = 1500
    const startTime = Date.now()

    const animate = () => {
      const now = Date.now()
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
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

export default function MarketWalletPage() {
  const [balances, setBalances] = useState<WalletBalance[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalDeposits: 0, totalWithdrawals: 0, totalTransactions: 0 })

  // Deposit modal state
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [depositCurrency, setDepositCurrency] = useState('USD')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositNotes, setDepositNotes] = useState('')
  const [depositLoading, setDepositLoading] = useState(false)

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
      const response = await fetch('/api/market/wallet?history=true&historyLimit=50')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          const walletData = data.data

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

          if (walletData.stats) {
            setStats({
              totalDeposits: walletData.stats.totalDeposits || 0,
              totalWithdrawals: walletData.stats.totalWithdrawals || 0,
              totalTransactions: walletData.stats.totalTransactions || 0
            })
          }

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
            direction: tx.direction || 'out',
            isOrderPayment: tx.isOrderPayment || false,
            counterparty: tx.counterparty || null
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

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      alert('Ingrese un monto valido')
      return
    }

    setDepositLoading(true)
    try {
      const response = await fetch('/api/market/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'deposit',
          amount: parseFloat(depositAmount),
          notes: depositNotes || `Deposito de ${depositAmount} ${depositCurrency}`,
          paymentMethod: 'wire'
        })
      })

      const data = await response.json()
      if (data.success) {
        setShowDepositModal(false)
        setDepositAmount('')
        setDepositNotes('')
        fetchWalletData()
      } else {
        alert(data.error || 'Error al depositar')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al procesar el deposito')
    } finally {
      setDepositLoading(false)
    }
  }

  const fetchCurrencyDetail = async (currencyCode: string) => {
    setSelectedCurrency(currencyCode)
    setLoadingCurrencyDetail(true)

    try {
      const response = await fetch(`/api/market/wallet?history=true&historyLimit=50&currency=${currencyCode}`)
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
            isOrderPayment: tx.isOrderPayment || false
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
    if (tx.isOrderPayment) {
      return <ShoppingBag className="w-4 h-4 text-green-500" />
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Header skeleton */}
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                  <div className="h-4 w-48 bg-gray-100 dark:bg-gray-800 rounded animate-pulse"></div>
                </div>
                <div className="flex gap-2">
                  <div className="h-10 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                  <div className="h-10 w-28 bg-green-200 dark:bg-green-900/30 rounded-lg animate-pulse"></div>
                </div>
              </div>

              {/* Main balance card skeleton */}
              <div className="bg-gradient-to-br from-green-600/80 to-green-800/80 rounded-2xl p-8 animate-pulse">
                <div className="space-y-4">
                  <div className="h-4 w-32 bg-white/20 rounded"></div>
                  <div className="h-12 w-48 bg-white/30 rounded-lg"></div>
                  <div className="h-4 w-40 bg-white/20 rounded"></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/20">
                  <div className="space-y-2">
                    <div className="h-3 w-20 bg-white/20 rounded"></div>
                    <div className="h-6 w-28 bg-white/30 rounded"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-20 bg-white/20 rounded"></div>
                    <div className="h-6 w-28 bg-white/30 rounded"></div>
                  </div>
                </div>
              </div>

              {/* Currency cards skeleton */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 animate-pulse"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                      <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>
                    <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                    <div className="h-3 w-32 bg-gray-100 dark:bg-gray-800 rounded"></div>
                  </motion.div>
                ))}
              </div>

              {/* Transactions skeleton */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                  <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="p-4 flex items-center justify-between animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                        <div className="space-y-2">
                          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                          <div className="h-3 w-24 bg-gray-100 dark:bg-gray-800 rounded"></div>
                        </div>
                      </div>
                      <div className="space-y-2 text-right">
                        <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="h-3 w-16 bg-gray-100 dark:bg-gray-800 rounded"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="p-6 space-y-6"
        >
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center justify-between"
          >
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Mi Wallet
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Gestiona tus balances y movimientos
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchWalletData}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Actualizar
              </button>
              <button
                onClick={() => setShowDepositModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-lg hover:opacity-90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Depositar
              </button>
            </div>
          </motion.div>

          {/* Main Balance Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-green-600 to-green-800 dark:from-green-700 dark:to-green-900 rounded-2xl p-8 text-white shadow-lg"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/80 text-sm mb-2">Balance Disponible</p>
                <div className="text-4xl md:text-5xl font-bold mb-4">
                  <AnimatedCounter value={mainBalance} currency={mainCurrency} />
                </div>
                <div className="flex items-center gap-4 text-sm text-white/70">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    <span>{stats.totalTransactions} transacciones</span>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-white/20 rounded-xl backdrop-blur-sm">
                <DollarSign className="w-8 h-8" />
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/20">
              <div>
                <p className="text-white/60 text-xs uppercase">Total Ingresos</p>
                <p className="text-xl font-semibold">
                  <AnimatedCounter value={stats.totalDeposits} currency={mainCurrency} />
                </p>
              </div>
              <div>
                <p className="text-white/60 text-xs uppercase">Total Egresos</p>
                <p className="text-xl font-semibold">
                  <AnimatedCounter value={stats.totalWithdrawals} currency={mainCurrency} />
                </p>
              </div>
            </div>
          </motion.div>

          {/* Currency Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border transition-all cursor-pointer hover:shadow-md ${
                    available > 0
                      ? 'border-green-600/30 dark:border-green-500/30 hover:border-green-600 dark:hover:border-green-500'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{currency.flag}</span>
                      <span className="font-medium text-gray-700 dark:text-gray-300">{currency.code}</span>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-500" />
                  </div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {available > 0 ? (
                      <AnimatedCounter value={available} currency={currency.code} />
                    ) : (
                      formatCurrency(0, currency.code)
                    )}
                  </p>
                  {reserved > 0 && (
                    <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Reservado: {formatCurrency(reserved, currency.code)}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">Click para ver detalles</p>
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
            <div className="p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5" />
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
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-full ${
                          tx.isOrderPayment
                            ? 'bg-green-100 dark:bg-green-900/30'
                            : 'bg-gray-100 dark:bg-gray-700'
                        }`}>
                          {getTransactionIcon(tx)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {tx.typeLabel}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {tx.counterparty || tx.description || tx.notes || tx.referenceType}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${
                          tx.type === 'deposit' || tx.type === 'release' || tx.direction === 'in'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {tx.type === 'deposit' || tx.type === 'release' || tx.direction === 'in' ? '+' : '-'}
                          {formatCurrency(Math.abs(tx.amount), tx.currency)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
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
              <div className="p-12 text-center">
                <History className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  No hay movimientos registrados
                </p>
              </div>
            )}
          </motion.div>

          {/* Transaction Detail Modal */}
          <AnimatePresence>
            {selectedTransaction && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                onClick={() => setSelectedTransaction(null)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={e => e.stopPropagation()}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md"
                >
                  <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Detalle de Transaccion
                    </h3>
                    <button
                      onClick={() => setSelectedTransaction(null)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="text-center py-4">
                      <p className={`text-3xl font-bold ${
                        selectedTransaction.type === 'deposit' || selectedTransaction.direction === 'in'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {selectedTransaction.type === 'deposit' || selectedTransaction.direction === 'in' ? '+' : '-'}
                        {formatCurrency(selectedTransaction.amount, selectedTransaction.currency)}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 mt-1">
                        {selectedTransaction.typeLabel}
                      </p>
                    </div>

                    <div className="space-y-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Fecha</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {new Date(selectedTransaction.createdAt).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Moneda</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {selectedTransaction.currency}
                        </span>
                      </div>
                      {selectedTransaction.counterparty && (
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Contraparte</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {selectedTransaction.counterparty}
                          </span>
                        </div>
                      )}
                    </div>

                    {(selectedTransaction.description || selectedTransaction.notes) && (
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Descripcion</p>
                        <p className="text-gray-900 dark:text-white">
                          {selectedTransaction.description || selectedTransaction.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="p-5 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => setSelectedTransaction(null)}
                      className="w-full py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                    >
                      Cerrar
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Deposit Modal */}
          <AnimatePresence>
            {showDepositModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                onClick={() => setShowDepositModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={e => e.stopPropagation()}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md"
                >
                  <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Depositar Fondos
                    </h3>
                    <button
                      onClick={() => setShowDepositModal(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-5 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Moneda
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {CURRENCIES.map(currency => (
                          <button
                            key={currency.code}
                            onClick={() => setDepositCurrency(currency.code)}
                            className={`p-3 rounded-lg border-2 text-center transition-colors ${
                              depositCurrency === currency.code
                                ? 'border-green-600 dark:border-green-500 bg-green-600/10 dark:bg-green-500/10'
                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                            }`}
                          >
                            <span className="text-xl">{currency.flag}</span>
                            <p className="text-xs font-medium mt-1">{currency.code}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Monto
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="number"
                          value={depositAmount}
                          onChange={e => setDepositAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-10 pr-16 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-600 dark:focus:ring-green-500 focus:border-transparent"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
                          {depositCurrency}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Notas (opcional)
                      </label>
                      <textarea
                        value={depositNotes}
                        onChange={e => setDepositNotes(e.target.value)}
                        placeholder="Referencia o descripcion del deposito..."
                        rows={2}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-600 dark:focus:ring-green-500 focus:border-transparent resize-none"
                      />
                    </div>
                  </div>

                  <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                    <button
                      onClick={() => setShowDepositModal(false)}
                      className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleDeposit}
                      disabled={depositLoading || !depositAmount}
                      className="flex-1 px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {depositLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      Depositar
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Currency Detail Modal */}
          <AnimatePresence>
            {selectedCurrency && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                onClick={closeCurrencyDetail}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 20 }}
                  onClick={e => e.stopPropagation()}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
                >
                  {/* Header */}
                  <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-600 to-green-800 dark:from-green-700 dark:to-green-900 flex items-center justify-center text-2xl">
                        {CURRENCIES.find(c => c.code === selectedCurrency)?.flag}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                          {CURRENCIES.find(c => c.code === selectedCurrency)?.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Detalles de {selectedCurrency}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={closeCurrencyDetail}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Content */}
                  {loadingCurrencyDetail ? (
                    <div className="p-12 flex items-center justify-center">
                      <RefreshCw className="w-8 h-8 animate-spin text-green-600 dark:text-green-500" />
                    </div>
                  ) : currencyDetail ? (
                    <div className="flex-1 overflow-y-auto">
                      {/* Balance Summary */}
                      <div className="p-5 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white dark:bg-gray-700 rounded-xl p-4 shadow-sm">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Disponible</p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                              {formatCurrency(currencyDetail.available, selectedCurrency)}
                            </p>
                          </div>
                          <div className="bg-white dark:bg-gray-700 rounded-xl p-4 shadow-sm">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Reservado</p>
                            <p className="text-2xl font-bold text-orange-500">
                              {formatCurrency(currencyDetail.reserved, selectedCurrency)}
                            </p>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div className="flex items-center gap-3 bg-white dark:bg-gray-700 rounded-xl p-4 shadow-sm">
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                              <ArrowDownLeft className="w-5 h-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Total Ingresos</p>
                              <p className="font-bold text-gray-900 dark:text-white">
                                {formatCurrency(currencyDetail.totalDeposits, selectedCurrency)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 bg-white dark:bg-gray-700 rounded-xl p-4 shadow-sm">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                              <ArrowUpRight className="w-5 h-5 text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Total Egresos</p>
                              <p className="font-bold text-gray-900 dark:text-white">
                                {formatCurrency(currencyDetail.totalWithdrawals, selectedCurrency)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Transactions List */}
                      <div className="p-5">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <History className="w-5 h-5" />
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
                                className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-full ${
                                    tx.direction === 'in' || tx.type === 'deposit'
                                      ? 'bg-green-100 dark:bg-green-900/30'
                                      : 'bg-red-100 dark:bg-red-900/30'
                                  }`}>
                                    {tx.direction === 'in' || tx.type === 'deposit' ? (
                                      <ArrowDownLeft className="w-4 h-4 text-green-600 dark:text-green-400" />
                                    ) : (
                                      <ArrowUpRight className="w-4 h-4 text-red-600 dark:text-red-400" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm text-gray-900 dark:text-white">
                                      {tx.typeLabel}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {new Date(tx.createdAt).toLocaleDateString('es-ES', {
                                        day: 'numeric',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </p>
                                  </div>
                                </div>
                                <p className={`font-bold ${
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
                          <div className="py-12 text-center">
                            <History className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-500 dark:text-gray-400">
                              No hay movimientos en {selectedCurrency}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {/* Footer */}
                  <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <button
                      onClick={closeCurrencyDetail}
                      className="w-full py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                    >
                      Cerrar
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
