'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
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
  ChevronLeft,
  AlertCircle,
  ArrowLeft,
  Users,
  Receipt,
  FileText,
  User
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { VirtualCard } from '@/components/wallet/VirtualCard'
import { SquareCardForm } from '@/components/payments/SquareCardForm'

type Tab = 'dashboard' | 'recharge' | 'transfer' | 'pending'
type PaymentMethod = 'card_manual' | 'card_terminal' | 'cash' | 'wire' | 'zelle'

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
  netAmount?: number
  paymentMethod?: string
  paymentMethodLabel?: string
  paymentReference?: string
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
  { id: 'card_terminal', label: 'Terminal', icon: Smartphone, instant: true },
  { id: 'cash', label: 'Efectivo', icon: Banknote, instant: false, requiresApproval: true },
  { id: 'wire', label: 'Wire', icon: Building, instant: false, requiresApproval: true },
  { id: 'zelle', label: 'Zelle', icon: DollarSign, instant: false, requiresApproval: true },
]

const quickAmounts = [50, 100, 250, 500, 1000]

export default function CompanyWalletPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const router = useRouter()

  // Brand colors
  const exaBrandBg = theme === 'dark' ? '#0374e5' : '#cc0a46'
  const exaBrandBgHover = theme === 'dark' ? '#0263c7' : '#b00940'

  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  // Terminal checkout state
  const [availableTerminals, setAvailableTerminals] = useState<Array<{ id: number; name: string; deviceId: string; locationName: string }>>([])
  const [selectedTerminalId, setSelectedTerminalId] = useState<number | null>(null)
  const [terminalCheckoutId, setTerminalCheckoutId] = useState<string | null>(null)
  const [terminalPolling, setTerminalPolling] = useState(false)
  const [terminalStatus, setTerminalStatus] = useState<string | null>(null)
  const [loadingTerminals, setLoadingTerminals] = useState(false)

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

  // Fetch pending requests
  const fetchPendingRequests = async () => {
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
  }

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

  // Fetch available terminals
  const fetchAvailableTerminals = async () => {
    try {
      setLoadingTerminals(true)
      const response = await fetch('/api/terminals?provider=square&status=paired')
      const data = await response.json()
      if (data.success) {
        setAvailableTerminals(data.data.terminals || [])
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

  // Calculate terminal fee (3.5%)
  const calculateTerminalFee = (amount: number) => {
    const fee = amount * 0.035
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
          resetRechargeForm()
          fetchDashboard()
        } else if (status === 'cancelled' || status === 'failed') {
          setTerminalPolling(false)
          setTerminalCheckoutId(null)
          setTerminalStatus(null)
          showNotification('error', 'Pago Cancelado', 'El pago fue cancelado o fallo')
        }
      }
    } catch (err) {
      console.error('Error polling terminal status:', err)
    }
  }, [rechargeAmount, showNotification])

  // Effect to poll terminal status
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (terminalPolling && terminalCheckoutId) {
      interval = setInterval(() => {
        pollTerminalStatus(terminalCheckoutId)
      }, 3000)
    }
    return () => clearInterval(interval)
  }, [terminalPolling, terminalCheckoutId, pollTerminalStatus])

  // Load data on mount
  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  // Load pending requests when tab changes
  useEffect(() => {
    if (activeTab === 'pending') {
      fetchPendingRequests()
    }
  }, [activeTab])

  // Load terminals when payment method is terminal
  useEffect(() => {
    if (paymentMethod === 'card_terminal' && availableTerminals.length === 0) {
      fetchAvailableTerminals()
    }
  }, [paymentMethod])

  // Reset recharge form
  const resetRechargeForm = () => {
    setRechargeAmount('')
    setPaymentReference('')
    setSelectedWallet(null)
    setSearchQuery('')
    setRechargeStep(1)
    setSelectedTerminalId(null)
    setTerminalStatus(null)
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

  // Filter users and customers based on search
  const filteredEntities = [...users, ...customers].filter(entity => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      entity.name.toLowerCase().includes(query) ||
      entity.walletNumber?.toLowerCase().includes(query) ||
      entity.phone?.toLowerCase().includes(query)
    )
  })

  // Process recharge
  const processRecharge = async () => {
    if (!selectedWallet || !rechargeAmount) return

    setProcessing(true)
    try {
      // For card_manual, the SquareCardForm component handles payment directly
      // For card_terminal, create terminal checkout
      if (paymentMethod === 'card_terminal') {
        if (!selectedTerminalId) {
          showNotification('error', 'Error', 'Seleccione un terminal')
          setProcessing(false)
          return
        }

        const response = await fetch('/api/wallet/recharge/terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            terminalId: selectedTerminalId,
            targetWalletNumber: selectedWallet.walletNumber,
            targetType: selectedWallet.type,
            amount: parseFloat(rechargeAmount)
          })
        })

        const data = await response.json()
        if (data.success) {
          setTerminalCheckoutId(data.data.checkoutId)
          setTerminalPolling(true)
          setTerminalStatus('pending')
          showNotification('info', 'Esperando Pago', 'Complete el pago en el terminal')
        } else {
          showNotification('error', 'Error', data.error)
        }
      } else if (['cash', 'wire', 'zelle'].includes(paymentMethod)) {
        // Create pending request
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

  // Handle Square card payment success
  const handleCardPaymentSuccess = (result: { checkoutId?: string; transactionId?: number }) => {
    showNotification('success', 'Recarga Exitosa', `Se han agregado $${rechargeAmount} al wallet`)
    resetRechargeForm()
    fetchDashboard()
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
        showNotification('success', 'Transferencia Exitosa', `Se han transferido $${transferAmount}`)
        resetTransferForm()
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

  // Render tabs
  const tabs = [
    { id: 'dashboard', label: 'Estado de Cuenta', icon: History },
    { id: 'recharge', label: 'Recargar', icon: ArrowDownRight },
    { id: 'transfer', label: 'Transferir', icon: ArrowUpRight },
    { id: 'pending', label: 'Solicitudes', icon: Clock, badge: pendingRequestsCount },
  ]

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    )
  }

  if (error) {
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mi Wallet</h1>
            <p className="text-gray-500 dark:text-gray-400">Gestiona el wallet de tu empresa</p>
          </div>
          <button
            onClick={() => fetchDashboard()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-colors"
            style={{ backgroundColor: exaBrandBg }}
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>

        {/* Company Card and Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* VirtualCard */}
          {companyWallet && (
            <div className="flex justify-center lg:justify-start">
              <VirtualCard
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
              />
            </div>
          )}

          {/* Account Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Resumen del Mes</h3>

            {stats && (
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <ArrowDownRight className="w-4 h-4 text-green-500" />
                    <span className="text-gray-600 dark:text-gray-400">Recargas Recibidas</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-green-600">{stats.rechargesReceived.formatted}</span>
                    <span className="text-xs text-gray-400 ml-2">({stats.rechargesReceived.count})</span>
                  </div>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4 text-red-500" />
                    <span className="text-gray-600 dark:text-gray-400">Recargas Realizadas</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-red-600">{stats.rechargesMade.formatted}</span>
                    <span className="text-xs text-gray-400 ml-2">({stats.rechargesMade.count})</span>
                  </div>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4 text-orange-500" />
                    <span className="text-gray-600 dark:text-gray-400">Transferencias Enviadas</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-orange-600">{stats.transfersOut.formatted}</span>
                    <span className="text-xs text-gray-400 ml-2">({stats.transfersOut.count})</span>
                  </div>
                </div>

                <div className="flex justify-between items-center py-2">
                  <div className="flex items-center gap-2">
                    <ArrowDownRight className="w-4 h-4 text-blue-500" />
                    <span className="text-gray-600 dark:text-gray-400">Transferencias Recibidas</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-blue-600">{stats.transfersIn.formatted}</span>
                    <span className="text-xs text-gray-400 ml-2">({stats.transfersIn.count})</span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Info */}
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <Users className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{users.length}</p>
                  <p className="text-xs text-gray-500">Usuarios</p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <User className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{customers.length}</p>
                  <p className="text-xs text-gray-500">Clientes</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          {/* Tab Headers */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={cn(
                  'flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap',
                  activeTab === tab.id
                    ? 'border-b-2 text-gray-900 dark:text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                )}
                style={activeTab === tab.id ? { borderColor: exaBrandBg, color: exaBrandBg } : {}}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.badge ? (
                  <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Dashboard Tab - Transaction History */}
            {activeTab === 'dashboard' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Transacciones Recientes</h3>

                {transactions.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">No hay transacciones</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
                            <p className="font-medium text-gray-900 dark:text-white">{tx.description || tx.typeLabel}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {new Date(tx.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                              {tx.paymentMethodLabel && ` • ${tx.paymentMethodLabel}`}
                            </p>
                          </div>
                        </div>
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Recharge Tab */}
            {activeTab === 'recharge' && (
              <div className="max-w-2xl mx-auto">
                {/* Wizard Steps */}
                <div className="flex items-center justify-center mb-8">
                  {[1, 2, 3].map((step, index) => (
                    <React.Fragment key={step}>
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                        rechargeStep >= step
                          ? 'text-white'
                          : 'bg-gray-200 text-gray-500 dark:bg-gray-700'
                      )}
                        style={rechargeStep >= step ? { backgroundColor: exaBrandBg } : {}}
                      >
                        {step}
                      </div>
                      {index < 2 && (
                        <div className={cn(
                          'w-16 h-1 mx-2 rounded',
                          rechargeStep > step ? '' : 'bg-gray-200 dark:bg-gray-700'
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
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
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
                      className="p-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: exaBrandBg + '20' }}
                        >
                          <Building className="w-5 h-5" style={{ color: exaBrandBg }} />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">{companyWallet?.name}</p>
                          <p className="text-sm text-gray-500">Mi Empresa • {companyWallet?.walletNumber}</p>
                        </div>
                        <p className="font-semibold text-gray-900 dark:text-white">{companyWallet?.balanceFormatted}</p>
                      </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar usuario o cliente..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-offset-0"
                        style={{ '--tw-ring-color': exaBrandBg } as React.CSSProperties}
                      />
                    </div>

                    {/* Entity List */}
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {filteredEntities.map((entity) => (
                        <div
                          key={`${entity.type}_${entity.id}`}
                          onClick={() => {
                            setSelectedWallet(entity)
                            setRechargeStep(2)
                          }}
                          className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
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
                                <p className="font-medium text-gray-900 dark:text-white text-sm">{entity.name}</p>
                                <p className="text-xs text-gray-500">
                                  {entity.type === 'user' ? 'Usuario' : 'Cliente'} • {entity.walletNumber}
                                </p>
                              </div>
                            </div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{entity.balanceFormatted}</p>
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
                      className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Cambiar wallet
                    </button>

                    {/* Selected Wallet */}
                    <div className="p-4 rounded-lg"
                      style={{ backgroundColor: exaBrandBg + '10' }}
                    >
                      <p className="text-sm text-gray-500 dark:text-gray-400">Recargar a:</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{selectedWallet.name}</p>
                      <p className="text-sm text-gray-500">{selectedWallet.walletNumber}</p>
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Monto
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          value={rechargeAmount}
                          onChange={(e) => setRechargeAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-8 pr-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-2xl font-semibold"
                        />
                      </div>
                      {/* Quick amounts */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {quickAmounts.map((amt) => (
                          <button
                            key={amt}
                            onClick={() => setRechargeAmount(amt.toString())}
                            className="px-3 py-1 text-sm rounded-full border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                          >
                            ${amt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Payment Method */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                                : 'border-gray-200 dark:border-gray-700'
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

                    {/* Terminal Selection */}
                    {paymentMethod === 'card_terminal' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Terminal
                        </label>
                        {loadingTerminals ? (
                          <div className="flex items-center justify-center p-4">
                            <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
                          </div>
                        ) : availableTerminals.length === 0 ? (
                          <p className="text-sm text-yellow-600 dark:text-yellow-400">
                            No hay terminales disponibles
                          </p>
                        ) : (
                          <select
                            value={selectedTerminalId || ''}
                            onChange={(e) => setSelectedTerminalId(parseInt(e.target.value))}
                            className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          >
                            {availableTerminals.map((terminal) => (
                              <option key={terminal.id} value={terminal.id}>
                                {terminal.name} - {terminal.locationName}
                              </option>
                            ))}
                          </select>
                        )}
                        {rechargeAmount && (
                          <div className="mt-2 text-sm text-gray-500">
                            <p>Fee (3.5%): ${calculateTerminalFee(parseFloat(rechargeAmount) || 0).fee.toFixed(2)}</p>
                            <p className="font-semibold">Total: ${calculateTerminalFee(parseFloat(rechargeAmount) || 0).total.toFixed(2)}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Payment Reference for manual methods */}
                    {['cash', 'wire', 'zelle'].includes(paymentMethod) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Referencia de Pago
                        </label>
                        <input
                          type="text"
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          placeholder="Numero de confirmacion, etc."
                          className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                    )}

                    {/* Continue Button */}
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
                  </div>
                )}

                {/* Step 3: Confirmation */}
                {rechargeStep === 3 && selectedWallet && (
                  <div className="space-y-6">
                    <button
                      onClick={() => setRechargeStep(2)}
                      className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Volver
                    </button>

                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
                      Confirmar Recarga
                    </h3>

                    {/* Summary */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Destino:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{selectedWallet.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Wallet:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{selectedWallet.walletNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Monto:</span>
                        <span className="font-semibold text-xl" style={{ color: exaBrandBg }}>${rechargeAmount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Metodo:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {paymentMethods.find(m => m.id === paymentMethod)?.label}
                        </span>
                      </div>
                      {paymentReference && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Referencia:</span>
                          <span className="font-medium text-gray-900 dark:text-white">{paymentReference}</span>
                        </div>
                      )}
                    </div>

                    {/* Payment Notice */}
                    {['cash', 'wire', 'zelle'].includes(paymentMethod) && (
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          Esta recarga requiere aprobacion del administrador del sistema.
                          Una vez aprobada, el saldo sera acreditado automaticamente.
                        </p>
                      </div>
                    )}

                    {/* Terminal Status */}
                    {paymentMethod === 'card_terminal' && terminalPolling && (
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                        <RefreshCw className="w-8 h-8 mx-auto animate-spin text-blue-500 mb-2" />
                        <p className="font-medium text-blue-800 dark:text-blue-200">Esperando pago en terminal...</p>
                        <p className="text-sm text-blue-600 dark:text-blue-300">{terminalStatus}</p>
                      </div>
                    )}

                    {/* Card Payment Form */}
                    {paymentMethod === 'card_manual' && selectedWallet && (
                      <SquareCardForm
                        amount={parseFloat(rechargeAmount) || 0}
                        targetWalletNumber={selectedWallet.walletNumber}
                        targetType={selectedWallet.type}
                        onSuccess={handleCardPaymentSuccess}
                        onError={(err) => showNotification('error', 'Error', err)}
                      />
                    )}

                    {/* Process Button (for non-card methods) */}
                    {paymentMethod !== 'card_manual' && !terminalPolling && (
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
                            {['cash', 'wire', 'zelle'].includes(paymentMethod)
                              ? 'Enviar Solicitud'
                              : 'Procesar Recarga'}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Transfer Tab */}
            {activeTab === 'transfer' && (
              <div className="max-w-2xl mx-auto">
                {/* Wizard Steps */}
                <div className="flex items-center justify-center mb-8">
                  {[1, 2, 3].map((step, index) => (
                    <React.Fragment key={step}>
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                        transferStep >= step
                          ? 'text-white'
                          : 'bg-gray-200 text-gray-500 dark:bg-gray-700'
                      )}
                        style={transferStep >= step ? { backgroundColor: exaBrandBg } : {}}
                      >
                        {step}
                      </div>
                      {index < 2 && (
                        <div className={cn(
                          'w-16 h-1 mx-2 rounded',
                          transferStep > step ? '' : 'bg-gray-200 dark:bg-gray-700'
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
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
                      Monto a Transferir
                    </h3>

                    {/* Source Wallet Info */}
                    <div className="p-4 rounded-lg"
                      style={{ backgroundColor: exaBrandBg + '10' }}
                    >
                      <p className="text-sm text-gray-500 dark:text-gray-400">Desde:</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{companyWallet?.name}</p>
                      <p className="text-sm text-gray-500">{companyWallet?.walletNumber}</p>
                      <p className="text-lg font-bold mt-2" style={{ color: exaBrandBg }}>{companyWallet?.balanceFormatted}</p>
                    </div>

                    {/* Amount Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                          className="w-full pl-8 pr-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-2xl font-semibold"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {quickAmounts.map((amt) => (
                          <button
                            key={amt}
                            onClick={() => setTransferAmount(amt.toString())}
                            disabled={(companyWallet?.balance || 0) < amt}
                            className="px-3 py-1 text-sm rounded-full border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            ${amt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (parseFloat(transferAmount) > 0) {
                          setTransferStep(2)
                        }
                      }}
                      disabled={!transferAmount || parseFloat(transferAmount) <= 0}
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
                      className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Cambiar monto
                    </button>

                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
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
                        className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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
                            className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
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
                                  <p className="font-medium text-gray-900 dark:text-white text-sm">{wallet.name}</p>
                                  <p className="text-xs text-gray-500">
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
                        <p className="text-gray-500">No se encontraron resultados</p>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Search className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                        <p className="text-gray-500">Ingrese al menos 2 caracteres para buscar</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Confirmation */}
                {transferStep === 3 && transferTargetWallet && (
                  <div className="space-y-6">
                    <button
                      onClick={() => setTransferStep(2)}
                      className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Cambiar destino
                    </button>

                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
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
                        <p className="text-xs text-gray-500 mt-1 max-w-[80px] truncate">{companyWallet?.name}</p>
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
                        <p className="text-xs text-gray-500 mt-1 max-w-[80px] truncate">{transferTargetWallet.name}</p>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Monto:</span>
                        <span className="font-semibold text-xl" style={{ color: exaBrandBg }}>${transferAmount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Desde:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{companyWallet?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Para:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{transferTargetWallet.name}</span>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Descripcion (opcional)
                      </label>
                      <input
                        type="text"
                        value={transferDescription}
                        onChange={(e) => setTransferDescription(e.target.value)}
                        placeholder="Motivo de la transferencia..."
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>

                    <button
                      onClick={processTransfer}
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
                          Confirmar Transferencia
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Pending Requests Tab */}
            {activeTab === 'pending' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Mis Solicitudes</h3>
                  <button
                    onClick={fetchPendingRequests}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
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
                    <p className="text-gray-500 dark:text-gray-400">No hay solicitudes</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingRequests.map((request) => (
                      <div
                        key={request.id}
                        className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
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
                              <p className="font-medium text-gray-900 dark:text-white">
                                Recarga {request.walletType === 'company' ? 'Empresa' : 'Usuario'} - {request.paymentMethodLabel}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {new Date(request.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900 dark:text-white">{request.amountFormatted}</p>
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
                          <p className="text-sm text-gray-500 mt-2">
                            Ref: {request.paymentReference}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
