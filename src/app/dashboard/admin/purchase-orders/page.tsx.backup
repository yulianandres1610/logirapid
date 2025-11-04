'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  Filter,
  ShoppingCart,
  Edit,
  Trash2,
  Eye,
  Printer,
  FileText,
  CheckSquare,
  X,
  Calendar,
  DollarSign,
  User,
  Phone,
  Mail,
  CreditCard,
  Clock,
  AlertCircle,
  CheckCircle,
  Package,
  TrendingUp,
  ArrowRight
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  PurchaseOrder,
  getAllPurchaseOrders,
  createPurchaseOrder,
  receivePurchaseOrder
} from '@/lib/package-types'
import { PurchaseOrderInvoice } from '@/components/purchase-order-invoice'

interface OrderFormData {
  supplier: string
  supplier_contact: string
  supplier_phone: string
  supplier_email: string
  items: {
    size: string
    quantity: number
    unit_price: number
  }[]
  expected_delivery?: string
  notes?: string
  payment_method?: string
  payment_terms?: string
}

const STATUSES = {
  BORRADOR: { label: 'Borrador', color: 'gray', description: 'Pedido no solicitado' },
  SOLICITUD_PRESUPUESTO: { label: 'Solicitud de Presupuesto', color: 'blue', description: 'Esperando cotización' },
  COMPRADA: { label: 'Comprada', color: 'yellow', description: 'Orden de compra emitida' },
  RECIBIDA: { label: 'Recibida', color: 'green', description: 'Mercancía recibida' },
  CANCELLED: { label: 'Cancelada', color: 'red', description: 'Orden cancelada' }
} as const

const BOX_SIZES = ['pequeño', 'mediano', 'grande', 'extra grande']
const PAYMENT_METHODS = ['Transferencia', 'Efectivo', 'Tarjeta de Crédito', 'Cheque']

