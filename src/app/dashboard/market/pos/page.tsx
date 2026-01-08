'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Monitor,
  Plus,
  Search,
  Warehouse,
  Users,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  X,
  Eye,
  Edit,
  Trash2,
  Play,
  Settings,
  DollarSign,
  ShoppingCart,
  Clock,
  History,
  Printer,
  FileText
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { PrintDocumentModal } from '@/components/print/PrintDocumentModal'

interface Terminal {
  id: number
  code: string
  name: string
  warehouseId: number
  warehouseName: string
  warehouseCode: string
  pricelistId: number | null
  pricelistName: string | null
  allowPriceEdit: boolean
  allowDiscount: boolean
  maxDiscountPercent: number
  requireCustomer: boolean
  defaultCurrency: string
  acceptedCurrencies: string[]
  isActive: boolean
  userCount: number
  hasOpenSession: boolean
  userHasAccess: boolean
  createdAt: string
  updatedAt: string
}

interface Stats {
  total: number
  active: number
  inactive: number
  withSessions: number
}

export default function MarketPOSPage() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const router = useRouter()
  const [terminals, setTerminals] = useState<Terminal[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, inactive: 0, withSessions: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [deleteTerminal, setDeleteTerminal] = useState<Terminal | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [openSessionModal, setOpenSessionModal] = useState<Terminal | null>(null)
  const [openingSession, setOpeningSession] = useState(false)
  const [printTerminal, setPrintTerminal] = useState<Terminal | null>(null)
  const [openingCash, setOpeningCash] = useState({ usd: 0, cup: 0, mlc: 0 })
  const [openingNotes, setOpeningNotes] = useState('')
  const [useDenominations, setUseDenominations] = useState(true)
  const [selectedCurrency, setSelectedCurrency] = useState<'USD' | 'CUP' | 'MLC'>('USD')
  const [denominations, setDenominations] = useState({
    USD: { 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 },
    CUP: { 1000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0 },
    MLC: { 50: 0, 20: 0, 10: 0, 5: 0 }
  })

  // Calculate totals from denominations
  const denominationTotals = {
    usd: Object.entries(denominations.USD).reduce((sum, [denom, count]) => sum + (parseInt(denom) * count), 0),
    cup: Object.entries(denominations.CUP).reduce((sum, [denom, count]) => sum + (parseInt(denom) * count), 0),
    mlc: Object.entries(denominations.MLC).reduce((sum, [denom, count]) => sum + (parseInt(denom) * count), 0)
  }

  // Update opening cash when denominations change
  useEffect(() => {
    if (useDenominations) {
      setOpeningCash(denominationTotals)
    }
  }, [denominationTotals.usd, denominationTotals.cup, denominationTotals.mlc, useDenominations])

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  const fetchTerminals = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter === 'inactive') {
        params.set('active', 'false')
      }

      const response = await fetch(`/api/market/pos/terminals?${params}`)
      const data = await response.json()

      if (data.success) {
        let filteredTerminals = data.data.terminals

        // Apply search filter
        if (search) {
          const searchLower = search.toLowerCase()
          filteredTerminals = filteredTerminals.filter((t: Terminal) =>
            t.name.toLowerCase().includes(searchLower) ||
            t.code.toLowerCase().includes(searchLower) ||
            t.warehouseName?.toLowerCase().includes(searchLower)
          )
        }

        // Apply status filter
        if (statusFilter === 'active') {
          filteredTerminals = filteredTerminals.filter((t: Terminal) => t.isActive)
        } else if (statusFilter === 'inactive') {
          filteredTerminals = filteredTerminals.filter((t: Terminal) => !t.isActive)
        } else if (statusFilter === 'withSession') {
          filteredTerminals = filteredTerminals.filter((t: Terminal) => t.hasOpenSession)
        }

        setTerminals(filteredTerminals)

        // Calculate stats
        const allTerminals = data.data.terminals
        setStats({
          total: allTerminals.length,
          active: allTerminals.filter((t: Terminal) => t.isActive).length,
          inactive: allTerminals.filter((t: Terminal) => !t.isActive).length,
          withSessions: allTerminals.filter((t: Terminal) => t.hasOpenSession).length
        })
      }
    } catch (error) {
      console.error('Error fetching terminals:', error)
    } finally {
      setLoading(false)
    }
  }

  // Consolidar en un solo useEffect para evitar doble carga
  useEffect(() => {
    // Debounce solo cuando hay búsqueda activa
    const debounceTime = search ? 300 : 0
    const debounce = setTimeout(() => {
      fetchTerminals()
    }, debounceTime)
    return () => clearTimeout(debounce)
  }, [statusFilter, search])

  const handleDeleteTerminal = async () => {
    if (!deleteTerminal) return

    setDeleting(true)
    setDeleteError(null)
    try {
      const response = await fetch(`/api/market/pos/terminals/${deleteTerminal.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setTerminals(prev => prev.filter(t => t.id !== deleteTerminal.id))
        setStats(prev => ({
          ...prev,
          total: prev.total - 1,
          active: deleteTerminal.isActive ? prev.active - 1 : prev.active,
          inactive: !deleteTerminal.isActive ? prev.inactive - 1 : prev.inactive
        }))
        setDeleteTerminal(null)
      } else {
        setDeleteError(data.error || 'Error al desactivar el terminal')
      }
    } catch (error) {
      console.error('Error deleting terminal:', error)
      setDeleteError('Error de conexión. Intente nuevamente.')
    } finally {
      setDeleting(false)
    }
  }

  const handleOpenSession = async () => {
    if (!openSessionModal) return

    setOpeningSession(true)
    try {
      const response = await fetch('/api/market/pos/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          terminalId: openSessionModal.id,
          openingCashUsd: openingCash.usd,
          openingCashCup: openingCash.cup,
          openingCashMlc: openingCash.mlc,
          openingNotes: openingNotes || null,
          openingDenominations: useDenominations ? denominations : null
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Navigate to POS interface
        router.push(`/dashboard/market/pos/${openSessionModal.id}`)
      } else {
        alert(data.error || 'Error al abrir sesión')
      }
    } catch (error) {
      console.error('Error opening session:', error)
      alert('Error de conexión')
    } finally {
      setOpeningSession(false)
    }
  }

  const handleEnterPOS = (terminal: Terminal) => {
    if (terminal.hasOpenSession) {
      // Go directly to POS
      router.push(`/dashboard/market/pos/${terminal.id}`)
    } else {
      // Show open session modal
      setOpenSessionModal(terminal)
      setOpeningCash({ usd: 0, cup: 0, mlc: 0 })
      setOpeningNotes('')
    }
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              {/* Total Terminales */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onClick={() => setStatusFilter(null)}
                className={cn(
                  'relative overflow-hidden cursor-pointer',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl',
                  statusFilter === null && 'ring-2 ring-blue-500'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-blue-900/30 border border-blue-800/50'
                          : 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200'
                      )}>
                        <Monitor className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-black'
                        )}>Total Terminales</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.total}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                      <span className={cn(
                        'text-xs font-medium',
                        theme === 'dark' ? 'text-gray-500' : 'text-black'
                      )}>Puntos de venta</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Activos */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                onClick={() => setStatusFilter(statusFilter === 'active' ? null : 'active')}
                className={cn(
                  'relative overflow-hidden cursor-pointer',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl',
                  statusFilter === 'active' && 'ring-2 ring-emerald-500'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-emerald-900/30 border border-emerald-800/50'
                          : 'bg-gradient-to-br from-emerald-50 to-green-100 border border-emerald-200'
                      )}>
                        <CheckCircle className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-black'
                        )}>Activos</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.active}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                        <span className={cn(
                          'text-xs font-medium',
                          theme === 'dark' ? 'text-gray-500' : 'text-black'
                        )}>Disponibles</span>
                      </div>
                      <span className={cn(
                        'text-xs font-bold',
                        theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                      )}>
                        {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-emerald-100 dark:bg-emerald-900/30 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-emerald-400 to-green-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${stats.total > 0 ? (stats.active / stats.total) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Con Sesión Abierta */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                onClick={() => setStatusFilter(statusFilter === 'withSession' ? null : 'withSession')}
                className={cn(
                  'relative overflow-hidden cursor-pointer',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl',
                  statusFilter === 'withSession' && 'ring-2 ring-amber-500'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-amber-900/30 border border-amber-800/50'
                          : 'bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200'
                      )}>
                        <Clock className="w-6 h-6 text-amber-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-black'
                        )}>Con Sesión</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.withSessions}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                      <span className={cn(
                        'text-xs font-medium',
                        theme === 'dark' ? 'text-gray-500' : 'text-black'
                      )}>En operación</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Inactivos */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                onClick={() => setStatusFilter(statusFilter === 'inactive' ? null : 'inactive')}
                className={cn(
                  'relative overflow-hidden cursor-pointer',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl',
                  statusFilter === 'inactive' && 'ring-2 ring-red-500'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-rose-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-red-900/30 border border-red-800/50'
                          : 'bg-gradient-to-br from-red-50 to-rose-100 border border-red-200'
                      )}>
                        <XCircle className="w-6 h-6 text-red-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-black'
                        )}>Inactivos</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.inactive}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                      <span className={cn(
                        'text-xs font-medium',
                        theme === 'dark' ? 'text-gray-500' : 'text-black'
                      )}>Deshabilitados</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Filters */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={cn(
                'p-4 rounded-2xl border shadow-xl',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, código o almacén..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={cn(
                      'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                        : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                    )}
                  />
                </div>

                {/* Clear Filters */}
                {(search || statusFilter) && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSearch('')
                      setStatusFilter(null)
                    }}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    <X className="w-4 h-4" />
                    Limpiar
                  </motion.button>
                )}

                {/* Refresh */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={fetchTerminals}
                  disabled={loading}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                    theme === 'dark'
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                </motion.button>

                {/* Historial de Sesiones */}
                <Link href="/dashboard/market/pos/sessions">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    <History className="w-5 h-5" />
                    Historial
                  </motion.button>
                </Link>

                {/* Nuevo Terminal */}
                {isAdmin && (
                  <Link href="/dashboard/market/pos/create">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25"
                    >
                      <Plus className="w-5 h-5" />
                      Nuevo Terminal
                    </motion.button>
                  </Link>
                )}
              </div>
            </motion.div>

            {/* Terminals Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={cn(
                      'rounded-2xl border shadow-xl p-6',
                      theme === 'dark'
                        ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                        : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                    )}
                  >
                    <div className="animate-pulse">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                        <div className="flex-1">
                          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                        </div>
                      </div>
                      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl mt-4" />
                    </div>
                  </motion.div>
                ))
              ) : terminals.length === 0 ? (
                <div className="col-span-full">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'rounded-2xl border shadow-xl p-12 text-center',
                      theme === 'dark'
                        ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                        : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                    )}
                  >
                    <Monitor className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      No hay terminales POS
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                      Crea tu primer punto de venta para empezar a vender
                    </p>
                    {isAdmin && (
                      <Link href="/dashboard/market/pos/create">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25"
                        >
                          <Plus className="w-5 h-5" />
                          Crear Terminal
                        </motion.button>
                      </Link>
                    )}
                  </motion.div>
                </div>
              ) : (
                terminals.map((terminal, index) => (
                  <motion.div
                    key={terminal.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      'relative overflow-hidden rounded-2xl border shadow-xl group',
                      theme === 'dark'
                        ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                        : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                      !terminal.isActive && 'opacity-60'
                    )}
                  >
                    {/* Status indicator */}
                    <div className={cn(
                      'absolute top-0 left-0 w-full h-1',
                      terminal.hasOpenSession
                        ? 'bg-gradient-to-r from-green-400 to-emerald-600'
                        : terminal.isActive
                        ? 'bg-gradient-to-r from-blue-400 to-blue-600'
                        : 'bg-gradient-to-r from-gray-400 to-gray-500'
                    )}></div>

                    <div className="p-6">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            'w-16 h-16 rounded-xl flex items-center justify-center shadow-lg border',
                            terminal.hasOpenSession
                              ? theme === 'dark' ? 'bg-green-900/30 border-green-800/50' : 'bg-green-50 border-green-200'
                              : terminal.isActive
                              ? theme === 'dark' ? 'bg-blue-900/30 border-blue-800/50' : 'bg-blue-50 border-blue-200'
                              : theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'
                          )}>
                            <Monitor className={cn(
                              'w-8 h-8',
                              terminal.hasOpenSession
                                ? 'text-green-600'
                                : terminal.isActive
                                ? 'text-blue-600'
                                : 'text-gray-400'
                            )} />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                              {terminal.name}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                              {terminal.code}
                            </p>
                          </div>
                        </div>

                        {/* Actions dropdown */}
                        {isAdmin && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => setPrintTerminal(terminal)}
                              className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              title="Imprimir reporte de ventas"
                            >
                              <Printer className="w-4 h-4 text-blue-500" />
                            </motion.button>
                            <Link href={`/dashboard/market/pos/${terminal.id}/settings`}>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <Settings className="w-4 h-4 text-gray-500" />
                              </motion.button>
                            </Link>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => setDeleteTerminal(terminal)}
                              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </motion.button>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Warehouse className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600 dark:text-gray-300">
                            {terminal.warehouseName || 'Sin almacén'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600 dark:text-gray-300">
                            {terminal.userCount} usuarios asignados
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <DollarSign className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600 dark:text-gray-300">
                            {terminal.acceptedCurrencies?.join(', ') || 'USD, CUP, MLC'}
                          </span>
                        </div>
                      </div>

                      {/* Status badge */}
                      <div className="flex items-center gap-2 mb-4">
                        {terminal.hasOpenSession ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            Sesión abierta
                          </span>
                        ) : terminal.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Disponible
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                            <XCircle className="w-3.5 h-3.5" />
                            Inactivo
                          </span>
                        )}
                        {terminal.pricelistName && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                            {terminal.pricelistName}
                          </span>
                        )}
                      </div>

                      {/* Action Button */}
                      {terminal.isActive && terminal.userHasAccess && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleEnterPOS(terminal)}
                          className={cn(
                            'w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg',
                            terminal.hasOpenSession
                              ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-green-500/25'
                              : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-blue-500/25'
                          )}
                        >
                          {terminal.hasOpenSession ? (
                            <>
                              <ShoppingCart className="w-5 h-5" />
                              Continuar Vendiendo
                            </>
                          ) : (
                            <>
                              <Play className="w-5 h-5" />
                              Abrir Caja
                            </>
                          )}
                        </motion.button>
                      )}

                      {terminal.isActive && !terminal.userHasAccess && (
                        <div className={cn(
                          'w-full py-3 rounded-xl text-center text-sm',
                          theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                        )}>
                          No tienes acceso a este terminal
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
              {deleteTerminal && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                  onClick={() => !deleting && setDeleteTerminal(null)}
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', duration: 0.3 }}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      'w-full max-w-md rounded-2xl p-6 shadow-2xl',
                      theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                    )}
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/30">
                        <Trash2 className="w-6 h-6 text-red-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                          Desactivar Terminal
                        </h3>
                        <p className="text-sm text-gray-500">
                          El terminal será desactivado
                        </p>
                      </div>
                    </div>

                    <div className={cn(
                      'p-4 rounded-xl mb-4',
                      theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                    )}>
                      <div className="flex items-center gap-3">
                        <Monitor className="w-10 h-10 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {deleteTerminal.name}
                          </p>
                          <p className="text-sm text-gray-500">{deleteTerminal.code}</p>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      ¿Estás seguro de que deseas desactivar este terminal?
                      Los datos de ventas se mantendrán pero no podrá usarse.
                    </p>

                    {deleteError && (
                      <div className={cn(
                        'p-3 rounded-lg mb-4 text-sm flex items-center gap-2',
                        theme === 'dark'
                          ? 'bg-red-900/30 text-red-300 border border-red-800'
                          : 'bg-red-50 text-red-600 border border-red-200'
                      )}>
                        <X className="w-4 h-4 flex-shrink-0" />
                        {deleteError}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { setDeleteTerminal(null); setDeleteError(null) }}
                        disabled={deleting}
                        className={cn(
                          'flex-1 py-2.5 rounded-xl transition-colors font-medium',
                          theme === 'dark'
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                          deleting && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        Cancelar
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleDeleteTerminal}
                        disabled={deleting}
                        className={cn(
                          'flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-medium shadow-lg shadow-red-500/25 transition-all',
                          deleting ? 'opacity-70 cursor-not-allowed' : 'hover:from-red-600 hover:to-red-700'
                        )}
                      >
                        {deleting ? (
                          <span className="flex items-center justify-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Desactivando...
                          </span>
                        ) : (
                          'Desactivar'
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Open Session Modal */}
            <AnimatePresence>
              {openSessionModal && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                  onClick={() => !openingSession && setOpenSessionModal(null)}
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', duration: 0.3 }}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      'w-full max-w-lg rounded-2xl p-6 shadow-2xl',
                      theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                    )}
                  >
                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                        <Play className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                          Abrir Sesión de Caja
                        </h3>
                        <p className="text-sm text-gray-500">
                          {openSessionModal.name}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 mb-6">
                      {/* Toggle between denomination and manual entry */}
                      <div className="flex items-center justify-between mb-4">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Contar por denominación
                        </label>
                        <button
                          type="button"
                          onClick={() => setUseDenominations(!useDenominations)}
                          className={cn(
                            'relative w-12 h-6 rounded-full transition-colors',
                            useDenominations ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                          )}
                        >
                          <span
                            className={cn(
                              'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm',
                              useDenominations && 'translate-x-6'
                            )}
                          />
                        </button>
                      </div>

                      {useDenominations ? (
                        <>
                          {/* Currency Tabs */}
                          <div className="flex gap-2 mb-4">
                            {(['USD', 'CUP', 'MLC'] as const).map((curr) => (
                              <button
                                key={curr}
                                onClick={() => setSelectedCurrency(curr)}
                                className={cn(
                                  'flex-1 py-2 rounded-lg font-medium transition-all',
                                  selectedCurrency === curr
                                    ? 'bg-blue-500 text-white'
                                    : theme === 'dark'
                                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                )}
                              >
                                {curr}
                              </button>
                            ))}
                          </div>

                          {/* Denomination Grid */}
                          <div className={cn(
                            'rounded-xl p-4 max-h-48 overflow-y-auto',
                            theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                          )}>
                            <div className="grid grid-cols-3 gap-2 text-xs font-medium text-gray-500 mb-2">
                              <span>Denominación</span>
                              <span className="text-center">Cantidad</span>
                              <span className="text-right">Subtotal</span>
                            </div>
                            {Object.keys(denominations[selectedCurrency])
                              .sort((a, b) => parseInt(b) - parseInt(a))
                              .map((denom) => {
                                const denomNum = parseInt(denom)
                                const count = denominations[selectedCurrency][denomNum as keyof typeof denominations[typeof selectedCurrency]]
                                return (
                                  <div key={denom} className="grid grid-cols-3 gap-2 items-center py-1.5 border-b border-gray-200 dark:border-gray-700 last:border-0">
                                    <span className="font-medium">
                                      {selectedCurrency === 'MLC' ? '€' : '$'}{denomNum.toLocaleString()}
                                    </span>
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => setDenominations(prev => ({
                                          ...prev,
                                          [selectedCurrency]: {
                                            ...prev[selectedCurrency],
                                            [denomNum]: Math.max(0, count - 1)
                                          }
                                        }))}
                                        className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 font-bold"
                                      >
                                        -
                                      </button>
                                      <input
                                        type="number"
                                        min="0"
                                        value={count}
                                        onChange={(e) => setDenominations(prev => ({
                                          ...prev,
                                          [selectedCurrency]: {
                                            ...prev[selectedCurrency],
                                            [denomNum]: Math.max(0, parseInt(e.target.value) || 0)
                                          }
                                        }))}
                                        className={cn(
                                          'w-14 text-center py-1 rounded-lg border font-medium',
                                          theme === 'dark'
                                            ? 'bg-gray-700 border-gray-600 text-white'
                                            : 'bg-white border-gray-200'
                                        )}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setDenominations(prev => ({
                                          ...prev,
                                          [selectedCurrency]: {
                                            ...prev[selectedCurrency],
                                            [denomNum]: count + 1
                                          }
                                        }))}
                                        className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 font-bold"
                                      >
                                        +
                                      </button>
                                    </div>
                                    <span className="text-right font-medium">
                                      {selectedCurrency === 'MLC' ? '€' : '$'}{(denomNum * count).toLocaleString()}
                                    </span>
                                  </div>
                                )
                              })}
                          </div>

                          {/* Currency Totals */}
                          <div className={cn(
                            'rounded-xl p-4 mt-4',
                            theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                          )}>
                            <h4 className="text-sm font-medium text-gray-500 mb-2">Totales por Moneda</h4>
                            <div className="grid grid-cols-3 gap-4">
                              <div className="text-center">
                                <p className="text-xs text-gray-500">USD</p>
                                <p className="font-bold text-lg">${denominationTotals.usd.toLocaleString()}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-xs text-gray-500">CUP</p>
                                <p className="font-bold text-lg">${denominationTotals.cup.toLocaleString()}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-xs text-gray-500">MLC</p>
                                <p className="font-bold text-lg">€{denominationTotals.mlc.toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        /* Manual Entry */
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Efectivo Inicial (entrada manual)
                          </label>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">USD</label>
                              <input
                                type="number"
                                min="0"
                                step="0.0001"
                                value={openingCash.usd}
                                onChange={(e) => setOpeningCash(prev => ({ ...prev, usd: parseFloat(e.target.value) || 0 }))}
                                className={cn(
                                  'w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                                  theme === 'dark'
                                    ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                                    : 'bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20'
                                )}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">CUP</label>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={openingCash.cup}
                                onChange={(e) => setOpeningCash(prev => ({ ...prev, cup: parseFloat(e.target.value) || 0 }))}
                                className={cn(
                                  'w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                                  theme === 'dark'
                                    ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                                    : 'bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20'
                                )}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">MLC</label>
                              <input
                                type="number"
                                min="0"
                                step="0.0001"
                                value={openingCash.mlc}
                                onChange={(e) => setOpeningCash(prev => ({ ...prev, mlc: parseFloat(e.target.value) || 0 }))}
                                className={cn(
                                  'w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                                  theme === 'dark'
                                    ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                                    : 'bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20'
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Notas (opcional)
                        </label>
                        <textarea
                          value={openingNotes}
                          onChange={(e) => setOpeningNotes(e.target.value)}
                          rows={2}
                          placeholder="Observaciones al abrir la caja..."
                          className={cn(
                            'w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 transition-all resize-none',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                              : 'bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20'
                          )}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setOpenSessionModal(null)}
                        disabled={openingSession}
                        className={cn(
                          'flex-1 py-2.5 rounded-xl transition-colors font-medium',
                          theme === 'dark'
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                          openingSession && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        Cancelar
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleOpenSession}
                        disabled={openingSession}
                        className={cn(
                          'flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium shadow-lg shadow-blue-500/25 transition-all',
                          openingSession ? 'opacity-70 cursor-not-allowed' : 'hover:from-blue-600 hover:to-blue-700'
                        )}
                      >
                        {openingSession ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Abriendo...
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            <Play className="w-4 h-4" />
                            Iniciar Sesión
                          </span>
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Print Sales Report Modal */}
            {printTerminal && (
              <PrintDocumentModal
                isOpen={!!printTerminal}
                onClose={() => setPrintTerminal(null)}
                documentType="sales_report"
                documentTitle={`Reporte de Ventas - ${printTerminal.name}`}
                documentData={{
                  terminalId: printTerminal.id,
                  terminalCode: printTerminal.code,
                  terminalName: printTerminal.name,
                  warehouseId: printTerminal.warehouseId,
                  warehouseName: printTerminal.warehouseName,
                  reportDate: new Date().toISOString(),
                  reportType: 'daily_sales'
                }}
                sourceType="pos_terminal"
                sourceId={printTerminal.id}
                onPrintSuccess={() => setPrintTerminal(null)}
              />
            )}
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
