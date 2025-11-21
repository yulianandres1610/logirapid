'use client'

import { useState, useEffect } from 'react'

// Función para remover ceros iniciales de direcciones
const removeLeadingZeros = (address: string): string => {
  if (!address) return address
  return address.replace(/^0+/, '')
}

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Package,
  Plus,
  Search,
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
  RefreshCw,
  Building2
} from 'lucide-react'
import LoadingBox from '@/components/ui/LoadingBox'
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
  status: 'pending' | 'reprogrammed' | 'picked_up' | 'in_transit' | 'in_route' | 'delivered'
  createdAt: string
  updatedAt: string
  firstName?: string
  lastName?: string
  phone?: string
  total?: number
  email?: string
  address?: string
  customerNotes?: string
  orderType?: 'recogida' | 'oficina' | 'entrega'
  street?: string
  apartment?: string
  city?: string
  state?: string
  zipcode?: string
  country?: string
  companyName?: string // Nombre de la empresa
  companyId?: number // ID de la empresa
  // Coordinates for mapping
  latitude?: number | null
  longitude?: number | null
}

// Force dynamic rendering to avoid static generation issues with useSearchParams
export const dynamic = 'force-dynamic'

export default function PickupOrdersPage() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const basePath = pathname?.startsWith('/dashboard/agency-admin')
    ? '/dashboard/agency-admin/pickup-orders'
    : '/dashboard/admin/pickup-orders'

  const [orders, setOrders] = useState<PackageOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalOrders, setTotalOrders] = useState(0)
  const ORDERS_PER_PAGE = 25
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dayFilter, setDayFilter] = useState<string>('all')

  // View state - inicializar desde URL o por defecto 'table'
  const [activeView, setActiveView] = useState<'table' | 'map' | 'statistics'>(() => {
    const viewFromUrl = searchParams.get('view')
    if (viewFromUrl === 'map') return 'map'
    if (viewFromUrl === 'statistics') return 'statistics'
    return 'table'
  })
  const [allOrders, setAllOrders] = useState<PackageOrder[]>([])
  const [zones, setZones] = useState<any[]>([])

  // Fetch orders - Show both recogida and entrega (both need routes)
  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: ORDERS_PER_PAGE.toString(),
        // No orderType filter - will show recogida and entrega by default
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

    const newUrl = `${basePath}${params.toString() ? '?' + params.toString() : ''}`
    router.push(newUrl, { scroll: false })
  }, [activeView, searchParams, router, basePath])

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
      // Parsear fecha de forma segura
      const dateStr = order.scheduledDate.includes('T') ? order.scheduledDate : order.scheduledDate + 'T00:00:00'
      const orderDate = new Date(dateStr)
      if (isNaN(orderDate.getTime())) return false
      const today = new Date().toDateString()
      return orderDate.toDateString() === today
    }).length
  }

  // Fetch all orders for map view (recogida y entrega - ambas necesitan ruta)
  const fetchAllOrders = async () => {
    try {
      const [ordersResponse, zonesResponse] = await Promise.all([
        fetch('/api/package-orders?limit=1000'), // Sin orderType - mostrará recogida y entrega
        fetch('/api/zones')
      ])

      if (ordersResponse.ok) {
        const data = await ordersResponse.json()
        // Filtrar solo órdenes pendientes y reprogramadas (las importantes para rutas)
        const filteredOrders = (data.data || []).filter((order: PackageOrder) =>
          order.status === 'pending' || order.status === 'reprogrammed'
        )
        setAllOrders(filteredOrders)
      }

      if (zonesResponse.ok) {
        const zonesData = await zonesResponse.json()
        setZones(zonesData.data || zonesData || [])
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
    reprogrammed: { label: 'Reprogramado', color: 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white shadow-lg border border-yellow-200 dark:from-yellow-600 dark:to-orange-700 dark:border-yellow-400', icon: AlertCircle },
    picked_up: { label: 'Recogido', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: Package },
    in_transit: { label: 'Enviado', color: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg border border-blue-200 dark:from-blue-600 dark:to-indigo-700 dark:border-blue-400', icon: Package },
    in_route: { label: 'En Reparto', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400', icon: Truck },
    delivered: { label: 'Entregado', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  }

  // Handle view order details
  const handleViewOrder = (orderId: number) => {
    router.push(`${basePath}/${orderId}`)
  }

  // Handle edit order
  const handleEditOrder = (orderId: number) => {
    router.push(`${basePath}/${orderId}/edit`)
  }

  // Handle delete order
  const handleDeleteOrder = async (orderId: number) => {
    console.log('handleDeleteOrder called with orderId:', orderId)

    // Find the order to check its status
    const order = orders.find(o => o.id === orderId)
    console.log('Found order:', order)

    if (!order) {
      console.error('Order not found with ID:', orderId)
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

  // Helper para parsear direcciones
  const parseAddress = (addressField: any) => {
    if (!addressField) return null
    if (typeof addressField === 'object' && addressField !== null) {
      return addressField
    }
    if (typeof addressField === 'string') {
      // First try to parse as JSON
      try {
        const parsed = JSON.parse(addressField)
        if (parsed && typeof parsed === 'object') {
          return parsed
        }
      } catch {
        // If not JSON, parse comma-separated string format
        // Format: "street, [Apt X,] city, state, zipcode, country"
        const parts = addressField.split(',').map(p => p.trim()).filter(Boolean)

        if (parts.length >= 2) {
          // Try to identify components
          const result: any = {}

          // Last part is usually country (if exists and not a number)
          if (parts.length > 4 && isNaN(Number(parts[parts.length - 1]))) {
            result.country = parts[parts.length - 1]
            parts.pop()
          }

          // Second to last should be zipcode (5 digits)
          if (parts.length > 0 && /^\d{5}(-\d{4})?$/.test(parts[parts.length - 1])) {
            result.zipCode = parts[parts.length - 1]
            parts.pop()
          }

          // Third to last should be state (2 letters)
          if (parts.length > 0 && /^[A-Z]{2}$/i.test(parts[parts.length - 1])) {
            result.state = parts[parts.length - 1]
            parts.pop()
          }

          // Fourth to last should be city
          if (parts.length > 0) {
            result.city = parts[parts.length - 1]
            parts.pop()
          }

          // Check if second part might be apartment (starts with "Apt")
          if (parts.length > 1 && parts[1].toLowerCase().startsWith('apt')) {
            result.apartment = parts[1]
            result.street = parts[0]
          } else {
            // Everything else is the street
            result.street = parts.join(', ')
          }

          return result
        }

        // Fallback: just return as street
        return { street: addressField }
      }
    }
    return null
  }

  const formatAddress = (address: any) => {
    if (!address) return 'Sin dirección'
    const parts: string[] = []
    if (address.street) parts.push(address.street)
    if (address.apartment) parts.push(`Apt: ${address.apartment}`)
    if (address.city) parts.push(address.city)
    if (address.state) parts.push(address.state)
    // Handle both zipCode (camelCase) and zipcode (lowercase)
    if (address.zipCode || address.zipcode) parts.push(address.zipCode || address.zipcode)
    if (address.country && address.country !== 'Estados Unidos' && address.country !== 'US') parts.push(address.country)

    return parts.length > 0 ? (
      <div>
        <div className="font-medium text-black dark:text-gray-100">{parts[0]}</div>
        {parts.length > 1 && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {parts.slice(1).join(', ')}
          </div>
        )}
      </div>
    ) : 'Sin dirección'
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
                    )}>De recogida</span>
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
                        // Parsear fecha de forma segura
                        const dateStr = order.scheduledDate.includes('T') ? order.scheduledDate : order.scheduledDate + 'T00:00:00'
                        const orderDate = new Date(dateStr)
                        if (isNaN(orderDate.getTime())) return false
                        const today = new Date().toDateString()
                        return orderDate.toDateString() === today && order.status === 'pending'
                      }).length}
                    </span>
                  </div>
                  <div className="w-full bg-violet-100 dark:bg-violet-900/30 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-violet-400 to-purple-500 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${stats.scheduledToday > 0 ? (orders.filter(order => {
                          if (!order.scheduledDate) return false
                          // Parsear fecha de forma segura
                          const dateStr = order.scheduledDate.includes('T') ? order.scheduledDate : order.scheduledDate + 'T00:00:00'
                          const orderDate = new Date(dateStr)
                          if (isNaN(orderDate.getTime())) return false
                          const today = new Date().toDateString()
                          return orderDate.toDateString() === today && order.status === 'pending'
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
                  statistics: 0
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
                  onClick={() => router.push(`${basePath}/create`)}
                  className={cn(
                    'flex-1 sm:flex-none justify-center whitespace-nowrap',
                    'rounded-lg text-sm font-medium transition-all duration-200',
                    'h-12 bg-blue-600 hover:bg-blue-700 text-white',
                    'shadow-sm hover:shadow-md',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                    'dark:bg-blue-700 dark:hover:bg-blue-800 dark:text-white',
                    'flex items-center gap-2 px-6'
                  )}
                >
                  <Plus className="w-4 h-4" />
                  Nueva Orden de Recogida
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
                <LoadingBox size="lg" text="Cargando órdenes de recogida..." />
              </div>
            ) : orders.length === 0 ? (
              <div className="p-8 text-center">
                <Package className="w-12 h-12 mx-auto text-gray-400" />
                <p className="mt-2 text-black dark:text-gray-400">
                  {searchTerm || statusFilter !== 'all' || dayFilter !== 'all' ? 'No se encontraron órdenes con los filtros aplicados' : 'No hay órdenes de recogida registradas'}
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-44">
                        Fecha Recogida
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-48">
                        Cliente
                      </th>
                      {user?.role === 'SUPER_ADMIN' && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-40">
                          Empresa
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex-1">
                        Dirección Recogida
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
                    {orders.map((order) => {
                      return (
                        <motion.tr
                          key={order.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={cn('hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors')}
                        >
                        {/* Columna 1: Número de Orden */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="text-base font-bold text-black dark:text-gray-100">
                              {order.orderNumber}
                            </div>
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
                              return (
                                <div>
                                  <div className="font-medium">
                                    {orderDate.toLocaleDateString('es-ES', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric'
                                    })}
                                  </div>
                                  <div className="text-gray-400 dark:text-gray-500 mt-1">
                                    {orderDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        </td>

                          {/* Fecha Recogida */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              {order.scheduledDate ? (
                                <div>
                                  <div className="font-medium text-black dark:text-gray-100">
                                    {(() => {
                                      const dateStr = order.scheduledDate.includes('T') ? order.scheduledDate : order.scheduledDate + 'T00:00:00'
                                      const scheduledDate = new Date(dateStr)
                                      if (isNaN(scheduledDate.getTime())) return <span className="text-gray-400">Fecha inválida</span>
                                      const today = new Date()
                                      today.setHours(0, 0, 0, 0)
                                      const tomorrow = new Date(today)
                                      tomorrow.setDate(tomorrow.getDate() + 1)
                                      const isToday = scheduledDate.toDateString() === today.toDateString()
                                      const isTomorrow = scheduledDate.toDateString() === tomorrow.toDateString()
                                      if (isToday) return <span className="text-blue-600 dark:text-blue-400">Hoy</span>
                                      if (isTomorrow) return <span className="text-green-600 dark:text-green-400">Mañana</span>
                                      return scheduledDate.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })
                                    })()}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {(() => {
                                      const dateStr = order.scheduledDate.includes('T') ? order.scheduledDate : order.scheduledDate + 'T00:00:00'
                                      const date = new Date(dateStr)
                                      if (isNaN(date.getTime())) return 'Fecha inválida'
                                      return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                    })()}
                                  </div>
                                  {order.timeSlot && (
                                    <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mt-1">
                                      <Clock className="w-3 h-3 inline mr-1" />
                                      {(() => {
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

                          {/* Cliente */}
                          <td className="px-6 py-2">
                            <div className="text-base font-medium text-black dark:text-gray-100">
                              {order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim()}
                            </div>
                          </td>

                          {/* Empresa (Solo para Super Admin) */}
                          {user?.role === 'SUPER_ADMIN' && (
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                <span className="text-sm font-medium text-black dark:text-gray-100">
                                  {order.companyName || 'Sin empresa'}
                                </span>
                              </div>
                            </td>
                          )}

                          {/* Dirección Recogida */}
                          <td className="px-6 py-3">
                            <div className="text-sm text-black dark:text-gray-400 min-w-0 max-w-md">
                              {formatAddress({
                                street: order.street,
                                apartment: order.apartment,
                                city: order.city,
                                state: order.state,
                                zipCode: order.zipcode,
                                country: order.country
                              })}
                            </div>
                          </td>

                          {/* Servicios */}
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
                      statistics: 0
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
                    onClick={() => router.push(`${basePath}/create`)}
                    className={cn(
                      'flex-1 sm:flex-none justify-center whitespace-nowrap',
                      'items-center gap-2 h-12 px-4',
                      'bg-blue-600 hover:bg-blue-700 text-white font-medium',
                      'rounded-lg transition-all duration-200',
                      'shadow-sm hover:shadow-md',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                      'dark:bg-blue-700 dark:hover:bg-blue-800 dark:text-white',
                      'flex'
                    )}
                  >
                    <Plus className="w-4 h-4" />
                    Nueva Orden de Recogida
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <PackageDeliveryMap
                  orders={allOrders}
                  zones={zones}
                  theme={theme}
                />
              </div>
            </motion.div>
          )}

        </motion.div>
      </div>
    </DashboardLayout>
  )
}
