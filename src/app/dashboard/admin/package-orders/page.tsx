'use client'

import { useState, useEffect } from 'react'

// Función para remover ceros iniciales de direcciones
const removeLeadingZeros = (address: string): string => {
  if (!address) return address
  return address.replace(/^0+/, '')
}

import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Package,
  Plus,
  Search,
  RefreshCw,
  Archive,
  Truck,
  Calendar,
  CheckCircle,
  AlertCircle,
  XCircle,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Clock,
  BarChart3
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import ViewToggle from '@/components/ui/ViewToggle'
import PackageDeliveryMap from '@/components/maps/PackageDeliveryMap'

interface PackageOrder {
  id: number
  orderNumber: string
  customerId: number
  customerName: string
  customerAddress?: string
  services: string[]
  notes?: string
  scheduledDate?: string
  timeSlot?: string
  status: 'pending' | 'scheduled' | 'picked_up' | 'delivered' | 'cancelled' | 'in_transit' | 'in_route'
  createdAt: string
  updatedAt: string
  firstName?: string
  lastName?: string
  phone?: string
  total?: number
  email?: string
  address?: string
  customerNotes?: string
  // Coordinates for mapping
  latitude?: number | null
  longitude?: number | null
}

export default function PackageOrdersPage() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [orders, setOrders] = useState<PackageOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalOrders, setTotalOrders] = useState(0)
  const ORDERS_PER_PAGE = 10
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dayFilter, setDayFilter] = useState<string>('all')

  // View state - inicializar desde URL o por defecto 'table'
  const [activeView, setActiveView] = useState<'table' | 'map' | 'statistics'>(() => {
    const viewFromUrl = searchParams.get('view')
    return viewFromUrl === 'map' ? 'map' : viewFromUrl === 'statistics' ? 'statistics' : 'table'
  })
  const [allOrders, setAllOrders] = useState<PackageOrder[]>([])

  // Fetch orders
  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: ORDERS_PER_PAGE.toString(),
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

  // Fetch all orders for map view on component mount
  useEffect(() => {
    fetchAllOrders()
  }, [])

  // Actualizar URL cuando cambia la vista
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())

    if (activeView === 'map') {
      params.set('view', 'map')
    } else {
      params.delete('view')
    }

    const newUrl = `/dashboard/admin/package-orders${params.toString() ? '?' + params.toString() : ''}`
    router.push(newUrl, { scroll: false })
  }, [activeView, searchParams, router])

  // Orders are now filtered on the server side

  // Calculate statistics
  const stats = {
    total: orders.length,
    pickups: orders.filter(order =>
      order.services.some(service =>
        service.toLowerCase().includes('recogida') || service.toLowerCase().includes('pickup')
      )
    ).length,
    deliveries: orders.filter(order =>
      order.services.some(service =>
        service.toLowerCase().includes('entrega') || service.toLowerCase().includes('delivery')
      )
    ).length,
    scheduledToday: orders.filter(order => {
      if (!order.scheduledDate) return false
      const orderDate = new Date(order.scheduledDate).toDateString()
      const today = new Date().toDateString()
      return orderDate === today
    }).length
  }

  // Fetch all orders for map view
  const fetchAllOrders = async () => {
    try {
      const response = await fetch('/api/package-orders?limit=1000')
      if (response.ok) {
        const data = await response.json()
        setAllOrders(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching all orders:', error)
    }
  }

  // Handle order click from map
  const handleOrderClick = (order: PackageOrder) => {
    setActiveView('table')
    showNotification('info', 'Orden Seleccionada', `Orden ${order.orderNumber} seleccionada desde el mapa`)
  }

  const STATUSES = {
    pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: AlertCircle },
    scheduled: { label: 'Programado', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: Calendar },
    picked_up: { label: 'Recogido', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: Package },
    delivered: { label: 'Entregado', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
    cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
    // Additional common statuses that might exist in the database
    in_transit: { label: 'En Ruta', color: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg border border-blue-200 dark:from-blue-600 dark:to-indigo-700 dark:border-blue-400', icon: Package },
    in_route: { label: 'En Ruta', color: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg border border-blue-200 dark:from-blue-600 dark:to-indigo-700 dark:border-blue-400', icon: Package },
    reprogrammed: { label: 'Reprogramada', color: 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white shadow-lg border border-yellow-200 dark:from-yellow-600 dark:to-orange-700 dark:border-yellow-400', icon: AlertCircle },
    processing: { label: 'Procesando', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: AlertCircle },
    ready: { label: 'Listo', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400', icon: CheckCircle },
    failed: { label: 'Fallido', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle }
  }

  // Handle view order details
  const handleViewOrder = (orderId: number) => {
    window.location.href = `/dashboard/admin/package-orders/${orderId}`
  }

  // Handle edit order
  const handleEditOrder = (orderId: number) => {
    window.location.href = `/dashboard/admin/package-orders/${orderId}/edit`
  }

  // Handle delete order
  const handleDeleteOrder = async (orderId: number) => {
    console.log('handleDeleteOrder called with orderId:', orderId)

    // Find the order to check its status
    const order = orders.find(o => o.id === orderId)
    console.log('Found order:', order)

    if (!order) {
      console.error('Order not found with ID:', orderId)
      // Don't show notification to user - let the API handle the error
      return
    }

    // Only allow deletion of pending orders
    if (order.status !== 'pending') {
      console.error('Order not in pending status:', order.status)
      showNotification('error', 'No se puede eliminar', 'Solo se pueden eliminar órdenes en estado pendiente')
      return
    }

    if (!confirm(`¿Estás seguro de que deseas eliminar la orden #${order.orderNumber}? Esta acción no se puede deshacer.`)) {
      console.log('User cancelled deletion')
      return
    }

    console.log('Proceeding with deletion of order:', orderId)

    try {
      console.log('Making DELETE request to:', `/api/package-orders/${orderId}`)
      const response = await fetch(`/api/package-orders/${orderId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      console.log('DELETE response status:', response.status)

      const data = await response.json()
      console.log('DELETE response data:', data)

      if (response.ok) {
        console.log('Order deleted successfully')
        showNotification('success', 'Orden Eliminada', data.message || 'La orden ha sido eliminada exitosamente')
        // If current page might be empty after deletion, go to previous page
        const totalPages = Math.ceil(totalOrders / ORDERS_PER_PAGE)
        if (currentPage > 1 && orders.length === 1 && currentPage === totalPages) {
          setCurrentPage(currentPage - 1)
        } else {
          fetchData() // Refresh the orders list
        }
      } else {
        // Show specific error message from server
        console.error('Server error:', data.error)
        showNotification('error', 'Error al eliminar', data.error || 'No se pudo eliminar la orden')
      }
    } catch (error) {
      console.error('Error deleting order:', error)
      showNotification('error', 'Error de conexión', 'No se pudo conectar con el servidor. Intenta de nuevo.')
    }
  }

  // Handle cancel order
  const handleCancelOrder = async (orderId: number) => {
    if (!confirm('¿Estás seguro de que deseas cancelar esta orden de paquetería?')) {
      return
    }

    try {
      const response = await fetch(`/api/package-orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'cancelled'
        })
      })

      if (response.ok) {
        showNotification('success', 'Orden Cancelada', 'La orden ha sido cancelada exitosamente')
        fetchData() // Refresh the orders list
      } else {
        throw new Error('Error cancelling order')
      }
    } catch (error) {
      console.error('Error cancelling order:', error)
      showNotification('error', 'Error', 'No se pudo cancelar la orden')
    }
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          
  
  
          {/* Conditional Rendering based on active view */}
          {activeView === 'table' && (
            <div>
              {/* Panel de Logística - Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {/* Total de Órdenes */}
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
                      <Package className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Total de Órdenes</p>
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

            {/* Recogidas */}
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
                      <Archive className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Recogidas</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{stats.pickups}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                      <span className={cn(
                        'text-xs font-medium',
                        theme === 'dark' ? 'text-gray-500' : 'text-black'
                      )}>Pendientes</span>
                    </div>
                    <span className={cn(
                      'text-xs font-bold',
                      theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                    )}>
                      {orders.filter(order =>
                        order.services.some(service =>
                          (service.toLowerCase().includes('recogida') || service.toLowerCase().includes('pickup')) &&
                          order.status === 'pending'
                        )
                      ).length}
                    </span>
                  </div>
                  <div className="w-full bg-amber-100 dark:bg-amber-900/30 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-amber-400 to-orange-500 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${stats.pickups > 0 ? (orders.filter(order =>
                          order.services.some(service =>
                            (service.toLowerCase().includes('recogida') || service.toLowerCase().includes('pickup')) &&
                            order.status === 'pending'
                          )
                        ).length / stats.pickups * 100) : 0}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Entregas */}
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
                      <Truck className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Entregas</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{stats.deliveries}</p>
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
                      )}>Pendientes</span>
                    </div>
                    <span className={cn(
                      'text-xs font-bold',
                      theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                    )}>
                      {orders.filter(order =>
                        order.services.some(service =>
                          (service.toLowerCase().includes('entrega') || service.toLowerCase().includes('delivery')) &&
                          order.status === 'pending'
                        )
                      ).length}
                    </span>
                  </div>
                  <div className="w-full bg-emerald-100 dark:bg-emerald-900/30 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-emerald-400 to-green-500 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${stats.deliveries > 0 ? (orders.filter(order =>
                          order.services.some(service =>
                            (service.toLowerCase().includes('entrega') || service.toLowerCase().includes('delivery')) &&
                            order.status === 'pending'
                          )
                        ).length / stats.deliveries * 100) : 0}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Programadas Hoy */}
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
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-400 to-purple-600"></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-violet-900/30 border border-violet-800/50'
                        : 'bg-gradient-to-br from-violet-50 to-purple-100 border border-violet-200'
                    )}>
                      <Calendar className="w-6 h-6 text-violet-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Hoy</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{stats.scheduledToday}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-violet-400 rounded-full"></div>
                      <span className={cn(
                        'text-xs font-medium',
                        theme === 'dark' ? 'text-gray-500' : 'text-black'
                      )}>Activas</span>
                    </div>
                    <span className={cn(
                      'text-xs font-bold',
                      theme === 'dark' ? 'text-violet-400' : 'text-violet-600'
                    )}>
                      {orders.filter(order => {
                        if (!order.scheduledDate) return false
                        const orderDate = new Date(order.scheduledDate).toDateString()
                        const today = new Date().toDateString()
                        return orderDate === today && order.status === 'scheduled'
                      }).length}
                    </span>
                  </div>
                  <div className="w-full bg-violet-100 dark:bg-violet-900/30 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-violet-400 to-purple-500 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${stats.scheduledToday > 0 ? (orders.filter(order => {
                          if (!order.scheduledDate) return false
                          const orderDate = new Date(order.scheduledDate).toDateString()
                          const today = new Date().toDateString()
                          return orderDate === today && order.status === 'scheduled'
                        }).length / stats.scheduledToday * 100) : 0}%`
                      }}
                    ></div>
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
                placeholder="Buscar por número de orden, cliente o dirección..."
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

              {/* View Toggle Buttons */}
              <ViewToggle
                activeView={activeView}
                onViewChange={setActiveView}
                counts={{
                  table: orders.length,
                  map: allOrders.length,
                  statistics: allOrders.length
                }}
                theme={theme}
                compact={true}
              />

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
                  onClick={() => window.location.href = '/dashboard/admin/package-orders/create'}
                  className={cn(
                    'flex-1 sm:flex-none justify-center whitespace-nowrap',
                    'rounded-lg text-sm font-medium transition-all duration-200',
                    'h-12 bg-blue-600 hover:bg-blue-700 text-black dark:text-white',
                    'shadow-sm hover:shadow-md',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                    'dark:bg-blue-700 dark:hover:bg-blue-800 dark:text-white',
                    'flex items-center gap-2 px-6'
                  )}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus w-4 h-4">
                    <path d="M5 12h14"></path>
                    <path d="M12 5v14"></path>
                  </svg>
                  Nueva Orden
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
              <div className="p-8 text-center">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                <p className="mt-2 text-black dark:text-gray-400">Cargando órdenes...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="p-8 text-center">
                <Package className="w-12 h-12 mx-auto text-gray-400" />
                <p className="mt-2 text-black dark:text-gray-400">
                  {searchTerm || statusFilter !== 'all' || dayFilter !== 'all' ? 'No se encontraron órdenes con los filtros aplicados' : 'No hay órdenes registradas'}
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                        Orden
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-44">
                        Fecha Recogida
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-48">
                        Cliente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex-1">
                        Dirección
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-52">
                        Servicios
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
                    {orders.map((order) => (
                      <motion.tr
                        key={order.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={cn(
                          'hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors'
                        )}
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-base font-bold text-black dark:text-gray-100 mb-1">
                            {order.orderNumber}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {(() => {
                              const now = new Date()
                              const orderDate = new Date(order.createdAt as string)
                              const daysDiff = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24))

                              if (daysDiff === 0) {
                                return (
                                  <div>
                                    <span className="text-blue-600 dark:text-blue-400 font-medium">Hoy</span>
                                    <div className="text-gray-400 dark:text-gray-500 mt-1">
                                      {orderDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  </div>
                                )
                              }
                              if (daysDiff === 1) {
                                return (
                                  <div>
                                    <span className="text-green-600 dark:text-green-400 font-medium">Ayer</span>
                                    <div className="text-gray-400 dark:text-gray-500 mt-1">
                                      {orderDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  </div>
                                )
                              }
                              if (daysDiff < 7) return <span>Hace {daysDiff} días</span>
                              if (daysDiff < 30) return <span>Hace {Math.floor(daysDiff / 7)} semanas</span>
                              return <span>Hace {Math.floor(daysDiff / 30)} meses</span>
                            })()}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            {order.scheduledDate ? (
                              <div>
                                <div className="font-medium text-black dark:text-gray-100">
                                  {(() => {
                                    if (!order.scheduledDate) return <span className="text-gray-400">No programada</span>

                                    const scheduledDate = new Date(order.scheduledDate + 'T00:00:00')
                                    const today = new Date()
                                    today.setHours(0, 0, 0, 0)
                                    const tomorrow = new Date(today)
                                    tomorrow.setDate(tomorrow.getDate() + 1)

                                    const isToday = scheduledDate.toDateString() === today.toDateString()
                                    const isTomorrow = scheduledDate.toDateString() === tomorrow.toDateString()

                                    if (isToday) {
                                      return <span className="text-blue-600 dark:text-blue-400">Hoy</span>
                                    } else if (isTomorrow) {
                                      return <span className="text-green-600 dark:text-green-400">Mañana</span>
                                    } else {
                                      return scheduledDate.toLocaleDateString('es-ES', {
                                        weekday: 'short',
                                        day: '2-digit',
                                        month: 'short'
                                      })
                                    }
                                  })()}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {new Date(order.scheduledDate + 'T00:00:00').toLocaleDateString('es-ES', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric'
                                  })}
                                </div>
                                {order.timeSlot && (
                                  <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mt-1">
                                    🕐 {(() => {
                                      const timeSlots: { [key: string]: string } = {
                                        'morning': '8:00 - 12:00',
                                        'afternoon': '12:00 - 16:00',
                                        'evening': '16:00 - 20:00'
                                      }
                                      return timeSlots[order.timeSlot] || order.timeSlot
                                    })()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500 italic">No programada</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-2">
                          <div className="text-base font-medium text-black dark:text-gray-100">
                            {order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim()}
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="text-sm text-black dark:text-gray-400 min-w-0 max-w-md">
                            {(() => {
                              // Enhanced address parsing function
                              const parseAddress = (addressField: any) => {
                                if (!addressField) return null

                                // Handle case where address is already an object (from new system)
                                if (typeof addressField === 'object' && addressField !== null) {
                                  return addressField
                                }

                                // Handle string addresses
                                if (typeof addressField === 'string') {
                                  // Try to parse as JSON first (for old formatted addresses)
                                  try {
                                    const parsed = JSON.parse(addressField)
                                    if (parsed && typeof parsed === 'object') {
                                      return parsed
                                    }
                                  } catch {
                                    // Parse complete address string into components
                                    return parseCompleteAddressString(addressField)
                                  }
                                }

                                return null
                              }

                              // Parse complete address string into components
                              const parseCompleteAddressString = (addressString: string) => {
                                // Common patterns for US addresses
                                const patterns = {
                                  // Pattern: Street, City, State CP (Miami, Florida, CP 33161)
                                  fullAddress: /^(.+?),\s*([^,]+?,\s*[^,]+?),\s*CP\s*(\d{5}(?:-\d{4})?)$/i,
                                  // Pattern: Street, City, State Zip (Miami, FL 33161)
                                  fullAddressZip: /^(.+?),\s*([^,]+?),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)$/i,
                                  // Pattern: Street, City State (Miami, FL)
                                  streetCityState: /^(.+?),\s*([^,]+?)\s+([A-Z]{2})$/i
                                }

                                for (const [key, pattern] of Object.entries(patterns)) {
                                  const match = addressString.match(pattern)
                                  if (match) {
                                    if (key === 'fullAddress') {
                                      return {
                                        street: match[1]?.trim(),
                                        city: match[2]?.trim(),
                                        state: match[3]?.trim(),
                                        zipCode: match[4]?.trim()
                                      }
                                    } else if (key === 'fullAddressZip') {
                                      return {
                                        street: match[1]?.trim(),
                                        city: match[2]?.trim(),
                                        state: match[3]?.trim(),
                                        zipCode: match[4]?.trim()
                                      }
                                    } else if (key === 'streetCityState') {
                                      return {
                                        street: match[1]?.trim(),
                                        city: match[2]?.trim(),
                                        state: match[3]?.trim()
                                      }
                                    }
                                  }
                                }

                                // If no pattern matches, try to split by commas
                                const parts = addressString.split(',').map(part => part.trim())
                                if (parts.length >= 2) {
                                  return {
                                    street: parts[0],
                                    city: parts[1],
                                    state: parts[2] || '',
                                    ...(parts[3] && { zipCode: parts[3] })
                                  }
                                }

                                // Fallback: treat as street only
                                return { street: addressString }
                              }

                              // Get address from customerAddress first, then fallback to address
                              const address = parseAddress(order.customerAddress) || parseAddress(order.address)

                              if (address) {
                                const parts: string[] = []

                                // Helper function to ensure we only add strings to parts
                                const safeAdd = (value: any, prefix?: string) => {
                                  if (value === null || value === undefined) return
                                  if (typeof value === 'object') {
                                    // If it's an object, convert to JSON string to avoid React errors
                                    const str = JSON.stringify(value)
                                    if (str && str !== '{}') {
                                      parts.push(prefix ? `${prefix} ${str}` : str)
                                    }
                                  } else if (typeof value === 'string' && value.trim()) {
                                    parts.push(prefix ? `${prefix} ${value.trim()}` : value.trim())
                                  } else if (value && value.toString() !== '[object Object]') {
                                    const str = String(value).trim()
                                    if (str) {
                                      parts.push(prefix ? `${prefix} ${str}` : str)
                                    }
                                  }
                                }

                                safeAdd(address.street)
                                safeAdd(address.apartment, 'Apt:')
                                safeAdd(address.city)
                                safeAdd(address.state)
                                safeAdd(address.zipCode)
                                if (address.country && address.country !== 'Estados Unidos') {
                                  safeAdd(address.country)
                                }

                                return parts.length > 0 ? (
                                  <div>
                                    <div className="font-medium text-black dark:text-gray-100">
                                      {parts[0]}
                                    </div>
                                    {parts.length > 1 && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {parts.slice(1).join(', ')}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 dark:text-gray-500">Sin dirección</span>
                                )
                              }

                              return <span className="text-gray-400 dark:text-gray-500">Sin dirección</span>
                            })()}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1">
                            {order.services.map((service, index) => (
                              <span
                                key={index}
                                className={cn(
                                  'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                                  service.toLowerCase().includes('recogida') || service.toLowerCase().includes('pickup')
                                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                                    : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                )}
                              >
                                {service}
                              </span>
                            ))}
                          </div>
                        </td>
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

                            {/* Edit Button */}
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleEditOrder(order.id)}
                              className={cn(
                                'relative p-2 rounded-lg transition-all duration-200',
                                theme === 'dark'
                                  ? 'text-gray-400 hover:bg-gray-700/50'
                                  : 'text-gray-600 hover:bg-gray-100'
                              )}
                              title="Editar orden"
                            >
                              <Edit className="w-4 h-4" />
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
                    ))}
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
          </div>
          )}

          {/* Vista de Mapa */}
          {activeView === 'map' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Filters para Mapa */}
              <div className="flex flex-col lg:flex-row gap-6 items-center justify-between py-6 px-4 mt-8 mb-6 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Buscar por número de orden, cliente o dirección..."
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

                  {/* View Toggle Buttons */}
                  <ViewToggle
                    activeView={activeView}
                    onViewChange={setActiveView}
                    counts={{
                      table: orders.length,
                      map: allOrders.length,
                      statistics: allOrders.length
                    }}
                    theme={theme}
                    compact={true}
                  />

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
                    onClick={() => window.location.href = '/dashboard/admin/package-orders/create'}
                    className={cn(
                      'flex-1 sm:flex-none justify-center whitespace-nowrap',
                      'items-center gap-2 h-12 px-4',
                      'bg-green-600 hover:bg-green-700 text-white font-medium',
                      'rounded-lg transition-all duration-200',
                      'shadow-sm hover:shadow-md',
                      'focus:outline-none focus:ring-2 focus:ring-green-500/20',
                      'dark:bg-green-700 dark:hover:bg-green-800 dark:text-white'
                    )}
                  >
                    <Plus className="w-4 h-4" />
                    Nueva Orden
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <PackageDeliveryMap
                  orders={orders}
                  theme={theme}
                />
              </div>
            </motion.div>
          )}

          {/* Statistics View */}
          {activeView === 'statistics' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-8"
            >
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-12">
                <div className="text-center space-y-6">
                  {/* Icon */}
                  <div className="mx-auto w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <BarChart3 className="w-12 h-12 text-black dark:text-white" />
                  </div>

                  {/* Title */}
                  <h2 className="text-3xl font-bold text-black dark:text-white">
                    Estadísticas de Órdenes
                  </h2>

                  {/* Message */}
                  <div className="space-y-4">
                    <p className="text-xl text-gray-600 dark:text-gray-300">
                      Estamos trabajando en Desarrollar una Solución Práctica
                    </p>
                    <p className="text-lg text-gray-500 dark:text-gray-400">
                      Próximamente podrás ver aquí análisis detallados, gráficos interactivos y métricas importantes sobre tus órdenes.
                    </p>
                  </div>

                  {/* Stats Preview */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                      <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                        {allOrders.length}
                      </div>
                      <div className="text-sm text-black dark:text-gray-300 mt-1">
                        Total de Órdenes
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                      <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                        {allOrders.filter(order => order.status === 'delivered').length}
                      </div>
                      <div className="text-sm text-black dark:text-gray-300 mt-1">
                        Órdenes Entregadas
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                      <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                        {allOrders.filter(order => order.status === 'pending').length}
                      </div>
                      <div className="text-sm text-black dark:text-gray-300 mt-1">
                        Órdenes Pendientes
                      </div>
                    </div>
                  </div>

                  {/* Progress indicator */}
                  <div className="mt-8">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse delay-75"></div>
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse delay-150"></div>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                      En desarrollo...
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}


        </motion.div>
      </div>
    </DashboardLayout>
  )
}