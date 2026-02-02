'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Package,
  Warehouse,
  CheckCircle,
  Loader2,
  Truck,
  Scale,
  AlertTriangle
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

type Step = 'warehouse' | 'products' | 'confirm'

interface ProductionOrder {
  id: number
  orderNumber: string
  status: string
  sourceProduct: {
    id: number
    name: string
    sku: string | null
  }
  sourceWarehouse: {
    id: number
    name: string
    code: string
  }
  sourceWeightKg: number
  materials: Array<{
    id: number
    productId: number
    productName: string
    warehouseId: number
    warehouseName: string
    quantity: number
  }>
}

interface WarehouseOption {
  id: number
  code: string
  name: string
  city: string | null
}

export default function DeliverMaterialsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { theme } = useTheme()
  const [currentStep, setCurrentStep] = useState<Step>('warehouse')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [order, setOrder] = useState<ProductionOrder | null>(null)
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([fetchOrder(), fetchWarehouses()])
  }, [resolvedParams.id])

  const fetchOrder = async () => {
    try {
      const response = await fetch(`/api/market/production/orders/${resolvedParams.id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setOrder(data.data)
          setSelectedWarehouseId(data.data.sourceWarehouse.id)
        }
      }
    } catch (error) {
      console.error('Error fetching order:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/market/warehouses?limit=100')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setWarehouses(data.data.warehouses || data.data || [])
        }
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error)
    }
  }

  const goToNextStep = () => {
    if (currentStep === 'warehouse') {
      if (!selectedWarehouseId) {
        setError('Seleccione un almacén')
        return
      }
      setCurrentStep('products')
    } else if (currentStep === 'products') {
      setCurrentStep('confirm')
    }
    setError('')
  }

  const goToPrevStep = () => {
    if (currentStep === 'products') setCurrentStep('warehouse')
    else if (currentStep === 'confirm') setCurrentStep('products')
    setError('')
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')

    try {
      const response = await fetch(`/api/market/production/orders/${resolvedParams.id}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceWarehouseId: selectedWarehouseId,
          materials: order?.materials.map(m => ({
            productId: m.productId,
            warehouseId: m.warehouseId,
            quantity: m.quantity
          })),
          notes
        })
      })

      const data = await response.json()

      if (data.success) {
        router.push(`/dashboard/market/production/dosification/${resolvedParams.id}`)
      } else {
        setError(data.error || 'Error al entregar materiales')
      }
    } catch (error) {
      console.error('Error:', error)
      setError('Error al entregar materiales')
    } finally {
      setSubmitting(false)
    }
  }

  const formatWeight = (kg: number) => kg.toFixed(3) + ' kg'

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
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
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId)

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen">
          {/* Header */}
          <div className={cn(
            'sticky top-0 z-10 border-b backdrop-blur-lg',
            theme === 'dark'
              ? 'bg-gray-900/80 border-gray-800'
              : 'bg-white/80 border-gray-200'
          )}>
            <div className="max-w-4xl mx-auto px-6 py-4">
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
                    <h1 className={cn(
                      'text-xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Entrega de Materiales
                    </h1>
                    <p className={cn(
                      'text-sm',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      {order.orderNumber}
                    </p>
                  </div>
                </div>
              </div>

              {/* Step indicators */}
              <div className="flex items-center justify-center mt-6 gap-4">
                {(['warehouse', 'products', 'confirm'] as Step[]).map((step, index) => {
                  const isActive = step === currentStep
                  const isPassed = (currentStep === 'products' && step === 'warehouse') ||
                                   (currentStep === 'confirm' && step !== 'confirm')

                  return (
                    <div key={step} className="flex items-center">
                      <div className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-xl transition-all',
                        isActive
                          ? theme === 'dark'
                            ? 'bg-blue-900/50 border border-blue-700'
                            : 'bg-blue-100 border border-blue-300'
                          : isPassed
                            ? theme === 'dark'
                              ? 'bg-blue-900/30'
                              : 'bg-blue-50'
                            : theme === 'dark'
                              ? 'bg-gray-800'
                              : 'bg-gray-100'
                      )}>
                        <span className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold',
                          isActive || isPassed
                            ? 'bg-blue-600 text-white'
                            : theme === 'dark'
                              ? 'bg-gray-700 text-gray-400'
                              : 'bg-gray-200 text-gray-500'
                        )}>
                          {isPassed ? <CheckCircle className="w-4 h-4" /> : index + 1}
                        </span>
                        <span className={cn(
                          'text-sm font-medium hidden sm:inline',
                          isActive || isPassed
                            ? 'text-blue-600'
                            : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        )}>
                          {step === 'warehouse' ? 'Almacén' :
                           step === 'products' ? 'Productos' : 'Confirmar'}
                        </span>
                      </div>
                      {index < 2 && (
                        <div className={cn(
                          'w-8 h-0.5 mx-1',
                          isPassed || (currentStep === 'confirm' && index < 2)
                            ? 'bg-blue-500'
                            : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                        )} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="max-w-3xl mx-auto px-6 py-8">
            {/* Step 1: Warehouse */}
            {currentStep === 'warehouse' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
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
                    Seleccionar Almacén de Origen
                  </h2>
                  <p className={cn(
                    'text-sm mb-6',
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Confirme el almacén desde donde se entregarán los materiales.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {warehouses.map(w => (
                      <button
                        key={w.id}
                        onClick={() => setSelectedWarehouseId(w.id)}
                        className={cn(
                          'p-4 rounded-xl border-2 text-left transition-all',
                          selectedWarehouseId === w.id
                            ? theme === 'dark'
                              ? 'border-blue-500 bg-blue-900/20'
                              : 'border-blue-500 bg-blue-50'
                            : theme === 'dark'
                              ? 'border-gray-700 hover:border-gray-600'
                              : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-10 h-10 rounded-lg flex items-center justify-center',
                            selectedWarehouseId === w.id
                              ? 'bg-blue-500 text-white'
                              : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                          )}>
                            <Warehouse className="w-5 h-5" />
                          </div>
                          <div>
                            <p className={cn(
                              'font-medium',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {w.name}
                            </p>
                            <p className="text-sm text-gray-500">{w.code}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Products */}
            {currentStep === 'products' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
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
                    Productos a Entregar
                  </h2>

                  {/* Source Product */}
                  <div className={cn(
                    'p-4 rounded-xl border mb-4',
                    theme === 'dark'
                      ? 'bg-blue-900/20 border-blue-800'
                      : 'bg-blue-50 border-blue-200'
                  )}>
                    <p className="text-xs text-blue-600 mb-2">MATERIA PRIMA</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-12 h-12 rounded-lg flex items-center justify-center',
                          theme === 'dark' ? 'bg-gray-700' : 'bg-blue-100'
                        )}>
                          <Package className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                          <p className={cn(
                            'font-semibold',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {order.sourceProduct.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            SKU: {order.sourceProduct.sku || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          'text-xl font-bold',
                          theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                        )}>
                          {formatWeight(order.sourceWeightKg)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Materials */}
                  {order.materials.length > 0 && (
                    <>
                      <p className="text-xs text-gray-500 mb-2 mt-6">MATERIALES DE EMPAQUE</p>
                      <div className="space-y-3">
                        {order.materials.map(m => (
                          <div
                            key={m.id}
                            className={cn(
                              'flex items-center justify-between p-4 rounded-xl',
                              theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                            )}
                          >
                            <div>
                              <p className={cn(
                                'font-medium',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {m.productName}
                              </p>
                              <p className="text-sm text-gray-500">{m.warehouseName}</p>
                            </div>
                            <span className={cn(
                              'text-lg font-bold',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              × {m.quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 3: Confirm */}
            {currentStep === 'confirm' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
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
                    Confirmar Entrega
                  </h2>

                  <div className={cn(
                    'p-4 rounded-xl mb-6',
                    theme === 'dark' ? 'bg-amber-900/20 border border-amber-800' : 'bg-amber-50 border border-amber-200'
                  )}>
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-amber-600 font-medium">
                          Al confirmar, el inventario será descontado
                        </p>
                        <p className="text-sm text-amber-600/80 mt-1">
                          Se descontará la materia prima y los materiales del almacén {selectedWarehouse?.name}.
                          La orden pasará a estado "En Proceso".
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        Almacén de origen
                      </span>
                      <span className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {selectedWarehouse?.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        Materia prima
                      </span>
                      <span className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {order.sourceProduct.name} ({formatWeight(order.sourceWeightKg)})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        Materiales
                      </span>
                      <span className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {order.materials.length} tipos
                      </span>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="mt-6">
                    <label className={cn(
                      'block text-sm font-medium mb-2',
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Notas (opcional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Observaciones de la entrega..."
                      rows={3}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 resize-none',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 text-white focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:ring-blue-500/20'
                      )}
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-4 rounded-xl bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8">
              <button
                onClick={goToPrevStep}
                disabled={currentStep === 'warehouse'}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 rounded-xl transition-all',
                  currentStep === 'warehouse'
                    ? 'opacity-50 cursor-not-allowed'
                    : theme === 'dark'
                      ? 'hover:bg-gray-800 text-gray-300'
                      : 'hover:bg-gray-100 text-gray-600'
                )}
              >
                <ArrowLeft className="w-5 h-5" />
                Anterior
              </button>

              {currentStep === 'confirm' ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={submitting}
                  className={cn(
                    'flex items-center gap-2 px-8 py-3 rounded-xl font-semibold transition-all',
                    'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
                    'hover:from-blue-600 hover:to-blue-700',
                    'shadow-lg shadow-blue-500/25',
                    submitting && 'opacity-75 cursor-not-allowed'
                  )}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Entregando...
                    </>
                  ) : (
                    <>
                      <Truck className="w-5 h-5" />
                      Confirmar Entrega
                    </>
                  )}
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={goToNextStep}
                  className={cn(
                    'flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all',
                    'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
                    'hover:from-blue-600 hover:to-blue-700'
                  )}
                >
                  Siguiente
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
