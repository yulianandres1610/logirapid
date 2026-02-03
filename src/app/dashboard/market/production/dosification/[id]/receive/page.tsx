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
  PackageCheck,
  Scale,
  AlertTriangle,
  Minus,
  Plus,
  Calendar
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
  targetProduct: {
    id: number
    name: string
    sku: string | null
  }
  targetWarehouse: {
    id: number
    name: string
    code: string
  }
  targetQuantity: number
  targetPortionWeightKg: number
  sourceWeightKg: number
  wasteSurplus: {
    kg: number
    type: string
  }
  costs: {
    perUnit: number
  }
}

interface WarehouseOption {
  id: number
  code: string
  name: string
  city: string | null
}

export default function ReceiveProductionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { theme } = useTheme()
  const [currentStep, setCurrentStep] = useState<Step>('warehouse')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [order, setOrder] = useState<ProductionOrder | null>(null)
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null)
  const [quantityReceived, setQuantityReceived] = useState(0)
  const [expirationDate, setExpirationDate] = useState('')
  const [observations, setObservations] = useState('')
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
          setSelectedWarehouseId(data.data.targetWarehouse.id)
          setQuantityReceived(data.data.targetQuantity)
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
      if (quantityReceived <= 0) {
        setError('Ingrese una cantidad válida')
        return
      }
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
      const response = await fetch(`/api/market/production/orders/${resolvedParams.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetWarehouseId: selectedWarehouseId,
          quantityReceived,
          expirationDate: expirationDate || undefined,
          observations
        })
      })

      const data = await response.json()

      if (data.success) {
        router.push(`/dashboard/market/production/dosification/${resolvedParams.id}`)
      } else {
        setError(data.error || 'Error al recibir producción')
      }
    } catch (error) {
      console.error('Error:', error)
      setError('Error al recibir producción')
    } finally {
      setSubmitting(false)
    }
  }

  const formatWeight = (kg: number) => kg.toFixed(3) + ' kg'
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value)
  }

  if (loading || !order) {
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

  const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId)
  const quantityDifference = quantityReceived - order.targetQuantity
  const hasDiscrepancy = quantityDifference !== 0

  const actualTotalWeight = quantityReceived * order.targetPortionWeightKg
  const actualWasteSurplus = order.sourceWeightKg - actualTotalWeight
  const actualWasteSurplusType = actualWasteSurplus > 0.001 ? 'surplus' :
                                 actualWasteSurplus < -0.001 ? 'waste' : 'exact'

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
                      Recepción de Producción
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
                            ? 'bg-emerald-900/50 border border-emerald-700'
                            : 'bg-emerald-100 border border-emerald-300'
                          : isPassed
                            ? theme === 'dark'
                              ? 'bg-emerald-900/30'
                              : 'bg-emerald-50'
                            : theme === 'dark'
                              ? 'bg-gray-800'
                              : 'bg-gray-100'
                      )}>
                        <span className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold',
                          isActive || isPassed
                            ? 'bg-emerald-600 text-white'
                            : theme === 'dark'
                              ? 'bg-gray-700 text-gray-400'
                              : 'bg-gray-200 text-gray-500'
                        )}>
                          {isPassed ? <CheckCircle className="w-4 h-4" /> : index + 1}
                        </span>
                        <span className={cn(
                          'text-sm font-medium hidden sm:inline',
                          isActive || isPassed
                            ? 'text-emerald-600'
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
                            ? 'bg-emerald-500'
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
                    Seleccionar Almacén Destino
                  </h2>
                  <p className={cn(
                    'text-sm mb-6',
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Confirme el almacén donde se recibirán los productos terminados.
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
                              ? 'border-emerald-500 bg-emerald-900/20'
                              : 'border-emerald-500 bg-emerald-50'
                            : theme === 'dark'
                              ? 'border-gray-700 hover:border-gray-600'
                              : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-10 h-10 rounded-lg flex items-center justify-center',
                            selectedWarehouseId === w.id
                              ? 'bg-emerald-500 text-white'
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
                    Productos Recibidos
                  </h2>

                  {/* Target Product */}
                  <div className={cn(
                    'p-4 rounded-xl border mb-6',
                    theme === 'dark'
                      ? 'bg-emerald-900/20 border-emerald-800'
                      : 'bg-emerald-50 border-emerald-200'
                  )}>
                    <p className="text-xs text-emerald-600 mb-2">PRODUCTO TERMINADO</p>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={cn(
                        'w-14 h-14 rounded-lg flex items-center justify-center',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-emerald-100'
                      )}>
                        <PackageCheck className="w-7 h-7 text-emerald-500" />
                      </div>
                      <div className="flex-1">
                        <p className={cn(
                          'font-semibold',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {order.targetProduct.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatWeight(order.targetPortionWeightKg)} / unidad
                        </p>
                      </div>
                    </div>

                    {/* Quantity Input */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Esperado: {order.targetQuantity} unidades</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setQuantityReceived(Math.max(0, quantityReceived - 1))}
                          className={cn(
                            'p-2 rounded-lg transition-colors',
                            theme === 'dark'
                              ? 'bg-gray-700 hover:bg-gray-600'
                              : 'bg-gray-200 hover:bg-gray-300'
                          )}
                        >
                          <Minus className="w-5 h-5" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={quantityReceived}
                          onChange={(e) => setQuantityReceived(Math.max(0, parseInt(e.target.value) || 0))}
                          className={cn(
                            'w-20 px-3 py-2 text-center text-xl font-bold rounded-lg border focus:outline-none focus:ring-2',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-600 text-white focus:ring-emerald-500/20'
                              : 'bg-white border-gray-200 text-gray-900 focus:ring-emerald-500/20'
                          )}
                        />
                        <button
                          onClick={() => setQuantityReceived(quantityReceived + 1)}
                          className={cn(
                            'p-2 rounded-lg transition-colors',
                            theme === 'dark'
                              ? 'bg-gray-700 hover:bg-gray-600'
                              : 'bg-gray-200 hover:bg-gray-300'
                          )}
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Discrepancy Alert */}
                  {hasDiscrepancy && (
                    <div className={cn(
                      'p-4 rounded-xl',
                      quantityDifference > 0
                        ? theme === 'dark'
                          ? 'bg-green-900/20 border border-green-800'
                          : 'bg-green-50 border border-green-200'
                        : theme === 'dark'
                          ? 'bg-red-900/20 border border-red-800'
                          : 'bg-red-50 border border-red-200'
                    )}>
                      <div className="flex items-center gap-3">
                        <AlertTriangle className={cn(
                          'w-5 h-5',
                          quantityDifference > 0 ? 'text-green-600' : 'text-red-600'
                        )} />
                        <div>
                          <p className={cn(
                            'font-medium',
                            quantityDifference > 0 ? 'text-green-600' : 'text-red-600'
                          )}>
                            {quantityDifference > 0 ? 'Excedente' : 'Faltante'}: {Math.abs(quantityDifference)} unidades
                          </p>
                          <p className="text-sm text-gray-500">
                            Esperado: {order.targetQuantity} | Recibido: {quantityReceived}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actual Waste/Surplus */}
                  <div className={cn(
                    'mt-4 p-4 rounded-xl',
                    actualWasteSurplusType === 'waste'
                      ? theme === 'dark'
                        ? 'bg-red-900/20 border border-red-800'
                        : 'bg-red-50 border border-red-200'
                      : actualWasteSurplusType === 'surplus'
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
                        actualWasteSurplusType === 'waste' ? 'text-red-600' :
                        actualWasteSurplusType === 'surplus' ? 'text-green-600' :
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        {actualWasteSurplusType === 'waste' ? 'Merma real' :
                         actualWasteSurplusType === 'surplus' ? 'Sobrante real' : 'Sin diferencia'}
                      </span>
                      <span className={cn(
                        'font-bold',
                        actualWasteSurplusType === 'waste' ? 'text-red-600' :
                        actualWasteSurplusType === 'surplus' ? 'text-green-600' :
                        'text-gray-600'
                      )}>
                        {actualWasteSurplusType !== 'exact' && (
                          <>
                            {actualWasteSurplusType === 'waste' ? '-' : '+'}
                            {formatWeight(Math.abs(actualWasteSurplus))}
                          </>
                        )}
                        {actualWasteSurplusType === 'exact' && formatWeight(0)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Peso fuente: {formatWeight(order.sourceWeightKg)} | Peso producido: {formatWeight(actualTotalWeight)}
                    </p>
                  </div>

                  {/* Expiration Date */}
                  <div className="mt-6">
                    <label className={cn(
                      'flex items-center gap-2 text-sm font-medium mb-2',
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      <Calendar className="w-4 h-4" />
                      Fecha de Vencimiento
                    </label>
                    <input
                      type="date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 text-white focus:ring-emerald-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:ring-emerald-500/20'
                      )}
                    />
                    <p className={cn(
                      'text-xs mt-1',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    )}>
                      Opcional. Se usará para control de lotes FIFO.
                    </p>
                  </div>
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
                    Confirmar Recepción
                  </h2>

                  <div className={cn(
                    'p-4 rounded-xl mb-6',
                    theme === 'dark' ? 'bg-emerald-900/20 border border-emerald-800' : 'bg-emerald-50 border border-emerald-200'
                  )}>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-emerald-600 font-medium">
                          Al confirmar, el inventario será actualizado
                        </p>
                        <p className="text-sm text-emerald-600/80 mt-1">
                          Se agregarán {quantityReceived} unidades de {order.targetProduct.name} al almacén {selectedWarehouse?.name}.
                          La orden será marcada como "Completada".
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        Almacén destino
                      </span>
                      <span className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {selectedWarehouse?.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        Producto
                      </span>
                      <span className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {order.targetProduct.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        Cantidad recibida
                      </span>
                      <span className={cn('font-bold', hasDiscrepancy ? (quantityDifference > 0 ? 'text-green-600' : 'text-red-600') : (theme === 'dark' ? 'text-white' : 'text-gray-900'))}>
                        {quantityReceived} unidades
                        {hasDiscrepancy && ` (${quantityDifference > 0 ? '+' : ''}${quantityDifference})`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        {actualWasteSurplusType === 'waste' ? 'Merma' : 'Sobrante'} real
                      </span>
                      <span className={cn(
                        'font-medium',
                        actualWasteSurplusType === 'waste' ? 'text-red-600' :
                        actualWasteSurplusType === 'surplus' ? 'text-green-600' :
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {actualWasteSurplusType !== 'exact' && (actualWasteSurplusType === 'waste' ? '-' : '+')}
                        {formatWeight(Math.abs(actualWasteSurplus))}
                      </span>
                    </div>
                    {expirationDate && (
                      <div className="flex justify-between">
                        <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                          Fecha de vencimiento
                        </span>
                        <span className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {new Date(expirationDate + 'T00:00:00').toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Observations */}
                  <div className="mt-6">
                    <label className={cn(
                      'block text-sm font-medium mb-2',
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Observaciones {hasDiscrepancy && <span className="text-red-500">*</span>}
                    </label>
                    <textarea
                      value={observations}
                      onChange={(e) => setObservations(e.target.value)}
                      placeholder={hasDiscrepancy ? "Explique la discrepancia en la cantidad..." : "Observaciones de la recepción..."}
                      rows={3}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 resize-none',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 text-white focus:ring-emerald-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:ring-emerald-500/20'
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
                    'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white',
                    'hover:from-emerald-600 hover:to-emerald-700',
                    'shadow-lg shadow-emerald-500/25',
                    submitting && 'opacity-75 cursor-not-allowed'
                  )}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Recibiendo...
                    </>
                  ) : (
                    <>
                      <PackageCheck className="w-5 h-5" />
                      Confirmar Recepción
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
                    'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white',
                    'hover:from-emerald-600 hover:to-emerald-700'
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
