'use client'

import { useEffect, useState, use } from 'react'
import { motion } from 'framer-motion'
import {
  Receipt,
  ArrowLeft,
  Calendar,
  DollarSign,
  Building,
  Tag,
  FileText,
  Loader2,
  Printer,
  Download,
  Sparkles,
  User,
  Clock,
  ExternalLink,
  Eye,
  X,
  Image as ImageIcon,
  FileIcon,
  Trash2,
  Edit,
  ShoppingBag,
  Package
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface ExpenseItem {
  id: number
  description: string
  amount: number
  suggestedCategory: string | null
  createdAt: string
}

interface ExpenseDetail {
  id: number
  description: string
  amount: number
  currency: string
  expenseDate: string
  categoryId: number | null
  categoryName: string | null
  categoryCode: string | null
  accountingType: string | null
  aiSuggestion: string | null
  aiConfidence: number | null
  aiAnalysis: string | null
  vendorName: string | null
  receiptPath: string | null
  receiptType: string | null
  createdById: number
  createdByName: string
  createdByEmail: string
  createdAt: string
  updatedAt: string
  items: ExpenseItem[]
  hasItems: boolean
}

const ACCOUNTING_TYPE_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  opex: { label: 'OPEX', color: 'blue', description: 'Gasto Operativo' },
  cogs: { label: 'COGS', color: 'amber', description: 'Costo de Ventas' },
  capex: { label: 'CAPEX', color: 'purple', description: 'Gasto de Capital' }
}

