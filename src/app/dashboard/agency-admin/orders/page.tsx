'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Filter,
  Download,
  Calendar,
  TrendingUp,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  ShoppingBag,
  Smartphone,
  Send,
  Eye
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'

interface Order {
  id: string
  date: string
  type: 'marketplace' | 'recarga' | 'remesa'
  customerName: string
  customerPhone: string
  amount: number
  status: 'pending' | 'completed' | 'cancelled' | 'failed'
  referenceCode?: string
  details: {
    marketName?: string
    phoneNumber?: string
    recipientName?: string
    destinationCountry?: string
    company?: string
    items?: Array<{productName: string; quantity: number; price: number}>
  }
  notes?: string
}

// Mock data para demostración
const MOCK_ORDERS: Order[] = [
  // Marketplace orders
  {
    id: 'MRK-001',
    date: '2024-01-15 14:30',
    type: 'marketplace',
    customerName: 'María González',
    customerPhone: '+53 5 123 4567',
    amount: 125.50,
    status: 'completed',
    referenceCode: 'MRK-001',
    details: {
      marketName: 'Mercado Central',
      items: [
        { productName: 'Arroz (5kg)', quantity: 2, price: 25.00 },
        { productName: 'Frijoles (3kg)', quantity: 1, price: 15.50 },
        { productName: 'Aceite vegetral', quantity: 3, price: 20.00 },
        { productName: 'Pollo (2kg)', quantity: 1, price: 45.00 }
      ]
    }
  },
  {
    id: 'MRK-002',
    date: '2024-01-15 16:45',
    type: 'marketplace',
    customerName: 'Carlos Rodríguez',
    customerPhone: '+53 5 987 6543',
    amount: 89.25,
    status: 'pending',
    referenceCode: 'MRK-002',
    details: {
      marketName: 'Supermarket La Habana',
      items: [
        { productName: 'Leche (1L)', quantity: 4, price: 12.00 },
        { productName: 'Pan (unidad)', quantity: 12, price: 3.00 },
        { productName: 'Huevos (docena)', quantity: 1, price: 8.25 },
        { productName: 'Café (500g)', quantity: 1, price: 66.00 }
      ]
    }
  },

  // Recarga orders
  {
    id: 'REC-001',
    date: '2024-01-15 10:15',
    type: 'recarga',
    customerName: 'Ana Martínez',
    customerPhone: '+53 5 555 1111',
    amount: 20.00,
    status: 'completed',
    referenceCode: 'REC-001',
    details: {
      phoneNumber: '+53 5 555 1111',
      company: 'Cubacel'
    }
  },
  {
    id: 'REC-002',
    date: '2024-01-15 11:30',
    type: 'recarga',
    customerName: 'Luis Pérez',
    customerPhone: '+53 5 222 3333',
    amount: 15.00,
    status: 'completed',
    referenceCode: 'REC-002',
    details: {
      phoneNumber: '+53 5 222 3333',
      company: 'Nauta'
    }
  },

  // Remesa orders
  {
    id: 'RMS-001',
    date: '2024-01-15 09:00',
    type: 'remesa',
    customerName: 'Roberto Díaz',
    customerPhone: '+53 5 777 8888',
    amount: 500.00,
    status: 'pending',
    referenceCode: 'RMS-001',
    details: {
      recipientName: 'Diana Díaz',
      destinationCountry: 'Estados Unidos',
      phoneNumber: '+1 555-123-4567'
    }
  },
  {
    id: 'RMS-002',
    date: '2024-01-15 13:20',
    type: 'remesa',
    customerName: 'Sofía López',
    customerPhone: '+53 5 999 0000',
    amount: 300.00,
    status: 'completed',
    referenceCode: 'RMS-002',
    details: {
      recipientName: 'Juan López',
      destinationCountry: 'España',
      phoneNumber: '+34 91-123-4567'
    }
  }
]