export default function PurchaseOrdersPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null)
  const [viewingOrder, setViewingOrder] = useState<PurchaseOrder | null>(null)
  const [showInvoice, setShowInvoice] = useState(false)
  const [printingOrder, setPrintingOrder] = useState<PurchaseOrder | null>(null)
  const [formData, setFormData] = useState<OrderFormData>({
    supplier: '',
    supplier_contact: '',
    supplier_phone: '',
    supplier_email: '',
    items: [{ size: 'mediano', quantity: 1, unit_price: 0 }],
    expected_delivery: '',
    notes: '',
    payment_method: 'Transferencia',
    payment_terms: '30 días'
  })

  useEffect(() => {
    loadOrders()
  }, [])

  const loadOrders = async () => {
    try {
      setLoading(true)
      const data = await getAllPurchaseOrders()
      setOrders(data)
    } catch (error) {
      console.error('Error loading orders:', error)
      showNotification('Error al cargar las órdenes', 'error')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    const statusConfig = STATUSES[status as keyof typeof STATUSES]
    if (!statusConfig) return theme === 'dark' ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' : 'bg-gray-100 text-gray-600 border-gray-200'

    const colors = {
      gray: theme === 'dark' ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' : 'bg-gray-100 text-gray-600 border-gray-200',
      blue: theme === 'dark' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-100 text-blue-600 border-blue-200',
      yellow: theme === 'dark' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-yellow-100 text-yellow-600 border-yellow-200',
      green: theme === 'dark' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-green-100 text-green-600 border-green-200',
      red: theme === 'dark' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-600 border-red-200'
    }

    return colors[statusConfig.color as keyof typeof colors]
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setLoading(true)

      const orderData = {
        ...formData,
        items: formData.items.map(item => ({
          ...item,
          total_price: item.quantity * item.unit_price
        }))
      }

      if (editingOrder) {
        await updatePurchaseOrder(editingOrder.id, orderData)
        showNotification('Orden actualizada exitosamente', 'success')
      } else {
        await createPurchaseOrder(orderData)
        showNotification('Orden creada exitosamente', 'success')
      }

      await loadOrders()
      setShowCreateForm(false)
      setEditingOrder(null)
      resetForm()
    } catch (error) {
      console.error('Error saving order:', error)
      showNotification('Error al guardar la orden', 'error')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      supplier: '',
      supplier_contact: '',
      supplier_phone: '',
      supplier_email: '',
      items: [{ size: 'mediano', quantity: 1, unit_price: 0 }],
      expected_delivery: '',
      notes: '',
      payment_method: 'Transferencia',
      payment_terms: '30 días'
    })
  }

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { size: 'mediano', quantity: 1, unit_price: 0 }]
    }))
  }

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  const updateItem = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      setLoading(true)

      const updateData: any = { status: newStatus }

      if (newStatus === 'SOLICITUD_PRESUPUESTO') {
        updateData.budget_request_date = new Date().toISOString()
      } else if (newStatus === 'COMPRADA') {
        updateData.purchase_date = new Date().toISOString()
      } else if (newStatus === 'RECIBIDA') {
        // Para estado RECIBIDA, usamos la función especializada que crea cajas
        const result = await receivePurchaseOrder(orderId)
        if (result) {
          showNotification(result.message, 'success')
          await loadOrders()
          return
        } else {
          showNotification('Error al recibir la orden', 'error')
          return
        }
      }

      // Para otros estados, usamos update genérico
      const response = await fetch(`/api/packages?type=order&id=${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      if (response.ok) {
        showNotification('Estado actualizado exitosamente', 'success')
        await loadOrders()
      } else {
        showNotification('Error al actualizar el estado', 'error')
      }
    } catch (error) {
      console.error('Error updating status:', error)
      showNotification('Error al actualizar el estado', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handlePrintInvoice = (order: PurchaseOrder) => {
    setPrintingOrder(order)
    setShowInvoice(true)
  }

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        order.supplier.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
  }

  const stats = {
    total: orders.length,
    borrador: orders.filter(o => o.status === 'BORRADOR').length,
    solicitud: orders.filter(o => o.status === 'SOLICITUD_PRESUPUESTO').length,
    comprada: orders.filter(o => o.status === 'COMPRADA').length,
    recibida: orders.filter(o => o.status === 'RECIBIDA').length,
    totalValue: orders.reduce((sum, order) => sum + order.total_amount, 0)
  }

  if (!user) {
    return <div>Cargando...</div>
  }

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className={cn(
              "p-3 rounded-xl",
              theme === 'dark' ? "bg-blue-900/30" : "bg-blue-50"
            )}>
              <ShoppingCart className={cn(
                "w-8 h-8",
                theme === 'dark' ? "text-blue-400" : "text-blue-600"
              )} />
            </div>
            <div>
              <h1 className={cn(
                "text-3xl font-bold",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                Órdenes de Compra
              </h1>
              <p className={cn(
                "text-base mt-1",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                Gestiona tus órdenes de compra a proveedores
              </p>
            </div>
          </div>

          <Button
            onClick={() => router.push('/dashboard/admin/purchase-orders/create')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nueva Orden
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className={cn(
            "rounded-xl p-4 border",
            theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
          )}>
            <div className="flex items-center justify-between mb-2">
              <ShoppingCart className={cn("w-5 h-5", theme === 'dark' ? "text-gray-400" : "text-gray-600")} />
            </div>
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className={cn("text-sm", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>Total Órdenes</div>
          </div>

          <div className={cn(
            "rounded-xl p-4 border",
            theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
          )}>
            <div className="flex items-center justify-between mb-2">
              <FileText className={cn("w-5 h-5", theme === 'dark' ? "text-gray-400" : "text-gray-600")} />
            </div>
            <div className="text-2xl font-bold text-gray-600">{stats.borrador}</div>
            <div className={cn("text-sm", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>Borradores</div>
          </div>

          <div className={cn(
            "rounded-xl p-4 border",
            theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
          )}>
            <div className="flex items-center justify-between mb-2">
              <Search className={cn("w-5 h-5 text-blue-600")} />
            </div>
            <div className="text-2xl font-bold text-blue-600">{stats.solicitud}</div>
            <div className={cn("text-sm", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>Solicitud Presupuesto</div>
          </div>

          <div className={cn(
            "rounded-xl p-4 border",
            theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
          )}>
            <div className="flex items-center justify-between mb-2">
              <CreditCard className={cn("w-5 h-5 text-yellow-600")} />
            </div>
            <div className="text-2xl font-bold text-yellow-600">{stats.comprada}</div>
            <div className={cn("text-sm", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>Compradas</div>
          </div>

          <div className={cn(
            "rounded-xl p-4 border",
            theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
          )}>
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className={cn("w-5 h-5 text-green-600")} />
            </div>
            <div className="text-2xl font-bold text-green-600">{stats.recibida}</div>
            <div className={cn("text-sm", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>Recibidas</div>
          </div>

          <div className={cn(
            "rounded-xl p-4 border",
            theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
          )}>
            <div className="flex items-center justify-between mb-2">
              <DollarSign className={cn("w-5 h-5 text-purple-600")} />
            </div>
            <div className="text-2xl font-bold text-purple-600">${stats.totalValue.toFixed(2)}</div>
            <div className={cn("text-sm", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>Valor Total</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className={cn(
              "absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5",
              theme === 'dark' ? "text-gray-400" : "text-gray-500"
            )} />
            <Input
              placeholder="Buscar por número de orden o proveedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(
                "pl-10",
                theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
              )}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={cn(
              "px-4 py-2 rounded-lg border",
              theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
            )}
          >
            <option value="all">Todos los estados</option>
            {Object.entries(STATUSES).map(([key, status]) => (
              <option key={key} value={key}>{status.label}</option>
            ))}
          </select>
        </div>

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto">
          {filteredOrders.length === 0 ? (
            <div className={cn(
              "h-full rounded-xl border p-12 text-center flex flex-col items-center justify-center",
              theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
            )}>
              <ShoppingCart className={cn(
                "w-20 h-20 mb-6 opacity-50",
                theme === 'dark' ? "text-gray-600" : "text-gray-400"
              )} />
              <h3 className={cn(
                "text-xl font-semibold mb-3",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                No hay órdenes de compra
              </h3>
              <p className={cn(
                "text-base mb-6 max-w-md",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                Crea tu primera orden de compra para empezar a gestionar tus pedidos
              </p>
              <Button
                onClick={() => router.push('/dashboard/admin/purchase-orders/create')}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
              >
                <Plus className="w-5 h-5 mr-2" />
                Crear Primera Orden
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className={cn(
                    "rounded-xl border p-6 hover:shadow-lg transition-all duration-300",
                    theme === 'dark' ? "bg-gray-800/50 border-gray-700 hover:border-gray-600" : "bg-white border-gray-200 hover:border-gray-300"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className={cn(
                        "p-3 rounded-xl",
                        theme === 'dark' ? "bg-purple-900/30" : "bg-purple-50"
                      )}>
                        <ShoppingCart className={cn(
                          "w-8 h-8",
                          theme === 'dark' ? "text-purple-400" : "text-purple-600"
                        )} />
                      </div>

                      <div>
                        <div className="flex items-center gap-4 mb-2">
                          <h3 className={cn(
                            "text-xl font-semibold",
                            theme === 'dark' ? "text-white" : "text-gray-900"
                          )}>
                            {order.order_number}
                          </h3>
                          <span className={cn(
                            "text-sm px-3 py-1 rounded-full font-medium border",
                            getStatusColor(order.status)
                          )}>
                            {STATUSES[order.status as keyof typeof STATUSES]?.label || order.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-6">
                          <div>
                            <p className={cn(
                              "text-xs mb-1",
                              theme === 'dark' ? "text-gray-500" : "text-gray-400"
                            )}>
                              Proveedor
                            </p>
                            <p className={cn(
                              "font-medium",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              {order.supplier}
                            </p>
                          </div>

                          <div>
                            <p className={cn(
                              "text-xs mb-1",
                              theme === 'dark' ? "text-gray-500" : "text-gray-400"
                            )}>
                              Fecha
                            </p>
                            <p className={cn(
                              "font-medium",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              {new Date(order.order_date).toLocaleDateString()}
                            </p>
                          </div>

                          <div>
                            <p className={cn(
                              "text-xs mb-1",
                              theme === 'dark' ? "text-gray-500" : "text-gray-400"
                            )}>
                              Items
                            </p>
                            <p className={cn(
                              "font-medium",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              {order.items.length} productos
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={cn(
                          "text-xs mb-1",
                          theme === 'dark' ? "text-gray-500" : "text-gray-400"
                        )}>
                          Total
                        </p>
                        <p className={cn(
                          "text-xl font-bold text-blue-600",
                          theme === 'dark' ? "text-blue-400" : "text-blue-600"
                        )}>
                          ${order.total_amount.toFixed(2)}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setViewingOrder(order)}
                          className={cn(
                            theme === 'dark' ? "border-gray-600 text-gray-300 hover:bg-gray-800" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                          )}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingOrder(order)
                            setFormData({
                              supplier: order.supplier,
                              supplier_contact: order.supplier_contact || '',
                              supplier_phone: order.supplier_phone || '',
                              supplier_email: order.supplier_email || '',
                              items: order.items,
                              expected_delivery: order.expected_delivery || '',
                              notes: order.notes || '',
                              payment_method: order.payment_method || 'Transferencia',
                              payment_terms: order.payment_terms || '30 días'
                            })
                            setShowCreateForm(true)
                          }}
                          className={cn(
                            theme === 'dark' ? "border-gray-600 text-gray-300 hover:bg-gray-800" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                          )}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePrintInvoice(order)}
                          className={cn(
                            theme === 'dark' ? "border-gray-600 text-gray-300 hover:bg-gray-800" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                          )}
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Status Progress */}
                  <div className="mt-4 flex items-center gap-2">
                    {Object.entries(STATUSES).map(([key, status], index) => {
                      const isCompleted = Object.keys(STATUSES).indexOf(order.status) >= index
                      const isActive = Object.keys(STATUSES).indexOf(order.status) === index

                      return (
                        <React.Fragment key={key}>
                          <div className={cn(
                            "flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-medium",
                            isCompleted
                              ? theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                              : theme === 'dark' ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-500'
                          )}>
                            {isCompleted ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {status.label}
                          </div>
                          {index < Object.keys(STATUSES).length - 1 && (
                            <ArrowRight className={cn(
                              "w-4 h-4",
                              isCompleted ? 'text-green-500' : 'text-gray-400'
                            )} />
                          )}
                        </React.Fragment>
                      )
                    })}
                  </div>

                  {/* Action Buttons based on status */}
                  <div className="mt-4 flex gap-2">
                    {order.status === 'BORRADOR' && (
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => updateOrderStatus(order.id, 'SOLICITUD_PRESUPUESTO')}
                        disabled={loading}
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        Solicitar Presupuesto
                      </Button>
                    )}

                    {order.status === 'SOLICITUD_PRESUPUESTO' && (
                      <Button
                        size="sm"
                        className="bg-yellow-600 hover:bg-yellow-700 text-white"
                        onClick={() => updateOrderStatus(order.id, 'COMPRADA')}
                        disabled={loading}
                      >
                        <CreditCard className="w-4 h-4 mr-1" />
                        Marcar como Comprada
                      </Button>
                    )}

                    {order.status === 'COMPRADA' && (
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => router.push(`/dashboard/admin/purchase-orders/receive/${order.id}`)}
                        disabled={loading}
                      >
                        <CheckSquare className="w-4 h-4 mr-1" />
                        Recibir Mercancía
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create/Edit Order Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <div className={cn(
              "w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-8",
              theme === 'dark' ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className="flex items-center justify-between mb-6">
                <h2 className={cn(
                  "text-2xl font-bold",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  {editingOrder ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCreateForm(false)
                    setEditingOrder(null)
                    resetForm()
                  }}
                  className={cn(
                    theme === 'dark' ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-600"
                  )}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Supplier Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      Proveedor *
                    </label>
                    <Input
                      required
                      value={formData.supplier}
                      onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
                      className={cn(
                        theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                      )}
                    />
                  </div>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      Contacto
                    </label>
                    <Input
                      value={formData.supplier_contact}
                      onChange={(e) => setFormData(prev => ({ ...prev, supplier_contact: e.target.value }))}
                      className={cn(
                        theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                      )}
                    />
                  </div>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      Teléfono
                    </label>
                    <Input
                      value={formData.supplier_phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, supplier_phone: e.target.value }))}
                      className={cn(
                        theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                      )}
                    />
                  </div>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      Email
                    </label>
                    <Input
                      type="email"
                      value={formData.supplier_email}
                      onChange={(e) => setFormData(prev => ({ ...prev, supplier_email: e.target.value }))}
                      className={cn(
                        theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                      )}
                    />
                  </div>
                </div>

                {/* Items */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={cn(
                      "text-lg font-semibold",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      Items de la Orden
                    </h3>
                    <Button
                      type="button"
                      onClick={addItem}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Agregar Item
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {formData.items.map((item, index) => (
                      <div key={index} className={cn(
                        "p-4 rounded-lg border",
                        theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"
                      )}>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              Tamaño
                            </label>
                            <select
                              value={item.size}
                              onChange={(e) => updateItem(index, 'size', e.target.value)}
                              className={cn(
                                "w-full px-3 py-2 rounded-lg border",
                                theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                              )}
                            >
                              {BOX_SIZES.map(size => (
                                <option key={size} value={size}>{size}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              Cantidad
                            </label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                              className={cn(
                                theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                              )}
                            />
                          </div>

                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              Precio Unitario
                            </label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unit_price}
                              onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              className={cn(
                                theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                              )}
                            />
                          </div>

                          <div className="flex items-end">
                            <div className="flex-1">
                              <label className={cn(
                                "block text-sm font-medium mb-2",
                                theme === 'dark' ? "text-gray-300" : "text-gray-700"
                              )}>
                                Total
                              </label>
                              <div className={cn(
                                "px-3 py-2 rounded-lg border font-medium",
                                theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                              )}>
                                ${(item.quantity * item.unit_price).toFixed(2)}
                              </div>
                            </div>

                            {formData.items.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeItem(index)}
                                className={cn(
                                  "ml-2",
                                  theme === 'dark' ? "hover:bg-gray-700 text-red-400" : "hover:bg-gray-100 text-red-600"
                                )}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 text-right">
                    <div className="text-lg font-semibold">
                      Total de la Orden: <span className="text-blue-600">${calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Additional Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      Fecha de Entrega Esperada
                    </label>
                    <Input
                      type="date"
                      value={formData.expected_delivery}
                      onChange={(e) => setFormData(prev => ({ ...prev, expected_delivery: e.target.value }))}
                      className={cn(
                        theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                      )}
                    />
                  </div>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      Método de Pago
                    </label>
                    <select
                      value={formData.payment_method}
                      onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                      className={cn(
                        "w-full px-3 py-2 rounded-lg border",
                        theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                      )}
                    >
                      {PAYMENT_METHODS.map(method => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                  )}>
                    Notas
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className={cn(
                      "w-full px-3 py-2 rounded-lg border resize-none",
                      theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                    )}
                  />
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateForm(false)
                      setEditingOrder(null)
                      resetForm()
                    }}
                    className={cn(
                      theme === 'dark' ? "border-gray-600 text-gray-300 hover:bg-gray-800" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    Cancelar
                  </Button>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {loading ? 'Guardando...' : (editingOrder ? 'Actualizar Orden' : 'Crear Orden')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Order Details Modal */}
        {viewingOrder && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <div className={cn(
              "w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-8",
              theme === 'dark' ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className="flex items-center justify-between mb-6">
                <h2 className={cn(
                  "text-2xl font-bold",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  Detalles de la Orden
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewingOrder(null)}
                  className={cn(
                    theme === 'dark' ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-600"
                  )}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-6">
                {/* Order Header */}
                <div className={cn(
                  "p-6 rounded-lg",
                  theme === 'dark' ? "bg-gray-800" : "bg-gray-50"
                )}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className={cn(
                        "text-xl font-semibold mb-2",
                        theme === 'dark' ? "text-white" : "text-gray-900"
                      )}>
                        {viewingOrder.order_number}
                      </h3>
                      <span className={cn(
                        "text-sm px-3 py-1 rounded-full font-medium border",
                        getStatusColor(viewingOrder.status)
                      )}>
                        {STATUSES[viewingOrder.status as keyof typeof STATUSES]?.label || viewingOrder.status}
                      </span>
                    </div>

                    <div className="text-right">
                      <p className={cn(
                        "text-sm mb-1",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        Total
                      </p>
                      <p className={cn(
                        "text-2xl font-bold text-blue-600",
                        theme === 'dark' ? "text-blue-400" : "text-blue-600"
                      )}>
                        ${viewingOrder.total_amount.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className={cn("mb-1", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>Fecha:</p>
                      <p className={cn("font-medium", theme === 'dark' ? "text-gray-300" : "text-gray-700")}>
                        {new Date(viewingOrder.order_date).toLocaleDateString()}
                      </p>
                    </div>
                    {viewingOrder.expected_delivery && (
                      <div>
                        <p className={cn("mb-1", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>Entrega Esperada:</p>
                        <p className={cn("font-medium", theme === 'dark' ? "text-gray-300" : "text-gray-700")}>
                          {new Date(viewingOrder.expected_delivery).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Supplier Information */}
                <div>
                  <h4 className={cn(
                    "text-lg font-semibold mb-3",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    Información del Proveedor
                  </h4>
                  <div className={cn(
                    "p-4 rounded-lg",
                    theme === 'dark' ? "bg-gray-800" : "bg-gray-50"
                  )}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className={cn("text-sm mb-1", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>Proveedor:</p>
                        <p className={cn("font-medium", theme === 'dark' ? "text-gray-300" : "text-gray-700")}>
                          {viewingOrder.supplier}
                        </p>
                      </div>
                      {viewingOrder.supplier_contact && (
                        <div>
                          <p className={cn("text-sm mb-1", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>Contacto:</p>
                          <p className={cn("font-medium", theme === 'dark' ? "text-gray-300" : "text-gray-700")}>
                            {viewingOrder.supplier_contact}
                          </p>
                        </div>
                      )}
                      {viewingOrder.supplier_phone && (
                        <div>
                          <p className={cn("text-sm mb-1", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>Teléfono:</p>
                          <p className={cn("font-medium", theme === 'dark' ? "text-gray-300" : "text-gray-700")}>
                            {viewingOrder.supplier_phone}
                          </p>
                        </div>
                      )}
                      {viewingOrder.supplier_email && (
                        <div>
                          <p className={cn("text-sm mb-1", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>Email:</p>
                          <p className={cn("font-medium", theme === 'dark' ? "text-gray-300" : "text-gray-700")}>
                            {viewingOrder.supplier_email}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <h4 className={cn(
                    "text-lg font-semibold mb-3",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    Items de la Orden
                  </h4>
                  <div className="space-y-2">
                    {viewingOrder.items.map((item, index) => (
                      <div key={index} className={cn(
                        "p-4 rounded-lg flex items-center justify-between",
                        theme === 'dark' ? "bg-gray-800" : "bg-gray-50"
                      )}>
                        <div>
                          <p className={cn("font-medium", theme === 'dark' ? "text-gray-300" : "text-gray-700")}>
                            Caja {item.size}
                          </p>
                          <p className={cn("text-sm", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
                            Cantidad: {item.quantity} × ${item.unit_price.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={cn("font-semibold", theme === 'dark' ? "text-gray-300" : "text-gray-700")}>
                            ${item.total_price.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {viewingOrder.notes && (
                  <div>
                    <h4 className={cn(
                      "text-lg font-semibold mb-3",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      Notas
                    </h4>
                    <div className={cn(
                      "p-4 rounded-lg",
                      theme === 'dark' ? "bg-gray-800" : "bg-gray-50"
                    )}>
                      <p className={cn(theme === 'dark' ? "text-gray-300" : "text-gray-700")}>
                        {viewingOrder.notes}
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
                  <Button
                    variant="outline"
                    onClick={() => setViewingOrder(null)}
                    className={cn(
                      theme === 'dark' ? "border-gray-600 text-gray-300 hover:bg-gray-800" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    Cerrar
                  </Button>

                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimir Factura
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Component */}
        {printingOrder && (
          <PurchaseOrderInvoice
            order={printingOrder}
            isVisible={showInvoice}
          />
        )}
      </div>
    </DashboardLayout>
  )
}