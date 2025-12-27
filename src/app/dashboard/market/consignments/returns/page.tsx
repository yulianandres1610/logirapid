'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RotateCcw,
  Clock,
  CheckCircle,
  Package,
  User,
  Warehouse,
  Calendar,
  Plus,
  Loader2,
  X,
  AlertTriangle,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface ReturnData {
  id: number
  returnNumber: string
  supplier: {
    id: number
    code: string
    name: string
  }
  order: {
    id: number
    orderNumber: string
  }
  warehouse: {
    id: number
    name: string
  }
  status: string
  totalItems: number
  totalUnits: number
  totalValue: number
  reason: string | null
  createdAt: string
  validatedAt: string | null
}

interface Stats {
  pending: { count: number; value: number }
  validated: { count: number; value: number }
  completed: { count: number; value: number }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pendiente', color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30', icon: Clock },
  validated: { label: 'Validada', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30', icon: CheckCircle },
  completed: { label: 'Completada', color: 'text-green-600 bg-green-100 dark:bg-green-900/30', icon: CheckCircle }
}

export default function ConsignmentReturnsPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [returns, setReturns] = useState<ReturnData[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchReturns()
  }, [filter])

  const fetchReturns = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/consignments/returns?status=${filter}`)
      const data = await response.json()

      if (data.success) {
        setReturns(data.data.returns)
        setStats(data.data.stats)
      }
    } catch {
      console.error('Error fetching returns')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value)

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/market/consignments">
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
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Devoluciones
                </h1>
                <p className="text-gray-500 mt-1">
                  Gestiona devoluciones de productos consignados
                </p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push('/dashboard/market/consignments/returns/create')}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-shadow"
            >
              <Plus className="w-5 h-5" />
              Nueva Devolucion
            </motion.button>
          </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className={cn(
            'p-5 rounded-2xl',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-sm text-gray-500">Pendientes</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.pending.count}
            </p>
            <p className="text-sm text-amber-600">{formatCurrency(stats.pending.value)}</p>
          </div>

          <div className={cn(
            'p-5 rounded-2xl',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm text-gray-500">Validadas</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.validated.count}
            </p>
          </div>

          <div className={cn(
            'p-5 rounded-2xl',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm text-gray-500">Completadas</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.completed.count}
            </p>
            <p className="text-sm text-green-600">{formatCurrency(stats.completed.value)}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'all', label: 'Todas' },
          { key: 'pending', label: 'Pendientes' },
          { key: 'completed', label: 'Completadas' }
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'px-4 py-2 rounded-xl font-medium transition-all',
              filter === f.key
                ? 'bg-red-500 text-white'
                : theme === 'dark'
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Returns List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
        </div>
      ) : returns.length === 0 ? (
        <div className={cn(
          'text-center py-12 rounded-2xl',
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        )}>
          <RotateCcw className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay devoluciones</p>
        </div>
      ) : (
        <div className="space-y-4">
          {returns.map((ret, index) => {
            const statusConfig = STATUS_CONFIG[ret.status] || STATUS_CONFIG.pending
            const StatusIcon = statusConfig.icon

            return (
              <motion.div
                key={ret.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  'p-5 rounded-2xl',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center',
                      'bg-red-100 dark:bg-red-900/30'
                    )}>
                      <RotateCcw className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-gray-900 dark:text-white">
                          {ret.returnNumber}
                        </span>
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1',
                          statusConfig.color
                        )}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {ret.supplier.name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Package className="w-4 h-4" />
                          {ret.order.orderNumber}
                        </span>
                        <span className="flex items-center gap-1">
                          <Warehouse className="w-4 h-4" />
                          {ret.warehouse.name}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xl font-bold text-red-600">
                      {formatCurrency(ret.totalValue)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {ret.totalUnits} unidades
                    </p>
                  </div>
                </div>

                {ret.reason && (
                  <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      <span className="font-medium">Motivo:</span> {ret.reason}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Calendar className="w-3.5 h-3.5" />
                    Creada: {formatDate(ret.createdAt)}
                  </div>
                  {ret.validatedAt && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Validada: {formatDate(ret.validatedAt)}
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
