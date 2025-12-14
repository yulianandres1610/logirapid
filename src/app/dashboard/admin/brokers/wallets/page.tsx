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
  Activity,
  Banknote,
  Calendar,
  ArrowLeft,
  ArrowRight,
  Loader2
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

// Mapeo de IDs de provincias a nombres completos
const PROVINCE_ID_TO_NAME: Record<string, string> = {
  'pinar-del-rio': 'Pinar del Río',
  'artemisa': 'Artemisa',
  'la-habana': 'La Habana',
  'mayabeque': 'Mayabeque',
  'matanzas': 'Matanzas',
  'cienfuegos': 'Cienfuegos',
  'villa-clara': 'Villa Clara',
  'sancti-spiritus': 'Sancti Spíritus',
  'ciego-de-avila': 'Ciego de Ávila',
  'camaguey': 'Camagüey',
  'las-tunas': 'Las Tunas',
  'holguin': 'Holguín',
  'granma': 'Granma',
  'santiago-de-cuba': 'Santiago de Cuba',
  'santiago': 'Santiago de Cuba',
  'guantanamo': 'Guantánamo',
  'isla-de-la-juventud': 'Isla de la Juventud'
}

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

interface DeliveryUser {
  id: number
  name: string
  email: string
  phone: string
  role: string
}

// Bill denominations by currency
const BILL_DENOMINATIONS: { [key: string]: number[] } = {
  USD: [100, 50, 20, 10, 5, 1],
  EUR: [500, 200, 100, 50, 20, 10, 5],
  CUP: [1000, 500, 200, 100, 50, 20, 10, 5, 1],
  MLC: [100, 50, 20, 10, 5, 1]
}

const WIZARD_STEPS = [
  { id: 1, title: 'Repartidor', icon: Users },
  { id: 2, title: 'Nomenclatura', icon: Banknote },
  { id: 3, title: 'Fecha Límite', icon: Calendar },
  { id: 4, title: 'Confirmación', icon: CheckCircle }
]

