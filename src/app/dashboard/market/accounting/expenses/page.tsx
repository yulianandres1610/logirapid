'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Calendar,
  Sparkles,
  X,
  Check,
  AlertCircle,
  Image as ImageIcon
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

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

export default function ExpensesPage() {
  const router = useRouter()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [byCategory, setByCategory] = useState<Array<{ categoryName: string; total: number }>>([])
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)

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
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteExpense = async (id: number) => {
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

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

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
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Receipt className="w-8 h-8 text-orange-600" />
                Gastos
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Total: ${totalExpenses.toLocaleString()} en {expenses.length} registros
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard/market/accounting/expenses/create')}
              className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium transition-colors shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Nuevo Gasto
            </button>
          </motion.div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-wrap gap-4"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500"
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
                className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500"
              />
              <span className="text-gray-400">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </motion.div>

          {/* Summary by Category */}
          {byCategory.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex flex-wrap gap-2"
            >
              {byCategory.slice(0, 6).map((cat, idx) => (
                <div
                  key={idx}
                  className="px-3 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm text-sm"
                >
                  <span className="text-gray-600 dark:text-gray-400">{cat.categoryName}:</span>
                  <span className="ml-1 font-bold text-gray-900 dark:text-white">${cat.total.toLocaleString()}</span>
                </div>
              ))}
            </motion.div>
          )}

          {/* Expenses List */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : expenses.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-lg"
            >
              <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No hay gastos registrados
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
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
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Descripción</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Categoría</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Proveedor</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Monto</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {expenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                        {new Date(expense.expenseDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {expense.description}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                          {expense.categoryName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {expense.vendorName || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-gray-900 dark:text-white">
                        ${expense.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <button
                          onClick={() => deleteExpense(expense.id)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
