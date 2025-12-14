'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import {
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  AlertCircle,
  Eye,
  Ban,
  ChevronLeft,
  ChevronRight,
  Loader2,
  DollarSign,
  User,
  Building2,
  Calendar
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

interface CashDeliveryOrder {
  id: number
  order_number: string
  broker_company_name: string
  broker_name: string
  broker_province: string
  delivery_user_name: string
  delivery_user_phone: string
  currency: string
  total_amount: string
  total_bills: number
  deadline_date: string
  status: string
  created_at: string
  completed_at?: string
}

const STATUS_CONFIG: { [key: string]: { label: string; color: string; bgColor: string; icon: any } } = {
  pending: { label: 'Pendiente', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', icon: Clock },
  in_transit: { label: 'En Tránsito', color: 'text-blue-500', bgColor: 'bg-blue-500/10', icon: Truck },
  pending_reception: { label: 'Recibiendo', color: 'text-purple-500', bgColor: 'bg-purple-500/10', icon: DollarSign },
  validating: { label: 'Validando OTP', color: 'text-orange-500', bgColor: 'bg-orange-500/10', icon: AlertCircle },
  completed: { label: 'Completado', color: 'text-green-500', bgColor: 'bg-green-500/10', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'text-red-500', bgColor: 'bg-red-500/10', icon: XCircle },
  blocked: { label: 'Bloqueado', color: 'text-red-600', bgColor: 'bg-red-600/10', icon: Ban }
}

export default function CashDeliveryListPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [orders, setOrders] = useState<CashDeliveryOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    loadOrders()
  }, [page, statusFilter])

  const loadOrders = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      })
      if (statusFilter) params.append('status', statusFilter)

      const res = await fetch(`/api/admin/cash-delivery?${params}`)
      const data = await res.json()

      if (data.success) {
        setOrders(data.data.orders || [])
        setTotalPages(data.data.pagination?.totalPages || 1)
        setTotalCount(data.data.pagination?.totalCount || 0)
      }
    } catch (error) {
      console.error('Error loading orders:', error)
      showNotification('error', 'Error', 'Error al cargar las órdenes')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = async (order: CashDeliveryOrder) => {
    if (!confirm(`¿Cancelar orden ${order.order_number}?`)) return

    try {
      const res = await fetch(`/api/admin/cash-delivery/${order.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelada por administrador' })
      })

      const data = await res.json()
      if (data.success) {
        showNotification('success', 'Orden cancelada', data.message)
        loadOrders()
      } else {
        showNotification('error', 'Error', data.error)
      }
    } catch (error) {
      showNotification('error', 'Error', 'Error al cancelar la orden')
    }
  }

  const filteredOrders = orders.filter(order =>
    order.order_number.toLowerCase().includes(search.toLowerCase()) ||
    order.broker_company_name?.toLowerCase().includes(search.toLowerCase()) ||
    order.delivery_user_name?.toLowerCase().includes(search.toLowerCase())
  )

  const cardBg = theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'
  const inputBg = theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'
  const textPrimary = theme === 'dark' ? 'text-white' : 'text-gray-900'
  const textSecondary = theme === 'dark' ? 'text-gray-400' : 'text-gray-600'

  return (
    <DashboardLayout>
      <div className="min-h-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-2xl font-bold ${textPrimary}`}>
              Entregas de Efectivo
            </h1>
            <p className={textSecondary}>
              Gestión de entregas de efectivo a brokers
            </p>
          </div>

          <button
            onClick={() => router.push('/dashboard/admin/brokers/cash-delivery')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-exa-primary to-exa-secondary text-white font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Nueva Entrega
          </button>
        </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pendientes', value: orders.filter(o => ['pending', 'in_transit'].includes(o.status)).length, color: 'from-yellow-500 to-amber-500' },
          { label: 'En Proceso', value: orders.filter(o => ['pending_reception', 'validating'].includes(o.status)).length, color: 'from-blue-500 to-cyan-500' },
          { label: 'Completadas', value: orders.filter(o => o.status === 'completed').length, color: 'from-green-500 to-emerald-500' },
          { label: 'Total', value: totalCount, color: 'from-purple-500 to-pink-500' }
        ].map((stat, i) => (
          <div key={i} className={`${cardBg} rounded-xl p-4 relative overflow-hidden`}>
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.color}`} />
            <p className={`text-sm ${textSecondary}`}>{stat.label}</p>
            <p className={`text-2xl font-bold ${textPrimary}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className={`${cardBg} rounded-2xl p-4`}>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por número, broker o repartidor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border ${inputBg} ${textPrimary} focus:outline-none focus:ring-2 focus:ring-exa-primary`}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className={`px-4 py-2 rounded-lg border ${inputBg} ${textPrimary} focus:outline-none focus:ring-2 focus:ring-exa-primary`}
          >
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Orders List */}
      <div className={`${cardBg} rounded-2xl overflow-hidden`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className={`h-8 w-8 animate-spin ${textSecondary}`} />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className={`h-12 w-12 mx-auto mb-4 ${textSecondary}`} />
            <p className={textSecondary}>No se encontraron órdenes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}>
                <tr>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Orden</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Broker</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Repartidor</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Monto</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Fecha Límite</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Estado</th>
                  <th className={`px-4 py-3 text-right text-xs font-medium ${textSecondary} uppercase`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredOrders.map(order => {
                  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
                  const StatusIcon = statusConfig.icon

                  return (
                    <tr key={order.id} className={`${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50'} transition-colors`}>
                      <td className="px-4 py-4">
                        <p className={`font-medium ${textPrimary}`}>{order.order_number}</p>
                        <p className={`text-xs ${textSecondary}`}>
                          {new Date(order.created_at).toLocaleDateString('es-ES')}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Building2 className={`h-4 w-4 ${textSecondary}`} />
                          <div>
                            <p className={textPrimary}>{order.broker_company_name || order.broker_name}</p>
                            <p className={`text-xs ${textSecondary}`}>{order.broker_province}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <User className={`h-4 w-4 ${textSecondary}`} />
                          <div>
                            <p className={textPrimary}>{order.delivery_user_name}</p>
                            <p className={`text-xs ${textSecondary}`}>{order.delivery_user_phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className={`font-semibold ${textPrimary}`}>
                          {order.currency} ${parseFloat(order.total_amount).toLocaleString()}
                        </p>
                        <p className={`text-xs ${textSecondary}`}>{order.total_bills} billetes</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar className={`h-4 w-4 ${textSecondary}`} />
                          <span className={textPrimary}>
                            {new Date(order.deadline_date + 'T00:00:00').toLocaleDateString('es-ES')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => router.push(`/dashboard/admin/brokers/cash-delivery/${order.id}`)}
                            className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'} transition-colors`}
                            title="Ver detalles"
                          >
                            <Eye className={`h-4 w-4 ${textSecondary}`} />
                          </button>
                          {['pending', 'in_transit'].includes(order.status) && (
                            <button
                              onClick={() => handleCancel(order)}
                              className={`p-2 rounded-lg hover:bg-red-500/10 transition-colors`}
                              title="Cancelar"
                            >
                              <XCircle className="h-4 w-4 text-red-500" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={`flex items-center justify-between px-4 py-3 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-100'}`}>
            <p className={`text-sm ${textSecondary}`}>
              Página {page} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'} disabled:opacity-50 transition-colors`}
              >
                <ChevronLeft className={`h-4 w-4 ${textSecondary}`} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'} disabled:opacity-50 transition-colors`}
              >
                <ChevronRight className={`h-4 w-4 ${textSecondary}`} />
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </DashboardLayout>
  )
}
