'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
  Building
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { VirtualCard } from '@/components/wallet/VirtualCard'
import StripeConnectStatus from '@/components/wallet/StripeConnectStatus'
import PasswordConfirmDialog from '@/components/ui/PasswordConfirmDialog'

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

  // Handle transfer to company
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Mi Billetera
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Gestiona tu billetera personal
            </p>
          </div>
          <button
            onClick={fetchWalletData}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
          </button>
        </div>

        {/* Virtual Card */}
        <div className="mb-8">
          <VirtualCard
            walletNumber={walletData.walletNumber}
            name={walletData.name}
            balance={walletData.balance}
            balanceFormatted={walletData.balanceFormatted}
            status="active"
            type="user"
            email={walletData.email}
            phone={walletData.phone}
          />
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-4 overflow-x-auto pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors",
                  activeTab === tab.id
                    ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Recargas</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${stats.rechargesAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-400">{stats.totalRecharges} transacciones</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <ArrowDownRight className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Enviado</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${stats.transfersSentAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-400">{stats.transfersSent} transferencias</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                    <ArrowUpRight className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Recibido</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${stats.transfersReceivedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-400">{stats.transfersReceived} transferencias</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <ArrowDownRight className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Retiros</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${stats.cashoutsAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-400">{stats.totalCashouts} retiros</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                    <Download className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Transfer Tab */}
          {activeTab === 'transfer' && (
            <div className="max-w-xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Transferir a Empresa
                </h3>

                {walletData.company ? (
                  <>
                    {/* Target company info */}
                    <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Destino</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {walletData.company.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {walletData.company.walletNumber}
                      </p>
                    </div>

                    {/* Amount input */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                          className="w-full pl-8 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Disponible: {walletData.balanceFormatted}
                      </p>
                    </div>

                    <button
                      onClick={handleTransferToCompany}
                      disabled={transferring || !transferAmount || parseFloat(transferAmount) <= 0}
                      className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {transferring ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Transfiriendo...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Transferir
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Building className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      No tienes una empresa asociada
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cashout Tab */}
          {activeTab === 'cashout' && (
            <div className="max-w-xl mx-auto space-y-6">
              {/* Stripe Connect Status */}
              <StripeConnectStatus
                entityType="user"
                entityId={walletData.id}
              />

              {/* Cashout info */}
              {walletData.canCashout && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Retirar Fondos
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Retira fondos de tu billetera a tu cuenta bancaria vinculada.
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    {walletData.balanceFormatted}
                    <span className="text-sm font-normal text-gray-500 ml-2">disponible</span>
                  </p>
                  <p className="text-sm text-gray-500">
                    Contacta a soporte para solicitar retiros manuales.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {transactions.length === 0 ? (
                  <div className="p-8 text-center">
                    <History className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      No hay transacciones aun
                    </p>
                  </div>
                ) : (
                  transactions.map((tx) => (
                    <div key={tx.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
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
                            <p className="font-medium text-gray-900 dark:text-white">
                              {tx.typeLabel}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
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
                          <p className="text-xs text-gray-400">
                            {new Date(tx.createdAt).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
