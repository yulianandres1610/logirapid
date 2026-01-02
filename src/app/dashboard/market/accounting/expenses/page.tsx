'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Receipt,
  Plus,
  Filter,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  Eye,
  Trash2,
  Building,
  Tag,
  ChevronRight,
  Loader2,
  FileText
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

interface ExpenseSummary {
  totalExpenses: number
  totalAmount: number
  thisMonth: number
  lastMonth: number
  avgPerExpense: number
  topCategory: string | null
  topCategoryAmount: number
}

export default function ExpensesPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [byCategory, setByCategory] = useState<Array<{ categoryName: string; total: number }>>([])
  const [summary, setSummary] = useState<ExpenseSummary | null>(null)

  useEffect(() => {
    fetchData()
  }, [categoryFilter, startDate, endDate])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch categories
      const catResponse = await fetch('/api/market/accounting/categories')
      if (catResponse.ok) {
        const catResult = await catResponse.json()
        if (catResult.success) {
          setCategories(catResult.data.categories)
        }
      }

      // Fetch expenses
      const params = new URLSearchParams()
      if (categoryFilter) params.set('categoryId', categoryFilter)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const response = await fetch(`/api/market/accounting/expenses?${params}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setExpenses(result.data.expenses)
          setByCategory(result.data.byCategory || [])

          // Calculate summary
          const allExpenses = result.data.expenses
          const total = allExpenses.reduce((sum: number, e: Expense) => sum + e.amount, 0)

          // This month
          const now = new Date()
          const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
          const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

          const thisMonth = allExpenses
            .filter((e: Expense) => new Date(e.expenseDate) >= thisMonthStart)
            .reduce((sum: number, e: Expense) => sum + e.amount, 0)

          const lastMonth = allExpenses
            .filter((e: Expense) => {
              const d = new Date(e.expenseDate)
              return d >= lastMonthStart && d <= lastMonthEnd
            })
            .reduce((sum: number, e: Expense) => sum + e.amount, 0)

          const topCat = result.data.byCategory?.[0] || null

          setSummary({
            totalExpenses: allExpenses.length,
            totalAmount: total,
            thisMonth,
            lastMonth,
            avgPerExpense: allExpenses.length > 0 ? total / allExpenses.length : 0,
            topCategory: topCat?.categoryName || null,
            topCategoryAmount: topCat?.total || 0
          })
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteExpense = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('¿Eliminar este gasto?')) return

    try {
      const response = await fetch(`/api/market/accounting/expenses?id=${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('Error deleting expense:', error)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value)
  }

  const monthChange = summary && summary.lastMonth > 0
    ? ((summary.thisMonth - summary.lastMonth) / summary.lastMonth * 100)
    : 0

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <h1 className={cn(
                "text-2xl md:text-3xl font-bold flex items-center gap-3",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                <Receipt className="w-8 h-8 text-orange-600" />
                Gastos
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Gestiona los gastos de tu negocio
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push('/dashboard/market/accounting/expenses/create')}
              className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium transition-colors shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Nuevo Gasto
            </motion.button>
          </motion.div>

          {/* Summary Cards */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {/* Total Gastos */}
            <div className={cn(
              'p-5 rounded-2xl border',
              theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
            )}>
              <div className="flex items-center gap-3 mb-3">
                <div className={cn(
                  'p-2 rounded-lg',
                  theme === 'dark' ? 'bg-orange-900/30' : 'bg-orange-100'
                )}>
                  <DollarSign className="w-5 h-5 text-orange-600" />
                </div>
                <span className="text-sm text-gray-500">Total Gastos</span>
              </div>
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrency(summary?.totalAmount || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {summary?.totalExpenses || 0} registros
              </p>
            </div>

            {/* Este Mes */}
            <div className={cn(
              'p-5 rounded-2xl border',
              theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
            )}>
              <div className="flex items-center gap-3 mb-3">
                <div className={cn(
                  'p-2 rounded-lg',
                  theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                )}>
                  <Wallet className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-sm text-gray-500">Este Mes</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(summary?.thisMonth || 0)}
              </p>
              {monthChange !== 0 && (
                <div className={cn(
                  'flex items-center gap-1 text-xs mt-1',
                  monthChange > 0 ? 'text-red-500' : 'text-green-500'
                )}>
                  {monthChange > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {Math.abs(monthChange).toFixed(1)}% vs mes anterior
                </div>
              )}
            </div>

            {/* Promedio */}
            <div className={cn(
              'p-5 rounded-2xl border',
              theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
            )}>
              <div className="flex items-center gap-3 mb-3">
                <div className={cn(
                  'p-2 rounded-lg',
                  theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                )}>
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-sm text-gray-500">Promedio</span>
              </div>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(summary?.avgPerExpense || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                por gasto
              </p>
            </div>

            {/* Top Categoría */}
            <div className={cn(
              'p-5 rounded-2xl border',
              theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
            )}>
              <div className="flex items-center gap-3 mb-3">
                <div className={cn(
                  'p-2 rounded-lg',
                  theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-100'
                )}>
                  <Tag className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="text-sm text-gray-500">Top Categoría</span>
              </div>
              <p className="text-lg font-bold text-emerald-600 truncate">
                {summary?.topCategory || 'N/A'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {formatCurrency(summary?.topCategoryAmount || 0)}
              </p>
            </div>
          </motion.div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={cn(
              'flex flex-wrap gap-4 p-4 rounded-xl',
              theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
            )}
          >
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={cn(
                  'px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-orange-500',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-white border-gray-200 text-gray-900'
                )}
              >
                <option value="">Todas las categorías</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={cn(
                  'px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-orange-500',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-white border-gray-200 text-gray-900'
                )}
              />
              <span className="text-gray-400">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={cn(
                  'px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-orange-500',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-white border-gray-200 text-gray-900'
                )}
              />
            </div>
          </motion.div>

          {/* By Category Summary */}
          {byCategory.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap gap-2"
            >
              {byCategory.slice(0, 8).map((cat, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm'
                  )}
                >
                  <span className="text-gray-500">{cat.categoryName}:</span>
                  <span className={cn(
                    'ml-1 font-bold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>{formatCurrency(cat.total)}</span>
                </div>
              ))}
            </motion.div>
          )}

          {/* Expenses List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : expenses.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                'text-center py-12 rounded-2xl',
                theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-lg'
              )}
            >
              <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className={cn(
                'text-lg font-medium mb-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                No hay gastos registrados
              </h3>
              <p className="text-gray-500 mb-4">
                Registra tu primer gasto
              </p>
              <button
                onClick={() => router.push('/dashboard/market/accounting/expenses/create')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                <Plus className="w-4 h-4" />
                Nuevo Gasto
              </button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className={cn(
                'rounded-2xl border overflow-hidden',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
              )}
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={cn(
                    theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                  )}>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Recibo</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {expenses.map((expense) => (
                      <tr
                        key={expense.id}
                        onClick={() => router.push(`/dashboard/market/accounting/expenses/${expense.id}`)}
                        className={cn(
                          'cursor-pointer transition-colors',
                          theme === 'dark'
                            ? 'hover:bg-gray-700/50'
                            : 'hover:bg-gray-50'
                        )}
                      >
                        <td className="px-4 py-4 text-sm whitespace-nowrap">
                          <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                            {new Date(expense.expenseDate).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <p className={cn(
                            'text-sm font-medium truncate max-w-xs',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {expense.description}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <span className={cn(
                            'px-2 py-1 rounded text-xs font-medium',
                            theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                          )}>
                            {expense.categoryName || 'Sin categoría'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">
                          {expense.vendorName || '-'}
                        </td>
                        <td className="px-4 py-4 text-sm text-right">
                          <span className="font-bold text-orange-600">
                            {formatCurrency(expense.amount)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {expense.receiptPath ? (
                            <span className={cn(
                              'inline-flex items-center gap-1 px-2 py-1 rounded text-xs',
                              theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                            )}>
                              <FileText className="w-3 h-3" />
                              Sí
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">No</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/dashboard/market/accounting/expenses/${expense.id}`}>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 text-gray-500 hover:text-blue-600 transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </motion.button>
                            </Link>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => deleteExpense(expense.id, e)}
                              className="p-1.5 text-gray-500 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </motion.button>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
