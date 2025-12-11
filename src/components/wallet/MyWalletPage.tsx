'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  AlertCircle,
  Loader2,
  History,
  Download,
  Send,
  Building,
  Search,
  User,
  Users,
  Check
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { cn } from '@/lib/utils'
import { AnimatedNumber } from '@/components/ui/animated-counter'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { VirtualCard } from '@/components/wallet/VirtualCard'
import StripeConnectStatus from '@/components/wallet/StripeConnectStatus'
import PasswordConfirmDialog from '@/components/ui/PasswordConfirmDialog'

interface WalletEntity {
  id: number
  name: string
  walletNumber: string
  balance: number
  balanceFormatted: string
  phone?: string
  email?: string
  status?: string
  role?: string
  type: 'company' | 'user' | 'customer'
}

type Tab = 'dashboard' | 'transfer' | 'history' | 'cashout'

interface WalletData {
  id: number
  name: string
  firstName: string
  lastName: string
  email: string
  phone: string
  role: string
  walletNumber: string
  balance: number
  balanceFormatted: string
  stripeAccountId: string | null
  stripeStatus: string
  stripePayoutsEnabled: boolean
  canCashout: boolean
  company: {
    id: number
    name: string
    walletNumber: string
  } | null
}

interface Transaction {
  id: number
  transactionNumber: number
  type: string
  typeLabel: string
  isIncoming: boolean
  sourceName: string
  sourceWalletNumber: string | null
  targetName: string
  targetWalletNumber: string | null
  amount: number
  amountFormatted: string
  fee: number | null
  netAmount: number | null
  paymentMethod: string
  paymentMethodLabel: string
  status: string
  createdAt: string
  completedAt: string | null
}

interface Stats {
  totalRecharges: number
  rechargesAmount: number
  transfersSent: number
  transfersSentAmount: number
  transfersReceived: number
  transfersReceivedAmount: number
  totalCashouts: number
  cashoutsAmount: number
}

interface MyWalletPageProps {
  role: string
}

