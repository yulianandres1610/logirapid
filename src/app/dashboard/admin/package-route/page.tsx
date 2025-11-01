'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Package,
  Plus,
  Search,
  Filter,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  Truck,
  Box,
  ArrowRight,
  Calendar,
  Users,
  BarChart3,
  TrendingUp,
  ShoppingCart,
  Tag,
  Printer,
  Package2,
  Archive,
  CreditCard,
  QrCode,
  DollarSign,
  TrendingDown,
  Eye,
  Edit,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  FileText,
  AlertTriangle,
  CheckSquare
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BarcodeGenerator } from '@/components/barcode-generator'
import { PackageLabelPrinter } from '@/components/package-label-printer'
import {
  Box as BoxType,
  PackagePrice,
  PurchaseOrder,
  Shipment,
  createBox,
  getAllBoxes,
  getCurrentPrices,
  getAllPurchaseOrders,
  getAllShipments,
  createPrice,
  createPurchaseOrder,
  updateBox,
  receivePurchaseOrder
} from '@/lib/package-types'

export default function PackageRoutePage() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const router = useRouter()

  // Estados principales
  const [activeTab, setActiveTab] = useState<'inventory' | 'prices' | 'orders' | 'printing'>('inventory')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)

  // Datos de la base de datos
  const [boxes, setBoxes] = useState<BoxType[]>([])
  const [prices, setPrices] = useState<PackagePrice[]>([])
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [shipments, setShipments] = useState<Shipment[]>([])

  // Estados para formularios modales
  const [showBoxModal, setShowBoxModal] = useState(false)
  const [showPriceModal, setShowPriceModal] = useState(false)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [selectedBoxes, setSelectedBoxes] = useState<string[]>([])
  const [selectedBoxForLabel, setSelectedBoxForLabel] = useState<BoxType | null>(null)
  const [showLabelPrinter, setShowLabelPrinter] = useState(false)

  // Cargar datos al montar
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [boxesData, pricesData, ordersData, shipmentsData] = await Promise.all([
        Promise.resolve(getAllBoxes()),
        Promise.resolve(getCurrentPrices()),
        Promise.resolve(getAllPurchaseOrders()),
        Promise.resolve(getAllShipments())
      ])
      setBoxes(boxesData)
      setPrices(pricesData)
      setOrders(ordersData)
      setShipments(shipmentsData)
    } catch (error) {
      console.error('Error loading data:', error)
      showNotification('Error al cargar los datos', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Estadísticas
  const stats = {
    totalBoxes: boxes.length,
    availableBoxes: boxes.filter(b => b.status === 'AVAILABLE').length,
    inUseBoxes: boxes.filter(b => b.status === 'IN_USE').length,
    totalValue: boxes.reduce((sum, box) => sum + box.cost, 0),
    activeOrders: orders.filter(o => o.status === 'PENDING' || o.status === 'APPROVED').length,
    totalOrdersValue: orders.reduce((sum, order) => sum + order.total_amount, 0)
  }

  // Funciones de ayuda
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return theme === 'dark' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-green-100 text-green-600 border-green-200'
      case 'IN_USE':
        return theme === 'dark' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-100 text-blue-600 border-blue-200'
      case 'MAINTENANCE':
        return theme === 'dark' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-yellow-100 text-yellow-600 border-yellow-200'
      case 'DAMAGED':
        return theme === 'dark' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-600 border-red-200'
      case 'DISPOSED':
        return theme === 'dark' ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' : 'bg-gray-100 text-gray-600 border-gray-200'
      case 'PENDING':
        return theme === 'dark' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-yellow-100 text-yellow-600 border-yellow-200'
      case 'APPROVED':
        return theme === 'dark' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-100 text-blue-600 border-blue-200'
      case 'RECEIVED':
        return theme === 'dark' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-green-100 text-green-600 border-green-200'
      case 'CANCELLED':
        return theme === 'dark' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-600 border-red-200'
      default:
        return theme === 'dark' ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' : 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'Disponible'
      case 'IN_USE': return 'En Uso'
      case 'MAINTENANCE': return 'Mantenimiento'
      case 'DAMAGED': return 'Dañada'
      case 'DISPOSED': return 'Eliminada'
      case 'PENDING': return 'Pendiente'
      case 'APPROVED': return 'Lista para Entrega'
      case 'RECEIVED': return 'Recibida'
      case 'CANCELLED': return 'Cancelada'
      default: return status
    }
  }

  // Funciones para manejar acciones
  const handleCreateBox = async (boxData: any) => {
    try {
      const newBox = createBox(boxData)
      if (newBox) {
        showNotification('Caja creada exitosamente', 'success')
        loadData()
        setShowBoxModal(false)
      } else {
        showNotification('Error al crear la caja', 'error')
      }
    } catch (error) {
      console.error('Error creating box:', error)
      showNotification('Error al crear la caja', 'error')
    }
  }

  const handleCreatePrice = async (priceData: any) => {
    try {
      const newPrice = createPrice(priceData)
      if (newPrice) {
        showNotification('Precio creado exitosamente', 'success')
        loadData()
        setShowPriceModal(false)
      } else {
        showNotification('Error al crear el precio', 'error')
      }
    } catch (error) {
      console.error('Error creating price:', error)
      showNotification('Error al crear el precio', 'error')
    }
  }

  const handleCreateOrder = async (orderData: any) => {
    try {
      const newOrder = createPurchaseOrder(orderData)
      if (newOrder) {
        showNotification('Orden creada exitosamente', 'success')
        loadData()
        setShowOrderModal(false)
      } else {
        showNotification('Error al crear la orden', 'error')
      }
    } catch (error) {
      console.error('Error creating order:', error)
      showNotification('Error al crear la orden', 'error')
    }
  }

  const handlePrintLabels = () => {
    if (selectedBoxes.length === 0) {
      showNotification('Seleccione al menos una caja para imprimir', 'warning')
      return
    }
    setShowPrintModal(true)
  }

  const handlePrintLabel = (box: BoxType) => {
    setSelectedBoxForLabel(box)
    setShowLabelPrinter(true)
  }

  // Función para recibir una orden y crear cajas en el inventario
  const handleReceiveOrder = async (orderId: string) => {
    try {
      setLoading(true)

      // Usar la nueva función del servidor para recibir la orden y crear cajas automáticamente
      const result = await receivePurchaseOrder(orderId)

      if (result) {
        showNotification(result.message, 'success')
        loadData() // Recargar todos los datos
      } else {
        showNotification('Error al recibir la orden', 'error')
      }
    } catch (error) {
      console.error('Error receiving order:', error)
      showNotification('Error al recibir la orden', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Función para procesar una orden (marcar como lista para entrega)
  const handleProcessOrder = async (orderId: string) => {
    try {
      const response = await fetch(`/api/packages?type=order&id=${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'APPROVED' }),
      })

      if (response.ok) {
        showNotification('Orden procesada y lista para entrega', 'success')
        loadData()
      } else {
        showNotification('Error al procesar la orden', 'error')
      }
    } catch (error) {
      console.error('Error processing order:', error)
      showNotification('Error al procesar la orden', 'error')
    }
  }

  // Función para enviar cajas (reducir inventario automáticamente)
  const handleShipBoxes = async (boxIds: string[], destination: string) => {
    try {
      setLoading(true)

      const shipmentData = {
        boxes: boxIds,
        origin: 'Almacén Principal',
        destination,
        status: 'PREPARING' as const
      }

      const response = await fetch('/api/packages?type=shipment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(shipmentData),
      })

      if (response.ok) {
        const shipment = await response.json()
        showNotification(
          `Envío creado exitosamente. ${boxIds.length} cajas asignadas al envío ${shipment.id.slice(-8)}`,
          'success'
        )
        loadData()
        setSelectedBoxes([]) // Limpiar selección
      } else {
        showNotification('Error al crear el envío', 'error')
      }
    } catch (error) {
      console.error('Error shipping boxes:', error)
      showNotification('Error al crear el envío', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col space-y-4 p-4">
        {/* Estadísticas Principales - Cards Grandes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          <div className={cn(
            "rounded-xl p-6 border",
            theme === 'dark'
              ? "bg-gray-800/50 border-gray-700"
              : "bg-white border-gray-200"
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className={cn(
                "p-4 rounded-xl",
                theme === 'dark' ? "bg-blue-900/30" : "bg-blue-50"
              )}>
                <Package2 className={cn(
                  "w-8 h-8",
                  theme === 'dark' ? "text-blue-400" : "text-blue-600"
                )} />
              </div>
              <div className={cn(
                "text-sm font-medium px-3 py-1 rounded-lg",
                theme === 'dark' ? "text-green-400 bg-green-400/10" : "text-green-600 bg-green-50"
              )}>
                <TrendingUp className="w-4 h-4 inline mr-1" />
                +8%
              </div>
            </div>
            <h3 className={cn(
              "text-3xl font-bold",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>{stats.totalBoxes}</h3>
            <p className={cn(
              "text-base",
              theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>Total Cajas</p>
          </div>

          <div className={cn(
            "rounded-xl p-6 border",
            theme === 'dark'
              ? "bg-gray-800/50 border-gray-700"
              : "bg-white border-gray-200"
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className={cn(
                "p-4 rounded-xl",
                theme === 'dark' ? "bg-green-900/30" : "bg-green-50"
              )}>
                <CheckSquare className={cn(
                  "w-8 h-8",
                  theme === 'dark' ? "text-green-400" : "text-green-600"
                )} />
              </div>
              <div className={cn(
                "text-sm font-medium px-3 py-1 rounded-lg",
                theme === 'dark' ? "text-blue-400 bg-blue-400/10" : "text-blue-600 bg-blue-50"
              )}>
                Disponible
              </div>
            </div>
            <h3 className={cn(
              "text-3xl font-bold",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>{stats.availableBoxes}</h3>
            <p className={cn(
              "text-base",
              theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>Cajas Disponibles</p>
          </div>

          <div className={cn(
            "rounded-xl p-6 border",
            theme === 'dark'
              ? "bg-gray-800/50 border-gray-700"
              : "bg-white border-gray-200"
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className={cn(
                "p-4 rounded-xl",
                theme === 'dark' ? "bg-purple-900/30" : "bg-purple-50"
              )}>
                <ShoppingCart className={cn(
                  "w-8 h-8",
                  theme === 'dark' ? "text-purple-400" : "text-purple-600"
                )} />
              </div>
              <div className={cn(
                "text-sm font-medium px-3 py-1 rounded-lg",
                theme === 'dark' ? "text-green-400 bg-green-400/10" : "text-green-600 bg-green-50"
              )}>
                Activas
              </div>
            </div>
            <h3 className={cn(
              "text-3xl font-bold",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>{stats.activeOrders}</h3>
            <p className={cn(
              "text-base",
              theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>Órdenes Activas</p>
          </div>

          <div className={cn(
            "rounded-xl p-6 border",
            theme === 'dark'
              ? "bg-gray-800/50 border-gray-700"
              : "bg-white border-gray-200"
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className={cn(
                "p-4 rounded-xl",
                theme === 'dark' ? "bg-orange-900/30" : "bg-orange-50"
              )}>
                <DollarSign className={cn(
                  "w-8 h-8",
                  theme === 'dark' ? "text-orange-400" : "text-orange-600"
                )} />
              </div>
              <div className={cn(
                "text-sm font-medium px-3 py-1 rounded-lg",
                theme === 'dark' ? "text-blue-400 bg-blue-400/10" : "text-blue-600 bg-blue-50"
              )}>
                Total
              </div>
            </div>
            <h3 className={cn(
              "text-3xl font-bold",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              ${stats.totalValue.toLocaleString()}
            </h3>
            <p className={cn(
              "text-base",
              theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>Valor Inventario</p>
          </div>
        </div>

        {/* Barra de herramientas */}
        <div className="flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar cajas, órdenes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  "pl-10 pr-4 h-10 w-64",
                  theme === 'dark'
                    ? "bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                    : "bg-white border-gray-200 text-gray-900 placeholder-gray-500"
                )}
              />
            </div>

            <Button
              onClick={() => setShowBoxModal(true)}
              className={cn(
                "flex items-center gap-2 h-10",
                "bg-blue-600 hover:bg-blue-700 text-white",
                "shadow-sm hover:shadow-md transition-all duration-200"
              )}
            >
              <Plus className="w-4 h-4" />
              Nueva Caja
            </Button>
          </div>
        </div>

        {/* Tabs de Navegación */}
        <div className={cn(
          "rounded-xl border p-1 shrink-0",
          theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('inventory')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 flex-1 justify-center",
                activeTab === 'inventory'
                  ? theme === 'dark'
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    : "bg-blue-50 text-blue-600 border border-blue-200"
                  : theme === 'dark'
                    ? "text-gray-400 hover:text-white hover:bg-gray-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              <Archive className="w-4 h-4" />
              Inventario
            </button>
            <button
              onClick={() => setActiveTab('prices')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 flex-1 justify-center",
                activeTab === 'prices'
                  ? theme === 'dark'
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    : "bg-blue-50 text-blue-600 border border-blue-200"
                  : theme === 'dark'
                    ? "text-gray-400 hover:text-white hover:bg-gray-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              <Tag className="w-4 h-4" />
              Precios
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 flex-1 justify-center",
                activeTab === 'orders'
                  ? theme === 'dark'
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    : "bg-blue-50 text-blue-600 border border-blue-200"
                  : theme === 'dark'
                    ? "text-gray-400 hover:text-white hover:bg-gray-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              <ShoppingCart className="w-4 h-4" />
              Órdenes
            </button>
            <button
              onClick={() => setActiveTab('printing')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 flex-1 justify-center",
                activeTab === 'printing'
                  ? theme === 'dark'
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    : "bg-blue-50 text-blue-600 border border-blue-200"
                  : theme === 'dark'
                    ? "text-gray-400 hover:text-white hover:bg-gray-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              <Printer className="w-4 h-4" />
              Impresión
            </button>
          </div>
        </div>

        {/* Contenido de las Tabs */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'inventory' && (
            <div className="h-full flex flex-col space-y-4">
              {/* Filtros y acciones */}
              <div className="flex flex-wrap justify-between items-center gap-4 shrink-0">
                <div className="flex gap-2">
                  {['Todos', 'Disponible', 'En Uso', 'Mantenimiento', 'Dañada'].map((filter) => (
                    <button
                      key={filter}
                      className={cn(
                        "px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200",
                        filter === 'Todos'
                          ? theme === 'dark'
                            ? "bg-gray-700 text-gray-300"
                            : "bg-gray-100 text-gray-700"
                          : theme === 'dark'
                            ? "text-gray-400 hover:text-white hover:bg-gray-700"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      )}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowPriceModal(true)}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Tag className="w-4 h-4 mr-2" />
                    Gestionar Precios
                  </Button>
                  <Button
                    onClick={() => setShowOrderModal(true)}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Nueva Orden
                  </Button>
                </div>
              </div>

              {/* Lista de Cajas - Ocupa todo el espacio restante */}
              <div className="flex-1 overflow-y-auto">
                {boxes.length === 0 ? (
                  <div className={cn(
                    "h-full rounded-xl border p-12 text-center flex flex-col items-center justify-center",
                    theme === 'dark'
                      ? "bg-gray-800/50 border-gray-700"
                      : "bg-white border-gray-200"
                  )}>
                    <Package2 className={cn(
                      "w-20 h-20 mb-6 opacity-50",
                      theme === 'dark' ? "text-gray-600" : "text-gray-400"
                    )} />
                    <h3 className={cn(
                      "text-xl font-semibold mb-3",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      No hay cajas registradas
                    </h3>
                    <p className={cn(
                      "text-base mb-6 max-w-md",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Comienza agregando tu primera caja al inventario para iniciar el sistema de gestión
                    </p>
                    <Button
                      onClick={() => setShowBoxModal(true)}
                      size="lg"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Agregar Primera Caja
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {boxes.map((box) => (
                      <div
                        key={box.id}
                        className={cn(
                          "rounded-xl border p-6 hover:shadow-lg transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 hover:border-gray-600"
                            : "bg-white border-gray-200 hover:border-gray-300"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-6">
                            {/* Checkbox de selección */}
                            <input
                              type="checkbox"
                              checked={selectedBoxes.includes(box.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedBoxes([...selectedBoxes, box.id])
                                } else {
                                  setSelectedBoxes(selectedBoxes.filter(id => id !== box.id))
                                }
                              }}
                              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />

                            {/* Información de la caja */}
                            <div className={cn(
                              "p-4 rounded-xl",
                              theme === 'dark' ? "bg-blue-900/30" : "bg-blue-50"
                            )}>
                              <Package2 className={cn(
                                "w-10 h-10",
                                theme === 'dark' ? "text-blue-400" : "text-blue-600"
                              )} />
                            </div>

                            <div>
                              <h3 className={cn(
                                "text-xl font-semibold mb-2",
                                theme === 'dark' ? "text-white" : "text-gray-900"
                              )}>
                                {box.barcode}
                              </h3>

                              {/* Código de barras real */}
                              <div className="mb-3">
                                <BarcodeGenerator
                                  value={box.barcode}
                                  width={1}
                                  height={40}
                                  displayValue={false}
                                  className="w-full"
                                />
                              </div>
                              <div className="flex items-center gap-6">
                                <div>
                                  <p className={cn(
                                    "text-xs mb-1",
                                    theme === 'dark' ? "text-gray-500" : "text-gray-400"
                                  )}>
                                    Tamaño
                                  </p>
                                  <p className={cn(
                                    "font-medium",
                                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                                  )}>
                                    {box.size}
                                  </p>
                                </div>
                                <div>
                                  <p className={cn(
                                    "text-xs mb-1",
                                    theme === 'dark' ? "text-gray-500" : "text-gray-400"
                                  )}>
                                    Capacidad
                                  </p>
                                  <p className={cn(
                                    "font-medium",
                                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                                  )}>
                                    {box.dimensions.weight_capacity}kg
                                  </p>
                                </div>
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
                                    {box.supplier}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            {/* Estado */}
                            <span className={cn(
                              "text-sm px-4 py-2 rounded-full font-medium border",
                              getStatusColor(box.status)
                            )}>
                              {getStatusText(box.status)}
                            </span>

                            {/* Costo */}
                            <div className="text-right">
                              <p className={cn(
                                "text-xs mb-1",
                                theme === 'dark' ? "text-gray-500" : "text-gray-400"
                              )}>
                                Costo
                              </p>
                              <p className={cn(
                                "text-lg font-bold",
                                theme === 'dark' ? "text-gray-300" : "text-gray-700"
                              )}>
                                ${box.cost.toFixed(2)}
                              </p>
                            </div>

                            {/* Acciones */}
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handlePrintLabel(box)}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                <Printer className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        {activeTab === 'prices' && (
            <div className="h-full flex flex-col space-y-4">
              <div className="flex justify-between items-center shrink-0">
                <Button
                  onClick={() => setShowPriceModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Tarifa
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {prices.length === 0 ? (
                  <div className={cn(
                    "h-full rounded-xl border p-12 text-center flex flex-col items-center justify-center",
                    theme === 'dark'
                      ? "bg-gray-800/50 border-gray-700"
                      : "bg-white border-gray-200"
                  )}>
                    <Tag className={cn(
                      "w-20 h-20 mb-6 opacity-50",
                      theme === 'dark' ? "text-gray-600" : "text-gray-400"
                    )} />
                    <h3 className={cn(
                      "text-xl font-semibold mb-3",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      No hay tarifas configuradas
                    </h3>
                    <p className={cn(
                      "text-base mb-6 max-w-md",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Define los precios para cada tamaño de caja y establece los márgenes de ganancia
                    </p>
                    <Button
                      onClick={() => setShowPriceModal(true)}
                      size="lg"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Crear Primera Tarifa
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {prices.map((price) => (
                      <div
                        key={price.id}
                        className={cn(
                          "rounded-xl border p-8 hover:shadow-lg transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 hover:border-gray-600"
                            : "bg-white border-gray-200 hover:border-gray-300"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-6">
                            <div className={cn(
                              "p-4 rounded-xl",
                              theme === 'dark' ? "bg-green-900/30" : "bg-green-50"
                            )}>
                              <Tag className={cn(
                                "w-10 h-10",
                                theme === 'dark' ? "text-green-400" : "text-green-600"
                              )} />
                            </div>
                            <div>
                              <h3 className={cn(
                                "text-xl font-semibold mb-2",
                                theme === 'dark' ? "text-white" : "text-gray-900"
                              )}>
                                Caja {price.size}
                              </h3>
                              <p className={cn(
                                "text-base",
                                theme === 'dark' ? "text-gray-400" : "text-gray-600"
                              )}>
                                Proveedor: {price.supplier}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-8">
                            <div className="text-center">
                              <p className={cn(
                                "text-xs mb-1",
                                theme === 'dark' ? "text-gray-500" : "text-gray-400"
                              )}>
                                Precio Base
                              </p>
                              <p className={cn(
                                "text-lg font-semibold",
                                theme === 'dark' ? "text-gray-300" : "text-gray-700"
                              )}>
                                ${price.base_price.toFixed(2)}
                              </p>
                            </div>
                            <div className="text-center">
                              <p className={cn(
                                "text-xs mb-1",
                                theme === 'dark' ? "text-gray-500" : "text-gray-400"
                              )}>
                                Margen
                              </p>
                              <p className={cn(
                                "text-lg font-semibold",
                                theme === 'dark' ? "text-gray-300" : "text-gray-700"
                              )}>
                                ${price.supplier_margin.toFixed(2)}
                              </p>
                            </div>
                            <div className="text-center">
                              <p className={cn(
                                "text-xs mb-1",
                                theme === 'dark' ? "text-gray-500" : "text-gray-400"
                              )}>
                                Precio Final
                              </p>
                              <p className={cn(
                                "text-xl font-bold text-green-600",
                                theme === 'dark' ? "text-green-400" : "text-green-600"
                              )}>
                                ${price.final_price.toFixed(2)}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="h-full flex flex-col space-y-4">
              <div className="flex justify-end shrink-0">
                <Button
                  onClick={() => setShowOrderModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Orden
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {orders.length === 0 ? (
                  <div className={cn(
                    "h-full rounded-xl border p-12 text-center flex flex-col items-center justify-center",
                    theme === 'dark'
                      ? "bg-gray-800/50 border-gray-700"
                      : "bg-white border-gray-200"
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
                      Crea tu primera orden de compra a proveedores para gestionar el inventario de cajas
                    </p>
                    <Button
                      onClick={() => setShowOrderModal(true)}
                      size="lg"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Crear Primera Orden
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className={cn(
                          "rounded-xl border p-8 hover:shadow-lg transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 hover:border-gray-600"
                            : "bg-white border-gray-200 hover:border-gray-300"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-6">
                            <div className={cn(
                              "p-4 rounded-xl",
                              theme === 'dark' ? "bg-purple-900/30" : "bg-purple-50"
                            )}>
                              <ShoppingCart className={cn(
                                "w-10 h-10",
                                theme === 'dark' ? "text-purple-400" : "text-purple-600"
                              )} />
                            </div>
                            <div>
                              <h3 className={cn(
                                "text-xl font-semibold mb-2",
                                theme === 'dark' ? "text-white" : "text-gray-900"
                              )}>
                                {order.order_number}
                              </h3>
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
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            {/* Estado */}
                            <span className={cn(
                              "text-sm px-4 py-2 rounded-full font-medium border",
                              getStatusColor(order.status)
                            )}>
                              {getStatusText(order.status)}
                            </span>

                            {/* Total */}
                            <div className="text-center">
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

                            {/* Acciones */}
                            <div className="flex gap-2">
                              {order.status === 'PENDING' && (
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  onClick={() => handleReceiveOrder(order.id)}
                                  disabled={loading}
                                >
                                  <CheckSquare className="w-4 h-4 mr-1" />
                                  Recibir
                                </Button>
                              )}
                              {order.status === 'APPROVED' && (
                                <Button
                                  size="sm"
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                  onClick={() => handleProcessOrder(order.id)}
                                  disabled={loading}
                                >
                                  <Package2 className="w-4 h-4 mr-1" />
                                  Procesar
                                </Button>
                              )}
                              <Button
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'printing' && (
            <div className="h-full flex flex-col space-y-4">
              <div className="flex justify-end shrink-0">
                <Button
                  onClick={handlePrintLabels}
                  disabled={selectedBoxes.length === 0}
                  size="lg"
                  className={cn(
                    "bg-blue-600 hover:bg-blue-700 text-white px-6",
                    selectedBoxes.length === 0 && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Printer className="w-5 h-5 mr-2" />
                  Imprimir Seleccionadas ({selectedBoxes.length})
                </Button>
              </div>

              <div className={cn(
                "flex-1 rounded-xl border p-12 flex flex-col items-center justify-center",
                theme === 'dark'
                  ? "bg-gray-800/50 border-gray-700"
                  : "bg-white border-gray-200"
              )}>
                <Printer className={cn(
                  "w-24 h-24 mb-8 opacity-50",
                  theme === 'dark' ? "text-gray-600" : "text-gray-400"
                )} />

                <h3 className={cn(
                  "text-2xl font-bold mb-4",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  Sistema de Impresión de Etiquetas
                </h3>

                <p className={cn(
                  "text-base mb-8 max-w-3xl mx-auto text-center",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  Selecciona las cajas del inventario para imprimir sus códigos de barras.
                  Cada etiqueta incluirá el código único, dimensiones y capacidad de la caja.
                </p>

                {selectedBoxes.length > 0 && (
                  <div className={cn(
                    "rounded-xl p-6 mb-8 w-full max-w-md",
                    theme === 'dark' ? "bg-blue-900/20 border border-blue-700" : "bg-blue-50 border border-blue-200"
                  )}>
                    <p className={cn(
                      "text-lg font-semibold text-center",
                      theme === 'dark' ? "text-blue-400" : "text-blue-600"
                    )}>
                      {selectedBoxes.length} caja(s) seleccionada(s) para impresión
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full">
                  <div className={cn(
                    "rounded-xl p-8 text-center",
                    theme === 'dark' ? "bg-gray-700/50" : "bg-gray-50"
                  )}>
                    <div className={cn(
                      "w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center",
                      theme === 'dark' ? "bg-blue-900/30" : "bg-blue-100"
                    )}>
                      <QrCode className={cn(
                        "w-8 h-8",
                        theme === 'dark' ? "text-blue-400" : "text-blue-600"
                      )} />
                    </div>
                    <h4 className={cn(
                      "text-lg font-semibold mb-2",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      Códigos de Barras
                    </h4>
                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Generación automática de códigos únicos para cada caja
                    </p>
                  </div>

                  <div className={cn(
                    "rounded-xl p-8 text-center",
                    theme === 'dark' ? "bg-gray-700/50" : "bg-gray-50"
                  )}>
                    <div className={cn(
                      "w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center",
                      theme === 'dark' ? "bg-green-900/30" : "bg-green-100"
                    )}>
                      <Package2 className={cn(
                        "w-8 h-8",
                        theme === 'dark' ? "text-green-400" : "text-green-600"
                      )} />
                    </div>
                    <h4 className={cn(
                      "text-lg font-semibold mb-2",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      Información Completa
                    </h4>
                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Dimensiones y capacidad en cada etiqueta impresa
                    </p>
                  </div>

                  <div className={cn(
                    "rounded-xl p-8 text-center",
                    theme === 'dark' ? "bg-gray-700/50" : "bg-gray-50"
                  )}>
                    <div className={cn(
                      "w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center",
                      theme === 'dark' ? "bg-purple-900/30" : "bg-purple-100"
                    )}>
                      <Printer className={cn(
                        "w-8 h-8",
                        theme === 'dark' ? "text-purple-400" : "text-purple-600"
                      )} />
                    </div>
                    <h4 className={cn(
                      "text-lg font-semibold mb-2",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      Impresión en Lote
                    </h4>
                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Imprime múltiples etiquetas simultáneamente
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modales simplificados - Placeholder para implementación completa */}
      {showBoxModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={cn(
            "rounded-xl p-6 max-w-md w-full mx-4",
            theme === 'dark' ? "bg-gray-800" : "bg-white"
          )}>
            <h3 className={cn(
              "text-lg font-semibold mb-4",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              Nueva Caja
            </h3>
            <p className={cn(
              "text-sm mb-4",
              theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>
              Formulario de creación de caja en desarrollo...
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowBoxModal(false)}
                className="bg-gray-500 hover:bg-gray-600 text-white"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {showPriceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={cn(
            "rounded-xl p-6 max-w-md w-full mx-4",
            theme === 'dark' ? "bg-gray-800" : "bg-white"
          )}>
            <h3 className={cn(
              "text-lg font-semibold mb-4",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              Nueva Tarifa
            </h3>
            <p className={cn(
              "text-sm mb-4",
              theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>
              Formulario de precios en desarrollo...
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowPriceModal(false)}
                className="bg-gray-500 hover:bg-gray-600 text-white"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {showOrderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={cn(
            "rounded-xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto",
            theme === 'dark' ? "bg-gray-800" : "bg-white"
          )}>
            <h3 className={cn(
              "text-2xl font-bold mb-6",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              Nueva Orden de Compra
            </h3>

            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const orderData = {
                supplier: formData.get('supplier'),
                expected_delivery: formData.get('expected_delivery'),
                notes: formData.get('notes'),
                items: [
                  {
                    size: formData.get('boxSize'),
                    quantity: parseInt(formData.get('quantity')),
                    unit_price: parseFloat(formData.get('unitPrice')),
                    total_price: parseInt(formData.get('quantity')) * parseFloat(formData.get('unitPrice'))
                  }
                ]
              };
              await handleCreateOrder(orderData);
            }} className="space-y-6">
              {/* Información del Proveedor */}
              <div>
                <label className={cn(
                  "block text-sm font-medium mb-2",
                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>
                  Proveedor
                </label>
                <input
                  name="supplier"
                  type="text"
                  required
                  className={cn(
                    "w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                    theme === 'dark'
                      ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                  )}
                  placeholder="Nombre del proveedor"
                />
              </div>

              {/* Información de Cajas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                  )}>
                    Tamaño de Caja
                  </label>
                  <select
                    name="boxSize"
                    required
                    className={cn(
                      "w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                      theme === 'dark'
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    )}
                  >
                    <option value="">Seleccionar tamaño</option>
                    <option value="pequeño">Pequeño</option>
                    <option value="mediano">Mediano</option>
                    <option value="grande">Grande</option>
                    <option value="extra grande">Extra Grande</option>
                  </select>
                </div>

                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                  )}>
                    Cantidad
                  </label>
                  <input
                    name="quantity"
                    type="number"
                    min="1"
                    required
                    className={cn(
                      "w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                      theme === 'dark'
                        ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                        : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                    )}
                    placeholder="Número de cajas"
                  />
                </div>

                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                  )}>
                    Precio por Caja
                  </label>
                  <input
                    name="unitPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className={cn(
                      "w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                      theme === 'dark'
                        ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                        : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                    )}
                    placeholder="$0.00"
                  />
                </div>

                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                  )}>
                    Fecha de Entrega
                  </label>
                  <input
                    name="expected_delivery"
                    type="date"
                    required
                    className={cn(
                      "w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                      theme === 'dark'
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    )}
                  />
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className={cn(
                  "block text-sm font-medium mb-2",
                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>
                  Notas (Opcional)
                </label>
                <textarea
                  name="notes"
                  rows={3}
                  className={cn(
                    "w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none",
                    theme === 'dark'
                      ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                  )}
                  placeholder="Instrucciones especiales o notas adicionales..."
                />
              </div>

              {/* Botones */}
              <div className="flex gap-3 justify-end">
                <Button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="bg-gray-500 hover:bg-gray-600 text-white"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Crear Orden
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPrintModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={cn(
            "rounded-xl p-6 max-w-md w-full mx-4",
            theme === 'dark' ? "bg-gray-800" : "bg-white"
          )}>
            <h3 className={cn(
              "text-lg font-semibold mb-4",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              Vista Previa de Impresión
            </h3>
            <p className={cn(
              "text-sm mb-4",
              theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>
              Preparando {selectedBoxes.length} etiquetas para imprimir...
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowPrintModal(false)}
                className="bg-gray-500 hover:bg-gray-600 text-white"
              >
                Cancelar
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Package Label Printer Modal */}
      {selectedBoxForLabel && (
        <PackageLabelPrinter
          box={selectedBoxForLabel}
          isVisible={showLabelPrinter}
          onClose={() => {
            setShowLabelPrinter(false)
            setSelectedBoxForLabel(null)
          }}
        />
      )}
    </DashboardLayout>
  )
}