export default function AdminBrokerWalletsPage() {
  const { theme } = useTheme()
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Cash Delivery Wizard Modal
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [selectedBroker, setSelectedBroker] = useState<Broker | null>(null)
  const [wizardStep, setWizardStep] = useState(1)
  const [deliveryUsers, setDeliveryUsers] = useState<DeliveryUser[]>([])
  const [selectedUser, setSelectedUser] = useState<DeliveryUser | null>(null)
  const [userSearch, setUserSearch] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [billDenominations, setBillDenominations] = useState<{ [key: string]: number }>({})
  const [deadlineDate, setDeadlineDate] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
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

  // Load delivery users when modal opens
  const loadDeliveryUsers = async () => {
    try {
      const res = await fetch('/api/users?role=USER,DRIVER')
      const data = await res.json()
      if (data.success) {
        setDeliveryUsers(data.data || data.users || [])
      }
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  // Calculate totals from bill denominations
  const calculateTotals = () => {
    let totalAmount = 0
    let totalBills = 0

    for (const [denom, count] of Object.entries(billDenominations)) {
      const quantity = Number(count) || 0
      totalAmount += parseInt(denom) * quantity
      totalBills += quantity
    }

    return { totalAmount, totalBills }
  }

  const { totalAmount, totalBills } = calculateTotals()

  // Handle bill denomination change
  const handleDenominationChange = (denomination: number, value: string) => {
    const numValue = parseInt(value) || 0
    setBillDenominations(prev => ({
      ...prev,
      [denomination]: numValue >= 0 ? numValue : 0
    }))
  }

  // Validate wizard step
  const isStepValid = () => {
    switch (wizardStep) {
      case 1:
        return selectedUser !== null
      case 2:
        return totalAmount > 0
      case 3:
        return deadlineDate !== ''
      case 4:
        return true
      default:
        return false
    }
  }

  // Submit cash delivery order
  const handleSubmitDelivery = async () => {
    if (!selectedBroker || !selectedUser) return

    setDepositLoading(true)
    try {
      const response = await fetch('/api/admin/cash-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brokerCompanyId: selectedBroker.id,
          deliveryUserId: selectedUser.id,
          currency: currency,
          billDenominations: billDenominations,
          deadlineDate: deadlineDate,
          notes: deliveryNotes
        })
      })

      const data = await response.json()
      if (data.success) {
        alert(`Orden ${data.data.orderNumber} creada exitosamente`)
        closeWizard()
        fetchWallets()
      } else {
        alert(data.error || 'Error al crear la orden')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al procesar la orden')
    } finally {
      setDepositLoading(false)
    }
  }

  const openDepositModal = (broker: Broker) => {
    setSelectedBroker(broker)
    setWizardStep(1)
    setSelectedUser(null)
    setUserSearch('')
    setCurrency('USD')
    setBillDenominations({})
    setDeadlineDate('')
    setDeliveryNotes('')
    setShowDepositModal(true)
    loadDeliveryUsers()
  }

  const closeWizard = () => {
    setShowDepositModal(false)
    setSelectedBroker(null)
    setWizardStep(1)
    setSelectedUser(null)
    setBillDenominations({})
  }

  // Filter users
  const filteredUsers = deliveryUsers.filter(user =>
    user.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    user.email?.toLowerCase().includes(userSearch.toLowerCase())
  )

  const getTransactionIcon = (direction: string) => {
    if (direction === 'in') {
      return <ArrowDownLeft className="w-4 h-4 text-green-500" />
    }
    return <ArrowUpRight className="w-4 h-4 text-red-500" />
  }

  const filteredBrokers = brokers.filter(broker => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    const provinceName = PROVINCE_ID_TO_NAME[broker.province] || broker.province || ''
    const municipalityName = PROVINCE_ID_TO_NAME[broker.municipality] || broker.municipality || ''
    return (
      broker.name.toLowerCase().includes(search) ||
      provinceName.toLowerCase().includes(search) ||
      municipalityName.toLowerCase().includes(search) ||
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
      <div className="min-h-full space-y-6">
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={cn(
            "relative overflow-hidden rounded-2xl p-5",
            theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'
          )}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                Balance Total
              </p>
              <p className={cn("text-3xl font-bold mt-1", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                {summary?.totalBalanceFormatted || '$0.00'}
              </p>
              <p className={cn("text-xs mt-2", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                Fondos disponibles
              </p>
            </div>
            <div className={cn("p-3 rounded-xl", theme === 'dark' ? 'bg-green-500/20' : 'bg-green-50')}>
              <DollarSign className="w-6 h-6 text-green-500" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-green-400" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(
            "relative overflow-hidden rounded-2xl p-5",
            theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'
          )}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                Total Brokers
              </p>
              <p className={cn("text-3xl font-bold mt-1", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                {summary?.totalBrokers || 0}
              </p>
              <p className={cn("text-xs mt-2", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                Registrados
              </p>
            </div>
            <div className={cn("p-3 rounded-xl", theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-50')}>
              <Users className="w-6 h-6 text-blue-500" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-400" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={cn(
            "relative overflow-hidden rounded-2xl p-5",
            theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'
          )}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                Brokers Activos
              </p>
              <p className={cn("text-3xl font-bold mt-1", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                {summary?.activeBrokers || 0}
              </p>
              <p className={cn("text-xs mt-2", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                Operando
              </p>
            </div>
            <div className={cn("p-3 rounded-xl", theme === 'dark' ? 'bg-emerald-500/20' : 'bg-emerald-50')}>
              <CheckCircle className="w-6 h-6 text-emerald-500" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className={cn(
            "relative overflow-hidden rounded-2xl p-5",
            theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'
          )}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                Transacciones
              </p>
              <p className={cn("text-3xl font-bold mt-1", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                {transactions.length}
              </p>
              <p className={cn("text-xs mt-2", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                Recientes
              </p>
            </div>
            <div className={cn("p-3 rounded-xl", theme === 'dark' ? 'bg-violet-500/20' : 'bg-violet-50')}>
              <Activity className="w-6 h-6 text-violet-500" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-violet-400" />
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
          className={cn(
            "w-full pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors",
            theme === 'dark'
              ? 'bg-white/5 border border-white/10 text-white placeholder-gray-500'
              : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400'
          )}
        />
      </div>

      {/* Brokers Wallets Table */}
      <div className={cn(
        "rounded-2xl overflow-hidden",
        theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'
      )}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={cn(
              theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'
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
                            {PROVINCE_ID_TO_NAME[broker.municipality] || broker.municipality}, {PROVINCE_ID_TO_NAME[broker.province] || broker.province}
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
        "rounded-2xl overflow-hidden",
        theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'
      )}>
        <div className={cn(
          "p-5 border-b",
          theme === 'dark' ? 'border-white/10' : 'border-gray-100'
        )}>
          <h2 className={cn("text-lg font-semibold flex items-center gap-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            <History className="w-5 h-5" />
            Movimientos Recientes
          </h2>
        </div>

        {transactions.length > 0 ? (
          <div className={cn("divide-y max-h-96 overflow-y-auto", theme === 'dark' ? 'divide-white/10' : 'divide-gray-100')}>
            {transactions.map((tx, index) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02 }}
                className={cn("p-4 transition-colors", theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-full",
                      theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'
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

      {/* Cash Delivery Wizard Modal */}
      <AnimatePresence>
        {showDepositModal && selectedBroker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={closeWizard}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className={cn(
                "rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col",
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
            >
              {/* Header */}
              <div className={cn(
                "p-5 border-b flex items-center justify-between shrink-0",
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              )}>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Nueva Entrega de Efectivo
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedBroker.name}
                  </p>
                </div>
                <button
                  onClick={closeWizard}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Steps Indicator */}
              <div className={cn("px-5 py-3 border-b shrink-0", theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                <div className="flex items-center justify-between">
                  {WIZARD_STEPS.map((step, index) => {
                    const Icon = step.icon
                    const isActive = wizardStep === step.id
                    const isCompleted = wizardStep > step.id

                    return (
                      <div key={step.id} className="flex items-center flex-1">
                        <div className="flex flex-col items-center flex-1">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center mb-1 transition-all",
                            isActive ? 'bg-green-500 text-white' :
                              isCompleted ? 'bg-green-500 text-white' :
                                theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-400'
                          )}>
                            {isCompleted ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                          </div>
                          <span className={cn("text-xs", isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500')}>
                            {step.title}
                          </span>
                        </div>
                        {index < WIZARD_STEPS.length - 1 && (
                          <div className={cn(
                            "h-0.5 flex-1 mx-2",
                            isCompleted ? 'bg-green-500' : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                          )} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Content */}
              <div className="p-5 overflow-y-auto flex-1">
                <AnimatePresence mode="wait">
                  {/* Step 1: Select Delivery User */}
                  {wizardStep === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <h4 className="font-medium text-gray-900 dark:text-white">Seleccionar Repartidor</h4>

                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Buscar repartidor..."
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          className={cn(
                            "w-full pl-10 pr-4 py-2 rounded-lg border",
                            theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
                          )}
                        />
                      </div>

                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {filteredUsers.length === 0 ? (
                          <p className="text-center py-4 text-gray-500">No se encontraron repartidores</p>
                        ) : (
                          filteredUsers.map(user => (
                            <button
                              key={user.id}
                              onClick={() => setSelectedUser(user)}
                              className={cn(
                                "w-full p-3 rounded-xl border-2 transition-all text-left",
                                selectedUser?.id === user.id
                                  ? 'border-green-500 bg-green-500/10'
                                  : `border-transparent ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-50 hover:bg-gray-100'}`
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white">{user.name}</p>
                                  <p className="text-sm text-gray-500">{user.phone || 'Sin teléfono'}</p>
                                </div>
                                {selectedUser?.id === user.id && (
                                  <CheckCircle className="h-5 w-5 text-green-500" />
                                )}
                              </div>
                              {!user.phone && (
                                <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  Usuario necesita teléfono para OTP
                                </p>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2: Bill Denominations */}
                  {wizardStep === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900 dark:text-white">Nomenclatura de Billetes</h4>
                        <select
                          value={currency}
                          onChange={(e) => {
                            setCurrency(e.target.value)
                            setBillDenominations({})
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg border text-sm",
                            theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
                          )}
                        >
                          {Object.keys(BILL_DENOMINATIONS).map(curr => (
                            <option key={curr} value={curr}>{curr}</option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {BILL_DENOMINATIONS[currency]?.map(denom => {
                          const count = billDenominations[denom] || 0
                          const subtotal = denom * count

                          return (
                            <div
                              key={denom}
                              className={cn("p-3 rounded-xl", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50')}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-gray-900 dark:text-white">${denom}</span>
                              </div>
                              <input
                                type="number"
                                min="0"
                                value={count || ''}
                                onChange={(e) => handleDenominationChange(denom, e.target.value)}
                                placeholder="0"
                                className={cn(
                                  "w-full px-2 py-1.5 rounded-lg border text-center text-sm",
                                  theme === 'dark' ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-200'
                                )}
                              />
                              <p className="text-xs text-gray-500 mt-1 text-center">= ${subtotal.toLocaleString()}</p>
                            </div>
                          )
                        })}
                      </div>

                      {/* Summary */}
                      <div className={cn(
                        "p-4 rounded-xl border",
                        theme === 'dark' ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'
                      )}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Total billetes</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{totalBills}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Total a entregar</p>
                            <p className="text-xl font-bold text-green-600">{currency} ${totalAmount.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Deadline */}
                  {wizardStep === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <h4 className="font-medium text-gray-900 dark:text-white">Fecha Límite de Entrega</h4>

                      <div>
                        <label className="block text-sm text-gray-500 mb-2">Fecha límite para completar la entrega</label>
                        <input
                          type="date"
                          value={deadlineDate}
                          onChange={(e) => setDeadlineDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className={cn(
                            "w-full px-4 py-3 rounded-xl border",
                            theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
                          )}
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-500 mb-2">Notas adicionales (opcional)</label>
                        <textarea
                          value={deliveryNotes}
                          onChange={(e) => setDeliveryNotes(e.target.value)}
                          placeholder="Instrucciones especiales para el repartidor..."
                          rows={3}
                          className={cn(
                            "w-full px-4 py-3 rounded-xl border resize-none",
                            theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
                          )}
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* Step 4: Confirmation */}
                  {wizardStep === 4 && (
                    <motion.div
                      key="step4"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <h4 className="font-medium text-gray-900 dark:text-white">Confirmar Orden de Entrega</h4>

                      <div className="space-y-3">
                        <div className={cn("p-3 rounded-xl", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50')}>
                          <p className="text-xs text-gray-500 mb-1">Broker destino</p>
                          <p className="font-medium text-gray-900 dark:text-white">{selectedBroker.name}</p>
                        </div>

                        <div className={cn("p-3 rounded-xl", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50')}>
                          <p className="text-xs text-gray-500 mb-1">Repartidor</p>
                          <p className="font-medium text-gray-900 dark:text-white">{selectedUser?.name}</p>
                          <p className="text-sm text-gray-500">{selectedUser?.phone}</p>
                        </div>

                        <div className={cn("p-3 rounded-xl", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50')}>
                          <p className="text-xs text-gray-500 mb-1">Monto a entregar</p>
                          <p className="text-xl font-bold text-green-600">{currency} ${totalAmount.toLocaleString()}</p>
                          <p className="text-sm text-gray-500">{totalBills} billetes en total</p>
                        </div>

                        <div className={cn("p-3 rounded-xl", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50')}>
                          <p className="text-xs text-gray-500 mb-1">Nomenclatura</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(billDenominations)
                              .filter(([_, count]) => count > 0)
                              .map(([denom, count]) => (
                                <span
                                  key={denom}
                                  className={cn("px-2 py-1 rounded-full text-xs", theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200')}
                                >
                                  {count}x${denom}
                                </span>
                              ))
                            }
                          </div>
                        </div>

                        <div className={cn("p-3 rounded-xl", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50')}>
                          <p className="text-xs text-gray-500 mb-1">Fecha límite</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {deadlineDate && new Date(deadlineDate + 'T00:00:00').toLocaleDateString('es-ES', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>

                      <div className={cn("p-3 rounded-xl bg-amber-500/10 border border-amber-500/30")}>
                        <p className="text-amber-600 dark:text-amber-400 text-sm flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          Al confirmar, se notificará al repartidor y al broker
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className={cn(
                "p-5 border-t flex gap-3 shrink-0",
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              )}>
                <button
                  onClick={() => wizardStep > 1 ? setWizardStep(wizardStep - 1) : closeWizard()}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2",
                    theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  <ArrowLeft className="w-4 h-4" />
                  {wizardStep === 1 ? 'Cancelar' : 'Anterior'}
                </button>

                {wizardStep < 4 ? (
                  <button
                    onClick={() => setWizardStep(wizardStep + 1)}
                    disabled={!isStepValid()}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    Siguiente
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmitDelivery}
                    disabled={depositLoading}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {depositLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Crear Orden
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </DashboardLayout>
  )
}
