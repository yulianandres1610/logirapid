'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Receipt,
  Plus,
  Search,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  Tag,
  Calendar,
  Eye,
  Trash2,
  FileText,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Building,
  Clock
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Expense {
  id: number
  description: string
  amount: number
  currency: string
  expenseDate: string
  categoryId: number | null
  categoryName: string
  categoryCode: string | null
  accountingType: string | null
  aiSuggestion: string | null
  aiConfidence: number | null
  vendorName: string | null
  receiptPath: string | null
  createdByName: string
  createdAt: string
}

interface Category {
  id: number
  name: string
  code: string | null
  accountingType: string | null
}

interface Stats {
  total: { count: number; amount: number }
  thisMonth: { count: number; amount: number }
  lastMonth: { count: number; amount: number }
  withReceipt: { count: number }
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const ACCOUNTING_TYPE_CONFIG: Record<string, { label: string; color: string; gradient: string }> = {
  opex: { label: 'OPEX', color: 'blue', gradient: 'from-blue-400 to-blue-600' },
  cogs: { label: 'COGS', color: 'amber', gradient: 'from-amber-400 to-orange-600' },
  capex: { label: 'CAPEX', color: 'purple', gradient: 'from-purple-400 to-purple-600' }
}

export default function ExpensesPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [stats, setStats] = useState<Stats>({
    total: { count: 0, amount: 0 },
    thisMonth: { count: 0, amount: 0 },
    lastMonth: { count: 0, amount: 0 },
    withReceipt: { count: 0 }
  })
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedAccountingType, setSelectedAccountingType] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [byCategory, setByCategory] = useState<Array<{ categoryName: string; total: number }>>([])

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    fetchExpenses()
  }, [pagination.page, selectedCategory, selectedAccountingType, startDate, endDate])

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (pagination.page === 1) {
        fetchExpenses()
      } else {
        setPagination(p => ({ ...p, page: 1 }))
      }
    }, 300)
    return () => clearTimeout(debounce)
  }, [search])

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/market/accounting/categories')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setCategories(data.data.categories)
        }
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchExpenses = async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })
      if (search) params.set('search', search)
      if (selectedCategory) params.set('categoryId', selectedCategory)
      if (selectedAccountingType) params.set('accountingType', selectedAccountingType)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const response = await fetch(`/api/market/accounting/expenses?${params}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setExpenses(data.data.expenses)
          setByCategory(data.data.byCategory || [])

          // Calculate stats
          const allExpenses = data.data.expenses
          const totalAmount = allExpenses.reduce((sum: number, e: Expense) => sum + e.amount, 0)

          const now = new Date()
          const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
          const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

          const thisMonthExpenses = allExpenses.filter((e: Expense) => new Date(e.expenseDate) >= thisMonthStart)
          const lastMonthExpenses = allExpenses.filter((e: Expense) => {
            const d = new Date(e.expenseDate)
            return d >= lastMonthStart && d <= lastMonthEnd
          })

          setStats({
            total: { count: allExpenses.length, amount: totalAmount },
            thisMonth: {
              count: thisMonthExpenses.length,
              amount: thisMonthExpenses.reduce((sum: number, e: Expense) => sum + e.amount, 0)
            },
            lastMonth: {
              count: lastMonthExpenses.length,
              amount: lastMonthExpenses.reduce((sum: number, e: Expense) => sum + e.amount, 0)
            },
            withReceipt: { count: allExpenses.filter((e: Expense) => e.receiptPath).length }
          })

          setPagination(prev => ({
            ...prev,
            total: data.data.expenses.length,
            totalPages: Math.ceil(data.data.expenses.length / prev.limit)
          }))
          setLastUpdated(new Date())
        }
      }
    } catch (error) {
      console.error('Error fetching expenses:', error)
    } finally {
      if (!silent) setLoading(false)
      else setIsRefreshing(false)
    }
  }

  const handleManualRefresh = () => fetchExpenses(true)

  const deleteExpense = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('¿Eliminar este gasto?')) return

    try {
      const response = await fetch(`/api/market/accounting/expenses?id=${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        fetchExpenses()
      }
    } catch (error) {
      console.error('Error deleting expense:', error)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const monthChange = stats.lastMonth.amount > 0
    ? ((stats.thisMonth.amount - stats.lastMonth.amount) / stats.lastMonth.amount * 100)
    : 0

  const topCategory = byCategory[0] || null

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Total Gastos */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-orange-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-orange-900/30 border border-orange-800/50'
                          : 'bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200'
                      )}>
                        <Receipt className="w-6 h-6 text-orange-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Total Gastos</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{formatCurrency(stats.total.amount)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>{stats.total.count} registros</span>
                  </div>
                </div>
              </motion.div>

              {/* Este Mes */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl'
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
                        <Wallet className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Este Mes</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{formatCurrency(stats.thisMonth.amount)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {monthChange !== 0 && (
                      <span className={cn(
                        'flex items-center gap-1 text-xs font-medium',
                        monthChange > 0 ? 'text-red-500' : 'text-green-500'
                      )}>
                        {monthChange > 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {Math.abs(monthChange).toFixed(1)}% vs mes anterior
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Top Categoria */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl'
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
                        <Tag className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Top Categoría</p>
                        <p className={cn(
                          'text-xl font-bold mt-1 truncate max-w-[150px]',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{topCategory?.categoryName || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>{formatCurrency(topCategory?.total || 0)}</span>
                  </div>
                </div>
              </motion.div>

              {/* Con Recibo */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-purple-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-purple-900/30 border border-purple-800/50'
                          : 'bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200'
                      )}>
                        <FileText className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Con Recibo</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.withReceipt.count}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>
                      {stats.total.count > 0
                        ? `${Math.round((stats.withReceipt.count / stats.total.count) * 100)}% documentado`
                        : '0% documentado'
                      }
                    </span>
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
                    placeholder="Buscar por descripción o proveedor..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={cn(
                      'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 text-white focus:border-orange-500 focus:ring-orange-500/20'
                        : 'bg-white border-gray-200 text-gray-900 focus:border-orange-500 focus:ring-orange-500/20'
                    )}
                  />
                </div>

                {/* Category Filter */}
                <select
                  value={selectedCategory || ''}
                  onChange={(e) => setSelectedCategory(e.target.value || null)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all min-w-[180px]',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-orange-500 focus:ring-orange-500/20'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-orange-500 focus:ring-orange-500/20'
                  )}
                >
                  <option value="">Todas las categorías</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>

                {/* Date Range */}
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gray-400 hidden sm:block" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={cn(
                      'px-3 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all w-[140px]',
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 text-white focus:border-orange-500 focus:ring-orange-500/20'
                        : 'bg-white border-gray-200 text-gray-900 focus:border-orange-500 focus:ring-orange-500/20'
                    )}
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={cn(
                      'px-3 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all w-[140px]',
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 text-white focus:border-orange-500 focus:ring-orange-500/20'
                        : 'bg-white border-gray-200 text-gray-900 focus:border-orange-500 focus:ring-orange-500/20'
                    )}
                  />
                </div>

                {/* Clear Filters */}
                {(search || selectedCategory || selectedAccountingType || startDate || endDate) && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSearch('')
                      setSelectedCategory(null)
                      setSelectedAccountingType(null)
                      setStartDate('')
                      setEndDate('')
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
                <div className="flex items-center gap-2">
                  {lastUpdated && (
                    <span className="text-xs text-gray-400 hidden sm:inline">
                      {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleManualRefresh}
                    disabled={loading || isRefreshing}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                      isRefreshing && 'opacity-75'
                    )}
                  >
                    <RefreshCw className={cn('w-4 h-4', (loading || isRefreshing) && 'animate-spin')} />
                  </motion.button>
                </div>

                {/* Nuevo Gasto */}
                <Link href="/dashboard/market/accounting/expenses/create">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/25"
                  >
                    <Plus className="w-5 h-5" />
                    Nuevo Gasto
                  </motion.button>
                </Link>
              </div>
            </motion.div>

            {/* Category Pills */}
            {byCategory.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="flex flex-wrap gap-2"
              >
                {byCategory.slice(0, 8).map((cat, idx) => (
                  <motion.button
                    key={idx}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      const category = categories.find(c => c.name === cat.categoryName)
                      if (category) {
                        setSelectedCategory(selectedCategory === String(category.id) ? null : String(category.id))
                      }
                    }}
                    className={cn(
                      'px-4 py-2 rounded-xl text-sm font-medium transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800 hover:bg-gray-700'
                        : 'bg-white shadow-sm hover:shadow-md'
                    )}
                  >
                    <span className="text-gray-500">{cat.categoryName}:</span>
                    <span className={cn(
                      'ml-1 font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>{formatCurrency(cat.total)}</span>
                  </motion.button>
                ))}
              </motion.div>
            )}

            {/* Expenses Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className={cn(
                'rounded-2xl border shadow-xl overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={cn(
                      'border-b',
                      theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                    )}>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedor</th>
                      <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Recibo</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan={7} className="py-4 px-4">
                            <div className="animate-pulse flex items-center gap-3">
                              <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                              <div className="flex-1">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : expenses.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center">
                          <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className="text-gray-500 dark:text-gray-400">No hay gastos registrados</p>
                          <Link href="/dashboard/market/accounting/expenses/create">
                            <button className="mt-3 text-sm text-orange-500 hover:text-orange-600">
                              Registrar primer gasto
                            </button>
                          </Link>
                        </td>
                      </tr>
                    ) : (
                      expenses.map((expense, index) => (
                        <motion.tr
                          key={expense.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          onClick={() => router.push(`/dashboard/market/accounting/expenses/${expense.id}`)}
                          className={cn(
                            'group transition-colors cursor-pointer',
                            theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                          )}
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {formatDate(expense.expenseDate)}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <p className={cn(
                              'text-sm font-medium truncate max-w-xs',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {expense.description}
                            </p>
                          </td>
                          <td className="py-4 px-4">
                            <span className={cn(
                              'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
                              theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                            )}>
                              <Tag className="w-3 h-3" />
                              {expense.categoryName || 'Sin categoría'}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            {expense.vendorName ? (
                              <div className="flex items-center gap-2">
                                <Building className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-600 dark:text-gray-300">{expense.vendorName}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className="text-sm font-bold text-orange-600">
                              {formatCurrency(expense.amount)}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            {expense.receiptPath ? (
                              <span className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
                                theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                              )}>
                                <FileText className="w-3 h-3" />
                                Sí
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">No</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Link href={`/dashboard/market/accounting/expenses/${expense.id}`}>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                  title="Ver detalle"
                                >
                                  <Eye className="w-4 h-4 text-blue-500" />
                                </motion.button>
                              </Link>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => deleteExpense(expense.id, e)}
                                className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </motion.button>
                            </div>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className={cn(
                  'flex items-center justify-between px-4 py-3 border-t',
                  theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                )}>
                  <p className="text-sm text-gray-500">
                    Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
                  </p>
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                      disabled={pagination.page === 1}
                      className={cn(
                        'p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                        theme === 'dark'
                          ? 'hover:bg-gray-700 text-gray-300'
                          : 'hover:bg-gray-200 text-gray-600'
                      )}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </motion.button>
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {pagination.page} / {pagination.totalPages}
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                      disabled={pagination.page === pagination.totalPages}
                      className={cn(
                        'p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                        theme === 'dark'
                          ? 'hover:bg-gray-700 text-gray-300'
                          : 'hover:bg-gray-200 text-gray-600'
                      )}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </motion.button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
