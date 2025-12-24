'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet,
  DollarSign,
  Store,
  ArrowLeft,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Loader2,
  Phone,
  ChevronRight,
  Receipt,
  History,
  X,
  AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface WalletData {
  id: number
  providerCompanyId: number
  receiverCompanyId: number
  partner: {
    id: number
    name: string
    phone: string | null
    logoUrl: string | null
  }
  balance: number
  totalSales: number
  totalPaid: number
  totalReturned: number
  lastSaleAt: string | null
  lastPaymentAt: string | null
}

interface PaymentRequest {
  id: number
  requestNumber: string
  walletId: number
  provider: { id: number; name: string; phone: string | null }
  receiver: { id: number; name: string; phone: string | null }
  amountRequested: number
  amountPaid: number
  amountPending: number
  status: string
  paymentMethod: string | null
  paymentReference: string | null
  requestedBy: string
  paidBy: string | null
  requestedAt: string
  paidAt: string | null
}

interface Summary {
  totalBalance: number
  totalSales: number
  totalPaid: number
  walletsCount: number
}

type TabType = 'wallets' | 'requests'

export default function CollectionsPage() {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [wallets, setWallets] = useState<WalletData[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('wallets')
  const [searchQuery, setSearchQuery] = useState('')

  // Modal state
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [selectedWallet, setSelectedWallet] = useState<WalletData | null>(null)
  const [requestAmount, setRequestAmount] = useState('')
  const [requestNotes, setRequestNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Load wallets
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const [walletsRes, requestsRes] = await Promise.all([
          fetch('/api/consignments/wallet?role=provider'),
          fetch('/api/consignments/payment-requests?role=provider')
        ])

        const [walletsData, requestsData] = await Promise.all([
          walletsRes.json(),
          requestsRes.json()
        ])

        if (walletsData.success) {
          setWallets(walletsData.data.wallets || [])
          setSummary(walletsData.data.summary || null)
        }
        if (requestsData.success) {
          setPaymentRequests(requestsData.data.requests || [])
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Filter wallets by search
  const filteredWallets = wallets.filter(wallet => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      wallet.partner.name.toLowerCase().includes(query) ||
      wallet.partner.phone?.toLowerCase().includes(query)
    )
  })

  // Filter requests by search
  const filteredRequests = paymentRequests.filter(req => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      req.requestNumber.toLowerCase().includes(query) ||
      req.receiver.name.toLowerCase().includes(query)
    )
  })

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca'
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const openRequestModal = (wallet: WalletData) => {
    setSelectedWallet(wallet)
    setRequestAmount(wallet.balance.toFixed(2))
    setRequestNotes('')
    setShowRequestModal(true)
  }

  const handleRequestPayment = async () => {
    if (!selectedWallet) return

    setSubmitting(true)
    try {
      const amount = parseFloat(requestAmount)
      if (isNaN(amount) || amount <= 0) {
        alert('Ingresa un monto válido')
        return
      }

      const response = await fetch('/api/consignments/wallet/request-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: selectedWallet.id,
          amount,
          notes: requestNotes || undefined
        })
      })

      const data = await response.json()
      if (data.success) {
        // Refresh data
        const [walletsRes, requestsRes] = await Promise.all([
          fetch('/api/consignments/wallet?role=provider'),
          fetch('/api/consignments/payment-requests?role=provider')
        ])
        const [walletsData, requestsData] = await Promise.all([
          walletsRes.json(),
          requestsRes.json()
        ])
        if (walletsData.success) {
          setWallets(walletsData.data.wallets || [])
          setSummary(walletsData.data.summary || null)
        }
        if (requestsData.success) {
          setPaymentRequests(requestsData.data.requests || [])
        }
        setShowRequestModal(false)
        setActiveTab('requests')
      } else {
        alert(data.error || 'Error al solicitar cobro')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al solicitar cobro')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
      pending: { label: 'Pendiente', color: 'amber', icon: Clock },
      partial: { label: 'Parcial', color: 'blue', icon: Receipt },
      completed: { label: 'Completado', color: 'green', icon: CheckCircle },
      cancelled: { label: 'Cancelado', color: 'gray', icon: XCircle }
    }
    const config = configs[status] || configs.pending
    const colorClasses: Record<string, string> = {
      amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    }
    const Icon = config.icon
    return (
      <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', colorClasses[config.color])}>
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </span>
    )
  }

  return (
    <ProtectedRoute requiredRole={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER']}>
      <DashboardLayout>
        <div className={cn(
          "min-h-screen py-6 px-4 sm:px-6 lg:px-8",
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
        )}>
          <div className="max-w-5xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/dashboard/market/consignments">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      'p-2 rounded-xl',
                      theme === 'dark' ? 'bg-gray-800 text-gray-300 hover:text-white' : 'bg-white text-gray-600 hover:text-gray-900 shadow-sm'
                    )}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </motion.button>
                </Link>
                <div>
                  <h1 className={cn(
                    "text-2xl sm:text-3xl font-bold",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Cobros
                  </h1>
                  <p className={cn(
                    "text-sm mt-1",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Gestiona los cobros a tus mercados receptores
                  </p>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            {summary && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'p-5 rounded-2xl border',
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      Total por Cobrar
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    ${summary.totalBalance.toFixed(2)}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={cn(
                    'p-5 rounded-2xl border',
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      Total Vendido
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                      <Receipt className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    ${summary.totalSales.toFixed(2)}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className={cn(
                    'p-5 rounded-2xl border',
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      Total Cobrado
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    ${summary.totalPaid.toFixed(2)}
                  </p>
                </motion.div>
              </div>
            )}

            {/* Tabs */}
            <div className={cn(
              'flex gap-2 p-1 rounded-xl',
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
            )}>
              {[
                { id: 'wallets', label: 'Saldos por Mercado', icon: Store },
                { id: 'requests', label: 'Solicitudes de Cobro', icon: History }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all',
                    activeTab === tab.id
                      ? theme === 'dark'
                        ? 'bg-purple-600 text-white shadow-lg'
                        : 'bg-white text-purple-600 shadow-md'
                      : theme === 'dark'
                        ? 'text-gray-400 hover:text-gray-200'
                        : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl border',
              theme === 'dark'
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
            )}>
              <Search className={cn('w-5 h-5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
              <input
                type="text"
                placeholder={activeTab === 'wallets' ? 'Buscar mercado...' : 'Buscar solicitud...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  'flex-1 bg-transparent outline-none',
                  theme === 'dark' ? 'text-white placeholder:text-gray-500' : 'text-gray-900 placeholder:text-gray-400'
                )}
              />
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              </div>
            ) : activeTab === 'wallets' ? (
              // Wallets List
              filteredWallets.length === 0 ? (
                <div className={cn(
                  'text-center py-20 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                )}>
                  <Store className={cn('w-16 h-16 mx-auto mb-4', theme === 'dark' ? 'text-gray-600' : 'text-gray-400')} />
                  <p className={cn('text-lg font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    No hay saldos pendientes
                  </p>
                  <p className={cn('text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                    Los saldos aparecerán cuando tus mercados vendan productos en consignación
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredWallets.map((wallet, index) => (
                    <motion.div
                      key={wallet.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        'p-5 rounded-xl border',
                        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                            <Store className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {wallet.partner.name}
                            </h3>
                            {wallet.partner.phone && (
                              <p className={cn('text-sm flex items-center gap-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                                <Phone className="w-3.5 h-3.5" />
                                {wallet.partner.phone}
                              </p>
                            )}
                            <div className={cn('flex items-center gap-4 mt-2 text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                              <span>Última venta: {formatDate(wallet.lastSaleAt)}</span>
                              <span>Último pago: {formatDate(wallet.lastPaymentAt)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn('text-2xl font-bold', wallet.balance > 0 ? 'text-green-500' : theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                            ${wallet.balance.toFixed(2)}
                          </p>
                          <p className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                            pendiente
                          </p>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className={cn(
                        'grid grid-cols-3 gap-4 mt-4 pt-4 border-t',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <div>
                          <p className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                            Total Vendido
                          </p>
                          <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            ${wallet.totalSales.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                            Total Cobrado
                          </p>
                          <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            ${wallet.totalPaid.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                            Devoluciones
                          </p>
                          <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            ${wallet.totalReturned.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      {wallet.balance > 0 && (
                        <div className={cn(
                          'flex justify-end mt-4 pt-4 border-t',
                          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                        )}>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => openRequestModal(wallet)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-medium shadow-lg"
                          >
                            <Send className="w-4 h-4" />
                            Solicitar Cobro
                          </motion.button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )
            ) : (
              // Payment Requests List
              filteredRequests.length === 0 ? (
                <div className={cn(
                  'text-center py-20 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                )}>
                  <History className={cn('w-16 h-16 mx-auto mb-4', theme === 'dark' ? 'text-gray-600' : 'text-gray-400')} />
                  <p className={cn('text-lg font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    No hay solicitudes de cobro
                  </p>
                  <p className={cn('text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                    Las solicitudes aparecerán cuando solicites un cobro
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRequests.map((req, index) => (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        'p-5 rounded-xl border',
                        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {req.requestNumber}
                            </h3>
                            {getStatusBadge(req.status)}
                          </div>
                          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                            A: {req.receiver.name}
                          </p>
                          <p className={cn('text-xs mt-2', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                            Solicitado: {formatDate(req.requestedAt)}
                            {req.paidAt && ` • Pagado: ${formatDate(req.paidAt)}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            ${req.amountRequested.toFixed(2)}
                          </p>
                          {req.status === 'partial' && (
                            <p className="text-xs text-amber-500">
                              Pagado: ${req.amountPaid.toFixed(2)}
                            </p>
                          )}
                          {req.paymentMethod && (
                            <p className={cn('text-xs mt-1', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                              {req.paymentMethod}
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* Request Payment Modal */}
        <AnimatePresence>
          {showRequestModal && selectedWallet && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowRequestModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'w-full max-w-md rounded-2xl p-6',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                )}
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className={cn('text-xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    Solicitar Cobro
                  </h2>
                  <button
                    onClick={() => setShowRequestModal(false)}
                    className={cn('p-2 rounded-lg', theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100')}
                  >
                    <X className={cn('w-5 h-5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                  </button>
                </div>

                {/* Market Info */}
                <div className={cn(
                  'flex items-center gap-4 p-4 rounded-xl mb-6',
                  theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                )}>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                    <Store className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {selectedWallet.partner.name}
                    </p>
                    <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      Saldo disponible: ${selectedWallet.balance.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Amount Input */}
                <div className="mb-4">
                  <label className={cn('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    Monto a Cobrar
                  </label>
                  <div className="relative">
                    <span className={cn(
                      'absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    )}>
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      max={selectedWallet.balance}
                      value={requestAmount}
                      onChange={(e) => setRequestAmount(e.target.value)}
                      className={cn(
                        'w-full pl-10 pr-4 py-3 rounded-xl border text-lg font-medium',
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-200 text-gray-900'
                      )}
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => setRequestAmount((selectedWallet.balance * 0.5).toFixed(2))}
                      className={cn(
                        'px-3 py-1 rounded-lg text-xs font-medium',
                        theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                      )}
                    >
                      50%
                    </button>
                    <button
                      onClick={() => setRequestAmount((selectedWallet.balance * 0.75).toFixed(2))}
                      className={cn(
                        'px-3 py-1 rounded-lg text-xs font-medium',
                        theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                      )}
                    >
                      75%
                    </button>
                    <button
                      onClick={() => setRequestAmount(selectedWallet.balance.toFixed(2))}
                      className={cn(
                        'px-3 py-1 rounded-lg text-xs font-medium',
                        theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                      )}
                    >
                      100%
                    </button>
                  </div>
                </div>

                {/* Notes */}
                <div className="mb-6">
                  <label className={cn('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    Notas (opcional)
                  </label>
                  <textarea
                    value={requestNotes}
                    onChange={(e) => setRequestNotes(e.target.value)}
                    placeholder="Añade notas para el receptor..."
                    rows={3}
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border resize-none',
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-500'
                        : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400'
                    )}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowRequestModal(false)}
                    className={cn(
                      'flex-1 px-4 py-3 rounded-xl font-medium',
                      theme === 'dark'
                        ? 'bg-gray-700 text-white'
                        : 'bg-gray-100 text-gray-700'
                    )}
                  >
                    Cancelar
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleRequestPayment}
                    disabled={submitting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium bg-gradient-to-r from-green-500 to-green-600 text-white disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Solicitar Cobro
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
