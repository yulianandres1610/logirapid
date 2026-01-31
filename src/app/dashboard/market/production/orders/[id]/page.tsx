'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Factory,
  ArrowLeft,
  Package,
  Loader2,
  DollarSign,
  Check,
  X,
  Warehouse,
  Calendar,
  BookOpen,
  AlertTriangle,
  PlayCircle,
  CheckCircle,
  XCircle,
  FileText,
  Clock,
  ArrowRight,
  Truck
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface ProductionOrderLine {
  id: number
  productId: number
  productName: string
  productSku: string
  productUnit: string
  variantId: number | null
  variantName: string | null
  quantityPlanned: number
  quantityConsumed: number
  unitCost: number
  totalCost: number
  lineStatus: string
  stockAvailable: number
  hasEnoughStock: boolean
}

interface ProductionOrder {
  id: number
  productionNumber: string
  bomId: number
  bomCode: string
  bomName: string
  bomOutputQuantity: number
  bomOutputUnit: string
  productId: number
  productName: string
  productSku: string
  productImage: string | null
  warehouse: {
    id: number
    name: string
    code: string
  }
  quantityToProduce: number
  quantityProduced: number
  totalMaterialCost: number
  unitCost: number
  status: string
  materialOutOperationId: number | null
  materialOutOperationNumber: string | null
  productInOperationId: number | null
  productInOperationNumber: string | null
  scheduledDate: string | null
  startedAt: string | null
  completedAt: string | null
  notes: string | null
  createdBy: string
  confirmedBy: string | null
  completedBy: string | null
  createdAt: string
  lines: ProductionOrderLine[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; gradient: string; step: number }> = {
  draft: { label: 'Borrador', color: 'gray', icon: FileText, gradient: 'from-gray-400 to-gray-600', step: 1 },
  confirmed: { label: 'Confirmada', color: 'blue', icon: CheckCircle, gradient: 'from-blue-400 to-blue-600', step: 2 },
  materials_out: { label: 'Mat. Entregados', color: 'amber', icon: Truck, gradient: 'from-amber-400 to-orange-600', step: 3 },
  in_production: { label: 'En Producción', color: 'purple', icon: PlayCircle, gradient: 'from-purple-400 to-purple-600', step: 4 },
  completed: { label: 'Completada', color: 'emerald', icon: CheckCircle, gradient: 'from-emerald-400 to-green-600', step: 5 },
  cancelled: { label: 'Cancelada', color: 'red', icon: XCircle, gradient: 'from-red-400 to-rose-600', step: -1 }
}

export default function ProductionOrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { theme } = useTheme()
  const orderId = params.id as string

  const [order, setOrder] = useState<ProductionOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Complete production modal
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [quantityProduced, setQuantityProduced] = useState<number>(0)
  const [updateProductCost, setUpdateProductCost] = useState(false)
  const [completionNotes, setCompletionNotes] = useState('')

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/market/production-orders/${orderId}`)
      const data = await response.json()

      if (data.success) {
        setOrder(data.data)
        setQuantityProduced(data.data.quantityToProduce)
      } else {
        alert(data.error || 'Error al cargar orden')
        router.push('/dashboard/market/production')
      }
    } catch (error) {
      console.error('Error fetching order:', error)
      router.push('/dashboard/market/production')
    } finally {
      setLoading(false)
    }
  }, [orderId, router])

  useEffect(() => {
    if (orderId) {
      fetchOrder()
    }
  }, [orderId, fetchOrder])

  const handleConfirm = async () => {
    if (!confirm('¿Confirmar esta orden? Los materiales serán reservados.')) return

    try {
      setActionLoading(true)
      const response = await fetch(`/api/market/production-orders/${orderId}/confirm`, {
        method: 'POST'
      })
      const data = await response.json()

      if (data.success) {
        fetchOrder()
      } else {
        alert(data.error || 'Error al confirmar orden')
      }
    } catch (error) {
      console.error('Error confirming order:', error)
      alert('Error al confirmar orden')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeliverMaterials = async () => {
    if (!confirm('¿Entregar todos los materiales a producción? El stock será descontado.')) return

    try {
      setActionLoading(true)
      const response = await fetch(`/api/market/production-orders/${orderId}/deliver-materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await response.json()