export default function MyWalletPage({ role }: MyWalletPageProps) {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const router = useRouter()

  // Brand colors (matching company wallet)
  const brandText = theme === 'dark' ? 'text-blue-500' : 'text-red-500'

  // Password verification state
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(true)

  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Wallet data
  const [walletData, setWalletData] = useState<WalletData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [stats, setStats] = useState<Stats | null>(null)

  // Transfer state
  const [transferAmount, setTransferAmount] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [transferDescription, setTransferDescription] = useState('')
  const [targetSearchQuery, setTargetSearchQuery] = useState('')
  const [targetSearchResults, setTargetSearchResults] = useState<WalletEntity[]>([])
  const [searchingTarget, setSearchingTarget] = useState(false)
  const [selectedTargetWallet, setSelectedTargetWallet] = useState<WalletEntity | null>(null)

  // Fetch wallet data
  const fetchWalletData = useCallback(async () => {
    if (!isAuthenticated) return

    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/wallet/my-wallet')
      const data = await res.json()

      if (data.success) {
        setWalletData(data.data.wallet)
        setTransactions(data.data.transactions)
        setStats(data.data.stats)
      } else {
        setError(data.error || 'Error al cargar billetera')
      }
    } catch (err) {
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) {
      fetchWalletData()
    }
  }, [isAuthenticated, fetchWalletData])

  // Handle password verification success
  const handlePasswordSuccess = () => {
    setShowPasswordDialog(false)
    setIsAuthenticated(true)
  }

  // Chart colors
  const CHART_COLORS = ['#10B981', '#3B82F6', '#EF4444', '#8B5CF6']

  // Chart data based on stats
  const chartData = useMemo(() => {
    if (!stats) return []
    return [
      { name: 'Recargas', value: stats.rechargesAmount, color: CHART_COLORS[0] },
      { name: 'Recibido', value: stats.transfersReceivedAmount, color: CHART_COLORS[1] },
      { name: 'Enviado', value: stats.transfersSentAmount, color: CHART_COLORS[2] },
      { name: 'Retiros', value: stats.cashoutsAmount, color: CHART_COLORS[3] },
    ].filter(item => item.value > 0)
  }, [stats])

  // Search wallets function
  const searchWallets = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setTargetSearchResults([])
      return
    }

    setSearchingTarget(true)
    try {
      const res = await fetch(`/api/wallet/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()

      if (data.success) {
        // Filter out the current user's wallet from results
        const filtered = data.data.filter(
          (w: WalletEntity) => !(w.type === 'user' && w.id === walletData?.id)
        )
        setTargetSearchResults(filtered)
      } else {
        setTargetSearchResults([])
      }
    } catch (err) {
      setTargetSearchResults([])
    } finally {
      setSearchingTarget(false)
    }
  }, [walletData?.id])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (targetSearchQuery) {
        searchWallets(targetSearchQuery)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [targetSearchQuery, searchWallets])

  // Handle transfer to any wallet
  const handleTransfer = async () => {
    if (!selectedTargetWallet) {
      showNotification('error', 'Error', 'Selecciona un destino')
      return
    }

    const amount = parseFloat(transferAmount)
    if (!amount || amount <= 0) {
      showNotification('error', 'Error', 'Ingresa un monto valido')
      return
    }

    if (walletData && amount > walletData.balance) {
      showNotification('error', 'Error', 'Saldo insuficiente')
      return
    }

    setTransferring(true)
    try {
      const res = await fetch('/api/wallet/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: 'user',
          sourceId: walletData?.id,
          targetType: selectedTargetWallet.type,
          targetWalletNumber: selectedTargetWallet.walletNumber,
          amount,
          description: transferDescription || undefined
        })
      })

      const data = await res.json()

      if (data.success) {
        showNotification('success', 'Exito', 'Transferencia exitosa')
        setTransferAmount('')
        setTransferDescription('')
        setSelectedTargetWallet(null)
        setTargetSearchQuery('')
        setTargetSearchResults([])
        fetchWalletData()
      } else {
        showNotification('error', 'Error', data.error || 'Error al transferir')
      }
    } catch (err) {
      showNotification('error', 'Error', 'Error de conexion')
    } finally {
      setTransferring(false)
    }
  }

  // Handle transfer to company (legacy)
  const handleTransferToCompany = async () => {
    if (!walletData?.company) {
      showNotification('error', 'Error', 'No tienes una empresa asociada')
      return
    }

    const amount = parseFloat(transferAmount)
    if (!amount || amount <= 0) {
      showNotification('error', 'Error', 'Ingresa un monto valido')
      return
    }

    if (amount > walletData.balance) {
      showNotification('error', 'Error', 'Saldo insuficiente')
      return
    }

    setTransferring(true)
    try {
      const res = await fetch('/api/wallet/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: 'user',
          sourceId: walletData.id,
          targetType: 'company',
          targetWalletNumber: walletData.company.walletNumber,
          amount
        })
      })

      const data = await res.json()

      if (data.success) {
        showNotification('success', 'Exito', 'Transferencia exitosa')
        setTransferAmount('')
        fetchWalletData()
      } else {
        showNotification('error', 'Error', data.error || 'Error al transferir')
      }
    } catch (err) {
      showNotification('error', 'Error', 'Error de conexion')
    } finally {
      setTransferring(false)
    }
  }

  // Show password dialog - render OUTSIDE DashboardLayout to prevent header animation
  if (!isAuthenticated && showPasswordDialog) {
    return (
      <PasswordConfirmDialog
        isOpen={true}
        onClose={() => router.back()}
        onSuccess={handlePasswordSuccess}
        title="Acceso a Mi Billetera"
        message="Por seguridad, ingresa tu contrasena para acceder a tu billetera personal."
        preventClose={true}
      />
    )
  }

  // Show loading
  if (loading && !walletData) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    )
  }

  // Show error
  if (error) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 mx-auto text-red-400 mb-4" />
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchWalletData}
              className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Reintentar
            </button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!walletData) return null

  const tabs = [
    { id: 'dashboard', label: 'Resumen', icon: Wallet },
    { id: 'transfer', label: 'Transferir', icon: Send },
    { id: 'cashout', label: 'Retirar', icon: Download },
    { id: 'history', label: 'Historial', icon: History },
  ]

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              Mi Billetera
            </h1>
            <p className={cn("text-sm mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              Gestiona tu billetera personal
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={fetchWalletData}
            disabled={loading}
            className={cn(
              "p-2 rounded-lg transition-colors",
              theme === 'dark'
                ? "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            )}
          >
            <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
          </motion.button>
        </motion.div>

        {/* Virtual Card + Chart Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Virtual Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 100 }}
          >
            <VirtualCard
              key={`card-${walletData.balance}`}
              walletNumber={walletData.walletNumber}
              name={walletData.name}
              balance={walletData.balance}
              balanceFormatted={walletData.balanceFormatted}
              status="active"
              type="user"
              email={walletData.email}
              phone={walletData.phone}
            />
          </motion.div>

          {/* Activity Chart */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 100 }}
            className={cn(
              "rounded-2xl p-6 border h-full min-h-[220px] flex flex-col",
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            )}
          >
            <h3 className={cn("text-lg font-semibold mb-4", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              Actividad de Billetera
            </h3>
            {chartData.length > 0 ? (
              <div className="flex-1 flex items-center">
                <div className="w-1/2 h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
                        dataKey="value"
                        stroke="none"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                        contentStyle={{
                          backgroundColor: theme === 'dark' ? '#1f2937' : '#fff',
                          border: theme === 'dark' ? '1px solid #374151' : '1px solid #e5e7eb',
                          borderRadius: '8px',
                          color: theme === 'dark' ? '#fff' : '#111827'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 space-y-2">
                  {chartData.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className={cn(
                        "text-sm",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      )}>
                        {item.name}
                      </span>
                      <span className={cn(
                        "text-sm font-medium ml-auto",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        ${item.value.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className={cn("text-sm", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                  Sin actividad aun
                </p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Tabs - matching company wallet style */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(
            "flex flex-wrap gap-2 p-1.5 rounded-xl mb-6",
            theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100'
          )}
        >
          {tabs.map((tab) => (
            <motion.button
              key={tab.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-lg transition-all",
                activeTab === tab.id
                  ? theme === 'dark'
                    ? "bg-gray-700 text-white shadow-lg"
                    : "bg-white text-gray-900 shadow-lg"
                  : theme === 'dark'
                    ? "text-gray-400 hover:text-gray-200"
                    : "text-gray-600 hover:text-gray-900"
              )}
            >
              <tab.icon className="w-5 h-5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </motion.button>
          ))}
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Stats Cards Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Balance */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={cn(
                    "rounded-xl p-5 border col-span-2 lg:col-span-1",
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="w-5 h-5 text-green-500" />
                    <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Balance</p>
                  </div>
                  <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    $<AnimatedNumber value={walletData.balance} decimals={2} />
                  </p>
                  <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                    {walletData.name}
                  </p>
                </motion.div>

                {/* Recargas */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className={cn(
                    "rounded-xl p-5 border",
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowDownRight className="w-5 h-5 text-green-500" />
                    <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Recargas</p>
                  </div>
                  <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    $<AnimatedNumber value={stats?.rechargesAmount || 0} decimals={2} />
                  </p>
                  <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                    {stats?.totalRecharges || 0} transacciones
                  </p>
                </motion.div>

                {/* Enviado */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className={cn(
                    "rounded-xl p-5 border",
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowUpRight className={cn("w-5 h-5", brandText)} />
                    <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Enviado</p>
                  </div>
                  <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    $<AnimatedNumber value={stats?.transfersSentAmount || 0} decimals={2} />
                  </p>
                  <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                    {stats?.transfersSent || 0} transferencias
                  </p>
                </motion.div>

                {/* Recibido */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className={cn(
                    "rounded-xl p-5 border",
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowDownRight className="w-5 h-5 text-blue-500" />
                    <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Recibido</p>
                  </div>
                  <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    $<AnimatedNumber value={stats?.transfersReceivedAmount || 0} decimals={2} />
                  </p>
                  <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                    {stats?.transfersReceived || 0} transferencias
                  </p>
                </motion.div>
              </div>

              {/* Retiros Card - Full width */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  "rounded-xl p-5 border",
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                      <Download className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Retiros Totales</p>
                      <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        $<AnimatedNumber value={stats?.cashoutsAmount || 0} decimals={2} />
                      </p>
                    </div>
                  </div>
                  <p className={cn("text-sm", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                    {stats?.totalCashouts || 0} retiros realizados
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Transfer Tab */}
          {activeTab === 'transfer' && (
            <motion.div
              key="transfer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-xl mx-auto"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  "rounded-xl p-6 border",
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                <h3 className={cn("text-lg font-semibold mb-4", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Transferir a Cualquier Wallet
                </h3>

                {/* Search Wallet Input */}
                {!selectedTargetWallet ? (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 }}
                    className="mb-6"
                  >
                    <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Buscar destino
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={targetSearchQuery}
                        onChange={(e) => setTargetSearchQuery(e.target.value)}
                        placeholder="Buscar por nombre, email, telefono o numero de wallet..."
                        className={cn(
                          "w-full pl-10 pr-4 py-3 border rounded-lg",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400'
                            : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400'
                        )}
                      />
                      {searchingTarget && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-gray-400" />
                      )}
                    </div>

                    {/* Search Results */}
                    {targetSearchResults.length > 0 && (
                      <div className={cn(
                        "mt-2 border rounded-lg max-h-60 overflow-y-auto",
                        theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'
                      )}>
                        {targetSearchResults.map((wallet) => (
                          <button
                            key={`${wallet.type}-${wallet.id}`}
                            onClick={() => {
                              setSelectedTargetWallet(wallet)
                              setTargetSearchQuery('')
                              setTargetSearchResults([])
                            }}
                            className={cn(
                              "w-full p-3 flex items-center gap-3 text-left transition-colors border-b last:border-b-0",
                              theme === 'dark'
                                ? 'hover:bg-gray-600 border-gray-600'
                                : 'hover:bg-gray-50 border-gray-100'
                            )}
                          >
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center",
                              wallet.type === 'company'
                                ? 'bg-blue-100 dark:bg-blue-900/30'
                                : wallet.type === 'user'
                                  ? 'bg-purple-100 dark:bg-purple-900/30'
                                  : 'bg-green-100 dark:bg-green-900/30'
                            )}>
                              {wallet.type === 'company' ? (
                                <Building className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                              ) : wallet.type === 'user' ? (
                                <User className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                              ) : (
                                <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "font-medium truncate",
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {wallet.name}
                              </p>
                              <p className={cn(
                                "text-sm truncate",
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                              )}>
                                {wallet.walletNumber}
                                {wallet.phone && ` · ${wallet.phone}`}
                              </p>
                            </div>
                            <span className={cn(
                              "text-xs px-2 py-1 rounded-full",
                              wallet.type === 'company'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                                : wallet.type === 'user'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                                  : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                            )}>
                              {wallet.type === 'company' ? 'Empresa' : wallet.type === 'user' ? 'Usuario' : 'Cliente'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* No Results */}
                    {targetSearchQuery.length >= 2 && !searchingTarget && targetSearchResults.length === 0 && (
                      <p className={cn(
                        "mt-2 text-sm text-center py-4",
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                      )}>
                        No se encontraron wallets
                      </p>
                    )}
                  </motion.div>
                ) : (
                  <>
                    {/* Selected Target Wallet */}
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 }}
                      className={cn(
                        "mb-6 p-4 rounded-lg relative",
                        theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                      )}
                    >
                      <button
                        onClick={() => setSelectedTargetWallet(null)}
                        className={cn(
                          "absolute top-2 right-2 p-1 rounded-full transition-colors",
                          theme === 'dark' ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                        )}
                      >
                        <AlertCircle className="w-4 h-4 text-gray-400 rotate-45" />
                      </button>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          selectedTargetWallet.type === 'company'
                            ? 'bg-blue-100 dark:bg-blue-900/30'
                            : selectedTargetWallet.type === 'user'
                              ? 'bg-purple-100 dark:bg-purple-900/30'
                              : 'bg-green-100 dark:bg-green-900/30'
                        )}>
                          {selectedTargetWallet.type === 'company' ? (
                            <Building className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          ) : selectedTargetWallet.type === 'user' ? (
                            <User className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                          ) : (
                            <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
                          )}
                        </div>
                        <div>
                          <p className={cn("text-sm mb-0.5", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                            Destino
                          </p>
                          <p className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {selectedTargetWallet.name}
                          </p>
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                            {selectedTargetWallet.walletNumber}
                          </p>
                        </div>
                        <Check className="w-5 h-5 text-green-500 ml-auto" />
                      </div>
                    </motion.div>

                    {/* Amount Input */}
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                      className="mb-4"
                    >
                      <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        Monto a transferir
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          value={transferAmount}
                          onChange={(e) => setTransferAmount(e.target.value)}
                          placeholder="0.00"
                          max={walletData.balance}
                          className={cn(
                            "w-full pl-8 pr-4 py-3 border rounded-lg",
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-white border-gray-200 text-gray-900'
                          )}
                        />
                      </div>
                      <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                        Disponible: {walletData.balanceFormatted}
                      </p>
                    </motion.div>

                    {/* Description Input */}
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 }}
                      className="mb-6"
                    >
                      <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        Descripcion (opcional)
                      </label>
                      <input
                        type="text"
                        value={transferDescription}
                        onChange={(e) => setTransferDescription(e.target.value)}
                        placeholder="Motivo de la transferencia..."
                        className={cn(
                          "w-full px-4 py-3 border rounded-lg",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400'
                            : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400'
                        )}
                      />
                    </motion.div>

                    {/* Transfer Button */}
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleTransfer}
                      disabled={transferring || !transferAmount || parseFloat(transferAmount) <= 0}
                      className={cn(
                        "w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors",
                        theme === 'dark'
                          ? 'bg-white text-gray-900 hover:bg-gray-100'
                          : 'bg-gray-900 text-white hover:bg-gray-800'
                      )}
                    >
                      {transferring ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Transfiriendo...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Transferir ${transferAmount || '0.00'}
                        </>
                      )}
                    </motion.button>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}

          {/* Cashout Tab */}
          {activeTab === 'cashout' && (
            <motion.div
              key="cashout"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-xl mx-auto space-y-6"
            >
              {/* Stripe Connect Status */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
              >
                <StripeConnectStatus
                  entityType="user"
                  entityId={walletData.id}
                />
              </motion.div>

              {/* Cashout info */}
              {walletData.canCashout && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className={cn(
                    "rounded-xl p-6 border",
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}
                >
                  <h3 className={cn("text-lg font-semibold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    Retirar Fondos
                  </h3>
                  <p className={cn("text-sm mb-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                    Retira fondos de tu billetera a tu cuenta bancaria vinculada.
                  </p>
                  <p className={cn("text-2xl font-bold mb-4", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {walletData.balanceFormatted}
                    <span className={cn("text-sm font-normal ml-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>disponible</span>
                  </p>
                  <p className={cn("text-sm", theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                    Contacta a soporte para solicitar retiros manuales.
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={cn(
                "rounded-xl border overflow-hidden",
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              )}
            >
              <div className={cn(
                "divide-y",
                theme === 'dark' ? 'divide-gray-700' : 'divide-gray-100'
              )}>
                {transactions.length === 0 ? (
                  <div className="p-8 text-center">
                    <History className={cn("w-12 h-12 mx-auto mb-4", theme === 'dark' ? 'text-gray-600' : 'text-gray-300')} />
                    <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      No hay transacciones aun
                    </p>
                  </div>
                ) : (
                  transactions.map((tx, index) => (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        "p-4 cursor-pointer transition-colors",
                        theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center",
                            tx.isIncoming
                              ? "bg-green-100 dark:bg-green-900/30"
                              : "bg-red-100 dark:bg-red-900/30"
                          )}>
                            {tx.isIncoming ? (
                              <ArrowDownRight className="w-5 h-5 text-green-600 dark:text-green-400" />
                            ) : (
                              <ArrowUpRight className="w-5 h-5 text-red-600 dark:text-red-400" />
                            )}
                          </div>
                          <div>
                            <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {tx.typeLabel}
                            </p>
                            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                              {tx.isIncoming ? `De: ${tx.sourceName}` : `A: ${tx.targetName}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn(
                            "font-semibold",
                            tx.isIncoming
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          )}>
                            {tx.isIncoming ? '+' : '-'}{tx.amountFormatted}
                          </p>
                          <p className={cn("text-xs", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                            {new Date(tx.createdAt).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  )
}
