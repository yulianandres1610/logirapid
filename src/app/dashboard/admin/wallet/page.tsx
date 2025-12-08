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
  ChevronLeft,
  AlertCircle,
  ArrowLeft,
  Users
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { VirtualCard } from '@/components/wallet/VirtualCard'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'

type Tab = 'dashboard' | 'recharge' | 'transfer' | 'history' | 'pending'
type PaymentMethod = 'card_manual' | 'card_terminal' | 'cash' | 'wire' | 'zelle' | 'credit'

// Wizard steps for recharge
type RechargeStep = 1 | 2 | 3

interface DashboardStats {
  totalBalance: { value: number; formatted: string }
  rechargesThisMonth: { value: number; formatted: string; change: number; count: number }
  transfersThisMonth: { value: number; formatted: string; change: number; count: number }
  activeCompanies: { value: number }
  pendingRequests: { value: number }
  pendingTransactions: { value: number }
  totalWallets: { value: number; companies: number; users: number; customers?: number }
  totalCompanies: { value: number; balance?: number; balanceFormatted?: string }
  totalUsers: { value: number; balance?: number; balanceFormatted?: string }
  totalCustomers: { value: number; balance?: number; balanceFormatted?: string }
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
  type: 'company' | 'user' | 'customer'
  dailyLimit?: number
  monthlyLimit?: number
  dailyUsed?: number
  monthlyUsed?: number
}

interface Transaction {
  id: number
  transactionNumber?: number
  type: string
  typeLabel: string
  sourceName: string
  sourceWalletNumber?: string
  targetName: string
  targetWalletNumber?: string
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

interface MonthlyTrend {
  month: string
  recharges: number
  transfers: number
  commissions: number
}

interface RechargeByMethod {
  method: string
  total: number
  count: number
}

const paymentMethods = [
  { id: 'card_manual', label: 'Tarjeta', icon: CreditCard },
  { id: 'card_terminal', label: 'Terminal', icon: Smartphone },
  { id: 'cash', label: 'Efectivo', icon: Banknote },
  { id: 'wire', label: 'Wire', icon: Building },
  { id: 'zelle', label: 'Zelle', icon: DollarSign },
  { id: 'credit', label: 'Crédito LogiRapid', icon: Wallet, superAdminOnly: true }
]

const quickAmounts = [50, 100, 250, 500, 1000]

// Month names for chart labels
const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export default function WalletManagementPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') as Tab | null

  // Brand colors - Exa colors
  const brandColor = theme === 'dark' ? 'blue' : 'red'
  const exaBrandBg = theme === 'dark' ? '#0374e5' : '#cc0a46'
  const exaBrandBgHover = theme === 'dark' ? '#0263c7' : '#b00940'
  const brandText = theme === 'dark' ? 'text-blue-500' : 'text-red-500'
  const brandBorder = theme === 'dark' ? 'border-blue-500' : 'border-red-500'

  const [activeTab, setActiveTab] = useState<Tab>(tabParam || 'dashboard')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dashboard data
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [topWallets, setTopWallets] = useState<WalletResult[]>([])
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([])
  const [rechargesByMethod, setRechargesByMethod] = useState<RechargeByMethod[]>([])

