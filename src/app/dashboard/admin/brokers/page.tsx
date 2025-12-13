'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  MapPin,
  DollarSign,
  Package,
  TrendingUp,
  Building2,
  Wallet,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Search,
  Filter
} from 'lucide-react'
import Link from 'next/link'

interface WalletBalance {
  currency: string
  available: number
  reserved: number
  total: number
}

interface BrokerStats {
  pendingOrders: number
  activeOrders: number
  deliveredOrders: number
  totalDeliveredAmount: number
}

interface Broker {
  id: number
  name: string
  province: string
  municipality: string
  deliveryHours: string
  contactPhone: string
  isActive: boolean
  maxDailyAmount: number | null
  createdAt: string
  walletBalances: WalletBalance[]
  stats: BrokerStats
}

interface Summary {
  totalBrokers: number
  activeBrokers: number
  provincesCovered: number
  totalPendingOrders: number
  totalUsdAvailable: number
  totalUsdReserved: number
}

interface Province {
  name: string
  brokerCount: number
}

export default function AdminBrokersPage() {
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [provinces, setProvinces] = useState<Province[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProvince, setSelectedProvince] = useState('')

  useEffect(() => {
    fetchBrokers()
  }, [selectedProvince])

  const fetchBrokers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedProvince) params.append('province', selectedProvince)

      const response = await fetch(`/api/admin/brokers?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setBrokers(data.data.brokers || [])
          setSummary(data.data.summary)
          setProvinces(data.data.provinces || [])
        }
      }
    } catch (error) {
      console.error('Error fetching brokers:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Gestion de Brokers
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Administra los brokers y sus wallets
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/admin/brokers/orders"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Package className="w-4 h-4" />
            Ver Ordenes
          </Link>
          <Link
            href="/dashboard/admin/brokers/wallets"
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Wallet className="w-4 h-4" />
            Ver Wallets
          </Link>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.totalBrokers}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Brokers</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.activeBrokers}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Activos</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <MapPin className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.provincesCovered}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Provincias</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.totalPendingOrders}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Pendientes</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(summary.totalUsdAvailable)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">USD Disponible</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(summary.totalUsdReserved)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">USD Reservado</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar broker por nombre o ubicacion..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={selectedProvince}
          onChange={(e) => setSelectedProvince(e.target.value)}
          className="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Todas las provincias</option>
          {provinces.map(p => (
            <option key={p.name} value={p.name}>
              {p.name} ({p.brokerCount})
            </option>
          ))}
        </select>
      </div>

      {/* Brokers List */}
      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-700 h-40 rounded-xl"></div>
          ))}
        </div>
      ) : filteredBrokers.length > 0 ? (
        <div className="grid gap-4">
          {filteredBrokers.map((broker, index) => (
            <motion.div
              key={broker.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                      <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                        {broker.name}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <MapPin className="w-4 h-4" />
                        {broker.municipality}, {broker.province}
                      </div>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    broker.isActive
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  }`}>
                    {broker.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                {/* Wallet Balances */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {broker.walletBalances.map(balance => (
                    <div
                      key={balance.currency}
                      className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3"
                    >
                      <p className="text-xs text-gray-500 dark:text-gray-400">{balance.currency}</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {balance.currency === 'CUP'
                          ? `${balance.available.toLocaleString()} CUP`
                          : formatCurrency(balance.available)}
                      </p>
                      {balance.reserved > 0 && (
                        <p className="text-xs text-orange-600 dark:text-orange-400">
                          {balance.currency === 'CUP'
                            ? `${balance.reserved.toLocaleString()} reservado`
                            : `${formatCurrency(balance.reserved)} reservado`}
                        </p>
                      )}
                    </div>
                  ))}
                  {broker.walletBalances.length === 0 && (
                    <div className="col-span-4 text-center py-3 text-gray-500 dark:text-gray-400 text-sm">
                      Sin balances configurados
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {broker.stats.pendingOrders} pendientes
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {broker.stats.activeOrders} activas
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {broker.stats.deliveredOrders} entregadas
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-purple-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {formatCurrency(broker.stats.totalDeliveredAmount)} total
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-12 text-center"
        >
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No se encontraron brokers
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {searchTerm || selectedProvince
              ? 'Intenta con otros filtros de busqueda'
              : 'No hay brokers registrados en el sistema'}
          </p>
        </motion.div>
      )}
    </div>
  )
}
