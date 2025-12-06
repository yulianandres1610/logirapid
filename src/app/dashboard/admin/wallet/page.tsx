'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
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

export default function WalletManagementPage() {
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

  const paymentMethods = [
    { id: 'card_manual', label: 'Tarjeta Manual', icon: '💳' },
    { id: 'card_terminal', label: 'Terminal', icon: '📱' },
    { id: 'cash', label: 'Efectivo', icon: '💵' },
    { id: 'wire', label: 'Wire Transfer', icon: '🏦' },
    { id: 'zelle', label: 'Zelle', icon: '💸' }
  ]

  const quickAmounts = [50, 100, 250, 500, 1000]

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-2xl">💳</span> Wallet Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">Control total de wallets del sistema</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => handleTabChange('dashboard')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'dashboard'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            📊 Dashboard
          </button>
          <button
            onClick={() => handleTabChange('operations')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'operations'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            💰 Operaciones
          </button>
          <button
            onClick={() => handleTabChange('pending')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            📋 Solicitudes
            {stats?.pendingRequests.value && stats.pendingRequests.value > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {stats.pendingRequests.value}
              </span>
            )}
          </button>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 animate-pulse">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3"></div>
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                  <p className="text-sm opacity-80 mb-1">💰 Balance Total</p>
                  <p className="text-2xl font-bold">{stats.totalBalance.formatted}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">📈 Recargas del Mes</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.rechargesThisMonth.formatted}</p>
                  <p className={`text-xs ${stats.rechargesThisMonth.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {stats.rechargesThisMonth.change >= 0 ? '↑' : '↓'} {Math.abs(stats.rechargesThisMonth.change)}%
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">🔄 Transferencias del Mes</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.transfersThisMonth.formatted}</p>
                  <p className={`text-xs ${stats.transfersThisMonth.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {stats.transfersThisMonth.change >= 0 ? '↑' : '↓'} {Math.abs(stats.transfersThisMonth.change)}%
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">🏢 Empresas Activas</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.activeCompanies.value}</p>
                </div>
              </div>
            )}

            {/* Search and Card */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">🔍 Buscar Wallet</h3>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    searchWallets(e.target.value)
                  }}
                  placeholder="Buscar por numero de wallet, telefono o nombre..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searching && <p className="text-sm text-gray-500 mt-2">Buscando...</p>}
                {searchResults.length > 0 && !selectedWallet && (
                  <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                    {searchResults.map(wallet => (
                      <button
                        key={`${wallet.type}-${wallet.id}`}
                        onClick={() => setSelectedWallet(wallet)}
                        className="w-full p-3 text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                      >
                        <p className="font-medium text-gray-900 dark:text-white">{wallet.name}</p>
                        <p className="text-sm text-gray-500">{wallet.walletNumber} - {wallet.balanceFormatted}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedWallet && (
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
              )}
            </div>

            {/* Top Wallets */}
            {topWallets.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">🏆 Top 10 Wallets por Balance</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                        <th className="pb-3">#</th>
                        <th className="pb-3">Empresa</th>
                        <th className="pb-3">Wallet</th>
                        <th className="pb-3 text-right">Balance</th>
                        <th className="pb-3 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {topWallets.map((wallet, index) => (
                        <tr key={wallet.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="py-3 text-gray-500">{index + 1}</td>
                          <td className="py-3">
                            <button
                              onClick={() => setSelectedWallet(wallet as any)}
                              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                            >
                              {wallet.name}
                            </button>
                          </td>
                          <td className="py-3 font-mono text-sm text-gray-500">{wallet.walletNumber}</td>
                          <td className="py-3 text-right font-semibold text-gray-900 dark:text-white">{wallet.balanceFormatted}</td>
                          <td className="py-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                              wallet.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${wallet.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                              {wallet.status === 'active' ? 'Activo' : 'Limite'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Operations Tab */}
        {activeTab === 'operations' && (
          <div className="space-y-6">
            {/* Operation sub-tabs */}
            <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setOperationTab('recharge')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  operationTab === 'recharge'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                💰 Recargar
              </button>
              <button
                onClick={() => setOperationTab('transfer')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  operationTab === 'transfer'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                🔄 Transferir
              </button>
              <button
                onClick={() => setOperationTab('history')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  operationTab === 'history'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                📋 Historial
              </button>
            </div>

            {/* Recharge Form */}
            {operationTab === 'recharge' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-700 max-w-2xl">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">💰 Recargar Wallet</h3>

                {/* Search wallet */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Buscar Wallet</label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      searchWallets(e.target.value)
                    }}
                    placeholder="Numero de wallet o telefono..."
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  {searchResults.length > 0 && !selectedWallet && (
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {searchResults.map(w => (
                        <button
                          key={`${w.type}-${w.id}`}
                          onClick={() => setSelectedWallet(w)}
                          className="w-full p-2 text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-sm"
                        >
                          {w.name} - {w.balanceFormatted}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedWallet && (
                    <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="font-medium text-green-700 dark:text-green-400">{selectedWallet.name}</p>
                        <p className="text-sm text-green-600 dark:text-green-500">Balance: {selectedWallet.balanceFormatted}</p>
                      </div>
                      <button onClick={() => setSelectedWallet(null)} className="text-green-600 hover:text-green-700">
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                {/* Amount */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Monto</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      value={rechargeAmount}
                      onChange={(e) => setRechargeAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    {quickAmounts.map(amt => (
                      <button
                        key={amt}
                        onClick={() => setRechargeAmount(amt.toString())}
                        className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Method */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Metodo de Pago</label>
                  <div className="grid grid-cols-5 gap-2">
                    {paymentMethods.map(method => (
                      <button
                        key={method.id}
                        onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                        className={`p-3 rounded-lg border-2 text-center transition-colors ${
                          paymentMethod === method.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <span className="text-xl">{method.icon}</span>
                        <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">{method.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reference */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Referencia (opcional)
                  </label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="Numero de referencia o confirmacion..."
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Note for cash/wire/zelle */}
                {['cash', 'wire', 'zelle'].includes(paymentMethod) && (
                  <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      ⚠️ Los pagos por {paymentMethod === 'cash' ? 'Efectivo' : paymentMethod === 'wire' ? 'Wire Transfer' : 'Zelle'} son procesados inmediatamente por SUPER_ADMIN.
                    </p>
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={processRecharge}
                  disabled={!selectedWallet || !rechargeAmount || processing}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
                >
                  {processing ? 'Procesando...' : `Procesar Recarga $${rechargeAmount || '0.00'}`}
                </button>
              </div>
            )}

            {/* Transfer Form */}
            {operationTab === 'transfer' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-700 max-w-2xl">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">🔄 Transferencia entre Wallets</h3>

                {/* Source */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Wallet Origen</label>
                  <input
                    type="text"
                    value={sourceSearchQuery}
                    onChange={(e) => {
                      setSourceSearchQuery(e.target.value)
                      searchWallets(e.target.value)
                    }}
                    placeholder="Buscar wallet origen..."
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  {searchResults.length > 0 && !transferSourceWallet && sourceSearchQuery && (
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {searchResults.map(w => (
                        <button
                          key={`src-${w.type}-${w.id}`}
                          onClick={() => {
                            setTransferSourceWallet(w)
                            setSourceSearchQuery(w.name)
                            setSearchResults([])
                          }}
                          className="w-full p-2 text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-sm"
                        >
                          {w.name} - {w.balanceFormatted}
                        </button>
                      ))}
                    </div>
                  )}
                  {transferSourceWallet && (
                    <p className="mt-2 text-sm text-green-600">✓ Balance: {transferSourceWallet.balanceFormatted}</p>
                  )}
                </div>

                <div className="text-center text-gray-400 my-4">⬇️</div>

                {/* Amount */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Monto</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="text-center text-gray-400 my-4">⬇️</div>

                {/* Target */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Wallet Destino</label>
                  <input
                    type="text"
                    value={targetSearchQuery}
                    onChange={(e) => {
                      setTargetSearchQuery(e.target.value)
                      searchWallets(e.target.value)
                    }}
                    placeholder="Buscar wallet destino..."
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  {searchResults.length > 0 && !transferTargetWallet && targetSearchQuery && (
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {searchResults.map(w => (
                        <button
                          key={`tgt-${w.type}-${w.id}`}
                          onClick={() => {
                            setTransferTargetWallet(w)
                            setTargetSearchQuery(w.name)
                            setSearchResults([])
                          }}
                          className="w-full p-2 text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-sm"
                        >
                          {w.name} - {w.balanceFormatted}
                        </button>
                      ))}
                    </div>
                  )}
                  {transferTargetWallet && (
                    <p className="mt-2 text-sm text-green-600">✓ Balance actual: {transferTargetWallet.balanceFormatted}</p>
                  )}
                </div>

                {/* Description */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Descripcion (opcional)
                  </label>
                  <input
                    type="text"
                    value={transferDescription}
                    onChange={(e) => setTransferDescription(e.target.value)}
                    placeholder="Motivo de la transferencia..."
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Submit */}
                <button
                  onClick={processTransfer}
                  disabled={!transferSourceWallet || !transferTargetWallet || !transferAmount || processing}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
                >
                  {processing ? 'Procesando...' : `Ejecutar Transferencia $${transferAmount || '0.00'}`}
                </button>
              </div>
            )}

            {/* History */}
            {operationTab === 'history' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📋 Historial de Transacciones</h3>

                {historyLoading ? (
                  <div className="text-center py-8 text-gray-500">Cargando...</div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No hay transacciones</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 uppercase">
                          <th className="pb-3">ID</th>
                          <th className="pb-3">Fecha</th>
                          <th className="pb-3">Tipo</th>
                          <th className="pb-3">Origen → Destino</th>
                          <th className="pb-3 text-right">Monto</th>
                          <th className="pb-3 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {transactions.map(tx => (
                          <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="py-3 text-gray-500">#{tx.id}</td>
                            <td className="py-3 text-sm text-gray-500">
                              {new Date(tx.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </td>
                            <td className="py-3">
                              <span className={`px-2 py-1 rounded text-xs ${
                                tx.type === 'recharge' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                tx.type.includes('transfer') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {tx.typeLabel}
                              </span>
                            </td>
                            <td className="py-3 text-sm">
                              <span className="text-gray-600 dark:text-gray-400">{tx.sourceName}</span>
                              <span className="mx-2 text-gray-400">→</span>
                              <span className="text-gray-900 dark:text-white">{tx.targetName}</span>
                            </td>
                            <td className="py-3 text-right font-semibold">
                              <span className={tx.type === 'transfer_out' ? 'text-red-500' : 'text-green-500'}>
                                {tx.type === 'transfer_out' ? '-' : '+'}{tx.amountFormatted}
                              </span>
                            </td>
                            <td className="py-3 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                                tx.status === 'completed' ? 'bg-green-100 text-green-700' :
                                tx.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {tx.status === 'completed' ? '✓' : tx.status === 'pending' ? '⏳' : '✕'} {tx.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pending Requests Tab */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                📋 Solicitudes de Recarga Pendientes
              </h3>
              <button
                onClick={fetchPendingRequests}
                className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                🔄 Actualizar
              </button>
            </div>

            {pendingLoading ? (
              <div className="text-center py-8 text-gray-500">Cargando...</div>
            ) : pendingRequests.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-100 dark:border-gray-700">
                <p className="text-gray-500 text-lg">No hay solicitudes pendientes</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map(request => (
                  <div key={request.id} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 shadow-lg">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {request.paymentMethod === 'cash' ? '💵' : request.paymentMethod === 'wire' ? '🏦' : '💸'}
                        </span>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{request.paymentMethodLabel}</p>
                          <p className="text-sm text-gray-500">
                            Hace {Math.round((Date.now() - new Date(request.createdAt).getTime()) / (1000 * 60 * 60))} horas
                          </p>
                        </div>
                      </div>
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">{request.amountFormatted}</span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <p className="text-sm">
                        <span className="text-gray-500">Empresa:</span>{' '}
                        <span className="text-gray-900 dark:text-white font-medium">{request.walletName}</span>
                      </p>
                      <p className="text-sm">
                        <span className="text-gray-500">Wallet:</span>{' '}
                        <span className="font-mono text-gray-600 dark:text-gray-400">{request.walletNumber}</span>
                      </p>
                      <p className="text-sm">
                        <span className="text-gray-500">Solicitado por:</span>{' '}
                        <span className="text-gray-900 dark:text-white">{request.requestedBy}</span>
                      </p>
                      {request.paymentReference && (
                        <p className="text-sm">
                          <span className="text-gray-500">Referencia:</span>{' '}
                          <span className="text-gray-900 dark:text-white">{request.paymentReference}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => processRequest(request.id, 'approve')}
                        className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                      >
                        ✓ Aprobar
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt('Motivo del rechazo:')
                          if (reason) {
                            processRequest(request.id, 'reject', reason)
                          }
                        }}
                        className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                      >
                        ✕ Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
