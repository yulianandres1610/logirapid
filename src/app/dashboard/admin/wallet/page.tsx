'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Wallet,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  TrendingUp,
  Building2,
  Clock,
  Check,
  X,
  CreditCard,
  Smartphone,
  Banknote,
  Building,
  DollarSign,
  ArrowRight,
  ArrowDown,
  History,
  ChevronRight,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { VirtualCard } from '@/components/wallet/VirtualCard'

type Tab = 'dashboard' | 'operations' | 'pending'
type OperationTab = 'recharge' | 'transfer' | 'history'
type PaymentMethod = 'card_manual' | 'card_terminal' | 'cash' | 'wire' | 'zelle'

interface DashboardStats {
  totalBalance: { value: number; formatted: string }
  rechargesThisMonth: { value: number; formatted: string; change: number; count: number }
  transfersThisMonth: { value: number; formatted: string; change: number; count: number }
  activeCompanies: { value: number }
  pendingRequests: { value: number }
}

interface WalletResult {
  id: number
  name: string
  walletNumber: string
  balance: number
  balanceFormatted: string
  phone?: string
  email?: string
  status: string
  type: 'company' | 'user'
  dailyLimit?: number
  monthlyLimit?: number
}

interface Transaction {
  id: number
  type: string
  typeLabel: string
  sourceName: string
  targetName: string
  amount: number
  amountFormatted: string
  paymentMethod?: string
  paymentMethodLabel?: string
  status: string
  createdAt: string
}

interface PendingRequest {
  id: number
  walletName: string
  walletNumber: string
  amount: number
  amountFormatted: string
  paymentMethod: string
  paymentMethodLabel: string
  paymentReference?: string
  requestedBy: string
  createdAt: string
  status: string
}

const paymentMethods = [
  { id: 'card_manual', label: 'Tarjeta', icon: CreditCard, color: 'from-blue-500 to-blue-600' },
  { id: 'card_terminal', label: 'Terminal', icon: Smartphone, color: 'from-purple-500 to-purple-600' },
  { id: 'cash', label: 'Efectivo', icon: Banknote, color: 'from-green-500 to-green-600' },
  { id: 'wire', label: 'Wire', icon: Building, color: 'from-orange-500 to-orange-600' },
  { id: 'zelle', label: 'Zelle', icon: DollarSign, color: 'from-indigo-500 to-indigo-600' }
]

const quickAmounts = [50, 100, 250, 500, 1000]