export default function OrdersPage() {
  const { theme } = useTheme()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'marketplace' | 'recarga' | 'remesa'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed' | 'cancelled' | 'failed'>('all')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  // Cargar órdenes desde la API
  useEffect(() => {
    loadOrders()
  }, [])

  const loadOrders = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/orders?agencyId=agency-1&limit=100')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setOrders(data.data)
        } else {
          setError('Error al cargar órdenes')
        }
      } else {
        setError('Error al conectar con el servidor')
      }
    } catch (error) {
      console.error('Error loading orders:', error)
      setError('Error al cargar órdenes')
    } finally {
      setLoading(false)
    }
  }

  // Filtrar órdenes
  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerPhone.includes(searchTerm) ||
      (order.referenceCode && order.referenceCode.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesType = filterType === 'all' || order.type === filterType
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus

    return matchesSearch && matchesType && matchesStatus
  })

  // Estadísticas
  const stats = {
    total: orders.length,
    completed: orders.filter(o => o.status === 'completed').length,
    pending: orders.filter(o => o.status === 'pending').length,
    totalAmount: orders.reduce((sum, order) => sum + order.amount, 0)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completado'
      case 'pending':
        return 'Pendiente'
      case 'cancelled':
        return 'Cancelado'
      case 'failed':
        return 'Fallido'
      default:
        return status
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'marketplace':
        return <ShoppingBag className="w-4 h-4" />
      case 'recarga':
        return <Smartphone className="w-4 h-4" />
      case 'remesa':
        return <Send className="w-4 h-4" />
      default:
        return <ShoppingBag className="w-4 h-4" />
    }
  }

  const getTypeText = (type: string) => {
    switch (type) {
      case 'marketplace':
        return 'Mercado'
      case 'recarga':
        return 'Recarga'
      case 'remesa':
        return 'Remesa'
      default:
        return type
    }
  }

  const exportOrders = () => {
    const dataStr = JSON.stringify(filteredOrders, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)

    const exportFileDefaultName = `orders-${new Date().toISOString().split('T')[0]}.json`

    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <DashboardLayout>
        <div className="max-w-7xl mx-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className={cn(
                "text-3xl font-bold",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                📋 Gestión de Órdenes
              </h1>
              <p className={cn(
                "text-lg mt-2",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                Visualiza y gestiona todas las órdenes de la agencia
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={exportOrders}
                className={cn(
                  "flex items-center gap-2",
                  theme === 'dark'
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-green-500 hover:bg-green-600 text-white"
                )}
              >
                <Download className="w-4 h-4" />
                Exportar
              </Button>
            </div>
          </div>

          {/* Estadísticas */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className={cn(
                "rounded-2xl border p-6",
                theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn(
                    "text-sm font-medium",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Total Órdenes
                  </p>
                  <p className={cn(
                    "text-2xl font-bold mt-1",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    {stats.total}
                  </p>
                </div>
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  theme === 'dark' ? "bg-blue-500/20" : "bg-blue-500/20"
                )}>
                  <ShoppingBag className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </motion.div>

            <motion.div
              className={cn(
                "rounded-2xl border p-6",
                theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn(
                    "text-sm font-medium",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Completadas
                  </p>
                  <p className={cn(
                    "text-2xl font-bold mt-1",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    {stats.completed}
                  </p>
                </div>
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  theme === 'dark' ? "bg-green-500/20" : "bg-green-500/20"
                )}>
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </motion.div>

            <motion.div
              className={cn(
                "rounded-2xl border p-6",
                theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn(
                    "text-sm font-medium",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Pendientes
                  </p>
                  <p className={cn(
                    "text-2xl font-bold mt-1",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    {stats.pending}
                  </p>
                </div>
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  theme === 'dark' ? "bg-yellow-500/20" : "bg-yellow-500/20"
                )}>
                  <Clock className="w-6 h-6 text-yellow-500" />
                </div>
              </div>
            </motion.div>

            <motion.div
              className={cn(
                "rounded-2xl border p-6",
                theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn(
                    "text-sm font-medium",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Monto Total
                  </p>
                  <p className={cn(
                    "text-2xl font-bold mt-1",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    ${stats.totalAmount.toFixed(2)}
                  </p>
                </div>
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  theme === 'dark' ? "bg-purple-500/20" : "bg-purple-500/20"
                )}>
                  <TrendingUp className="w-6 h-6 text-purple-500" />
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Filtros */}
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className={cn(
                  "absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5",
                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                )} />
                <input
                  type="text"
                  placeholder="Buscar por nombre, teléfono o referencia..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(
                    "w-full pl-10 pr-4 py-3 rounded-xl border transition-colors duration-200",
                    theme === 'dark'
                      ? "bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-exa-secondary"
                      : "bg-white border-gray-200 text-gray-900 placeholder-gray-500 focus:border-exa-primary"
                  )}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className={cn(
                  "px-4 py-3 rounded-xl border transition-colors duration-200",
                  theme === 'dark'
                    ? "bg-white/5 border-white/10 text-white focus:border-exa-secondary"
                    : "bg-white border-gray-200 text-gray-900 focus:border-exa-primary"
                )}
              >
                <option value="all">Todos los tipos</option>
                <option value="marketplace">Mercado</option>
                <option value="recarga">Recarga</option>
                <option value="remesa">Remesa</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className={cn(
                  "px-4 py-3 rounded-xl border transition-colors duration-200",
                  theme === 'dark'
                    ? "bg-white/5 border-white/10 text-white focus:border-exa-secondary"
                    : "bg-white border-gray-200 text-gray-900 focus:border-exa-primary"
                )}
              >
                <option value="all">Todos los estados</option>
                <option value="completed">Completados</option>
                <option value="pending">Pendientes</option>
                <option value="cancelled">Cancelados</option>
                <option value="failed">Fallidos</option>
              </select>
            </div>
          </div>

          {/* Lista de Órdenes */}
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <AnimatePresence>
              {filteredOrders.map((order) => (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={cn(
                    "rounded-2xl border overflow-hidden transition-all duration-300",
                    theme === 'dark'
                      ? "bg-white/5 border-white/10 hover:bg-white/10"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  )}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-3">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(order.type)}
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              {getTypeText(order.type)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {getStatusIcon(order.status)}
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              {getStatusText(order.status)}
                            </span>
                          </div>

                          <span className={cn(
                            "text-sm font-mono",
                            theme === 'dark' ? "text-gray-400" : "text-gray-600"
                          )}>
                            {order.referenceCode}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className={cn(
                              "text-sm font-medium mb-1",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Cliente
                            </p>
                            <p className={cn(
                              "font-medium",
                              theme === 'dark' ? "text-white" : "text-gray-900"
                            )}>
                              {order.customerName}
                            </p>
                            <p className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              {order.customerPhone}
                            </p>
                          </div>

                          <div>
                            <p className={cn(
                              "text-sm font-medium mb-1",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Fecha
                            </p>
                            <p className={cn(
                              "font-medium",
                              theme === 'dark' ? "text-white" : "text-gray-900"
                            )}>
                              {order.date}
                            </p>
                          </div>

                          <div>
                            <p className={cn(
                              "text-sm font-medium mb-1",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Monto
                            </p>
                            <p className={cn(
                              "text-xl font-bold",
                              theme === 'dark' ? "text-white" : "text-gray-900"
                            )}>
                              ${order.amount.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                          className={cn(
                            "mt-4 text-sm",
                            theme === 'dark' ? "text-exa-secondary hover:text-exa-secondary/80" : "text-exa-primary hover:text-exa-primary/80"
                          )}
                        >
                          {expandedOrder === order.id ? 'Ocultar detalles' : 'Ver detalles'}
                        </Button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {expandedOrder === order.id && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="border-t border-gray-200 dark:border-gray-700"
                        >
                          <div className="p-6 pt-4">
                            <h4 className={cn(
                              "font-medium mb-3",
                              theme === 'dark' ? "text-white" : "text-gray-900"
                            )}>
                              Detalles de la orden
                            </h4>

                            {order.type === 'marketplace' && order.details.items && (
                              <div className="space-y-2">
                                <p className={cn(
                                  "text-sm font-medium mb-2",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                )}>
                                  Productos:
                                </p>
                                {order.details.items.map((item, idx) => (
                                  <div key={idx} className="flex justify-between text-sm">
                                    <span className={cn(
                                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                                    )}>
                                      {item.productName} (x{item.quantity})
                                    </span>
                                    <span className={cn(
                                      "font-medium",
                                      theme === 'dark' ? "text-white" : "text-gray-900"
                                    )}>
                                      ${(item.price * item.quantity).toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {order.type === 'recarga' && (
                              <div className="space-y-2">
                                <p className={cn(
                                  "text-sm font-medium mb-2",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                )}>
                                  Número recargado: {order.details.phoneNumber}
                                </p>
                                <p className={cn(
                                  "text-sm font-medium mb-2",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                )}>
                                  Compañía: {order.details.company}
                                </p>
                              </div>
                            )}

                            {order.type === 'remesa' && (
                              <div className="space-y-2">
                                <p className={cn(
                                  "text-sm font-medium mb-2",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                )}>
                                  Destinatario: {order.details.recipientName}
                                </p>
                                <p className={cn(
                                  "text-sm font-medium mb-2",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                )}>
                                  País: {order.details.destinationCountry}
                                </p>
                                <p className={cn(
                                  "text-sm font-medium mb-2",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                )}>
                                  Teléfono: {order.details.phoneNumber}
                                </p>
                              </div>
                            )}

                            {order.notes && (
                              <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                                <p className={cn(
                                  "text-sm font-medium mb-1",
                                  theme === 'dark' ? "text-blue-300" : "text-blue-700"
                                )}>
                                  Notas:
                                </p>
                                <p className={cn(
                                  "text-sm",
                                  theme === 'dark' ? "text-blue-200" : "text-blue-600"
                                )}>
                                  {order.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          {filteredOrders.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                "rounded-2xl border p-12 text-center",
                theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
              )}
            >
              <div className="max-w-md mx-auto">
                <div className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6",
                  theme === 'dark' ? "bg-gray-700/50" : "bg-gray-100"
                )}>
                  <Search className={cn(
                    "w-10 h-10",
                    theme === 'dark' ? "text-gray-400" : "text-gray-500"
                  )} />
                </div>
                <h3 className={cn(
                  "text-xl font-semibold mb-3",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  No se encontraron órdenes
                </h3>
                <p className={cn(
                  "text-lg",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  No hay órdenes que coincidan con los filtros seleccionados
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}