export default function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const { theme } = useTheme()
  const router = useRouter()
  const [expense, setExpense] = useState<ExpenseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchExpense()
  }, [resolvedParams.id])

  const fetchExpense = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/market/accounting/expenses/${resolvedParams.id}`)
      const data = await response.json()
      if (data.success) {
        setExpense(data.data)
      } else {
        setError(data.error || 'Error al cargar el gasto')
      }
    } catch (err) {
      console.error('Error:', err)
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de eliminar este gasto? Esta acción no se puede deshacer.')) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/market/accounting/expenses?id=${resolvedParams.id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.success) {
        router.push('/dashboard/market/accounting/expenses')
      } else {
        alert(data.error || 'Error al eliminar')
      }
    } catch (err) {
      console.error('Error:', err)
      alert('Error de conexión')
    } finally {
      setDeleting(false)
    }
  }

  const formatCurrency = (value: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('es-US', { style: 'currency', currency }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getReceiptUrl = (path: string) => {
    if (path.startsWith('http')) return path
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${path}`
  }

  const isPdfReceipt = expense?.receiptType === 'application/pdf' || expense?.receiptPath?.endsWith('.pdf')

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (error || !expense) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6">
            <div className={cn(
              'max-w-xl mx-auto text-center p-8 rounded-2xl',
              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            )}>
              <Receipt className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {error || 'Gasto no encontrado'}
              </h2>
              <Link href="/dashboard/market/accounting/expenses">
                <button className="text-orange-500 hover:text-orange-600">
                  Volver a gastos
                </button>
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const accountingConfig = expense.accountingType ? ACCOUNTING_TYPE_CONFIG[expense.accountingType] : null

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-5xl mx-auto space-y-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/dashboard/market/accounting/expenses">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                    )}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </motion.button>
                </Link>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className={cn(
                      'text-2xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Gasto #{expense.id}</h1>
                    {accountingConfig && (
                      <span className={cn(
                        'inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium',
                        accountingConfig.color === 'blue' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                        accountingConfig.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                        accountingConfig.color === 'purple' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      )}>
                        {accountingConfig.label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{expense.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => window.print()}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl transition-colors',
                    theme === 'dark'
                      ? 'bg-gray-700 text-white hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  <Printer className="w-4 h-4" />
                  Imprimir
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Eliminar
                </motion.button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={cn(
                'p-4 rounded-xl',
                theme === 'dark' ? 'bg-orange-900/20' : 'bg-orange-50'
              )}>
                <p className="text-sm text-orange-600 mb-1">Monto Total</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(expense.amount, expense.currency)}
                </p>
              </div>
              <div className={cn(
                'p-4 rounded-xl',
                theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
              )}>
                <p className="text-sm text-gray-500 mb-1">Fecha del Gasto</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatDate(expense.expenseDate)}
                </p>
              </div>
              <div className={cn(
                'p-4 rounded-xl',
                theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
              )}>
                <p className="text-sm text-gray-500 mb-1">Categoría</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {expense.categoryName || 'Sin categoría'}
                </p>
              </div>
              <div className={cn(
                'p-4 rounded-xl',
                theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
              )}>
                <p className="text-sm text-gray-500 mb-1">Proveedor</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {expense.vendorName || 'No especificado'}
                </p>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Details */}
              <div className="space-y-6">
                {/* Expense Info */}
                <div className={cn(
                  'p-5 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                )}>
                  <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Información del Gasto
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                      )}>
                        <DollarSign className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Monto</p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(expense.amount, expense.currency)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                      )}>
                        <Calendar className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Fecha del Gasto</p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {formatDate(expense.expenseDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                      )}>
                        <Tag className="w-5 h-5 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Categoría</p>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {expense.categoryName || 'Sin categoría'}
                          </p>
                          {expense.categoryCode && (
                            <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                              {expense.categoryCode}
                            </span>
                          )}
                        </div>
                        {accountingConfig && (
                          <p className="text-xs text-gray-500 mt-1">{accountingConfig.description}</p>
                        )}
                      </div>
                    </div>
                    {expense.vendorName && (
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'p-2 rounded-lg',
                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                        )}>
                          <Building className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Proveedor</p>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {expense.vendorName}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Productos/Items del Recibo */}
                {expense.hasItems && expense.items.length > 0 && (
                  <div className={cn(
                    'p-5 rounded-2xl border',
                    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                  )}>
                    <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4" />
                      Productos del Recibo ({expense.items.length})
                    </h3>
                    <div className="space-y-3">
                      {expense.items.map((item, index) => (
                        <div
                          key={item.id}
                          className={cn(
                            'flex items-center justify-between p-3 rounded-xl',
                            theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium',
                              theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'
                            )}>
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white text-sm">
                                {item.description}
                              </p>
                              {item.suggestedCategory && (
                                <p className="text-xs text-gray-500">
                                  {item.suggestedCategory}
                                </p>
                              )}
                            </div>
                          </div>
                          <p className="font-semibold text-orange-600">
                            {formatCurrency(item.amount, expense.currency)}
                          </p>
                        </div>
                      ))}
                      {/* Total de items */}
                      <div className={cn(
                        'flex items-center justify-between pt-3 mt-3 border-t',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <p className="font-medium text-gray-500">
                          Subtotal productos
                        </p>
                        <p className="font-bold text-gray-900 dark:text-white">
                          {formatCurrency(
                            expense.items.reduce((sum, item) => sum + item.amount, 0),
                            expense.currency
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* AI Analysis */}
                {(expense.aiSuggestion || expense.aiAnalysis) && (
                  <div className={cn(
                    'p-5 rounded-2xl border',
                    theme === 'dark' ? 'bg-purple-900/20 border-purple-800' : 'bg-purple-50 border-purple-200'
                  )}>
                    <h3 className="text-sm font-medium text-purple-600 mb-3 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Análisis de IA
                    </h3>
                    {expense.aiSuggestion && (
                      <div className="mb-3">
                        <p className="text-xs text-purple-500 mb-1">Categoría Sugerida</p>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-purple-700 dark:text-purple-300">
                            {expense.aiSuggestion}
                          </span>
                          {expense.aiConfidence && (
                            <span className="text-xs px-2 py-0.5 bg-purple-200 dark:bg-purple-800 rounded-full">
                              {Math.round(expense.aiConfidence * 100)}% confianza
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {expense.aiAnalysis && (
                      <div>
                        <p className="text-xs text-purple-500 mb-1">Razonamiento</p>
                        <p className="text-sm text-purple-700 dark:text-purple-300">
                          {expense.aiAnalysis}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Metadata */}
                <div className={cn(
                  'p-5 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                )}>
                  <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Registro
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Creado por:</span>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {expense.createdByName}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Fecha de registro:</span>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {formatDateTime(expense.createdAt)}
                      </span>
                    </div>
                    {expense.updatedAt !== expense.createdAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Última actualización:</span>
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {formatDateTime(expense.updatedAt)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Receipt */}
              <div className="space-y-6">
                <div className={cn(
                  'p-5 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                )}>
                  <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Recibo Original
                  </h3>

                  {expense.receiptPath ? (
                    <div className="space-y-4">
                      {/* Receipt Preview */}
                      <div
                        className={cn(
                          'relative rounded-xl overflow-hidden cursor-pointer group',
                          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
                        )}
                        onClick={() => setShowReceiptModal(true)}
                      >
                        {isPdfReceipt ? (
                          <div className="aspect-[3/4] flex flex-col items-center justify-center p-8">
                            <FileIcon className="w-16 h-16 text-red-500 mb-4" />
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              Documento PDF
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Click para ver
                            </p>
                          </div>
                        ) : (
                          <div className="aspect-[3/4] relative">
                            <img
                              src={getReceiptUrl(expense.receiptPath)}
                              alt="Recibo"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        )}
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="flex items-center gap-2 text-white">
                            <Eye className="w-5 h-5" />
                            <span>Ver completo</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setShowReceiptModal(true)}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-colors',
                            theme === 'dark'
                              ? 'bg-gray-700 text-white hover:bg-gray-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          )}
                        >
                          <Eye className="w-4 h-4" />
                          Ver
                        </motion.button>
                        <motion.a
                          href={getReceiptUrl(expense.receiptPath)}
                          target="_blank"
                          rel="noopener noreferrer"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-colors',
                            theme === 'dark'
                              ? 'bg-gray-700 text-white hover:bg-gray-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          )}
                        >
                          <ExternalLink className="w-4 h-4" />
                          Abrir
                        </motion.a>
                        <motion.a
                          href={getReceiptUrl(expense.receiptPath)}
                          download
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 text-white hover:bg-orange-700 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </motion.a>
                      </div>
                    </div>
                  ) : (
                    <div className={cn(
                      'aspect-[3/4] rounded-xl flex flex-col items-center justify-center',
                      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
                    )}>
                      <ImageIcon className="w-16 h-16 text-gray-400 mb-4" />
                      <p className="text-gray-500">No hay recibo adjunto</p>
                    </div>
                  )}
                </div>

                {/* Description Card */}
                <div className={cn(
                  'p-5 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                )}>
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Descripción</h3>
                  <p className="text-gray-700 dark:text-gray-300">{expense.description}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Receipt Modal */}
        {showReceiptModal && expense.receiptPath && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setShowReceiptModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="relative max-w-4xl max-h-[90vh] w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowReceiptModal(false)}
                className="absolute -top-12 right-0 p-2 text-white hover:text-gray-300"
              >
                <X className="w-8 h-8" />
              </button>

              {isPdfReceipt ? (
                <iframe
                  src={getReceiptUrl(expense.receiptPath)}
                  className="w-full h-[80vh] rounded-xl"
                />
              ) : (
                <img
                  src={getReceiptUrl(expense.receiptPath)}
                  alt="Recibo"
                  className="w-full max-h-[80vh] object-contain rounded-xl"
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  )
}