  // Recharge wizard
  const [rechargeStep, setRechargeStep] = useState<RechargeStep>(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<WalletResult[]>([])
  const [selectedWallet, setSelectedWallet] = useState<WalletResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [rechargeAmount, setRechargeAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card_manual')
  const [paymentReference, setPaymentReference] = useState('')
  const [processing, setProcessing] = useState(false)

  // Terminal checkout state
  const [availableTerminals, setAvailableTerminals] = useState<Array<{ id: number; name: string; deviceId: string; locationName: string }>>([])
  const [selectedTerminalId, setSelectedTerminalId] = useState<number | null>(null)
  const [terminalCheckoutId, setTerminalCheckoutId] = useState<string | null>(null)
  const [terminalPolling, setTerminalPolling] = useState(false)
  const [terminalStatus, setTerminalStatus] = useState<string | null>(null)
  const [loadingTerminals, setLoadingTerminals] = useState(false)

  // Transfer wizard
  const [transferStep, setTransferStep] = useState<1 | 2 | 3 | 4>(1)
  const [transferSourceWallet, setTransferSourceWallet] = useState<WalletResult | null>(null)
  const [transferTargetWallet, setTransferTargetWallet] = useState<WalletResult | null>(null)
  const [transferAmount, setTransferAmount] = useState('')
  const [transferDescription, setTransferDescription] = useState('')
  const [sourceSearchQuery, setSourceSearchQuery] = useState('')
  const [targetSearchQuery, setTargetSearchQuery] = useState('')
  const [sourceSearchResults, setSourceSearchResults] = useState<WalletResult[]>([])
  const [targetSearchResults, setTargetSearchResults] = useState<WalletResult[]>([])

  // History
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historySearchQuery, setHistorySearchQuery] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyTotalPages, setHistoryTotalPages] = useState(0)

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
        setTopWallets(data.data.topWallets || [])
        // Set chart data
        if (data.data.charts) {
          setMonthlyTrends(data.data.charts.monthlyTrends || [])
          setRechargesByMethod(data.data.charts.rechargesByMethod || [])
        }
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
  const searchWallets = async (query: string, setResults: (results: WalletResult[]) => void) => {
    if (query.length < 2) {
      setResults([])
      return
    }
    try {
      setSearching(true)
      const response = await fetch(`/api/wallet/search?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      if (data.success) {
        setResults(data.data.results || [])
      }
    } catch (err) {
      console.error('Error searching:', err)
    } finally {
      setSearching(false)
    }
  }

  // Fetch available terminals for terminal payment
  const fetchAvailableTerminals = async () => {
    try {
      setLoadingTerminals(true)
      const response = await fetch('/api/terminals?provider=square&status=paired')
      const data = await response.json()
      if (data.success) {
        setAvailableTerminals(data.data.terminals || [])
        // Auto-select first terminal if available
        if (data.data.terminals?.length > 0) {
          setSelectedTerminalId(data.data.terminals[0].id)
        }
      }
    } catch (err) {
      console.error('Error fetching terminals:', err)
    } finally {
      setLoadingTerminals(false)
    }
  }

  // Calculate 3% fee for terminal payments
  const calculateTerminalFee = (amount: number) => {
    const fee = amount * 0.03
    return {
      fee: Math.round(fee * 100) / 100,
      total: Math.round((amount + fee) * 100) / 100
    }
  }

  // Poll terminal checkout status
  const pollTerminalStatus = useCallback(async (checkoutId: string) => {
    try {
      const response = await fetch(`/api/wallet/recharge/terminal/${checkoutId}/status`)
      const data = await response.json()

      if (data.success) {
        const status = data.data.status
        setTerminalStatus(status)

        if (status === 'completed') {
          setTerminalPolling(false)
          setTerminalCheckoutId(null)
          showNotification('success', 'Recarga Exitosa', `Se han agregado $${rechargeAmount} al wallet`)
          // Reset form
          setRechargeAmount('')
          setPaymentReference('')
          setSelectedWallet(null)
          setSearchQuery('')
          setRechargeStep(1)
          setSelectedTerminalId(null)
          setTerminalStatus(null)
          fetchDashboard()
        } else if (status === 'cancelled' || status === 'failed') {
          setTerminalPolling(false)
          setTerminalCheckoutId(null)
          setTerminalStatus(null)
          showNotification('error', 'Pago Cancelado', 'El pago fue cancelado o falló')
        }
        // Continue polling for pending/in_progress states
      }
    } catch (err) {
      console.error('Error polling terminal status:', err)
    }
  }, [rechargeAmount, showNotification])

  // Effect to poll terminal status
  useEffect(() => {
    if (!terminalPolling || !terminalCheckoutId) return

    const interval = setInterval(() => {
      pollTerminalStatus(terminalCheckoutId)
    }, 3000) // Poll every 3 seconds

    return () => clearInterval(interval)
  }, [terminalPolling, terminalCheckoutId, pollTerminalStatus])

  // Effect to fetch terminals when terminal method is selected
  useEffect(() => {
    if (paymentMethod === 'card_terminal' && availableTerminals.length === 0) {
      fetchAvailableTerminals()
    }
  }, [paymentMethod])

  // Process recharge
  const processRecharge = async () => {
    if (!selectedWallet || !rechargeAmount || parseFloat(rechargeAmount) <= 0) {
      showNotification('warning', 'Datos incompletos', 'Seleccione un wallet y monto valido')
      return
    }

    // Handle terminal payment differently
    if (paymentMethod === 'card_terminal') {
      if (!selectedTerminalId) {
        showNotification('warning', 'Terminal no seleccionado', 'Por favor seleccione un terminal de pago')
        return
      }

      try {
        setProcessing(true)
        const response = await fetch('/api/wallet/recharge/terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetWalletNumber: selectedWallet.walletNumber,
            targetType: selectedWallet.type,
            amount: parseFloat(rechargeAmount),
            terminalId: selectedTerminalId,
            description: paymentReference || undefined
          })
        })
        const data = await response.json()
        if (data.success) {
          showNotification('info', 'Esperando Pago', 'Proceso de pago enviado al terminal. Por favor complete el pago en el terminal.')
          setTerminalCheckoutId(data.data.checkoutId)
          setTerminalPolling(true)
          setTerminalStatus('pending')
        } else {
          showNotification('error', 'Error', data.error)
          setProcessing(false)
        }
      } catch (err) {
        showNotification('error', 'Error', 'Error al enviar pago al terminal')
        setProcessing(false)
      }
      return
    }

    // Regular recharge flow for non-terminal methods
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
        showNotification('success', 'Recarga Exitosa', data.message)
        // Reset form
        setRechargeAmount('')
        setPaymentReference('')
        setSelectedWallet(null)
        setSearchQuery('')
        setRechargeStep(1)
        fetchDashboard()
      } else {
        showNotification('error', 'Error', data.error)
      }
    } catch (err) {
      showNotification('error', 'Error', 'Error al procesar la recarga')
    } finally {
      setProcessing(false)
    }
  }

  // Cancel terminal checkout
  const cancelTerminalCheckout = async () => {
    if (!terminalCheckoutId) return

    try {
      setTerminalPolling(false)
      setProcessing(false)
      setTerminalCheckoutId(null)
      setTerminalStatus(null)
      showNotification('info', 'Cancelado', 'Proceso de pago cancelado')
    } catch (err) {
      console.error('Error canceling checkout:', err)
    }
  }

  // Process transfer
  const processTransfer = async () => {
    if (!transferSourceWallet || !transferTargetWallet || !transferAmount) {
      showNotification('warning', 'Datos incompletos', 'Complete todos los campos')
      return
    }

    const amount = parseFloat(transferAmount)

    // Validate amount is positive
    if (amount <= 0) {
      showNotification('error', 'Monto Invalido', 'El monto debe ser mayor a 0')
      return
    }

    // Validate amount doesn't exceed source wallet balance
    if (amount > transferSourceWallet.balance) {
      showNotification('error', 'Balance Insuficiente', `El monto ($${amount.toFixed(2)}) excede el saldo disponible ($${transferSourceWallet.balance.toFixed(2)})`)
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
          amount,
          description: transferDescription || undefined
        })
      })
      const data = await response.json()
      if (data.success) {
        showNotification('success', 'Transferencia Exitosa', data.message)
        // Reset form
        setTransferSourceWallet(null)
        setTransferTargetWallet(null)
        setTransferAmount('')
        setTransferDescription('')
        setSourceSearchQuery('')
        setTargetSearchQuery('')
        setTransferStep(1)
        fetchDashboard()
      } else {
        showNotification('error', 'Error', data.error)
      }
    } catch (err) {
      showNotification('error', 'Error', 'Error al procesar la transferencia')
    } finally {
      setProcessing(false)
    }
  }

  // Fetch transactions
  const fetchTransactions = async (page: number = 1, search?: string) => {
    try {
      setHistoryLoading(true)
      const params = new URLSearchParams({
        limit: '25',
        page: page.toString()
      })
      if (search && search.trim()) {
        params.append('search', search.trim())
      }
      const response = await fetch(`/api/wallet/transactions?${params.toString()}`)
      const data = await response.json()
      if (data.success) {
        setTransactions(data.data.transactions || [])
        setHistoryTotal(data.data.pagination?.total || 0)
        setHistoryTotalPages(data.data.pagination?.totalPages || 0)
        setHistoryPage(page)
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
        setPendingRequests(data.data.requests || [])
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
        showNotification('success', action === 'approve' ? 'Aprobada' : 'Rechazada', data.message)
        fetchPendingRequests()
        fetchDashboard()
      } else {
        showNotification('error', 'Error', data.error)
      }
    } catch (err) {
      showNotification('error', 'Error', 'Error al procesar la solicitud')
    }
  }

  useEffect(() => {
    fetchDashboard()
    fetchPendingRequests()
  }, [fetchDashboard])

  useEffect(() => {
    if (activeTab === 'history') {
      fetchTransactions(1, historySearchQuery)
    }
  }, [activeTab])

  // Handle history search
  const handleHistorySearch = (e: React.FormEvent) => {
    e.preventDefault()
    setHistoryPage(1)
    fetchTransactions(1, historySearchQuery)
  }

  // Handle history page change
  const handleHistoryPageChange = (newPage: number) => {
    fetchTransactions(newPage, historySearchQuery)
  }

  // Update URL when tab changes
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    router.push(`/dashboard/admin/wallet?tab=${tab}`, { scroll: false })
  }

  const tabs = [
    { id: 'dashboard' as Tab, label: 'Dashboard', icon: TrendingUp },
    { id: 'recharge' as Tab, label: 'Recargar', icon: ArrowDownRight },
    { id: 'transfer' as Tab, label: 'Transferir', icon: ArrowUpRight },
    { id: 'history' as Tab, label: 'Historial', icon: History },
    { id: 'pending' as Tab, label: 'Solicitudes', icon: Clock, badge: stats?.pendingRequests?.value || 0 }
  ]

  const rechargeSteps = [
    { id: 1, title: 'Wallet', icon: Search },
    { id: 2, title: 'Monto', icon: DollarSign },
    { id: 3, title: 'Confirmar', icon: Check }
  ]

  const transferSteps = [
    { id: 1, title: 'Origen', icon: Wallet },
    { id: 2, title: 'Monto', icon: DollarSign },
    { id: 3, title: 'Destino', icon: Users },
    { id: 4, title: 'Confirmar', icon: Check }
  ]

  return (
    <DashboardLayout>
      <div className={cn(
        "min-h-screen pt-6 pb-20 px-4 sm:px-6 lg:px-8",
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Single Tab Bar */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex gap-1 p-1.5 rounded-xl overflow-x-auto",
              theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm'
            )}
          >
            {tabs.map((tab) => (
              <motion.button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "flex-1 min-w-[100px] flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 relative whitespace-nowrap",
                  activeTab === tab.id
                    ? 'text-white'
                    : theme === 'dark'
                      ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                )}
                style={activeTab === tab.id ? { backgroundColor: exaBrandBg } : undefined}
              >
                <tab.icon className="w-5 h-5" />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 sm:static sm:ml-1 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px]">
                    {tab.badge}
                  </span>
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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Stats Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {loading ? (
                    [...Array(8)].map((_, i) => (
                      <div key={i} className={cn(
                        "rounded-xl p-5 animate-pulse",
                        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                      )}>
                        <div className={cn("h-4 rounded w-1/2 mb-3", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')} />
                        <div className={cn("h-8 rounded w-2/3", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')} />
                      </div>
                    ))
                  ) : stats && (
                    <>
                      {/* Balance Total */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className={cn(
                          "rounded-xl p-5 border col-span-2 sm:col-span-1",
                          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                        )}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Wallet className="w-5 h-5 text-green-500" />
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Balance Total</p>
                        </div>
                        <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{stats.totalBalance.formatted}</p>
                      </motion.div>

                      {/* Total Wallets */}
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
                          <CreditCard className="w-5 h-5 text-indigo-500" />
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Total Wallets</p>
                        </div>
                        <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{stats.totalWallets?.value || 0}</p>
                        <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                          {stats.totalWallets?.companies || 0} empresas, {stats.totalWallets?.users || 0} usuarios
                        </p>
                      </motion.div>

                      {/* Recargas Mes */}
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
                          <ArrowDownRight className="w-5 h-5 text-green-500" />
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Recargas Mes</p>
                        </div>
                        <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{stats.rechargesThisMonth.formatted}</p>
                        <p className={cn(
                          "text-xs mt-1",
                          stats.rechargesThisMonth.change >= 0 ? 'text-green-500' : 'text-red-500'
                        )}>
                          {stats.rechargesThisMonth.change >= 0 ? '+' : ''}{stats.rechargesThisMonth.change}%
                        </p>
                      </motion.div>

                      {/* Transferencias Mes */}
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
                          <ArrowUpRight className={cn("w-5 h-5", brandText)} />
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Transferencias Mes</p>
                        </div>
                        <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{stats.transfersThisMonth.formatted}</p>
                        <p className={cn(
                          "text-xs mt-1",
                          stats.transfersThisMonth.change >= 0 ? 'text-green-500' : 'text-red-500'
                        )}>
                          {stats.transfersThisMonth.change >= 0 ? '+' : ''}{stats.transfersThisMonth.change}%
                        </p>
                      </motion.div>

                      {/* Saldo Empresas */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className={cn(
                          "rounded-xl p-5 border",
                          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                        )}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className="w-5 h-5 text-purple-500" />
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Empresas</p>
                        </div>
                        <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{stats.totalCompanies?.balanceFormatted || '$0.00'}</p>
                        <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>{stats.totalCompanies?.value || 0} empresas ({stats.activeCompanies?.value || 0} activas)</p>
                      </motion.div>

                      {/* Saldo Usuarios */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 }}
                        className={cn(
                          "rounded-xl p-5 border",
                          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                        )}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-5 h-5 text-cyan-500" />
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Usuarios</p>
                        </div>
                        <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{stats.totalUsers?.balanceFormatted || '$0.00'}</p>
                        <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>{stats.totalUsers?.value || 0} usuarios registrados</p>
                      </motion.div>

                      {/* Saldo Clientes */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className={cn(
                          "rounded-xl p-5 border",
                          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                        )}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-5 h-5 text-amber-500" />
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Clientes</p>
                        </div>
                        <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{stats.totalCustomers?.balanceFormatted || '$0.00'}</p>
                        <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>{stats.totalCustomers?.value || 0} clientes en el sistema</p>
                      </motion.div>

                      {/* Transacciones Pendientes */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.45 }}
                        className={cn(
                          "rounded-xl p-5 border",
                          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                        )}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-5 h-5 text-yellow-500" />
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Pendientes</p>
                        </div>
                        <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{stats.pendingTransactions?.value || 0}</p>
                        <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>transacciones ({stats.pendingRequests?.value || 0} solicitudes)</p>
                      </motion.div>
                    </>
                  )}
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Area Chart - Transaction Trends */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className={cn(
                      "rounded-xl p-6 border lg:col-span-2",
                      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    )}
                  >
                    <h3 className={cn("text-lg font-semibold mb-4", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      Tendencias de Transacciones
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthlyTrends.map(t => ({
                          name: monthNames[parseInt(t.month.split('-')[1]) - 1] || t.month,
                          recargas: t.recharges,
                          transferencias: t.transfers,
                          comisiones: t.commissions || 0
                        }))}>
                          <defs>
                            <linearGradient id="colorRecargas" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorTransferencias" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={theme === 'dark' ? '#3b82f6' : '#ef4444'} stopOpacity={0.3}/>
                              <stop offset="95%" stopColor={theme === 'dark' ? '#3b82f6' : '#ef4444'} stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorComisiones" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
                          <XAxis
                            dataKey="name"
                            stroke={theme === 'dark' ? '#9ca3af' : '#6b7280'}
                            fontSize={12}
                          />
                          <YAxis
                            stroke={theme === 'dark' ? '#9ca3af' : '#6b7280'}
                            fontSize={12}
                            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                              border: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
                              borderRadius: '8px',
                              color: theme === 'dark' ? '#ffffff' : '#000000'
                            }}
                            formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                          />
                          <Area
                            type="monotone"
                            dataKey="recargas"
                            name="Recargas"
                            stroke="#22c55e"
                            fillOpacity={1}
                            fill="url(#colorRecargas)"
                            strokeWidth={2}
                          />
                          <Area
                            type="monotone"
                            dataKey="transferencias"
                            name="Transferencias"
                            stroke={theme === 'dark' ? '#3b82f6' : '#ef4444'}
                            fillOpacity={1}
                            fill="url(#colorTransferencias)"
                            strokeWidth={2}
                          />
                          <Area
                            type="monotone"
                            dataKey="comisiones"
                            name="Comisiones"
                            stroke="#f59e0b"
                            fillOpacity={1}
                            fill="url(#colorComisiones)"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-4 mt-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-green-500" />
                        <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Recargas</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("w-3 h-3 rounded-full", theme === 'dark' ? 'bg-blue-500' : 'bg-red-500')} />
                        <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Transferencias</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-amber-500" />
                        <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Comisiones</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Pie Chart - Recharges by Method */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className={cn(
                      "rounded-xl p-6 border",
                      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    )}
                  >
                    <h3 className={cn("text-lg font-semibold mb-4", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      Recargas por Metodo
                    </h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={rechargesByMethod.length > 0 ? rechargesByMethod.map((item, index) => ({
                              name: item.method,
                              value: item.total,
                              color: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]
                            })) : [{ name: 'Sin datos', value: 1, color: theme === 'dark' ? '#374151' : '#e5e7eb' }]}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {(rechargesByMethod.length > 0 ? rechargesByMethod : [{ method: 'Sin datos', total: 1 }]).map((_, index) => (
                              <Cell key={`cell-${index}`} fill={['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#374151'][index % 6]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                              border: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
                              borderRadius: '8px',
                              color: theme === 'dark' ? '#ffffff' : '#000000'
                            }}
                            formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 mt-2">
                      {rechargesByMethod.length > 0 ? rechargesByMethod.map((item, index) => {
                        const totalSum = rechargesByMethod.reduce((acc, curr) => acc + curr.total, 0)
                        const percentage = totalSum > 0 ? ((item.total / totalSum) * 100).toFixed(1) : '0'
                        const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']
                        return (
                          <div key={item.method} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[index % 5] }} />
                              <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>{item.method}</span>
                            </div>
                            <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{percentage}%</span>
                          </div>
                        )
                      }) : (
                        <div className="text-center py-4">
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Sin datos de recargas</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>

                {/* Search and Card */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 }}
                    className={cn(
                      "rounded-xl p-6 border",
                      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    )}
                  >
                    <h3 className={cn("text-lg font-semibold mb-4", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      Buscar Wallet
                    </h3>
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
                          searchWallets(e.target.value, setSearchResults)
                        }}
                        placeholder="Numero, telefono o nombre..."
                        className={cn(
                          "w-full pl-12 pr-4 py-3 rounded-lg border transition-all",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500'
                            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-red-500'
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
                      <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                        {searchResults.map(wallet => (
                          <button
                            key={`${wallet.type}-${wallet.id}`}
                            onClick={() => {
                              setSelectedWallet(wallet)
                              setSearchResults([])
                            }}
                            className={cn(
                              "w-full p-3 text-left rounded-lg border transition-colors flex items-center justify-between",
                              theme === 'dark'
                                ? 'bg-gray-700 border-gray-600 hover:border-blue-500'
                                : 'bg-gray-50 border-gray-200 hover:border-red-500'
                            )}
                          >
                            <div>
                              <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{wallet.name}</p>
                              <p className={cn("text-xs font-mono", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                No. Cuenta: {wallet.walletNumber}
                              </p>
                              <p className={cn("text-xs", theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
                                Balance: {wallet.balanceFormatted}
                              </p>
                            </div>
                            <ChevronRight className={cn("w-5 h-5", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>

                  {selectedWallet ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
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
                        dailyUsed={selectedWallet.dailyUsed || 0}
                        monthlyUsed={selectedWallet.monthlyUsed || 0}
                        onRecharge={() => handleTabChange('recharge')}
                        onTransfer={() => {
                          setTransferSourceWallet(selectedWallet)
                          setSourceSearchQuery(selectedWallet.name)
                          handleTabChange('transfer')
                        }}
                        onHistory={() => handleTabChange('history')}
                      />
                    </motion.div>
                  ) : (
                    <div className={cn(
                      "rounded-xl p-8 border flex flex-col items-center justify-center min-h-[280px]",
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                    )}>
                      <CreditCard className={cn("w-12 h-12 mb-4", theme === 'dark' ? 'text-gray-600' : 'text-gray-300')} />
                      <p className={cn("text-center", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        Busca un wallet para ver su tarjeta
                      </p>
                    </div>
                  )}
                </div>

                {/* Top Wallets Table */}
                {topWallets.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className={cn(
                      "rounded-xl p-6 border",
                      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    )}
                  >
                    <h3 className={cn("text-lg font-semibold mb-4", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      Top 10 Wallets por Balance
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className={cn("text-left text-xs uppercase tracking-wider", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                            <th className="pb-3 pl-3">#</th>
                            <th className="pb-3">Empresa</th>
                            <th className="pb-3">Wallet</th>
                            <th className="pb-3 text-right">Balance</th>
                            <th className="pb-3 text-center pr-3">Estado</th>
                          </tr>
                        </thead>
                        <tbody className={cn("divide-y", theme === 'dark' ? 'divide-gray-700' : 'divide-gray-100')}>
                          {topWallets.map((wallet, index) => (
                            <tr
                              key={wallet.id}
                              onClick={() => setSelectedWallet(wallet as any)}
                              className={cn(
                                "cursor-pointer transition-colors",
                                theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                              )}
                            >
                              <td className="py-3 pl-3">
                                <span
                                  className={cn(
                                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                                    index < 3
                                      ? 'text-white'
                                      : theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                                  )}
                                  style={index < 3 ? { backgroundColor: exaBrandBg } : undefined}
                                >
                                  {index + 1}
                                </span>
                              </td>
                              <td className="py-3">
                                <span className={cn("font-medium", brandText)}>{wallet.name}</span>
                              </td>
                              <td className={cn("py-3 font-mono text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                {wallet.walletNumber}
                              </td>
                              <td className={cn("py-3 text-right font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                {wallet.balanceFormatted}
                              </td>
                              <td className="py-3 text-center pr-3">
                                <span className={cn(
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                                  wallet.status === 'active'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                )}>
                                  <span className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    wallet.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
                                  )} />
                                  {wallet.status === 'active' ? 'Activo' : 'Limite'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Recharge Tab - Wizard Form */}
            {activeTab === 'recharge' && (
              <motion.div
                key="recharge"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-3xl mx-auto pt-16"
              >
                {/* Step Progress */}
                <div className="mb-8">
                  <div className="flex items-center justify-center">
                    {rechargeSteps.map((step, index) => (
                      <React.Fragment key={step.id}>
                        <div className="flex flex-col items-center">
                          <motion.div
                            animate={{
                              scale: rechargeStep === step.id ? 1.1 : 1,
                              backgroundColor: rechargeStep === step.id
                                ? theme === 'dark' ? '#0374e5' : '#cc0a46'
                                : rechargeStep > step.id
                                ? '#10B981'
                                : theme === 'dark' ? '#374151' : '#E5E7EB'
                            }}
                            className="w-12 h-12 rounded-full flex items-center justify-center"
                          >
                            {rechargeStep > step.id ? (
                              <Check className="w-6 h-6 text-white" />
                            ) : (
                              <step.icon className={cn(
                                "w-6 h-6",
                                rechargeStep === step.id ? 'text-white' : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                              )} />
                            )}
                          </motion.div>
                          <p className={cn(
                            "text-xs mt-2 font-medium",
                            rechargeStep === step.id ? brandText : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          )}>
                            {step.title}
                          </p>
                        </div>
                        {index < rechargeSteps.length - 1 && (
                          <div className="flex-1 h-0.5 mx-4 relative">
                            <div className={cn("absolute inset-0", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')} />
                            <motion.div
                              animate={{ scaleX: rechargeStep > step.id ? 1 : 0 }}
                              className="h-full origin-left bg-green-500"
                            />
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Step Content */}
                <motion.div
                  className={cn(
                    "rounded-2xl border p-8 shadow-lg",
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}
                >
                  <AnimatePresence mode="wait">
                    {/* Step 1: Select Wallet */}
                    {rechargeStep === 1 && (
                      <motion.div
                        key="step1"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                      >
                        <h3 className={cn("text-xl font-bold mb-4", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          Seleccionar Wallet
                        </h3>
                        <div className="relative mb-4">
                          <Search className={cn("absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                              setSearchQuery(e.target.value)
                              setSelectedWallet(null)
                              searchWallets(e.target.value, setSearchResults)
                            }}
                            placeholder="Buscar por numero, telefono o nombre..."
                            className={cn(
                              "w-full pl-12 pr-4 py-3 rounded-lg border",
                              theme === 'dark'
                                ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500'
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-red-500'
                            )}
                          />
                        </div>
                        {searchResults.length > 0 && !selectedWallet && (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {searchResults.map(w => (
                              <button
                                key={`${w.type}-${w.id}`}
                                onClick={() => {
                                  setSelectedWallet(w)
                                  setSearchQuery(w.name)
                                  setSearchResults([])
                                }}
                                className={cn(
                                  "w-full p-3 text-left rounded-lg border transition-colors",
                                  theme === 'dark' ? 'bg-gray-700 border-gray-600 hover:border-blue-500' : 'bg-gray-50 border-gray-200 hover:border-red-500'
                                )}
                              >
                                <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{w.name}</span>
                                <span className={cn("text-sm ml-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>- {w.balanceFormatted}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {selectedWallet && (
                          <div className={cn(
                            "p-4 rounded-lg border-2 flex justify-between items-center",
                            theme === 'dark' ? 'bg-green-900/20 border-green-500/30' : 'bg-green-50 border-green-200'
                          )}>
                            <div>
                              <p className="font-medium text-green-600">{selectedWallet.name}</p>
                              <p className="text-sm text-green-500">Balance: {selectedWallet.balanceFormatted}</p>
                            </div>
                            <button onClick={() => { setSelectedWallet(null); setSearchQuery('') }} className="p-1 hover:bg-green-100 rounded">
                              <X className="w-5 h-5 text-green-600" />
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Step 2: Amount & Method */}
                    {rechargeStep === 2 && (
                      <motion.div
                        key="step2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                      >
                        <h3 className={cn("text-xl font-bold mb-4", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          Monto y Metodo de Pago
                        </h3>

                        {/* Amount */}
                        <div className="mb-6">
                          <label className={cn("text-sm font-medium block mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>Monto</label>
                          <div className="relative">
                            <span className={cn("absolute left-4 top-1/2 -translate-y-1/2 text-lg", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>$</span>
                            <input
                              type="number"
                              value={rechargeAmount}
                              onChange={(e) => setRechargeAmount(e.target.value)}
                              placeholder="0.00"
                              className={cn(
                                "w-full pl-10 pr-4 py-3 rounded-lg border text-2xl font-bold",
                                theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                              )}
                            />
                          </div>
                          <div className="flex flex-wrap gap-2 mt-3">
                            {quickAmounts.map(amt => (
                              <button
                                key={amt}
                                onClick={() => setRechargeAmount(amt.toString())}
                                className={cn(
                                  "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                                  rechargeAmount === amt.toString()
                                    ? 'text-white border-transparent'
                                    : theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-100 border-gray-200 text-gray-700'
                                )}
                                style={rechargeAmount === amt.toString() ? { backgroundColor: exaBrandBg } : undefined}
                              >
                                ${amt}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Payment Method */}
                        <div className="mb-6">
                          <label className={cn("text-sm font-medium block mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>Metodo de Pago</label>
                          <div className="grid grid-cols-5 gap-2">
                            {paymentMethods.map(method => (
                              <button
                                key={method.id}
                                onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                                className={cn(
                                  "p-3 rounded-lg border-2 text-center transition-all",
                                  paymentMethod === method.id
                                    ? 'border-transparent text-white'
                                    : theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
                                )}
                                style={paymentMethod === method.id ? { backgroundColor: exaBrandBg } : undefined}
                              >
                                <method.icon className={cn(
                                  "w-5 h-5 mx-auto mb-1",
                                  paymentMethod === method.id ? 'text-white' : theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                )} />
                                <p className={cn(
                                  "text-xs",
                                  paymentMethod === method.id ? 'text-white' : theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                )}>{method.label}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Terminal Selector - shown when card_terminal is selected */}
                        {paymentMethod === 'card_terminal' && (
                          <div className="mb-6">
                            <label className={cn("text-sm font-medium block mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                              Terminal de Pago
                            </label>
                            {loadingTerminals ? (
                              <div className="flex items-center gap-2 text-gray-500">
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Cargando terminales...</span>
                              </div>
                            ) : availableTerminals.length === 0 ? (
                              <div className={cn(
                                "p-4 rounded-lg border",
                                theme === 'dark' ? 'bg-yellow-900/20 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200'
                              )}>
                                <p className="text-sm text-yellow-600">
                                  No hay terminales disponibles. Por favor configure un terminal Square primero.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {availableTerminals.map(terminal => (
                                  <button
                                    key={terminal.id}
                                    onClick={() => setSelectedTerminalId(terminal.id)}
                                    className={cn(
                                      "w-full p-3 rounded-lg border-2 text-left transition-all",
                                      selectedTerminalId === terminal.id
                                        ? 'border-green-500 bg-green-500/10'
                                        : theme === 'dark' ? 'bg-gray-700 border-gray-600 hover:border-gray-500' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                                    )}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                          {terminal.name}
                                        </p>
                                        <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                          {terminal.locationName}
                                        </p>
                                      </div>
                                      {selectedTerminalId === terminal.id && (
                                        <Check className="w-5 h-5 text-green-500" />
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* 3% Fee Notice */}
                            {rechargeAmount && parseFloat(rechargeAmount) > 0 && (
                              <div className={cn(
                                "mt-3 p-3 rounded-lg border",
                                theme === 'dark' ? 'bg-blue-900/20 border-blue-500/30' : 'bg-blue-50 border-blue-200'
                              )}>
                                <p className="text-sm text-blue-600 font-medium mb-1">Cargo por procesamiento (3%)</p>
                                <div className="flex justify-between text-sm">
                                  <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>Monto base:</span>
                                  <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>${parseFloat(rechargeAmount).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>Cargo (3%):</span>
                                  <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>${calculateTerminalFee(parseFloat(rechargeAmount)).fee.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm font-bold mt-1 pt-1 border-t border-blue-300/30">
                                  <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>Total a cobrar:</span>
                                  <span className="text-blue-600">${calculateTerminalFee(parseFloat(rechargeAmount)).total.toFixed(2)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Reference */}
                        <div>
                          <label className={cn("text-sm font-medium block mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                            {paymentMethod === 'card_terminal' ? 'Nota' : 'Referencia'} <span className="text-gray-500">(opcional)</span>
                          </label>
                          <input
                            type="text"
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            placeholder={paymentMethod === 'card_terminal' ? 'Nota para el recibo...' : 'Numero de confirmacion...'}
                            className={cn(
                              "w-full px-4 py-3 rounded-lg border",
                              theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                            )}
                          />
                        </div>
                      </motion.div>
                    )}

                    {/* Step 3: Confirm */}
                    {rechargeStep === 3 && (
                      <motion.div
                        key="step3"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                      >
                        {/* Terminal Waiting State */}
                        {terminalPolling ? (
                          <div className="text-center py-8">
                            <div className={cn(
                              "mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6",
                              theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                            )}>
                              <Smartphone className="w-10 h-10 text-blue-500 animate-pulse" />
                            </div>
                            <h3 className={cn("text-xl font-bold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              Esperando Pago en Terminal
                            </h3>
                            <p className={cn("text-sm mb-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                              Por favor complete el pago en el terminal de pago.
                            </p>
                            <div className="flex items-center justify-center gap-2 text-sm text-blue-500">
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>
                                {terminalStatus === 'pending' && 'Iniciando...'}
                                {terminalStatus === 'in_progress' && 'Procesando pago...'}
                                {terminalStatus === 'cancelling' && 'Cancelando...'}
                                {!terminalStatus && 'Conectando con terminal...'}
                              </span>
                            </div>
                            <button
                              onClick={cancelTerminalCheckout}
                              className={cn(
                                "mt-6 px-4 py-2 rounded-lg text-sm font-medium",
                                theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              )}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <>
                            <h3 className={cn("text-xl font-bold mb-4", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              Confirmar Recarga
                            </h3>
                            <div className={cn("p-4 rounded-lg mb-4", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50')}>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className={cn("text-xs uppercase mb-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Wallet</p>
                                  <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{selectedWallet?.name}</p>
                                </div>
                                <div>
                                  <p className={cn("text-xs uppercase mb-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Balance Actual</p>
                                  <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{selectedWallet?.balanceFormatted}</p>
                                </div>
                                <div>
                                  <p className={cn("text-xs uppercase mb-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Monto a Recargar</p>
                                  <p className={cn("text-xl font-bold", brandText)}>${parseFloat(rechargeAmount || '0').toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className={cn("text-xs uppercase mb-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Metodo</p>
                                  <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                    {paymentMethods.find(m => m.id === paymentMethod)?.label}
                                  </p>
                                </div>
                              </div>

                              {/* Terminal Fee Breakdown */}
                              {paymentMethod === 'card_terminal' && rechargeAmount && parseFloat(rechargeAmount) > 0 && (
                                <div className="mt-4 pt-4 border-t border-gray-600">
                                  <p className={cn("text-xs uppercase mb-2", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Desglose de Pago</p>
                                  <div className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                      <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>Monto base:</span>
                                      <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>${parseFloat(rechargeAmount).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>Cargo procesamiento (3%):</span>
                                      <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>${calculateTerminalFee(parseFloat(rechargeAmount)).fee.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold pt-1 border-t border-gray-500">
                                      <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>Total a cobrar:</span>
                                      <span className="text-blue-500">${calculateTerminalFee(parseFloat(rechargeAmount)).total.toFixed(2)}</span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {paymentReference && (
                                <div className="mt-4 pt-4 border-t border-gray-600">
                                  <p className={cn("text-xs uppercase mb-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                                    {paymentMethod === 'card_terminal' ? 'Nota' : 'Referencia'}
                                  </p>
                                  <p className={cn("font-mono text-sm", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>{paymentReference}</p>
                                </div>
                              )}
                            </div>
                            <div className={cn(
                              "p-4 rounded-lg flex items-center gap-3",
                              theme === 'dark' ? 'bg-green-900/20 border border-green-500/30' : 'bg-green-50 border border-green-200'
                            )}>
                              <Check className="w-5 h-5 text-green-500" />
                              <p className="text-sm text-green-600">
                                Nuevo balance: ${((selectedWallet?.balance || 0) + parseFloat(rechargeAmount || '0')).toFixed(2)}
                              </p>
                            </div>

                            {/* Terminal Note */}
                            {paymentMethod === 'card_terminal' && (
                              <div className={cn(
                                "mt-4 p-3 rounded-lg border",
                                theme === 'dark' ? 'bg-blue-900/20 border-blue-500/30' : 'bg-blue-50 border-blue-200'
                              )}>
                                <p className="text-sm text-blue-600">
                                  <Smartphone className="w-4 h-4 inline mr-1" />
                                  Al confirmar, el pago se enviara al terminal. El cliente debera completar el pago con tarjeta y firmar.
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Navigation Buttons - Hidden during terminal polling */}
                {!terminalPolling && (
                  <div className="flex justify-between mt-6">
                    <button
                      onClick={() => rechargeStep > 1 ? setRechargeStep((rechargeStep - 1) as RechargeStep) : null}
                      disabled={rechargeStep === 1 || processing}
                      className={cn(
                        "flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all",
                        (rechargeStep === 1 || processing) ? 'opacity-50 cursor-not-allowed' : '',
                        theme === 'dark' ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                      )}
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Anterior
                    </button>

                    {rechargeStep < 3 ? (
                      <button
                        onClick={() => setRechargeStep((rechargeStep + 1) as RechargeStep)}
                        disabled={rechargeStep === 1 && !selectedWallet || rechargeStep === 2 && (!rechargeAmount || (paymentMethod === 'card_terminal' && !selectedTerminalId))}
                        className={cn(
                          "flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-white transition-all",
                          (rechargeStep === 1 && !selectedWallet || rechargeStep === 2 && (!rechargeAmount || (paymentMethod === 'card_terminal' && !selectedTerminalId))) && 'opacity-50 cursor-not-allowed'
                        )}
                        style={{ backgroundColor: exaBrandBg }}
                      >
                        Siguiente
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={processRecharge}
                        disabled={processing || (paymentMethod === 'card_terminal' && !selectedTerminalId)}
                        className={cn(
                          "flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-white transition-all",
                          paymentMethod === 'card_terminal' ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700",
                          (processing || (paymentMethod === 'card_terminal' && !selectedTerminalId)) && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : paymentMethod === 'card_terminal' ? <Smartphone className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        {processing ? 'Enviando...' : paymentMethod === 'card_terminal' ? 'Enviar a Terminal' : 'Confirmar Recarga'}
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Transfer Tab - Wizard Form */}
            {activeTab === 'transfer' && (
              <motion.div
                key="transfer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-3xl mx-auto pt-16"
              >
                {/* Step Progress */}
                <div className="mb-8">
                  <div className="flex items-center justify-center">
                    {transferSteps.map((step, index) => (
                      <React.Fragment key={step.id}>
                        <div className="flex flex-col items-center">
                          <motion.div
                            animate={{
                              scale: transferStep === step.id ? 1.1 : 1,
                              backgroundColor: transferStep === step.id
                                ? theme === 'dark' ? '#0374e5' : '#cc0a46'
                                : transferStep > step.id
                                ? '#10B981'
                                : theme === 'dark' ? '#374151' : '#E5E7EB'
                            }}
                            className="w-12 h-12 rounded-full flex items-center justify-center"
                          >
                            {transferStep > step.id ? (
                              <Check className="w-6 h-6 text-white" />
                            ) : (
                              <step.icon className={cn(
                                "w-6 h-6",
                                transferStep === step.id ? 'text-white' : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                              )} />
                            )}
                          </motion.div>
                          <p className={cn(
                            "text-xs mt-2 font-medium",
                            transferStep === step.id ? brandText : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          )}>
                            {step.title}
                          </p>
                        </div>
                        {index < transferSteps.length - 1 && (
                          <div className="flex-1 h-0.5 mx-4 relative">
                            <div className={cn("absolute inset-0", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')} />
                            <motion.div
                              animate={{ scaleX: transferStep > step.id ? 1 : 0 }}
                              className="h-full origin-left bg-green-500"
                            />
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Step Content */}
                <motion.div
                  className={cn(
                    "rounded-2xl border p-8 shadow-lg",
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}
                >
                  <AnimatePresence mode="wait">
                    {/* Step 1: Source Wallet */}
                    {transferStep === 1 && (
                      <motion.div key="t-step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                        <h3 className={cn("text-xl font-bold mb-4", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          Wallet Origen
                        </h3>
                        <div className="relative mb-4">
                          <Search className={cn("absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                          <input
                            type="text"
                            value={sourceSearchQuery}
                            onChange={(e) => {
                              setSourceSearchQuery(e.target.value)
                              setTransferSourceWallet(null)
                              searchWallets(e.target.value, setSourceSearchResults)
                            }}
                            placeholder="Buscar wallet origen..."
                            className={cn(
                              "w-full pl-12 pr-4 py-3 rounded-lg border",
                              theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                            )}
                          />
                        </div>
                        {sourceSearchResults.length > 0 && !transferSourceWallet && (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {sourceSearchResults.map(w => (
                              <button
                                key={`src-${w.type}-${w.id}`}
                                onClick={() => {
                                  setTransferSourceWallet(w)
                                  setSourceSearchQuery(w.name)
                                  setSourceSearchResults([])
                                }}
                                className={cn(
                                  "w-full p-3 text-left rounded-lg border",
                                  theme === 'dark' ? 'bg-gray-700 border-gray-600 hover:border-blue-500' : 'bg-gray-50 border-gray-200 hover:border-red-500'
                                )}
                              >
                                <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{w.name}</span>
                                <span className={cn("text-sm ml-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>- {w.balanceFormatted}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {transferSourceWallet && (
                          <div className={cn("p-4 rounded-lg border-2", theme === 'dark' ? 'bg-green-900/20 border-green-500/30' : 'bg-green-50 border-green-200')}>
                            <p className="font-medium text-green-600">{transferSourceWallet.name}</p>
                            <p className="text-sm text-green-500">Balance disponible: {transferSourceWallet.balanceFormatted}</p>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Step 2: Amount */}
                    {transferStep === 2 && (
                      <motion.div key="t-step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                        <h3 className={cn("text-xl font-bold mb-4", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          Monto a Transferir
                        </h3>
                        <div className="relative mb-4">
                          <span className={cn("absolute left-4 top-1/2 -translate-y-1/2 text-lg", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>$</span>
                          <input
                            type="number"
                            value={transferAmount}
                            onChange={(e) => setTransferAmount(e.target.value)}
                            placeholder="0.00"
                            max={transferSourceWallet?.balance}
                            className={cn(
                              "w-full pl-10 pr-4 py-3 rounded-lg border text-2xl font-bold",
                              theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                            )}
                          />
                        </div>
                        <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          Balance disponible: {transferSourceWallet?.balanceFormatted}
                        </p>
                        <div className="mt-4">
                          <label className={cn("text-sm font-medium block mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                            Descripcion <span className="text-gray-500">(opcional)</span>
                          </label>
                          <input
                            type="text"
                            value={transferDescription}
                            onChange={(e) => setTransferDescription(e.target.value)}
                            placeholder="Motivo de la transferencia..."
                            className={cn(
                              "w-full px-4 py-3 rounded-lg border",
                              theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                            )}
                          />
                        </div>
                      </motion.div>
                    )}

                    {/* Step 3: Target Wallet */}
                    {transferStep === 3 && (
                      <motion.div key="t-step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                        <h3 className={cn("text-xl font-bold mb-4", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          Wallet Destino
                        </h3>
                        <div className="relative mb-4">
                          <Search className={cn("absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                          <input
                            type="text"
                            value={targetSearchQuery}
                            onChange={(e) => {
                              setTargetSearchQuery(e.target.value)
                              setTransferTargetWallet(null)
                              searchWallets(e.target.value, setTargetSearchResults)
                            }}
                            placeholder="Buscar wallet destino..."
                            className={cn(
                              "w-full pl-12 pr-4 py-3 rounded-lg border",
                              theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                            )}
                          />
                        </div>
                        {targetSearchResults.length > 0 && !transferTargetWallet && (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {targetSearchResults.filter(w => w.walletNumber !== transferSourceWallet?.walletNumber).map(w => (
                              <button
                                key={`tgt-${w.type}-${w.id}`}
                                onClick={() => {
                                  setTransferTargetWallet(w)
                                  setTargetSearchQuery(w.name)
                                  setTargetSearchResults([])
                                }}
                                className={cn(
                                  "w-full p-3 text-left rounded-lg border",
                                  theme === 'dark' ? 'bg-gray-700 border-gray-600 hover:border-blue-500' : 'bg-gray-50 border-gray-200 hover:border-red-500'
                                )}
                              >
                                <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{w.name}</span>
                                <span className={cn("text-sm ml-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>- {w.balanceFormatted}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {transferTargetWallet && (
                          <div className={cn("p-4 rounded-lg border-2", theme === 'dark' ? 'bg-green-900/20 border-green-500/30' : 'bg-green-50 border-green-200')}>
                            <p className="font-medium text-green-600">{transferTargetWallet.name}</p>
                            <p className="text-sm text-green-500">Balance actual: {transferTargetWallet.balanceFormatted}</p>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Step 4: Confirm */}
                    {transferStep === 4 && (
                      <motion.div key="t-step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                        <h3 className={cn("text-xl font-bold mb-4", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          Confirmar Transferencia
                        </h3>
                        <div className={cn("p-4 rounded-lg mb-4", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50')}>
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className={cn("text-xs uppercase", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>De</p>
                              <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{transferSourceWallet?.name}</p>
                            </div>
                            <ArrowRight className={cn("w-5 h-5", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                            <div className="text-right">
                              <p className={cn("text-xs uppercase", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>A</p>
                              <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{transferTargetWallet?.name}</p>
                            </div>
                          </div>
                          <div className="text-center border-t border-gray-600 pt-4">
                            <p className={cn("text-xs uppercase mb-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Monto</p>
                            <p className={cn("text-3xl font-bold", brandText)}>${parseFloat(transferAmount || '0').toFixed(2)}</p>
                          </div>
                          {transferDescription && (
                            <div className="text-center mt-4 pt-4 border-t border-gray-600">
                              <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>{transferDescription}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Navigation Buttons */}
                <div className="flex justify-between mt-6">
                  <button
                    onClick={() => transferStep > 1 ? setTransferStep((transferStep - 1) as any) : null}
                    disabled={transferStep === 1}
                    className={cn(
                      "flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all",
                      transferStep === 1 ? 'opacity-50 cursor-not-allowed' : '',
                      theme === 'dark' ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                    )}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Anterior
                  </button>

                  {transferStep < 4 ? (
                    <button
                      onClick={() => setTransferStep((transferStep + 1) as any)}
                      disabled={
                        (transferStep === 1 && !transferSourceWallet) ||
                        (transferStep === 2 && !transferAmount) ||
                        (transferStep === 3 && !transferTargetWallet)
                      }
                      className={cn(
                        "flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-white transition-all",
                        ((transferStep === 1 && !transferSourceWallet) || (transferStep === 2 && !transferAmount) || (transferStep === 3 && !transferTargetWallet)) && 'opacity-50 cursor-not-allowed'
                      )}
                      style={{ backgroundColor: exaBrandBg }}
                    >
                      Siguiente
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={processTransfer}
                      disabled={processing}
                      className={cn(
                        "flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-white transition-all",
                        "bg-green-600 hover:bg-green-700",
                        processing && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      {processing ? 'Procesando...' : 'Confirmar Transferencia'}
                    </button>
                  )}
                </div>
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
                  "rounded-xl p-6 border",
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <h3 className={cn("text-lg font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    Historial de Transacciones
                  </h3>

                  {/* Search Box */}
                  <form onSubmit={handleHistorySearch} className="flex gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-initial">
                      <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                      <input
                        type="text"
                        value={historySearchQuery}
                        onChange={(e) => setHistorySearchQuery(e.target.value)}
                        placeholder="Buscar transacciones..."
                        className={cn(
                          "w-full sm:w-64 pl-10 pr-4 py-2 rounded-lg border text-sm",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-500'
                            : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'
                        )}
                      />
                    </div>
                    <button
                      type="submit"
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium text-white",
                        "transition-colors"
                      )}
                      style={{ backgroundColor: exaBrandBg }}
                    >
                      Buscar
                    </button>
                  </form>
                </div>

                {historyLoading ? (
                  <div className="text-center py-12">
                    <RefreshCw className={cn("w-8 h-8 animate-spin mx-auto mb-3", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-12">
                    <History className={cn("w-12 h-12 mx-auto mb-3", theme === 'dark' ? 'text-gray-600' : 'text-gray-300')} />
                    <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      {historySearchQuery ? 'No se encontraron transacciones' : 'No hay transacciones'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full table-fixed">
                        <thead>
                          <tr className={cn("text-left text-xs uppercase", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                            <th className="pb-3 pr-4 w-28 whitespace-nowrap">No. Trans.</th>
                            <th className="pb-3 pr-4 w-24">Tipo</th>
                            <th className="pb-3 pr-6 w-44 text-left">Nombre Wallet</th>
                            <th className="pb-3 pr-6 w-28 text-left">Monto</th>
                            <th className="pb-3 pr-4 w-32 text-left whitespace-nowrap">No. Cuenta</th>
                            <th className="pb-3 pr-4 w-28 whitespace-nowrap">Metodo Pago</th>
                            <th className="pb-3 pr-4 w-28 whitespace-nowrap">Fecha / Hora</th>
                            <th className="pb-3 w-28 text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody className={cn("divide-y", theme === 'dark' ? 'divide-gray-700' : 'divide-gray-100')}>
                          {transactions.map(tx => (
                            <tr key={tx.id} className={cn(theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50')}>
                              <td className={cn("py-3 pr-4 text-sm font-mono truncate", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                                {tx.transactionNumber || tx.id}
                              </td>
                              <td className="py-3 pr-4">
                                <span className={cn(
                                  "px-2 py-1 rounded text-xs font-medium whitespace-nowrap",
                                  tx.type === 'recharge'
                                    ? 'bg-green-100 text-green-700'
                                    : tx.type === 'transfer_in'
                                      ? 'bg-blue-100 text-blue-700'
                                      : tx.type === 'transfer_out'
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-gray-100 text-gray-600'
                                )}>
                                  {tx.typeLabel}
                                </span>
                              </td>
                              <td className={cn("py-3 pr-6 text-sm text-left font-medium truncate", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                {tx.type === 'transfer_out' ? tx.sourceName : tx.targetName}
                              </td>
                              <td className="py-3 pr-6 text-left font-semibold whitespace-nowrap">
                                <span className={tx.type === 'transfer_out' ? 'text-red-500' : 'text-green-500'}>
                                  {tx.type === 'transfer_out' ? '-' : '+'}{tx.amountFormatted}
                                </span>
                              </td>
                              <td className={cn("py-3 pr-4 text-sm font-mono text-left", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                {tx.type === 'transfer_out' ? (tx.sourceWalletNumber || '-') : (tx.targetWalletNumber || '-')}
                              </td>
                              <td className={cn("py-3 pr-4 text-sm whitespace-nowrap", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                {tx.paymentMethodLabel || '-'}
                              </td>
                              <td className={cn("py-3 pr-4 text-sm whitespace-nowrap", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                <div>{new Date(tx.createdAt).toLocaleDateString('es-ES')}</div>
                                <div className="text-xs">{new Date(tx.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
                              </td>
                              <td className="py-3 text-center">
                                <span className={cn(
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs whitespace-nowrap",
                                  tx.status === 'completed' ? 'bg-green-100 text-green-700' : tx.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                )}>
                                  {tx.status === 'completed' ? <Check className="w-3 h-3" /> : tx.status === 'pending' ? <Clock className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                  {tx.status === 'completed' ? 'Completada' : tx.status === 'pending' ? 'Pendiente' : 'Rechazada'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className={cn(
                      "flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 pt-4 border-t",
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        Mostrando {transactions.length} de {historyTotal} transacciones
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleHistoryPageChange(historyPage - 1)}
                          disabled={historyPage <= 1}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                            historyPage <= 1
                              ? 'opacity-50 cursor-not-allowed'
                              : '',
                            theme === 'dark'
                              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          )}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className={cn("text-sm px-3", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          Pagina {historyPage} de {historyTotalPages || 1}
                        </span>
                        <button
                          onClick={() => handleHistoryPageChange(historyPage + 1)}
                          disabled={historyPage >= historyTotalPages}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                            historyPage >= historyTotalPages
                              ? 'opacity-50 cursor-not-allowed'
                              : '',
                            theme === 'dark'
                              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          )}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* Pending Tab */}
            {activeTab === 'pending' && (
              <motion.div
                key="pending"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <div className="flex justify-between items-center">
                  <h3 className={cn("text-lg font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    Solicitudes Pendientes
                  </h3>
                  <button
                    onClick={fetchPendingRequests}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg",
                      theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    )}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Actualizar
                  </button>
                </div>

                {pendingLoading ? (
                  <div className="text-center py-12">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-500" />
                  </div>
                ) : pendingRequests.length === 0 ? (
                  <div className={cn(
                    "rounded-xl p-12 text-center border",
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}>
                    <Check className={cn("w-12 h-12 mx-auto mb-3", theme === 'dark' ? 'text-green-400' : 'text-green-500')} />
                    <p className={cn("text-lg font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      No hay solicitudes pendientes
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {pendingRequests.map(request => (
                      <div
                        key={request.id}
                        className={cn(
                          "rounded-xl p-5 border",
                          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                        )}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {request.walletName}
                            </p>
                            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                              {request.paymentMethodLabel} - {new Date(request.createdAt).toLocaleDateString('es-ES')}
                            </p>
                          </div>
                          <p className={cn("text-2xl font-bold", brandText)}>
                            {request.amountFormatted}
                          </p>
                        </div>

                        <div className={cn("grid grid-cols-2 gap-3 p-3 rounded-lg mb-4", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50')}>
                          <div>
                            <p className={cn("text-xs uppercase", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Wallet</p>
                            <p className={cn("font-mono text-sm", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>{request.walletNumber}</p>
                          </div>
                          <div>
                            <p className={cn("text-xs uppercase", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Solicitado por</p>
                            <p className={cn("text-sm", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{request.requestedBy}</p>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={() => processRequest(request.id, 'approve')}
                            className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                          >
                            <Check className="w-4 h-4" />
                            Aprobar
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt('Motivo del rechazo:')
                              if (reason) processRequest(request.id, 'reject', reason)
                            }}
                            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                          >
                            <X className="w-4 h-4" />
                            Rechazar
                          </button>
                        </div>
                      </div>
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