      if (data.success) {
        fetchOrder()
        alert(data.message)
      } else {
        alert(data.error || 'Error al entregar materiales')
      }
    } catch (error) {
      console.error('Error delivering materials:', error)
      alert('Error al entregar materiales')
    } finally {
      setActionLoading(false)
    }
  }

  const handleComplete = async () => {
    if (quantityProduced <= 0) {
      alert('La cantidad producida debe ser mayor a 0')
      return
    }

    try {
      setActionLoading(true)
      const response = await fetch(`/api/market/production-orders/${orderId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantityProduced,
          updateProductCost,
          notes: completionNotes.trim() || null
        })
      })
      const data = await response.json()

      if (data.success) {
        setShowCompleteModal(false)
        fetchOrder()
        alert(data.message)
      } else {
        alert(data.error || 'Error al completar producción')
      }
    } catch (error) {
      console.error('Error completing production:', error)
      alert('Error al completar producción')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('¿Está seguro de cancelar esta orden?')) return

    try {
      setActionLoading(true)
      const response = await fetch(`/api/market/production-orders/${orderId}`, {
        method: 'DELETE'
      })
      const data = await response.json()

      if (data.success) {
        router.push('/dashboard/market/production')
      } else {
        alert(data.error || 'Error al cancelar orden')
      }
    } catch (error) {
      console.error('Error cancelling order:', error)
      alert('Error al cancelar orden')
    } finally {
      setActionLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <ProtectedRoute requiredRole={['SUPER_ADMIN', 'ADMIN', 'MARKET_ADMIN', 'MARKET_MANAGER', 'MARKET_COMERCIAL', 'MARKET_ALMACENERO']}>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (!order) {
    return null
  }

  const currentStatus = STATUS_CONFIG[order.status] || STATUS_CONFIG.draft
  const CurrentIcon = currentStatus.icon

  return (
    <ProtectedRoute requiredRole={['SUPER_ADMIN', 'ADMIN', 'MARKET_ADMIN', 'MARKET_MANAGER', 'MARKET_COMERCIAL', 'MARKET_ALMACENERO']}>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/market/production"
                className={cn(
                  "p-2 rounded-lg transition-all",
                  theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                )}
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className={cn(
                  "text-2xl font-bold flex items-center gap-2",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  <Factory className="w-7 h-7 text-purple-500" />
                  {order.productionNumber}
                </h1>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  {order.bomName} • {order.productName}
                </p>
              </div>
            </div>

            <span className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium",
              `bg-gradient-to-r ${currentStatus.gradient} text-white`
            )}>
              <CurrentIcon className="w-4 h-4" />
              {currentStatus.label}
            </span>
          </div>

          {/* Progress Steps */}
          {order.status !== 'cancelled' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "p-4 rounded-2xl border shadow-xl mb-6",
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              <div className="flex items-center justify-between">
                {['draft', 'confirmed', 'materials_out', 'in_production', 'completed'].map((step, index) => {
                  const stepConfig = STATUS_CONFIG[step]
                  const StepIcon = stepConfig.icon
                  const isActive = order.status === step
                  const isCompleted = stepConfig.step < (STATUS_CONFIG[order.status]?.step || 0)

                  return (
                    <React.Fragment key={step}>
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                          isActive
                            ? `bg-gradient-to-r ${stepConfig.gradient} text-white`
                            : isCompleted
                              ? 'bg-green-500 text-white'
                              : theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                        )}>
                          {isCompleted ? (
                            <Check className="w-5 h-5" />
                          ) : (
                            <StepIcon className="w-5 h-5" />
                          )}
                        </div>
                        <span className={cn(
                          "text-xs mt-2",
                          isActive || isCompleted
                            ? theme === 'dark' ? 'text-white' : 'text-gray-900'
                            : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        )}>
                          {stepConfig.label}
                        </span>
                      </div>
                      {index < 4 && (
                        <div className={cn(
                          "flex-1 h-1 mx-2 rounded",
                          isCompleted
                            ? 'bg-green-500'
                            : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                        )} />
                      )}
                    </React.Fragment>
                  )
                })}
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Product Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-6 rounded-2xl border shadow-xl",
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <h2 className={cn(
                  "font-semibold mb-4",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Producto a fabricar
                </h2>

                <div className="flex items-center gap-4">
                  {order.productImage ? (
                    <img src={order.productImage} alt="" className="w-20 h-20 rounded-lg object-cover" />
                  ) : (
                    <div className={cn(
                      "w-20 h-20 rounded-lg flex items-center justify-center",
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    )}>
                      <Package className="w-10 h-10 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <p className={cn(
                      "font-semibold text-lg",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {order.productName}
                    </p>
                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      SKU: {order.productSku}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className={cn(
                        "text-sm",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>
                        Receta: <strong>{order.bomCode}</strong>
                      </span>
                      <span className={cn(
                        "text-sm",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>
                        Almacén: <strong>{order.warehouse.name}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Materials List */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  "p-6 rounded-2xl border shadow-xl",
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <h2 className={cn(
                  "font-semibold mb-4",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Materiales
                </h2>

                <div className="space-y-3">
                  {order.lines.map((line) => (
                    <div
                      key={line.id}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-lg",
                        line.lineStatus === 'consumed'
                          ? theme === 'dark' ? 'bg-green-900/20 border border-green-700' : 'bg-green-50 border border-green-200'
                          : line.lineStatus === 'delivered'
                            ? theme === 'dark' ? 'bg-amber-900/20 border border-amber-700' : 'bg-amber-50 border border-amber-200'
                            : !line.hasEnoughStock
                              ? theme === 'dark' ? 'bg-red-900/20 border border-red-700' : 'bg-red-50 border border-red-200'
                              : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {line.lineStatus === 'consumed' ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : line.lineStatus === 'delivered' ? (
                          <Truck className="w-5 h-5 text-amber-500" />
                        ) : line.hasEnoughStock ? (
                          <Package className="w-5 h-5 text-gray-400" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                        )}
                        <div>
                          <p className={cn(
                            "font-medium",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {line.productName}
                            {line.variantName && ` - ${line.variantName}`}
                          </p>
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            {line.productSku} • {formatCurrency(line.unitCost)}/{line.productUnit}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "font-medium",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {line.quantityConsumed > 0 ? (
                            <span>{line.quantityConsumed} / {line.quantityPlanned} {line.productUnit}</span>
                          ) : (
                            <span>{line.quantityPlanned} {line.productUnit}</span>
                          )}
                        </p>
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        )}>
                          {formatCurrency(line.totalCost)}
                        </p>
                        {order.status === 'draft' && (
                          <p className={cn(
                            "text-xs",
                            line.hasEnoughStock
                              ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
                              : theme === 'dark' ? 'text-red-400' : 'text-red-600'
                          )}>
                            Stock: {line.stockAvailable.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Summary */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  "p-6 rounded-2xl border shadow-xl",
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <h2 className={cn(
                  "font-semibold mb-4",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Resumen
                </h2>

                <div className="space-y-4">
                  <div className={cn(
                    "p-4 rounded-lg",
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                  )}>
                    <p className={cn(
                      "text-sm mb-1",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Cantidad
                    </p>
                    <p className={cn(
                      "text-2xl font-bold",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {order.quantityProduced > 0 ? (
                        <span>{order.quantityProduced} / {order.quantityToProduce}</span>
                      ) : (
                        order.quantityToProduce
                      )} {order.bomOutputUnit}
                    </p>
                  </div>

                  <div className={cn(
                    "p-4 rounded-lg",
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                  )}>
                    <p className={cn(
                      "text-sm mb-1",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Costo total materiales
                    </p>
                    <p className={cn(
                      "text-2xl font-bold",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {formatCurrency(order.totalMaterialCost)}
                    </p>
                  </div>

                  <div className={cn(
                    "p-4 rounded-lg",
                    theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-50'
                  )}>
                    <p className={cn(
                      "text-sm mb-1",
                      theme === 'dark' ? 'text-purple-300' : 'text-purple-700'
                    )}>
                      Costo por unidad
                    </p>
                    <p className={cn(
                      "text-2xl font-bold",
                      theme === 'dark' ? 'text-purple-300' : 'text-purple-700'
                    )}>
                      {formatCurrency(order.unitCost)}
                    </p>
                  </div>

                  {/* Dates */}
                  <div className={cn(
                    "p-4 rounded-lg space-y-2",
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                  )}>
                    {order.scheduledDate && (
                      <div className="flex justify-between text-sm">
                        <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Programada:</span>
                        <span className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>{formatDate(order.scheduledDate)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Creada:</span>
                      <span className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>{formatDate(order.createdAt)}</span>
                    </div>
                    {order.startedAt && (
                      <div className="flex justify-between text-sm">
                        <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Iniciada:</span>
                        <span className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>{formatDate(order.startedAt)}</span>
                      </div>
                    )}
                    {order.completedAt && (
                      <div className="flex justify-between text-sm">
                        <span className={cn(theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Completada:</span>
                        <span className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>{formatDate(order.completedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Actions */}
              {order.status !== 'completed' && order.status !== 'cancelled' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className={cn(
                    "p-6 rounded-2xl border shadow-xl space-y-3",
                    theme === 'dark'
                      ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                      : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                  )}
                >
                  <h2 className={cn(
                    "font-semibold mb-4",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Acciones
                  </h2>

                  {order.status === 'draft' && (
                    <button
                      onClick={handleConfirm}
                      disabled={actionLoading}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all",
                        "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                      )}
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Confirmar Orden
                    </button>
                  )}

                  {order.status === 'confirmed' && (
                    <button
                      onClick={handleDeliverMaterials}
                      disabled={actionLoading}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all",
                        "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
                      )}
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Truck className="w-4 h-4" />
                      )}
                      Entregar Materiales
                    </button>
                  )}

                  {(order.status === 'materials_out' || order.status === 'in_production') && (
                    <button
                      onClick={() => setShowCompleteModal(true)}
                      disabled={actionLoading}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all",
                        "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                      )}
                    >
                      <CheckCircle className="w-4 h-4" />
                      Completar Producción
                    </button>
                  )}

                  {order.status !== 'completed' && (
                    <button
                      onClick={handleCancel}
                      disabled={actionLoading}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
                        theme === 'dark'
                          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                          : 'bg-red-50 text-red-600 hover:bg-red-100'
                      )}
                    >
                      <XCircle className="w-4 h-4" />
                      Cancelar Orden
                    </button>
                  )}
                </motion.div>
              )}
            </div>
          </div>

          {/* Complete Production Modal */}
          {showCompleteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "w-full max-w-md p-6 rounded-xl",
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                )}
              >
                <h3 className={cn(
                  "text-lg font-semibold mb-4",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Completar Producción
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-1",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Cantidad producida *
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={quantityProduced}
                        onChange={(e) => setQuantityProduced(parseFloat(e.target.value) || 0)}
                        min="0.001"
                        step="0.001"
                        className={cn(
                          "flex-1 px-4 py-2 rounded-lg border",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-gray-50 border-gray-200 text-gray-900'
                        )}
                      />
                      <span className={cn(
                        "text-sm",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>
                        / {order.quantityToProduce} {order.bomOutputUnit}
                      </span>
                    </div>
                    {quantityProduced < order.quantityToProduce && (
                      <p className={cn(
                        "text-xs mt-1",
                        theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                      )}>
                        Merma: {(order.quantityToProduce - quantityProduced).toFixed(2)} {order.bomOutputUnit}
                      </p>
                    )}
                  </div>

                  <div className={cn(
                    "p-3 rounded-lg",
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                  )}>
                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Costo final por unidad:
                    </p>
                    <p className={cn(
                      "text-lg font-bold",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {formatCurrency(quantityProduced > 0 ? order.totalMaterialCost / quantityProduced : 0)}
                    </p>
                  </div>

                  <label className={cn(
                    "flex items-center gap-2 cursor-pointer",
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    <input
                      type="checkbox"
                      checked={updateProductCost}
                      onChange={(e) => setUpdateProductCost(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm">
                      Actualizar costo del producto automáticamente
                    </span>
                  </label>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-1",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Notas (opcional)
                    </label>
                    <textarea
                      value={completionNotes}
                      onChange={(e) => setCompletionNotes(e.target.value)}
                      rows={2}
                      placeholder="Observaciones de la producción..."
                      className={cn(
                        "w-full px-4 py-2 rounded-lg border resize-none",
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-gray-50 border-gray-200 text-gray-900'
                      )}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCompleteModal(false)}
                      className={cn(
                        "flex-1 px-4 py-2 rounded-lg font-medium",
                        theme === 'dark'
                          ? 'bg-gray-700 text-white hover:bg-gray-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleComplete}
                      disabled={actionLoading || quantityProduced <= 0}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium",
                        "bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                      )}
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Completar
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
