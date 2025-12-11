'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Wallet,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Clock,
  Check,
  X,
  CreditCard,
  Smartphone,
  Banknote,
  Building,
  DollarSign,
  ArrowRight,
  History,
  ChevronRight,
  AlertCircle,
  ArrowLeft,
  Users,
  FileText,
  User,
  Calendar,
  Filter,
  Download,
  ExternalLink,
  Receipt
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import { cn } from '@/lib/utils'
import { AnimatedNumber } from '@/components/ui/animated-counter'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { VirtualCard } from '@/components/wallet/VirtualCard'
import StripeCardForm from '@/components/wallet/StripeCardForm'
import { PaymentReceiptStep, PaymentReceiptData } from '@/components/wallet/PaymentReceiptStep'
import CashoutModal from '@/components/wallet/CashoutModal'
import StripeConnectStatus from '@/components/wallet/StripeConnectStatus'
import PasswordConfirmDialog from '@/components/ui/PasswordConfirmDialog'

type Tab = 'statement' | 'recharge' | 'transfer' | 'pending'
type PaymentMethod = 'card_manual' | 'cash' | 'wire' | 'zelle'

interface CompanyWallet {
  id: number
  name: string
  walletNumber: string
  balance: number
  balanceFormatted: string
  dailyLimit: number
  monthlyLimit: number
  dailyUsed?: number
  monthlyUsed?: number
  creditLimit: number
  creditLimitFormatted: string
  creditEnabled: boolean
  availableCredit: number
  availableCreditFormatted: string
  isNegative: boolean
  daysInNegative: number
  phone?: string
  email?: string
  logo?: string
  currency: string
  status: string
  type: 'company'
}

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

interface Transaction {
  id: number
  transactionNumber?: string
  type: string
  typeLabel: string
  sourceType?: string
  targetType?: string
  amount: number
  amountFormatted: string
  displayAmount?: number
  fee?: number
  totalCharged?: number
  netAmount?: number
  paymentMethod?: string
  paymentMethodLabel?: string
  paymentReference?: string
  cardBrand?: string
  cardLast4?: string
  receiptUrl?: string | null
  stripePaymentIntentId?: string
  status: string
  description?: string
  createdAt: string
  completedAt?: string
  isOutgoing?: boolean
  isIncoming?: boolean
  targetName?: string
  sourceName?: string
}

interface PendingRequest {
  id: number
  walletName: string
  walletNumber: string
  walletType: string
  amount: number
  amountFormatted: string
  paymentMethod: string
  paymentMethodLabel: string
  paymentReference?: string
  requestedBy: string
  requestedByEmail?: string
  createdAt: string
  status: string
}

interface Stats {
  rechargesReceived: { value: number; formatted: string; count: number }
  rechargesMade: { value: number; formatted: string; count: number }
  transfersOut: { value: number; formatted: string; count: number }
  transfersIn: { value: number; formatted: string; count: number }
}

const paymentMethods = [
  { id: 'card_manual', label: 'Tarjeta', icon: CreditCard, instant: true },
  { id: 'cash', label: 'Efectivo', icon: Banknote, instant: false, requiresApproval: true },
  { id: 'wire', label: 'Wire', icon: Building, instant: false, requiresApproval: true },
  { id: 'zelle', label: 'Zelle', icon: DollarSign, instant: false, requiresApproval: true },
]

const quickAmounts = [50, 100, 250, 500, 1000]