export default function WalletManagementPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') as Tab | null

  const [activeTab, setActiveTab] = useState<Tab>(tabParam || 'dashboard')
  const [operationTab, setOperationTab] = useState<OperationTab>('recharge')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dashboard data
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [topWallets, setTopWallets] = useState<WalletResult[]>([])

  // Search data
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<WalletResult[]>([])
  const [selectedWallet, setSelectedWallet] = useState<WalletResult | null>(null)
  const [searching, setSearching] = useState(false)

  // Recharge form
  const [rechargeAmount, setRechargeAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card_manual')
  const [paymentReference, setPaymentReference] = useState('')
  const [processing, setProcessing] = useState(false)

  // Transfer form
  const [transferSourceWallet, setTransferSourceWallet] = useState<WalletResult | null>(null)
  const [transferTargetWallet, setTransferTargetWallet] = useState<WalletResult | null>(null)
  const [transferAmount, setTransferAmount] = useState('')
  const [transferDescription, setTransferDescription] = useState('')
  const [sourceSearchQuery, setSourceSearchQuery] = useState('')
  const [targetSearchQuery, setTargetSearchQuery] = useState('')

  // History
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Pending requests
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/wallet/dashboard')
      const data = await response.json()
      if (data.success) {
        setStats(data.data.stats)
        setTopWallets(data.data.topWallets)
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Error al cargar el dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  // Search wallets
  const searchWallets = async (query: string) => {
    if (query.length < 3) {
      setSearchResults([])
      return
    }
    try {
      setSearching(true)
      const response = await fetch(`/api/wallet/search?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      if (data.success) {
        setSearchResults(data.data.results)
      }
    } catch (err) {
      console.error('Error searching:', err)
    } finally {
      setSearching(false)
    }
  }

  // Process recharge
  const processRecharge = async () => {
    if (!selectedWallet || !rechargeAmount || parseFloat(rechargeAmount) <= 0) {
      alert('Seleccione un wallet y monto valido')
      return
    }

    try {
      setProcessing(true)
      const response = await fetch('/api/wallet/recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetWalletNumber: selectedWallet.walletNumber,
          targetType: selectedWallet.type,
          amount: parseFloat(rechargeAmount),
          paymentMethod,
          paymentReference: paymentReference || undefined
        })
      })
      const data = await response.json()
      if (data.success) {
        alert(data.message)
        setRechargeAmount('')
        setPaymentReference('')
        setSelectedWallet(null)
        setSearchQuery('')
        fetchDashboard()
      } else {
        alert(data.error)
      }
    } catch (err) {
      alert('Error al procesar la recarga')
    } finally {
      setProcessing(false)
    }
  }

  // Process transfer
  const processTransfer = async () => {
    if (!transferSourceWallet || !transferTargetWallet || !transferAmount) {
      alert('Complete todos los campos')
      return
    }

    try {
      setProcessing(true)
      const response = await fetch('/api/wallet/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceWalletNumber: transferSourceWallet.walletNumber,
          sourceType: transferSourceWallet.type,
          targetWalletNumber: transferTargetWallet.walletNumber,
          targetType: transferTargetWallet.type,
          amount: parseFloat(transferAmount),
          description: transferDescription || undefined
        })
      })
      const data = await response.json()
      if (data.success) {
        alert(data.message)
        setTransferSourceWallet(null)
        setTransferTargetWallet(null)
        setTransferAmount('')
        setTransferDescription('')
        setSourceSearchQuery('')
        setTargetSearchQuery('')
        fetchDashboard()
      } else {
        alert(data.error)
      }
    } catch (err) {
      alert('Error al procesar la transferencia')
    } finally {
      setProcessing(false)
    }
  }

  // Fetch transactions
  const fetchTransactions = async () => {
    try {
      setHistoryLoading(true)
      const response = await fetch('/api/wallet/transactions?limit=50')
      const data = await response.json()
      if (data.success) {
        setTransactions(data.data.transactions)
      }
    } catch (err) {
      console.error('Error fetching transactions:', err)
    } finally {
      setHistoryLoading(false)
    }
  }

  // Fetch pending requests
  const fetchPendingRequests = async () => {
    try {
      setPendingLoading(true)
      const response = await fetch('/api/wallet/recharge-requests?status=pending')
      const data = await response.json()
      if (data.success) {
        setPendingRequests(data.data.requests)
      }
    } catch (err) {
      console.error('Error fetching pending requests:', err)
    } finally {
      setPendingLoading(false)
    }
  }

  // Approve/reject request
  const processRequest = async (id: number, action: 'approve' | 'reject', reason?: string) => {
    try {
      const response = await fetch(`/api/wallet/recharge-requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rejectionReason: reason })
      })
      const data = await response.json()
      if (data.success) {
        alert(data.message)
        fetchPendingRequests()
        fetchDashboard()
      } else {
        alert(data.error)
      }
    } catch (err) {
      alert('Error al procesar la solicitud')
    }
  }

  useEffect(() => {
    fetchDashboard()
    fetchPendingRequests()
  }, [fetchDashboard])

  useEffect(() => {
    if (operationTab === 'history') {
      fetchTransactions()
    }
  }, [operationTab])

  // Update URL when tab changes
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    router.push(`/dashboard/admin/wallet?tab=${tab}`, { scroll: false })
  }

  const tabs = [
    { id: 'dashboard' as Tab, label: 'Dashboard', icon: TrendingUp },
    { id: 'operations' as Tab, label: 'Operaciones', icon: RefreshCw },
    { id: 'pending' as Tab, label: 'Solicitudes', icon: Clock, badge: stats?.pendingRequests?.value || 0 }
  ]

  const operationTabs = [
    { id: 'recharge' as OperationTab, label: 'Recargar', icon: ArrowDownRight },
    { id: 'transfer' as OperationTab, label: 'Transferir', icon: ArrowUpRight },
    { id: 'history' as OperationTab, label: 'Historial', icon: History }
  ]

  return (
    <DashboardLayout>
      <div className={cn(
        "min-h-screen pt-8 sm:pt-12 pb-20 px-4 sm:px-6 lg:px-8",
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-3 mb-2">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center",
                    "bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30"
                  )}
                >
                  <Wallet className="w-6 h-6 text-white" />
                </motion.div>
                <h1 className={cn(
                  "text-3xl sm:text-4xl font-bold",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Wallet Manager
                </h1>
              </div>
              <p className={cn(
                "text-sm sm:text-base ml-15",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Control total de wallets del sistema
              </p>
            </div>
          </motion.div>

          {/* Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(
              "flex gap-2 p-1.5 rounded-2xl",
              theme === 'dark' ? 'bg-gray-800/50' : 'bg-white shadow-lg'
            )}
          >
            {tabs.map((tab, index) => (
              <motion.button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-300 relative",
                  activeTab === tab.id
                    ? theme === 'dark'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-400/30'
                    : theme === 'dark'
                      ? 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                )}
              >
                <tab.icon className="w-5 h-5" />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.badge && tab.badge > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 sm:static sm:ml-1 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full min-w-[20px]"
                  >
                    {tab.badge}
                  </motion.span>
                )}
              </motion.button>
            ))}
          </motion.div>

          {/* Content */}
          <AnimatePresence mode="wait">
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {loading ? (
                    [...Array(4)].map((_, i) => (
                      <div key={i} className={cn(
                        "rounded-2xl p-6 animate-pulse",
                        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                      )}>
                        <div className={cn("h-4 rounded w-1/2 mb-3", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')} />
                        <div className={cn("h-8 rounded w-2/3", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')} />
                      </div>
                    ))
                  ) : stats && (
                    <>
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 text-white shadow-xl"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-8 -translate-y-8" />
                        <div className="relative z-10">
                          <div className="flex items-center gap-2 mb-2">
                            <Wallet className="w-5 h-5 opacity-80" />
                            <p className="text-sm opacity-80">Balance Total</p>
                          </div>
                          <p className="text-3xl font-bold">{stats.totalBalance.formatted}</p>
                        </div>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className={cn(
                          "rounded-2xl p-6 shadow-lg border",
                          theme === 'dark' ? 'bg-gray-800/95 border-gray-700/50' : 'bg-white border-gray-100'
                        )}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <ArrowDownRight className={cn("w-5 h-5", theme === 'dark' ? 'text-green-400' : 'text-green-500')} />
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Recargas del Mes</p>
                        </div>
                        <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{stats.rechargesThisMonth.formatted}</p>
                        <p className={cn(
                          "text-xs mt-1 flex items-center gap-1",
                          stats.rechargesThisMonth.change >= 0 ? 'text-green-500' : 'text-red-500'
                        )}>
                          {stats.rechargesThisMonth.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                          {Math.abs(stats.rechargesThisMonth.change)}% vs mes anterior
                        </p>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className={cn(
                          "rounded-2xl p-6 shadow-lg border",
                          theme === 'dark' ? 'bg-gray-800/95 border-gray-700/50' : 'bg-white border-gray-100'
                        )}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <ArrowUpRight className={cn("w-5 h-5", theme === 'dark' ? 'text-blue-400' : 'text-blue-500')} />
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Transferencias del Mes</p>
                        </div>
                        <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{stats.transfersThisMonth.formatted}</p>
                        <p className={cn(
                          "text-xs mt-1 flex items-center gap-1",
                          stats.transfersThisMonth.change >= 0 ? 'text-green-500' : 'text-red-500'
                        )}>
                          {stats.transfersThisMonth.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                          {Math.abs(stats.transfersThisMonth.change)}% vs mes anterior
                        </p>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className={cn(
                          "rounded-2xl p-6 shadow-lg border",
                          theme === 'dark' ? 'bg-gray-800/95 border-gray-700/50' : 'bg-white border-gray-100'
                        )}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className={cn("w-5 h-5", theme === 'dark' ? 'text-purple-400' : 'text-purple-500')} />
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Empresas Activas</p>
                        </div>
                        <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{stats.activeCompanies.value}</p>
                        <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>con wallet activo</p>
                      </motion.div>
                    </>
                  )}
                </div>

                {/* Search and Virtual Card */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className={cn(
                      "rounded-2xl p-6 shadow-lg border",
                      theme === 'dark' ? 'bg-gray-800/95 border-gray-700/50' : 'bg-white border-gray-100'
                    )}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100'
                      )}>
                        <Search className={cn("w-5 h-5", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
                      </div>
                      <h3 className={cn("text-lg font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        Buscar Wallet
                      </h3>
                    </div>
                    <div className="relative">
                      <Search className={cn(
                        "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5",
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                      )} />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value)
                          searchWallets(e.target.value)
                        }}
                        placeholder="Numero de wallet, telefono o nombre..."
                        className={cn(
                          "w-full pl-12 pr-4 py-4 rounded-xl border-2 transition-all duration-200",
                          "focus:outline-none focus:ring-0",
                          theme === 'dark'
                            ? 'bg-gray-700/50 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500'
                            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                        )}
                      />
                    </div>
                    {searching && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Buscando...
                      </div>
                    )}
                    {searchResults.length > 0 && !selectedWallet && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 space-y-2 max-h-48 overflow-y-auto"
                      >
                        {searchResults.map(wallet => (
                          <motion.button
                            key={`${wallet.type}-${wallet.id}`}
                            onClick={() => setSelectedWallet(wallet)}
                            whileHover={{ scale: 1.01, x: 4 }}
                            whileTap={{ scale: 0.99 }}
                            className={cn(
                              "w-full p-4 text-left rounded-xl border transition-all duration-200 flex items-center justify-between group",
                              theme === 'dark'
                                ? 'bg-gray-700/50 border-gray-600 hover:border-blue-500 hover:bg-gray-700'
                                : 'bg-gray-50 border-gray-200 hover:border-blue-500 hover:bg-blue-50'
                            )}
                          >
                            <div>
                              <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{wallet.name}</p>
                              <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                {wallet.walletNumber} - {wallet.balanceFormatted}
                              </p>
                            </div>
                            <ChevronRight className={cn(
                              "w-5 h-5 transition-transform group-hover:translate-x-1",
                              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                            )} />
                          </motion.button>
                        ))}
                      </motion.div>
                    )}
                  </motion.div>

                  {selectedWallet ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    >
                      <VirtualCard
                        walletNumber={selectedWallet.walletNumber}
                        name={selectedWallet.name}
                        balance={selectedWallet.balance}
                        balanceFormatted={selectedWallet.balanceFormatted}
                        phone={selectedWallet.phone}
                        email={selectedWallet.email}
                        status={selectedWallet.status}
                        type={selectedWallet.type}
                        dailyLimit={selectedWallet.dailyLimit || 5000}
                        monthlyLimit={selectedWallet.monthlyLimit || 50000}
                        onRecharge={() => {
                          handleTabChange('operations')
                          setOperationTab('recharge')
                        }}
                        onTransfer={() => {
                          handleTabChange('operations')
                          setOperationTab('transfer')
                          setTransferSourceWallet(selectedWallet)
                          setSourceSearchQuery(selectedWallet.name)
                        }}
                        onHistory={() => {
                          handleTabChange('operations')
                          setOperationTab('history')
                        }}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className={cn(
                        "rounded-2xl p-8 shadow-lg border flex flex-col items-center justify-center min-h-[280px]",
                        theme === 'dark' ? 'bg-gray-800/50 border-gray-700/50' : 'bg-gray-50 border-gray-200'
                      )}
                    >
                      <div className={cn(
                        "w-16 h-16 rounded-2xl flex items-center justify-center mb-4",
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                      )}>
                        <CreditCard className={cn("w-8 h-8", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                      </div>
                      <p className={cn("text-center", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        Busca un wallet para ver su tarjeta virtual
                      </p>
                    </motion.div>
                  )}
                </div>

                {/* Top Wallets */}
                {topWallets.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className={cn(
                      "rounded-2xl p-6 shadow-lg border",
                      theme === 'dark' ? 'bg-gray-800/95 border-gray-700/50' : 'bg-white border-gray-100'
                    )}
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        "bg-gradient-to-br from-yellow-400 to-orange-500"
                      )}>
                        <TrendingUp className="w-5 h-5 text-white" />
                      </div>
                      <h3 className={cn("text-lg font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        Top 10 Wallets por Balance
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className={cn("text-left text-xs uppercase tracking-wider", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                            <th className="pb-4 pl-4">#</th>
                            <th className="pb-4">Empresa</th>
                            <th className="pb-4">Wallet</th>
                            <th className="pb-4 text-right">Balance</th>
                            <th className="pb-4 text-center pr-4">Estado</th>
                          </tr>
                        </thead>
                        <tbody className={cn("divide-y", theme === 'dark' ? 'divide-gray-700/50' : 'divide-gray-100')}>
                          {topWallets.map((wallet, index) => (
                            <motion.tr
                              key={wallet.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.1 * index }}
                              className={cn(
                                "transition-colors cursor-pointer",
                                theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                              )}
                              onClick={() => setSelectedWallet(wallet as any)}
                            >
                              <td className="py-4 pl-4">
                                <span className={cn(
                                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                                  index < 3
                                    ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white'
                                    : theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                                )}>
                                  {index + 1}
                                </span>
                              </td>
                              <td className="py-4">
                                <span className={cn(
                                  "font-medium hover:underline",
                                  theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                                )}>
                                  {wallet.name}
                                </span>
                              </td>
                              <td className={cn("py-4 font-mono text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                {wallet.walletNumber}
                              </td>
                              <td className={cn("py-4 text-right font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                {wallet.balanceFormatted}
                              </td>
                              <td className="py-4 text-center pr-4">
                                <span className={cn(
                                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                                  wallet.status === 'active'
                                    ? theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                                    : theme === 'dark' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                                )}>
                                  <span className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    wallet.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
                                  )} />
                                  {wallet.status === 'active' ? 'Activo' : 'Limite'}
                                </span>
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Operations Tab */}
            {activeTab === 'operations' && (
              <motion.div
                key="operations"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Operation sub-tabs */}
                <div className={cn(
                  "flex gap-2 p-1.5 rounded-xl w-fit",
                  theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100'
                )}>
                  {operationTabs.map(tab => (
                    <motion.button
                      key={tab.id}
                      onClick={() => setOperationTab(tab.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200",
                        operationTab === tab.id
                          ? theme === 'dark'
                            ? 'bg-gray-700 text-white shadow-lg'
                            : 'bg-white text-gray-900 shadow-md'
                          : theme === 'dark'
                            ? 'text-gray-400 hover:text-white'
                            : 'text-gray-500 hover:text-gray-900'
                      )}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </motion.button>
                  ))}
                </div>

                {/* Recharge Form */}
                <AnimatePresence mode="wait">
                  {operationTab === 'recharge' && (
                    <motion.div
                      key="recharge"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className={cn(
                        "rounded-2xl p-6 sm:p-8 shadow-lg border max-w-2xl",
                        theme === 'dark' ? 'bg-gray-800/95 border-gray-700/50' : 'bg-white border-gray-100'
                      )}
                    >
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
                          <ArrowDownRight className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className={cn("text-xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            Recargar Wallet
                          </h3>
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                            Agrega fondos a un wallet
                          </p>
                        </div>
                      </div>

                      {/* Wallet Search */}
                      <div className="space-y-2 mb-6">
                        <label className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          Wallet destino
                        </label>
                        <div className="relative">
                          <Search className={cn(
                            "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5",
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          )} />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                              setSearchQuery(e.target.value)
                              setSelectedWallet(null)
                              searchWallets(e.target.value)
                            }}
                            placeholder="Buscar por numero, telefono o nombre..."
                            className={cn(
                              "w-full pl-12 pr-4 py-3 rounded-xl border-2 transition-all",
                              theme === 'dark'
                                ? 'bg-gray-700/50 border-gray-600 text-white focus:border-blue-500'
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500'
                            )}
                          />
                        </div>
                        {searchResults.length > 0 && !selectedWallet && (
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {searchResults.map(w => (
                              <button
                                key={`${w.type}-${w.id}`}
                                onClick={() => {
                                  setSelectedWallet(w)
                                  setSearchQuery(w.name)
                                  setSearchResults([])
                                }}
                                className={cn(
                                  "w-full p-3 text-left rounded-lg transition-colors text-sm",
                                  theme === 'dark'
                                    ? 'bg-gray-700/50 hover:bg-gray-700 text-white'
                                    : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                                )}
                              >
                                {w.name} - {w.balanceFormatted}
                              </button>
                            ))}
                          </div>
                        )}
                        {selectedWallet && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={cn(
                              "p-4 rounded-xl border-2 flex justify-between items-center",
                              theme === 'dark'
                                ? 'bg-green-500/10 border-green-500/30'
                                : 'bg-green-50 border-green-200'
                            )}
                          >
                            <div>
                              <p className={cn("font-medium", theme === 'dark' ? 'text-green-400' : 'text-green-700')}>
                                {selectedWallet.name}
                              </p>
                              <p className={cn("text-sm", theme === 'dark' ? 'text-green-500/70' : 'text-green-600')}>
                                Balance actual: {selectedWallet.balanceFormatted}
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedWallet(null)
                                setSearchQuery('')
                              }}
                              className={cn(
                                "p-1 rounded-lg transition-colors",
                                theme === 'dark' ? 'hover:bg-green-500/20' : 'hover:bg-green-100'
                              )}
                            >
                              <X className={cn("w-5 h-5", theme === 'dark' ? 'text-green-400' : 'text-green-600')} />
                            </button>
                          </motion.div>
                        )}
                      </div>

                      {/* Amount */}
                      <div className="space-y-2 mb-6">
                        <label className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          Monto
                        </label>
                        <div className="relative">
                          <span className={cn(
                            "absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium",
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          )}>$</span>
                          <input
                            type="number"
                            value={rechargeAmount}
                            onChange={(e) => setRechargeAmount(e.target.value)}
                            placeholder="0.00"
                            className={cn(
                              "w-full pl-10 pr-4 py-3 rounded-xl border-2 text-2xl font-bold transition-all",
                              theme === 'dark'
                                ? 'bg-gray-700/50 border-gray-600 text-white focus:border-blue-500'
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500'
                            )}
                          />
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {quickAmounts.map(amt => (
                            <motion.button
                              key={amt}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setRechargeAmount(amt.toString())}
                              className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-all border",
                                rechargeAmount === amt.toString()
                                  ? 'bg-blue-500 text-white border-blue-500'
                                  : theme === 'dark'
                                    ? 'bg-gray-700 text-gray-300 border-gray-600 hover:border-blue-500'
                                    : 'bg-gray-100 text-gray-700 border-gray-200 hover:border-blue-500'
                              )}
                            >
                              ${amt}
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      {/* Payment Method */}
                      <div className="space-y-3 mb-6">
                        <label className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          Metodo de pago
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                          {paymentMethods.map(method => (
                            <motion.button
                              key={method.id}
                              whileHover={{ scale: 1.02, y: -2 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                              className={cn(
                                "p-3 rounded-xl border-2 text-center transition-all",
                                paymentMethod === method.id
                                  ? `bg-gradient-to-br ${method.color} border-transparent text-white shadow-lg`
                                  : theme === 'dark'
                                    ? 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
                                    : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                              )}
                            >
                              <method.icon className={cn(
                                "w-6 h-6 mx-auto mb-1",
                                paymentMethod === method.id ? 'text-white' : theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                              )} />
                              <p className={cn(
                                "text-xs font-medium",
                                paymentMethod === method.id ? 'text-white' : theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                              )}>
                                {method.label}
                              </p>
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      {/* Reference */}
                      <div className="space-y-2 mb-6">
                        <label className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          Referencia <span className="text-gray-500">(opcional)</span>
                        </label>
                        <input
                          type="text"
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          placeholder="Numero de confirmacion o referencia..."
                          className={cn(
                            "w-full px-4 py-3 rounded-xl border-2 transition-all",
                            theme === 'dark'
                              ? 'bg-gray-700/50 border-gray-600 text-white focus:border-blue-500'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500'
                          )}
                        />
                      </div>

                      {/* Warning for approval methods */}
                      {['cash', 'wire', 'zelle'].includes(paymentMethod) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className={cn(
                            "p-4 rounded-xl mb-6 flex items-start gap-3",
                            theme === 'dark' ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-200'
                          )}
                        >
                          <AlertCircle className={cn("w-5 h-5 flex-shrink-0 mt-0.5", theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600')} />
                          <p className={cn("text-sm", theme === 'dark' ? 'text-yellow-300' : 'text-yellow-700')}>
                            Los pagos por {paymentMethod === 'cash' ? 'Efectivo' : paymentMethod === 'wire' ? 'Wire Transfer' : 'Zelle'} se procesan inmediatamente por SUPER_ADMIN.
                          </p>
                        </motion.div>
                      )}

                      {/* Submit */}
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={processRecharge}
                        disabled={!selectedWallet || !rechargeAmount || processing}
                        className={cn(
                          "w-full py-4 rounded-xl font-semibold text-white transition-all",
                          "bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-500/30",
                          "hover:from-green-600 hover:to-emerald-700",
                          "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        )}
                      >
                        {processing ? (
                          <span className="flex items-center justify-center gap-2">
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            Procesando...
                          </span>
                        ) : (
                          `Procesar Recarga $${rechargeAmount || '0.00'}`
                        )}
                      </motion.button>
                    </motion.div>
                  )}

                  {/* Transfer Form */}
                  {operationTab === 'transfer' && (
                    <motion.div
                      key="transfer"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className={cn(
                        "rounded-2xl p-6 sm:p-8 shadow-lg border max-w-2xl",
                        theme === 'dark' ? 'bg-gray-800/95 border-gray-700/50' : 'bg-white border-gray-100'
                      )}
                    >
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                          <ArrowUpRight className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className={cn("text-xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            Transferencia entre Wallets
                          </h3>
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                            Mueve fondos entre wallets del sistema
                          </p>
                        </div>
                      </div>

                      {/* Source Wallet */}
                      <div className="space-y-2 mb-4">
                        <label className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          Wallet origen
                        </label>
                        <input
                          type="text"
                          value={sourceSearchQuery}
                          onChange={(e) => {
                            setSourceSearchQuery(e.target.value)
                            setTransferSourceWallet(null)
                            searchWallets(e.target.value)
                          }}
                          placeholder="Buscar wallet origen..."
                          className={cn(
                            "w-full px-4 py-3 rounded-xl border-2 transition-all",
                            theme === 'dark'
                              ? 'bg-gray-700/50 border-gray-600 text-white focus:border-blue-500'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500'
                          )}
                        />
                        {searchResults.length > 0 && !transferSourceWallet && sourceSearchQuery && (
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {searchResults.map(w => (
                              <button
                                key={`src-${w.type}-${w.id}`}
                                onClick={() => {
                                  setTransferSourceWallet(w)
                                  setSourceSearchQuery(w.name)
                                  setSearchResults([])
                                }}
                                className={cn(
                                  "w-full p-3 text-left rounded-lg text-sm",
                                  theme === 'dark' ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'
                                )}
                              >
                                {w.name} - {w.balanceFormatted}
                              </button>
                            ))}
                          </div>
                        )}
                        {transferSourceWallet && (
                          <p className={cn("text-sm flex items-center gap-1", theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
                            <Check className="w-4 h-4" /> Balance: {transferSourceWallet.balanceFormatted}
                          </p>
                        )}
                      </div>

                      {/* Arrow */}
                      <div className="flex justify-center my-4">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                        )}>
                          <ArrowDown className={cn("w-5 h-5", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="space-y-2 mb-4">
                        <label className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          Monto a transferir
                        </label>
                        <div className="relative">
                          <span className={cn("absolute left-4 top-1/2 -translate-y-1/2 text-lg", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>$</span>
                          <input
                            type="number"
                            value={transferAmount}
                            onChange={(e) => setTransferAmount(e.target.value)}
                            placeholder="0.00"
                            className={cn(
                              "w-full pl-10 pr-4 py-3 rounded-xl border-2 text-xl font-bold",
                              theme === 'dark'
                                ? 'bg-gray-700/50 border-gray-600 text-white focus:border-blue-500'
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500'
                            )}
                          />
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="flex justify-center my-4">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                        )}>
                          <ArrowDown className={cn("w-5 h-5", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                        </div>
                      </div>

                      {/* Target Wallet */}
                      <div className="space-y-2 mb-6">
                        <label className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          Wallet destino
                        </label>
                        <input
                          type="text"
                          value={targetSearchQuery}
                          onChange={(e) => {
                            setTargetSearchQuery(e.target.value)
                            setTransferTargetWallet(null)
                            searchWallets(e.target.value)
                          }}
                          placeholder="Buscar wallet destino..."
                          className={cn(
                            "w-full px-4 py-3 rounded-xl border-2 transition-all",
                            theme === 'dark'
                              ? 'bg-gray-700/50 border-gray-600 text-white focus:border-blue-500'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500'
                          )}
                        />
                        {searchResults.length > 0 && !transferTargetWallet && targetSearchQuery && (
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {searchResults.map(w => (
                              <button
                                key={`tgt-${w.type}-${w.id}`}
                                onClick={() => {
                                  setTransferTargetWallet(w)
                                  setTargetSearchQuery(w.name)
                                  setSearchResults([])
                                }}
                                className={cn(
                                  "w-full p-3 text-left rounded-lg text-sm",
                                  theme === 'dark' ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'
                                )}
                              >
                                {w.name} - {w.balanceFormatted}
                              </button>
                            ))}
                          </div>
                        )}
                        {transferTargetWallet && (
                          <p className={cn("text-sm flex items-center gap-1", theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
                            <Check className="w-4 h-4" /> Balance actual: {transferTargetWallet.balanceFormatted}
                          </p>
                        )}
                      </div>

                      {/* Description */}
                      <div className="space-y-2 mb-6">
                        <label className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          Descripcion <span className="text-gray-500">(opcional)</span>
                        </label>
                        <input
                          type="text"
                          value={transferDescription}
                          onChange={(e) => setTransferDescription(e.target.value)}
                          placeholder="Motivo de la transferencia..."
                          className={cn(
                            "w-full px-4 py-3 rounded-xl border-2",
                            theme === 'dark'
                              ? 'bg-gray-700/50 border-gray-600 text-white focus:border-blue-500'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500'
                          )}
                        />
                      </div>

                      {/* Submit */}
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={processTransfer}
                        disabled={!transferSourceWallet || !transferTargetWallet || !transferAmount || processing}
                        className={cn(
                          "w-full py-4 rounded-xl font-semibold text-white transition-all",
                          "bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30",
                          "hover:from-blue-600 hover:to-indigo-700",
                          "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        )}
                      >
                        {processing ? (
                          <span className="flex items-center justify-center gap-2">
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            Procesando...
                          </span>
                        ) : (
                          `Ejecutar Transferencia $${transferAmount || '0.00'}`
                        )}
                      </motion.button>
                    </motion.div>
                  )}

                  {/* History */}
                  {operationTab === 'history' && (
                    <motion.div
                      key="history"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className={cn(
                        "rounded-2xl p-6 shadow-lg border",
                        theme === 'dark' ? 'bg-gray-800/95 border-gray-700/50' : 'bg-white border-gray-100'
                      )}
                    >
                      <div className="flex items-center gap-3 mb-6">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-100'
                        )}>
                          <History className={cn("w-5 h-5", theme === 'dark' ? 'text-purple-400' : 'text-purple-600')} />
                        </div>
                        <h3 className={cn("text-lg font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          Historial de Transacciones
                        </h3>
                      </div>

                      {historyLoading ? (
                        <div className="text-center py-12">
                          <RefreshCw className={cn("w-8 h-8 animate-spin mx-auto mb-3", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                          <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Cargando...</p>
                        </div>
                      ) : transactions.length === 0 ? (
                        <div className="text-center py-12">
                          <History className={cn("w-12 h-12 mx-auto mb-3", theme === 'dark' ? 'text-gray-600' : 'text-gray-300')} />
                          <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No hay transacciones</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className={cn("text-left text-xs uppercase tracking-wider", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                                <th className="pb-4">ID</th>
                                <th className="pb-4">Fecha</th>
                                <th className="pb-4">Tipo</th>
                                <th className="pb-4">Detalle</th>
                                <th className="pb-4 text-right">Monto</th>
                                <th className="pb-4 text-center">Estado</th>
                              </tr>
                            </thead>
                            <tbody className={cn("divide-y", theme === 'dark' ? 'divide-gray-700/50' : 'divide-gray-100')}>
                              {transactions.map((tx, index) => (
                                <motion.tr
                                  key={tx.id}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: 0.03 * index }}
                                  className={cn(theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50')}
                                >
                                  <td className={cn("py-3 text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>#{tx.id}</td>
                                  <td className={cn("py-3 text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                    {new Date(tx.createdAt).toLocaleDateString('es-ES')}
                                  </td>
                                  <td className="py-3">
                                    <span className={cn(
                                      "px-2 py-1 rounded-lg text-xs font-medium",
                                      tx.type === 'recharge'
                                        ? theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                                        : tx.type.includes('transfer')
                                          ? theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                                          : theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600'
                                    )}>
                                      {tx.typeLabel}
                                    </span>
                                  </td>
                                  <td className="py-3 text-sm">
                                    <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>{tx.sourceName}</span>
                                    <ArrowRight className={cn("inline w-3 h-3 mx-2", theme === 'dark' ? 'text-gray-600' : 'text-gray-300')} />
                                    <span className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>{tx.targetName}</span>
                                  </td>
                                  <td className="py-3 text-right font-semibold">
                                    <span className={tx.type === 'transfer_out' ? 'text-red-500' : 'text-green-500'}>
                                      {tx.type === 'transfer_out' ? '-' : '+'}{tx.amountFormatted}
                                    </span>
                                  </td>
                                  <td className="py-3 text-center">
                                    <span className={cn(
                                      "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs",
                                      tx.status === 'completed'
                                        ? theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                                        : tx.status === 'pending'
                                          ? theme === 'dark' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                                          : theme === 'dark' ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'
                                    )}>
                                      {tx.status === 'completed' ? <Check className="w-3 h-3" /> : tx.status === 'pending' ? <Clock className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                      {tx.status}
                                    </span>
                                  </td>
                                </motion.tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Pending Tab */}
            {activeTab === 'pending' && (
              <motion.div
                key="pending"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      theme === 'dark' ? 'bg-orange-500/20' : 'bg-orange-100'
                    )}>
                      <Clock className={cn("w-5 h-5", theme === 'dark' ? 'text-orange-400' : 'text-orange-600')} />
                    </div>
                    <h3 className={cn("text-lg font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      Solicitudes Pendientes
                    </h3>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={fetchPendingRequests}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl transition-colors",
                      theme === 'dark'
                        ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    )}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Actualizar
                  </motion.button>
                </div>

                {pendingLoading ? (
                  <div className="text-center py-12">
                    <RefreshCw className={cn("w-8 h-8 animate-spin mx-auto mb-3", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                  </div>
                ) : pendingRequests.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={cn(
                      "rounded-2xl p-12 text-center border",
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700/50' : 'bg-white border-gray-100'
                    )}
                  >
                    <div className={cn(
                      "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4",
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    )}>
                      <Check className={cn("w-8 h-8", theme === 'dark' ? 'text-green-400' : 'text-green-500')} />
                    </div>
                    <p className={cn("text-lg font-medium mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      No hay solicitudes pendientes
                    </p>
                    <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      Todas las solicitudes han sido procesadas
                    </p>
                  </motion.div>
                ) : (
                  <div className="grid gap-4">
                    {pendingRequests.map((request, index) => (
                      <motion.div
                        key={request.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * index }}
                        className={cn(
                          "rounded-2xl p-6 shadow-lg border",
                          theme === 'dark' ? 'bg-gray-800/95 border-gray-700/50' : 'bg-white border-gray-100'
                        )}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center",
                              request.paymentMethod === 'cash'
                                ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                                : request.paymentMethod === 'wire'
                                  ? 'bg-gradient-to-br from-orange-500 to-amber-600'
                                  : 'bg-gradient-to-br from-indigo-500 to-purple-600'
                            )}>
                              {request.paymentMethod === 'cash' ? <Banknote className="w-6 h-6 text-white" /> :
                                request.paymentMethod === 'wire' ? <Building className="w-6 h-6 text-white" /> :
                                  <DollarSign className="w-6 h-6 text-white" />}
                            </div>
                            <div>
                              <p className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                {request.paymentMethodLabel}
                              </p>
                              <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                Hace {Math.round((Date.now() - new Date(request.createdAt).getTime()) / (1000 * 60 * 60))} horas
                              </p>
                            </div>
                          </div>
                          <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {request.amountFormatted}
                          </p>
                        </div>

                        <div className={cn(
                          "grid grid-cols-2 gap-4 p-4 rounded-xl mb-4",
                          theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                        )}>
                          <div>
                            <p className={cn("text-xs uppercase tracking-wider mb-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Empresa</p>
                            <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{request.walletName}</p>
                          </div>
                          <div>
                            <p className={cn("text-xs uppercase tracking-wider mb-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Wallet</p>
                            <p className={cn("font-mono text-sm", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>{request.walletNumber}</p>
                          </div>
                          <div>
                            <p className={cn("text-xs uppercase tracking-wider mb-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Solicitado por</p>
                            <p className={cn("text-sm", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{request.requestedBy}</p>
                          </div>
                          {request.paymentReference && (
                            <div>
                              <p className={cn("text-xs uppercase tracking-wider mb-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Referencia</p>
                              <p className={cn("text-sm", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{request.paymentReference}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-3">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => processRequest(request.id, 'approve')}
                            className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium shadow-lg shadow-green-500/30 hover:from-green-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2"
                          >
                            <Check className="w-5 h-5" />
                            Aprobar
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              const reason = prompt('Motivo del rechazo:')
                              if (reason) processRequest(request.id, 'reject', reason)
                            }}
                            className="flex-1 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-medium shadow-lg shadow-red-500/30 hover:from-red-600 hover:to-rose-700 transition-all flex items-center justify-center gap-2"
                          >
                            <X className="w-5 h-5" />
                            Rechazar
                          </motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </DashboardLayout>
  )
}
