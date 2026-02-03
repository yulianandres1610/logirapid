'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Package,
  Scale,
  Warehouse,
  Clock,
  CheckCircle,
  Play,
  X,
  Truck,
  PackageCheck,
  AlertTriangle,
  DollarSign,
  Calendar,
  User,
  FileText,
  ArrowRight,
  Printer
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface ProductionOrder {
  id: number
  orderNumber: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  sourceProduct: {
    id: number
    name: string
    sku: string | null
    imageUrl: string | null
    unit: string
    variantId: number | null
    variantName: string | null
  }
  targetProduct: {
    id: number
    name: string
    sku: string | null
    imageUrl: string | null
    unit: string
    variantId: number | null
    variantName: string | null
  }
  sourceWarehouse: {
    id: number
    name: string
    code: string
  }
  targetWarehouse: {
    id: number
    name: string
    code: string
  }
  sourceQuantity: number         // Cantidad de unidades del producto fuente
  sourceUnitCost: number         // Costo por unidad del producto fuente
  sourceWeightKg: number         // Peso bruto total (solo para porcionar)
  targetPortionWeightKg: number
  targetQuantity: number
  expectedTotalWeightKg: number
  wasteSurplus: {
    kg: number
    type: 'waste' | 'surplus' | 'exact'
  }
  actualQuantity: number | null
  actualWasteSurplusKg: number | null
  costs: {
    rawMaterial: number
    materials: number
    labor: number
    total: number
    perUnit: number
  }
  documents: {
    productionDocPrinted: boolean
    receptionDocPrinted: boolean
  }
  materials: Array<{
    id: number
    productId: number
    productName: string
    productSku: string | null
    productImage: string | null
    variantId: number | null
    variantName: string | null
    warehouseId: number
    warehouseName: string
    quantity: number
    unitCost: number
    totalCost: number
  }>
  activityLog: Array<{
    id: number
    action: string
    details: any
    performedBy: string
    performedAt: string
  }>
  createdBy: string
  completedBy: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  notes: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  pending: { label: 'Pendiente', color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30', icon: Clock },
  in_progress: { label: 'En Proceso', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', icon: Play },
  completed: { label: 'Completada', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircle },
  cancelled: { label: 'Cancelada', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', icon: X }
}

export default function ProductionOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { theme } = useTheme()
  const [order, setOrder] = useState<ProductionOrder | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrder()
  }, [resolvedParams.id])

  const fetchOrder = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/market/production/orders/${resolvedParams.id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setOrder(data.data)
        }
      }
    } catch (error) {
      console.error('Error fetching order:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatWeight = (kg: number) => {
    return kg.toFixed(3) + ' kg'
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (!order) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6 flex items-center justify-center">
            <div className="text-center">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-500">Orden no encontrada</p>
              <Link href="/dashboard/market/production/dosification">
                <button className="mt-3 text-emerald-500 hover:text-emerald-600">
                  Volver a órdenes
                </button>
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const statusConfig = STATUS_CONFIG[order.status]
  const StatusIcon = statusConfig.icon

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
                <button
                  onClick={() => router.back()}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    theme === 'dark'
                      ? 'hover:bg-gray-800 text-gray-400'
                      : 'hover:bg-gray-100 text-gray-600'
                  )}
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className={cn(
                      'text-2xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {order.orderNumber}
                    </h1>
                    <span className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium',
                      statusConfig.bgColor,
                      statusConfig.color
                    )}>
                      <StatusIcon className="w-4 h-4" />
                      {statusConfig.label}
                    </span>
                  </div>
                  <p className={cn(
                    'text-sm mt-1',
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Creada el {formatDate(order.createdAt)} por {order.createdBy}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                {order.status === 'pending' && (
                  <Link href={`/dashboard/market/production/dosification/${order.id}/deliver`}>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all',
                        'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
                        'hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25'
                      )}
                    >
                      <Truck className="w-5 h-5" />
                      Entregar Materiales
                    </motion.button>
                  </Link>
                )}
                {order.status === 'in_progress' && (
                  <Link href={`/dashboard/market/production/dosification/${order.id}/receive`}>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all',
                        'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white',
                        'hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25'
                      )}
                    >
                      <PackageCheck className="w-5 h-5" />
                      Recibir Producción
                    </motion.button>
                  </Link>
                )}
              </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Order Details */}
              <div className="lg:col-span-2 space-y-6">
                {/* Products Card */}
                <div className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700'
                    : 'bg-white border-gray-200'
                )}>
                  <h2 className={cn(
                    'text-lg font-semibold mb-4',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Productos
                  </h2>

                  <div className="flex items-center gap-4">
                    {/* Source Product */}
                    <div className={cn(
                      'flex-1 p-4 rounded-xl border',
                      theme === 'dark'
                        ? 'bg-gray-700/50 border-gray-600'
                        : 'bg-gray-50 border-gray-200'
                    )}>
                      <p className="text-xs text-gray-500 mb-2">PRODUCTO FUENTE</p>
                      <div className="flex items-center gap-3">
                        {order.sourceProduct.imageUrl ? (
                          <img
                            src={order.sourceProduct.imageUrl}
                            alt={order.sourceProduct.name}
                            className="w-14 h-14 rounded-xl object-cover"
                          />
                        ) : (
                          <div className={cn(
                            'w-14 h-14 rounded-xl flex items-center justify-center',
                            theme === 'dark' ? 'bg-gray-600' : 'bg-gray-100'
                          )}>
                            <Package className="w-7 h-7 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <p className={cn(
                            'font-semibold',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {order.sourceProduct.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {order.sourceQuantity} {order.sourceProduct.unit || 'unidad(es)'} × {formatCurrency(order.sourceUnitCost)}
                          </p>
                          <p className="text-xs text-gray-400">
                            Peso: {formatWeight(order.sourceWeightKg)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                        <Warehouse className="w-3 h-3" />
                        {order.sourceWarehouse.name}
                      </div>
                    </div>

                    <ArrowRight className={cn(
                      'w-6 h-6 flex-shrink-0',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    )} />

                    {/* Target Product */}
                    <div className={cn(
                      'flex-1 p-4 rounded-xl border',
                      theme === 'dark'
                        ? 'bg-emerald-900/20 border-emerald-800'
                        : 'bg-emerald-50 border-emerald-200'
                    )}>
                      <p className="text-xs text-emerald-600 mb-2">PRODUCTO FINAL</p>
                      <div className="flex items-center gap-3">
                        {order.targetProduct.imageUrl ? (
                          <img
                            src={order.targetProduct.imageUrl}
                            alt={order.targetProduct.name}
                            className="w-14 h-14 rounded-xl object-cover"
                          />
                        ) : (
                          <div className={cn(
                            'w-14 h-14 rounded-xl flex items-center justify-center',
                            theme === 'dark' ? 'bg-gray-600' : 'bg-emerald-100'
                          )}>
                            <PackageCheck className="w-7 h-7 text-emerald-500" />
                          </div>
                        )}
                        <div>
                          <p className={cn(
                            'font-semibold',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {order.targetProduct.name}
                          </p>
                          <p className="text-sm text-emerald-600">
                            {order.actualQuantity ?? order.targetQuantity} × {formatWeight(order.targetPortionWeightKg)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                        <Warehouse className="w-3 h-3" />
                        {order.targetWarehouse.name}
                      </div>
                    </div>
                  </div>

                  {/* Waste/Surplus */}
                  <div className={cn(
                    'mt-4 p-4 rounded-xl',
                    order.wasteSurplus.type === 'waste'
                      ? theme === 'dark'
                        ? 'bg-red-900/20 border border-red-800'
                        : 'bg-red-50 border border-red-200'
                      : order.wasteSurplus.type === 'surplus'
                        ? theme === 'dark'
                          ? 'bg-green-900/20 border border-green-800'
                          : 'bg-green-50 border border-green-200'
                        : theme === 'dark'
                          ? 'bg-gray-700 border border-gray-600'
                          : 'bg-gray-50 border border-gray-200'
                  )}>
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        'font-medium',
                        order.wasteSurplus.type === 'waste' ? 'text-red-600' :
                        order.wasteSurplus.type === 'surplus' ? 'text-green-600' :
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        {order.wasteSurplus.type === 'waste' ? 'Merma' :
                         order.wasteSurplus.type === 'surplus' ? 'Sobrante' : 'Sin diferencia'}
                        {order.status === 'completed' ? ' Real' : ' Esperado'}
                      </span>
                      <span className={cn(
                        'text-xl font-bold flex items-center gap-2',
                        order.wasteSurplus.type === 'waste' ? 'text-red-600' :
                        order.wasteSurplus.type === 'surplus' ? 'text-green-600' :
                        'text-gray-600'
                      )}>
                        {order.wasteSurplus.type === 'waste' && <AlertTriangle className="w-5 h-5" />}
                        {order.wasteSurplus.type === 'surplus' && <CheckCircle className="w-5 h-5" />}
                        {order.wasteSurplus.type !== 'exact' && (
                          <>
                            {order.wasteSurplus.type === 'waste' ? '-' : '+'}
                            {formatWeight(Math.abs(order.actualWasteSurplusKg ?? order.wasteSurplus.kg))}
                          </>
                        )}
                        {order.wasteSurplus.type === 'exact' && formatWeight(0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Materials Card */}
                {order.materials.length > 0 && (
                  <div className={cn(
                    'p-6 rounded-2xl border',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700'
                      : 'bg-white border-gray-200'
                  )}>
                    <h2 className={cn(
                      'text-lg font-semibold mb-4',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Materiales
                    </h2>
                    <div className="space-y-3">
                      {order.materials.map(m => (
                        <div
                          key={m.id}
                          className={cn(
                            'flex items-center gap-4 p-3 rounded-xl',
                            theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                          )}
                        >
                          <div className="flex-1">
                            <p className={cn(
                              'font-medium',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {m.productName}
                            </p>
                            <p className="text-sm text-gray-500">
                              {m.warehouseName}
                            </p>
                          </div>
                          <span className={cn(
                            'font-medium',
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          )}>
                            × {m.quantity}
                          </span>
                          <span className={cn(
                            'font-bold w-24 text-right',
                            theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                          )}>
                            {formatCurrency(m.totalCost)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Activity Log */}
                <div className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700'
                    : 'bg-white border-gray-200'
                )}>
                  <h2 className={cn(
                    'text-lg font-semibold mb-4',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Historial de Actividad
                  </h2>
                  <div className="space-y-4">
                    {order.activityLog.map((log, index) => (
                      <div key={log.id} className="flex gap-4">
                        <div className={cn(
                          'w-2 h-2 mt-2 rounded-full flex-shrink-0',
                          index === 0 ? 'bg-emerald-500' : 'bg-gray-400'
                        )} />
                        <div className="flex-1">
                          <p className={cn(
                            'text-sm font-medium',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {log.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </p>
                          <p className="text-xs text-gray-500">
                            {log.performedBy} - {formatDate(log.performedAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column - Costs & Info */}
              <div className="space-y-6">
                {/* Costs Card */}
                <div className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700'
                    : 'bg-white border-gray-200'
                )}>
                  <h2 className={cn(
                    'text-lg font-semibold mb-4 flex items-center gap-2',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    <DollarSign className="w-5 h-5" />
                    Costos
                  </h2>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <div className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        <span>Materia prima</span>
                        <span className="block text-xs">
                          ({order.sourceQuantity} × {formatCurrency(order.sourceUnitCost)})
                        </span>
                      </div>
                      <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                        {formatCurrency(order.costs.rawMaterial)}
                      </span>
                    </div>
                    {order.costs.materials > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                          Materiales
                        </span>
                        <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                          {formatCurrency(order.costs.materials)}
                        </span>
                      </div>
                    )}
                    {order.costs.labor > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                          Mano de obra
                        </span>
                        <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                          {formatCurrency(order.costs.labor)}
                        </span>
                      </div>
                    )}
                    <div className={cn(
                      'flex justify-between pt-3 border-t font-bold',
                      theme === 'dark' ? 'border-gray-600' : 'border-gray-200'
                    )}>
                      <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                        Total
                      </span>
                      <span className="text-emerald-600">
                        {formatCurrency(order.costs.total)}
                      </span>
                    </div>
                    <div className={cn(
                      'flex justify-between text-lg font-bold pt-2',
                      theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                    )}>
                      <span>Costo/Unidad</span>
                      <span>{formatCurrency(order.costs.perUnit)}</span>
                    </div>
                  </div>
                </div>

                {/* Info Card */}
                <div className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700'
                    : 'bg-white border-gray-200'
                )}>
                  <h2 className={cn(
                    'text-lg font-semibold mb-4 flex items-center gap-2',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    <FileText className="w-5 h-5" />
                    Información
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Creado por</p>
                      <p className={cn(
                        'flex items-center gap-2',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <User className="w-4 h-4 text-gray-400" />
                        {order.createdBy}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Fecha de creación</p>
                      <p className={cn(
                        'flex items-center gap-2',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {formatDate(order.createdAt)}
                      </p>
                    </div>
                    {order.startedAt && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Inicio de producción</p>
                        <p className={cn(
                          'flex items-center gap-2',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          <Play className="w-4 h-4 text-blue-500" />
                          {formatDate(order.startedAt)}
                        </p>
                      </div>
                    )}
                    {order.completedAt && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Completada</p>
                        <p className={cn(
                          'flex items-center gap-2',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          {formatDate(order.completedAt)}
                        </p>
                      </div>
                    )}
                    {order.notes && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Notas</p>
                        <p className={cn(
                          'text-sm',
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          {order.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
