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
  Search
} from 'lucide-react'
import Link from 'next/link'

interface BrokerBalance {
  currency: string
  available: number
  reserved: number
  total: number
  lowThreshold: number
  isLow: boolean
  lastUpdated: string
}

interface Broker {
  id: number
  name: string
  province: string
  municipality: string
  isActive: boolean
  balances: BrokerBalance[]
}

interface CurrencyTotal {
  currency: string
  totalAvailable: number
  totalReserved: number
  grandTotal: number
  brokerCount: number
}

interface Transaction {
  id: number
  brokerId: number
  brokerName: string
  currency: string
  type: string
  amount: number
  balanceAfter: number
  referenceType: string
  referenceId: number | null
  notes: string
  createdAt: string
  createdByName: string | null
}

const CURRENCIES = [
  { code: 'USD', name: 'Dolares', symbol: '$', flag: '🇺🇸' },
  { code: 'CUP', name: 'Pesos Cubanos', symbol: '', flag: '🇨🇺' },
  { code: 'MLC', name: 'MLC', symbol: '$', flag: '💳' },
  { code: 'EUR', name: 'Euros', symbol: '€', flag: '🇪🇺' }
]

export default function AdminBrokerWalletsPage() {
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [totals, setTotals] = useState<CurrencyTotal[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Deposit modal
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [selectedBroker, setSelectedBroker] = useState<Broker | null>(null)
  const [depositCurrency, setDepositCurrency] = useState('USD')
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
          setTotals(data.data.totals || [])
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
          currency: depositCurrency,
          amount: parseFloat(depositAmount),
          notes: depositNotes || `Deposito administrativo de ${depositAmount} ${depositCurrency}`
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

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === 'CUP') {
      return `${amount.toLocaleString()} CUP`
    }
    const curr = CURRENCIES.find(c => c.code === currency)
    return `${curr?.symbol || '$'}${amount.toFixed(2)} ${currency}`
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
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

  const getTransactionLabel = (type: string) => {
    const labels: Record<string, string> = {
      deposit: 'Deposito',
      withdrawal: 'Retiro',
      reservation: 'Reserva',
      release: 'Liberacion'
    }
    return labels[type] || type
  }

  const filteredBrokers = brokers.filter(broker => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      broker.name.toLowerCase().includes(search) ||
      broker.province?.toLowerCase().includes(search) ||
      broker.municipality?.toLowerCase().includes(search)
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Wallets de Brokers
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Administra los fondos de todos los brokers
          </p>
        </div>
        <Link
          href="/dashboard/admin/brokers"
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <Building2 className="w-4 h-4" />
          Ver Brokers
        </Link>
      </div>

      {/* Totals by Currency */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {CURRENCIES.map((currency, index) => {
          const total = totals.find(t => t.currency === currency.code)
          return (
            <motion.div
              key={currency.code}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{currency.flag}</span>
                <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                  {total?.brokerCount || 0} brokers
                </span>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Disponible</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(total?.totalAvailable || 0, currency.code)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Reservado</p>
                    <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                      {formatCurrency(total?.totalReserved || 0, currency.code)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(total?.grandTotal || 0, currency.code)}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })}
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Broker
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  USD
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  CUP
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  MLC
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  EUR
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
                        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {broker.municipality}, {broker.province}
                        </p>
                      </div>
                    </div>
                  </td>
                  {['USD', 'CUP', 'MLC', 'EUR'].map(currency => {
                    const balance = broker.balances.find(b => b.currency === currency)
                    return (
                      <td key={currency} className="px-4 py-4">
                        {balance ? (
                          <div className={balance.isLow ? 'text-red-600 dark:text-red-400' : ''}>
                            <p className="font-semibold">
                              {formatCurrency(balance.available, currency)}
                            </p>
                            {balance.reserved > 0 && (
                              <p className="text-xs text-orange-600 dark:text-orange-400">
                                {formatCurrency(balance.reserved, currency)} res.
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    )
                  })}
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
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
                    <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-700">
                      {getTransactionIcon(tx.type)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {getTransactionLabel(tx.type)} - {tx.brokerName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {tx.notes || tx.referenceType}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${
                      tx.type === 'deposit' || tx.type === 'release'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {tx.type === 'deposit' || tx.type === 'release' ? '+' : '-'}
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
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md"
            >
              <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
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
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
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
                      className="w-full pl-10 pr-16 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
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
  )
}
