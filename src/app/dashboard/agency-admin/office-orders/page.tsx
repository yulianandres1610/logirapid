'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Package,
  Search,
  RefreshCw,
  Truck,
  CheckCircle,
  AlertCircle,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Store,
  MapPin,
  User,
  Phone,
  Building2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import LoadingBox from '@/components/ui/LoadingBox'
import PaymentStatusBadge from '@/components/package-orders/PaymentStatusBadge'

interface PackageOrder {
  id: number
  orderNumber: string
  customerId: number
  customerName: string
  status: 'pending' | 'reprogrammed' | 'picked_up' | 'in_transit' | 'in_route' | 'delivered'
  createdAt: string
  updatedAt: string
  total?: number
  totalAmount?: number
  orderType?: 'recogida' | 'oficina'
  companyName?: string
  companyId?: number
  // Payment fields
  paymentMethod?: string
  paymentStatus?: string
  paidAmount?: number
  officeOrderData?: string | {
    senderName?: string
    senderPhone?: string
    receiverName?: string
    receiverPhone?: string
    destination?: {
      street?: string
      apartment?: string
      city?: string
      state?: string
      zipCode?: string
      country?: string
    }
    boxCount?: number
  }
}

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'
export const fetchCache = 'force-no-store'

export default function AgencyOfficeOrdersPage() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const router = useRouter()

  const [orders, setOrders] = useState<PackageOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalOrders, setTotalOrders] = useState(0)
  const ORDERS_PER_PAGE = 25
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dayFilter, setDayFilter] = useState<string>('all')

  // Fetch orders - ONLY OFFICE ORDERS (API filters by company_id automatically for agency users)
  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: ORDERS_PER_PAGE.toString(),
        orderType: 'oficina', // FILTER ONLY OFFICE ORDERS
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && statusFilter !== 'all' && { status: statusFilter }),
        ...(dayFilter && dayFilter !== 'all' && { dayFilter: dayFilter })
      })

      const response = await fetch(`/api/package-orders?${params}`)
      if (response.ok) {
        const data = await response.json()
        setOrders(data.data || [])
        setTotalOrders(data.pagination?.total || 0)
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
      showNotification('error', 'Error', 'No se pudieron cargar las órdenes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when filters change
  }, [searchTerm, statusFilter, dayFilter])

  useEffect(() => {
    fetchData()
  }, [currentPage, searchTerm, statusFilter, dayFilter])

  // Calculate statistics
  const stats = {
    total: totalOrders,
    today: orders.filter(order => {
      if (!order.createdAt) return false
      const orderDate = new Date(order.createdAt)
      if (isNaN(orderDate.getTime())) return false
      const today = new Date().toDateString()
      return orderDate.toDateString() === today
    }).length,
    inTransit: orders.filter(order => order.status === 'in_transit').length,
    delivered: orders.filter(order => order.status === 'delivered').length
  }

  const STATUSES = {
    pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: AlertCircle },
    reprogrammed: { label: 'Reprogramado', color: 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white shadow-lg border border-yellow-200 dark:from-yellow-600 dark:to-orange-700 dark:border-yellow-400', icon: AlertCircle },
    picked_up: { label: 'Recogido', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: Package },
    in_transit: { label: 'Enviado', color: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg border border-blue-200 dark:from-blue-600 dark:to-indigo-700 dark:border-blue-400', icon: Package },
    in_route: { label: 'En Reparto', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400', icon: Truck },
    delivered: { label: 'Entregado', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  }

  // Handle view order details
  const handleViewOrder = (orderId: number) => {
    window.location.href = `/dashboard/agency-admin/office-orders/${orderId}`
  }

  // Handle delete order
  const handleDeleteOrder = async (orderId: number) => {
    const order = orders.find(o => o.id === orderId)

    if (!order) {
      return
    }

    // Only allow deletion of pending orders
    if (order.status !== 'pending') {
      showNotification('error', 'No se puede eliminar', 'Solo se pueden eliminar órdenes en estado pendiente')
      return
    }

    if (!confirm(`¿Estás seguro de que deseas eliminar la orden #${order.orderNumber}? Esta acción no se puede deshacer.`)) {
      return
    }

    try {
      const response = await fetch(`/api/package-orders/${orderId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      // Try to parse JSON response, but handle empty responses
      let data: any = {}
      try {
        const text = await response.text()
        if (text) {
          data = JSON.parse(text)
        }
      } catch (e) {
        console.log('No JSON response from DELETE')
      }

      if (response.ok) {
        showNotification('success', 'Orden Eliminada', data.message || 'La orden ha sido eliminada exitosamente')
        // If current page might be empty after deletion, go to previous page
        const totalPages = Math.ceil(totalOrders / ORDERS_PER_PAGE)
        if (currentPage > 1 && orders.length === 1 && currentPage === totalPages) {
          setCurrentPage(currentPage - 1)
        } else {
          fetchData() // Refresh the orders list
        }
      } else {
        showNotification('error', 'Error al eliminar', data.error || 'No se pudo eliminar la orden')
      }
    } catch (error) {
      console.error('Error deleting order:', error)
      showNotification('error', 'Error de conexión', 'No se pudo conectar con el servidor. Intenta de nuevo.')
    }
  }

  // Helper to parse officeOrderData
  const parseOfficeData = (order: PackageOrder) => {
    if (!order.officeOrderData) return null
    try {
      if (typeof order.officeOrderData === 'string') {
        return JSON.parse(order.officeOrderData)
      }
      return order.officeOrderData
    } catch {
      return null
    }
  }

  // Helper to format address
  const formatAddress = (address: any) => {
    if (!address) return 'Sin dirección'

    // Si tiene dirección completa legacy, usarla
    if (address.fullAddress) {
      return address.fullAddress
    }

    // Si tiene campos estructurados, formatearlos
    const parts: string[] = []
    if (address.street) parts.push(address.street)
    if (address.apartment) parts.push(`Apt: ${address.apartment}`)
    if (address.city) parts.push(address.city)
    if (address.state) parts.push(address.state)
    if (address.zipCode) parts.push(address.zipCode)
    if (address.country && address.country !== 'Estados Unidos') parts.push(address.country)

    return parts.length > 0 ? parts.join(', ') : 'Sin dirección'
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {/* Total de Órdenes de Oficina */}
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
                      <Store className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Total de Órdenes de Oficina</p>
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
                    )}>En sistema</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Recogidas Hoy */}
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
                      <Package className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Recogidas Hoy</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{stats.today}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>Creadas hoy</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Enviadas (in_transit) */}
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
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-purple-600"></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-indigo-900/30 border border-indigo-800/50'
                        : 'bg-gradient-to-br from-indigo-50 to-purple-100 border border-indigo-200'
                    )}>
                      <Truck className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Enviadas</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{stats.inTransit}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>En tránsito</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Entregadas */}
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
                      )}>Entregadas</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{stats.delivered}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>Completadas</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Filters */}
          <div className="flex flex-col lg:flex-row gap-6 items-center justify-between py-6 px-4 mt-8 mb-6 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por número de orden, código de empaque, remitente o destinatario..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  'w-full h-12 pl-10 pr-4 rounded-lg border transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 text-sm'
                    : 'bg-white border-gray-300 text-black placeholder-gray-500 text-sm'
                )}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              {/* Day Filter */}
              <select
                value={dayFilter}
                onChange={(e) => setDayFilter(e.target.value)}
                className={cn(
                  'h-12 px-4 rounded-lg border transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-600 text-gray-900 dark:text-white text-sm'
                    : 'bg-white border-gray-300 text-black text-sm'
                )}
              >
                <option value="all">Todas las fechas</option>
                <option value="today">Hoy</option>
                <option value="week">Esta semana</option>
                <option value="month">Este mes</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={cn(
                  'w-full sm:w-auto h-12 px-4 rounded-lg border transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-600 text-gray-900 dark:text-white text-sm'
                    : 'bg-white border-gray-300 text-black text-sm'
                )}
              >
                <option value="all">Todos los estados</option>
                {Object.entries(STATUSES).map(([key, status]) => (
                  <option key={key} value={key}>{status.label}</option>
                ))}
              </select>

              <div className="flex gap-3 w-full sm:w-auto">
                <Button
                  onClick={fetchData}
                  className={cn(
                    'flex-1 sm:flex-none items-center justify-center gap-2 h-12',
                    'bg-blue-600 hover:bg-blue-700 text-black dark:text-white font-medium',
                    'rounded-lg transition-all duration-200',
                    'shadow-sm hover:shadow-md',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                    'dark:bg-blue-700 dark:hover:bg-blue-800 dark:text-white'
                  )}
                >
                  <RefreshCw className="w-4 h-4" />
                  Actualizar
                </Button>

                <button
                  onClick={() => window.location.href = '/dashboard/agency-admin/office-orders/create'}
                  className={cn(
                    'flex-1 sm:flex-none justify-center whitespace-nowrap',
                    'rounded-lg text-sm font-medium transition-all duration-200',
                    'h-12 bg-green-600 hover:bg-green-700 text-white',
                    'shadow-sm hover:shadow-md',
                    'focus:outline-none focus:ring-2 focus:ring-green-500/20',
                    'dark:bg-green-700 dark:hover:bg-green-800 dark:text-white',
                    'flex items-center gap-2 px-6'
                  )}
                >
                  <Store className="w-4 h-4" />
                  Nueva Orden de Oficina
                </button>
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className={cn(
            'rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}>
            {loading ? (
              <div className="p-8">
                <LoadingBox size="lg" text="Cargando órdenes de oficina..." />
              </div>
            ) : orders.length === 0 ? (
              <div className="p-8 text-center">
                <Store className="w-12 h-12 mx-auto text-gray-400" />
                <p className="mt-2 text-black dark:text-gray-400">
                  {searchTerm || statusFilter !== 'all' || dayFilter !== 'all' ? 'No se encontraron órdenes de oficina con los filtros aplicados' : 'No hay órdenes de oficina registradas'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={cn(
                    'border-b border-gray-200 dark:border-gray-700',
                    theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                  )}>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                        Orden
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-40">
                        Fecha Creación
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-48">
                        Remitente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-48">
                        Destinatario
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                        Municipio
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                        Provincia
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex-1">
                        Dirección Completa
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">
                        Pago
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">
                        Estado
                      </th>
                      <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {orders.map((order) => {
                      const officeData = parseOfficeData(order)

                      return (
                        <motion.tr
                          key={order.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={cn('hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors')}
                        >
                          {/* Orden */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-base font-bold text-black dark:text-gray-100">
                              {order.orderNumber}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {(() => {
                                const now = new Date()
                                if (!order.createdAt) {
                                  return <span>Sin fecha</span>
                                }
                                const orderDate = new Date(order.createdAt)
                                if (isNaN(orderDate.getTime())) {
                                  return <span>Fecha inválida</span>
                                }
                                const daysDiff = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24))

                                if (daysDiff === 0) {
                                  return <span className="text-blue-600 dark:text-blue-400 font-medium">Hoy</span>
                                }
                                if (daysDiff === 1) {
                                  return <span className="text-green-600 dark:text-green-400 font-medium">Ayer</span>
                                }
                                return (
                                  <span className="font-medium">
                                    {orderDate.toLocaleDateString('es-ES', {
                                      day: '2-digit',
                                      month: 'short'
                                    })}
                                  </span>
                                )
                              })()}
                            </div>
                          </td>

                          {/* Fecha Creación */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              {(() => {
                                if (!order.createdAt) return <span className="text-gray-400">Sin fecha</span>
                                const orderDate = new Date(order.createdAt)
                                if (isNaN(orderDate.getTime())) return <span className="text-gray-400">Fecha inválida</span>
                                return (
                                  <div>
                                    <div className="font-medium text-black dark:text-gray-100">
                                      {orderDate.toLocaleDateString('es-ES', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric'
                                      })}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      {orderDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  </div>
                                )
                              })()}
                            </div>
                          </td>

                          {/* Remitente */}
                          <td className="px-6 py-2">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <div className="text-sm font-medium text-black dark:text-gray-100">
                                {officeData?.senderName || order.customerName || 'N/A'}
                              </div>
                            </div>
                          </td>

                          {/* Destinatario */}
                          <td className="px-6 py-2">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <div className="text-sm font-medium text-black dark:text-gray-100">
                                {officeData?.receiverName || 'N/A'}
                              </div>
                            </div>
                          </td>

                          {/* Municipio */}
                          <td className="px-6 py-3">
                            <div className="text-sm text-black dark:text-gray-100">
                              {officeData?.destination?.city || 'N/A'}
                            </div>
                          </td>

                          {/* Provincia */}
                          <td className="px-6 py-3">
                            <div className="text-sm text-black dark:text-gray-100">
                              {officeData?.destination?.state || 'N/A'}
                            </div>
                          </td>

                          {/* Dirección Completa */}
                          <td className="px-6 py-3">
                            <div className="text-sm text-black dark:text-gray-400 flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                              <span>{officeData?.destination ? formatAddress(officeData.destination) : 'Sin dirección'}</span>
                            </div>
                          </td>

                          {/* Pago */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <PaymentStatusBadge
                                status={order.paymentStatus || 'pending_payment'}
                                size="sm"
                              />
                              {(order.totalAmount || order.total) && (order.totalAmount || order.total || 0) > 0 && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  ${(order.totalAmount || order.total || 0).toFixed(2)}
                                  {order.paymentStatus === 'partial' && order.paidAmount && (
                                    <span className="text-green-600 dark:text-green-400 ml-1">
                                      (${order.paidAmount.toFixed(2)} pagado)
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Estado */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={cn(
                              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                              STATUSES[order.status]?.color || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                            )}>
                              {(() => {
                                const StatusIcon = STATUSES[order.status]?.icon || AlertCircle
                                return <StatusIcon className="w-3 h-3 mr-1" />
                              })()}
                              {STATUSES[order.status]?.label || order.status || 'Desconocido'}
                            </span>
                          </td>

                          {/* Acciones */}
                          <td className="px-2 py-4 whitespace-nowrap">
                            <div className="flex gap-1 justify-end">
                              {/* View Details Button */}
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleViewOrder(order.id)}
                                className={cn(
                                  'relative p-2 rounded-lg transition-all duration-200',
                                  theme === 'dark'
                                    ? 'text-blue-400 hover:bg-blue-900/30'
                                    : 'text-blue-600 hover:bg-blue-50'
                                )}
                                title="Ver detalles"
                              >
                                <Eye className="w-4 h-4" />
                              </motion.button>

                              {/* Delete Button (only for pending orders) */}
                              {order.status === 'pending' ? (
                                <motion.button
                                  type="button"
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    handleDeleteOrder(order.id)
                                  }}
                                  className={cn(
                                    'relative p-2 rounded-lg transition-all duration-200',
                                    theme === 'dark'
                                      ? 'text-red-400 hover:bg-red-900/30'
                                      : 'text-red-600 hover:bg-red-50'
                                  )}
                                  title="Eliminar orden"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </motion.button>
                              ) : (
                                <div
                                  className={cn(
                                    'p-2 rounded-lg opacity-50 cursor-not-allowed',
                                    theme === 'dark'
                                      ? 'text-gray-600'
                                      : 'text-gray-400'
                                  )}
                                  title="No se puede eliminar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalOrders > ORDERS_PER_PAGE && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'mt-6 p-4 rounded-xl border',
                  theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm text-black dark:text-gray-400">
                    Mostrando {((currentPage - 1) * ORDERS_PER_PAGE) + 1} a{' '}
                    {Math.min(currentPage * ORDERS_PER_PAGE, totalOrders)} de {totalOrders} órdenes
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </Button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, Math.ceil(totalOrders / ORDERS_PER_PAGE)) }, (_, i) => {
                        const totalPages = Math.ceil(totalOrders / ORDERS_PER_PAGE)
                        let pageNum

                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className={cn(
                              'w-8 h-8 p-0',
                              currentPage === pageNum && theme === 'dark'
                                ? 'bg-blue-600 hover:bg-blue-700'
                                : currentPage === pageNum
                                ? 'bg-red-600 hover:bg-red-700'
                                : ''
                            )}
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage >= Math.ceil(totalOrders / ORDERS_PER_PAGE)}
                      className="flex items-center gap-1"
                    >
                      Siguiente
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  )
}
