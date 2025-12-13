'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet,
  DollarSign,
  Plus,
  Building2,
  MapPin,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ArrowDownLeft,
  ArrowUpRight,
  History,
  X,
  Search,
  Users,
  Activity
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface Broker {
  id: number
  name: string
  tradeName: string
  walletNumber: string
  walletBalance: number
  walletBalanceFormatted: string
  currency: string
  province: string
  municipality: string
  isActive: boolean
  email: string
  phone: string
  logo: string | null
  createdAt: string
  stats: {
    totalTransactions: number
    totalDeposits: number
    totalDepositsFormatted: string
    totalWithdrawals: number
    totalWithdrawalsFormatted: string
  }
  lastTransactionDate: string | null
}

interface Summary {
  totalBrokers: number
  activeBrokers: number
  totalBalance: number
  totalBalanceFormatted: string
}

interface Transaction {
  id: number
  transactionNumber: string
  type: string
  typeLabel: string
  direction: 'in' | 'out'
  directionLabel: string
  brokerId: number
  brokerName: string
  amount: number
  amountFormatted: string
  currency: string
  paymentMethod: string
  paymentMethodLabel: string
  status: string
  description: string
  createdByName: string
  createdAt: string
  completedAt: string
}

export default function AdminBrokerWalletsPage() {
  const { theme } = useTheme()
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Deposit modal
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [selectedBroker, setSelectedBroker] = useState<Broker | null>(null)
  const [depositAmount, setDepositAmount] = useState('')
  const [depositNotes, setDepositNotes] = useState('')
  const [depositLoading, setDepositLoading] = useState(false)

  useEffect(() => {
    fetchWallets()
  }, [])

  const fetchWallets = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/brokers/wallets')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setBrokers(data.data.brokers || [])
          setSummary(data.data.summary || null)
          setTransactions(data.data.recentTransactions || [])
        }
      }
    } catch (error) {
      console.error('Error fetching wallets:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeposit = async () => {
    if (!selectedBroker || !depositAmount || parseFloat(depositAmount) <= 0) {
      alert('Seleccione un broker y monto valido')
      return
    }

    setDepositLoading(true)
    try {
      const response = await fetch(`/api/admin/brokers/${selectedBroker.id}/wallet/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(depositAmount),
          notes: depositNotes || `Deposito administrativo de $${depositAmount}`
        })
      })

      const data = await response.json()
      if (data.success) {
        setShowDepositModal(false)
        setSelectedBroker(null)
        setDepositAmount('')
        setDepositNotes('')
        fetchWallets()
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

  const openDepositModal = (broker: Broker) => {
    setSelectedBroker(broker)
    setShowDepositModal(true)
  }

  const getTransactionIcon = (direction: string) => {
    if (direction === 'in') {
      return <ArrowDownLeft className="w-4 h-4 text-green-500" />
    }
    return <ArrowUpRight className="w-4 h-4 text-red-500" />
  }

  const filteredBrokers = brokers.filter(broker => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      broker.name.toLowerCase().includes(search) ||
      broker.province?.toLowerCase().includes(search) ||
      broker.municipality?.toLowerCase().includes(search) ||
      broker.walletNumber?.toLowerCase().includes(search)
    )
  })

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className={cn(
        "min-h-screen p-6 space-y-6",
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className={cn(
              "text-2xl font-bold",
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              Wallets de Brokers
            </h1>
            <p className={cn(
              "mt-1",
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            )}>
              Administra los fondos de todos los brokers
            </p>
          </div>
          <Link
            href="/dashboard/admin/brokers"
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl transition-all",
              theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-white hover:bg-gray-100 text-gray-900 border border-gray-200'
            )}
          >
            <Building2 className="w-4 h-4" />
            Ver Brokers
          </Link>
        </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={cn(
            "rounded-xl p-5 shadow-sm border",
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Balance Total</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {summary?.totalBalanceFormatted || '$0.00'}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(
            "rounded-xl p-5 shadow-sm border",
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Brokers</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {summary?.totalBrokers || 0}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={cn(
            "rounded-xl p-5 shadow-sm border",
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Brokers Activos</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {summary?.activeBrokers || 0}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className={cn(
            "rounded-xl p-5 shadow-sm border",
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
              <Activity className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Transacciones Recientes</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {transactions.length}
          </p>
        </motion.div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar broker por nombre o ubicacion..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Brokers Wallets Table */}
      <div className={cn(
        "rounded-xl shadow-sm border overflow-hidden",
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={cn(
              theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
            )}>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Broker
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Wallet
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Balance
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Depositos
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Retiros
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Transacciones
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredBrokers.map((broker, index) => (
                <motion.tr
                  key={broker.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                        <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {broker.name}
                        </p>
                        {broker.province && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {broker.municipality}, {broker.province}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-sm font-mono text-gray-600 dark:text-gray-400">
                      {broker.walletNumber || '-'}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {broker.walletBalanceFormatted}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="text-sm text-green-600 dark:text-green-400">
                      {broker.stats.totalDepositsFormatted}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {broker.stats.totalWithdrawalsFormatted}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={cn(
                      "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                      theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                    )}>
                      {broker.stats.totalTransactions}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <button
                      onClick={() => openDepositModal(broker)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Depositar
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredBrokers.length === 0 && (
          <div className="p-12 text-center">
            <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm ? 'No se encontraron brokers' : 'No hay brokers registrados'}
            </p>
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className={cn(
        "rounded-xl shadow-sm border",
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <div className={cn(
          "p-5 border-b",
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        )}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5" />
            Movimientos Recientes
          </h2>
        </div>

        {transactions.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-96 overflow-y-auto">
            {transactions.map((tx, index) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02 }}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-full",
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    )}>
                      {getTransactionIcon(tx.direction)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {tx.typeLabel} - {tx.brokerName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {tx.description || tx.transactionNumber}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${
                      tx.direction === 'in'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {tx.direction === 'in' ? '+' : '-'}
                      {tx.amountFormatted}
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
      </div>

      {/* Deposit Modal */}
      <AnimatePresence>
        {showDepositModal && selectedBroker && (
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
              className={cn(
                "rounded-2xl shadow-xl w-full max-w-md",
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
            >
              <div className={cn(
                "p-5 border-b flex items-center justify-between",
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              )}>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Depositar Fondos
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedBroker.name}
                  </p>
                </div>
                <button
                  onClick={() => setShowDepositModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Current Balance Info */}
                <div className={cn(
                  "p-4 rounded-lg",
                  theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                )}>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Balance Actual</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedBroker.walletBalanceFormatted}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Wallet: {selectedBroker.walletNumber || 'Sin asignar'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Monto a Depositar
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={e => setDepositAmount(e.target.value)}
                      placeholder="0.00"
                      className={cn(
                        "w-full pl-10 pr-16 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent",
                        theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
                      )}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
                      {selectedBroker.currency || 'USD'}
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
                    className={cn(
                      "w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none",
                      theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
                    )}
                  />
                </div>

                {depositAmount && parseFloat(depositAmount) > 0 && (
                  <div className={cn(
                    "p-3 rounded-lg border",
                    theme === 'dark' ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'
                  )}>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Nuevo balance: <span className="font-bold">
                        ${((selectedBroker.walletBalance || 0) + parseFloat(depositAmount)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </p>
                  </div>
                )}
              </div>

              <div className={cn(
                "p-5 border-t flex gap-3",
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              )}>
                <button
                  onClick={() => setShowDepositModal(false)}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-lg transition-colors",
                    theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeposit}
                  disabled={depositLoading || !depositAmount || parseFloat(depositAmount) <= 0}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
      </div>
    </DashboardLayout>
  )
}