export default function CompanyWalletPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') as Tab | null

  // Brand colors
  const exaBrandBg = theme === 'dark' ? '#0374e5' : '#cc0a46'
  const brandText = theme === 'dark' ? 'text-blue-500' : 'text-red-500'

  const [activeTab, setActiveTab] = useState<Tab>(tabParam || 'statement')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Password verification state
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(true)

  // Dashboard data
  const [companyWallet, setCompanyWallet] = useState<CompanyWallet | null>(null)
  const [users, setUsers] = useState<WalletEntity[]>([])
  const [customers, setCustomers] = useState<WalletEntity[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0)

  // Recharge wizard
  const [rechargeStep, setRechargeStep] = useState<1 | 2 | 3>(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedWallet, setSelectedWallet] = useState<WalletEntity | null>(null)
  const [rechargeAmount, setRechargeAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card_manual')
  const [paymentReference, setPaymentReference] = useState('')
  const [processing, setProcessing] = useState(false)

  // Receipt step state
  const [showReceiptStep, setShowReceiptStep] = useState(false)
  const [receiptData, setReceiptData] = useState<PaymentReceiptData | null>(null)

  // Stripe payment state
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null)
  const [stripePaymentData, setStripePaymentData] = useState<{
    paymentIntentId: string
    amount: number
    fee: number
    totalCharged: number
  } | null>(null)
  const [creatingPaymentIntent, setCreatingPaymentIntent] = useState(false)

  // Transfer wizard
  const [transferStep, setTransferStep] = useState<1 | 2 | 3>(1)
  const [transferTargetWallet, setTransferTargetWallet] = useState<WalletEntity | null>(null)
  const [transferAmount, setTransferAmount] = useState('')
  const [transferDescription, setTransferDescription] = useState('')
  const [targetSearchQuery, setTargetSearchQuery] = useState('')
  const [targetSearchResults, setTargetSearchResults] = useState<WalletEntity[]>([])
  const [searchingTarget, setSearchingTarget] = useState(false)

  // Pending requests
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)

  // Cashout modal state
  const [showCashoutModal, setShowCashoutModal] = useState(false)
  const [connectStatus, setConnectStatus] = useState<'not_connected' | 'pending' | 'active' | 'restricted'>('not_connected')
  const [connectLoading, setConnectLoading] = useState(false)
  const [externalAccounts, setExternalAccounts] = useState<Array<{
    id: string
    type: string
    last4: string
    bankName: string
    currency: string
    default: boolean
  }>>([])

  // Transaction details modal state
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [showTransactionDetails, setShowTransactionDetails] = useState(false)

  // Tabs configuration
  const tabs = [
    { id: 'statement', label: 'Estado de Cuenta', icon: History },
    { id: 'recharge', label: 'Recargar', icon: ArrowDownRight },
    { id: 'transfer', label: 'Transferir', icon: ArrowUpRight },
    { id: 'pending', label: 'Solicitudes', icon: Clock, badge: pendingRequestsCount },
  ]

  // Chart colors for payment methods
  const CHART_COLORS = {
    card_manual: '#3B82F6',  // blue
    terminal: '#8B5CF6',     // purple
    cash: '#10B981',         // green
    wire: '#F59E0B',         // amber
    zelle: '#EC4899',        // pink
  }

  // Calculate recharges by payment method from transactions
  const rechargesByMethod = useMemo(() => {
    const methodCounts: Record<string, { count: number; amount: number; label: string }> = {
      card_manual: { count: 0, amount: 0, label: 'Tarjeta' },
      terminal: { count: 0, amount: 0, label: 'Terminal' },
      cash: { count: 0, amount: 0, label: 'Efectivo' },
      wire: { count: 0, amount: 0, label: 'Wire' },
      zelle: { count: 0, amount: 0, label: 'Zelle' },
    }

    transactions.forEach(tx => {
      if (tx.type === 'recharge' && tx.paymentMethod) {
        const method = tx.paymentMethod
        if (methodCounts[method]) {
          methodCounts[method].count += 1
          methodCounts[method].amount += tx.amount
        }
      }
    })

    return Object.entries(methodCounts)
      .filter(([_, data]) => data.count > 0)
      .map(([method, data]) => ({
        name: data.label,
        value: data.count,
        amount: data.amount,
        color: CHART_COLORS[method as keyof typeof CHART_COLORS] || '#6B7280'
      }))
  }, [transactions])

  // Handle tab change
  const handleTabChange = (tabId: Tab) => {
    setActiveTab(tabId)
    router.push(`/dashboard/admin/company-wallet?tab=${tabId}`, { scroll: false })
  }

  // Fetch company dashboard data
  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/wallet/company-dashboard')
      const data = await response.json()
      if (data.success) {
        setCompanyWallet(data.data.companyWallet)
        setUsers(data.data.users || [])
        setCustomers(data.data.customers || [])
        setTransactions(data.data.transactions || [])
        setStats(data.data.stats)
        setPendingRequestsCount(data.data.pendingRequests || 0)
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Error al cargar el dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch pending requests with useCallback to avoid stale closures
  const fetchPendingRequests = useCallback(async () => {
    try {
      setPendingLoading(true)
      const response = await fetch('/api/wallet/recharge-requests?status=all')
      const data = await response.json()
      if (data.success) {
        setPendingRequests(data.data.requests || [])
      }
    } catch (err) {
      console.error('Error fetching pending requests:', err)
    } finally {
      setPendingLoading(false)
    }
  }, [])

  // Search wallets (for transfers - any wallet in the system)
  const searchWallets = async (query: string) => {
    if (query.length < 2) {
      setTargetSearchResults([])
      return
    }
    try {
      setSearchingTarget(true)
      const response = await fetch(`/api/wallet/search?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      if (data.success) {
        setTargetSearchResults(data.data.results || [])
      }
    } catch (err) {
      console.error('Error searching:', err)
    } finally {
      setSearchingTarget(false)
    }
  }

  // Load data on mount
  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  // Load pending requests when tab changes
  useEffect(() => {
    if (activeTab === 'pending') {
      fetchPendingRequests()
    }
  }, [activeTab, fetchPendingRequests])

  // Auto-update pending requests every 10 seconds when on pending tab
  useEffect(() => {
    if (activeTab !== 'pending') return

    const interval = setInterval(() => {
      fetchPendingRequests()
    }, 10000) // 10 seconds

    return () => clearInterval(interval)
  }, [activeTab, fetchPendingRequests])

  // Auto-update company wallet data every 30 seconds when on statement tab
  // This ensures limits and balance are updated if changed by SUPER_ADMIN
  useEffect(() => {
    if (activeTab !== 'statement') return

    const interval = setInterval(() => {
      fetchDashboard()
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [activeTab, fetchDashboard])

  // Reset recharge form
  const resetRechargeForm = () => {
    setRechargeAmount('')
    setPaymentReference('')
    setSelectedWallet(null)
    setSearchQuery('')
    setRechargeStep(1)
    // Reset Stripe state
    setStripeClientSecret(null)
    setStripePaymentData(null)
  }

  // Create Stripe PaymentIntent for card recharge
  const createStripePaymentIntent = async () => {
    if (!selectedWallet || !rechargeAmount || parseFloat(rechargeAmount) <= 0) return

    setCreatingPaymentIntent(true)
    try {
      const response = await fetch('/api/wallet/recharge/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: selectedWallet.type,
          targetId: selectedWallet.id,
          amount: parseFloat(rechargeAmount)
        })
      })

      const data = await response.json()
      if (data.success) {
        setStripeClientSecret(data.data.clientSecret)
        setStripePaymentData({
          paymentIntentId: data.data.paymentIntentId,
          amount: data.data.amount,
          fee: data.data.fee,
          totalCharged: data.data.totalCharged
        })
      } else {
        showNotification('error', 'Error', data.error || 'Error al crear el intento de pago')
      }
    } catch (err) {
      showNotification('error', 'Error', 'Error al conectar con el servidor')
    } finally {
      setCreatingPaymentIntent(false)
    }
  }

  // Reset transfer form
  const resetTransferForm = () => {
    setTransferAmount('')
    setTransferDescription('')
    setTransferTargetWallet(null)
    setTargetSearchQuery('')
    setTargetSearchResults([])
    setTransferStep(1)
  }

  // Filter users and customers based on search (only show when searching)
  const filteredEntities = searchQuery.length >= 2
    ? [...users, ...customers].filter(entity => {
        const query = searchQuery.toLowerCase()
        return (
          entity.name.toLowerCase().includes(query) ||
          entity.walletNumber?.toLowerCase().includes(query) ||
          entity.phone?.toLowerCase().includes(query)
        )
      })
    : []

  // Process recharge (for cash, wire, zelle methods)
  const processRecharge = async () => {
    if (!selectedWallet || !rechargeAmount) return

    setProcessing(true)
    try {
      if (['cash', 'wire', 'zelle'].includes(paymentMethod)) {
        const response = await fetch('/api/wallet/recharge-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetWalletNumber: selectedWallet.walletNumber,
            targetType: selectedWallet.type,
            amount: parseFloat(rechargeAmount),
            paymentMethod,
            paymentReference
          })
        })

        const data = await response.json()
        if (data.success) {
          showNotification('success', 'Solicitud Creada', 'Su solicitud esta pendiente de aprobacion')
          resetRechargeForm()
          fetchDashboard()
        } else {
          showNotification('error', 'Error', data.error)
        }
      }
    } catch (err) {
      showNotification('error', 'Error', 'Error al procesar la recarga')
    } finally {
      setProcessing(false)
    }
  }

  // Handle Stripe card payment success - calls confirm API to credit wallet
  const handleCardPaymentSuccess = async (paymentResult: { id: string; status: string }) => {
    if (!selectedWallet || !stripePaymentData) return

    setProcessing(true)
    try {
      // Call confirm API to credit the wallet
      const response = await fetch('/api/wallet/recharge/stripe/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIntentId: paymentResult.id,
          targetType: selectedWallet.type,
          targetId: selectedWallet.id
        })
      })

      const data = await response.json()
      if (data.success) {
        // Update companyWallet balance immediately
        if (companyWallet) {
          setCompanyWallet({
            ...companyWallet,
            balance: data.data.newBalance,
            balanceFormatted: `$${data.data.newBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          })
        }

        setReceiptData({
          transactionNumber: data.data.transactionNumber,
          amount: data.data.amount,
          fee: data.data.fee,
          totalCharged: data.data.totalCharged,
          newBalance: data.data.newBalance,
          cardBrand: data.data.cardBrand,
          cardLast4: data.data.cardLast4,
          recipientName: selectedWallet?.name || '',
          recipientPhone: selectedWallet?.phone || null,
          walletNumber: selectedWallet?.walletNumber || '',
          paymentDate: new Date()
        })

        setShowReceiptStep(true)
        fetchDashboard() // Also refresh to get updated transactions
      } else {
        showNotification('error', 'Error', data.error || 'Error al confirmar el pago')
      }
    } catch (err) {
      showNotification('error', 'Error', 'Error al confirmar el pago')
    } finally {
      setProcessing(false)
    }
  }

  // Handle closing receipt step
  const handleCloseReceipt = () => {
    setShowReceiptStep(false)
    setReceiptData(null)
    resetRechargeForm()
  }

  // Process transfer
  const processTransfer = async () => {
    if (!companyWallet || !transferTargetWallet || !transferAmount) return

    setProcessing(true)
    try {
      const response = await fetch('/api/wallet/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceWalletNumber: companyWallet.walletNumber,
          sourceType: 'company',
          targetWalletNumber: transferTargetWallet.walletNumber,
          targetType: transferTargetWallet.type,
          amount: parseFloat(transferAmount),
          description: transferDescription
        })
      })

      const data = await response.json()
      if (data.success) {
        // Update companyWallet balance immediately from API response
        if (data.data?.source && companyWallet) {
          setCompanyWallet({
            ...companyWallet,
            balance: data.data.source.newBalance,
            balanceFormatted: data.data.source.newBalanceFormatted
          })
        }
        showNotification('success', 'Transferencia Exitosa', `Se han transferido $${transferAmount}`)
        resetTransferForm()
        fetchDashboard() // Also refresh to get updated transactions
      } else {
        showNotification('error', 'Error', data.error)
      }
    } catch (err) {
      showNotification('error', 'Error', 'Error al procesar la transferencia')
    } finally {
      setProcessing(false)
    }
  }

  // Initiate Stripe Connect onboarding
  const initiateStripeConnect = async () => {
    if (!companyWallet) return

    try {
      setConnectLoading(true)

      const response = await fetch('/api/stripe/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'company',
          entityId: companyWallet.id
        })
      })

      const data = await response.json()

      if (data.success && data.data.onboardingUrl) {
        // Redirect to Stripe onboarding
        window.location.href = data.data.onboardingUrl
      } else {
        showNotification('error', 'Error', data.error || 'Error al iniciar el proceso de conexion')
        setConnectLoading(false)
      }
    } catch (err) {
      showNotification('error', 'Error', 'Error de conexion al iniciar el proceso')
      setConnectLoading(false)
    }
  }

  // Password verification dialog (shown as overlay, not blocking layout)
  // The dialog will be rendered at the end of the main return

  if (error && !companyWallet) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <p className="text-lg text-gray-600 dark:text-gray-400">{error}</p>
          <button
            onClick={() => fetchDashboard()}
            className="px-4 py-2 text-white rounded-lg"
            style={{ backgroundColor: exaBrandBg }}
          >
            Reintentar
          </button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className={cn(
        "min-h-screen pt-6 pb-20 px-4 sm:px-6 lg:px-8",
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Tab Bar - Same style as SUPER_ADMIN */}
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
                onClick={() => handleTabChange(tab.id as Tab)}
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
            {/* Statement Tab */}
            {activeTab === 'statement' && (
              <motion.div
                key="statement"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Stats Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <div key={i} className={cn(
                        "rounded-xl p-5 animate-pulse",
                        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                      )}>
                        <div className={cn("h-4 rounded w-1/2 mb-3", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')} />
                        <div className={cn("h-8 rounded w-2/3", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')} />
                      </div>
                    ))
                  ) : companyWallet && (
                    <>
                      {/* Balance */}
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
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Balance</p>
                        </div>
                        <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          $<AnimatedNumber value={companyWallet.balance} decimals={2} />
                        </p>
                        <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                          {companyWallet.name}
                        </p>
                      </motion.div>

                      {/* Recibido */}
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
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Recibido</p>
                        </div>
                        <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          $<AnimatedNumber value={stats?.rechargesReceived.value || 0} decimals={2} />
                        </p>
                        <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                          {stats?.rechargesReceived.count || 0} transacciones
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
                          $<AnimatedNumber value={stats?.rechargesMade.value || 0} decimals={2} />
                        </p>
                        <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                          {stats?.rechargesMade.count || 0} transacciones
                        </p>
                      </motion.div>

                      {/* Usuarios */}
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
                          <Users className="w-5 h-5 text-blue-500" />
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Usuarios</p>
                        </div>
                        <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          <AnimatedNumber value={users.length} decimals={0} />
                        </p>
                        <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                          registrados
                        </p>
                      </motion.div>

                      {/* Clientes */}
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
                          <User className="w-5 h-5 text-purple-500" />
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Clientes</p>
                        </div>
                        <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          <AnimatedNumber value={customers.length} decimals={0} />
                        </p>
                        <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                          en el sistema
                        </p>
                      </motion.div>
                    </>
                  )}
                </div>

                {/* Virtual Card (Left) + Limits Cards (Right) - All in one row */}
                {companyWallet && (
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
                    {/* Virtual Card - Left Side (2.5 columns visually - rectangular) */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3, type: 'spring', stiffness: 100 }}
                      className="lg:col-span-2"
                    >
                      <VirtualCard
                        key={`card-${companyWallet.balance}`}
                        walletNumber={companyWallet.walletNumber}
                        balance={companyWallet.balance}
                        balanceFormatted={companyWallet.balanceFormatted}
                        name={companyWallet.name}
                        type="company"
                        status={companyWallet.status}
                        logo={companyWallet.logo}
                        creditLimit={companyWallet.creditLimit}
                        creditEnabled={companyWallet.creditEnabled}
                        availableCredit={companyWallet.availableCredit}
                        dailyLimit={companyWallet.dailyLimit}
                        monthlyLimit={companyWallet.monthlyLimit}
                        dailyUsed={companyWallet.dailyUsed}
                        monthlyUsed={companyWallet.monthlyUsed}
                        daysInNegative={companyWallet.daysInNegative}
                        phone={companyWallet.phone}
                        email={companyWallet.email}
                        onCashout={() => setShowCashoutModal(true)}
                      />
                    </motion.div>

                    {/* Daily Limit Card - 1 column */}
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 }}
                      className={cn(
                        "rounded-xl p-4 border h-full",
                        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/30">
                          <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className={cn("text-sm font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            Limite Diario
                          </h3>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-baseline">
                          <span className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Usado</span>
                          <span className={cn("text-sm font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            ${(companyWallet.dailyUsed || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Limite</span>
                          <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                            {companyWallet.dailyLimit > 0
                              ? `$${companyWallet.dailyLimit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                              : 'Sin limite'}
                          </span>
                        </div>
                        {companyWallet.dailyLimit > 0 && (
                          <>
                            <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  ((companyWallet.dailyUsed || 0) / companyWallet.dailyLimit) >= 0.9
                                    ? 'bg-red-500'
                                    : ((companyWallet.dailyUsed || 0) / companyWallet.dailyLimit) >= 0.7
                                      ? 'bg-yellow-500'
                                      : 'bg-green-500'
                                )}
                                style={{ width: `${Math.min(100, ((companyWallet.dailyUsed || 0) / companyWallet.dailyLimit) * 100)}%` }}
                              />
                            </div>
                            <div className="flex justify-between items-baseline">
                              <span className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Disponible</span>
                              <span className="text-sm font-bold text-green-600 dark:text-green-400">
                                ${Math.max(0, companyWallet.dailyLimit - (companyWallet.dailyUsed || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </motion.div>

                    {/* Monthly Limit Card - 1 column */}
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 }}
                      className={cn(
                        "rounded-xl p-4 border h-full",
                        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-purple-100 dark:bg-purple-900/30">
                          <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <h3 className={cn("text-sm font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            Limite Mensual
                          </h3>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-baseline">
                          <span className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Usado</span>
                          <span className={cn("text-sm font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            ${(companyWallet.monthlyUsed || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Limite</span>
                          <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                            {companyWallet.monthlyLimit > 0
                              ? `$${companyWallet.monthlyLimit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                              : 'Sin limite'}
                          </span>
                        </div>
                        {companyWallet.monthlyLimit > 0 && (
                          <>
                            <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  ((companyWallet.monthlyUsed || 0) / companyWallet.monthlyLimit) >= 0.9
                                    ? 'bg-red-500'
                                    : ((companyWallet.monthlyUsed || 0) / companyWallet.monthlyLimit) >= 0.7
                                      ? 'bg-yellow-500'
                                      : 'bg-green-500'
                                )}
                                style={{ width: `${Math.min(100, ((companyWallet.monthlyUsed || 0) / companyWallet.monthlyLimit) * 100)}%` }}
                              />
                            </div>
                            <div className="flex justify-between items-baseline">
                              <span className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Disponible</span>
                              <span className="text-sm font-bold text-green-600 dark:text-green-400">
                                ${Math.max(0, companyWallet.monthlyLimit - (companyWallet.monthlyUsed || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </motion.div>
                  </div>
                )}

                {/* Transaction History (Statement) - Full Width Below */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className={cn(
                    "rounded-xl p-6 border",
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}
                >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className={cn("text-lg font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        Estado de Cuenta
                      </h3>
                      <button
                        onClick={() => fetchDashboard()}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors",
                          theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                        )}
                      >
                        <RefreshCw className={cn("w-4 h-4", loading && 'animate-spin')} />
                        Actualizar
                      </button>
                    </div>

                    {loading ? (
                      <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className={cn(
                            "h-16 rounded-lg animate-pulse",
                            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                          )} />
                        ))}
                      </div>
                    ) : transactions.length === 0 ? (
                      <div className="text-center py-12">
                        <History className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">No hay transacciones</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {transactions.map((tx) => (
                          <div
                            key={tx.id}
                            onClick={() => {
                              setSelectedTransaction(tx)
                              setShowTransactionDetails(true)
                            }}
                            className={cn(
                              "flex items-center justify-between p-4 rounded-lg transition-colors cursor-pointer",
                              theme === 'dark' ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'
                            )}
                          >
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                'w-10 h-10 rounded-full flex items-center justify-center',
                                tx.isOutgoing ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'
                              )}>
                                {tx.isOutgoing ? (
                                  <ArrowUpRight className="w-5 h-5 text-red-600 dark:text-red-400" />
                                ) : (
                                  <ArrowDownRight className="w-5 h-5 text-green-600 dark:text-green-400" />
                                )}
                              </div>
                              <div>
                                <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                  {tx.description || tx.typeLabel}
                                </p>
                                <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                  {new Date(tx.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  {tx.paymentMethodLabel && ` • ${tx.paymentMethodLabel}`}
                                  {tx.cardLast4 && ` • ****${tx.cardLast4}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className={cn(
                                  'font-semibold',
                                  (tx.displayAmount || 0) < 0 ? 'text-red-600' : 'text-green-600'
                                )}>
                                  {(tx.displayAmount || 0) >= 0 ? '+' : ''}{tx.amountFormatted}
                                </p>
                                <p className={cn(
                                  'text-xs',
                                  tx.status === 'completed' ? 'text-green-500' : 'text-yellow-500'
                                )}>
                                  {tx.status === 'completed' ? 'Completada' : 'Pendiente'}
                                </p>
                              </div>
                              <ChevronRight className={cn("w-4 h-4", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
              </motion.div>
            )}

            {/* Recharge Tab */}
            {activeTab === 'recharge' && (
              <motion.div
                key="recharge"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={cn(
                  "rounded-xl p-6 border",
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                <div className="max-w-2xl mx-auto">
                  {/* Wizard Steps */}
                  <div className="flex items-center justify-center mb-8">
                    {[1, 2, 3].map((step, index) => (
                      <React.Fragment key={step}>
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                          rechargeStep >= step
                            ? 'text-white'
                            : theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                        )}
                          style={rechargeStep >= step ? { backgroundColor: exaBrandBg } : {}}
                        >
                          {step}
                        </div>
                        {index < 2 && (
                          <div className={cn(
                            'w-16 h-1 mx-2 rounded',
                            rechargeStep > step ? '' : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                          )}
                            style={rechargeStep > step ? { backgroundColor: exaBrandBg } : {}}
                          />
                        )}
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Step 1: Select Wallet */}
                  {rechargeStep === 1 && (
                    <div className="space-y-4">
                      <h3 className={cn("text-lg font-semibold text-center", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        Seleccionar Wallet Destino
                      </h3>

                      {/* Quick Select: Company Wallet */}
                      <div
                        onClick={() => {
                          if (companyWallet) {
                            setSelectedWallet({
                              id: companyWallet.id,
                              name: companyWallet.name,
                              walletNumber: companyWallet.walletNumber,
                              balance: companyWallet.balance,
                              balanceFormatted: companyWallet.balanceFormatted,
                              phone: companyWallet.phone,
                              email: companyWallet.email,
                              type: 'company'
                            })
                            setRechargeStep(2)
                          }
                        }}
                        className={cn(
                          "p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                          theme === 'dark' ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: exaBrandBg + '20' }}
                          >
                            <Building className="w-5 h-5" style={{ color: exaBrandBg }} />
                          </div>
                          <div className="flex-1">
                            <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{companyWallet?.name}</p>
                            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Mi Empresa • {companyWallet?.walletNumber}</p>
                          </div>
                          <p className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{companyWallet?.balanceFormatted}</p>
                        </div>
                      </div>

                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Buscar usuario..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className={cn(
                            "w-full pl-10 pr-4 py-3 rounded-lg border focus:ring-2 focus:ring-offset-0",
                            theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                          )}
                        />
                      </div>

                      {/* Entity List */}
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {filteredEntities.length === 0 && (
                          <div className="text-center py-8">
                            <Search className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                              {searchQuery.length < 2 ? 'Escribe al menos 2 caracteres para buscar usuarios' : 'No se encontraron usuarios'}
                            </p>
                          </div>
                        )}
                        {filteredEntities.map((entity) => (
                          <div
                            key={`${entity.type}_${entity.id}`}
                            onClick={() => {
                              setSelectedWallet(entity)
                              setRechargeStep(2)
                            }}
                            className={cn(
                              "p-3 rounded-lg border cursor-pointer transition-colors",
                              theme === 'dark' ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium',
                                  entity.type === 'user' ? 'bg-blue-500' : 'bg-purple-500'
                                )}>
                                  {entity.name.charAt(0)}
                                </div>
                                <div>
                                  <p className={cn("font-medium text-sm", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{entity.name}</p>
                                  <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                    {entity.type === 'user' ? 'Usuario' : 'Cliente'} • {entity.walletNumber}
                                  </p>
                                </div>
                              </div>
                              <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>{entity.balanceFormatted}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 2: Amount and Payment Method */}
                  {rechargeStep === 2 && selectedWallet && (
                    <div className="space-y-6">
                      <button
                        onClick={() => setRechargeStep(1)}
                        className={cn("flex items-center gap-2", theme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700')}
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Cambiar wallet
                      </button>

                      {/* Selected Wallet */}
                      <div className="p-4 rounded-lg" style={{ backgroundColor: exaBrandBg + '10' }}>
                        <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Recargar a:</p>
                        <p className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{selectedWallet.name}</p>
                        <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>{selectedWallet.walletNumber}</p>
                      </div>

                      {/* Amount */}
                      <div>
                        <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          Monto
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <input
                            type="number"
                            value={rechargeAmount}
                            onChange={(e) => setRechargeAmount(e.target.value)}
                            placeholder="0.00"
                            className={cn(
                              "w-full pl-8 pr-4 py-3 rounded-lg border text-2xl font-semibold",
                              theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                            )}
                          />
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {quickAmounts.map((amt) => (
                            <button
                              key={amt}
                              onClick={() => setRechargeAmount(amt.toString())}
                              className={cn(
                                "px-3 py-1 text-sm rounded-full border transition-colors",
                                theme === 'dark' ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'
                              )}
                            >
                              ${amt}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Payment Method */}
                      <div>
                        <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          Metodo de Pago
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {paymentMethods.map((method) => (
                            <button
                              key={method.id}
                              onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                              className={cn(
                                'p-3 rounded-lg border-2 transition-colors flex flex-col items-center gap-2',
                                paymentMethod === method.id
                                  ? 'border-current'
                                  : theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                              )}
                              style={paymentMethod === method.id ? { borderColor: exaBrandBg, color: exaBrandBg } : {}}
                            >
                              <method.icon className="w-5 h-5" />
                              <span className="text-xs font-medium">{method.label}</span>
                              {method.requiresApproval && (
                                <span className="text-[10px] text-yellow-600 dark:text-yellow-400">Requiere Aprobacion</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Payment Reference for manual methods */}
                      {['cash', 'wire', 'zelle'].includes(paymentMethod) && (
                        <div>
                          <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                            Referencia de Pago
                          </label>
                          <input
                            type="text"
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            placeholder="Numero de confirmacion, etc."
                            className={cn(
                              "w-full px-4 py-3 rounded-lg border",
                              theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                            )}
                          />
                        </div>
                      )}

                      {/* Card Payment Form - shown when card_manual is selected */}
                      {paymentMethod === 'card_manual' && selectedWallet && rechargeAmount && parseFloat(rechargeAmount) > 0 && (
                        <div className="mb-6">
                          {/* If no client secret yet, show button to initialize payment */}
                          {!stripeClientSecret ? (
                            <button
                              onClick={createStripePaymentIntent}
                              disabled={creatingPaymentIntent}
                              className="w-full py-3 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                              style={{ backgroundColor: exaBrandBg }}
                            >
                              {creatingPaymentIntent ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  Preparando pago...
                                </>
                              ) : (
                                <>
                                  <CreditCard className="w-4 h-4" />
                                  Pagar ${parseFloat(rechargeAmount).toFixed(2)} con Tarjeta
                                </>
                              )}
                            </button>
                          ) : stripePaymentData && (
                            /* Show Stripe payment form once we have the client secret */
                            <StripeCardForm
                              clientSecret={stripeClientSecret}
                              amount={stripePaymentData.amount}
                              fee={stripePaymentData.fee}
                              totalCharged={stripePaymentData.totalCharged}
                              targetName={selectedWallet.name}
                              walletNumber={selectedWallet.walletNumber}
                              onSuccess={handleCardPaymentSuccess}
                              onError={(err) => showNotification('error', 'Error de Pago', err)}
                              onCancel={() => {
                                setStripeClientSecret(null)
                                setStripePaymentData(null)
                              }}
                            />
                          )}
                        </div>
                      )}

                      {/* Continue Button - only for non-card methods */}
                      {paymentMethod !== 'card_manual' && (
                        <button
                          onClick={() => {
                            if (parseFloat(rechargeAmount) > 0) {
                              setRechargeStep(3)
                            }
                          }}
                          disabled={!rechargeAmount || parseFloat(rechargeAmount) <= 0}
                          className="w-full py-3 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ backgroundColor: exaBrandBg }}
                        >
                          Continuar
                        </button>
                      )}
                    </div>
                  )}

                  {/* Step 3: Confirmation */}
                  {rechargeStep === 3 && selectedWallet && (
                    <div className="space-y-6">
                      <button
                        onClick={() => setRechargeStep(2)}
                        className={cn("flex items-center gap-2", theme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700')}
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Volver
                      </button>

                      <h3 className={cn("text-lg font-semibold text-center", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        Confirmar Recarga
                      </h3>

                      {/* Summary */}
                      <div className={cn("p-4 rounded-lg space-y-3", theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50')}>
                        <div className="flex justify-between">
                          <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Destino:</span>
                          <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{selectedWallet.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Wallet:</span>
                          <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{selectedWallet.walletNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Monto:</span>
                          <span className="font-semibold text-xl" style={{ color: exaBrandBg }}>${rechargeAmount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Metodo:</span>
                          <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {paymentMethods.find(m => m.id === paymentMethod)?.label}
                          </span>
                        </div>
                        {paymentReference && (
                          <div className="flex justify-between">
                            <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Referencia:</span>
                            <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{paymentReference}</span>
                          </div>
                        )}
                      </div>

                      {/* Payment Notice */}
                      {['cash', 'wire', 'zelle'].includes(paymentMethod) && (
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            Esta recarga requiere aprobacion del administrador del sistema.
                          </p>
                        </div>
                      )}

                      {/* Process Button (for non-card methods) */}
                      {paymentMethod !== 'card_manual' && (
                        <button
                          onClick={processRecharge}
                          disabled={processing}
                          className="w-full py-3 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          style={{ backgroundColor: exaBrandBg }}
                        >
                          {processing ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Procesando...
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              {['cash', 'wire', 'zelle'].includes(paymentMethod) ? 'Enviar Solicitud' : 'Procesar Recarga'}
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Transfer Tab */}
            {activeTab === 'transfer' && (
              <motion.div
                key="transfer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={cn(
                  "rounded-xl p-6 border",
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                <div className="max-w-2xl mx-auto">
                  {/* Wizard Steps */}
                  <div className="flex items-center justify-center mb-8">
                    {[1, 2, 3].map((step, index) => (
                      <React.Fragment key={step}>
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                          transferStep >= step
                            ? 'text-white'
                            : theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                        )}
                          style={transferStep >= step ? { backgroundColor: exaBrandBg } : {}}
                        >
                          {step}
                        </div>
                        {index < 2 && (
                          <div className={cn(
                            'w-16 h-1 mx-2 rounded',
                            transferStep > step ? '' : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                          )}
                            style={transferStep > step ? { backgroundColor: exaBrandBg } : {}}
                          />
                        )}
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Step 1: Amount */}
                  {transferStep === 1 && (
                    <div className="space-y-6">
                      <h3 className={cn("text-lg font-semibold text-center", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        Monto a Transferir
                      </h3>

                      {/* Source Wallet Info */}
                      <div className="p-4 rounded-lg" style={{ backgroundColor: exaBrandBg + '10' }}>
                        <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Desde:</p>
                        <p className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{companyWallet?.name}</p>
                        <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>{companyWallet?.walletNumber}</p>
                        <p className="text-lg font-bold mt-2" style={{ color: exaBrandBg }}>{companyWallet?.balanceFormatted}</p>
                      </div>

                      {/* Amount Input */}
                      <div>
                        <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          Monto
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <input
                            type="number"
                            value={transferAmount}
                            onChange={(e) => setTransferAmount(e.target.value)}
                            placeholder="0.00"
                            max={companyWallet?.balance}
                            className={cn(
                              "w-full pl-8 pr-4 py-3 rounded-lg border text-2xl font-semibold",
                              theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                            )}
                          />
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {quickAmounts.map((amt) => (
                            <button
                              key={amt}
                              onClick={() => setTransferAmount(amt.toString())}
                              disabled={(companyWallet?.balance || 0) < amt}
                              className={cn(
                                "px-3 py-1 text-sm rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                                theme === 'dark' ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'
                              )}
                            >
                              ${amt}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Validation message */}
                      {transferAmount && parseFloat(transferAmount) > (companyWallet?.balance || 0) && (
                        <p className="text-sm text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          El monto excede el balance disponible (${companyWallet?.balance.toFixed(2)})
                        </p>
                      )}

                      <button
                        onClick={() => {
                          const amount = parseFloat(transferAmount)
                          const availableBalance = companyWallet?.balance || 0
                          if (amount > 0 && amount <= availableBalance) {
                            setTransferStep(2)
                          }
                        }}
                        disabled={!transferAmount || parseFloat(transferAmount) <= 0 || parseFloat(transferAmount) > (companyWallet?.balance || 0)}
                        className="w-full py-3 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: exaBrandBg }}
                      >
                        Continuar
                      </button>
                    </div>
                  )}

                  {/* Step 2: Select Target Wallet */}
                  {transferStep === 2 && (
                    <div className="space-y-6">
                      <button
                        onClick={() => setTransferStep(1)}
                        className={cn("flex items-center gap-2", theme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700')}
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Cambiar monto
                      </button>

                      <h3 className={cn("text-lg font-semibold text-center", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        Seleccionar Wallet Destino
                      </h3>

                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Buscar por nombre, telefono o numero de wallet..."
                          value={targetSearchQuery}
                          onChange={(e) => {
                            setTargetSearchQuery(e.target.value)
                            searchWallets(e.target.value)
                          }}
                          className={cn(
                            "w-full pl-10 pr-4 py-3 rounded-lg border",
                            theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                          )}
                        />
                      </div>

                      {/* Search Results */}
                      {searchingTarget ? (
                        <div className="flex items-center justify-center p-8">
                          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                      ) : targetSearchResults.length > 0 ? (
                        <div className="max-h-64 overflow-y-auto space-y-2">
                          {targetSearchResults.map((wallet) => (
                            <div
                              key={`${wallet.type}_${wallet.id}`}
                              onClick={() => {
                                setTransferTargetWallet(wallet)
                                setTransferStep(3)
                              }}
                              className={cn(
                                "p-3 rounded-lg border cursor-pointer transition-colors",
                                theme === 'dark' ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium',
                                    wallet.type === 'company' ? 'bg-green-500' :
                                    wallet.type === 'user' ? 'bg-blue-500' : 'bg-purple-500'
                                  )}>
                                    {wallet.name.charAt(0)}
                                  </div>
                                  <div>
                                    <p className={cn("font-medium text-sm", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{wallet.name}</p>
                                    <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                      {wallet.type === 'company' ? 'Empresa' : wallet.type === 'user' ? 'Usuario' : 'Cliente'} • {wallet.walletNumber}
                                    </p>
                                  </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : targetSearchQuery.length >= 2 ? (
                        <div className="text-center py-8">
                          <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No se encontraron resultados</p>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Search className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                          <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Ingrese al menos 2 caracteres para buscar</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 3: Confirmation */}
                  {transferStep === 3 && transferTargetWallet && (
                    <div className="space-y-6">
                      <button
                        onClick={() => setTransferStep(2)}
                        className={cn("flex items-center gap-2", theme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700')}
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Cambiar destino
                      </button>

                      <h3 className={cn("text-lg font-semibold text-center", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        Confirmar Transferencia
                      </h3>

                      {/* Transfer Flow Visualization */}
                      <div className="flex items-center justify-center gap-4">
                        <div className="text-center">
                          <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center"
                            style={{ backgroundColor: exaBrandBg + '20' }}
                          >
                            <Building className="w-6 h-6" style={{ color: exaBrandBg }} />
                          </div>
                          <p className={cn("text-xs mt-1 max-w-[80px] truncate", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>{companyWallet?.name}</p>
                        </div>
                        <ArrowRight className="w-6 h-6 text-gray-400" />
                        <div className="text-center">
                          <div className={cn(
                            'w-12 h-12 rounded-full mx-auto flex items-center justify-center text-white',
                            transferTargetWallet.type === 'company' ? 'bg-green-500' :
                            transferTargetWallet.type === 'user' ? 'bg-blue-500' : 'bg-purple-500'
                          )}>
                            {transferTargetWallet.name.charAt(0)}
                          </div>
                          <p className={cn("text-xs mt-1 max-w-[80px] truncate", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>{transferTargetWallet.name}</p>
                        </div>
                      </div>

                      {/* Summary */}
                      <div className={cn("p-4 rounded-lg space-y-3", theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50')}>
                        <div className="flex justify-between">
                          <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Monto:</span>
                          <span className="font-semibold text-xl" style={{ color: exaBrandBg }}>${transferAmount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Desde:</span>
                          <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{companyWallet?.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Para:</span>
                          <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{transferTargetWallet.name}</span>
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          Descripcion (opcional)
                        </label>
                        <input
                          type="text"
                          value={transferDescription}
                          onChange={(e) => setTransferDescription(e.target.value)}
                          placeholder="Motivo de la transferencia..."
                          className={cn(
                            "w-full px-4 py-3 rounded-lg border",
                            theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                          )}
                        />
                      </div>

                      {/* Validation: check if balance is still sufficient */}
                      {parseFloat(transferAmount) > (companyWallet?.balance || 0) && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-red-800 dark:text-red-200">
                            Balance insuficiente. Su balance actual es ${companyWallet?.balance.toFixed(2)}
                          </p>
                        </div>
                      )}

                      <button
                        onClick={processTransfer}
                        disabled={processing || parseFloat(transferAmount) > (companyWallet?.balance || 0)}
                        className="w-full py-3 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        style={{ backgroundColor: exaBrandBg }}
                      >
                        {processing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Procesando...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            Confirmar Transferencia
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Pending Requests Tab */}
            {activeTab === 'pending' && (
              <motion.div
                key="pending"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={cn(
                  "rounded-xl p-6 border",
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className={cn("text-lg font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>Mis Solicitudes</h3>
                  <button
                    onClick={fetchPendingRequests}
                    className={cn(
                      "flex items-center gap-2 text-sm transition-colors",
                      theme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    <RefreshCw className={cn('w-4 h-4', pendingLoading && 'animate-spin')} />
                    Actualizar
                  </button>
                </div>

                {pendingLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                ) : pendingRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                    <p className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No hay solicitudes</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingRequests.map((request) => (
                      <div
                        key={request.id}
                        className={cn(
                          "p-4 rounded-lg",
                          theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              'w-10 h-10 rounded-full flex items-center justify-center',
                              request.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                              request.status === 'approved' ? 'bg-green-100 dark:bg-green-900/30' :
                              'bg-red-100 dark:bg-red-900/30'
                            )}>
                              {request.status === 'pending' ? (
                                <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                              ) : request.status === 'approved' ? (
                                <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                              ) : (
                                <X className="w-5 h-5 text-red-600 dark:text-red-400" />
                              )}
                            </div>
                            <div>
                              <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                Recarga {request.walletType === 'company' ? 'Empresa' : 'Usuario'} - {request.paymentMethodLabel}
                              </p>
                              <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                {new Date(request.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{request.amountFormatted}</p>
                            <p className={cn(
                              'text-xs font-medium',
                              request.status === 'pending' ? 'text-yellow-600' :
                              request.status === 'approved' ? 'text-green-600' :
                              'text-red-600'
                            )}>
                              {request.status === 'pending' ? 'Pendiente' :
                               request.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                            </p>
                          </div>
                        </div>
                        {request.paymentReference && (
                          <p className={cn("text-sm mt-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                            Ref: {request.paymentReference}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Receipt Modal */}
      <AnimatePresence>
        {showReceiptStep && receiptData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) handleCloseReceipt()
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.3 }}
            >
              <PaymentReceiptStep
                data={receiptData}
                onClose={handleCloseReceipt}
                onSent={() => {
                  showNotification('success', 'Recibo Enviado', 'El recibo ha sido enviado exitosamente')
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cashout Modal */}
      {companyWallet && (
        <CashoutModal
          isOpen={showCashoutModal}
          onClose={() => setShowCashoutModal(false)}
          entityType="company"
          entityId={companyWallet.id}
          entityName={companyWallet.name}
          walletBalance={companyWallet.balance}
          walletNumber={companyWallet.walletNumber}
          connectStatus={connectStatus}
          externalAccounts={externalAccounts}
          onSuccess={(result) => {
            // Update balance after successful cashout
            setCompanyWallet({
              ...companyWallet,
              balance: result.newBalance,
              balanceFormatted: `$${result.newBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            })
            showNotification('success', 'Retiro Exitoso', `Se han retirado $${result.amount.toFixed(2)} a tu cuenta bancaria`)
            fetchDashboard()
          }}
          onConnectRequired={() => {
            // Initiate Stripe Connect onboarding
            initiateStripeConnect()
          }}
        />
      )}

      {/* Stripe Connect Status - Fetches and updates connect status */}
      {companyWallet && (
        <div className="hidden">
          <StripeConnectStatus
            entityType="company"
            entityId={companyWallet.id}
            onStatusChange={(status) => {
              setConnectStatus(status.status)
              setExternalAccounts(status.externalAccounts || [])
            }}
            compact
          />
        </div>
      )}

      {/* Transaction Details Modal */}
      <AnimatePresence>
        {showTransactionDetails && selectedTransaction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowTransactionDetails(false)
                setSelectedTransaction(null)
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className={cn(
                "w-full max-w-md rounded-xl shadow-2xl overflow-hidden",
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
            >
              {/* Header */}
              <div className="p-6 border-b" style={{ borderColor: theme === 'dark' ? '#374151' : '#E5E7EB' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center',
                      selectedTransaction.isOutgoing ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'
                    )}>
                      {selectedTransaction.isOutgoing ? (
                        <ArrowUpRight className="w-6 h-6 text-red-600 dark:text-red-400" />
                      ) : (
                        <ArrowDownRight className="w-6 h-6 text-green-600 dark:text-green-400" />
                      )}
                    </div>
                    <div>
                      <h3 className={cn("font-semibold text-lg", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        Detalles de Transaccion
                      </h3>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        #{selectedTransaction.transactionNumber || selectedTransaction.id}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowTransactionDetails(false)
                      setSelectedTransaction(null)
                    }}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                    )}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Amount */}
                <div className="text-center py-4">
                  <p className={cn(
                    "text-3xl font-bold",
                    (selectedTransaction.displayAmount || 0) < 0 ? 'text-red-600' : 'text-green-600'
                  )}>
                    {(selectedTransaction.displayAmount || 0) >= 0 ? '+' : ''}{selectedTransaction.amountFormatted}
                  </p>
                  <p className={cn(
                    "text-sm mt-1",
                    selectedTransaction.status === 'completed' ? 'text-green-500' : 'text-yellow-500'
                  )}>
                    {selectedTransaction.status === 'completed' ? 'Completada' : 'Pendiente'}
                  </p>
                </div>

                {/* Details */}
                <div className={cn("rounded-lg p-4 space-y-3", theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50')}>
                  <div className="flex justify-between">
                    <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Tipo</span>
                    <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {selectedTransaction.typeLabel}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Fecha</span>
                    <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {new Date(selectedTransaction.createdAt).toLocaleString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  {selectedTransaction.paymentMethodLabel && (
                    <div className="flex justify-between">
                      <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Metodo de Pago</span>
                      <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {selectedTransaction.paymentMethodLabel}
                      </span>
                    </div>
                  )}

                  {selectedTransaction.cardBrand && selectedTransaction.cardLast4 && (
                    <div className="flex justify-between">
                      <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Tarjeta</span>
                      <span className={cn("text-sm font-medium flex items-center gap-1", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        <CreditCard className="w-4 h-4" />
                        {selectedTransaction.cardBrand} ****{selectedTransaction.cardLast4}
                      </span>
                    </div>
                  )}

                  {selectedTransaction.fee !== undefined && selectedTransaction.fee > 0 && (
                    <div className="flex justify-between">
                      <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Comision</span>
                      <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        ${selectedTransaction.fee.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {selectedTransaction.totalCharged && selectedTransaction.totalCharged !== selectedTransaction.amount && (
                    <div className="flex justify-between">
                      <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Total Cobrado</span>
                      <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        ${selectedTransaction.totalCharged.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {selectedTransaction.targetName && (
                    <div className="flex justify-between">
                      <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Destinatario</span>
                      <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {selectedTransaction.targetName}
                      </span>
                    </div>
                  )}

                  {selectedTransaction.sourceName && selectedTransaction.isIncoming && (
                    <div className="flex justify-between">
                      <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Origen</span>
                      <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {selectedTransaction.sourceName}
                      </span>
                    </div>
                  )}

                  {selectedTransaction.paymentReference && (
                    <div className="flex justify-between">
                      <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Referencia</span>
                      <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {selectedTransaction.paymentReference}
                      </span>
                    </div>
                  )}

                  {selectedTransaction.description && (
                    <div className="flex justify-between">
                      <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Descripcion</span>
                      <span className={cn("text-sm font-medium text-right max-w-[200px]", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {selectedTransaction.description}
                      </span>
                    </div>
                  )}
                </div>

                {/* Receipt Button */}
                {selectedTransaction.receiptUrl && (
                  <a
                    href={selectedTransaction.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "flex items-center justify-center gap-2 w-full py-3 rounded-lg font-medium transition-colors",
                      theme === 'dark'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    )}
                  >
                    <Receipt className="w-5 h-5" />
                    Ver Recibo de Stripe
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}

                {/* Close Button */}
                <button
                  onClick={() => {
                    setShowTransactionDetails(false)
                    setSelectedTransaction(null)
                  }}
                  className={cn(
                    "w-full py-3 rounded-lg font-medium transition-colors",
                    theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  )}
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Password verification dialog - shown as overlay */}
      <PasswordConfirmDialog
        isOpen={!isAuthenticated && showPasswordDialog}
        onClose={() => router.back()}
        onSuccess={() => {
          setIsAuthenticated(true)
          setShowPasswordDialog(false)
        }}
      />
    </DashboardLayout>
  )
}
